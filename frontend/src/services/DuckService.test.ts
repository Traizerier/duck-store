import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/setup";
import { DuckService, type DuckUpdate } from "./DuckService";
import { ApiError } from "./BaseService";
import { Duck } from "../models/Duck";

function newService(): DuckService {
  // A fresh instance per test — the service is stateless, but constructing
  // one here keeps the test arrange block readable.
  return new DuckService();
}

describe("DuckService.list", () => {
  it("returns an array of Duck model instances", async () => {
    server.use(
      http.get("/api/ducks", () =>
        HttpResponse.json([
          { id: 1, color: "Red", size: "Large", price: 10, quantity: 5, deleted: false },
          { id: 2, color: "Green", size: "Small", price: 8, quantity: 20, deleted: false },
        ]),
      ),
    );
    const ducks = await newService().list();
    expect(ducks).toHaveLength(2);
    expect(ducks[0]).toBeInstanceOf(Duck);
    expect(ducks[0].color).toBe("Red");
    expect(ducks[1].color).toBe("Green");
  });

  it("throws ApiError on server error", async () => {
    server.use(http.get("/api/ducks", () => new HttpResponse(null, { status: 500 })));
    await expect(newService().list()).rejects.toBeInstanceOf(ApiError);
  });

  it("preserves non-JSON error bodies in ApiError.body.raw", async () => {
    // Reproduces a misconfigured-proxy HTML error page scenario. The parse
    // fails, but the raw text is the only debug breadcrumb the operator has.
    server.use(
      http.get("/api/ducks", () =>
        new HttpResponse("<html><body>502 Bad Gateway</body></html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );
    const err = await newService().list().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).body).toMatchObject({
      error: "NonJsonResponse",
      raw: expect.stringContaining("502 Bad Gateway"),
    });
  });
});

describe("DuckService.create", () => {
  it("POSTs the input and returns a Duck model instance", async () => {
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
    const duck = await newService().create({
      color: "Red",
      size: "Large",
      price: 10,
      quantity: 5,
    });
    expect(duck).toBeInstanceOf(Duck);
    expect(duck.id).toBe(42);
    expect(duck.color).toBe("Red");
    expect(capturedBody).toEqual({ color: "Red", size: "Large", price: 10, quantity: 5 });
  });

  it("throws ApiError with body on 400 validation error", async () => {
    server.use(
      http.post("/api/ducks", () =>
        HttpResponse.json(
          { error: "ValidationError", errors: { color: "invalid" } },
          { status: 400 },
        ),
      ),
    );
    const err = await newService()
      .create({ color: "Blue", size: "Large", price: 10, quantity: 5 })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).body).toMatchObject({ errors: { color: "invalid" } });
  });
});

describe("DuckService via Duck model", () => {
  it("Duck.update() PATCHes via the service", async () => {
    let capturedId: string | undefined;
    let capturedBody: unknown;
    server.use(
      http.get("/api/ducks", () =>
        HttpResponse.json([
          { id: 42, color: "Red", size: "Large", price: 10, quantity: 5, deleted: false },
        ]),
      ),
      http.patch("/api/ducks/:id", async ({ request, params }) => {
        capturedId = String(params.id);
        capturedBody = await request.json();
        const body = capturedBody as DuckUpdate;
        return HttpResponse.json({
          id: Number(params.id),
          color: "Red",
          size: "Large",
          price: body.price ?? 10,
          quantity: body.quantity ?? 5,
          deleted: false,
        });
      }),
    );
    const [duck] = await newService().list();
    await duck.update({ price: 15 });
    expect(duck.price).toBe(15);
    expect(capturedId).toBe("42");
    expect(capturedBody).toEqual({ price: 15 });
  });

  it("Duck.delete() sends DELETE to /api/ducks/:id", async () => {
    let capturedId: string | undefined;
    server.use(
      http.get("/api/ducks", () =>
        HttpResponse.json([
          { id: 42, color: "Red", size: "Large", price: 10, quantity: 5, deleted: false },
        ]),
      ),
      http.delete("/api/ducks/:id", ({ params }) => {
        capturedId = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const [duck] = await newService().list();
    await duck.delete();
    expect(capturedId).toBe("42");
    expect(duck.deleted).toBe(true);
  });

  it("Duck.delete() throws ApiError on 404", async () => {
    server.use(
      http.get("/api/ducks", () =>
        HttpResponse.json([
          { id: 999, color: "Red", size: "Large", price: 10, quantity: 5, deleted: false },
        ]),
      ),
      http.delete("/api/ducks/:id", () => new HttpResponse(null, { status: 404 })),
    );
    const [duck] = await newService().list();
    await expect(duck.delete()).rejects.toBeInstanceOf(ApiError);
  });
});
