#!/bin/bash
# 📦 o-marker 插件打包脚本（支持独立版本自增、零污染源码、符合 Chrome 商店规范）

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "======================================="
echo "   🚀 正在打包 o-marker 浏览器扩展"
echo "======================================="

VERSION_FILE="version.txt"
DEFAULT_VERSION="0.0.1"

# 帮助信息支持
if [ "$1" = "-h" ] || [ "$1" = "--help" ] || [ "$1" = "help" ]; then
  echo "使用方法: ./package-extension.sh [版本号]"
  echo ""
  echo "参数说明:"
  echo "  [版本号]    可选。指定要打包发布的版本号 (例如: 1.0.0)。"
  echo "             若不提供参数，则自动从 $VERSION_FILE 读取并自增末位 (如 0.1.1 -> 0.1.2)。"
  echo ""
  echo "选项:"
  echo "  -h, --help  显示帮助信息"
  echo ""
  echo "示例:"
  echo "  ./package-extension.sh          # 自动自增版本号打包"
  echo "  ./package-extension.sh 0.2.0    # 指定版本为 0.2.0 打包"
  exit 0
fi

# 1. 检查并准备依赖
if [ ! -d "apps/extension/node_modules" ]; then
  echo "[1/5] 📦 检测到未安装依赖，正在安装 (yarn install)..."
  (cd apps/extension && yarn install)
else
  echo "[1/5] 依赖已就绪"
fi

# 2. 计算与管理版本号（支持参数传入或基于 version.txt 末位自增）
CUSTOM_VERSION="$1"
NEW_VERSION=$(node -e "
const fs = require('fs');
const custom = '$CUSTOM_VERSION'.trim();

if (custom) {
  // 验证自定义版本号格式（1-4段纯数字，符合 Chrome 规范）
  if (!/^\d+(\.\d+){0,3}$/.test(custom)) {
    console.error('❌ 版本号格式不合法: ' + custom + '，Chrome 规范要求为 1-4 段点分数字（如 1.0.0）');
    process.exit(1);
  }
  fs.writeFileSync('$VERSION_FILE', custom + '\n');
  console.log(custom);
} else {
  let ver = '$DEFAULT_VERSION';
  if (fs.existsSync('$VERSION_FILE')) {
    const content = fs.readFileSync('$VERSION_FILE', 'utf8').trim();
    if (content) ver = content;
  } else if (fs.existsSync('apps/extension/package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync('apps/extension/package.json', 'utf8'));
      if (pkg.version) ver = pkg.version;
    } catch (e) {}
  }
  const parts = ver.split('.');
  parts[parts.length - 1] = parseInt(parts[parts.length - 1] || 0) + 1;
  const nextVer = parts.join('.');
  fs.writeFileSync('$VERSION_FILE', nextVer + '\n');
  console.log(nextVer);
}
")

echo "[2/5] 🆙 扩展版本号设定为: v$NEW_VERSION (记录于 $VERSION_FILE)"

# 3. 执行生产环境构建
echo "[3/5] ⚙️  正在执行 Plasmo 生产环境构建..."
(cd apps/extension && yarn build)

PROD_DIR="apps/extension/build/chrome-mv3-prod"
if [ ! -d "$PROD_DIR" ]; then
  echo "❌ 构建产物目录不存在: $PROD_DIR"
  exit 1
fi

# 4. 将独立版本号注入到构建产物的 manifest.json（源码 package.json 零污染）
echo "[4/5] 💉 注入版本号至产物 manifest.json..."
node -e "
const fs = require('fs');
const p = '$PROD_DIR/manifest.json';
const manifest = JSON.parse(fs.readFileSync(p, 'utf8'));
manifest.version = '$NEW_VERSION';
fs.writeFileSync(p, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
"

# 5. 压缩打包并归档
echo "[5/5] 📦 正在生成 Chrome Web Store 标准分发包..."
mkdir -p dist
rm -f o-marker.zip "dist/o-marker-v${NEW_VERSION}.zip"

(
  cd "$PROD_DIR"
  zip -r "$ROOT_DIR/o-marker.zip" . -x "*.DS_Store" "*__MACOSX*" "*.map" > /dev/null
)

cp o-marker.zip "dist/o-marker-v${NEW_VERSION}.zip"
# 清理 build 目录下可能残留的非标准 zip，避免混淆
rm -f "$ROOT_DIR/apps/extension/build/chrome-mv3-prod.zip"

FILE_SIZE=$(ls -lh o-marker.zip | awk '{print $5}')

echo ""
echo "=========================================================="
echo "   ✅ 打包完成！"
echo "   📦 根目录发布包: o-marker.zip ($FILE_SIZE)"
echo "   📂 归档历史版本: dist/o-marker-v${NEW_VERSION}.zip"
echo "   🏷️  插件版本号: v$NEW_VERSION"
echo "=========================================================="
echo "💡 提示："
echo "   1. 上传至 Chrome 开发者控制台直接使用根目录的 o-marker.zip 即可。"
echo "   2. 指定版本号打包方式：./package-extension.sh 0.0.3"
echo "   3. 详细发布审查准备请参考: docs/Chrome插件打包与发布完整指南.md"
echo "=========================================================="
