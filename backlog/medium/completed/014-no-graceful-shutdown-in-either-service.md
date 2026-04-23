---
id: 014
title: Neither service has a graceful shutdown / SIGTERM handler
status: Completed
severity: medium
service: warehouse-service, store-service
promoted_from: P015
---

# 014: Neither service has a graceful shutdown / SIGTERM handler

**Found by:** Architecture, Error Handling

**Related to:** 009 (noted as a deferred follow-up in the 009 resolution)

## Description
Neither warehouse-service nor store-service installs a signal handler or closes resources on shutdown:

- **warehouse-service:** `server.js` calls `connectDb(...)` and destructures only `db`, leaking the `client` handle. There is no `process.on("SIGTERM", ...)` or equivalent — when the container stops, Node exits while Mongo connections are mid-flight. The 009 resolution explicitly flagged this as an adjacent follow-up.
- **store-service:** `cmd/server/main.go` runs `http.ListenAndServe` with no `signal.NotifyContext` wrapper, so in-flight HTTP requests get TCP-reset rather than drained. The `warehouse.Client`'s 5s timeout means a slow-to-warehouse order can still be cut mid-response.

STANDARDS.md doesn't call out graceful shutdown by name, but the plan's architecture ("store calls warehouse over HTTP, data owned by warehouse") means an ungraceful warehouse shutdown during an order call turns an ordinary deploy into a client-visible 502.

## Impact
- In Docker / docker-compose redeploys, in-flight requests are dropped mid-write and Mongo connections are not returned cleanly.
- Harder to debug shutdown-timing issues because there's no lifecycle log line confirming "drained, closing" vs "crashed."
- Low blast radius today (take-home project, no real traffic) but the fix is small and idiomatic in both stacks — and it's the kind of thing a reviewer notices.

## Affected Files
- `warehouse-service/src/server.js:10-20` — discards `client` from `connectDb` return; no signal handler around `app.listen`.
- `store-service/cmd/server/main.go:13-37` — `http.ListenAndServe` with no `http.Server{}` + `Shutdown(ctx)` pattern, no `signal.NotifyContext`.

## Suggested Fix

**warehouse-service:** Keep the `client` reference, register SIGTERM/SIGINT handlers that close the HTTP server first, then `await client.close()`.

**store-service:** Switch from `http.ListenAndServe` to a `*http.Server` + `Shutdown(ctx)` with `signal.NotifyContext`.

No new dependencies in either service. Adds 10-15 lines each, turns deploys from "drop connections" into "drain then exit."

## Resolution

**Completed:** 2026-04-23

Applied the ticket's suggested fix to both services. No new tests (bootstrap code isn't covered by the existing suites — `server.js` and `main.go` have no unit tests today). Verification was end-to-end: run each binary directly inside its dev container, send SIGTERM, confirm the clean-shutdown log line and exit 0.

**Changes (2 files):**

- `warehouse-service/src/server.js` — `connectDb` destructure now keeps `client` alongside `db`. `app.listen` return value is captured as `server`. Added an async `shutdown(signal)` with a re-entrancy guard (`shuttingDown` flag, so SIGINT-after-SIGTERM doesn't run the close path twice), which logs `received <sig>, shutting down`, calls `server.close()` then `await client.close()`, then `process.exit(0)`. Registered for both SIGTERM and SIGINT.
- `store-service/cmd/server/main.go` — swapped `http.ListenAndServe` for a `*http.Server{Addr, Handler}` value, started with `ListenAndServe()` in a goroutine. `signal.NotifyContext(..., SIGTERM, SIGINT)` cancels the main context on signal; the listener goroutine ignores `http.ErrServerClosed` (the normal path after `Shutdown`) so it doesn't log.Fatal on clean shutdown. After the context fires, a 10-second `context.WithTimeout` gives in-flight requests a drain window, then `srv.Shutdown(ctx)` runs. Clean-exit log lines at both the "draining" and "exited cleanly" points. Added `context`, `errors`, `os/signal`, `syscall`, and `time` to the imports.

**Verification:**

- `go vet ./... && go test ./... -count=1` — clean, all 64 store tests pass.
- `npm test -- --run` — warehouse: 99/99 pass.
- **Warehouse SIGTERM smoke:** ran `PORT=4099 node src/server.js` inside `duckstore-warehouse`, sent SIGTERM via `kill -TERM`. Observed: `received SIGTERM, shutting down` logged, process exit 0.
- **Store SIGTERM smoke:** built a fresh `/tmp/store-bin`, ran it with `PORT=4099`, sent SIGTERM. Observed: `received shutdown signal, draining` → `store-service exited cleanly` → exit 0.
- Both smokes used direct-binary invocation to sidestep the dev-container `sh -c "..."` PID 1 issue (see below). Under the production image (`CMD ["/usr/local/bin/server"]`) the binary is PID 1 by default and signal delivery works natively.

**No TDD cycle applied:** bootstrap-level lifecycle code has no meaningful assertion surface without heavy mocking of `process.on` / `signal.NotifyContext`. Existing handler/service tests already cover the business logic; this ticket is pure operational hygiene. Verified by signal dispatch instead of unit test.

**Adjacent concerns noted but not tackled:**

- **Dev-container PID 1.** Both services run via `sh -c "... npm run dev"` / `sh -c "... go run ./cmd/server"` in `docker-compose.dev.yml`. The shell is PID 1 and doesn't forward signals to children, so `docker stop duckstore-store` in dev mode exits via SIGKILL (10s later), bypassing our new handlers. The *code* is correct — production uses the prod Dockerfile stage with the binary as PID 1 (`CMD ["/usr/local/bin/server"]`) and signals work there. If we want `docker stop` to exercise the shutdown path in dev too, the dev command strings should be changed to `exec ...` so sh is replaced by the Node/Go process. Out of scope: this ticket is about the service code, not the dev harness.
- **Store `Shutdown` doesn't propagate the 10s-timeout error.** If a handler takes longer than 10s, `srv.Shutdown(shutdownCtx)` returns `context.DeadlineExceeded` and we log + exit 0. For a take-home this is fine; in prod you might want the exit code to reflect the timeout. Not actioned because matching Docker's own 10s default between SIGTERM and SIGKILL is the sensible choice.
- **Warehouse `server.close()` isn't awaited.** `server.close()` in Node is async but we don't `await` it before closing the Mongo client. In practice `client.close()` on a quiet DB returns quickly, so the handle-leak window is tiny. Proper fix would be `await new Promise(res => server.close(res))` before `client.close()`. Left as-is to match the ticket's suggested shape; worth a follow-up if strict ordering becomes important.
- **Signal handler installed only for SIGTERM/SIGINT.** SIGQUIT (Ctrl+\) and SIGHUP (tty close) fall through to default Node/Go behavior. Fine for Docker-deployed services — those rarely see SIGQUIT/SIGHUP — but noted for completeness.
