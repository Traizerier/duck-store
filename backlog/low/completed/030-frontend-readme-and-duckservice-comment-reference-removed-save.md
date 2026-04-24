---
id: 030
title: Frontend README layout and DuckService._patch comment still reference removed Duck.save()
status: Completed
severity: low
service: frontend
promoted_from: P031
---

# 030: Frontend README layout and `DuckService._patch` comment still reference removed `Duck.save()`

**Found by:** Consistency (documentation drift)
**Related to:** 015 (same README that 015 rewrote); 016 (the ticket that removed `Duck.save()` but didn't update the doc/comment that mentioned it)

## Description
Ticket 016 deleted `Duck.save()` and its unit test, leaving `update()` and `delete()` as the model's only mutation methods. Two places still describe the pre-deletion API:

1. **`frontend/README.md:29`** — the Layout block says:

   ```
   ├── models/
   │   └── Duck.ts               # active-record: save()/update()/delete() on a fetched row
   ```

   This line was written in ticket 015's rewrite and the wording survived ticket 016's deletion. `save()` no longer exists on the model.

2. **`frontend/src/services/DuckService.ts:43`** — the leading comment on `_patch` says:

   ```ts
   // Internal — called by Duck.save() and Duck.update(). Returns the raw
   // row; the model is responsible for mutating itself in place.
   async _patch(id: number, fields: DuckUpdate): Promise<DuckData> { ... }
   ```

   `_patch`'s only caller is `Duck.update()` now — `Duck.save()` is gone along with its test.

Neither is a code bug; both are reader-visible doc drift that directly undercut the "attention to detail" signal. This is the same class of regression 015 and P016 flagged (doc-vs-reality), and it's the standard aftershock of deleting a public method without sweeping the prose that described it.

## Impact
- A reader opening `frontend/README.md` sees `save()` listed as a public method and then can't find it in `Duck.ts`. Same story if they start from `DuckService.ts:43` and grep for `Duck.save` — the comment points at code that doesn't exist.
- Creates a small "which API am I supposed to use?" moment — `save()` in the doc might be interpreted as a planned method, a removed method, or a typo. All three readings are worse than the comment being accurate.
- Slight regression of ticket 015's resolution, which rewrote `frontend/README.md` specifically to eliminate stale layout descriptions.

## Affected Files
- `frontend/README.md:29` — Layout line lists `save()/update()/delete()`; should be `update()/delete()`.
- `frontend/src/services/DuckService.ts:43-44` — `_patch` header comment mentions `Duck.save()`; should name only `Duck.update()`.

## Suggested Fix
Two one-line edits:

1. `frontend/README.md:29` — change `# active-record: save()/update()/delete() on a fetched row` to `# active-record: update()/delete() on a fetched row` (or rewrite the descriptor to not enumerate methods, which sidesteps this class of drift — e.g. `# active-record: duck instances that know how to persist themselves`).

2. `frontend/src/services/DuckService.ts:43-44` — change `// Internal — called by Duck.save() and Duck.update(). Returns the raw` to `// Internal — called by Duck.update(). Returns the raw`.

No test changes needed. The broader lesson — co-locate prose with the code it describes so it's in the same diff when behavior changes — is already implicit in STANDARDS.md's "Types: Co-located with the owning component" rule and doesn't need a separate ticket.

## Resolution

**Completed:** 2026-04-23

Both references updated. Rewrote the README line to stop enumerating methods entirely (the ticket's "sidesteps this class of drift" option), so the descriptor won't lie the next time the model API shifts.

**Changes (2 files):**

- `frontend/README.md` — Layout line `Duck.ts # active-record: save()/update()/delete() on a fetched row` rewritten to `Duck.ts # active-record: fetched duck knows how to update/delete itself`. Doesn't enumerate; won't drift.
- `frontend/src/services/DuckService.ts` — `_patch` leading comment trimmed from `Internal — called by Duck.save() and Duck.update()` to `Internal — called by Duck.update()`.

**Verification:** `grep "save()" frontend/` returns zero hits. Tests unchanged (no behavior touched).
