import { describe, it, expect } from "vitest";
import { calculate } from "./pricing.js";
import { PricingService } from "./service.js";
import { MATERIALS, SHIPPING_MODES } from "../packaging/packaging.js";

const EPS = 0.01;
const almost = (a, b) => Math.abs(a - b) < EPS;

function assertTotal(result, expected) {
  if (!almost(result.total, expected)) {
    throw new Error(`total ${result.total} !≈ ${expected}`);
  }
}

describe("calculate — happy paths", () => {
  it("base * quantity, wood + USA + air (the canonical 211.95 case)", () => {
    // 5 @ 10 = 50 → wood +5% = 52.5 → USA +18% = 61.95 → air 30×5 = 150 → 211.95
    const r = calculate({
      quantity: 5,
      unitPrice: 10,
      material: MATERIALS.Wood,
      country: "USA",
      shippingMode: SHIPPING_MODES.Air,
    });
    assertTotal(r, 211.95);
    expect(r.details.map((d) => d.name)).toEqual([
      "base",
      "material:wood",
      "country:usa",
      "shipping:air",
    ]);
  });

  it("volume discount triggers above threshold", () => {
    // 200 @ 1 = 200 → -20% = 160 → wood +5% = 168 → USA +18% = 198.24 → air 30×200 = 6000 → 6198.24
    const r = calculate({
      quantity: 200,
      unitPrice: 1,
      material: MATERIALS.Wood,
      country: "USA",
      shippingMode: SHIPPING_MODES.Air,
    });
    const names = r.details.map((d) => d.name);
    expect(names).toContain("volume_discount");
    assertTotal(r, 6198.24);
  });

  it("air bulk discount kicks in above 1000 units", () => {
    // quantity=1001 → air = 30×1001 × (1 - 0.15) = 25525.5
    const r = calculate({
      quantity: 1001,
      unitPrice: 0.01,           // keep pre-shipping small so air is the visible chunk
      material: MATERIALS.Wood,  // wood +5%
      country: "USA",
      shippingMode: SHIPPING_MODES.Air,
    });
    const air = r.details.find((d) => d.name === "shipping:air");
    expect(almost(air.amount, 25525.5)).toBe(true);
  });

  it("sea is flat $400 regardless of quantity", () => {
    const r = calculate({
      quantity: 10,
      unitPrice: 10,
      material: MATERIALS.Wood,
      country: "USA",
      shippingMode: SHIPPING_MODES.Sea,
    });
    expect(r.details.find((d) => d.name === "shipping:sea").amount).toBe(400);
  });

  it("land = 10 per unit", () => {
    const r = calculate({
      quantity: 7,
      unitPrice: 10,
      material: MATERIALS.Plastic,
      country: "Bolivia",
      shippingMode: SHIPPING_MODES.Land,
    });
    expect(r.details.find((d) => d.name === "shipping:land").amount).toBe(70);
  });
});

describe("calculate — country tax variants", () => {
  it.each([
    ["USA",     0.18, "country:usa"],
    ["Bolivia", 0.13, "country:bolivia"],
    ["India",   0.19, "country:india"],
    ["France",  0.15, "country:other"],    // default
    ["",        0.15, "country:other"],
  ])("%s → +%s (%s)", (country, rate, name) => {
    const r = calculate({
      quantity: 1,
      unitPrice: 100,
      material: MATERIALS.Cardboard,   // -1% so the country line is visible
      country,
      shippingMode: SHIPPING_MODES.Land,
    });
    const tax = r.details.find((d) => d.name === name);
    expect(tax).toBeDefined();
    // pre-tax total is 99 (100 - 1% cardboard), tax = 99 * rate
    expect(almost(tax.amount, 99 * rate)).toBe(true);
  });
});

describe("PricingService", () => {
  it("exposes calculate and delegates to the factory", () => {
    const svc = new PricingService();
    const r = svc.calculate({
      quantity: 5,
      unitPrice: 10,
      material: MATERIALS.Wood,
      country: "USA",
      shippingMode: SHIPPING_MODES.Air,
    });
    assertTotal(r, 211.95);
    expect(svc.entityName).toBe("pricing");
  });
});
