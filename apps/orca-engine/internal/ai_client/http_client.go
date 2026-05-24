package ai_client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"orca/engine/pkg/models"
)

type AIClient struct {
	baseURL       string
	internalToken string
	client        *http.Client
}

type envelope struct {
	Success bool                   `json:"success"`
	Data    models.PredictResponse `json:"data"`
	Error   string                 `json:"error"`
}

func NewAIClient(baseURL string, internalToken string) *AIClient {
	return &AIClient{
		baseURL:       strings.TrimRight(baseURL, "/"),
		internalToken: internalToken,
		client:        &http.Client{},
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
		if c.internalToken != "" {
			httpReq.Header.Set("X-Internal-Token", c.internalToken)
		}
		resp, err := c.client.Do(httpReq)
		if err == nil && resp.StatusCode < 500 {
			defer resp.Body.Close()
			if resp.StatusCode >= 400 {
				body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
				cancel()
				return nil, fmt.Errorf("orca-ai returned status %d: %s", resp.StatusCode, string(body))
			}
			var out envelope
			if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
				cancel()
				return nil, err
			}
			if !out.Success {
				cancel()
				return nil, fmt.Errorf("orca-ai returned unsuccessful envelope: %s", out.Error)
			}
			cancel()
			return &out.Data, nil
		}
		if resp != nil {
			resp.Body.Close()
		}
		cancel()
		lastErr = err
		if resp != nil {
			lastErr = fmt.Errorf("orca-ai returned status %d", resp.StatusCode)
		}
		log.Printf(`{"service":"orca-engine","level":"WARN","action":"predict_retry","attempt":%d,"error":%q}`, attempt+1, lastErr)
		time.Sleep(time.Duration(100*(1<<attempt)) * time.Millisecond)
	}
	return nil, lastErr
}
