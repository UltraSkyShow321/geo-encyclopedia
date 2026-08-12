<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts/core';
import { BarChart, PieChart, ScatterChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, PieChart, ScatterChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

const props = withDefaults(
  defineProps<{
    option: echarts.EChartsCoreOption;
    height?: string;
  }>(),
  { height: '320px' }
);

const el = ref<HTMLDivElement>();
let chart: echarts.ECharts | undefined;

function render() {
  if (!chart) return;
  chart.setOption(props.option as echarts.EChartsCoreOption, true);
}

onMounted(() => {
  if (!el.value) return;
  chart = echarts.init(el.value);
  render();
  window.addEventListener('resize', resize);
});

function resize() {
  chart?.resize();
}

watch(() => props.option, render, { deep: true });

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  chart?.dispose();
  chart = undefined;
});
</script>

<template>
  <div ref="el" :style="{ height }" class="w-full"></div>
</template>
