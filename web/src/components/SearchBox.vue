<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const router = useRouter();
const q = ref('');
const input = ref<HTMLInputElement>();

function submit() {
  const keyword = q.value.trim();
  if (!keyword) return;
  router.push({ path: '/search', query: { q: keyword } });
  input.value?.blur();
}

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <form @submit.prevent="submit" class="relative flex-1 min-w-[180px] max-w-md">
    <svg
      class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
    </svg>
    <input
      ref="input"
      v-model="q"
      type="search"
      :placeholder="t('nav.searchPlaceholder')"
      class="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
    />
  </form>
</template>
