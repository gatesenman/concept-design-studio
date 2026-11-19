import { Project } from './types';
import { uid, now } from './util';
import { defaultArch, defaultContext } from './templates';
import { evidenceFor, tplText, PromptTpl } from './aiplus';

export type ChStatus = 'empty' | 'pending' | 'accepted';
export interface ChapterAI { status: ChStatus; draft?: any; mode?: 'replace' | 'complete'; instruction?: string; updatedAt?: string; error?: string; }
export interface AIState { brief: string; docName?: string; docText?: string; chapters: Record<string, ChapterAI>; issues?: Issue[]; checkedAt?: string;
  materials?: import('./aiplus').Material[]; clarify?: { q: string; why?: string; options?: string[]; a: string }[]; usage?: import('./aiplus').Usage;
  reviews?: Finding[]; reviewedAt?: string; chat?: import('./aiplus').ChatMsg[]; snapshots?: import('./aiplus').Snapshot[]; cites?: Record<string, Record<string, import('./aiplus').Cite>>; }
export interface Finding { role: string; chapter: string; severity: '高' | '中' | '低'; issue: string; suggestion: string; }
export interface Issue { chapter: string; level: '高' | '中' | '低'; issue: string; suggestion: string; source: 'AI' | '规则'; }

type Kind = 'object' | 'list';
export interface ChapterDef { key: string; title: string; kind: Kind; idKey?: string; fields: Record<string, string>; schema: string; guide: string; }

