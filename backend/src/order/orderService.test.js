import { describe, it, expect, beforeEach, vi } from "vitest";
import { OrderService } from "./orderService.js";
import { PackagingService } from "../packaging/service.js";
import { PricingService } from "../pricing/service.js";
import { Schema } from "../schemas/Schema.js";
import { ValidationError, NotFoundError } from "../errors.js";

const enums = {
  colors: ["Red", "Green", "Yellow", "Black"],
  sizes: ["XLarge", "Large", "Medium", "Small", "XSmall"],
};

const duckRaw = Object.freeze({
  name: "duck",
  plural: "ducks",
  collection: "ducks",
  fields: {
    color:    { type: "enum",    enumRef: "colors", required: true },
    size:     { type: "enum",    enumRef: "sizes",  required: true },
    price:    { type: "number",  rule: "positive",     required: true },
    quantity: { type: "integer", rule: "non-negative", required: true },
  },
  editable: ["price", "quantity"],
  matchOnInsert: ["color", "size", "price"],
  lookupBy: ["color", "size"],
  orders: { enabled: true, lookupItemBy: ["color", "size"] },
});

function fakeInventory(row, err) {
  return {
    findByAttributes: vi.fn(async () => {
      if (err) throw err;
      return row;
    }),
  };
}

let schema;
let packaging;
let pricing;
beforeEach(() => {
  schema = new Schema(duckRaw, enums);
  packaging = new PackagingService();
  pricing = new PricingService();
});

describe("OrderService.process — happy path", () => {
  it("returns package + total + details for a valid order", async () => {
    const svc = new OrderService(
      fakeInventory({ id: 1, color: "Red", size: "Large", price: 10, quantity: 100, deleted: false }),
      packaging,
      pricing,
      schema,
    );
    const out = await svc.process({
      color: "Red", size: "Large", quantity: 5,
      country: "USA", shippingMode: "air",
    });
    expect(out.packageType).toBe("wood");
    expect(out.protections).toEqual(["polystyrene"]);
    expect(out.total).toBeGreaterThan(211.94);
    expect(out.total).toBeLessThan(211.96);
    expect(out.details.length).toBe(4);
  });
});

describe("OrderService.process — validation", () => {
  it.each([
    [{ quantity: 0 },     "quantity"],
    [{ quantity: -1 },    "quantity"],
    [{ country: "" },     "country"],
    [{ country: "   " },  "country"],
    [{ shippingMode: "rocket" }, "shippingMode"],
  ])("rejects bad %j", async (overrides, field) => {
    const svc = new OrderService(
      fakeInventory({ id: 1, color: "Red", size: "Large", price: 10, quantity: 100 }),
      packaging,
      pricing,
      schema,
    );
    const req = { color: "Red", size: "Large", quantity: 5, country: "USA", shippingMode: "air", ...overrides };
    const err = await svc.process(req).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.errors[field]).toBeDefined();
  });

  it("trims country before pricing (USA not default 15%)", async () => {
    const svc = new OrderService(
      fakeInventory({ id: 1, color: "Red", size: "Large", price: 10, quantity: 100 }),
      packaging,
      pricing,
      schema,
    );
    // With country="  USA  " — if trim happens, USA tax (+18%) applies →
    // matches the canonical 211.95. Without trim, default 15% → different total.
    const out = await svc.process({
      color: "Red", size: "Large", quantity: 5,
      country: "  USA  ", shippingMode: "air",
    });
    expect(out.total).toBeGreaterThan(211.94);
    expect(out.total).toBeLessThan(211.96);
  });
});

describe("OrderService.process — inventory errors propagate", () => {
  it("propagates NotFoundError when the item doesn't exist", async () => {
    const svc = new OrderService(
      fakeInventory(null, new NotFoundError("No duck found for color=Red, size=Large")),
      packaging,
      pricing,
      schema,
    );
    await expect(svc.process({
      color: "Red", size: "Large", quantity: 5,
      country: "USA", shippingMode: "air",
    })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("propagates ValidationError when inventory rejects bad enum values", async () => {
    const svc = new OrderService(
      fakeInventory(null, new ValidationError({ color: "must be one of: Red, Green" })),
      packaging,
      pricing,
      schema,
    );
    const err = await svc.process({
      color: "Purple", size: "Large", quantity: 5,
      country: "USA", shippingMode: "air",
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.errors.color).toBeDefined();
  });
});
