---
name: run-tests
description: Guide for running tests across the Duck Store services.
disable-model-invocation: true
user-invocable: true
---

## Quick reference

| Service            | Install      | Run all tests        | Watch mode                  | Coverage                   |
| ------------------ | ------------ | -------------------- | --------------------------- | -------------------------- |
| warehouse-service  | `npm ci`     | `npm test`           | `npm test -- --watch`       | `npm test -- --coverage`   |
| store-service      | —            | `go test ./...`      | `gotestsum --watch` *(optional install)* | `go test -cover ./...`     |
| frontend           | `npm ci`     | `npm test`           | `npm test -- --watch`       | `npm test -- --coverage`   |

## Run a single test

- **Go:** `go test ./internal/pricing -run TestCalculatePrice_VolumeOver100 -v`
- **Vitest (Node + React):** `npx vitest run path/to/file.test.js -t "volume discount"`

## Verbose output

- **Go:** `go test -v ./...`
- **Vitest:** `npm test -- --reporter=verbose`

## Integration test dependencies

- **Node DB tests:** `mongodb-memory-server` spins Mongo inside the test — no docker needed.
- **Go → Warehouse HTTP calls:** use `httptest.NewServer` to stub warehouse-service in tests.
- **React → API calls:** use MSW (`msw`) to mock fetch at the network layer.

## Run everything

From the repo root, once a workspace setup exists:

```bash
npm test --workspaces && (cd store-service && go test ./...)
```

## Results & CI

- Vitest writes JUnit XML with `--reporter=junit --outputFile=test-results.xml` if CI needs it.
- Go: `go test -json ./... > test-results.json` for machine-readable output.
