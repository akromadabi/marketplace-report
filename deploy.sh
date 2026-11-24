#!/bin/bash
#======================================================================
# Deploy Script for Marketplace Report (Create React App + Laravel API)
# Target Server: /www/wwwroot/mp.siapp.in
# Cara Jalankan di Server (bisa dari folder manapun):
#   bash /www/wwwroot/mp.siapp.in/deploy.sh
#======================================================================

set -e  # Berhenti jika ada error fatal

# ── 0. Pindah ke direktori project secara otomatis ───────────────────
# Agar script bisa dieksekusi dari direktori mana saja
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# ── Warna Output ─────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
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
    echo -e "${RED}✗ Deploy mengalami kendala! Mengembalikan aplikasi ke online...${NC}"
    if [ -d "$PROJECT_DIR/marketplace-api" ]; then
        cd "$PROJECT_DIR/marketplace-api" && php artisan up 2>/dev/null || true
    fi
    echo -e "${GREEN}✓ Status aplikasi dipulihkan${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}
trap cleanup ERR

# ── Start ────────────────────────────────────────────────────────────
echo -e "\n${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     🚀 DEPLOY MARKETPLACE REPORT             ║${NC}"
echo -e "${CYAN}║     Directory: $PROJECT_DIR${NC}"
echo -e "${CYAN}║     $(date '+%Y-%m-%d %H:%M:%S')                  ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"

# ── 1. Maintenance Mode ─────────────────────────────────────────────
step "1/8 — Mengaktifkan Maintenance Mode"
if [ -d "marketplace-api" ]; then
    cd marketplace-api
    php artisan down --retry=60 --refresh=15 2>/dev/null || true
    cd "$PROJECT_DIR"
    success "Maintenance mode aktif"
fi

# ── 2. Pull Latest Code ─────────────────────────────────────────────
step "2/8 — Mengambil kode terbaru dari Git"
git config --global --add safe.directory "$PROJECT_DIR" 2>/dev/null || true
git fetch origin master
git reset --hard origin/master
success "Kode berhasil diperbarui ke: $(git log --oneline -1)"

# ── 3. Composer Dependencies ────────────────────────────────────────
step "3/8 — Menginstall dependencies PHP (Composer)"
if [ -d "marketplace-api" ]; then
    cd marketplace-api
    if command -v composer &> /dev/null; then
        composer install --no-dev --optimize-autoloader --no-interaction 2>&1
        success "Dependencies PHP selesai dioptimasi"
    else
        echo -e "${YELLOW}Composer tidak ditemukan di PATH, melewati composer install.${NC}"
    fi
    cd "$PROJECT_DIR"
fi

# ── 4. Frontend Assets ─────────────────────────────────────────────
step "4/8 — Sinkronisasi Frontend Assets"
if [ -d "build" ]; then
    mkdir -p public/static marketplace-api/public/static
    
    # Salin build ke root public/
    cp -r build/index.html public/index.html 2>/dev/null || true
    cp -r build/static/* public/static/ 2>/dev/null || true
    cp build/asset-manifest.json public/asset-manifest.json 2>/dev/null || true
    
    # Salin juga ke marketplace-api/public/ agar fallback Laravel web.php bekerja
    cp -r build/index.html marketplace-api/public/index.html 2>/dev/null || true
    cp -r build/static/* marketplace-api/public/static/ 2>/dev/null || true
    cp build/asset-manifest.json marketplace-api/public/asset-manifest.json 2>/dev/null || true
    
    success "Frontend assets berhasil disinkronkan"
else
    echo -e "${YELLOW}Folder build/ tidak ditemukan di Git. Pastikan sudah dibuild secara lokal sebelum push.${NC}"
fi

# ── 5. Database Migration ────────────────────────────────────────────
step "5/8 — Migrasi Database"
if [ -d "marketplace-api" ]; then
    cd marketplace-api
    php artisan migrate --force 2>&1
    cd "$PROJECT_DIR"
    success "Migrasi database selesai"
fi

# ── 6. Cache & Optimization ─────────────────────────────────────────
step "6/8 — Optimasi Cache Laravel"
if [ -d "marketplace-api" ]; then
    cd marketplace-api
    php artisan config:clear 2>&1
    php artisan route:clear 2>&1
    php artisan view:clear 2>&1
    php artisan cache:clear 2>&1

    php artisan config:cache 2>&1
    php artisan route:cache 2>&1
    php artisan view:cache 2>&1
    cd "$PROJECT_DIR"
    success "Cache Laravel berhasil diperbarui"
fi

# ── 7. Permission & Ownership (aaPanel / Linux www:www) ──────────────
step "7/8 — Merapikan Permission File & Storage"
if id "www" &>/dev/null; then
    chown -R www:www "$PROJECT_DIR" 2>/dev/null || true
fi
if [ -d "marketplace-api/storage" ]; then
    chmod -R 775 marketplace-api/storage marketplace-api/bootstrap/cache 2>/dev/null || true
fi
success "Permission storage & cache aman"

# ── 8. Go Live ──────────────────────────────────────────────────────
step "8/8 — Matikan Maintenance Mode & Go Live"
if [ -d "marketplace-api" ]; then
    cd marketplace-api
    php artisan up 2>&1
    cd "$PROJECT_DIR"
fi
success "Aplikasi kembali online!"

# ── Summary ──────────────────────────────────────────────────────────
echo -e "\n${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✅ DEPLOY SELESAI DENGAN SUKSES!         ║${NC}"
echo -e "${GREEN}║     Commit : $(git log --oneline -1 | head -c 35)${NC}"
echo -e "${GREEN}║     Waktu  : $(date '+%Y-%m-%d %H:%M:%S')        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
