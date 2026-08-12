<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '../api';

const { t } = useI18n();
const route = useRoute();
const topic = ref<any>(null);
const notFound = ref(false);

onMounted(async () => {
  try {
    topic.value = await api.topic(String(route.params.slug));
    document.title = topic.value.title_zh;
  } catch {
    notFound.value = true;
  }
});
</script>

<template>
  <div v-if="notFound" class="py-20 text-center text-slate-400">{{ t('common.noResults') }}</div>
  <div v-else-if="topic" class="space-y-6 max-w-4xl">
    <div v-if="topic.status !== 'published'" class="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
      {{ t('common.draftBanner') }}
    </div>
    <div>
      <div class="text-xs text-slate-400 mb-1">{{ t('topics.' + (topic.category || 'other')) }}</div>
      <h1 class="text-3xl font-bold">{{ topic.title_zh }}</h1>
      <p class="text-slate-500 dark:text-slate-400">{{ topic.title_en }}</p>
    </div>

    <article class="prose prose-slate dark:prose-invert max-w-none" v-html="topic.bodyHtml"></article>

    <section v-if="topic.countries?.length">
      <h2 class="text-lg font-semibold mb-3">{{ t('common.relatedCountries') }}</h2>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          v-for="c in topic.countries"
          :key="c.slug"
          :to="`/countries/${c.slug}`"
          class="px-3 py-1.5 rounded-full text-sm bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
        >
          {{ c.flag_emoji }} {{ c.name_zh }}
        </RouterLink>
      </div>
    </section>

    <section v-if="topic.relatedTopics?.length">
      <h2 class="text-lg font-semibold mb-3">{{ t('common.relatedTopics') }}</h2>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          v-for="rt in topic.relatedTopics"
          :key="rt.slug"
          :to="`/topics/${rt.slug}`"
          class="px-3 py-1.5 rounded-lg text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
        >
          {{ rt.title_zh }}
        </RouterLink>
      </div>
    </section>
  </div>
</template>
