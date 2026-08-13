# 项目规则与记忆

## 识图规则（收到图片必须自动执行）

当用户在本会话中发送图片/截图时，无论当前模型是否支持直接看图，都必须自动调用多模态模型识别图片内容：

1. 从对话内容中找出图片的本地路径；找不到就先询问用户图片保存位置
2. 执行：`node tools/see-image.mjs <图片路径>`（脚本自动用 `.env` 的 key 调用多模态模型）
3. 用识别结果辅助回答/排障，回复中引用关键识别结论（不要只说"看不到图片"）

## 项目快速参考

- 数据源: `content/`（Markdown 是唯一事实来源，改后需重新导入）
- 重新导入: `POST /api/admin/reimport` 或重启后端
- 内容状态: draft/review/published（`node tools/set-status.mjs`）
- 后端: `server/` (Fastify + node:sqlite)，前端: `web/` (Vue3)，客户端壳: `apps/`
- 测试: `node tools/e2e-test.mjs`（需系统 Edge 无头模式）
- 部署: Docker compose；外网: 绿联远程访问 + Cloudflare Tunnel
- 敏感信息: `.env`（含密钥）不入库；token 类文件用完即清
