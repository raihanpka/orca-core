package models

import "time"

type ShipmentEvent struct {
	ShipmentID             string    `json:"shipment_id"`
	ExternalID             string    `json:"external_id"`
	DistanceKM             float64   `json:"distance_km"`
	EstimatedDeliveryDays  float64   `json:"estimated_delivery_days"`
	DayOfWeek              int       `json:"day_of_week"`
	HourOfDay              int       `json:"hour_of_day"`
	HubZone                string    `json:"hub_zone"`
	OriginHubID            string    `json:"origin_hub_id"`
	DestinationZone        string    `json:"destination_zone"`
	VehicleType            string    `json:"vehicle_type"`
	LoadWeightKG           float64   `json:"load_weight_kg"`
	CustomerLat            float64   `json:"customer_lat"`
	CustomerLng            float64   `json:"customer_lng"`
	WeatherSeverityScore   float64   `json:"weather_severity_score"`
	HistoricalHubDelayRate float64   `json:"historical_hub_delay_rate"`
	HistoricalDriverRate   float64   `json:"historical_driver_rate"`
	ItemCount              int       `json:"item_count"`
	ProductWeightG         float64   `json:"product_weight_g"`
	RemainingHoursToSLA    float64   `json:"remaining_hours_to_sla"`
	DispatchedAt           time.Time `json:"dispatched_at"`
	SLADeadline            time.Time `json:"sla_deadline"`
}

type PredictRequest struct {
	ShipmentID             string  `json:"shipment_id"`
	DistanceKM             float64 `json:"distance_km"`
	EstimatedDeliveryDays  float64 `json:"estimated_delivery_days"`
	DayOfWeek              int     `json:"day_of_week"`
	HourOfDay              int     `json:"hour_of_day"`
	HubZone                string  `json:"hub_zone"`
	WeatherSeverityScore   float64 `json:"weather_severity_score"`
	HistoricalHubDelayRate float64 `json:"historical_hub_delay_rate"`
	HistoricalDriverRate   float64 `json:"historical_driver_rate"`
	ItemCount              int     `json:"item_count"`
	ProductWeightG         float64 `json:"product_weight_g"`
	RemainingHoursToSLA    float64 `json:"remaining_hours_to_sla"`
}

type PredictResponse struct {
	ShipmentID          string  `json:"shipment_id"`
	DelayProbability    float64 `json:"delay_probability"`
	SLARiskScore        float64 `json:"sla_risk_score"`
	PredictedDelayHours float64 `json:"predicted_delay_hours"`
	ModelVersion        string  `json:"model_version"`
}

type WSMessage struct {
	Type             string  `json:"type"`
	ShipmentID       string  `json:"shipment_id"`
	SLARiskScore     float64 `json:"sla_risk_score,omitempty"`
	DelayProbability float64 `json:"delay_probability,omitempty"`
	ExternalID       string  `json:"external_id,omitempty"`
	Intervention     string  `json:"intervention,omitempty"`
}

type AlertDispatchRequest struct {
	ShipmentID     string  `json:"shipment_id"`
	AlertType      string  `json:"alert_type"`
	SLARiskScore   float64  `json:"sla_risk_score"`
	Intervention   string  `json:"intervention"`
	RecipientPhone string  `json:"recipient_phone,omitempty"`
}
