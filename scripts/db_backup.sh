#!/usr/bin/env bash
# Database Backup Script for Healthcare Recruitment CRM
set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/crm_db_backup_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-crm_db}"

echo "Creating database backup for ${DB_NAME}..."
mysqldump -u "${DB_USER}" -p "${DB_NAME}" > "${BACKUP_FILE}"
gzip "${BACKUP_FILE}"

echo "✓ Backup created successfully: ${BACKUP_FILE}.gz"
