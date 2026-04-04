#!/usr/bin/env bash
set -euo pipefail

base_url="${FRONTEND_BASE_URL:-${1:-}}"

if [[ -z "${base_url}" ]]; then
  echo "Set FRONTEND_BASE_URL or pass the frontend URL as the first argument."
  exit 1
fi

base_url="${base_url%/}"

deployment_payload="$(curl -fsS "${base_url}/api/deployment/status")"
curl -fsS "${base_url}/sign-in" >/dev/null

grep -q '"app":"ops-dashboard"' <<<"${deployment_payload}"
grep -q '"supportedExecutionScope"' <<<"${deployment_payload}"
grep -q '"backend"' <<<"${deployment_payload}"

echo "Frontend smoke passed for ${base_url}"
