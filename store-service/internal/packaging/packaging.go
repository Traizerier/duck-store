package packaging

import "fmt"

type Material string
type Protection string
type Size string
type ShippingMode string

const (
	Wood      Material = "wood"
	Cardboard Material = "cardboard"
	Plastic   Material = "plastic"

	Polystyrene   Protection = "polystyrene"
	BubbleWrap    Protection = "bubble_wrap"
	MoistureBeads Protection = "moisture_beads"

	XLarge Size = "XLarge"
	Large  Size = "Large"
	Medium Size = "Medium"
	Small  Size = "Small"
	XSmall Size = "XSmall"

	Air  ShippingMode = "air"
	Land ShippingMode = "land"
	Sea  ShippingMode = "sea"
)

// --- shipping modes (registry + validator) ---------------------------------
// Single source of truth: any code that needs to check or enumerate valid
// shipping modes reads from here instead of hardcoding its own switch.

var shippingModes = []ShippingMode{Air, Land, Sea}

// ShippingModes returns the canonical list of supported shipping modes in
// declaration order. Returns a fresh slice so callers can't mutate the
// package-level registry.
func ShippingModes() []ShippingMode {
	return append([]ShippingMode(nil), shippingModes...)
}

// IsValidShippingMode reports whether m is a supported shipping mode.
func IsValidShippingMode(m ShippingMode) bool {
	for _, v := range shippingModes {
		if v == m {
			return true
		}
	}
	return false
}

// --- Strategy pattern -------------------------------------------------------
// Each strategy exposes the material it uses. Concrete strategies are
// unexported — outside the package they're only reachable via Build.

type packagingStrategy interface {
	material() Material
}

type woodPackaging struct{}
type cardboardPackaging struct{}
type plasticPackaging struct{}

func (woodPackaging) material() Material      { return Wood }
func (cardboardPackaging) material() Material { return Cardboard }
func (plasticPackaging) material() Material   { return Plastic }

func strategyForSize(s Size) (packagingStrategy, error) {
	switch s {
	case XLarge, Large:
		return woodPackaging{}, nil
	case Medium:
		return cardboardPackaging{}, nil
	case Small, XSmall:
		return plasticPackaging{}, nil
	}
	return nil, fmt.Errorf("unknown size %q", s)
}

// --- Decorator pattern ------------------------------------------------------
// Package wraps a selected strategy and adds protections derived from the
// material + shipping mode.

type Package struct {
	material    Material
	protections []Protection
}

func (p Package) Material() Material        { return p.material }
func (p Package) Protections() []Protection { return p.protections }

func protectionsFor(material Material, mode ShippingMode) ([]Protection, error) {
	switch mode {
	case Air:
		if material == Wood || material == Cardboard {
			return []Protection{Polystyrene}, nil
		}
		return []Protection{BubbleWrap}, nil
	case Land:
		return []Protection{Polystyrene}, nil
	case Sea:
		return []Protection{MoistureBeads, BubbleWrap}, nil
	}
	return nil, fmt.Errorf("unknown shipping mode %q", mode)
}

// Build is the public factory: pick a strategy from size, then decorate it
// with protections derived from the shipping mode. Returns an error for
// unknown sizes so callers can't trigger a nil-pointer panic by bypassing
// upstream validation.
func Build(size Size, mode ShippingMode) (Package, error) {
	s, err := strategyForSize(size)
	if err != nil {
		return Package{}, fmt.Errorf("packaging.Build: %w", err)
	}
	m := s.material()
	prot, err := protectionsFor(m, mode)
	if err != nil {
		return Package{}, fmt.Errorf("packaging.Build: %w", err)
	}
	return Package{
		material:    m,
		protections: prot,
	}, nil
}
