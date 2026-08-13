// 世界地理百科 桌面客户端主进程
// 内置本地代理: 页面以 http://127.0.0.1:<port> 加载（同源），/api/* 转发到用户配置的百科服务器
const path = require('node:path');
const { app, BrowserWindow, Menu, shell } = require('electron');
const { createProxy } = require('./proxy.cjs');

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(`http://127.0.0.1:${port}/index.html`);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
  return win;
}

const menu = Menu.buildFromTemplate([
  {
    label: '文件',
    submenu: [
      { label: '服务器设置', accelerator: 'Ctrl+,', click: (_i, win) => win?.loadURL(win.webContents.getURL().split('#')[0] + '#/settings') },
      { type: 'separator' },
      { role: 'quit', label: '退出' },
    ],
  },
  {
    label: '视图',
    submenu: [
      { role: 'reload', label: '刷新' },
      { role: 'togglefullscreen', label: '全屏' },
      { role: 'toggleDevTools', label: '开发者工具' },
    ],
  },
]);

app.whenReady().then(() => {
  const proxy = createProxy();
  proxy.listen(0, '127.0.0.1', () => {
    const port = proxy.address().port;
    Menu.setApplicationMenu(menu);
    createWindow(port);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
