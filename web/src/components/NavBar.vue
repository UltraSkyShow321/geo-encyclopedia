<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { api } from '../api';
import SearchBox from './SearchBox.vue';

const { t, locale } = useI18n();
const auth = useAuthStore();
const theme = useThemeStore();
const router = useRouter();
const drafts = ref(0);
const menuOpen = ref(false);

const links = computed(() => [
  { to: '/countries', label: t('nav.countries') },
  { to: '/topics', label: t('nav.topics') },
  { to: '/map', label: t('nav.map') },
  { to: '/ranks', label: t('nav.ranks') },
  { to: '/quiz', label: t('nav.quiz') },
]);

async function refreshDrafts() {
  if (!auth.authed) {
    drafts.value = 0;
    return;
  }
  try {
    const meta = await api.meta();
    drafts.value = meta.totalDrafts;
  } catch {
    /* ignore */
  }
}

onMounted(async () => {
  theme.apply();
  await refreshDrafts();
});

watch(() => auth.authed, refreshDrafts);

function switchLang() {
  locale.value = locale.value === 'zh' ? 'en' : 'zh';
  localStorage.setItem('geo-lang', locale.value);
  document.documentElement.lang = locale.value;
}

async function logout() {
  await auth.logout();
  router.push('/');
}

function go(path: string) {
  menuOpen.value = false;
  router.push(path);
}
</script>

<template>
  <header class="sticky top-0 z-[1000] backdrop-blur bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
    <div class="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
      <RouterLink to="/" class="flex items-center gap-2 shrink-0" @click="menuOpen = false">
        <svg class="w-7 h-7 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm7.9 9h-3.1A13.6 13.6 0 0 0 15 5.2 8.05 8.05 0 0 1 19.9 11zM12 4c.9 1.2 1.7 3.1 2.1 5H9.9c.4-1.9 1.2-3.8 2.1-5zM4.1 11h3.1c.2-2.2.7-4.1 1.8-5.8A8.05 8.05 0 0 0 4.1 11zm0 2a8.05 8.05 0 0 0 4.9 5.8C7.9 17.1 7.4 15.2 7.2 13H4.1zm3.1 0c.2 2.2.7 4.1 1.8 5.8a8.05 8.05 0 0 0 0-11.6C7.9 8.9 7.4 10.8 7.2 13zm4.8 7c-.9-1.2-1.7-3.1-2.1-5h4.2c-.4 1.9-1.2 3.8-2.1 5zm2.6-7h-5.2c.2-2.2.7-4.1 1.8-5.8a9.6 9.6 0 0 1 1.6 0c1.1 1.7 1.6 3.6 1.8 5.8zm.2 5.8c1.1-1.7 1.6-3.6 1.8-5.8h3.1a8.05 8.05 0 0 1-4.9 5.8zM15 11c-.2-2.2-.7-4.1-1.8-5.8-.5-.1-1.1-.1-1.6 0C10.5 6.9 10 8.8 9.8 11H15z" />
        </svg>
        <span class="font-bold hidden sm:block">{{ t('home.heroTitle') }}</span>
      </RouterLink>

      <div class="hidden md:flex items-center gap-1">
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="px-2.5 py-1.5 rounded-md text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          active-class="text-indigo-600 dark:text-indigo-400 font-semibold"
        >
          {{ l.label }}
        </RouterLink>
      </div>

      <div class="flex-1 hidden md:flex justify-end">
        <SearchBox />
      </div>

      <div class="flex items-center gap-1 ml-auto md:ml-0">
        <button
          class="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          :title="theme.isDark ? t('login.title') : ''"
          @click="theme.cycle()"
        >
          <svg v-if="theme.isDark" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36l-.7-.7M6.34 6.34l-.7-.7m12.02 0l-.7.7M6.34 17.66l-.7.7M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.35 15.54A8.5 8.5 0 1111.46 3.65a7 7 0 008.89 11.9z" />
          </svg>
        </button>
        <button
          class="px-2 py-1.5 rounded-md text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          @click="switchLang"
        >
          {{ locale === 'zh' ? 'EN' : '中文' }}
        </button>
        <RouterLink
          v-if="auth.authed"
          to="/favorites"
          class="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {{ t('nav.favorites') }}
          <span v-if="drafts > 0" class="ml-1 text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5">
            {{ t('nav.drafts') }} {{ drafts }}
          </span>
        </RouterLink>
        <button
          v-if="auth.authed"
          class="px-2.5 py-1.5 rounded-md text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          @click="logout"
        >
          {{ t('nav.logout') }}
        </button>
        <RouterLink
          v-else
          to="/login"
          class="px-3 py-1.5 rounded-md text-sm bg-indigo-600 text-white hover:bg-indigo-700"
        >
          {{ t('nav.login') }}
        </RouterLink>
        <button class="md:hidden p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" @click="menuOpen = !menuOpen">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path v-if="!menuOpen" stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
            <path v-else stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="menuOpen" class="md:hidden border-t border-slate-200 dark:border-slate-800 px-4 py-3 space-y-1 bg-white dark:bg-slate-950">
      <div class="flex md:hidden pb-2">
        <SearchBox />
      </div>
      <button v-for="l in links" :key="l.to" class="block w-full text-left px-2 py-2 rounded-md text-sm hover:bg-slate-100 dark:hover:bg-slate-800" @click="go(l.to)">
        {{ l.label }}
      </button>
      <button class="block w-full text-left px-2 py-2 rounded-md text-sm hover:bg-slate-100 dark:hover:bg-slate-800" @click="go(auth.authed ? '/favorites' : '/login')">
        {{ t('nav.favorites') }}
      </button>
    </div>
  </header>
</template>
