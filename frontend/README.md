# frontend

React + TypeScript UI for a single backend stack. Each stack (warehouse, store) builds the same frontend image with its own `VITE_TITLE` / `VITE_INSTANCE`, so the UI is branded per instance without the React code knowing about the stack concept.

## Stack

- Node 20, React 18, TypeScript 5, Vite 5
- `@tanstack/react-table` — headless table with sortable columns
- Vitest + React Testing Library + MSW for tests (jsdom env)

## Run

```bash
bash run.sh up warehouse            # from repo root — warehouse stack only
bash run.sh test warehouse frontend # run frontend tests inside the container
```

Dev server exposed at **http://localhost:5173** for warehouse, **:5174** for store (configurable in `.env.<stack>`).

## Layout

```
src/
├── services/
│   ├── BaseService.ts        # HTTP scaffold (request / requestVoid / jsonInit) + ApiError
│   ├── DuckService.ts        # duck CRUD client; list()/create() return Duck instances
│   ├── ServiceContainer.ts   # typed registry — `ServiceRegistry` interface + register/get
│   └── index.ts              # `services` singleton with the `"duck"` service registered
├── models/
│   └── Duck.ts               # active-record: fetched duck knows how to update/delete itself
├── components/
│   ├── DuckTable.tsx         # sortable table (TanStack React Table, headless)
│   └── DuckForm.tsx          # shared add/edit form, color/size disabled in edit mode
├── pages/
│   └── Inventory.tsx         # wires table + form + delete + error state via services.get("duck")
├── i18n/locale.tsx           # translate() + <LocaleProvider>; dev-warns on missing keys
├── constants/ducks.ts        # color/size enums (imports shared/enums.json)
├── test/setup.ts             # MSW server + RTL cleanup
├── vite-env.d.ts             # local ImportMeta.env typings (VITE_INSTANCE, VITE_TITLE, ...)
├── App.tsx                   # instance chip + locale toggle + <Inventory />
└── main.tsx                  # StrictMode bootstrap + styles import
```

## Key design notes

- **Service + model split:** components ask `services.get("duck").list()` / `services.get("duck").create(input)` and receive `Duck` instances. Mutations happen on the instance — `duck.update(fields)` persists and mutates locally in one call. Adding a second service is a new key in the `ServiceRegistry` interface plus a `services.register(...)` call — no call-site casts.
- **Headless table:** TanStack React Table provides sort state/behavior; we keep full control of markup so the bilingual headers and color cells stay intact. `sortDescFirst: false` is set table-wide because TanStack defaults numeric columns to desc-first, which is surprising UX.
- **API error shape:** `ApiError` lives in `services/BaseService.ts` (re-exported from `services/index.ts`). It carries `status` + parsed `body`. The Inventory page extracts `body.errors` from 400 responses and passes them to `DuckForm`, which renders per-field error messages inline under each input.
- **Vite proxy:** `/api/*` → `http://backend:4001` on each stack's own compose network. Browser sees a single origin, no CORS needed in dev. "Warehouse" vs "store" is a compose project label, not a DNS name the frontend ever sees — each compose project has its own `backend` service.
- **Per-stack branding:** `VITE_TITLE` is rendered as the page `<h1>` in `Inventory.tsx`; `VITE_INSTANCE` is a small chip near the locale toggle in `App.tsx`. Both arrive from the per-stack `.env.<name>` at compose time.
- **Spec-aligned readonly enforcement:** `DuckForm` in edit mode disables the color/size selects visually; the Inventory page's update path also whitelists fields server-side-safe because the backend drops them structurally.

## Tests

Run `bash run.sh test <stack> frontend` from the repo root for the live count. The suite covers MSW-backed service tests (`services/DuckService.test.ts`), registry tests (`services/ServiceContainer.test.ts`), unit tests for the `Duck` model (`models/Duck.test.ts`), component tests for `DuckTable`/`DuckForm`, a full-flow integration test at `pages/Inventory.test.tsx`, and i18n drift tests (`i18n/locale.test.ts`).

## Assumptions

See [../docs/assumptions.md](../docs/assumptions.md).
