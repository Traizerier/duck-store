package main

import (
	"log"
	"net/http"
	"os"

	"duckstore/store-service/internal/order"
	"duckstore/store-service/internal/warehouse"
)

func main() {
	port := getenv("PORT", "4002")
	warehouseURL := getenv("WAREHOUSE_URL", "http://localhost:4001")

	client := warehouse.NewClient(warehouseURL)

	mux := http.NewServeMux()
	mux.Handle("POST /api/orders", order.Handler(client))
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	log.Printf("store-service listening on :%s (warehouse: %s)", port, warehouseURL)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
