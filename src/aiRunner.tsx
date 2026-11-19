import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { Project } from './types';
import { CHAPTERS, buildMessages, consistencyMessages, emptyAI, localIssues, normalize, parseJSON, chapterDef, chapterStatus, currentContent, Finding } from './ai';
import { DEP_LEVELS, validate, repairMessages, clarifyMessages, reviewMessages, chatMessages, ChatMsg, ROLES, chapterKeyOf, msgTokens, estTokens, Usage } from './aiplus';
import { now, uid } from './util';
import { friendlyLlmError } from './llmErrors';

export interface LlmSettings { preset: string; baseUrl: string; model: string; temperature: number; jsonMode: boolean; hasKey: boolean; keyMode: string | null; }
export interface Gen { projectId: string; key: string; text: string; startedAt: number; index: number; total: number; status?: string; }
export interface ClarifyQ { q: string; why?: string; options?: string[]; a: string; }
type GenOpts = { instruction?: string; complete?: boolean; noCache?: boolean };
interface AICtx {
  settings: LlmSettings | null; configured: boolean; reloadSettings: () => Promise<void>;
  gen: Gen | null; gens: Record<string, Gen>; done: number; queue: string[]; running: boolean; stopping: boolean; checking: boolean;
  generate: (k: string, o?: GenOpts) => Promise<boolean>;
  generateAll: (opts?: { force?: boolean; skipClarify?: boolean }) => Promise<void>; stop: () => void; checkConsistency: () => Promise<void>;
  settingsOpen: boolean; openSettings: (v?: boolean) => void; requestGenerateAll: () => void;
  skipAccepted: boolean; setSkipAccepted: (v: boolean) => void;
  clarifyQs: ClarifyQ[] | null; clarifying: boolean; askClarify: (thenGenerate: boolean) => Promise<void>; submitClarify: (qs: ClarifyQ[] | null, generate: boolean) => void; clarifyThen: boolean;
  reviewing: string[]; runReview: (roles?: string[]) => Promise<void>; fixDraft: (chapter: string, issue: string, suggestion?: string) => Promise<boolean>;
  chatBusy: boolean; sendChat: (text: string, quote?: string) => Promise<void>; chatDraft: { text: string; quote?: string } | null; setChatDraft: (v: { text: string; quote?: string } | null) => void;
}
const C = createContext<AICtx>(null as any);
export const useAI = () => useContext(C);
const cache = new Map<string, string>();
const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ':' + s.length; };

