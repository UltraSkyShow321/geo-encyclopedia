import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { i18n } from './i18n';
import './style.css';

// PWA Service Worker 仅在 http(s) 下注册；file://（Electron 桌面版）下必须跳过，否则启动即崩溃
if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
  try {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({ immediate: true });
  } catch {
    /* SW 注册失败不影响使用 */
  }
}

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.mount('#app');
