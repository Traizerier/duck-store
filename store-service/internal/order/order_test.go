package order

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"duckstore/store-service/internal/enums"
	"duckstore/store-service/internal/warehouse"
)

type fakeWarehouse struct {
	price float64
	err   error
}

func (f *fakeWarehouse) LookupPrice(ctx context.Context, color, size string) (float64, error) {
	if f.err != nil {
		return 0, f.err
	}
	return f.price, nil
}

// testEnums returns the canonical enums inlined — avoids every test needing
// to resolve shared/enums.json from its own working directory.
func testEnums() *enums.Enums {
	return &enums.Enums{
		Colors: []string{"Red", "Green", "Yellow", "Black"},
		Sizes:  []string{"XLarge", "Large", "Medium", "Small", "XSmall"},
	}
}

func postOrder(t *testing.T, client WarehouseClient, body any) *httptest.ResponseRecorder {
	return postOrderWithEnums(t, client, testEnums(), body)
}

func postOrderWithEnums(t *testing.T, client WarehouseClient, e *enums.Enums, body any) *httptest.ResponseRecorder {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("encode body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	Handler(client, e)(rec, req)
	return rec
}

func TestHandler_HappyPath(t *testing.T) {
	// price=10, qty=5, Large → wood packaging, USA, air
	// Base: 50; no volume discount; wood +5% → 52.5; USA +18% → 61.95;
	// air 30*5 = 150 (no bulk). Total: 211.95.
	client := &fakeWarehouse{price: 10}
	rec := postOrder(t, client, Request{
		Color: "Red", Size: "Large", Quantity: 5,
		Country: "USA", ShippingMode: "air",
	})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}

	var resp Response
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v (body: %s)", err, rec.Body.String())
	}

	if resp.PackageType != "wood" {
		t.Errorf("packageType = %q, want wood", resp.PackageType)
	}
	if len(resp.Protections) != 1 || resp.Protections[0] != "polystyrene" {
		t.Errorf("protections = %v, want [polystyrene]", resp.Protections)
	}
	if resp.Total < 211.94 || resp.Total > 211.96 {
		t.Errorf("total = %f, want 211.95 (±0.01)", resp.Total)
	}
	if len(resp.Details) != 4 {
		t.Errorf("details count = %d, want 4 (base, material, country, shipping)", len(resp.Details))
	}
}

