package subscriber

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/go-redis/redis/v9"
	"github.com/jackc/pgx/v5/pgxpool"

	"orca/engine/internal/ai_client"
	orcadb "orca/engine/internal/db"
	"orca/engine/internal/state"
	"orca/engine/internal/ws"
	"orca/engine/pkg/models"
)

func Subscribe(ctx context.Context, redisClient *redis.Client, ai *ai_client.AIClient, store *state.ShipmentStore, pool *pgxpool.Pool, hub *ws.Hub) {
	pubsub := redisClient.Subscribe(ctx, "orca:events:shipments")
	defer pubsub.Close()

	for msg := range pubsub.Channel() {
		started := time.Now()
		var event models.ShipmentEvent
		if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
			log.Printf(`{"service":"orca-engine","level":"WARN","action":"decode_failed","error":%q}`, err.Error())
			continue
		}
		if event.ShipmentID == "" {
			continue
		}
		store.Set(event.ShipmentID, state.ShipmentState{ShipmentEvent: event})
		prediction, err := ai.Predict(ctx, models.PredictRequest{
			ShipmentID: event.ShipmentID, DistanceKM: event.DistanceKM, EstimatedDeliveryDays: event.EstimatedDeliveryDays,
			DayOfWeek: event.DayOfWeek, HourOfDay: event.HourOfDay, HubZone: event.HubZone,
			WeatherSeverityScore: event.WeatherSeverityScore, HistoricalHubDelayRate: event.HistoricalHubDelayRate,
			HistoricalDriverRate: event.HistoricalDriverRate, ItemCount: event.ItemCount, ProductWeightG: event.ProductWeightG,
			RemainingHoursToSLA: event.RemainingHoursToSLA,
		})
		if err != nil {
			log.Printf(`{"service":"orca-engine","level":"ERROR","action":"predict_failed","shipment_id":%q,"error":%q}`, event.ShipmentID, err.Error())
			continue
		}
		if pool != nil {
			_ = orcadb.InsertPrediction(ctx, pool, event.ShipmentID, prediction.DelayProbability, prediction.SLARiskScore, prediction.PredictedDelayHours, prediction.ModelVersion)
		}
		hub.Broadcast(models.WSMessage{Type: "prediction_update", ShipmentID: event.ShipmentID, SLARiskScore: prediction.SLARiskScore, DelayProbability: prediction.DelayProbability})
		log.Printf(`{"service":"orca-engine","level":"INFO","action":"prediction_stored","shipment_id":%q,"duration_ms":%d}`, event.ShipmentID, time.Since(started).Milliseconds())
	}
}
