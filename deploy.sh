#!/bin/bash
#======================================================================
# Deploy Script for Marketplace Report (Create React App + Laravel API)
# Jalankan di terminal hosting (SSH):
#   cd ~/report.groovy-media.com && bash deploy.sh
#======================================================================

set -e  # Berhenti jika ada error

# ── Warna Output ─────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

step() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}▶ $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# ── Safety: Pastikan site kembali online jika script error ───────────
cleanup() {
    echo -e "\n${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}✗ Deploy gagal! Mengembalikan aplikasi ke online...${NC}"
    cd marketplace-api && php artisan up 2>/dev/null || true
    echo -e "${GREEN}✓ Aplikasi kembali online (tapi deploy belum selesai)${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}
trap cleanup ERR

# ── Start ────────────────────────────────────────────────────────────
echo -e "\n${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     🚀 DEPLOY MARKETPLACE REPORT             ║${NC}"
echo -e "${CYAN}║     $(date '+%Y-%m-%d %H:%M:%S')                  ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"

# ── 1. Maintenance Mode ─────────────────────────────────────────────
step "1/7 — Mengaktifkan Maintenance Mode"
cd marketplace-api
php artisan down --retry=60 --refresh=15 2>/dev/null || true
cd ..
success "Maintenance mode aktif"

# ── 2. Pull Latest Code ─────────────────────────────────────────────
step "2/7 — Mengambil kode terbaru dari Git"
git fetch origin master
git reset --hard origin/master
success "Kode berhasil diperbarui ke $(git log --oneline -1 | head -c 40)"

# ── 3. Composer Dependencies ────────────────────────────────────────
step "3/7 — Menginstall dependencies PHP (Composer)"
cd marketplace-api
if command -v composer &> /dev/null; then
    composer install --no-dev --optimize-autoloader --no-interaction 2>&1
    success "Dependencies PHP selesai"
else
    echo -e "${RED}Composer tidak ditemukan, melewati instalasi dependencies.${NC}"
fi
cd ..

# ── 4. Frontend Assets ─────────────────────────────────────────────
step "4/7 — Memperbarui Frontend Files"
if [ -d "build" ]; then
    cp -r build/index.html public/index.html 2>/dev/null || true
    cp -r build/static/* public/static/ 2>/dev/null || true
    cp build/asset-manifest.json public/asset-manifest.json 2>/dev/null || true
    
    # Juga salin ke public milik Laravel/API agar / rute Laravel bisa ter-server dengan benar!
    cp -r build/index.html marketplace-api/public/index.html 2>/dev/null || true
    cp -r build/static/* marketplace-api/public/static/ 2>/dev/null || true
    cp build/asset-manifest.json marketplace-api/public/asset-manifest.json 2>/dev/null || true
    
    success "Frontend assets berhasil disalin"
else
    echo -e "${RED}Folder build/ tidak ditemukan. Menggunakan fallback dari lokal (pastikan tracking Git diperbarui).${NC}"
fi

# ── 5. Database Migration ────────────────────────────────────────────
step "5/7 — Migrasi Database"
cd marketplace-api
php artisan migrate --force 2>&1
cd ..
success "Migrasi database selesai"

# ── 6. Cache & Optimization ─────────────────────────────────────────
step "6/7 — Optimasi Cache"
cd marketplace-api
php artisan config:clear 2>&1
php artisan route:clear 2>&1
php artisan view:clear 2>&1
php artisan cache:clear 2>&1

php artisan config:cache 2>&1
php artisan route:cache 2>&1
php artisan view:cache 2>&1
cd ..
success "Cache sudah di-rebuild"

# ── 7. Go Live ──────────────────────────────────────────────────────
step "7/7 — Matikan Maintenance Mode & Go Live"
cd marketplace-api
php artisan up 2>&1
cd ..
success "Aplikasi kembali online!"

# ── Summary ──────────────────────────────────────────────────────────
echo -e "\n${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✅ DEPLOY SELESAI!                       ║${NC}"
echo -e "${GREEN}║     Commit : $(git log --oneline -1 | head -c 40)${NC}"
echo -e "${GREEN}║     Waktu  : $(date '+%H:%M:%S')                       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
