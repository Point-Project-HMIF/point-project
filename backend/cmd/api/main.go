package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"pointproject/backend/internal/config"
	"pointproject/backend/internal/database"
	"pointproject/backend/internal/httpapi"
	"pointproject/backend/internal/repository"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	if pool == nil {
		log.Fatal("DATABASE_URL wajib diisi")
	}
	defer pool.Close()

	var store repository.Store = repository.NewPostgresStore(pool)

	handler := httpapi.NewRouter(
		store,
		cfg.JWTSecret,
		cfg.CORSAllowedOrigins,
		cfg.ResendAPIKey,
		cfg.ResendFromEmail,
		cfg.R2Endpoint,
		cfg.R2Bucket,
		cfg.R2AccessKeyID,
		cfg.R2SecretAccessKey,
		cfg.R2PublicBaseURL,
	)

	log.Printf("Point Project API berjalan di %s", cfg.HTTPAddr)
	if err := http.ListenAndServe(cfg.HTTPAddr, handler); err != nil {
		log.Fatal(err)
	}
}
