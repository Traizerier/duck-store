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
├── api/ducks.ts              # typed fetch wrapper: listDucks, createDuck, updateDuck, deleteDuck
├── components/
│   ├── DuckTable.tsx         # sortable table (TanStack React Table, headless)
│   └── DuckForm.tsx          # shared add/edit form, color/size disabled in edit mode
├── pages/
│   └── Warehouse.tsx         # wires table + form + delete + error state
├── test/setup.ts             # MSW server + RTL cleanup
├── App.tsx                   # tab bar + Warehouse page
└── main.tsx                  # StrictMode bootstrap
```

## Key design notes

- **Headless table:** TanStack React Table provides sort state/behavior; we keep full control of markup so the bilingual headers and color cells stay intact. `sortDescFirst: false` is set table-wide because TanStack defaults numeric columns to desc-first, which is surprising UX.
- **API error shape:** `ApiError` carries `status` + parsed `body`. The Warehouse page extracts `body.errors` from 400 responses and passes them to `DuckForm`, which renders per-field error messages inline under each input.
- **Vite proxy:** `/api/*` → `http://warehouse:4001` (compose service network). Browser sees a single origin, no CORS needed in dev. In prod, a static build would sit behind a gateway that does the same routing.
- **Spec-aligned readonly enforcement:** `DuckForm` in edit mode disables the color/size selects visually; the Warehouse page's update path also whitelists fields server-side-safe because the backend drops them structurally.

## Tests

**30 tests**:
- `api/ducks.test.ts` — 7, MSW fake backend, covers all 4 CRUD methods + error paths
- `components/DuckTable.test.tsx` — 8, RTL, includes sort-by-header click
- `components/DuckForm.test.tsx` — 8, add + edit modes, field-error rendering
- `pages/Warehouse.test.tsx` — 7, full flow with MSW: load, add, edit, delete (with/without confirm), 400 field errors

## Assumptions

See [../docs/assumptions.md](../docs/assumptions.md).
