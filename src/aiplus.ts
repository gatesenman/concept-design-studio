import { Project } from './types';
import { CHAPTERS, chapterDef, currentContent, emptyAI } from './ai';
import { uid, now } from './util';

// ---------------- materials + BM25 retrieval ----------------
export interface Material { id: string; name: string; text: string; addedAt: string; }
export interface Chunk { mid: string; name: string; idx: number; text: string; }
export interface Cite { name: string; text: string; }

export function chunkText(m: Material, size = 420, overlap = 60): Chunk[] {
  const paras = m.text.replace(/\r/g, '').split(/\n{2,}|(?<=[。！？!?])\s*\n/).map(s => s.trim()).filter(Boolean);
  const out: Chunk[] = []; let buf = '';
  const push = () => { if (buf.trim()) out.push({ mid: m.id, name: m.name, idx: out.length, text: buf.trim() }); };
  for (const p of paras) {
    if ((buf + '\n' + p).length > size && buf) { push(); buf = buf.slice(-overlap) + '\n' + p; } else buf = buf ? buf + '\n' + p : p;
    while (buf.length > size * 1.6) { const head = buf.slice(0, size); buf = buf.slice(size - overlap); out.push({ mid: m.id, name: m.name, idx: out.length, text: head }); }
  }
  push(); return out;
}
/** CJK bigrams + latin words */
export function tokenize(s: string): string[] {
  const t = s.toLowerCase(); const out: string[] = [];
  for (const w of t.match(/[a-z0-9][a-z0-9\-_.]+/g) || []) out.push(w);
  const cjk = t.replace(/[^\u4e00-\u9fff]+/g, ' ').split(' ').filter(Boolean);
  for (const seg of cjk) { if (seg.length === 1) out.push(seg); for (let i = 0; i < seg.length - 1; i++) out.push(seg.slice(i, i + 2)); }
  return out;
}
export function bm25(chunks: Chunk[], query: string, k = 4): { c: Chunk; score: number }[] {
  if (!chunks.length) return [];
  const docs = chunks.map(c => tokenize(c.text)); const avg = docs.reduce((s, d) => s + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>(); docs.forEach(d => new Set(d).forEach(w => df.set(w, (df.get(w) || 0) + 1)));
  const q = Array.from(new Set(tokenize(query))); const N = docs.length, k1 = 1.4, b = 0.75;
  return docs.map((d, i) => {
    const tf = new Map<string, number>(); d.forEach(w => tf.set(w, (tf.get(w) || 0) + 1));
    let s = 0; for (const w of q) { const f = tf.get(w); if (!f) continue; const n = df.get(w)!; const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5)); s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.length / avg)); }
    return { c: chunks[i], score: s };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}
export function allMaterials(p: Project): Material[] {
  const ai = p.ai || emptyAI(); const ms = [...(ai.materials || [])];
  if (ai.docText?.trim() && !ms.some(m => m.name === (ai.docName || '粘贴的资料'))) ms.unshift({ id: 'paste', name: ai.docName || '粘贴的资料', text: ai.docText, addedAt: '' });
  return ms;
}
const QUERY: Record<string, string> = {
  vision: '问题 痛点 目标 愿景 指标 约束 用户', stakeholders: '干系人 角色 部门 管理 合作方 期望', personas: '用户 会员 画像 年龄 习惯 痛点 抱怨',
  journeys: '流程 场景 步骤 体验 触点 高峰', scope: '功能 模块 范围 版本 MVP', requirements: '需求 功能 性能 并发 合规 授权 加密 验收',
  options: '方案 采购 自研 成本 系统', arch: '系统 接口 对接 架构 数据 门禁', risks: '风险 合规 隐私 法规 性能 依赖 高峰 失败', decisions: '决策 选择 原因', glossary: '术语 定义 概念'
};
/** returns evidence block for prompt + cite map */
export function evidenceFor(p: Project, k: string, extraQuery = ''): { block: string; cites: Record<string, Cite> } {
  const chunks = allMaterials(p).flatMap(m => chunkText(m));
  if (!chunks.length) return { block: '', cites: {} };
  const def = chapterDef(k); const q = [def?.title, QUERY[k], p.ai?.brief, extraQuery].filter(Boolean).join(' ');
  let hits = bm25(chunks, q, 4); if (!hits.length) hits = chunks.slice(0, 2).map(c => ({ c, score: 0 }));
  const cites: Record<string, Cite> = {}; const lines: string[] = [];
  hits.forEach((h, i) => { const id = 'S' + (i + 1); cites[id] = { name: h.c.name, text: h.c.text.slice(0, 300) }; lines.push(`[${id}]《${h.c.name}》${h.c.text.slice(0, 600)}`); });
  return { block: lines.join('\n'), cites };
}

