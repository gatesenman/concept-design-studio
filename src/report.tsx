import { CiteChips, CiteFooter } from './aiui2';
import React from 'react';
import { useStore } from './store';
import { I, Tag } from './ui';
import { Mermaid } from './pages1';
import { weighted } from './exporter';
import { chapterStatus, CHAPTERS } from './ai';
import { progress, metaOf, NAV } from './meta';
import { useNav } from './nav';
import { Project } from './types';

const reviewProgress = (p: Project) => {
  const n = CHAPTERS.length;
  const acc = CHAPTERS.filter(c => chapterStatus(p, c.key) === 'accepted').length;
  const pend = CHAPTERS.filter(c => chapterStatus(p, c.key) === 'pending').length;
  return { n, acc, pend };
};
const dash = (s?: string) => (s && String(s).trim()) || '—';
const fname = (p: Project, id: string) => p.features.find(f => f.id === id)?.name || '—';
const pname = (p: Project, id: string) => p.personas.find(x => x.id === id)?.name || '—';

function EmptyHint({ text }: { text: string }) {
  return <p className="rp-empty muted">{text}</p>;
}

export function ReportCover() {
  const { project: p, prefs, setPrefs } = useStore(); const nav = useNav();
  if (!p) return null;
  const rp = reviewProgress(p);
  const v = p.vision;
  const done = NAV.filter(n => progress(p, n.key) !== null).filter(n => (progress(p, n.key) || 0) >= 0.8).length;
  const total = NAV.filter(n => progress(p, n.key) !== null).length;
  const best = weighted(p).sort((a, b) => b.score - a.score)[0];
  const mos = ['Must', 'Should', 'Could', "Won't"] as const;
  return <div className="rp-cover" data-testid="report-cover">
    <div className="rp-cover-badge"><I n="file-paper-2-line" /> 软件概念设计说明书</div>
    <h1 className="rp-title" data-testid="report-title">{p.name}</h1>
    <p className="rp-subtitle">{p.description || '概念探索阶段设计报告'}</p>
    <div className="rp-meta-row">
      <span><I n="user-line" /> {dash(p.owner) === '—' ? '未指定负责人' : p.owner}</span>
      <span><I n="flag-line" /> {p.phase}</span>
      <span><I n="calendar-line" /> 更新于 {new Date(p.updatedAt).toLocaleString('zh-CN', { hour12: false })}</span>
      <span><I n="price-tag-3-line" /> {p.template}</span>
    </div>
    <blockquote className="rp-pitch">
      <I n="double-quotes-l" c="rp-q" />
      <div>针对 <em>{dash(v.target)}</em>，他们面临 <em>{dash(v.problem)}</em>；我们的愿景是 <em>{dash(v.vision)}</em>，以 <em>{dash(v.metrics)}</em> 衡量成功。</div>
    </blockquote>
    <div className="rp-stats">
      <div className="rp-stat"><b data-testid="kpi-req">{p.requirements.length}</b><span>需求</span></div>
      <div className="rp-stat"><b>{p.features.length}</b><span>功能</span></div>
      <div className="rp-stat"><b>{p.personas.length}</b><span>画像</span></div>
      <div className="rp-stat"><b>{p.risks.length}</b><span>风险项</span></div>
      <div className="rp-stat ok"><b data-testid="kpi-ready">{Math.round(done / Math.max(total, 1) * 100)}%</b><span>完备度</span></div>
      <div className="rp-stat"><b data-testid="report-review">{rp.acc}/{rp.n}</b><span>AI 已采纳</span></div>
    </div>
    <div className="rp-mos">{mos.map(m => {
      const n = p.requirements.filter(r => r.moscow === m).length;
      const pct = p.requirements.length ? n / p.requirements.length * 100 : 0;
      return <div key={m} className="rp-mos-row"><span>{m}</span><div className="rp-mos-bar"><i className={'m-' + m.replace("'", '')} style={{ width: pct + '%' }} /></div><b>{n}</b></div>;
    })}</div>
    {best && <div className="rp-rec"><I n="trophy-line" /> 推荐方案：<b>{best.o.name}</b><span className="muted">加权得分 {best.score.toFixed(2)}</span></div>}
    <div className="rp-cover-actions">
      <button className="btn primary" data-testid="cover-to-edit" onClick={() => setPrefs({ docMode: 'edit' })}><I n="edit-2-line" /> 进入编辑模式完善</button>
      <button className="btn" onClick={() => nav.go('export')}><I n="upload-2-line" /> 导出报告</button>
      {prefs.docMode !== 'edit' && rp.pend > 0 && <button className="btn" onClick={() => { setPrefs({ docMode: 'edit' }); nav.go('ai'); }}><I n="eye-line" /> 审核 {rp.pend} 章待审草稿</button>}
    </div>
  </div>;
}

