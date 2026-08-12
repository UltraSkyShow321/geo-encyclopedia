<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';

const { t } = useI18n();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const password = ref('');
const error = ref(false);
const busy = ref(false);

async function submit() {
  busy.value = true;
  error.value = false;
  try {
    await auth.login(password.value);
    const next = String(route.query.next || '/');
    router.push(next);
  } catch {
    error.value = true;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="max-w-sm mx-auto py-16">
    <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 space-y-5">
      <div class="text-center">
        <div class="text-4xl">🔐</div>
        <h1 class="text-xl font-bold mt-3">{{ t('login.title') }}</h1>
        <p class="text-xs text-slate-500 mt-1.5">{{ t('login.hint') }}</p>
      </div>
      <form class="space-y-3" @submit.prevent="submit">
        <input
          v-model="password"
          type="password"
          autofocus
          class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          :placeholder="t('login.password')"
        />
        <p v-if="error" class="text-sm text-red-500">{{ t('login.error') }}</p>
        <button class="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50" :disabled="busy || !password">
          {{ t('login.submit') }}
        </button>
      </form>
    </div>
  </div>
</template>
