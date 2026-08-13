export interface CountrySummary {
  slug: string;
  type: string;
  status: string;
  name_zh?: string;
  name_en?: string;
  continent?: string;
  continent_en?: string;
  capital_zh?: string;
  capital_en?: string;
  population?: number | null;
  area_km2?: number | null;
  currency_zh?: string;
  official_language_zh?: string;
  government_zh?: string;
  timezone?: string;
  flag_emoji?: string;
  flag_url?: string;
  iso_alpha2?: string;
  iso_alpha3?: string;
  iso_numeric?: string;
  coordinates?: [number, number];
  neighbors?: string[];
  un_member?: boolean;
}

export interface CountryDetail extends CountrySummary {
  body?: string;
  bodyHtml?: string;
  capital_coords?: [number, number] | null;
  favorites?: { note: string } | null;
}

export interface TopicSummary {
  slug: string;
  title_zh: string;
  title_en: string;
  category: string;
  summary: string;
  status: string;
}

export interface SearchResult {
  slug: string;
  type: string;
  title_zh: string;
  title_en: string;
  flag_emoji: string;
  continent: string;
  excerpt: string;
  score: number;
}

export interface QuizQuestion {
  type: string;
  question: string;
  options: string[];
  answerIndex: number;
  fact: string;
}

export interface Card {
  id: number;
  slug: string | null;
  question: string;
  answer: string;
  next_review: number;
  interval_days: number;
  streak: number;
  created_at: number;
}

declare global {
  interface Window {
    __GEO_NATIVE__?: boolean;
  }
}

/** 原生包装（Capacitor/Electron）环境下，API 地址可在应用内设置 */
export function isNativeEnv(): boolean {
  return window.__GEO_NATIVE__ === true;
}

export function apiBase(): string {
  if (!isNativeEnv()) return '';
  // Electron 桌面端：页面经本地代理以 http 加载，走同源 /api，无需 base
  if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) return '';
  const saved = localStorage.getItem('geo-server');
  return saved ? saved.replace(/\/+$/, '') : '';
}

export function setApiBase(url: string) {
  localStorage.setItem('geo-server', url.replace(/\/+$/, ''));
}

/** 资源地址：移动端(Capacitor)拼服务器地址；网页端与桌面端(本地代理根路径)用绝对路径 */
export function assetUrl(p: string): string {
  const base = apiBase();
  if (isNativeEnv() && base) return base + p;
  return p;
}

/** 原生桌面端：把服务器地址通知本地代理（同源转发 /api） */
export async function notifyNativeProxy(url: string) {
  if (!isNativeEnv() || typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return;
  try {
    await fetch('/__geo_server', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch {
    /* 忽略 */
  }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiBase() + url, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('unauthorized');
    let msg = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => req<any>('/api/meta'),
  countries: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
    return req<{ total: number; items: CountrySummary[] }>(`/api/countries?${qs}`);
  },
  country: (slug: string) => req<CountryDetail>(`/api/countries/${encodeURIComponent(slug)}`),
  topics: () => req<{ categories: { category: string; items: TopicSummary[] }[]; total: number }>('/api/topics'),
  topic: (slug: string) => req<any>(`/api/topics/${encodeURIComponent(slug)}`),
  search: (q: string) => req<{ q: string; total: number; results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`),
  geojson: () => req<any>('/api/geojson'),
  landforms: () => req<any[]>('/api/landforms'),
  config: () => req<{ amapKey: string; amapSecurityCode: string }>('/api/config'),
  countryAt: (lat: number, lng: number) => req<{ slug: string | null; name_zh: string | null }>(`/api/country-at?lat=${lat}&lng=${lng}`),
  quiz: (continent: string, count: number) =>
    req<{ questions: QuizQuestion[] }>(`/api/quiz?continent=${encodeURIComponent(continent)}&count=${count}`),
  me: () => req<{ authed: boolean }>('/api/auth/me'),
  login: (password: string) =>
    req<{ ok: boolean }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => req<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  favorites: () => req<any[]>('/api/favorites'),
  putFavorite: (slug: string, note: string) =>
    req<any>(`/api/favorites/${slug}`, { method: 'PUT', body: JSON.stringify({ note }) }),
  deleteFavorite: (slug: string) => req<any>(`/api/favorites/${slug}`, { method: 'DELETE' }),
  cards: () => req<{ due: Card[]; all: Card[]; dueCount: number }>('/api/cards'),
  addCard: (question: string, answer: string, slug?: string) =>
    req<any>('/api/cards', { method: 'POST', body: JSON.stringify({ question, answer, slug }) }),
  reviewCard: (id: number, correct: boolean) =>
    req<any>(`/api/cards/${id}/review`, { method: 'POST', body: JSON.stringify({ correct }) }),
  deleteCard: (id: number) => req<any>(`/api/cards/${id}`, { method: 'DELETE' }),
  clearCards: () => req<any>('/api/cards', { method: 'DELETE' }),
  reimport: () => req<any>('/api/admin/reimport', { method: 'POST' }),
};
