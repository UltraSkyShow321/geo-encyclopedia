<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useThemeStore } from './stores/theme';
import { apiBase, isNativeEnv } from './api';
import NavBar from './components/NavBar.vue';
import FooterBar from './components/FooterBar.vue';

useThemeStore().apply();

const router = useRouter();

onMounted(() => {
  // 原生应用首次启动：未配置服务器地址 → 引导到设置页
  if (isNativeEnv() && !apiBase() && router.currentRoute.value.name !== 'settings') {
    router.push({ name: 'settings', query: { first: '1' } });
  }
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
