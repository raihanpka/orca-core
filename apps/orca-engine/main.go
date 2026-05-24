package main

import (
	"context"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v9"
	"github.com/jackc/pgx/v5/pgxpool"

	"orca/engine/internal/ai_client"
	orcadb "orca/engine/internal/db"
	"orca/engine/internal/dispatcher"
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

func getFloat(key string, fallback float64) float64 {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func main() {
	ctx := context.Background()
	appEnv := getenv("APP_ENV", "development")
	redisURL := getenv("REDIS_URL", "redis://localhost:6379")
	databaseURL := getenv("DATABASE_URL", "postgresql://orca:orca_pass@localhost:5432/orca_db")
	aiURL := getenv("AI_SERVICE_URL", "http://localhost:8000")
	internalToken := getenv("INTERNAL_API_TOKEN", "dev-internal-token")
	port := getenv("WS_PORT", "9090")
	alertRiskThreshold := getFloat("ALERT_RISK_THRESHOLD", 70)
	alertRecipient := getenv("ALERT_RECIPIENT_PHONE", "")
	wsAllowedOrigins := getenv("WS_ALLOWED_ORIGINS", "")

	redisOptions, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatal(err)
	}
	redisClient := redis.NewClient(redisOptions)
	redisConnected := false
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("[orca-engine] Redis unavailable: %v", err)
	} else {
		redisConnected = true
		log.Println("[orca-engine] Redis connected")
	}

	pool, err := orcadb.NewPool(ctx, databaseURL)
	if err != nil {
		log.Printf("[orca-engine] PostgreSQL unavailable: %v", err)
	} else {
		defer pool.Close()
		log.Println("[orca-engine] PostgreSQL connected")
	}

	aiClient := ai_client.NewAIClient(aiURL, internalToken)
	alertDispatcher := dispatcher.NewAlertDispatcher(aiURL, internalToken)
	store := state.NewShipmentStore()
	hub := ws.NewHub(appEnv, wsAllowedOrigins)
	go hub.Run()
	if redisConnected {
		go subscriber.Subscribe(ctx, redisClient, aiClient, alertDispatcher, store, pool, hub, subscriber.Options{
			AlertRiskThreshold: alertRiskThreshold,
			AlertRecipient:     alertRecipient,
		})
	}
	if pool != nil {
		go publishHubMetrics(ctx, pool, store)
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "orca-engine"})
	})
	router.GET("/ws", func(c *gin.Context) {
		hub.Handler(c.Writer, c.Request)
	})

	log.Printf("[orca-engine] HTTP listening on :%s", port)
	log.Fatal(router.Run(":" + port))
}

func publishHubMetrics(ctx context.Context, pool *pgxpool.Pool, store *state.ShipmentStore) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			writeHubMetrics(ctx, pool, store)
		}
	}
}

type hubAggregate struct {
	count     int
	dwellMins float64
	riskTotal float64
}

func writeHubMetrics(ctx context.Context, pool *pgxpool.Pool, store *state.ShipmentStore) {
	aggregates := map[string]*hubAggregate{}
	now := time.Now().UTC()
	for _, shipment := range store.All() {
		hubID := shipment.OriginHubID
		if hubID == "" {
			hubID = "hub_unknown"
		}
		item := aggregates[hubID]
		if item == nil {
			item = &hubAggregate{}
			aggregates[hubID] = item
		}
		item.count++
		if !shipment.DispatchedAt.IsZero() {
			item.dwellMins += now.Sub(shipment.DispatchedAt).Minutes()
		}
		item.riskTotal += shipment.LastRiskScore
	}
	for hubID, item := range aggregates {
		avgDwell := 0.0
		delayRate := 0.0
		if item.count > 0 {
			avgDwell = item.dwellMins / float64(item.count)
			delayRate = item.riskTotal / float64(item.count) / 100
		}
		if err := orcadb.InsertHubMetric(ctx, pool, hubID, item.count, avgDwell, delayRate); err != nil {
			log.Printf(`{"service":"orca-engine","level":"WARN","action":"hub_metric_insert_failed","hub_id":%q,"error":%q}`, hubID, err.Error())
		}
	}
}
