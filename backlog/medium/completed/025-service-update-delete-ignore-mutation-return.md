---
id: 025
title: duckService.update / delete ignore mutation return value, masking TOCTOU races
status: Completed
severity: medium
service: warehouse-service
promoted_from: P020
---

# 025: `duckService.update` / `duckService.delete` ignore mutation return value, masking TOCTOU races

**Found by:** Error Handling
**Related to:** 007 (established the `deleted: false` invariant in repo mutations — this is the service-layer counterpart)

## Description
After item 007, `repo.update`, `repo.incrementQuantity`, and `repo.softDelete` all filter on `{_id, deleted: false}` and return `null` when no active row matches. The service layer still only does a pre-check:

```js
// duckService.js:36-43
async update(id, fields) {
  // ... validation ...
  await requireActiveDuck(id);         // read-check
  return repo.update(id, editable);    // returns null if the row was
                                       // soft-deleted between the two calls;
                                       // service returns that null as-is.
},

async delete(id) {
  await requireActiveDuck(id);
  return repo.softDelete(id);          // same story
},
```

The route then sends that `null` straight back: `PATCH` returns `200 OK` with body `null`, and `DELETE` returns `204` (which is accidentally fine for the delete case because the body is empty anyway, but the caller sees "deleted" even though no row changed).

## Impact
- **`PATCH /api/ducks/:id` silently 200s on a deleted duck.** Two concurrent requests — one PATCH, one DELETE — can interleave so the PATCH sees an active duck during `requireActiveDuck`, then `repo.update` returns `null`, and the response is `200 {body: null}`. The frontend's `ApiError` only fires on `!res.ok`, so the table shows stale data with no user feedback.
- **Lost NotFound signal.** The repo's `deleted: false` filter exists specifically to enforce the logical-deletion invariant (item 007's rationale). The service then throws that signal away by not checking the return.
- **Violates STANDARDS.md error-handling rule:** "Operations that can fail but have no handling." The `null` return is the failure signal; nobody reads it.

## Affected Files
- `warehouse-service/src/services/duckService.js:36-44` — `update` doesn't check `repo.update`'s return value.
- `warehouse-service/src/services/duckService.js:46-49` — `delete` doesn't check `repo.softDelete`'s return value (less severe because the route returns 204, but the service contract is still "assume success" rather than verified success).
- Related: `warehouse-service/src/routes/ducks.js:52-59` — the PATCH handler sends `duck` to `res.json(duck)` with no null check.

## Suggested Fix
Check the mutation result and throw `NotFoundError` when it's `null`:

```js
async update(id, fields) {
  // ... validation ...
  await requireActiveDuck(id);
  const updated = await repo.update(id, editable);
  if (!updated) throw new NotFoundError(`Duck ${id} not found`);
  return updated;
},

async delete(id) {
  await requireActiveDuck(id);
  const deleted = await repo.softDelete(id);
  if (!deleted) throw new NotFoundError(`Duck ${id} not found`);
  return deleted;
},
```

Once both call sites trust the mutation result, the `requireActiveDuck` pre-check becomes redundant and can be removed — which also collapses one read per request and makes the race impossible by construction. Table-driven tests in `duckService.test.js` should cover "row disappears between check and mutation" by stubbing the repo to return a duck from `findById` but `null` from the mutation.

## Resolution

**Completed:** 2026-04-23

Went with the ticket's stronger recommendation: removed the `requireActive` pre-check entirely and made the mutation's null return the authoritative "no match" signal. The race is now impossible by construction — there's no window between a check and a mutation, just the mutation itself.

**Changes (2 files):**

- `warehouse-service/src/services/duckService.js` — `update` and `delete` no longer call `this.requireActive(this.repo, id)`. Both now read the mutation result and `throw new NotFoundError(...)` when it's `null`. Comment at `update` names the rationale (the repo's `{_id, deleted:false}` filter is the single source of truth).
- `warehouse-service/src/services/duckService.test.js` — fake repo's `update`, `incrementQuantity`, and `softDelete` methods now filter `!d.deleted` to mirror the real repo's invariant (item 007 explicitly noted this fake drift would matter once `requireActive` was removed — here we are). Added one new regression test: `should throw NotFoundError when repo.update returns null`, using a direct stub so the TOCTOU contract is pinned regardless of fake-repo behavior.

**Verification:**

- `npm test -- --run` — 104 warehouse tests pass (was 103; +1 TOCTOU regression test).
- End-to-end: `DELETE /api/ducks/99999` returns `404 {error: "NotFoundError", message: "Duck 99999 not found"}` as before; semantics preserved.

**Adjacent concerns noted but not tackled:**

- **Route-level null guard in `PATCH`** (`routes/ducks.js` calling `res.json(duck)`): with the service now throwing on null, the route never sees a null to send back. The old `res.json(null)` footgun can't fire. No route change needed.
- **`incrementQuantity` path** — `create()` reaches this when the matching duck exists and gets its quantity incremented. The repo's `deleted:false` filter means a deleted matching duck wouldn't be found by `findMatch`, so `incrementQuantity` only runs on active rows. Not touched.
