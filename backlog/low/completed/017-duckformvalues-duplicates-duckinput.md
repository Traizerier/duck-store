---
id: 017
title: DuckFormValues duplicates DuckInput with an identical shape
status: Completed
severity: low
service: frontend
promoted_from: P025
---

# 017: `DuckFormValues` duplicates `DuckInput` with an identical shape

**Found by:** Duplication

## Description
Two interfaces in `frontend/src/` declare byte-identical shapes for duck-form data:

```ts
// frontend/src/components/DuckForm.tsx:5-10
export interface DuckFormValues {
  color: string;
  size: string;
  price: number;
  quantity: number;
}

// frontend/src/services/DuckService.ts:16-21
export interface DuckInput {
  color: string;
  size: string;
  price: number;
  quantity: number;
}
```

`Warehouse.tsx:58,61` then hands a `DuckFormValues` value straight to `services.duck.create(values)`, which expects `DuckInput`. Structural typing lets this compile, but the two types drift independently — if someone adds `notes: string` to `DuckInput`, `DuckForm` still compiles and silently submits no `notes` field; if someone adds it to `DuckFormValues`, the field gets collected in the UI but dropped at `create(values)` with no compile error either.

STANDARDS.md (frontend): "Types: Co-located with the owning component. Move to `src/types/` only when reused in 2+ places." This shape is reused in two places — which is exactly the condition for the type to live in one spot.

## Impact
Low-risk today because the fields are all primitives and match exactly, but the types are positioned to drift the moment a fifth duck field is added to the domain. Any new "editable on create" field will silently skip the form-to-service hand-off with no compile error. Also a small duplication smell: any reader adding a new field has to remember both spots.

## Affected Files
- `frontend/src/components/DuckForm.tsx:5-10` — `DuckFormValues` interface.
- `frontend/src/services/DuckService.ts:16-21` — `DuckInput` interface.
- `frontend/src/pages/Warehouse.tsx:58,61` — hand-off site that relies on structural typing.

## Suggested Fix
Have `DuckForm` import `DuckInput` and use it directly:

```ts
// DuckForm.tsx
import type { DuckInput } from "../services/DuckService";

export type DuckFormValues = DuckInput;
// or, drop DuckFormValues entirely and use DuckInput everywhere
```

If you want to keep the name `DuckFormValues` inside the component for readability, leave it as a pure type alias so TypeScript catches drift via the pointer to the canonical shape. The underlying declaration should live with the service (which owns the wire shape); the component's type is a consumer of that shape, not a parallel declaration.

## Resolution

**Completed:** 2026-04-23

`DuckFormValues` is now a type alias for `DuckInput`. The wire shape lives on the service; the component re-exports the same type under a readable name. A new editable field added to `DuckInput` propagates into the form automatically.

**Changes (1 file):**

- `frontend/src/components/DuckForm.tsx` — removed the local interface declaration, added `import type { DuckInput } from "../services/DuckService"` and `export type DuckFormValues = DuckInput`. Comment at the alias names the reason.

**Verification:** `npx tsc --noEmit` clean; `npm test -- --run` green (45 tests). No test edits needed — `DuckFormValues` stays the public name the tests import.
