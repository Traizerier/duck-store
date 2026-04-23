package enums

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoad_SharedFile(t *testing.T) {
	e, err := Load("../../../shared/enums.json")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(e.Colors) == 0 {
		t.Error("Colors empty — shared/enums.json lost its color list")
	}
	if len(e.Sizes) == 0 {
		t.Error("Sizes empty — shared/enums.json lost its size list")
	}
}

func TestLoad_MissingFile(t *testing.T) {
	if _, err := Load("nonexistent.json"); err == nil {
		t.Error("expected error for missing file, got nil")
	}
}

func TestLoad_InvalidJSON(t *testing.T) {
	tmp := filepath.Join(t.TempDir(), "bad.json")
	if err := os.WriteFile(tmp, []byte("not json"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(tmp); err == nil {
		t.Error("expected error for invalid JSON, got nil")
	}
}

func TestLoad_EmptyColors(t *testing.T) {
	tmp := filepath.Join(t.TempDir(), "empty.json")
	if err := os.WriteFile(tmp, []byte(`{"colors":[],"sizes":["Large"]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(tmp); err == nil {
		t.Error("expected error for empty colors, got nil")
	}
}
