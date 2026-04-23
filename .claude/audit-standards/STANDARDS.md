# Coding Standards — Duck Store

Per-project configuration for the code auditor. Each project replaces this file with its own standards; everything else under `.claude/audit-standards/` and `.claude/agents/code-auditor.md` stays generic and loads this file at runtime.

---

## Default audit scope

Used when `/audit` is invoked with no path argument.

**Include:**
- `warehouse-service/src/`
- `store-service/` (excluding `vendor/`)
- `frontend/src/`

**Exclude:** `node_modules/`, `dist/`, `build/`, `coverage/`, `.vite/`, generated files, `*.test.*`, `*_test.go`.

---

## Architecture

Three-service microservices project:

| Service            | Language / Runtime        | Purpose                                                |
| ------------------ | ------------------------- | ------------------------------------------------------ |
| warehouse-service  | Node + Express + MongoDB  | Duck CRUD; source of truth for inventory               |
| store-service      | Go                        | Order endpoint: packaging (Strategy) + pricing (Chain) |
| frontend           | React + Vite + TypeScript | Warehouse UI                                           |

Mongo is owned by warehouse-service. store-service communicates with warehouse over HTTP — **no shared DB access across services**.

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

## warehouse-service (Node + Express)

- **Naming:** `camelCase` variables/functions, `PascalCase` classes, files either `kebab-case.js` or `camelCase.js` — pick one per service and stay consistent.
- **Modules:** ES modules or CommonJS — pick one (`"type": "module"` or not) and stay consistent.
- **Async:** `async/await` only. No bare `.then()` chains; no mixed callback/promise code.
- **Layering:** `routes/` → `services/` → `repos/` → `db/`. Routes do not touch Mongo directly. Repos do not format HTTP responses.
- **Error handling:** Services throw domain errors (with a code/type). A central error-handling middleware maps them to HTTP status. No `try/catch` that swallows silently.
- **Validation:** At the route boundary only (e.g. zod/joi). Internal functions trust their inputs.
- **Enums:** Color (Red/Green/Yellow/Black) and Size (XLarge/Large/Medium/Small/XSmall) come from a shared constants module — never inlined.

## store-service (Go)

- **Naming:** Packages lowercase single-word. Exported `PascalCase`, unexported `camelCase`. Files `snake_case.go`.
- **Errors:** `if err != nil { return ..., err }`. Wrap at layer boundaries with `fmt.Errorf("context: %w", err)`. Never ignore an error without a comment explaining why.
- **Interfaces:** Defined by the consumer (small, 1–3 methods). Concrete types at the package boundary.
- **Layering:** `cmd/server` wires dependencies. `internal/order` owns the HTTP handler. `internal/packaging` and `internal/pricing` are pure logic. `internal/warehouse` is the outbound HTTP client.
- **Design patterns:**
  - Packaging strategies implement a common `PackagingStrategy` interface; decorators wrap them for protection materials.
  - Pricing rules implement a `Rule` interface and compose in an explicit, documented order.
- **No magic values.** Discount percentages, surcharges, and thresholds are named constants.
- **Testing:** Table-driven tests for anything with multiple cases (all pricing rules, packaging rules).

## frontend (React + TypeScript)

- **Naming:** `PascalCase` component files (`DuckTable.tsx`); `camelCase` hooks prefixed `use` (`useDucks.ts`); `kebab-case` for non-component assets.
- **Components:** Functional only; no classes. One component per file.
- **Data fetching:** Through a typed client in `src/api/`. Components never call `fetch` directly.
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

- Each service has a `README.md` covering install, run, test, environment variables, and (for store-service) a short design-pattern summary.
- `docs/plan.md` is the master plan.
- `docs/logging.md` captures cross-language logging conventions.
- Spec assumptions live either in the service README or `docs/assumptions.md`.
