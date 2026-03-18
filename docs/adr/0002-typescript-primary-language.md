# ADR 0002: TypeScript as the Primary Language

**Status:** Accepted
**Date:** 2026-03-18
**Deciders:** Engineering Lead

---

## Context

Sentinel Apex requires a primary implementation language for all application-layer code: strategy engines, risk checks, execution management, the REST API, and the operations dashboard. The following requirements shaped the language selection:

**Type safety is non-negotiable for financial systems.** Incorrect types for monetary values, order sides, position states, or risk metric computations are not merely bugs — they are capital loss events. The language must make it structurally difficult to confuse a `quantity` (units of base asset) with a `notionalUsd` (dollar value), or to pass a `Decimal` funding rate where a percentage is expected.

**Domain modeling must be first-class.** The system has a rich domain model with state machines, invariants, and event types. The language must support discriminated unions, exhaustiveness checking, and readonly data structures well — not as library add-ons, but as native language features.

**The Drift Protocol SDK and Solana web3.js ecosystem are TypeScript-native.** The primary execution venue (Drift Protocol) publishes its SDK in TypeScript. All Solana tooling (web3.js, Anchor) has TypeScript as the primary or best-supported interface. Using a different language for the system would require writing and maintaining FFI bindings or spawning subprocess calls to interact with Drift — unnecessary complexity.

**The operations dashboard requires a JavaScript-compatible environment.** The Next.js ops dashboard and its server-side logic must be JavaScript-compatible. A typed language that compiles to JavaScript is the natural fit; the same domain types can be shared between the backend engine and the frontend dashboard without duplication or a separate IDL layer.

The team considered the following languages:

1. **Python:** Strong data science ecosystem. Lacks native discriminated unions. Type checking is opt-in and enforced by a separate tool (mypy), not the compiler. Runtime type errors are common even with type annotations. Not compatible with the Solana/Drift SDK ecosystem without additional bridging. Rejected.

2. **Rust:** Excellent type system. Native performance. Memory safety. However: Solana program development is in Rust, but the Drift Protocol SDK for off-chain trading is not mature in Rust. The team does not have the Rust proficiency to deliver safely within project timelines. Rejected for this phase; may be revisited for specific performance-critical hot paths.

3. **Go:** Strong performance, good type system, excellent concurrency model. No native discriminated unions; sum types are approximated with interfaces. Not compatible with the Solana SDK ecosystem. Rejected.

4. **TypeScript:** Structural type system with discriminated unions, exhaustiveness checking, readonly modifiers, template literal types, and inference that handles complex generic patterns. Native to the Solana ecosystem. Compiles away at runtime (zero overhead versus JavaScript). The operations dashboard shares types with the backend directly.

---

## Decision

**TypeScript is the primary and exclusive implementation language** for all application-layer code in this repository.

Specific rules that follow from this decision:

### Strict TypeScript Configuration

All packages compile with `strict: true` in `tsconfig.json`. This enables:
- `strictNullChecks`: `null` and `undefined` are not assignable to non-nullable types
- `noImplicitAny`: All variables and parameters must have explicit or inferable types
- `strictFunctionTypes`: Function parameter types are checked contravariantly
- `strictPropertyInitialization`: Class properties must be assigned in the constructor

Additionally, the following compiler options are enabled:
- `noUncheckedIndexedAccess`: Array and object index access returns `T | undefined`, not `T`
- `exactOptionalPropertyTypes`: `{ foo?: string }` means `foo` is either `string` or absent, not `string | undefined`
- `noImplicitOverride`: Class method overrides must use the `override` keyword

### Financial Values Use Decimal, Not Number

All monetary values, quantities, prices, and rates are typed as `Decimal` (from `decimal.js`). The `number` primitive is prohibited for any financial computation. This is enforced via a custom ESLint rule that flags `number` usage in modules within `packages/domain`, `packages/carry`, `packages/risk-engine`, `packages/treasury`, and `packages/execution`.

### Discriminated Unions for State

All state machines use discriminated union types. For example:

```typescript
type OrderState =
  | { status: 'intent'; intentCreatedAt: string }
  | { status: 'submitted'; submittedAt: string; venueOrderId: string }
  | { status: 'filled'; filledAt: string; filledQty: Decimal }
  | { status: 'failed'; failedAt: string; reason: string };
```

Switch statements over `status` are checked for exhaustiveness by the TypeScript compiler. Adding a new state variant without handling it in all switch statements produces a compile error.

### No `any`

The ESLint rule `@typescript-eslint/no-explicit-any` is set to `error`. The `as any` cast and `// @ts-ignore` comments are prohibited. `// @ts-expect-error` is permitted only with a comment explaining why the suppression is necessary and a ticket reference to fix it.

### Runtime Validation at System Boundaries

TypeScript's type safety only applies within the compiled code. All data entering the system from external sources (API requests, venue API responses, database reads) is validated against a Zod schema at the boundary. The inferred TypeScript type from the Zod schema is used as the type inside the system. This prevents trusting external data's type without validation.

### Versioning

All packages use `"type": "module"` (ESM) in their `package.json`. CommonJS modules are prohibited for new code. The TypeScript compiler target is `ES2022`.

---

## Consequences

**Positive:**
- Type errors in domain logic are caught at compile time, not at runtime in production
- Discriminated unions with exhaustiveness checking make adding new cases to state machines safe: the compiler identifies every switch statement that needs updating
- Shared types between API server and ops dashboard eliminate the need for a separate schema definition language or code generation step
- `decimal.js` typing as `Decimal` makes it structurally impossible to pass a raw `number` to a function expecting a monetary value without an explicit conversion
- The Drift Protocol SDK, Solana web3.js, Marginfi SDK, and Kamino SDK are all TypeScript-native; no bridging layer is required

**Negative:**
- TypeScript compilation adds a build step that JavaScript does not require. This is a negligible cost given Turborepo's caching.
- Strict mode and `noUncheckedIndexedAccess` produce more verbose code in some patterns (e.g., array index access always requires nullish handling). This is the correct tradeoff for a financial system.
- Developers familiar with Python's data science tooling (pandas, numpy) will find the TypeScript ecosystem for quantitative analysis less mature. Backtesting and analytics code that requires heavy numerical computation may eventually be extracted to a Python notebook layer; this is explicitly deferred to a future decision.

**Neutral:**
- JavaScript files (`.js`) are not permitted in the `packages/` or `apps/` directories. All source files are `.ts` or `.tsx`.
- Tests are written in TypeScript using Vitest.
- Configuration files (e.g., `vite.config.ts`, `next.config.ts`) use TypeScript where the tooling supports it.
