# P004: Structured logging conventions are declared but not implemented

**Proposed severity:** Medium
**Found by:** Consistency, Architecture, Error Handling
**Status:** Proposed
**Related to:** None

## Description
STANDARDS.md (Cross-cutting rules) requires "Structured, per-module, [logging] with levels VERBOSE/DEBUG/INFO/WARN/ERROR" and points at `docs/logging.md` for shared conventions. In practice:

- `docs/logging.md` does not exist.
- warehouse-service uses a bare `console.log` for startup and a bare `console.error(err)` in the error middleware — no level, no module tag, no structured fields.
- store-service uses stdlib `log.Printf` / `log.Fatal` — again no level, no structure.
- Neither service logs the offending value along with errors (standards: "An error message without the offending value is half-useless").

## Impact
Operational visibility doesn't match the declared standard. In particular, the Express error middleware swallows the request path, request id, and offending payload, so 500s are hard to attribute. Store-service shipping/pricing rules log nothing at all, which will hurt debugging once business logic starts changing.

## Affected Files
- `warehouse-service/src/app.js:19` (`console.error(err)` with no context)
- `warehouse-service/src/server.js:23` (`console.log` startup banner)
- `store-service/cmd/server/main.go:25-28` (`log.Printf`, `log.Fatal`)
- `docs/logging.md` — missing file referenced by STANDARDS.md

## Suggested Fix
- Write `docs/logging.md` defining level semantics, required fields (timestamp, level, service, module, requestId, error fields), and format (JSON vs keyval).
- In warehouse-service adopt a structured logger (pino is the low-friction choice) and replace both `console.*` call sites. The Express error handler should log method, path, status, and the error stack.
- In store-service switch to `log/slog` (stdlib) with per-module handlers, and log request method/path/status around the order handler.

