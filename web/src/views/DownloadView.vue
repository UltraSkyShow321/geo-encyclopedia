<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const RELEASE = 'https://github.com/UltraSkyShow321/geo-encyclopedia/releases/latest/download';

const platforms = [
  {
    id: 'android', icon: '🤖', name: 'Android', status: 'ready',
    noteKey: 'download.androidNote', stepsKey: 'download.androidSteps',
    link: `${RELEASE}/geo-encyclopedia-v1.0.0-android.apk`,
  },
  {
    id: 'windows', icon: '🪟', name: 'Windows（安装版）', status: 'ready',
    noteKey: 'download.windowsNote', stepsKey: 'download.windowsSteps',
    link: `${RELEASE}/geo-encyclopedia-v1.0.0-win-setup.exe`,
    alt: `${RELEASE}/geo-encyclopedia-v1.0.0-win-portable.exe`,
  },
  {
    id: 'windowsZip', icon: '📦', name: 'Windows（免安装 zip）', status: 'ready',
    noteKey: 'download.windowsZipNote', stepsKey: 'download.windowsZipSteps',
    link: `${RELEASE}/geo-encyclopedia-v1.0.0-win-portable.zip`,
  },
  {
    id: 'ios', icon: '🍎', name: 'iOS', status: 'pwa',
    noteKey: 'download.iosNote', stepsKey: 'download.iosSteps', link: '',
  },
  {
    id: 'macos', icon: '💻', name: 'macOS', status: 'pwa',
    noteKey: 'download.macosNote', stepsKey: 'download.macosSteps', link: '',
  },
  {
    id: 'harmony', icon: '🌺', name: 'HarmonyOS', status: 'hybrid',
    noteKey: 'download.harmonyNote', stepsKey: 'download.harmonySteps',
    link: `${RELEASE}/geo-encyclopedia-v1.0.0-android.apk`,
  },
  {
    id: 'pwa', icon: '🌐', name: 'PWA', status: 'ready',
    noteKey: 'download.pwaNote', stepsKey: 'download.pwaSteps', link: '',
  },
];

const statusLabel = computed<Record<string, string>>(() => ({
  ready: t('download.statusReady'),
  pwa: t('download.statusPwa'),
  hybrid: t('download.statusHybrid'),
}));

const steps = (key: string) => t(key).split('\n').filter((s) => s.trim());
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">📥 {{ t('download.title') }}</h1>
      <p class="text-sm text-slate-500 mt-1">{{ t('download.subtitle') }}</p>
    </div>

    <div class="grid sm:grid-cols-2 gap-4">
      <div v-for="p in platforms" :key="p.id" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <div class="flex items-center gap-3">
          <span class="text-3xl leading-none">{{ p.icon }}</span>
          <div class="flex-1">
            <h2 class="font-semibold">{{ p.name }}</h2>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap"
            :class="p.status === 'ready' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
              : p.status === 'hybrid' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'">
            {{ statusLabel[p.status] }}
          </span>
        </div>
        <p class="text-sm text-slate-500">{{ t(p.noteKey) }}</p>
        <a v-if="p.link" :href="p.link" target="_blank" class="block text-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          {{ t('download.download') }}
        </a>
        <a v-if="p.alt" :href="p.alt" target="_blank" class="block text-center px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
          {{ t('download.altDownload') }}
        </a>
        <ol class="text-xs text-slate-400 list-decimal pl-4 space-y-1">
          <li v-for="(s, i) in steps(p.stepsKey)" :key="i">{{ s }}</li>
        </ol>
      </div>
    </div>
  </div>
</template>
