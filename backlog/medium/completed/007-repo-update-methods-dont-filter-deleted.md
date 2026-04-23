---
id: 007
title: Duck repo mutation methods don't filter by deleted:false
status: Completed
severity: medium
service: warehouse-service
promoted_from: P008
---

# 007: Duck repo mutation methods don't filter by deleted:false

**Found by:** Error Handling, Architecture

## Description
`duckRepo.update`, `duckRepo.incrementQuantity`, and `duckRepo.softDelete` all match on `{_id: id}` alone — they do not include `deleted: false` in the filter (`duckRepo.js:40-68`). Today the service layer guards mutations with `requireActiveDuck` before calling these repo methods, so the invariant holds end-to-end, but the repo itself doesn't defend its own standards rule: "Reads filter `deleted: false`. Never hard-delete ducks." The same logical-deletion discipline should apply to writes reaching deleted rows.

## Impact
A future caller (another service, a migration script, a new internal endpoint) that reaches `repo.update` or `repo.incrementQuantity` without going through the service layer can mutate or resurrect deleted ducks silently. The merge-on-add path (`duckService.js:30`) already demonstrates how `findMatch` (which does filter deleted) followed by `incrementQuantity` (which doesn't) only stays correct because of `findMatch`'s filter — the invariant is one refactor away from breaking.

## Affected Files
- `warehouse-service/src/repos/duckRepo.js:40-48` (`update`)
- `warehouse-service/src/repos/duckRepo.js:50-58` (`incrementQuantity`)
- `warehouse-service/src/repos/duckRepo.js:60-68` (`softDelete`)

## Suggested Fix
Add `deleted: false` to the `findOneAndUpdate` filter in `update`, `incrementQuantity`, and `softDelete`. Have them return `null` (and propagate a NotFoundError at the service layer) if the match fails. Add repo-level tests that seed a `deleted: true` doc and assert the mutation methods do not touch it.

## Resolution

**Completed:** 2026-04-23

Three-line fix exactly as suggested — `deleted: false` added to each of the three `findOneAndUpdate` filters. Added a comment block naming the invariant so the rule is visible next to the code that enforces it.

**Changes (2 files):**

- `warehouse-service/src/repos/duckRepo.js` — `update`, `incrementQuantity`, `softDelete` filters now all match `{ _id: id, deleted: false }`. `toDuck` already returned `null` for null docs, so "no match → return null" works without extra code. Service layer (`requireActiveDuck`) still maps null to `NotFoundError` for external callers.
- `warehouse-service/src/repos/duckRepo.test.js` — three new regression tests:
  - `update` against a deleted duck returns null and the raw Mongo doc is unchanged
  - `incrementQuantity` against a deleted duck returns null and quantity is unchanged
  - `softDelete` of an already-deleted duck returns null

Each test verifies the raw Mongo state (via `db.collection("ducks").findOne({_id})`) so we catch a regression where the method both returns null AND mutates the doc (shouldn't happen, but belt-and-suspenders for findOneAndUpdate's contract).

**Test count:** warehouse 78 → 81 (+3 repo tests).

**Adjacent concerns noted but not tackled:**

- **Service-layer race condition.** Between `requireActiveDuck(id)` succeeding and `repo.update(id, fields)` running, a concurrent DELETE could tombstone the row. With this fix, `repo.update` would then return null; `service.update` would return that null to the route; the route would `res.json(null)` and respond 200. Not a crash, but also not ideal. Fix would be: have the service check the repo return value and throw `NotFoundError` if null. Small, but out of scope for P008 (which is specifically about repo self-defense). Worth a follow-up ticket: "service mutation methods don't handle null from repo."
- **Fake repo in `duckService.test.js`** still doesn't filter deleted. Service tests don't exercise the "try to update a deleted row" path because `requireActiveDuck` intercepts first, so the fake's behavior never matters. Leaving the fake as-is to minimize churn; if service tests ever grow to exercise this path, update the fake at that time to match real behavior.
