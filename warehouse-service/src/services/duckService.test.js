import { describe, it, expect, beforeEach, vi } from "vitest";
import { createDuckService } from "./duckService.js";
import { ValidationError, NotFoundError } from "../errors.js";

function createFakeRepo() {
  const ducks = [];
  let nextId = 1;
  return {
    findMatch: vi.fn(async ({ color, size, price }) =>
      ducks.find(
        (d) => d.color === color && d.size === size && d.price === price && !d.deleted,
      ) ?? null
    ),
    findById: vi.fn(async (id) =>
      ducks.find((d) => d.id === id && !d.deleted) ?? null
    ),
    insert: vi.fn(async (duck) => {
      const saved = { ...duck, id: nextId++ };
      ducks.push(saved);
      return saved;
    }),
    update: vi.fn(async (id, fields) => {
      const duck = ducks.find((d) => d.id === id);
      if (!duck) return null;
      Object.assign(duck, fields);
      return { ...duck };
    }),
    incrementQuantity: vi.fn(async (id, delta) => {
      const duck = ducks.find((d) => d.id === id);
      duck.quantity += delta;
      return { ...duck };
    }),
    softDelete: vi.fn(async (id) => {
      const duck = ducks.find((d) => d.id === id);
      if (!duck) return null;
      duck.deleted = true;
      return { ...duck };
    }),
    listActive: vi.fn(async () =>
      ducks.filter((d) => !d.deleted).sort((a, b) => a.quantity - b.quantity)
    ),
    findActiveByColorAndSize: vi.fn(async ({ color, size }) =>
      ducks.find((d) => d.color === color && d.size === size && !d.deleted) ?? null
    ),
    seed(duck) {
      ducks.push(duck);
    },
  };
}

const validInput = Object.freeze({
  color: "Red",
  size: "Large",
  price: 10,
  quantity: 5,
});

describe("DuckService.create", () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = createFakeRepo();
    service = createDuckService(repo);
  });

  describe("with no existing match", () => {
    it("should insert a new duck and not increment", async () => {
      const duck = await service.create(validInput);
      expect(repo.insert).toHaveBeenCalledOnce();
      expect(repo.incrementQuantity).not.toHaveBeenCalled();
      expect(duck).toMatchObject({
        color: "Red",
        size: "Large",
        price: 10,
        quantity: 5,
        deleted: false,
      });
      expect(duck.id).toBeDefined();
    });
  });

  describe("with an existing active match", () => {
    beforeEach(() => {
      repo.seed({
        id: 42,
        color: "Red",
        size: "Large",
        price: 10,
        quantity: 10,
        deleted: false,
      });
    });

    it("should increment the existing duck and not insert", async () => {
      const duck = await service.create({ ...validInput, quantity: 5 });
      expect(repo.incrementQuantity).toHaveBeenCalledWith(42, 5);
      expect(repo.insert).not.toHaveBeenCalled();
      expect(duck.quantity).toBe(15);
    });
  });

  describe("when price, color, or size differ from existing", () => {
    beforeEach(() => {
      repo.seed({
        id: 42,
        color: "Red",
        size: "Large",
        price: 10,
        quantity: 10,
        deleted: false,
      });
    });

    it("should insert new when price differs", async () => {
      await service.create({ ...validInput, price: 12 });
      expect(repo.insert).toHaveBeenCalledOnce();
      expect(repo.incrementQuantity).not.toHaveBeenCalled();
    });

    it("should insert new when color differs", async () => {
      await service.create({ ...validInput, color: "Green" });
      expect(repo.insert).toHaveBeenCalledOnce();
      expect(repo.incrementQuantity).not.toHaveBeenCalled();
    });

    it("should insert new when size differs", async () => {
      await service.create({ ...validInput, size: "Medium" });
      expect(repo.insert).toHaveBeenCalledOnce();
      expect(repo.incrementQuantity).not.toHaveBeenCalled();
    });
  });

  describe("when the only match is logically deleted", () => {
    it("should insert new rather than resurrect the deleted duck", async () => {
      repo.seed({
        id: 42,
        color: "Red",
        size: "Large",
        price: 10,
        quantity: 10,
        deleted: true,
      });
      await service.create(validInput);
      expect(repo.insert).toHaveBeenCalledOnce();
      expect(repo.incrementQuantity).not.toHaveBeenCalled();
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError without touching the repo", async () => {
      await expect(
        service.create({ ...validInput, color: "Blue" }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(repo.findMatch).not.toHaveBeenCalled();
      expect(repo.insert).not.toHaveBeenCalled();
      expect(repo.incrementQuantity).not.toHaveBeenCalled();
    });

    it("should expose validation errors on the thrown error", async () => {
      const err = await service
        .create({ ...validInput, color: "Blue", size: "Huge" })
        .catch((e) => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.errors.color).toBeDefined();
      expect(err.errors.size).toBeDefined();
    });
  });
});

