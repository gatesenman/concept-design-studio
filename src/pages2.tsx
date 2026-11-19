import React, { useState } from 'react';
import { useStore } from './store';
import { EditTable, Header, Tag, I, Search } from './ui';
import { Mermaid } from './pages1';
import { Feature, Requirement } from './types';
import { uid, fmt } from './util';
import { weighted, toMarkdown, mdToHtml } from './exporter';
import { blankProject, sampleProject, TEMPLATES } from './templates';
import { useNav } from './nav';
import { EmptyState } from './shell';
import { useAI } from './aiRunner';

export function PriorityPage() {
  const { project: p, update } = useStore(); const [drag, setDrag] = useState(''); if (!p) return null;
  const move = (id: string, m: any) => update(x => ({ ...x, requirements: x.requirements.map(r => r.id === id ? { ...r, moscow: m } : r) }));
  const cols = [['Must', '必须有'], ['Should', '应该有'], ['Could', '可以有'], ["Won't", '这次不做']];
  const kano = ['基本型', '期望型', '兴奋型', '无差异', '反向型'];
  return <div data-testid="page-priority"><Header title="优先级排序" desc="MoSCoW 看板（可拖拽）、价值/工作量矩阵与 Kano 分类视图" />
    <div className="board">{cols.map(([m, l]) => <div key={m} className={'lane m-' + m.replace("'", '')} data-testid={'lane-' + m.replace("'", '')} onDragOver={e => e.preventDefault()} onDrop={() => { move(drag, m); setDrag(''); }}>
      <h4>{m} <small>{l}</small><b>{p.requirements.filter(r => r.moscow === m).length}</b></h4>
      {p.requirements.filter(r => r.moscow === m).map(r => <div key={r.id} className="kcard" draggable onDragStart={() => setDrag(r.id)} data-testid={'kcard-' + r.code}><b>{r.code}</b> {r.title}<div className="muted">价值 {r.value} · 工作量 {r.effort} · {r.kano}</div></div>)}</div>)}</div>
    <div className="cols2">
      <div className="card"><h3>价值 / 工作量矩阵</h3><div className="ve">
        <span className="ql tl">快速见效</span><span className="ql tr">重大项目</span><span className="ql bl">填充项</span><span className="ql br">费力不讨好</span>
        {p.requirements.map(r => <div key={r.id} className="dot" title={r.title} style={{ left: `${(r.effort - 0.5) / 10 * 100}%`, bottom: `${(r.value - 0.5) / 10 * 100}%` }}>{r.code.replace(/^[A-Z]+-0*/, '')}</div>)}
        <div className="axis-x">工作量 <I n="arrow-right-line" /></div><div className="axis-y">价值 <I n="arrow-up-line" /></div></div></div>
      <div className="card"><h3>Kano 模型分类</h3>{kano.map(k => <div key={k} className="kano-row"><b>{k}</b><div className="chips">{p.requirements.filter(r => r.kano === k).map(r => <span key={r.id} className="chip" title={r.title}>{r.code} {r.title}</span>)}</div></div>)}
        <p className="muted">基本型：缺失会不满；期望型：越多越满意；兴奋型：超预期惊喜。</p></div></div></div>;
}

