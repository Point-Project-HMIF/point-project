# Point Project 4.0 Website

Implementasi awal sesuai PRD untuk website kompetisi UI/UX Design Point Project 4.0 HMIF ITERA.

Struktur proyek dipisah menjadi:

- `frontend/` - React, TypeScript, Vite, Tailwind CSS
- `backend/` - Go REST API, PostgreSQL-ready

## Menjalankan Backend

```bash
cd backend
copy .env.example .env
go mod tidy
go run ./cmd/migrate
go run ./cmd/api
```

Backend wajib memakai PostgreSQL melalui `DATABASE_URL`. Isi `.env` lokal dengan connection string database, jalankan migrasi, lalu start API.

## Menjalankan Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Default frontend membaca API dari `http://localhost:8080/api`.

## Akun Admin Awal

Saat memakai mode in-memory:

- Email awal: `admin@pointproject.id`
- Password awal: `admin12345`