// ---------------- prompt templates ----------------
export interface PromptTpl { industry: string; style: string; custom: string; }
export const INDUSTRIES: Record<string, string> = {
  通用: '', 金融: '金融行业：关注监管合规（等保、反洗钱、数据出境）、审计留痕、高可用与资金安全。', 医疗: '医疗健康：关注患者隐私（个人健康信息）、临床流程、医保对接与合规认证。',
  政务: '政务信息化：关注国产化适配、等保三级、跨部门数据共享与公众服务体验。', 电商零售: '电商零售：关注转化漏斗、营销活动高峰、供应链与会员体系。',
  制造: '智能制造：关注设备数据采集、MES/ERP 集成、产线连续性与 OT 安全。', 教育: '教育：关注师生多角色、学期节奏、未成年人保护与内容合规。'
};
export const STYLES: Record<string, string> = {
  专业严谨: '表述专业严谨、条理清晰。', 简洁要点: '尽量简洁，每条控制在一两句话，突出要点。', 咨询报告: '采用咨询报告风格：结论先行、数据化、给出依据与权衡。', 详尽展开: '内容详尽，给出充分的细节、示例与边界条件。'
};
export const defaultTpl: PromptTpl = { industry: '通用', style: '专业严谨', custom: '' };
export function tplText(t?: PromptTpl): string {
  const x = { ...defaultTpl, ...(t || {}) };
  return [INDUSTRIES[x.industry], STYLES[x.style], x.custom?.trim() ? '团队补充约定：' + x.custom.trim() : ''].filter(Boolean).join('\n');
}

// ---------------- budgeting ----------------
export const estTokens = (s: string) => Math.ceil((s.match(/[\u4e00-\u9fff]/g) || []).length * 0.75 + s.replace(/[\u4e00-\u9fff]/g, '').length / 3.6);
export const msgTokens = (m: { content: string }[]) => m.reduce((s, x) => s + estTokens(x.content) + 4, 0);

// ---------------- validation ----------------
export function validate(k: string, d: any): string {
  const def = chapterDef(k); if (!def) return '';
  if (!d || typeof d !== 'object') return '输出不是对象';
  if (k === 'vision') return !d.problem?.trim() || !d.vision?.trim() ? '缺少 problem 或 vision 字段' : '';
  if (k === 'arch') return !/flowchart|graph/.test(d.contextDiagram || '') || !/flowchart|graph/.test(d.architecture || '') ? 'contextDiagram/architecture 必须是 Mermaid flowchart 代码' : '';
  if (!Array.isArray(d.items) || !d.items.length) return 'items 必须是非空数组';
  const bad = d.items.findIndex((x: any) => !String(x[def.idKey!] ?? '').trim());
  if (bad >= 0) return `第 ${bad + 1} 条缺少 ${def.idKey} 字段`;
  if (k === 'options' && (!Array.isArray(d.criteria) || !d.criteria.length)) return 'criteria 必须是非空数组';
  return '';
}
export function repairMessages(orig: any[], badText: string, err: string, schema: string) {
  return [...orig, { role: 'assistant', content: badText.slice(0, 3000) },
    { role: 'user', content: `[[REPAIR]] 你上一次的输出无法通过校验：${err}。请严格按照以下 JSON 结构重新输出完整结果，只输出一个 JSON 对象：${schema}` }];
}

