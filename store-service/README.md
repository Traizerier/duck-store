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
cmd/server/main.go          # wire client → handler, listen
internal/
├── packaging/              # Strategy + Decorator
├── pricing/                # Chain of Responsibility
├── order/                  # HTTP handler composing packaging + pricing + client
└── warehouse/              # HTTP client to warehouse-service
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

**33 tests**:
- `internal/packaging` — 14 table-driven subtests (5 material × size, 9 protection × material+mode)
- `internal/pricing` — 5 scenario tests covering all rules, including air bulk shipping discount
- `internal/order` — 9 handler tests using a fake `WarehouseClient`
- `internal/warehouse` — 5 client tests using `httptest.NewServer`

## Assumptions

Spec ambiguities (rule order, compounding vs base-only percentages, etc.): [../docs/assumptions.md](../docs/assumptions.md).
