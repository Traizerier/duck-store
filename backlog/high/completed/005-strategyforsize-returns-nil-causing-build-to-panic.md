---
id: 005
title: strategyForSize returns nil and Build dereferences it without a guard
status: Completed
severity: high
service: store-service
promoted_from: P003
---

# 005: strategyForSize returns nil and Build dereferences it without a guard

**Found by:** Error Handling, Architecture

## Description
`strategyForSize` returns `nil` when the size value doesn't match any case, and `Build` immediately calls `s.material()` on that return value (`packaging.go:86-87`). If a caller ever passes an unknown size — e.g. a future code path that skips the order handler's `isValidSize` check, or a direct internal caller — the server will panic with a nil pointer dereference on a request-handling goroutine.

Today the order handler validates before calling `Build`, so the nil path is unreachable, but the `packaging` package is presented as a reusable internal library with no defense at its own boundary.

## Impact
A single missed validation at any future call site takes down the server. The package API makes an implicit precondition (`size must be valid`) that is not expressed in the type system or checked at runtime — the kind of "silent fallback that masks bugs" the standards call out.

## Affected Files
- `store-service/internal/packaging/packaging.go:44-54` (`strategyForSize`)
- `store-service/internal/packaging/packaging.go:85-92` (`Build`)

## Suggested Fix
Either:
- Make `Build` return `(Package, error)` and have `strategyForSize` return an error for unknown sizes, wrapped with `fmt.Errorf("unknown size %q", size)`. This matches the standards' "wrap at layer boundaries with `%w`" guidance.
- Or have `Build` panic with an explicit message if `strategyForSize` returns nil, so the failure mode is obvious.

Either way, add a unit test for the unknown-size case.

## Resolution

**Completed:** 2026-04-23

Chose Option 1 — error returns — matching the STANDARDS.md guidance to "wrap at layer boundaries with `%w`". The `packaging` library now defends its own boundary instead of relying on implicit preconditions.

**Changes (3 files):**

- `internal/packaging/packaging.go`:
  - `strategyForSize(size) (packagingStrategy, error)` — returns `fmt.Errorf("unknown size %q", s)` for the unhandled case instead of `nil`.
  - `Build(size, mode) (Package, error)` — propagates the strategy error with `fmt.Errorf("packaging.Build: %w", err)` so stack traces show the boundary. Returns a zero-value `Package` on error so callers that forget to check can't accidentally use a partial result.

- `internal/order/order.go`: caller now unpacks `pkg, err := packaging.Build(...)`. On non-nil error, responds `500 Internal Server Error` — this path is unreachable in practice (the handler's validator rejects unknown sizes first, and the packaging drift test asserts the typed `Size` constants match `shared/enums.json`), but the defensive branch costs one `if err != nil` and guards against future drift or a direct-call bypass.

- `internal/packaging/packaging_test.go`:
  - Existing tests updated to unpack `(pkg, err)` and `t.Fatalf` on unexpected errors.
  - New `TestBuild_UnknownSize` covers `"Huge"`, `""`, `"XXLarge"`, and `"large"` (wrong case). Asserts non-nil error *and* zero-value `Package` so the "caller ignored the error" path can't accidentally surface a valid-looking result.

**Adjacent concerns noted but not fixed in this ticket:**
- `protectionsFor(material, mode)` returns `nil` silently for unknown shipping modes. Same class of issue as the original `strategyForSize` — silent fallback. Not in scope here because it can't cause a panic (just yields an empty protections list), but it's a candidate for a follow-up audit item under the same "silent fallback that masks bugs" rule. The validator already rejects unknown modes, so in practice this code path is also unreachable.
- The handler's 500 branch has no direct test (would require constructing an `*enums.Enums` whose Sizes list disagrees with packaging's typed constants — the `packaging/enums_drift_test.go` prevents exactly that drift, making the scenario unreachable). Keeping the branch documented via the comment rather than contriving a mismatch in tests.

### Follow-up: both adjacent concerns resolved

**`protectionsFor` silent fallback → error return.** Same treatment as `strategyForSize`: `protectionsFor(material, mode) ([]Protection, error)` returns `fmt.Errorf("unknown shipping mode %q", mode)` instead of `nil`. `Build` chains the error with `"packaging.Build: %w"` and returns a zero-value `Package`. Now every public boundary of the packaging library defends itself — no more implicit preconditions, no more silent empty returns. `TestBuild_UnknownShippingMode` (3 subtests: `"rocket"`, `""`, `"AIR"` wrong-case) guards the new behavior.

**500 handler branch covered.** Added `TestHandler_500WhenPackagingRejectsValidatedSize`: constructs an `*enums.Enums` whose `Sizes` list contains `"Huge"` (a value the validator then accepts) and sends a request with `Size: "Huge"`. The handler's call to `packaging.Build` returns an error, and we assert the response is 500. Covers the drift-handler path without touching `shared/enums.json` or the packaging constants — a test-local `*enums.Enums` is all it takes. Added `postOrderWithEnums` helper so other future tests can reuse the pattern.
