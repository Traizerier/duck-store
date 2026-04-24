---
id: 015
title: Root README.md and frontend/README.md describe a stale codebase
status: Completed
severity: low
service: docs
promoted_from: P023
---

# 015: Root `README.md` and `frontend/README.md` describe a stale codebase

**Found by:** Architecture (documentation drift)
**Related to:** P016 (same kind of doc-vs-reality drift; P016 covers `docs/plan.md`, this covers the two README files)

## Description
STANDARDS.md says "Each service has a `README.md` covering install, run, test, environment variables, and (for store-service) a short design-pattern summary." Two concrete drifts exist outside the `docs/plan.md` finding filed as P016:

1. **Root `README.md:73-77`** — the "Project layout" table still reports all three services as partial:

   | Path                | Stack                       | Status    |
   | ------------------- | --------------------------- | --------- |
   | `warehouse-service/`| Node + Express + MongoDB    | scaffolding |
   | `store-service/`    | Go                          | scaffolding |
   | `frontend/`         | React + Vite + TypeScript   | not started |

   All three services are fully implemented — warehouse-service has the full CRUD + lookup route, store-service has `/api/orders` with packaging + pricing, and frontend has the warehouse UI with i18n and tests.

2. **`frontend/README.md:23-33`** — the "Layout" block still lists the old API layer that the recent refactor deleted:

   ```
   src/
   ├── api/ducks.ts              # typed fetch wrapper: listDucks, createDuck, ...
   ```

   The `src/api/` directory no longer exists. Current layout is `src/services/BaseService.ts`, `src/services/DuckService.ts`, `src/services/index.ts`, and `src/models/Duck.ts`. The same file (`frontend/README.md:44-49`) also documents "30 tests" with an `api/ducks.test.ts — 7` line item for a test file that was deleted alongside `api/ducks.ts`.

3. **`frontend/README.md:37`** still references `ApiError` as living in the old api layer ("`ApiError` carries `status` + parsed `body`...") without noting that it moved to `src/services/BaseService.ts` and is re-exported through `src/services/index.ts`.

## Impact
Reviewer-visible drift on the two documents a reader opens first. An interviewer-cloning flow — open root README → "not started" on frontend, then open `frontend/README.md` → layout that doesn't match `src/` — produces a much worse impression than not having a README at all, because it reads as "the author shipped and forgot to update the docs." Directly undercuts the "attention to detail" signal the bilingual UI and test coverage are trying to send.

## Affected Files
- `README.md:73-77` — stale per-service status table.
- `frontend/README.md:23-33` — layout tree references deleted `src/api/ducks.ts`.
- `frontend/README.md:25` (in layout) + `:46` (in Tests count) — stale `api/ducks.ts` / `api/ducks.test.ts` references.
- `frontend/README.md:37` — "ApiError" paragraph describes the pre-refactor location of the class.
- `frontend/README.md:44-49` — "**30 tests**" block and per-file counts no longer match after the service/model split.

## Suggested Fix
1. In root `README.md`, flip the status column to "done" (or drop the column and rewrite the table as "what each path holds"). Prefer dropping the column so a future refactor doesn't re-introduce the drift.
2. In `frontend/README.md`, rewrite the Layout block to reflect the `services/` + `models/` split. Minimum change:

   ```
   src/
   ├── services/
   │   ├── BaseService.ts    # HTTP scaffold + ApiError
   │   ├── DuckService.ts    # duck CRUD client
   │   └── index.ts          # `services` singleton
   ├── models/Duck.ts        # active-record duck with save/update/delete
   ├── components/
   │   ├── DuckTable.tsx
   │   └── DuckForm.tsx
   ├── pages/Warehouse.tsx
   ├── i18n/locale.tsx       # translations + <LocaleProvider>
   ├── test/setup.ts         # MSW + RTL cleanup
   └── main.tsx
   ```
3. Either update the test counts to match `run.sh test frontend` output, or delete the Tests section entirely and link to the command (matches P016's recommendation for `docs/plan.md`).
4. Update the "ApiError" paragraph (line 37) to reference `services/BaseService.ts`.

Consider replacing hard-coded test counts with a "run `bash run.sh test <svc>`" pointer in every README at the same time, so this class of drift stops recurring.

## Resolution

**Completed:** 2026-04-23

Fixed both READMEs. Dropped the "Status" column in favor of a "Holds" column so the next refactor doesn't silently re-introduce the same staleness. Replaced hard-coded test counts with a pointer to `bash run.sh test frontend`.

**Changes (2 files):**

- `README.md` — Project layout table now describes what each path holds (services present, key concepts like `ServiceContainer`, `OrderService`/`PackagingService`/`PricingService`, Duck active-record). Added `shared/enums.json` and `backlog/` rows. Status column removed.
- `frontend/README.md` — Layout tree rewritten to match the current `services/` + `models/` split. `ApiError` paragraph updated to point at `services/BaseService.ts`. Tests section replaced with a pointer to `run.sh test frontend` + a short description of each suite's role (no counts to drift).

**Verification:** visual diff against the current source tree. Layout lines match files that exist; deleted `api/ducks.ts` line is gone.

**Adjacent concerns noted but not tackled:**

- **Root `README.md` prerequisites** still says "Go ≥ 1.21" — we've been shipping with go1.22+ for a while. Minor; someone upgrading would find out quickly when `setup.sh` reports the minimum.
- **P016** (`docs/plan.md` stale counts and checkboxes) is still proposed; same pattern, different file. Resolution here explicitly doesn't touch plan.md so that ticket stays clean.