// ---------------- clarify / review / chat prompts ----------------
export function clarifyMessages(p: Project) {
  const ai = p.ai || emptyAI(); const mats = allMaterials(p).map(m => `《${m.name}》${m.text.slice(0, 800)}`).join('\n');
  return [{ role: 'system', content: '你是资深产品顾问。在动笔写概念设计之前，先找出信息缺口。严格只输出一个 JSON 对象。[[TASK:clarify]]' },
    { role: 'user', content: `# 项目名称\n${p.name}\n# 项目构想\n${ai.brief || p.description}\n${mats ? '# 参考资料摘要\n' + mats + '\n' : ''}请提出 3-6 个最关键、会显著影响方案的澄清问题（目标用户、范围边界、约束、成功标准、集成、合规等），每个问题给出 2-4 个可选答案供快速选择。\n输出：{"questions":[{"q":"问题","why":"为什么重要","options":["选项A","选项B"]}]}` }];
}
export const ROLES: { key: string; name: string; icon: string; focus: string }[] = [
  { key: 'product', name: '产品经理', icon: 'lightbulb-line', focus: '价值主张、目标与指标是否可衡量、MVP 范围是否聚焦、需求优先级是否合理' },
  { key: 'arch', name: '架构师', icon: 'node-tree', focus: '架构与需求是否匹配、非功能需求（性能/可用性/扩展性）、集成与技术风险、方案选择依据' },
  { key: 'security', name: '安全合规', icon: 'shield-keyhole-line', focus: '个人信息与数据安全、权限、审计、法规合规（个人信息保护法、等保等）' },
  { key: 'ops', name: '运营交付', icon: 'tools-line', focus: '上线计划、运营流程、培训与支持、监控告警、成本与人力' },
  { key: 'user', name: '用户代言人', icon: 'user-heart-line', focus: '用户画像与旅程是否真实、痛点是否被需求覆盖、体验与可访问性' }
];
export function docDigest(p: Project, max = 9000) {
  const out = CHAPTERS.map(c => `【${c.title}】${JSON.stringify(currentContent(p, c.key)).slice(0, 1400)}`).join('\n');
  return out.length > max ? out.slice(0, max) + '…' : out;
}
export function reviewMessages(p: Project, role: string) {
  const r = ROLES.find(x => x.key === role)!;
  return [{ role: 'system', content: `你是一名${r.name}，正在评审一份软件概念设计文档。只关注你的专业视角：${r.focus}。严格只输出一个 JSON 对象。[[TASK:review]][[ROLE:${role}]]` },
    { role: 'user', content: `# 项目：${p.name}\n${docDigest(p)}\n\n请给出 2-6 条最重要的评审发现。chapter 必须是以下之一：${CHAPTERS.map(c => c.title).join('、')}。\n输出：{"findings":[{"chapter":"章节名","severity":"高|中|低","issue":"问题","suggestion":"可执行的修改建议"}]}` }];
}
export interface ChatMsg { id: string; role: 'user' | 'assistant'; text: string; at: string; actions?: ChatAction[]; quote?: string; error?: boolean; }
export interface ChatAction { chapter: string; instruction: string; label?: string; done?: boolean; }
export function chatMessages(p: Project, history: ChatMsg[], tpl?: PromptTpl) {
  const sys = `你是本项目的 AI 概念设计助手，熟悉下面的完整文档。用简体中文简洁回答。若用户希望修改文档，请在 actions 中给出结构化修改建议（每条对应一个章节和一条明确的修改指令），这些修改会作为草稿交给用户审核，不会直接生效。\n${tplText(tpl)}\n可用章节 key：${CHAPTERS.map(c => `${c.key}=${c.title}`).join('，')}。\n严格只输出一个 JSON 对象：{"reply":"回答（可用换行）","actions":[{"chapter":"章节key","instruction":"具体修改指令","label":"按钮文案"}]}，没有修改建议时 actions 为空数组。[[TASK:chat]]`;
  const ctx = `# 项目：${p.name}\n# 构想：${p.ai?.brief || p.description}\n${docDigest(p, 7000)}`;
  const hist = history.slice(-8).map(m => ({ role: m.role, content: m.role === 'user' ? (m.quote ? `（引用原文：「${m.quote}」）\n` : '') + m.text : m.text }));
  return [{ role: 'system', content: sys }, { role: 'user', content: ctx }, { role: 'assistant', content: '{"reply":"我已阅读完整文档，请问需要什么帮助？","actions":[]}' }, ...hist];
}
export function chapterKeyOf(name: string): string | null {
  if (!name) return null; const n = String(name).trim();
  const direct = CHAPTERS.find(c => c.key === n || c.title === n || n.includes(c.title) || c.title.includes(n)); if (direct) return direct.key;
  const alias: Record<string, string> = { 追溯矩阵: 'requirements', 优先级: 'requirements', 需求: 'requirements', 架构: 'arch', 风险: 'risks', 愿景: 'vision', 画像: 'personas', 旅程: 'journeys', 范围: 'scope', 功能: 'scope', 方案: 'options', 决策: 'decisions', 术语: 'glossary', 干系人: 'stakeholders' };
  for (const [a, k] of Object.entries(alias)) if (n.includes(a)) return k;
  return null;
}

