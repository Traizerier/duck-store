import { MATERIALS, SHIPPING_MODES } from "../packaging/packaging.js";

// Chain of Responsibility: each rule mutates a shared context
// (quantity/unitPrice/material/country/shippingMode → running total +
// details trace). Adding a new rule is a single append to the `rules` array.

// --- business constants ----------------------------------------------------
const VOLUME_DISCOUNT_THRESHOLD = 100;
const VOLUME_DISCOUNT_RATE = 0.20;

const WOOD_RATE = 0.05;
const CARDBOARD_RATE = -0.01;
const PLASTIC_RATE = 0.10;

const USA_TAX_RATE = 0.18;
const BOLIVIA_TAX_RATE = 0.13;
const INDIA_TAX_RATE = 0.19;
const DEFAULT_TAX_RATE = 0.15;

const SEA_SHIPPING_FLAT = 400.0;
const LAND_RATE_PER_UNIT = 10.0;
const AIR_RATE_PER_UNIT = 30.0;
const AIR_BULK_THRESHOLD = 1000;
const AIR_BULK_DISCOUNT = 0.15;

// --- rule primitives -------------------------------------------------------

function applyPercentage(ctx, rate, name) {
  const amount = ctx.total * rate;
  ctx.total += amount;
  ctx.details.push({ name, amount });
}

function applyBase(ctx) {
  const amount = ctx.quantity * ctx.unitPrice;
  ctx.total = amount;
  ctx.details.push({ name: "base", amount });
}

function applyVolumeDiscount(ctx) {
  if (ctx.quantity <= VOLUME_DISCOUNT_THRESHOLD) return;
  applyPercentage(ctx, -VOLUME_DISCOUNT_RATE, "volume_discount");
}

function applyMaterialAdjustment(ctx) {
  switch (ctx.material) {
    case MATERIALS.Wood:      applyPercentage(ctx, WOOD_RATE,      "material:wood"); break;
    case MATERIALS.Cardboard: applyPercentage(ctx, CARDBOARD_RATE, "material:cardboard"); break;
    case MATERIALS.Plastic:   applyPercentage(ctx, PLASTIC_RATE,   "material:plastic"); break;
    // unknown material: no-op — validation should've caught it upstream
  }
}

function applyCountryTax(ctx) {
  switch (ctx.country) {
    case "USA":     applyPercentage(ctx, USA_TAX_RATE,     "country:usa"); break;
    case "Bolivia": applyPercentage(ctx, BOLIVIA_TAX_RATE, "country:bolivia"); break;
    case "India":   applyPercentage(ctx, INDIA_TAX_RATE,   "country:india"); break;
    default:        applyPercentage(ctx, DEFAULT_TAX_RATE, "country:other");
  }
}

function applyShippingSurcharge(ctx) {
  let amount;
  let name;
  switch (ctx.shippingMode) {
    case SHIPPING_MODES.Sea:
      amount = SEA_SHIPPING_FLAT;
      name = "shipping:sea";
      break;
    case SHIPPING_MODES.Land:
      amount = LAND_RATE_PER_UNIT * ctx.quantity;
      name = "shipping:land";
      break;
    case SHIPPING_MODES.Air:
      amount = AIR_RATE_PER_UNIT * ctx.quantity;
      if (ctx.quantity > AIR_BULK_THRESHOLD) amount *= 1 - AIR_BULK_DISCOUNT;
      name = "shipping:air";
      break;
    default:
      return;
  }
  ctx.total += amount;
  ctx.details.push({ name, amount });
}

// Chain order matters: percentages compound on the running total, and
// shipping is additive so its position changes the final figure.
const rules = [
  applyBase,
  applyVolumeDiscount,
  applyMaterialAdjustment,
  applyCountryTax,
  applyShippingSurcharge,
];

// --- public API ------------------------------------------------------------

// calculate takes { quantity, unitPrice, material, country, shippingMode }
// and returns { total, details: [{name, amount}, ...] }.
export function calculate(req) {
  const ctx = {
    quantity: req.quantity,
    unitPrice: req.unitPrice,
    material: req.material,
    country: req.country,
    shippingMode: req.shippingMode,
    total: 0,
    details: [],
  };
  for (const rule of rules) rule(ctx);
  return { total: ctx.total, details: ctx.details };
}
