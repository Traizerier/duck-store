---
id: 020
title: Go service.BaseService + Name() is test-only scaffolding with no production consumer
status: Completed
severity: low
service: store-service
promoted_from: P028
---

# 020: Go `service.BaseService` + `Name()` is test-only scaffolding with no production consumer

**Found by:** Dead Code, Architecture

## Description
`store-service/internal/service/base.go` defines a minimal `BaseService` struct and a `Name()` accessor:

```go
type BaseService struct {
    name string
}

func New(name string) BaseService { return BaseService{name: name} }
func (b BaseService) Name() string { return b.name }
```

The struct is embedded in `OrderService` (`order/order.go:59-65`), `PackagingService` (`packaging/service.go:8-14`), and `PricingService` (`pricing/service.go:8-14`), each constructed with its string identifier. A grep across the full non-test tree for `.Name()` and any use of the `name` field turns up zero call sites:

- `cmd/server/main.go` wires the services and calls `Handler()`, `Build()`, `Calculate()` — never `Name()`.
- `internal/order/order.go` holds references to the other services by the `Packager` / `Pricer` / `WarehouseClient` interfaces, none of which include `Name()`.
- The only `Name()` calls are in `internal/service/base_test.go`, `internal/packaging/packaging_test.go`, and `internal/pricing/pricing_test.go`, each asserting the constructor threaded the string through correctly.

The doc comment on `BaseService` says *"Useful for log lines that need to tag which service produced them"* — but no log line in the service reads `Name()`, and the structured-logging story is still deferred (P004).

STANDARDS.md (Dead code): "Unused exports, commented-out blocks > 5 lines, and feature flags that always resolve the same way should be removed, not kept 'just in case.'" STANDARDS.md (Go): "Interfaces: Defined by the consumer (small, 1–3 methods). Concrete types at the package boundary." A base struct nobody consumes is the inverse of that rule — a shared supertype with no shared behavior.

## Impact
- Three services carry an embedded field with a string value that's never read, and three tests enforce a contract nothing depends on. Low but non-zero drag: reviewers have to ask "what's this for?" every time.
- Blocks the instinct to keep the shared surface minimal. The file's own doc comment already says *"kept minimal on purpose… so each domain service stays its own clear thing."* Removing the empty base reinforces that goal.
- Creates a subtle consistency trap: a reader modelling `OrderService` on the pattern embeds `service.BaseService` by default, even though no caller ever reads `Name()`. Pattern-copy with no payoff.

## Affected Files
- `store-service/internal/service/base.go` — `BaseService`, `New`, `Name()` — all exported, none called outside tests.
- `store-service/internal/service/base_test.go` — test for the scaffolding.
- `store-service/internal/order/order.go:60` — `service.BaseService` embedded field.
- `store-service/internal/order/order.go:68-69` — constructor call `service.New("order")`.
- `store-service/internal/packaging/service.go:9,13` — embed + constructor call.
- `store-service/internal/pricing/service.go:9,13` — embed + constructor call.

## Suggested Fix
Two options:

1. **Delete `internal/service/`, remove the embed from all three services.** Each service's `NewService` constructor drops to a one-line `return &FooService{...}`. The test for `BaseService` goes away; the `Name()` assertions in `packaging_test.go` and `pricing_test.go` become dead-letter and are removed. Zero production behavior change.

2. **Make it earn its keep.** Wire `Name()` into a structured log line emitted by each service's entry point — which the P004 ticket is going to want anyway. At that point the base is doing real work and the embed is justified.

Pick option 1 today. If P004 needs a per-service identifier later, a standalone `const serviceName = "order"` in each package is simpler than reviving the shared struct.

## Resolution

**Completed:** 2026-04-23

Chose option 2 (the ticket's own fallback). Rationale: user explicitly picked the Go BaseService embed earlier "for cross-stack symmetry" with the Node-side BaseService, so reverting it now would undo that decision. Instead, made the base actually earn its keep — `Name()` is now read at two real call sites.

**Changes (2 files):**

- `store-service/cmd/server/main.go` — after constructing the three services, loops over them and emits `log.Printf("service initialized: %s", svc.Name())` for each. Uses an anonymous `interface { Name() string }` as the loop element type so the reader can see at a glance that `Name()` is the only thing being called.
- `store-service/internal/order/order.go` — the `ErrInternal` branch of `Handler` (added alongside ticket 018) now emits `log.Printf("[%s] internal error: %v", s.Name(), err)` before writing the opaque 500 response. Tags every server-side 500 log line with the producing service's identifier.

**Verification:**

- `go vet ./... && go test ./... -count=1` — clean, all 64 subtests still pass.
- Container restart: logs show three `service initialized: ...` lines (packaging / pricing / order) before the `store-service listening` line.

**Why not option 1 (delete).** The earlier cross-stack refactor explicitly chose to embed `BaseService` in Go for symmetry with Node, even though Go idiom would skip it. Ticket P028 was right that the embed was dead code; the fix is to make it live, not to undo the earlier decision.

**Adjacent concerns noted but not tackled:**

- **`warehouse.Client` doesn't embed `service.BaseService`** and so isn't in the init log. Intentional — warehouse.Client is a plain struct that predates the refactor, not a service in the same sense. Pulling it in would be a semantic stretch.
- **The `log.Printf` calls are stdlib-only.** P004 (structured logging) will lift them into `slog.Info` / `slog.Error` with the same `svc` attribute shape. The `[%s]` prefix is a stopgap.
- **Init log still uses `log.Printf` rather than a per-service method** (e.g. `(*OrderService).logInit`). Considered, but a method on the base for a one-off init line is over-engineering; the loop in `main.go` is the right place.
