import { defineStore } from 'pinia';
import { api } from '../api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    authed: false,
    initialized: false,
  }),
  actions: {
    async init() {
      try {
        const r = await api.me();
        this.authed = r.authed;
      } catch {
        this.authed = false;
      }
      this.initialized = true;
    },
    async login(password: string) {
      await api.login(password);
      this.authed = true;
    },
    async logout() {
      try {
        await api.logout();
      } catch {
        /* ignore */
      }
      this.authed = false;
    },
  },
});
