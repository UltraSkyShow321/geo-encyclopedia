<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api, apiBase, isNativeEnv, setApiBase } from '../api';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const url = ref(apiBase());
const status = ref<'idle' | 'testing' | 'ok' | 'fail'>('idle');
const firstTime = computed(() => route.query.first === '1');
const native = ref(false);

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
  if (firstTime.value) router.push('/');
}

onMounted(() => {
  native.value = isNativeEnv();
});
</script>

<template>
  <div class="max-w-md mx-auto space-y-5">
    <h1 class="text-2xl font-bold">⚙️ {{ t('settings.title') }}</h1>

    <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
      <p class="text-sm text-slate-500">{{ t('settings.hint') }}</p>
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

    <div v-if="!native" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs text-slate-500">
      {{ t('settings.webNote') }}
    </div>
  </div>
</template>
