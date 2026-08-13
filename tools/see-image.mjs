// 尝试用 opencode-go 的多模态模型描述截图
import './load-env.mjs';
import fs from 'node:fs';

const BASE = (process.env.OPENAI_BASE_URL || '').replace(/\/+$/, '');
const file = process.argv[2];
const b64 = fs.readFileSync(file).toString('base64');

for (const model of ['mimo-v2-omni', 'qwen3.7-plus', 'glm-5.1']) {
  try {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: '用中文描述这张截图：1)主体内容 2)有无异常(纯色块/白屏/黑屏/横条) 3)颜色构成 4)界面元素。' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
          ],
        }],
        max_tokens: 400,
      }),
    });
    const j = await r.json();
    const c = j.choices?.[0]?.message?.content;
    console.log(`=== ${model} HTTP ${r.status} ===`);
    console.log(c ? String(c).slice(0, 600) : JSON.stringify(j).slice(0, 300));
  } catch (e) {
    console.log(`=== ${model} ERR ${e.message.slice(0, 100)} ===`);
  }
}
