# Duck Store — Interview Plan

Spec: [../design.md](../design.md) · Mockup: [../Screenshot 2026-04-22 100134.png](../Screenshot%202026-04-22%20100134.png)

## Architecture: two microservices

Target employer values microservices, and the spec already splits into two modules. Use that as the service boundary:

| Service        | Stack             | Owns                                               |
| -------------- | ----------------- | -------------------------------------------------- |
| **Warehouse**  | Node + Express    | Duck CRUD, Mongo, React-facing API                 |
| **Store**      | Go (chi or stdlib)| Order endpoint: packaging (Strategy) + pricing (Chain) |
| **Frontend**   | React + Vite      | Warehouse UI only (per spec)                       |

**Why this split works:**
- Matches the spec's own module boundary — not arbitrary.
- Warehouse is a safe, familiar Node CRUD — fast to ship.
- Store is narrow scope (one endpoint, pure logic, almost no Mongo) — ideal Go crash course without being blocked on driver quirks.
- If Go time slips, Store can fall back into Node without derailing the submission.

**Inter-service communication:**
- Store calls Warehouse (HTTP) to fetch duck price for the order and, optionally, decrement stock.
- Keep it HTTP/JSON — no shared DB, no shared code. That's the microservice point.

## Stack decision

Spec says "Express or Nest" but the job is Go. Dual-backend satisfies both — Express covers the letter of the spec, Go signals fit for the role.

## Ambiguities to clarify (or note as assumptions in README)

1. **Price on add** — spec says the add form collects "Color, Size, and Quantity" but the merge rule keys on "price, color, and size." Assumption: the form also collects price (the mockup shows a price column, and otherwise the merge rule is meaningless).
2. **ID = Integer** — Mongo's `_id` is ObjectId by default. Use a `counters` collection with `findOneAndUpdate $inc` for auto-increment ints. Call this out.
3. **Order endpoint & stock** — spec doesn't say whether an order decrements warehouse quantity. Implement it (obvious behavior) but note.
4. **Discount order** — "greater than 100 units, apply 20% discount to the total cost" reads as applied before material/country percentages. Flag if unsure.

## Repo layout

```
duck-store/
├── warehouse-service/         # Node + Express
│   ├── src/
│   │   ├── routes/ducks.js
│   │   ├── services/duckService.js
│   │   ├── repos/duckRepo.js
│   │   ├── db/mongo.js        # client + counters helper
│   │   └── server.js
│   └── package.json
├── store-service/             # Go
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── order/             # handler, request/response types
│   │   ├── packaging/         # Strategy + Decorator
│   │   ├── pricing/           # Chain of Responsibility
│   │   └── warehouse/         # HTTP client to warehouse-service
│   └── go.mod
├── frontend/                  # React + Vite
│   ├── src/
│   │   ├── api/ducks.ts
│   │   ├── components/        # DuckTable, DuckFormModal, ConfirmDialog
│   │   └── pages/Warehouse.tsx
│   └── package.json
└── docker-compose.yml         # mongo + both services + frontend
```

## Data model (MongoDB, owned by warehouse-service)

```
ducks:    { _id: int, color, size, price, quantity, deleted: bool }
counters: { _id: "ducks", seq: int }
```

Index: `{ color:1, size:1, price:1, deleted:1 }` — makes merge-on-add lookup cheap. Every read filters `deleted: false`.

## API surface

### Warehouse service (Node, port 4001)

| Method | Path              | Purpose                           |
| ------ | ----------------- | --------------------------------- |
| GET    | `/api/ducks`      | list (sorted by quantity)         |
| POST   | `/api/ducks`      | create-or-merge                   |
| PATCH  | `/api/ducks/:id`  | update price + quantity only      |
| DELETE | `/api/ducks/:id`  | logical delete (set deleted=true) |
| GET    | `/api/ducks/lookup?color=&size=` | internal: fetch price for Store |

`POST /api/ducks` logic: `findOneAndUpdate({color,size,price,deleted:false}, {$inc:{quantity:N}})` with upsert. On upsert, assign a new id from `counters`.

### Store service (Go, port 4002)

| Method | Path           | Purpose                                |
| ------ | -------------- | -------------------------------------- |
| POST   | `/api/orders`  | package + price calculation            |

Request: `{color, size, quantity, country, shippingMode}`
Response: `{packageType, protections[], totalToPay, details[]}`

## Design patterns — where they're scoring you

### Packaging (Strategy + Decorator) — Go

- `PackagingStrategy` interface picks material from size → `WoodPackaging`, `CardboardPackaging`, `PlasticPackaging`.
- `ProtectionDecorator` wraps the strategy based on (material, shipping mode) → polystyrene / bubble wrap / moisture beads. Sea mode adds two protections, so decorator composes cleanly.
- `PackagingService` picks strategy from size, applies decorators from shipping rules. Returns `{material, protections[]}`.

### Pricing (Chain of Responsibility / Pipeline) — Go

Each rule is a step that takes a `PriceContext` and appends to `details[]` (so the response's "details of discounts and increments" comes for free):

1. Base = qty × price
2. Volume discount (>100 → -20%)
3. Material adjustment (wood +5%, plastic +10%, cardboard -1%)
4. Country tax (USA +18%, Bolivia +13%, India +19%, else +15%)
5. Shipping surcharge (sea flat +$400; land +$10·qty; air +$30·qty, -15% if qty>1000)

Each step records `{name, amount, note}` — the response trace is free.

## Frontend

- Single page: header tabs (Warehouse active, Store stub), "Agregar Patito" button, table sorted by quantity.
- `DuckFormModal` shared between add and edit. In edit mode, color/size are `disabled`.
- Delete uses native `window.confirm` — spec says "alert to confirm," that's enough.
- Color/Size are fixed enums — use `<select>`, not free text.
- Mockup has bilingual labels ("Color / Rojo", "actions / Acciones"). Keep bilingual — low effort, shows attention to detail.
- Only talks to warehouse-service. No frontend code for Store module (spec: "backend only").

## Order of work (take-home, ~2–3 days with Go learning)

- [x] docker-compose with Mongo
- [x] warehouse-service: Mongo + counters + CRUD — verified end-to-end with curl
- [x] React table + add/edit/delete — end-to-end for Warehouse
- [x] store-service: Go scaffold, HTTP server, `/api/orders` wired
- [x] Packaging Strategy + Decorator in Go (14 subtests)
- [x] Pricing Chain in Go (5 subtests + named constants, no magic numbers)
- [x] Wire Store → Warehouse HTTP client for price lookup
- [x] Warehouse `GET /api/ducks/lookup?color&size` — internal endpoint for store
- [x] Assumptions documented in [docs/assumptions.md](./assumptions.md)
- [x] READMEs: per-service run instructions, pattern rationale
- [x] Root README: dev workflow, compose profiles, devcontainers

## Tests

Run `bash run.sh test` for the live counts — numbers drift fast and the
plan is not the source of truth. Coverage spans pure validator tests,
fake-repo service tests, real-Mongo repo + db tests, a `ServiceContainer`
unit test, Supertest integration tests against a real in-memory Mongo,
table-driven packaging strategy × protection tests, pricing-rule scenario
tests, `httptest.NewServer`-backed warehouse-client tests, MSW-backed
frontend service tests, unit tests for the `Duck` model and i18n drift,
and a full-flow integration test for the Warehouse page.

## Fallback plan

If Go time is running out: move `/api/orders` into warehouse-service (same patterns, Node implementation). Submit with a note that the dual-backend was the intended architecture. Losing Go loses the "matches the job stack" point but keeps the microservice thinking intact (could split later).
