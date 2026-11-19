import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from './store';
import { EditTable, Field, Header, Tag, I, Search } from './ui';
import { Journey, Persona, Requirement, Stakeholder, Vision } from './types';
import { uid } from './util';
import { weighted } from './exporter';
import { useNav } from './nav';
import { EmptyState } from './shell';
import { NAV, progress } from './meta';

export function Dashboard() {
  const { project: p } = useStore(); const { go, quickAdd } = useNav(); if (!p) return null;
  const vfill = Object.values(p.vision).filter(x => x.trim()).length;
  const checks: [string, boolean, string][] = [
    ['问题陈述与愿景', vfill >= 5, 'vision'], ['至少 3 位干系人', p.stakeholders.length >= 3, 'stakeholders'], ['至少 1 个用户画像', p.personas.length >= 1, 'personas'],
    ['至少 1 条用户旅程', p.journeys.length >= 1, 'journeys'], ['Must 需求均有验收标准', p.requirements.filter(r => r.moscow === 'Must').every(r => r.acceptance.trim()) && p.requirements.length > 0, 'requirements'],
    ['需求已关联功能', p.requirements.length > 0 && p.requirements.every(r => r.featureId), 'trace'], ['至少 2 个候选方案', p.options.length >= 2, 'options'],
    ['架构草图', !!p.architecture.trim(), 'arch'], ['风险已识别', p.risks.length > 0, 'risks'], ['术语表', p.glossary.length > 0, 'glossary']];
  const done = checks.filter(c => c[1]).length; const pct = Math.round(done / checks.length * 100);
  const best = weighted(p).sort((a, b) => b.score - a.score)[0];
  const highRisk = p.risks.filter(r => r.probability * r.impact >= 15 && r.status !== '已关闭').length;
  const mos = ['Must', 'Should', 'Could', "Won't"].map(m => [m, p.requirements.filter(r => r.moscow === m).length] as const);
  const next = NAV.filter(n => progress(p, n.key) !== null && progress(p, n.key)! < 1)[0];
  return <div data-testid="page-dashboard">
    <Header title={p.name} desc={p.description || '尚未填写项目描述，可在“问题与愿景”中补充'}><button className="btn" onClick={() => go('vision')}><I n="edit-line" /> 编辑项目信息</button><button className="btn primary" onClick={() => go('export')}><I n="upload-2-line" /> 导出文档</button></Header>
    {next && <div className="next-card" data-testid="next-step"><div className="nx-ic"><I n={next.icon} /></div><div className="nx-t"><small>建议下一步</small><b>完善「{next.label}」</b><span>{next.help[0]}</span></div>
      <button className="btn primary" data-testid="next-go" onClick={() => go(next.key)}>前往 <I n="arrow-right-line" /></button></div>}
    {pct < 40 && <div className="quick-start card" data-testid="quick-start"><h3><I n="rocket-2-line" /> 快速开始</h3><div className="qs-grid">
      <button onClick={() => go('vision')}><I n="focus-3-line" /><b>1. 写下问题与愿景</b><span>用几句话说明要解决什么问题</span></button>
      <button onClick={() => quickAdd('persona')}><I n="user-heart-line" /><b>2. 创建用户画像</b><span>明确你在为谁设计</span></button>
      <button onClick={() => quickAdd('requirement')}><I n="file-list-3-line" /><b>3. 记录第一条需求</b><span>以用户故事形式描述</span></button></div></div>}
    <div className="kpis">
      <div className="kpi" onClick={() => go('requirements')}><b data-testid="kpi-req">{p.requirements.length}</b><span>需求条目</span></div>
      <div className="kpi" onClick={() => go('scope')}><b>{p.features.length}</b><span>功能点</span></div>
      <div className="kpi" onClick={() => go('personas')}><b>{p.personas.length}</b><span>用户画像</span></div>
      <div className="kpi warn" onClick={() => go('risks')}><b>{highRisk}</b><span>高风险项</span></div>
      <div className="kpi ok"><b data-testid="kpi-ready">{pct}%</b><span>概念完备度</span></div>
    </div>
    <div className="cols2">
      <div className="card"><h3>概念阶段检查清单</h3><div className="progress"><i style={{ width: pct + '%' }} /></div>
        <ul className="checklist">{checks.map(([t, ok, k]) => <li key={t} className={ok ? 'ok' : ''} onClick={() => go(k)} data-tip="点击前往"><I n={ok ? 'checkbox-circle-fill' : 'checkbox-blank-circle-line'} /> {t}<I n="arrow-right-s-line" c="li-go" /></li>)}</ul></div>
      <div>
        <div className="card"><h3>需求优先级分布 (MoSCoW)</h3>
          {mos.map(([m, n]) => <div className="bar" key={m}><span>{m}</span><div><i className={'m-' + m.replace("'", '')} style={{ width: (p.requirements.length ? n / p.requirements.length * 100 : 0) + '%' }} /></div><b>{n}</b></div>)}</div>
        <div className="card"><h3>推荐方案</h3>{best ? <p><b>{best.o.name}</b><br /><span className="muted">加权得分 {best.score.toFixed(2)} / 10</span></p> : <p className="muted">尚未添加候选方案</p>}</div>
        <div className="card"><h3>愿景</h3><p>{p.vision.vision || <span className="muted">未填写</span>}</p></div>
      </div>
    </div>
  </div>;
}

