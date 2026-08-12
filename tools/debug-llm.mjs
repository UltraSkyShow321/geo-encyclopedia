// 复现 cn 生成调用，打印完整诊断
import './load-env.mjs';

const BASE = (process.env.OPENAI_BASE_URL || '').replace(/\/+$/, '');
const MODEL = process.env.OPENAI_MODEL || '';

const system = `你是一位严谨的地理百科编辑。根据提供的国家数据与你的常识，用简体中文撰写一篇准确、信息密度高的百科正文。
要求：
1. 严格分为四个小节，标题必须为：## 地理概况、## 历史沿革、## 经济、## 文化与人口
2. 每节 180–300 字，总字数 800–1100 字
3. 专有名词首次出现时，中文后加英文括号附注，例如"长江（Yangtze River）"
4. 统计数字（人口、面积、首都等）以提供的数据为准；其余内容（地形、气候、历史时期、支柱产业、民族宗教等）可依据广为人知的常识补充，但要避免编造未经验证的具体数字
5. 语气客观、信息密度高，避免"数据未提供"之类的空话套话
6. 只输出正文 Markdown，不要任何前言后语`;

const user = `国家数据：
中文名: 中国；英文名: China；大洲: 亚洲；首都: Beijing；人口: 1410710000；面积(km²): 9706961；货币: Chinese yuan（CNY）；官方语言: Chinese

请撰写正文。`;

const res = await fetch(`${BASE}/chat/completions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  body: JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.7,
    max_tokens: 4000,
    reasoning_effort: 'low',
  }),
});
const json = await res.json();
const msg = json.choices?.[0]?.message;
console.log('HTTP:', res.status);
console.log('finish_reason:', json.choices?.[0]?.finish_reason);
console.log('content 长度:', (msg?.content || '').length);
console.log('reasoning 长度:', (msg?.reasoning_content || '').length);
console.log('usage:', JSON.stringify(json.usage));
console.log('content 尾部:', JSON.stringify((msg?.content || '').slice(-120)));
