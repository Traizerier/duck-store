import { describe, it, expect } from "vitest";
import { isValidStackName, assertValidStackName } from "./validateStackName.js";
import { InvalidStackNameError } from "./errors.js";

describe("isValidStackName", () => {
  it.each([
    ["warehouse"],
    ["store"],
    ["frogs"],
    ["a"],
    ["a1"],
    ["multi-word-stack"],
    ["stack-42"],
    ["0"],
  ])("accepts %s", (name) => {
    expect(isValidStackName(name)).toBe(true);
  });

  it.each([
    ["Warehouse", "uppercase"],
    ["", "empty"],
    ["-leading", "leading hyphen"],
    ["a.b", "contains dot"],
    ["a/b", "contains slash"],
    ["a b", "contains space"],
    ["a;b", "shell metachar"],
    ["a$b", "shell metachar"],
    ["a`b", "shell metachar"],
    [null, "null"],
    [undefined, "undefined"],
    [42, "number"],
    ["x".repeat(33), "too long"],
  ])("rejects %s (%s)", (name) => {
    expect(isValidStackName(name)).toBe(false);
  });
});

describe("assertValidStackName", () => {
  it("returns undefined for valid names", () => {
    expect(assertValidStackName("warehouse")).toBeUndefined();
  });

  it("throws InvalidStackNameError with the provided name on reject", () => {
    try {
      assertValidStackName("../../etc/passwd");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidStackNameError);
      expect(err.providedName).toBe("../../etc/passwd");
    }
  });
});
