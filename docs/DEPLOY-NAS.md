# 绿联 NAS 部署指南（长期稳定运行）

目标：百科服务 7×24 运行在 NAS 上，Android / Windows / 网页 多端随时连接使用。

## 第 1 步：拷贝项目到 NAS

用绿联文件管理 App 或 SMB 共享，把整个项目目录复制到 NAS 的 Docker 目录，例如：

```
/volume1/docker/geo-encyclopedia/
```

包含内容：`content/`（百科内容）、`server/`（后端）、`web/`（前端）、`Dockerfile`、`docker-compose.yml`、`scripts/` 等。

> 不要拷贝本机的 `node_modules`、`data/`、`logs/`、`.env`（这些在 NAS 上会重新生成）。

## 第 2 步：在 NAS 上创建 .env

在 NAS 的 `geo-encyclopedia` 目录下新建文件 `.env`（与 docker-compose.yml 同目录），内容参考 `.env.example`：

```
# 管理员密码（登录收藏/笔记/草稿管理用）——务必改成强密码
ADMIN_PASSWORD=你的强密码

# 高德地图（可选）：Key + 安全密钥
AMAP_KEY=
AMAP_SECURITY_CODE=
```

## 第 3 步：启动容器（二选一）

### 方式 A：绿联 Docker 应用界面（推荐）
1. 打开绿联的 **Docker** 应用（UGOS Pro 自带）
2. 左侧找 **"项目 / Compose"** → 新建项目
3. 项目名称填 `geo-encyclopedia`，路径选择 `/volume1/docker/geo-encyclopedia`（compose 文件自动识别）
4. 点 **部署/启动**，等待构建完成（首次构建约 3-5 分钟）

### 方式 B：SSH 命令行
1. 绿联控制面板 → 开启 **SSH**（终端机）
2. 用终端连接 NAS，执行：
```bash
cd /volume1/docker/geo-encyclopedia
docker compose build
docker compose up -d
```
3. 容器 `geo-encyclopedia` 随 NAS 开机自动重启（restart: always）

## 第 4 步：验证

在 NAS 局域网内，浏览器访问：`http://NAS的IP:3000`（例如 `http://192.168.31.199:3000`）

- 应看到网站首页、244 国内容
- 用 `.env` 的 ADMIN_PASSWORD 登录，导航栏出现"收藏/退出"

## 第 5 步：多端客户端连接

| 客户端 | 填写的服务器地址 |
|---|---|
| Windows 桌面版 | `http://NAS的IP:3000` |
| Android APK | `http://NAS的IP:3000` |
| 手机/电脑浏览器 | 直接用 `http://NAS的IP:3000` 访问（无需客户端） |

客户端首次打开 → 设置页 → 填地址 → 测试连接 → 开始使用。

## 第 6 步：外网访问（可选）

### 绿联远程访问（推荐，国内快）
1. 绿联控制面板 → **远程访问**
2. 添加端口映射：NAS 本机 **3000** 端口
3. 生成公网 HTTPS 地址（如 `https://xxx.link.ugreencloud.com`）
4. 客户端填这个公网地址即可在任何网络使用

### Cloudflare Tunnel（备选，可绑域名）
1. 在 dash.cloudflare.com 创建 Tunnel，复制 Token
2. NAS 的 `.env` 加一行 `TUNNEL_TOKEN=你的token`
3. SSH 执行：`docker compose --profile tunnel up -d`
4. 在 CF 面板把域名路由指向 `http://app:3000`

## 第 7 步：备份（建议设置定时任务）

在绿联控制面板 → 定时任务，添加一条计划（例如每周日 3:00）：

```
powershell -ExecutionPolicy Bypass -File /volume1/docker/geo-encyclopedia/scripts/backup.ps1
```

或直接在绿联的文件快照/备份中对 `content/` 和 `data/` 目录做定时备份。

## 日常维护

- **修改内容**：编辑 NAS 上 `content/countries/*.md` → 浏览器访问 `http://NAS的IP:3000/api/admin/reimport`（需先登录，或 `docker compose restart`）
- **查看日志**：`docker compose logs -f app`
- **升级版本**：`git pull`（或重新拷贝新文件）→ `docker compose build && docker compose up -d`
- **换密码**：改 `.env` 的 ADMIN_PASSWORD → `docker compose up -d`（重建容器生效）
