<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { api, type QuizQuestion } from '../api';
import { CONTINENTS } from '../utils/format';

const { t } = useI18n();

const continents = ['', ...CONTINENTS.map((c) => c.zh)];
const continent = ref('');
const count = ref(8);
const started = ref(false);
const finished = ref(false);
const questions = ref<QuizQuestion[]>([]);
const index = ref(0);
const selected = ref<number | null>(null);
const correctCount = ref(0);
const wrongQuestions = ref<QuizQuestion[]>([]);
const addedToCards = ref(false);

async function start() {
  const r = await api.quiz(continent.value, count.value);
  questions.value = r.questions;
  index.value = 0;
  selected.value = null;
  correctCount.value = 0;
  wrongQuestions.value = [];
  finished.value = false;
  addedToCards.value = false;
  started.value = true;
}

function choose(i: number) {
  if (selected.value !== null) return;
  selected.value = i;
  if (i === questions.value[index.value].answerIndex) {
    correctCount.value++;
  } else {
    wrongQuestions.value.push(questions.value[index.value]);
  }
}

function next() {
  if (index.value + 1 >= questions.value.length) {
    finished.value = true;
    started.value = false;
    return;
  }
  index.value++;
  selected.value = null;
}

async function addWrongToCards() {
  for (const q of wrongQuestions.value) {
    await api.addCard(q.question, q.fact);
  }
  addedToCards.value = true;
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">🧭 {{ t('quiz.title') }}</h1>
      <p class="text-sm text-slate-500 mt-1">{{ t('quiz.subtitle') }}</p>
    </div>

    <div v-if="!started && !finished" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
      <label class="block">
        <span class="text-sm font-medium">{{ t('common.continent') }}</span>
        <select v-model="continent" class="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
          <option value="">{{ t('quiz.continentAll') }}</option>
          <option v-for="c in continents.slice(1)" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label class="block">
        <span class="text-sm font-medium">{{ t('quiz.count') }}: {{ count }}</span>
        <input v-model.number="count" type="range" min="4" max="20" step="2" class="mt-2 w-full accent-indigo-600" />
      </label>
      <button class="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700" @click="start">
        {{ t('quiz.start') }}
      </button>
    </div>

    <div v-else-if="started && questions.length" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
      <div class="flex items-center justify-between text-sm text-slate-500">
        <span>{{ t('quiz.progress') }}: {{ index + 1 }} / {{ questions.length }}</span>
        <span class="text-emerald-600 font-medium">✓ {{ correctCount }}</span>
      </div>
      <div class="h-1.5 rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div class="h-full bg-indigo-500 transition-all" :style="{ width: `${((index + 1) / questions.length) * 100}%` }"></div>
      </div>

      <div>
        <div class="text-xs text-slate-400 mb-1">
          {{ questions[index].type === 'capital' ? '🏛️' : questions[index].type === 'continent' ? '🌍' : questions[index].type === 'area' ? '📐' : '👥' }}
          {{ questions[index].type }}
        </div>
        <p class="text-lg font-semibold">{{ questions[index].question }}</p>
      </div>

      <div class="space-y-2">
        <button
          v-for="(opt, i) in questions[index].options"
          :key="i"
          class="w-full text-left px-4 py-3 rounded-lg border text-sm transition"
          :class="selected === null
            ? 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
            : i === questions[index].answerIndex
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : i === selected
                ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300'
                : 'border-slate-200 dark:border-slate-800 opacity-60'"
          @click="choose(i)"
        >
          {{ String.fromCharCode(65 + i) }}. {{ opt }}
        </button>
      </div>

      <div v-if="selected !== null" class="text-sm rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
        <span :class="selected === questions[index].answerIndex ? 'text-emerald-600' : 'text-red-500'">
          {{ selected === questions[index].answerIndex ? t('quiz.correct') : t('quiz.wrong') }}
        </span>
        <span class="text-slate-500"> — {{ questions[index].fact }}</span>
      </div>

      <button
        v-if="selected !== null"
        class="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
        @click="next"
      >
        {{ t('quiz.next') }}
      </button>
    </div>

    <div v-else-if="finished" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-4">
      <div class="text-5xl">{{ correctCount === questions.length ? '🏆' : correctCount >= questions.length / 2 ? '🎉' : '💪' }}</div>
      <h2 class="text-xl font-bold">{{ t('quiz.result') }}</h2>
      <p class="text-3xl font-bold text-indigo-600">{{ correctCount }} / {{ questions.length }}</p>
      <div class="flex flex-wrap justify-center gap-3 pt-2">
        <button class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700" @click="start">
          {{ t('quiz.again') }}
        </button>
        <button
          v-if="wrongQuestions.length && !addedToCards"
          class="px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600"
          @click="addWrongToCards"
        >
          {{ t('quiz.addWrongToCards') }} ({{ wrongQuestions.length }})
        </button>
        <span v-if="addedToCards" class="text-sm text-emerald-600 flex items-center">✓ {{ t('quiz.addToCardsDone') }}</span>
      </div>
    </div>
  </div>
</template>
