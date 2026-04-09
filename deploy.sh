#!/bin/bash
echo "=== [1/3] Pulling latest from GitHub ==="
git pull origin master

echo "=== [2/3] Running Database Migrations ==="
cd marketplace-api
php artisan migrate --force
cd ..

echo "=== [3/3] Updating Frontend Files ==="
cp build/index.html public/index.html
cp -r build/static/* public/static/
cp build/asset-manifest.json public/asset-manifest.json 2>/dev/null

echo "=== ✅ Deployment selesai! ==="
