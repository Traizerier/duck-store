# backlog

Per-severity tickets tracking work on Duck Store. Layout:

```
backlog/
├── proposed/            # audit findings awaiting triage (P###-*.md)
├── critical/ high/ medium/ low/
│   ├── active/          # open or in-progress tickets
│   └── completed/       # closed tickets with a ## Resolution section
```

Tickets are numbered globally and sorted into severity at promotion time. Filenames carry the severity-agnostic number (`034-...`) once promoted. See [`.claude/skills/backlog/SKILL.md`](../.claude/skills/backlog/SKILL.md) for the full flow.

## Reading pre-pivot tickets

The project went through an architectural pivot in 2026-04 — see the banner at the top of [`docs/plan.md`](../docs/plan.md). Before the pivot the codebase had two separate services:

- `warehouse-service/` — Node + Express + MongoDB
- `store-service/` — Go, called the warehouse via HTTP for price lookups

The pivot collapsed both into a single schema-driven Node backend, deployed twice as independent stacks (warehouse, store) with their own Mongo containers. No inter-backend HTTP.

**Tickets numbered roughly 001–032 were resolved against the pre-pivot architecture.** Their Description and Affected Files sections reference paths like `warehouse-service/src/...` or `store-service/internal/...` that no longer exist in the tree — those references were accurate at the time the ticket was closed. Resolutions are preserved as-is so the history of each fix stays honest; consult the plan.md pivot banner for the post-pivot file locations (`backend/src/...` and `frontend/src/...`).

Tickets 033 and later were filed and resolved after the pivot and use the current paths directly.
