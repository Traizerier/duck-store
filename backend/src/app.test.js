import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import supertest from "supertest";
import { MongoClient } from "mongodb";
import { Schema } from "./schemas/Schema.js";
import { createInventoryRepo, createInventoryIndex } from "./inventory/repo.js";
import { InventoryService } from "./inventory/service.js";
import { PackagingService } from "./packaging/service.js";
import { PricingService } from "./pricing/service.js";
import { OrderService } from "./order/orderService.js";
import { ServiceContainer } from "./container.js";
import { createApp } from "./app.js";
import { createCounters } from "./db/mongo.js";
import { readFile } from "node:fs/promises";

const validInput = Object.freeze({
  color: "Red",
  size: "Large",
  price: 10,
  quantity: 5,
});

let client;
let db;
let request;

beforeAll(async () => {
  const uri = process.env.MONGO_URL || "mongodb://localhost:27017";
  client = await MongoClient.connect(uri);
  db = client.db("duckstore_test_routes");

  const duckRaw = JSON.parse(await readFile("./src/schemas/duck.json", "utf-8"));
  const enums = JSON.parse(await readFile("../shared/enums.json", "utf-8"));
  const schema = new Schema(duckRaw, enums);
  await createInventoryIndex(db, schema);
  const repo = createInventoryRepo(db, schema, createCounters(db));

  const container = new ServiceContainer();
  const inventory = new InventoryService(schema, repo);
  const packaging = new PackagingService();
  const pricing = new PricingService();
  container.register("inventory", inventory);
  container.register("packaging", packaging);
  container.register("pricing", pricing);
  container.register("order", new OrderService(inventory, packaging, pricing, schema));
  const app = createApp(container, schema);
  request = supertest(app);
});

afterAll(async () => {
  await db.dropDatabase();
  await client.close();
});

beforeEach(async () => {
  await db.collection("ducks").deleteMany({});
  await db.collection("counters").deleteMany({});
});

describe("GET /health", () => {
  it("should return 200 with ok:true and schema type", async () => {
    const res = await request.get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.type).toBe("duck");
  });
});

describe("POST /api/ducks", () => {
  it("should create a new duck and return 201", async () => {
    const res = await request.post("/api/ducks").send(validInput);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...validInput, deleted: false });
    expect(res.body.id).toBeDefined();
  });

  it("should merge quantities when a matching duck already exists", async () => {
    await request.post("/api/ducks").send({ ...validInput, quantity: 10 });
    const res = await request.post("/api/ducks").send({ ...validInput, quantity: 5 });
    expect(res.status).toBe(201);
    expect(res.body.quantity).toBe(15);
  });

  it("should return 400 with error details on invalid input", async () => {
    const res = await request.post("/api/ducks").send({ ...validInput, color: "Blue" });
    expect(res.status).toBe(400);
    expect(res.body.errors.color).toBeDefined();
  });
});

describe("GET /api/ducks", () => {
  it("should return active ducks sorted by quantity ascending", async () => {
    await request.post("/api/ducks").send({ ...validInput, quantity: 20 });
    await request.post("/api/ducks").send({ ...validInput, color: "Green", quantity: 5 });
    const res = await request.get("/api/ducks");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].quantity).toBe(5);
    expect(res.body[1].quantity).toBe(20);
  });

  it("should return an empty array when no ducks exist", async () => {
    const res = await request.get("/api/ducks");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/ducks/lookup", () => {
  it("should return the active duck matching color and size", async () => {
    await request.post("/api/ducks").send(validInput);
    const res = await request.get("/api/ducks/lookup?color=Red&size=Large");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ color: "Red", size: "Large", price: 10 });
  });

  it("should return 404 when no match exists", async () => {
    const res = await request.get("/api/ducks/lookup?color=Red&size=Large");
    expect(res.status).toBe(404);
  });

  // Item 011: boundary validation for /lookup. Missing or out-of-enum color/size
  // must return 400 ValidationError, not 404 — otherwise `color=undefined`
  // leaks into logs and clients can't distinguish "sold out" from "bad input."
  it("should return 400 ValidationError when color and size are missing", async () => {
    const res = await request.get("/api/ducks/lookup");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.errors.color).toBeDefined();
    expect(res.body.errors.size).toBeDefined();
  });

  it("should return 400 ValidationError for an unknown color", async () => {
    const res = await request.get("/api/ducks/lookup?color=Purple&size=Large");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.errors.color).toBeDefined();
  });

  it("should return 400 ValidationError for an unknown size", async () => {
    const res = await request.get("/api/ducks/lookup?color=Red&size=Huge");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.errors.size).toBeDefined();
  });
});

