---
id: 009
title: docs/plan.md repo layout diverges from the implementation
status: Completed
severity: low
service: warehouse-service
promoted_from: P010
---

# 009: docs/plan.md repo layout diverges from the implementation

**Found by:** Architecture

## Description
`docs/plan.md` is described in STANDARDS.md as "the master plan," and its "Repo layout" section (lines 38-63) shows a `warehouse-service/src/db/mongo.js` file for the Mongo client + counters helper. In the actual implementation there is no `src/db/` directory — the Mongo client and counters helper are inlined in `server.js` (lines 10-16) and `repos/duckRepo.js` (lines 8-18) respectively. STANDARDS.md also references `docs/logging.md`, which does not exist (see P004).

## Impact
A reviewer (or the job interviewer this project is being submitted to) comparing the plan to the code sees a layering diagram the code doesn't match. The plan's own layering (`routes/` → `services/` → `repos/` → `db/`) implies a `db/` layer that isn't there, even though the behavior is covered elsewhere.

## Affected Files
- `docs/plan.md:38-63` (repo layout claiming `src/db/mongo.js`)
- `warehouse-service/src/server.js:1-16` (inlined Mongo bootstrap)
- `warehouse-service/src/repos/duckRepo.js:11-18` (`nextId` counters helper)
- `.claude/audit-standards/STANDARDS.md:41` (reference to missing `docs/logging.md`)

## Suggested Fix
Either update the doc to match reality (remove the `src/db/` node, drop the `docs/logging.md` reference or replace it with a short inline note) or add a thin `src/db/mongo.js` that owns connection + counters and import it from `server.js` and `duckRepo.js`. The second option better matches the standards' layering rule ("Routes do not touch Mongo directly. Repos do not format HTTP responses.") because today the counters concept leaks into the repo. Either way, close the gap so the docs and code agree.

## Resolution

**Completed:** 2026-04-23

Chose the code-to-match-doc direction (Option B) since it strengthens the standards' layering rule — counters no longer leak into the repo. The plan.md tree already shows `db/mongo.js` with the comment "client + counters helper," so no doc edit was needed; the code now genuinely matches.

**Changes (5 files):**

- `warehouse-service/src/db/mongo.js` (new) — three exports:
  - `connectDb(url, dbName)` — wraps `MongoClient.connect` and returns `{ client, db }`.
  - `createDucksIndex(db)` — creates the compound index `{color:1, size:1, price:1, deleted:1}` supporting `findMatch`. Mongo's `createIndex` is idempotent so it's safe on every boot.
  - `createCounters(db)` — returns `{ nextId(name) }`. Callers pick the counter name, so sequences are independent per collection.
- `warehouse-service/src/db/mongo.test.js` (new, 6 tests) — integration-style tests hitting the real Mongo container. Covers `connectDb` round-trip, `nextId` starting at 1, monotonic increment, independent sequences per name, `createDucksIndex` producing the expected key shape, and idempotency of a second `createDucksIndex` call.
- `warehouse-service/src/server.js` — swapped the inlined `MongoClient.connect` + index creation for `connectDb` + `createDucksIndex`. Creates counters and passes them to `createDuckRepo`.
- `warehouse-service/src/repos/duckRepo.js` — signature is now `createDuckRepo(db, counters)`. The internal `nextId` helper is gone; `insert` calls `counters.nextId("ducks")` instead. Comment at the factory names the reason ID generation lives in the db layer.
- `warehouse-service/src/repos/duckRepo.test.js` — imports `createCounters` and passes `createCounters(db)` into the factory in `beforeEach`.
- `warehouse-service/src/app.test.js` — same shape update in the test bootstrap.

**Verification:**

- **Valid RED:** with the stub in place (empty `connectDb`, no-op `createDucksIndex`, `nextId` returning 0), the db test file ran with 5 assertion failures and 1 trivial pass (the idempotency test is green against a no-op). Project loaded — failures were on `expect`, not imports.
- **GREEN:** after implementing, all 6 db tests pass. Full warehouse suite 87/87 (validation 21 + service 25 + db 6 + repo 19 + app/routes 16).
- **Smoke:** restarted the warehouse container; logs show `warehouse-service listening on :4001 (db: duckstore)` with the reorganized bootstrap — the connection + index bootstrap still runs identically to before.

**Test count:** warehouse 81 → 87 (+6 new db tests).

**Adjacent concerns noted but not tackled:**

- **Stale test counts in `docs/plan.md:142-144`.** Plan reports 78 / 33 / 111; reality is 87 / 64 (subtests) / 40 frontend / 191 total. Not inside this ticket's scope (which is specifically the repo-layout line) — worth a separate low-severity ticket if the doc is meant to stay current, or a README note that counts drift fast and `run.sh test` is the source of truth.
- **`STANDARDS.md:41` reference to `docs/logging.md`.** Still unresolved; the ticket explicitly defers that to P004 (the logging-conventions ticket). Not touched here.
- **Stale checkbox in `docs/plan.md:130`** ("React table + add/edit/delete — in progress"). Frontend is done with 40 tests; checkbox should flip. Same deferred-to-P004-or-similar scope.
- **`connectDb` returns `{ client, db }` but `server.js` destructures only `db`.** The client reference is leaked — on SIGTERM we'd want to `client.close()` for a graceful shutdown. Out of scope for a layering fix, but a reasonable follow-up (add a shutdown handler, or change `connectDb` to register one itself).
