import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppData, Project } from './types';
import { now, uid } from './util';
import { sampleProject } from './templates';

declare global { interface Window { api?: any } }
const LS = 'cds-data';
const api = {
  async load(): Promise<AppData | null> { if (window.api) return window.api.load(); const s = localStorage.getItem(LS); return s ? JSON.parse(s) : null; },
  async save(d: AppData) { if (window.api) return window.api.save(d); localStorage.setItem(LS, JSON.stringify(d)); }
};
export interface Prefs { theme: 'light' | 'dark'; collapsed: boolean; onboarded: boolean; helpHidden: Record<string, boolean>; collapsedSections?: Record<string, boolean>; docMode?: 'preview' | 'edit'; aiTpl?: import('./aiplus').PromptTpl; clarifyOn?: boolean; useCache?: boolean; chatOpen?: boolean; concurrency?: number; }
export const defaultPrefs: Prefs = { theme: 'light', collapsed: false, onboarded: false, helpHidden: {}, docMode: 'preview' };
export interface Toast { id: string; text: string; kind: 'ok' | 'info' | 'warn' | 'err'; action?: { label: string; run: () => void }; }
export interface ConfirmOpts { title: string; message: string; okText?: string; danger?: boolean; }

interface Ctx {
  data: AppData; project: Project | null; prefs: Prefs;
  setData: (f: (d: AppData) => AppData, label?: string) => void; update: (f: (p: Project) => Project, label?: string) => void;
  setPrefs: (p: Partial<Prefs>) => void; saving: 'idle' | 'saving' | 'saved' | 'error'; saved: string;
  flushSave: () => Promise<void>;
  undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean;
  toast: (text: string, kind?: Toast['kind'], action?: Toast['action']) => void; toasts: Toast[]; dismiss: (id: string) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>; confirmState: (ConfirmOpts & { resolve: (b: boolean) => void }) | null;
}
const C = createContext<Ctx>(null as any);
export const useStore = () => useContext(C);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataRaw] = useState<AppData | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saved, setSaved] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirm] = useState<Ctx['confirmState']>(null);
  const past = useRef<AppData[]>([]); const future = useRef<AppData[]>([]); const lastPush = useRef(0); const [, force] = useState(0);
  const timer = useRef<any>(); const dataRef = useRef<AppData | null>(null); dataRef.current = data;
  const dirty = useRef(false);

  useEffect(() => { api.load().then(d => {
    if (!d || !d.projects) { const s = sampleProject(); d = { version: 1, currentId: s.id, projects: [s] }; }
    d.prefs = { ...defaultPrefs, ...(d.prefs || {}) };
    setDataRaw(d);
  }); }, []);

  const persist = useCallback(async (d: AppData) => {
    setSaving('saving');
    try {
      await api.save(d);
      dirty.current = false;
      setSaving('saved');
      setSaved(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    } catch (e: any) {
      setSaving('error');
      setToasts(t => [...t.slice(-3), { id: uid(), text: '自动保存失败：' + (e?.message || e), kind: 'err' as const }]);
    }
  }, []);

  useEffect(() => {
    if (!data) return;
    document.documentElement.dataset.theme = data.prefs!.theme;
    dirty.current = true;
    clearTimeout(timer.current); setSaving('saving');
    timer.current = setTimeout(() => { persist(data); }, 450);
  }, [data, persist]);

  const flushSave = useCallback(async () => {
    clearTimeout(timer.current);
    if (dataRef.current && dirty.current) await persist(dataRef.current);
  }, [persist]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushSave(); };
    const onUnload = () => { if (dataRef.current && dirty.current) { try { navigator.sendBeacon?.(''); } catch {} /* best-effort sync via sync XHR not available; flush async */ flushSave(); } };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('visibilitychange', onHide);
    return () => { window.removeEventListener('beforeunload', onUnload); document.removeEventListener('visibilitychange', onHide); };
  }, [flushSave]);

  const dismiss = useCallback((id: string) => setToasts(t => t.filter(x => x.id !== id)), []);
  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok', action?: Toast['action']) => {
    const id = uid(); setToasts(t => [...t.slice(-3), { id, text, kind, action }]); setTimeout(() => dismiss(id), action ? 7000 : 3200);
  }, [dismiss]);
  if (!data) return <div className="loading"><div className="spinner" />正在加载工作台…</div>;
  const project = data.projects.find(p => p.id === data.currentId) || null;
  const setData = (f: (d: AppData) => AppData) => setDataRaw(d => {
    const t = Date.now(); if (t - lastPush.current > 600) { past.current = [...past.current.slice(-99), d!]; future.current = []; } lastPush.current = t;
    return f(d!);
  });
  const update = (f: (p: Project) => Project) => setData(d => ({ ...d, projects: d.projects.map(p => p.id === d.currentId ? { ...f(p), updatedAt: now() } : p) }));
  const setPrefs = (p: Partial<Prefs>) => setDataRaw(d => ({ ...d!, prefs: { ...d!.prefs!, ...p } }));
  const undo = () => { const prev = past.current.pop(); if (!prev) return toast('没有可撤销的操作', 'info');
    setDataRaw(d => { future.current.push(d!); return { ...prev, prefs: d!.prefs }; }); lastPush.current = 0; force(x => x + 1); toast('已撤销', 'info'); };
  const redo = () => { const nxt = future.current.pop(); if (!nxt) return toast('没有可重做的操作', 'info');
    setDataRaw(d => { past.current.push(d!); return { ...nxt, prefs: d!.prefs }; }); lastPush.current = 0; force(x => x + 1); toast('已重做', 'info'); };
  const confirm = (o: ConfirmOpts) => new Promise<boolean>(resolve => setConfirm({ ...o, resolve: (b) => { setConfirm(null); resolve(b); } }));
  return <C.Provider value={{ data, project, prefs: data.prefs!, setData, update, setPrefs, saving, saved, flushSave, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0, toast, toasts, dismiss, confirm, confirmState }}>{children}</C.Provider>;
}