describe("PATCH /api/ducks/:id", () => {
  let existing;

  beforeEach(async () => {
    const res = await request.post("/api/ducks").send(validInput);
    existing = res.body;
  });

  it("should update price and quantity and return the updated duck", async () => {
    const res = await request
      .patch(`/api/ducks/${existing.id}`)
      .send({ price: 15, quantity: 20 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(15);
    expect(res.body.quantity).toBe(20);
  });

  it("should silently ignore readonly fields", async () => {
    const res = await request
      .patch(`/api/ducks/${existing.id}`)
      .send({ color: "Green", price: 15 });
    expect(res.status).toBe(200);
    expect(res.body.color).toBe("Red");
    expect(res.body.price).toBe(15);
  });

  it("should return 400 on invalid values", async () => {
    const res = await request.patch(`/api/ducks/${existing.id}`).send({ price: -1 });
    expect(res.status).toBe(400);
  });

  it("should return 404 for unknown id", async () => {
    const res = await request.patch("/api/ducks/999").send({ price: 15 });
    expect(res.status).toBe(404);
  });

  // Item 010: boundary validation for :id. A non-integer or non-positive id
  // is a malformed request, not a missing row — must be 400, not 404.
  it("should return 400 ValidationError for a non-numeric id", async () => {
    const res = await request.patch("/api/ducks/abc").send({ price: 15 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.errors.id).toBeDefined();
  });

  it("should return 400 ValidationError for a non-integer id", async () => {
    const res = await request.patch("/api/ducks/1.5").send({ price: 15 });
    expect(res.status).toBe(400);
    expect(res.body.errors.id).toBeDefined();
  });

  it("should return 400 ValidationError for a non-positive id", async () => {
    const res = await request.patch("/api/ducks/0").send({ price: 15 });
    expect(res.status).toBe(400);
    expect(res.body.errors.id).toBeDefined();
  });
});

describe("DELETE /api/ducks/:id", () => {
  let existing;

  beforeEach(async () => {
    const res = await request.post("/api/ducks").send(validInput);
    existing = res.body;
  });

  it("should logically delete the duck and return 204", async () => {
    const res = await request.delete(`/api/ducks/${existing.id}`);
    expect(res.status).toBe(204);
  });

  it("should exclude deleted ducks from the list endpoint", async () => {
    await request.delete(`/api/ducks/${existing.id}`);
    const list = await request.get("/api/ducks");
    expect(list.body).toEqual([]);
  });

  it("should return 404 for unknown id", async () => {
    const res = await request.delete("/api/ducks/999");
    expect(res.status).toBe(404);
  });

  it("should return 404 when deleting an already-deleted duck", async () => {
    await request.delete(`/api/ducks/${existing.id}`);
    const res = await request.delete(`/api/ducks/${existing.id}`);
    expect(res.status).toBe(404);
  });

  it("should return 400 ValidationError for a non-numeric id", async () => {
    const res = await request.delete("/api/ducks/not-a-number");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.errors.id).toBeDefined();
  });
});

describe("POST /api/orders", () => {
  // Order flow needs a duck in inventory to price. Seed one per test.
  beforeEach(async () => {
    await request.post("/api/ducks").send({
      color: "Red", size: "Large", price: 10, quantity: 100,
    });
  });

  it("processes a valid order and returns package+total+details", async () => {
    const res = await request.post("/api/orders").send({
      color: "Red", size: "Large", quantity: 5,
      country: "USA", shippingMode: "air",
    });
    expect(res.status).toBe(200);
    expect(res.body.packageType).toBe("wood");
    expect(res.body.protections).toEqual(["polystyrene"]);
    expect(res.body.total).toBeGreaterThan(211.94);
    expect(res.body.total).toBeLessThan(211.96);
  });

  it("returns 404 when no duck matches color+size", async () => {
    const res = await request.post("/api/orders").send({
      color: "Green", size: "Small", quantity: 5,
      country: "USA", shippingMode: "air",
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("NotFoundError");
  });

  it("returns 400 on bad shippingMode", async () => {
    const res = await request.post("/api/orders").send({
      color: "Red", size: "Large", quantity: 5,
      country: "USA", shippingMode: "rocket",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.errors.shippingMode).toBeDefined();
  });

  it("returns 400 on unknown color (via inventory validation)", async () => {
    const res = await request.post("/api/orders").send({
      color: "Purple", size: "Large", quantity: 5,
      country: "USA", shippingMode: "air",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });
});

describe("error middleware — 500 branch", () => {
  // Separate app with a service that throws an unexpected error (not
  // ValidationError / NotFoundError), so we hit the 500 fallback.
  // Stands in a mock inventory service that rejects list() with a
  // message containing internal-looking detail; the response body
  // must not echo it back.
  async function appWithThrowingService() {
    const { createApp } = await import("./app.js");
    const { ServiceContainer } = await import("./container.js");

    const throwing = {
      entityName: "duck",
      list: async () => {
        const err = new Error("ENOENT: /internal/secret/path/config.json");
        err.stack = "Error: ENOENT: /internal/secret/path/config.json\n    at ...";
        throw err;
      },
    };
    const schema = { name: "duck", plural: "ducks", hasOrders: false };
    const container = new ServiceContainer();
    container.register("inventory", throwing);
    return supertest(createApp(container, schema));
  }

  it("returns a generic message without leaking err.message", async () => {
    const { vi } = await import("vitest");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const req = await appWithThrowingService();
    const res = await req.get("/api/ducks");
    errSpy.mockRestore();

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("InternalServerError");
    expect(res.body.message).toBe("internal error");
    // Specifically: the internal path must not appear anywhere in the body.
    expect(JSON.stringify(res.body)).not.toContain("/internal/secret/path");
    expect(JSON.stringify(res.body)).not.toContain("ENOENT");
  });
});
