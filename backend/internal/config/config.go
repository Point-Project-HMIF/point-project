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
}

func Load() Config {
	loadDotEnv(".env")

	return Config{
		HTTPAddr:           env("HTTP_ADDR", ":8080"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		JWTSecret:          env("JWT_SECRET", "dev-secret-change-me"),
		CORSAllowedOrigins: splitCSV(env("CORS_ALLOWED_ORIGINS", "http://localhost:5173")),
		ResendAPIKey:       os.Getenv("RESEND_API_KEY"),
		ResendFromEmail:    env("RESEND_FROM_EMAIL", "Point Project <noreply@contact.pointproject.web.id>"),
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
