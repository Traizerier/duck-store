# Duck Store — Interview Plan

Spec: [../design.md](../design.md) · Mockup: [../Screenshot 2026-04-22 100134.png](../Screenshot%202026-04-22%20100134.png)

> **Architecture update (2026-04):** the original Node-warehouse + Go-store split
> was collapsed after reviewer feedback. Warehouse and store are now **separate
> concerns** — each owns its own duck inventory and pricing, no HTTP link
> between them. Both run as **two instances of the same schema-driven Node
> backend**, each with its own Mongo container and database. The sections
> below have been rewritten to match; earlier drafts (Go store, HTTP coupling,
> "fallback plan" referring to Go slipping) are preserved in git history.

## Architecture: two parallel stacks, one schema-driven backend

| Component    | Stack                         | Owns                                                                 |
| ------------ | ----------------------------- | -------------------------------------------------------------------- |
| **backend**  | Node + Express + MongoDB      | schema-driven inventory CRUD + order pipeline (packaging + pricing). Deployed **twice** — warehouse instance + store instance — from the same image. |
| **mongo ×2** | Mongo 7                       | one container per backend instance, own volume. Data isolated by container, not by database name. |
| **frontend** | React + Vite + TypeScript     | Per-stack single-page inventory UI. Same codebase built twice, branded via `VITE_TITLE` / `VITE_INSTANCE` at build time. No tabs, no cross-stack routing. Bilingual i18n. |

**Why this split works:**
- Warehouse and store model the same concern (duck inventory + pricing), so the code is shared verbatim. Differences are runtime — database, instance name, port.
- Schema-driven backend: adding a third stack ("frogs") is a new `schemas/frog.json` + a new compose entry. No JS changes.
- Two Mongo containers is the honest answer to "truly independent data" — `docker compose down -v warehouse-mongo` doesn't touch store's data.

**No inter-service communication.** Each stack is self-contained. Orders on the warehouse side only know about the warehouse's ducks; orders on the store side only know about the store's ducks.

## Stack decision

Single Node + Express + MongoDB backend. Originally the plan had a Node warehouse + Go store split for learning + scope reasons; reviewer feedback made the two sides into parallel instances of the same code, so the language split became redundant and was collapsed to Node.

## Ambiguities to clarify (or note as assumptions in README)

1. **Price on add** — spec says the add form collects "Color, Size, and Quantity" but the merge rule keys on "price, color, and size." Assumption: the form also collects price (the mockup shows a price column, and otherwise the merge rule is meaningless).
2. **ID = Integer** — Mongo's `_id` is ObjectId by default. Use a `counters` collection with `findOneAndUpdate $inc` for auto-increment ints. Call this out.
3. **Order endpoint & stock** — spec doesn't say whether an order decrements warehouse quantity. Implement it (obvious behavior) but note.
4. **Discount order** — "greater than 100 units, apply 20% discount to the total cost" reads as applied before material/country percentages. Flag if unsure.

## Repo layout

```
duck-store/
├── backend/                            # Node + Express (deployed twice)
│   ├── src/
│   │   ├── schemas/
│   │   │   ├── Schema.js               # loader + accessor
│   │   │   └── duck.json               # today's only entity type
│   │   ├── inventory/                  # schema-driven CRUD subsystem
│   │   │   ├── repo.js
│   │   │   ├── service.js
│   │   │   ├── validator.js
│   │   │   └── routes.js
│   │   ├── packaging/                  # Strategy + Decorator (duck-specific)
│   │   ├── pricing/                    # Chain of Responsibility
│   │   ├── order/                      # OrderService (schema-aware lookup)
│   │   ├── db/mongo.js                 # connect + counters
│   │   ├── services/BaseService.js
│   │   ├── container.js
│   │   ├── app.js
│   │   ├── server.js
│   │   └── errors.js
│   └── package.json
├── frontend/                           # React + Vite (unchanged in shape)
│   ├── src/
│   │   ├── services/                   # ServiceContainer + DuckService(basePath)
│   │   ├── models/Duck.ts
│   │   ├── components/                 # DuckTable, DuckForm
│   │   └── pages/                      # Inventory.tsx (single page, branded per stack)
│   └── package.json
├── shared/enums.json                   # color/size enums; schemas reference by name
└── docker-compose.yml                  # 2× {backend, mongo} stacks + frontend
```

## Data model (MongoDB, one database per backend instance)

```
ducks:    { _id: int, color, size, price, quantity, deleted: bool }
counters: { _id: "duck", seq: int }   // name keyed by schema.name
```

Each backend container runs against its own Mongo container, so warehouse's ducks and store's ducks are in parallel `ducks` collections in parallel databases — not intermingled.

Index: `{ color:1, size:1, price:1, deleted:1 }` — makes merge-on-add lookup cheap. Every read filters `deleted: false`.

## API surface (per backend instance)

Both stacks expose the same routes against their own Mongo. Container-internal port is `:4001`; host ports differ (warehouse `:4001`, store `:4002` — set in `.env.<stack>`).

