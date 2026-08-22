// 生成 /dl/ 下载索引页（内嵌二维码）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dlDir = path.join(__dirname, '..', 'downloads');
const qrLan = fs.readFileSync(path.join(dlDir, 'qr-lan.svg'), 'utf8').replace(/\n\s*/g, ' ');
const qrWan = fs.readFileSync(path.join(dlDir, 'qr-wan.svg'), 'utf8').replace(/\n\s*/g, ' ');

const css = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,'PingFang SC',sans-serif;background:#1e1b4b;color:#e2e8f0;min-height:100vh;padding:24px 16px}.wrap{max-width:760px;margin:0 auto}.h{text-align:center;margin-bottom:8px;font-size:26px}.sub{text-align:center;color:#94a3b8;font-size:13px;margin-bottom:22px}.card{background:#312e81;border:1px solid #4338ca;border-radius:14px;padding:18px;margin-bottom:14px}.name{font-weight:700;font-size:15px;display:flex;align-items:center;gap:8px}.meta{color:#94a3b8;font-size:12px;margin-top:2px}.btn{display:block;text-align:center;margin-top:10px;padding:11px;border-radius:10px;background:#6366f1;color:#fff;text-decoration:none;font-size:14px;font-weight:600}.btn:hover{background:#4f46e5}.note{font-size:12px;color:#c7d2fe;margin-top:6px;line-height:1.6}h3{margin:0 0 10px;font-size:15px;color:#a5b4fc}.qrs{display:flex;gap:18px;justify-content:center;margin:20px 0 6px;flex-wrap:wrap}.qr{background:#fff;border-radius:10px;padding:8px;width:150px;text-align:center}.qr svg{width:100%;height:auto;display:block}.qrt{font-size:12px;color:#cbd5e1;margin-top:5px}.pwa{background:#312e81;border:1px solid #4338ca;border-radius:14px;padding:16px 18px;font-size:13px;line-height:1.9;color:#c7d2fe}`;

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>世界地理百科全书 - 安装包下载</title>
<style>${css}</style>
</head>
<body>
<div class="wrap">
  <div class="h">🌍 世界地理百科全书</div>
  <div class="sub">安装包下载 · 244 国档案 / 互动地图 / 离线可用</div>

  <div class="qrs">
    <div class="qr">${qrLan}<div class="qrt">家里 WiFi 扫我</div></div>
    <div class="qr">${qrWan}<div class="qrt">外网/流量扫我</div></div>
  </div>

  <div class="card">
    <div class="name">🤖 Android / 鸿蒙 4.x</div>
    <div class="meta">v1.0.0 · 5.4 MB · APK 直接安装，内置服务器地址，下载即用</div>
    <a class="btn" href="geo-encyclopedia-v1.0.0-android.apk" download>下载 APK</a>
    <div class="note">安装提示：若提示"未知来源"请允许；覆盖安装保留收藏与笔记数据。</div>
  </div>

  <div class="card">
    <div class="name">🪟 Windows 安装版</div>
    <div class="meta">v1.0.0 · 78.9 MB · 推荐桌面用户</div>
    <a class="btn" href="geo-encyclopedia-v1.0.0-win-setup.exe" download>下载 Setup.exe</a>
    <div class="note">SmartScreen 拦截时：点击"更多信息 → 仍要运行"。</div>
  </div>

  <div class="card">
    <div class="name">📦 Windows 免安装 zip（绕过 SmartScreen）</div>
    <div class="meta">v1.0.0 · 78.7 MB · 解压即用，不写注册表</div>
    <a class="btn" href="geo-encyclopedia-v1.0.0-win-portable.zip" download>下载 Portable.zip</a>
    <div class="note">解压后运行 geo-encyclopedia-v1.0.0-win-portable.exe。单文件版：<a style="color:#a5b4fc" href="geo-encyclopedia-v1.0.0-win-portable.exe">win-portable.exe</a></div>
  </div>

  <div class="pwa">
    <h3>📱 iPhone / iPad / macOS / 鸿蒙 6.0（免安装包）</h3>
    iPhone/iPad：Safari 打开首页 → 分享 → <b>添加到主屏幕</b><br>
    macOS：Chrome/Edge 打开首页 → 地址栏右侧 <b>安装</b><br>
    鸿蒙 6.0：浏览器打开首页 → 菜单 → <b>添加到主屏幕</b><br>
    PWA 同样支持离线缓存、全屏体验与新图标。
  </div>

  <div class="sub" style="margin-top:18px">客户端自动连接服务器：内网直连 · 外网自动切换 · 断网走离线包</div>
</div>
</body>
</html>`;

fs.writeFileSync(path.join(dlDir, 'index.html'), html);
console.log('downloads/index.html written:', (html.length / 1024).toFixed(1) + 'KB');
