// 用 LLM 为各国首都生成近似坐标（供"首都影像"截图定位）
// 用法: node tools/gen-capitals.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './load-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const countriesDir = path.join(here, '..', 'content', 'countries');
const outFile = path.join(here, '..', 'content', 'metadata', 'capitals.json');
const BASE_URL = (process.env.OPENAI_BASE_URL || '').replace(/\/+$/, '');
const MODEL = process.env.OPENAI_MODEL || '';

// 读取所有国家首都
const countries = [];
for (const f of fs.readdirSync(countriesDir)) {
  if (!f.endsWith('.md')) continue;
  const raw = fs.readFileSync(path.join(countriesDir, f), 'utf8');
  const slug = raw.match(/^slug: (\w+)/m)?.[1];
  const capital = raw.match(/^capital_zh: (.+)$/m)?.[1];
  const continent = raw.match(/^continent: (.+)$/m)?.[1];
  const nameZh = raw.match(/^name_zh: (.+)$/m)?.[1];
  if (slug && capital) countries.push({ slug, capital: capital.replace(/"/g, '').trim(), continent, nameZh });
}

async function ask(items) {
  const list = items.map((c) => `${c.nameZh}(${c.slug}):${c.capital}`).join('\n');
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: '你是地理数据助手。根据国家首都名称，给出每个首都的近似经纬度。只输出 JSON 对象，键为括号中的slug，值为 [纬度, 经度]（保留2位小数）。不要输出任何其他文字。',
        },
        { role: 'user', content: list },
      ],
      max_tokens: 4000,
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const text = (j.choices?.[0]?.message?.content || '').trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('无 JSON: ' + text.slice(0, 100));
  return JSON.parse(m[0]);
}

const continents = {};
for (const c of countries) {
  (continents[c.continent || '其他'] ||= []).push(c);
}
console.log('大洲分组:', Object.entries(continents).map(([k, v]) => `${k}(${v.length})`).join(' '));

const result = {};
for (const [continent, items] of Object.entries(continents)) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await ask(items);
      Object.assign(result, r);
      console.log(`✓ ${continent}: ${Object.keys(r).length} 个`);
      break;
    } catch (e) {
      console.log(`  ${continent} 第${attempt + 1}次失败: ${e.message.slice(0, 60)}`);
    }
  }
}

fs.writeFileSync(outFile, JSON.stringify(result, null, 1), 'utf8');
console.log(`完成: ${Object.keys(result).length}/${countries.length} 个首都坐标 → ${outFile}`);