export function TracePage() {
  const { project: p, update } = useStore(); const [mode, setMode] = useState<'feature' | 'stakeholder'>('feature'); if (!p) return null;
  const cols = mode === 'feature' ? p.features.map(f => ({ id: f.id, name: f.name })) : p.stakeholders.map(s => ({ id: s.id, name: s.name }));
  const has = (r: Requirement, c: string) => mode === 'feature' ? r.featureId === c : r.stakeholderIds.includes(c);
  const toggle = (r: Requirement, c: string) => update(x => ({ ...x, requirements: x.requirements.map(q => q.id !== r.id ? q : mode === 'feature' ? { ...q, featureId: q.featureId === c ? '' : c } : { ...q, stakeholderIds: q.stakeholderIds.includes(c) ? q.stakeholderIds.filter(z => z !== c) : [...q.stakeholderIds, c] }) }));
  const orphanR = p.requirements.filter(r => !cols.some(c => has(r, c.id)));
  const orphanC = cols.filter(c => !p.requirements.some(r => has(r, c.id)));
  return <div data-testid="page-trace"><Header title="需求追溯矩阵" desc="点击单元格建立/取消关联，自动识别孤立需求与无需求支撑的功能">
    <div className="seg"><button className={mode === 'feature' ? 'on' : ''} onClick={() => setMode('feature')}>需求 × 功能</button><button className={mode === 'stakeholder' ? 'on' : ''} onClick={() => setMode('stakeholder')} data-testid="trace-sh">需求 × 干系人</button></div></Header>
    <div className="card scroll"><table className="grid trace" data-testid="trace-table"><thead><tr><th>需求</th>{cols.map(c => <th key={c.id} className="vert"><span>{c.name}</span></th>)}</tr></thead>
      <tbody>{p.requirements.map(r => <tr key={r.id}><td><b>{r.code}</b> {r.title}</td>{cols.map(c => <td key={c.id} className={'tc ' + (has(r, c.id) ? 'on' : '')} onClick={() => toggle(r, c.id)}>{has(r, c.id) ? <I n="checkbox-blank-circle-fill" /> : ''}</td>)}</tr>)}</tbody></table></div>
    <div className="cols2"><div className="card"><h3><I n="error-warning-line" c="warn-ic" /> 未关联的需求 ({orphanR.length})</h3>{orphanR.map(r => <span className="chip warn" key={r.id}>{r.code} {r.title}</span>)}</div>
      <div className="card"><h3><I n="error-warning-line" c="warn-ic" /> 无需求支撑的{mode === 'feature' ? '功能' : '干系人'} ({orphanC.length})</h3>{orphanC.map(c => <span className="chip warn" key={c.id}>{c.name}</span>)}</div></div></div>;
}

export function ScopePage() {
  const { project: p, update } = useStore(); if (!p) return null;
  const rel: Feature['release'][] = ['MVP', 'V1.x', '未来', '不做'];
  const epics = Array.from(new Set(p.features.map(f => f.epic || '未分组')));
  return <div data-testid="page-scope"><Header title="功能范围地图" desc="按史诗 (Epic) 与发布版本规划范围，明确 MVP 边界" />
    <div className="card scroll"><div className="storymap" style={{ gridTemplateColumns: `90px repeat(${Math.max(epics.length, 1)}, minmax(170px,1fr))` }}>
      <div />{epics.map(e => <div key={e} className="epic">{e}</div>)}
      {rel.map(r => <React.Fragment key={r}><div className={'rel r-' + r}>{r}</div>{epics.map(e => <div key={e} className="cell-s">{p.features.filter(f => (f.epic || '未分组') === e && f.release === r).map(f =>
        <div key={f.id} className="fcard" title={f.desc}>{f.name}<small>{p.requirements.filter(q => q.featureId === f.id).length} 条需求</small></div>)}</div>)}</React.Fragment>)}</div></div>
    <EditTable testid="feat" itemName="功能" emptyIcon="puzzle-line" addLabel="新增功能" rows={p.features} onChange={r => update(x => ({ ...x, features: r }))} make={() => ({ name: '新功能', epic: epics[0] || '核心', release: 'MVP' as const, desc: '' })}
      cols={[{ key: 'name', label: '功能名称', width: 200 }, { key: 'epic', label: '史诗 / 模块', width: 140 }, { key: 'release', label: '版本', type: 'select', options: rel, width: 90 }, { key: 'desc', label: '说明', type: 'area' }]} /></div>;
}

