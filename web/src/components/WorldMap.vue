<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api';
import { useThemeStore } from '../stores/theme';
import { useI18n } from 'vue-i18n';

type BasemapId = 'boundaries' | 'terrain' | 'satellite' | 'amap';

const props = withDefaults(
  defineProps<{
    basemap?: BasemapId;
    showBasemapSwitcher?: boolean;
    highlight?: string;
    zoomToHighlight?: boolean;
    height?: string;
    center?: [number, number] | null;
  }>(),
  { basemap: 'boundaries', showBasemapSwitcher: false, highlight: '', zoomToHighlight: false, height: '520px', center: null }
);

const { t } = useI18n();
const theme = useThemeStore();
const router = useRouter();
const el = ref<HTMLDivElement>();

const basemap = ref<BasemapId>(props.basemap);

const BASEMAPS: Record<BasemapId, { label: string; url?: string; overlayUrl?: string; overlayUrl2?: string; maxZoom?: number; attribution?: string }> = {
  boundaries: {
    label: t('map.layerBoundaries'),
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, Intermap',
  },
  terrain: {
    label: t('map.layerTerrain'),
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA, DeLorme',
  },
  satellite: {
    label: t('map.layerSatellite'),
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    overlayUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    overlayUrl2: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, USDA, USGS',
  },
  amap: {
    label: t('map.layerAmap'),
  },
};

const layers = computed(() => Object.entries(BASEMAPS).map(([id, v]) => ({ id: id as BasemapId, ...v })));

let map: L.Map | undefined;
let geoLayer: L.GeoJSON | undefined;
let highlightLayer: L.GeoJSON | undefined;
let highlightMarker: L.CircleMarker | undefined;
let tileLayer: L.TileLayer | undefined;
let overlayLayer: L.TileLayer | undefined;
let overlayLayer2: L.TileLayer | undefined;
let landformLayer: L.LayerGroup | undefined;
let disposed = false;
let amapKey = '';
let amapSecurityCode = '';
let amapInstance: any = null;
let amapDiv: HTMLDivElement | null = null;
const offlineMode = ref(false);
const amapNotice = ref('');

