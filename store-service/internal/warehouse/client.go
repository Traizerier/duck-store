package warehouse

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ErrDuckNotFound is returned (wrapped) by LookupPrice when the warehouse
// responds 404 — i.e. no active duck matches the requested color+size.
// Callers use errors.Is to distinguish this from upstream faults so they can
// surface a 404 to the client instead of a 502.
var ErrDuckNotFound = errors.New("duck not found")

type Client struct {
	baseURL string
	http    *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: 5 * time.Second},
	}
}

// LookupPrice fetches the active duck matching color + size from the
// warehouse service and returns its price.
func (c *Client) LookupPrice(ctx context.Context, color, size string) (float64, error) {
	q := url.Values{}
	q.Set("color", color)
	q.Set("size", size)
	endpoint := fmt.Sprintf("%s/api/ducks/lookup?%s", c.baseURL, q.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, fmt.Errorf("build warehouse request: %w", err)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return 0, fmt.Errorf("warehouse request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return 0, fmt.Errorf("color=%s, size=%s: %w", color, size, ErrDuckNotFound)
	}
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("warehouse returned status %d", resp.StatusCode)
	}

	var duck struct {
		Price float64 `json:"price"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&duck); err != nil {
		return 0, fmt.Errorf("decode warehouse response: %w", err)
	}
	return duck.Price, nil
}
