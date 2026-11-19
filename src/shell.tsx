import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store';
import { useNav } from './nav';
import { NAV, PHASES, phaseProgress, progress, metaOf } from './meta';
import { I } from './ui';
import { useAI } from './aiRunner';
import { chapterDef, chapterStatus } from './ai';
import { StatusBadge, reviewProgress } from './aiui';

export const SHORTCUTS: [string, string][] = [
  ['Ctrl + K', '打开命令面板 / 全局搜索'], ['Ctrl + Z', '撤销'], ['Ctrl + Y / Ctrl + Shift + Z', '重做'], ['Ctrl + N', '新增需求'],
  ['Ctrl + B', '折叠 / 展开侧边栏'], ['Ctrl + Shift + L', '切换浅色 / 深色主题'], ['Ctrl + E', '前往导出'], ['Alt + 1 ~ 9', '快速切换到前 9 个模块'],
  ['Ctrl + ,', '打开 AI 模型设置'], ['Ctrl + Shift + P', '切换预览 / 编辑模式'], ['F1 或 Ctrl + /', '显示快捷键帮助'], ['Esc', '关闭弹窗 / 抽屉']
];

export function Ring({ v, size = 18 }: { v: number; size?: number }) {
  const r = size / 2 - 2, c = 2 * Math.PI * r;
  return <svg className="ring" width={size} height={size}><circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" />
    <circle cx={size / 2} cy={size / 2} r={r} className={'ring-fg ' + (v >= 1 ? 'done' : '')} strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform={`rotate(-90 ${size / 2} ${size / 2})`} /></svg>;
}

export function Sidebar() {
  const { project, data, setData, prefs, setPrefs } = useStore(); const nav = useNav();
  const [w, setW] = useState(window.innerWidth); useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
  const collapsed = prefs.collapsed || w < 1000;
  let group = '';
  return <aside className={'side ' + (collapsed ? 'collapsed' : '')} data-testid="sidebar">
    <div className="brand"><div className="logo"><I n="lightbulb-flash-line" /></div><div className="brand-t"><b>概念设计工作台</b><small>Concept Design Studio</small></div></div>
    <div className="proj-switch-wrap"><I n="folder-3-line" /><select className="proj-switch" data-testid="proj-switch" title="切换项目" value={data.currentId || ''} onChange={e => setData(d => ({ ...d, currentId: e.target.value }))}>
      {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}{!data.projects.length && <option value="">（无项目）</option>}</select></div>
    <button className="search-btn" data-testid="open-palette" onClick={nav.openPalette} data-tip="全局搜索 (Ctrl+K)"><I n="search-line" /><span>搜索或执行命令…</span><kbd>Ctrl K</kbd></button>
    <nav>{NAV.map(m => { const head = m.group !== group; group = m.group; const pr = project ? progress(project, m.key) : null;
      return <React.Fragment key={m.key}>{head && <div className="grp"><span>{m.group}</span>{project && PHASES.includes(m.group) && <em>{Math.round(phaseProgress(project, m.group) * 100)}%</em>}</div>}
        <button className={'nav ' + (nav.page === m.key ? 'on' : '')} data-testid={'nav-' + m.key} data-tip={collapsed ? m.label : undefined} disabled={!project && m.key !== 'projects'} onClick={() => nav.go(m.key)}>
          <i className={'ri-' + m.icon} /><span className="nl">{m.label}</span><TocStatus k={m.key} /></button></React.Fragment>; })}</nav>
    <div className="side-foot"><button className="icon-btn" data-testid="toggle-sidebar" data-tip={prefs.collapsed ? '展开侧边栏 (Ctrl+B)' : '折叠侧边栏 (Ctrl+B)'} onClick={() => setPrefs({ collapsed: !prefs.collapsed })}><I n={prefs.collapsed ? 'menu-unfold-line' : 'menu-fold-line'} /></button><span className="ver">v1.5.1 · 本地存储</span></div></aside>;
}

