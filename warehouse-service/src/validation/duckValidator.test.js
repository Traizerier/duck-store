import { describe, it, expect } from "vitest";
import { validateDuckInput } from "./duckValidator.js";

const validInput = Object.freeze({
  color: "Red",
  size: "Large",
  price: 9.99,
  quantity: 5,
});

describe("validateDuckInput", () => {
  describe("happy path", () => {
    it("should return valid for fully correct input", () => {
      const result = validateDuckInput(validInput);
      expect(result.valid).toBe(true);
    });

    it("should accept every spec-listed color", () => {
      for (const color of ["Red", "Green", "Yellow", "Black"]) {
        const result = validateDuckInput({ ...validInput, color });
        expect(result.valid, `color=${color}`).toBe(true);
      }
    });

    it("should accept every spec-listed size", () => {
      for (const size of ["XLarge", "Large", "Medium", "Small", "XSmall"]) {
        const result = validateDuckInput({ ...validInput, size });
        expect(result.valid, `size=${size}`).toBe(true);
      }
    });

    it("should accept quantity of zero (SKU with no stock)", () => {
      const result = validateDuckInput({ ...validInput, quantity: 0 });
      expect(result.valid).toBe(true);
    });
  });

  describe("color validation", () => {
    it("should reject an unknown color", () => {
      const result = validateDuckInput({ ...validInput, color: "Blue" });
      expect(result.valid).toBe(false);
      expect(result.errors.color).toBeDefined();
    });

    it("should reject a lowercase color (case-sensitive)", () => {
      const result = validateDuckInput({ ...validInput, color: "red" });
      expect(result.valid).toBe(false);
      expect(result.errors.color).toBeDefined();
    });

    it("should reject a missing color", () => {
      const result = validateDuckInput({ ...validInput, color: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors.color).toBeDefined();
    });
  });

  describe("size validation", () => {
    it("should reject an unknown size", () => {
      const result = validateDuckInput({ ...validInput, size: "Huge" });
      expect(result.valid).toBe(false);
      expect(result.errors.size).toBeDefined();
    });

    it("should reject a missing size", () => {
      const result = validateDuckInput({ ...validInput, size: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors.size).toBeDefined();
    });
  });

  describe("price validation", () => {
    it("should reject a negative price", () => {
      const result = validateDuckInput({ ...validInput, price: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors.price).toBeDefined();
    });

    it("should reject a zero price", () => {
      const result = validateDuckInput({ ...validInput, price: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors.price).toBeDefined();
    });

    it("should reject a non-numeric price", () => {
      const result = validateDuckInput({ ...validInput, price: "nine" });
      expect(result.valid).toBe(false);
      expect(result.errors.price).toBeDefined();
    });

    it("should reject a missing price", () => {
      const result = validateDuckInput({ ...validInput, price: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors.price).toBeDefined();
    });
  });

  describe("quantity validation", () => {
    it("should reject a negative quantity", () => {
      const result = validateDuckInput({ ...validInput, quantity: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors.quantity).toBeDefined();
    });

    it("should reject a non-integer quantity", () => {
      const result = validateDuckInput({ ...validInput, quantity: 1.5 });
      expect(result.valid).toBe(false);
      expect(result.errors.quantity).toBeDefined();
    });

    it("should reject a missing quantity", () => {
      const result = validateDuckInput({ ...validInput, quantity: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors.quantity).toBeDefined();
    });
  });

  describe("multiple errors", () => {
    it("should report every invalid field in one call", () => {
      const result = validateDuckInput({
        color: "Purple",
        size: "Massive",
        price: -1,
        quantity: -1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.color).toBeDefined();
      expect(result.errors.size).toBeDefined();
      expect(result.errors.price).toBeDefined();
      expect(result.errors.quantity).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should reject NaN price", () => {
      const result = validateDuckInput({ ...validInput, price: NaN });
      expect(result.valid).toBe(false);
      expect(result.errors.price).toBeDefined();
    });

    it("should reject positive Infinity price", () => {
      const result = validateDuckInput({ ...validInput, price: Infinity });
      expect(result.valid).toBe(false);
      expect(result.errors.price).toBeDefined();
    });

    it("should reject a null input by returning all field errors", () => {
      const result = validateDuckInput(null);
      expect(result.valid).toBe(false);
      expect(result.errors.color).toBeDefined();
      expect(result.errors.size).toBeDefined();
      expect(result.errors.price).toBeDefined();
      expect(result.errors.quantity).toBeDefined();
    });

    it("should reject an undefined input by returning all field errors", () => {
      const result = validateDuckInput(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors.color).toBeDefined();
      expect(result.errors.size).toBeDefined();
      expect(result.errors.price).toBeDefined();
      expect(result.errors.quantity).toBeDefined();
    });
  });
});
