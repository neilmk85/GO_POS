package util

import (
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func IsValidEmail(email string) bool {
	// Simple email validation pattern
	pattern := `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
	matched, _ := regexp.MatchString(pattern, email)
	return matched
}

func RequiredString(val, fieldName string) error {
	if strings.TrimSpace(val) == "" {
		return fmt.Errorf("%s is required", fieldName)
	}
	return nil
}

func ParseIntParam(r *http.Request, name string) (int, error) {
	// Go 1.22+ PathValue method
	val := r.PathValue(name)
	if val == "" {
		return 0, fmt.Errorf("parameter %s not found", name)
	}

	intVal, err := strconv.Atoi(val)
	if err != nil {
		return 0, fmt.Errorf("parameter %s must be an integer", name)
	}

	return intVal, nil
}

func ParseQueryInt(r *http.Request, name string, defaultVal int) int {
	val := r.URL.Query().Get(name)
	if val == "" {
		return defaultVal
	}

	intVal, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}

	return intVal
}

func ParseQueryString(r *http.Request, name string, defaultVal string) string {
	val := r.URL.Query().Get(name)
	if val == "" {
		return defaultVal
	}
	return val
}

func ParseDateParam(r *http.Request, name string) (*time.Time, error) {
	val := r.URL.Query().Get(name)
	if val == "" {
		return nil, nil
	}

	t, err := time.Parse("2006-01-02", val)
	if err != nil {
		return nil, fmt.Errorf("parameter %s must be in YYYY-MM-DD format", name)
	}

	return &t, nil
}

func ParsePagination(r *http.Request) (page, size int) {
	page = ParseQueryInt(r, "page", 0)
	size = ParseQueryInt(r, "size", 20)

	// Validate bounds
	if page < 0 {
		page = 0
	}
	if size < 1 || size > 500 {
		size = 20
	}

	return page, size
}