function TocStatus({ k }: { k: string }) {
  const { project } = useStore(); const ai = useAI(); if (!project || !chapterDef(k)) return null;
  const g = ai.gen?.key === k && ai.gen.projectId === project.id; const s = chapterStatus(project, k);
  return <span className={'np toc-s ' + (g ? 'gen' : s)} data-testid={'toc-status-' + k} data-status={g ? 'gen' : s} title={g ? '生成中' : { empty: '待生成', pending: '待审核', accepted: '已采纳' }[s]}>
    {g ? <I n="loader-4-line" c="spin" /> : s === 'accepted' ? <I n="checkbox-circle-fill" /> : s === 'pending' ? <I n="error-warning-fill" /> : <I n="checkbox-blank-circle-line" />}</span>;
}

export function Topbar() {
  const { project, prefs, setPrefs, saving, saved, undo, redo, canUndo, canRedo } = useStore(); const nav = useNav(); const ai = useAI();
  const rp = project ? reviewProgress(project) : null;
  const mode = prefs.docMode || 'preview';
  const setMode = (m: 'preview' | 'edit') => setPrefs({ docMode: m });
  return <header className="topbar"><div className="crumb"><span className="crumb-p">{project?.name || '未选择项目'}</span><I n="arrow-right-s-line" c="sep" /><span>{metaOf(nav.page)?.label}</span></div>
    <div className="top-actions">
      {project && <div className="mode-toggle" data-testid="mode-toggle" role="tablist" aria-label="文档模式">
        <button className={mode === 'preview' ? 'on' : ''} data-testid="mode-preview" role="tab" aria-selected={mode === 'preview'} onClick={() => setMode('preview')} data-tip="预览模式：像阅读报告一样浏览 (Ctrl+Shift+P)"><I n="eye-line" /> 预览</button>
        <button className={mode === 'edit' ? 'on' : ''} data-testid="mode-edit" role="tab" aria-selected={mode === 'edit'} onClick={() => setMode('edit')} data-tip="编辑模式：AI 生成与内容编辑 (Ctrl+Shift+P)"><I n="edit-2-line" /> 编辑</button>
      </div>}
      <span className={'save ' + saving} data-testid="save-status" data-tip="所有修改自动保存到本机">{saving === 'saving' ? <><I n="loader-4-line" c="spin" /> 保存中…</> : saving === 'error' ? <><I n="error-warning-fill" /> 保存失败</> : <><I n="cloud-line" /> {saved ? `已保存 ${saved}` : '就绪'}</>}</span>
      {project && <button className={'icon-btn' + (prefs.chatOpen ? ' on' : '')} data-testid="chat-toggle" onClick={() => setPrefs({ chatOpen: !prefs.chatOpen })} data-tip="AI 助手 (Ctrl+J)"><I n="chat-smile-2-line" /></button>}
      {project && <button className="icon-btn" data-testid="history-btn" onClick={() => window.dispatchEvent(new Event('cds:history'))} data-tip={`版本历史（${project.ai?.snapshots?.length || 0}）`}><I n="history-line" /></button>}
      {rp && <button className="review-pill" data-testid="review-pill" onClick={() => { if (mode === 'preview') setMode('edit'); nav.go('ai'); }} data-tip="AI 章节审核进度"><I n="sparkling-2-line" /> 审核 {rp.acc}/{rp.n}{rp.pend > 0 && <em>{rp.pend} 待审</em>}</button>}
      {mode === 'edit' && <><div className="divider" />
      <button className="icon-btn" data-testid="undo" disabled={!canUndo} onClick={undo} data-tip="撤销 (Ctrl+Z)"><I n="arrow-go-back-line" /></button>
      <button className="icon-btn" data-testid="redo" disabled={!canRedo} onClick={redo} data-tip="重做 (Ctrl+Y)"><I n="arrow-go-forward-line" /></button></>}
      <div className="divider" />
      <button className="icon-btn" data-testid="theme-toggle" onClick={() => setPrefs({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })} data-tip={prefs.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}><I n={prefs.theme === 'dark' ? 'sun-line' : 'moon-line'} /></button>
      <button className="icon-btn" data-testid="open-help" onClick={nav.openHelp} data-tip="快捷键 (F1)"><I n="keyboard-box-line" /></button>
      <button className="icon-btn" data-testid="open-settings" onClick={() => ai.openSettings()} data-tip="AI 模型设置 (Ctrl+,)"><I n="settings-3-line" /></button>
      <button className="icon-btn" onClick={nav.openTour} data-tip="新手引导" data-testid="open-tour"><I n="question-line" /></button>
    </div></header>;
}

