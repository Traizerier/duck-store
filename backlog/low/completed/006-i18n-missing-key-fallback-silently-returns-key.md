---
id: 006
title: i18n translate() silently returns the key when a translation is missing
status: Completed
severity: low
service: frontend
promoted_from: P006
---

# 006: i18n translate() silently returns the key when a translation is missing

**Found by:** Error Handling

## Description
`translate` in `frontend/src/i18n/locale.tsx:106` does `dict[key] ?? key` — if a key is missing from the active locale's dictionary, the raw key string (e.g. `"col.price"`) is rendered directly in the UI. There's no warning in dev and no test asserting the two locales cover the same keys. This is the "silent fallback that masks bugs" pattern flagged in STANDARDS.md.

## Impact
If someone adds a new UI string in English only (easy to do — the Spanish dictionary is edited in a separate block of the same file), users see raw keys like `warehouse.newLabel` in the Spanish build. No test or runtime signal catches the regression.

## Affected Files
- `frontend/src/i18n/locale.tsx:100-113` (`translate`)
- `frontend/src/i18n/locale.tsx:7-90` (two parallel dictionaries with no cross-check)

## Suggested Fix
- In dev, call `console.warn` (or throw in tests) when a key is missing from the active locale.
- Add a small unit test that asserts `Object.keys(translations.en).sort()` deep-equals `Object.keys(translations.es).sort()` so any key added to one dictionary must be added to the other.
- Optionally, tighten the type: make `t` accept `TranslationKey` instead of `string`, so the TypeScript compiler catches typos at build time.

## Resolution

**Completed:** 2026-04-23

Two of the three suggested fixes landed; the third was evaluated and rejected with rationale.

**Changes (2 files):**

- `frontend/src/i18n/locale.tsx`:
  - `translations` now exported (was module-local) so tests can iterate its keys without needing a hook/component.
  - `translate` now exported alongside the hook — the fallback `dict[key] ?? key` became an explicit `if (str === undefined)` branch that calls `console.warn` behind `import.meta.env.DEV`. Production builds still fall back silently; in dev, missing keys make noise.
- `frontend/src/i18n/locale.test.ts` (new):
  - **Drift test** — asserts `Object.keys(translations.en).sort()` deep-equals `Object.keys(translations.es).sort()`. Adds a key to only one locale? CI fails.
  - Happy-path tests for known keys (`col.price` in en/es) and `{var}` interpolation (`table.pageOf`).
  - Verifies the key-as-fallback behavior still works so missing translations don't blow up production, only warn in dev.
  - Verifies the warn fires for missing keys, includes both the key and locale in the message, and does NOT fire for known keys.

**Type tightening (`t: (key: TranslationKey, ...)`) — not applied.** The `DuckTable` color cell does `t(`color.${getValue()}`)` where `getValue()` is a runtime `Duck.color` string. Narrowing `t`'s param to `TranslationKey` makes that call type-error unless we cast, which defeats the compile-time check. A proper fix would split `t` into two functions (typed `t(key)` and dynamic `tDynamic(key)`), which is a bigger API change than this ticket's severity warrants. Revisit if typed-string dispatch becomes common enough to justify the split.

**Test count:** frontend 33 → 40 (+7 across 1 new test file).
