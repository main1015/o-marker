#!/bin/bash

# 确保脚本在任何目录下执行都能正确进入 apps/server 目录
cd "$(dirname "$0")/apps/server"

if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
  echo "用法: $0 [端口号]"
  echo "  端口号    运行服务器的端口 (默认: 3000)"
  exit 0
fi

# 允许通过第一个参数指定端口，默认 3000 (Next.js 默认端口)
export PORT=${1:-3000}

# 验证端口是否为数字
if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "错误：端口号必须是一个纯数字。"
  exit 1
fi

echo "======================================="
echo "   🚀 正在启动 o-marker 云端后端服务 (端口: $PORT)"
echo "======================================="

if [ ! -d "node_modules" ]; then
  echo "[1/2] 检测到未安装依赖，正在安装后端依赖 (npm install)..."
  npm install
else
  echo "[1/2] 依赖已就绪，跳过 npm install"
fi

echo "[2/2] 正在以开发模式启动服务器..."
# 对于 Next.js，可以使用 -p 参数指定端口
npm run dev -- -p $PORT
