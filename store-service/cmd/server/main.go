package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"duckstore/store-service/internal/enums"
	"duckstore/store-service/internal/order"
	"duckstore/store-service/internal/warehouse"
)

func main() {
	port := getenv("PORT", "4002")
	warehouseURL := getenv("WAREHOUSE_URL", "http://localhost:4001")
	enumsPath := getenv("ENUMS_PATH", "../shared/enums.json")

	sharedEnums, err := enums.Load(enumsPath)
	if err != nil {
		log.Fatalf("load enums from %s: %v", enumsPath, err)
	}

	client := warehouse.NewClient(warehouseURL)

	mux := http.NewServeMux()
	mux.Handle("POST /api/orders", order.Handler(client, sharedEnums))
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	srv := &http.Server{Addr: ":" + port, Handler: mux}

	// Graceful shutdown. NotifyContext cancels ctx on SIGTERM/SIGINT; the
	// listener goroutine below returns ErrServerClosed once Shutdown runs,
	// which is the normal path and must not log.Fatal.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	go func() {
		log.Printf("store-service listening on :%s (warehouse=%s, enums=%s)",
			port, warehouseURL, enumsPath)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("received shutdown signal, draining")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	log.Println("store-service exited cleanly")
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
