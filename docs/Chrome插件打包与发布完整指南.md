# Chrome 插件打包与发布完整指南

本文档作为 **o-marker（现代智能书签与知识助手）** 插件打包、版本构建与发布的标准化作业指导书（SOP），涵盖**企业/内部私有分发**与**Chrome 网上应用店官方公开发布**两种完整路径。

---

## 一、发布方式选型与对比

| 维度 | 途径一：企业 / 内部私有分发（推荐内测） | 途径二：Chrome Web Store 官方公开发布 |
| :--- | :--- | :--- |
| **适用场景** | 团队内测、公司内网、个人多机自用部署 | 面向全球互联网公众用户正式发布 |
| **审核周期** | **零审核**，即打即用，随时分发 | 需 Google 官方审核（通常 1 ~ 3 个工作日） |
| **费用成本** | **完全免费** | 需向 Google 支付一次性 **$5 美元** 开发者注册费 |
| **安装方式** | 拖拽 `.crx` 文件安装，或企业域策略静默推送 | 应用商店页面点击“添加至 Chrome”一键安装 |
| **更新方式** | 重新分发 `.crx` 或通过自建 Update URL 更新 | 商店后台更新版本后，客户端浏览器自动静默拉取更新 |

---

## 二、途径一：企业 / 内部私有分发实操

### 2.1 方式 A：打包为 `.crx` 文件直接分发

> **特别说明**：`o-marker` 使用了 Plasmo 现代化框架，打包 `.crx` 前必须先执行生产构建编译出纯净静态目录 `apps/extension/build/chrome-mv3-prod`（运行 `./package-extension.sh` 会自动完成生产编译）。

#### 步骤 1：准备编译产物
在项目根目录下执行一次打包命令，确保生产环境构建产物已更新：
```bash
./package-extension.sh
```
构建出的生产静态文件位于目录：
👉 **`apps/extension/build/chrome-mv3-prod`**

#### 步骤 2：使用 Chrome 自带工具打包
1. 打开 Chrome 浏览器，在地址栏输入并访问：`chrome://extensions/`；
2. 开启右上角的 **「开发者模式」** 开关；
3. 点击左上角弹出的 **「打包扩展程序 (Pack extension)」** 按钮；
4. 填写配置项：
   - **扩展程序根目录**：选择本项目的生产产物目录：
     👉 `/home/wy/code/chrome/o-marker/apps/extension/build/chrome-mv3-prod`
     *(⚠️ 请注意是选择 `build/chrome-mv3-prod`，而不是源码目录)*
   - **私有密钥文件 (Private key file)**：
     - **首次打包**：留空无需选择，直接点击「打包扩展程序」；
     - **后续版本更新**：**必须**选择上一次打包时生成的 `.pem` 密钥文件，否则 Chrome 会认为这是两个完全不同的插件，导致旧数据无法继承且无法覆盖安装！
5. 打包成功后，Chrome 会在 `chrome-mv3-prod` 的上级目录生成两个文件：
   - `chrome-mv3-prod.crx`（可重命名为 `o-marker.crx`）：插件安装包；
   - `chrome-mv3-prod.pem`（可重命名为 `o-marker.pem`）：**核心密钥私钥（请务必妥善备份并加入 .gitignore，严禁丢失或泄露）**。

#### 步骤 3：分发与安装给同事/内测用户
- **安装方法**：
  1. 打开 `chrome://extensions/` 页面，开启右上角的「开发者模式」；
  2. 将生成的 `.crx` 文件直接**拖拽**进该页面；
  3. 页面弹出“添加「o-marker」吗？”，点击 **「添加扩展程序」** 即可完成安装。

---

## 三、途径二：Chrome 网上应用店 (Chrome Web Store) 官方公开发布

