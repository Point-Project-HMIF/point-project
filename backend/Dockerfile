FROM golang:1.25-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/api ./cmd/api \
  && CGO_ENABLED=0 GOOS=linux go build -o /out/migrate ./cmd/migrate

FROM alpine:3.22

RUN apk add --no-cache ca-certificates tzdata wget

WORKDIR /app

COPY --from=builder /out/api /app/api
COPY --from=builder /out/migrate /app/migrate
COPY migrations /app/migrations

ENV HTTP_ADDR=:8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1

CMD ["/bin/sh", "-c", "/app/migrate && exec /app/api"]