export function ReportAI() {
  const { project: p, setPrefs } = useStore(); const nav = useNav(); if (!p) return null;
  const rp = reviewProgress(p); const brief = p.ai?.brief;
  return <div className="rp-block" data-testid="page-ai">
    {brief ? <div className="rp-brief"><h4>项目构想</h4><p>{brief}</p></div> : <EmptyHint text="尚未填写 AI 项目构想。可在编辑模式中完善。" />}
    <div className="rp-chips">{CHAPTERS.map((c, i) => {
      const s = chapterStatus(p, c.key);
      return <span key={c.key} className={'rp-chip ' + s}><em>{i + 1}</em>{c.title}{s === 'accepted' ? <I n="check-line" /> : s === 'pending' ? <I n="eye-line" /> : null}</span>;
    })}</div>
    <p className="muted small">审核进度 {rp.acc}/{rp.n}{rp.pend ? ` · ${rp.pend} 章待审` : ''}</p>
    <button className="btn sm" onClick={() => { setPrefs({ docMode: 'edit' }); nav.go('ai'); }}><I n="sparkling-2-line" /> 在编辑模式使用 AI</button>
  </div>;
}

export function ReportVision() {
  const { project: p } = useStore(); if (!p) return null; const v = p.vision;
  const rows: [string, string][] = [['问题陈述', v.problem], ['目标用户', v.target], ['产品愿景', v.vision], ['业务目标', v.goals], ['非目标', v.nonGoals], ['成功指标', v.metrics], ['约束条件', v.constraints]];
  return <div className="rp-block" data-testid="page-vision">
    <div className="rp-statement">针对 <u>{dash(v.target)}</u>，他们面临 <u>{dash(v.problem)}</u>；愿景是 <u>{dash(v.vision)}</u>。</div>
    <dl className="rp-dl">{rows.map(([k, val]) => <React.Fragment key={k}><dt>{k}</dt><dd className="pre">{dash(val)}</dd></React.Fragment>)}</dl>
  </div>;
}

export function ReportStakeholders() {
  const { project: p } = useStore(); if (!p) return null;
  const quad = (s: any) => s.influence === '高' ? (s.interest === '高' ? 0 : 1) : (s.interest === '高' ? 2 : 3);
  const names = ['重点管理', '保持满意', '保持知情', '持续关注'];
  if (!p.stakeholders.length) return <div className="rp-block" data-testid="page-stakeholders"><EmptyHint text="暂无干系人记录" /></div>;
  return <div className="rp-block" data-testid="page-stakeholders">
    <table className="rp-table" data-testid="sh-table"><thead><tr><th>名称</th><th>角色</th><th>影响力</th><th>关注度</th><th>期望</th><th>策略</th></tr></thead>
      <tbody>{p.stakeholders.map(s => <tr key={s.id}><td><b>{s.name}</b></td><td>{s.role}</td><td>{s.influence}</td><td>{s.interest}</td><td>{s.expectations}</td><td>{s.strategy}</td></tr>)}</tbody></table>
    <div className="rp-matrix">{names.map((n, i) => <div key={n} className={'rp-q q' + i}><h4>{n}</h4><div className="chips">{p.stakeholders.filter(s => quad(s) === i).map(s => <span className="chip" key={s.id}>{s.name}</span>)}</div></div>)}</div>
  </div>;
}

export function ReportPersonas() {
  const { project: p } = useStore(); if (!p) return null;
  if (!p.personas.length) return <div className="rp-block" data-testid="page-personas"><EmptyHint text="暂无用户画像" /></div>;
  return <div className="rp-block" data-testid="page-personas"><div className="rp-persona-grid">{p.personas.map(q =>
    <article key={q.id} className="rp-persona" data-testid="persona-card" style={{ borderTopColor: q.color }}>
      <header><div className="rp-avatar" style={{ background: q.color }}>{q.name.slice(0, 1)}</div>
        <div><b>{q.name}</b><span className="muted">{q.role}{q.age ? ` · ${q.age} 岁` : ''}</span></div></header>
      {q.quote && <blockquote>「{q.quote}」</blockquote>}
      <div className="rp-kv"><span>目标</span><p>{dash(q.goals)}</p></div>
      <div className="rp-kv"><span>痛点</span><p>{dash(q.pains)}</p></div>
      <div className="rp-kv"><span>行为</span><p>{dash(q.behaviors)}</p></div>
    </article>)}</div></div>;
}

