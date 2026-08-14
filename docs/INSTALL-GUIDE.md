# 完整安装与使用指南

覆盖：NAS 部署（含离线镜像方案）→ 多端安装 → 日常使用与维护。

---

## 一、NAS 部署（推荐，长期稳定运行）

### 方案 1：离线镜像加载（最快，不依赖 NAS 外网）

1. 把 **`geo-encyclopedia-image.tar`**（95MB，本机桌面/或从本机重新导出）通过绿联文件管理拷贝到 NAS：
   `/volume1/docker/geo-encyclopedia/geo-encyclopedia-image.tar`
2. 在 NAS 的 `geo-encyclopedia` 目录创建 `.env`：
   ```
   ADMIN_PASSWORD=你的强密码
   AMAP_KEY=（可选）高德Key
   AMAP_SECURITY_CODE=（可选）高德安全密钥
   ```
3. SSH 登录 NAS 执行：
   ```bash
   cd /volume1/docker/geo-encyclopedia
   docker load < geo-encyclopedia-image.tar
   docker compose up -d
   ```
   > 镜像已存在时 compose 直接使用，不会联网构建。

### 方案 2：NAS 联网构建（已改国内源）

项目已更新 Dockerfile（阿里云镜像仓库 + npmmirror），网络正常的 NAS 可直接：
```bash
cd /volume1/docker/geo-encyclopedia
docker compose build
docker compose up -d
```

### 验证

浏览器访问 `http://NAS的IP:3000`，能看到 244 国内容即成功。

---

## 二、多端安装

### 网页端（所有设备通用）
浏览器直接访问 `http://NAS的IP:3000`，无需安装；可"添加到主屏幕"当 App 用。

### Windows 桌面版
1. 下载：`geo-encyclopedia-v1.0.0-win-setup.exe`（GitHub Releases）
2. 安装 → 打开 → 服务器设置页：
   - 局域网：填 `http://NAS的IP:3000`（或点快捷按钮改 IP）
   - 外网：填绿联穿透地址
3. 测试连接 → 开始使用

### Android（含鸿蒙 4.x）
1. 下载：`geo-encyclopedia-v1.0.0-android.apk`
2. 允许"安装未知来源应用"
3. 打开 → 填服务器地址 → 测试连接 → 开始使用

### iOS / macOS
- 网页版 + "添加到主屏幕"（PWA），体验一致

---

## 三、外网访问

绿联控制面板 → **远程访问** → 添加端口映射（NAS 本机 **3000**）→ 获得公网 HTTPS 地址。
把该地址填进客户端，任何网络都能用。
（备选：Cloudflare Tunnel，见 docs/DEPLOY-NAS.md）

---

## 四、日常使用

### 登录
- 右上角"登录" → 输入 `.env` 的 `ADMIN_PASSWORD`
- 登录后可：收藏国家、写学习笔记、看草稿、用测验和记忆卡片

### 功能一览
| 功能 | 入口 |
|---|---|
| 244 国档案（国旗/影像/视频/首都图） | 国家 → 点击任意国家 |
| 互动地图（区划/地形/卫星/高德 + 地貌标注） | 地图 |
| 数据排行（人口/面积图表） | 排行 |
| 搜索 | 顶部搜索框 |
| 测验 / 记忆卡片 / 收藏笔记 | 导航栏 |

### 内容管理（校对/发布）
1. 编辑 NAS 上 `content/countries/*.md`（或用电脑编辑后上传覆盖）
2. 生效：登录后访问 `http://NAS的IP:3000/api/admin/reimport`，或 `docker compose restart`
3. 批量发布：把 md 里 `status: draft` 改为 `published`

### 更新升级
```bash
cd /volume1/docker/geo-encyclopedia
# 拷贝新版文件（或 git pull），然后：
docker compose build && docker compose up -d
```

### 备份
绿联定时任务每周执行：`powershell -ExecutionPolicy Bypass -File scripts/backup.ps1`
（或对 `content/` 和 `data/` 目录做绿联快照备份）

---

## 五、常见问题

| 现象 | 处理 |
|---|---|
| 客户端"测试连接失败" | 确认服务在 NAS 上运行；局域网用 `http://NAS的IP:3000`（不含 https） |
| 高德底图提示未配置 | `.env` 填 AMAP_KEY + AMAP_SECURITY_CODE，重启容器 |
| 改了内容不生效 | 执行 `/api/admin/reimport` 或 `docker compose restart` |
| 忘记登录密码 | 改 `.env` 的 ADMIN_PASSWORD → `docker compose up -d` |
| 想恢复默认 | `docker compose down` 再 `docker compose up -d`（数据在 ./data 卷，不丢失） |
