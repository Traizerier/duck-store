---
id: 036
title: Root README Prerequisites, Configuration, and Dev-workflow text describe an architecture that no longer exists
status: Completed
severity: medium
service: docs
promoted_from: P038
---

# 036: Root `README.md` Prerequisites, Configuration, and Dev-workflow text describe an architecture that no longer exists

**Found by:** Architecture (documentation drift), Consistency
**Related to:** 015 (prior Project-layout table rewrite — still current shape, but values stale). Body written against the current two-stack world.

## Description

Ticket 015 brought the "Project layout" table up to date for the Node-warehouse + Go-store architecture. That architecture was collapsed (Go dropped; `warehouse-service/` renamed to `backend/`; the two sides became two instances of the same image) and the README wasn't reviewed after. Separately, the stack arrangement changed again: there's no longer a shared `.env` at the repo root — each stack has its own `.env.<name>`, and run.sh orchestrates two independent compose projects.

Concrete drift:

1. **README.md:8** — *"Node.js ≥ 20 and npm — for `warehouse-service` and `frontend`."* — `warehouse-service/` doesn't exist; the directory is `backend/`.
2. **README.md:9** — *"Go ≥ 1.21 — for `store-service`…"* — no Go in the repo. Still makes `setup.sh` complain on a clean machine without Go.
3. **README.md:27-32** — Configuration table's rows describe a single-`.env` world:
   - *"Compose | `.env` (repo root)"* — there is no `.env` at the root. Per-stack files are `.env.warehouse` and `.env.store`.
   - *"Service (host mode) | `<service>/.env`"* — steers readers at a convention we don't use.
   - The "Example — changing the warehouse host port" narrative (lines 35-39) tells the reader to edit root `.env` with `WAREHOUSE_HOST_PORT=...`. The actual knob is `BACKEND_HOST_PORT` in `.env.warehouse:10`.
4. **README.md:48** — *"bash run.sh   # foreground: brings up mongo + warehouse, streams logs"* — `bash run.sh` (default command `up`) now brings up BOTH stacks in the background. Foreground is a subcommand (`run.sh foreground <stack>`).
5. **README.md:49-56** — The lifecycle command list is mostly wrong:
   - `bash run.sh detached` — no such subcommand; the default IS detached.
   - `bash run.sh down` — still works but arg syntax changed; `bash run.sh down <stack>` narrows scope.
   - `bash run.sh logs [svc]` / `shell [svc]` / `test [svc]` — all now take `<stack> [svc]`.
6. **README.md:67** — *"docker compose up -d --build   # without docker-compose.dev.yml, the base file alone runs prod Dockerfiles"* — the base `docker-compose.yml` now requires a `--env-file`. A bare `docker compose up` will fail with "variable is not set" warnings.
7. **README.md:77** — Layout table, frontend row: *"Warehouse + Store tabs, typed ServiceContainer, active-record Duck model, bilingual i18n."* — No tabs any more. Single page, branded per stack via `VITE_TITLE`.
8. **README.md:86** — *"`run.sh` — starts Mongo via docker compose, then each service's dev mode in parallel."* — pre-pivot description. `run.sh` now iterates over `STACKS=(warehouse store)` and runs `docker compose` once per stack with its matching `.env.<name>`.

## Impact

- First thing a reviewer does is run `setup.sh` to check prereqs. "Go ≥ 1.21" makes `setup.sh` fail on a clean Mac without Go — friction for something the code doesn't use.
- The Configuration section is load-bearing onboarding. Steering new contributors at a `<service>/.env` convention that doesn't exist, with an example that names the wrong env var, produces real confusion.
- `docker compose up -d --build` (line 67) no longer works as shown. That's the one command the reviewer might copy-paste literally.
- The Layout table's "Warehouse + Store tabs" line describes an intermediate architecture the frontend briefly had and then shed — reviewer who sees "tabs" in the README and then doesn't see them in the UI loses confidence.

## Affected Files

- `README.md:8-9` — Prereqs (Go reference + `warehouse-service` naming).
- `README.md:27-39` — Configuration table + "Example — changing the warehouse host port".
- `README.md:48-56` — Dev workflow command list.
- `README.md:67` — Prod-images snippet; bare `docker compose` command.
- `README.md:77` — Project layout, frontend row ("Warehouse + Store tabs").
- `README.md:86` — Scripts paragraph, `run.sh` description.

## Suggested Fix

1. **Prereqs:** delete the Go line. Rewrite the Node line as: *"for `backend/` and `frontend/`."*
2. **Configuration table:** collapse to the real shape — per-stack `.env.<name>` at the repo root + `environment:` overrides in compose. Rewrite the port-change example to edit `.env.warehouse` / `.env.store` and set `BACKEND_HOST_PORT` / `FRONTEND_HOST_PORT`.
3. **Dev workflow commands:** mirror `run.sh`'s own help output. Key shapes:
   - `bash run.sh up [stack...]` (default: both)
   - `bash run.sh down [stack...]` (default: both)
   - `bash run.sh foreground <stack>` (requires a stack)
   - `bash run.sh logs [stack]`, `shell <stack> [svc]`, `test <stack> [svc]`
4. **Prod-images snippet:** replace the bare `docker compose up -d --build` with the correct per-stack form, or point at `run.sh up` and note that dropping `docker-compose.dev.yml` picks the prod image.
5. **Layout table:** rewrite the frontend row — *"Single-page inventory UI, typed `ServiceContainer`, active-record `Duck` model, bilingual i18n. Per-stack branding via `VITE_TITLE`."*
6. **Scripts paragraph:** update the `run.sh` description to match reality — *"orchestrates one compose project per stack (`duckstore-warehouse`, `duckstore-store`). Each stack is an independent `{mongo, backend, frontend}` trio. See `bash run.sh help`."*

## Resolution

Rewrote the stale sections of root `README.md`:

- **Prereqs:** dropped the Go line entirely; Node entry now reads "for `backend/` and `frontend/`."
- **Quickstart:** updated to `bash run.sh up` (default brings up both stacks); added the `bash run.sh down` teardown note.
- **Configuration table:** collapsed to two rows reflecting the real shape — per-stack `.env.<stack>` + `environment:` overrides in compose. Rewrote the port-change example to edit `.env.warehouse` with `BACKEND_HOST_PORT` / `FRONTEND_HOST_PORT`.
- **Dev workflow commands:** mirrored `run.sh help`. New shapes: `up [stack...]`, `down [stack...]`, `foreground <stack>`, `logs [stack]`, `shell <stack> [svc]`, `test <stack> [svc]`.
- **Prod-images snippet:** replaced the bare `docker compose up -d --build` with two correct per-stack invocations including `--env-file` and `-p` flags.
- **Project layout table:** rewrote the frontend row — "Single-page inventory UI, typed `ServiceContainer`, active-record `Duck` model, bilingual i18n. Per-stack branding via `VITE_TITLE`."
- **Scripts paragraph:** `run.sh` description now reads "orchestrates one compose project per stack (`duckstore-warehouse`, `duckstore-store`). Each stack is an independent `{mongo, backend, frontend}` trio."
