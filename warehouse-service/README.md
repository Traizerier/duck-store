# warehouse-service

Node.js + Express + MongoDB service owning the duck inventory. Exposes CRUD plus `GET /api/ducks/lookup` used by store-service for price resolution.

## Stack

- Node 20 (see root [`.tool-versions`](../.tool-versions))
- Express 4
- MongoDB 7 driver (no Mongoose — small surface)
- Vitest + Supertest + mongodb-memory-server for tests

## Run

All commands go through the root orchestrator:

```bash
bash run.sh                        # from repo root: starts mongo + this service + store + frontend
bash run.sh test warehouse         # run the test suite inside the container
bash run.sh shell warehouse        # bash inside the container
```

From inside the container (when shelled in): `npm run dev` starts the server with `node --watch`.

The service listens on **4001**.

## Endpoints

| Method | Path                              | Purpose                                         |
| ------ | --------------------------------- | ----------------------------------------------- |
| `GET`  | `/api/ducks`                      | list active ducks sorted by quantity ascending  |
| `POST` | `/api/ducks`                      | create (or merge quantity if duplicate exists)  |
| `PATCH`| `/api/ducks/:id`                  | update price + quantity (color/size whitelisted out) |
| `DELETE`| `/api/ducks/:id`                 | logical delete (`deleted: true`)                |
| `GET`  | `/api/ducks/lookup?color=&size=`  | internal: first active duck matching color+size |
| `GET`  | `/health`                         | `{ok: true}`                                    |

## Layout

```
src/
├── constants/ducks.js          # COLORS, SIZES enums (reads shared/enums.json)
├── db/mongo.js                 # connect, createDucksIndex, createCounters
├── validation/duckValidator.js # pure validation (input + update + lookup query)
├── services/
│   ├── BaseService.js          # requireActive(repo, id) guard shared by domain services
│   └── duckService.js          # business logic: merge-on-add, soft-delete, list, lookup
├── repos/duckRepo.js           # MongoDB driver calls; _id ↔ id mapping
├── routes/ducks.js             # Express router (parseId, validateLookupQuery)
├── container.js                # ServiceContainer (register/get) — extension point
├── app.js                      # app factory: middleware, router, error handler
├── server.js                   # prod entry: connect Mongo, build container, listen, SIGTERM
└── errors.js                   # ValidationError, NotFoundError
```

## Key design notes

- **Layering:** `routes → services → repos → db`. Routes never touch Mongo; repos never format HTTP responses.
- **Service container:** `ServiceContainer` registers each service by name; `createApp` pulls them out for each router, so adding a second service is a one-line change in `server.js`.
- **Logical deletion:** every read filters `deleted: false`. Deleted rows are terminal — can't be updated, re-deleted, or matched on re-add. Repo mutation methods filter `deleted: false` too, so the invariant is enforced at the data-access boundary.
- **Integer IDs:** `counters` collection with atomic `findOneAndUpdate({$inc:{seq:1}}, {upsert:true})`. Spec says `Id: Integer`, Mongo prefers ObjectId — the repo bridges via `toDuck({_id, ...})`.
- **Merge-on-add:** POST with matching `{color, size, price}` on a non-deleted duck increments quantity instead of inserting (spec requirement e.ii).
- **Readonly fields:** `update(id, fields)` silently whitelists `price`/`quantity` via `pickEditableFields` — color/size in the payload are dropped, not rejected.
- **Index:** `{color:1, size:1, price:1, deleted:1}` compound index created at server start for `findMatch` performance.

## Tests

Run `bash run.sh test warehouse` from the repo root for the live count. The suite covers pure validator tests, fake-repo service tests, real-Mongo repo + db tests, a `ServiceContainer` unit test, and Supertest integration tests against a real in-memory Mongo.

## Assumptions

Spec ambiguities and how we resolved them: [../docs/assumptions.md](../docs/assumptions.md).
