---
name: tdd
description: Implement a feature or fix using strict Test-Driven Development (red-green-refactor). Use when asked to implement, add, build, fix, or create anything that involves writing code.
argument-hint: [description of what to implement]
---

Implement the following using strict Test-Driven Development: $ARGUMENTS

Duck Store is a microservices project with three codebases. Pick the right conventions for the service you're touching:

| Service            | Stack              | Test runner                     | Test file pattern | Notes                                      |
| ------------------ | ------------------ | ------------------------------- | ----------------- | ------------------------------------------ |
| warehouse-service  | Node + Express     | Vitest + Supertest              | `*.test.js`       | `mongodb-memory-server` for DB tests       |
| store-service      | Go                 | `go test` (stdlib)              | `*_test.go`       | Table-driven tests; `httptest` for HTTP    |
| frontend           | React + Vite + TS  | Vitest + React Testing Library  | `*.test.ts(x)`    | MSW for API mocks; `user-event` for input  |

YOU MUST follow this exact sequence. Do NOT skip or combine steps.

## Phase 1: UNDERSTAND
1. Identify which service the change belongs to.
2. Read the relevant source files to understand existing patterns.
3. Read sibling tests for naming, fixtures, and mocking conventions.
4. Decide the test layer:
   - **Pure logic** (packaging rules, pricing rules) → unit tests, no mocks
   - **HTTP handlers** → integration test with Supertest (Node) or `httptest.NewRecorder` (Go)
   - **DB repos** (Node) → `mongodb-memory-server`
   - **React components** → RTL + `user-event`; mock network with MSW
5. Note any assumptions from [../../docs/plan.md](../../../docs/plan.md) that this task touches (e.g., discount ordering).

## Phase 2: RED (write failing tests + stubs)
1. Create the test file next to the code it tests (or in the service's conventional test directory).
2. Use Arrange-Act-Assert. Test happy path AND at least one failure/edge case.
3. Naming:
   - **Go:** `TestFunction_Scenario_Expected` — e.g. `TestCalculatePrice_VolumeOver100_Applies20PctDiscount`
   - **Node / React (Vitest):** `describe("unit", () => { it("should <behavior> when <scenario>", ...) })`
4. **Stub every module/symbol the tests reference** so the test suite loads and each test actually runs. Stubs export the expected signatures but return placeholder values guaranteed to fail the assertions (e.g. `{ valid: false, errors: {} }` when tests expect varied results). Goal: N tests execute, N fail on assertions. A "module not found" or compile error is scaffolding incomplete, not valid RED.
5. Run the tests and confirm they FAIL — ideally every test fails, each with an assertion-level failure.

Report to the user:
> "RED: [N] tests written, all failing. [paste key failing output]. Proceed to GREEN?"

Wait for a short confirmation (e.g. "go", "proceed") before continuing.

## Phase 3: GREEN (minimum implementation)
1. Write the MINIMUM code needed to make the tests pass.
2. Do NOT add anything beyond what the tests require.
3. Do NOT refactor yet — ugly code that passes tests is fine.
4. Do NOT add error handling, logging, or extra features not driven by a test.
5. Run the tests and confirm they PASS.

Report to the user:
> "GREEN: [N] tests passing. Proceed to REFACTOR?"

Wait for confirmation.

## Phase 4: REFACTOR
1. Clean up while keeping tests green.
2. Extract duplication, rename for clarity, tighten types, add brief docstrings on exported APIs.
3. Apply stack idioms:
   - **Go:** `if err != nil` returns, small interfaces, lowercase package names, exported `PascalCase` / unexported `camelCase`.
   - **Node:** `async/await`, thin route handlers delegating to services, services throwing domain errors caught at the boundary.
   - **React:** functional components only, custom hooks named `useX`, co-locate types with components.
4. Do NOT add new functionality — only improve existing code.
5. Run the tests one last time.

Report:
> "REFACTOR: tests still passing. Summary: [1–2 sentences on what was implemented]."

## Phase 5: REVIEW
1. Verify test naming follows the conventions above.
2. Verify no untested public behavior was introduced.
3. Note edge cases discovered but not covered (suggest as follow-ups — don't implement).
4. Mention any spec ambiguities that were resolved by assumption.
