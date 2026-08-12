<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api, type CountryDetail } from '../api';
import EChart from '../components/EChart.vue';
import WorldMap from '../components/WorldMap.vue';
import { formatNumber, formatArea } from '../utils/format';
import { useAuthStore } from '../stores/auth';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const country = ref<CountryDetail | null>(null);
const notFound = ref(false);
const siblings = ref<any[]>([]);
const relatedTopics = ref<any[]>([]);
const isFav = ref(false);
const note = ref('');
const noteSaved = ref(false);
const saving = ref(false);

const fields = computed(() => {
  const c = country.value!;
  return [
    { label: t('common.capital'), value: c.capital_zh ? `${c.capital_zh} (${c.capital_en})` : '' },
    { label: t('common.population'), value: formatNumber(c.population, locale.value) },
    { label: t('common.area'), value: formatArea(c.area_km2, locale.value) },
    { label: t('common.currency'), value: c.currency_zh },
    { label: t('common.language'), value: c.official_language_zh },
    { label: t('common.government'), value: c.government_zh },
    { label: t('common.timezone'), value: c.timezone },
    { label: t('common.iso'), value: [c.iso_alpha2, c.iso_alpha3, c.iso_numeric].filter(Boolean).join(' · ') },
  ].filter((f) => f.value);
});

const siblingChart = computed(() => {
  const c = country.value!;
  if (!siblings.value.length) return {};
  const list = [...siblings.value].sort((a, b) => (b.population ?? 0) - (a.population ?? 0)).slice(0, 10);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: list.map((x) => x.name_zh), axisLabel: { interval: 0, rotate: 40, fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatNumber(v, locale.value) } },
    series: [
      {
        type: 'bar',
        data: list.map((x) => ({
          value: x.population,
          itemStyle: { color: x.slug === c.slug ? '#f59e0b' : '#6366f1', borderRadius: [3, 3, 0, 0] },
        })),
        barMaxWidth: 30,
      },
    ],
  };
});

async function toggleFavorite() {
  if (!auth.authed) {
    router.push({ name: 'login', query: { next: route.fullPath } });
    return;
  }
  if (isFav.value) {
    await api.deleteFavorite(country.value!.slug);
    isFav.value = false;
  } else {
    await api.putFavorite(country.value!.slug, note.value);
    isFav.value = true;
  }
}

async function saveNote() {
  if (!country.value) return;
  saving.value = true;
  try {
    await api.putFavorite(country.value.slug, note.value);
    isFav.value = true;
    noteSaved.value = true;
    setTimeout(() => (noteSaved.value = false), 1500);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    const c = await api.country(String(route.params.slug));
    country.value = c;
    document.title = `${c.name_zh} - ${c.name_en}`;
    if (c.favorites) {
      isFav.value = true;
      note.value = c.favorites.note;
    }
    const [sib, tops] = await Promise.all([
      api.countries({ continent: c.continent, limit: 2000 }),
      api.topics(),
    ]);
    siblings.value = sib.items;
    relatedTopics.value = tops.categories
      .flatMap((cat) => cat.items)
      .filter((tp: any) => (tp as any).related_countries?.includes(c.slug));
  } catch {
    notFound.value = true;
  }
});
</script>

<template>
  <div v-if="notFound" class="py-20 text-center text-slate-400">
    {{ t('common.noResults') }}
    <RouterLink :to="`/countries`" class="block mt-3 text-indigo-500">{{ t('common.back') }}</RouterLink>
  </div>

  <div v-else-if="country" class="space-y-8">
    <div v-if="country.status !== 'published'" class="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
      {{ t('common.draftBanner') }}
    </div>

    <section class="flex flex-wrap items-start gap-5">
      <span class="text-7xl leading-none select-none">{{ country.flag_emoji || '🌐' }}</span>
      <div class="flex-1 min-w-[220px]">
        <h1 class="text-3xl font-bold">{{ country.name_zh }}</h1>
        <p class="text-slate-500 dark:text-slate-400">{{ country.name_en }}</p>
        <div class="mt-2 flex flex-wrap gap-2 text-xs">
          <span class="px-2.5 py-1 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">{{ country.continent }}</span>
          <span v-if="country.un_member" class="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800">{{ t('common.unMember') }}</span>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          class="px-4 py-2 rounded-lg text-sm border"
          :class="isFav
            ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
            : 'border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'"
          @click="toggleFavorite"
        >
          {{ isFav ? t('common.unfavorite') : t('common.favorite') }}
        </button>
      </div>
    </section>

    <section class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div v-for="f in fields" :key="f.label" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
        <div class="text-xs text-slate-500">{{ f.label }}</div>
        <div class="mt-1 text-sm font-medium">{{ f.value }}</div>
      </div>
    </section>

    <section v-if="auth.authed" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h2 class="text-sm font-semibold mb-2">{{ t('common.note') }}</h2>
      <textarea
        v-model="note"
        rows="3"
        class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        :placeholder="t('common.note')"
      ></textarea>
      <div class="mt-2 flex items-center gap-3">
        <button class="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50" :disabled="saving" @click="saveNote">
          {{ t('common.saveNote') }}
        </button>
        <span v-if="noteSaved" class="text-sm text-emerald-600">{{ t('common.saved') }}</span>
      </div>
    </section>

    <section>
      <h2 class="text-xl font-semibold mb-3">{{ t('common.locationOnMap') }}</h2>
      <WorldMap metric="continent" :highlight="country.iso_numeric" zoom-to-highlight height="420px" />
    </section>

    <section>
      <h2 class="text-xl font-semibold mb-3">{{ t('common.statistics') }}</h2>
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <EChart :option="siblingChart" height="320px" />
      </div>
    </section>

    <article class="prose prose-slate dark:prose-invert max-w-none" v-html="country.bodyHtml"></article>

    <section v-if="country.neighbors?.length" class="flex flex-wrap gap-2 items-center">
      <span class="text-sm text-slate-500 mr-1">{{ t('common.neighbors') }}:</span>
      <template v-for="n in country.neighbors" :key="n">
        <RouterLink :to="`/countries/${n}`" class="px-3 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
          {{ n.toUpperCase() }}
        </RouterLink>
      </template>
    </section>

    <section v-if="relatedTopics.length">
      <h2 class="text-xl font-semibold mb-3">{{ t('common.relatedTopics') }}</h2>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          v-for="tp in relatedTopics"
          :key="tp.slug"
          :to="`/topics/${tp.slug}`"
          class="px-3 py-1.5 rounded-lg text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
        >
          {{ tp.title_zh }}
        </RouterLink>
      </div>
    </section>
  </div>
</template>
