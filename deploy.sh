#!/bin/bash
echo "=== [1/4] Pulling latest from GitHub ==="
git pull origin master

echo "=== [2/4] Building Frontend ==="
# Load nvm jika npm tidak ditemukan
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Cari npm jika masih belum ada
if ! command -v npm &> /dev/null; then
    NPM_PATH=$(find /usr/local/bin /usr/bin "$HOME/.nvm" -name "npm" 2>/dev/null | head -1)
    if [ -n "$NPM_PATH" ]; then
        alias npm="$NPM_PATH"
        export PATH="$(dirname $NPM_PATH):$PATH"
    else
        echo "ERROR: npm tidak ditemukan! Install Node.js terlebih dahulu."
        exit 1
    fi
fi

npm install --omit=dev --silent
npm run build

echo "=== [3/4] Running Database Migrations ==="
cd marketplace-api
php artisan migrate --force
cd ..

echo "=== [4/4] Updating Frontend Files ==="
cp build/index.html public/index.html
cp -r build/static/* public/static/
cp build/asset-manifest.json public/asset-manifest.json 2>/dev/null

echo "=== ✅ Deployment selesai! ==="
