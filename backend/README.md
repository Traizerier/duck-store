# backend

Node.js + Express + MongoDB backend. **Schema-driven** — the inventory subsystem (repo / service / validator / routes) reads an entity-type definition at boot and builds CRUD + lookup endpoints from it. `src/schemas/duck.json` is today's only schema. Adding a second type (e.g. frog) is a new schema file plus a new compose entry; no JS changes.

The same image is deployed twice via `docker-compose.yml`: one instance as the **warehouse** (its own Mongo container + database), one as the **store** (its own Mongo container + database). The two are fully independent — different data, different URLs, no HTTP link between them.

## Stack

- Node 20 (see root [`.tool-versions`](../.tool-versions))
- Express 4
- MongoDB 7 (official driver)
- Vitest + Supertest for tests

## Run

All commands go through the root orchestrator:

```bash
bash run.sh                        # from repo root: starts both backend stacks + frontend
bash run.sh test warehouse         # run the backend test suite inside the warehouse container
bash run.sh shell warehouse        # bash inside the warehouse container
bash run.sh test store             # same test suite, inside the store container
```

Both instances listen on **4001** internally. Host ports: warehouse `4001`, store `4002`.

## Endpoints (per instance)

| Method | Path                              | Purpose                                         |
| ------ | --------------------------------- | ----------------------------------------------- |
| `GET`  | `/api/ducks`                      | list active ducks sorted by quantity ascending  |
| `POST` | `/api/ducks`                      | create (or merge quantity if duplicate exists)  |
| `PATCH`| `/api/ducks/:id`                  | update price + quantity (color/size whitelisted out) |
| `DELETE`| `/api/ducks/:id`                 | logical delete (`deleted: true`)                |
| `GET`  | `/api/ducks/lookup?color=&size=`  | lookup by attributes                            |
| `POST` | `/api/orders`                     | package + price an order against this instance's inventory |
| `GET`  | `/health`                         | `{ok: true, instance, type}`                    |

The path `/api/ducks` comes from `schema.plural`. A `frog.json` schema would produce `/api/frogs` automatically.

## Layout

```
src/
├── schemas/
│   ├── Schema.js                  # schema loader + accessor class
│   └── duck.json                  # the duck entity definition
├── inventory/
│   ├── repo.js                    # generic Mongo repo built from a schema
│   ├── service.js                 # generic InventoryService (CRUD + lookup)
│   ├── validator.js               # schema-driven validators
│   └── routes.js                  # generic Express router
├── packaging/                     # Strategy + Decorator (duck-specific)
├── pricing/                       # Chain of Responsibility (duck-specific)
├── order/                         # OrderService — validate + lookup + package + price
├── db/mongo.js                    # connect + counters helper
├── services/BaseService.js        # embedded by every domain service
├── container.js                   # ServiceContainer (register/get)
├── app.js                         # app factory + error middleware
├── server.js                      # prod entry: load schema, wire container, listen, SIGTERM
└── errors.js                      # ValidationError, NotFoundError
```

## Key design notes

- **Schema at boot.** `SCHEMA_PATH` env var points at a JSON schema. `Schema.load()` reads it + `shared/enums.json`, validates the shape (resolves enum references eagerly), and hands it to every subsystem that needs entity-type specifics.
- **Service container.** Inventory is always registered. Packaging / pricing / order register only when `schema.orders.enabled` — other entity types can skip the order pipeline.
- **Layering:** `routes → services → repos → db`. Routes never touch Mongo; repos never format HTTP responses.
- **Logical deletion:** every read filters `deleted: false`. Mutation methods filter it too, so a tombstoned row can't be updated, re-deleted, or resurrected. The repo-layer invariant is the source of truth; the service layer trusts repo return values (`null` → NotFound).
- **Integer IDs:** `counters` collection with atomic `findOneAndUpdate({$inc:{seq:1}}, {upsert:true})`. Counter name = `schema.name`, so a `duck` and a hypothetical `frog` schema maintain independent sequences in the same database.
- **Merge-on-add:** POST with matching `schema.matchOnInsert` keys on a non-deleted row increments `schema.mergeField` instead of inserting. For ducks: match on `{color, size, price}`, merge into `quantity`.
- **Readonly fields:** `update(id, fields)` silently keeps only `schema.editable` fields. Extras in the payload are dropped, not rejected.
- **Compound index** built from `schema.matchOnInsert + ["deleted"]` at server start — idempotent. For ducks: `{color, size, price, deleted}`.

## Tests

Run `bash run.sh test warehouse` from the repo root for the live count. The suite covers: schema loader (happy-path + malformed), schema-driven validators, real-Mongo generic repo tests, fake-repo service tests, supertest integration against real Mongo, plus packaging (table-driven strategy × protection), pricing (scenario per rule), and order (fake-inventory happy path + error routing).

## Assumptions

Spec ambiguities and how we resolved them: [../docs/assumptions.md](../docs/assumptions.md).
