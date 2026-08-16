#!/usr/bin/env bash
# Database Restore Script for Healthcare Recruitment CRM
set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/db_restore.sh <path_to_backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-crm_db}"

echo "Restoring database ${DB_NAME} from ${BACKUP_FILE}..."
gunzip -c "${BACKUP_FILE}" | mysql -u "${DB_USER}" -p "${DB_NAME}"

echo "✓ Database restore completed successfully."
