---
id: 034
title: run.sh DEV_SERVICES references nonexistent mongo service; also leaves orphans on down and can't target individual instances
status: Completed
severity: high
service: scripts
promoted_from: P035
---

# 034: `run.sh` DEV_SERVICES references `mongo`, but compose defines `warehouse-mongo` and `store-mongo`

**Found by:** Architecture, Consistency
**Reviewer follow-up:** "when running the stop flag on run.bat stop, 2 of the containers remain open" — `down` doesn't remove orphans. Also asked: "update the run stuff to be able to specify which service (store vs warehouse vs whatever arbitrary named instance) to start/interact with."

## Description
`run.sh:42` declares:

```bash
DEV_SERVICES=(mongo warehouse store frontend)
```

Every `up`/`foreground`/`build` command iterates over this list:

```bash
dc up -d "${DEV_SERVICES[@]}"    # run.sh:57
```

But after the pivot, `docker-compose.yml` no longer has a service called `mongo` — it has `warehouse-mongo` (lines 8-13) and `store-mongo` (lines 32-37). There is also no `mongo` service declared in `docker-compose.dev.yml`. The resulting `docker compose up -d mongo warehouse store frontend` fails with:

```
no such service: mongo
```

which aborts the entire `up` (docker compose validates service names before starting anything).

## Impact
- `bash run.sh up` — the documented primary dev entrypoint in the root README (`## Quickstart`) — does not start the stack at all. Every developer (and every reviewer cloning the repo) hits this on first run.
- `bash run.sh build`, `bash run.sh foreground` all fail the same way for the same reason.
- The error message surfaces as "no such service: mongo" with no hint about the warehouse-mongo / store-mongo rename, so troubleshooting requires reading `docker-compose.yml`.

## Affected Files
- `run.sh:42` — `DEV_SERVICES=(mongo warehouse store frontend)` references a nonexistent service.
- `run.sh:57, 72, 91` — `dc up -d "${DEV_SERVICES[@]}"` / `dc up ...` / `dc build ...` all propagate the failure.

## Suggested Fix
Update DEV_SERVICES to match the current compose services:

```bash
DEV_SERVICES=(warehouse-mongo store-mongo warehouse store frontend)
```

Alternatively, rely on compose's default behavior — `dc up -d` with no service arguments starts every service in the file — and drop the explicit list. That removes the class of drift where compose adds a service and `run.sh` silently skips it. If explicit control is wanted (e.g., to omit `frontend` in a particular mode), keep the list but keep it in sync with compose via a test or a comment pointing at `docker-compose.yml`.

## Resolution

**Completed:** 2026-04-23

Took the "drop the explicit list" approach and used this ticket to land two other reviewer follow-ups at the same time:

1. **The stale `mongo` service name** (this ticket).
2. **"`run.bat stop` leaves 2 of the containers running"** — the real cause: `warehouse` and `store` had `profiles: ["full"]` in `docker-compose.yml`, and `docker compose down` ignores profiled services unless you explicitly activate the profile. Removing the profiles fixed it.
3. **"Update the run stuff to be able to specify which service to start/interact with"** — `up`, `foreground`, `build`, `down`, `logs`, `restart`, `rebuild` now all accept optional service names that get forwarded to compose.

**Changes (3 files):**

- `run.sh` — significant rewrite:
  - Deleted the hardcoded `DEV_SERVICES=(mongo warehouse store frontend)` array. Commands pass through user-supplied service args; empty = all services (compose default), which stays correct as compose evolves.
  - Added `--remove-orphans` to `up`, `foreground`, and `down` so stale containers from prior compose shapes (e.g. the pre-pivot single `mongo`) can't linger.
  - `down` now aliased to `stop` for discoverability, matching the reviewer's phrasing.
  - New `services` command (`run.sh services`) lists compose-known services for quick discovery.
  - Help text rewritten to document the new `[svc...]` argument shape with examples.
- `docker-compose.yml` — removed `profiles: ["full"]` from `warehouse` and `store`. Both now start by default like every other service. Prod-image runs (previously gated behind `--profile full`) now just use the base compose file without the dev override: `docker compose up -d --build`.
- `README.md` — updated the "Running the built prod images" stanza to match (no more `--profile full`).

**Verification:**

- `bash run.sh down` against the running stack: all five containers stop + get removed; `duckstore_default` network removed. Previously only the two mongos stopped (the profile filter hid warehouse + store).
- `bash run.sh up` with no args: all 5 services (`warehouse-mongo`, `store-mongo`, `warehouse`, `store`, `frontend`) come up. Boot logs show the expected `backend [warehouse]` / `backend [store]` lines on their own mongos.
- `bash run.sh up warehouse`: only `warehouse` + its declared dep (`warehouse-mongo`) start. Nothing else.
- `bash run.sh services`: lists all 5 compose services in sorted order.
- `bash run.sh help`: new help text renders; `Services available:` line at the bottom is generated from `dc config --services`, so it can't drift.

**Adjacent concerns noted but not tackled:**

- **`run.sh test` for a non-backend service that isn't the frontend.** Currently the else branch assumes `npm run test:run`. Not a problem today (only `frontend` and the two backend instances exist, all Node). If a future service uses a different test runner, the branch will need extending.
- **Stopping a single instance.** `run.sh down warehouse` today hands the arg to `docker compose down` which treats positional args as **services to *not* remove**. Non-intuitive. If per-service stop becomes a common need, add a `stop <svc>` path that calls `dc stop <svc> && dc rm -f <svc>` explicitly.
- **`run.sh ps` arg pass-through**: `dc ps "$@"` forwards filters. Not documented; low-traffic enough to skip.
