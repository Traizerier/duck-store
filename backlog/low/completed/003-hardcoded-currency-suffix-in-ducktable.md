---
id: 003
title: Hardcoded "USD" currency suffix in DuckTable is neither translated nor spaced
status: Completed
severity: low
service: frontend
promoted_from: P007
---

# 003: Hardcoded "USD" currency suffix in DuckTable is neither translated nor spaced

**Found by:** Consistency

## Description
`DuckTable.tsx` renders the price as `` `${getValue()}USD` `` — a hardcoded currency code concatenated with no separator ("10USD") and no translation entry. Every other user-facing string in this component goes through `t(...)`, so this is an inconsistency against the component's own pattern and against the frontend's bilingual-UI rule in `docs/assumptions.md`.

## Impact
- Minor visual: "10USD" reads as a typo next to properly spaced headings.
- No i18n path for the currency — if a future locale wants a prefix (`$10`) or a different code, there's no hook.

## Affected Files
- `frontend/src/components/DuckTable.tsx:40-43`

## Suggested Fix
Add a translation key (e.g. `"price.format": "{value} USD"`) and use `t("price.format", { value: getValue() })`. Or, if locale-specific formatting is desired, use `Intl.NumberFormat(locale, { style: "currency", currency: "USD" })`.

## Resolution

**Completed:** 2026-04-23

Added a `"price.format": "{value} USD"` key to both EN and ES dictionaries in `frontend/src/i18n/locale.tsx`, and changed the price cell in `DuckTable.tsx` from the hardcoded template literal to `t("price.format", { value: getValue() })`. Output now reads "10 USD" (with the missing space) and routes through the i18n layer, making a future locale override or swap to `Intl.NumberFormat` a one-line change. Two assertions in `DuckTable.test.tsx` were updated from `"10USD"`/`"8USD"` to the spaced form.
