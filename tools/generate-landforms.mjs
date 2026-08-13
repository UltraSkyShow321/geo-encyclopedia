// 为 content/metadata/landforms.json 中缺少 desc 的地貌生成讲解文字（调用 LLM）
// 用法: node tools/generate-landforms.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './load-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, '..', 'content', 'metadata', 'landforms.json');
const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
const MODEL = process.env.OPENAI_MODEL || 'deepseek-chat';
const CONCURRENCY = 4;

const items = JSON.parse(fs.readFileSync(file, 'utf8'));
const jobs = items
  .filter((it) => !it.desc)
  .map((it) => ({
    slug: it.slug,
    run: async () => {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content: '你是地理百科编辑。为给出的地理事物写一段 50-80 字的中文简介，包含位置、规模/高度/长度的关键数字和 1-2 个地理特征，客观准确，结尾不加句号以外的标点。只输出简介正文。',
            },
            { role: 'user', content: `${it.name_zh}（${it.name_en}），类型：${it.type}。` },
          ],
          max_tokens: 300,
          temperature: 0.5,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const j = await res.json();
      const desc = (j.choices?.[0]?.message?.content || '').trim();
      if (desc.length < 20) throw new Error('内容过短');
      it.desc = desc;
    },
  }));

if (!jobs.length) {
  console.log('无需生成（全部已有 desc）');
  process.exit(0);
}
console.log(`待生成: ${jobs.length} 处地貌`);

let idx = 0;
let failed = 0;
const worker = async () => {
  while (idx < jobs.length) {
    const i = idx++;
    try {
      await jobs[i].run();
      process.stdout.write('.');
    } catch (e) {
      failed++;
      console.error(`\n[失败] ${jobs[i].slug}: ${e.message}`);
    }
  }
};
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`\n完成: 成功 ${jobs.length - failed}，失败 ${failed}`);

fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf8');
console.log('已写入 landforms.json');
