<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api, type CountrySummary } from '../api';
import { offline } from '../offline';
import CountryCard from '../components/CountryCard.vue';
import { CONTINENTS } from '../utils/format';
import { useAuthStore } from '../stores/auth';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const countries = ref<CountrySummary[]>([]);
const loading = ref(true);
const visible = ref(30);

const continent = computed(() => String(route.query.continent || ''));
const sort = computed(() => String(route.query.sort || 'name'));
const order = computed(() => String(route.query.order || 'asc'));
const q = computed(() => String(route.query.q || ''));
const includeDrafts = computed(() => route.query.includeDrafts === 'true');

const sorted = computed(() => {
  const list = [...countries.value];
  const dir = order.value === 'desc' ? -1 : 1;
  list.sort((a, b) => {
    if (sort.value === 'population') return ((a.population ?? 0) - (b.population ?? 0)) * dir;
    if (sort.value === 'area') return ((a.area_km2 ?? 0) - (b.area_km2 ?? 0)) * dir;
    return String(a.name_zh).localeCompare(String(b.name_zh), 'zh') * dir;
  });
  return list;
});

const visibleItems = computed(() => sorted.value.slice(0, visible.value));

function setQuery(patch: Record<string, string | undefined>) {
  const qs: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...route.query, ...patch })) {
    if (Array.isArray(v)) continue;
    if (v && v !== '') qs[k] = String(v);
  }
  router.replace({ path: '/countries', query: qs });
}

watch([continent, q, includeDrafts], async () => {
  loading.value = true;
  visible.value = 30;
  try {
    const r = await api.countries({
      continent: continent.value,
      q: q.value,
      includeDrafts: includeDrafts.value && auth.authed ? 'true' : undefined,
      limit: 2000,
    });
    countries.value = r.items;
  } catch {
    // 离线兜底：从本地离线包读取
    const cs = (await offline.countries()) as any[];
    let list = cs;
    if (continent.value) list = list.filter((c) => c.continent === continent.value);
    if (q.value) {
      const kw = q.value.toLowerCase();
      list = list.filter((c) =>
        [c.name_zh, c.name_en, c.capital_zh, c.capital_en, c.continent].filter(Boolean).join(' ').toLowerCase().includes(kw)
      );
    }
    list = list.map((c) => ({ ...c, status: 'published' }));
    countries.value = list as any;
  } finally {
    loading.value = false;
  }
}, { immediate: true });
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">{{ t('countries.title') }} <span class="text-sm font-normal text-slate-400">({{ sorted.length }})</span></h1>

    <div class="flex flex-wrap gap-2 items-center">
      <select
        :value="continent"
        class="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        @change="setQuery({ continent: ($event.target as HTMLSelectElement).value })"
      >
        <option value="">{{ t('common.allContinents') }}</option>
        <option v-for="c in CONTINENTS" :key="c.zh" :value="c.zh">{{ c.zh }}</option>
      </select>

      <select
        :value="sort"
        class="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        @change="setQuery({ sort: ($event.target as HTMLSelectElement).value })"
      >
        <option value="name">{{ t('common.sortByName') }}</option>
        <option value="population">{{ t('common.sortByPopulation') }}</option>
        <option value="area">{{ t('common.sortByArea') }}</option>
      </select>

      <button
        class="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        @click="setQuery({ order: order === 'asc' ? 'desc' : 'asc' })"
      >
        {{ order === 'asc' ? t('common.ascending') : t('common.descending') }}
      </button>

      <label v-if="auth.authed" class="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          :checked="includeDrafts"
          class="accent-indigo-600"
          @change="setQuery({ includeDrafts: ($event.target as HTMLInputElement).checked ? 'true' : undefined })"
        />
        {{ t('countries.includeDrafts') }}
      </label>
    </div>

    <div v-if="loading" class="py-16 text-center text-slate-400">Loading…</div>

    <div v-else-if="visibleItems.length" class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <CountryCard v-for="c in visibleItems" :key="c.slug" :country="c" />
    </div>
    <div v-else class="py-16 text-center text-slate-400">{{ t('common.noResults') }}</div>

    <div v-if="visible < sorted.length" class="text-center">
      <button
        class="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
        @click="visible += 30"
      >
        {{ t('common.loadMore') }} ({{ sorted.length - visible }})
      </button>
    </div>
  </div>
</template>
