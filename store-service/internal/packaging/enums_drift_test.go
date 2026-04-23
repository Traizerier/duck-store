package packaging

import (
	"encoding/json"
	"os"
	"slices"
	"testing"
)

// Guards against drift between the typed packaging.Size constants (which
// drive strategy selection) and the canonical size list in shared/enums.json.
//
// We can't load shared/enums.json into the typed constants directly — Go's
// `const` must be compile-time — so this test is the guarantee that a
// change to one must be reflected in the other.
func TestSize_matchesSharedEnums(t *testing.T) {
	data, err := os.ReadFile("../../../shared/enums.json")
	if err != nil {
		t.Fatalf("read shared/enums.json: %v", err)
	}
	var shared struct {
		Sizes []string `json:"sizes"`
	}
	if err := json.Unmarshal(data, &shared); err != nil {
		t.Fatalf("parse shared/enums.json: %v", err)
	}

	local := []string{string(XLarge), string(Large), string(Medium), string(Small), string(XSmall)}
	if !slices.Equal(local, shared.Sizes) {
		t.Errorf("packaging Size constants %v drift from shared/enums.json sizes %v",
			local, shared.Sizes)
	}
}
