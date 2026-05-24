package ai_client

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

type AIClient struct {
	baseURL string
	client  *http.Client
}

type envelope struct {
	Success bool                   `json:"success"`
	Data    models.PredictResponse `json:"data"`
	Error   string                 `json:"error"`
}

func NewAIClient(baseURL string) *AIClient {
	return &AIClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  &http.Client{},
	}
}

func (c *AIClient) Predict(ctx context.Context, req models.PredictRequest) (*models.PredictResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		attemptCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		httpReq, err := http.NewRequestWithContext(attemptCtx, http.MethodPost, c.baseURL+"/internal/predict", bytes.NewReader(body))
		if err != nil {
			cancel()
			return nil, err
		}
		httpReq.Header.Set("Content-Type", "application/json")
		resp, err := c.client.Do(httpReq)
		if err == nil && resp.StatusCode < 500 {
			defer resp.Body.Close()
			if resp.StatusCode >= 400 {
				cancel()
				return nil, fmt.Errorf("orca-ai returned status %d", resp.StatusCode)
			}
			var out envelope
			if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
				cancel()
				return nil, err
			}
			cancel()
			return &out.Data, nil
		}
		if resp != nil {
			resp.Body.Close()
		}
		cancel()
		lastErr = err
		time.Sleep(time.Duration(100*(1<<attempt)) * time.Millisecond)
	}
	return nil, lastErr
}
