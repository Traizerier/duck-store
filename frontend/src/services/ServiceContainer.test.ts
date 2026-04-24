import { describe, it, expect } from "vitest";
import { ServiceContainer } from "./ServiceContainer";
import { DuckService } from "./DuckService";

describe("ServiceContainer", () => {
  it("registers and retrieves a service by name", () => {
    const c = new ServiceContainer();
    const svc = new DuckService("/api/test/ducks");
    c.register("duck", svc);
    expect(c.get("duck")).toBe(svc);
  });

  it("throws when retrieving an unregistered name", () => {
    const c = new ServiceContainer();
    expect(() => c.get("duck")).toThrowError(/not registered/);
  });

  it("throws when registering the same name twice", () => {
    const c = new ServiceContainer();
    c.register("duck", new DuckService("/api/ducks"));
    expect(() => c.register("duck", new DuckService("/api/ducks"))).toThrowError(/already registered/);
  });
});
