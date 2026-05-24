package ws

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/websocket"

	"orca/engine/pkg/models"
)

type Hub struct {
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	broadcast  chan models.WSMessage
	clients    map[*websocket.Conn]bool
}

func NewHub() *Hub {
	return &Hub{
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		broadcast:  make(chan models.WSMessage, 100),
		clients:    make(map[*websocket.Conn]bool),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case conn := <-h.register:
			h.clients[conn] = true
		case conn := <-h.unregister:
			if h.clients[conn] {
				delete(h.clients, conn)
				conn.Close()
			}
		case msg := <-h.broadcast:
			body, _ := json.Marshal(msg)
			for conn := range h.clients {
				if err := conn.WriteMessage(websocket.TextMessage, body); err != nil {
					delete(h.clients, conn)
					conn.Close()
				}
			}
		}
	}
}

func (h *Hub) Broadcast(msg models.WSMessage) {
	h.broadcast <- msg
}

func (h *Hub) Handler(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	h.register <- conn
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			h.unregister <- conn
			return
		}
	}
}
