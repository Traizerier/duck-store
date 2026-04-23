// Package pricing computes order totals using a pipeline of pricing rules
// (Chain of Responsibility variant). Each rule reads from a priceContext,
// applies its adjustment to the running total, and records a Detail entry
// that surfaces in the final response. Adding a new rule is a single append
// to the `rules` slice.
package pricing

import "duckstore/store-service/internal/packaging"

// --- business constants -----------------------------------------------------

const (
	volumeDiscountThreshold = 100
	volumeDiscountRate      = 0.20

	woodRate      = 0.05
	cardboardRate = -0.01
	plasticRate   = 0.10

	usaTaxRate     = 0.18
	boliviaTaxRate = 0.13
	indiaTaxRate   = 0.19
	defaultTaxRate = 0.15

	seaShippingFlat  = 400.0
	landRatePerUnit  = 10.0
	airRatePerUnit   = 30.0
	airBulkThreshold = 1000
	airBulkDiscount  = 0.15
)

// --- public API -------------------------------------------------------------

type Request struct {
	Quantity     int
	UnitPrice    float64
	Material     packaging.Material
	Country      string
	ShippingMode packaging.ShippingMode
}

type Detail struct {
	Name   string  `json:"name"`
	Amount float64 `json:"amount"`
}

type Result struct {
	Total   float64
	Details []Detail
}

func Calculate(req Request) Result {
	ctx := &priceContext{
		quantity:     req.Quantity,
		unitPrice:    req.UnitPrice,
		material:     req.Material,
		country:      req.Country,
		shippingMode: req.ShippingMode,
	}
	for _, rule := range rules {
		rule(ctx)
	}
	return Result{Total: ctx.total, Details: ctx.details}
}

// --- chain internals --------------------------------------------------------

type priceContext struct {
	quantity     int
	unitPrice    float64
	material     packaging.Material
	country      string
	shippingMode packaging.ShippingMode
	total        float64
	details      []Detail
}

// Chain order matters: percentages compound on the running total, and
// shipping is additive so its position changes the final figure.
var rules = []func(*priceContext){
	applyBase,
	applyVolumeDiscount,
	applyMaterialAdjustment,
	applyCountryTax,
	applyShippingSurcharge,
}

// applyPercentage applies `rate` against the running total and logs a Detail
// named `name`. Positive rate is a surcharge; negative is a discount.
func applyPercentage(ctx *priceContext, rate float64, name string) {
	amount := ctx.total * rate
	ctx.total += amount
	ctx.details = append(ctx.details, Detail{Name: name, Amount: amount})
}

func applyBase(ctx *priceContext) {
	amount := float64(ctx.quantity) * ctx.unitPrice
	ctx.total = amount
	ctx.details = append(ctx.details, Detail{Name: "base", Amount: amount})
}

func applyVolumeDiscount(ctx *priceContext) {
	if ctx.quantity <= volumeDiscountThreshold {
		return
	}
	applyPercentage(ctx, -volumeDiscountRate, "volume_discount")
}

func applyMaterialAdjustment(ctx *priceContext) {
	switch ctx.material {
	case packaging.Wood:
		applyPercentage(ctx, woodRate, "material:wood")
	case packaging.Cardboard:
		applyPercentage(ctx, cardboardRate, "material:cardboard")
	case packaging.Plastic:
		applyPercentage(ctx, plasticRate, "material:plastic")
	}
}

func applyCountryTax(ctx *priceContext) {
	switch ctx.country {
	case "USA":
		applyPercentage(ctx, usaTaxRate, "country:usa")
	case "Bolivia":
		applyPercentage(ctx, boliviaTaxRate, "country:bolivia")
	case "India":
		applyPercentage(ctx, indiaTaxRate, "country:india")
	default:
		applyPercentage(ctx, defaultTaxRate, "country:other")
	}
}

func applyShippingSurcharge(ctx *priceContext) {
	var amount float64
	var name string
	switch ctx.shippingMode {
	case packaging.Sea:
		amount = seaShippingFlat
		name = "shipping:sea"
	case packaging.Land:
		amount = landRatePerUnit * float64(ctx.quantity)
		name = "shipping:land"
	case packaging.Air:
		amount = airRatePerUnit * float64(ctx.quantity)
		if ctx.quantity > airBulkThreshold {
			amount *= (1 - airBulkDiscount)
		}
		name = "shipping:air"
	default:
		return
	}
	ctx.total += amount
	ctx.details = append(ctx.details, Detail{Name: name, Amount: amount})
}
