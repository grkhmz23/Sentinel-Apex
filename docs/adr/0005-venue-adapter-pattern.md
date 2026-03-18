# ADR 0005: Venue Adapter Pattern for All Venue Integrations

**Status:** Accepted
**Date:** 2026-03-18
**Deciders:** Engineering Lead

---

## Context

Sentinel Apex integrates with multiple external venues for execution and capital deployment:

- **Drift Protocol** (Solana DEX perpetuals) — primary carry execution
- **Binance, OKX, Bybit** (CEX perpetuals) — cross-venue rate capture and carry
- **Marginfi** (Solana on-chain lending) — treasury T0/T1 deployment
- **Kamino** (Solana yield) — treasury T0/T1 deployment

Each of these venues has a different API interface: different authentication mechanisms, different data formats, different error codes, different rate limit behaviors, different response schemas, and different latency characteristics. Drift is accessed via an on-chain SDK and Solana RPC; CEX venues are accessed via REST/WebSocket APIs; Marginfi and Kamino are on-chain protocols accessed via their TypeScript SDKs.

If the strategy engine, risk engine, and execution layer interact with these venues directly — through their native APIs and SDKs — the consequences are:

1. **Coupling:** Strategy logic becomes entangled with venue-specific details. A change to how Drift returns position data requires touching strategy code.
2. **Untestability:** Unit tests for strategy and risk logic require mocking the Drift SDK, Binance REST client, and Marginfi SDK simultaneously. Mocking three different SDK interfaces is brittle and verbose.
3. **Inconsistency:** Venue A returns quantities as strings; venue B returns them as numbers; venue C denominations in base asset; venue D in quote asset. Without normalization at a boundary, type coercions and unit assumptions are scattered throughout the codebase.
4. **Dry-run impossibility:** Replacing live venue calls with simulated fills requires either conditional branching throughout the codebase (if PAPER_MODE: ...) or a clean abstraction boundary where the swap can happen in one place.

The adapter pattern (also known as the port-and-adapter or hexagonal architecture pattern in the context of application design) addresses all of these concerns by placing a typed interface between the domain logic and the external venue.

---

## Decision

**All venue integrations are implemented behind a typed `VenueAdapter` interface.** No code outside of `packages/venue-adapters` is permitted to import or reference a venue-specific SDK (Drift SDK, Binance REST client, Marginfi SDK, etc.) directly.

### The VenueAdapter Interface

```typescript
// packages/venue-adapters/src/types.ts

export interface VenueAdapter {
  readonly venueId: string;
  readonly venueType: VenueType;

  // Market data
  getPrice(asset: Asset): Promise<Result<PriceQuote, VenueError>>;
  getOrderBook(asset: Asset, depth: number): Promise<Result<OrderBook, VenueError>>;
  getFundingRate(asset: Asset): Promise<Result<FundingRate, VenueError>>;
  getOpenInterest(asset: Asset): Promise<Result<OpenInterest, VenueError>>;

  // Account state
  getPositions(): Promise<Result<VenuePosition[], VenueError>>;
  getBalances(): Promise<Result<VenueBalance[], VenueError>>;

  // Execution (only for execution venues, not treasury venues)
  submitOrder?(intent: OrderIntent): Promise<Result<VenueOrderId, VenueError>>;
  cancelOrder?(venueOrderId: VenueOrderId): Promise<Result<void, VenueError>>;
  getOrderStatus?(venueOrderId: VenueOrderId): Promise<Result<VenueOrderStatus, VenueError>>;

  // Treasury (only for treasury venues)
  deposit?(asset: Asset, amount: Decimal): Promise<Result<VenueDepositId, VenueError>>;
  withdraw?(asset: Asset, amount: Decimal): Promise<Result<VenueWithdrawalId, VenueError>>;
  getDepositBalance?(asset: Asset): Promise<Result<VenueBalance, VenueError>>;

  // Connection health
  isHealthy(): Promise<boolean>;
  getLatencyStats(): VenueLatencyStats;
}
```

All return types are wrapped in a `Result<T, E>` type (Either monad). Venue adapters never throw exceptions for expected failure modes (API errors, rate limits, order rejections). They return typed errors that callers handle explicitly.

### Normalization at the Boundary

