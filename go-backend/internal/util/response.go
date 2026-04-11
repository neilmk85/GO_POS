package util

import (
	"encoding/json"
	"net/http"
	"time"
)

// Now returns the current time as a pointer to time.Time
func Now() *time.Time {
	t := time.Now()
	return &t
}

type APIResponse struct {
	Success   bool        `json:"success"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp string      `json:"timestamp"`
}

type PaginatedData struct {
	Content       interface{} `json:"content"`
	TotalElements int64       `json:"totalElements"`
	TotalPages    int         `json:"totalPages"`
	Size          int         `json:"size"`
	Number        int         `json:"number"`
}

type BusinessException struct {
	StatusCode int
	Message    string
	Status     int // legacy name
}

func (e *BusinessException) Error() string {
	return e.Message
}

type ResourceNotFoundException struct {
	Message string
}

func (e *ResourceNotFoundException) Error() string {
	return e.Message
}

func SuccessResponse(message string, data interface{}) APIResponse {
	return APIResponse{
		Success:   true,
		Message:   message,
		Data:      data,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}

func ErrorResponse(message string) APIResponse {
	return APIResponse{
		Success:   false,
		Message:   message,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}

func SendSuccess(w http.ResponseWriter, message string, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(SuccessResponse(message, data))
}

func SendError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(ErrorResponse(message))
}

func SendPaginated(w http.ResponseWriter, content interface{}, totalElements int64, totalPages, size, number int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	paginatedData := PaginatedData{
		Content:       content,
		TotalElements: totalElements,
		TotalPages:    totalPages,
		Size:          size,
		Number:        number,
	}

	response := SuccessResponse("Success", paginatedData)
	json.NewEncoder(w).Encode(response)
}
