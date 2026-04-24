---
id: 016
title: Duck.save() has no production callers — only its own unit test
status: Completed
severity: low
service: frontend
promoted_from: P024
---

# 016: `Duck.save()` has no production callers — only its own unit test

**Found by:** Dead Code

## Description
`frontend/src/models/Duck.ts:26-32` defines `save()`:

```ts
async save(): Promise<void> {
  const updated = await this.service._patch(this.id, {
    price: this.price,
    quantity: this.quantity,
  });
  Object.assign(this, updated);
}
```

A project-wide grep for `.save(` turns up exactly two matches: the definition in `Duck.ts` and the call in `Duck.test.ts:44`. Nothing in `pages/`, `components/`, or `services/` invokes it. The production persistence path is `Duck.update(fields)` (used by `Warehouse.tsx:63`), which accepts an explicit field bag and covers the same use case.

STANDARDS.md (Dead code): "Unused exports, commented-out blocks > 5 lines, and feature flags that always resolve the same way should be removed, not kept 'just in case.'"

## Impact
Small ongoing maintenance tax: `save()` sits alongside `update()` as two methods with overlapping semantics, and its test enforces a contract (`save() persists current editable fields`) that no real caller exercises. A future reader looking at `Duck` has to decide between `save` and `update`; the real answer today is always `update`. Also keeps a fragile coupling — `save()` hard-codes the editable fields (`price`, `quantity`) instead of deriving them, so a new editable field would silently be missed if someone did start using `save()`.

## Affected Files
- `frontend/src/models/Duck.ts:26-32` — `save()` definition.
- `frontend/src/models/Duck.test.ts:38-49` — the only caller (a unit test asserting the behavior no one uses).

## Suggested Fix
Two options, pick one:

1. **Delete `save()` and its test** — lowest overhead. Consumers that want to persist the whole instance do `await duck.update({ price: duck.price, quantity: duck.quantity })`, which is one line and already what the model offers for partial updates.

2. **Collapse `save()` into `update()` with no args**: make `update(fields?)` default to `{price, quantity}` when no fields are passed. Keeps the short-form API but doesn't require a second code path. Rewrite the existing `save()` test to call `update()` instead.

Option 1 is cleaner given there's no demonstrated need; the pattern is easy to re-add if an active-record `save()` idiom becomes useful.

## Resolution

**Completed:** 2026-04-23

Chose option 1 — deleted `save()` and its test. `Duck.update(fields)` is the only persistence method now; callers that want to persist the whole editable surface do `await duck.update({ price: duck.price, quantity: duck.quantity })`, which is one line and mirrors what they'd write anyway.

**Changes (2 files):**

- `frontend/src/models/Duck.ts` — `save()` method removed. `update(fields)` unchanged in behavior.
- `frontend/src/models/Duck.test.ts` — `save()`-specific test removed. Remaining 5 tests cover `update`, `delete`, error rethrow, and `toJSON`.

**Verification:** `npm test -- --run` — `models/Duck.test.ts` goes 6 → 5 tests, all pass. Full frontend suite 46 → 45 → 46 after the i18n ticket (019) added one back.

**Adjacent concerns noted but not tackled:**

- **`update(fields?)` with a default of all editable fields** (the ticket's option 2) was considered. Rejected — makes the contract fuzzier and the `update()` call site always passes explicit fields today, so defaulting adds a footgun (readers wondering "which fields did `update()` just persist?") for no callers' benefit.
