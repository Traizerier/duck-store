---
id: 019
title: Warehouse.describeError renders raw English, bypassing the i18n layer
status: Completed
severity: low
service: frontend
promoted_from: P027
---

# 019: `Warehouse.describeError` renders raw English, bypassing the i18n layer

**Found by:** Consistency
**Related to:** 003 (hardcoded "USD" — same "fell through the i18n net" pattern); 006 (i18n missing-key dev-warn); P017 (size values not localized)

## Description
`frontend/src/pages/Warehouse.tsx:129-135`:

```ts
function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    return `Request failed (${e.status})`;
  }
  if (e instanceof Error) return e.message;
  return "Unknown error";
}
```

The returned string is rendered by the `warehouse-error` alert (`Warehouse.tsx:91-95`). A Spanish-speaking user who clicks the locale toggle to `es` still sees `"Request failed (502)"` / `"Unknown error"` when anything goes wrong. Every other user-facing string in this page flows through `t(...)` — `t("warehouse.title")`, `t("warehouse.addButton")`, `t("delete.confirm", {...})`. Error copy is the only exception, and it surfaces exactly at the moment the user needs help most.

STANDARDS.md doesn't prescribe translations explicitly, but `docs/plan.md:123` and `docs/assumptions.md:60` both list bilingual labels as a deliberate mockup-matching choice. The existing `translate()` function already has a missing-key dev-warn (item 006), so adding keys is cheap and the consistency story is clear: *all* UI strings go through `t`.

## Impact
User-visible inconsistency: Spanish locale surfaces Spanish for everything up to and including the delete-confirm dialog, then flips to English the instant the server returns an error. Narrow window, but it's also the only moment a non-technical user can't work around the mismatch. Also inconsistent with item 003's resolution (currency formatting moved into the dictionary) and the overall "every rendered string is a translation key" pattern the page otherwise follows.

## Affected Files
- `frontend/src/pages/Warehouse.tsx:129-135` — `describeError` builds strings without `t()`.
- `frontend/src/pages/Warehouse.tsx:91-95` — the alert renders the raw string.
- `frontend/src/i18n/locale.tsx:10-97` — dictionaries currently have no `error.*` namespace.

## Suggested Fix
1. Add three keys to both locales in `locale.tsx`:
   ```ts
   "error.requestFailed": "Request failed ({status})",
   "error.unknown": "Unknown error",
   // Spanish mirror: "Error de solicitud ({status})", "Error desconocido",
   ```
2. Pull `t` into `describeError` (either by accepting it as a parameter or by inlining the logic in the component):
   ```ts
   const describeError = (e: unknown): string => {
     if (e instanceof ApiError) return t("error.requestFailed", { status: e.status });
     if (e instanceof Error) return e.message; // network/JS errors — keep raw
     return t("error.unknown");
   };
   ```
   `e.message` from a non-`ApiError` is a JS-engine string (e.g. `"Failed to fetch"`) that isn't ours to translate — leaving it raw is the honest trade-off.
3. Existing tests in `Warehouse.test.tsx` don't currently assert error strings; add one that renders with `locale=es`, forces an `ApiError`, and asserts the Spanish copy appears.

## Resolution

**Completed:** 2026-04-23

Added `error.requestFailed` and `error.unknown` keys to both locales, pulled `describeError` into the component body so it can reach `t`, and added the Spanish-locale regression test the ticket suggested.

**Changes (3 files):**

- `frontend/src/i18n/locale.tsx` — two new keys in both `en` and `es` (`"Request failed ({status})"` / `"Error de solicitud ({status})"`; `"Unknown error"` / `"Error desconocido"`). Also added an optional `initialLocale` prop to `LocaleProvider` so tests can mount a non-English tree without a `setLocale` dance — used by the new assertion below.
- `frontend/src/pages/Warehouse.tsx` — `describeError` moved from module scope into the component body. `ApiError` path goes through `t("error.requestFailed", { status })`; `Error.message` is left raw (engine-generated, not our copy); fallback goes through `t("error.unknown")`.
- `frontend/src/pages/Warehouse.test.tsx` — new test renders `<Warehouse />` inside `<LocaleProvider initialLocale="es">`, forces a 500, and asserts the alert reads `"Error de solicitud (500)"`.

**Verification:**

- The existing en/es key-parity test (`locale.test.ts`) still passes — the two new keys were added to both dictionaries at once.
- `npm test -- --run` — 46 tests green (was 45 after ticket 016; +1 from the new Spanish test here).
- `npx tsc --noEmit` exits 0.

**Adjacent concerns noted but not tackled:**

- **Generic `Error.message` strings** from `fetch` / network failures render raw (e.g. `"Failed to fetch"`). We don't translate them — they come from the browser runtime, not from our code, and any i18n of them would be a bilingual imitation rather than real localization. Flagged in the `describeError` comment.
- **`LocaleProvider.initialLocale` prop** is exposed for test convenience. If production ever wants to hydrate an initial locale from e.g. the `Accept-Language` header, this prop is already the entry point.
