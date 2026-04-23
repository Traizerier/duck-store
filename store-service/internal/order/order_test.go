package order

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
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

func postOrder(t *testing.T, client WarehouseClient, body any) *httptest.ResponseRecorder {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("encode body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	Handler(client)(rec, req)
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
	Handler(&fakeWarehouse{price: 10})(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestHandler_ValidationError(t *testing.T) {
	cases := []struct {
		name string
		body Request
	}{
		{"unknown color", Request{Color: "Blue", Size: "Large", Quantity: 5, Country: "USA", ShippingMode: "air"}},
		{"unknown size", Request{Color: "Red", Size: "Huge", Quantity: 5, Country: "USA", ShippingMode: "air"}},
		{"zero quantity", Request{Color: "Red", Size: "Large", Quantity: 0, Country: "USA", ShippingMode: "air"}},
		{"negative quantity", Request{Color: "Red", Size: "Large", Quantity: -1, Country: "USA", ShippingMode: "air"}},
		{"missing country", Request{Color: "Red", Size: "Large", Quantity: 5, Country: "", ShippingMode: "air"}},
		{"unknown shipping mode", Request{Color: "Red", Size: "Large", Quantity: 5, Country: "USA", ShippingMode: "rocket"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := postOrder(t, &fakeWarehouse{price: 10}, c.body)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want 400 (body: %s)", rec.Code, rec.Body.String())
			}
		})
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
