# store-service

Go service that accepts orders and returns packaging + pricing details. Calls the warehouse over HTTP for unit price lookup; no database of its own.

## Stack

- Go 1.22 (see root [`.tool-versions`](../.tool-versions))
- stdlib only: `net/http`, `encoding/json`, `testing`
- No frameworks — small surface, idiomatic Go

## Run

```bash
bash run.sh                    # from repo root
bash run.sh test store         # runs `go test ./...` inside the container
bash run.sh shell store        # bash inside the container
```

Listens on **4002**.

## Endpoint

```
POST /api/orders
  body: {color, size, quantity, country, shippingMode}
  200:  {packageType, protections, total, details}
  400:  validation error
  502:  warehouse lookup failed
```

## Layout

```
cmd/server/main.go          # wire services → handler; listen + graceful shutdown
internal/
├── enums/                  # load shared/enums.json at startup
├── service/                # BaseService (Name()) embedded by all services
├── packaging/              # Strategy + Decorator
├── pricing/                # Chain of Responsibility
├── order/                  # OrderService: validate → lookup → package → price
└── warehouse/              # HTTP client to warehouse-service (ErrDuckNotFound)
```

## Key patterns (spec-required)

### Strategy + Decorator — `internal/packaging`

- `packagingStrategy` interface (unexported) with 3 concrete impls: `woodPackaging`, `cardboardPackaging`, `plasticPackaging`. One strategy picked by duck size.
- `Package` struct is the **decorator** — it wraps the chosen strategy's material and adds a `[]Protection` derived from the material + shipping mode.
- `Build(size, mode)` is the public factory — selects strategy, composes decorator.

### Chain of Responsibility — `internal/pricing`

Ordered slice of rule functions:

```go
var rules = []func(*priceContext){
    applyBase,
    applyVolumeDiscount,
    applyMaterialAdjustment,
    applyCountryTax,
    applyShippingSurcharge,
}
```

Each rule reads a `priceContext`, adjusts the running total, and appends a `Detail{Name, Amount}` that surfaces in the response. Adding a new rule is a single append.

All rates and thresholds are named constants at the top of the file — no magic numbers in business logic.

## Tests

Run `bash run.sh test store` from the repo root for the live count. Coverage: table-driven tests for every packaging strategy × protection combination, scenario tests for every pricing rule (including the air-bulk discount), handler tests against a fake `WarehouseClient`, `httptest.NewServer`-backed warehouse-client tests, enum-load tests, a drift guard against `shared/enums.json`, and a `BaseService` sanity test.

## Assumptions

Spec ambiguities (rule order, compounding vs base-only percentages, etc.): [../docs/assumptions.md](../docs/assumptions.md).
