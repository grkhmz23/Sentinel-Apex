# =============================================================================
# Sentinel Apex — Makefile
# =============================================================================
# All targets are phony (they don't produce output files).
# Run `make help` to list available targets.
# =============================================================================

SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help

# Colour helpers
BOLD  := \033[1m
RESET := \033[0m
GREEN := \033[32m
CYAN  := \033[36m

##@ General

.PHONY: help
help: ## Show this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\n$(BOLD)Usage:$(RESET)\n  make $(CYAN)<target>$(RESET)\n"} \
		/^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2 } \
		/^##@/ { printf "\n$(BOLD)%s$(RESET)\n", substr($$0, 5) }' $(MAKEFILE_LIST)

##@ Setup

.PHONY: setup
setup: ## Install all dependencies via pnpm
	@echo "$(GREEN)→ Installing dependencies…$(RESET)"
	pnpm install --frozen-lockfile
	@if [ ! -f .env ]; then \
		echo "$(GREEN)→ Creating .env from .env.example…$(RESET)"; \
		cp .env.example .env; \
	else \
		echo "  .env already exists — skipping copy"; \
	fi
	@echo "$(GREEN)✓ Setup complete$(RESET)"

##@ Development

.PHONY: dev
dev: ## Start all services in watch/dev mode
	@echo "$(GREEN)→ Starting all services…$(RESET)"
	pnpm turbo run dev --parallel

.PHONY: dev-api
dev-api: ## Start the API in watch mode
	@echo "$(GREEN)→ Starting API…$(RESET)"
	pnpm --filter @sentinel-apex/api dev

.PHONY: build
build: ## Build all packages and apps
	@echo "$(GREEN)→ Building all packages…$(RESET)"
	pnpm turbo run build

##@ Quality

.PHONY: test
test: ## Run all tests
	@echo "$(GREEN)→ Running tests…$(RESET)"
	pnpm turbo run test

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	pnpm vitest --watch

.PHONY: lint
lint: ## Lint all source files
	@echo "$(GREEN)→ Linting…$(RESET)"
	pnpm turbo run lint

.PHONY: lint-fix
lint-fix: ## Lint and auto-fix all source files
	pnpm turbo run lint -- --fix

.PHONY: typecheck
typecheck: ## Run TypeScript type checking across all packages
	@echo "$(GREEN)→ Type checking…$(RESET)"
	pnpm turbo run typecheck

.PHONY: format
format: ## Format all files with Prettier
	@echo "$(GREEN)→ Formatting…$(RESET)"
	pnpm prettier --write "**/*.{ts,tsx,js,cjs,mjs,json,yaml,yml,md}" --ignore-path .gitignore

.PHONY: format-check
format-check: ## Check formatting without writing changes
	pnpm prettier --check "**/*.{ts,tsx,js,cjs,mjs,json,yaml,yml,md}" --ignore-path .gitignore

##@ Database

.PHONY: db-migrate
db-migrate: ## Run pending database migrations
	@echo "$(GREEN)→ Running database migrations…$(RESET)"
	pnpm db:migrate

.PHONY: db-reset
db-reset: ## Drop and recreate the database, then run all migrations
	@echo "$(GREEN)→ Resetting database ($(BOLD)destructive$(RESET)$(GREEN))…$(RESET)"
	@read -p "  Are you sure? This will destroy all data. [y/N] " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		pnpm db:reset; \
		echo "$(GREEN)✓ Database reset complete$(RESET)"; \
	else \
		echo "  Aborted."; \
	fi

.PHONY: db-start
db-start: ## Start local Postgres
	@echo "$(GREEN)→ Starting local Postgres…$(RESET)"
	pnpm db:start

.PHONY: db-stop
db-stop: ## Stop local Postgres
	@echo "$(GREEN)→ Stopping local Postgres…$(RESET)"
	pnpm db:stop

.PHONY: db-health
db-health: ## Check local Postgres readiness
	@echo "$(GREEN)→ Checking local Postgres health…$(RESET)"
	pnpm db:health

##@ Docker

.PHONY: docker-up
docker-up: ## Start all Docker Compose services (detached)
	@echo "$(GREEN)→ Starting Docker services…$(RESET)"
	docker compose -f infra/docker/docker-compose.local-db.yml up -d postgres
	@echo "$(GREEN)✓ Services running$(RESET)"

.PHONY: docker-down
docker-down: ## Stop and remove Docker Compose containers
	@echo "$(GREEN)→ Stopping Docker services…$(RESET)"
	docker compose -f infra/docker/docker-compose.local-db.yml down
	@echo "$(GREEN)✓ Services stopped$(RESET)"

.PHONY: docker-logs
docker-logs: ## Tail logs from all Docker services
	docker compose -f infra/docker/docker-compose.local-db.yml logs -f

.PHONY: docker-ps
docker-ps: ## List running Docker containers
	docker compose -f infra/docker/docker-compose.local-db.yml ps

##@ Maintenance

.PHONY: clean
clean: ## Remove all build artifacts and caches
	@echo "$(GREEN)→ Cleaning build artifacts…$(RESET)"
	pnpm turbo run clean
	rm -rf node_modules .turbo coverage
	find . -name "dist" -not -path "*/node_modules/*" -type d -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete 2>/dev/null || true
	@echo "$(GREEN)✓ Clean complete$(RESET)"

.PHONY: nuke
nuke: clean ## Remove everything including pnpm store (full reset)
	@echo "$(GREEN)→ Nuking pnpm store and lock file…$(RESET)"
	rm -rf pnpm-lock.yaml
	pnpm store prune
	@echo "$(GREEN)✓ Nuke complete — run 'make setup' to reinstall$(RESET)"
