import { describe, it, expect, beforeEach, vi } from "vitest";
import { InventoryService } from "./service.js";
import { Schema } from "../schemas/Schema.js";
import { ValidationError, NotFoundError } from "../errors.js";

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
});

const validInput = Object.freeze({ color: "Red", size: "Large", price: 10, quantity: 5 });

function createFakeRepo() {
  const rows = [];
  let nextId = 1;
  // Mutations filter deleted:false — mirror real repo behavior so tests
  // of "row is deleted" actually exercise the NotFoundError path.
  return {
    findMatch: vi.fn(async ({ color, size, price }) =>
      rows.find(
        (r) => r.color === color && r.size === size && r.price === price && !r.deleted,
      ) ?? null,
    ),
    findById: vi.fn(async (id) => rows.find((r) => r.id === id && !r.deleted) ?? null),
    findByAttributes: vi.fn(async (attrs) =>
      rows.find((r) => !r.deleted && Object.entries(attrs).every(([k, v]) => r[k] === v)) ?? null,
    ),
    insert: vi.fn(async (data) => {
      const saved = { id: nextId++, ...data, deleted: false };
      rows.push(saved);
      return saved;
    }),
    update: vi.fn(async (id, fields) => {
      const row = rows.find((r) => r.id === id && !r.deleted);
      if (!row) return null;
      Object.assign(row, fields);
      return { ...row };
    }),
    incrementMergeField: vi.fn(async (id, delta) => {
      const row = rows.find((r) => r.id === id && !r.deleted);
      if (!row) return null;
      row.quantity += delta;
      return { ...row };
    }),
    softDelete: vi.fn(async (id) => {
      const row = rows.find((r) => r.id === id && !r.deleted);
      if (!row) return null;
      row.deleted = true;
      return { ...row };
    }),
    listActive: vi.fn(async () =>
      rows.filter((r) => !r.deleted).sort((a, b) => a.quantity - b.quantity),
    ),
    seed(row) { rows.push(row); },
  };
}

let schema;
let repo;
let service;
beforeEach(() => {
  schema = new Schema(duckRaw, enums);
  repo = createFakeRepo();
  service = new InventoryService(schema, repo);
});

describe("InventoryService.create", () => {
  it("inserts a fresh row when no match exists", async () => {
    const row = await service.create(validInput);
    expect(row).toMatchObject({ ...validInput, deleted: false });
    expect(repo.insert).toHaveBeenCalledOnce();
    expect(repo.incrementMergeField).not.toHaveBeenCalled();
  });

  it("increments the merge field when a match exists", async () => {
    await service.create(validInput);
    const merged = await service.create({ ...validInput, quantity: 3 });
    expect(merged.quantity).toBe(8);
    expect(repo.incrementMergeField).toHaveBeenCalledOnce();
  });

  it("throws ValidationError on bad input", async () => {
    await expect(service.create({ ...validInput, color: "Purple" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("InventoryService.update", () => {
  it("applies editable fields and drops non-editable", async () => {
    const { id } = await service.create(validInput);
    const updated = await service.update(id, { price: 15, color: "Green" });
    expect(updated.price).toBe(15);
    expect(updated.color).toBe("Red"); // color not in editable
  });

  it("throws ValidationError on bad update value", async () => {
    const { id } = await service.create(validInput);
    await expect(service.update(id, { price: -1 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError when id doesn't match", async () => {
    await expect(service.update(999, { price: 15 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when repo.update returns null (deleted)", async () => {
    const { id } = await service.create(validInput);
    await service.delete(id);
    await expect(service.update(id, { price: 15 })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("InventoryService.delete", () => {
  it("soft-deletes an active row", async () => {
    const { id } = await service.create(validInput);
    const deleted = await service.delete(id);
    expect(deleted.deleted).toBe(true);
  });

  it("throws NotFoundError when id doesn't exist", async () => {
    await expect(service.delete(999)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError for already-deleted row", async () => {
    const { id } = await service.create(validInput);
    await service.delete(id);
    await expect(service.delete(id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("InventoryService.list", () => {
  it("returns active rows in defaultSort order", async () => {
    await service.create({ ...validInput, quantity: 20 });
    await service.create({ ...validInput, color: "Green", quantity: 5 });
    const rows = await service.list();
    expect(rows.map((r) => r.quantity)).toEqual([5, 20]);
  });
});

describe("InventoryService.findByAttributes", () => {
  it("returns the matching row on valid query", async () => {
    await service.create(validInput);
    const found = await service.findByAttributes({ color: "Red", size: "Large" });
    expect(found.color).toBe("Red");
    expect(found.size).toBe("Large");
  });

  it("throws ValidationError on bad query", async () => {
    await expect(
      service.findByAttributes({ color: "Purple", size: "Large" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError when nothing matches", async () => {
    await expect(
      service.findByAttributes({ color: "Red", size: "Large" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
