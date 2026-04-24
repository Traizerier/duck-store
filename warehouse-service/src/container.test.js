import { describe, it, expect } from "vitest";
import { ServiceContainer } from "./container.js";

describe("ServiceContainer", () => {
  it("registers and retrieves a service by name", () => {
    const c = new ServiceContainer();
    const svc = { id: "duck-service" };
    c.register("duck", svc);
    expect(c.get("duck")).toBe(svc);
  });

  it("throws when retrieving an unregistered name", () => {
    const c = new ServiceContainer();
    expect(() => c.get("order")).toThrowError(/not registered/);
  });

  it("throws when registering the same name twice", () => {
    const c = new ServiceContainer();
    c.register("duck", {});
    expect(() => c.register("duck", {})).toThrowError(/already registered/);
  });

  it("rejects empty or non-string names", () => {
    const c = new ServiceContainer();
    expect(() => c.register("", {})).toThrow();
    expect(() => c.register(null, {})).toThrow();
  });
});
