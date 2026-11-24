#!/bin/sh
# =============================================================
# CECS — Backup harian (PostgreSQL + MinIO)
# Dijalankan lewat cron di host Docker, sebagai root.
#
#   sh /opt/cecs/scripts/backup.sh
#
# Keluaran:
#   $BACKUP_DIR/db-YYYY-MM-DD.sql.gz
#   $BACKUP_DIR/minio-YYYY-MM-DD.tar.gz
#   $BACKUP_DIR/backup.log
# =============================================================
set -eu

BACKUP_DIR="${BACKUP_DIR:-/var/backups/cecs}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
PG_CONTAINER="${PG_CONTAINER:-cecs_postgres}"
MINIO_VOLUME="${MINIO_VOLUME:-cecs_prod_minio_data}"
POSTGRES_USER="${POSTGRES_USER:-cecs_user}"
POSTGRES_DB="${POSTGRES_DB:-cecs}"

STAMP="$(date +%F)"
LOG="$BACKUP_DIR/backup.log"

mkdir -p "$BACKUP_DIR"

log() {
    echo "$(date '+%F %T') | $*" | tee -a "$LOG"
}

fail() {
    log "GAGAL: $*"
    exit 1
}

log "===== Backup dimulai ($STAMP) ====="

# ── 1. PostgreSQL ────────────────────────────────────────────
# Ditulis ke berkas sementara dulu, baru dipindahkan setelah sukses.
# Tanpa ini, backup yang terpotong di tengah jalan akan terlihat seperti
# backup yang sah — dan baru ketahuan rusak saat dibutuhkan.
DB_TMP="$BACKUP_DIR/.db-$STAMP.sql.gz.part"
DB_OUT="$BACKUP_DIR/db-$STAMP.sql.gz"

log "Dump PostgreSQL dari container $PG_CONTAINER..."
if ! docker exec "$PG_CONTAINER" pg_dump \
        -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
        | gzip > "$DB_TMP"; then
    rm -f "$DB_TMP"
    fail "pg_dump tidak berhasil"
fi

# gzip -t membaca seluruh berkas; dump terpotong akan ketahuan di sini.
gzip -t "$DB_TMP" || { rm -f "$DB_TMP"; fail "arsip database rusak"; }
mv "$DB_TMP" "$DB_OUT"
log "Database OK  -> $DB_OUT ($(du -h "$DB_OUT" | cut -f1))"

# ── 2. MinIO (lampiran foto & dokumen) ───────────────────────
MINIO_TMP="$BACKUP_DIR/.minio-$STAMP.tar.gz.part"
MINIO_OUT="$BACKUP_DIR/minio-$STAMP.tar.gz"

log "Arsipkan volume MinIO $MINIO_VOLUME..."
if ! docker run --rm \
        -v "$MINIO_VOLUME":/data:ro \
        -v "$BACKUP_DIR":/backup \
        alpine:latest \
        tar czf "/backup/$(basename "$MINIO_TMP")" -C /data . ; then
    rm -f "$MINIO_TMP"
    fail "arsip MinIO tidak berhasil"
fi

gzip -t "$MINIO_TMP" || { rm -f "$MINIO_TMP"; fail "arsip MinIO rusak"; }
mv "$MINIO_TMP" "$MINIO_OUT"
log "MinIO OK     -> $MINIO_OUT ($(du -h "$MINIO_OUT" | cut -f1))"

# ── 3. Rotasi ────────────────────────────────────────────────
log "Hapus backup lebih tua dari $RETENTION_DAYS hari..."
find "$BACKUP_DIR" -name 'db-*.sql.gz'     -type f -mtime "+$RETENTION_DAYS" -print -delete | tee -a "$LOG"
find "$BACKUP_DIR" -name 'minio-*.tar.gz'  -type f -mtime "+$RETENTION_DAYS" -print -delete | tee -a "$LOG"
# Bersihkan sisa berkas .part dari percobaan yang gagal
find "$BACKUP_DIR" -name '.*.part' -type f -mtime +1 -delete 2>/dev/null || true

# ── 4. Ringkasan ─────────────────────────────────────────────
COUNT=$(find "$BACKUP_DIR" -name 'db-*.sql.gz' -type f | wc -l | tr -d ' ')
log "Selesai. $COUNT salinan database tersimpan di $BACKUP_DIR"
log "PENGINGAT: backup di server yang sama TIDAK melindungi dari ransomware."
log "Salin folder ini ke cloud atau disk eksternal."
log "===== Backup selesai ====="
