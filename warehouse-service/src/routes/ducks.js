import { Router } from "express";
import { ValidationError } from "../errors.js";
import { validateLookupQuery } from "../validation/duckValidator.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Boundary check for :id path params. Bare `Number(raw)` returns NaN for
// non-numeric strings, which Mongo then silently doesn't match, producing
// a 404 for what should be a 400. Reject at the route so the error envelope
// matches body-validation failures.
function parseId(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError({ id: "must be a positive integer" });
  }
  return n;
}

export function createDucksRouter(service) {
  const router = Router();

  // /lookup must be registered before any future /:id param routes so the
  // literal segment wins the match.
  router.get(
    "/lookup",
    asyncHandler(async (req, res) => {
      const { color, size } = req.query;
      const { valid, errors } = validateLookupQuery({ color, size });
      if (!valid) throw new ValidationError(errors);
      const duck = await service.findByColorAndSize({ color, size });
      res.json(duck);
    }),
  );

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const ducks = await service.list();
      res.json(ducks);
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const duck = await service.create(req.body);
      res.status(201).json(duck);
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const duck = await service.update(id, req.body);
      res.json(duck);
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
