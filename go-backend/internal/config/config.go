package config

import (
	"bufio"
	"os"
	"strings"
)

type Config struct {
	DBDsn              string
	JwtSecret          string
	JwtExpiry          string
	JwtRefreshExpiry   string
	Port               string
	FrontendUrl        string
	UploadDir          string
	MaxFileSize        int
	Env                string
}

func Load() *Config {
	return &Config{
		DBDsn:            getEnv("DB_DSN", "root:root@tcp(localhost:3306)/posdb?charset=utf8mb4&parseTime=True&loc=Local"),
		JwtSecret:        getEnv("JWT_SECRET", "pos-super-secret-jwt-key-change-in-production"),
		JwtExpiry:        getEnv("JWT_EXPIRY", "720h"),
		JwtRefreshExpiry: getEnv("JWT_REFRESH_EXPIRY", "8760h"),
		Port:             getEnv("PORT", "8080"),
		FrontendUrl:      getEnv("FRONTEND_URL", "http://localhost:3000"),
		UploadDir:        getEnv("UPLOAD_DIR", "uploads"),
		MaxFileSize:      getEnvInt("MAX_FILE_SIZE", 5242880),
		Env:              getEnv("ENV", "development"),
	}
}

func getEnv(key, defaultVal string) string {
	if val, exists := os.LookupEnv(key); exists {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val, exists := os.LookupEnv(key); exists {
		if i := parseIntSimple(val); i >= 0 {
			return i
		}
	}
	return defaultVal
}

func parseIntSimple(s string) int {
	var result int
	for _, c := range s {
		if c < '0' || c > '9' {
			return -1
		}
		result = result*10 + int(c-'0')
	}
	return result
}

func LoadEnvFile(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip comments and empty lines
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Split on first = only
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		// Remove quotes if present
		if (strings.HasPrefix(value, "\"") && strings.HasSuffix(value, "\"")) ||
			(strings.HasPrefix(value, "'") && strings.HasSuffix(value, "'")) {
			value = value[1 : len(value)-1]
		}

		os.Setenv(key, value)
	}

	return scanner.Err()
}
