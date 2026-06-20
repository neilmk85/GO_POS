package handler

import (
	"log/slog"
	"net/http"

	"github.com/nilesh/pos-backend/internal/util"
)

// handleError handles different error types and sends appropriate HTTP responses
func handleError(w http.ResponseWriter, err error) {
	if be, ok := err.(*util.BusinessException); ok {
		code := be.StatusCode
		if code == 0 {
			code = http.StatusBadRequest
		}
		util.SendError(w, code, be.Message)
		return
	}

	if rn, ok := err.(*util.ResourceNotFoundException); ok {
		util.SendError(w, http.StatusNotFound, rn.Message)
		return
	}

	slog.Error("[Handler] Error", "error", err)
	util.SendError(w, http.StatusInternalServerError, "Internal server error")
}
