package packaging

import (
	"slices"
	"testing"
)

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
			got := Build(c.size, Air).Material()
			if got != c.expected {
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
			got := Build(c.size, c.mode).Protections()
			if !slices.Equal(got, c.expected) {
				t.Errorf("Build(%q, %q).Protections() = %v, want %v", c.size, c.mode, got, c.expected)
			}
		})
	}
}
