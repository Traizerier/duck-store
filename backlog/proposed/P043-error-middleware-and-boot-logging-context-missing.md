# P043: Express error middleware and boot failures log without request/boot context

**Proposed severity:** Low
**Found by:** Error Handling
**Status:** Proposed
**Related to:** P004 (structured logging conventions) — same root cause class; filing as a separate finding because this one has a concrete code fix independent of the logging-standard document, and ties into specific post-pivot boot paths (`server.js` top-level `await`) that didn't exist when P004 was written.

## Description
Two error-handling gaps, both flagged by the "log values with errors" rule in STANDARDS.md:

1. **`backend/src/app.js:30`** — the Express error-handling middleware runs `console.error(err)` on the 500 path with zero request context:

   ```js
   app.use((err, _req, res, _next) => {
     if (err instanceof ValidationError) { /* ... */ }
     if (err instanceof NotFoundError)   { /* ... */ }
     console.error(err);
     res.status(500).json({ /* ... */ });
   });
   ```

   The middleware deliberately discards `_req` with an underscore — so when a 500 fires in production, the operator sees the error's stack trace and nothing else. No method, no URL, no body, no instance label. With two backend instances writing to separate containers' logs, a production incident requires the operator to hand-correlate logs against load-balancer traces just to learn which route was hit.

2. **`backend/src/server.js:24, 26`** — two top-level `await` calls drive the boot:

   ```js
   const schema = await Schema.load(SCHEMA_PATH, ENUMS_PATH);
   const { client, db } = await connectDb(MONGO_URL, MONGO_DB);
   ```

   Neither is wrapped in `try { ... } catch`. A failure — a bad JSON file, a missing `shared/enums.json` (see P034), a Mongo connect timeout — produces an unhandled rejection with the default Node message and a non-zero exit. The process exits, but nothing in the log mentions the instance name, the schema path, or the Mongo URL being attempted — the three values the operator needs to diagnose the failure.

Neither finding requires adopting a full structured logger (which is P004's scope). They're both addressable with plain `console.error` plus a handful of context fields. P004 remains the right home for the broader "adopt pino / slog and define field conventions" conversation; this ticket is the minimum bar.

## Impact
- **500 debugging**: the Express middleware is the single place every unhandled server error funnels through. Logging just the stack loses the request envelope, which is what you need first when paging on a 500 spike.
- **Boot debugging**: with P034 unresolved, the production image fails `Schema.load` — and the operator sees an ENOENT stack trace that doesn't name the path being read. Adding one `try/catch` around each top-level `await` with `console.error(\`boot: failed to load schema from ${SCHEMA_PATH}\`, err); process.exit(1);` turns a mystery into a 30-second diagnosis.
- Post-pivot, both backends run as the same image — the `INSTANCE` env is the only way to tell warehouse from store in logs. The error middleware currently doesn't include it.

## Affected Files
- `backend/src/app.js:23-35` — error-handling middleware; `_req` discarded, `console.error(err)` is the only log.
- `backend/src/server.js:24` — unguarded `await Schema.load(...)`.
- `backend/src/server.js:26` — unguarded `await connectDb(...)`.

## Suggested Fix

1. **Error middleware** — stop discarding the request and include the instance label:

   ```js
   app.use((err, req, res, _next) => {
     if (err instanceof ValidationError) { /* unchanged */ }
     if (err instanceof NotFoundError)   { /* unchanged */ }
     console.error(
       `[${process.env.INSTANCE ?? "default"}] ${req.method} ${req.originalUrl} -> 500`,
       err,
     );
     res.status(500).json({ error: "InternalServerError", message: err.message || "internal error" });
   });
   ```

   (If/when P004 lands, this call site becomes `log.error({ req, err }, "request failed")` or equivalent — but the context belongs at the call site either way.)

2. **Boot guards** — wrap each top-level await with an exit-on-failure guard that names what was being loaded:

   ```js
   let schema;
   try {
     schema = await Schema.load(SCHEMA_PATH, ENUMS_PATH);
   } catch (err) {
     console.error(`boot: failed to load schema (SCHEMA_PATH=${SCHEMA_PATH}, ENUMS_PATH=${ENUMS_PATH})`, err);
     process.exit(1);
   }

   let client, db;
   try {
     ({ client, db } = await connectDb(MONGO_URL, MONGO_DB));
   } catch (err) {
     console.error(`boot: failed to connect to mongo (MONGO_URL=${MONGO_URL}, MONGO_DB=${MONGO_DB})`, err);
     process.exit(1);
   }
   ```

   Both now print the actual values that failed, which is the STANDARDS.md rule — "An error message without the offending value is half-useless" — applied verbatim.

Tests: add one app-level test that POSTs to a route with a handler that throws (not a ValidationError/NotFoundError), captures `console.error`, and asserts the log line includes method + URL. Cheap insurance against regression.
