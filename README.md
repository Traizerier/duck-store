# Duck Store

Microservices implementation of the rubber duck warehouse & store. See [docs/plan.md](docs/plan.md) for the architecture and implementation plan.

## Prerequisites

- **bash** — required to run `setup.sh` / `run.sh`. On Windows, use **Git Bash** or **WSL**.
- **Node.js ≥ 20** and **npm** — for `backend/` and `frontend/`.
- **Docker + docker compose** — for MongoDB and containerized dev mode.

## Quickstart

```bash
bash setup.sh     # verify prereqs + install all dependencies + seed .env files
bash run.sh up    # bring up both stacks (warehouse + store) in the background
```

On Windows you can also double-click `setup.bat` / `run.bat`, which call the bash scripts via Git Bash.

Use `bash run.sh down` to stop everything cleanly.

### Configuration

The project runs as **two independent compose stacks** (warehouse, store). Each stack is a `{mongo, backend, frontend}` trio with its own network, volume, and lifecycle. Same template (`docker-compose.yml`), parameterized per stack via `.env.<stack>`.

| Scope            | File              | Used for                                                                                              |
| ---------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| Per-stack        | `.env.<stack>`    | Variable substitution in `docker-compose.yml` — instance name, host ports, DB name, frontend title.   |
| In-container     | `environment:` in compose | Runtime overrides inside containers — swaps `localhost` URLs for compose service names.       |

`.env.warehouse` and `.env.store` are checked in — they hold non-secret config (instance name, host ports, DB name, frontend title), and having them tracked is what makes a clean clone + `bash run.sh up` work without a seeding step. `.env.example` shows the shape for a new stack. Real secrets (DB passwords, API keys) belong in an untracked `.env.<stack>.local` override — those ARE gitignored.

**Example — changing the warehouse host ports:**

1. Edit `.env.warehouse`: `BACKEND_HOST_PORT=5001`, `FRONTEND_HOST_PORT=5173`.
2. `bash run.sh down warehouse && bash run.sh up warehouse` — now exposed on the new ports.
3. Container-internal ports stay fixed (backend `:4001`, frontend `:5173`), so inter-container URLs (`http://backend:4001`) don't change.

For **true secrets** (DB passwords, API keys), keep them in `.env.<stack>.local` (gitignored) and reference as `${VAR}` in compose. If you need stronger guarantees (at-rest encryption, non-env delivery), Docker Compose's `secrets:` block is the upgrade path — we haven't needed it yet.

### Dev workflow

`run.sh` wraps `docker compose` so you always see what's happening — and orchestrates both stacks. Each stack is a separate compose project (`duckstore-warehouse`, `duckstore-store`) with no cross-stack DNS or data.

```bash
bash run.sh up [stack...]         # start stacks in the background (default: both)
bash run.sh foreground <stack>    # start one stack attached; Ctrl+C stops it
bash run.sh down [stack...]       # stop + remove stacks (default: both)
bash run.sh ps                    # show containers per stack
bash run.sh logs [stack]          # tail logs (all stacks multiplexed, or one stack)
bash run.sh shell <stack> [svc]   # bash inside a running container (default svc: backend)
bash run.sh test  <stack> [svc]   # run test suite inside the container
bash run.sh help                  # full command reference
```

Each container's startup command installs deps, prints a ready banner, then idles — so the container stays alive and you start the dev server / tests yourself. Dep-install output is visible right in the terminal running `run.sh`; no hidden VS Code popups.

**Editing in a container:** start containers with `run.sh`, then in VS Code: `Ctrl+Shift+P` → **"Dev Containers: Attach to Running Container"** → pick the container. No lifecycle magic — you're just attaching an editor to what compose already started.

**Running the built prod images instead of bind-mounted dev:**

Drop the dev override — `run.sh` layers both `docker-compose.yml` + `docker-compose.dev.yml`; invoking compose without the dev override picks the prod Dockerfile:

