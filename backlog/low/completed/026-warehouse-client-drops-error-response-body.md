---
id: 026
title: warehouse.Client.LookupPrice drops warehouse error body on non-200/404 responses
status: Completed
severity: low
service: store-service
promoted_from: P021
---

# 026: `warehouse.Client.LookupPrice` drops the warehouse error body on non-200/404 responses

**Found by:** Error Handling
**Related to:** 008 (aligned 404-from-warehouse handling; this covers the remaining non-2xx path)

## Description
In `store-service/internal/warehouse/client.go:54-56`, any response that isn't `200` or `404` produces an error whose only context is the numeric status code:

```go
if resp.StatusCode != http.StatusOK {
    return 0, fmt.Errorf("warehouse returned status %d", resp.StatusCode)
}
```

But warehouse-service replies with a structured body on 400 and 500 (`{error: "ValidationError", errors: {...}}` or `{error: "InternalServerError"}` — see P018). The Go client reads none of it; the body is discarded via the `defer resp.Body.Close()` without being decoded, so the order handler's upstream diagnostic is reduced to `"warehouse lookup failed: warehouse returned status 400"`.

## Impact
- **Debugging suffers.** A 400 from warehouse on `/api/ducks/lookup` means the color/size failed enum validation upstream (possible after `shared/enums.json` drifts between deploy generations). Without the body, on-call sees "status 400" and has to curl warehouse manually to find the field and message.
- **STANDARDS.md rule "Log values with errors" applies to upstream errors too.** The warehouse already packaged the offending value into the response; swallowing it defeats the structured-envelope work done in items 004/011.
- Client surfaces `502 warehouse lookup failed` for a warehouse 400 that's almost certainly caused by a bad request *to store-service*, which is misleading.

## Affected Files
- `store-service/internal/warehouse/client.go:54-56` — non-200 branch discards body.

## Suggested Fix
Read the body (capped at a small byte limit to avoid accidentally pulling a huge payload), and include a trimmed snippet in the error:

```go
if resp.StatusCode != http.StatusOK {
    body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
    return 0, fmt.Errorf("warehouse returned status %d: %s", resp.StatusCode, bytes.TrimSpace(body))
}
```

The existing `client_test.go` already has a non-200 case; extend it to assert the error message contains the mocked body snippet. Bonus: once P018 lands, the client can decode the canonical envelope and expose a typed error for 400s (analogous to `ErrDuckNotFound`) so the order handler can map upstream 400 to a 4xx to the client instead of a 502.

## Resolution

**Completed:** 2026-04-23

Applied the suggested fix verbatim — non-200 branch now reads up to 1 KiB of the upstream body via `io.LimitReader` and includes a trimmed snippet in the returned error.

**Changes (2 files):**

- `store-service/internal/warehouse/client.go` — added `bytes` + `io` imports. Non-200 branch reads a bounded body snippet and formats `"warehouse returned status %d: %s"` when the body is non-empty, falling back to the status-only message when it is. 404 path unchanged.
- `store-service/internal/warehouse/client_test.go` — new `TestClient_LookupPrice_IncludesErrorBody` test: mock server returns 400 + a ValidationError JSON body, asserts the error message contains both the status code and `"ValidationError"` substring.

**Verification:**

- `go test ./internal/warehouse/... -count=1` — clean, includes the new test.
- `go vet ./...` — clean (bytes/io imports used correctly).

**Adjacent concerns noted but not tackled:**

- **Typed upstream error** (ticket's "bonus" suggestion) — holding off. With ticket 023's canonical envelope in place, the future typed-error route is `decode body as {error: TypedCode} → switch on code → return typed error`. That's worth a dedicated ticket if a second upstream status (e.g. 400) needs distinct handling in the order pipeline. Today all non-404/non-200 still flow to 502 at the order boundary, which is the right behavior.
