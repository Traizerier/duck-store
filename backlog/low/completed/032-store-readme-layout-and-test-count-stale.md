---
id: 032
title: store-service/README.md Layout omits internal/enums + internal/service, Tests count stale
status: Completed
severity: low
service: store-service
promoted_from: P033
---

# 032: `store-service/README.md` Layout omits `internal/enums` + `internal/service` and Tests count is stale

**Found by:** Consistency (documentation drift), Architecture (documentation drift)
**Related to:** 015 (same class — service-level README drift; 015 covered root + frontend); 021 (same class of stale test counts, different file); 031 (warehouse-service counterpart of this same finding)

## Description
STANDARDS.md: *"Each service has a `README.md` covering install, run, test, environment variables, and (for store-service) a short design-pattern summary."* `store-service/README.md`'s Layout and Tests sections have drifted from the actual tree:

1. **Layout block (lines 33-40)** shows:

   ```
   cmd/server/main.go          # wire client → handler, listen
   internal/
   ├── packaging/              # Strategy + Decorator
   ├── pricing/                # Chain of Responsibility
   ├── order/                  # HTTP handler composing packaging + pricing + client
   └── warehouse/              # HTTP client to warehouse-service
   ```

   Missing from the list:
   - `internal/enums/` — loads `shared/enums.json` at `main()` startup; it's the injection point for color/size validation in the order handler (referenced in `internal/order/order.go:13, 74`).
   - `internal/service/` — holds `BaseService` with `Name()`, embedded by all three services; after ticket 020's resolution this is live scaffolding that gets read at the init-log and the `ErrInternal` log line.

2. **Tests section (lines 68-73)** reports:

   ```
   **33 tests**:
   - internal/packaging — 14 table-driven subtests ...
   - internal/pricing — 5 scenario tests ...
   - internal/order — 9 handler tests ...
   - internal/warehouse — 5 client tests ...
   ```

   Per the completed-ticket 020 resolution notes (*"go vet ./... && go test ./... -count=1 — clean, all 64 subtests still pass"*), the real count is **64 subtests**, and the list above doesn't include:
   - `internal/enums/enums_test.go` — added when enums were factored out.
   - `internal/service/base_test.go` — added with `BaseService` (ticket 020 left this in place).
   - `internal/packaging/enums_drift_test.go` — the `TestSize_matchesSharedEnums` guard added when shared/enums.json became the source of truth.

## Impact
- Same "open the README, then open the tree, see a mismatch" reviewer flow as P032 — and this time the missing directories (`enums/`, `service/`) are exactly the two pieces that tie store-service into the cross-service architecture (shared enums + cross-stack BaseService symmetry from ticket 020). A reviewer who stops at the README misses the single source of truth story entirely.
- STANDARDS.md calls out `cmd/server` wiring + `internal/order` handler + `internal/packaging` + `internal/pricing` + `internal/warehouse` client as the layering — but then `internal/enums` (config loader) and `internal/service` (cross-service base) live outside that five-box story in the README. Adding them to the Layout makes the architecture legible in one place.
- Test-count drift is the same P016/P032 footgun: this ticket will re-fire on the next audit if counts stay hardcoded.

## Affected Files
- `store-service/README.md:33-40` — Layout tree missing `internal/enums/` and `internal/service/`.
- `store-service/README.md:68-73` — "**33 tests**" block with stale totals, missing `enums`, `service`, and `packaging/enums_drift_test.go` rows.

## Suggested Fix
Mirror 015's resolution pattern:

1. **Layout (lines 33-40)**: add the missing rows with one-line descriptions:

   ```
   cmd/server/main.go          # wire client → handlers; graceful shutdown
   internal/
   ├── enums/                  # load shared/enums.json at startup
   ├── service/                # BaseService (Name()) embedded by all services
   ├── packaging/              # Strategy + Decorator
   ├── pricing/                # Chain of Responsibility
   ├── order/                  # HTTP handler composing packaging + pricing + client
   └── warehouse/              # HTTP client to warehouse-service
   ```

2. **Tests section (lines 68-73)**: replace hard-coded counts with a pointer to the command, matching ticket 015's resolution on the frontend README:

   ```markdown
   ## Tests

   Run `bash run.sh test store` from the repo root for the live count. Coverage:
   table-driven tests for every packaging strategy × protection combination,
   scenario tests for every pricing rule (including the air-bulk discount),
   handler tests against a fake `WarehouseClient`, `httptest.NewServer`-backed
   warehouse client tests, enum-load tests, and a drift guard against
   `shared/enums.json`.
   ```

Either half alone closes part of the finding; both together mirrors the frontend/warehouse patterns and stops this from recurring.

## Resolution

**Completed:** 2026-04-23

Both halves applied, mirroring 015 (frontend) and 031 (warehouse).

**Changes (1 file):**

- `store-service/README.md` — Layout tree adds `internal/enums/` and `internal/service/` rows. `cmd/server/main.go`'s description updated to mention graceful shutdown. `internal/order/`'s description updated from "HTTP handler composing ..." to "OrderService: validate → lookup → package → price" so it reflects the service-shape refactor from ticket 020. Tests section replaced with a pointer to `bash run.sh test store` plus a one-paragraph coverage summary that explicitly names the `BaseService` test and the `enums_drift_test.go` guard.

**Verification:** `ls store-service/internal/` — every listed directory exists; nothing missing, nothing renamed.
