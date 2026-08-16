<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api, apiBase, isNativeEnv, notifyNativeProxy, setApiBase } from '../api';
import { DEFAULT_SERVER } from '../config';
import { downloadOfflinePack, getOfflineMeta, getOfflinePack } from '../offline';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const url = ref(apiBase() || DEFAULT_SERVER);
const status = ref<'idle' | 'testing' | 'ok' | 'fail'>('idle');
const firstTime = computed(() => route.query.first === '1');
const native = ref(false);
const usingDefault = ref(!localStorage.getItem('geo-server'));

// 离线包状态
const packInfo = ref<{ has: boolean; version?: number; updated?: number; size?: string }>({ has: false });
const packBusy = ref(false);

async function refreshPackInfo() {
  const pack = await getOfflinePack();
  const meta = await getOfflineMeta();
  packInfo.value = pack
    ? {
        has: true,
        version: meta?.version ?? pack.version,
        updated: meta?.updated_at,
        size: `${(JSON.stringify(pack).length / 1024 / 1024).toFixed(1)} MB`,
      }
    : { has: false };
}

async function updatePack() {
  packBusy.value = true;
  try {
    await downloadOfflinePack();
    await refreshPackInfo();
  } catch {
    alert('离线包更新失败（需要联网）');
  } finally {
    packBusy.value = false;
  }
}

onMounted(async () => {
  native.value = isNativeEnv();
  await refreshPackInfo();
});

async function test() {
  const target = url.value.trim().replace(/\/+$/, '');
  if (!target) {
    status.value = 'fail';
    return;
  }
  status.value = 'testing';
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    // 桌面端：先通知本地代理，再走同源 /api 测试；网页端：直接请求目标站点
    if (isNativeEnv() && /^https?:$/.test(location.protocol)) {
      await notifyNativeProxy(target);
      const res = await fetch('/api/meta', { signal: ctrl.signal });
      if (!res.ok) throw new Error(String(res.status));
      status.value = 'ok';
      return;
    }
    const res = await fetch(`${target}/api/meta`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(String(res.status));
    const meta = await res.json();
    status.value = 'ok';
    void meta;
  } catch {
    status.value = 'fail';
  }
}

function save() {
  const target = url.value.trim().replace(/\/+$/, '');
  setApiBase(target);
  notifyNativeProxy(target);
  usingDefault.value = false;
  if (firstTime.value) router.push('/');
}

function resetDefault() {
  url.value = DEFAULT_SERVER;
  localStorage.removeItem('geo-server');
  usingDefault.value = true;
  notifyNativeProxy(DEFAULT_SERVER);
}
</script>

<template>
  <div class="max-w-md mx-auto space-y-5">
    <h1 class="text-2xl font-bold">⚙️ {{ t('settings.title') }}</h1>

    <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
      <p class="text-sm text-slate-500">{{ t('settings.hint') }}</p>
      <div class="text-xs text-emerald-600" v-if="usingDefault">✅ 当前使用内置默认服务器（无需配置即可使用）</div>
      <div class="flex flex-wrap gap-2">
        <button class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" @click="url = 'http://127.0.0.1:3000'">
          💻 本机 http://127.0.0.1:3000
        </button>
        <button class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700" @click="resetDefault">
          ↩️ 恢复默认（{{ DEFAULT_SERVER }}）
        </button>
      </div>
      <label class="block">
        <span class="text-sm font-medium">{{ t('settings.serverUrl') }}</span>
        <input
          v-model="url"
          type="url"
          :placeholder="t('settings.serverPlaceholder')"
          class="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </label>
      <div class="flex gap-2">
        <button class="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" :disabled="status === 'testing'" @click="test">
          {{ t('settings.test') }}
        </button>
        <span v-if="status === 'ok'" class="text-sm text-emerald-600 self-center">✓ {{ t('settings.ok') }}</span>
        <span v-else-if="status === 'fail'" class="text-sm text-red-500 self-center">{{ t('settings.fail') }}</span>
      </div>
      <button class="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50" :disabled="!url.trim()" @click="save">
        {{ firstTime ? t('settings.start') : t('settings.save') }}
      </button>
    </div>

    <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
      <h2 class="text-sm font-semibold">📦 离线数据包</h2>
      <p class="text-xs text-slate-500">首次联网下载后，断网也能浏览全部 244 国内容、搜索与测验。</p>
      <div class="text-sm" v-if="packInfo.has">
        ✅ 已缓存（{{ packInfo.size }}）
        <span v-if="packInfo.updated" class="text-xs text-slate-400 ml-1">{{ new Date(packInfo.updated).toLocaleString() }}</span>
      </div>
      <div class="text-sm" v-else>尚未缓存离线数据</div>
      <button class="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50" :disabled="packBusy" @click="updatePack">
        {{ packBusy ? '下载中…' : '立即下载/更新离线包' }}
      </button>
    </div>

    <div v-if="!native" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs text-slate-500">
      {{ t('settings.webNote') }}
    </div>
  </div>
</template>
