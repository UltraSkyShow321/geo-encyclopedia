// 调用 LLM（OpenAI 兼容接口）为草稿国家/专题填充正文
// 用法: node tools/generate-content.mjs [--all] [--limit N] [--slug cn] [--concurrency 3]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './load-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const countriesDir = path.join(root, 'content', 'countries');
const topicsDir = path.join(root, 'content', 'topics');

const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
const MODEL = process.env.OPENAI_MODEL || 'deepseek-chat';
const args = new Set(process.argv.slice(2));
const onlySlug = args.has('--slug') || args.has('--only')
  ? process.argv[Math.max(process.argv.indexOf('--slug'), process.argv.indexOf('--only')) + 1]
  : null;
const limitArg = args.has('--limit') ? Number(process.argv[process.argv.indexOf('--limit') + 1]) : null;
const CONCURRENCY = args.has('--concurrency') ? Number(process.argv[process.argv.indexOf('--concurrency') + 1]) || 3 : 3;

const PLACEHOLDER = /待生成/;

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    if (!key) continue;
    if (val === 'true') meta[key] = true;
    else if (val === 'false') meta[key] = false;
    else if (/^-?\d+$/.test(val)) meta[key] = parseInt(val, 10);
    else if (val.startsWith('[')) meta[key] = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    else meta[key] = val.replace(/^"|"$/g, '');
  }
  return { meta, body: m[2] ?? '' };
}

function formatFrontmatter(meta) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.join(', ')}]`);
    else if (typeof v === 'string' && /[:#\[\]'"&]/.test(v)) lines.push(`${k}: "${v.replace(/"/g, '\\"')}"`);
    else lines.push(`${k}: ${v}`);
  }
  lines.push('---');
  return lines.join('\n');
}

function itemSummary(meta) {
  const keys = [
    ['中文名', meta.name_zh], ['英文名', meta.name_en], ['大洲', meta.continent],
    ['首都', meta.capital_zh], ['人口', meta.population], ['面积(km²)', meta.area_km2],
    ['货币', meta.currency_zh], ['官方语言', meta.official_language_zh],
    ['政体', meta.government_zh], ['时区', meta.timezone],
  ];
  return keys.filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => `${k}: ${v}`).join('；');
}

function buildPrompt(meta, type) {
  const system =
    type === 'country'
      ? `你是一位严谨的地理百科编辑。根据提供的国家数据与你的常识，用简体中文撰写一篇准确、信息密度高的百科正文。
要求：
1. 严格分为四个小节，标题必须为：## 地理概况、## 历史沿革、## 经济、## 文化与人口
2. 每节 180–300 字，总字数 800–1100 字
3. 专有名词首次出现时，中文后加英文括号附注，例如"长江（Yangtze River）"
4. 统计数字（人口、面积、首都等）以提供的数据为准；其余内容（地形、气候、历史时期、支柱产业、民族宗教等）可依据广为人知的常识补充，但要避免编造未经验证的具体数字
5. 语气客观、信息密度高，避免"数据未提供"之类的空话套话
6. 只输出正文 Markdown，不要任何前言后语`
      : `你是一位严谨的地理百科编辑。根据提供的主题信息与你的常识，用简体中文撰写一篇准确、信息密度高的百科正文。
要求：
1. 使用 Markdown 格式，包含 2-4 个小节（用 ## 二级标题），字数 400–800 字
2. 专有名词首次出现时附英文括号，如"尼罗河（Nile）"
3. 列举关键条目时使用列表，数字使用广为人知的近似值（如"约 6,650km"）
4. 语气客观，避免空话套话
5. 只输出正文 Markdown，不要任何前言后语`;
  const user = type === 'country'
    ? `国家数据：\n${itemSummary(meta)}\n\n请撰写正文。`
    : `主题：${meta.title_zh}（${meta.title_en}）\n类别：${meta.category}\n\n请撰写正文。`;
  return { system, user };
}

