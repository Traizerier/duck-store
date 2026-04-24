# stack-manager

Programmatic control plane for the duck-store compose stacks. Exposes the same lifecycle surface as `run.sh` (up / down / restart / logs / status / health) as an authenticated HTTP API, so tests, admin UIs, and external orchestration can drive the stacks without shelling out.

## Why

`run.sh` is the bash surface — fine for a terminal. The stack-manager is the programmatic surface — needed when you want:

- an admin dashboard that hits `POST /stacks/warehouse/restart`
- integration tests that stand up a fresh stack, exercise it, tear it down
- an external orchestrator treating each stack as a managed unit

Both surfaces read the same source of truth: `.env.*` files at the repo root.

## Run

```bash
bash run.sh cp up       # build + start the control plane (duckstore-control-plane project)
bash run.sh cp logs     # tail its logs
bash run.sh cp test     # run the test suite inside the container
bash run.sh cp down     # stop it
```

Default port: **4000** (override with `CONTROL_PLANE_HOST_PORT` in `.env.control-plane`).

## HTTP API

Every route except `GET /health` requires `Authorization: Bearer <CONTROL_PLANE_TOKEN>`.

| Method | Path                              | Purpose                                                  |
| ------ | --------------------------------- | -------------------------------------------------------- |
| GET    | `/health`                         | control plane's own liveness (no auth)                   |
| GET    | `/stacks`                         | list discovered stacks + per-stack metadata              |
| GET    | `/stacks/:name`                   | container status (state, ports) for one stack's services |
| POST   | `/stacks/:name/up`                | start the stack                                          |
| POST   | `/stacks/:name/down`              | stop + remove the stack                                  |
| POST   | `/stacks/:name/restart`           | bounce the stack                                         |
| GET    | `/stacks/:name/logs?tail=N`       | last N log lines (default 200, max 5000)                 |
| GET    | `/stacks/:name/health`            | proxies the stack backend's `/health`                    |

Errors:

| Status | Error name          | Meaning                                                                 |
| ------ | ------------------- | ----------------------------------------------------------------------- |
| 400    | InvalidStackName    | name didn't match `^[a-z0-9][a-z0-9-]{0,31}$`                           |
| 401    | Unauthorized        | missing or wrong bearer token                                           |
| 404    | UnknownStack        | name isn't in the discovered stacks list (no matching `.env.<name>`)    |
| 502    | ComposeError        | `docker compose` exited non-zero; `exitCode` is in the body             |
| 500    | InternalServerError | unexpected                                                              |

## Safety model

Two layers keep the control plane from touching containers it doesn't own:

1. **Discovery is the allowlist.** At init and before every lifecycle op, the manager reads `.env.*` at the repo root, excluding `.env`, `.env.example`, `.env.control-plane`, and any `*.local` overrides. Only those names are reachable.
2. **Every compose invocation is project-scoped.** `docker compose -p duckstore-<validated-name> --env-file .env.<validated-name> -f ... <cmd>`. There's no bare `docker compose` call anywhere — removing a `.env.<name>` file removes the stack from the allowlist, full stop.

Stack names are also regex-whitelisted (`^[a-z0-9][a-z0-9-]{0,31}$`), so a request like `GET /stacks/../../etc/passwd` hits the 400 branch before any filesystem or compose call is made.

## Layout

```
src/
├── errors.js               # InvalidStackNameError, UnknownStackError, ComposeError
├── validateStackName.js    # regex-backed isValidStackName + assertValidStackName
├── discoverStacks.js       # reads .env.* with denylist; parses KEY=VALUE lines
├── runCompose.js           # spawn('docker', ['compose', ...args]) wrapper
├── StackManager.js         # the library: list/status/up/down/restart/logs/health
├── auth.js                 # bearer middleware (timingSafeEqual)
├── server.js               # createApp({manager, token}) — Express routes + error mapper
└── main.js                 # entry point; wires env vars into StackManager + server
```

## Config

| Env var                  | Default                            | Used for                                                        |
| ------------------------ | ---------------------------------- | --------------------------------------------------------------- |
| `CONTROL_PLANE_TOKEN`    | *(required)*                       | bearer token for every non-`/health` route                      |
| `PORT`                   | `4000`                             | HTTP listen port                                                |
| `REPO_ROOT`              | `process.cwd()`                    | directory to read `.env.*` and invoke compose from              |
| `BACKEND_HOST`           | `localhost`                        | host the control plane uses to reach stack backends for `/health` proxying. In-container default is `host.docker.internal` (Docker Desktop). |

## Adding a stack

The control plane auto-discovers. Drop in `.env.frogs` at the repo root with the usual fields (`INSTANCE_NAME`, `FRONTEND_TITLE`, ports, DB name) and `GET /stacks` will include it on the next request. The same `.env.frogs` is what `run.sh` uses, so both surfaces stay in sync.

## Tests

79 tests across 6 files. Pure unit tests against mocked runners, plus supertest coverage of the HTTP routes:

```bash
bash run.sh cp test
```
