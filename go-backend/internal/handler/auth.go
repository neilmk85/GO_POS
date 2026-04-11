package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// handleError sends an error response with appropriate status code
func handleAuthError(w http.ResponseWriter, err error) {
	if be, ok := err.(*util.BusinessException); ok {
		util.SendError(w, be.StatusCode, be.Message)
		return
	}
	if _, ok := err.(*util.ResourceNotFoundException); ok {
		util.SendError(w, http.StatusNotFound, err.Error())
		return
	}
	slog.Error("[AuthHandler] Internal error", "error", err)
	util.SendError(w, http.StatusInternalServerError, "Internal server error")
}

// Login handles user login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req service.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result, err := h.authService.Login(&req)
	if err != nil {
		handleAuthError(w, err)
		return
	}

	util.SendSuccess(w, "Login successful", result)
}

// Register handles user registration (admin only)
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req service.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result, err := h.authService.Register(&req)
	if err != nil {
		handleAuthError(w, err)
		return
	}

	util.SendSuccess(w, "User registered successfully", result)
}

// RefreshToken handles token refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req service.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result, err := h.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		handleAuthError(w, err)
		return
	}

	util.SendSuccess(w, "Token refreshed", result)
}
