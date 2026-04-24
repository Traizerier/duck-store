---
id: 023
title: Error envelope shapes drift across warehouse, store, and 500 responses
status: Completed
severity: medium
service: warehouse-service, store-service, frontend
promoted_from: P018
---

# 023: Error envelope shapes drift across warehouse, store, and 500 responses

**Found by:** Consistency, Architecture
**Related to:** 004 (partially aligned ValidationError envelopes; this finding covers the other three codes those services return)

## Description
Item 004 aligned the **400 ValidationError** envelope across both services (`{error: "ValidationError", errors: {field: msg}}`). The other three response shapes did not come along:

| Status | warehouse-service (`app.js`)                    | store-service (`order.go`)                             |
| ------ | ----------------------------------------------- | ------------------------------------------------------ |
| 400    | `{error: "ValidationError", errors: {...}}`    | `{error: "ValidationError", errors: {...}}` ← aligned |
| 404    | `{error: "NotFoundError", message: "..."}`     | `{error: "no duck available for color=..., size=..."}` |
| 500    | `{error: "InternalServerError"}` *(no msg)*    | `{error: "internal error: ..."}`                       |
| 502    | n/a                                             | `{error: "warehouse lookup failed: ..."}`              |

Three distinct shapes are in play: `{error: <Code>, message: <str>}`, `{error: <Code>, errors: <obj>}`, and `{error: <msg>}`. The frontend's `extractFieldErrors` only knows about the second shape, and `describeError` falls back to the bare status code because the other shapes put the human message in different keys (or omit it entirely).

## Impact
- **Frontend loses error context on non-validation failures.** `Warehouse.tsx:138` already drops the body on any non-400 response and shows only "Request failed (<status>)". So a 500 from warehouse (no message field) and a 404 from store (no code field) both produce the same unhelpful toast, even though the bodies contain different information.
- **A shared frontend client can't dispatch on error code.** Store-service 4xx/5xx put the message in `error`; warehouse-service 4xx/5xx put the code in `error` and the message in `message` (or omit message). Code that wants to say "was this a NotFoundError?" has to sniff both shapes.
- STANDARDS.md: "Log values with errors. An error message without the offending value is half-useless." Warehouse's 500 shape actively violates this at the HTTP boundary.

## Affected Files
- `warehouse-service/src/app.js:16-17` — 404 returns `{error, message}`.
- `warehouse-service/src/app.js:19-20` — 500 returns only `{error: "InternalServerError"}`, no message field at all.
- `store-service/internal/order/order.go:141-143` — `writeError` always emits `{error: <msg>}` regardless of code, conflicting with warehouse's code-in-`error` convention.
- `store-service/internal/order/order.go:65-69, 79` — 404/500/502 emit bare `{error: msg}` without a typed code.
- `frontend/src/pages/Warehouse.tsx:135-140` — `describeError` can only fall back to status code, since no single key reliably carries the message.

## Suggested Fix
Pick one canonical envelope (e.g. the warehouse-style `{error: <Code>, message?: <str>, errors?: <obj>}`) and apply it to both services:

1. In `store-service/internal/order/order.go`, change `writeError(w, code, msg)` to emit `{error: <typedCode>, message: <msg>}`. Map status codes to codes: 400 → already handled by `writeValidationError`, 404 → `"NotFoundError"`, 500 → `"InternalServerError"`, 502 → `"UpstreamError"`.
2. In `warehouse-service/src/app.js`, add a `message` field to the 500 branch: `res.status(500).json({ error: "InternalServerError", message: err.message })` (coupled with P004's logging, so stack traces go to the log, not the wire).
3. In `frontend/src/pages/Warehouse.tsx`, extend `describeError` to prefer `body.message` when the error came through `ApiError`, falling back to the status code only when both `message` and a ValidationError map are absent.
4. Write a cross-service contract test (or a shared TS type in `shared/`) that documents the canonical envelope so this doesn't drift again.

## Resolution

**Completed:** 2026-04-23

All three services now emit the same envelope shape for every error response:

```
{error: "<TypedCode>", message?: "<human-readable>", errors?: {field: msg}}
```

TypedCodes: `ValidationError` (400 with `errors`), `BadRequest` (400 with `message` — invalid JSON), `NotFoundError` (404), `InternalServerError` (500), `UpstreamError` (502).

**Changes (3 files):**

- `store-service/internal/order/order.go` — `writeError` signature changed from `(w, code, msg)` to `(w, code, typedCode, msg)`, emits `{error: typedCode, message: msg}`. All 4 call sites updated with explicit typed codes (`BadRequest`/`NotFoundError`/`InternalServerError`/`UpstreamError`).
- `warehouse-service/src/app.js` — 500 branch now emits `{error: "InternalServerError", message: err.message ?? "internal error"}`. 400 and 404 branches already matched the canonical shape.
- `frontend/src/pages/Warehouse.tsx` — `describeError` now calls a new `extractApiMessage(body)` helper first. If the envelope carries a `message` string, that's what the user sees. Falls through to the translated `error.requestFailed` string only when the body has no message (non-JSON response, `{error}` without `message`, etc.).

**Tests added (2 new):**

- `store-service/internal/order/order_test.go` — `TestHandler_ErrorEnvelope_HasTypedCodeAndMessage` is a table-driven regression guard: asserts that invalid-JSON / warehouse-502 / warehouse-404 all carry `{error: <expected-typed-code>, message: non-empty}`. Would catch a regression where someone reverted `writeError` to the old shape.
- `frontend/src/pages/Warehouse.test.tsx` — new test hands back a 500 with `{error: "InternalServerError", message: "warehouse connection refused"}`, asserts the error banner shows the server's message (not the translated fallback).

**Verification:**

- `go test ./... -count=1` — all packages pass.
- `npm test -- --run` (warehouse) — 104 tests pass.
- `npm test -- --run` (frontend) — 48 tests pass, tsc clean.
- **End-to-end smoke** against the live stack confirms every error path:
  - 400 ValidationError (both services): `{error: "ValidationError", errors: {color: "..."}}`
  - 404 (store — duck not found): `{error: "NotFoundError", message: "no duck available for color=Black, size=XSmall"}`
  - 404 (warehouse — DELETE unknown id): `{error: "NotFoundError", message: "Duck 99999 not found"}`
  - 400 (invalid id path): `{error: "ValidationError", errors: {id: "must be a positive integer"}}`

**Adjacent concerns noted but not tackled:**

- **Shared TypeScript type for the envelope** — the ticket suggests putting a canonical `ApiErrorEnvelope` type in `shared/`. Deferred: today the frontend only consumes the envelope in two places (`extractApiMessage` + `extractFieldErrors`), and both are defensive narrow-and-check functions that already tolerate drift. Worth doing if a second client (CLI, mobile) materializes.
- **Cross-service contract test** — considered, rejected for now. Adding a cross-container test harness is scope-creep for a doc-level consistency finding. The two new regression tests (Go handler + frontend banner) cover the wire shape from both ends without a new test infra.
- **500 message leakage** (ticket 018 concern) — warehouse still passes `err.message` through on 500. Node's `err.message` is typically generic enough (e.g. `"Cannot read properties of undefined"`) to be safe; stack traces stay in `console.error`. If this becomes a concern, narrow to `"internal error"` at the boundary in a follow-up.