export function Stepper() {
  const { project } = useStore(); const nav = useNav(); if (!project) return null;
  const cur = metaOf(nav.page)?.group;
  return <div className="stepper" data-testid="stepper">{PHASES.map((ph, i) => { const v = phaseProgress(project, ph); const first = NAV.find(n => n.group === ph)!;
    return <React.Fragment key={ph}>{i > 0 && <div className={'step-line ' + (v > 0 ? 'on' : '')} />}
      <button className={'step ' + (cur === ph ? 'cur ' : '') + (v >= 1 ? 'done' : '')} onClick={() => nav.go(first.key)} data-tip={`${ph}阶段：${NAV.filter(n => n.group === ph).map(n => n.label).join('、')}`}>
        <span className="step-n">{v >= 1 ? <I n="check-line" /> : i + 1}</span><span className="step-t"><b>{ph}</b><small data-testid={'phase-' + ph}>{Math.round(v * 100)}%</small></span></button></React.Fragment>; })}</div>;
}

export function ModuleHelp({ k }: { k: string }) {
  const { prefs, setPrefs } = useStore(); const m = metaOf(k); if (!m) return null;
  const hidden = prefs.helpHidden[k];
  if (hidden) return <button className="help-pill" data-testid="help-show" onClick={() => setPrefs({ helpHidden: { ...prefs.helpHidden, [k]: false } })}><I n="lightbulb-line" /> 使用提示</button>;
  return <div className="module-help" data-testid="module-help"><I n="lightbulb-line" c="mh-ic" /><ul>{m.help.map(h => <li key={h}>{h}</li>)}</ul>
    <button className="icon-btn sm" data-testid="help-hide" data-tip="隐藏提示" onClick={() => setPrefs({ helpHidden: { ...prefs.helpHidden, [k]: true } })}><I n="close-line" /></button></div>;
}

export function Toasts() {
  const { toasts, dismiss } = useStore();
  return <div className="toasts">{toasts.map(t => <div key={t.id} className={'toast ' + t.kind} data-testid="toast">
    <I n={{ ok: 'checkbox-circle-fill', info: 'information-fill', warn: 'error-warning-fill', err: 'close-circle-fill' }[t.kind]} />
    <span>{t.text}</span>{t.action && <button data-testid="toast-action" onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>}
    <button className="tx" onClick={() => dismiss(t.id)}><I n="close-line" /></button></div>)}</div>;
}

export function ConfirmDialog() {
  const { confirmState: c } = useStore(); const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => { ok.current?.focus(); }, [c]);
  if (!c) return null;
  return <div className="overlay" onMouseDown={() => c.resolve(false)} onKeyDown={e => e.key === 'Escape' && c.resolve(false)}>
    <div className="dialog" data-testid="confirm" onMouseDown={e => e.stopPropagation()}>
      <div className={'dlg-ic ' + (c.danger ? 'danger' : '')}><I n={c.danger ? 'delete-bin-6-line' : 'question-line'} /></div>
      <h3>{c.title}</h3><p>{c.message}</p>
      <div className="dlg-btns"><button className="btn" data-testid="confirm-cancel" onClick={() => c.resolve(false)}>取消</button>
        <button ref={ok} className={'btn ' + (c.danger ? 'danger-solid' : 'primary')} data-testid="confirm-ok" onClick={() => c.resolve(true)}>{c.okText || '确定'}</button></div></div></div>;
}

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return <div className="overlay" onMouseDown={onClose}><div className="dialog wide" data-testid="shortcut-help" onMouseDown={e => e.stopPropagation()}>
    <div className="dlg-head"><h3><I n="keyboard-box-line" /> 键盘快捷键</h3><button className="icon-btn" onClick={onClose}><I n="close-line" /></button></div>
    <table className="kbd-table"><tbody>{SHORTCUTS.map(([k, d]) => <tr key={k}><td>{k.split(' / ').map(x => <kbd key={x}>{x}</kbd>)}</td><td>{d}</td></tr>)}</tbody></table></div></div>;
}