export const CHAPTERS: ChapterDef[] = [
  { key: 'vision', title: '问题与愿景', kind: 'object', fields: { description: '项目简介', problem: '问题陈述', target: '目标用户', vision: '产品愿景', goals: '业务目标', nonGoals: '非目标', metrics: '成功指标', constraints: '约束条件' },
    schema: '{"description":"一句话项目简介","problem":"问题陈述","target":"目标用户/市场","vision":"产品愿景","goals":"业务目标，多条用换行分隔并编号","nonGoals":"明确不做的事","metrics":"可量化的成功指标","constraints":"时间/预算/技术/合规约束"}',
    guide: '提炼核心问题、目标用户与愿景，目标需可衡量（SMART）。' },
  { key: 'stakeholders', title: '干系人分析', kind: 'list', idKey: 'name', fields: { name: '名称', role: '角色', influence: '影响力', interest: '关注度', expectations: '期望', strategy: '策略' },
    schema: '{"items":[{"name":"干系人名称","role":"角色","influence":"高|中|低","interest":"高|中|低","expectations":"期望与诉求","strategy":"重点管理|保持满意|保持知情|持续关注"}]}', guide: '列出 4-7 个关键干系人（内部与外部）。' },
  { key: 'personas', title: '用户画像', kind: 'list', idKey: 'name', fields: { name: '姓名', role: '角色', age: '年龄', goals: '目标', pains: '痛点', behaviors: '行为特征', quote: '用户原声' },
    schema: '{"items":[{"name":"中文化名","role":"角色/身份","age":"年龄数字","goals":"目标","pains":"痛点","behaviors":"行为特征","quote":"一句代表性原话"}]}', guide: '为 2-3 类核心用户各建一个画像。' },
  { key: 'journeys', title: '用户旅程', kind: 'list', idKey: 'title', fields: { title: '旅程', persona: '画像', scenario: '场景', stages: '阶段' },
    schema: '{"items":[{"title":"旅程标题","persona":"对应画像姓名","scenario":"场景描述","stages":[{"name":"阶段名","action":"用户行为","touchpoint":"触点","emotion":1-5的整数,"pain":"痛点","opportunity":"机会点"}]}]}', guide: '为最核心的画像输出 1-2 条旅程，每条 4-6 个阶段。' },
  { key: 'scope', title: '功能范围', kind: 'list', idKey: 'name', fields: { name: '功能', epic: '史诗/模块', release: '版本', desc: '说明' },
    schema: '{"items":[{"name":"功能名称","epic":"所属模块","release":"MVP|V1.x|未来|不做","desc":"一句话说明"}]}', guide: '输出 8-14 个功能，按模块归组，明确 MVP 边界，并包含至少 1 个“不做”。' },
  { key: 'requirements', title: '需求池', kind: 'list', idKey: 'code', fields: { code: '编号', type: '类型', title: '标题', asA: '作为', iWant: '我希望', soThat: '以便', acceptance: '验收标准', moscow: 'MoSCoW', kano: 'Kano', feature: '关联功能', persona: '关联画像', value: '价值', effort: '工作量' },
    schema: '{"items":[{"code":"US-001 或 NFR-001","type":"用户故事|功能需求|非功能需求|约束","title":"简短标题","asA":"角色","iWant":"功能","soThat":"价值","acceptance":"Given/When/Then 验收标准，换行分隔","moscow":"Must|Should|Could|Won\'t","kano":"基本型|期望型|兴奋型|无差异|反向型","feature":"必须是功能范围中已有的功能名称","persona":"画像姓名或空","value":1-10,"effort":1-10}]}',
    guide: '输出 8-14 条需求（含 1-3 条非功能需求），每条 Must 必须有验收标准，feature 必须引用功能范围中的名称。' },
  { key: 'options', title: '方案对比', kind: 'list', idKey: 'name', fields: { name: '方案', desc: '描述', pros: '优势', cons: '劣势', scores: '评分' },
    schema: '{"criteria":[{"name":"评估维度","weight":权重整数，合计100}],"items":[{"name":"方案名称","desc":"描述","pros":"优势","cons":"劣势","scores":{"评估维度名称":0-10的分数}}]}', guide: '给出 4-6 个评估维度和 2-4 个差异明显的候选方案（如自研/采购/低代码/云服务）。' },
  { key: 'arch', title: '架构草图', kind: 'object', fields: { contextDiagram: '系统上下文图 (Mermaid)', architecture: '逻辑架构图 (Mermaid)' },
    schema: '{"contextDiagram":"Mermaid flowchart 代码，展示系统与外部用户/系统关系","architecture":"Mermaid flowchart 代码，展示逻辑分层与组件"}', guide: '基于推荐方案输出两张 Mermaid flowchart；节点 ID 用英文，标签用中文，用 \\n 换行，不要使用 ``` 包裹。' },
  { key: 'risks', title: '风险与假设', kind: 'list', idKey: 'desc', fields: { kind: '类型', desc: '描述', probability: '概率', impact: '影响', mitigation: '应对', owner: '负责人' },
    schema: '{"items":[{"kind":"风险|假设|问题|依赖","desc":"描述","probability":1-5,"impact":1-5,"mitigation":"应对/验证方式","owner":"负责角色"}]}', guide: '输出 6-10 条，覆盖技术、业务、合规、进度，并包含关键假设。' },
  { key: 'decisions', title: '决策记录', kind: 'list', idKey: 'title', fields: { title: '标题', context: '背景', decision: '决策', consequences: '影响' },
    schema: '{"items":[{"title":"ADR-001 决策标题","context":"背景","decision":"决策","consequences":"影响"}]}', guide: '记录 2-4 个关键架构/产品决策。' },
  { key: 'glossary', title: '术语表', kind: 'list', idKey: 'term', fields: { term: '术语', en: '英文', definition: '定义' },
    schema: '{"items":[{"term":"术语","en":"英文","definition":"定义"}]}', guide: '提取 6-12 个业务关键术语。' }
];
export const chapterDef = (k: string) => CHAPTERS.find(c => c.key === k);
export const emptyAI = (): AIState => ({ brief: '', chapters: {} });

/** current content of a chapter in the generic draft shape (used for diff + context) */
export function currentContent(p: Project, k: string): any {
  const per = (id: string) => p.personas.find(x => x.id === id)?.name || '';
  const feat = (id: string) => p.features.find(x => x.id === id)?.name || '';
  switch (k) {
    case 'vision': return { description: p.description, ...p.vision };
    case 'stakeholders': return { items: p.stakeholders };
    case 'personas': return { items: p.personas };
    case 'journeys': return { items: p.journeys.map(j => ({ ...j, persona: per(j.personaId) })) };
    case 'scope': return { items: p.features };
    case 'requirements': return { items: p.requirements.map(r => ({ ...r, feature: feat(r.featureId), persona: per(r.personaId) })) };
    case 'options': return { criteria: p.criteria, items: p.options.map(o => ({ ...o, scores: Object.fromEntries(p.criteria.map(c => [c.name, o.scores[c.id] ?? 0])) })) };
    case 'arch': return { contextDiagram: p.contextDiagram, architecture: p.architecture };
    case 'risks': return { items: p.risks };
    case 'decisions': return { items: p.decisions };
    case 'glossary': return { items: p.glossary };
  }
}
export function hasContent(p: Project, k: string) {
  const c = currentContent(p, k); if (!c) return false;
  if (k === 'vision') return Object.values(p.vision).some(v => v.trim());
  if (k === 'arch') return (p.architecture.trim() !== '' && p.architecture !== defaultArch) || (p.contextDiagram.trim() !== '' && p.contextDiagram !== defaultContext);
  return (c.items || []).length > 0;
}
export function chapterStatus(p: Project, k: string): ChStatus {
  const a = p.ai?.chapters[k];
  if (a?.status === 'pending' && a.draft) return 'pending';
  if (a?.status === 'accepted' || hasContent(p, k)) return 'accepted';
  return 'empty';
}
export const STATUS_LABEL: Record<ChStatus, string> = { empty: '待生成', pending: '待审核', accepted: '已采纳' };

