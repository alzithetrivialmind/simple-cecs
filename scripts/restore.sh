#!/bin/sh
# =============================================================
# CECS — Pemulihan ke PRODUKSI
#
#   sh scripts/restore.sh /var/backups/cecs/db-YYYY-MM-DD.sql.gz
#
# PERINGATAN: menimpa database produksi. Untuk sekadar menguji backup,
# gunakan scripts/verify-backup.sh yang tidak menyentuh produksi.
# =============================================================
set -eu

PG_CONTAINER="${PG_CONTAINER:-cecs_postgres}"
MINIO_VOLUME="${MINIO_VOLUME:-cecs_prod_minio_data}"
POSTGRES_USER="${POSTGRES_USER:-cecs_user}"
POSTGRES_DB="${POSTGRES_DB:-cecs}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

DUMP="${1:-}"
[ -n "$DUMP" ] && [ -f "$DUMP" ] || {
    echo "Pemakaian: sh scripts/restore.sh <db-YYYY-MM-DD.sql.gz> [minio-YYYY-MM-DD.tar.gz]"
    exit 1
}
MINIO_ARCHIVE="${2:-}"

echo "============================================="
echo " PEMULIHAN KE PRODUKSI"
echo "============================================="
echo "Dump database : $DUMP"
[ -n "$MINIO_ARCHIVE" ] && echo "Arsip MinIO   : $MINIO_ARCHIVE"
echo
echo "Ini akan MENIMPA database produksi."
printf "Ketik PULIHKAN untuk melanjutkan: "
read -r CONFIRM
[ "$CONFIRM" = "PULIHKAN" ] || { echo "Dibatalkan."; exit 1; }

echo
echo "[1/5] Memeriksa integritas arsip..."
gzip -t "$DUMP" || { echo "  Arsip database rusak. Dibatalkan."; exit 1; }
[ -n "$MINIO_ARCHIVE" ] && { gzip -t "$MINIO_ARCHIVE" || { echo "  Arsip MinIO rusak. Dibatalkan."; exit 1; }; }
echo "  OK"

# Hentikan aplikasi lebih dulu supaya tidak ada yang menulis saat pemulihan.
echo "[2/5] Menghentikan aplikasi..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop app nginx || true
echo "  OK"

# Simpan keadaan sekarang sebelum ditimpa — jaring pengaman bila dump
# yang dipulihkan ternyata bukan yang dimaksud.
echo "[3/5] Menyimpan snapshot keadaan saat ini..."
SAFETY="/tmp/cecs-pre-restore-$(date +%F-%H%M%S).sql.gz"
if docker exec "$PG_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists | gzip > "$SAFETY"; then
    echo "  Snapshot -> $SAFETY"
else
    echo "  Peringatan: snapshot gagal dibuat."
    printf "  Lanjutkan tanpa jaring pengaman? (ya/tidak): "
    read -r C2
    [ "$C2" = "ya" ] || { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" start app nginx; exit 1; }
fi

echo "[4/5] Memulihkan database..."
if ! gunzip -c "$DUMP" | docker exec -i "$PG_CONTAINER" \
        psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1; then
    echo "  GAGAL. Snapshot sebelum pemulihan ada di: $SAFETY"
    exit 1
fi
echo "  OK"

if [ -n "$MINIO_ARCHIVE" ]; then
    echo "[5/5] Memulihkan lampiran MinIO..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop minio || true
    docker run --rm \
        -v "$MINIO_VOLUME":/data \
        -v "$(cd "$(dirname "$MINIO_ARCHIVE")" && pwd)":/backup:ro \
        alpine:latest \
        sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$MINIO_ARCHIVE") -C /data"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" start minio
    echo "  OK"
else
    echo "[5/5] Arsip MinIO tidak diberikan — lampiran dilewati."
fi

echo
echo "Menjalankan kembali aplikasi..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" start app nginx

echo
echo "Pemulihan selesai."
echo "Snapshot sebelum pemulihan: $SAFETY"
echo "Periksa aplikasi, lalu hapus snapshot itu bila semuanya sudah benar."
