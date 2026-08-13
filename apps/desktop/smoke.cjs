// Electron 桌面版启动冒烟测试（offscreen 渲染 + 截图）
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const errors = [];
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    webPreferences: {
      offscreen: true,
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.webContents.on('console-message', (_e, _l, msg) => {
    if (/error/i.test(msg)) errors.push(msg.slice(0, 200));
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => errors.push(`did-fail-load ${code}: ${desc}`));

  await win.loadFile(path.join(__dirname, 'web', 'index.html'));
  await new Promise((r) => setTimeout(r, 6000));
  const img = await win.webContents.capturePage();
  const out = path.join(__dirname, '..', '..', 'logs', 'screenshots', 'desktop-app.png');
  fs.writeFileSync(out, img.toPNG());
  console.log('截图已保存:', out);
  console.log('控制台错误:', errors.length ? errors : '无');
  const body = await win.webContents.executeJavaScript('document.body.innerHTML.length');
  console.log('页面 body 内容长度:', body);
  const settingsVisible = await win.webContents.executeJavaScript(
    "document.body.textContent.includes('服务器地址') || document.body.textContent.includes('Server URL')"
  );
  console.log('设置页可见:', settingsVisible);
  app.quit();
});
