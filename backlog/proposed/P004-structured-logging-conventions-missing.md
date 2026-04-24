# P004: Structured logging conventions are declared but not implemented

**Proposed severity:** Medium
**Found by:** Consistency, Architecture, Error Handling
**Status:** Proposed
**Related to:** P043 (narrower scope — specific context fields on the error middleware + boot-time `await` guards). P004 is the broader "adopt a structured logger + write the missing conventions doc" follow-up. File-path references updated 2026-04 to match the post-pivot layout (`backend/` instead of the deleted `warehouse-service/` + `store-service/`).

## Description

[STANDARDS.md](.claude/audit-standards/STANDARDS.md) (Cross-cutting rules) requires *"Structured, per-module, [logging] with levels VERBOSE/DEBUG/INFO/WARN/ERROR"* and points at `docs/logging.md` for shared conventions. In practice:

- `docs/logging.md` does not exist.
- [backend/src/app.js:30](backend/src/app.js#L30) uses a bare `console.error(err)` on the 500 path — no level, no module tag, no structured fields. `_req` is explicitly discarded with an underscore, so the log line carries zero request context.
- [backend/src/server.js:54](backend/src/server.js#L54) and [backend/src/server.js:60-62](backend/src/server.js#L60-L62) use plain `console.log` for the service-init loop and the boot banner.
- Neither call site logs the offending value along with errors (standards: *"An error message without the offending value is half-useless"*).

The Go `store-service` bullet in the earlier draft of this ticket no longer applies — that directory was deleted in the 2026-04 pivot. The problem is now entirely in the Node backend.

## Impact

Operational visibility doesn't match the declared standard. Concretely:

- The Express error middleware swallows request path, method, body, and instance label, so 500s are hard to attribute. With the same image deployed as two stacks (warehouse + store), the `INSTANCE` env is the only way to tell whose backend logged a given error — and the current middleware doesn't include it.
- The boot banner at [backend/src/server.js:60-62](backend/src/server.js#L60-L62) *does* include the instance name, schema name, and DB — nice for success paths, but any boot failure (schema parse error, Mongo connect timeout) falls through to Node's default unhandled-rejection handler, which prints a stack trace with none of the env context that would make it diagnosable.
- Backend business logic (packaging, pricing, order pipeline) has no logging at all. Once rules start changing — new country tax rates, new shipping modes — the absence of traceable rule-decision logs will hurt debugging.

## Affected Files

- [backend/src/app.js:30](backend/src/app.js#L30) — `console.error(err)` with no request context.
- [backend/src/app.js:23](backend/src/app.js#L23) — middleware signature discards `_req`.
- [backend/src/server.js:54](backend/src/server.js#L54) — `console.log` init banner for each registered service.
- [backend/src/server.js:60-62](backend/src/server.js#L60-L62) — `console.log` startup banner.
- [backend/src/server.js:71](backend/src/server.js#L71) — shutdown signal log.
- `docs/logging.md` — missing file referenced by [STANDARDS.md](.claude/audit-standards/STANDARDS.md).

## Suggested Fix

Two layers; land P043 first (narrower, zero new deps) and then use this ticket for the broader logger-adoption work:

1. **P043 lands the context fields with plain `console.error`.** That resolves the immediate "500s have no request context" and "boot failures have no env context" complaints without introducing a dependency.

2. **P004 (this ticket) then adopts a structured logger.** Recommend [pino](https://getpino.io) — zero-config JSON logging, 1000x the throughput of `console.*` for prod, child-logger pattern for per-module tags. Replace the remaining `console.*` sites:
   - `pino` root logger in `backend/src/log.js`, injected via container or imported at the top of each module. Child loggers per module (`log.child({ module: "inventory" })`).
   - Middleware: `log.error({ req, err, instance: process.env.INSTANCE }, "request failed")`.
   - Startup: `log.info({ instance, schema, db, port }, "backend listening")`.
   - Order pipeline: `log.debug({ rule, context, amount }, "pricing rule")` at each pricing step — the `details[]` array in the order response already captures this; making it a log too lets prod debugging tie a trace back to the request.

3. **Write `docs/logging.md`** defining:
   - Level semantics (VERBOSE/DEBUG/INFO/WARN/ERROR).
   - Required fields on every line (timestamp, level, instance, module, reqId-when-applicable).
   - Error-line contract: always log the offending value alongside the error object.
   - Format: JSON in prod (`pino` default), pretty in dev (`pino-pretty` as a dev dep).

If pino feels heavyweight, `console.*` with a small `log()` helper that adds `{level, timestamp, instance, module, ...}` is an acceptable step 1 — the shape matters more than the library. Step 3 (the conventions doc) is load-bearing either way, since STANDARDS.md currently cites a file that doesn't exist.
