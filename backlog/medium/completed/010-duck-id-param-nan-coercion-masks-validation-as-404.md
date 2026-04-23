---
id: 010
title: Duck :id path param coerces to NaN, masking validation errors as 404
status: Completed
severity: medium
service: warehouse-service
promoted_from: P011
---

# 010: Duck `:id` path param coerces to `NaN`, masking validation errors as 404

**Found by:** Error Handling

## Description
`routes/ducks.js` turns `req.params.id` into a number with a bare `Number(req.params.id)` call for both PATCH and DELETE. When a client sends a non-numeric id (e.g. `PATCH /api/ducks/abc` or `DELETE /api/ducks/not-a-number`), `Number()` returns `NaN`, which flows through `service.update`/`service.delete` into `repo.findById({ _id: NaN, deleted: false })`. Mongo finds nothing, the service throws `NotFoundError`, and the client sees a 404 "Duck NaN not found" — instead of the 400 ValidationError the request actually warrants.

STANDARDS.md (warehouse-service) requires "validation at the route boundary only" and the cross-cutting rule says "HTTP boundary validation only. Validate external inputs at the edge." A malformed path param is an edge-of-system input that the route layer is letting through unvalidated.

## Impact
- Malformed id requests report 404 NotFound, muddying observability: a real "id 42 doesn't exist" 404 and a "id was `hotdog`" 404 are indistinguishable in logs.
- Error messages leak `NaN` into user-facing responses (`"Duck NaN not found"`).
- Inconsistent with the POST/GET validation story, which rejects bad input at the boundary with 400.

## Affected Files
- `warehouse-service/src/routes/ducks.js:36-52` — PATCH and DELETE both call `Number(req.params.id)` with no integer check.

## Suggested Fix
Add a tiny parser at the route boundary that rejects non-integer / non-positive ids with a 400 `ValidationError` (reusing the existing error class so the middleware formats it identically to body-validation failures):

```js
function parseId(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError({ id: "must be a positive integer" });
  }
  return n;
}
```

Use it in both PATCH and DELETE handlers. Add a route-level test (`app.test.js`) asserting `PATCH /api/ducks/abc` → 400 with the ValidationError envelope.

## Resolution

**Completed:** 2026-04-23

Implemented the suggested `parseId` helper verbatim and wired it into both the PATCH and DELETE handlers. Worked alongside ticket 011 since both are route-boundary validation fixes touching the same file.

**Changes (2 files):**

- `warehouse-service/src/routes/ducks.js` — added `import { ValidationError } from "../errors.js"` and a module-level `parseId(raw)` helper that throws `ValidationError({ id: "must be a positive integer" })` when `Number.isInteger(n) && n > 0` doesn't hold. The PATCH and DELETE handlers call `parseId(req.params.id)` instead of bare `Number(...)`. The existing middleware in `app.js` already formats `ValidationError` as `400 {error: "ValidationError", errors: {...}}`, so no middleware changes.
- `warehouse-service/src/app.test.js` — 4 new route-level tests across PATCH and DELETE:
  - `PATCH /api/ducks/abc` → 400 with `errors.id` and `error: "ValidationError"`
  - `PATCH /api/ducks/1.5` → 400 (non-integer)
  - `PATCH /api/ducks/0` → 400 (non-positive)
  - `DELETE /api/ducks/not-a-number` → 400 with `errors.id`

**Verification:**

- **Valid RED:** before the GREEN edit, all 4 new tests failed with `expected 404 to be 400` — project compiled, failures were on status assertions.
- **GREEN:** all 99 warehouse tests pass. Route breakdown went from 16 → 23 (+4 from 010, +3 from 011).
- **Smoke:** `curl -X PATCH /api/ducks/abc` returns `400 {error: "ValidationError", errors: {id: "must be a positive integer"}}` — verified end-to-end against the running container.

**Adjacent concerns noted but not tackled:**

- **Service-layer `id` typing.** `service.update(id, ...)` and `service.delete(id)` trust the caller to pass a positive integer. With the route boundary fix, that's now a genuine invariant. If a future internal caller skips the route, the service itself would still accept non-integers. Not acted on because the standards rule is explicitly "HTTP boundary validation only" — internal code trusts its own types. Mention for posterity.
- **`NotFoundError` message reveals NaN when other code paths bypass `parseId`.** With `parseId` in place on PATCH/DELETE, this can't happen today. If a future endpoint accepts `:id` and forgets to call `parseId`, the old NaN-in-message leak returns. A follow-up could centralize id handling (router param middleware with `router.param("id", ...)`) so every `:id` route gets `parseId` for free. Out of scope — today we only have two `:id` routes and both are covered.
