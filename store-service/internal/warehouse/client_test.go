package warehouse

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClient_LookupPrice_HappyPath(t *testing.T) {
	var (
		gotPath  string
		gotColor string
		gotSize  string
	)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotColor = r.URL.Query().Get("color")
		gotSize = r.URL.Query().Get("size")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":1,"color":"Red","size":"Large","price":15.99,"quantity":10,"deleted":false}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	price, err := client.LookupPrice(context.Background(), "Red", "Large")
	if err != nil {
		t.Fatalf("LookupPrice: %v", err)
	}
	if price != 15.99 {
		t.Errorf("price = %v, want 15.99", price)
	}
	if gotPath != "/api/ducks/lookup" {
		t.Errorf("path = %q, want /api/ducks/lookup", gotPath)
	}
	if gotColor != "Red" {
		t.Errorf("color query = %q, want Red", gotColor)
	}
	if gotSize != "Large" {
		t.Errorf("size query = %q, want Large", gotSize)
	}
}

func TestClient_LookupPrice_NotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	_, err := NewClient(server.URL).LookupPrice(context.Background(), "Red", "Large")
	if err == nil {
		t.Error("expected error for 404, got nil")
	}
}

func TestClient_LookupPrice_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	_, err := NewClient(server.URL).LookupPrice(context.Background(), "Red", "Large")
	if err == nil {
		t.Error("expected error for 500, got nil")
	}
}

func TestClient_LookupPrice_MalformedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("not json"))
	}))
	defer server.Close()

	_, err := NewClient(server.URL).LookupPrice(context.Background(), "Red", "Large")
	if err == nil {
		t.Error("expected error for malformed response, got nil")
	}
}

func TestClient_LookupPrice_NetworkError(t *testing.T) {
	// 127.0.0.1:1 — port 1 is reserved; connect refused on any reasonable host.
	_, err := NewClient("http://127.0.0.1:1").LookupPrice(context.Background(), "Red", "Large")
	if err == nil {
		t.Error("expected error for unreachable server, got nil")
	}
}
