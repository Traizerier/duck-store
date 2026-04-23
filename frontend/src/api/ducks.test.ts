import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/setup";
import { listDucks, createDuck, updateDuck, deleteDuck, ApiError, type DuckUpdate } from "./ducks";

describe("listDucks", () => {
  it("should return the array from the server", async () => {
    server.use(
      http.get("/api/ducks", () =>
        HttpResponse.json([
          { id: 1, color: "Red", size: "Large", price: 10, quantity: 5, deleted: false },
          { id: 2, color: "Green", size: "Small", price: 8, quantity: 20, deleted: false },
        ]),
      ),
    );
    const ducks = await listDucks();
    expect(ducks).toHaveLength(2);
    expect(ducks[0].color).toBe("Red");
    expect(ducks[1].color).toBe("Green");
  });

  it("should throw ApiError on server error", async () => {
    server.use(http.get("/api/ducks", () => new HttpResponse(null, { status: 500 })));
    await expect(listDucks()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("createDuck", () => {
  it("should POST the input and return the created duck", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/ducks", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { id: 42, color: "Red", size: "Large", price: 10, quantity: 5, deleted: false },
          { status: 201 },
        );
      }),
    );
    const duck = await createDuck({ color: "Red", size: "Large", price: 10, quantity: 5 });
    expect(duck.id).toBe(42);
    expect(duck.color).toBe("Red");
    expect(capturedBody).toEqual({ color: "Red", size: "Large", price: 10, quantity: 5 });
  });

  it("should throw ApiError with body on 400 validation error", async () => {
    server.use(
      http.post("/api/ducks", () =>
        HttpResponse.json(
          { error: "ValidationError", errors: { color: "invalid" } },
          { status: 400 },
        ),
      ),
    );
    const err = await createDuck({ color: "Blue", size: "Large", price: 10, quantity: 5 }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).body).toMatchObject({ errors: { color: "invalid" } });
  });
});

describe("updateDuck", () => {
  it("should PATCH specific fields and return the updated duck", async () => {
    let capturedId: string | undefined;
    let capturedBody: unknown;
    server.use(
      http.patch("/api/ducks/:id", async ({ request, params }) => {
        capturedId = String(params.id);
        capturedBody = await request.json();
        return HttpResponse.json({
          id: Number(params.id),
          color: "Red",
          size: "Large",
          price: (capturedBody as DuckUpdate).price ?? 10,
          quantity: (capturedBody as DuckUpdate).quantity ?? 5,
          deleted: false,
        });
      }),
    );
    const duck = await updateDuck(42, { price: 15 });
    expect(duck.price).toBe(15);
    expect(capturedId).toBe("42");
    expect(capturedBody).toEqual({ price: 15 });
  });
});

describe("deleteDuck", () => {
  it("should send DELETE to /api/ducks/:id", async () => {
    let capturedId: string | undefined;
    server.use(
      http.delete("/api/ducks/:id", ({ params }) => {
        capturedId = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await deleteDuck(42);
    expect(capturedId).toBe("42");
  });

  it("should throw ApiError on 404", async () => {
    server.use(http.delete("/api/ducks/:id", () => new HttpResponse(null, { status: 404 })));
    await expect(deleteDuck(999)).rejects.toBeInstanceOf(ApiError);
  });
});
