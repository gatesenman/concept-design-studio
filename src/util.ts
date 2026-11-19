export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const now = () => new Date().toISOString();
export const fmt = (s: string) => new Date(s).toLocaleString('zh-CN', { hour12: false });
