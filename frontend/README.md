# frontend

React + TypeScript UI for the warehouse module. Calls the warehouse API through Vite's dev proxy so browser and API share the same origin (no CORS).

## Stack

- Node 20, React 18, TypeScript 5, Vite 5
- `@tanstack/react-table` — headless table with sortable columns
- Vitest + React Testing Library + MSW for tests (jsdom env)

## Run

```bash
bash run.sh                    # from repo root
bash run.sh test frontend      # run tests inside the container
```

Dev server at **http://localhost:5173**.

## Layout

```
src/
├── services/
│   ├── BaseService.ts        # HTTP scaffold (request / requestVoid / jsonInit) + ApiError
│   ├── DuckService.ts        # duck CRUD client; list()/create() return Duck instances
│   └── index.ts              # `services` singleton — extension point for future services
├── models/
│   └── Duck.ts               # active-record: fetched duck knows how to update/delete itself
├── components/
│   ├── DuckTable.tsx         # sortable table (TanStack React Table, headless)
│   └── DuckForm.tsx          # shared add/edit form, color/size disabled in edit mode
├── pages/
│   └── Warehouse.tsx         # wires table + form + delete + error state via `services.duck`
├── i18n/locale.tsx           # translate() + <LocaleProvider>; dev-warns on missing keys
├── constants/ducks.ts        # color/size enums (imports shared/enums.json)
├── test/setup.ts             # MSW server + RTL cleanup
├── vite-env.d.ts             # local ImportMeta.env typings (avoids vite/client resolution on host)
├── App.tsx                   # tab bar + Warehouse page
└── main.tsx                  # StrictMode bootstrap + styles import
```

## Key design notes

- **Service + model split:** components ask `services.duck.list()` / `services.duck.create(input)` and receive `Duck` instances. Mutations happen on the instance — `duck.update(fields)` persists and mutates locally in one call. Adding a future service is a one-line addition to `services/index.ts`.
- **Headless table:** TanStack React Table provides sort state/behavior; we keep full control of markup so the bilingual headers and color cells stay intact. `sortDescFirst: false` is set table-wide because TanStack defaults numeric columns to desc-first, which is surprising UX.
- **API error shape:** `ApiError` lives in `services/BaseService.ts` (re-exported from `services/index.ts`). It carries `status` + parsed `body`. The Warehouse page extracts `body.errors` from 400 responses and passes them to `DuckForm`, which renders per-field error messages inline under each input.
- **Vite proxy:** `/api/*` → `http://warehouse:4001` (compose service network). Browser sees a single origin, no CORS needed in dev. In prod, a static build would sit behind a gateway that does the same routing.
- **Spec-aligned readonly enforcement:** `DuckForm` in edit mode disables the color/size selects visually; the Warehouse page's update path also whitelists fields server-side-safe because the backend drops them structurally.

## Tests

Run `bash run.sh test frontend` from the repo root for the live count. The suite covers MSW-backed service tests (`services/DuckService.test.ts`), unit tests for the `Duck` model (`models/Duck.test.ts`), component tests for `DuckTable`/`DuckForm`, a full-flow integration test at `pages/Warehouse.test.tsx`, and i18n drift tests (`i18n/locale.test.ts`).

## Assumptions

See [../docs/assumptions.md](../docs/assumptions.md).