Every venue adapter is responsible for normalizing external data to internal domain types before returning. Specific normalization requirements:

- **Quantities:** All quantities are returned as `Decimal` instances, regardless of whether the venue returns them as `string`, `number`, or scientific notation
- **Prices:** All prices in USD-denominated `Decimal`
- **Funding rates:** All rates expressed as annualized decimal fractions (e.g., 0.10 = 10% annualized), regardless of venue convention (some venues return per-8h rates, some per-day, some annualized)
- **Timestamps:** All timestamps returned as ISO 8601 UTC strings
- **Asset symbols:** All assets referenced by the system's internal `assetId`, not the venue's ticker string — the adapter is responsible for the mapping
- **Error codes:** Venue-specific error codes are mapped to typed `VenueError` variants; raw venue error messages are logged but not propagated as business logic

### Concrete Implementations

| Adapter | Venues | Module |
|---|---|---|
| `DriftAdapter` | Drift Protocol | `packages/venue-adapters/src/drift/` |
| `BinanceAdapter` | Binance perps | `packages/venue-adapters/src/binance/` |
| `OkxAdapter` | OKX perps | `packages/venue-adapters/src/okx/` |
| `BybitAdapter` | Bybit perps | `packages/venue-adapters/src/bybit/` |
| `MarginfiAdapter` | Marginfi lending | `packages/venue-adapters/src/marginfi/` |
| `KaminoAdapter` | Kamino yield | `packages/venue-adapters/src/kamino/` |
| `SimulatedVenueAdapter` | Paper trading | `packages/venue-adapters/src/simulated/` |

All implementations extend a `BaseVenueAdapter` that provides:
- Rate limit tracking and request queuing
- Circuit breaker state management
- Retry logic with exponential backoff for transient errors
- Latency measurement and reporting

### Testing Strategy

Because all domain logic depends on `VenueAdapter` (the interface), not on any concrete adapter, unit tests for strategy, risk, and execution logic use a `MockVenueAdapter` that returns configured responses. Tests for the concrete adapters (`DriftAdapter`, etc.) are integration tests that run against recorded API responses (using HTTP playback fixtures) or against testnet endpoints in CI.

### Response Schema Validation

Every response from a real venue adapter is validated against a Zod schema before being processed. If the response does not match the schema:
- The adapter returns a `VenueError` with type `UnexpectedResponseShape`
- The raw response is logged at DEBUG level for investigation
- Unknown fields in responses are ignored (not trusted)
- Missing required fields cause schema validation failure

This prevents a venue API change from silently producing incorrect data that propagates into the domain.

---

## Consequences

**Positive:**
- Strategy, risk, and execution logic is completely decoupled from venue-specific SDKs. Replacing a CEX venue or adding a new treasury protocol requires only a new adapter implementation; no changes to domain logic.
- Unit testing of domain logic is simple: inject a `MockVenueAdapter` with controlled responses. No mocking of HTTP clients, Solana RPCs, or SDK internals.
- Paper trading (ADR-0004) is trivially implemented by injecting `SimulatedVenueAdapter` instead of real adapters. The swap is a single line in the adapter factory.
- Funding rate normalization at the boundary means the carry engine works with consistent units regardless of how many different venues express rates differently.
- Schema validation at the boundary means venue API changes are caught immediately and produce explicit errors rather than silent data corruption.

**Negative:**
- Each new venue requires writing a new adapter, including response schema definitions, normalization logic, and integration tests. This is a non-trivial amount of code per venue.
- The abstraction layer adds one level of indirection. Debugging a venue-specific issue (e.g., a Drift order rejection) requires tracing through the adapter layer.
- The `VenueAdapter` interface must remain stable; adding new capabilities required by specific venues (e.g., a Drift-specific feature unavailable on CEX) must be done through optional methods or a separate interface extension, not by changing the core interface.

**Neutral:**
- The adapter implementations are not unit tested in isolation against live venues in normal CI runs. Integration tests run against fixtures. Production behavior is validated in paper-trading mode before live deployment.
- Venue adapter code is the most likely to break due to external changes (API updates, SDK version bumps). Adapter tests are run on a weekly schedule against live testnet endpoints to catch breaking changes before they affect production.
