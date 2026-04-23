---
id: 002
title: Size enum duplicated across warehouse, store, and frontend
status: Completed
service: infra
severity: High
promoted_from: P002
---

## Resolution

**Completed:** 2026-04-23

Resolved together with backlog 001 — same structural fix, same canonical
`shared/enums.json` is the source for both `colors` and `sizes`.

See `backlog/001-color-enum-duplicated-across-three-services.md` for the
per-service details. The only size-specific nuance: store-service's typed
`packaging.Size` constants stay local because they drive the Strategy
pattern's `switch size { case XLarge, Large: ... }` selection — Go can't
generate typed constants from runtime data. The drift test in
`internal/packaging/enums_drift_test.go` guarantees the two stay in sync.

# 002: Size enum duplicated across warehouse, store, and frontend

**Found by:** Duplication, Consistency, Architecture

## Description
The Size enum (`XLarge`, `Large`, `Medium`, `Small`, `XSmall`) is redeclared in three places: the warehouse `SIZES` constant, the store-service `packaging.Size` typed constants (also used by `order.isValidSize`), and the frontend `SIZES` tuple. STANDARDS.md explicitly names Size among the enums that "come from a shared constants module — never inlined."

## Impact
Same class of failure as the Color duplication: any size change must be made everywhere in lockstep, and there is no cross-service guard. Store-service additionally uses these values as typed `packaging.Size` constants that drive packaging strategy selection, so a silent drift there has functional consequences, not just validation ones.

## Affected Files
- `warehouse-service/src/constants/ducks.js:2`
- `store-service/internal/packaging/packaging.go:17-21`
- `store-service/internal/order/order.go:112-118` (consumes the packaging constants)
- `frontend/src/components/DuckForm.tsx:5`

## Suggested Fix
Same approach as 001 — single declared source, consumers load from it. If a shared schema is impractical in the near term, at minimum add a test per service that asserts the local list matches a canonical fixture, so drift fails CI.