// ---------------- usage & cost ----------------
export interface Usage { calls: number; prompt: number; completion: number; cached: number; }
export const PRICES: Record<string, [number, number]> = { deepseek: [2, 8], dashscope: [0.8, 2], openai: [1.1, 4.4], xai: [2.2, 3.6], moonshot: [12, 12], custom: [0, 0] }; // 元 / 百万 tokens
export const cost = (u: Usage | undefined, preset = 'custom') => { if (!u) return 0; const [a, b] = PRICES[preset] || [0, 0]; return (u.prompt * a + u.completion * b) / 1e6; };

// ---------------- snapshots ----------------
export interface Snapshot { id: string; at: string; label: string; data: string; }
const strip = (p: Project) => { const ai = p.ai ? { ...p.ai, snapshots: undefined, chat: undefined } : undefined; return JSON.stringify({ ...p, ai }); };
export function withSnapshot(p: Project, label: string): Project {
  const ai = p.ai || emptyAI(); const s: Snapshot = { id: uid(), at: now(), label, data: strip(p) };
  return { ...p, ai: { ...ai, snapshots: [s, ...(ai.snapshots || [])].slice(0, 20) } };
}
export function restoreSnapshot(p: Project, s: Snapshot): Project {
  const cur = withSnapshot(p, '恢复版本前自动快照');
  const old = JSON.parse(s.data) as Project;
  return { ...old, id: p.id, ai: { ...(old.ai || emptyAI()), snapshots: cur.ai!.snapshots, chat: p.ai?.chat } };
}
export function diffChapters(a: Project, b: Project) {
  return CHAPTERS.map(c => {
    const x = currentContent(a, c.key), y = currentContent(b, c.key);
    if (JSON.stringify(x) === JSON.stringify(y)) return null;
    if (c.kind === 'object') { const fields = Object.keys(c.fields).filter(f => (x?.[f] || '') !== (y?.[f] || '')); return { key: c.key, title: c.title, kind: 'object' as const, fields: fields.map(f => ({ f, label: c.fields[f], old: String(x?.[f] || ''), now: String(y?.[f] || '') })) }; }
    const id = c.idKey!; const xi = (x?.items || []) as any[], yi = (y?.items || []) as any[];
    const xs = new Map(xi.map(i => [String(i[id]), JSON.stringify(i)])), ys = new Map(yi.map(i => [String(i[id]), JSON.stringify(i)]));
    const added = [...ys.keys()].filter(k => !xs.has(k)), removed = [...xs.keys()].filter(k => !ys.has(k)), changed = [...ys.keys()].filter(k => xs.has(k) && xs.get(k) !== ys.get(k));
    return { key: c.key, title: c.title, kind: 'list' as const, added, removed, changed };
  }).filter(Boolean) as any[];
}
export const DEP_LEVELS: string[][] = [['vision'], ['stakeholders', 'personas'], ['journeys', 'scope', 'glossary'], ['requirements', 'options'], ['arch', 'risks', 'decisions']];
