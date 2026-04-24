package packaging

import (
	"slices"
	"testing"
)

func TestIsValidShippingMode(t *testing.T) {
	cases := []struct {
		mode  ShippingMode
		valid bool
	}{
		{Air, true},
		{Land, true},
		{Sea, true},
		{"rocket", false},
		{"", false},
		{"AIR", false}, // case-sensitive — lowercase only per the spec
	}
	for _, c := range cases {
		t.Run(string(c.mode), func(t *testing.T) {
			if got := IsValidShippingMode(c.mode); got != c.valid {
				t.Errorf("IsValidShippingMode(%q) = %v, want %v", c.mode, got, c.valid)
			}
		})
	}
}

func TestShippingModes(t *testing.T) {
	modes := ShippingModes()
	want := []ShippingMode{Air, Land, Sea}
	if !slices.Equal(modes, want) {
		t.Errorf("ShippingModes() = %v, want %v", modes, want)
	}
}

func TestBuild_MaterialBySize(t *testing.T) {
	cases := []struct {
		size     Size
		expected Material
	}{
		{XLarge, Wood},
		{Large, Wood},
		{Medium, Cardboard},
		{Small, Plastic},
		{XSmall, Plastic},
	}
	for _, c := range cases {
		t.Run(string(c.size), func(t *testing.T) {
			pkg, err := Build(c.size, Air)
			if err != nil {
				t.Fatalf("Build(%q, Air) unexpected error: %v", c.size, err)
			}
			if got := pkg.Material(); got != c.expected {
				t.Errorf("Build(%q, Air).Material() = %q, want %q", c.size, got, c.expected)
			}
		})
	}
}

func TestBuild_ProtectionsByModeAndMaterial(t *testing.T) {
	cases := []struct {
		name     string
		size     Size
		mode     ShippingMode
		expected []Protection
	}{
		{"air_wood", Large, Air, []Protection{Polystyrene}},
		{"air_cardboard", Medium, Air, []Protection{Polystyrene}},
		{"air_plastic", Small, Air, []Protection{BubbleWrap}},
		{"land_wood", Large, Land, []Protection{Polystyrene}},
		{"land_cardboard", Medium, Land, []Protection{Polystyrene}},
		{"land_plastic", Small, Land, []Protection{Polystyrene}},
		{"sea_wood", Large, Sea, []Protection{MoistureBeads, BubbleWrap}},
		{"sea_cardboard", Medium, Sea, []Protection{MoistureBeads, BubbleWrap}},
		{"sea_plastic", Small, Sea, []Protection{MoistureBeads, BubbleWrap}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			pkg, err := Build(c.size, c.mode)
			if err != nil {
				t.Fatalf("Build(%q, %q) unexpected error: %v", c.size, c.mode, err)
			}
			if got := pkg.Protections(); !slices.Equal(got, c.expected) {
				t.Errorf("Build(%q, %q).Protections() = %v, want %v", c.size, c.mode, got, c.expected)
			}
		})
	}
}

func TestBuild_UnknownShippingMode(t *testing.T) {
	cases := []ShippingMode{"rocket", "", "AIR" /* wrong case */}
	for _, mode := range cases {
		t.Run(string(mode), func(t *testing.T) {
			pkg, err := Build(Large, mode)
			if err == nil {
				t.Errorf("Build(Large, %q) returned nil error for unknown shipping mode", mode)
			}
			if pkg.Material() != "" || len(pkg.Protections()) != 0 {
				t.Errorf("Build(Large, %q) returned non-zero Package on error: %+v", mode, pkg)
			}
		})
	}
}

func TestBuild_UnknownSize(t *testing.T) {
	cases := []Size{"Huge", "", "XXLarge", "large" /* wrong case */}
	for _, size := range cases {
		t.Run(string(size), func(t *testing.T) {
			pkg, err := Build(size, Air)
			if err == nil {
				t.Errorf("Build(%q, Air) returned nil error for unknown size", size)
			}
			// Zero-value Package guarantee — callers that ignore the error
			// shouldn't get a populated package.
			if pkg.Material() != "" || len(pkg.Protections()) != 0 {
				t.Errorf("Build(%q, Air) returned non-zero Package on error: %+v", size, pkg)
			}
		})
	}
}

// The service is a thin adapter over Build; one test that round-trips a
// happy-path and an error-path is enough to catch regressions where the
// method signature drifts from the underlying function.
func TestPackagingService_Build(t *testing.T) {
	svc := NewService()
	if svc.Name() != "packaging" {
		t.Errorf("Name() = %q, want %q", svc.Name(), "packaging")
	}

	pkg, err := svc.Build(Large, Air)
	if err != nil {
		t.Fatalf("Build(Large, Air): %v", err)
	}
	if pkg.Material() != Wood {
		t.Errorf("Material = %q, want %q", pkg.Material(), Wood)
	}

	if _, err := svc.Build("Humongous", Air); err == nil {
		t.Error("Build(Humongous, Air): expected error on unknown size")
	}
}
