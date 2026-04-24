import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoClient } from "mongodb";
import { createInventoryRepo, createInventoryIndex } from "./repo.js";
import { Schema } from "../schemas/Schema.js";
import { createCounters } from "../db/mongo.js";

const enums = { colors: ["Red", "Green", "Yellow", "Black"], sizes: ["Large", "Small"] };

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
  mergeField: "quantity",
  lookupBy: ["color", "size"],
  defaultSort: { field: "quantity", direction: "asc" },
});

const validDuck = Object.freeze({ color: "Red", size: "Large", price: 10, quantity: 5 });

let client;
let db;
let repo;
let schema;

beforeAll(async () => {
  const uri = process.env.MONGO_URL || "mongodb://localhost:27017";
  client = await MongoClient.connect(uri);
  db = client.db("duckstore_test_inventory");
  schema = new Schema(duckRaw, enums);
});

afterAll(async () => {
  await db.dropDatabase();
  await client.close();
});

beforeEach(async () => {
  await db.collection("ducks").deleteMany({});
  await db.collection("counters").deleteMany({});
  repo = createInventoryRepo(db, schema, createCounters(db));
});

describe("insert + findById + findMatch", () => {
  it("assigns auto-incrementing ids keyed by schema.name", async () => {
    const a = await repo.insert(validDuck);
    const b = await repo.insert(validDuck);
    const c = await repo.insert(validDuck);
    expect([a.id, b.id, c.id]).toEqual([1, 2, 3]);
  });

  it("findById returns active duck and omits deleted", async () => {
    const { id } = await repo.insert(validDuck);
    const found = await repo.findById(id);
    expect(found.id).toBe(id);
    await repo.softDelete(id);
    expect(await repo.findById(id)).toBeNull();
  });

  it("findMatch uses schema.matchOnInsert keys", async () => {
    await repo.insert(validDuck);
    expect(await repo.findMatch({ color: "Red", size: "Large", price: 10 })).toMatchObject(validDuck);
    expect(await repo.findMatch({ color: "Red", size: "Large", price: 99 })).toBeNull();
    expect(await repo.findMatch({ color: "Green", size: "Large", price: 10 })).toBeNull();
  });
});

describe("findByAttributes", () => {
  it("returns the first active row matching the given attributes", async () => {
    const { id } = await repo.insert(validDuck);
    const found = await repo.findByAttributes({ color: "Red", size: "Large" });
    expect(found.id).toBe(id);
  });

  it("excludes deleted rows", async () => {
    const { id } = await repo.insert(validDuck);
    await repo.softDelete(id);
    expect(await repo.findByAttributes({ color: "Red", size: "Large" })).toBeNull();
  });
});

describe("update / incrementMergeField / softDelete (deleted:false filter)", () => {
  it("update applies fields and leaves other fields alone", async () => {
    const { id } = await repo.insert(validDuck);
    const updated = await repo.update(id, { price: 15 });
    expect(updated.price).toBe(15);
    expect(updated.quantity).toBe(5);
  });

  it("update returns null for deleted row", async () => {
    const { id } = await repo.insert(validDuck);
    await repo.softDelete(id);
    expect(await repo.update(id, { price: 99 })).toBeNull();
  });

  it("incrementMergeField uses schema.mergeField (quantity)", async () => {
    const { id } = await repo.insert({ ...validDuck, quantity: 5 });
    const after = await repo.incrementMergeField(id, 3);
    expect(after.quantity).toBe(8);
  });

  it("incrementMergeField returns null for deleted row", async () => {
    const { id } = await repo.insert(validDuck);
    await repo.softDelete(id);
    expect(await repo.incrementMergeField(id, 1)).toBeNull();
  });

  it("softDelete returns null for already-deleted row", async () => {
    const { id } = await repo.insert(validDuck);
    await repo.softDelete(id);
    expect(await repo.softDelete(id)).toBeNull();
  });
});

describe("listActive sorts by schema.defaultSort", () => {
  it("returns active rows sorted by quantity ascending (per duck schema)", async () => {
    await repo.insert({ ...validDuck, color: "Red",    quantity: 20 });
    await repo.insert({ ...validDuck, color: "Green",  quantity: 5 });
    await repo.insert({ ...validDuck, color: "Yellow", quantity: 10 });
    const rows = await repo.listActive();
    expect(rows.map((r) => r.quantity)).toEqual([5, 10, 20]);
  });

  it("excludes deleted rows from list", async () => {
    const a = await repo.insert({ ...validDuck, color: "Red" });
    await repo.insert({ ...validDuck, color: "Green", deleted: false });
    await repo.softDelete(a.id);
    const rows = await repo.listActive();
    expect(rows).toHaveLength(1);
    expect(rows[0].color).toBe("Green");
  });
});

describe("createInventoryIndex", () => {
  it("creates a compound index from schema.matchOnInsert + deleted", async () => {
    await db.collection("ducks").drop().catch(() => {});
    await createInventoryIndex(db, schema);
    const indexes = await db.collection("ducks").indexes();
    const match = indexes.find(
      (ix) =>
        ix.key.color === 1 &&
        ix.key.size === 1 &&
        ix.key.price === 1 &&
        ix.key.deleted === 1,
    );
    expect(match).toBeDefined();
  });
});
