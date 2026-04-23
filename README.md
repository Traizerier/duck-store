# Duck Store

Microservices implementation of the rubber duck warehouse & store. See [docs/plan.md](docs/plan.md) for the architecture and implementation plan.

## Prerequisites

- **bash** — required to run `setup.sh` / `run.sh`. On Windows, use **Git Bash** or **WSL**.
- **Node.js ≥ 20** and **npm** — for `warehouse-service` and `frontend`.
- **Go ≥ 1.21** — for `store-service` (optional until you start on that service).
- **Docker + docker compose** — for MongoDB (optional if you run Mongo yourself).

## Quickstart

```bash
bash setup.sh   # verify prereqs + install all dependencies + seed .env files
bash run.sh     # start MongoDB + all services in dev mode
```

On Windows you can also double-click `setup.bat` / `run.bat`, which call the bash scripts via Git Bash.

Press **Ctrl+C** in the `run.sh` terminal to stop everything cleanly.

### Configuration

Three config scopes, by layer:

| Scope                  | File                    | Used for                                                                                         |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| Compose                | `.env` (repo root)      | Variable substitution in `docker-compose.yml` / `docker-compose.dev.yml` — host ports, DB name, future auth creds. |
| Service (host mode)    | `<service>/.env`        | What each app reads via `process.env` / `os.Getenv` when running on the host (e.g. via `run.sh`). |
| Service (container)    | `environment:` in compose | Overrides service `.env` in containers — swaps `localhost` URLs for compose service names.      |

All three start from `.env.example` files; `setup.sh` copies them for you. Never commit actual `.env` files — they're gitignored.

**Example — changing the warehouse host port:**

1. Edit root `.env`: `WAREHOUSE_HOST_PORT=5001`
2. `docker compose down && docker compose up` — now exposed on `localhost:5001`.
3. Container-internal port stays 4001, so inter-service URLs (`http://warehouse:4001`) don't change.

For **true secrets** (DB passwords, API keys), the pattern extends naturally: add `MONGO_PASSWORD=` to root `.env`, reference as `${MONGO_PASSWORD}` in compose, keep the actual `.env` off git. If you need stronger guarantees (at-rest encryption, non-env delivery), Docker Compose's `secrets:` block is the upgrade path — we haven't needed it yet.

### Dev workflow

Lifecycle is explicit — `run.sh` wraps `docker compose` so you always see what's happening (and where it failed).

```bash
bash run.sh              # foreground: brings up mongo + warehouse, streams logs
bash run.sh detached     # background variant; returns to your prompt
bash run.sh ps           # what's running
bash run.sh logs [svc]   # tail logs
bash run.sh shell [svc]  # bash inside a running container
bash run.sh test  [svc]  # run tests inside the container
bash run.sh down         # stop everything
bash run.sh help         # full command reference
```

Each container's startup command installs deps, prints a ready banner, then idles on `tail -f /dev/null` — so the container stays alive and you start the dev server / tests yourself. Dep-install output is visible right in the terminal running `run.sh`; no hidden VS Code popups.

**Editing in a container:** start containers with `run.sh`, then in VS Code: `Ctrl+Shift+P` → **"Dev Containers: Attach to Running Container"** → pick the container. No lifecycle magic — you're just attaching an editor to what compose already started.

(There are also per-service `.devcontainer/devcontainer.json` files, but the recommended flow is explicit `run.sh` + Attach to Running Container. "Reopen in Container" still works if you prefer it.)

**Running the built prod images instead of bind-mounted dev:**

```bash
docker compose --profile full up --build   # mongo + warehouse + store, prod Dockerfiles
docker compose --profile full down
```

## Project layout

| Path                | Stack                       | Status    |
| ------------------- | --------------------------- | --------- |
| `warehouse-service/`| Node + Express + MongoDB    | scaffolding |
| `store-service/`    | Go                          | scaffolding |
| `frontend/`         | React + Vite + TypeScript   | not started |
| `docs/`             | plan, conventions, assumptions | —      |
| `.claude/`          | agent/skill config          | —         |

## Scripts

- `setup.sh` — verifies tools against [`.tool-versions`](.tool-versions), auto-installs via winget/brew if missing, installs all per-service deps. Idempotent.
- `run.sh` — starts Mongo via docker compose, then each service's dev mode in parallel.
- `update.sh` — reports installed-vs-required for system tools, offers to upgrade (winget/brew), and reports outdated npm/Go deps per service.

Windows users can double-click `setup.bat` / `run.bat` / `update.bat` as equivalents.

## Versioning

[`.tool-versions`](.tool-versions) is the source of truth for required tool versions. It's compatible with `asdf`/`mise` (which will install that major automatically) and is read by `setup.sh` as a minimum floor.

To bump a version:
1. Edit `.tool-versions` (e.g., `node 20` → `node 22`).
2. Run `bash update.sh` to upgrade installed tools to match.
3. Restart your terminal so the new versions are on PATH.
4. Commit `.tool-versions` so collaborators get the same floor.

Per-service dependencies (`package.json` / `go.mod`) are managed by their own tools — `update.sh` reports outdated ones but does not auto-update, so you can review breaking changes before committing.

## Development workflow

TDD (red → green → refactor). See [`.claude/skills/tdd/SKILL.md`](.claude/skills/tdd/SKILL.md) for the enforced cycle.
