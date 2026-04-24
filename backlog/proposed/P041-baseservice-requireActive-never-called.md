# P041: `BaseService.requireActive(repo, id)` is declared but has zero call sites

**Proposed severity:** Low
**Found by:** Dead Code
**Status:** Proposed
**Related to:** 020 (cross-stack BaseService symmetry — this is the JS side of what 020 addressed on the Go side; the Go port was collapsed, so the remaining JS method lost its usage narrative too)

## Description
`backend/src/services/BaseService.js:21-27` declares an async `requireActive(repo, id)` helper: find a row by id, throw `NotFoundError` if absent. The class comment explicitly documents it:

```js
// Subclasses typically call `this.requireActive(this.repo, id)`.
```

But grepping the backend for `requireActive` returns only the definition and the comment. `InventoryService.update` (`inventory/service.js:50-52`) and `InventoryService.delete` (`inventory/service.js:56-58`) each reimplement the same guard inline:

```js
const updated = await this.repo.update(id, editable);
if (!updated) throw new NotFoundError(`${this.entityName} ${id} not found`);
```

Both existing subclass mutation paths rely on the repo's own `deleted: false` filter to return `null` when the row isn't found, and throw inline — never through the base helper. `PackagingService`, `PricingService`, and `OrderService` extend `BaseService` only for `entityName`; they don't interact with a repo and don't need `requireActive` either.

## Impact
- Per STANDARDS.md *"Dead code: Unused exports, commented-out blocks > 5 lines, and feature flags that always resolve the same way should be removed, not kept 'just in case.'"* — `requireActive` qualifies.
- The class comment is actively misleading: it tells readers the standard pattern is `this.requireActive(this.repo, id)`, but none of the shipped subclasses use that pattern. A new subclass author following the comment would end up introducing a dependency on dead scaffolding.
- The helper is subtly wrong for the existing call sites anyway: the inline pattern checks the return of a mutation (`update` / `softDelete`) so it catches "deleted between findById and mutate" as well. `requireActive` does a pre-check by findById, which opens a TOCTOU window the inline code doesn't have. Encouraging future code to call `requireActive` before a mutation would make that code more racy, not less.

## Affected Files
- `backend/src/services/BaseService.js:21-27` — `requireActive` method definition.
- `backend/src/services/BaseService.js:8-11` — class comment directing subclasses to call it.

## Suggested Fix
Remove `requireActive` and the sentence in the class comment that points at it. Keep the `entityName` convention (it's live — InventoryService uses `this.entityName` in its inline throws at lines 51, 57, 76; Order/Packaging/Pricing set it for cross-stack symmetry per ticket 020).

If a shared guard is wanted later, add it then — at that point it should probably take `(repo, id)` AND be expressed as a wrapper around a mutation (the inline pattern's return-of-mutation check), not a separate findById. Better to not ship an API shape today that the only extant usage pattern actively disagrees with.
