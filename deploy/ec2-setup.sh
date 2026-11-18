#!/usr/bin/env bash
# One-time bootstrap for an EC2 instance (Ubuntu 22.04/24.04 or Amazon Linux 2023).
# Run from the repository root on the server:  sudo bash deploy/ec2-setup.sh
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Create .env from .env.example first"; exit 1; }

# Fill any blank/placeholder secrets with random values (written back to .env, chmod 600).
gen() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
for key in JWT_SECRET OTP_SECRET DB_PASSWORD DB_ROOT_PASSWORD; do
  val="$(grep -E "^${key}=" .env | cut -d= -f2- || true)"
  if [ -z "$val" ] || [[ "$val" == change-me* ]]; then
    if grep -qE "^${key}=" .env; then sed -i "s#^${key}=.*#${key}=$(gen)#" .env; else echo "${key}=$(gen)" >> .env; fi
    echo "    generated ${key}"
  fi
done
chmod 600 .env
set -a; . ./.env; set +a
: "${DOMAIN:?DOMAIN must be set in .env}"

echo "==> Installing cron (for certificate renewal)"
if ! command -v crontab >/dev/null; then
  if command -v dnf >/dev/null; then dnf install -y cronie && systemctl enable --now crond; else apt-get update -y && apt-get install -y cron; fi
fi

echo "==> Installing Docker"
if ! command -v docker >/dev/null; then
  if [ -f /etc/os-release ] && grep -q "Amazon Linux" /etc/os-release; then
    dnf install -y docker
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    systemctl enable --now docker
  else
    curl -fsSL https://get.docker.com | sh
  fi
fi

echo "==> Adding 2G swap (helps small instances build images)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Building and starting the stack"
docker compose up -d --build

echo "==> Seeding roles, superadmin, categories and locations"
docker compose run --rm api /app/seed

if [ -n "${LETSENCRYPT_EMAIL:-}" ] && [ ! -f deploy/nginx/templates/ssl.conf.template ]; then
  # Only request www.<domain> if its DNS resolves; otherwise Let's Encrypt rejects the whole request.
  DOMAINS=(-d "$DOMAIN")
  if getent hosts "www.$DOMAIN" >/dev/null; then DOMAINS+=(-d "www.$DOMAIN"); fi
  echo "==> Requesting a Let's Encrypt certificate for ${DOMAINS[*]}"
  if docker compose --profile certbot run --rm certbot certonly --webroot -w /var/www/certbot \
      "${DOMAINS[@]}" --cert-name "$DOMAIN" --email "$LETSENCRYPT_EMAIL" --agree-tos --non-interactive; then
    cp deploy/nginx/templates/ssl.conf.template.disabled deploy/nginx/templates/ssl.conf.template
    sed -i 's#include /etc/nginx/conf.d/app.locations;#location / { return 301 https://$host$request_uri; }#' \
      deploy/nginx/templates/default.conf.template
    docker compose restart nginx
    # Renew twice a day; nginx reloads to pick up renewed certificates.
    ( crontab -l 2>/dev/null | grep -v certbot; echo "17 3,15 * * * cd $(pwd) && docker compose --profile certbot run --rm certbot renew -q && docker compose exec nginx nginx -s reload" ) | crontab -
  else
    echo "!! Certificate request failed. Check that DNS for $DOMAIN points to this instance and ports 80/443 are open."
  fi
fi

echo "==> Done. Visit https://$DOMAIN  (admin: $SUPERADMIN_EMAIL)"
