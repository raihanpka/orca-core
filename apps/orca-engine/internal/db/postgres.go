package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	return pool, pool.Ping(ctx)
}

func InsertPrediction(ctx context.Context, pool *pgxpool.Pool, shipmentID string, delayProb, riskScore, predictedDelayHrs float64, modelVersion string) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO shipment_predictions (time, shipment_id, delay_probability, sla_risk_score, predicted_delay_hrs, model_version)
		VALUES (NOW(), $1::uuid, $2, $3, $4, $5)
	`, shipmentID, delayProb, riskScore, predictedDelayHrs, modelVersion)
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
