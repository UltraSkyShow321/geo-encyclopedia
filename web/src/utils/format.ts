export function formatNumber(n: number | null | undefined, lang: string): string {
  if (n === null || n === undefined) return '—';
  if (lang === 'zh') {
    if (n >= 1e8) return `${+(n / 1e8).toFixed(2)} 亿`;
    if (n >= 1e4) return `${+(n / 1e4).toFixed(1)} 万`;
    return n.toLocaleString('zh-CN');
  }
  if (n >= 1e9) return `${+(n / 1e9).toFixed(2)} B`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)} M`;
  return n.toLocaleString('en-US');
}

export function formatArea(n: number | null | undefined, lang: string): string {
  if (n === null || n === undefined) return '—';
  if (lang === 'zh') {
    if (n >= 1e6) return `${+(n / 1e6).toFixed(2)} 万 km²`;
    return `${n.toLocaleString('zh-CN')} km²`;
  }
  return `${n.toLocaleString('en-US')} km²`;
}

export const CONTINENTS = [
  { zh: '亚洲', en: 'Asia' },
  { zh: '非洲', en: 'Africa' },
  { zh: '欧洲', en: 'Europe' },
  { zh: '北美洲', en: 'North America' },
  { zh: '南美洲', en: 'South America' },
  { zh: '大洋洲', en: 'Oceania' },
  { zh: '南极洲', en: 'Antarctica' },
];

export const CONTINENT_COLORS: Record<string, string> = {
  亚洲: '#f59e0b',
  非洲: '#ef4444',
  欧洲: '#3b82f6',
  北美洲: '#10b981',
  南美洲: '#8b5cf6',
  大洋洲: '#06b6d4',
  南极洲: '#64748b',
};

export const METRIC_COLORS = ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'];

export function colorFor(metric: string, value: number | null | undefined): string {
  if (value === null || value === undefined || !value) return '#cbd5e1';
  const thresholds =
    metric === 'population' ? [1e6, 1e7, 5e7, 2e8, 1e9] : [1e4, 1e5, 5e5, 1e6, 5e6];
  let idx = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) idx = i;
  }
  return METRIC_COLORS[idx];
}

export function legendFor(metric: string): { color: string; label: string }[] {
  if (metric === 'population') {
    return [
      { color: '#dbeafe', label: '< 100万' },
      { color: '#93c5fd', label: '100万–1000万' },
      { color: '#3b82f6', label: '1000万–5000万' },
      { color: '#1d4ed8', label: '5000万–2亿' },
      { color: '#1e3a8a', label: '> 2亿' },
    ];
  }
  return [
    { color: '#dbeafe', label: '< 1万 km²' },
    { color: '#93c5fd', label: '1万–10万 km²' },
    { color: '#3b82f6', label: '10万–50万 km²' },
    { color: '#1d4ed8', label: '50万–100万 km²' },
    { color: '#1e3a8a', label: '> 100万 km²' },
  ];
}
