package config

import (
	"bufio"
	"os"
	"strings"
)

type Config struct {
	HTTPAddr           string
	DatabaseURL        string
	JWTSecret          string
	CORSAllowedOrigins []string
	ResendAPIKey       string
	ResendFromEmail    string
	R2Endpoint         string
	R2AccountID        string
	R2Bucket           string
	R2AccessKeyID      string
	R2SecretAccessKey  string
	R2PublicBaseURL    string
	R2ObjectPrefix     string
}

func Load() Config {
	loadDotEnv(".env")
	r2AccountID := os.Getenv("R2_ACCOUNT_ID")

	return Config{
		HTTPAddr:           env("HTTP_ADDR", ":8080"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		JWTSecret:          env("JWT_SECRET", "dev-secret-change-me"),
		CORSAllowedOrigins: splitCSV(env("CORS_ALLOWED_ORIGINS", "http://localhost:5173")),
		ResendAPIKey:       os.Getenv("RESEND_API_KEY"),
		ResendFromEmail:    env("RESEND_FROM_EMAIL", "Point Project <noreply@contact.pointproject.web.id>"),
		R2Endpoint:         r2Endpoint(os.Getenv("R2_ENDPOINT"), r2AccountID),
		R2AccountID:        r2AccountID,
		R2Bucket:           os.Getenv("R2_BUCKET"),
		R2AccessKeyID:      os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey:  os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2PublicBaseURL:    os.Getenv("R2_PUBLIC_BASE_URL"),
		R2ObjectPrefix:     env("R2_OBJECT_PREFIX", env("R2_FOLDER_PREFIX", "pp")),
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func r2Endpoint(endpoint, accountID string) string {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint != "" {
		return endpoint
	}
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return ""
	}
	return "https://" + accountID + ".r2.cloudflarestorage.com"
}

func loadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if key != "" && os.Getenv(key) == "" {
			_ = os.Setenv(key, value)
		}
	}
}
