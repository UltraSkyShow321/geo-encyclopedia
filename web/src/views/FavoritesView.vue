<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '../api';

const { t } = useI18n();

interface FavRow {
  slug: string;
  note: string;
  title_zh: string;
  title_en: string;
  flag_emoji: string;
  type: string;
  created_at: number;
}

const rows = ref<FavRow[]>([]);
const editing = ref<Record<string, string>>({});
const saved = ref<Record<string, boolean>>({});
const saving = ref<Record<string, boolean>>({});

async function load() {
  rows.value = await api.favorites();
  editing.value = Object.fromEntries(rows.value.map((r) => [r.slug, r.note]));
}

async function save(slug: string) {
  saving.value[slug] = true;
  try {
    await api.putFavorite(slug, editing.value[slug] || '');
    const row = rows.value.find((r) => r.slug === slug);
    if (row) row.note = editing.value[slug] || '';
    saved.value[slug] = true;
    setTimeout(() => (saved.value[slug] = false), 1500);
  } finally {
    saving.value[slug] = false;
  }
}

async function remove(slug: string) {
  await api.deleteFavorite(slug);
  await load();
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

onMounted(load);
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold">⭐ {{ t('favorites.title') }} <span class="text-sm font-normal text-slate-400">({{ rows.length }})</span></h1>

    <div v-if="!rows.length" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-400">
      {{ t('favorites.empty') }}
    </div>

    <div v-for="row in rows" :key="row.slug" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div class="flex items-center gap-3">
        <span class="text-2xl leading-none">{{ row.flag_emoji || '📄' }}</span>
        <RouterLink :to="row.type === 'country' ? `/countries/${row.slug}` : `/topics/${row.slug}`" class="font-semibold hover:text-indigo-600 dark:hover:text-indigo-400">
          {{ row.title_zh }}
        </RouterLink>
        <span class="text-xs text-slate-400">{{ row.title_en }}</span>
        <span class="ml-auto text-[11px] text-slate-400">{{ fmtDate(row.created_at) }}</span>
        <button class="text-xs text-red-400 hover:text-red-600" @click="remove(row.slug)">{{ t('favorites.remove') }}</button>
      </div>
      <div class="flex items-start gap-2">
        <textarea
          v-model="editing[row.slug]"
          rows="2"
          class="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          :placeholder="t('favorites.notes')"
        ></textarea>
        <button class="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50 shrink-0" :disabled="saving[row.slug]" @click="save(row.slug)">
          {{ saved[row.slug] ? '✓' : t('common.saveNote') }}
        </button>
      </div>
    </div>
  </div>
</template>
