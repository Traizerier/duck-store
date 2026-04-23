package order

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"

	"duckstore/store-service/internal/enums"
	"duckstore/store-service/internal/packaging"
	"duckstore/store-service/internal/pricing"
	"duckstore/store-service/internal/warehouse"
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

// Handler builds a POST /api/orders handler. Takes the warehouse client plus
// the shared enums so color/size validation reads from the canonical source.
func Handler(client WarehouseClient, e *enums.Enums) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req Request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
			return
		}

		// Normalize before validation so downstream pricing sees the same
		// value we validated against. Without this, "  USA  " passes the
		// non-empty check but falls through to the default (+15%) tax.
		req.Country = strings.TrimSpace(req.Country)

		if errs := validate(req, e); errs != nil {
			writeValidationError(w, errs)
			return
		}

		price, err := client.LookupPrice(r.Context(), req.Color, req.Size)
		if err != nil {
			// A 404 from the warehouse means the warehouse answered
			// correctly — this color+size combination has no active duck.
			// That's a client-input problem (404), not an upstream fault
			// (502); surfacing it as 502 would page on-call for nothing.
			if errors.Is(err, warehouse.ErrDuckNotFound) {
				writeError(w, http.StatusNotFound, "no duck available for color="+req.Color+", size="+req.Size)
				return
			}
			writeError(w, http.StatusBadGateway, "warehouse lookup failed: "+err.Error())
			return
		}

		size := packaging.Size(req.Size)
		mode := packaging.ShippingMode(req.ShippingMode)
		pkg, err := packaging.Build(size, mode)
		if err != nil {
			// Unreachable in practice — validate() rejects unknown sizes
			// before we get here. Guarding anyway so a future validator
			// drift (or direct call) doesn't take down the server.
			writeError(w, http.StatusInternalServerError, "internal error: "+err.Error())
			return
		}
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

// validate returns a field-keyed map of validation messages, or nil if the
// request is valid. The shape mirrors warehouse-service's ValidationError
// envelope so a shared frontend client can handle both.
func validate(req Request, e *enums.Enums) map[string]string {
	errs := map[string]string{}

	if !slices.Contains(e.Colors, req.Color) {
		errs["color"] = "must be one of: " + strings.Join(e.Colors, ", ")
	}
	if !slices.Contains(e.Sizes, req.Size) {
		errs["size"] = "must be one of: " + strings.Join(e.Sizes, ", ")
	}
	if req.Quantity <= 0 {
		errs["quantity"] = "must be a positive integer"
	}
	if !packaging.IsValidShippingMode(packaging.ShippingMode(req.ShippingMode)) {
		errs["shippingMode"] = "must be one of: " + joinModes(packaging.ShippingModes())
	}
	if strings.TrimSpace(req.Country) == "" {
		errs["country"] = "required"
	}

	if len(errs) == 0 {
		return nil
	}
	return errs
}

func joinModes(ms []packaging.ShippingMode) string {
	ss := make([]string, len(ms))
	for i, m := range ms {
		ss[i] = string(m)
	}
	return strings.Join(ss, ", ")
}

// --- HTTP response helpers --------------------------------------------------

// writeError emits {error: msg} — used for non-validation problems like
// invalid JSON or upstream warehouse failures.
func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

// writeValidationError emits {error: "ValidationError", errors: {field: msg}}
// — matches warehouse-service's envelope so shared client code can parse
// both services uniformly.
func writeValidationError(w http.ResponseWriter, fields map[string]string) {
	writeJSON(w, http.StatusBadRequest, map[string]any{
		"error":  "ValidationError",
		"errors": fields,
	})
}

func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	// Encode runs after WriteHeader, so the status is already on the wire —
	// we can't propagate an error to the caller or change the response code,
	// and a second Write would corrupt the body. Dropping is intentional.
	// Once structured logging (ticket 004) lands, this branch is the natural
	// place for a DEBUG-level record of post-header failures (client
	// disconnect, broken pipe mid-write).
	if err := json.NewEncoder(w).Encode(body); err != nil {
		_ = err
	}
}
