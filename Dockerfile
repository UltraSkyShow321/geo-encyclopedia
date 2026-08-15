# ===== 阶段1: 构建前端 =====
# 基础镜像用官方源（本机/能访问 Docker Hub 的环境直接可用；NAS 端部署推荐"本机导出镜像+load"方式）
FROM docker.1ms.run/library/node:24-alpine AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci
COPY web/ ./
RUN npm run build

# ===== 阶段2: 后端运行环境 =====
FROM docker.1ms.run/library/node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    CONTENT_DIR=/app/content

COPY server/package.json server/package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci --omit=dev

COPY server/ ./
COPY --from=web-build /app/web/dist ./web/dist
COPY content/ ./content/

EXPOSE 3000
CMD ["node", "--env-file-if-exists=/app/.env", "src/index.js"]
