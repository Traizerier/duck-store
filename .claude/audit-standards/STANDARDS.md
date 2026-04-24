# Coding Standards — Duck Store

Per-project configuration for the code auditor. Each project replaces this file with its own standards; everything else under `.claude/audit-standards/` and `.claude/agents/code-auditor.md` stays generic and loads this file at runtime.

---

## Default audit scope

Used when `/audit` is invoked with no path argument.

**Include:**
- `backend/src/`
- `frontend/src/`
- `shared/` (JSON enums)

**Exclude:** `node_modules/`, `dist/`, `build/`, `coverage/`, `.vite/`, generated files, `*.test.*`.

---

## Architecture

Two parallel stacks from one codebase + a shared frontend:

| Component          | Language / Runtime        | Purpose                                                            |
| ------------------ | ------------------------- | ------------------------------------------------------------------ |
| backend (warehouse instance) | Node + Express + MongoDB | schema-driven inventory CRUD + order pipeline (packaging + pricing). Its own Mongo container. |
| backend (store instance)     | Node + Express + MongoDB | same image as warehouse, parameterized by env. Its own Mongo container. |
| frontend           | React + Vite + TypeScript | Two tabs (Warehouse / Store), each pointed at its own backend via Vite's dev proxy. |

**No inter-backend communication.** Each stack is self-contained; orders placed against the warehouse only see warehouse ducks, and vice versa.

See [`../../docs/plan.md`](../../docs/plan.md) for the full plan and pattern rationale.

---

## Cross-cutting rules

- **No secrets in code.** Use `.env` + commit a `.env.example`. Never commit real creds.
- **HTTP boundary validation only.** Validate external inputs at the edge; internal code trusts its own types.
- **Logical deletion.** Reads filter `deleted: false`. Never hard-delete ducks.
- **Logging.** Structured, per-module, with levels VERBOSE/DEBUG/INFO/WARN/ERROR. Shared conventions live in `docs/logging.md`.
- **Design patterns are explicit.** Packaging uses Strategy + Decorator; pricing uses Chain of Responsibility. Don't collapse into procedural `if/else` soup.
- **No magic numbers** in pricing, packaging, or business logic. Named constants in a dedicated module per service.

---

## backend (Node + Express)

- **Naming:** `camelCase` variables/functions, `PascalCase` classes, files either `kebab-case.js` or `camelCase.js` — stay consistent.
- **Modules:** ES modules (`"type": "module"`).
- **Async:** `async/await` only. No bare `.then()` chains; no mixed callback/promise code.
- **Layering:** `routes/` → `services/` → `repos/` → `db/`. Routes do not touch Mongo directly. Repos do not format HTTP responses.
- **Schema-driven inventory:** the generic CRUD subsystem (`src/inventory/`) reads an entity-type schema at boot and builds validation/repo/routes from it. Hardcoding a specific entity's fields outside of `src/schemas/*.json` is a red flag.
- **Error handling:** Services throw domain errors (`ValidationError`, `NotFoundError`). A central error-handling middleware maps them to HTTP status. No `try/catch` that swallows silently. Canonical envelope: `{error: TypedCode, message?, errors?}`.
- **Validation:** At the route boundary only. Internal functions trust their inputs. Schema drives what "valid" means.
- **Design patterns (duck-specific, order pipeline):**
  - Packaging uses Strategy + Decorator (size → material → protections).
  - Pricing uses Chain of Responsibility (ordered rule array mutating a shared context).
- **No magic values.** Discount percentages, surcharges, thresholds are named constants in the module that uses them.
- **Testing:** Table-driven for anything with multiple cases. Real Mongo for repo tests; fake repo for service tests; supertest for route tests.

## frontend (React + TypeScript)

- **Naming:** `PascalCase` component files (`DuckTable.tsx`); `camelCase` hooks prefixed `use` (`useDucks.ts`); `kebab-case` for non-component assets.
- **Components:** Functional only; no classes. One component per file.
- **Data fetching:** Through the typed `ServiceContainer` in `src/services/` (`services.get("warehouseDuck")` etc.). Components never call `fetch` directly.
- **State:** Local `useState` by default. Lift only when two siblings need it. Avoid premature context/reducers.
- **Types:** Co-located with the owning component. Move to `src/types/` only when reused in 2+ places.
- **Styling:** One approach — don't mix CSS modules, Tailwind, and inline styles.
- **`any` is a smell.** If you reach for `any`, document why.

---

## Error handling (all services)

- **No silent swallowing.** Every caught error is re-thrown with context, logged with enough info to debug, or returned as a typed failure.
- **Validate at system boundaries** (HTTP input, DB reads, external API responses). Trust internal types.
- **Log values with errors.** An error message without the offending value is half-useless.

## Complexity thresholds

- Functions > 80 lines are suspect.
- Files > 500 lines are suspect.
- Functions with > 5 parameters are suspect.
- Nesting > 4 levels inside a single function is suspect.
- Types with many public methods (god classes) are suspect.

## Dead code

- Unused exports, commented-out blocks > 5 lines, and feature flags that always resolve the same way should be removed, not kept "just in case."

## Testing

- TDD (red-green-refactor) is the default — see [`.claude/skills/tdd/SKILL.md`](../skills/tdd/SKILL.md).
- Pure logic → unit tests. HTTP handlers → Supertest (Node) / `httptest` (Go). React components → React Testing Library.
- Tests should be explicit over clever. Readability > DRY in tests.

## Documentation

- Each service has a `README.md` covering install, run, test, and environment variables.
  The backend README also includes a short design-pattern summary (Strategy + Decorator
  for packaging, Chain of Responsibility for pricing).
- `docs/plan.md` is the master plan.
- `docs/logging.md` captures cross-language logging conventions.
- Spec assumptions live either in the service README or `docs/assumptions.md`.
