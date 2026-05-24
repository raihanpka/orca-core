package dispatcher

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func DispatchAlert(ctx context.Context, aiServiceURL, shipmentID, alertType string, riskScore float64, intervention, recipientPhone string) error {
	body, _ := json.Marshal(map[string]any{
		"shipment_id": shipmentID, "alert_type": alertType, "sla_risk_score": riskScore,
		"intervention": intervention, "recipient_phone": recipientPhone,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(aiServiceURL, "/")+"/alerts/dispatch", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("alert dispatch failed with status %d", resp.StatusCode)
	}
	return nil
}
