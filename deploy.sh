#!/bin/bash
echo "=== [1/4] Pulling latest from GitHub ==="
git pull origin master

echo "=== [2/4] Building Frontend ==="
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
