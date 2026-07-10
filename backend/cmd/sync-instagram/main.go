package main

import (
	"context"
	"log"
	"time"

	"pointproject/backend/internal/config"
	"pointproject/backend/internal/database"
	"pointproject/backend/internal/instagram"
	"pointproject/backend/internal/repository"
)

func main() {
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	if pool == nil {
		log.Fatal("DATABASE_URL wajib diisi")
	}
	defer pool.Close()

	store := repository.NewPostgresStore(pool)
	syncer := instagram.NewSyncer(store, instagram.Config{
		APIKey:          cfg.EnsembleAPIKey,
		UserID:          cfg.InstagramUserID,
		OldestTimestamp: cfg.InstagramOldest,
		ChunkSize:       10,
		SyncInterval:    cfg.InstagramSyncEvery,
	})
	result, err := syncer.Sync(ctx)
	if err != nil {
		log.Fatalf("sync instagram: %v", err)
	}
	log.Printf("instagram sync complete: fetched=%d saved=%d skipped=%d", result.Fetched, result.Saved, result.Skipped)
}
