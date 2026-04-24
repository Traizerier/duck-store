---
id: 038
title: docs/assumptions.md documents removed services and a 502 error path that no longer exists
status: Completed
severity: medium
service: docs
promoted_from: P040
---

# 038: `docs/assumptions.md` documents removed services (`warehouse-service`, `store-service`) and a 502 error path that no longer exists

**Found by:** Architecture (documentation drift), Consistency
**Related to:** 015 / 021 / 031 / 032 addressed README drift; this covers the assumptions file that wasn't touched by any of them.

## Description

STANDARDS.md calls out `docs/assumptions.md` as the canonical place for spec-ambiguity decisions. Several entries still reference code deleted in the 2026-04 pivot:

1. **Store § "Error mapping" (lines 44-46)** — documents *"Warehouse lookup failure → `502 Bad Gateway` (upstream service fault, not client's fault)."* There is no warehouse lookup anymore — each backend instance has its own inventory, and `backend/src/order/orderService.js:38` does a local `this.inventory.findByAttributes(lookup)`. An order against a missing duck throws `NotFoundError` → 404.
2. **Cross-cutting § "Shared enums" (lines 50-55)** — the three-bullet list reads:
   - *"warehouse-service reads it at module-load time in `src/constants/ducks.js`."* — file deleted; the current equivalent is `backend/src/schemas/Schema.js` loading `shared/enums.json` via `Schema.load(schemaPath, enumsPath)` at boot.
   - *"store-service loads it at `main()` startup via `internal/enums.Load`…"* — store-service is gone.
   - The exception paragraph referencing `store-service/internal/packaging.Size` — file doesn't exist; the exception no longer applies.
3. **Frontend § last line (line 58)** — *"UI targets the warehouse module only. Store's `/api/orders` has no UI per spec."* — post-pivot each stack ships its own frontend pointed only at its own backend; stack identity is a build-time variable (`VITE_TITLE`), not a UI concept.

## Impact

- A reviewer who opens the file and sees "502 Bad Gateway" for a failure mode the current code can't produce will go looking for the dead code in the backend, lose time, and lose confidence.
- The shared-enums paragraphs reference files that don't exist. Anyone using the document as a source-tree map wastes time searching for `src/constants/ducks.js`, `internal/enums/`, `internal/packaging.Size`.
- STANDARDS.md says *"Spec assumptions live either in the service README or `docs/assumptions.md`"* (line 103). Keeping stale copy in the canonical location undermines the standard.

## Affected Files

- `docs/assumptions.md:44-46` — Store error-mapping section references nonexistent 502/warehouse-lookup path.
- `docs/assumptions.md:50-55` — Shared-enums bullets reference deleted files.
- `docs/assumptions.md:58` — Frontend paragraph describes single-warehouse UI.

## Suggested Fix

1. **Store § Error mapping** — replace the "Warehouse lookup failure → 502" bullet with: *"Order for a duck that doesn't exist → 404 (inventory lookup is local, `backend/src/order/orderService.js:38`)."*
2. **Shared enums** — collapse the three bullets into one:
   ```markdown
   - `shared/enums.json` at the repo root is the single source of truth for color/size lists.
     - **backend** (both warehouse + store instances of the same image) loads it at boot in `src/schemas/Schema.js`; the schema resolves enum references eagerly so a typo fails fast.
     - **frontend** imports the JSON in `src/constants/ducks.ts` (Vite inlines it at build time).
   ```
   Drop the `internal/packaging.Size` exception paragraph entirely.
3. **Frontend paragraph** — rewrite as: *"Each stack ships its own frontend against its own backend. Page title / instance chip come from `VITE_TITLE` / `VITE_INSTANCE` at build time; the React code in `frontend/src/pages/Inventory.tsx` has no branching on stack identity. Order-placement endpoints (`/api/orders`) have no UI per spec."*

Consider adding a one-line header banner mirroring `docs/plan.md`'s "Architecture update (2026-04)" block so future readers know the file was reviewed post-pivot.

## Resolution

Updated `docs/assumptions.md`:

- Added a one-line "Architecture update (2026-04)" banner at the top so future readers know the file was reviewed post-pivot.
- **Store § Error mapping:** replaced the "Warehouse lookup failure → 502" bullet with "Order for a duck that doesn't exist in this stack → 404 (inventory lookup is local; see `backend/src/order/orderService.js`)."
- **Cross-cutting § Shared enums:** collapsed the three bullets (warehouse-service / frontend / store-service) into two — backend (both instances load via `src/schemas/Schema.js`) and frontend. Dropped the `store-service/internal/packaging.Size` exception paragraph entirely.
- **Frontend paragraph:** rewrote from "UI targets the warehouse module only" to a description of the per-stack frontend architecture (`VITE_TITLE` / `VITE_INSTANCE` branding, no stack branching in React code, `/api/orders` intentionally backend-only per spec).