// ---------------- prompt building ----------------
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);
function summarize(p: Project, k: string, src: any): string {
  if (!src) return '';
  if (k === 'vision' || k === 'arch') return JSON.stringify(src);
  if (k === 'options') return JSON.stringify({ criteria: (src.criteria || []).map((c: any) => `${c.name}(${c.weight})`), options: (src.items || []).map((o: any) => o.name) });
  const pick: Record<string, string[]> = { stakeholders: ['name', 'role'], personas: ['name', 'role', 'goals', 'pains'], journeys: ['title', 'persona'], scope: ['name', 'epic', 'release'], requirements: ['code', 'title', 'moscow', 'feature'], risks: ['kind', 'desc'], decisions: ['title', 'decision'], glossary: ['term'] };
  return JSON.stringify((src.items || []).map((it: any) => Object.fromEntries((pick[k] || ['name']).map(f => [f, it[f]]))));
}
export function buildMessages(p: Project, k: string, opts: { instruction?: string; complete?: boolean; useDrafts?: Record<string, any>; tpl?: PromptTpl; budget?: number } = {}) {
  const def = chapterDef(k)!; const ai = p.ai || emptyAI(); const idx = CHAPTERS.findIndex(c => c.key === k);
  const budget = opts.budget ?? 9000;
  const parts = CHAPTERS.slice(0, idx).map(c => {
    const st = ai.chapters[c.key]; const draft = opts.useDrafts?.[c.key] || (st?.status === 'pending' ? st.draft : null);
    const src = chapterStatus(p, c.key) === 'accepted' ? currentContent(p, c.key) : draft;
    return { c, s: summarize(p, c.key, src) };
  }).filter(x => x.s);
  // token budgeting: if too long, compress older chapters to names only
  let total = parts.reduce((s, x) => s + x.s.length, 0); let compressed = 0;
  for (const x of parts) { if (total <= budget) break; const short = clip(x.s, 300); total -= x.s.length - short.length; x.s = short; compressed++; }
  const ctx = parts.map(x => `【${x.c.title}】${clip(x.s, 2500)}`).join('\n');
  const style = tplText(opts.tpl);
  const ev = evidenceFor(p, k, opts.instruction || '');
  const sys = `你是资深解决方案工程师、产品经理与需求分析师，正在为软件项目做概念设计。请用简体中文输出专业、具体、可落地的内容。\n${style ? style + '\n' : ''}严格只输出一个 JSON 对象，不要输出 Markdown 代码块或任何解释文字。\n[[CHAPTER:${k}]]`;
  let user = `# 项目名称\n${p.name}\n\n# 项目构想（用户输入）\n${ai.brief || p.description || '（未提供）'}\n`;
  if (ai.clarify?.length) user += `\n# 需求澄清问答（务必遵循）\n${ai.clarify.filter(c => c.a?.trim()).map((c, i) => `Q${i + 1}：${c.q}\nA${i + 1}：${c.a}`).join('\n')}\n`;
  if (ev.block) user += `\n# 参考资料片段（证据）\n${ev.block}\n引用规则：凡是依据上述资料得出的条目，请在该条目中加入 "sources":["S1"] 字段（对象型章节在顶层加 "sources"）；不要编造资料中没有的事实。\n`;
  if (ctx) user += `\n# 已完成的前序章节${compressed ? `（为控制长度，已压缩 ${compressed} 章摘要）` : ''}（请保持一致并在此基础上展开）\n${ctx}\n`;
  user += `\n# 当前任务：生成「${def.title}」章节\n要求：${def.guide}\n输出 JSON 结构：${def.schema}\n`;
  if (opts.complete) user += `\n# 补全模式\n该章节已有内容如下，请只输出缺失的、新增的条目（不要重复已有条目）：\n${clip(JSON.stringify(currentContent(p, k)), 4000)}\n`;
  if (opts.instruction) user += `\n# 额外要求（优先满足）\n${opts.instruction}\n`;
  const msgs = [{ role: 'system', content: sys }, { role: 'user', content: user }];
  return Object.assign(msgs, { cites: ev.cites });
}
export function consistencyMessages(p: Project) {
  const all = CHAPTERS.map(c => `【${c.title}】${clip(summarize(p, c.key, currentContent(p, c.key)), 2000)}`).join('\n');
  return [{ role: 'system', content: '你是严谨的需求评审专家。严格只输出一个 JSON 对象。[[TASK:consistency]]' },
    { role: 'user', content: `请对以下概念设计文档做跨章节一致性与完整性审查，找出矛盾、遗漏、不可验证或范围不清的问题。\n${all}\n输出：{"issues":[{"chapter":"章节名","level":"高|中|低","issue":"问题","suggestion":"修改建议"}]}` }];
}

