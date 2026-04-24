import express from "express";
import { createInventoryRouter } from "./inventory/routes.js";
import { createOrdersRouter } from "./order/routes.js";
import { ValidationError, NotFoundError } from "./errors.js";

// createApp takes the service container + schema and mounts the inventory
// router at `/api/${schema.plural}`. Routes stay decoupled from the
// container itself — they only see the concrete service they need, so
// unit tests can pass a fake service without building a container.
export function createApp(container, schema) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) =>
    res.json({ ok: true, instance: process.env.INSTANCE ?? "default", type: schema.name }),
  );

  app.use(`/api/${schema.plural}`, createInventoryRouter(container.get("inventory")));
  if (schema.hasOrders) {
    app.use("/api/orders", createOrdersRouter(container.get("order")));
  }

  app.use((err, _req, res, _next) => {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: "ValidationError", errors: err.errors });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: "NotFoundError", message: err.message });
    }
    console.error(err);
    res.status(500).json({
      error: "InternalServerError",
      message: err.message || "internal error",
    });
  });

  return app;
}
