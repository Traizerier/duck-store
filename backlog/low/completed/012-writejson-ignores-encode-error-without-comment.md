---
id: 012
title: writeJSON discards json.NewEncoder(...).Encode error without comment
status: Completed
severity: low
service: store-service
promoted_from: P013
---

# 012: `writeJSON` discards `json.NewEncoder(...).Encode` error without comment

**Found by:** Error Handling

## Description
In `store-service/internal/order/order.go`, `writeJSON` ignores the encoding error with a blank assignment and no explanation:

```go
func writeJSON(w http.ResponseWriter, code int, body any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    _ = json.NewEncoder(w).Encode(body)
}
```

STANDARDS.md (store-service): "`if err != nil { return ..., err }`. … **Never ignore an error without a comment explaining why.**" The `_ =` here is exactly the pattern the standard forbids — it swallows a real failure mode (client disconnect mid-write, broken pipe) without acknowledging the choice.

## Impact
In practice the error is genuinely un-returnable here (the handler has already written headers and the response body is a stream). That's a fine reason to drop it — but the rule is that the *reason* must be a comment, not implicit. Without the comment, a reader can't tell "this was considered" from "the author forgot." Also, swallowing silently means we never see encode failures in logs — even VERBOSE/DEBUG level would be useful once structured logging lands (see P004).

## Affected Files
- `store-service/internal/order/order.go:163-167` — `writeJSON` swallows `Encode` error.

## Suggested Fix
Add a one-line comment explaining why the error is dropped here, and optionally log at DEBUG once structured logging exists:

```go
func writeJSON(w http.ResponseWriter, code int, body any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    // Encode errors here are post-header; we can't change the status anymore.
    // Log at DEBUG so we see them in dev, but don't attempt recovery.
    if err := json.NewEncoder(w).Encode(body); err != nil {
        // TODO: replace with slog.DebugContext once docs/logging.md lands (P004)
        _ = err
    }
}
```

The minimum acceptable fix is just the explanatory comment — that satisfies the standard. The logging piece is incremental and depends on P004.

## Resolution

**Completed:** 2026-04-23

Took the ticket's middle path: upgraded the bare `_ = json.NewEncoder(w).Encode(body)` to an explicit `if err := ...; err != nil { _ = err }` branch with a multi-line comment explaining *why* the error is dropped. Not a behavior change — the error is still discarded — but the intent is now visible next to the code and there's a natural slot for the future DEBUG log once structured logging (ticket 004) exists.

**Changes (1 file):**

- `store-service/internal/order/order.go` — `writeJSON` now uses the `if err := ...; err != nil` pattern. Comment covers three points: (1) why we can't propagate the error (status is already committed to the wire), (2) why we can't recover (second Write would corrupt the body), (3) where the DEBUG log will go when ticket 004 lands.

**Verification:**

- `go test ./...` — all 64 store-service tests still pass (no new tests — this is a no-behavior-change cleanup).
- `go vet ./...` — clean, no warnings about the empty-ish branch.

**Test count:** unchanged (64).

**No TDD cycle applied:** this ticket is explicitly a comment-only change per its own "minimum acceptable fix." No new assertions to drive, no RED state possible. Ran the existing suite after the edit to confirm no regression.

**Adjacent concerns noted but not tackled:**

- **DEBUG log for post-header encode failures.** Deferred to ticket 004 as the ticket itself proposes. The comment now serves as a pointer so whoever works 004 doesn't have to rediscover this site.
- **Other `_ =` call sites across the Go code.** Quick `grep -n "_ =" store-service/` turns up a couple of test-file ignores (`_, _ = w.Write(...)` in `httptest` handlers) which are fine — test-server handlers don't meaningfully fail. No production `_ =` without a comment remains in the service after this edit.