async function callLLM(meta, type) {
  const { system, user } = buildPrompt(meta, type);
  const requiredHeadings = type === 'country'
    ? ['## 地理概况', '## 历史沿革', '## 经济', '## 文化与人口']
    : null;
  let lastDetail = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const body = {
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      max_tokens: attempt === 1 ? 4000 : 8000,
      reasoning_effort: 'low',
    };
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const content = (json.choices?.[0]?.message?.content || '').trim();
    const finishReason = json.choices?.[0]?.finish_reason;
    const reasoning = json.choices?.[0]?.message?.reasoning_content || '';
    lastDetail = `finish_reason=${finishReason}, 长度=${content.length}${reasoning ? `, 推理 ${reasoning.length} 字` : ''}`;

    // 校验: 非空 + 达到最小长度 + 包含全部必需小节标题
    const valid =
      content.length >= (type === 'country' ? 300 : 200) &&
      (!requiredHeadings || requiredHeadings.every((h) => content.includes(h)));
    if (valid) return content;
  }

  throw new Error(`LLM 内容不完整 (${lastDetail})`);
}

function runPool(tasks, concurrency) {
  let idx = 0;
  let done = 0;
  let failures = 0;
  const failureLog = [];
  const start = Date.now();

  const report = () => {
    const elapsed = Math.round((Date.now() - start) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const running = Math.min(idx, tasks.length) - done;
    const eta = done > 0 ? Math.round((elapsed / done) * (tasks.length - done) / 60) : '?';
    let line = `[${done}/${tasks.length}] 成功 ${done - failures} 失败 ${failures} 进行中 ${running} 已用 ${mins}m${secs}s`;
    if (done > 0 && eta !== '?') line += ` 预计还需约 ${eta} 分钟`;
    if (process.stdout.isTTY) {
      process.stdout.write('\r' + ' '.repeat(90) + '\r' + line);
    } else {
      process.stdout.write(line + '\n');
    }
  };

  const timer = setInterval(report, 5000);

  const worker = async () => {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        await tasks[i]();
        done++;
      } catch (e) {
        failures++;
        done++;
        failureLog.push(`${tasks[i].name}: ${e.message}`);
        if (failureLog.length <= 5) console.error(`\n[失败] ${tasks[i].name}: ${e.message}`);
      }
    }
  };
  return Promise.all(Array.from({ length: concurrency }, worker))
    .then(() => {
      clearInterval(timer);
      report();
      console.log('');
      if (failureLog.length > 5) {
        console.error(`其余 ${failureLog.length - 5} 条失败信息略，日志见上方（重跑会自动跳过已成功的条目）`);
      }
      return failures;
    });
}

async function main() {
  if (!API_KEY) {
    console.error('缺少 OPENAI_API_KEY，请在 .env 中配置（参考 .env.example）');
    process.exit(1);
  }
  const jobs = [];

  for (const [dir, type] of [[countriesDir, 'country'], [topicsDir, 'topic']]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).sort()) {
      if (!file.endsWith('.md')) continue;
      const filePath = path.join(dir, file);
      const { meta, body } = parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
      if (onlySlug && meta.slug !== onlySlug) continue;
      if (!args.has('--all') && meta.status === 'published') continue;
      if (!PLACEHOLDER.test(body)) continue;
      const name = `${type}:${meta.slug}`;
      jobs.push({
        name,
        run: async () => {
          const content = await callLLM(meta, type);
          const newBody = content
            .replace(/^## /gm, '## ')
            .replace(/^\s*\n+/, '')
            .trimEnd() + '\n';
          meta.ai_generated = true;
          const md = `${formatFrontmatter(meta)}\n${newBody}`;
          fs.writeFileSync(filePath, md, 'utf8');
        },
      });
    }
  }

  if (onlySlug) {
    const job = jobs.find((j) => j.name.endsWith(`:${onlySlug}`));
    if (!job) {
      console.error(`未找到 ${onlySlug} 的待生成条目`);
      process.exit(1);
    }
    await job.run();
    console.log(`\n完成 ${job.name}`);
    return;
  }

  const limited = limitArg ? jobs.slice(0, limitArg) : jobs;
  console.log(`待生成条目：${limited.length}（并发 ${CONCURRENCY}）`);
  const failures = await runPool(limited.map((j) => j.run), CONCURRENCY);
  console.log(`\n完成：成功 ${limited.length - failures}，失败 ${failures}`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
