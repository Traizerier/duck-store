---
name: backlog
description: Browse and work through the project backlog — one markdown file per task under `backlog/`. Items are organized by severity folder (critical / high / medium / low), and each severity has its own active and completed subfolders.
---

# backlog

Browse and work through the project backlog — one markdown file per task.

## Directory layout

```
backlog/
├── proposed/                    # audit findings awaiting triage
│   └── P###-slug.md             # P-prefixed IDs from /audit
├── critical/
│   ├── active/                  # open or in-progress critical items
│   └── completed/               # closed critical items, kept for history
├── high/
│   ├── active/
│   └── completed/
├── medium/
│   ├── active/
│   └── completed/
└── low/
    ├── active/
    └── completed/
```

**ID convention:** proposed items carry the `P###` prefix from `/audit`. On promotion, drop the `P` and assign a sequential number across the severity's active/completed folders (e.g. `P001` → `001`).

**Status flow:**

```
/audit                →  proposed/P###-slug.md
/backlog promote ...  →  <severity>/active/###-slug.md
/backlog work ...     →  delegates to backlog-worker; on success moves to <severity>/completed/###-slug.md
```

## User-invocable

Invoked with `/backlog`. Arguments are optional.

## Routing

| User types                  | Mode                                                             |
| --------------------------- | ---------------------------------------------------------------- |
| `/backlog` (no args)        | **Browse** — list everything grouped by severity + active/completed |
| `/backlog proposed`         | **Browse** — list items in `proposed/` awaiting promotion        |
| `/backlog <severity>`       | **Browse** — filter by severity (critical / high / medium / low) |
| `/backlog active`           | **Browse** — list only active items across all severities        |
| `/backlog completed`        | **Browse** — list only completed items across all severities     |
| `/backlog <number>`         | **Browse** — show a specific item (globs `backlog/**/*<number>*.md`) |
| `/backlog promote <ID>`     | **Promote** — move `proposed/P###` → `<severity>/active/###`     |
| `/backlog work <number>`    | **Work** — delegate to backlog-worker agent                      |

## Browse mode (handle directly — no agent)

Use Read, Glob, and Grep yourself. **Do not spawn an agent.** Target: 1–2 tool calls per operation.

- **List everything:** glob `backlog/**/*.md`. Group each file by the two path segments immediately above the filename (e.g. `high/active/` vs `high/completed/`).
- **List proposed:** glob `backlog/proposed/*.md`.
- **List by severity:** glob `backlog/<severity>/active/*.md backlog/<severity>/completed/*.md`.
- **List active/completed across severities:** glob `backlog/*/active/*.md` or `backlog/*/completed/*.md`.
- **Show one item:** glob `backlog/**/*<number>*.md`, then Read.

## Promote mode (handle directly — no agent)

1. Glob `backlog/proposed/P<number>*.md` to find the file.
2. Read the frontmatter to get severity (`**Proposed severity:** <level>` — may also be in `severity:` frontmatter field).
3. Assign a sequential number based on the highest existing ID across all severities' active/completed folders.
4. Create `backlog/<severity>/active/<new-id>-<slug>.md` with:
   - Frontmatter: `id`, `title`, `status: Open`, `severity`, `promoted_from: P<original>`
   - The original Description / Impact / Affected Files / Suggested Fix sections
5. Delete the source file from `backlog/proposed/`.

## Work mode (delegate to agent)

`/backlog work <number>` uses the backlog-worker agent. Spawn with `subagent_type: "general-purpose"` and instruct it to:

1. Follow the instructions in `.claude/agents/backlog-worker.md`.
2. Work on item `<number>` — the agent globs `backlog/**/*<number>*.md` to locate it.
3. Use the `tdd` skill (strict red-green-refactor) for every code change.
4. Get explicit user confirmation before any edits.
5. On completion, move the file from `<severity>/active/` to `<severity>/completed/` (preserve severity and filename) and append a `## Resolution` section.
