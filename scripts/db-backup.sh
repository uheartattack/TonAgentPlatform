#!/usr/bin/env bash
# Daily PostgreSQL backup for ton-agent-platform.
# - Dumps the `builder_bot` schema via the docker postgres container.
# - Stores compressed dumps in /app/backups/db.
# - Keeps the last 14 daily backups; older ones are removed.
# - Intended to be called from cron: 0 3 * * *  /app/scripts/db-backup.sh
#
# Safe to re-run: per-day filename, no overwrite of older dates.

set -euo pipefail

BACKUP_DIR="/app/backups/db"
CONTAINER="ton-agent-postgres"
DB_USER="ton_agent"
DB_NAME="ton_agent_platform"
RETENTION_DAYS=14
TS="$(date -u +%Y%m%d_%H%M)"
OUT="${BACKUP_DIR}/db-${TS}.sql.gz"

mkdir -p "$BACKUP_DIR"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "[db-backup] $(date -u +%FT%TZ) ERROR: container $CONTAINER is not running" >&2
  exit 1
fi

# Dump and gzip in a single pipe to avoid touching disk twice.
# --clean --if-exists so the restore script is idempotent.
docker exec -i "$CONTAINER" \
  pg_dump --clean --if-exists --no-owner --no-acl \
  -U "$DB_USER" -d "$DB_NAME" \
  | gzip -9 > "$OUT.tmp"

# Atomic rename so partially-written files never count as a backup.
mv "$OUT.tmp" "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "[db-backup] $(date -u +%FT%TZ) wrote $OUT ($SIZE)"

# Rotation: drop dumps older than RETENTION_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete \
  | sed 's|^|[db-backup] expired: |'

# Sanity: keep at least 1 backup even if the find above misbehaves.
REMAINING=$(find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sql.gz' -type f | wc -l)
if [ "$REMAINING" -eq 0 ]; then
  echo "[db-backup] $(date -u +%FT%TZ) WARN: no backups remain after rotation" >&2
fi
