const fs = require('node:fs');
(async () => {
  for (const [name, url] of [
    ['globe-texture.jpg', 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg'],
    ['globe-night.jpg', 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night.jpg'],
  ]) {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
    console.log(name, 'status', r.status);
    if (r.ok) {
      fs.writeFileSync('web/public/' + name, Buffer.from(await r.arrayBuffer()));
      console.log('saved', name, fs.statSync('web/public/' + name).size);
    }
  }
})();