export function OptionsPage() {
  const { project: p, update } = useStore(); const addOpt = () => update(x => ({ ...x, options: [...x.options, { id: uid(), name: `方案${String.fromCharCode(65 + x.options.length)}`, desc: '', pros: '', cons: '', scores: {} }] })); if (!p) return null;
  const tw = p.criteria.reduce((s, c) => s + c.weight, 0);
  const res = weighted(p); const max = Math.max(...res.map(r => r.score), 0);
  const setScore = (oid: string, cid: string, v: number) => update(x => ({ ...x, options: x.options.map(o => o.id === oid ? { ...o, scores: { ...o.scores, [cid]: Math.max(0, Math.min(10, v)) } } : o) }));
  const setO = (oid: string, k: string, v: string) => update(x => ({ ...x, options: x.options.map(o => o.id === oid ? { ...o, [k]: v } : o) }));
  return <div data-testid="page-options"><Header title="概念方案对比" desc="定义评估维度与权重，对候选方案打分 (0-10)，自动计算加权得分">
    <button className="btn primary" data-testid="opt-add" onClick={addOpt}><I n="add-line" /> 新增方案</button></Header>
    <EditTable testid="crit" itemName="评估维度" emptyIcon="scales-3-line" addLabel="新增评估维度" rows={p.criteria} onChange={r => update(x => ({ ...x, criteria: r }))} make={() => ({ name: '新维度', weight: 10 })}
      cols={[{ key: 'name', label: '评估维度' }, { key: 'weight', label: '权重 (%)', type: 'number', min: 0, max: 100, width: 120 }]} />
    {tw !== 100 && <div className="alert">当前权重合计为 {tw}%，建议调整为 100%（得分已按比例归一化）。</div>}
    {p.options.length === 0 ? <EmptyState icon="trophy-line" title="还没有候选方案" desc="至少列出 2 个可选方案（例如自研 / 采购 / 低代码），按维度打分后系统会自动推荐。" action="添加候选方案" onAction={addOpt} /> :
    <div className="card scroll"><table className="grid score" data-testid="opt-table"><thead><tr><th>方案</th>{p.criteria.map(c => <th key={c.id}>{c.name}<br /><small>{c.weight}%</small></th>)}<th>加权得分</th><th></th></tr></thead>
      <tbody>{res.map(({ o, score }) => <tr key={o.id} className={score === max && max > 0 ? 'best' : ''}>
        <td><input className="cell b" value={o.name} onChange={e => setO(o.id, 'name', e.target.value)} /><textarea className="cell" rows={1} placeholder="方案描述" value={o.desc} onChange={e => setO(o.id, 'desc', e.target.value)} /></td>
        {p.criteria.map(c => <td key={c.id}><input className="cell num" type="number" min={0} max={10} value={o.scores[c.id] ?? 0} onChange={e => setScore(o.id, c.id, Number(e.target.value))} /></td>)}
        <td><b data-testid="opt-score">{score.toFixed(2)}</b> {score === max && max > 0 && <Tag c="green">推荐</Tag>}<div className="sbar"><i style={{ width: score * 10 + '%' }} /></div></td>
        <td><button className="btn danger sm" onClick={() => update(x => ({ ...x, options: x.options.filter(z => z.id !== o.id) }))}><I n="delete-bin-6-line" /> 删除</button></td></tr>)}</tbody></table></div>}
    <div className="opt-grid">{p.options.map(o => <div className="card" key={o.id}><h4>{o.name}</h4>
      <label className="field"><span><I n="thumb-up-line" c="ok-ic" /> 优势</span><textarea rows={2} value={o.pros} onChange={e => setO(o.id, 'pros', e.target.value)} /></label>
      <label className="field"><span><I n="thumb-down-line" c="warn-ic" /> 劣势</span><textarea rows={2} value={o.cons} onChange={e => setO(o.id, 'cons', e.target.value)} /></label></div>)}</div></div>;
}

export function ArchPage() {
  const { project: p, update } = useStore(); const [tab, setTab] = useState<'contextDiagram' | 'architecture'>('contextDiagram'); if (!p) return null;
  const snippets: [string, string][] = [['外部系统', '\n  SYS -->|接口| EXT[外部系统]'], ['数据库', '\n  SVC --> DB2[(新数据库)]'], ['消息队列', '\n  SVC --> MQ[[消息队列]]'], ['子图', '\n  subgraph 新分组\n    N1[节点1] --> N2[节点2]\n  end']];
  return <div data-testid="page-arch"><Header title="架构草图" desc="使用 Mermaid 语法绘制系统上下文图与逻辑架构图，实时预览">
    <div className="seg"><button className={tab === 'contextDiagram' ? 'on' : ''} onClick={() => setTab('contextDiagram')}>系统上下文图</button><button className={tab === 'architecture' ? 'on' : ''} onClick={() => setTab('architecture')} data-testid="arch-tab-logic">逻辑架构图</button></div></Header>
    <div className="cols-arch"><div className="card"><div className="toolbar">{snippets.map(([l, s]) => <button key={l} className="btn sm" onClick={() => update(x => ({ ...x, [tab]: x[tab] + s }))}><I n="add-line" /> {l}</button>)}</div>
      <textarea className="code" data-testid="arch-code" spellCheck={false} value={p[tab]} onChange={e => update(x => ({ ...x, [tab]: e.target.value }))} /></div>
      <div className="card"><Mermaid code={p[tab]} testid="arch-preview" /></div></div></div>;
}

