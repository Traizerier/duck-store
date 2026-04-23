import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoClient } from "mongodb";
import { createDuckRepo } from "./duckRepo.js";
import { createCounters } from "../db/mongo.js";

const validDuck = Object.freeze({
  color: "Red",
  size: "Large",
  price: 10,
  quantity: 5,
  deleted: false,
});

let client;
let db;

beforeAll(async () => {
  const uri = process.env.MONGO_URL || "mongodb://localhost:27017";
  client = await MongoClient.connect(uri);
  db = client.db("duckstore_test");
});

afterAll(async () => {
  await db.dropDatabase();
  await client.close();
});

let repo;
beforeEach(async () => {
  await db.collection("ducks").deleteMany({});
  await db.collection("counters").deleteMany({});
  repo = createDuckRepo(db, createCounters(db));
});

describe("DuckRepo.insert", () => {
  it("should assign an integer id starting at 1", async () => {
    const duck = await repo.insert(validDuck);
    expect(duck.id).toBe(1);
    expect(duck.color).toBe("Red");
  });

  it("should auto-increment ids across inserts", async () => {
    const a = await repo.insert(validDuck);
    const b = await repo.insert(validDuck);
    const c = await repo.insert(validDuck);
    expect([a.id, b.id, c.id]).toEqual([1, 2, 3]);
  });
});

describe("DuckRepo.findMatch", () => {
  it("should return an active duck matching color/size/price", async () => {
    await repo.insert(validDuck);
    const match = await repo.findMatch({ color: "Red", size: "Large", price: 10 });
    expect(match).not.toBeNull();
    expect(match.color).toBe("Red");
    expect(match.size).toBe("Large");
    expect(match.price).toBe(10);
  });

  it("should return null when no match exists", async () => {
    await repo.insert(validDuck);
    const match = await repo.findMatch({ color: "Green", size: "Large", price: 10 });
    expect(match).toBeNull();
  });

  it("should return null when the only match is logically deleted", async () => {
    await repo.insert({ ...validDuck, deleted: true });
    const match = await repo.findMatch({ color: "Red", size: "Large", price: 10 });
    expect(match).toBeNull();
  });
});

describe("DuckRepo.findById", () => {
  it("should return the active duck with matching id", async () => {
    const { id } = await repo.insert(validDuck);
    const found = await repo.findById(id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(id);
    expect(found.color).toBe("Red");
  });

  it("should return null when id does not exist", async () => {
    const found = await repo.findById(999);
    expect(found).toBeNull();
  });

  it("should return null when duck is logically deleted", async () => {
    const { id } = await repo.insert({ ...validDuck, deleted: true });
    const found = await repo.findById(id);
    expect(found).toBeNull();
  });
});

describe("DuckRepo.findActiveByColorAndSize", () => {
  it("should return the active duck with matching color and size", async () => {
    const inserted = await repo.insert(validDuck);
    const found = await repo.findActiveByColorAndSize({ color: "Red", size: "Large" });
    expect(found).not.toBeNull();
    expect(found.id).toBe(inserted.id);
    expect(found.price).toBe(10);
  });

  it("should return null when no duck matches", async () => {
    const found = await repo.findActiveByColorAndSize({ color: "Green", size: "Large" });
    expect(found).toBeNull();
  });

  it("should exclude deleted ducks", async () => {
    await repo.insert({ ...validDuck, deleted: true });
    const found = await repo.findActiveByColorAndSize({ color: "Red", size: "Large" });
    expect(found).toBeNull();
  });
});

describe("DuckRepo.update", () => {
  it("should apply specified fields and leave others unchanged", async () => {
    const { id } = await repo.insert(validDuck);
    const updated = await repo.update(id, { price: 15 });
    expect(updated.price).toBe(15);
    expect(updated.quantity).toBe(5);
    expect(updated.color).toBe("Red");
  });

  it("should not touch a logically-deleted duck (returns null)", async () => {
    const { id } = await repo.insert({ ...validDuck, deleted: true });
    const result = await repo.update(id, { price: 999 });
    expect(result).toBeNull();
    // Raw Mongo verification — price must still be the original.
    const raw = await db.collection("ducks").findOne({ _id: id });
    expect(raw.price).toBe(10);
  });
});

describe("DuckRepo.incrementQuantity", () => {
  it("should add the delta to the current quantity", async () => {
    const { id } = await repo.insert(validDuck);
    const updated = await repo.incrementQuantity(id, 3);
    expect(updated.quantity).toBe(8);
  });

  it("should not increment a logically-deleted duck (returns null)", async () => {
    const { id } = await repo.insert({ ...validDuck, deleted: true, quantity: 5 });
    const result = await repo.incrementQuantity(id, 100);
    expect(result).toBeNull();
    const raw = await db.collection("ducks").findOne({ _id: id });
    expect(raw.quantity).toBe(5);
  });
});

describe("DuckRepo.softDelete", () => {
  it("should set deleted to true", async () => {
    const { id } = await repo.insert(validDuck);
    const updated = await repo.softDelete(id);
    expect(updated.deleted).toBe(true);
  });

  it("should return null for an already-deleted duck", async () => {
    const { id } = await repo.insert({ ...validDuck, deleted: true });
    const result = await repo.softDelete(id);
    expect(result).toBeNull();
  });
});

describe("DuckRepo.listActive", () => {
  it("should return active ducks sorted by quantity ascending", async () => {
    await repo.insert({ ...validDuck, color: "Red", quantity: 20 });
    await repo.insert({ ...validDuck, color: "Green", quantity: 5 });
    await repo.insert({ ...validDuck, color: "Yellow", quantity: 10 });
    const ducks = await repo.listActive();
    expect(ducks.map((d) => d.quantity)).toEqual([5, 10, 20]);
  });

  it("should exclude deleted ducks", async () => {
    await repo.insert({ ...validDuck, color: "Red", deleted: false });
    await repo.insert({ ...validDuck, color: "Green", deleted: true });
    const ducks = await repo.listActive();
    expect(ducks).toHaveLength(1);
    expect(ducks[0].color).toBe("Red");
  });
});
