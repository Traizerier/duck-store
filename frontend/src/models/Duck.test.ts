import { describe, it, expect, vi } from "vitest";
import { Duck } from "./Duck";
import type { DuckService, DuckData, DuckUpdate } from "../services/DuckService";

// Minimal DuckService stand-in with spied methods. No network — just
// structural compatibility so the model's save/update/delete paths light up.
function makeStubService(): DuckService {
  return {
    _patch: vi.fn(async (_id: number, fields: DuckUpdate) => ({
      id: 1,
      color: "Red",
      size: "Large",
      price: fields.price ?? 10,
      quantity: fields.quantity ?? 5,
      deleted: false,
    } satisfies DuckData)),
    _delete: vi.fn(async () => {}),
  } as unknown as DuckService;
}

const data: DuckData = Object.freeze({
  id: 1,
  color: "Red",
  size: "Large",
  price: 10,
  quantity: 5,
  deleted: false,
});

describe("Duck", () => {
  it("copies the data shape onto the instance", () => {
    const duck = new Duck(makeStubService(), data);
    expect(duck.id).toBe(1);
    expect(duck.color).toBe("Red");
    expect(duck.price).toBe(10);
  });

  it("update(fields) mutates in place and persists only the given fields", async () => {
    const svc = makeStubService();
    const duck = new Duck(svc, data);

    await duck.update({ price: 99 });

    expect(svc._patch).toHaveBeenCalledWith(1, { price: 99 });
    expect(duck.price).toBe(99);
    expect(duck.quantity).toBe(5); // unchanged on the server response
  });

  it("delete() flips deleted=true and calls the service", async () => {
    const svc = makeStubService();
    const duck = new Duck(svc, data);

    await duck.delete();

    expect(svc._delete).toHaveBeenCalledWith(1);
    expect(duck.deleted).toBe(true);
  });

  it("rethrows errors from the service (no catch)", async () => {
    const err = new Error("backend down");
    const svc = {
      _patch: vi.fn(async () => { throw err; }),
      _delete: vi.fn(async () => { throw err; }),
    } as unknown as DuckService;
    const duck = new Duck(svc, data);

    await expect(duck.update({ price: 1 })).rejects.toBe(err);
    await expect(duck.delete()).rejects.toBe(err);
  });

  it("toJSON() omits the private service reference", () => {
    const duck = new Duck(makeStubService(), data);
    const json = JSON.parse(JSON.stringify(duck));
    expect(json).toEqual(data);
    expect(Object.keys(json)).not.toContain("service");
  });
});
