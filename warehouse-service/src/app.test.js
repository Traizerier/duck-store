import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import supertest from "supertest";
import { MongoClient } from "mongodb";
import { createDuckRepo } from "./repos/duckRepo.js";
import { createDuckService } from "./services/duckService.js";
import { createApp } from "./app.js";

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
  const repo = createDuckRepo(db);
  const service = createDuckService(repo);
  const app = createApp(service);
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
  it("should return 200 with ok:true", async () => {
    const res = await request.get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
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
});
