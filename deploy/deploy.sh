#!/usr/bin/env bash
# Pull latest code and redeploy with minimal downtime. Run on the EC2 host from the repo root.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose build api web
docker compose up -d api web nginx
docker compose run --rm api /app/seed   # idempotent: applies new categories/permissions
docker image prune -f