export function VisionPage() {
  const { project: p, update } = useStore(); if (!p) return null;
  const set = (k: keyof Vision) => (v: string) => update(x => ({ ...x, vision: { ...x.vision, [k]: v } }));
  const v = p.vision;
  return <div data-testid="page-vision"><Header title="问题与愿景" desc="明确要解决的问题、目标用户、产品愿景与成功标准" />
    <div className="card statement"><b>电梯演讲：</b>针对 <u>{v.target || '[目标用户]'}</u>，他们面临 <u>{v.problem || '[问题]'}</u>；我们的愿景是 <u>{v.vision || '[愿景]'}</u>，以 <u>{v.metrics || '[成功指标]'}</u> 衡量成功。</div>
    <div className="cols2"><div className="card">
      <Field label="问题陈述" area value={v.problem} onChange={set('problem')} testid="vision-problem" placeholder="用户在什么场景下遇到了什么问题，造成了什么影响？" />
      <Field label="目标用户 / 市场" area value={v.target} onChange={set('target')} />
      <Field label="产品愿景" area value={v.vision} onChange={set('vision')} testid="vision-vision" />
      <Field label="约束条件（时间/预算/技术/合规）" area value={v.constraints} onChange={set('constraints')} /></div>
      <div className="card"><Field label="业务目标" area rows={5} value={v.goals} onChange={set('goals')} />
        <Field label="非目标（明确不做）" area value={v.nonGoals} onChange={set('nonGoals')} />
        <Field label="成功指标 (KPI / OKR)" area value={v.metrics} onChange={set('metrics')} />
        <div className="field"><span>项目信息</span><div className="row">
          <input placeholder="项目名称" value={p.name} data-testid="proj-name" onChange={e => update(x => ({ ...x, name: e.target.value }))} />
          <input placeholder="负责人" value={p.owner} onChange={e => update(x => ({ ...x, owner: e.target.value }))} />
          <select value={p.phase} onChange={e => update(x => ({ ...x, phase: e.target.value }))}>{['概念探索', '需求定义', '方案评审', '概念冻结'].map(o => <option key={o}>{o}</option>)}</select></div>
          <textarea rows={2} placeholder="项目描述" value={p.description} onChange={e => update(x => ({ ...x, description: e.target.value }))} /></div></div></div></div>;
}

export function StakeholdersPage() {
  const { project: p, update } = useStore(); if (!p) return null;
  const lv = ['高', '中', '低'];
  const quad = (s: Stakeholder) => s.influence === '高' ? (s.interest === '高' ? 0 : 1) : (s.interest === '高' ? 2 : 3);
  const names = ['重点管理', '保持满意', '保持知情', '持续关注'];
  return <div data-testid="page-stakeholders"><Header title="干系人分析" desc="识别干系人并通过权力/利益矩阵制定沟通策略" />
    <EditTable testid="sh" itemName="干系人" emptyIcon="group-line" addLabel="新增干系人" rows={p.stakeholders} onChange={r => update(x => ({ ...x, stakeholders: r }))}
      make={() => ({ name: '新干系人', role: '', influence: '中', interest: '中', expectations: '', strategy: '保持知情' })}
      cols={[{ key: 'name', label: '名称', width: 130 }, { key: 'role', label: '角色', width: 120 }, { key: 'influence', label: '影响力', type: 'select', options: lv, width: 70 },
        { key: 'interest', label: '关注度', type: 'select', options: lv, width: 70 }, { key: 'expectations', label: '期望/诉求', type: 'area' }, { key: 'strategy', label: '策略', type: 'select', options: names, width: 100 }]} />
    <div className="card"><h3>权力 / 利益矩阵</h3><div className="matrix">{names.map((n, i) =>
      <div key={n} className={'q q' + i}><h4>{n}</h4>{p.stakeholders.filter(s => quad(s) === i).map(s => <span key={s.id} className="chip">{s.name}</span>)}</div>)}</div>
      <p className="muted">纵轴：影响力 · 横轴：关注度（“中”归入低区间）</p></div></div>;
}

