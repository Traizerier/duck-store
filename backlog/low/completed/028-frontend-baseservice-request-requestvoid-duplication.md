---
id: 028
title: Frontend BaseService.request and requestVoid duplicate non-ok handling
status: Completed
severity: low
service: frontend
promoted_from: P029
---

# 028: Frontend `BaseService.request` and `requestVoid` duplicate non-ok handling

**Found by:** Duplication
**Related to:** 027 (same four lines are the subject of 027's "silent JSON-parse swallow" finding; this item is about the duplication, 027 is about the swallow)

## Description
`frontend/src/services/BaseService.ts:21-36` declares two protected methods whose only difference is the final `return res.json()` vs. nothing:

```ts
protected async request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(this.basePath + path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

protected async requestVoid(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(this.basePath + path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
}
```

The fetch call, the `!res.ok` branch, the JSON-body parse, and the `ApiError` throw are byte-identical four-line blocks. Any fix to the error-handling path (e.g. the P022 "preserve raw text" improvement, or adding a request-id header) has to land in two places or the two methods drift.

## Impact
Small in isolation (eight lines), but it's a canary: the error-handling contract for HTTP calls is now maintained in two copies. The moment P022's "read-body-as-text-then-parse" fix lands, or anyone adds auth headers / timeouts / retry logic, the second copy becomes a silent drift vector. Also makes `BaseService` read like it has two entrypoints with different contracts when the real difference is a one-line "do I decode JSON on success?"

## Affected Files
- `frontend/src/services/BaseService.ts:21-28` — `request<T>` method.
- `frontend/src/services/BaseService.ts:30-36` — `requestVoid` method with the same four-line non-ok block.

## Suggested Fix
Extract the shared pre-check into one private helper, then have both public methods call it:

```ts
private async fetchOrThrow(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(this.basePath + path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
  return res;
}

protected async request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await this.fetchOrThrow(path, init);
  return res.json() as Promise<T>;
}

protected async requestVoid(path: string, init?: RequestInit): Promise<void> {
  await this.fetchOrThrow(path, init);
}
```

P022's "preserve the raw body text" fix then has a single landing place, which is exactly the outcome that finding recommends. Existing `DuckService.test.ts` coverage continues to verify both methods through their public call sites without test edits.

## Resolution

**Completed:** 2026-04-23

Extracted `private async fetchOrThrow` exactly as suggested. Both `request<T>` and `requestVoid` now delegate to it. The subsequent ticket 027 fix then only had to land in one place (the predicted payoff).

**Changes (1 file):**

- `frontend/src/services/BaseService.ts` — new `private async fetchOrThrow(path, init)` returns the raw `Response` on success or throws `ApiError` on non-ok. `request<T>` calls it and then `res.json()`. `requestVoid` calls it and ignores the response.

**Verification:** `npm test -- --run src/services/DuckService.test.ts` — 7 existing tests pass unchanged (8 after ticket 027's non-JSON test added on top).