| Method | Path                              | Purpose                                                 |
| ------ | --------------------------------- | ------------------------------------------------------- |
| GET    | `/api/ducks`                      | list (sorted by quantity)                               |
| POST   | `/api/ducks`                      | create-or-merge                                         |
| PATCH  | `/api/ducks/:id`                  | update price + quantity only                            |
| DELETE | `/api/ducks/:id`                  | logical delete (set deleted=true)                       |
| GET    | `/api/ducks/lookup?color=&size=`  | general attribute-based lookup (first active match)     |
| POST   | `/api/orders`                     | package + price calculation against this stack's ducks  |
| GET    | `/health`                         | `{ ok, instance, type }` — instance label identifies stack |

`POST /api/ducks` logic: `findOneAndUpdate({color,size,price,deleted:false}, {$inc:{quantity:N}})` with upsert. On upsert, assign a new id from `counters`.

`POST /api/orders` looks up the duck locally via `this.inventory.findByAttributes({color,size})`. No cross-stack call — an order for a duck that doesn't exist in this stack returns 404.

Request: `{color, size, quantity, country, shippingMode}`
Response: `{packageType, protections[], total, details[]}`

## Design patterns — where they're scoring you

### Packaging (Strategy + Decorator)

Code: `backend/src/packaging/packaging.js` + `backend/src/packaging/service.js`.

- Size-keyed strategy table picks material → wood / cardboard / plastic.
- Protection decoration is layered on (material, shipping mode) → polystyrene / bubble wrap / moisture beads. Sea mode adds two protections, so the composition works cleanly.
- `PackagingService.build(size, mode)` picks strategy from size, applies decorators from shipping rules. Returns `{packageType, protections[]}`.

### Pricing (Chain of Responsibility / Pipeline)

Code: `backend/src/pricing/pricing.js` + `backend/src/pricing/service.js`.


Each rule is a step that takes a price context and appends to `details[]` (so the response's "details of discounts and increments" comes for free):

1. Base = qty × price
2. Volume discount (>100 → -20%)
3. Material adjustment (wood +5%, plastic +10%, cardboard -1%)
4. Country tax (USA +18%, Bolivia +13%, India +19%, else +15%)
5. Shipping surcharge (sea flat +$400; land +$10·qty; air +$30·qty, -15% if qty>1000)

Each step records `{name, amount, note}` — the response trace is free.

## Frontend

- Single page (`pages/Inventory.tsx`): "Agregar Patito" button, table sorted by quantity.
- Built once per stack. Page `<h1>` and instance chip come from `VITE_TITLE` / `VITE_INSTANCE` at compose time — the React code has no branching on stack identity. "Warehouse vs store" is entirely a compose-time concept.
- Typed `ServiceContainer` exposes the `DuckService` as `services.get("duck")`. Registry shape lives in `services/ServiceContainer.ts`.
- `DuckForm` shared between add and edit. In edit mode, color/size are `disabled`.
- Delete uses native `window.confirm` — spec says "alert to confirm," that's enough.
- Color/Size are fixed enums — use `<select>`, not free text.
- Mockup has bilingual labels ("Color / Rojo", "actions / Acciones"). Keep bilingual — low effort, shows attention to detail.
- No order-placement UI — `/api/orders` is a backend-only endpoint per spec.

## Order of work

> Historical checklist — items below reflect the original Node+Go plan. Post-pivot work (2026-04) is tracked in the backlog.

- [x] docker-compose with Mongo
- [x] warehouse-service: Mongo + counters + CRUD — verified end-to-end with curl
- [x] React table + add/edit/delete — end-to-end
- [x] ~~store-service: Go scaffold, HTTP server, `/api/orders` wired~~ *(superseded: collapsed into second Node backend instance)*
- [x] ~~Packaging Strategy + Decorator in Go (14 subtests)~~ *(ported to `backend/src/packaging/` in Node)*
- [x] ~~Pricing Chain in Go (5 subtests + named constants, no magic numbers)~~ *(ported to `backend/src/pricing/` in Node)*
- [x] ~~Wire Store → Warehouse HTTP client for price lookup~~ *(removed: each stack has its own local inventory; no inter-backend HTTP)*
- [x] `GET /api/ducks/lookup?color&size` — general attribute-based lookup
- [x] Assumptions documented in [docs/assumptions.md](./assumptions.md)
- [x] READMEs: per-service run instructions, pattern rationale
- [x] Root README: dev workflow, compose profiles, devcontainers
- [x] 2026-04 pivot: schema-driven backend; two independent `{mongo, backend, frontend}` stacks from one image; frontend per stack.

## Tests

Run `bash run.sh test <stack>` for the live counts — numbers drift fast and the
plan is not the source of truth. Coverage spans pure validator tests,
fake-repo service tests, real-Mongo repo + db tests, `ServiceContainer`
and `Schema` unit tests, Supertest integration tests against a real Mongo,
table-driven packaging strategy × protection tests, pricing-rule scenario
tests, MSW-backed frontend service tests, unit tests for the `Duck` model
and i18n drift, and a full-flow integration test for the Inventory page.

## What actually shipped

Both backend stacks are a single Node image driven by `schemas/duck.json`. The Go store-service was never merged; packaging and pricing were ported to Node and the `OrderService` looks up inventory locally rather than calling a separate warehouse. The frontend builds one codebase per stack, branded via `VITE_TITLE` / `VITE_INSTANCE` — no tabs, no cross-stack HTTP. See the banner at the top of this file for the architectural summary.