// ---------------- parsing & normalization ----------------
export function parseJSON(text: string): any {
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('AI 输出中未找到 JSON 对象');
  return JSON.parse(t.slice(a, b + 1));
}
const pickEnum = <T extends string>(v: any, opts: readonly T[], d: T): T => (opts.includes(v) ? v : (opts.find(o => String(v || '').includes(o)) || d));
const num = (v: any, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const str = (v: any) => (v == null ? '' : Array.isArray(v) ? v.join('\n') : typeof v === 'object' ? JSON.stringify(v) : String(v));
export function normalize(k: string, j: any): any {
  const r = normalize0(k, j);
  const srcs = (v: any) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,，\s]+/) : []).map((s: any) => String(s).replace(/[\[\]]/g, '').trim()).filter((s: string) => /^S\d+$/.test(s));
  const raw = (Array.isArray(j?.items) ? j.items : []) as any[];
  if (r && Array.isArray(r.items)) r.items = r.items.map((x: any, i: number) => { const s = srcs(raw[i]?.sources); return s.length ? { ...x, sources: s } : x; });
  else if (r && typeof r === 'object') { const s = srcs(j?.sources); if (s.length) r.sources = s; }
  return r;
}
function normalize0(k: string, j: any): any {
  const items = (Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : []) as any[];
  const L = ['高', '中', '低'] as const;
  switch (k) {
    case 'vision': return Object.fromEntries(Object.keys(chapterDef(k)!.fields).map(f => [f, str(j?.[f])]));
    case 'arch': return { contextDiagram: str(j?.contextDiagram).replace(/^```(mermaid)?|```$/g, '').trim(), architecture: str(j?.architecture).replace(/^```(mermaid)?|```$/g, '').trim() };
    case 'stakeholders': return { items: items.map(x => ({ name: str(x.name), role: str(x.role), influence: pickEnum(x.influence, L, '中'), interest: pickEnum(x.interest, L, '中'), expectations: str(x.expectations), strategy: pickEnum(x.strategy, ['重点管理', '保持满意', '保持知情', '持续关注'] as const, '保持知情') })) };
    case 'personas': return { items: items.map(x => ({ name: str(x.name), role: str(x.role), age: str(x.age), goals: str(x.goals), pains: str(x.pains), behaviors: str(x.behaviors), quote: str(x.quote) })) };
    case 'journeys': return { items: items.map(x => ({ title: str(x.title), persona: str(x.persona), scenario: str(x.scenario), stages: (Array.isArray(x.stages) ? x.stages : []).map((s: any) => ({ name: str(s.name), action: str(s.action), touchpoint: str(s.touchpoint), emotion: num(s.emotion, 1, 5, 3), pain: str(s.pain), opportunity: str(s.opportunity) })) })) };
    case 'scope': return { items: items.map(x => ({ name: str(x.name), epic: str(x.epic) || '核心', release: pickEnum(x.release, ['MVP', 'V1.x', '未来', '不做'] as const, 'MVP'), desc: str(x.desc) })) };
    case 'requirements': return { items: items.map((x, i) => ({ code: str(x.code) || `US-${String(i + 1).padStart(3, '0')}`, type: pickEnum(x.type, ['用户故事', '功能需求', '非功能需求', '约束'] as const, '用户故事'), title: str(x.title), asA: str(x.asA), iWant: str(x.iWant), soThat: str(x.soThat), acceptance: str(x.acceptance), moscow: pickEnum(x.moscow, ['Must', 'Should', 'Could', "Won't"] as const, 'Should'), kano: pickEnum(x.kano, ['基本型', '期望型', '兴奋型', '无差异', '反向型'] as const, '期望型'), feature: str(x.feature), persona: str(x.persona), value: num(x.value, 1, 10, 5), effort: num(x.effort, 1, 10, 5) })) };
    case 'options': return { criteria: (Array.isArray(j?.criteria) ? j.criteria : []).map((c: any) => ({ name: str(c.name), weight: num(c.weight, 0, 100, 20) })), items: items.map(x => ({ name: str(x.name), desc: str(x.desc), pros: str(x.pros), cons: str(x.cons), scores: Object.fromEntries(Object.entries(x.scores || {}).map(([a, b]) => [a, num(b, 0, 10, 5)])) })) };
    case 'risks': return { items: items.map(x => ({ kind: pickEnum(x.kind, ['风险', '假设', '问题', '依赖'] as const, '风险'), desc: str(x.desc), probability: num(x.probability, 1, 5, 3), impact: num(x.impact, 1, 5, 3), mitigation: str(x.mitigation), owner: str(x.owner), status: '开放' })) };
    case 'decisions': return { items: items.map(x => ({ title: str(x.title), context: str(x.context), decision: str(x.decision), consequences: str(x.consequences), status: '提议', date: now().slice(0, 10) })) };
    case 'glossary': return { items: items.map(x => ({ term: str(x.term), en: str(x.en), definition: str(x.definition) })) };
  }
  return j;
}

