<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { api, type CountrySummary } from '../api';
import { offline } from '../offline';
import SearchBox from '../components/SearchBox.vue';
import CountryCard from '../components/CountryCard.vue';
import EChart from '../components/EChart.vue';
import { CONTINENT_COLORS, formatNumber } from '../utils/format';
import { useAuthStore } from '../stores/auth';

const { t, locale } = useI18n();
const auth = useAuthStore();
const meta = ref<any>(null);
const popular = ref<CountrySummary[]>([]);
const topics = ref<any[]>([]);
const offlineMode = ref(false);

const populationChart = computed(() => {
  if (!popular.value.length) return {};
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: popular.value.map((c) => c.name_zh), axisLabel: { interval: 0, rotate: 40, fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatNumber(v, locale.value) } },
    series: [
      {
        type: 'bar',
        data: popular.value.map((c) => c.population),
        itemStyle: { color: '#6366f1', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 26,
      },
    ],
  };
});

onMounted(async () => {
  try {
    const [m, c] = await Promise.all([api.meta(), api.countries({ sort: 'population', order: 'desc', limit: 10 })]);
    meta.value = m;
    popular.value = c.items;
  } catch {
    // 离线兜底：从本地离线包计算
    offlineMode.value = true;
    const cs = (await offline.countries()) as any[];
    const top = [...cs].sort((a, b) => (b.population || 0) - (a.population || 0)).slice(0, 10);
    popular.value = top;
    const continents = new Map<string, { name: string; count: number; population: number }>();
    for (const c of cs) {
      const rec = continents.get(c.continent) || { name: c.continent, count: 0, population: 0 };
      rec.count++; rec.population += c.population || 0;
      continents.set(c.continent, rec);
    }
    meta.value = {
      totalCountries: cs.length,
      totalTopics: (await offline.topics()).length,
      totalDrafts: 0,
      totalPopulation: cs.reduce((s: number, c: any) => s + (c.population || 0), 0),
      continents: [...continents.values()],
    };
  }
  try {
    const t = await api.topics();
    topics.value = t.categories;
  } catch {
    const ts = await offline.topics();
    const cats = new Map<string, any[]>();
    for (const t of ts) {
      if (!cats.has(t.category)) cats.set(t.category, []);
      cats.get(t.category)!.push({ slug: t.slug, title_zh: t.title_zh, title_en: t.title_en, category: t.category, summary: t.summary });
    }
    topics.value = [...cats.entries()].map(([category, items]) => ({ category, items }));
  }
});
</script>

<template>
  <div class="space-y-10">
    <div v-if="offlineMode" class="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
      离线模式（数据来自本地缓存，联网后自动更新）
    </div>
    <section class="text-center py-8 md:py-12">
      <h1 class="text-3xl md:text-5xl font-bold text-slate-900 dark:text-slate-100">
        {{ t('home.heroTitle') }}
      </h1>
      <p class="mt-3 text-slate-500 dark:text-slate-400">{{ t('home.heroSub') }}</p>
      <div class="mt-6 max-w-xl mx-auto">
        <SearchBox />
      </div>
      <div v-if="meta" class="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
        <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
          <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{{ meta.totalCountries }}</div>
          <div class="text-xs text-slate-500">{{ t('home.statCountries') }}</div>
        </div>
        <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
          <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{{ meta.totalTopics }}</div>
          <div class="text-xs text-slate-500">{{ t('home.statTopics') }}</div>
        </div>
        <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
          <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{{ meta.continents.length }}</div>
          <div class="text-xs text-slate-500">{{ t('home.statContinents') }}</div>
        </div>
        <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
          <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{{ formatNumber(meta.totalPopulation, locale) }}</div>
          <div class="text-xs text-slate-500">{{ t('home.statPopulation') }}</div>
        </div>
      </div>
    </section>

    <section v-if="meta">
      <h2 class="text-xl font-semibold mb-4">{{ t('home.continentsTitle') }}</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <RouterLink
          v-for="c in meta.continents"
          :key="c.name"
          :to="{ path: '/countries', query: { continent: c.name } }"
          class="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center hover:shadow-md transition bg-white dark:bg-slate-900"
          :style="{ borderTopColor: CONTINENT_COLORS[c.name] || '#94a3b8', borderTopWidth: 3 }"
        >
          <div class="font-semibold">{{ c.name }}</div>
          <div class="text-xs text-slate-500 mt-1">{{ c.count }} 国 · {{ formatNumber(c.population, locale) }}</div>
        </RouterLink>
      </div>
    </section>

    <section v-if="topics.length">
      <h2 class="text-xl font-semibold mb-4">{{ t('home.topicsTitle') }}</h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <RouterLink
          v-for="cat in topics"
          :key="cat.category"
          :to="{ path: '/topics', query: { category: cat.category } }"
          class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:shadow-md transition flex items-center justify-between"
        >
          <div>
            <div class="font-semibold">{{ t('topics.' + (cat.category || 'other')) }}</div>
            <div class="text-xs text-slate-500">{{ cat.count }} 篇</div>
          </div>
          <span class="text-2xl">{{ cat.category === 'nature' ? '🏔️' : '🏛️' }}</span>
        </RouterLink>
      </div>
    </section>

    <section v-if="popular.length">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">{{ t('home.popularTitle') }}</h2>
        <RouterLink to="/ranks" class="text-sm text-indigo-600 dark:text-indigo-400">→</RouterLink>
      </div>
      <div class="grid md:grid-cols-5 gap-3">
        <div class="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <EChart :option="populationChart" height="300px" />
        </div>
        <div class="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <CountryCard v-for="c in popular" :key="c.slug" :country="c" />
        </div>
      </div>
    </section>

    <p v-if="auth.authed" class="text-center text-xs text-slate-400">{{ t('home.about') }}</p>
  </div>
</template>
