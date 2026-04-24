---
id: 018
title: order.Handler 500 response leaks internal error detail to the client
status: Completed
severity: low
service: store-service
promoted_from: P026
---

# 018: `order.Handler` 500 response leaks internal error detail to the client

**Found by:** Error Handling
**Related to:** P018 (error-envelope shape drift — both touch the same `writeError` code path; this is specifically about the `msg` payload, not the envelope shape)

## Description
`store-service/internal/order/order.go:160-162` handles the `ErrInternal` branch:

```go
case errors.Is(err, ErrInternal):
    writeError(w, http.StatusInternalServerError,
        "internal error: "+err.Error())
```

`ErrInternal` is the sentinel returned by `Process` when validation and packaging disagree — i.e. a server-side bug (the comment on `ErrInternal` calls it out: *"a server-side bug, not a client input problem"*). The branch then returns `err.Error()` verbatim in the response body. A client hitting this path sees something like:

```json
{"error": "internal error: internal error: packaging.Build: unknown size \"Huge\""}
```

The 502 branch has the same shape (`"warehouse lookup failed: "+err.Error()`, line 164-165) but 502 at least contains useful upstream context for a legitimate client retry. The 500 case is never retryable and the only audience for the message is the operator — who should be reading logs, not the response body.

STANDARDS.md (Error handling, all services): "Log values with errors. An error message without the offending value is half-useless." The paired requirement — don't leak those values *to the client* — is implicit in the "HTTP boundary validation only" principle and the general industry practice around 500s, but isn't contradicted by STANDARDS.md.

## Impact
- Minor information leak. `err.Error()` here contains the raw size string from the drift case, which isn't sensitive on this project but in a hardened service would be where PII or pricing internals could surface.
- Double-prefixed message: `Process` wraps with `"%w: %s"` producing `"internal error: ..."`, then the handler prepends `"internal error: "` again, yielding `"internal error: internal error: ..."`. Not broken, but noisy.
- Once structured logging lands (P004), the natural home for this detail is a log record — the response body should just say the event happened and offer a correlation id.

## Affected Files
- `store-service/internal/order/order.go:160-162` — 500 branch that echoes `err.Error()`.
- `store-service/internal/order/order.go:163-165` — 502 branch with the same pattern (less severe; document rationale or trim the upstream detail).
- `store-service/internal/order/order.go:89` — `ErrInternal` sentinel that produces the doubled prefix.

## Suggested Fix
Split "what the caller sees" from "what we log":

```go
case errors.Is(err, ErrInternal):
    // TODO(P004): log err with a correlation id
    writeError(w, http.StatusInternalServerError, "internal error")
```

And drop the `"internal error: %s"` prefix in the `Process` wrap since the handler already owns the client-facing label:

```go
return Response{}, fmt.Errorf("%w: %s", ErrInternal, err.Error())
// stays as-is; ErrInternal.Error() is "internal error" so the double prefix
// only appears when the handler also prepends — pick one side.
```

A single-line fix (drop `": "+err.Error()` from the handler) is enough to close the leak today. The logging half hooks up cleanly once P004 lands.

## Resolution

**Completed:** 2026-04-23

The 500 response body is now a flat `{"error": "internal error"}`. The detail is not lost — ticket 020 (Go BaseService option 3) landed alongside this one and routes the dropped detail into a server-side `log.Printf` tagged with the service's `Name()`. The "log the detail server-side" TODO that this ticket deferred to P004 is therefore already satisfied on the un-structured side; P004 will lift the `log.Printf` into `slog`.

**Changes (1 file):**

- `store-service/internal/order/order.go` — `ErrInternal` branch no longer appends `err.Error()` to the response body. Comment names the reason (500 is not client-actionable) and points to the paired log in the same branch. The doubled `"internal error: internal error: ..."` message is gone as a side effect.

**Verification:**

- `go test ./... -count=1` — 64 subtests pass. `TestHandler_500WhenPackagingRejectsValidatedSize` asserts status only, so no test-body edits were needed.
- End-to-end smoke (drifted-enum scenario): response body is now `{"error":"internal error"}` while the server log line shows `[order] internal error: ...` with the full cause.

**Adjacent concerns noted but not tackled:**

- **502 branch** (`"warehouse lookup failed: "+err.Error()`) still includes the upstream error text. That's a legitimate trade-off: on a 502 the client *can* retry, and the upstream context is useful. Not touched — the ticket explicitly called this out as lower severity than the 500 case.
- **Structured-logger migration** is still P004's job. The current `log.Printf("[%s] internal error: %v", s.Name(), err)` is stdlib-only, which P004 will lift into slog without shape churn.