export function PersonasPage() {
  const { project: p, update, toast, undo } = useStore(); const { arg, quickAdd } = useNav(); if (!p) return null;
  const set = (id: string, k: keyof Persona, v: string) => update(x => ({ ...x, personas: x.personas.map(q => q.id === id ? { ...q, [k]: v } : q) }));
  const colors = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];
  return <div data-testid="page-personas"><Header title="用户画像" desc="构建典型用户角色：目标、痛点、行为与原声">
    <button className="btn primary" data-testid="persona-add" onClick={() => update(x => ({ ...x, personas: [...x.personas, { id: uid(), name: '新角色', role: '', age: '', goals: '', pains: '', behaviors: '', quote: '', color: colors[x.personas.length % colors.length] }] }))}><I n="add-line" /> 新增画像</button></Header>
    {p.personas.length === 0 && <EmptyState icon="user-heart-line" title="还没有用户画像" desc="用户画像帮助团队对“为谁设计”达成共识。建议为每类核心用户创建一个画像。" action="创建第一个画像" onAction={() => quickAdd('persona')} />}
    <div className="persona-grid">{p.personas.map(q => <div className={'card persona ' + (arg?.flash === q.id ? 'flash' : '')} key={q.id} data-testid="persona-card">
      <div className="persona-head" style={{ background: q.color }}><div className="avatar">{q.name.slice(0, 1)}</div>
        <div><input className="ghost big" value={q.name} onChange={e => set(q.id, 'name', e.target.value)} /><div className="row"><input className="ghost" placeholder="角色" value={q.role} onChange={e => set(q.id, 'role', e.target.value)} /><input className="ghost sm" placeholder="年龄" value={q.age} onChange={e => set(q.id, 'age', e.target.value)} /></div></div>
        <button className="x" data-tip="删除画像" onClick={() => { update(x => ({ ...x, personas: x.personas.filter(z => z.id !== q.id) })); toast('已删除画像', 'ok', { label: '撤销', run: undo }); }}><I n="delete-bin-6-line" /></button></div>
      <Field label={<><I n="chat-quote-line" /> 用户原声</>} value={q.quote} onChange={v => set(q.id, 'quote', v)} />
      <Field label={<><I n="focus-3-line" /> 目标</>} area rows={2} value={q.goals} onChange={v => set(q.id, 'goals', v)} />
      <Field label={<><I n="emotion-unhappy-line" /> 痛点</>} area rows={2} value={q.pains} onChange={v => set(q.id, 'pains', v)} />
      <Field label={<><I n="smartphone-line" /> 行为特征</>} area rows={2} value={q.behaviors} onChange={v => set(q.id, 'behaviors', v)} />
      <div className="muted">关联需求：{p.requirements.filter(r => r.personaId === q.id).map(r => r.code).join('、') || '无'}</div></div>)}</div></div>;
}

