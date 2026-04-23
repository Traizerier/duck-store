---
name: audit
description: Run a code audit to discover potential backlog items. Dispatches specialized sub-agents to find duplication, dead code, complexity, error handling, consistency, and architecture issues.
---

# audit

Run a code audit against the project's coding standards. Findings are written to `backlog/proposed/` for human review.

**Per-project configuration:** [`.claude/audit-standards/STANDARDS.md`](../../audit-standards/STANDARDS.md). That file defines the default scope, architecture, and rules the audit checks against. The skill, agent, and briefing template are all stack-agnostic — only `STANDARDS.md` is project-specific.

## User-invocable

Invoked with `/audit`. Arguments are optional.

## Instructions

Parse the user's argument and delegate to the code-auditor agent.

### Routing

| User types                                | Action                                                           |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `/audit` (no args)                        | Audit the default scope from `STANDARDS.md` (all specialists)    |
| `/audit <path>`                           | Audit the specified directory only (all specialists)             |
| `/audit <specialist>`                     | Run only that specialist across the default scope                |
| `/audit <specialist> <path>`              | Run that specialist against a specific path                      |

### Specialist keywords

Accept case-insensitively: `duplication`, `dead-code`, `complexity`, `error-handling`, `consistency`, `architecture`.

### Execution

Use the Agent tool with `subagent_type: "general-purpose"` and include:

1. Tell the agent to follow the instructions in [`.claude/agents/code-auditor.md`](../../agents/code-auditor.md).
2. Pass the scope (a directory path, `all`, or a specialist name — plus an optional path for specialist + scope combinations).
3. Include: "Write all proposed items to `backlog/proposed/`. Report a summary when done."

Do not set `max_turns` or override the model.

### After the agent completes

Display the summary to the user:
- Number of proposed items created
- Breakdown by severity and specialist
- List of proposed item IDs and titles
- Remind: "Use `/backlog proposed` to review findings, or `/backlog promote <ID>` to move items to the active backlog."
