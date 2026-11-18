#!/usr/bin/env bash
# Upload this repository to an EC2 host over SSH and run the setup (Docker, build, seed, SSL via certbot).
#
#   bash deploy/push.sh ubuntu@<ec2-public-ip> ~/.ssh/my-key.pem
#
# Requires a filled-in .env in the repo root (copy .env.example). Re-running it redeploys.
set -euo pipefail
HOST="${1:?usage: push.sh user@host [path/to/key.pem]}"
KEY="${2:-}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[ -n "$KEY" ] && SSH_OPTS+=(-i "$KEY")

cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Create .env from .env.example first"; exit 1; }

ARCHIVE="$(mktemp -d)/rapidsale.tgz"
echo "==> Packaging"
tar --exclude=node_modules --exclude=.next --exclude='*.exe' --exclude=backend/uploads \
    --exclude=backend/.env --exclude=web/.env.local --exclude=mobile/.env --exclude=mobile/.expo \
    -czf "$ARCHIVE" .

echo "==> Uploading to $HOST"
scp "${SSH_OPTS[@]}" "$ARCHIVE" "$HOST:/tmp/rapidsale.tgz"

echo "==> Installing on server"
ssh "${SSH_OPTS[@]}" "$HOST" 'set -e
  sudo mkdir -p /opt/rapidsale
  # Keep the server copy of .env (it holds generated secrets) and the enabled SSL config.
  [ -f /opt/rapidsale/.env ] && sudo cp /opt/rapidsale/.env /tmp/rapidsale.env.keep || true
  [ -f /opt/rapidsale/deploy/nginx/templates/ssl.conf.template ] && sudo cp -r /opt/rapidsale/deploy/nginx/templates /tmp/rapidsale.nginx.keep || true
  sudo tar -xzf /tmp/rapidsale.tgz -C /opt/rapidsale
  [ -f /tmp/rapidsale.env.keep ] && sudo mv /tmp/rapidsale.env.keep /opt/rapidsale/.env || true
  [ -d /tmp/rapidsale.nginx.keep ] && sudo cp -r /tmp/rapidsale.nginx.keep/. /opt/rapidsale/deploy/nginx/templates/ && sudo rm -rf /tmp/rapidsale.nginx.keep || true
  rm -f /tmp/rapidsale.tgz
  cd /opt/rapidsale && sudo bash deploy/ec2-setup.sh'
