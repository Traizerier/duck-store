import { Router } from "express";
import { ValidationError } from "../errors.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Path-param id parser. A non-integer / non-positive id is a malformed
// request (400), not a miss (404). Reuses the ValidationError envelope
// so the client sees the same shape as body-level validation errors.
function parseId(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError({ id: "must be a positive integer" });
  }
  return n;
}

export function createInventoryRouter(service) {
  const router = Router();

  // /lookup must win over /:id.
  router.get(
    "/lookup",
    asyncHandler(async (req, res) => {
      const row = await service.findByAttributes(req.query);
      res.json(row);
    }),
  );

  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      res.json(await service.list());
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const row = await service.create(req.body);
      res.status(201).json(row);
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const row = await service.update(id, req.body);
      res.json(row);
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      await service.delete(id);
      res.status(204).end();
    }),
  );

  return router;
}
