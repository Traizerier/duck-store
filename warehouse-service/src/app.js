import express from "express";
import { createDucksRouter } from "./routes/ducks.js";
import { ValidationError, NotFoundError } from "./errors.js";

// createApp takes the service container and pulls out each router's service
// at wiring time. Routes stay decoupled from the container — they only see
// the concrete service they need, so unit tests can pass a fake service
// without building a container.
export function createApp(container) {
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => res.json({ ok: true }));
  app.use("/api/ducks", createDucksRouter(container.get("duck")));

  app.use((err, req, res, next) => {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: "ValidationError", errors: err.errors });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: "NotFoundError", message: err.message });
    }
    // Canonical envelope across both services: {error: TypedCode, message}.
    // err.message stays client-visible (typically "TypeError: ..." or similar
    // — not a stack trace). Stack goes to stderr via console.error above.
    console.error(err);
    res.status(500).json({
      error: "InternalServerError",
      message: err.message || "internal error",
    });
  });

  return app;
}
