#!/usr/bin/env bash
# Nightly MySQL dump (add to cron: 0 2 * * * /path/to/repo/deploy/backup.sh). Optionally copy to S3.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
mkdir -p backups
FILE="backups/rapidsale-$(date +%F).sql.gz"
docker compose exec -T mysql mysqldump -u root -p"$DB_ROOT_PASSWORD" --single-transaction "$DB_NAME" | gzip > "$FILE"
[ -n "${BACKUP_S3_BUCKET:-}" ] && aws s3 cp "$FILE" "s3://$BACKUP_S3_BUCKET/db/" || true
find backups -name '*.sql.gz' -mtime +14 -delete
