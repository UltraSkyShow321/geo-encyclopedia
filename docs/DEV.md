# 开发者文档（DEV）

面向开发者的技术说明。普通用户请阅读 [README](../README.md)。

## 架构

```
浏览器/客户端 (Vue3 PWA / Electron / Capacitor)
   │  HTTPS / HTTP
   ▼
Fastify (Node.js)  ── SQLite (node:sqlite, FTS5 中文检索)
   ├── 静态托管 web/dist
   ├── /api/* REST
   └── 内容导入: content/*.md → SQLite
```

- `web/` — Vue 3 + Vite + Tailwind + Pinia + vue-router（hash 模式适配桌面端 file 场景已废弃，桌面端现走本地代理 http）
- `server/` — Fastify + node:sqlite（需 Node ≥ 22.5）；CORS 全开（个人站点）
- `apps/desktop/` — Electron：**本地代理架构**（proxy.cjs），页面从 `http://127.0.0.1:<随机端口>` 加载，`/api/*` 转发到用户配置的服务器（同源，无 CORS/cookie 问题）
- `apps/mobile/` — Capacitor Android；iOS 工程已配置（需 Mac 构建）
- `apps/harmony/` — 鸿蒙 NEXT DevEco 工程（ArkWeb WebView 包装）
- `content/` — 唯一内容事实来源（Markdown frontmatter + 正文）
- `tools/` — 数据拉取、LLM 生成、E2E 测试、Release 发布等脚本

## 本地开发

```bash
cd server && npm install && npm run dev     # :3000
cd web && npm install && npm run dev        # :5173 (代理 /api)
```

生产构建：`cd web && npm run build`（server 自动托管 dist）。

## 常用命令

```bash
npm run fetch:data          # 拉取 244 国结构化数据 → content/countries/
npm run generate:content    # LLM 批量生成正文（需 .env 的 OPENAI_API_KEY）
node tools/set-status.mjs published    # 批量发布 draft→published
node tools/e2e-test.mjs     # E2E 全流程测试（需系统 Edge）
node tools/release.mjs <token文件>  # 发布 GitHub Release + 上传安装包
node apps/desktop/test-proxy.cjs  # 桌面代理模块测试
```

## API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/meta | 站点统计 |
| GET | /api/countries?continent=&sort=&q=&includeDrafts= | 国家列表 |
| GET | /api/countries/:slug | 国家详情（含正文 HTML、首都坐标） |
| GET | /api/topics, /api/topics/:slug | 专题 |
| GET | /api/search?q= | 全文搜索（FTS5 trigram，中文可用） |
| GET | /api/geojson | 世界边界（50m，已做日期线切割） |
| GET | /api/landforms | 136 处地貌标注（含讲解） |
| GET | /api/staticmap/:slug?layer=&center= | 卫星/地形/区划静态图（代理 ArcGIS） |
| GET | /api/country-svg/:slug | 国家轮廓 SVG |
| GET | /api/country-at?lat=&lng= | 坐标反查国家 |
| GET | /api/config | 公共配置（amapKey 等） |
| POST | /api/auth/login·logout | 单用户登录（ADMIN_PASSWORD） |
| GET/PUT/DELETE | /api/favorites… | 收藏与笔记 |
| GET/POST | /api/cards… | 记忆卡片 |
| POST | /api/admin/reimport | 重新导入 content（需登录） |

## 多端构建

```bash
# Android APK
cd apps/mobile && npm install && node sync.mjs
cd android && gradlew.bat assembleRelease --offline   # 产物 app-release.apk

# Windows 桌面
cd apps/desktop && node sync.mjs && npx electron-builder --win

# 桌面本地代理测试
cd apps/desktop && node test-proxy.cjs
```

## 关键配置

`.env`：
- `ADMIN_PASSWORD` 必填（登录/收藏/笔记）
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` 内容生成（可选）
- `AMAP_KEY` / `AMAP_SECURITY_CODE` 高德地图（可选）
- `TUNNEL_TOKEN` Cloudflare Tunnel（可选）

## 已知事项

- NAS 部署：若 NAS 拉镜像超时，用「本机 buildx 导出 + docker load」或配置镜像加速器（docs/DEPLOY-NAS.md）；绿联 ext4 卷需 `"storage-driver": "vfs"`
- 桌面端 exe 未签名（无证书），首次运行 Windows SmartScreen 需"仍要运行"
- iOS 分发需 Mac + 开发者账号；无账号用 PWA
