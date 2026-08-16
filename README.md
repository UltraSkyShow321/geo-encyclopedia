# 🌍 世界地理百科全书

一个随时可用的地理百科：**244 个国家档案、地理专题、互动地图、数据图表、小测验**。
支持 **Windows / Android / iOS / iPad / macOS / 鸿蒙** 多端使用，**内网、外网、完全离线**三种场景全覆盖。

> 个人项目 · 内容由 AI 生成并经人工校对 · 数据部署在自己的 NAS 上，完全属于你

---

## 🚀 快速开始（3 分钟）

### 方式一：在线使用（最简单，不用安装）

打开下面的网址就能用（手机/电脑浏览器都行）：

| 场景 | 网址 |
|---|---|
| 局域网（家里 WiFi） | `http://192.168.31.114:3000` |
| 外网（流量 / 出门在外） | `https://geo.galaxygrass.top` |

想"像 App 一样"用？

| 设备 | 操作 |
|---|---|
| **iPhone/iPad** | Safari 打开网址 → 分享 → **添加到主屏幕** |
| **安卓/鸿蒙** | 用 Chrome/自带浏览器打开 → 菜单 → **安装应用/添加到主屏幕** |
| **Windows/macOS** | Chrome/Edge 打开网址 → 地址栏右侧 → **安装** |

### 方式二：安装客户端（体验更佳）

去 **Releases 页面**下载安装包：

👉 https://github.com/UltraSkyShow321/geo-encyclopedia/releases

| 平台 | 下载 | 说明 |
|---|---|---|
| Windows | `geo-encyclopedia-v1.0.0-win-setup.exe` | 安装版（推荐） |
| Windows | `geo-encyclopedia-v1.0.0-win-portable.zip` | 免安装版：解压即用，不写注册表（绕过 SmartScreen 拦截） |
| Android / 鸿蒙4.x | `geo-encyclopedia-v1.0.0-android.apk` | 直接安装 |
| iOS / iPad / macOS | 用上面的"添加到主屏幕"方式 | 无需安装包 |

#### Windows 安装说明

1. **安装版**：双击 `win-setup.exe` → 按向导安装 → 桌面出现"世界地理百科"图标
2. **免安装版**：解压 `win-portable.zip` → 双击 `geo-encyclopedia-v1.0.0-win-portable.exe` 直接运行
3. 若 SmartScreen 弹窗：点"**更多信息** → **仍要运行**"

#### Android 安装说明

1. 下载 `geo-encyclopedia-v1.0.0-android.apk` 传到手机（微信文件传输助手/QQ/数据线均可）
2. 手机提示"未知来源安装" → 允许后安装
3. 打开即用，**无需任何配置**（内置服务器地址，下载即用）

#### 客户端联网策略（全自动，无需配置）

| 环境 | 行为 |
|---|---|
| 家里 WiFi（内网） | 自动连 `http://192.168.31.114:3000`，速度最快 |
| 流量 / 出门在外（外网） | 内网 8 秒连不上时**自动切换**到 `https://geo.galaxygrass.top` |
| 断网 / 无信号 | 使用**本地离线包**（首次联网打开时自动下载，244 国内容+国旗+地图轮廓，约 5MB），浏览/搜索/测验照常可用 |

> 首次使用建议在家里 WiFi 下打开一次，完成离线包下载；之后出门断网也能用。

### 登录

点右上角"登录"，输入管理员密码。
登录后可：**收藏国家、写学习笔记、使用小测验和记忆卡片**。

---

## 📖 使用向导

### 首页
搜索框 + 国家/大洲入口 + 人口 TOP10。

### 国家档案（核心内容）
点任何国家 → 查看：
- 🏳️ 国旗、首都、人口、面积、货币、语言、政体等 8 项信息
- 🛰️ **卫星/地形/区划影像**、首都城区图、国家轮廓图
- 📺 视频讲解链接（B站/YouTube）
- 📊 同洲人口对比图表

