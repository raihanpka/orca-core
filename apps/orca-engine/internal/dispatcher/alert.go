package dispatcher

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"orca/engine/pkg/models"
)

type AlertDispatcher struct {
	aiServiceURL string
	client       *http.Client
}

func NewAlertDispatcher(aiServiceURL string) *AlertDispatcher {
	return &AlertDispatcher{
		aiServiceURL: strings.TrimRight(aiServiceURL, "/"),
		client:       &http.Client{Timeout: 10 * time.Second},
	}
}

func (d *AlertDispatcher) Dispatch(ctx context.Context, payload models.AlertDispatchRequest) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.aiServiceURL+"/alerts/dispatch", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := d.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("alert dispatch failed with status %d", resp.StatusCode)
	}
	return nil
}
