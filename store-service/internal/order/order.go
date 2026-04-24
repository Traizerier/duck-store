package order

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"slices"
	"strings"

	"duckstore/store-service/internal/enums"
	"duckstore/store-service/internal/packaging"
	"duckstore/store-service/internal/pricing"
	"duckstore/store-service/internal/service"
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

// --- consumer-side interfaces -----------------------------------------------

// WarehouseClient is the contract OrderService needs from the warehouse.
// A fake in tests, a real HTTP client in production.
type WarehouseClient interface {
	LookupPrice(ctx context.Context, color, size string) (float64, error)
}

// Packager is what OrderService needs from a packaging implementation. The
// interface is declared here (consumer side) so packaging.PackagingService
// satisfies it structurally — no reverse dependency.
type Packager interface {
	Build(size packaging.Size, mode packaging.ShippingMode) (packaging.Package, error)
}

// Pricer is what OrderService needs from a pricing implementation.
type Pricer interface {
	Calculate(req pricing.Request) pricing.Result
}

// --- service ----------------------------------------------------------------

// OrderService orchestrates the order-processing pipeline: validate → lookup
// warehouse price → build packaging → calculate total. Dependencies are
// injected so tests (and future reusers like a CLI) can swap them out.
type OrderService struct {
	service.BaseService
	warehouse WarehouseClient
	packager  Packager
	pricer    Pricer
	enums     *enums.Enums
}

func NewService(wh WarehouseClient, pkg Packager, pr Pricer, e *enums.Enums) *OrderService {
	return &OrderService{
		BaseService: service.New("order"),
		warehouse:   wh,
		packager:    pkg,
		pricer:      pr,
		enums:       e,
	}
}

// --- error types ------------------------------------------------------------

// ValidationError carries field-keyed messages for 400 responses. Parallels
// warehouse-service's envelope so a shared client can parse both.
type ValidationError struct {
	Fields map[string]string
}

func (e *ValidationError) Error() string { return "validation failed" }

// ErrInternal marks "validator and packaging/pricing disagree" failures —
// a server-side bug, not a client input problem. Maps to 500.
var ErrInternal = errors.New("internal error")

// --- Process: pure business logic ------------------------------------------

// Process runs the order pipeline without any HTTP concerns. Returns typed
// errors so Handler can map them to status codes:
//   - *ValidationError          → 400 ValidationError envelope
//   - errors.Is ErrDuckNotFound → 404
//   - errors.Is ErrInternal     → 500
//   - anything else             → 502 (upstream warehouse fault)
func (s *OrderService) Process(ctx context.Context, req Request) (Response, error) {
	// Normalize before validation so downstream pricing sees the same
	// value we validated against. Without this, "  USA  " passes the
	// non-empty check but falls through to the default (+15%) tax.
	req.Country = strings.TrimSpace(req.Country)

	if errs := validate(req, s.enums); errs != nil {
		return Response{}, &ValidationError{Fields: errs}
	}

	price, err := s.warehouse.LookupPrice(ctx, req.Color, req.Size)
	if err != nil {
		// Forward as-is; the wrap preserves errors.Is(..., ErrDuckNotFound).
		return Response{}, err
	}

	size := packaging.Size(req.Size)
	mode := packaging.ShippingMode(req.ShippingMode)
	pkg, err := s.packager.Build(size, mode)
	if err != nil {
		// Unreachable in practice — validate() rejects unknown sizes before
		// we get here. Guarded so a future validator drift doesn't panic.
		return Response{}, fmt.Errorf("%w: %s", ErrInternal, err.Error())
	}
	result := s.pricer.Calculate(pricing.Request{
		Quantity:     req.Quantity,
		UnitPrice:    price,
		Material:     pkg.Material(),
		Country:      req.Country,
		ShippingMode: mode,
	})

	return Response{
		PackageType: string(pkg.Material()),
		Protections: pkg.Protections(),
		Total:       result.Total,
		Details:     result.Details,
	}, nil
}

// --- Handler: HTTP shell ----------------------------------------------------

// Handler is the thin HTTP adapter around Process. It decodes the request,
// delegates the pipeline, and translates typed errors to status codes.
func (s *OrderService) Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req Request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "BadRequest", "invalid JSON: "+err.Error())
			return
		}

		resp, err := s.Process(r.Context(), req)
		if err != nil {
			var verr *ValidationError
			switch {
			case errors.As(err, &verr):
				writeValidationError(w, verr.Fields)
			case errors.Is(err, warehouse.ErrDuckNotFound):
				writeError(w, http.StatusNotFound, "NotFoundError",
					"no duck available for color="+req.Color+", size="+req.Size)
			case errors.Is(err, ErrInternal):
				// 500s are never a client-actionable message. Keep the
				// detail on the server, tagged with this service's Name()
				// so a future structured logger (ticket 004) can pick it
				// up without shape churn.
				log.Printf("[%s] internal error: %v", s.Name(), err)
				writeError(w, http.StatusInternalServerError,
					"InternalServerError", "internal error")
			default:
				writeError(w, http.StatusBadGateway, "UpstreamError",
					"warehouse lookup failed: "+err.Error())
			}
			return
		}

		writeJSON(w, http.StatusOK, resp)
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

// writeError emits the canonical error envelope shared across both services:
//
//	{"error": <TypedCode>, "message": <human-readable>}
//
// The typed code (e.g. "NotFoundError", "UpstreamError") lets a client
// dispatch on the error class; the message is free-form debug copy.
// Mirrors warehouse-service/src/app.js's error middleware.
func writeError(w http.ResponseWriter, code int, typedCode, msg string) {
	writeJSON(w, code, map[string]string{
		"error":   typedCode,
		"message": msg,
	})
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
