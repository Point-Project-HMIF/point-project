package main

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"pointproject/backend/internal/config"
)

func main() {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL wajib diisi untuk menjalankan migrasi")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("parse database url: %v", err)
	}
	poolConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	defer pool.Close()

	if _, err := pool.Exec(ctx, `
		create table if not exists schema_migrations (
			version text primary key,
			applied_at timestamptz not null default now()
		)
	`); err != nil {
		log.Fatalf("create schema_migrations: %v", err)
	}

	files, err := filepath.Glob(filepath.Join("migrations", "*.sql"))
	if err != nil {
		log.Fatalf("list migrations: %v", err)
	}
	sort.Strings(files)

	for _, file := range files {
		version := filepath.Base(file)
		var exists bool
		if err := pool.QueryRow(ctx, `select exists(select 1 from schema_migrations where version = $1)`, version).Scan(&exists); err != nil {
			log.Fatalf("check migration %s: %v", version, err)
		}
		if exists {
			log.Printf("skip %s", version)
			continue
		}

		sqlBytes, err := os.ReadFile(file)
		if err != nil {
			log.Fatalf("read %s: %v", version, err)
		}
		sql := strings.TrimSpace(string(sqlBytes))
		if sql == "" {
			log.Printf("skip empty %s", version)
			continue
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			log.Fatalf("begin %s: %v", version, err)
		}
		if _, err := tx.Exec(ctx, sql); err != nil {
			_ = tx.Rollback(ctx)
			log.Fatalf("apply %s: %v", version, err)
		}
		if _, err := tx.Exec(ctx, `insert into schema_migrations (version) values ($1)`, version); err != nil {
			_ = tx.Rollback(ctx)
			log.Fatalf("record %s: %v", version, err)
		}
		if err := tx.Commit(ctx); err != nil {
			log.Fatalf("commit %s: %v", version, err)
		}
		log.Printf("applied %s", version)
	}
}
