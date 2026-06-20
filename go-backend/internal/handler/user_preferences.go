package handler

import (
	"encoding/json"
	"net/http"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type UserPreferenceHandler struct {
	service *service.UserPreferenceService
}

func NewUserPreferenceHandler(s *service.UserPreferenceService) *UserPreferenceHandler {
	return &UserPreferenceHandler{service: s}
}

// GET /api/users/preferences
func (h *UserPreferenceHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	prefs, err := h.service.GetAll(user.ID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Preferences retrieved", prefs)
}

// PUT /api/users/preferences/{key}
func (h *UserPreferenceHandler) Set(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	key := r.PathValue("key")
	if key == "" {
		util.SendError(w, http.StatusBadRequest, "Key is required")
		return
	}
	var body struct {
		Value string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.service.Set(user.ID, key, body.Value); err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Preference saved", nil)
}

// DELETE /api/users/preferences/{key}
func (h *UserPreferenceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	key := r.PathValue("key")
	if err := h.service.Delete(user.ID, key); err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Preference deleted", nil)
}
