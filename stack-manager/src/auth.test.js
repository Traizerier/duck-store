import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { bearerAuth } from "./auth.js";

function appWithAuth(token) {
  const app = express();
  app.use(bearerAuth(token));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/stacks", (_req, res) => res.json({ stacks: [] }));
  return app;
}

describe("bearerAuth", () => {
  it("throws at construction time if token is empty", () => {
    expect(() => bearerAuth("")).toThrow(/token/);
    expect(() => bearerAuth()).toThrow(/token/);
  });

  it("lets /health through without a token", async () => {
    const res = await request(appWithAuth("secret")).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("401s requests with no Authorization header", async () => {
    const res = await request(appWithAuth("secret")).get("/stacks");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("401s requests with the wrong scheme", async () => {
    const res = await request(appWithAuth("secret"))
      .get("/stacks")
      .set("Authorization", "Basic secret");
    expect(res.status).toBe(401);
  });

  it("401s requests with the wrong token", async () => {
    const res = await request(appWithAuth("secret"))
      .get("/stacks")
      .set("Authorization", "Bearer wrong");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("invalid token");
  });

  it("200s requests with the right token", async () => {
    const res = await request(appWithAuth("secret"))
      .get("/stacks")
      .set("Authorization", "Bearer secret");
    expect(res.status).toBe(200);
  });
});