export function ReportJourneys() {
  const { project: p } = useStore(); if (!p) return null;
  if (!p.journeys.length) return <div className="rp-block" data-testid="page-journeys"><EmptyHint text="暂无用户旅程" /></div>;
  return <div className="rp-block" data-testid="page-journeys">{p.journeys.map(j => {
    const pe = pname(p, j.personaId);
    return <div key={j.id} className="rp-journey">
      <h4>{j.title}{pe !== '—' && <span className="muted"> · {pe}</span>}</h4>
      {j.scenario && <p className="rp-scen">{j.scenario}</p>}
      <div className="rp-stages">{j.stages.map(s => <div key={s.id} className="rp-stage">
        <div className="rp-stage-h"><b>{s.name}</b><span className={'emo-pill e' + s.emotion}>情绪 {s.emotion}</span></div>
        <p><span className="k">行为</span>{dash(s.action)}</p>
        <p><span className="k">触点</span>{dash(s.touchpoint)}</p>
        {s.pain && <p className="pain"><span className="k">痛点</span>{s.pain}</p>}
        {s.opportunity && <p className="opp"><span className="k">机会</span>{s.opportunity}</p>}
      </div>)}</div>
    </div>;
  })}</div>;
}

export function ReportScope() {
  const { project: p } = useStore(); if (!p) return null;
  if (!p.features.length) return <div className="rp-block" data-testid="page-scope"><EmptyHint text="暂无功能范围" /></div>;
  const rel = ['MVP', 'V1.x', '未来', '不做'] as const;
  return <div className="rp-block" data-testid="page-scope">
    <table className="rp-table" data-testid="feat-table"><thead><tr><th>功能</th><th>史诗</th><th>版本</th><th>说明</th><th>关联需求</th></tr></thead>
      <tbody>{p.features.map(f => <tr key={f.id}><td><b>{f.name}</b></td><td>{f.epic}</td><td><Tag c={f.release === 'MVP' ? 'green' : f.release === '不做' ? 'gray' : 'blue'}>{f.release}</Tag></td><td>{f.desc}</td><td>{p.requirements.filter(r => r.featureId === f.id).length}</td></tr>)}</tbody></table>
    <div className="rp-rel-tags">{rel.map(r => <div key={r} className="rp-rel"><h5>{r}</h5><div className="chips">{p.features.filter(f => f.release === r).map(f => <span className="chip" key={f.id}>{f.name}</span>)}</div></div>)}</div>
  </div>;
}

export function ReportRequirements() {
  const { project: p } = useStore(); if (!p) return null;
  const mc: any = { Must: 'red', Should: 'orange', Could: 'blue', "Won't": 'gray' };
  if (!p.requirements.length) return <div className="rp-block" data-testid="page-requirements"><EmptyHint text="暂无需求" /></div>;
  return <div className="rp-block" data-testid="page-requirements">
    <table className="rp-table" data-testid="req-table"><thead><tr><th>编号</th><th>标题</th><th>描述</th><th>MoSCoW</th><th>Kano</th><th>价值</th><th>功能</th></tr></thead>
      <tbody>{p.requirements.map(r => <tr key={r.id}>
        <td><b>{r.code}</b></td><td>{r.title}<CiteChips compact ids={(r as any).sources} cites={p.ai?.cites?.requirements} /></td>
        <td className="desc">{r.type === '用户故事' ? `作为${r.asA || '…'}，我希望${r.iWant || '…'}，以便${r.soThat || '…'}` : r.iWant}</td>
        <td><Tag c={mc[r.moscow]}>{r.moscow}</Tag></td><td>{r.kano}</td><td>{r.value}/{r.effort}</td><td>{fname(p, r.featureId)}</td>
      </tr>)}</tbody></table>
  </div>;
}