interface Cmd { id: string; label: string; sub?: string; icon: string; group: string; run: () => void; }
export function Palette({ onClose }: { onClose: () => void }) {
  const st = useStore(); const nav = useNav(); const p = st.project; const ai = useAI();
  const [q, setQ] = useState(''); const [sel, setSel] = useState(0); const listRef = useRef<HTMLDivElement>(null);
  const cmds = useMemo<Cmd[]>(() => {
    const c: Cmd[] = [];
    NAV.forEach(m => c.push({ id: 'go-' + m.key, label: m.label, sub: m.group, icon: m.icon, group: '跳转到模块', run: () => nav.go(m.key) }));
    const act = (id: string, label: string, icon: string, run: () => void) => c.push({ id, label, icon, group: '命令', run });
    if (p) { act('qa-req', '新增需求', 'add-line', () => nav.quickAdd('requirement')); act('qa-risk', '新增风险', 'add-line', () => nav.quickAdd('risk')); act('qa-sh', '新增干系人', 'add-line', () => nav.quickAdd('stakeholder'));
      act('qa-feat', '新增功能', 'add-line', () => nav.quickAdd('feature')); act('qa-term', '新增术语', 'add-line', () => nav.quickAdd('term')); act('qa-persona', '新增用户画像', 'add-line', () => nav.quickAdd('persona')); }
    act('new-proj', '新建项目', 'folder-add-line', () => nav.go('projects'));
    act('ai-settings', 'AI 模型设置', 'settings-3-line', () => ai.openSettings());
    if (p) { act('ai-all', 'AI 一键生成全部章节', 'magic-line', () => { nav.go('ai'); ai.generateAll(); }); act('ai-check', 'AI 一致性检查', 'shield-check-line', () => { nav.go('ai'); ai.checkConsistency(); });
      NAV.filter(m => chapterDef(m.key)).forEach(m => c.push({ id: 'gen-' + m.key, label: `AI 生成「${m.label}」`, icon: 'sparkling-2-line', group: 'AI', run: () => { nav.go(m.key); ai.generate(m.key); } })); }
    act('theme', '切换浅色 / 深色主题', 'contrast-2-line', () => st.setPrefs({ theme: st.prefs.theme === 'dark' ? 'light' : 'dark' }));
    act('side', '折叠 / 展开侧边栏', 'layout-left-line', () => st.setPrefs({ collapsed: !st.prefs.collapsed }));
    act('undo', '撤销', 'arrow-go-back-line', st.undo); act('redo', '重做', 'arrow-go-forward-line', st.redo);
    act('help', '查看快捷键', 'keyboard-box-line', nav.openHelp); act('tour', '重新打开新手引导', 'guide-line', nav.openTour);
    st.data.projects.forEach(x => c.push({ id: 'p-' + x.id, label: x.name, sub: x.template, icon: 'folder-3-line', group: '项目', run: () => { st.setData(d => ({ ...d, currentId: x.id })); nav.go('dashboard'); } }));
    if (p) {
      p.requirements.forEach(r => c.push({ id: 'r-' + r.id, label: `${r.code} ${r.title}`, sub: r.moscow, icon: 'file-list-3-line', group: '需求', run: () => nav.go('requirements', { open: r.id }) }));
      p.features.forEach(f => c.push({ id: 'f-' + f.id, label: f.name, sub: f.release, icon: 'puzzle-line', group: '功能', run: () => nav.go('scope') }));
      p.personas.forEach(f => c.push({ id: 'pe-' + f.id, label: f.name, sub: f.role, icon: 'user-heart-line', group: '用户画像', run: () => nav.go('personas') }));
      p.stakeholders.forEach(f => c.push({ id: 's-' + f.id, label: f.name, sub: f.role, icon: 'group-line', group: '干系人', run: () => nav.go('stakeholders') }));
      p.risks.forEach(f => c.push({ id: 'k-' + f.id, label: f.desc || '(未描述)', sub: f.kind, icon: 'error-warning-line', group: '风险与假设', run: () => nav.go('risks') }));
      p.glossary.forEach(f => c.push({ id: 'g-' + f.id, label: f.term, sub: f.definition, icon: 'book-2-line', group: '术语', run: () => nav.go('glossary') }));
    }
    return c;
  }, [p, st.data.projects, st.prefs]);
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = (toks.length ? cmds.filter(c => toks.every(t => (c.label + ' ' + (c.sub || '') + ' ' + c.group).toLowerCase().includes(t))) : cmds.filter(c => c.group !== 'AI' && c.group !== '需求' && c.group !== '术语' && c.group !== '风险与假设' && c.group !== '干系人' && c.group !== '功能' && c.group !== '用户画像')).slice(0, 60);
  useEffect(() => setSel(0), [q]);
  useEffect(() => { listRef.current?.querySelector('.pi.sel')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const run = (c?: Cmd) => { if (!c) return; onClose(); c.run(); };
  let g = '';
  return <div className="overlay top" onMouseDown={onClose}><div className="palette" data-testid="palette" onMouseDown={e => e.stopPropagation()}>
    <div className="pal-in"><I n="search-line" /><input autoFocus data-testid="palette-input" placeholder="搜索模块、需求、功能、术语，或输入命令…" value={q} onChange={e => setQ(e.target.value)}
      onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, list.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); } else if (e.key === 'Enter') run(list[sel]); else if (e.key === 'Escape') onClose(); }} /><kbd>Esc</kbd></div>
    <div className="pal-list" ref={listRef}>{list.length === 0 && <div className="pal-empty"><I n="search-eye-line" /> 没有找到与“{q}”匹配的结果</div>}
      {list.map((c, i) => { const head = c.group !== g; g = c.group; return <React.Fragment key={c.id}>{head && <div className="pg">{c.group}</div>}
        <div className={'pi ' + (i === sel ? 'sel' : '')} data-testid="palette-item" onMouseEnter={() => setSel(i)} onClick={() => run(c)}><I n={c.icon} /><span className="pl">{c.label}</span>{c.sub && <span className="ps">{c.sub}</span>}</div></React.Fragment>; })}</div>
    <div className="pal-foot"><span><kbd><I n="arrow-up-line" /></kbd><kbd><I n="arrow-down-line" /></kbd> 选择</span><span><kbd>Enter</kbd> 执行</span><span><kbd>Esc</kbd> 关闭</span></div></div></div>;
}

