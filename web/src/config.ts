// 内置默认服务器地址（构建时可用环境变量覆盖: VITE_DEFAULT_SERVER）
// 普通用户下载即用，无需手动填写；设置页仍可修改/恢复默认
export const DEFAULT_SERVER: string =
  (import.meta.env.VITE_DEFAULT_SERVER as string) || 'http://192.168.31.114:3000';

// 外网备用地址（构建时可用 VITE_PUBLIC_SERVER 覆盖）
// 内网地址不可达时自动切换到该地址（走 Cloudflare Tunnel）
export const PUBLIC_SERVER: string =
  (import.meta.env.VITE_PUBLIC_SERVER as string) || 'https://geo.galaxygrass.top';
