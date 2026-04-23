# P016: `docs/plan.md` has stale test counts and stale progress checkboxes

**Proposed severity:** Low
**Found by:** Architecture (documentation drift)

**Status:** Proposed
**Related to:** 009 (same kind of doc-vs-reality drift; follow-up explicitly deferred in P009's resolution notes)

## Description
`docs/plan.md` is STANDARDS.md's "master plan" and should reflect the current state. Two concrete drifts exist:

1. **Stale task checkboxes (lines 130, 137):**
   - `- [ ] React table + add/edit/delete — end-to-end for Warehouse ← in progress` — the frontend is clearly done (Warehouse.tsx + DuckTable + DuckForm + 40 frontend tests + i18n work all landed).
   - `- [ ] READMEs: per-service run instructions, pattern rationale` — `warehouse-service/README.md` and `store-service/README.md` both exist (confirmed via `ls`); only the doc's checkbox is stale.

2. **Stale test counts (lines 142-144):**
   ```
   - warehouse-service: 78 (validator 21 + service 25 + repo 16 + app/routes 16)
   - store-service: 33 (packaging 14 subtests + pricing 5 + order 9 + warehouse 5)
   - Total: 111 tests, all passing
   ```
   P009's resolution logged the true count as **warehouse 87** (validation 21 + service 25 + **db 6** + repo **19** + app/routes 16) after the db-layer split; store-service has grown to 64 subtests across packaging/pricing/order/warehouse; frontend has 40; total ≈ **191**. The numbers in the plan are off by ~80.

## Impact
Reviewer-visible drift. STANDARDS.md points at `docs/plan.md` as the authoritative plan; a reader comparing plan to reality sees "in progress" next to clearly-finished frontend work and a test-count claim that's wrong by a large factor. Doesn't break any code but directly undercuts the message the plan is trying to send to an interviewer.

## Affected Files
- `docs/plan.md:130` — stale "in progress" checkbox for the frontend.
- `docs/plan.md:137` — stale unchecked "READMEs" item.
- `docs/plan.md:142-144` — stale per-service + total test counts.

## Suggested Fix
Two options, pick one:

1. **Flip the checkboxes and update the numbers** (cheap, but drifts again the moment a test is added). Run `run.sh test` to get current counts and paste them in.
2. **Replace the "Test counts" section with a line that defers to the command** — e.g. "Run `./run.sh test` for current totals; counts drift fast and the plan is not the source of truth." Then delete the numbers. This is what P009's resolution recommended as an alternative.

Either way, checkboxes on lines 130 and 137 should be flipped (`[x]`) or the items removed. Prefer option 2 for the counts so this doesn't come back as a finding on the next audit.