### 3.1 账号注册与资质准备
1. **Google 账号**：准备一个支持开发者验证的 Google 账号；
2. **开发者入驻**：访问 [Chrome 开发者信息中心 (Developer Dashboard)](https://chrome.google.com/webstore/devconsole/)；
3. **缴纳注册费**：按照提示支付 **一次性 $5 美元** 的注册费用（需使用支持 Visa / MasterCard 等国际支付的双币信用卡）。

---

### 3.2 发布物料与素材清单 (Checklist)

在提交审核前，请确认以下物料均已齐备：

#### 1. 图标资产 (Icons)
在 `apps/extension/assets/` 目录下已内置了标准矢量与位图图标（`icon16.png`、`icon48.png`、`icon128.png`），构建时 Plasmo 会自动优化并输出至分发包根目录。

#### 2. 官方宣传图与截屏物料 (Store Images)
项目已在 `store_assets/` 目录下严格按照官方尺寸与 RGB 格式预先生成了全套素材：
- **`store_assets/screenshot_1280x800.png`**（必填截屏，1280 × 800）
- **`store_assets/small_promo_440x280.png`**（推荐小型宣传卡片，440 × 280）
- **`store_assets/promo_marquee_1400x560.png`**（推荐顶部大Banner，1400 × 560）

#### 3. 官方商品说明文案与权限申报
我们准备了开箱即用的文字资料，详细查阅：
👉 [Chrome应用商店文案与素材资料.md](./Chrome应用商店文案与素材资料.md)
直接复制其中的：
- **商品详情「说明」正文 (Description)**
- **权限合理性说明（Justification）**：`activeTab`、`tabs`、`storage`、`host_permissions`

---

### 3.3 一键打包分发 ZIP 包

在项目根目录下运行打包脚本：

```bash
# 默认自增版本打包（自动读取 version.txt，末位加 1，例如 0.1.2 -> 0.1.3）
./package-extension.sh

# 或指定具体版本号打包
./package-extension.sh 1.0.0
```

**产物特性**：
- **`o-marker.zip`**：直接生成在项目根目录，解压后根节点即为 `manifest.json`，无任何系统隐藏文件（`.DS_Store`、`__MACOSX`、`.map`），符合 Chrome Web Store 严格的格式规范。
- **`dist/o-marker-v{版本号}.zip`**：自动归档历史版本，便于版本追溯。
- **零污染源码仓库**：版本号独立记录于 `version.txt`，动态注入产物，源码 `package.json` 保持干净。

---

### 3.4 开发者控制台提审步骤

1. 登录 [Chrome Web Store 开发者后台](https://chrome.google.com/webstore/devconsole/)；
2. 点击右上角 **「+ 新建项目 (New Item)」**；
3. 将项目根目录生成的 **`o-marker.zip`** 拖拽上传；
4. 填写 **商品详情 (Store Listing)**：
   - 参照 `docs/Chrome应用商店文案与素材资料.md` 复制标题、简短摘要与正文说明；
   - 上传 `store_assets/` 目录下的截屏与宣传图；
5. 完善 **隐私权规范 (Privacy Practices)**：
   - 复制权限使用理由（`activeTab`、`tabs`、`host_permissions`）；
   - 勾选“不向第三方出售数据”、“不用于贷款审核”、“不用于广告营销”合规保证；
6. 点击 **「提交以供审核 (Submit for Review)」**：
   - 首次提交通常需要 24 ~ 72 小时完成人工审核；
   - 审核通过后将正式上架，面向全网用户提供一键安装服务。

---

## 四、后续版本迭代与更新规范

1. **版本更新打包**：
   - 直接运行 `./package-extension.sh`（或指定新版本号 `./package-extension.sh 1.1.0`）；
   - 脚本会自动记录新版本并生成新的分发包。
2. **私有 CRX 更新**：
   - 使用 Chrome「打包扩展程序」，**必须载入原先保存的 `.pem` 私钥**重新打包为新的 `.crx`；
   - 分发新包，用户拖入浏览器即可无缝覆盖更新，原有数据完整保留。
3. **商店公开更新**：
   - 在开发者控制台对应项目点击「上传新程序包」，上传新生成的 `o-marker.zip`；
   - 确认无误后提交审核，审核通过后客户端浏览器会在 24 小时内自动静默更新。