declare global {
  interface Window {
    AMap?: any;
    __leafletMap?: L.Map | undefined;
    __geoFeatures?: any[];
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

async function loadGeoJson(): Promise<any> {
  try {
    return await api.geojson();
  } catch {
    const g = await offlineGeojson();
    if (g) offlineMode.value = true;
    return g;
  }
}

async function offlineGeojson(): Promise<any | null> {
  const { offline } = await import('../offline');
  return offline.geojson();
}

async function ensureAmapKey() {
  if (amapKey) return amapKey;
  try {
    const cfg = await api.config();
    amapKey = cfg.amapKey || '';
    amapSecurityCode = cfg.amapSecurityCode || '';
  } catch {
    amapKey = '';
  }
  return amapKey;
}

function loadAmapScript(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.AMap) return resolve();
    // 高德安全密钥：在加载 SDK 前注入（可免配域名白名单）
    if (amapSecurityCode) {
      window._AMapSecurityConfig = { securityJsCode: amapSecurityCode };
    }
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`;
    const timer = setTimeout(() => reject(new Error('高德地图 SDK 加载超时（网络或 Key 问题）')), 15000);
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); reject(new Error('高德地图 SDK 加载失败')); };
    document.head.appendChild(script);
  });
}

function showAmapNotice(msg: string) {
  amapNotice.value = msg;
  window.setTimeout(() => { if (amapNotice.value === msg) amapNotice.value = ''; }, 6000);
}

async function activateAmap() {
  const key = await ensureAmapKey();
  if (!key) {
    showAmapNotice('未配置高德地图 Key：请在 .env 填写 AMAP_KEY（lbs.amap.com 免费注册）并重启后端服务');
    basemap.value = 'boundaries';
    return;
  }
  try {
    await loadAmapScript(key);
  } catch (e: any) {
    showAmapNotice(`高德地图加载失败：${e.message}（检查 AMAP_KEY / AMAP_SECURITY_CODE 是否配置、后端是否重启）`);
    basemap.value = 'boundaries';
    return;
  }
  if (disposed || !el.value) return;
  if (!amapDiv) {
    amapDiv = document.createElement('div');
    amapDiv.style.cssText = 'position:absolute;inset:0;z-index:5;background:#eef1f4;';
    el.value.parentElement?.appendChild(amapDiv);
  }
  if (!amapInstance) {
    amapInstance = new (window.AMap as any).Map(amapDiv, {
      zoom: 3,
      center: [105, 35],
      mapStyle: 'amap://styles/normal',
      showLabel: true,
    });
    amapInstance.on('click', async (e: any) => {
      try {
        const r = await api.countryAt(e.lnglat.getLat(), e.lnglat.getLng());
        if (r.slug) router.push(`/countries/${r.slug}`);
      } catch {
        /* ignore */
      }
    });
  }
  if (map) map.getContainer().style.visibility = 'hidden';
}

function deactivateAmap() {
  if (amapInstance) {
    amapInstance.destroy();
    amapInstance = null;
  }
  if (amapDiv) {
    amapDiv.remove();
    amapDiv = null;
  }
  if (map) map.getContainer().style.visibility = 'visible';
}

const LANDFORM_COLORS: Record<string, string> = {
  山脉: '#92400e', 山峰: '#a16207', 高原: '#b45309', 平原: '#65a30d', 沙漠: '#d97706',
  盆地: '#a16207', 海峡: '#0891b2', 运河: '#0e7490', 湖泊: '#0284c7', 河流: '#38bdf8',
  岛屿: '#14b8a6', 半岛: '#0d9488', 海湾: '#0369a1', 瀑布: '#0ea5e9', 峡谷: '#7c3aed',
  森林: '#16a34a', 冰川: '#64748b',
};

async function renderLandforms() {
  if (landformLayer) {
    map?.removeLayer(landformLayer);
    landformLayer = undefined;
  }
  if (basemap.value !== 'terrain') return;
  try {
    let landforms: any[];
    try {
      landforms = await api.landforms();
    } catch {
      const { offline } = await import('../offline');
      landforms = await offline.landforms();
    }
    if (disposed || !map) return;
    landformLayer = L.layerGroup();
    for (const lf of landforms) {
      const color = LANDFORM_COLORS[lf.type] || '#64748b';
      const icon = L.divIcon({
        className: 'lf-marker',
        html: `<div style="display:flex;align-items:center;gap:4px;white-space:nowrap;">
          <span style="width:10px;height:10px;border-radius:50%;background:${color};border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);display:inline-block;"></span>
          <span style="font-size:11px;font-weight:600;color:#1e293b;background:rgba(255,255,255,.85);padding:0 5px;border-radius:4px;border:1px solid rgba(100,116,139,.3);">${lf.name_zh}</span>
        </div>`,
        iconSize: [0, 0],
      });
      const marker = L.marker([lf.lat, lf.lng], { icon });
      marker.bindPopup(
        `<div style="font-size:13px;min-width:220px;max-width:320px;">
          <div style="font-weight:700;font-size:14px;">${lf.name_zh} <span style="font-weight:400;color:#64748b;">${lf.name_en}</span></div>
          <div style="margin:4px 0 6px;"><span style="display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;color:#fff;background:${color};">${lf.type}</span></div>
          <div style="color:#334155;line-height:1.6;">${lf.desc || ''}</div>
        </div>`
      );
      marker.addTo(landformLayer);
    }
    landformLayer.addTo(map);
    syncLandformOpacity();
  } catch {
    /* 标注数据加载失败时静默 */
  }
}

// 低缩放级别隐藏地貌标注，避免标签重叠；缩放 >=3 级显示
function syncLandformOpacity() {
  if (!landformLayer || !map) return;
  const show = map.getZoom() >= 3;
  landformLayer.eachLayer((l: any) => l.setOpacity?.(show ? 1 : 0));
}

function applyBasemap() {
  if (!map) return;
  if (basemap.value === 'amap') {
    activateAmap();
    return;
  }
  deactivateAmap();
  const b = BASEMAPS[basemap.value];
  // 离线模式：不加载网络瓦片，仅显示本地轮廓
  if (offlineMode.value) {
    return;
  }
  if (tileLayer) {
    map.removeLayer(tileLayer);
    tileLayer = undefined;
  }
  tileLayer = L.tileLayer(b.url!, { attribution: b.attribution || '', maxZoom: b.maxZoom || 18 }).addTo(map);
  if (overlayLayer) {
    map.removeLayer(overlayLayer);
    overlayLayer = undefined;
  }
  if (overlayLayer2) {
    map.removeLayer(overlayLayer2);
    overlayLayer2 = undefined;
  }
  if (b.overlayUrl) {
    overlayLayer = L.tileLayer(b.overlayUrl, { attribution: '', maxZoom: b.maxZoom || 18, opacity: 0.9 }).addTo(map);
  }
  if (b.overlayUrl2) {
    overlayLayer2 = L.tileLayer(b.overlayUrl2, { attribution: '', maxZoom: b.maxZoom || 18, opacity: 0.85 }).addTo(map);
  }
}

function paint(geojson: any) {
  if (geoLayer) {
    map?.removeLayer(geoLayer);
    geoLayer = undefined;
  }
  (window as any).__geoFeatures = geojson.features;
  const strokeColor = theme.isDark ? '#94a3b8' : '#334155';
  geoLayer = L.geoJSON(geojson, {
    style: () => ({
      color: strokeColor,
      weight: 0.8,
      fillColor: '#ffffff',
      fillOpacity: 0.02,
    }),
    onEachFeature: (f: any, layer: L.Layer) => {
      const p = f.properties;
      const label = p.name_zh ? `${p.name_zh}${p.name_en ? ' · ' + p.name_en : ''}` : p.name_en;
      layer.bindTooltip(label, { sticky: true });
      layer.on('mouseover', (e: any) => {
        e.target.setStyle({ color: '#f59e0b', weight: 1.6 });
        e.target.bringToFront();
      });
      layer.on('mouseout', (e: any) => {
        e.target.setStyle({ color: strokeColor, weight: 0.8 });
      });
      layer.on('click', () => {
        if (p.slug) router.push(`/countries/${p.slug}`);
      });
    },
  });
  geoLayer.addTo(map!);

  if (props.highlight) {
    highlightLayer?.remove();
    highlightLayer = L.geoJSON(geojson, {
      filter: (f: any) => String(f.properties.iso_numeric ?? '').padStart(3, '0') === String(props.highlight ?? '').padStart(3, '0'),
      style: { color: '#f59e0b', weight: 2.5, fillColor: '#f59e0b', fillOpacity: 0.28 },
    }).addTo(map!);
    if (props.zoomToHighlight) {
      // 小国也需要放大到可见级别（maxZoom 10）；bounds 无效时保持世界视图
      const b = highlightLayer.getBounds();
      const span = b.isValid() ? b.getEast() - b.getWest() : 0;
      if (b.isValid() && span <= 200) {
        map?.fitBounds(b.pad(0.1), { maxZoom: 10 });
        // 小国在低 zoom 下几乎不可见：加一个脉冲点标记位置
        const c = b.getCenter();
        highlightMarker?.remove();
        highlightMarker = L.circleMarker([c.lat, c.lng], {
          radius: 7, color: '#f59e0b', weight: 2.5, fillColor: '#f59e0b', fillOpacity: 0.9,
        }).addTo(map!);
      } else if (props.center) {
        // 跨日期线国家（bounds 横跨全球）或 geojson 缺失的领地：按国家中心坐标定位
        highlightMarker?.remove();
        highlightMarker = L.circleMarker([props.center[0], props.center[1]], {
          radius: 9, color: '#f59e0b', weight: 3, fillColor: '#f59e0b', fillOpacity: 0.9,
        }).addTo(map!);
        map?.setView([props.center[0], props.center[1]], 5);
      }
    }
  } else {
    highlightMarker?.remove();
    highlightMarker = undefined;
  }
}

async function initMap() {
  if (!el.value || map || disposed) return;
  map = L.map(el.value, { worldCopyJump: true, zoomControl: true, attributionControl: true }).setView([25, 10], 2);
  map.on('zoomend', syncLandformOpacity);
  (window as any).__leafletMap = map;
  applyBasemap();
  const geojson = await loadGeoJson();
  if (disposed || !map) return;
  paint(geojson);
  renderLandforms();
}

watch(basemap, () => {
  if (!map) return;
  applyBasemap();
  renderLandforms();
});

watch(
  () => props.highlight,
  async () => {
    if (!map) return;
    const geojson = await loadGeoJson();
    paint(geojson);
  }
);

onMounted(initMap);
onBeforeUnmount(() => {
  disposed = true;
  deactivateAmap();
  if ((window as any).__leafletMap === map) (window as any).__leafletMap = undefined;
  map?.remove();
  map = undefined;
});

// 供父组件调用: 飞往指定国家
function focusCountry(slug: string) {
  if (!map || disposed) return;
  const hit = (window as any).__geoFeatures?.find((f: any) => f.properties.slug === slug);
  if (!hit) return;
  const layer = L.geoJSON(hit);
  map.flyToBounds(layer.getBounds().pad(0.15), { maxZoom: 5 });
}
defineExpose({ focusCountry });
</script>

<template>
  <div class="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
    <div ref="el" :style="{ height }" class="w-full z-0"></div>

    <div v-if="showBasemapSwitcher" class="absolute top-2 right-2 z-[500] flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 text-[11px] shadow">
      <button
        v-for="l in layers"
        :key="l.id"
        class="px-2.5 py-1.5 font-medium"
        :class="basemap === l.id
          ? 'bg-indigo-600 text-white'
          : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'"
        @click="basemap = l.id"
      >
        {{ l.label }}
      </button>
    </div>

    <div v-if="offlineMode" class="absolute top-2 left-1/2 -translate-x-1/2 z-[600] rounded-lg bg-amber-50 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200 shadow">
      离线模式：无底图，仅显示国家轮廓
    </div>

    <div v-if="amapNotice" class="absolute top-12 right-2 z-[600] max-w-xs rounded-lg bg-amber-50 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 shadow">
      {{ amapNotice }}
    </div>

    <div class="absolute bottom-6 right-2 z-[500] text-[11px] px-2 py-1 rounded bg-slate-900/70 text-slate-100 pointer-events-none">
      {{ t('map.clickHint') }}
    </div>
  </div>
</template>
