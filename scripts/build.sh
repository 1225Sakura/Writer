#!/bin/bash
cd "$(dirname "$0")/.."
echo "=== Writer 构建 ==="
echo "[1/4] 前端构建..."
cd src/frontend && npm run build
echo "[2/4] 复制前端..."
cd ../..
rm -rf electron/frontend-build && mkdir -p electron/frontend-build
cp -r src/frontend/dist/* electron/frontend-build/
echo "[3/4] Electron 构建..."
cd electron && npm run build:electron
echo "[4/4] 打包..."
npm run dist:win
echo "=== 完成 ==="
ls -la release/*.exe 2>/dev/null || dir release\*.exe
