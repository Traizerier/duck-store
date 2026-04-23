import express from "express";
import { createDucksRouter } from "./routes/ducks.js";
import { ValidationError, NotFoundError } from "./errors.js";

export function createApp(service) {
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => res.json({ ok: true }));
  app.use("/api/ducks", createDucksRouter(service));

  app.use((err, req, res, next) => {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: "ValidationError", errors: err.errors });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: "NotFoundError", message: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "InternalServerError" });
  });

  return app;
}