func TestHandler_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewReader([]byte("not json")))
	rec := httptest.NewRecorder()
	Handler(&fakeWarehouse{price: 10}, testEnums())(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestHandler_ValidationError(t *testing.T) {
	cases := []struct {
		name  string
		body  Request
		field string // which key `body.errors` should contain
	}{
		{"unknown color", Request{Color: "Blue", Size: "Large", Quantity: 5, Country: "USA", ShippingMode: "air"}, "color"},
		{"unknown size", Request{Color: "Red", Size: "Huge", Quantity: 5, Country: "USA", ShippingMode: "air"}, "size"},
		{"zero quantity", Request{Color: "Red", Size: "Large", Quantity: 0, Country: "USA", ShippingMode: "air"}, "quantity"},
		{"negative quantity", Request{Color: "Red", Size: "Large", Quantity: -1, Country: "USA", ShippingMode: "air"}, "quantity"},
		{"missing country", Request{Color: "Red", Size: "Large", Quantity: 5, Country: "", ShippingMode: "air"}, "country"},
		{"unknown shipping mode", Request{Color: "Red", Size: "Large", Quantity: 5, Country: "USA", ShippingMode: "rocket"}, "shippingMode"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := postOrder(t, &fakeWarehouse{price: 10}, c.body)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400 (body: %s)", rec.Code, rec.Body.String())
			}
			var resp struct {
				Error  string            `json:"error"`
				Errors map[string]string `json:"errors"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("decode body: %v (raw: %s)", err, rec.Body.String())
			}
			if resp.Error != "ValidationError" {
				t.Errorf("body.error = %q, want \"ValidationError\"", resp.Error)
			}
			if _, ok := resp.Errors[c.field]; !ok {
				t.Errorf("body.errors.%s missing; got errors=%v", c.field, resp.Errors)
			}
		})
	}
}

// Guards against a subtle pricing drift: validate() trims the country to
// check emptiness, but the handler must also propagate the trimmed value
// to pricing or "  USA  " falls through to the default (+15%) tax instead
// of matching USA's (+18%).
func TestHandler_NormalizesCountryWhitespace(t *testing.T) {
	client := &fakeWarehouse{price: 10}
	rec := postOrder(t, client, Request{
		Color: "Red", Size: "Large", Quantity: 5,
		Country: "  USA  ", ShippingMode: "air",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	var resp Response
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	// Same math as the USA happy-path test: base 50 → wood +5% → USA +18% → air 150 = 211.95.
	// If country weren't trimmed, it would match "other" at +15% and produce a different total.
	if resp.Total < 211.94 || resp.Total > 211.96 {
		t.Errorf("total = %f, want 211.95 (USA rate, not default 15%%) — country trim may not be propagating", resp.Total)
	}
}

// Simulates a validator/packaging drift: enums accepts "Huge" so validation
// passes, but packaging rejects it so Build returns an error. Covers the
// handler's 500 internal-error branch. In practice the packaging drift test
// keeps enums and packaging in sync — this is a structural guarantee that
// even under drift, the server reports a 500 instead of panicking.
func TestHandler_500WhenPackagingRejectsValidatedSize(t *testing.T) {
	driftedEnums := &enums.Enums{
		Colors: []string{"Red", "Green", "Yellow", "Black"},
		Sizes:  []string{"Huge"}, // not a packaging.Size constant
	}
	rec := postOrderWithEnums(t, &fakeWarehouse{price: 10}, driftedEnums, Request{
		Color: "Red", Size: "Huge", Quantity: 5,
		Country: "USA", ShippingMode: "air",
	})
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500 (body: %s)", rec.Code, rec.Body.String())
	}
}

func TestHandler_WarehouseError(t *testing.T) {
	client := &fakeWarehouse{err: errors.New("warehouse down")}
	rec := postOrder(t, client, Request{
		Color: "Red", Size: "Large", Quantity: 5,
		Country: "USA", ShippingMode: "air",
	})
	if rec.Code != http.StatusBadGateway {
		t.Errorf("status = %d, want 502 (body: %s)", rec.Code, rec.Body.String())
	}
}

// A missing duck (warehouse answered correctly — 404) is a client-input
// problem, not an upstream fault, so it must surface as 404 to the order
// client. Otherwise it pages on-call for what is really a validation miss.
func TestHandler_WarehouseDuckNotFound_ReturnsNotFound(t *testing.T) {
	client := &fakeWarehouse{err: warehouse.ErrDuckNotFound}
	rec := postOrder(t, client, Request{
		Color: "Red", Size: "Large", Quantity: 5,
		Country: "USA", ShippingMode: "air",
	})
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 (body: %s)", rec.Code, rec.Body.String())
	}
	var body struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v (raw: %s)", err, rec.Body.String())
	}
	if body.Error == "" {
		t.Errorf("body.error empty; want a human-readable message (body: %s)", rec.Body.String())
	}
}

// Wrapped ErrDuckNotFound (as the real client returns — fmt.Errorf("...: %w"))
// must still route to 404. Guards against a regression where the handler does
// `err == warehouse.ErrDuckNotFound` instead of `errors.Is`.
func TestHandler_WrappedDuckNotFound_StillReturnsNotFound(t *testing.T) {
	wrapped := wrappedErr{msg: "color=Red, size=Large", inner: warehouse.ErrDuckNotFound}
	client := &fakeWarehouse{err: wrapped}
	rec := postOrder(t, client, Request{
		Color: "Red", Size: "Large", Quantity: 5,
		Country: "USA", ShippingMode: "air",
	})
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 for wrapped ErrDuckNotFound (body: %s)", rec.Code, rec.Body.String())
	}
}

type wrappedErr struct {
	msg   string
	inner error
}

func (w wrappedErr) Error() string { return w.msg + ": " + w.inner.Error() }
func (w wrappedErr) Unwrap() error { return w.inner }
