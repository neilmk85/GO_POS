package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

type Message struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data,omitempty"`
}

type Client struct {
	conn     *websocket.Conn
	ctx      context.Context
	cancel   context.CancelFunc
	outletID string
	send     chan []byte
	hub      *Hub
}

type Hub struct {
	mu           sync.RWMutex
	clients      map[*Client]bool
	outletRooms  map[string]map[*Client]bool
	register     chan *Client
	unregister   chan *Client
	broadcast    chan broadcastMessage
}

type broadcastMessage struct {
	outletID string
	event    string
	data     interface{}
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		clients:     make(map[*Client]bool),
		outletRooms: make(map[string]map[*Client]bool),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		broadcast:   make(chan broadcastMessage, 256),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	slog.Info("[WebSocket] Hub started")
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			slog.Debug("[WebSocket] Client registered", "outletId", client.outletID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)

				// Remove from outlet room
				if room, exists := h.outletRooms[client.outletID]; exists {
					delete(room, client)
					if len(room) == 0 {
						delete(h.outletRooms, client.outletID)
					}
				}
			}
			h.mu.Unlock()
			slog.Debug("[WebSocket] Client unregistered", "outletId", client.outletID)

		case msg := <-h.broadcast:
			h.mu.RLock()
			room := h.outletRooms[msg.outletID]
			h.mu.RUnlock()

			msgBytes, err := json.Marshal(Message{
				Event: msg.event,
				Data:  msg.data,
			})
			if err != nil {
				slog.Error("[WebSocket] Failed to marshal message", "error", err)
				continue
			}

			for client := range room {
				select {
				case client.send <- msgBytes:
				default:
					// Client's send channel is full, close it
					close(client.send)
				}
			}
		}
	}
}

// HandleWS handles WebSocket connections
func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	// Accept WebSocket connection
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true,
	})
	if err != nil {
		slog.Error("[WebSocket] Failed to accept connection", "error", err)
		http.Error(w, "Failed to establish WebSocket connection", http.StatusInternalServerError)
		return
	}

	defer conn.Close(websocket.StatusInternalError, "")

	// Authenticate via query param or header
	outletID, err := h.authenticateWS(r)
	if err != nil {
		slog.Warn("[WebSocket] Authentication failed", "error", err)
		conn.Close(websocket.StatusPolicyViolation, "Unauthorized")
		return
	}

	// Create client
	ctx, cancel := context.WithCancel(r.Context())
	client := &Client{
		conn:     conn,
		ctx:      ctx,
		cancel:   cancel,
		outletID: outletID,
		send:     make(chan []byte, 256),
		hub:      h,
	}

	// Register client
	h.register <- client

	// Add to outlet room
	h.mu.Lock()
	if _, exists := h.outletRooms[outletID]; !exists {
		h.outletRooms[outletID] = make(map[*Client]bool)
	}
	h.outletRooms[outletID][client] = true
	h.mu.Unlock()

	slog.Info("[WebSocket] Client connected", "outletId", outletID)

	// Handle read and write concurrently
	go h.readPump(client)
	go h.writePump(client)
}

// readPump reads messages from the WebSocket connection
func (h *Hub) readPump(client *Client) {
	defer func() {
		client.cancel()
		h.unregister <- client
		client.conn.Close(websocket.StatusGoingAway, "")
	}()

	client.conn.SetReadLimit(65536)

	for {
		var msg Message
		err := wsjson.Read(client.ctx, client.conn, &msg)
		if err != nil {
			if websocket.CloseStatus(err) == websocket.StatusNormalClosure ||
				websocket.CloseStatus(err) == websocket.StatusGoingAway {
				return
			}
			slog.Error("[WebSocket] Read error", "error", err)
			return
		}

		// Handle join-outlet message to update the room
		if msg.Event == "join-outlet" {
			if dataMap, ok := msg.Data.(map[string]interface{}); ok {
				if newOutletID, ok := dataMap["outletId"].(string); ok {
					h.mu.Lock()
					// Remove from old room
					if room, exists := h.outletRooms[client.outletID]; exists {
						delete(room, client)
						if len(room) == 0 {
							delete(h.outletRooms, client.outletID)
						}
					}
					// Add to new room
					if _, exists := h.outletRooms[newOutletID]; !exists {
						h.outletRooms[newOutletID] = make(map[*Client]bool)
					}
					h.outletRooms[newOutletID][client] = true
					client.outletID = newOutletID
					h.mu.Unlock()

					slog.Debug("[WebSocket] Client joined outlet", "outletId", newOutletID)
				}
			}
		}
	}
}

// writePump writes messages to the WebSocket connection
func (h *Hub) writePump(client *Client) {
	ticker := time.NewTicker(54 * time.Second)
	defer ticker.Stop()
	defer client.conn.Close(websocket.StatusInternalError, "")

	for {
		select {
		case msg, ok := <-client.send:
			if !ok {
				client.conn.Close(websocket.StatusNormalClosure, "")
				return
			}

			if err := client.conn.Write(client.ctx, websocket.MessageText, msg); err != nil {
				slog.Error("[WebSocket] Write error", "error", err)
				return
			}

		case <-ticker.C:
			if err := client.conn.Write(client.ctx, websocket.MessageText, []byte("ping")); err != nil {
				slog.Error("[WebSocket] Ping error", "error", err)
				return
			}
		}
	}
}

// BroadcastToOutlet sends a message to all clients in an outlet room
func (h *Hub) BroadcastToOutlet(outletID string, event string, data interface{}) {
	select {
	case h.broadcast <- broadcastMessage{
		outletID: outletID,
		event:    event,
		data:     data,
	}:
	default:
		slog.Warn("[WebSocket] Broadcast channel full, message dropped")
	}
}

// BroadcastToAll sends a message to all connected clients
func (h *Hub) BroadcastToAll(event string, data interface{}) {
	h.mu.RLock()
	outlets := make([]string, 0, len(h.outletRooms))
	for outletID := range h.outletRooms {
		outlets = append(outlets, outletID)
	}
	h.mu.RUnlock()

	for _, outletID := range outlets {
		h.BroadcastToOutlet(outletID, event, data)
	}
}

// authenticateWS extracts and validates the outlet ID from the request
func (h *Hub) authenticateWS(r *http.Request) (string, error) {
	// Try to get outlet ID from query parameter
	outletID := r.URL.Query().Get("outletId")
	if outletID != "" {
		return outletID, nil
	}

	// Try to get outlet ID from Authorization header (via JWT context)
	// For now, we'll use a simple approach - in production, validate JWT here
	outletID = r.Header.Get("X-Outlet-ID")
	if outletID != "" {
		return outletID, nil
	}

	return "", fmt.Errorf("outlet ID not provided")
}