const STEPS = [
  { icon: 'lightbulb-flash-line', title: '欢迎使用软件概念设计工作台', body: '用 AI 从一句话构想生成完整概念设计，再由你逐章审核。示例项目可随时对照学习。' },
  { icon: 'route-line', title: '按四个阶段推进', body: '按 发现 → 定义 → 设计 → 治理 推进。左侧目录点击可平滑跳转；生成时顶部进度条可随时停止。' },
  { icon: 'sparkling-2-line', title: 'AI 生成，人工审核', body: '在「AI 构思助手」中输入一句话构想，AI 会按顺序逐章生成草稿。每一章都需要你审核：采纳、逐条勾选、编辑后采纳、驳回或重新生成。目录中的徽标显示 待生成 / 待审核 / 已采纳。' },
  { icon: 'search-line', title: 'Ctrl + K 随时搜索', body: '命令面板可以搜索任意模块、需求、功能、术语，也能直接执行“新增需求”“切换主题”等命令。按 F1 查看全部快捷键。' },
  { icon: 'shield-check-line', title: '放心编辑', body: '所有修改自动保存在本机；误操作可随时 Ctrl + Z 撤销。删除条目后提示框里也有“撤销”按钮。' },
  { icon: 'rocket-2-line', title: '开始吧', body: '你可以先浏览示例项目了解用法，也可以直接新建自己的项目（支持 SaaS、移动应用、企业内部系统、AI 应用等模板）。' }
];
export function Tour({ onClose }: { onClose: (target?: string) => void }) {
  const [i, setI] = useState(0); const s = STEPS[i]; const last = i === STEPS.length - 1;
  return <div className="overlay"><div className="dialog tour" data-testid="tour">
    <div className="tour-art"><I n={s.icon} /></div><div className="tour-step">第 {i + 1} / {STEPS.length} 步</div>
    <h2>{s.title}</h2><p>{s.body}</p>
    <div className="dots">{STEPS.map((_, k) => <span key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} />)}</div>
    <div className="dlg-btns">{!last && <button className="btn ghost-btn" data-testid="tour-skip" onClick={() => onClose()}>跳过引导</button>}
      {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>上一步</button>}
      {last ? <><button className="btn" data-testid="tour-new" onClick={() => onClose('projects')}><I n="folder-add-line" /> 新建我的项目</button><button className="btn primary" data-testid="tour-done" onClick={() => onClose('dashboard')}><I n="eye-line" /> 浏览示例项目</button></>
        : <button className="btn primary" data-testid="tour-next" onClick={() => setI(i + 1)}>下一步 <I n="arrow-right-line" /></button>}</div></div></div>;
}

