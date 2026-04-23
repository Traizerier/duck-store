---
id: 001
title: Color enum duplicated across three services
status: Completed
service: infra
severity: High
promoted_from: P001
---

## Resolution

**Completed:** 2026-04-23

Created `shared/enums.json` at the repo root as the single source of truth.
All three services now reference it:

- **warehouse-service**: `constants/ducks.js` reads it via `fs.readFileSync`
  at module-load time and re-exports as `COLORS`/`SIZES`.
- **frontend**: `src/constants/ducks.ts` imports the JSON directly (Vite
  inlines it at transform time). `DuckForm.tsx` imports from the
  constants module instead of declaring `COLORS`/`SIZES` locally.
  `vite.config.ts` `server.fs.allow: [".."]` lets the dev server read
  across the project boundary.
- **store-service**: new `internal/enums` package with a `Load(path)`
  function that returns a `*Enums{Colors, Sizes}`. `main.go` loads at
  startup (path via `ENUMS_PATH` env var, default `../shared/enums.json`)
  and passes the result to `order.Handler`. The order validator now
  checks against the loaded lists instead of a hardcoded `validColors`
  slice.

Drift impossible for the two JS services — they literally read the same
file. For the store-service's typed `packaging.Size` constants (which
can't be loaded at runtime because Go `const`s must be compile-time),
`internal/packaging/enums_drift_test.go` asserts they match
`shared/enums.json` and fails CI if they diverge.

# 001: Color enum duplicated across three services

**Found by:** Duplication, Consistency, Architecture

## Description
The Color enum (`Red`, `Green`, `Yellow`, `Black`) is declared in three independent places: the warehouse `COLORS` constant, the store-service `validColors` slice, and the frontend `COLORS` tuple. STANDARDS.md says Color enums "come from a shared constants module — never inlined." `docs/assumptions.md` already acknowledges the store-service copy is a workaround because "there's no shared schema between services," and the frontend copy is not acknowledged at all.

## Impact
Any schema change (adding/removing a color) must be made in three files in lockstep; a miss produces silent validation drift where one service accepts a value another rejects. The frontend currently has no guard that its options match what the backend accepts.

## Affected Files
- `warehouse-service/src/constants/ducks.js:1` — canonical list
- `store-service/internal/order/order.go:78` — `validColors` duplicate
- `frontend/src/components/DuckForm.tsx:4` — `COLORS` duplicate
- `frontend/src/i18n/locale.tsx:42-45` — color translation keys tied to the same list

## Suggested Fix
Pick a source of truth per the assumptions doc (warehouse) and have each consumer stay in sync:
- Expose a `GET /api/ducks/enums` (or similar) endpoint from warehouse, or a shared JSON schema file checked into the repo root, or a generated types package.
- Store-service and frontend load the list at startup / build time rather than hardcoding.
- As a minimum step, add a CI check or test that diffs the three arrays and fails if they drift.
