<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import WorldMap from '../components/WorldMap.vue';

const { t } = useI18n();
type Metric = 'continent' | 'population' | 'area';
const metric = ref<Metric>('continent');

const metrics = [
  { key: 'continent', label: t('map.byContinent') },
  { key: 'population', label: t('map.byPopulation') },
  { key: 'area', label: t('map.byArea') },
] as { key: Metric; label: string }[];
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">{{ t('map.title') }}</h1>
      <div class="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden text-sm">
        <button
          v-for="m in metrics"
          :key="m.key"
          class="px-4 py-2"
          :class="metric === m.key
            ? 'bg-indigo-600 text-white'
            : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'"
          @click="metric = m.key"
        >
          {{ m.label }}
        </button>
      </div>
    </div>
    <WorldMap :metric="metric" show-basemap-switcher height="calc(100vh - 200px)" />
  </div>
</template>
