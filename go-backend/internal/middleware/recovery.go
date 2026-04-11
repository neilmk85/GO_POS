package middleware

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"
)

// Recovery middleware recovers from panics and returns a proper error response
func Recovery() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					// Log the panic and stack trace
					slog.Error("[Panic Recovery] Recovered from panic",
						"error", err,
						"stack", string(debug.Stack()),
						"method", r.Method,
						"path", r.URL.Path,
					)

					// Set content type to JSON
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)

					// Return error response
					response := map[string]interface{}{
						"success":   false,
						"message":   "Internal server error",
						"timestamp": time.Now().UTC().Format(time.RFC3339),
					}

					if err := json.NewEncoder(w).Encode(response); err != nil {
						slog.Error("[Recovery] Failed to encode error response", "error", err)
						fmt.Fprintf(w, `{"success":false,"message":"Internal server error","timestamp":"%s"}`, time.Now().UTC().Format(time.RFC3339))
					}
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}
