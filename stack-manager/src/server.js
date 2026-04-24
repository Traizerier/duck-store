import express from "express";
import { bearerAuth } from "./auth.js";
import {
  InvalidStackNameError,
  UnknownStackError,
  ComposeError,
} from "./errors.js";

// Express app factory. Manager + token are injected so the same factory
// serves tests (with a fake manager) and production (with the real one).
export function createApp({ manager, token }) {
  const app = express();
  app.use(express.json({ limit: "10kb" }));
  app.use(bearerAuth(token));

  // Liveness probe — no auth (auth middleware short-circuits /health).
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "stack-manager" });
  });

  app.get("/stacks", async (_req, res, next) => {
    try {
      const stacks = await manager.list();
      res.json({ stacks });
    } catch (err) {
      next(err);
    }
  });

  app.get("/stacks/:name", async (req, res, next) => {
    try {
      const status = await manager.status(req.params.name);
      res.json(status);
    } catch (err) {
      next(err);
    }
  });

  app.post("/stacks/:name/up", async (req, res, next) => {
    try {
      res.json(await manager.up(req.params.name));
    } catch (err) {
      next(err);
    }
  });

  app.post("/stacks/:name/down", async (req, res, next) => {
    try {
      res.json(await manager.down(req.params.name));
    } catch (err) {
      next(err);
    }
  });

  app.post("/stacks/:name/restart", async (req, res, next) => {
    try {
      res.json(await manager.restart(req.params.name));
    } catch (err) {
      next(err);
    }
  });

  app.get("/stacks/:name/logs", async (req, res, next) => {
    try {
      const tail = req.query.tail !== undefined ? Number(req.query.tail) : 200;
      res.json(await manager.logs(req.params.name, { tail }));
    } catch (err) {
      next(err);
    }
  });

  app.get("/stacks/:name/health", async (req, res, next) => {
    try {
      res.json(await manager.health(req.params.name));
    } catch (err) {
      next(err);
    }
  });

  // Central error handler. Maps typed errors to HTTP; anything else is
  // a 500 and we log it (the request is in req so context is preserved).
  app.use((err, req, res, _next) => {
    if (err instanceof InvalidStackNameError) {
      return res.status(400).json({
        error: "InvalidStackName",
        message: err.message,
        providedName: err.providedName,
      });
    }
    if (err instanceof UnknownStackError) {
      return res.status(404).json({
        error: "UnknownStack",
        message: err.message,
        stackName: err.stackName,
      });
    }
    if (err instanceof ComposeError) {
      return res.status(502).json({
        error: "ComposeError",
        message: err.message,
        exitCode: err.exitCode ?? null,
      });
    }
    console.error(
      `[stack-manager] ${req.method} ${req.originalUrl} -> 500`,
      err,
    );
    res.status(500).json({
      error: "InternalServerError",
      message: err.message || "internal error",
    });
  });

  return app;
}
