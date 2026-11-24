#!/bin/sh
# =============================================================
# CECS — Uji pemulihan backup
#
# Memulihkan dump ke PostgreSQL SEMENTARA yang terpisah, memverifikasi
# isinya, lalu membuang container itu. Database produksi tidak disentuh
# sama sekali.
#
#   sh scripts/verify-backup.sh                       # backup terbaru
#   sh scripts/verify-backup.sh /path/db-YYYY-MM-DD.sql.gz
#
# Backup yang belum pernah diuji pulih bukanlah backup. Jalankan ini
# sebulan sekali.
# =============================================================
set -eu

BACKUP_DIR="${BACKUP_DIR:-/var/backups/cecs}"
TEST_CONTAINER="cecs_restore_test_$$"
TEST_PASSWORD="verify_only_$$"
PG_IMAGE="${PG_IMAGE:-postgres:16-alpine}"

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
    DUMP=$(find "$BACKUP_DIR" -name 'db-*.sql.gz' -type f | sort | tail -n 1)
fi

[ -n "$DUMP" ] && [ -f "$DUMP" ] || {
    echo "Tidak menemukan berkas dump. Periksa BACKUP_DIR=$BACKUP_DIR"
    exit 1
}

echo "Menguji  : $DUMP"
echo "Ukuran   : $(du -h "$DUMP" | cut -f1)"
echo

cleanup() {
    docker rm -f "$TEST_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# ── 1. Integritas arsip ──────────────────────────────────────
echo "[1/4] Memeriksa integritas gzip..."
gzip -t "$DUMP" || { echo "  GAGAL: arsip rusak"; exit 1; }
echo "  OK"

# ── 2. Jalankan PostgreSQL sementara ─────────────────────────
echo "[2/4] Menjalankan PostgreSQL sementara..."
docker run -d --name "$TEST_CONTAINER" \
    -e POSTGRES_PASSWORD="$TEST_PASSWORD" \
    -e POSTGRES_USER=cecs_user \
    -e POSTGRES_DB=cecs \
    "$PG_IMAGE" >/dev/null

i=0
until docker exec "$TEST_CONTAINER" pg_isready -U cecs_user -d cecs >/dev/null 2>&1; do
    i=$((i + 1))
    [ "$i" -gt 60 ] && { echo "  GAGAL: PostgreSQL tidak siap"; exit 1; }
    sleep 1
done
echo "  OK (siap dalam ${i}s)"

# ── 3. Pulihkan ──────────────────────────────────────────────
echo "[3/4] Memulihkan dump..."
if ! gunzip -c "$DUMP" | docker exec -i "$TEST_CONTAINER" \
        psql -U cecs_user -d cecs -v ON_ERROR_STOP=1 >/dev/null 2>/tmp/restore_err_$$; then
    echo "  GAGAL saat memulihkan:"
    tail -n 20 "/tmp/restore_err_$$"
    rm -f "/tmp/restore_err_$$"
    exit 1
fi
rm -f "/tmp/restore_err_$$"
echo "  OK"

# ── 4. Verifikasi isi ────────────────────────────────────────
# Dump yang pulih tanpa error tapi kosong tetap tidak berguna, jadi
# jumlah baris pada tabel inti ikut diperiksa.
echo "[4/4] Memverifikasi isi..."
query() {
    docker exec "$TEST_CONTAINER" psql -U cecs_user -d cecs -tAc "$1" 2>/dev/null || echo "ERR"
}

TABLES=$(query "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
echo "  Tabel            : $TABLES"
[ "$TABLES" -ge 10 ] 2>/dev/null || { echo "  GAGAL: jumlah tabel tidak wajar"; exit 1; }

FAILED=0
for t in User Equipment WorkOrder; do
    N=$(query "SELECT count(*) FROM \"$t\";")
    echo "  $t: $N baris"
    [ "$N" = "ERR" ] && FAILED=1
done
[ "$FAILED" -eq 0 ] || { echo "  GAGAL: tabel inti tidak terbaca"; exit 1; }

USERS=$(query "SELECT count(*) FROM \"User\" WHERE \"deletedAt\" IS NULL;")
[ "$USERS" -ge 1 ] 2>/dev/null || { echo "  GAGAL: tidak ada pengguna aktif"; exit 1; }

echo
echo "BACKUP VALID — dump ini bisa dipulihkan."
echo "Catat tanggal uji ini; ulangi bulan depan."
