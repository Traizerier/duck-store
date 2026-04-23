// Package enums loads the canonical duck color and size lists from
// shared/enums.json at the repo root. It's the single source of truth
// that warehouse-service, store-service, and frontend all agree on.
//
// Store-service loads this at main() startup and wires the result into
// order.Handler. If the file is missing or malformed the service should
// refuse to start — colors and sizes are a program-structure invariant,
// not a runtime concern.
package enums

import (
	"encoding/json"
	"fmt"
	"os"
)

type Enums struct {
	Colors []string `json:"colors"`
	Sizes  []string `json:"sizes"`
}

func Load(path string) (*Enums, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	var e Enums
	if err := json.Unmarshal(data, &e); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	if len(e.Colors) == 0 {
		return nil, fmt.Errorf("%s: colors is empty", path)
	}
	if len(e.Sizes) == 0 {
		return nil, fmt.Errorf("%s: sizes is empty", path)
	}
	return &e, nil
}
