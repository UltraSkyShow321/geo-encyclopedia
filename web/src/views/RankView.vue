<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { api, type CountrySummary } from '../api';
import EChart from '../components/EChart.vue';
import { formatNumber, formatArea, CONTINENTS } from '../utils/format';

const { t, locale } = useI18n();
const countries = ref<CountrySummary[]>([]);
const tab = ref<'population' | 'area'>('population');

onMounted(async () => {
  const r = await api.countries({ limit: 2000 });
  countries.value = r.items;
});

const sortedTop = computed(() => {
  const key = tab.value === 'population' ? 'population' : 'area_km2';
  return [...countries.value].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0)).slice(0, 20);
});

const barOption = computed(() => {
  const fmt = (v: number) => (tab.value === 'population' ? formatNumber(v, locale.value) : formatArea(v, locale.value));
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: sortedTop.value.map((c) => c.name_zh),
      axisLabel: { interval: 0, rotate: 45, fontSize: 10 },
    },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => fmt(v) } },
    series: [
      {
        type: 'bar',
        data: sortedTop.value.map((c, i) => ({
          value: tab.value === 'population' ? c.population : c.area_km2,
          itemStyle: { color: i < 3 ? '#f59e0b' : '#6366f1', borderRadius: [3, 3, 0, 0] },
        })),
        barMaxWidth: 28,
      },
    ],
  };
});

const scatterOption = computed(() => {
  const data = countries.value
    .filter((c) => c.population && c.area_km2)
    .map((c) => ({
      value: [c.area_km2!, c.population!],
      name: c.name_zh!,
      continent: c.continent,
    }));
  const colors: Record<string, string> = {
    亚洲: '#f59e0b', 非洲: '#ef4444', 欧洲: '#3b82f6',
    北美洲: '#10b981', 南美洲: '#8b5cf6', 大洋洲: '#06b6d4', 南极洲: '#64748b',
  };
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const d = data[p.dataIndex];
        return `${d.name}<br/>${t('common.area')}: ${formatArea(d.value[0], locale.value)}<br/>${t('common.population')}: ${formatNumber(d.value[1], locale.value)}`;
      },
    },
    grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'log', name: 'km²', axisLabel: { formatter: (v: number) => formatNumber(v, locale.value) } },
    yAxis: { type: 'log', name: t('common.population'), axisLabel: { formatter: (v: number) => formatNumber(v, locale.value) } },
    series: [
      {
        type: 'scatter',
        data: data.map((d) => ({ ...d, itemStyle: { color: colors[d.continent ?? ''] || '#94a3b8', opacity: 0.8 } })),
        symbolSize: 8,
        emphasis: { itemStyle: { borderColor: '#000', borderWidth: 1 } },
      },
    ],
  };
});

const pieOption = computed(() => {
  const totals = new Map<string, number>();
  for (const c of countries.value) {
    if (!c.population) continue;
    const name = c.continent || '其他';
    totals.set(name, (totals.get(name) || 0) + c.population!);
  }
  const colors: Record<string, string> = {
    亚洲: '#f59e0b', 非洲: '#ef4444', 欧洲: '#3b82f6',
    北美洲: '#10b981', 南美洲: '#8b5cf6', 大洋洲: '#06b6d4', 南极洲: '#64748b',
  };
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['35%', '65%'],
        center: ['50%', '42%'],
        data: [...totals.entries()].map(([name, value]) => ({
          name,
          value,
          itemStyle: { color: colors[name] || '#94a3b8' },
        })),
        label: { formatter: (p: any) => `${p.name}\n${formatNumber(p.value, locale.value)}` },
      },
    ],
  };
});

const tableRows = computed(() => {
  const key = tab.value === 'population' ? 'population' : 'area_km2';
  return [...countries.value]
    .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
    .slice(0, 20)
    .map((c, i) => ({
      rank: i + 1,
      ...c,
      value: key === 'population' ? formatNumber(c.population, locale.value) : formatArea(c.area_km2, locale.value),
    }));
});
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">{{ t('ranks.title') }}</h1>

    <div class="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden text-sm w-fit">
      <button
        class="px-5 py-2"
        :class="tab === 'population' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'"
        @click="tab = 'population'"
      >
        {{ t('ranks.population') }}
      </button>
      <button
        class="px-5 py-2"
        :class="tab === 'area' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'"
        @click="tab = 'area'"
      >
        {{ t('ranks.area') }}
      </button>
    </div>

    <div class="grid lg:grid-cols-2 gap-4">
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 class="text-sm font-semibold mb-2">{{ t('ranks.topLabel') }} — {{ tab === 'population' ? t('ranks.population') : t('ranks.area') }}</h2>
        <EChart :option="barOption" height="420px" />
      </div>
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 class="text-sm font-semibold mb-2">{{ t('ranks.topLabel') }}</h2>
        <div class="overflow-y-auto max-h-[420px]">
          <RouterLink
            v-for="row in tableRows"
            :key="row.slug"
            :to="`/countries/${row.slug}`"
            class="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span class="w-7 text-right text-sm font-semibold text-slate-400">{{ row.rank }}</span>
            <span class="text-xl leading-none">{{ row.flag_emoji || '🌐' }}</span>
            <span class="flex-1 text-sm font-medium">{{ row.name_zh }}</span>
            <span class="text-sm text-slate-500">{{ row.value }}</span>
          </RouterLink>
        </div>
      </div>
    </div>

    <div class="grid lg:grid-cols-2 gap-4">
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 class="text-sm font-semibold mb-2">{{ t('ranks.popVsArea') }}</h2>
        <EChart :option="scatterOption" height="380px" />
      </div>
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 class="text-sm font-semibold mb-2">{{ t('ranks.continentShare') }}</h2>
        <EChart :option="pieOption" height="380px" />
      </div>
    </div>
  </div>
</template>
