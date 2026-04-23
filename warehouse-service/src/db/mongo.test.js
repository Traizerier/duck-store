import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoClient } from "mongodb";
import { connectDb, createDucksIndex, createCounters } from "./mongo.js";

let client;
let db;

beforeAll(async () => {
  const uri = process.env.MONGO_URL || "mongodb://localhost:27017";
  client = await MongoClient.connect(uri);
  db = client.db("duckstore_test_db");
});

afterAll(async () => {
  await db.dropDatabase();
  await client.close();
});

beforeEach(async () => {
  await db.collection("counters").deleteMany({});
});

describe("connectDb", () => {
  it("returns a usable client and db", async () => {
    const uri = process.env.MONGO_URL || "mongodb://localhost:27017";
    const { client: c, db: d } = await connectDb(uri, "duckstore_test_db_connect");
    // Writing to the returned db should succeed.
    await d.collection("smoke").insertOne({ ok: 1 });
    const found = await d.collection("smoke").findOne({ ok: 1 });
    expect(found.ok).toBe(1);
    await d.dropDatabase();
    await c.close();
  });
});

describe("createCounters", () => {
  it("assigns 1 on the first call for a new counter", async () => {
    const counters = createCounters(db);
    const id = await counters.nextId("ducks");
    expect(id).toBe(1);
  });

  it("increments monotonically across calls on the same counter", async () => {
    const counters = createCounters(db);
    const a = await counters.nextId("ducks");
    const b = await counters.nextId("ducks");
    const c = await counters.nextId("ducks");
    expect([a, b, c]).toEqual([1, 2, 3]);
  });

  it("maintains independent sequences per counter name", async () => {
    const counters = createCounters(db);
    await counters.nextId("ducks");
    await counters.nextId("ducks");
    const otherFirst = await counters.nextId("other");
    const ducksThird = await counters.nextId("ducks");
    expect(otherFirst).toBe(1);
    expect(ducksThird).toBe(3);
  });
});

describe("createDucksIndex", () => {
  it("creates the compound index supporting findMatch queries", async () => {
    await db.collection("ducks").drop().catch(() => {});
    await createDucksIndex(db);
    const indexes = await db
      .collection("ducks")
      .indexes()
      .catch(() => []);
    const match = indexes.find(
      (ix) =>
        ix.key.color === 1 &&
        ix.key.size === 1 &&
        ix.key.price === 1 &&
        ix.key.deleted === 1,
    );
    expect(match).toBeDefined();
  });

  it("is idempotent (second call does not throw)", async () => {
    await createDucksIndex(db);
    await expect(createDucksIndex(db)).resolves.not.toThrow();
  });
});
