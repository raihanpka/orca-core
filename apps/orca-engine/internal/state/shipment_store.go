package state

import (
	"sync"
	"time"

	"orca/engine/pkg/models"
)

type ShipmentState struct {
	models.ShipmentEvent
	LastRiskScore   float64
	LastPredictedAt time.Time
}

type ShipmentStore struct {
	mu    sync.RWMutex
	items map[string]ShipmentState
}

func NewShipmentStore() *ShipmentStore {
	return &ShipmentStore{items: make(map[string]ShipmentState)}
}

func (s *ShipmentStore) Set(id string, state ShipmentState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[id] = state
}

func (s *ShipmentStore) Get(id string) (ShipmentState, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	item, ok := s.items[id]
	return item, ok
}

func (s *ShipmentStore) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.items, id)
}

func (s *ShipmentStore) All() []ShipmentState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	items := make([]ShipmentState, 0, len(s.items))
	for _, item := range s.items {
		items = append(items, item)
	}
	return items
}
