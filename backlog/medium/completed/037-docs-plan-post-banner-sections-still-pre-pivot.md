---
id: 037
title: docs/plan.md — banner is current but API/patterns/frontend/order-of-work sections describe a superseded architecture
status: Completed
severity: medium
service: docs
promoted_from: P039
---

# 037: `docs/plan.md` — banner is current but API/patterns/frontend/order-of-work sections describe a superseded architecture

**Found by:** Architecture (documentation drift)
**Related to:** 009 (prior plan.md layout drift — resolved); 021 (prior plan.md test counts — resolved). Body diffs against the current per-stack architecture.

## Description

`docs/plan.md:5-11` has an "Architecture update (2026-04)" banner explaining that the Node-warehouse + Go-store split was collapsed into two instances of the same schema-driven Node backend. The banner and the "Architecture" table immediately below it (`docs/plan.md:13-26`) are both current — *except* for the frontend row, which still describes the intermediate two-tab shape. Every section below the architecture table is stale.

Concrete drift:

1. **docs/plan.md:19** (Architecture table, frontend row) — *"Two tabs (Warehouse / Store), each pointed at its own backend via the Vite proxy. Bilingual i18n."* — the two-tab world was the transitional shape, not the current one. Each stack now ships its own frontend pointed at its own backend. Title comes from `VITE_TITLE` at build time. No tabs, no cross-stack proxy.
2. **docs/plan.md:85-106** — *"## API surface"* — two sub-sections under *"### Warehouse service (Node, port 4001)"* and *"### Store service (Go, port 4002)"*:
   - Store isn't Go; both stacks run the same Node image.
   - 4001 / 4002 are the *host* ports; inside the container both listen on 4001. The port-per-service framing misleads.
   - `docs/plan.md:95` lists `GET /api/ducks/lookup?color=&size=` as *"internal: fetch price for Store"* — STANDARDS.md explicitly says "No inter-backend communication." The lookup is a general helper.
3. **docs/plan.md:110, 116** — Design-pattern subsection headings *"### Packaging (Strategy + Decorator) — Go"* and *"### Pricing (Chain of Responsibility / Pipeline) — Go"*. The code is now JS under `backend/src/packaging/` and `backend/src/pricing/`. Body text mentions `WoodPackaging`, `ProtectionDecorator`, `PriceContext` — Go-style type names for code that doesn't exist.
4. **docs/plan.md:128-135** — Frontend section:
   - *"Single page: header tabs (Warehouse active, Store stub), …"* — no tabs.
   - *"Only talks to warehouse-service. No frontend code for Store module (spec: 'backend only')."* — post-pivot each stack has its own frontend that talks only to its own backend.
5. **docs/plan.md:139-149** — "Order of work" checkboxes cite work that didn't ship or was superseded (Go scaffold, Packaging in Go, Store → Warehouse HTTP client, etc.).
6. **docs/plan.md:162-164** — *"## Fallback plan"* describes what actually happened but is still framed as hypothetical contingency, not shipped reality.

## Impact

- STANDARDS.md names `docs/plan.md` (line 102) as *"the master plan."* A master plan whose API tables, pattern headings, and order-of-work checklist contradict its own 2026-04 banner undermines the banner AND the document.
- The "internal: fetch price for Store" row at line 95 actively contradicts STANDARDS.md's "No inter-backend communication." Two load-bearing governance docs disagreeing about the architecture is worse than either being merely stale.
- Order-of-work checkboxes carry weight during an interview-read: they read as *"here's what was done."* A reader parsing them today thinks a Store → Warehouse Go HTTP client is live in tree.

## Affected Files

- `docs/plan.md:19` — Architecture table, frontend row ("Two tabs").
- `docs/plan.md:85-95` — Warehouse-service API subsection + the `/api/ducks/lookup` "for Store" note.
- `docs/plan.md:99-106` — Store-service API subsection + (Go, port 4002) heading.
- `docs/plan.md:108-126` — Design pattern subsections with Go type names and `— Go` suffixes.
- `docs/plan.md:128-135` — Frontend section describing Store as stub.
- `docs/plan.md:139-149` — Order of work checkboxes.
- `docs/plan.md:162-164` — Fallback plan as hypothetical.

## Suggested Fix

1. **Architecture-table frontend row (line 19):** rewrite to *"Per-stack single-page inventory UI. Same codebase built twice, branded via `VITE_TITLE` / `VITE_INSTANCE` at build time. No tabs, no cross-stack routing."*
2. **API surface (lines 85-106):** collapse the two subsections into one *"### API surface (per backend instance)"* table mirroring `backend/README.md`'s endpoints. Drop the "internal: fetch price for Store" language on the lookup row.
3. **Design patterns (lines 110-126):** drop `— Go` from headings. Point "where the code lives" at `backend/src/packaging/packaging.js` and `backend/src/pricing/pricing.js`. Type names in prose become JS factory names matching the current code.
4. **Frontend section (lines 128-135):** rewrite to describe the per-stack frontend. Single page, typed `ServiceContainer`, `VITE_TITLE`-branded header.
5. **Order of work (lines 139-149):** preserve as historical with a banner: *"Historical checklist — items below reflect the original Node+Go plan. Post-pivot work (2026-04) is tracked in the backlog."* Or strike through the Go-specific lines and replace with a single pivot line.
6. **Fallback plan (lines 162-164):** delete or rename to *"## What actually shipped"* and rewrite in past tense.

## Resolution

Rewrote every post-banner section of `docs/plan.md`:

- **Architecture-table frontend row:** changed from "Two tabs (Warehouse / Store)" to "Per-stack single-page inventory UI. Same codebase built twice, branded via `VITE_TITLE` / `VITE_INSTANCE` at build time. No tabs, no cross-stack routing."
- **Repo layout `pages/` line:** changed from "Warehouse.tsx, Store.tsx" to "Inventory.tsx (single page, branded per stack)".
- **API surface:** collapsed the two subsections ("Warehouse service (Node, port 4001)" / "Store service (Go, port 4002)") into one "## API surface (per backend instance)" table covering all of ducks CRUD + lookup + orders + health. Dropped the "internal: fetch price for Store" language on the lookup row and the "Store isn't Go" framing.
- **Design patterns:** dropped `— Go` suffixes from both headings, replaced Go-style type names (`WoodPackaging`, `PriceContext`, etc.) with the current Node code pointers (`backend/src/packaging/packaging.js`, `backend/src/pricing/pricing.js`).
- **Frontend section:** rewrote to describe the per-stack build, `VITE_TITLE` / `VITE_INSTANCE` branding, typed `ServiceContainer` with the `"duck"` key. Explicitly notes the React code doesn't branch on stack identity.
- **Order of work:** added a "Historical checklist" banner; struck through the three Go-specific items with `~~...~~` plus trailing notes pointing at the ported Node locations or the architectural decision that superseded them; added a final "2026-04 pivot" line summarizing what shipped.
- **Tests paragraph:** updated to `bash run.sh test <stack>` and dropped the `httptest.NewServer`-backed warehouse-client tests (those were Go; no longer exist).
- **Fallback plan:** renamed to "What actually shipped" and rewrote in past tense — the dual-Node architecture is the shipped outcome, not a contingency.
