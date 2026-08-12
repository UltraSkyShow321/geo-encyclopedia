<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <footer class="border-t border-slate-200 dark:border-slate-800 mt-12">
    <div class="max-w-6xl mx-auto px-4 py-8 text-sm text-slate-500 dark:text-slate-400 space-y-1">
      <p>{{ t('footer.about') }}</p>
      <p>{{ t('footer.api') }}</p>
      <p class="text-xs text-slate-400 dark:text-slate-500">Geo-Encyclopedia · v0.1</p>
    </div>
  </footer>
</template>
