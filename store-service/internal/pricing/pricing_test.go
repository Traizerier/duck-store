package pricing

import (
	"math"
	"slices"
	"testing"

	"duckstore/store-service/internal/packaging"
)

const eps = 0.001

func almostEqual(a, b float64) bool {
	return math.Abs(a-b) < eps
}

func TestCalculate(t *testing.T) {
	cases := []struct {
		name                string
		req                 Request
		expectedTotal       float64
		expectedDetailNames []string
	}{
		{
			// Covers: base, cardboard adjustment (-1%), other-country tax (+15%),
			// land shipping (+$10/unit). No volume discount (qty <= 100).
			//  50 * 0.99 * 1.15 + 100 = 156.925
			name: "small_cardboard_other_land",
			req: Request{
				Quantity:     10,
				UnitPrice:    5,
				Material:     packaging.Cardboard,
				Country:      "Germany",
				ShippingMode: packaging.Land,
			},
			expectedTotal:       156.925,
			expectedDetailNames: []string{"base", "material:cardboard", "country:other", "shipping:land"},
		},
		{
			// Covers: volume discount trigger (qty 101 > 100).
			// 101 * 0.8 * 0.99 * 1.15 + 1010 = 1101.9908
			name: "volume_discount_101_units",
			req: Request{
				Quantity:     101,
				UnitPrice:    1,
				Material:     packaging.Cardboard,
				Country:      "Germany",
				ShippingMode: packaging.Land,
			},
			expectedTotal:       1101.9908,
			expectedDetailNames: []string{"base", "volume_discount", "material:cardboard", "country:other", "shipping:land"},
		},
		{
			// Covers: wood (+5%), USA (+18%), sea (+$400 flat).
			// 2000 * 0.8 * 1.05 * 1.18 + 400 = 2382.4
			name: "wood_usa_sea",
			req: Request{
				Quantity:     200,
				UnitPrice:    10,
				Material:     packaging.Wood,
				Country:      "USA",
				ShippingMode: packaging.Sea,
			},
			expectedTotal:       2382.4,
			expectedDetailNames: []string{"base", "volume_discount", "material:wood", "country:usa", "shipping:sea"},
		},
		{
			// Covers: plastic (+10%), Bolivia (+13%), air normal (qty <= 1000).
			// 500 * 1.10 * 1.13 + 30*50 = 2121.5
			name: "plastic_bolivia_air_normal",
			req: Request{
				Quantity:     50,
				UnitPrice:    10,
				Material:     packaging.Plastic,
				Country:      "Bolivia",
				ShippingMode: packaging.Air,
			},
			expectedTotal:       2121.5,
			expectedDetailNames: []string{"base", "material:plastic", "country:bolivia", "shipping:air"},
		},
		{
			// Covers: India (+19%), air bulk (qty > 1000, -15% on shipping).
			// 1500 * 0.8 * 1.10 * 1.19 + 30*1500*0.85 = 1570.80 + 38250 = 39820.80
			name: "india_air_bulk_over_1000",
			req: Request{
				Quantity:     1500,
				UnitPrice:    1,
				Material:     packaging.Plastic,
				Country:      "India",
				ShippingMode: packaging.Air,
			},
			expectedTotal:       39820.80,
			expectedDetailNames: []string{"base", "volume_discount", "material:plastic", "country:india", "shipping:air"},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			result := Calculate(c.req)
			if !almostEqual(result.Total, c.expectedTotal) {
				t.Errorf("Total = %.4f, want %.4f", result.Total, c.expectedTotal)
			}
			names := make([]string, len(result.Details))
			for i, d := range result.Details {
				names[i] = d.Name
			}
			if !slices.Equal(names, c.expectedDetailNames) {
				t.Errorf("detail names = %v, want %v", names, c.expectedDetailNames)
			}
		})
	}
}
