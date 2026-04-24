---
id: 027
title: Frontend apiFetch silently swallows non-JSON error bodies
status: Completed
severity: low
service: frontend
promoted_from: P022
---

# 027: Frontend `apiFetch` silently swallows non-JSON error bodies

**Found by:** Error Handling
**Related to:** 006 (related i18n dev-warn pattern — apply the same "warn in DEV" instinct here); 028 (dedup fix that collapsed the two swallow sites into one)

## Description
`frontend/src/api/ducks.ts:29-36` wraps every API call:

```ts
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
  return res;
}
```

The `.catch(() => ({}))` converts any JSON-parse failure (HTML error page from a misconfigured proxy, 502 from an upstream without a body, truncated response) into an empty-object body. The caller then only has `res.status` to go on — `extractFieldErrors` returns `null`, `describeError` falls to `"Request failed (<status>)"`, and the actual server response (which might contain the debug breadcrumb the developer needs) is silently dropped on the floor.

STANDARDS.md: "No silent swallowing. Every caught error is re-thrown with context, logged with enough info to debug, or returned as a typed failure." The catch discards the parse error without logging it and without preserving the raw text.

## Impact
- In dev mode (Vite proxy misbehaving, backend crashed and returning Express's default HTML error page, etc.) the user sees a generic status-code message and the console is empty. The actual payload — which would instantly explain the problem — is gone.
- In production, same story: a 502 from the edge returning HTML becomes `ApiError(502, {})` and the user sees "Request failed (502)" with no clue whether it was warehouse down, proxy misconfigured, or the duck service returning unstructured 5xx.

## Affected Files
- `frontend/src/api/ducks.ts:31-33` — the `.catch(() => ({}))` swallow.

## Suggested Fix
Read the body as text first, then try to parse as JSON, preserving the raw text on failure:

```ts
if (!res.ok) {
  const raw = await res.text();
  let body: unknown;
  try { body = raw ? JSON.parse(raw) : {}; }
  catch {
    if (import.meta.env?.DEV) {
      console.warn(`[api] non-JSON error body from ${path}:`, raw);
    }
    body = { error: "NonJsonResponse", raw };
  }
  throw new ApiError(res.status, body);
}
```

Then `describeError` in `Warehouse.tsx` can surface `body.raw` (truncated) when present, giving developers the actual server output instead of a generic status code. Mirror the P006 `import.meta.env?.DEV` pattern so the dev-warn is dead-stripped in production builds.

## Resolution

**Completed:** 2026-04-23

Applied the suggested read-as-text-then-parse approach inside `BaseService.fetchOrThrow` (ticket 028 moved the non-ok handling into that single helper, so this fix landed in one place by construction).

**Changes (2 files):**

- `frontend/src/services/BaseService.ts` — `fetchOrThrow` now calls `res.text()`, tries `JSON.parse`, and on parse failure emits a dev-mode `console.warn` (mirroring the i18n missing-key pattern) and stashes `{error: "NonJsonResponse", raw}` as the `ApiError.body`. Pre-production builds still get the `ApiError` with a populated body; dev builds additionally get a console breadcrumb.
- `frontend/src/services/DuckService.test.ts` — new regression test: MSW hands back an HTML 502 body; the resulting `ApiError.body` is `{error: "NonJsonResponse", raw: <contains "502 Bad Gateway">}`.

**Verification:**

- `npm test -- --run src/services/DuckService.test.ts` — 8 tests pass (+1 for the non-JSON case). Dev-mode `console.warn` visibly emitted by the test harness confirming the breadcrumb path fires.
- Full frontend suite 48 green after all GROUP E fixes.

**Adjacent concerns noted but not tackled:**

- **Surface `body.raw` in the UI** (ticket suggestion): `Warehouse.tsx`'s `describeError` (ticket 023) already prefers `body.message` when present. `body.raw` is intentionally left out of the user-facing string — it's a debug breadcrumb (typically HTML), not a translatable message. Operators find it via the dev-warn and the `ApiError.body` in the thrown error, not the alert banner.
