// 通过 GitHub API 发布项目（适用于 github.com 不可达、api.github.com 可达的网络环境）
// 用法: node tools/github-publish.mjs <token文件路径>
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tokenFile = process.argv[2];
if (!tokenFile || !fs.existsSync(tokenFile)) {
  console.error('用法: node tools/github-publish.mjs <token文件路径>');
  process.exit(1);
}
const TOKEN = fs.readFileSync(tokenFile, 'utf8').trim();
const API = 'https://api.github.com';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function gh(api, opts = {}) {
  const headers = { authorization: `Bearer ${TOKEN}`, 'user-agent': 'geo-encyclopedia', ...(opts.headers || {}) };
  const res = await fetch(`${API}${api}`, { ...opts, headers });
  let body = null;
  const text = await res.text();
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`API ${res.status} ${api}: ${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function main() {
  console.log('== 1/6 验证账号 ==');
  const user = await gh('/user');
  console.log(`  账号: ${user.login}`);

  console.log('== 2/6 创建公开仓库 ==');
  let repo;
  try {
    repo = await gh(`/user/repos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'geo-encyclopedia',
        description: '世界地理百科全书 — 244国档案 + 地理专题 + 互动地图 + 测验/卡片 (Vue3 + Fastify + SQLite)',
        private: false,
        has_issues: true,
        has_wiki: true,
      }),
    });
  } catch (e) {
    if (String(e.message).includes('already exists')) {
      console.log('  仓库已存在，复用');
      repo = await gh(`/repos/${user.login}/geo-encyclopedia`);
    } else throw e;
  }
  console.log(`  仓库: ${repo.html_url}`);

  console.log('== 3/6 读取本地提交 ==');
  const head = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  const tree = execSync('git rev-parse HEAD:', { cwd: ROOT, encoding: 'utf8' }).trim();
  const message = execSync('git log -1 --format=%B', { cwd: ROOT, encoding: 'utf8' }).trim();
  const authorName = execSync('git log -1 --format=%an', { cwd: ROOT, encoding: 'utf8' }).trim();
  const authorEmail = execSync('git log -1 --format=%ae', { cwd: ROOT, encoding: 'utf8' }).trim();
  const commitTime = execSync('git log -1 --format=%ct', { cwd: ROOT, encoding: 'utf8' }).trim();
  console.log(`  commit ${head.slice(0, 8)} | 作者 ${authorName} <${authorEmail}>`);

  console.log('== 4/6 上传文件 (blobs) ==');
  const entries = execSync('git ls-tree -r HEAD --full-tree', { cwd: ROOT, encoding: 'utf8' })
    .trim()
    .split('\n')
    .map((l) => {
      const m = l.match(/^(\d+)\s+(\w+)\s+([0-9a-f]{40})\s+(.+)$/);
      return m ? { mode: m[1], type: m[2], sha: m[3], path: m[4] } : null;
    })
    .filter((e) => e && e.type === 'blob');
  console.log(`  ${entries.length} 个文件`);

  let uploaded = 0;
  let inited = false;
  let initSha = null;
  let initPromise = null;
  async function initEmptyRepo() {
    // 空仓库必须先有一个提交（Contents API 创建首个文件），Git Data API 才会解锁
    console.log('  仓库为空，通过 Contents API 创建初始化提交…');
    const init = await gh(`/repos/${user.login}/geo-encyclopedia/contents/.gitkeep`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: Buffer.from('').toString('base64'), message: 'init' }),
    });
    initSha = init.commit.sha;
    inited = true;
  }
  function ensureInit() {
    if (!initPromise) initPromise = initEmptyRepo();
    return initPromise;
  }

  const BATCH = 20;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (e) => {
        const content = execSync(`git cat-file blob ${e.sha}`, { cwd: ROOT });
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            await gh(`/repos/${user.login}/geo-encyclopedia/git/blobs`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ content: content.toString('base64'), encoding: 'base64' }),
            });
            return;
          } catch (err) {
            if (String(err.message).includes('Git Repository is empty') && !inited) {
              await ensureInit();
              continue;
            }
            if (attempt === 3) throw err;
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      })
    );
    uploaded += batch.length;
    process.stdout.write(`\r  ${uploaded}/${entries.length}`);
  }
  console.log('');

  console.log('== 5/6 建树与提交 ==');
  const treeRes = await gh(`/repos/${user.login}/geo-encyclopedia/git/trees`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tree: entries.map((e) => ({ path: e.path, mode: e.mode, type: 'blob', sha: e.sha })),
    }),
  });
  const commitRes = await gh(`/repos/${user.login}/geo-encyclopedia/git/commits`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message,
      tree: treeRes.sha,
      parents: inited ? [initSha] : [],
      author: { name: authorName, email: authorEmail, date: new Date(Number(commitTime) * 1000).toISOString() },
      committer: { name: authorName, email: authorEmail, date: new Date(Number(commitTime) * 1000).toISOString() },
    }),
  });
  console.log(`  提交: ${commitRes.sha.slice(0, 8)}`);

  console.log('== 6/6 推送分支 ==');
  if (inited) {
    // 已有 init 提交，用更新而非创建 ref
    await gh(`/repos/${user.login}/geo-encyclopedia/git/refs/heads/main`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sha: commitRes.sha, force: true }),
    });
  } else {
    await gh(`/repos/${user.login}/geo-encyclopedia/git/refs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/main`, sha: commitRes.sha }),
    });
  }

  const check = await gh(`/repos/${user.login}/geo-encyclopedia/contents/README.md`);
  console.log('  校验: README.md 已上传 ✅');
  console.log(`\n发布完成: ${repo.html_url}`);
  console.log(`克隆地址: git clone https://github.com/${user.login}/geo-encyclopedia.git`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
