const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

const WEB_DIR = path.join(__dirname, 'web');

function createWindow() {
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

  win.loadFile(path.join(WEB_DIR, 'index.html'));

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
      { label: '服务器设置', accelerator: 'Ctrl+,', click: (_i, win) => win?.loadURL('file://' + path.join(WEB_DIR, 'index.html') + '#/settings') },
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
  Menu.setApplicationMenu(menu);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