```bash
docker compose -p duckstore-warehouse --env-file .env.warehouse -f docker-compose.yml up -d --build
docker compose -p duckstore-store     --env-file .env.store     -f docker-compose.yml up -d --build
```

## Project layout

| Path                | Stack                       | Holds                                                        |
| ------------------- | --------------------------- | ------------------------------------------------------------ |
| `backend/`          | Node + Express + MongoDB    | schema-driven inventory service + order pipeline (packaging + pricing). Same image deployed twice — once as the warehouse instance, once as the store instance. |
| `backend/src/schemas/` | JSON                     | entity-type definitions. `duck.json` is today's only schema; each schema instantiates a full CRUD surface at `/api/{plural}`. |
| `frontend/`         | React + Vite + TypeScript   | Single-page inventory UI, typed `ServiceContainer`, active-record `Duck` model, bilingual i18n. Per-stack branding via `VITE_TITLE`. |
| `stack-manager/`    | Node + Express              | control-plane HTTP API. Discovers stacks from `.env.*`, orchestrates them via docker compose. Bearer-token auth. Not a managed stack — sits alongside. |
| `shared/enums.json` | JSON                        | single source of truth for color/size enums; schemas reference entries by name. |
| `docs/`             | markdown                    | `plan.md`, `assumptions.md`.                                 |
| `backlog/`          | markdown                    | per-severity tickets (active + completed).                   |
| `.claude/`          | config                      | agents, skills, audit standards.                             |

### Control plane

`stack-manager/` is a small Express service that exposes the stack-lifecycle surface programmatically. Start it with `bash run.sh cp up` (port 4000 by default). Everything except `/health` requires a bearer token — see `.env.control-plane`.

```
GET    /health                       liveness probe (no auth)
GET    /stacks                       list discovered stacks + metadata
GET    /stacks/:name                 container status for one stack
POST   /stacks/:name/up              start it
POST   /stacks/:name/down            stop it
POST   /stacks/:name/restart         bounce it
GET    /stacks/:name/logs?tail=N     recent logs (default N=200, max 5000)
GET    /stacks/:name/health          proxy the stack's backend /health
```

Safety: the manager only touches stacks it discovered from `.env.*` at the repo root (excluding `.env`, `.env.example`, `.env.control-plane`, and any `*.local` overrides). Stack names must match `^[a-z0-9][a-z0-9-]{0,31}$`, so there's no way to shell-inject into the `docker compose -p duckstore-<name>` invocation.

## Scripts

- `setup.sh` — verifies tools against [`.tool-versions`](.tool-versions), auto-installs via winget/brew if missing, installs all per-service deps. Idempotent.
- `run.sh` — orchestrates one compose project per stack (`duckstore-warehouse`, `duckstore-store`). Each stack is an independent `{mongo, backend, frontend}` trio. See `bash run.sh help`.
- `update.sh` — reports installed-vs-required for system tools, offers to upgrade (winget/brew), and reports outdated npm deps per service.

Windows users can double-click `setup.bat` / `run.bat` / `update.bat` as equivalents.

## Versioning

[`.tool-versions`](.tool-versions) is the source of truth for required tool versions. It's compatible with `asdf`/`mise` (which will install that major automatically) and is read by `setup.sh` as a minimum floor.

To bump a version:
1. Edit `.tool-versions` (e.g., `node 20` → `node 22`).
2. Run `bash update.sh` to upgrade installed tools to match.
3. Restart your terminal so the new versions are on PATH.
4. Commit `.tool-versions` so collaborators get the same floor.

Per-service dependencies (`package.json`) are managed by their own tools — `update.sh` reports outdated ones but does not auto-update, so you can review breaking changes before committing.

## Development workflow

TDD (red → green → refactor). See [`.claude/skills/tdd/SKILL.md`](.claude/skills/tdd/SKILL.md) for the enforced cycle.
