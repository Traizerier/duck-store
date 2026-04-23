---
name: backlog
description: Browse and work through the project backlog — implementation tasks tracked in `backlog/`. Use when the user wants to list, view, or work on a specific task. For this project, [docs/plan.md](../../../docs/plan.md) already has a high-level checklist — use this system only if you want finer-grained per-task tracking.
---

# backlog

Browse and work through the project backlog — one markdown file per task under `backlog/`.

> **Note for Duck Store:** the checklist in [docs/plan.md](../../../docs/plan.md) may be enough. Use this `backlog/` system only if you want finer-grained tracking (one file per spec requirement, with status and resolution notes).

## User-invocable

Invoked with `/backlog`. Arguments are optional.

## Routing

| User types                 | Mode                                  |
| -------------------------- | ------------------------------------- |
| `/backlog` (no args)       | **Browse** — list all tasks           |
| `/backlog <number>`        | **Browse** — show item details        |
| `/backlog <status>`        | **Browse** — filter (open/in-progress/completed) |
| `/backlog work <number>`   | **Work** — delegate to backlog-worker |

## File layout

Tasks live in `backlog/` as individual markdown files. Each file has frontmatter with at minimum:

```
---
id: 001
title: Short task title
status: Open | In Progress | Completed
service: warehouse-service | store-service | frontend | infra
---
```

If `backlog/README.md` exists, treat it as the master index (titles + statuses).

## Browse mode (handle directly — no agent)

Use Read, Glob, and Grep yourself. **Do not spawn an agent.**

### List all tasks
1. If `backlog/README.md` exists, read it.
2. Otherwise, glob `backlog/*.md` and grep for `title:` and `status:` in one call.
3. Group by status and display: id, title, status, service.

### Show a specific item
1. Glob `backlog/*<number>*.md`.
2. Read and display the full contents.

### Filter by status
1. Grep `status: <value>` across `backlog/*.md`.
2. Display matches.

Target: **1–2 tool calls** total per browse operation.

## Work mode (delegate to agent)

`/backlog work <number>` uses the backlog-worker agent. Spawn with `subagent_type: "general-purpose"` and instruct it to:

1. Follow the instructions in `.claude/agents/backlog-worker.md`.
2. Work on item `<number>`.
3. Use the `tdd` skill (strict red-green-refactor) for every code change.
4. Get explicit user confirmation before any edits.
