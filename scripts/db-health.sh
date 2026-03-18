#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/infra/docker/docker-compose.local-db.yml"

docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U sentinel -d sentinel_apex
