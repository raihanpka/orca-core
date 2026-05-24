package ws

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"

	"orca/engine/pkg/models"
)

type Hub struct {
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	broadcast  chan models.WSMessage
	clients    map[*websocket.Conn]bool
	appEnv     string
	origins    map[string]bool
}

func NewHub(appEnv string, allowedOrigins string) *Hub {
	origins := map[string]bool{}
	for _, origin := range strings.Split(allowedOrigins, ",") {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			origins[origin] = true
		}
	}
	return &Hub{
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		broadcast:  make(chan models.WSMessage, 100),
		clients:    make(map[*websocket.Conn]bool),
		appEnv:     appEnv,
		origins:    origins,
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
	upgrader := websocket.Upgrader{CheckOrigin: h.checkOrigin}
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

func (h *Hub) checkOrigin(r *http.Request) bool {
	if h.appEnv == "development" || h.appEnv == "local" {
		return true
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return false
	}
	return h.origins[origin]
}
