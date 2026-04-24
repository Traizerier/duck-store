---
id: 035
title: frontend/README.md still documents the pre-pivot single-warehouse architecture
status: Completed
severity: medium
service: frontend
promoted_from: P037
---

# 035: `frontend/README.md` still documents the pre-pivot single-warehouse architecture

**Found by:** Architecture (documentation drift), Consistency
**Related to:** 015 (prior README drift in services/models split — resolved); body written against the current per-stack-frontend architecture (not the intermediate two-tab shape).

## Description

`frontend/README.md` still describes the UI from two architectures ago. Drift has accumulated in layers:

- **Layer 1 (pre-pivot):** the doc was written when the frontend talked to one warehouse backend (no store concept in the UI).
- **Layer 2 (never written down):** the intermediate two-tab world where the single frontend switched between `services.get("warehouseDuck")` and `services.get("storeDuck")` via a proxy rewrite.
- **Layer 3 (current):** each stack is `{mongo, backend, frontend}` and the frontend talks to exactly one backend. Stack identity (title, instance chip) arrives as `VITE_TITLE` / `VITE_INSTANCE` at build/boot time. There are no tabs.

Concrete drift in the file today:

1. **[frontend/README.md:3](../../../frontend/README.md)** — *"React + TypeScript UI for the warehouse module. Calls the warehouse API through Vite's dev proxy…"* — the UI isn't warehouse-specific; it's a single inventory page parameterized per stack.
2. **[frontend/README.md:27](../../../frontend/README.md)** — *"`services/index.ts   # services singleton — extension point for future services"* — still correct in spirit, but hasn't been updated to reflect the new typed `ServiceRegistry` pattern (see `frontend/src/services/ServiceContainer.ts:7-9`).
3. **[frontend/README.md:33-34](../../../frontend/README.md)** — Layout references `pages/Warehouse.tsx` with the comment *"wires table + form + delete + error state via `services.duck`"*. The page is now `frontend/src/pages/Inventory.tsx`, and the service lookup is `services.get("duck")`.
4. **[frontend/README.md:39](../../../frontend/README.md)** — *"App.tsx   # tab bar + Warehouse page"* — App.tsx has no tab bar. It renders the instance chip (from `VITE_INSTANCE`), the locale toggle, and `<Inventory />`. One backend, one page.
5. **[frontend/README.md:45-47](../../../frontend/README.md)** — The "Service + model split" paragraph talks to `services.duck.list()` / `services.duck.create(input)`. Current code uses `services.get("duck")`.
6. **[frontend/README.md:48](../../../frontend/README.md)** — *"`/api/*` → `http://warehouse:4001`"* — the actual proxy target is `http://backend:4001`. Each compose project has its own `backend` service name; "warehouse" isn't a DNS name any more, it's a compose project label.
7. **[frontend/README.md:53](../../../frontend/README.md)** — Tests paragraph points at `pages/Warehouse.test.tsx` (doesn't exist; current file is `pages/Inventory.test.tsx`) and omits `services/ServiceContainer.test.ts`.

## Impact

- A reviewer reading the frontend README and then opening the running UI sees something completely different — no tabs, no "warehouse module" framing. Worse than straight drift: the doc argues an architectural shape that was never shipped.
- `services.duck` as a property access pattern has been gone twice now (015 closed one instance, this is the second). README references lag code recurrently enough to catch here.
- The proxy target is the one part that can actually break a dev loop. `http://warehouse:4001` was briefly right in the two-tab intermediate; `http://backend:4001` is the current truth. A dev who copy-pastes the README's example gets DNS failure.

## Affected Files

- `frontend/README.md:3` — "warehouse module" intro.
- `frontend/README.md:27` — services singleton comment.
- `frontend/README.md:33-34` — Layout names `pages/Warehouse.tsx` + `services.duck`.
- `frontend/README.md:39` — App.tsx described as "tab bar + Warehouse page".
- `frontend/README.md:45-47` — Design notes still reference `services.duck`.
- `frontend/README.md:48` — Vite proxy target names a service that no longer exists.
- `frontend/README.md:53` — Tests paragraph names the old Warehouse test file.

## Suggested Fix

1. **Intro (line 3):** "React + TypeScript UI for a single backend stack. Each stack (warehouse, store) builds the same frontend image with its own `VITE_TITLE` / `VITE_INSTANCE`, so the UI is branded per instance without knowing the stack concept in code."
2. **Layout:** rename `pages/Warehouse.tsx` → `pages/Inventory.tsx`; add `services/ServiceContainer.ts`; update the services comment to mention the typed `ServiceRegistry`.
3. **App.tsx line:** drop "tab bar"; describe the instance chip + locale toggle + single `<Inventory />` render.
4. **Key design notes — service + model split:** replace every `services.duck.*` reference with `services.get("duck")`. Call out `ServiceRegistry` as the extension point.
5. **Key design notes — Vite proxy:** describe the actual target: `/api/* → http://backend:4001` on each stack's own compose network.
6. **Key design notes — branding:** new bullet. *"`VITE_TITLE` sets the page `<h1>`; `VITE_INSTANCE` is rendered as a small chip near the locale toggle. Both come from the per-stack `.env.<name>` at compose time."*
7. **Tests:** rename `pages/Warehouse.test.tsx` → `pages/Inventory.test.tsx`; add `services/ServiceContainer.test.ts`. Point at `bash run.sh test <stack>` for live counts.

## Resolution

Rewrote `frontend/README.md` end-to-end to describe the current per-stack architecture:

- Intro reframed as "React + TypeScript UI for a single backend stack," with `VITE_TITLE` / `VITE_INSTANCE` called out as the branding mechanism.
- Run section updated to use `bash run.sh up warehouse` / `bash run.sh test warehouse frontend` and listed the warehouse/store dev server ports (5173 / 5174).
- Layout tree renamed `pages/Warehouse.tsx` → `pages/Inventory.tsx`, added `services/ServiceContainer.ts`, updated the services comment to reference the `"duck"` key registration.
- Service + model split paragraph now uses `services.get("duck")` throughout; added the `ServiceRegistry` extension-point note.
- Vite proxy bullet describes the actual target `http://backend:4001` on each stack's own compose network, and calls out that "warehouse vs store" is a compose project label, not a DNS name.
- New "Per-stack branding" bullet documenting `VITE_TITLE` / `VITE_INSTANCE`.
- Tests paragraph renamed `Warehouse.test.tsx` → `Inventory.test.tsx`, added `services/ServiceContainer.test.ts`, and points at `bash run.sh test <stack> frontend` for live counts.
