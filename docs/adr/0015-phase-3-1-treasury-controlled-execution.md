# ADR 0015: Phase 3.1 Treasury Controlled Execution

Date: 2026-03-21
Status: Accepted

## Decision

Atlas Treasury execution will reuse the existing runtime command and worker model rather than introducing a separate treasury executor.

Treasury policy recommendations and treasury execution intents are separate concepts:

- policy produces recommendations
- treasury execution planner produces execution-ready intents with blocked reasons and approval metadata
- worker executes approved treasury actions through explicit treasury venue adapter capabilities

## Why

- keeps treasury under the same durable command lifecycle as the rest of the runtime
- avoids a hidden second control plane
- preserves existing actor propagation, audit, and worker health semantics
- makes simulated and live boundaries explicit in one place

## Consequences

- treasury action lifecycle is durable and inspectable
- treasury execution attempts have append-only history
- runtime owns treasury execution-time revalidation
- future real treasury connectors can plug into the same adapter and worker path
- allocator work remains intentionally out of scope
