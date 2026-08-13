// 本地代理服务器（无 Electron 依赖，可独立测试）
// 将 http://127.0.0.1:<port>/api/* 转发到用户配置的百科服务器，静态资源从本地 web 目录提供
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

const WEB_DIR = path.join(__dirname, 'web');
let geoServer = '';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function serveStatic(req, res, urlPath) {
  let filePath = path.join(WEB_DIR, decodeURIComponent(urlPath));
  if (!filePath.startsWith(WEB_DIR)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(WEB_DIR, 'index.html');
  }
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('not found'); return; }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
}

function createProxy() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/__geo_server' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      try {
        const u = JSON.parse(body).url;
        if (u && /^https?:\/\//.test(u)) geoServer = u.replace(/\/+$/, '');
      } catch { /* ignore */ }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, server: geoServer }));
      return;
    }

    if (url.pathname.startsWith('/api/') && geoServer) {
      try {
        const ALLOWED = ['accept', 'accept-language', 'content-type', 'authorization', 'cookie', 'referer', 'origin', 'user-agent'];
        const headers = {};
        for (const k of ALLOWED) if (req.headers[k]) headers[k] = req.headers[k];
        for (const k of Object.keys(req.headers)) if (k.startsWith('x-')) headers[k] = req.headers[k];
        const target = geoServer + url.pathname + url.search;
        const up = await fetch(target, {
          method: req.method,
          headers,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
          duplex: 'half',
          redirect: 'manual',
        });
        const respHeaders = { 'content-type': up.headers.get('content-type') || 'application/octet-stream' };
        const setCookie = up.headers.getSetCookie();
        if (setCookie.length) respHeaders['set-cookie'] = setCookie;
        res.writeHead(up.status, respHeaders);
        Readable.fromWeb(up.body).pipe(res);
      } catch (e) {
        const detail = e.cause ? `${e.cause.code || ''} ${e.cause.message || ''}` : e.message;
        console.error('[proxy]', req.method, url.pathname, '->', detail);
        if (!res.headersSent) {
          res.writeHead(502, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'proxy failed: ' + detail }));
        } else {
          res.destroy();
        }
      }
      return;
    }

    serveStatic(req, res, url.pathname);
  });
}

module.exports = { createProxy, WEB_DIR, getGeoServer: () => geoServer };