export function ReportPriority() {
  const { project: p } = useStore(); if (!p) return null;
  const cols = [['Must', '必须有'], ['Should', '应该有'], ['Could', '可以有'], ["Won't", '这次不做']] as const;
  return <div className="rp-block" data-testid="page-priority">
    <div className="rp-board">{cols.map(([m, l]) => <div key={m} className={'rp-lane m-' + m.replace("'", '')} data-testid={'lane-' + m.replace("'", '')}>
      <h4>{m} <small>{l}</small><b>{p.requirements.filter(r => r.moscow === m).length}</b></h4>
      {p.requirements.filter(r => r.moscow === m).map(r => <div key={r.id} className="rp-kcard" data-testid={'kcard-' + r.code}><b>{r.code}</b> {r.title}<div className="muted">价值 {r.value} · 工作量 {r.effort}</div></div>)}
    </div>)}</div>
  </div>;
}

export function ReportTrace() {
  const { project: p } = useStore(); if (!p) return null;
  const cols = p.features;
  return <div className="rp-block" data-testid="page-trace">
    {!cols.length || !p.requirements.length ? <EmptyHint text="需同时具备需求与功能才能展示追溯矩阵" /> :
    <table className="rp-table rp-trace" data-testid="trace-table"><thead><tr><th>需求</th>{cols.map(c => <th key={c.id} className="vert"><span>{c.name}</span></th>)}</tr></thead>
      <tbody>{p.requirements.map(r => <tr key={r.id}><td><b>{r.code}</b> {r.title}</td>
        {cols.map(c => <td key={c.id} className={'tc ' + (r.featureId === c.id ? 'on' : '')}>{r.featureId === c.id ? <I n="checkbox-blank-circle-fill" /> : ''}</td>)}</tr>)}</tbody></table>}
  </div>;
}

export function ReportOptions() {
  const { project: p } = useStore(); if (!p) return null;
  const res = weighted(p); const max = Math.max(...res.map(r => r.score), 0);
  if (!p.options.length) return <div className="rp-block" data-testid="page-options"><EmptyHint text="暂无候选方案" /></div>;
  return <div className="rp-block" data-testid="page-options">
    <table className="rp-table" data-testid="opt-table"><thead><tr><th>方案</th>{p.criteria.map(c => <th key={c.id}>{c.name}<br /><small>{c.weight}%</small></th>)}<th>加权得分</th></tr></thead>
      <tbody>{res.map(({ o, score }) => <tr key={o.id} className={score === max && max > 0 ? 'best' : ''}>
        <td><b>{o.name}</b><div className="muted small">{o.desc}</div></td>
        {p.criteria.map(c => <td key={c.id}>{o.scores[c.id] ?? 0}</td>)}
        <td><b data-testid="opt-score">{score.toFixed(2)}</b>{score === max && max > 0 && <Tag c="green">推荐</Tag>}
          <div className="sbar"><i style={{ width: score * 10 + '%' }} /></div></td>
      </tr>)}</tbody></table>
    <div className="rp-opt-notes">{p.options.map(o => <div key={o.id} className="rp-opt-card"><h4>{o.name}</h4>
      <p><I n="thumb-up-line" c="ok-ic" /> {dash(o.pros)}</p><p><I n="thumb-down-line" c="warn-ic" /> {dash(o.cons)}</p></div>)}</div>
  </div>;
}

export function ReportArch() {
  const { project: p } = useStore(); if (!p) return null;
  return <div className="rp-block" data-testid="page-arch">
    <h4 className="rp-h4">系统上下文</h4>
    {p.contextDiagram?.trim() ? <Mermaid code={p.contextDiagram} testid="arch-preview" /> : <EmptyHint text="未绘制上下文图" />}
    <h4 className="rp-h4">逻辑架构</h4>
    {p.architecture?.trim() ? <Mermaid code={p.architecture} /> : <EmptyHint text="未绘制逻辑架构图" />}
  </div>;
}

export function ReportDecisions() {
  const { project: p } = useStore(); if (!p) return null;
  if (!p.decisions.length) return <div className="rp-block" data-testid="page-decisions"><EmptyHint text="暂无决策记录" /></div>;
  return <div className="rp-block" data-testid="page-decisions"><div className="rp-adrs">{p.decisions.map(d =>
    <article key={d.id} className="rp-adr"><header><b>{d.title}</b><Tag c={d.status === '已采纳' ? 'green' : d.status === '已废弃' ? 'gray' : 'orange'}>{d.status}</Tag><span className="muted">{d.date}</span></header>
      <div className="rp-kv"><span>背景</span><p>{dash(d.context)}</p></div>
      <div className="rp-kv"><span>决策</span><p>{dash(d.decision)}</p></div>
      <div className="rp-kv"><span>影响</span><p>{dash(d.consequences)}</p></div>
    </article>)}</div></div>;
}

