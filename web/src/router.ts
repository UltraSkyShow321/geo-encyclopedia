import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

const routes = [
  { path: '/', name: 'home', component: () => import('./views/HomeView.vue'), meta: { title: '世界地理百科全书' } },
  { path: '/countries', name: 'countries', component: () => import('./views/CountryListView.vue'), meta: { title: '国家档案' } },
  { path: '/countries/:slug', name: 'country', component: () => import('./views/CountryDetailView.vue') },
  { path: '/topics', name: 'topics', component: () => import('./views/TopicListView.vue'), meta: { title: '地理专题' } },
  { path: '/topics/:slug', name: 'topic', component: () => import('./views/TopicDetailView.vue') },
  { path: '/map', name: 'map', component: () => import('./views/MapView.vue'), meta: { title: '互动地图' } },
  { path: '/ranks', name: 'ranks', component: () => import('./views/RankView.vue'), meta: { title: '数据排行' } },
  { path: '/search', name: 'search', component: () => import('./views/SearchView.vue') },
  { path: '/quiz', name: 'quiz', component: () => import('./views/QuizView.vue'), meta: { title: '地理小测验' } },
  { path: '/cards', name: 'cards', component: () => import('./views/CardsView.vue'), meta: { title: '记忆卡片', auth: true } },
  { path: '/favorites', name: 'favorites', component: () => import('./views/FavoritesView.vue'), meta: { title: '我的收藏', auth: true } },
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
  { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
  { path: '/download', name: 'download', component: () => import('./views/DownloadView.vue'), meta: { title: '下载客户端' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: typeof location !== 'undefined' && location.protocol === 'file:'
    ? createWebHashHistory()
    : createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.initialized) await auth.init();
  if (to.meta.auth && !auth.authed) {
    return { name: 'login', query: { next: to.fullPath } };
  }
  return true;
});