export function AIProvider({ children }: { children: React.ReactNode }) {
  const st = useStore();
  const [settings, setSettings] = useState<LlmSettings | null>(null);
  const [gens, setGens] = useState<Record<string, Gen>>({}); const [done, setDone] = useState(0); const [queue, setQueue] = useState<string[]>([]);
  const [running, setRunning] = useState(false); const [stopping, setStopping] = useState(false);
  const [checking, setChecking] = useState(false); const [settingsOpen, setSettingsOpen] = useState(false);
  const [skipAccepted, setSkipAccepted] = useState(true);
  const [clarifyQs, setClarifyQs] = useState<ClarifyQ[] | null>(null); const [clarifying, setClarifying] = useState(false); const [clarifyThen, setClarifyThen] = useState(false);
  const [reviewing, setReviewing] = useState<string[]>([]); const [chatBusy, setChatBusy] = useState(false);
  const [chatDraft, setChatDraft] = useState<{ text: string; quote?: string } | null>(null);
  const projRef = useRef<Project | null>(st.project); projRef.current = st.project;
  const prefsRef = useRef(st.prefs); prefsRef.current = st.prefs;
  const cur = useRef<{ ids: Set<string>; stop: boolean }>({ ids: new Set(), stop: false });
  const pendingAll = useRef(false);
  const reloadSettings = async () => { if (window.api?.getSettings) setSettings(await window.api.getSettings()); };
  useEffect(() => { reloadSettings(); }, []);
  const configured = !!(settings?.hasKey && settings.baseUrl && settings.model);
  const updP = (pid: string, f: (p: Project) => Project) => st.setData(d => ({ ...d, projects: d.projects.map(p => p.id === pid ? f(p) : p) }));
  const setChapter = (pid: string, k: string, patch: any) => updP(pid, p => { const ai = p.ai || emptyAI();
    return { ...p, updatedAt: now(), ai: { ...ai, chapters: { ...ai.chapters, [k]: { ...(ai.chapters[k] || { status: 'empty' }), ...patch } } } }; });
  const addUsage = (pid: string, u: Partial<Usage>) => updP(pid, p => { const ai = p.ai || emptyAI(); const o = ai.usage || { calls: 0, prompt: 0, completion: 0, cached: 0 };
    return { ...p, ai: { ...ai, usage: { calls: o.calls + (u.calls || 0), prompt: o.prompt + (u.prompt || 0), completion: o.completion + (u.completion || 0), cached: o.cached + (u.cached || 0) } } }; });

  /** low-level call with usage, retries, cache */
  const callLLM = async (pid: string, messages: any[], onText: (t: string) => void, o: { json?: boolean; cache?: boolean; label?: string; temperature?: number } = {}): Promise<string> => {
    if (!window.api?.llmStream) throw new Error('当前环境不支持 AI 调用');
    const key = hash(JSON.stringify(messages));
    if (o.cache && prefsRef.current.useCache !== false && cache.has(key)) { const t = cache.get(key)!; onText(t); addUsage(pid, { cached: 1 }); return t; }
    let acc = ''; const h = window.api.llmStream(messages, (d: string) => { acc += d; onText(acc); }, { json: o.json, temperature: o.temperature },
      (r: any) => st.toast(`${o.label ? `「${o.label}」` : ''}模型${r.status === 429 ? '限流（HTTP 429）' : `服务异常（HTTP ${r.status}）`}，${(r.wait / 1000).toFixed(1)} 秒后自动重试（第 ${r.attempt}/3 次）`, 'warn'));
    cur.current.ids.add(h.id);
    try {
      const r = await h.promise; const text = typeof r === 'string' ? r : r.text; const u = typeof r === 'string' ? null : r.usage;
      addUsage(pid, { calls: 1, prompt: u?.prompt_tokens ?? msgTokens(messages), completion: u?.completion_tokens ?? estTokens(text) });
      cache.set(key, text); return text;
    } finally { cur.current.ids.delete(h.id); }
  };
  const ensure = () => { if (!configured) { st.toast('请先配置 AI 模型（Base URL、API Key、模型名称）', 'warn'); setSettingsOpen(true); return false; } return true; };
  const setGen = (k: string, g: Gen | null | ((g: Gen) => Gen)) => setGens(m => { const n = { ...m }; if (g === null) delete n[k]; else if (typeof g === 'function') { if (n[k]) n[k] = g(n[k]); } else n[k] = g; return n; });

  const genOne = async (p: Project, k: string, o: GenOpts = {}, drafts?: Record<string, any>, meta?: { index: number; total: number }, useCache = false) => {
    const title = chapterDef(k)?.title || k;
    setGen(k, { projectId: p.id, key: k, text: '', startedAt: Date.now(), index: meta?.index ?? 1, total: meta?.total ?? 1 });
    setChapter(p.id, k, { error: undefined });
    try {
      const msgs = buildMessages(p, k, { ...o, useDrafts: drafts, tpl: prefsRef.current.aiTpl });
      const text = await callLLM(p.id, msgs, t => setGen(k, g => ({ ...g, text: t })), { cache: useCache && !o.noCache, label: title });
      if (cur.current.stop) return null;
      let draft: any = null, err = '', repaired = false;
      try { draft = normalize(k, parseJSON(text)); err = validate(k, draft); } catch (e: any) { err = '不是合法 JSON：' + String(e?.message || e).slice(0, 80); }
      if (err) {
        setGen(k, g => ({ ...g, text: '', status: `输出未通过结构校验（${err}），正在自动修复…` }));
        const t2 = await callLLM(p.id, repairMessages(msgs, text, err, chapterDef(k)!.schema), t => setGen(k, g => ({ ...g, text: t })), { label: title });
        if (cur.current.stop) return null;
        draft = normalize(k, parseJSON(t2)); const e2 = validate(k, draft); if (e2) throw new Error('模型输出 JSON 校验失败：' + e2); repaired = true;
      }
      draft._cites = (msgs as any).cites || {}; if (repaired) draft._repaired = true;
      setChapter(p.id, k, { status: 'pending', draft, mode: o.complete ? 'complete' : 'replace', instruction: o.instruction || '', updatedAt: now(), error: undefined });
      return draft;
    } catch (e: any) {
      const msg = friendlyLlmError(e);
      if (msg !== '已停止生成' && !cur.current.stop) { setChapter(p.id, k, { error: msg, updatedAt: now() }); st.toast(`「${title}」生成失败：${msg}`, 'err'); }
      return null;
    } finally { setGen(k, null); }
  };

  const generate = async (k: string, o: GenOpts = {}) => {
    const p = projRef.current; if (!p || running || !ensure()) return false;
    setRunning(true); setStopping(false); cur.current.stop = false; setDone(0);
    window.dispatchEvent(new CustomEvent('cds:gen-chapter', { detail: { key: k } }));
    const r = await genOne(p, k, o, undefined, { index: 1, total: 1 }); setRunning(false); setStopping(false);
    if (r) st.toast(`「${chapterDef(k)?.title}」草稿已就绪，请审核`, 'info');
    return !!r;
  };

  const askClarify = async (thenGenerate: boolean) => {
    const p = projRef.current; if (!p || running || clarifying || !ensure()) return;
    setClarifying(true); setClarifyThen(thenGenerate);
    try {
      const t = await callLLM(p.id, clarifyMessages(p), () => {}, { label: '需求澄清' });
      const qs = ((parseJSON(t).questions || []) as any[]).slice(0, 6).map(x => ({ q: String(x.q || x.question || ''), why: x.why ? String(x.why) : undefined, options: Array.isArray(x.options) ? x.options.map(String).slice(0, 4) : [], a: '' })).filter(x => x.q);
      if (!qs.length) throw new Error('模型没有给出澄清问题');
      const prev = p.ai?.clarify || []; qs.forEach(q => { const m = prev.find(x => x.q === q.q); if (m) q.a = m.a; });
      setClarifyQs(qs);
    } catch (e: any) {
      st.toast('生成澄清问题失败：' + friendlyLlmError(e) + (thenGenerate ? '，将直接生成' : ''), 'warn');
      if (thenGenerate) { setClarifying(false); generateAll({ skipClarify: true }); return; }
    } finally { setClarifying(false); }
  };
  const submitClarify = (qs: ClarifyQ[] | null, gen: boolean) => {
    const p = projRef.current; setClarifyQs(null); if (!p) return;
    updP(p.id, x => ({ ...x, ai: { ...(x.ai || emptyAI()), clarify: qs ? qs.map(q => ({ q: q.q, why: q.why, options: q.options, a: q.a })) : (x.ai?.clarify || []) } }));
    if (qs) st.toast(`已记录 ${qs.filter(q => q.a.trim()).length} 条澄清回答，将用于后续生成`, 'ok');
    if (gen) setTimeout(() => { pendingSkip.current = true; pendingAll.current = true; st.setPrefs({}); }, 0);
  };
  const pendingSkip = useRef(false);

  const generateAll = async (opts: { force?: boolean; skipClarify?: boolean } = {}) => {
    const p0 = projRef.current; if (!p0 || running || !ensure()) return;
    if (!opts.skipClarify && prefsRef.current.clarifyOn !== false && !p0.ai?.clarify) { await askClarify(true); return; }
    const force = !!opts.force;
    const keys = CHAPTERS.map(c => c.key).filter(k => force || skipAccepted === false || chapterStatus(p0, k) !== 'accepted');
    if (!keys.length) { st.toast('所有章节均已采纳。如需重跑，请关闭「跳过已采纳」或单章重新生成。', 'info'); return; }
    setRunning(true); setStopping(false); cur.current.stop = false; setDone(0); setQueue(keys);
    const drafts: Record<string, any> = {};
    for (const c of CHAPTERS) {
      if (chapterStatus(p0, c.key) === 'accepted') drafts[c.key] = currentContent(p0, c.key);
      else { const d = p0.ai?.chapters[c.key]?.draft; if (d) drafts[c.key] = d; }
    }
    let ok = 0, fail = 0, n = 0; const conc = Math.max(1, Math.min(4, prefsRef.current.concurrency || 2));
    for (const level of DEP_LEVELS) {
      const todo = level.filter(k => keys.includes(k)); let i = 0;
      const worker = async () => {
        while (i < todo.length && !cur.current.stop) {
          const k = todo[i++]; const p = projRef.current!; if (p.id !== p0.id) return;
          window.dispatchEvent(new CustomEvent('cds:gen-chapter', { detail: { key: k } }));
          const r = await genOne(p, k, {}, drafts, { index: ++n, total: keys.length }, true);
          if (r) { drafts[k] = r; ok++; } else if (!cur.current.stop) fail++;
          setDone(d => d + 1); setQueue(q => q.filter(x => x !== k));
        }
      };
      await Promise.all(Array.from({ length: Math.min(conc, todo.length) }, worker));
      if (cur.current.stop || projRef.current?.id !== p0.id) break;
    }
    setQueue([]); setRunning(false); setStopping(false);
    if (cur.current.stop) st.toast(`已停止：成功 ${ok} 章${fail ? `，失败 ${fail} 章` : ''}。可从失败章节点「重试」。`, 'warn');
    else st.toast(`全部完成：成功 ${ok} 章${fail ? `，失败 ${fail} 章` : ''}。请从目录中带叹号的章节开始审核。`, fail ? 'warn' : 'ok');
  };

  const stop = () => {
    cur.current.stop = true; setStopping(true);
    cur.current.ids.forEach(id => window.api?.llmAbort(id));
    st.toast('正在停止生成…', 'info');
  };

  const checkConsistency = async () => {
    const p = projRef.current; if (!p) return;
    const local = localIssues(p); let aiIssues: any[] = [];
    if (configured) { setChecking(true);
      try {
        const t = await callLLM(p.id, consistencyMessages(p), () => {}, { label: '一致性检查' });
        aiIssues = (parseJSON(t).issues || []).map((x: any) => ({
          chapter: String(x.chapter || ''), level: ['高', '中', '低'].includes(x.level) ? x.level : '中',
          issue: String(x.issue || ''), suggestion: String(x.suggestion || ''), source: 'AI'
        }));
      } catch (e: any) { st.toast('一致性检查失败：' + friendlyLlmError(e), 'err'); }
      finally { setChecking(false); }
    } else st.toast('未配置 AI，仅运行了本地规则检查', 'info');
    updP(p.id, x => ({ ...x, ai: { ...(x.ai || emptyAI()), issues: [...aiIssues, ...local], checkedAt: now() } }));
    st.toast(`检查完成：发现 ${aiIssues.length + local.length} 个问题`, aiIssues.length + local.length ? 'warn' : 'ok');
  };

  const runReview = async (roles = ROLES.map(r => r.key)) => {
    const p = projRef.current; if (!p || reviewing.length || !ensure()) return;
    setReviewing(roles); const all: Finding[] = []; let failed = 0;
    await Promise.all(roles.map(async role => {
      try {
        const t = await callLLM(p.id, reviewMessages(p, role), () => {}, { label: ROLES.find(r => r.key === role)?.name });
        for (const x of (parseJSON(t).findings || []) as any[]) all.push({ role, chapter: String(x.chapter || ''), severity: ['高', '中', '低'].includes(x.severity) ? x.severity : '中', issue: String(x.issue || ''), suggestion: String(x.suggestion || '') });
      } catch (e: any) { failed++; st.toast(`「${ROLES.find(r => r.key === role)?.name}」评审失败：${friendlyLlmError(e)}`, 'err'); }
      finally { setReviewing(r => r.filter(x => x !== role)); }
    }));
    const order = { 高: 0, 中: 1, 低: 2 } as const; all.sort((a, b) => order[a.severity] - order[b.severity]);
    updP(p.id, x => ({ ...x, ai: { ...(x.ai || emptyAI()), reviews: all, reviewedAt: now() } }));
    st.toast(`多角色评审完成：${all.length} 条发现${failed ? `（${failed} 个角色失败）` : ''}`, all.some(f => f.severity === '高') ? 'warn' : 'ok');
  };

  const fixDraft = async (chapter: string, issue: string, suggestion = '') => {
    const k = chapterKeyOf(chapter); if (!k) { st.toast(`无法定位章节「${chapter}」`, 'warn'); return false; }
    const ok = await generate(k, { instruction: `修复以下评审问题，并保持其余内容基本不变：${issue}${suggestion ? `\n修改建议：${suggestion}` : ''}`, noCache: true });
    if (ok) { st.setPrefs({ docMode: 'edit' }); setTimeout(() => window.dispatchEvent(new CustomEvent('cds:goto', { detail: { key: k } })), 50); }
    return ok;
  };

  const sendChat = async (text: string, quote?: string) => {
    const p = projRef.current; if (!p || chatBusy || !text.trim() || !ensure()) return;
    const um: ChatMsg = { id: uid(), role: 'user', text: text.trim(), at: now(), quote };
    const hist = [...(p.ai?.chat || []), um];
    updP(p.id, x => ({ ...x, ai: { ...(x.ai || emptyAI()), chat: [...(x.ai?.chat || []), um] } }));
    setChatBusy(true); const aid = uid();
    try {
      const t = await callLLM(p.id, chatMessages(p, hist, prefsRef.current.aiTpl), () => {}, { label: 'AI 助手' });
      let reply = t, actions: any[] = [];
      try { const j = parseJSON(t); reply = String(j.reply || ''); actions = (Array.isArray(j.actions) ? j.actions : []).map((a: any) => ({ chapter: chapterKeyOf(String(a.chapter || '')) || '', instruction: String(a.instruction || ''), label: a.label ? String(a.label) : undefined })).filter((a: any) => a.chapter && a.instruction); } catch { }
      const am: ChatMsg = { id: aid, role: 'assistant', text: reply || '（空回复）', at: now(), actions };
      updP(p.id, x => ({ ...x, ai: { ...(x.ai || emptyAI()), chat: [...(x.ai?.chat || []), am].slice(-60) } }));
    } catch (e: any) {
      const am: ChatMsg = { id: aid, role: 'assistant', text: friendlyLlmError(e), at: now(), error: true };
      updP(p.id, x => ({ ...x, ai: { ...(x.ai || emptyAI()), chat: [...(x.ai?.chat || []), am] } }));
    } finally { setChatBusy(false); }
  };

  const requestGenerateAll = () => { pendingAll.current = true; };
  useEffect(() => { if (pendingAll.current && st.project && !running && !clarifying) { pendingAll.current = false; const s = pendingSkip.current; pendingSkip.current = false; generateAll({ skipClarify: s }); } });
  const genList = Object.values(gens); const gen = genList[0] || null;
  return <C.Provider value={{ settings, configured, reloadSettings, gen, gens, done, queue, running, stopping, checking, generate, generateAll, stop, checkConsistency, settingsOpen, openSettings: (v = true) => setSettingsOpen(v), requestGenerateAll, skipAccepted, setSkipAccepted,
    clarifyQs, clarifying, askClarify, submitClarify, clarifyThen, reviewing, runReview, fixDraft, chatBusy, sendChat, chatDraft, setChatDraft }}>{children}</C.Provider>;
}
