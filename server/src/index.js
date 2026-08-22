import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import './env.js';
import { importContent } from './importer.js';
import { ensureGeoJson, getGeoJson, getGeoJsonGz } from './geojson.js';
import { isAuthed, loginRoute, logoutRoute, meRoute } from './auth.js';
import { registerCountriesRoutes } from './routes/countries.js';
import { registerTopicsRoutes } from './routes/topics.js';
import { registerSearchRoute } from './routes/search.js';
import { registerMetaRoute, registerFavoritesRoutes } from './routes/meta.js';
import { registerQuizRoute } from './routes/quiz.js';
import { registerCardsRoutes } from './routes/cards.js';
import { registerMapAssetsRoutes } from './routes/map-assets.js';
import { registerOfflineRoute } from './routes/offline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const webDist = resolveWebDist();

function resolveWebDist() {
  if (process.env.WEB_DIST && fs.existsSync(process.env.WEB_DIST)) return process.env.WEB_DIST;
  const candidates = [
    path.join(process.cwd(), 'web', 'dist'),
    path.join(__dirname, '..', '..', 'web', 'dist'),
  ];
  return candidates.find((p) => fs.existsSync(path.join(p, 'index.html'))) || candidates[0];
}

const app = Fastify({ logger: true, trustProxy: true });

// CORS：允许跨域访问（桌面端本地代理同源转发；此配置方便网页端设置页跨域测试）
app.addHook('onRequest', async (req, reply) => {
  reply.header('access-control-allow-origin', '*');
  reply.header('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  reply.header('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') {
    reply.code(204).send();
  }
});

app.addHook('onRequest', async (req) => {
  req.authed = isAuthed(req);
});

app.post('/api/auth/login', loginRoute);
app.post('/api/auth/logout', logoutRoute);
app.get('/api/auth/me', meRoute);

registerCountriesRoutes(app);
registerTopicsRoutes(app);
registerSearchRoute(app);
registerMetaRoute(app);
registerFavoritesRoutes(app);
registerQuizRoute(app);
registerCardsRoutes(app);
registerMapAssetsRoutes(app);
registerOfflineRoute(app);

// geojson：大响应手动 gzip（外网传输提速 3-5 倍）
app.get('/api/geojson', (req, reply) => {
  if (String(req.headers['accept-encoding'] || '').includes('gzip')) {
    return reply
      .type('application/json')
      .header('content-encoding', 'gzip')
      .header('cache-control', 'public, max-age=86400')
      .send(getGeoJsonGz());
  }
  return reply.type('application/json').header('cache-control', 'public, max-age=86400').send(getGeoJson());
});

app.post('/api/admin/reimport', (req, reply) => {
  if (!req.authed) {
    reply.code(401).send({ error: 'unauthorized' });
    return;
  }
  const result = importContent();
  ensureGeoJson();
  return result;
});

app.get('/api/health', () => ({ ok: true }));

if (fs.existsSync(webDist)) {
  app.register(fastifyStatic, { root: webDist, wildcard: false });
  // 安装包下载目录（容器挂载 /app/downloads；本地开发为项目根 downloads）
  const dlDir = [process.env.DOWNLOADS_DIR, path.join(process.cwd(), 'downloads'), '/app/downloads'].find((p) => p && fs.existsSync(p));
  if (dlDir) {
    app.register(fastifyStatic, { root: dlDir, prefix: '/dl/', wildcard: true, decorateReply: false });
    app.log.info(`downloads served at /dl/ from ${dlDir}`);
  }
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/dl/')) {
      reply.code(404).send({ error: 'not found' });
      return;
    }
    reply.sendFile('index.html');
  });
} else {
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      reply.code(404).send({ error: 'not found' });
      return;
    }
    reply.code(503).send({ error: 'web dist not built yet; run: npm run build in web/' });
  });
}

const result = importContent();
ensureGeoJson();
app.log.info(`imported content: ${result.total} items (seeded=${result.seeded})`);

app.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