export function RisksPage() {
  const { project: p, update } = useStore(); if (!p) return null;
  const lvl = (v: number) => v >= 15 ? ['red', '高'] : v >= 8 ? ['orange', '中'] : ['green', '低'];
  return <div data-testid="page-risks"><Header title="风险与假设日志" desc="RAID：风险、假设、问题、依赖；概率 × 影响 自动计算风险值" />
    <EditTable testid="risk" itemName="风险或假设" emptyIcon="error-warning-line" addLabel="新增条目" rows={p.risks} onChange={r => update(x => ({ ...x, risks: r }))} make={() => ({ kind: '风险' as const, desc: '', probability: 3, impact: 3, mitigation: '', owner: '', status: '开放' as const })}
      cols={[{ key: 'kind', label: '类型', type: 'select', options: ['风险', '假设', '问题', '依赖'], width: 80 }, { key: 'desc', label: '描述', type: 'area' }, { key: 'probability', label: '概率1-5', type: 'number', min: 1, max: 5, width: 75 },
        { key: 'impact', label: '影响1-5', type: 'number', min: 1, max: 5, width: 75 }, { key: 'mitigation', label: '应对/验证方式', type: 'area' }, { key: 'owner', label: '负责人', width: 90 }, { key: 'status', label: '状态', type: 'select', options: ['开放', '处理中', '已关闭', '已验证'], width: 90 }]}
      extra={r => { const v = r.probability * r.impact; const [c, l] = lvl(v); return <Tag c={c}>{v} {l}</Tag>; }} />
    <div className="card"><h3>风险热力图</h3><div className="heat">{[5, 4, 3, 2, 1].map(i => <React.Fragment key={i}><div className="hl">{i}</div>{[1, 2, 3, 4, 5].map(pr => {
      const items = p.risks.filter(r => r.impact === i && r.probability === pr); return <div key={pr} className={'hc ' + lvl(i * pr)[0]}>{items.map(r => <span key={r.id} title={r.desc}><I n="checkbox-blank-circle-fill" /></span>)}</div>; })}</React.Fragment>)}
      <div />{[1, 2, 3, 4, 5].map(i => <div key={i} className="hl">{i}</div>)}</div><p className="muted">纵轴：影响 · 横轴：概率</p></div></div>;
}

export function DecisionsPage() {
  const { project: p, update } = useStore(); if (!p) return null;
  return <div data-testid="page-decisions"><Header title="架构决策记录 (ADR)" desc="记录关键设计决策的背景、结论与影响，便于后续追溯" />
    <EditTable testid="adr" itemName="决策记录" emptyIcon="pushpin-line" addLabel="新增决策" rows={p.decisions} onChange={r => update(x => ({ ...x, decisions: r }))} make={() => ({ title: `ADR-${String(p.decisions.length + 1).padStart(3, '0')} `, context: '', decision: '', consequences: '', status: '提议' as const, date: new Date().toISOString().slice(0, 10) })}
      cols={[{ key: 'title', label: '标题', width: 180 }, { key: 'context', label: '背景', type: 'area' }, { key: 'decision', label: '决策', type: 'area' }, { key: 'consequences', label: '影响', type: 'area' }, { key: 'status', label: '状态', type: 'select', options: ['提议', '已采纳', '已废弃'], width: 80 }, { key: 'date', label: '日期', type: 'date', width: 130 }]} /></div>;
}