export function ReportRisks() {
  const { project: p } = useStore(); if (!p) return null;
  const lvl = (v: number): [string, string] => v >= 15 ? ['red', '高'] : v >= 8 ? ['orange', '中'] : ['green', '低'];
  if (!p.risks.length) return <div className="rp-block" data-testid="page-risks"><EmptyHint text="暂无风险与假设" /></div>;
  return <div className="rp-block" data-testid="page-risks">
    <table className="rp-table" data-testid="risk-table"><thead><tr><th>类型</th><th>描述</th><th>概率</th><th>影响</th><th>风险值</th><th>应对</th><th>负责人</th><th>状态</th></tr></thead>
      <tbody>{p.risks.map(r => { const v = r.probability * r.impact; const [c, l] = lvl(v); return <tr key={r.id}>
        <td>{r.kind}</td><td>{r.desc}<CiteChips compact ids={(r as any).sources} cites={p.ai?.cites?.risks} /></td><td>{r.probability}</td><td>{r.impact}</td><td><Tag c={c}>{v} {l}</Tag></td><td>{r.mitigation}</td><td>{r.owner}</td><td>{r.status}</td>
      </tr>; })}</tbody></table>
    <h4 className="rp-h4">风险热力图</h4>
    <div className="heat rp-heat">{[5, 4, 3, 2, 1].map(i => <React.Fragment key={i}><div className="hl">{i}</div>{[1, 2, 3, 4, 5].map(pr => {
      const items = p.risks.filter(r => r.impact === i && r.probability === pr);
      return <div key={pr} className={'hc ' + lvl(i * pr)[0]}>{items.map(r => <span key={r.id} title={r.desc}><I n="checkbox-blank-circle-fill" /></span>)}</div>;
    })}</React.Fragment>)}<div />{[1, 2, 3, 4, 5].map(i => <div key={i} className="hl">{i}</div>)}</div>
    <p className="muted small">纵轴：影响 · 横轴：概率</p>
  </div>;
}

export function ReportGlossary() {
  const { project: p } = useStore(); if (!p) return null;
  if (!p.glossary.length) return <div className="rp-block" data-testid="page-glossary"><EmptyHint text="暂无术语" /></div>;
  return <div className="rp-block" data-testid="page-glossary">
    <table className="rp-table" data-testid="term-table"><thead><tr><th>术语</th><th>英文</th><th>定义</th></tr></thead>
      <tbody>{p.glossary.map(g => <tr key={g.id}><td><b>{g.term}</b></td><td className="muted">{g.en}</td><td>{g.definition}</td></tr>)}</tbody></table>
  </div>;
}

export function ReportExport() {
  const { project: p } = useStore(); const nav = useNav(); const { setPrefs } = useStore();
  // reuse ExportPage actions via navigating is heavy; inline slim export
  if (!p) return null;
  return <div className="rp-block rp-export" data-testid="page-export">
    <p className="muted">本报告可切换到编辑模式使用完整导出工具，或直接从顶栏导出。</p>
    <div className="rp-cover-actions">
      <button className="btn primary" onClick={() => { setPrefs({ docMode: 'edit' }); nav.go('export'); }}><I n="upload-2-line" /> 打开导出工具</button>
    </div>
  </div>;
}

const MAP: Record<string, React.FC> = {
  dashboard: ReportCover, ai: ReportAI, vision: ReportVision, stakeholders: ReportStakeholders,
  personas: ReportPersonas, journeys: ReportJourneys, scope: ReportScope, requirements: ReportRequirements,
  priority: ReportPriority, trace: ReportTrace, options: ReportOptions, arch: ReportArch,
  decisions: ReportDecisions, risks: ReportRisks, glossary: ReportGlossary, export: ReportExport
};

export function ReportChapter({ k }: { k: string }) {
  const C = MAP[k];
  return C ? <><C /><CiteFooter k={k} /></> : null;
}

export function ReportSectionHead({ k, idx }: { k: string; idx: number }) {
  const m = metaOf(k);
  const isCover = k === 'dashboard';
  if (isCover) return null;
  return <div className="rp-sec-head" data-testid={'rp-head-' + k}>
    <span className="rp-chap-n">第 {String(idx).padStart(2, '0')} 章</span>
    <i className={'ri-' + m.icon} />
    <h2>{m.label}</h2>
    <div className="rp-sec-line" />
  </div>;
}
