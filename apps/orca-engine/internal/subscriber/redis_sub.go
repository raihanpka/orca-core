package subscriber

import (
	"context"
	"encoding/json"
	"log"
	"math"
	"time"

	"github.com/go-redis/redis/v9"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"orca/engine/internal/ai_client"
	orcadb "orca/engine/internal/db"
	"orca/engine/internal/dispatcher"
	"orca/engine/internal/state"
	"orca/engine/internal/ws"
	"orca/engine/pkg/models"
)

const shipmentChannel = "orca:events:shipments"

type Options struct {
	AlertRiskThreshold float64
	AlertRecipient     string
}

func Subscribe(ctx context.Context, redisClient *redis.Client, ai *ai_client.AIClient, alerts *dispatcher.AlertDispatcher, store *state.ShipmentStore, pool *pgxpool.Pool, hub *ws.Hub, opts Options) {
	pubsub := redisClient.Subscribe(ctx, shipmentChannel)
	defer pubsub.Close()

	for msg := range pubsub.Channel() {
		started := time.Now()
		var event models.ShipmentEvent
		if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
			log.Printf(`{"service":"orca-engine","level":"WARN","action":"decode_failed","error":%q}`, err.Error())
			continue
		}
		normalizeEvent(&event)
		if event.ShipmentID == "" {
			log.Printf(`{"service":"orca-engine","level":"WARN","action":"missing_shipment_id"}`)
			continue
		}
		store.Set(event.ShipmentID, state.ShipmentState{ShipmentEvent: event})
		prediction, err := ai.Predict(ctx, buildPredictRequest(event))
		if err != nil {
			log.Printf(`{"service":"orca-engine","level":"ERROR","action":"predict_failed","shipment_id":%q,"error":%q}`, event.ShipmentID, err.Error())
			continue
		}
		if pool != nil {
			if err := orcadb.UpsertShipment(ctx, pool, event); err != nil {
				log.Printf(`{"service":"orca-engine","level":"ERROR","action":"shipment_upsert_failed","shipment_id":%q,"error":%q}`, event.ShipmentID, err.Error())
				continue
			}
			if err := orcadb.InsertShipmentEvent(ctx, pool, event); err != nil {
				log.Printf(`{"service":"orca-engine","level":"WARN","action":"shipment_event_insert_failed","shipment_id":%q,"error":%q}`, event.ShipmentID, err.Error())
			}
			if err := orcadb.InsertCarbonRecord(ctx, pool, event); err != nil {
				log.Printf(`{"service":"orca-engine","level":"WARN","action":"carbon_insert_failed","shipment_id":%q,"error":%q}`, event.ShipmentID, err.Error())
			}
			featuresJSON, _ := json.Marshal(buildPredictRequest(event))
			if err := orcadb.InsertPrediction(ctx, pool, event.ShipmentID, prediction.DelayProbability, prediction.SLARiskScore, prediction.PredictedDelayHours, prediction.ModelVersion, featuresJSON); err != nil {
				log.Printf(`{"service":"orca-engine","level":"ERROR","action":"prediction_insert_failed","shipment_id":%q,"error":%q}`, event.ShipmentID, err.Error())
				continue
			}
		}
		store.Set(event.ShipmentID, state.ShipmentState{ShipmentEvent: event, LastRiskScore: prediction.SLARiskScore, LastPredictedAt: time.Now().UTC()})
		hub.Broadcast(models.WSMessage{Type: "prediction_update", ShipmentID: event.ShipmentID, SLARiskScore: prediction.SLARiskScore, DelayProbability: prediction.DelayProbability})
		if prediction.SLARiskScore >= opts.AlertRiskThreshold {
			intervention := recommendIntervention(prediction.SLARiskScore)
			if err := alerts.Dispatch(ctx, models.AlertDispatchRequest{
				ShipmentID: event.ShipmentID, AlertType: "sla_risk", SLARiskScore: prediction.SLARiskScore,
				Intervention: intervention, RecipientPhone: opts.AlertRecipient,
			}); err != nil {
				log.Printf(`{"service":"orca-engine","level":"ERROR","action":"alert_dispatch_failed","shipment_id":%q,"error":%q}`, event.ShipmentID, err.Error())
			} else {
				hub.Broadcast(models.WSMessage{Type: "alert", ShipmentID: event.ShipmentID, ExternalID: event.ExternalID, SLARiskScore: prediction.SLARiskScore, Intervention: intervention})
			}
		}
		log.Printf(`{"service":"orca-engine","level":"INFO","action":"prediction_stored","shipment_id":%q,"duration_ms":%d}`, event.ShipmentID, time.Since(started).Milliseconds())
	}
}

func normalizeEvent(event *models.ShipmentEvent) {
	now := time.Now().UTC()
	if event.ShipmentID == "" && event.ExternalID != "" {
		event.ShipmentID = uuid.NewSHA1(uuid.NameSpaceOID, []byte(event.ExternalID)).String()
	}
	if event.DistanceKM <= 0 {
		event.DistanceKM = 30
	}
	if event.EstimatedDeliveryDays <= 0 {
		event.EstimatedDeliveryDays = 2
	}
	if event.DispatchedAt.IsZero() {
		event.DispatchedAt = now
	}
	if event.SLADeadline.IsZero() {
		event.SLADeadline = event.DispatchedAt.Add(time.Duration(event.EstimatedDeliveryDays * float64(24*time.Hour)))
	}
	if event.DayOfWeek < 0 || event.DayOfWeek > 6 {
		event.DayOfWeek = int(event.DispatchedAt.Weekday())
	}
	if event.HourOfDay < 0 || event.HourOfDay > 23 {
		event.HourOfDay = event.DispatchedAt.Hour()
	}
	if event.HourOfDay == 0 && !event.DispatchedAt.IsZero() {
		event.HourOfDay = event.DispatchedAt.Hour()
	}
	if event.HubZone == "" {
		event.HubZone = "000"
	}
	if event.OriginHubID == "" {
		event.OriginHubID = "hub_" + event.HubZone
	}
	if event.VehicleType == "" {
		event.VehicleType = "van_diesel"
	}
	if event.LoadWeightKG <= 0 {
		event.LoadWeightKG = event.ProductWeightG / 1000
	}
	if event.LoadWeightKG <= 0 {
		event.LoadWeightKG = 1
	}
	if event.HistoricalDriverRate <= 0 {
		event.HistoricalDriverRate = 1
	}
	if event.ItemCount <= 0 {
		event.ItemCount = 1
	}
	if event.ProductWeightG <= 0 {
		event.ProductWeightG = 1000
	}
	if event.RemainingHoursToSLA == 0 {
		event.RemainingHoursToSLA = math.Max(event.SLADeadline.Sub(now).Hours(), 0)
	}
}

func buildPredictRequest(event models.ShipmentEvent) models.PredictRequest {
	return models.PredictRequest{
		ShipmentID: event.ShipmentID, DistanceKM: event.DistanceKM, EstimatedDeliveryDays: event.EstimatedDeliveryDays,
		DayOfWeek: event.DayOfWeek, HourOfDay: event.HourOfDay, HubZone: event.HubZone,
		WeatherSeverityScore: event.WeatherSeverityScore, HistoricalHubDelayRate: event.HistoricalHubDelayRate,
		HistoricalDriverRate: event.HistoricalDriverRate, ItemCount: event.ItemCount, ProductWeightG: event.ProductWeightG,
		RemainingHoursToSLA: event.RemainingHoursToSLA,
	}
}

func recommendIntervention(score float64) string {
	if score >= 85 {
		return "escalate_to_courier_manager"
	}
	return "reroute_via_toll"
}