// ---------------- diff & apply ----------------
export type ItemState = 'new' | 'update' | 'same';
export function diffItem(p: Project, k: string, item: any): { state: ItemState; old?: any } {
  const def = chapterDef(k)!; const cur = currentContent(p, k)?.items || [];
  const old = cur.find((x: any) => String(x[def.idKey!] || '').trim() === String(item[def.idKey!] || '').trim());
  if (!old) return { state: 'new' };
  const changed = Object.keys(def.fields).some(f => JSON.stringify(old[f] ?? '') !== JSON.stringify(item[f] ?? ''));
  return { state: changed ? 'update' : 'same', old };
}
/** apply accepted draft (selection = indexes for lists, field names for objects) */
export function applyDraft(p: Project, k: string, draft: any, sel: Set<string>): Project {
  const def = chapterDef(k)!; let q: Project = { ...p };
  const items: any[] = (draft.items || []).filter((_: any, i: number) => sel.has(String(i)));
  const merge = <T extends { id: string }>(list: T[], key: string, build: (x: any, old?: T) => T) => {
    const out = [...list];
    for (const it of items) { const i = out.findIndex((o: any) => String(o[key] || '').trim() === String(it[key] || '').trim()); if (i >= 0) out[i] = build(it, out[i]); else out.push(build(it)); }
    return out;
  };
  switch (k) {
    case 'vision': { const v = { ...q.vision } as any; Object.keys(def.fields).forEach(f => { if (sel.has(f) && f !== 'description') v[f] = draft[f]; }); q.vision = v; if (sel.has('description')) q.description = draft.description; break; }
    case 'arch': if (sel.has('contextDiagram')) q.contextDiagram = draft.contextDiagram; if (sel.has('architecture')) q.architecture = draft.architecture; break;
    case 'stakeholders': q.stakeholders = merge(q.stakeholders, 'name', (x, o) => ({ ...x, id: o?.id || uid() })); break;
    case 'personas': { const colors = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4']; let n = q.personas.length; q.personas = merge(q.personas, 'name', (x, o) => ({ ...x, id: o?.id || uid(), color: o?.color || colors[n++ % colors.length] })); break; }
    case 'journeys': q.journeys = merge(q.journeys, 'title', (x, o) => ({ id: o?.id || uid(), title: x.title, scenario: x.scenario, sources: x.sources, personaId: q.personas.find(pp => pp.name === x.persona)?.id || q.personas[0]?.id || '', stages: x.stages.map((s: any) => ({ ...s, id: uid() })) })); break;
    case 'scope': q.features = merge(q.features, 'name', (x, o) => ({ ...x, id: o?.id || uid() })); break;
    case 'requirements': q.requirements = merge(q.requirements, 'code', (x, o) => { const { feature, persona, ...rest } = x;
      const f = q.features.find(ff => ff.name === feature) || q.features.find(ff => feature && (ff.name.includes(feature) || feature.includes(ff.name)));
      return { ...rest, id: o?.id || uid(), status: o?.status || '草稿', featureId: f?.id || '', personaId: q.personas.find(pp => pp.name === persona)?.id || '', stakeholderIds: o?.stakeholderIds || [] }; }); break;
    case 'options': {
      if (sel.has('criteria') && draft.criteria?.length) { q.criteria = draft.criteria.map((c: any) => ({ id: q.criteria.find(o => o.name === c.name)?.id || uid(), name: c.name, weight: c.weight })); q.options = q.options.map(o => ({ ...o })); }
      q.options = merge(q.options, 'name', (x, o) => ({ id: o?.id || uid(), name: x.name, desc: x.desc, pros: x.pros, cons: x.cons, sources: x.sources, scores: Object.fromEntries(q.criteria.map(c => [c.id, x.scores?.[c.name] ?? o?.scores?.[c.id] ?? 0])) })); break; }
    case 'risks': q.risks = merge(q.risks, 'desc', (x, o) => ({ ...x, id: o?.id || uid(), status: o?.status || '开放' })); break;
    case 'decisions': q.decisions = merge(q.decisions, 'title', (x, o) => ({ ...x, id: o?.id || uid(), status: o?.status || '提议' })); break;
    case 'glossary': q.glossary = merge(q.glossary, 'term', (x, o) => ({ ...x, id: o?.id || uid() })); break;
  }
  const ai = q.ai || emptyAI();
  const cites = draft._cites && Object.keys(draft._cites).length ? { ...(ai.cites || {}), [k]: { ...(ai.cites?.[k] || {}), ...draft._cites } } : ai.cites;
  const chSources = draft.sources ? { ...(ai as any).chSources, [k]: draft.sources } : (ai as any).chSources;
  q.ai = { ...ai, cites, chSources, chapters: { ...ai.chapters, [k]: { status: 'accepted', updatedAt: now() } } } as any;
  return q;
}

/** rule-based consistency checks (no AI needed) */
export function localIssues(p: Project): Issue[] {
  const out: Issue[] = []; const add = (chapter: string, level: Issue['level'], issue: string, suggestion: string) => out.push({ chapter, level, issue, suggestion, source: '规则' });
  if (!p.vision.problem.trim()) add('问题与愿景', '高', '缺少问题陈述', '先用一两句话说明要解决的核心问题');
  p.requirements.filter(r => r.moscow === 'Must' && !r.acceptance.trim()).forEach(r => add('需求池', '高', `${r.code} 为 Must 但没有验收标准`, '补充 Given/When/Then 验收标准'));
  p.requirements.filter(r => !r.featureId).forEach(r => add('追溯矩阵', '中', `${r.code} 未关联任何功能`, '在需求详情中选择关联功能'));
  p.features.filter(f => f.release === 'MVP' && !p.requirements.some(r => r.featureId === f.id)).forEach(f => add('功能范围', '中', `MVP 功能「${f.name}」没有需求支撑`, '补充对应用户故事，或调整版本'));
  p.personas.filter(x => !p.requirements.some(r => r.personaId === x.id) && !p.journeys.some(j => j.personaId === x.id)).forEach(x => add('用户画像', '低', `画像「${x.name}」未被任何需求或旅程引用`, '确认该画像是否必要，或补充相关需求'));
  const tw = p.criteria.reduce((s, c) => s + c.weight, 0); if (p.options.length && tw !== 100) add('方案对比', '低', `评估权重合计为 ${tw}%`, '调整权重使合计为 100%');
  if (p.risks.filter(r => r.probability * r.impact >= 15 && !r.mitigation.trim()).length) add('风险与假设', '高', '存在没有应对措施的高风险项', '为高风险项补充应对/验证方式');
  return out;
}

/** simple word-level diff tokens for review UI */
export function wordDiff(oldS: string, newS: string): { t: string; k: 'eq' | 'del' | 'add' }[] {
  const a = String(oldS || '').split(/(\s+)/).filter(x => x.length);
  const b = String(newS || '').split(/(\s+)/).filter(x => x.length);
  // LCS DP (bounded for UI)
  if (a.length * b.length > 8000) return [{ t: String(newS || ''), k: 'add' }];
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const out: { t: string; k: 'eq' | 'del' | 'add' }[] = [];
  let i = n, j = m;
  const rev: typeof out = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) { rev.push({ t: a[i - 1], k: 'eq' }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { rev.push({ t: b[j - 1], k: 'add' }); j--; }
    else { rev.push({ t: a[i - 1], k: 'del' }); i--; }
  }
  rev.reverse();
  // merge adjacent same kind
  for (const t of rev) {
    const last = out[out.length - 1];
    if (last && last.k === t.k) last.t += t.t; else out.push({ ...t });
  }
  return out;
}
