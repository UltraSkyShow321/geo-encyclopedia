<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { api, type Card } from '../api';

const { t } = useI18n();

const due = ref<Card[]>([]);
const all = ref<Card[]>([]);
const flipped = ref(false);
const currentIndex = ref(0);
const showAll = ref(false);
const showForm = ref(false);
const newQuestion = ref('');
const newAnswer = ref('');
const newSlug = ref('');
const countries = ref<{ slug: string; name_zh: string }[]>([]);
const busy = ref(false);

const current = computed(() => due.value[currentIndex.value]);

async function load() {
  const r = await api.cards();
  due.value = r.due;
  all.value = r.all;
  currentIndex.value = 0;
  flipped.value = false;
}

async function review(correct: boolean) {
  if (!current.value) return;
  busy.value = true;
  try {
    await api.reviewCard(current.value.id, correct);
    due.value.splice(currentIndex.value, 1);
    flipped.value = false;
    if (currentIndex.value >= due.value.length) currentIndex.value = 0;
  } finally {
    busy.value = false;
  }
  await load();
}

async function addCard() {
  if (!newQuestion.value.trim() || !newAnswer.value.trim()) return;
  await api.addCard(newQuestion.value.trim(), newAnswer.value.trim(), newSlug.value || undefined);
  newQuestion.value = '';
  newAnswer.value = '';
  newSlug.value = '';
  showForm.value = false;
  await load();
}

async function removeCard(id: number) {
  await api.deleteCard(id);
  await load();
}

async function clearAll() {
  if (!confirm(t('cards.clearAll') + '?')) return;
  await api.clearCards();
  await load();
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

onMounted(async () => {
  await load();
  const r = await api.countries({ sort: 'name', limit: 2000 });
  countries.value = r.items.map((c) => ({ slug: c.slug, name_zh: c.name_zh || c.slug }));
});
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">🎴 {{ t('cards.title') }}</h1>
      <div class="text-sm text-slate-500">
        {{ t('cards.dueToday') }}: <span class="font-semibold text-amber-600">{{ due.length }}</span>
        · {{ t('cards.total') }}: {{ all.length }}
      </div>
    </div>

    <div v-if="due.length" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 min-h-[240px] flex flex-col justify-between">
      <div class="text-xs text-slate-400 mb-3">{{ currentIndex + 1 }} / {{ due.length }}</div>
      <div class="flex-1 flex items-center justify-center text-center cursor-pointer select-none" @click="flipped = !flipped">
        <p v-if="!flipped" class="text-xl font-semibold">{{ current.question }}</p>
        <p v-else class="text-lg text-indigo-600 dark:text-indigo-300">{{ current.answer }}</p>
      </div>
      <div class="text-center text-xs text-slate-400 mt-4">{{ t('cards.flip') }}</div>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <button class="py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50" :disabled="busy" @click="review(false)">
          ✕ {{ t('cards.forgot') }}
        </button>
        <button class="py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50" :disabled="busy" @click="review(true)">
          ✓ {{ t('cards.remembered') }}
        </button>
      </div>
    </div>
    <div v-else class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-slate-400">
      {{ t('cards.none') }}
    </div>

    <div class="flex gap-2">
      <button class="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700" @click="showForm = !showForm">
        + {{ t('cards.addCard') }}
      </button>
      <button class="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm" @click="showAll = !showAll">
        {{ t('cards.total') }} ({{ all.length }})
      </button>
      <button v-if="all.length" class="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-500 text-sm" @click="clearAll">
        {{ t('cards.clearAll') }}
      </button>
    </div>

    <form v-if="showForm" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3" @submit.prevent="addCard">
      <input v-model="newQuestion" class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm" :placeholder="t('cards.question')" />
      <input v-model="newAnswer" class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm" :placeholder="t('cards.answer')" />
      <select v-model="newSlug" class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <option value="">{{ t('cards.linkedCountry') }}</option>
        <option v-for="c in countries" :key="c.slug" :value="c.slug">{{ c.name_zh }}</option>
      </select>
      <button class="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">{{ t('cards.add') }}</button>
    </form>

    <div v-if="showAll" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
      <div v-if="!all.length" class="p-8 text-center text-sm text-slate-400">{{ t('cards.empty') }}</div>
      <div v-for="c in all" :key="c.id" class="flex items-start gap-3 p-3.5">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium">{{ c.question }}</p>
          <p class="text-xs text-slate-500 mt-0.5 line-clamp-1">{{ c.answer }}</p>
          <p class="text-[11px] text-slate-400 mt-1">
            {{ t('cards.nextReview') }}: {{ fmtDate(c.next_review) }}
            <span v-if="c.interval_days"> · {{ c.interval_days }}d</span>
          </p>
        </div>
        <button class="text-xs text-red-400 hover:text-red-600" @click="removeCard(c.id)">{{ t('cards.delete') }}</button>
      </div>
    </div>
  </div>
</template>
