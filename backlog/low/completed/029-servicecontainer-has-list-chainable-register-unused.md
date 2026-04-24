---
id: 029
title: ServiceContainer.has / list / chainable register are test-only scaffolding
status: Completed
severity: low
service: warehouse-service
promoted_from: P030
---

# 029: `ServiceContainer.has()`, `.list()`, and chainable `register()` are test-only scaffolding

**Found by:** Dead Code
**Related to:** 020 (same pattern: base/scaffolding code whose only callers are its own tests — 020's resolution chose "make it live" over "delete"; this finding flags the parallel case for the Node side)

## Description
`warehouse-service/src/container.js` exports four public methods on `ServiceContainer`: `register`, `get`, `has`, `list`. A project-wide grep for each:

- `register` — 1 production call site (`server.js:20`) + 1 test-app wiring site (`app.test.js:27`).
- `get` — 1 production call site (`app.js:14`).
- **`has`** — 0 production call sites; only `container.test.js:25-27` (the test for itself).
- **`list`** — 0 production call sites; only `container.test.js:34`.
- **`register` chainability** (the `return this` on `container.js:20`) — 0 production call sites; only `container.test.js:38-41`.

The class doc comment says *"The container exists so adding the next service (e.g. 'order') is a one-line change in server.js."* That's true of `register` and `get`. `has`, `list`, and the chainable return were added speculatively — there is no caller today that introspects the container. STANDARDS.md (Dead code): *"Unused exports ... and feature flags that always resolve the same way should be removed, not kept 'just in case.'"* Three public methods exist with no consumer outside the test file that verifies them.

This is the same structural pattern ticket 020 flagged on the Go `service.BaseService.Name()`: scaffolding whose tests were the only consumers. That ticket chose "make it live" over "delete" because the user had committed to cross-stack symmetry. Here there is no symmetric consumer on either of the other two services — Go's `service.BaseService` has no container, and the frontend uses a plain object singleton (`services/index.ts`) — so "make it live" has no paired usage to justify.

## Impact
- Three test cases (`.has()`, `.list()`, chainable `register()`) enforce contracts no caller exercises. A future reader modifying `ServiceContainer` has to preserve behaviors that are inert in production.
- Small maintenance drag: the tests are 12 lines in a 48-line test file, i.e. a quarter of the container's tests guard unused surface.
- The chainable `register()` return also invites a `container.register(a).register(b)` style nobody has adopted — a small consistency trap.

## Affected Files
- `warehouse-service/src/container.js:20` — `return this` in `register()`, unused chainability.
- `warehouse-service/src/container.js:30-32` — `has(name)` method.
- `warehouse-service/src/container.js:34-36` — `list()` method.
- `warehouse-service/src/container.test.js:23-28` — test for `has()`.
- `warehouse-service/src/container.test.js:30-35` — test for `list()`.
- `warehouse-service/src/container.test.js:37-41` — test for chainable return.

## Suggested Fix
Two options, pick one:

1. **Delete `has`, `list`, and the `return this` from `register`**, and remove the three corresponding test cases. The container shrinks to `register(name, svc)` / `get(name)` — exactly what the two production call sites use. Net: -15 lines across two files.

2. **Keep the methods but drop the tests for them.** If you want the introspection surface available for the next service (e.g. a future `/health` handler that lists registered services), leave the methods defined but delete the tests — a test that isn't anchored to a production caller is just extra wire. Worse than option 1 for signal.

Option 1 is cleaner. The methods can be re-added in one line each if a caller ever materializes — which is the same reasoning ticket 016 used when it deleted `Duck.save()` rather than preserving it for a hypothetical consumer.

## Resolution

**Completed:** 2026-04-23

Chose option 1 — deleted the unused surface. Parallels ticket 016's reasoning: the methods are cheap to re-add if a caller shows up, but carrying them (and their tests) for a hypothetical consumer is net-negative today.

**Diverged from ticket 020's outcome intentionally.** Ticket 020 (Go `BaseService.Name()`) chose "make it live" because the user had explicitly chosen cross-stack symmetry and because there was a clean landing site for `Name()` in the init-log + `ErrInternal` log. Here neither applies: `has`/`list` don't have a symmetric consumer on the Go or frontend side, and the chainable `return this` adds no capability that `register(...); register(...)` doesn't already provide.

**Changes (2 files):**

- `warehouse-service/src/container.js` — removed `has()`, `list()`, and the `return this` tail from `register()`. Container now has exactly two methods: `register(name, service)` and `get(name)`.
- `warehouse-service/src/container.test.js` — removed the three tests for the deleted surface. Container now has 4 tests (register/get happy path + duplicate/missing-name guards).

**Verification:** `npm test -- --run` — 103 tests pass (was 106; −3 for the removed scaffolding tests). The remaining two production call sites (`server.js` register + `app.js` get) work unchanged.
