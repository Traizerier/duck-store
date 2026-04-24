---
id: 039
title: .claude/audit-standards/STANDARDS.md still references store-service in the documentation section
status: Completed
severity: low
service: audit
promoted_from: P042
---

# 039: `.claude/audit-standards/STANDARDS.md` still references `store-service` in the documentation section

**Found by:** Consistency (documentation drift)
**Related to:** 015, 031, 032 (same class — post-pivot doc drift; STANDARDS.md was not included in those fixes)

## Description

`.claude/audit-standards/STANDARDS.md:100` — Documentation section — still reads:

> Each service has a `README.md` covering install, run, test, environment variables, and (for store-service) a short design-pattern summary.

Post-pivot there is no `store-service` — the Go service was deleted in 2026-04 and its packaging/pricing logic was ported to `backend/src/packaging/` and `backend/src/pricing/`. The parenthetical "(for store-service)" names a directory that doesn't exist.

Elsewhere in STANDARDS.md the post-pivot architecture is fully accurate. This is a one-line residue.

## Impact

- The code auditor itself reads STANDARDS.md on every run and passes it verbatim to every specialist. A specialist reading "for store-service" and looking for `store-service/README.md` either wastes time confirming the file doesn't exist or files a doc-drift finding because a README the standards claim should exist doesn't.
- Auditor hygiene: the standards document is also the reference every new contributor reads. A mention of a deleted service here undermines the document's authority.

## Affected Files

- `.claude/audit-standards/STANDARDS.md:100` — "(for store-service)" parenthetical.

## Suggested Fix

Drop the parenthetical. The design-pattern summary now lives in `backend/README.md` alongside the rest:

```markdown
- Each service has a `README.md` covering install, run, test, and environment variables.
  The backend README also includes a short design-pattern summary (Strategy + Decorator
  for packaging, Chain of Responsibility for pricing).
```

## Resolution

Rewrote the Documentation bullet in `.claude/audit-standards/STANDARDS.md:100`. Removed the "(for store-service)" parenthetical and moved the design-pattern summary callout onto its own sub-line naming `backend/README.md` as the home for Strategy + Decorator (packaging) and Chain of Responsibility (pricing).
