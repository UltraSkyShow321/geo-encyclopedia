import crypto from 'node:crypto';
import { stmts } from './db.js';

const SESSION_TTL = 30 * 24 * 3600 * 1000;
const loginAttempts = new Map();

const DEFAULT_PASSWORD = 'change-me-to-a-strong-password';
const envPassword = process.env.ADMIN_PASSWORD;

if (!envPassword) {
  console.error(
    '✗ 未检测到 ADMIN_PASSWORD。\n' +
    '  请在项目根目录创建 .env 文件（可从 .env.example 复制）并填写：ADMIN_PASSWORD=你的密码\n' +
    '  本地开发: 在 server 目录执行 npm run dev（会自动加载 ../.env）\n' +
    '  Docker 部署: 确保 .env 与 docker-compose.yml 同目录，并重新创建容器'
  );
  process.exit(1);
}
if (envPassword === DEFAULT_PASSWORD) {
  console.warn('⚠ ADMIN_PASSWORD 仍为示例默认值（change-me-to-a-strong-password），请尽快修改 .env！');
}

function passwordHash(password) {
  const salt = 'geo-encyclopedia-static-salt-v1';
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
const expectedHash = passwordHash(envPassword);

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export function isAuthed(req) {
  const token = parseCookies(req.headers.cookie).geo_token;
  if (!token) return false;
  stmts.cleanupSessions.run(Date.now());
  const s = stmts.sessionByToken.get(token);
  return s ? s.expires_at > Date.now() : false;
}

export function setCookie(reply, token) {
  reply.header(
    'set-cookie',
    `geo_token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}`
  );
}

export function clearCookie(reply) {
  reply.header('set-cookie', 'geo_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

export function requireAuth(req, reply) {
  if (!isAuthed(req)) {
    reply.code(401).send({ error: 'unauthorized' });
    return false;
  }
  return true;
}

export async function loginRoute(req, reply) {
  const ip = req.ip;
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (rec.reset < now) {
    rec.count = 0;
    rec.reset = now + 15 * 60 * 1000;
  }
  if (rec.count >= 20) {
    reply.code(429).send({ error: 'too many attempts' });
    return;
  }
  const password = String(req.body?.password ?? '');
  if (!timingSafeEqualHex(passwordHash(password), expectedHash)) {
    rec.count += 1;
    loginAttempts.set(ip, rec);
    reply.code(401).send({ error: 'wrong password' });
    return;
  }
  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  stmts.insertSession.run(token, now, now + SESSION_TTL);
  setCookie(reply, token);
  reply.send({ ok: true });
}

export function logoutRoute(req, reply) {
  const token = parseCookies(req.headers.cookie).geo_token;
  if (token) stmts.deleteSession.run(token);
  clearCookie(reply);
  reply.send({ ok: true });
}

export function meRoute(req) {
  return { authed: isAuthed(req) };
}
