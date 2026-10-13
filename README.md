# o-marker

o-marker 是一款旨在提供极致体验的下一代书签管理工具。它的目标是吸取市面上顶级书签工具（如 Raindrop.io, Toby 等）的优点，提供从网页收集、多维组织、智能检索到死链清理的全流程解决方案。

项目包含两部分：
- **Chrome 插件端**：用于网页上的快速收集与日常交互。
- **服务端**：负责数据同步、离线抓取与多端支持。

## 🎯 核心目标 (Vision)
1. **极低阻力的收集**：随手保存，一键打包工作会话。
2. **高效的多维组织**：支持标签（Tags）、嵌套集合（Collections）。
3. **强力的检索与视觉呈现**：看板、卡片等多种视图，支持全文搜索。
4. **自动化维护**：一键清理死链、去重。

## 🛠️ 技术栈选型 (Tech Stack)

### Chrome 插件端
- **框架**：React + TypeScript
- **构建工具**：Plasmo (现代化的浏览器插件开发框架)
- **样式**：Tailwind CSS

### 服务端
- **框架**：Next.js (API Routes / 全栈) 或 Node.js 纯服务
- **数据库**：PostgreSQL (支持层级查询和全文检索)
- **ORM**：Prisma

## 📚 文档导读
- 详细的产品需求与路线图规划，请查阅：[产品需求文档 (PRD)](./docs/PRD.md)

## 🚀 开发指南

由于我们使用了现代化的脚手架和 React，开发流程与传统的纯原生插件有所不同。我们在根目录提供了快捷启动脚本以简化流程。

### 1. 启动本地开发环境

打开两个终端，分别运行以下快捷脚本：

- **启动服务端**：
  ```bash
  ./start-server.sh
  ```
  *(基于 Next.js 启动，默认运行在 `http://localhost:3000`)*

- **启动插件端构建引擎**：
  ```bash
  ./start-extension.sh
  ```
  *(注意：这会启动 Plasmo 的实时编译引擎，它会监听您的代码变动并打包到 `build` 目录下，但**不会直接弹出一个浏览器**。)*

### 2. 在 Chrome 中加载插件 (仅需一次)

当 `./start-extension.sh` 在后台运行时，请按照以下步骤将开发中的插件“安装”到浏览器中：

1. 打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/`
2. 打开右上角的 **“开发者模式” (Developer mode)**
3. 点击左上角的 **“加载未打包的扩展程序”** (部分版本显示为“加载已解压的扩展程序” / Load unpacked)
4. 在弹出的目录选择器中，选择本项目的构建输出目录：
   👉 **`/home/wy/code/chrome/o-marker/apps/extension/build/chrome-mv3-dev`**
   *(⚠️ 请一定注意是选择 `build/chrome-mv3-dev` 文件夹，而不是插件的源码根目录！)*

### 3. 热重载开发 (HMR)

加载完成后，您可以开始修改 `apps/extension` 下的代码。您每次保存文件，引擎都会实时编译并将更新自动推送到 Chrome 浏览器中生效。您**无需**每次都去扩展程序页面点击刷新。

### 4. 插件打包与发布 (Release)

当准备将扩展发布至 Chrome Web Store 或分发给用户时，运行根目录打包脚本：

```bash
# 自动自增版本打包（例如 0.1.0 -> 0.1.1）
./package-extension.sh

# 或指定具体版本号打包
./package-extension.sh 1.0.0
```

- 脚本会自动执行生产环境优化编译，并在根目录生成可直接上传的 `o-marker.zip`，同时在 `dist/` 归档。
- 详细的发布指引与内测打包请查阅：[Chrome插件打包与发布完整指南](./docs/Chrome插件打包与发布完整指南.md)。
- Chrome Web Store 开发者后台文案与图片物料请查阅：[Chrome应用商店文案与素材资料](./docs/Chrome应用商店文案与素材资料.md)。

