# syntax=docker/dockerfile:1

# ---- base: shared env for dev and builder ----
FROM golang:1.22-alpine AS base

# Non-root user; pre-create workspace + go module cache with app ownership so
# bind mounts and named volumes inherit writable perms on first mount.
RUN adduser -D -u 10001 app \
    && mkdir -p /workspace/store-service /go/pkg/mod \
    && chown -R app:app /workspace /go

WORKDIR /workspace/store-service
USER app

# ---- builder: compiles the prod binary ----
FROM base AS builder

COPY --chown=app:app go.mod go.sum* ./
RUN go mod download

COPY --chown=app:app . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /tmp/server ./cmd/server

# ---- prod runtime ----
FROM alpine:3.19 AS prod
RUN adduser -D -u 10001 app
COPY --from=builder /tmp/server /usr/local/bin/server

USER app
EXPOSE 4002
CMD ["/usr/local/bin/server"]