export function GlossaryPage() {
  const { project: p, update } = useStore(); const [q, setQ] = useState(''); if (!p) return null;
  const rows = p.glossary;
  return <div data-testid="page-glossary"><Header title="术语表" desc="统一业务语言，消除沟通歧义"><Search placeholder="搜索术语" value={q} onChange={setQ} /></Header>
    {q && <div className="card">{rows.filter(g => (g.term + g.en + g.definition).toLowerCase().includes(q.toLowerCase())).map(g => <p key={g.id}><b>{g.term}</b> <i className="muted">{g.en}</i> — {g.definition}</p>)}</div>}
    <EditTable testid="term" itemName="术语" emptyIcon="book-2-line" addLabel="新增术语" rows={rows} onChange={r => update(x => ({ ...x, glossary: r }))} make={() => ({ term: '新术语', en: '', definition: '' })}
      cols={[{ key: 'term', label: '术语', width: 160 }, { key: 'en', label: '英文', width: 160 }, { key: 'definition', label: '定义', type: 'area' }]} /></div>;
}

export function ExportPage() {
  const { project: p, data, setData, toast } = useStore(); const [msg, setMsg] = useState(''); if (!p) return null;
  const md = toMarkdown(p); const base = p.name.replace(/[\\/:*?"<>|（）()\s]/g, '_');
  const run = async (kind: string) => {
    let r: any;
    if (!window.api) { const blob = new Blob([kind === 'json' ? JSON.stringify(p, null, 2) : kind === 'md' ? md : mdToHtml(md, p.name)]); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = base + '.' + (kind === 'pdf' ? 'html' : kind); a.click(); r = { ok: true, path: a.download }; }
    else if (kind === 'md') r = await window.api.exportText({ name: base + '.md', content: md, ext: 'md' });
    else if (kind === 'json') r = await window.api.exportText({ name: base + '.json', content: JSON.stringify(p, null, 2), ext: 'json' });
    else if (kind === 'html') r = await window.api.exportText({ name: base + '.html', content: mdToHtml(md, p.name), ext: 'html' });
    else r = await window.api.exportPdf({ name: base + '.pdf', html: mdToHtml(md, p.name) });
    setMsg(r?.ok ? `已导出：${r.path}` : '已取消'); if (r?.ok) toast(`${kind.toUpperCase()} 导出成功`);
  };
  const imp = async () => { const s = window.api ? await window.api.importJson() : prompt('粘贴项目 JSON'); if (!s) return;
    try { const o = JSON.parse(s); if (!o.name || !o.requirements) throw 0; o.id = uid(); o.name += '（导入）'; setData(d => ({ ...d, projects: [...d.projects, o], currentId: o.id })); setMsg('导入成功'); } catch { setMsg('文件格式无效'); } };
  return <div data-testid="page-export"><Header title="导出与分享" desc="生成概念设计说明书，或导出 JSON 以备份/迁移" />
    <div className="export-btns">
      <button className="ebtn" data-testid="export-md" onClick={() => run('md')}><I n="markdown-line" c="eic" /><b>Markdown</b><span>概念设计说明书 (.md)</span></button>
      <button className="ebtn" data-testid="export-pdf" onClick={() => run('pdf')}><I n="file-pdf-2-line" c="eic" /><b>PDF</b><span>A4 排版打印版 (.pdf)</span></button>
      <button className="ebtn" data-testid="export-html" onClick={() => run('html')}><I n="html5-line" c="eic" /><b>HTML</b><span>可在浏览器查看 (.html)</span></button>
      <button className="ebtn" data-testid="export-json" onClick={() => run('json')}><I n="braces-line" c="eic" /><b>JSON</b><span>完整数据备份 (.json)</span></button>
      <button className="ebtn" onClick={imp}><I n="download-2-line" c="eic" /><b>导入 JSON</b><span>从备份恢复为新项目</span></button></div>
    {msg && <div className="alert ok" data-testid="export-msg">{msg}</div>}
    <div className="card"><h3>Markdown 预览</h3><pre className="md-preview">{md}</pre></div>
    <p className="muted">共 {data.projects.length} 个项目 · 数据自动保存在本地应用数据目录</p></div>;
}

export function ProjectsPage() {
  const { data, setData, confirm, toast } = useStore(); const { go } = useNav(); const ai = useAI(); const [brief, setBrief] = useState(''); const [aiName, setAiName] = useState(''); const [name, setName] = useState(''); const [tpl, setTpl] = useState(TEMPLATES[0]);
  const create = (pr: any) => { setData(d => ({ ...d, projects: [...d.projects, pr], currentId: pr.id })); toast(`已创建项目“${pr.name}”`); go('dashboard'); };
  const aiCreate = () => { const pr = blankProject(aiName.trim() || brief.trim().slice(0, 16), '空白项目'); pr.ai = { brief: brief.trim(), chapters: {} }; pr.description = brief.trim().slice(0, 80);
    setData(d => ({ ...d, projects: [...d.projects, pr], currentId: pr.id })); setBrief(''); setAiName(''); go('ai'); if (ai.configured) ai.requestGenerateAll(); else { toast('请先配置 AI 模型，然后点击“AI 一键生成全部章节”', 'warn'); ai.openSettings(); } };
  return <div data-testid="page-projects"><div className="page-head"><div><h2>项目管理</h2><p className="muted">用 AI 从一句话构想生成完整概念设计，或基于模板手动创建</p></div></div>
    <div className="card ai-new"><h3><I n="sparkling-2-line" /> 用 AI 新建项目 <span className="muted small">输入构想 → AI 逐章生成草稿 → 你逐章审核</span></h3>
      <div className="row"><input data-testid="ai-new-name" placeholder="项目名称（可选）" value={aiName} onChange={e => setAiName(e.target.value)} style={{ maxWidth: 260 }} /></div>
      <textarea data-testid="ai-new-brief" className="full" rows={3} placeholder="用几句话描述你的软件构想：目标用户、要解决的问题、核心功能设想……" value={brief} onChange={e => setBrief(e.target.value)} />
      <div className="row"><button className="btn primary" data-testid="ai-new-go" disabled={!brief.trim()} onClick={aiCreate}><I n="magic-line" /> 创建并 AI 生成全部章节</button>
        <span className="muted small">{ai.configured ? `当前模型：${ai.settings?.model}` : '尚未配置 AI 模型'}</span><button className="btn sm" onClick={() => ai.openSettings()}><I n="settings-3-line" /> AI 设置</button></div></div>
    <div className="card"><h3><I n="folder-add-line" /> 手动新建项目</h3><div className="row">
      <input data-testid="new-name" placeholder="输入项目名称，回车创建" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { create(blankProject(name.trim(), tpl)); setName(''); } }} />
      <select data-testid="new-tpl" value={tpl} onChange={e => setTpl(e.target.value)}>{TEMPLATES.map(t => <option key={t}>{t}</option>)}</select>
      <button className="btn primary" data-testid="new-create" disabled={!name.trim()} onClick={() => { create(blankProject(name.trim(), tpl)); setName(''); }}><I n="add-circle-line" /> 创建项目</button>
      <button className="btn" data-testid="new-sample" onClick={() => create(sampleProject())}><I n="magic-line" /> 载入示例项目</button></div></div>
    <div className="proj-grid">{data.projects.map(p => <div key={p.id} className={'card proj ' + (p.id === data.currentId ? 'cur' : '')} data-testid="proj-card">
      <h4>{p.name}</h4><p className="muted">{p.description || '无描述'}</p>
      <div className="meta"><Tag c="blue">{p.template}</Tag><Tag c="gray">{p.phase}</Tag></div>
      <div className="muted small">需求 {p.requirements.length} · 功能 {p.features.length} · 风险 {p.risks.length}<br />更新于 {fmt(p.updatedAt)}</div>
      <div className="row"><button className="btn primary sm" onClick={() => { setData(d => ({ ...d, currentId: p.id })); go('dashboard'); }}><I n="folder-open-line" /> 打开</button>
        <button className="btn sm" onClick={() => setData(d => ({ ...d, projects: [...d.projects, { ...JSON.parse(JSON.stringify(p)), id: uid(), name: p.name + ' - 副本' }] }))}><I n="file-copy-line" /> 复制</button>
        <button className="btn danger sm" data-testid="proj-del" onClick={async () => { if (await confirm({ title: '删除项目', message: `确定删除项目“${p.name}”吗？其中的 ${p.requirements.length} 条需求等全部内容将被删除（可通过撤销恢复）。`, okText: '删除项目', danger: true })) { toast('项目已删除'); setData(d => { const ps = d.projects.filter(x => x.id !== p.id); return { ...d, projects: ps, currentId: d.currentId === p.id ? ps[0]?.id || null : d.currentId }; }); } }}><I n="delete-bin-6-line" /> 删除</button></div></div>)}</div></div>;
}
