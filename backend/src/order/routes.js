import { Router } from "express";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function createOrdersRouter(orderService) {
  const router = Router();
  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const result = await orderService.process(req.body);
      res.json(result);
    }),
  );
  return router;
}
