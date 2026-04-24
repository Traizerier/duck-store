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
	"duckstore/store-service/internal/packaging"
	"duckstore/store-service/internal/pricing"
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

	warehouseClient := warehouse.NewClient(warehouseURL)
	packagingSvc := packaging.NewService()
	pricingSvc := pricing.NewService()
	orderSvc := order.NewService(warehouseClient, packagingSvc, pricingSvc, sharedEnums)

	// Per-service init log. Tags each line with the service's Name() so
	// operators can see at boot which services got wired in — and the
	// tagging pattern is the same one used at error sites below, so a
	// future structured logger (ticket P004) can lift both paths into
	// slog.Info / slog.Error without shape churn.
	for _, svc := range []interface{ Name() string }{packagingSvc, pricingSvc, orderSvc} {
		log.Printf("service initialized: %s", svc.Name())
	}

	mux := http.NewServeMux()
	mux.Handle("POST /api/orders", orderSvc.Handler())
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
