import { describe, it, expect } from "vitest";
import {
  build,
  isValidShippingMode,
  shippingModes,
  MATERIALS,
  PROTECTIONS,
  SIZES,
  SHIPPING_MODES,
} from "./packaging.js";
import { PackagingService } from "./service.js";

describe("isValidShippingMode", () => {
  it.each([
    [SHIPPING_MODES.Air, true],
    [SHIPPING_MODES.Land, true],
    [SHIPPING_MODES.Sea, true],
    ["rocket", false],
    ["", false],
    ["AIR", false], // case-sensitive — lowercase only
  ])("%s → %s", (mode, expected) => {
    expect(isValidShippingMode(mode)).toBe(expected);
  });
});

describe("shippingModes", () => {
  it("returns the canonical list in declaration order", () => {
    expect(shippingModes()).toEqual(["air", "land", "sea"]);
  });
  it("returns a fresh copy each time — mutating the result doesn't affect the registry", () => {
    const a = shippingModes();
    a.push("rocket");
    expect(shippingModes()).toEqual(["air", "land", "sea"]);
  });
});

describe("build — strategy pattern (size → material)", () => {
  it.each([
    [SIZES.XLarge, MATERIALS.Wood],
    [SIZES.Large,  MATERIALS.Wood],
    [SIZES.Medium, MATERIALS.Cardboard],
    [SIZES.Small,  MATERIALS.Plastic],
    [SIZES.XSmall, MATERIALS.Plastic],
  ])("%s → %s", (size, material) => {
    expect(build(size, SHIPPING_MODES.Air).material).toBe(material);
  });

  it("throws on unknown size", () => {
    expect(() => build("Humongous", SHIPPING_MODES.Air)).toThrow(/unknown size/);
  });
});

describe("build — decorator pattern (material + mode → protections)", () => {
  it.each([
    [SIZES.Large,  SHIPPING_MODES.Air,  [PROTECTIONS.Polystyrene]],   // wood + air
    [SIZES.Medium, SHIPPING_MODES.Air,  [PROTECTIONS.Polystyrene]],   // cardboard + air
    [SIZES.Small,  SHIPPING_MODES.Air,  [PROTECTIONS.BubbleWrap]],    // plastic + air
    [SIZES.Large,  SHIPPING_MODES.Land, [PROTECTIONS.Polystyrene]],   // land always polystyrene
    [SIZES.Small,  SHIPPING_MODES.Land, [PROTECTIONS.Polystyrene]],
    [SIZES.Large,  SHIPPING_MODES.Sea,  [PROTECTIONS.MoistureBeads, PROTECTIONS.BubbleWrap]], // sea = 2
    [SIZES.XSmall, SHIPPING_MODES.Sea,  [PROTECTIONS.MoistureBeads, PROTECTIONS.BubbleWrap]],
  ])("%s + %s → %j", (size, mode, expected) => {
    expect(build(size, mode).protections).toEqual(expected);
  });

  it("throws on unknown mode", () => {
    expect(() => build(SIZES.Large, "rocket")).toThrow(/unknown shipping mode/);
  });
});

describe("Package is frozen", () => {
  it("doesn't allow mutation of material/protections", () => {
    const pkg = build(SIZES.Large, SHIPPING_MODES.Air);
    expect(() => { pkg.material = "gold"; }).toThrow();
    expect(() => { pkg.protections.push("gold"); }).toThrow();
  });
});

describe("PackagingService", () => {
  it("exposes build and delegates to the factory", () => {
    const svc = new PackagingService();
    const pkg = svc.build(SIZES.Large, SHIPPING_MODES.Air);
    expect(pkg.material).toBe(MATERIALS.Wood);
    expect(pkg.protections).toEqual([PROTECTIONS.Polystyrene]);
    expect(svc.entityName).toBe("packaging");
  });

  it("propagates errors on unknown size", () => {
    const svc = new PackagingService();
    expect(() => svc.build("Humongous", SHIPPING_MODES.Air)).toThrow(/unknown size/);
  });
});
