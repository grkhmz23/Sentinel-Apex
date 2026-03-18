#!/usr/bin/env bash
# =============================================================================
# Sentinel Apex — Bootstrap Script
# =============================================================================
# Sets up a fresh developer environment end-to-end:
#   1. Verify required tools are available
#   2. Install Node dependencies via pnpm
#   3. Copy .env.example → .env (if not already present)
#   4. Start local Postgres
#   5. Run database migrations
#   7. Print next-steps summary
# =============================================================================

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "${CYAN}[bootstrap]${RESET} $*"; }
success() { echo -e "${GREEN}[bootstrap] ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}[bootstrap] ⚠${RESET} $*"; }
error()   { echo -e "${RED}[bootstrap] ✗${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

require_cmd() {
  local cmd="$1"
  local install_hint="${2:-}"
  if ! command -v "$cmd" &>/dev/null; then
    error "Required command not found: ${BOLD}${cmd}${RESET}"
    if [[ -n "$install_hint" ]]; then
      error "  Install it with: $install_hint"
    fi
    exit 1
  fi
}

# ── Resolve repo root ─────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}   Sentinel Apex — Developer Bootstrap${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════${RESET}"
echo ""

# =============================================================================
# Step 1 — Check prerequisites
# =============================================================================
info "Checking prerequisites…"

require_cmd node  "https://nodejs.org  (or use nvm: nvm install)"
require_cmd pnpm  "npm install -g pnpm  (or: corepack enable && corepack prepare pnpm@latest --activate)"
require_cmd docker "https://docs.docker.com/get-docker/"
require_cmd docker-compose "Included with Docker Desktop, or: https://docs.docker.com/compose/install/"

# Node version check
NODE_VERSION_REQUIRED="20"
NODE_VERSION_ACTUAL="$(node --version | sed 's/v//' | cut -d. -f1)"
if [[ "$NODE_VERSION_ACTUAL" -lt "$NODE_VERSION_REQUIRED" ]]; then
  die "Node.js >= ${NODE_VERSION_REQUIRED} is required (found $(node --version)). Use nvm: nvm use"
fi

# pnpm version check
PNPM_VERSION_REQUIRED="9"
PNPM_VERSION_ACTUAL="$(pnpm --version | cut -d. -f1)"
if [[ "$PNPM_VERSION_ACTUAL" -lt "$PNPM_VERSION_REQUIRED" ]]; then
  warn "pnpm >= ${PNPM_VERSION_REQUIRED} is recommended (found $(pnpm --version)). Run: corepack prepare pnpm@latest --activate"
fi

success "All prerequisites satisfied."

# =============================================================================
# Step 2 — Install dependencies
# =============================================================================
info "Installing dependencies via pnpm…"

if [[ -f "pnpm-lock.yaml" ]]; then
  pnpm install --frozen-lockfile
else
  warn "pnpm-lock.yaml not found — running pnpm install (lock file will be created)"
  pnpm install
fi

success "Dependencies installed."

# =============================================================================
# Step 3 — Environment file
# =============================================================================
info "Checking environment configuration…"

if [[ -f ".env" ]]; then
  warn ".env already exists — skipping copy. Review it manually if variables have changed."
else
  cp .env.example .env
  success ".env created from .env.example."
  echo ""
  echo -e "  ${YELLOW}Action required:${RESET} Open .env and fill in the required values:"
  echo -e "    • ${BOLD}DATABASE_URL${RESET}         — local default: postgresql://sentinel:sentinel@localhost:5432/sentinel_apex"
  echo -e "    • ${BOLD}API_SECRET_KEY${RESET}       — generate with: openssl rand -hex 64"
  echo -e "    • ${BOLD}EXECUTION_MODE${RESET}       — keep this at dry-run for local/dev"
  echo -e "    • ${BOLD}FEATURE_FLAG_LIVE_EXECUTION${RESET} — keep this false for local/dev"
  echo ""
fi

# =============================================================================
# Step 4 — Start local Postgres
# =============================================================================
info "Starting local Postgres…"

if ! docker info &>/dev/null; then
  die "Docker daemon is not running. Start Docker Desktop or the Docker service and retry."
fi

pnpm db:start
success "Local Postgres is ready."

# =============================================================================
# Step 5 — Run database migrations
# =============================================================================
info "Running database migrations…"

if [[ -z "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="postgresql://sentinel:sentinel@localhost:5432/sentinel_apex"
fi

pnpm db:migrate
success "Migrations applied."

# =============================================================================
# Step 6 — Summary
# =============================================================================
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  Bootstrap complete!${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo ""
echo -e "  1. Review and update ${CYAN}.env${RESET} with the local Postgres connection and API key."
echo -e "  2. Start the development server:"
echo -e "       ${CYAN}pnpm --filter @sentinel-apex/api dev${RESET}   or   ${CYAN}make dev-api${RESET}"
echo -e "  3. Run one deterministic paper cycle:"
echo -e "       ${CYAN}pnpm --filter @sentinel-apex/runtime dev:run-cycle${RESET}"
echo ""
echo -e "  ${BOLD}Useful commands:${RESET}"
echo -e "    ${CYAN}make help${RESET}          — list all Makefile targets"
echo -e "    ${CYAN}make test${RESET}          — run all tests"
echo -e "    ${CYAN}make typecheck${RESET}     — type-check all packages"
echo -e "    ${CYAN}make lint${RESET}          — lint all packages"
echo -e "    ${CYAN}make db-start${RESET}      — start local Postgres"
echo -e "    ${CYAN}make db-migrate${RESET}    — apply migrations"
echo ""
