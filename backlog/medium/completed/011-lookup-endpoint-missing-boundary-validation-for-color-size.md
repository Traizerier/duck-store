---
id: 011
title: /api/ducks/lookup lacks boundary validation for color + size
status: Completed
severity: medium
service: warehouse-service
promoted_from: P012
---

# 011: `/api/ducks/lookup` lacks boundary validation for color + size

**Found by:** Error Handling, Consistency

## Description
The `/lookup?color=&size=` handler passes `req.query.color` and `req.query.size` directly through to `service.findByColorAndSize` without validating them at the route boundary. Omitted query params (`/api/ducks/lookup`) make both values `undefined`; the service delegates to the repo, Mongo finds nothing, and the service throws a 404 with the message `"No duck found for color=undefined, size=undefined"`.

STANDARDS.md cross-cutting rule: "HTTP boundary validation only. Validate external inputs at the edge." warehouse-service rule: "Validation: At the route boundary only." The POST/PATCH paths follow this (via `validateDuckInput` / `validateDuckUpdate`) but `/lookup` is a second boundary that bypasses validation entirely. The store-service `order.Handler` does validate color/size against the shared enums before calling `warehouse.LookupPrice` (order.go:103-111), so today's only reason this hasn't broken is that the in-process caller happens to pre-validate — an invariant the warehouse shouldn't rely on.

## Impact
- Bad inputs are surfaced as 404 NotFound instead of 400 ValidationError. A reviewer or any future direct HTTP caller can't distinguish "this color/size combo exists but is sold out / logically deleted" from "you sent garbage."
- Error messages ship `color=undefined` text back to the client — low-quality UX and awkward in logs.
- Inconsistent with the rest of the service, which uses the `ValidationError`/`NotFoundError` envelope discipline. Missing from `/lookup` means the contract isn't uniform.

## Affected Files
- `warehouse-service/src/routes/ducks.js:11-18` — `/lookup` handler hands query params through unchecked.
- `warehouse-service/src/services/duckService.js:55-61` — `findByColorAndSize` throws `NotFoundError` even when the input is clearly invalid.
- `warehouse-service/src/validation/duckValidator.js` — already exports `COLORS`/`SIZES`; easy to add a `validateLookupQuery({color, size})` companion to `validateDuckInput`/`validateDuckUpdate`.

## Suggested Fix
Add a `validateLookupQuery` in `duckValidator.js` that checks `color ∈ COLORS` and `size ∈ SIZES` (the same checks `validateDuckInput` already does for the body), and call it from the `/lookup` route. On failure throw `ValidationError` so the existing middleware turns it into `400 {error: "ValidationError", errors: {...}}`. Add a route-level test asserting that `/api/ducks/lookup` (no params) and `/api/ducks/lookup?color=Purple&size=Large` both return 400 with the ValidationError envelope, not 404.

## Resolution

**Completed:** 2026-04-23

Implemented the suggested `validateLookupQuery` in `duckValidator.js` and wired it into the `/lookup` route. Worked alongside ticket 010 since both are route-boundary validation fixes touching the same router.

**Changes (3 files):**

- `warehouse-service/src/validation/duckValidator.js` — added `validateLookupQuery(query)` that mirrors the body-validator contract (`{ valid, errors }`). Checks `color ∈ COLORS` and `size ∈ SIZES` against the shared enums; returns the same `"must be one of: ..."` message format used by `validateDuckInput` so the client sees a uniform error vocabulary.
- `warehouse-service/src/routes/ducks.js` — `/lookup` handler now calls `validateLookupQuery({color, size})` before delegating to the service. On `valid: false`, throws `ValidationError(errors)` which the existing `app.js` middleware formats as `400 {error: "ValidationError", errors: {...}}`. Added the import from `../validation/duckValidator.js`.
- Tests — route-level in `app.test.js` (3 new) and unit-level in `duckValidator.test.js` (5 new):
  - Route: no params → 400 with both `errors.color` and `errors.size`
  - Route: `?color=Purple&size=Large` → 400 with `errors.color` only
  - Route: `?color=Red&size=Huge` → 400 with `errors.size` only
  - Unit: valid input `{color:"Red", size:"Large"}` → `valid:true`
  - Unit: unknown color → `errors.color`; unknown size → `errors.size`
  - Unit: empty object → both errors; `undefined` input → both errors (mirrors existing `validateDuckInput` null/undefined handling)

**Verification:**

- **Valid RED:** before the GREEN edit, the 3 route tests returned 404 and the 4 failing unit tests hit the stub's `{valid:true}` return. 7 total failures on `expect` — project compiled, failures were all assertion-level (the stub made imports resolve).
- **GREEN:** all 99 warehouse tests pass. Validator breakdown went from 21 → 26; app/routes from 16 → 23 (across both tickets).
- **Smoke:** `GET /api/ducks/lookup` → `400 {error: "ValidationError", errors: {color: "...", size: "..."}}`. `GET /api/ducks/lookup?color=Purple&size=Large` → `400 {..., errors: {color: "..."}}`. Verified end-to-end against the running container.

**Adjacent concerns noted but not tackled:**

- **Store service already pre-validates.** The ticket noted store's `order.Handler` validates color/size against shared enums before calling `warehouse.LookupPrice`. After this fix, the warehouse now defends its own boundary, so that pre-validation is belt-and-suspenders rather than load-bearing — good, but it also means store could be trimmed in a later refactor. Not acted on: store's validation gives a better user-facing error message for the order flow (`"must be one of: ..."` alongside the color+size errors from its own validator), and removing it would regress that UX.
- **`findByColorAndSize` service throws `"No duck found for color=X, size=Y"` on 404.** With `/lookup` now guarding at the route, X and Y are always valid enum values — no more `color=undefined` in logs. Leaving the service message as-is; it's accurate now.
- **No test asserts service.findByColorAndSize still runs on valid input.** The existing "returns the active duck matching color and size" test covers the happy path. The new validation doesn't short-circuit valid input, verified by that test still passing. No new test needed.
