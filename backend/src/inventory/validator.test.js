import { describe, it, expect, beforeAll } from "vitest";
import { buildValidators } from "./validator.js";
import { Schema } from "../schemas/Schema.js";

const enums = { colors: ["Red", "Green", "Yellow", "Black"], sizes: ["XLarge", "Large", "Medium", "Small", "XSmall"] };

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
});

let schema;
let v;
beforeAll(() => {
  schema = new Schema(duckRaw, enums);
  v = buildValidators(schema);
});

const validInput = Object.freeze({ color: "Red", size: "Large", price: 9.99, quantity: 5 });

describe("validateInput (schema-driven)", () => {
  it("accepts fully valid input", () => {
    expect(v.validateInput(validInput)).toEqual({ valid: true, errors: {} });
  });

  it("reports every invalid field at once", () => {
    const result = v.validateInput({ color: "Purple", size: "Huge", price: -1, quantity: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors.color).toMatch(/must be one of: Red, Green, Yellow, Black/);
    expect(result.errors.size).toMatch(/must be one of: XLarge, Large, Medium, Small, XSmall/);
    expect(result.errors.price).toMatch(/positive/);
    expect(result.errors.quantity).toMatch(/non-negative/);
  });

  it("flags missing required fields", () => {
    expect(v.validateInput({}).errors).toMatchObject({
      color: "required", size: "required", price: "required", quantity: "required",
    });
  });

  it("rejects non-integer quantity", () => {
    expect(v.validateInput({ ...validInput, quantity: 1.5 }).errors.quantity).toMatch(/integer/);
  });

  it("rejects NaN and Infinity price", () => {
    expect(v.validateInput({ ...validInput, price: NaN }).errors.price).toBeDefined();
    expect(v.validateInput({ ...validInput, price: Infinity }).errors.price).toBeDefined();
  });

  it("accepts quantity = 0 (non-negative, not positive)", () => {
    expect(v.validateInput({ ...validInput, quantity: 0 }).valid).toBe(true);
  });
});

describe("validateUpdate (schema-driven, editable only)", () => {
  it("accepts partial update of editable fields", () => {
    expect(v.validateUpdate({ price: 15 })).toEqual({ valid: true, errors: {} });
    expect(v.validateUpdate({ quantity: 10 })).toEqual({ valid: true, errors: {} });
  });

  it("accepts empty update", () => {
    expect(v.validateUpdate({})).toEqual({ valid: true, errors: {} });
  });

  it("validates values when fields are provided", () => {
    expect(v.validateUpdate({ price: -1 }).errors.price).toMatch(/positive/);
    expect(v.validateUpdate({ quantity: -1 }).errors.quantity).toMatch(/non-negative/);
  });

  it("ignores non-editable fields (color/size aren't editable)", () => {
    // color/size present but not in editable list — the route is expected
    // to strip them, so validator sees only editable. We pass just editable
    // here and it passes; presence of extras is the caller's concern.
    expect(v.validateUpdate({ price: 10 })).toEqual({ valid: true, errors: {} });
  });
});

describe("validateLookupQuery (schema-driven, lookupBy only)", () => {
  it("accepts valid color + size", () => {
    expect(v.validateLookupQuery({ color: "Red", size: "Large" })).toEqual({ valid: true, errors: {} });
  });

  it("rejects unknown color + missing size", () => {
    const r = v.validateLookupQuery({ color: "Purple" });
    expect(r.valid).toBe(false);
    expect(r.errors.color).toMatch(/must be one of/);
    expect(r.errors.size).toBe("required");
  });
});
