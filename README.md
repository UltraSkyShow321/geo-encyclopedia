# 世界地理百科全书 (Geo-Encyclopedia)

个人学习用的世界地理百科网站：国家档案、自然地理/人文地理专题、互动地图、数据图表、小测验与记忆卡片。
部署于家庭 NAS（绿联 UGOS Pro / Docker），通过 **绿联远程访问**（主）与 **Cloudflare Tunnel**（备）对外提供服务。

## 快速开始（下载即用）

仓库已包含全部内容（244 国 + 9 专题，AI 生成 + 结构化数据），**无需任何 API Key** 即可运行。LLM Key 只在你想重新生成/扩充内容时才需要。

### 方式一：Node.js 直接运行（需 Node ≥ 22.5）

```bash
git clone <本仓库地址>
cd geo-encyclopedia
copy .env.example .env        # 然后编辑 .env，设置 ADMIN_PASSWORD（登录密码）

# 终端 1
cd server && npm install && npm run dev    # 后端 http://127.0.0.1:3000

# 终端 2
cd web && npm install && npm run dev       # 前端 http://localhost:5173
```

或只跑生产模式：

```bash
cd web && npm install && npm run build     # 构建前端（server 会自动托管 dist）
cd server && npm install && npm run start  # http://127.0.0.1:3000
```

### 方式二：Docker（推荐）

```bash
git clone <本仓库地址>
cd geo-encyclopedia
copy .env.example .env        # 设置 ADMIN_PASSWORD
docker compose up -d --build  # http://127.0.0.1:3000
```

### 说明

- 内容默认是**草稿状态**，需要登录（`ADMIN_PASSWORD`）才能看到全部 244 国；不登录只能看到已发布内容。要一键发布全部内容：`node tools/set-status.mjs published`
- 地图瓦片来自 Esri 免费服务（无需 Key）；交互地图、PWA 离线缓存开箱即用
- `.env` 不会提交到仓库（已在 .gitignore）

## 功能

- 国家/地区档案（244 国）：首都、人口、面积、货币、语言、旗帜、邻国等结构化数据 + 百科正文（AI 生成 + 人工校对）
- 地理专题：自然地理（河流、山脉、沙漠、气候、板块…）/ 人文地理（世界遗产、城市、人口…）
- 互动地图：Leaflet + OSM 瓦片，按大洲/人口/面积着色，点击跳转
- 数据排行：ECharts 柱状图/散点图/饼图 + TOP 20 表格
- 全文搜索：中英文关键词（SQLite FTS5 trigram，支持中文）
- 学习功能：单用户登录、收藏 + 笔记、地理小测验、记忆卡片（间隔重复）
- 深色模式、中英双语界面、PWA（手机可安装、离线看缓存）

## 目录结构

```
geo-encyclopedia/
├── content/            # 内容源（Markdown，这是唯一事实来源）
│   ├── countries/      # 每国一个 .md（frontmatter 存结构化数据，正文存百科文本）
│   └── topics/         # 地理专题
├── server/             # Node.js (Fastify + node:sqlite) API + 静态托管
├── web/                # Vue 3 + Vite + Tailwind 前端
├── tools/              # 数据拉取 / AI 生成 / 状态管理脚本
├── scripts/            # 备份脚本
├── data/               # 运行时数据（SQLite/缓存，gitignore）
└── docker-compose.yml  # NAS 一键部署
```

## 本地开发

要求 Node.js ≥ 22.5（建议 24）。

```bash
# 1. 后端
cd server && npm install
ADMIN_PASSWORD=你的密码 npm run dev        # http://127.0.0.1:3000

# 2. 前端（另开终端）
cd web && npm install
npm run dev                                 # http://127.0.0.1:5173（/api 自动代理到 3000）
```

生产构建：

```bash
cd web && npm run build     # 产物 dist/ 由 server 自动托管
```

## 内容工作流（重要）

内容以 Markdown 文件为准，`status` 控制可见性：`draft`（草稿，仅管理员可见）→ `review`（校对中）→ `published`（公开）。