export function JourneysPage() {
  const { project: p, update, confirm, toast } = useStore(); const [sel, setSel] = useState<string>(''); if (!p) return null;
  const j = p.journeys.find(x => x.id === sel) || p.journeys[0];
  const upd = (f: (j: Journey) => Journey) => update(x => ({ ...x, journeys: x.journeys.map(y => y.id === j!.id ? f(y) : y) }));
  const setStage = (sid: string, k: string, v: any) => upd(y => ({ ...y, stages: y.stages.map(s => s.id === sid ? { ...s, [k]: v } : s) }));
  const emo = ['', 'emotion-sad-line', 'emotion-unhappy-line', 'emotion-normal-line', 'emotion-happy-line', 'emotion-laugh-line'];
  return <div data-testid="page-journeys"><Header title="用户旅程 / 场景地图" desc="按阶段梳理用户行为、触点、情绪曲线与机会点">
    <button className="btn primary" data-testid="journey-add" onClick={() => { const id = uid(); update(x => ({ ...x, journeys: [...x.journeys, { id, title: '新旅程', personaId: x.personas[0]?.id || '', scenario: '', stages: ['认知', '考虑', '使用', '留存'].map(n => ({ id: uid(), name: n, action: '', touchpoint: '', emotion: 3, pain: '', opportunity: '' })) }] })); setSel(id); }}><I n="add-line" /> 新建旅程</button></Header>
    <div className="tabs">{p.journeys.map(x => <button key={x.id} className={x.id === j?.id ? 'on' : ''} onClick={() => setSel(x.id)}>{x.title}</button>)}</div>
    {j ? <div className="card" key={j.id}>
      <div className="row"><input className="title-in" value={j.title} data-testid="journey-title" onChange={e => upd(y => ({ ...y, title: e.target.value }))} />
        <select value={j.personaId} onChange={e => upd(y => ({ ...y, personaId: e.target.value }))}><option value="">（选择画像）</option>{p.personas.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}</select>
        <button className="btn" data-testid="stage-add" onClick={() => upd(y => ({ ...y, stages: [...y.stages, { id: uid(), name: '新阶段', action: '', touchpoint: '', emotion: 3, pain: '', opportunity: '' }] }))}><I n="add-line" /> 阶段</button>
        <button className="btn danger" data-testid="journey-del" onClick={async () => { if (await confirm({ title: '删除用户旅程', message: `确定删除旅程“${j.title}”及其全部 ${j.stages.length} 个阶段吗？可通过撤销恢复。`, okText: '删除', danger: true })) { update(x => ({ ...x, journeys: x.journeys.filter(y => y.id !== j.id) })); toast('已删除旅程'); } }}><I n="delete-bin-6-line" /> 删除旅程</button></div>
      <textarea className="full" rows={2} placeholder="场景描述" value={j.scenario} onChange={e => upd(y => ({ ...y, scenario: e.target.value }))} />
      <div className="journey" style={{ gridTemplateColumns: `110px repeat(${j.stages.length}, minmax(150px,1fr))` }}>
        <div className="jh">阶段</div>{j.stages.map(s => <div key={s.id} className="jh stage"><input value={s.name} onChange={e => setStage(s.id, 'name', e.target.value)} /><button className="x" onClick={() => upd(y => ({ ...y, stages: y.stages.filter(z => z.id !== s.id) }))}><I n="close-line" /></button></div>)}
        {([['action', '用户行为'], ['touchpoint', '触点']] as const).map(([k, l]) => <React.Fragment key={k}><div className="jl">{l}</div>{j.stages.map(s => <textarea key={s.id} value={(s as any)[k]} onChange={e => setStage(s.id, k, e.target.value)} />)}</React.Fragment>)}
        <div className="jl">情绪曲线</div>{j.stages.map(s => <div key={s.id} className="emo"><div className="emo-dot" style={{ marginTop: (5 - s.emotion) * 14 }}><I n={emo[s.emotion]} c={'emo-' + s.emotion} /></div><input type="range" min={1} max={5} value={s.emotion} onChange={e => setStage(s.id, 'emotion', Number(e.target.value))} /></div>)}
        {([['pain', '痛点'], ['opportunity', '机会点']] as const).map(([k, l]) => <React.Fragment key={k}><div className={'jl ' + k}>{l}</div>{j.stages.map(s => <textarea className={k} key={s.id} value={(s as any)[k]} onChange={e => setStage(s.id, k, e.target.value)} />)}</React.Fragment>)}
      </div></div> : <EmptyState icon="route-line" title="还没有用户旅程" desc="用户旅程按阶段梳理用户的行为、触点和情绪，帮助发现痛点与机会。点击右上角“新建旅程”开始，系统会预置 4 个常用阶段。" />}</div>;
}