export function QuickAdd() {
  const nav = useNav(); const { project, prefs } = useStore(); const [open, setOpen] = useState(false); if (!project) return null;
  if ((prefs.docMode || 'preview') === 'preview') return null;
  const items: [string, string, string][] = [['requirement', '需求', 'file-list-3-line'], ['risk', '风险', 'error-warning-line'], ['feature', '功能', 'puzzle-line'], ['stakeholder', '干系人', 'group-line'], ['persona', '用户画像', 'user-heart-line'], ['term', '术语', 'book-2-line']];
  return <div className={'fab-wrap ' + (open ? 'open' : '')} onMouseLeave={() => setOpen(false)}>
    {open && <div className="fab-menu" data-testid="fab-menu">{items.map(([k, l, ic]) => <button key={k} data-testid={'qa-' + k} onClick={() => { setOpen(false); nav.quickAdd(k); }}><I n={ic} /> 新增{l}</button>)}</div>}
    <button className="fab" data-testid="fab" data-tip="快速新增" onClick={() => setOpen(!open)}><I n="add-line" /></button></div>;
}

export function EmptyState({ icon, title, desc, action, onAction, testid }: { icon: string; title: string; desc: string; action?: string; onAction?: () => void; testid?: string }) {
  return <div className="empty-state" data-testid={testid || 'empty-state'}><div className="es-ic"><I n={icon} /></div><h4>{title}</h4><p>{desc}</p>
    {action && <button className="btn primary" data-testid="empty-cta" onClick={onAction}><I n="add-line" /> {action}</button>}</div>;
}


export function GenProgressBar() {
  const ai = useAI(); const { project } = useStore(); const nav = useNav();
  const [nowTick, setNowTick] = useState(Date.now()); const t0 = React.useRef(Date.now());
  useEffect(() => { if (!ai.running) return; t0.current = Date.now(); const t = setInterval(() => setNowTick(Date.now()), 1000); return () => clearInterval(t); }, [ai.running]);
  const list = Object.values(ai.gens).filter(g => g.projectId === project?.id);
  if (!ai.running || !list.length || !project) return null;
  const g0 = list[0]; const total = Math.max(g0.total, 1); const idx = Math.min(total, ai.done + 1);
  const elapsed = Math.max(0, Math.round((nowTick - t0.current) / 1000));
  const titles = list.map(g => chapterDef(g.key)?.title || g.key).join('、');
  const pct = Math.round(((ai.done + list.filter(g => g.text).length * 0.5) / total) * 100);
  return <div className="gen-bar" data-testid="gen-bar">
    <div className="gen-bar-top">
      <I n={ai.stopping ? 'loader-4-line' : 'sparkling-2-line'} c="spin" />
      <b>{ai.stopping ? '正在停止…' : 'AI 生成中'}</b>
      <span className="muted" data-testid="gen-bar-meta">第 {idx}/{total} 章 · {list.length > 1 ? `并行 ${list.length} 章：` : ''}{titles} · 已用 {elapsed}s · 队列剩余 {Math.max(0, ai.queue.length - list.length)}</span>
      <button className="btn sm" onClick={() => nav.go(g0.key)}><I n="focus-3-line" /> 定位</button>
      <button className="btn sm danger-solid" data-testid="gen-bar-stop" disabled={ai.stopping} onClick={ai.stop}>
        <I n="stop-circle-line" /> {ai.stopping ? '停止中' : '停止全部'}</button>
    </div>
    <div className="gen-bar-track"><i style={{ width: Math.max(2, Math.min(99, pct)) + '%' }} /></div>
  </div>;
}
