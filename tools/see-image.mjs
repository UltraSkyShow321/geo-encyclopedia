// 识图工具: 用多模态模型描述图片内容（供 agent 自动调用）
// 用法: node see-image.mjs <图片路径>
import './load-env.mjs';
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('用法: node see-image.mjs <图片路径>');
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error('图片不存在:', file);
  process.exit(1);
}

const BASE = (process.env.OPENAI_BASE_URL || '').replace(/\/+$/, '');
const b64 = fs.readFileSync(file).toString('base64');
const MODELS = ['qwen3.7-plus', 'mimo-v2-omni', 'glm-5.1'];

async function ask(model) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '请仔细描述这张图片：1)画面主体内容 2)有无异常（纯色块/白屏/黑屏/横条/文字乱码等）3)主要颜色构成 4)可见的文字/界面元素（原文引用）。用中文回答。' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
        ],
      }],
      max_tokens: 400,
    }),
  });
  const j = await res.json();
  const c = j.choices?.[0]?.message?.content;
  if (!c) throw new Error(`HTTP ${res.status}`);
  return String(c).trim();
}

for (const model of MODELS) {
  try {
    console.log(await ask(model));
    process.exit(0);
  } catch {
    /* 换下一个模型 */
  }
}
console.error('识图失败：所有多模态模型均不可用，请检查 OPENAI_API_KEY / OPENAI_BASE_URL');
process.exit(1);