### 互动地图
- **区划 / 地形 / 卫星 / 高德** 四种底图切换
- 地形图标注 **136 处地貌**（喜马拉雅、青藏高原、撒哈拉、马六甲海峡…点击有讲解）
- 点国家直接跳转档案；搜索框可快速跳转到任意国家

### 排行
人口 / 面积 TOP20 图表、人口×面积散点图、各洲人口占比。

### 学习功能
- **测验**：按大洲随机出题，错题一键加入记忆卡片
- **记忆卡片**：间隔复习（忘了/记住了）
- **收藏+笔记**：每个国家可以收藏并写学习笔记

### 其他
深色模式 🌙 · 中英双语切换 · 离线数据包（断网可用）· Android 返回手势（上一页/退出）

---

## 🖥️ 自己部署（NAS / 服务器，可选）

把网站部署到自己的设备上，随时访问、数据自持：

**部署到绿联/群晖 NAS**（推荐，7×24 运行）：
1. 拷贝本项目到 NAS（如 `/volume1/docker/geo-encyclopedia`）
2. 建 `.env` 文件，设置管理员密码（参考 `.env.example`）
3. Docker 里启动（绿联 Docker → 项目 → Compose，或 SSH 执行 `docker compose build && docker compose up -d`）
4. 浏览器访问 `http://NAS的IP:3000`，完成！

> NAS 网络无法拉取 Docker 基础镜像时，参考 [docs/DEPLOY-NAS.md](docs/DEPLOY-NAS.md) 的离线方案；
> 完整部署与备份细节见 [docs/INSTALL-GUIDE.md](docs/INSTALL-GUIDE.md)。

**外网访问（二选一）**：
- **Cloudflare Tunnel**（推荐）：dash.cloudflare.com → Zero Trust → Tunnels → 添加 Public Hostname 路由（如 `geo.你的域名` → `http://NAS的IP:3000`）。零端口暴露，免费
- **绿联远程访问**：控制面板 → 远程访问 → 映射 3000 端口

部署后记得把客户端内置的服务器地址改成你自己的（构建时 `VITE_DEFAULT_SERVER` / `VITE_PUBLIC_SERVER` 环境变量，见 [docs/DEV.md](docs/DEV.md)）。

---

## ⚙️ 高级（内容管理与定制）

- **修改内容**：编辑 `content/countries/*.md`（Markdown 文件）→ 重新导入后生效
- **批量生成内容**：配置 `.env` 的 LLM Key 后运行 `npm run generate:content`
- **技术文档**：开发者请看 [README 技术版](docs/DEV.md)（含 API 列表、架构、本地开发）

---

## 📜 数据来源与许可

- 国家数据：mledoze/countries、i18n-iso-countries、World Bank
- 地图：Esri / 高德 / OpenStreetMap
- 项目代码：MIT License

---

## ❓ 常见问题

| 问题 | 答案 |
|---|---|
| 客户端提示"连接失败" | 检查服务器地址；流量下请确认外网地址可达（`https://geo.galaxygrass.top`） |
| 出门用流量没数据 | 客户端会自动切外网；若仍无数据，先在家 WiFi 下打开一次 App 完成离线包下载，之后断网也能用 |
| 国旗不显示 | 在线失败会自动用离线包国旗兜底；若仍不显示请更新到最新版本 |
| 高德地图显示"未配置" | 在服务器 `.env` 填 `AMAP_KEY` 和 `AMAP_SECURITY_CODE`（lbs.amap.com 免费注册）|
| 内容不显示/是旧内容 | 修改 content 后访问 `/api/admin/reimport` 或重启容器 |
| 忘记管理员密码 | 改 `.env` 的 `ADMIN_PASSWORD` 后重启容器 |
| 想重置一切 | `docker compose down && docker compose up -d`（数据卷不丢）|
| Windows 安装包被 SmartScreen 拦 | 点"更多信息 → 仍要运行"；或用免安装 zip 版 |

---

**遇到问题？** 提 Issue：https://github.com/UltraSkyShow321/geo-encyclopedia/issues
