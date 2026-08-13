<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '../api';
import WorldMap from '../components/WorldMap.vue';

const { t } = useI18n();

const countries = ref<{ slug: string; name: string }[]>([]);
const countryFilter = ref('');
const selectedSlug = ref('');
const mapRef = ref<InstanceType<typeof WorldMap>>();

const filteredCountries = computed(() => {
  const q = countryFilter.value.trim();
  if (!q) return countries.value.slice(0, 30);
  return countries.value.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
});

function jump() {
  if (!selectedSlug.value) return;
  mapRef.value?.focusCountry(selectedSlug.value);
  countryFilter.value = '';
  selectedSlug.value = '';
}

onMounted(async () => {
  try {
    const r = await api.countries({ sort: 'name', limit: 2000 });
    countries.value = r.items.map((c) => ({ slug: c.slug, name: c.name_zh || c.slug }));
  } catch {
    /* ignore */
  }
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">🌍 {{ t('map.title') }}</h1>
      <div class="relative">
        <input
          v-model="countryFilter"
          type="text"
          list="country-options"
          :placeholder="t('map.jumpCountry')"
          class="w-56 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          @change="selectedSlug = countryFilter ? countryFilter : selectedSlug"
        />
        <datalist id="country-options">
          <option v-for="c in filteredCountries" :key="c.slug" :value="c.name" />
        </datalist>
        <button
          class="absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs"
          @click="jump"
        >
          {{ t('map.go') }}
        </button>
      </div>
    </div>

    <WorldMap ref="mapRef" show-basemap-switcher height="calc(100vh - 200px)" />
  </div>
</template>
