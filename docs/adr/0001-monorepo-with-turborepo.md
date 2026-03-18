# ADR 0001: Monorepo with pnpm Workspaces and Turborepo

**Status:** Accepted
**Date:** 2026-03-18
**Deciders:** Engineering Lead

---

## Context

Sentinel Apex is composed of multiple distinct packages with well-defined boundaries: domain logic, strategy engines (carry, treasury, allocator), a risk engine, execution infrastructure, venue adapters, a REST API, and an operations dashboard. These packages must:

- Share domain types, configuration schemas, and utility functions without duplication
- Be independently testable (a change to the treasury sleeve should not require rebuilding the API)
- Support incremental builds so that CI does not rebuild unchanged packages on every commit
- Have consistent tooling (TypeScript compiler options, linting rules, test runner configuration) without copy-pasting configuration files into every package
- Allow a developer to run the full local stack with a single command from the repository root

The team considered three structural options:

1. **Single package:** All code in one directory, one `package.json`. Simple to start but becomes unmanageable at scale. No enforced boundaries between domains. Any file can import any other file.

2. **Polyrepo:** Each package in its own repository. Strict boundaries enforced by repo access. High operational overhead for a small team: 12+ repositories to manage, cross-package changes require coordinating multiple PRs, shared tooling configuration must be duplicated or extracted into a separate tooling repo.

3. **Monorepo with workspaces:** All packages in a single repository, each with its own `package.json`. Shared tooling is centralized. Cross-package changes are a single PR. Boundaries are enforced by explicit imports (not file-system proximity).

The additional question within option 3 was whether to use a build orchestration tool. Without one, running `build` or `test` across all packages in dependency order requires custom scripting. Build caching is unavailable, so CI rebuild times grow linearly with the number of packages.

---

## Decision

The repository is structured as a **pnpm workspace monorepo** with **Turborepo** as the build orchestration layer.

**pnpm** is chosen as the package manager over npm or yarn because:
- Strict mode prevents packages from importing dependencies not listed in their own `package.json` (phantom dependency prevention)
- Symlink-based `node_modules` uses significantly less disk space than npm's copy-based approach
- Workspace protocol (`workspace:*`) makes cross-package dependencies explicit and version-controlled
- pnpm's lockfile format is deterministic and produces reliable reproducible installs in CI

**Turborepo** is chosen as the task runner because:
- It understands the workspace dependency graph and runs tasks in the correct topological order
- Remote caching enables CI to skip rebuilding packages whose inputs have not changed
- Pipeline configuration (`turbo.json`) is declarative and co-located with the root configuration
- It integrates directly with pnpm workspaces without additional configuration

### Repository Structure

```
/
├── turbo.json                  # Task pipeline definitions
├── package.json                # Root workspace config
├── pnpm-workspace.yaml         # Workspace package globs
├── tsconfig.base.json          # Shared TypeScript base config
├── apps/
│   ├── api/                    # Fastify REST API
│   └── ops-dashboard/          # Next.js operations dashboard
└── packages/
    ├── domain/                 # Core domain model (no infra deps)
    ├── config/                 # Configuration schema and loading
    ├── observability/          # Logging, metrics, tracing
    ├── shared/                 # Cross-cutting utilities
    ├── carry/                  # Apex Carry strategy engine
    ├── treasury/               # Atlas Treasury sleeve engine
    ├── allocator/              # Sentinel meta-allocator
    ├── risk-engine/            # Pre-trade checks + portfolio risk
    ├── strategy-engine/        # Execution coordinator
    ├── venue-adapters/         # Typed venue integration layer
    ├── execution/              # Order lifecycle + reconciliation
    └── backtest/               # Historical simulation harness
```

### Turborepo Pipeline

The `turbo.json` pipeline defines the following task order:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

`dependsOn: ["^build"]` means a package's build waits for all its workspace dependencies to build first. This ensures type definitions from `packages/domain` are available before `packages/carry` compiles.

---

## Consequences

**Positive:**
- A single `pnpm install` from the repository root installs all dependencies
- `pnpm turbo run build` builds all packages in correct dependency order with caching
- Shared TypeScript configuration is maintained in one place (`tsconfig.base.json`)
- Lint and typecheck rules apply uniformly across all packages
- Cross-package refactoring (e.g., renaming a domain type) is a single PR touching all affected files
- CI build times improve as the codebase grows due to Turborepo's content-based caching

**Negative:**
- pnpm's strict phantom-dependency prevention occasionally causes issues when third-party packages have incorrectly specified dependencies; these require explicit workarounds in the affected package's `package.json`
- Developers unfamiliar with monorepo tooling have a higher initial learning curve than a single-package setup
- Turborepo's remote cache requires a Vercel account or self-hosted cache server; local development still works without it but does not benefit from CI cache hits

**Neutral:**
- All packages are TypeScript-only; no JavaScript packages are permitted in this workspace
- Each package has its own `tsconfig.json` extending `tsconfig.base.json`; build output goes to each package's `dist/` directory
