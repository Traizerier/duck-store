import { Router } from "express";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function createDucksRouter(service) {
  const router = Router();

  // /lookup must be registered before any future /:id param routes so the
  // literal segment wins the match.
  router.get(
    "/lookup",
    asyncHandler(async (req, res) => {
      const { color, size } = req.query;
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
      const id = Number(req.params.id);
      const duck = await service.update(id, req.body);
      res.json(duck);
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      await service.delete(id);
      res.status(204).end();
    }),
  );

  return router;
}
