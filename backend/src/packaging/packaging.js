// Strategy + Decorator: size → strategy (picks material), then
// (material, shippingMode) → list of protections that decorate the
// resulting Package.

export const MATERIALS = Object.freeze({
  Wood: "wood",
  Cardboard: "cardboard",
  Plastic: "plastic",
});

export const PROTECTIONS = Object.freeze({
  Polystyrene: "polystyrene",
  BubbleWrap: "bubble_wrap",
  MoistureBeads: "moisture_beads",
});

export const SIZES = Object.freeze({
  XLarge: "XLarge",
  Large: "Large",
  Medium: "Medium",
  Small: "Small",
  XSmall: "XSmall",
});

export const SHIPPING_MODES = Object.freeze({
  Air: "air",
  Land: "land",
  Sea: "sea",
});

// Single source of truth for valid shipping modes — callers (validators,
// registries) read from here instead of hardcoding their own switch.
const _shippingModeList = Object.freeze([
  SHIPPING_MODES.Air,
  SHIPPING_MODES.Land,
  SHIPPING_MODES.Sea,
]);

export function shippingModes() {
  return _shippingModeList.slice(); // fresh copy so callers can't mutate
}

export function isValidShippingMode(mode) {
  return _shippingModeList.includes(mode);
}

// --- Strategy: size → material --------------------------------------------
const sizeToMaterial = Object.freeze({
  [SIZES.XLarge]: MATERIALS.Wood,
  [SIZES.Large]: MATERIALS.Wood,
  [SIZES.Medium]: MATERIALS.Cardboard,
  [SIZES.Small]: MATERIALS.Plastic,
  [SIZES.XSmall]: MATERIALS.Plastic,
});

function strategyForSize(size) {
  const material = sizeToMaterial[size];
  if (!material) throw new Error(`unknown size "${size}"`);
  return material;
}

// --- Decorator: (material, mode) → protections ----------------------------
function protectionsFor(material, mode) {
  switch (mode) {
    case SHIPPING_MODES.Air:
      if (material === MATERIALS.Wood || material === MATERIALS.Cardboard) {
        return [PROTECTIONS.Polystyrene];
      }
      return [PROTECTIONS.BubbleWrap];
    case SHIPPING_MODES.Land:
      return [PROTECTIONS.Polystyrene];
    case SHIPPING_MODES.Sea:
      return [PROTECTIONS.MoistureBeads, PROTECTIONS.BubbleWrap];
    default:
      throw new Error(`unknown shipping mode "${mode}"`);
  }
}

// Package is the decorator result — a material + its protections. Frozen
// so callers can pass it around without accidental mutation.
export class Package {
  constructor(material, protections) {
    this.material = material;
    this.protections = Object.freeze(protections.slice());
    Object.freeze(this);
  }
}

// Public factory: size → strategy → decorated package. Throws on unknown
// size or mode so callers bypassing upstream validation can't silently
// produce a partially-populated package.
export function build(size, mode) {
  const material = strategyForSize(size);
  const protections = protectionsFor(material, mode);
  return new Package(material, protections);
}
