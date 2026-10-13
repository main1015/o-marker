#!/bin/bash

# 确保脚本在任何目录下执行都能正确进入 apps/extension 目录
cd "$(dirname "$0")/apps/extension"

echo "======================================="
echo "   🧩 正在启动 o-marker 插件开发环境"
echo "======================================="

if [ ! -d "node_modules" ]; then
  echo "[1/2] 检测到未安装依赖，正在安装插件依赖 (yarn install)..."
  yarn install
else
  echo "[1/2] 依赖已就绪，跳过 yarn install"
fi

echo "[2/2] 正在启动 Plasmo 开发服务器..."
yarn dev
