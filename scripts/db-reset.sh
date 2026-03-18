#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/infra/docker/docker-compose.local-db.yml"

docker compose -f "$COMPOSE_FILE" down -v
"$REPO_ROOT/scripts/db-start.sh"

if [[ -z "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="postgresql://sentinel:sentinel@localhost:5432/sentinel_apex"
fi

pnpm --dir "$REPO_ROOT" --filter @sentinel-apex/db migrate