export function RequirementsPage() {
  const { project: p, update, toast, undo } = useStore(); const { arg, quickAdd } = useNav(); const [q, setQ] = useState(''); const [fm, setFm] = useState('全部'); const [edit, setEdit] = useState<string | null>(arg?.open || null);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setEdit(null); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);
  useEffect(() => { if (arg?.open) setEdit(arg.open); if (arg?.focus) setTimeout(() => (document.querySelector('[data-testid=req-title]') as HTMLInputElement)?.select(), 80); }, [arg]);
  if (!p) return null;
  const list = p.requirements.filter(r => (fm === '全部' || r.moscow === fm) && (r.code + r.title + r.iWant).includes(q));
  const setR = (id: string, patch: Partial<Requirement>) => update(x => ({ ...x, requirements: x.requirements.map(r => r.id === id ? { ...r, ...patch } : r) }));
  const add = () => quickAdd('requirement');
  const cur = p.requirements.find(r => r.id === edit);
  const mc: any = { Must: 'red', Should: 'orange', Could: 'blue', "Won't": 'gray' };
  return <div data-testid="page-requirements"><Header title="需求池" desc="以用户故事 + 验收标准 (Given/When/Then) 捕获需求，并进行 MoSCoW / Kano 分类">
    <button className="btn primary" data-testid="req-add" onClick={add} data-tip="Ctrl+N"><I n="add-line" /> 新增需求</button></Header>
    {p.requirements.length === 0 ? <EmptyState icon="file-list-3-line" title="需求池还是空的" desc="用“作为[角色]，我希望[功能]，以便[价值]”的格式记录用户故事，并为它们补充验收标准。" action="新增第一条需求" onAction={add} /> :
    <div className="card"><div className="toolbar"><Search placeholder="搜索编号/标题…" value={q} onChange={setQ} testid="req-search" />
      {['全部', 'Must', 'Should', 'Could', "Won't"].map(m => <button key={m} className={'btn sm ' + (fm === m ? 'primary' : '')} onClick={() => setFm(m)}>{m}</button>)}<span className="muted">显示 {list.length} / {p.requirements.length}</span></div>
      <table className="grid" data-testid="req-table"><thead><tr><th>编号</th><th>类型</th><th>标题</th><th>描述</th><th>MoSCoW</th><th>Kano</th><th>价值/工作量</th><th>状态</th><th></th></tr></thead>
        <tbody>{list.map(r => <tr key={r.id} className={edit === r.id ? 'sel' : ''} onClick={() => setEdit(r.id)}><td><b>{r.code}</b></td><td>{r.type}</td><td>{r.title}</td>
          <td className="desc">{r.type === '用户故事' ? `作为${r.asA || '…'}，我希望${r.iWant || '…'}，以便${r.soThat || '…'}` : r.iWant}</td>
          <td><Tag c={mc[r.moscow]}>{r.moscow}</Tag></td><td>{r.kano}</td><td>{r.value} / {r.effort}</td><td>{r.status}</td>
          <td><button className="btn danger sm" data-tip="删除" onClick={e => { e.stopPropagation(); if (edit === r.id) setEdit(null); update(x => ({ ...x, requirements: x.requirements.filter(z => z.id !== r.id) })); toast(`已删除 ${r.code}`, 'ok', { label: '撤销', run: undo }); }}><I n="delete-bin-6-line" /> 删除</button></td></tr>)}{list.length === 0 && <tr><td colSpan={9} className="empty">没有符合筛选条件的需求</td></tr>}</tbody></table></div>}
    {cur && createPortal(<><div className="drawer-mask" onClick={() => setEdit(null)} /><div className="drawer" data-testid="req-editor"><div className="drawer-head"><div><small>编辑需求</small><h3>{cur.code} {cur.title}</h3></div><span className="save-hint"><I n="cloud-line" /> 修改即时保存</span><button className="icon-btn" data-testid="drawer-close" data-tip="关闭 (Esc)" onClick={() => setEdit(null)}><I n="close-line" /></button></div>
      <div className="drawer-body"><div className="story-preview"><I n="double-quotes-l" /> 作为<b>{cur.asA || '[角色]'}</b>，我希望<b>{cur.iWant || '[功能]'}</b>，以便<b>{cur.soThat || '[价值]'}</b></div>
      <div className="cols2 tight">
        <Field label="编号" value={cur.code} onChange={v => setR(cur.id, { code: v })} />
        <Field label="标题" value={cur.title} onChange={v => setR(cur.id, { title: v })} testid="req-title" />
        <label className="field"><span>类型</span><select value={cur.type} onChange={e => setR(cur.id, { type: e.target.value as any })}>{['用户故事', '功能需求', '非功能需求', '约束'].map(o => <option key={o}>{o}</option>)}</select></label>
        <Field label="作为（角色）" value={cur.asA} onChange={v => setR(cur.id, { asA: v })} testid="req-asa" />
        <Field label="我希望（功能）" value={cur.iWant} onChange={v => setR(cur.id, { iWant: v })} testid="req-iwant" />
        <Field label="以便（价值）" value={cur.soThat} onChange={v => setR(cur.id, { soThat: v })} />
        <label className="field"><span>MoSCoW</span><select data-testid="req-moscow" value={cur.moscow} onChange={e => setR(cur.id, { moscow: e.target.value as any })}>{['Must', 'Should', 'Could', "Won't"].map(o => <option key={o}>{o}</option>)}</select></label>
        <label className="field"><span>Kano 分类</span><select value={cur.kano} onChange={e => setR(cur.id, { kano: e.target.value as any })}>{['基本型', '期望型', '兴奋型', '无差异', '反向型'].map(o => <option key={o}>{o}</option>)}</select></label>
        <label className="field"><span>状态</span><select value={cur.status} onChange={e => setR(cur.id, { status: e.target.value as any })}>{['草稿', '评审中', '已确认', '已拒绝'].map(o => <option key={o}>{o}</option>)}</select></label>
        <label className="field"><span>业务价值 (1-10)：{cur.value}</span><input type="range" min={1} max={10} value={cur.value} onChange={e => setR(cur.id, { value: +e.target.value })} /></label>
        <label className="field"><span>实现工作量 (1-10)：{cur.effort}</span><input type="range" min={1} max={10} value={cur.effort} onChange={e => setR(cur.id, { effort: +e.target.value })} /></label>
        <label className="field"><span>关联功能</span><select data-testid="req-feature" value={cur.featureId} onChange={e => setR(cur.id, { featureId: e.target.value })}><option value="">（未关联）</option>{p.features.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label className="field"><span>关联画像</span><select value={cur.personaId} onChange={e => setR(cur.id, { personaId: e.target.value })}><option value="">（无）</option>{p.personas.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <div className="field"><span>关联干系人</span><div className="chips">{p.stakeholders.map(s => <label key={s.id} className="chk"><input type="checkbox" checked={cur.stakeholderIds.includes(s.id)} onChange={e => setR(cur.id, { stakeholderIds: e.target.checked ? [...cur.stakeholderIds, s.id] : cur.stakeholderIds.filter(z => z !== s.id) })} />{s.name}</label>)}</div></div>
      </div>
      <Field label="验收标准 (Given / When / Then)" area rows={4} value={cur.acceptance} onChange={v => setR(cur.id, { acceptance: v })} testid="req-acc" />
      <button className="btn sm" onClick={() => setR(cur.id, { acceptance: (cur.acceptance ? cur.acceptance + '\n' : '') + 'Given [前置条件]\nWhen [用户操作]\nThen [预期结果]' })}><I n="magic-line" /> 插入 GWT 模板</button>
    </div></div></>, document.body)}</div>;
}

let mid = 0; let mermaidMod: any = null;
async function loadMermaid() {
  if (mermaidMod) return mermaidMod;
  mermaidMod = (await import('mermaid')).default;
  mermaidMod.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
  return mermaidMod;
}
export function Mermaid({ code, testid }: { code: string; testid?: string }) {
  const ref = useRef<HTMLDivElement>(null); const [err, setErr] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { let alive = true; const t = setTimeout(async () => {
    try {
      setLoading(true);
      const mermaid = await loadMermaid();
      await mermaid.parse(code);
      const { svg } = await mermaid.render('m' + (++mid), code);
      if (alive && ref.current) { ref.current.innerHTML = svg; setErr(''); }
    } catch (e: any) {
      if (alive) setErr(String(e?.message || e).split('\n').slice(0, 3).join(' '));
      document.querySelectorAll('[id^="dm"]').forEach(n => n.remove());
    } finally { if (alive) setLoading(false); }
  }, 200); return () => { alive = false; clearTimeout(t); }; }, [code]);
  return <div className="mermaid-box" data-testid={testid}>{loading && !err && <div className="muted" style={{ padding: 12 }}><i className="ri-loader-4-line spin" /> 正在渲染架构图…</div>}{err && <div className="err">语法错误：{err}</div>}<div ref={ref} /></div>;
}
