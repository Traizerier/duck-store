---
id: 013
title: Hand-rolled contains in order.go duplicates stdlib slices.Contains
status: Completed
severity: low
service: store-service
promoted_from: P014
---

# 013: Hand-rolled `contains` in `order.go` duplicates `slices.Contains`

**Found by:** Duplication

## Description
`store-service/internal/order/order.go` defines a private `contains(xs []string, s string) bool` helper that linear-searches a slice:

```go
func contains(xs []string, s string) bool {
    for _, x := range xs {
        if x == s {
            return true
        }
    }
    return false
}
```

This is exactly `slices.Contains` from the standard library (stable since Go 1.21). The test code already imports `slices` (e.g. `enums_drift_test.go`, `packaging_test.go`, `pricing_test.go`), so the dependency is clearly already accepted.

## Impact
- A small amount of dead surface that we own and have to read. Not a behavioral issue.
- The idiom "we roll our own `contains`" sometimes proliferates — if a second use site appears, the copy gets copied. Removing it now prevents that.
- Consistency: tests use `slices.Equal` / `slices.Contains`; production code does the same thing a different way.

## Affected Files
- `store-service/internal/order/order.go:106, 109, 128-135` — two call sites and the helper itself.

## Suggested Fix
Import `slices` in `order.go` and replace the two call sites:

```go
import (
    "slices"
    // ... existing imports
)

// in validate():
if !slices.Contains(e.Colors, req.Color) { ... }
if !slices.Contains(e.Sizes, req.Size) { ... }
```

Delete the local `contains` function. Tests should pass unchanged.

## Resolution

**Completed:** 2026-04-23

Straight swap — added `slices` to the import block, replaced the two `contains(...)` call sites in `validate()` with `slices.Contains(...)`, and deleted the 8-line helper.

**Changes (1 file):**

- `store-service/internal/order/order.go` — `slices` added to the stdlib import group; `contains(e.Colors, req.Color)` → `slices.Contains(e.Colors, req.Color)` (and same for `Sizes`); local `contains` function removed. Net: +1 import line, −8 function lines.

**Verification:**

- `go vet ./...` — clean.
- `go test ./... -count=1` — all 64 store-service tests pass unchanged.

**No TDD cycle applied:** pure refactor, no behavior change. The validation tests in `order_test.go` already exercise the call sites (`unknown color` and `unknown size` cases in `TestHandler_ValidationError`) and provide regression coverage for free.

**Test count:** unchanged (64).

**Adjacent concerns noted but not tackled:**

- **`joinModes(packaging.ShippingMode) string`** is still a hand-rolled helper a few lines down. It does `strings.Join` over `[]ShippingMode`, which can't use `slices` directly but could use `fmt.Sprintf` or a generic mapper. Not worth a ticket — it's a type-specific adapter, not a duplication of stdlib.
- **`warehouse-service` validator** uses `COLORS.includes(data.color)` and `SIZES.includes(data.size)` — that's the JS idiom for the same thing. Not a duplication issue cross-language; the Node side is already using its stdlib.
