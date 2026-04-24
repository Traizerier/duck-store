---
id: 031
title: warehouse-service/README.md Layout block omits files + Tests section has stale count
status: Completed
severity: low
service: warehouse-service
promoted_from: P032
---

# 031: `warehouse-service/README.md` Layout block omits files + Tests section has stale count

**Found by:** Consistency (documentation drift), Architecture (documentation drift)
**Related to:** 015 (root + frontend README drift — this is the service-level analogue that 015 did not cover); 021 (same class of stale test counts, different file)

## Description
STANDARDS.md: *"Each service has a `README.md` covering install, run, test, environment variables, and (for store-service) a short design-pattern summary."* `warehouse-service/README.md`'s Layout and Tests sections have drifted from the actual tree in two concrete ways:

1. **Layout block (lines 39-49)** omits two real directories/files that exist today:

   ```
   src/
   ├── constants/ducks.js          # COLORS, SIZES enums (single source of truth)
   ├── validation/duckValidator.js # pure validation (input + update)
   ├── services/duckService.js     # business logic: ...
   ├── repos/duckRepo.js           # MongoDB driver calls; _id ↔ id mapping + counters
   ├── routes/ducks.js             # Express router
   ├── app.js                      # app factory: middleware, router, error handler
   ├── server.js                   # prod entry: connect Mongo, create index, listen
   └── errors.js                   # ValidationError, NotFoundError
   ```

   Missing from the list:
   - `src/db/mongo.js` — created by the db-layer split (referenced in ticket 009's resolution and P016's description).
   - `src/container.js` — the `ServiceContainer` the README's line 30 table-row alludes to but the layout tree doesn't show.
   - `src/services/BaseService.js` — the base class `DuckService` extends (added alongside ticket 020's cross-stack symmetry work).

   The "Layering" key-design-note on line 53 says `routes → services → repos → db`, which mentions a `db` layer that doesn't appear anywhere in the layout.

2. **Tests section (lines 60-66)** reports:

   ```
   **78 tests** across:
   - validation/duckValidator.test.js — 21, pure
   - services/duckService.test.js — 25, fake repo
   - repos/duckRepo.test.js — 16, real Mongo against test db
   - app.test.js — 16, Supertest + real Mongo
   ```

   P016 (still in proposed) logged the post-db-split numbers as **87** (validation 21 + service 25 + **db 6** + repo **19** + app/routes 16). Also missing from the list is `container.test.js` (7 tests). The totals drift the moment anyone adds a test — 015's resolution explicitly chose to *remove* counts from `frontend/README.md` for this exact reason, and that lesson didn't carry over to this file.

## Impact
- A reviewer reading the warehouse README gets an incomplete mental map of the source tree. If they then open `src/`, they see two directories (`db/`, `container.js`) that the README's Layout claimed aren't there.
- Same reviewer-confidence hit as 015: "shipped and forgot to update the docs" reads worse than a missing README.
- The "Layering" rule quoted from STANDARDS.md names `db` as a distinct layer, and the doc demonstrates the opposite.
- Test counts are already known to drift; leaving numbers in the doc sets up the next audit to re-file this finding.

## Affected Files
- `warehouse-service/README.md:39-49` — Layout tree missing `db/mongo.js`, `container.js`, `services/BaseService.js`.
- `warehouse-service/README.md:53` — "Layering" note references `db` layer that's missing from the Layout.
- `warehouse-service/README.md:60-66` — "**78 tests**" block with stale per-file counts (no `container.test.js`, no `db/mongo.test.js`; `repos/duckRepo.test.js` count is old).

## Suggested Fix
Mirror ticket 015's resolution on the frontend README — update the Layout and replace hard-coded counts with a pointer to the run command:

1. **Layout (lines 39-49)**: add the missing rows:

   ```
   src/
   ├── constants/ducks.js          # COLORS, SIZES enums (single source of truth)
   ├── db/mongo.js                 # Mongo connection + index + counters helpers
   ├── validation/duckValidator.js # pure validation (input + update)
   ├── services/
   │   ├── BaseService.js          # requireActive(repo, id) guard
   │   └── duckService.js          # business logic
   ├── repos/duckRepo.js           # MongoDB driver calls; _id ↔ id mapping
   ├── routes/ducks.js             # Express router
   ├── container.js                # ServiceContainer (register/get)
   ├── app.js                      # app factory + error middleware
   ├── server.js                   # prod entry + graceful shutdown
   └── errors.js                   # ValidationError, NotFoundError
   ```

2. **Tests section (lines 60-66)**: replace with a pointer — same pattern 015 established:

   ```markdown
   ## Tests

   Run `bash run.sh test warehouse` from the repo root for the live count. The suite covers pure
   validator tests, fake-repo service tests, real-Mongo repo + db tests, a
   `ServiceContainer` unit test, and Supertest integration tests against a real in-memory Mongo.
   ```

Either of these alone closes half the finding; doing both matches the pattern already applied to `frontend/README.md` and stops the count drift for good.

## Resolution

**Completed:** 2026-04-23

Both halves applied, mirroring ticket 015's pattern on the frontend.

**Changes (1 file):**

- `warehouse-service/README.md` — Layout tree now includes `db/mongo.js`, `services/BaseService.js` under a `services/` sub-tree, and `container.js`. Added a "Service container" bullet to the Key design notes so the `ServiceContainer` concept is called out explicitly. Tests section replaced with a pointer to `bash run.sh test warehouse` plus a one-paragraph coverage summary. No hard-coded counts remain.

**Verification:** `ls warehouse-service/src/` — every directory/file shown in the README tree exists; no missing entries. Same readthrough confirms no renamed/deleted files are still listed.
