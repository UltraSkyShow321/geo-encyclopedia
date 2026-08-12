<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CountrySummary } from '../api';
import { formatNumber, formatArea } from '../utils/format';

const props = defineProps<{ country: CountrySummary }>();
const { t, locale } = useI18n();

const population = computed(() => formatNumber(props.country.population, locale.value));
const area = computed(() => formatArea(props.country.area_km2, locale.value));
</script>

<template>
  <RouterLink
    :to="`/countries/${country.slug}`"
    class="group block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition"
  >
    <div class="flex items-start justify-between">
      <span class="text-4xl leading-none select-none">{{ country.flag_emoji || '🌐' }}</span>
      <span
        v-if="country.status !== 'published'"
        class="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5"
      >
        {{ t('common.statusDraft') }}
      </span>
    </div>
    <h3 class="mt-3 font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
      {{ country.name_zh }}
    </h3>
    <p class="text-xs text-slate-500 dark:text-slate-400">{{ country.name_en }}</p>
    <div class="mt-3 flex flex-wrap gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
      <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{{ country.continent }}</span>
      <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{{ t('common.capital') }} {{ country.capital_zh }}</span>
    </div>
    <dl class="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
      <div>
        <dt>{{ t('common.population') }}</dt>
        <dd class="text-sm font-medium text-slate-800 dark:text-slate-200">{{ population }}</dd>
      </div>
      <div>
        <dt>{{ t('common.area') }}</dt>
        <dd class="text-sm font-medium text-slate-800 dark:text-slate-200">{{ area }}</dd>
      </div>
    </dl>
  </RouterLink>
</template>
