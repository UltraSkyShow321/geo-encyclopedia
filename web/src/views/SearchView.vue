<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api, type SearchResult } from '../api';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const q = ref(String(route.query.q || ''));
const results = ref<SearchResult[]>([]);
const total = ref(0);
const searching = ref(false);

const countries = computed(() => results.value.filter((r) => r.type === 'country'));
const topics = computed(() => results.value.filter((r) => r.type === 'topic'));

watch(q, (val) => {
  router.replace({ path: '/search', query: val.trim() ? { q: val.trim() } : {} });
});

watch(
  () => route.query.q,
  async (val) => {
    const keyword = String(val || '').trim();
    if (!keyword) {
      results.value = [];
      total.value = 0;
      return;
    }
    searching.value = true;
    try {
      const r = await api.search(keyword);
      results.value = r.results;
      total.value = r.total;
    } finally {
      searching.value = false;
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">
        {{ t('search.title') }} <span v-if="q.trim()" class="text-base font-normal text-slate-400">{{ t('search.for') }} “{{ q }}”</span>
      </h1>
      <input
        v-model="q"
        type="search"
        autofocus
        class="mt-3 w-full max-w-lg px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        :placeholder="t('nav.searchPlaceholder')"
      />
    </div>

    <div v-if="searching" class="py-16 text-center text-slate-400">Loading…</div>

    <template v-else-if="results.length">
      <section v-if="countries.length">
        <h2 class="text-sm font-semibold text-slate-500 mb-2">{{ t('search.countries') }} ({{ countries.length }})</h2>
        <div class="space-y-2">
          <RouterLink
            v-for="r in countries"
            :key="r.slug"
            :to="`/countries/${r.slug}`"
            class="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl leading-none">{{ r.flag_emoji || '🌐' }}</span>
              <div>
                <div class="font-semibold">{{ r.title_zh }} <span class="text-xs text-slate-400">{{ r.title_en }}</span></div>
                <div class="text-xs text-slate-500 mt-0.5 line-clamp-2">{{ r.excerpt }}</div>
              </div>
            </div>
          </RouterLink>
        </div>
      </section>

      <section v-if="topics.length">
        <h2 class="text-sm font-semibold text-slate-500 mb-2">{{ t('search.topics') }} ({{ topics.length }})</h2>
        <div class="space-y-2">
          <RouterLink
            v-for="r in topics"
            :key="r.slug"
            :to="`/topics/${r.slug}`"
            class="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition"
          >
            <div class="font-semibold">{{ r.title_zh }} <span class="text-xs text-slate-400">{{ r.title_en }}</span></div>
            <div class="text-xs text-slate-500 mt-0.5 line-clamp-2">{{ r.excerpt }}</div>
          </RouterLink>
        </div>
      </section>
    </template>

    <div v-else-if="q.trim()" class="py-16 text-center text-slate-400">{{ t('common.noResults') }}</div>
  </div>
</template>
