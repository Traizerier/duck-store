---
id: 004
title: Order-endpoint validation errors use a different shape than warehouse
status: Completed
severity: medium
service: store-service
promoted_from: P005
---

# 004: Order-endpoint validation errors use a different shape than warehouse

**Found by:** Consistency, Error Handling

## Description
Warehouse-service returns validation failures as `{error: "ValidationError", errors: {color: "must be one of: ...", size: "..."}}` — a structured field-keyed object (`app.js:14`). Store-service's order handler returns `{error: "invalid color \"Blue\"; invalid size \"Huge\"; quantity must be positive"}` — a single semicolon-joined string with no field attribution (`order.go:80-101, 130-132`). Frontend `extractFieldErrors` (Warehouse.tsx:118) specifically understands the warehouse shape and silently ignores everything else.

## Impact
Any future UI that talks to store-service gets a flat string it can't map back to form fields. Two services in the same system exposing two different 400-response schemas is the exact API-shape inconsistency the Consistency rules call out, and it means shared client code can't be written.

## Affected Files
- `store-service/internal/order/order.go:80-101` (`validate` returning joined string)
- `store-service/internal/order/order.go:130-132` (`writeError` wrapping as `{error: msg}`)
- `warehouse-service/src/app.js:12-21` (reference shape)
- `frontend/src/pages/Warehouse.tsx:118-133` (`extractFieldErrors` — only understands the warehouse shape)

## Suggested Fix
Define one error envelope, use it in both services. Recommended shape (matching warehouse): `{error: "ValidationError", errors: {<field>: <message>}}`. Update the store-service `validate` function to return a `map[string]string` (or a typed error carrying one), and change `writeError` to emit the structured shape when the caller has field errors. Add a shared document or types package that spells the envelope out so a third service can't drift.

## Resolution

**Completed:** 2026-04-23

Store-service now emits the same `{error: "ValidationError", errors: {field: msg}}` envelope as warehouse for field-level validation failures. Non-validation 400s (invalid JSON body) and 502s (warehouse lookup failures) keep the simpler `{error: msg}` shape — same split warehouse uses.

**Changes (3 files):**
- `store-service/internal/order/order.go` — `validate` signature changed from `error` (semicolon-joined string) to `map[string]string` (nil when valid). New `writeValidationError` helper emits the structured envelope. Field messages match warehouse's style (`"must be one of: Red, Green, ..."`, `"must be a positive integer"`, `"required"`).
- `store-service/internal/packaging/packaging.go` — added `ShippingModes()` and `IsValidShippingMode()` as the canonical registry. `order.go` now calls `packaging.IsValidShippingMode` and builds its error message from `packaging.ShippingModes()`, so a new mode added to the package automatically shows up in validation + error text.
- Tests: `order_test.go`'s `TestHandler_ValidationError` subtests now decode the body and assert `body.error == "ValidationError"` and the expected field key is present. `packaging_test.go` got `TestIsValidShippingMode` (6 cases) and `TestShippingModes` to cover the new exports.

**Frontend touchpoint:** none — `Warehouse.tsx`'s `extractFieldErrors` already reads exactly this shape, so when a store-service frontend lands it'll share the same extractor.

### Follow-up: country whitespace propagation

An adjacent latent bug surfaced while reviewing the validator: `validate()` called `strings.TrimSpace(req.Country)` to check for emptiness, but never wrote the trimmed value back. So `"  USA  "` passed validation yet reached `pricing.Calculate` un-trimmed, fell through the country switch's specific cases, and silently received the default `+15%` instead of USA's `+18%` (211.95 → 210.375 on the happy-path totals).

**Fix:** the handler now normalizes `req.Country = strings.TrimSpace(req.Country)` once, right after JSON decode and before validation. Added `TestHandler_NormalizesCountryWhitespace` as a regression guard — sends `"  USA  "` and asserts the USA-rate total.

**`writeError` vs `writeValidationError` asymmetry:** reviewed as part of this ticket, decided to keep. `writeError` is general-purpose and takes a status code (used for 400 bad-JSON and 502 warehouse-lookup). `writeValidationError` is specific to the 400 ValidationError envelope. Unifying them would move complexity without removing any — the two shapes are genuinely different outputs.
