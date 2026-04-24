import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "./server.js";
import { InvalidStackNameError, UnknownStackError, ComposeError } from "./errors.js";

// Fake manager that lets each test set its responses up front.
function fakeManager(overrides = {}) {
  return {
    list: vi.fn(async () => [
      { name: "warehouse", projectName: "duckstore-warehouse" },
      { name: "store", projectName: "duckstore-store" },
    ]),
    status: vi.fn(async (name) => ({ name, services: [] })),
    up: vi.fn(async (name) => ({ name, action: "up" })),
    down: vi.fn(async (name) => ({ name, action: "down" })),
    restart: vi.fn(async (name) => ({ name, action: "restart" })),
    logs: vi.fn(async (name, opts) => ({ name, tail: opts.tail, lines: [] })),
    health: vi.fn(async (name) => ({ name, backend: { reachable: true, ok: true } })),
    ...overrides,
  };
}

const TOKEN = "test-token";
const bearer = { Authorization: `Bearer ${TOKEN}` };

function appFor(manager = fakeManager()) {
  return createApp({ manager, token: TOKEN });
}

describe("GET /health", () => {
  it("200s without auth", async () => {
    const res = await request(appFor()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("stack-manager");
  });
});

describe("GET /stacks", () => {
  it("requires bearer auth", async () => {
    const res = await request(appFor()).get("/stacks");
    expect(res.status).toBe(401);
  });

  it("returns the list from the manager", async () => {
    const mgr = fakeManager();
    const res = await request(appFor(mgr)).get("/stacks").set(bearer);
    expect(res.status).toBe(200);
    expect(res.body.stacks).toHaveLength(2);
    expect(mgr.list).toHaveBeenCalled();
  });
});

describe("GET /stacks/:name", () => {
  it("returns status for a known stack", async () => {
    const mgr = fakeManager({
      status: vi.fn(async (name) => ({
        name,
        services: [{ service: "backend", state: "running" }],
      })),
    });
    const res = await request(appFor(mgr)).get("/stacks/warehouse").set(bearer);
    expect(res.status).toBe(200);
    expect(res.body.services[0].state).toBe("running");
  });

  it("maps UnknownStackError to 404", async () => {
    const mgr = fakeManager({
      status: vi.fn(async () => {
        throw new UnknownStackError("frogs");
      }),
    });
    const res = await request(appFor(mgr)).get("/stacks/frogs").set(bearer);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("UnknownStack");
    expect(res.body.stackName).toBe("frogs");
  });

  it("maps InvalidStackNameError to 400 with providedName", async () => {
    const mgr = fakeManager({
      status: vi.fn(async () => {
        throw new InvalidStackNameError("BAD NAME");
      }),
    });
    const res = await request(appFor(mgr)).get("/stacks/BAD%20NAME").set(bearer);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("InvalidStackName");
    expect(res.body.providedName).toBe("BAD NAME");
  });
});

describe("POST /stacks/:name/{up,down,restart}", () => {
  it.each([
    ["up", "up"],
    ["down", "down"],
    ["restart", "restart"],
  ])("POST /stacks/warehouse/%s invokes manager.%s", async (path, method) => {
    const mgr = fakeManager();
    const res = await request(appFor(mgr))
      .post(`/stacks/warehouse/${path}`)
      .set(bearer);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "warehouse", action: method });
    expect(mgr[method]).toHaveBeenCalledWith("warehouse");
  });

  it("requires auth on every lifecycle op", async () => {
    const res = await request(appFor()).post("/stacks/warehouse/up");
    expect(res.status).toBe(401);
  });

  it("maps ComposeError to 502 with exitCode", async () => {
    const mgr = fakeManager({
      up: vi.fn(async () => {
        throw new ComposeError("boom", { exitCode: 1, stderr: "err" });
      }),
    });
    const res = await request(appFor(mgr))
      .post("/stacks/warehouse/up")
      .set(bearer);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("ComposeError");
    expect(res.body.exitCode).toBe(1);
  });
});

describe("GET /stacks/:name/logs", () => {
  it("passes tail from the query string", async () => {
    const mgr = fakeManager();
    const res = await request(appFor(mgr))
      .get("/stacks/warehouse/logs?tail=42")
      .set(bearer);
    expect(res.status).toBe(200);
    expect(mgr.logs).toHaveBeenCalledWith("warehouse", { tail: 42 });
  });

  it("defaults tail to 200", async () => {
    const mgr = fakeManager();
    await request(appFor(mgr)).get("/stacks/warehouse/logs").set(bearer);
    expect(mgr.logs).toHaveBeenCalledWith("warehouse", { tail: 200 });
  });
});

describe("GET /stacks/:name/health", () => {
  it("returns the backend health shape", async () => {
    const mgr = fakeManager({
      health: vi.fn(async (name) => ({
        name,
        backend: { reachable: true, ok: true, status: 200, body: { ok: true } },
      })),
    });
    const res = await request(appFor(mgr))
      .get("/stacks/warehouse/health")
      .set(bearer);
    expect(res.status).toBe(200);
    expect(res.body.backend.reachable).toBe(true);
  });
});
