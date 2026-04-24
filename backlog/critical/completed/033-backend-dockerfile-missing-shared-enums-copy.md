---
id: 033
title: Backend prod Dockerfile doesn't copy shared/enums.json, so Schema.load() fails at boot
status: Completed
severity: critical
service: backend, docker-compose
promoted_from: P034
---

# 033: Backend prod Dockerfile doesn't copy `shared/enums.json`, so `Schema.load()` fails at boot

**Found by:** Architecture, Error Handling

## Description
`backend/src/server.js:20` resolves the enums path at boot:

```js
const ENUMS_PATH = process.env.ENUMS_PATH || resolve(here, "../../shared/enums.json");
```

With `here = /app/src`, the default resolves to `/shared/enums.json` in the container. But `backend/Dockerfile` only copies `package.json`, `package-lock.json*`, and `src/` into `/app` — the repo-root `shared/` directory is never copied into the image, and `docker-compose.yml` under the `full` profile does not set `ENUMS_PATH` or bind-mount the shared directory either.

The dev-mode override (`docker-compose.dev.yml`) bind-mounts `./:/workspace:cached` so the file is present at runtime — that's why local dev works. Production (`docker compose --profile full up --build`) will crash on the first `Schema.load()` call with `ENOENT: ... shared/enums.json`.

## Impact
- The production compose path documented in the root README (`docker compose --profile full up --build`) cannot start either backend container — both exit on boot with an uncaught promise rejection from the top-level `await Schema.load(...)` in `server.js:24`.
- No graceful error message; the operator sees a Node stack trace pointing at `readFile` and has to reverse-engineer that the image was built without the shared file.
- Both `warehouse` and `store` instances share the same image, so both stacks are affected identically.

## Affected Files
- `backend/Dockerfile:19` — only `src/` is copied; no `shared/` copy step.
- `backend/src/server.js:20` — default `ENUMS_PATH` assumes `../../shared/enums.json` exists.
- `docker-compose.yml:21-27, 45-51` — environment blocks for `warehouse` and `store` do not set `ENUMS_PATH` and don't mount the shared directory.

## Suggested Fix
Pick one of:

1. **Bake it into the image.** Adjust `backend/Dockerfile` to copy the shared file into a known path and point `ENUMS_PATH` there. Because the Dockerfile's build context is `./backend` (per compose `build: ./backend`), it can't reach `../shared/enums.json` directly — change the build context in compose to the repo root with a `dockerfile: backend/Dockerfile` override, then `COPY --chown=node:node shared/enums.json /app/shared/enums.json` and set `ENUMS_PATH=/app/shared/enums.json` in compose.

2. **Bind-mount in prod compose.** Add `volumes: ["./shared:/app/shared:ro"]` to both the `warehouse` and `store` services in `docker-compose.yml`, and set `ENUMS_PATH: "/app/shared/enums.json"`. Simpler, but less hermetic — the prod image is no longer self-contained.

Either way, add a smoke test (or at least a CI step) that runs `docker compose --profile full up -d` and checks `/health` on both instances, so this class of regression gets caught.

## Resolution

**Completed:** 2026-04-23

Chose option 1 (bake into image) so the prod image stays self-contained — `docker push` / `docker run` works anywhere without needing a matching repo layout on the host.

**RED state reproduced first** (pre-fix): `docker build -t test -f backend/Dockerfile backend/ && docker run test` exited immediately with `ENOENT: no such file or directory, open '/shared/enums.json'` at `Schema.load → readFile`, from the top-level `await` in `server.js`. Exact failure mode the ticket predicted.

**Changes (4 files):**

- `docker-compose.yml` — both `warehouse` and `store` stacks switched from `build: ./backend` to:
  ```yaml
  build:
    context: .                 # repo root so the Dockerfile can reach shared/
    dockerfile: backend/Dockerfile
  ```
  Lets the Dockerfile reach `shared/enums.json` (previously outside the build context).
- `backend/Dockerfile` — `COPY` paths now have a `backend/` prefix to account for the new context (`backend/package.json`, `backend/src/`). Added `COPY --chown=node:node shared/enums.json /shared/enums.json`, which matches the path `server.js`'s default `ENUMS_PATH` resolves to at runtime (`resolve("/app/src", "../../shared/enums.json") = "/shared/enums.json"`). No env-var configuration needed in compose as a result.
- `.dockerignore` (new, at repo root) — keeps the build context lean now that it's the whole repo. Excludes `node_modules`, `dist`, `build`, `coverage`, `.vite`, `backlog/`, `docs/`, `.claude/`, top-level `.md` files (except `backend/README.md`), `frontend/`, `docker-compose*.yml`, `setup.sh`/`run.sh`/`update.sh`/`*.bat`, `.env*`, `.tool-versions`, and `**/*.test.js` (tests don't belong in the prod image).
- No `server.js` change — the default path was already correct for the prod image layout; it just needed the file to exist on disk.

**GREEN verification:**

1. **Prod path via compose full profile:**
   ```
   docker compose -p duckstore-prod -f docker-compose.yml --profile full up -d --build
   ```
   Both containers boot without the ENOENT. Logs show:
   - `service initialized: inventory / packaging / pricing / order`
   - `backend [warehouse] listening on :4001 (schema: duck, db: warehouse)`
   - `backend [store]     listening on :4001 (schema: duck, db: store)`
2. **HTTP smoke from a sidecar container on the compose network:**
   - `GET /health` → `{ok:true, instance:"warehouse", type:"duck"}` (and `instance:"store"` for the other)
   - `POST /api/ducks` → `201` with a valid `{id, color, size, price, quantity, deleted:false}` payload
3. **Dev path unchanged:** `docker compose -p duckstore -f docker-compose.yml -f docker-compose.dev.yml up -d` still boots cleanly. Backend test suite: 128/128 pass.
4. **Image content:** `docker run ... node -e 'readFileSync("/shared/enums.json")'` prints the expected JSON.

**Adjacent concerns noted but not tackled:**

- **CI smoke recommendation** (ticket's suggested follow-up): not added — no CI pipeline in this repo. If one lands, a `docker compose --profile full up --wait` + `curl /health` pair would catch this class of regression.
- **`.dockerignore`** is verbose but explicit. Could be tightened later, but tight rather than loose is the safer direction for a build-context-everything-at-root setup.
- **Build context size** is now the full repo minus ignored paths; first build is slightly slower than `./backend`-only. Cached layers absorb this on rebuilds.
