# 产品需求文档 (PRD) - o-marker

## 1. 产品概述
o-marker 是一款对标行业顶尖标准（如 Raindrop.io）的下一代书签与知识管理工具。旨在解决用户在浏览器书签管理中遇到的“收集阻力大”、“整理困难”、“搜索效率低”以及“大量死链积压”等痛点。

## 2. 竞品参考与痛点分析
- **Raindrop.io** (全面管理)：拥有现代美观的UI，支持标签、嵌套集合、卡片/列表/看板等多视图，支持全文搜索与网页快照。
  - *o-marker 借鉴点*：优美的UI规范、标签+多级文件夹体系、多视图展示。
- **Toby / Tabme** (会话管理)：能将新标签页改造成看板，一键保存打开的所有标签页，解决“标签开太多”的问题。
  - *o-marker 借鉴点*：实现“一键打包当前窗口所有Tab”的会话保存功能。
- **Bookmark Clean Up** (清理工具)：一键检测批量删除失效死链、去重。
  - *o-marker 借鉴点*：内置自动化维护工具，定期体检书签库。

## 3. 开发路线图 (Roadmap)
为避免过度工程化，遵循渐进式开发原则，项目划分为三个主要阶段：

### Phase 1: MVP 核心基建 (当前阶段)
- **目标**：实现最核心的书签收集与基础同步，对标 Raindrop.io 顶级插件体验。
- **功能点**：
  - [x] **Chrome 插件 (Raindrop 体验重塑)**：实现“打开即存 (Instant Auto-Save)”、原地编辑标题与笔记、文件夹抽屉选择器、Tag Chips 动态胶囊输入。详见 [EXTENSION_RAINDROP_REDESIGN.md](file:///home/wy/code/chrome/o-marker/docs/EXTENSION_RAINDROP_REDESIGN.md)。
  - [x] **会话打包（Session Save）**：底栏一键归档当前窗口内的所有活动标签页。
  - [x] **全语种无缝适配**：插件全面覆盖全球 18 种主流语言。

### Phase 2: 高级组织与视觉升级 (对标 Raindrop 体验)
- **目标**：突破插件弹窗的空间限制，开发一个独立的全屏 Web 客户端（Web Dashboard），提供沉浸式的书签整理与检索体验。
- **功能点**：
  - [x] **Web 端管理后台**：使用 Next.js 构建，包含左侧边栏（文件夹树）、顶部搜索与主内容区。
  - [x] **多视图支持**：支持标准大卡片与高密度紧凑卡片一键切换。
  - [x] **嵌套集合与标签系统**：支持文件夹新建、软删除、标签动态关联与原地编辑。
  - [x] **元数据丰富化**：服务端自动抓取保存网页的 Title、Description 和 Favicon。
  - [x] **全链路国际化 (i18n)**：支持全球主流 18 种语言（简中、繁中、英、日、韩、法、德、西、意、葡、俄、阿、印、越、印尼、泰、荷、波），详细规划与技术规范参见 [I18N.md](file:///home/wy/code/chrome/o-marker/docs/I18N.md)。

### Phase 3: 极致体验与自动化
- **目标**：提供企业级的检索与数据维护体验。
- **功能点**：
  - [x] **模糊搜索**：基于标题、URL、描述与标签的实时防抖模糊匹配。
  - [x] **书签体检清理**：一键检测合并重复项、一键清空废纸篓。
  - [x] **导入导出能力**：支持标准 Netscape HTML 书签格式的双向导入导出。

## 4. 数据实体初步设计 (Data Model Draft)
- **User (用户)**：ID, Email, PasswordHash, CreatedAt.
- **Bookmark (书签)**：ID, URL, Title, Description, CoverImg, CollectionID, UserID, Status (Active/Dead).
- **Collection (集合/文件夹)**：ID, Name, ParentID, UserID.
- **Tag (标签)**：ID, Name, UserID.
- **BookmarkTag (多对多关联表)**.
