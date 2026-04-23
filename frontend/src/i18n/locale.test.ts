import { describe, it, expect, vi, afterEach } from "vitest";
import { translate, translations } from "./locale";

describe("i18n dictionaries", () => {
  it("should have identical key sets in English and Spanish", () => {
    const en = Object.keys(translations.en).sort();
    const es = Object.keys(translations.es).sort();
    expect(es).toEqual(en);
  });
});

describe("translate()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the English value for a known key", () => {
    expect(translate("en", "col.price")).toBe("Price");
  });

  it("returns the Spanish value for a known key", () => {
    expect(translate("es", "col.price")).toBe("Precio");
  });

  it("interpolates {var} placeholders", () => {
    expect(translate("en", "table.pageOf", { current: 2, total: 5 })).toBe(
      "Page 2 of 5",
    );
  });

  it("returns the key as a visible fallback when missing (still renders something)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(translate("en", "nonexistent.key")).toBe("nonexistent.key");
  });

  it("warns in dev when a key is missing from the active locale", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    translate("en", "missing.key.for.warn.test");
    expect(warn).toHaveBeenCalled();
    // Message should name both the key and the locale so the source of the
    // warning is obvious.
    const firstCallArg = String(warn.mock.calls[0]?.[0] ?? "");
    expect(firstCallArg).toContain("missing.key.for.warn.test");
    expect(firstCallArg).toContain("en");
  });

  it("does not warn when the key exists", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    translate("en", "col.price");
    expect(warn).not.toHaveBeenCalled();
  });
});
