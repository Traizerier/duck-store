import { describe, it, expect } from "vitest";
import { Schema } from "./Schema.js";

const enums = { colors: ["Red", "Green"], sizes: ["Large", "Small"] };

const validRaw = Object.freeze({
  name: "duck",
  plural: "ducks",
  collection: "ducks",
  fields: {
    color:    { type: "enum",    enumRef: "colors", required: true },
    size:     { type: "enum",    enumRef: "sizes",  required: true },
    price:    { type: "number",  rule: "positive",  required: true },
    quantity: { type: "integer", rule: "non-negative", required: true },
  },
  editable: ["price", "quantity"],
  matchOnInsert: ["color", "size", "price"],
  mergeField: "quantity",
  lookupBy: ["color", "size"],
  defaultSort: { field: "quantity", direction: "asc" },
  softDelete: true,
  orders: { enabled: true, lookupItemBy: ["color", "size"] },
});

describe("Schema", () => {
  it("exposes accessors for every raw field", () => {
    const s = new Schema(validRaw, enums);
    expect(s.name).toBe("duck");
    expect(s.plural).toBe("ducks");
    expect(s.collection).toBe("ducks");
    expect(s.editable).toEqual(["price", "quantity"]);
    expect(s.matchOnInsert).toEqual(["color", "size", "price"]);
    expect(s.mergeField).toBe("quantity");
    expect(s.lookupBy).toEqual(["color", "size"]);
    expect(s.defaultSort).toEqual({ field: "quantity", direction: "asc" });
    expect(s.softDelete).toBe(true);
    expect(s.hasOrders).toBe(true);
    expect(s.ordersConfig).toEqual({ enabled: true, lookupItemBy: ["color", "size"] });
  });

  it("resolves enum references via enumValues", () => {
    const s = new Schema(validRaw, enums);
    expect(s.enumValues("colors")).toEqual(["Red", "Green"]);
    expect(s.enumValues("sizes")).toEqual(["Large", "Small"]);
  });

  it("throws on unknown enum name via enumValues", () => {
    const s = new Schema(validRaw, enums);
    expect(() => s.enumValues("animals")).toThrow(/unknown enum "animals"/);
  });

  it("defaults softDelete to true when absent", () => {
    const { softDelete: _, ...rest } = validRaw;
    const s = new Schema(rest, enums);
    expect(s.softDelete).toBe(true);
  });

  it("defaults hasOrders to false when orders block absent", () => {
    const { orders: _, ...rest } = validRaw;
    const s = new Schema(rest, enums);
    expect(s.hasOrders).toBe(false);
  });

  it("rejects raw missing name/plural/collection/fields/editable/matchOnInsert/lookupBy", () => {
    for (const key of ["name", "plural", "collection", "fields", "editable", "matchOnInsert", "lookupBy"]) {
      const { [key]: _, ...missing } = validRaw;
      expect(() => new Schema(missing, enums)).toThrow(new RegExp(`missing required key "${key}"`));
    }
  });

  it("rejects empty fields object", () => {
    expect(() => new Schema({ ...validRaw, fields: {} }, enums)).toThrow(/fields must be a non-empty object/);
  });

  it("catches enumRef typos at construction", () => {
    const bad = {
      ...validRaw,
      fields: {
        ...validRaw.fields,
        color: { type: "enum", enumRef: "colour", required: true },
      },
    };
    expect(() => new Schema(bad, enums)).toThrow(/unknown enum "colour"/);
  });

  it("catches enum field missing enumRef", () => {
    const bad = {
      ...validRaw,
      fields: { ...validRaw.fields, color: { type: "enum", required: true } },
    };
    expect(() => new Schema(bad, enums)).toThrow(/no enumRef/);
  });
});
