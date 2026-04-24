---
id: 022
title: Size enum values render untranslated in the warehouse UI
status: Completed
severity: low
service: frontend
promoted_from: P017
---

# 022: Size enum values render untranslated in the warehouse UI

**Found by:** Consistency

## Description
`docs/plan.md:123` explicitly calls out the bilingual-labels intent ("Mockup has bilingual labels … Keep bilingual"), and the i18n dictionary contains `color.Red`/`color.Green`/`color.Yellow`/`color.Black` keys with Spanish translations. Sizes get the same "needs translating" treatment on the plan, but the dictionary has no `size.*` entries and no component translates size values — `DuckTable` renders the size column with a raw `accessor("size")` (no `cell:` mapper) and `DuckForm` renders `<option>{s}</option>`. The result: when a user switches to Spanish, colors flip (Red → Rojo) but sizes stay English ("XLarge", "Medium", "XSmall").

## Impact
User-facing inconsistency: a Spanish-speaking user sees "Rojo Medium" in the grid, which reads as half-translated. This directly undercuts the "attention to detail" signal the bilingual labels are meant to send to a reviewer. Also breaks the pattern established by the color column — anyone adding another filterable enum column will legitimately wonder whether to follow the color model or the size model.

## Affected Files
- `frontend/src/i18n/locale.tsx:47-50` — only `color.*` keys exist; no `size.*` entries in either dictionary.
- `frontend/src/components/DuckTable.tsx:37-39` — size column has no `cell:` translation (compare to color column at 33-36).
- `frontend/src/components/DuckForm.tsx:67-71` — `<option value={s}>{s}</option>` renders raw size enum instead of `t(\`size.${s}\`)`.

## Suggested Fix
1. Add `size.XLarge`/`size.Large`/`size.Medium`/`size.Small`/`size.XSmall` keys to both `en` and `es` dictionaries in `locale.tsx`. Reasonable Spanish mapping: "Extra Grande / Grande / Mediano / Pequeño / Extra Pequeño" (or keep the size tokens if the product owner prefers untranslated sizing — document that decision in `docs/assumptions.md`).
2. In `DuckTable`, mirror the color column: add `cell: ({ getValue }) => t(\`size.${getValue()}\`)` to the size column definition.
3. In `DuckForm`, change `<option key={s} value={s}>{s}</option>` to `<option key={s} value={s}>{t(\`size.${s}\`)}</option>`.
4. The existing `locale.test.ts` drift test (from P006 resolution) will automatically verify the `es` dictionary keeps parity; no new test plumbing needed.

## Resolution

**Completed:** 2026-04-23

Applied all four suggested edits. Went with the ticket's Spanish mapping verbatim ("Extra Grande / Grande / Mediano / Pequeño / Extra Pequeño"). The en keys pass through the English label so the table reads "Extra Large" / "Extra Small" instead of "XLarge" / "XSmall" — a small polish that also reads better than the raw enum tokens.

**Changes (4 files):**

- `frontend/src/i18n/locale.tsx` — five new keys in each dictionary (`size.XLarge` … `size.XSmall`).
- `frontend/src/components/DuckTable.tsx` — size column now has `cell: ({ getValue }) => t(\`size.${getValue()}\`)` (mirrors color).
- `frontend/src/components/DuckForm.tsx` — option text uses `t(\`size.${s}\`)`; the `value` attr still submits the raw enum token.
- `frontend/src/components/DuckForm.test.tsx` — "five spec sizes" test now asserts against option `.value` (stable) instead of visible text (now localized). Locale-parity is already covered by `i18n/locale.test.ts`.

**Verification:** `npm test -- --run` — 46 tests pass. The en/es key-parity assertion caught that both locales got all five keys added.
