#!/usr/bin/env bash
set -euo pipefail

base_url="${BACKEND_BASE_URL:-${1:-}}"

if [[ -z "${base_url}" ]]; then
  echo "Set BACKEND_BASE_URL or pass the backend URL as the first argument."
  exit 1
fi

base_url="${base_url%/}"

health_payload="$(curl -fsS "${base_url}/health")"
ready_payload="$(curl -fsS "${base_url}/readyz")"

grep -q '"service":"api"' <<<"${health_payload}"
grep -q '"supportedExecutionScope"' <<<"${ready_payload}"
grep -q '"blockedExecutionScope"' <<<"${ready_payload}"

echo "Backend smoke passed for ${base_url}"
