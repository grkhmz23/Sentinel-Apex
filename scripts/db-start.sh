#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/infra/docker/docker-compose.local-db.yml"

docker compose -f "$COMPOSE_FILE" up -d postgres

for _ in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U sentinel -d sentinel_apex >/dev/null 2>&1; then
    echo "[db] postgres is ready"
    exit 0
  fi
  sleep 1
done

echo "[db] postgres did not become ready in time" >&2
exit 1
