---
id: 008
title: Warehouse 404 on lookup is surfaced to clients as 502 Bad Gateway
status: Completed
severity: low
service: store-service
promoted_from: P009
---

# 008: Warehouse 404 on lookup is surfaced to clients as 502 Bad Gateway

**Found by:** Error Handling

## Description
When `/api/orders` is called with a color+size combination that doesn't exist in the warehouse, the warehouse client returns a plain `error` with no typing (`client.go:44-46`). The order handler maps any error from `LookupPrice` to HTTP 502 (`order.go:49-52`). So a client request for a nonexistent duck — a client-side validation problem — comes back as "502 Bad Gateway: warehouse lookup failed: no duck found for color=X, size=Y".

This contradicts `docs/assumptions.md` which states warehouse lookup failures are 502 only because they're "upstream service fault, not client's fault." A 404 from the warehouse is not an upstream fault — the warehouse answered correctly.

## Impact
- Misleading status code for monitoring/alerting — a 502 on this endpoint will page an on-call engineer when there's nothing wrong upstream.
- Confusing to API consumers: they can't distinguish "my input was invalid" (should be 400 or 404) from "warehouse is down" (502).

## Affected Files
- `store-service/internal/warehouse/client.go:44-46` (404 collapsed into generic error)
- `store-service/internal/order/order.go:48-52` (all client errors → 502)

## Suggested Fix
Introduce a typed error in the `warehouse` package — `var ErrDuckNotFound = errors.New("duck not found")` — and return it from `LookupPrice` when the response status is 404. In the order handler, `errors.Is(err, warehouse.ErrDuckNotFound)` → return 404 with a clear message; every other error stays as 502. Add an order-handler test for the 404 pathway.

## Resolution

**Completed:** 2026-04-23

Implemented exactly as suggested — typed sentinel in the warehouse package, `%w`-wrapped on 404, order handler dispatches via `errors.Is`.

**Changes (2 files):**

- `store-service/internal/warehouse/client.go` — added `var ErrDuckNotFound = errors.New("duck not found")` with a comment explaining its role in the 404-vs-502 split. The 404 branch in `LookupPrice` now returns `fmt.Errorf("color=%s, size=%s: %w", color, size, ErrDuckNotFound)` so the color/size context is preserved for logs while `errors.Is` still matches.
- `store-service/internal/order/order.go` — added `errors` and `warehouse` imports. Before the existing 502 fallback, the handler now checks `errors.Is(err, warehouse.ErrDuckNotFound)` and emits `404 {"error":"no duck available for color=X, size=Y"}`. Comment on the branch names the reason (warehouse answered correctly — not an upstream fault).

**Tests added (3 new + 1 enhanced):**

- `warehouse/client_test.go`:
  - `TestClient_LookupPrice_NotFound` — enhanced to assert `errors.Is(err, ErrDuckNotFound)` (was just a nil-check before, which would pass against any error).
  - `TestClient_LookupPrice_ServerError_IsNotDuckNotFound` (new) — guards against over-broad matching; a 500 must not classify as `ErrDuckNotFound` or the handler would incorrectly 404 on legitimate upstream faults.
- `order/order_test.go`:
  - `TestHandler_WarehouseDuckNotFound_ReturnsNotFound` (new) — fakeWarehouse returns `warehouse.ErrDuckNotFound` directly; asserts 404 and a non-empty `error` message.
  - `TestHandler_WrappedDuckNotFound_StillReturnsNotFound` (new) — fakeWarehouse returns a wrapped sentinel via a small `wrappedErr` adapter with `Unwrap`. Guards against a regression where someone changes the handler to `err == warehouse.ErrDuckNotFound` instead of `errors.Is`, which would fail to match against the real client's `%w`-wrapped error.

**Test count:** store-service Go tests now at 64 (including subtests).

**RED-state verification:** Before the GREEN edits, all three new assertions failed exactly as expected (404-path: `status = 502, want 404`; client-path: `errors.Is(err, ErrDuckNotFound) = false`). Project compiled throughout — the sentinel was declared as a stub before wiring it into `LookupPrice` or the handler, so failures were on assertions, not compile errors.

**Adjacent concerns noted but not tackled:**

- **Response-body shape.** The new 404 uses the same `{"error": "..."}` envelope as other non-validation errors (`writeError`). That matches the existing pattern and contradicts nothing in `docs/assumptions.md`. If we later adopt a richer envelope for "valid-input-but-not-found" responses (e.g. `{error: "DuckNotFound", color: "...", size: "..."}`), that's a cross-service decision and belongs in its own ticket.
- **Client-side UX.** The frontend currently treats any non-2xx from the order endpoint as a generic failure. A follow-up could distinguish 404 ("this duck isn't in stock") from 502 ("something's wrong upstream, try again") for a better message. Out of scope for a backend-only ticket.
- **`no duck available for color=X, size=Y` message leaks input back verbatim.** Color/size are already validated against the enum before reaching the lookup, so this is safe today. If the validator is ever relaxed (e.g. accepting free-text sizes), the message would need HTML-escape discipline. Noted but not acted on — the validator guarantee holds.
