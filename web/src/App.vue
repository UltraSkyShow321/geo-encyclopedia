<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useThemeStore } from './stores/theme';
import { apiBase, isNativeEnv } from './api';
import { checkOfflineUpdate } from './offline';
import NavBar from './components/NavBar.vue';
import FooterBar from './components/FooterBar.vue';

useThemeStore().apply();

const router = useRouter();

onMounted(async () => {
  // 原生桌面端（本地代理 http 模式）：内置默认地址已配好，直接使用；连接失败才提示设置页
  if (isNativeEnv() && /^https?:$/.test(location.protocol)) {
    try {
      const r = await fetch('/api/meta', { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error(String(r.status));
    } catch {
      if (router.currentRoute.value.name !== 'settings') {
        router.push({ name: 'settings', query: { first: '1' } });
      }
    }
    return;
  }
  // 原生移动端（Capacitor）：使用内置默认服务器地址（或已保存的自定义地址），无需设置
  // 若默认地址不可用且未配置，仍提供设置页入口（用户可在设置页修改）
  // 离线数据包：后台自动检查更新（联网时）
  setTimeout(() => { checkOfflineUpdate().catch(() => {}); }, 3000);
});
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <NavBar />
    <main class="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
      <RouterView />
    </main>
    <FooterBar />
  </div>
</template>
