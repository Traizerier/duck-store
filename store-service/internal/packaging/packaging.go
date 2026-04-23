package packaging

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

func strategyForSize(s Size) packagingStrategy {
	switch s {
	case XLarge, Large:
		return woodPackaging{}
	case Medium:
		return cardboardPackaging{}
	case Small, XSmall:
		return plasticPackaging{}
	}
	return nil
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

func protectionsFor(material Material, mode ShippingMode) []Protection {
	switch mode {
	case Air:
		if material == Wood || material == Cardboard {
			return []Protection{Polystyrene}
		}
		return []Protection{BubbleWrap}
	case Land:
		return []Protection{Polystyrene}
	case Sea:
		return []Protection{MoistureBeads, BubbleWrap}
	}
	return nil
}

// Build is the public factory: pick a strategy from size, then decorate it
// with protections derived from the shipping mode.
func Build(size Size, mode ShippingMode) Package {
	s := strategyForSize(size)
	m := s.material()
	return Package{
		material:    m,
		protections: protectionsFor(m, mode),
	}
}