describe("DuckService.update", () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = createFakeRepo();
    service = createDuckService(repo);
    repo.seed({
      id: 42,
      color: "Red",
      size: "Large",
      price: 10,
      quantity: 10,
      deleted: false,
    });
  });

  describe("with valid editable fields", () => {
    it("should update both price and quantity", async () => {
      const duck = await service.update(42, { price: 15, quantity: 20 });
      expect(duck.price).toBe(15);
      expect(duck.quantity).toBe(20);
    });

    it("should allow partial update of just price", async () => {
      const duck = await service.update(42, { price: 15 });
      expect(duck.price).toBe(15);
      expect(duck.quantity).toBe(10);
    });

    it("should allow partial update of just quantity", async () => {
      const duck = await service.update(42, { quantity: 20 });
      expect(duck.price).toBe(10);
      expect(duck.quantity).toBe(20);
    });
  });

  describe("with read-only fields in the payload", () => {
    it("should silently ignore color while still applying price", async () => {
      const duck = await service.update(42, { color: "Green", price: 15 });
      expect(duck.color).toBe("Red");
      expect(duck.price).toBe(15);
    });

    it("should silently ignore size while still applying quantity", async () => {
      const duck = await service.update(42, { size: "Medium", quantity: 20 });
      expect(duck.size).toBe("Large");
      expect(duck.quantity).toBe(20);
    });

    it("should be a no-op when only read-only fields are provided", async () => {
      const duck = await service.update(42, { color: "Green", size: "Medium" });
      expect(duck).toMatchObject({
        id: 42,
        color: "Red",
        size: "Large",
        price: 10,
        quantity: 10,
      });
    });
  });

  describe("with invalid editable values", () => {
    it("should throw ValidationError for non-positive price", async () => {
      await expect(service.update(42, { price: 0 })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it("should throw ValidationError for non-integer quantity", async () => {
      await expect(service.update(42, { quantity: 1.5 })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });
  });

  describe("when target duck is missing", () => {
    it("should throw NotFoundError for unknown id", async () => {
      await expect(service.update(999, { price: 15 })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("should throw NotFoundError when duck is logically deleted", async () => {
      repo.seed({
        id: 7,
        color: "Green",
        size: "Small",
        price: 5,
        quantity: 3,
        deleted: true,
      });
      await expect(service.update(7, { price: 15 })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});

describe("DuckService.delete", () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = createFakeRepo();
    service = createDuckService(repo);
  });

  it("should logically delete an existing duck", async () => {
    repo.seed({
      id: 42,
      color: "Red",
      size: "Large",
      price: 10,
      quantity: 10,
      deleted: false,
    });
    await service.delete(42);
    expect(repo.softDelete).toHaveBeenCalledWith(42);
  });

  it("should throw NotFoundError for unknown id", async () => {
    await expect(service.delete(999)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("should throw NotFoundError when duck is already deleted", async () => {
    repo.seed({
      id: 42,
      color: "Red",
      size: "Large",
      price: 10,
      quantity: 10,
      deleted: true,
    });
    await expect(service.delete(42)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("DuckService.findByColorAndSize", () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = createFakeRepo();
    service = createDuckService(repo);
  });

  it("should return the active duck matching color and size", async () => {
    repo.seed({ id: 42, color: "Red", size: "Large", price: 10, quantity: 5, deleted: false });
    const duck = await service.findByColorAndSize({ color: "Red", size: "Large" });
    expect(duck.id).toBe(42);
    expect(duck.price).toBe(10);
  });

  it("should throw NotFoundError when no match", async () => {
    await expect(
      service.findByColorAndSize({ color: "Red", size: "Large" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("DuckService.list", () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = createFakeRepo();
    service = createDuckService(repo);
  });

  it("should return only non-deleted ducks", async () => {
    repo.seed({ id: 1, color: "Red", size: "Large", price: 10, quantity: 5, deleted: false });
    repo.seed({ id: 2, color: "Green", size: "Small", price: 8, quantity: 3, deleted: true });
    const ducks = await service.list();
    expect(ducks.map((d) => d.id)).toEqual([1]);
  });

  it("should return active ducks sorted by quantity ascending", async () => {
    repo.seed({ id: 1, color: "Red", size: "Large", price: 10, quantity: 20, deleted: false });
    repo.seed({ id: 2, color: "Green", size: "Small", price: 8, quantity: 5, deleted: false });
    repo.seed({ id: 3, color: "Yellow", size: "Medium", price: 9, quantity: 10, deleted: false });
    const ducks = await service.list();
    expect(ducks.map((d) => d.quantity)).toEqual([5, 10, 20]);
  });
});
