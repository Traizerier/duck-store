package order

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"duckstore/store-service/internal/packaging"
	"duckstore/store-service/internal/pricing"
)

type Request struct {
	Color        string `json:"color"`
	Size         string `json:"size"`
	Quantity     int    `json:"quantity"`
	Country      string `json:"country"`
	ShippingMode string `json:"shippingMode"`
}

type Response struct {
	PackageType string                 `json:"packageType"`
	Protections []packaging.Protection `json:"protections"`
	Total       float64                `json:"total"`
	Details     []pricing.Detail       `json:"details"`
}

// WarehouseClient is the contract the order handler needs from the warehouse
// service. A fake in tests, a real HTTP client in production.
type WarehouseClient interface {
	LookupPrice(ctx context.Context, color, size string) (float64, error)
}

func Handler(client WarehouseClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req Request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
			return
		}
		if err := validate(req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}

		price, err := client.LookupPrice(r.Context(), req.Color, req.Size)
		if err != nil {
			writeError(w, http.StatusBadGateway, "warehouse lookup failed: "+err.Error())
			return
		}

		size := packaging.Size(req.Size)
		mode := packaging.ShippingMode(req.ShippingMode)
		pkg := packaging.Build(size, mode)
		result := pricing.Calculate(pricing.Request{
			Quantity:     req.Quantity,
			UnitPrice:    price,
			Material:     pkg.Material(),
			Country:      req.Country,
			ShippingMode: mode,
		})

		writeJSON(w, http.StatusOK, Response{
			PackageType: string(pkg.Material()),
			Protections: pkg.Protections(),
			Total:       result.Total,
			Details:     result.Details,
		})
	}
}

// --- validation -------------------------------------------------------------

// Spec-defined color palette. No shared source of truth with warehouse-service
// yet — if one emerges (shared package, schema registry), wire it up here.
var validColors = []string{"Red", "Green", "Yellow", "Black"}

func validate(req Request) error {
	var errs []string
	if !isValidColor(req.Color) {
		errs = append(errs, fmt.Sprintf("invalid color %q", req.Color))
	}
	if !isValidSize(req.Size) {
		errs = append(errs, fmt.Sprintf("invalid size %q", req.Size))
	}
	if req.Quantity <= 0 {
		errs = append(errs, "quantity must be positive")
	}
	if !isValidShippingMode(req.ShippingMode) {
		errs = append(errs, fmt.Sprintf("invalid shippingMode %q", req.ShippingMode))
	}
	if strings.TrimSpace(req.Country) == "" {
		errs = append(errs, "country is required")
	}
	if len(errs) > 0 {
		return errors.New(strings.Join(errs, "; "))
	}
	return nil
}

func isValidColor(s string) bool {
	for _, c := range validColors {
		if c == s {
			return true
		}
	}
	return false
}

func isValidSize(s string) bool {
	switch packaging.Size(s) {
	case packaging.XLarge, packaging.Large, packaging.Medium, packaging.Small, packaging.XSmall:
		return true
	}
	return false
}

func isValidShippingMode(s string) bool {
	switch packaging.ShippingMode(s) {
	case packaging.Air, packaging.Land, packaging.Sea:
		return true
	}
	return false
}

// --- HTTP response helpers --------------------------------------------------

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}
