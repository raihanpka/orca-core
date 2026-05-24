package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"orca/engine/pkg/models"
)

func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	return pool, pool.Ping(ctx)
}

func InsertPrediction(ctx context.Context, pool *pgxpool.Pool, shipmentID string, delayProb, riskScore, predictedDelayHrs float64, modelVersion string, featuresJSON []byte) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO shipment_predictions (time, shipment_id, delay_probability, sla_risk_score, predicted_delay_hrs, model_version, features_json)
		VALUES (NOW(), $1::uuid, $2, $3, $4, $5, $6::jsonb)
	`, shipmentID, delayProb, riskScore, predictedDelayHrs, modelVersion, string(featuresJSON))
	return err
}

func UpsertShipment(ctx context.Context, pool *pgxpool.Pool, event models.ShipmentEvent) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO shipments (
			id, external_id, origin_hub_id, destination_zone, customer_lat, customer_lng,
			vehicle_type, load_weight_kg, item_count, sla_deadline, dispatched_at, status, distance_km
		)
		VALUES ($1::uuid, $2, $3, $4, NULLIF($5, 0), NULLIF($6, 0), $7, $8, $9, $10, $11, 'in_transit', $12)
		ON CONFLICT (id) DO UPDATE SET
			external_id = COALESCE(EXCLUDED.external_id, shipments.external_id),
			origin_hub_id = EXCLUDED.origin_hub_id,
			destination_zone = EXCLUDED.destination_zone,
			customer_lat = COALESCE(EXCLUDED.customer_lat, shipments.customer_lat),
			customer_lng = COALESCE(EXCLUDED.customer_lng, shipments.customer_lng),
			vehicle_type = EXCLUDED.vehicle_type,
			load_weight_kg = EXCLUDED.load_weight_kg,
			item_count = EXCLUDED.item_count,
			sla_deadline = EXCLUDED.sla_deadline,
			dispatched_at = EXCLUDED.dispatched_at,
			status = 'in_transit',
			distance_km = EXCLUDED.distance_km
	`, event.ShipmentID, event.ExternalID, event.OriginHubID, event.DestinationZone, event.CustomerLat, event.CustomerLng,
		event.VehicleType, event.LoadWeightKG, event.ItemCount, event.SLADeadline, event.DispatchedAt, event.DistanceKM)
	return err
}

func InsertCarbonRecord(ctx context.Context, pool *pgxpool.Pool, event models.ShipmentEvent) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO carbon_records (
			shipment_id, route_distance_km, co2_kg, vehicle_type, load_weight_ton, emission_factor, glec_version
		)
		SELECT
			$1::uuid,
			$2,
			ROUND(($2::numeric * ($3::numeric / 1000.0) * emission_factor)::numeric, 4),
			$4,
			ROUND(($3::numeric / 1000.0)::numeric, 4),
			emission_factor,
			glec_version
		FROM glec_emission_factors
		WHERE vehicle_type = $4
		ON CONFLICT (shipment_id) DO NOTHING
	`, event.ShipmentID, event.DistanceKM, event.LoadWeightKG, event.VehicleType)
	return err
}

func InsertAlertLog(ctx context.Context, pool *pgxpool.Pool, shipmentID, alertType string, riskScore float64, intervention string) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO alert_logs (shipment_id, alert_type, sla_risk_score, intervention, notified_via)
		VALUES ($1::uuid, $2, $3, $4, '{}')
	`, shipmentID, alertType, riskScore, intervention)
	return err
}

func InsertHubMetric(ctx context.Context, pool *pgxpool.Pool, hubID string, inboundVolume int, avgDwellMin, delayRate float64) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO hub_metrics (time, hub_id, inbound_volume, avg_dwell_time_min, delay_rate, active_shipments)
		VALUES (NOW(), $1, $2, $3, $4, $2)
	`, hubID, inboundVolume, avgDwellMin, delayRate)
	return err
}
