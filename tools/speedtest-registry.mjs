// 完整 registry 认证 + arm64 镜像层下载测速
const hosts = ['docker.1ms.run', 'docker.xuanyuan.me', 'hub.rat.dev', 'docker.m.daocloud.io'];

async function getToken(host) {
  // 探测 WWW-Authenticate realm
  const probe = await fetch(`https://${host}/v2/`, { signal: AbortSignal.timeout(10000) });
  const auth = probe.headers.get('www-authenticate') || '';
  const realmMatch = auth.match(/realm="([^"]+)"/);
  const serviceMatch = auth.match(/service="([^"]+)"/);
  if (!realmMatch) return { error: `no realm: ${auth.slice(0, 80)}` };
  const realm = realmMatch[1];
  const service = serviceMatch ? serviceMatch[1] : 'registry.docker.io';
  const tokenRes = await fetch(
    `${realm}?service=${encodeURIComponent(service)}&scope=repository:library/node:pull`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!tokenRes.ok) return { error: `token ${tokenRes.status}` };
  const t = await tokenRes.json();
  return { token: t.token || t.access_token };
}

async function speedTest(host) {
  try {
    const auth = await getToken(host);
    if (auth.error || !auth.token) return { host, error: auth.error || 'no token' };
    const H = { authorization: `Bearer ${auth.token}`, accept: 'application/vnd.docker.distribution.manifest.list.v2+json' };
    const manifestRes = await fetch(`https://${host}/v2/library/node/manifests/24-alpine`, { headers: H, signal: AbortSignal.timeout(15000) });
    if (!manifestRes.ok) return { host, error: `manifest ${manifestRes.status}` };
    const list = await manifestRes.json();
    const arm64 = list.manifests.find((m) => m.platform?.architecture === 'arm64');
    if (!arm64) return { host, error: 'no arm64' };
    const mRes = await fetch(`https://${host}/v2/library/node/manifests/${arm64.digest}`, {
      headers: { ...H, accept: 'application/vnd.docker.distribution.manifest.v2+json' },
      signal: AbortSignal.timeout(15000),
    });
    const m = await mRes.json();
    const layer = m.layers[0].digest;
    const t0 = Date.now();
    const blobRes = await fetch(`https://${host}/v2/library/node/blobs/${layer}`, {
      headers: { authorization: `Bearer ${auth.token}` },
      signal: AbortSignal.timeout(40000),
    });
    if (!blobRes.ok) return { host, error: `blob ${blobRes.status}` };
    const reader = blobRes.body.getReader();
    let received = 0;
    const target = 4 * 1024 * 1024;
    while (received < target) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
    }
    await reader.cancel();
    const secs = (Date.now() - t0) / 1000;
    return { host, speed: `${(received / 1024 / 1024 / secs).toFixed(2)} MB/s`, took: secs.toFixed(1) + 's' };
  } catch (e) {
    return { host, error: e.message.slice(0, 50) };
  }
}

for (const r of await Promise.all(hosts.map(speedTest))) console.log(JSON.stringify(r));
