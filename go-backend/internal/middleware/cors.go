package middleware

import (
	"log/slog"
	"net/http"
	"strings"
)

// CORS middleware handles Cross-Origin Resource Sharing
func CORS(frontendURL string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Allow requests from the configured frontend URL or any localhost origin (dev)
			allowed := strings.HasPrefix(origin, frontendURL) ||
				origin == frontendURL ||
				strings.HasPrefix(origin, "http://localhost:") ||
				strings.HasPrefix(origin, "http://127.0.0.1:")
			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}

			// Allow credentials
			w.Header().Set("Access-Control-Allow-Credentials", "true")

			// Handle preflight requests
			if r.Method == http.MethodOptions {
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				w.Header().Set("Access-Control-Max-Age", "3600")
				w.WriteHeader(http.StatusNoContent)
				return
			}

			// Set CORS headers for actual requests
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			slog.Debug("[CORS] Request allowed", "origin", origin, "method", r.Method, "path", r.URL.Path)

			next.ServeHTTP(w, r)
		})
	}
}