```bash
# 1. 拉取 244 国结构化数据（mledoze/countries + i18n-iso-countries + World Bank 人口）
npm run fetch:data

# 2. 用 LLM 批量生成正文（需先在 .env 配置 OPENAI_API_KEY，见下）
npm run generate:content          # 全部草稿
npm run generate:content -- --limit 10    # 先试 10 个
npm run generate:content -- --slug cn     # 单个

# 3. 校对：直接编辑 content/countries/cn.md（修改文字、数字、status）

# 4. 批量发布（可 --slug / --continent / --type 限定）
node tools/set-status.mjs published --continent 亚洲
node tools/set-status.mjs published

# 5. 让服务重新导入（改文件后生效）
curl -X POST -b cookie http://127.0.0.1:3000/api/admin/reimport   # 或重启容器
```

`.env`（从 `.env.example` 复制，**必须放在项目根目录**，即与 `docker-compose.yml` 同级）：

```
ADMIN_PASSWORD=管理员密码（登录/收藏/笔记用）
OPENAI_API_KEY=你的 LLM Key
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

> 注意：
> - `.env` 文件编码无所谓（UTF-8 带 BOM 也可以，服务端会自动处理）
> - 若 `.env` 缺失或未设置 `ADMIN_PASSWORD`，服务会直接报错退出并提示，不会静默用默认密码
> - 修改 `.env` 后需重启服务/容器才生效

## NAS 部署（绿联 UGOS Pro + Docker）

1. 将整个项目目录复制到 NAS（如 `/volume1/docker/geo-encyclopedia`）
2. 创建 `.env` 并设置 `ADMIN_PASSWORD`（与本地开发共用同一套 `content/` 可选）
3. 绿联 Docker 应用（或 SSH）执行：

```bash
cd /volume1/docker/geo-encyclopedia
docker compose build
docker compose up -d
```

4. **外网访问（主链路 · 绿联远程访问）**：UGOS Pro「远程访问」→ 添加端口映射 `3000` → 生成公网 HTTPS 地址，浏览器收藏即可（多端通用）。
5. **外网访问（备链路 · Cloudflare Tunnel，可选）**：
   - 在 Cloudflare 面板创建 Tunnel，复制 token 到 `.env` 的 `TUNNEL_TOKEN`
   - `docker compose --profile tunnel up -d`
   - 在 CF 面板把域名路由指向 `http://app:3000`
6. 访问保护建议：CF Tunnel 可再叠加 Access 登录；绿联地址仅自己使用。

### 修改内容后生效

编辑 `content/` 下 md 后，调用 `POST /api/admin/reimport`（需登录态）或 `docker compose restart`。

### 备份

```bash
powershell -ExecutionPolicy Bypass -File scripts/backup.ps1   # 打包 content+data+.env
```
或把该脚本加入绿联定时任务；也可直接用绿联自带的文件快照/备份功能对 `content/` 与 `data/` 目录做定时备份。

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/meta | 站点统计 |
| GET | /api/countries?continent=&sort=&q=&includeDrafts= | 国家列表 |
| GET | /api/countries/:slug | 国家详情（含渲染后正文） |
| GET | /api/topics, /api/topics/:slug | 专题 |
| GET | /api/search?q= | 全文搜索 |
| GET | /api/geojson | 世界地图边界（含国家属性） |
| GET | /api/quiz?continent=&count= | 随机测验题 |
| POST | /api/auth/login|logout | 登录/退出（密码=ADMIN_PASSWORD） |
| GET/PUT/DELETE | /api/favorites… | 收藏与笔记 |
| GET/POST | /api/cards… | 记忆卡片 |
| POST | /api/admin/reimport | 重新导入内容（需登录） |

## 数据来源

- 国家基础数据：[mledoze/countries](https://github.com/mledoze/countries)（MIT）
- 中文国名：[i18n-iso-countries](https://github.com/neuland/jade-countries)（CC BY 4.0 数据）
- 人口数据：World Bank Open Data
- 地图瓦片：Esri（区划 World_Street_Map / 地形 World_Terrain_Base / 卫星 World_Imagery，均无需 Key；OSM/CARTO 瓦片在国内网络不可达故未采用）
- 边界数据：[world-atlas](https://github.com/topojson/world-atlas)
