# ===== 阶段1: 构建前端 =====
FROM node:24-alpine AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ===== 阶段2: 后端运行环境 =====
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    CONTENT_DIR=/app/content

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server/ ./
COPY --from=web-build /app/web/dist ./web/dist
COPY content/ ./content/

EXPOSE 3000
CMD ["node", "--env-file-if-exists=/app/.env", "src/index.js"]
