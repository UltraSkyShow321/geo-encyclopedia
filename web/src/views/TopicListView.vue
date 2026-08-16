<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api, type TopicSummary } from '../api';
import { offline } from '../offline';

const { t } = useI18n();
const route = useRoute();
const topics = ref<{ category: string; items: TopicSummary[] }[]>([]);
const active = ref(String(route.query.category || ''));
const offlineMode = ref(false);

const categories = computed(() => {
  if (!active.value) return topics.value;
  return topics.value.filter((c) => c.category === active.value);
});

const tabs = computed(() => [
  { key: '', label: t('common.allContinents') === t('common.allContinents') ? '全部' : 'All' },
  ...topics.value.map((c) => ({ key: c.category, label: t('topics.' + (c.category || 'other')) })),
]);

onMounted(async () => {
  try {
    const r = await api.topics();
    topics.value = r.categories;
  } catch {
    offlineMode.value = true;
    const ts = await offline.topics();
    const cats = new Map<string, TopicSummary[]>();
    for (const t of ts) {
      if (!cats.has(t.category)) cats.set(t.category, []);
      cats.get(t.category)!.push({
        slug: t.slug, title_zh: t.title_zh, title_en: t.title_en,
        category: t.category, summary: t.summary, status: 'published',
      });
    }
    topics.value = [...cats.entries()].map(([category, items]) => ({ category, items }));
  }
});
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">{{ t('topics.title') }} <span class="text-sm font-normal text-slate-400">({{ topics.reduce((s, c) => s + c.items.length, 0) }})</span></h1>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="px-4 py-2 rounded-lg text-sm border"
        :class="active === tab.key
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'"
        @click="active = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-for="cat in categories" :key="cat.category" class="space-y-3">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <span class="text-xl">{{ cat.category === 'nature' ? '🏔️' : cat.category === 'human' ? '🏛️' : '📚' }}</span>
        {{ t('topics.' + (cat.category || 'other')) }}
      </h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <RouterLink
          v-for="tp in cat.items"
          :key="tp.slug"
          :to="`/topics/${tp.slug}`"
          class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition"
        >
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold text-slate-900 dark:text-slate-100">{{ tp.title_zh }}</h3>
            <span v-if="tp.status !== 'published'" class="shrink-0 text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5">
              {{ t('common.statusDraft') }}
            </span>
          </div>
          <p class="text-xs text-slate-400 mb-1">{{ tp.title_en }}</p>
          <p class="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{{ tp.summary }}</p>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
