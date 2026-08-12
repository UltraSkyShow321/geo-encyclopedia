<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api';
import { useThemeStore } from '../stores/theme';
import { CONTINENT_COLORS, colorFor, legendFor, formatNumber } from '../utils/format';
import { useI18n } from 'vue-i18n';

type BasemapId = 'boundaries' | 'terrain' | 'satellite';

const props = withDefaults(
  defineProps<{
    metric?: 'continent' | 'population' | 'area';
    basemap?: BasemapId;
    showBasemapSwitcher?: boolean;
    highlight?: string;
    zoomToHighlight?: boolean;
    height?: string;
  }>(),
  { metric: 'continent', basemap: 'boundaries', showBasemapSwitcher: false, highlight: '', zoomToHighlight: false, height: '520px' }
);

const { locale, t } = useI18n();
const theme = useThemeStore();
const router = useRouter();
const el = ref<HTMLDivElement>();

const basemap = ref<BasemapId>(props.basemap);

const BASEMAPS: Record<BasemapId, { label: string; url: string; attribution: string }> = {
  boundaries: {
    label: t('map.layerBoundaries'),
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, Intermap',
  },
  terrain: {
    label: t('map.layerTerrain'),
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA',
  },
  satellite: {
    label: t('map.layerSatellite'),
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, USDA, USGS',
  },
};

const layers = computed(() => Object.entries(BASEMAPS).map(([id, v]) => ({ id: id as BasemapId, ...v })));

let map: L.Map | undefined;
let geoLayer: L.GeoJSON | undefined;
let legend: L.Control | undefined;
let highlightLayer: L.GeoJSON | undefined;
let tileLayer: L.TileLayer | undefined;

function applyBasemap() {
  if (!map) return;
  const b = BASEMAPS[basemap.value];
  if (tileLayer) {
    map.removeLayer(tileLayer);
    tileLayer = undefined;
  }
  tileLayer = L.tileLayer(b.url, { attribution: b.attribution, maxZoom: 18 }).addTo(map);
}

function paint(geojson: any) {
  if (geoLayer) {
    map?.removeLayer(geoLayer);
    geoLayer = undefined;
  }
  geoLayer = L.geoJSON(geojson, {
    style: (f: any) => {
      const p = f.properties;
      const fill = CONTINENT_COLORS[p.continent] || (props.metric !== 'continent' ? colorFor(props.metric, props.metric === 'population' ? p.population : p.area_km2) : '#94a3b8');
      return {
        color: theme.isDark ? '#0f172a' : '#ffffff',
        weight: 0.8,
        fillColor: fill,
        fillOpacity: 0.72,
      };
    },
    onEachFeature: (f: any, layer: L.Layer) => {
      const p = f.properties;
      let info = p.name_zh || p.name_en;
      if (props.metric === 'population') info += ` · ${formatNumber(p.population, locale.value)}`;
      if (props.metric === 'area') info += ` · ${formatNumber(p.area_km2, locale.value)} km²`;
      layer.bindTooltip(info, { sticky: true });
      layer.on('click', () => {
        if (p.slug) router.push(`/countries/${p.slug}`);
      });
    },
  });
  geoLayer.addTo(map!);

  if (props.highlight) {
    highlightLayer?.remove();
    highlightLayer = L.geoJSON(geojson, {
      filter: (f: any) => String(f.properties.iso_numeric) === String(props.highlight),
      style: { color: '#f59e0b', weight: 2, fillColor: '#f59e0b', fillOpacity: 0.35 },
    }).addTo(map!);
    if (props.zoomToHighlight) {
      map?.fitBounds(highlightLayer.getBounds().pad(0.1), { maxZoom: 4 });
    }
  }
}

function renderLegend() {
  legend?.remove();
  legend = new L.Control({ position: 'bottomleft' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'bg-white/90 dark:bg-slate-900/90 rounded shadow px-3 py-2 text-xs leading-5');
    let html = `<div class="font-semibold mb-1">${t('map.legendTitle')}</div>`;
    if (props.metric === 'continent') {
      html += Object.entries(CONTINENT_COLORS)
        .map(([name, c]) => `<div><span class="inline-block w-3 h-3 rounded-sm mr-1.5 align-middle" style="background:${c}"></span>${name}</div>`)
        .join('');
    } else {
      html += legendFor(props.metric)
        .map((l) => `<div><span class="inline-block w-3 h-3 rounded-sm mr-1.5 align-middle" style="background:${l.color}"></span>${l.label}</div>`)
        .join('');
    }
    div.innerHTML = html;
    return div;
  };
  legend.addTo(map!);
}

async function initMap() {
  if (!el.value || map) return;
  map = L.map(el.value, { worldCopyJump: true, zoomControl: true, attributionControl: true }).setView([25, 10], 2);
  applyBasemap();
  const geojson = await api.geojson();
  paint(geojson);
  renderLegend();
}

watch(
  () => props.metric,
  async () => {
    if (!map) return;
    const geojson = await api.geojson();
    paint(geojson);
    renderLegend();
  }
);

watch(
  () => props.highlight,
  async () => {
    if (!map) return;
    const geojson = await api.geojson();
    paint(geojson);
  }
);

watch(basemap, () => {
  if (!map) return;
  applyBasemap();
});

onMounted(initMap);
onBeforeUnmount(() => {
  map?.remove();
  map = undefined;
});
</script>

<template>
  <div class="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
    <div ref="el" :style="{ height }" class="w-full z-0"></div>

    <div v-if="showBasemapSwitcher" class="absolute top-2 left-2 z-[500] flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 text-[11px] shadow">
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

    <div class="absolute bottom-6 right-2 z-[500] text-[11px] px-2 py-1 rounded bg-slate-900/70 text-slate-100 pointer-events-none">
      {{ t('map.clickHint') }}
    </div>
  </div>
</template>
