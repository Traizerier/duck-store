---
id: 024
title: validateDuckInput and validateLookupQuery duplicate color+size checks
status: Completed
severity: low
service: warehouse-service
promoted_from: P019
---

# 024: `validateDuckInput` and `validateLookupQuery` duplicate color+size checks

**Found by:** Duplication

## Description
`warehouse-service/src/validation/duckValidator.js` exports two validators that both check the same color+size fields against the same enums with byte-identical error messages:

```js
// validateDuckInput (lines 15-20)
if (!COLORS.includes(data.color)) { errors.color = `must be one of: ${COLORS.join(", ")}`; }
if (!SIZES.includes(data.size))   { errors.size  = `must be one of: ${SIZES.join(", ")}`; }

// validateLookupQuery (lines 41-46) — same block
if (!COLORS.includes(data.color)) { errors.color = `must be one of: ${COLORS.join(", ")}`; }
if (!SIZES.includes(data.size))   { errors.size  = `must be one of: ${SIZES.join(", ")}`; }
```

The two validators were introduced separately (input validator first, lookup validator added in item 011), which is how the copy landed. The bodies will drift the moment someone changes the error-message phrasing or adds a length/casing rule — one caller will get the new rule and the other won't.

## Impact
Small today (six lines), but it's a classic "second copy acts as a canary for silent divergence." The payload-validator and the query-validator must agree on "what's a valid color?" for the POST body → merge → lookup flow to be coherent; duplicated code removes the guarantee.

## Affected Files
- `warehouse-service/src/validation/duckValidator.js:15-20` — color+size block in `validateDuckInput`.
- `warehouse-service/src/validation/duckValidator.js:41-46` — identical block in `validateLookupQuery`.

## Suggested Fix
Extract a small helper and have both validators call it:

```js
function checkColorAndSize(data, errors) {
  if (!COLORS.includes(data.color)) errors.color = `must be one of: ${COLORS.join(", ")}`;
  if (!SIZES.includes(data.size))   errors.size  = `must be one of: ${SIZES.join(", ")}`;
}
```

Then `validateDuckInput` calls `checkColorAndSize(data, errors)` before the price/quantity checks, and `validateLookupQuery` is reduced to `checkColorAndSize(data, errors)` followed by the `valid/errors` return. Existing test cases (both validators are tested independently) continue to pass without changes.

## Resolution

**Completed:** 2026-04-23

Extracted `checkColorAndSize(data, errors)` exactly as suggested. Both validators call it; neither contains the copy-pasted block anymore.

**Changes (1 file):**

- `warehouse-service/src/validation/duckValidator.js` — new module-private `checkColorAndSize(data, errors)` mutator. `validateDuckInput` and `validateLookupQuery` both call it; each shrinks by six lines.

**Verification:** `npm test -- --run src/validation/duckValidator.test.js` — 26 tests pass unchanged.
