import { defineStore } from 'pinia';

type ThemeMode = 'auto' | 'light' | 'dark';

function systemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyClass(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
}

export const useThemeStore = defineStore('theme', {
  state: (): { mode: ThemeMode } => ({
    mode: (localStorage.getItem('geo-theme') as ThemeMode) || 'auto',
  }),
  getters: {
    isDark(state): boolean {
      return state.mode === 'dark' || (state.mode === 'auto' && systemDark());
    },
    next(state): ThemeMode {
      if (state.mode === 'auto') return 'light';
      if (state.mode === 'light') return 'dark';
      return 'auto';
    },
  },
  actions: {
    apply() {
      applyClass(this.isDark);
    },
    cycle() {
      this.mode = this.next;
      localStorage.setItem('geo-theme', this.mode);
      this.apply();
    },
  },
});
