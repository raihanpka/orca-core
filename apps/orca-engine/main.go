package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/go-redis/redis/v9"

	"orca/engine/internal/ai_client"
	orcadb "orca/engine/internal/db"
	"orca/engine/internal/state"
	"orca/engine/internal/subscriber"
	"orca/engine/internal/ws"
)

func getenv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func main() {
	ctx := context.Background()
	redisURL := getenv("REDIS_URL", "redis://localhost:6379")
	databaseURL := getenv("DATABASE_URL", "postgresql://orca:orca_pass@localhost:5432/orca_db")
	aiURL := getenv("AI_SERVICE_URL", "http://localhost:8000")
	port := getenv("WS_PORT", "9090")

	redisOptions, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatal(err)
	}
	redisClient := redis.NewClient(redisOptions)
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("[orca-engine] Redis unavailable: %v", err)
	} else {
		log.Println("[orca-engine] Redis connected")
	}

	pool, err := orcadb.NewPool(ctx, databaseURL)
	if err != nil {
		log.Printf("[orca-engine] PostgreSQL unavailable: %v", err)
	} else {
		defer pool.Close()
		log.Println("[orca-engine] PostgreSQL connected")
	}

	aiClient := ai_client.NewAIClient(aiURL)
	store := state.NewShipmentStore()
	hub := ws.NewHub()
	go hub.Run()
	if redisClient != nil {
		go subscriber.Subscribe(ctx, redisClient, aiClient, store, pool, hub)
	}

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "orca-engine"})
	})
	http.HandleFunc("/ws", hub.Handler)

	log.Printf("[orca-engine] HTTP listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
