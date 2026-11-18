#!/usr/bin/env bash
# Build RapidSale locally and deploy it to the shared EC2 host under https://<host>/rapidsale/.
#
#   bash deploy/ec2/deploy.sh ubuntu@13.220.70.180 ~/.ssh/id_rsa
#
# The server never compiles anything (it is small and runs other live sites): Go is cross-compiled
# and Next.js is built here, then wrapped in tiny Docker images on the server.
set -euo pipefail
# Git Bash on Windows rewrites args/env like "/rapidsale" into Windows paths; disable that.
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"
HOST="${1:?usage: deploy.sh user@host [ssh-key]}"
KEY="${2:-}"
BASE_PATH="${BASE_PATH:-/rapidsale}"
REMOTE_DIR=/opt/rapidsale
SSH=(ssh -o StrictHostKeyChecking=accept-new)
SCP=(scp -o StrictHostKeyChecking=accept-new)
[ -n "$KEY" ] && SSH+=(-i "$KEY") && SCP+=(-i "$KEY")

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/deploy/ec2/build"
# Native Windows tools (go) need a Windows-style path when running under Git Bash.
GO_OUT="$OUT"; command -v cygpath >/dev/null && GO_OUT="$(cygpath -m "$OUT")"
[ -f "$ROOT/.env" ] || { echo "Missing $ROOT/.env (production env)"; exit 1; }
SITE_NAME="$(grep -E '^NEXT_PUBLIC_SITE_NAME=' "$ROOT/.env" | cut -d= -f2- || true)"

echo "==> Building Go API (linux/amd64)"
rm -rf "$OUT" && mkdir -p "$OUT/api" "$OUT/web"
( cd "$ROOT/backend" && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o "$GO_OUT/api/api" ./cmd/api \
  && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o "$GO_OUT/api/seed" ./cmd/seed )

[ -s "$OUT/api/api" ] && [ -s "$OUT/api/seed" ] || { echo "Go binaries missing in $OUT/api"; exit 1; }

echo "==> Building Next.js (basePath $BASE_PATH)"
( cd "$ROOT/web" && NEXT_BASE_PATH="$BASE_PATH" NEXT_PUBLIC_API_URL="$BASE_PATH/api" NEXT_PUBLIC_SITE_NAME="${SITE_NAME:-RapidSale}" \
  NEXT_TELEMETRY_DISABLED=1 npx next build )
cp -r "$ROOT/web/.next/standalone/." "$OUT/web/"
mkdir -p "$OUT/web/.next" && cp -r "$ROOT/web/.next/static" "$OUT/web/.next/static"
cp -r "$ROOT/web/public" "$OUT/web/public"
rm -f "$OUT/web/.env" "$OUT/web/.env.local"   # never ship local env files

echo "==> Packaging"
PKG="$(mktemp -d)/rapidsale-deploy.tgz"
tar -C "$ROOT" -czf "$PKG" .env deploy/ec2

echo "==> Uploading ($(du -h "$PKG" | cut -f1))"
"${SCP[@]}" "$PKG" "$HOST:/tmp/rapidsale-deploy.tgz"

echo "==> Deploying on server"
"${SSH[@]}" "$HOST" "REMOTE_DIR=$REMOTE_DIR bash -s" <<'REMOTE'
set -euo pipefail
sudo mkdir -p "$REMOTE_DIR"
sudo rm -rf "$REMOTE_DIR/deploy/ec2/build"
sudo tar -xzf /tmp/rapidsale-deploy.tgz -C "$REMOTE_DIR" && rm -f /tmp/rapidsale-deploy.tgz
sudo chmod 600 "$REMOTE_DIR/.env"
cd "$REMOTE_DIR"
DC=(sudo docker compose --env-file "$REMOTE_DIR/.env" -f deploy/ec2/docker-compose.yml)

echo "--> docker compose up"
"${DC[@]}" build --pull
"${DC[@]}" up -d --remove-orphans
echo "--> waiting for MySQL"
for i in $(seq 1 60); do
  [ "$(sudo docker inspect -f '{{.State.Health.Status}}' rapidsale-mysql-1 2>/dev/null)" = healthy ] && break; sleep 3
done
echo "--> seeding (idempotent)"
"${DC[@]}" run --rm -T api /app/seed </dev/null
"${DC[@]}" restart api   # reload catalog cache after seeding

echo "--> Apache include"
VHOST=/etc/apache2/sites-enabled/fastdrive-ssl.conf
sudo install -m 644 deploy/ec2/apache-rapidsale.inc /etc/apache2/rapidsale.inc
if ! sudo grep -q "Include /etc/apache2/rapidsale.inc" "$VHOST"; then
  BACKUP="/etc/apache2/fastdrive-ssl.conf.bak-$(date +%Y%m%d%H%M%S)"
  sudo cp "$VHOST" "$BACKUP"
  sudo sed -i '/RequestHeader set X-Forwarded-Proto "https"/a\    Include /etc/apache2/rapidsale.inc' "$VHOST"
  if ! sudo apache2ctl configtest; then
    echo "!! Apache config test failed, restoring $BACKUP"; sudo cp "$BACKUP" "$VHOST"; exit 1
  fi
  echo "    added Include to $VHOST (backup: $BACKUP)"
fi
sudo apache2ctl configtest && sudo systemctl reload apache2
"${DC[@]}" ps
REMOTE

echo "==> Done: https://${HOST#*@}$BASE_PATH/"
