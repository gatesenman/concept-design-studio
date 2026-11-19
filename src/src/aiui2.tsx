import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store';
import { useAI, ClarifyQ } from './aiRunner';
import { useNav } from './nav';
import { I, Tag } from './ui';
import { CHAPTERS, chapterDef, emptyAI, currentContent } from './ai';
import { ROLES, chunkText, cost, Material, Cite, Snapshot, diffChapters, restoreSnapshot, INDUSTRIES, STYLES, defaultTpl, tplText, chapterKeyOf, allMaterials } from './aiplus';
import { uid, now } from './util';
import { wordDiff } from './ai';

const fmtT = (s?: string) => s ? new Date(s).toLocaleString('zh-CN', { hour12: false }) : '';
const fileIcon = (n: string) => /\.pdf$/i.test(n) ? 'file-pdf-2-line' : /\.docx?$/i.test(n) ? 'file-word-2-line' : /\.(md|markdown)$/i.test(n) ? 'markdown-line' : 'file-text-line';

/* ---------- citations ---------- */
export function CiteChips({ ids, cites, compact }: { ids?: string[]; cites?: Record<string, Cite>; compact?: boolean }) {
  if (!ids?.length) return null;
  return <span className="cites">{ids.map(id => { const c = cites?.[id]; return <span key={id} className={'cite-chip' + (compact ? ' sm' : '')} data-testid="cite-chip" title={c ? `《${c.name}》\n${c.text}` : '来源'}>{id}{!compact && c ? <em>{c.name}</em> : null}</span>; })}</span>;
}
export function CiteFooter({ k }: { k: string }) {
  const { project: p } = useStore(); const cites = p?.ai?.cites?.[k]; if (!p || !cites) return null;
  const c = currentContent(p, k); const used = new Set<string>([...((p.ai as any)?.chSources?.[k] || []), ...((c?.items || []) as any[]).flatMap(x => x.sources || [])]);
  const ids = Object.keys(cites).filter(id => used.has(id)); if (!ids.length) return null;
  return <div className="rp-cites" data-testid={'report-cites-' + k}><div className="rp-cites-h"><I n="book-open-line" /> 参考来源</div>
    <ol>{ids.map(id => <li key={id}><span className="cite-chip sm">{id}</span><b>《{cites[id].name}》</b><span className="muted">{cites[id].text.slice(0, 120)}{cites[id].text.length > 120 ? '…' : ''}</span></li>)}</ol></div>;
}

/* ---------- materials ---------- */
export function MaterialsBar() {
  const { project: p, update, toast } = useStore(); if (!p) return null;
  const ms = p.ai?.materials || [];
  const add = async () => {
    const r: any[] = await window.api?.readDocs?.(); if (!r?.length) return;
    const ok = r.filter(x => x.ok && x.text?.trim()); const bad = r.filter(x => !x.ok || !x.text?.trim());
    update(x => { const ai = x.ai || emptyAI(); const cur = (ai.materials || []).filter(m => !ok.some(o => o.name === m.name));
      return { ...x, ai: { ...ai, materials: [...cur, ...ok.map(o => ({ id: uid(), name: o.name, text: o.text, addedAt: now() } as Material))] } }; });
    if (ok.length) toast(`已导入 ${ok.length} 份资料，共 ${ok.reduce((s, o) => s + o.text.length, 0)} 字，生成时将按相关性检索引用`, 'ok');
    bad.forEach(b => toast(`「${b.name}」读取失败：${b.error || '没有可提取的文本'}`, 'err'));
  };
  const del = (id: string) => update(x => ({ ...x, ai: { ...(x.ai || emptyAI()), materials: (x.ai?.materials || []).filter(m => m.id !== id) } }));
  const chunks = allMaterials(p).reduce((s, m) => s + chunkText(m).length, 0);
  return <div className="materials" data-testid="materials">
    <div className="row"><button className="btn" onClick={add} data-testid="ai-import-docs"><I n="folder-upload-line" /> 导入资料（txt / md / docx / pdf，可多选）</button>
      {chunks > 0 && <span className="muted small" data-testid="mat-stat"><I n="database-2-line" /> {allMaterials(p).length} 份资料 · {chunks} 个检索片段（BM25）</span>}</div>
    {ms.length > 0 && <div className="mat-list">{ms.map(m => <span key={m.id} className="chip mat" data-testid="mat-chip" title={m.text.slice(0, 200)}><I n={fileIcon(m.name)} /> {m.name}<small>{m.text.length} 字</small><button className="chip-x" onClick={() => del(m.id)} aria-label="移除"><I n="close-line" /></button></span>)}</div>}
  </div>;
}

/* ---------- clarify ---------- */
export function ClarifyDialog() {
  const ai = useAI(); const [qs, setQs] = useState<ClarifyQ[]>([]);
  useEffect(() => { if (ai.clarifyQs) setQs(ai.clarifyQs.map(q => ({ ...q }))); }, [ai.clarifyQs]);
  if (!ai.clarifyQs) return null;
  const set = (i: number, a: string) => setQs(x => x.map((q, j) => j === i ? { ...q, a } : q));
  const answered = qs.filter(q => q.a.trim()).length;
  return <div className="overlay"><div className="dialog wide clarify" data-testid="clarify-dialog">
    <div className="dlg-head"><h3><I n="question-answer-line" /> 开始生成前，AI 想先确认几个问题</h3><button className="icon-btn" onClick={() => ai.submitClarify(null, false)} aria-label="关闭"><I n="close-line" /></button></div>
    <p className="muted small">回答会作为硬性约束写入每个章节的提示词，显著提升生成内容的贴合度。可点选建议答案，也可自由填写；不想回答可直接跳过。</p>
    <div className="cq-list">{qs.map((q, i) => <div className="cq" key={i} data-testid="clarify-q">
      <div className="cq-q"><span className="cq-n">Q{i + 1}</span><b>{q.q}</b></div>{q.why && <div className="muted small cq-why"><I n="information-line" /> {q.why}</div>}
      {!!q.options?.length && <div className="cq-opts">{q.options.map(o => <button key={o} className={'preset' + (q.a === o ? ' on' : '')} data-testid="clarify-opt" onClick={() => set(i, q.a === o ? '' : o)}>{o}</button>)}</div>}
      <input data-testid="clarify-a" value={q.a} placeholder="输入你的回答…" onChange={e => set(i, e.target.value)} /></div>)}</div>
    <div className="dlg-btns end"><span className="muted small" style={{ marginRight: 'auto' }}>已回答 {answered}/{qs.length}</span>
      <button className="btn" data-testid="clarify-skip" onClick={() => ai.submitClarify(ai.clarifyThen ? [] : null, ai.clarifyThen)}>跳过{ai.clarifyThen ? '，直接生成' : ''}</button>
      <button className="btn primary" data-testid="clarify-go" onClick={() => ai.submitClarify(qs, ai.clarifyThen)}><I n={ai.clarifyThen ? 'magic-line' : 'save-3-line'} /> {ai.clarifyThen ? '保存回答并开始生成' : '保存回答'}</button></div></div></div>;
}
export function ClarifySummary() {
  const { project: p, update } = useStore(); const ai = useAI(); const c = p?.ai?.clarify; if (!p) return null;
  const answered = (c || []).filter(x => x.a?.trim());
  return <div className="clarify-sum" data-testid="clarify-summary"><I n="question-answer-line" />
    {c ? answered.length ? <><span>已澄清 {answered.length} 个问题：</span><span className="cs-list">{answered.map((x, i) => <span key={i} className="chip" title={x.q}>{x.a}</span>)}</span></> : <span className="muted">已跳过需求澄清</span> : <span className="muted">一键生成前，AI 会先提出 3-6 个澄清问题</span>}
    <button className="btn sm" data-testid="clarify-open" disabled={ai.clarifying || ai.running} onClick={() => ai.askClarify(false)}>{ai.clarifying ? <I n="loader-4-line" c="spin" /> : <I n="chat-forward-line" />} {c ? '重新澄清' : '先做澄清'}</button>
    {c && <button className="icon-btn sm" data-tip="清除澄清回答" onClick={() => update(x => ({ ...x, ai: { ...(x.ai || emptyAI()), clarify: undefined } }))}><I n="delete-bin-line" /></button>}
  </div>;
}

/* ---------- usage ---------- */
export function UsageLine() {
  const { project: p } = useStore(); const ai = useAI(); const u = p?.ai?.usage; if (!u || !u.calls && !u.cached) return null;
  const c = cost(u, ai.settings?.preset);
  return <div className="usage-line" data-testid="usage"><I n="coins-line" /> 本项目 AI 用量：{u.calls} 次调用 · 输入 {u.prompt.toLocaleString()} / 输出 {u.completion.toLocaleString()} tokens{u.cached ? ` · 缓存命中 ${u.cached} 次` : ''}{c > 0 ? ` · 估算费用 ¥${c.toFixed(c < 0.1 ? 4 : 2)}` : ''}</div>;
}

/* ---------- multi-role review ---------- */
export function ReviewPanel() {
  const { project: p, update } = useStore(); const ai = useAI(); const { go } = useNav(); const [role, setRole] = useState('all'); const [busy, setBusy] = useState<number | null>(null);
  if (!p) return null; const fs = p.ai?.reviews;
  const list = (fs || []).filter(f => role === 'all' || f.role === role);
  return <div className="card review" data-testid="review-panel">
    <h3><I n="team-line" /> 多角色 AI 评审 <span className="muted small">产品 · 架构 · 安全合规 · 运营 · 用户代言人，五个视角并行评审</span>
      <button className="btn sm primary" style={{ marginLeft: 'auto' }} data-testid="ai-review" disabled={!!ai.reviewing.length} onClick={() => ai.runReview()}>{ai.reviewing.length ? <><I n="loader-4-line" c="spin" /> 评审中（剩余 {ai.reviewing.length}）</> : <><I n="play-circle-line" /> {fs ? '重新评审' : '开始评审'}</>}</button>
      {fs && <button className="icon-btn sm" onClick={() => update(x => ({ ...x, ai: { ...(x.ai || emptyAI()), reviews: undefined } }))} aria-label="清除"><I n="close-line" /></button>}</h3>
    {!!ai.reviewing.length && <div className="role-run">{ROLES.map(r => <span key={r.key} className={'role-pill ' + (ai.reviewing.includes(r.key) ? 'run' : 'done')}><I n={ai.reviewing.includes(r.key) ? 'loader-4-line' : 'check-line'} c={ai.reviewing.includes(r.key) ? 'spin' : ''} /> {r.name}</span>)}</div>}
    {fs && <>
      <div className="role-tabs">{[{ key: 'all', name: '全部', icon: 'apps-line' }, ...ROLES].map(r => { const n = r.key === 'all' ? fs.length : fs.filter(f => f.role === r.key).length;
        return <button key={r.key} className={'rtab' + (role === r.key ? ' on' : '')} data-testid={'rtab-' + r.key} onClick={() => setRole(r.key)}><I n={r.icon} /> {r.name}<b>{n}</b></button>; })}
        <span className="sev-sum">{(['高', '中', '低'] as const).map(s => <Tag key={s} c={s === '高' ? 'red' : s === '中' ? 'orange' : 'gray'}>{s} {fs.filter(f => f.severity === s).length}</Tag>)}</span></div>
      {list.length === 0 ? <p className="muted">暂无发现。</p> : <table className="grid"><thead><tr><th style={{ width: 54 }}>严重度</th><th style={{ width: 96 }}>角色</th><th style={{ width: 110 }}>章节</th><th>问题</th><th>建议</th><th style={{ width: 120 }}></th></tr></thead>
        <tbody>{list.map((f, i) => { const r = ROLES.find(x => x.key === f.role); const k = chapterKeyOf(f.chapter);
          return <tr key={i} data-testid="finding-row"><td><Tag c={f.severity === '高' ? 'red' : f.severity === '中' ? 'orange' : 'gray'}>{f.severity}</Tag></td><td><span className="role-name"><I n={r?.icon || 'user-line'} /> {r?.name}</span></td>
            <td>{k ? <a className="link" onClick={() => go(k)}>{chapterDef(k)?.title}</a> : f.chapter}</td><td>{f.issue}</td><td className="muted">{f.suggestion}</td>
            <td>{k && <button className="btn sm ai-btn" data-testid="finding-fix" disabled={ai.running} onClick={async () => { setBusy(i); await ai.fixDraft(f.chapter, f.issue, f.suggestion); setBusy(null); }}>{busy === i ? <I n="loader-4-line" c="spin" /> : <I n="magic-line" />} 生成修复草稿</button>}</td></tr>; })}</tbody></table>}
      <div className="muted small">评审时间：{fmtT(p.ai?.reviewedAt)} · 修复草稿会进入对应章节的「待审核」，不会直接修改文档</div></>}
  </div>;
}

/* ---------- chat drawer ---------- */
const QUICK = ['这份设计最薄弱的三个地方是什么？', '补充缺失的非功能需求', '帮我把风险章节写得更具体', '用三句话总结这个项目'];
export function ChatPanel() {
  const st = useStore(); const ai = useAI(); const { go } = useNav(); const p = st.project; const [text, setText] = useState(''); const [quote, setQuote] = useState<string | undefined>();
  const listRef = useRef<HTMLDivElement>(null); const msgs = p?.ai?.chat || [];
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = 1e9; }, [msgs.length, ai.chatBusy]);
  useEffect(() => { if (ai.chatDraft) { setText(ai.chatDraft.text); setQuote(ai.chatDraft.quote); ai.setChatDraft(null); } }, [ai.chatDraft]);
  if (!st.prefs.chatOpen || !p) return null;
  const send = (t = text) => { if (!t.trim()) return; ai.sendChat(t, quote); setText(''); setQuote(undefined); };
  const runAction = async (mid: string, idx: number) => {
    const m = msgs.find(x => x.id === mid); const a = m?.actions?.[idx]; if (!a) return;
    const ok = await ai.generate(a.chapter, { instruction: a.instruction, noCache: true });
    if (ok) { st.update(x => ({ ...x, ai: { ...x.ai!, chat: (x.ai!.chat || []).map(c => c.id === mid ? { ...c, actions: c.actions!.map((y, j) => j === idx ? { ...y, done: true } : y) } : c) } })); st.setPrefs({ docMode: 'edit' }); setTimeout(() => go(a.chapter), 60); }
  };
  return <aside className="chat-panel" data-testid="chat-panel">
    <div className="chat-head"><I n="chat-smile-2-line" /><b>AI 助手</b><span className="muted small">已读取「{p.name}」全文</span>
      <button className="icon-btn sm" style={{ marginLeft: 'auto' }} data-tip="清空对话" onClick={() => st.update(x => ({ ...x, ai: { ...(x.ai || emptyAI()), chat: [] } }))}><I n="delete-bin-6-line" /></button>
      <button className="icon-btn sm" data-tip="关闭 Ctrl+J" data-testid="chat-close" onClick={() => st.setPrefs({ chatOpen: false })}><I n="close-line" /></button></div>
    <div className="chat-list" ref={listRef}>
      {!msgs.length && <div className="chat-empty"><I n="sparkling-2-line" /><p>可以问我关于这份设计的任何问题，或让我提出修改。所有修改都会先变成<b>待审核草稿</b>，由你决定是否采纳。</p>
        <div className="chat-quick">{QUICK.map(q => <button key={q} className="preset" data-testid="chat-quick" onClick={() => send(q)}>{q}</button>)}</div></div>}
      {msgs.map(m => <div key={m.id} className={'cmsg ' + m.role + (m.error ? ' err' : '')} data-testid={'chat-msg-' + m.role}>
        {m.quote && <blockquote>{m.quote}</blockquote>}<div className="cbody">{m.text}</div>
        {!!m.actions?.length && <div className="cacts">{m.actions.map((a, i) => <button key={i} className={'btn sm ' + (a.done ? '' : 'ai-btn')} data-testid="chat-action" disabled={ai.running || a.done} onClick={() => runAction(m.id, i)} title={a.instruction}>
          <I n={a.done ? 'check-line' : 'magic-line'} /> {a.done ? '已生成草稿' : a.label || `修改「${chapterDef(a.chapter)?.title}」`}<small>{chapterDef(a.chapter)?.title}</small></button>)}</div>}</div>)}
      {ai.chatBusy && <div className="cmsg assistant typing" data-testid="chat-typing"><span /><span /><span /></div>}
    </div>
    <div className="chat-input">{quote && <div className="chat-quote"><I n="double-quotes-l" /> <span>{quote}</span><button className="chip-x" onClick={() => setQuote(undefined)}><I n="close-line" /></button></div>}
      <textarea data-testid="chat-input" rows={2} value={text} placeholder="问点什么，或描述你想要的修改…（Enter 发送，Shift+Enter 换行）" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
      <button className="btn primary" data-testid="chat-send" disabled={ai.chatBusy || !text.trim()} onClick={() => send()}><I n="send-plane-2-line" /></button></div>
  </aside>;
}

/* ---------- selection toolbar (preview) ---------- */
export function SelectionToolbar() {
  const st = useStore(); const ai = useAI(); const { go } = useNav(); const [s, setS] = useState<{ x: number; y: number; text: string; k: string } | null>(null);
  useEffect(() => {
    const h = () => setTimeout(() => {
      const sel = window.getSelection(); const t = sel?.toString().trim() || '';
      if (!t || t.length < 2 || (st.prefs.docMode || 'preview') !== 'preview') return setS(null);
      const node = sel!.anchorNode as any; const el = (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('[data-section]');
      if (!el) return setS(null);
      const r = sel!.getRangeAt(0).getBoundingClientRect(); setS({ x: r.left + r.width / 2, y: r.top, text: t.slice(0, 800), k: el.getAttribute('data-section') });
    }, 10);
    const d = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.('.sel-bar')) setS(null); };
    document.addEventListener('mouseup', h); document.addEventListener('mousedown', d); return () => { document.removeEventListener('mouseup', h); document.removeEventListener('mousedown', d); };
  }, [st.prefs.docMode]);
  if (!s) return null;
  const target = chapterDef(s.k) ? s.k : 'vision';
  const act = async (kind: string) => {
    const t = s.text; setS(null); window.getSelection()?.removeAllRanges();
    if (kind === 'ask') { st.setPrefs({ chatOpen: true }); ai.setChatDraft({ text: '', quote: t }); return; }
    const ins = kind === 'req' ? `把以下内容转化为结构化需求条目（含验收标准）：「${t}」` : `${kind === 'rewrite' ? '改写' : kind === 'expand' ? '扩写' : '精简'}以下文本，使其${kind === 'rewrite' ? '更专业、清晰' : kind === 'expand' ? '更具体、补充细节与示例' : '更简洁、去除冗余'}，其余内容保持不变：「${t}」`;
    const k = kind === 'req' ? 'requirements' : target;
    st.setPrefs({ docMode: 'edit' }); setTimeout(() => go(k), 60);
    await ai.generate(k, { instruction: ins, complete: kind === 'req', noCache: true });
  };
  const B = (k: string, ic: string, l: string) => <button key={k} data-testid={'sel-' + k} disabled={ai.running} onMouseDown={e => e.preventDefault()} onClick={() => act(k)}><I n={ic} /> {l}</button>;
  return <div className="sel-bar" data-testid="sel-bar" style={{ left: Math.max(180, Math.min(window.innerWidth - 220, s.x)), top: Math.max(60, s.y - 46) }}>
    <span className="sel-ic"><I n="sparkling-2-fill" /></span>{B('rewrite', 'edit-line', '改写')}{B('expand', 'expand-diagonal-line', '扩写')}{B('shorten', 'contract-left-right-line', '精简')}{B('req', 'list-check-3', '转成需求')}{B('ask', 'chat-smile-2-line', '问 AI')}</div>;
}

/* ---------- history ---------- */
export function HistoryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const st = useStore(); const p = st.project; const [sel, setSel] = useState<string | null>(null);
  const snaps: Snapshot[] = p?.ai?.snapshots || [];
  useEffect(() => { if (open && snaps.length && !snaps.some(s => s.id === sel)) setSel(snaps[0].id); }, [open, snaps.length]);
  const s = snaps.find(x => x.id === sel);
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open]);
  const diff = useMemo(() => s && p ? diffChapters(JSON.parse(s.data), p) : [], [s?.id, p]);
  if (!open || !p) return null;
  const restore = async () => { if (!s) return; if (!await st.confirm({ title: "恢复历史版本", message: `恢复到「${s.label}」（${fmtT(s.at)}）的版本？当前内容会先自动保存为一个快照。`, okText: "恢复" })) return;
    st.update(x => restoreSnapshot(x, s)); st.toast('已恢复历史版本', 'ok'); onClose(); };
  return <div className="overlay" onMouseDown={onClose}><div className="drawer history" data-testid="history" onMouseDown={e => e.stopPropagation()}>
    <div className="dlg-head"><h3><I n="history-line" /> 版本历史 <span className="muted small">每次采纳 AI 草稿前自动快照，最多保留 20 个</span></h3><button className="icon-btn" onClick={onClose}><I n="close-line" /></button></div>
    {!snaps.length ? <div className="empty-mini"><I n="time-line" /><p>还没有快照。采纳任意 AI 草稿后会自动创建。</p></div> :
      <div className="hist-body"><ul className="hist-list">{snaps.map(x => <li key={x.id} data-testid="snap-item" className={x.id === sel ? 'on' : ''} onClick={() => setSel(x.id)}><I n="git-commit-line" /><div><b>{x.label}</b><small>{fmtT(x.at)}</small></div></li>)}</ul>
        <div className="hist-diff" data-testid="snap-diff">{s && <><div className="hd-head"><b>该快照 → 当前版本 的变化</b><button className="btn sm primary" data-testid="snap-restore" onClick={restore}><I n="arrow-go-back-line" /> 恢复到此版本</button></div>
          {!diff.length ? <p className="muted">与当前版本内容一致。</p> : diff.map((d: any) => <div key={d.key} className="hd-ch" data-testid="snap-diff-ch"><div className="hd-t"><I n="file-list-3-line" /> {d.title}</div>
            {d.kind === 'object' ? d.fields.map((f: any) => <div key={f.f} className="hd-f"><span className="k">{f.label}</span><span className="wdiff pre">{wordDiff(f.old, f.now).map((x, i) => <span key={i} className={'w-' + x.k}>{x.t}</span>)}</span></div>)
              : <div className="hd-l">{d.added.map((x: string) => <span key={'a' + x} className="chip add"><I n="add-line" />{x}</span>)}{d.removed.map((x: string) => <span key={'r' + x} className="chip del"><I n="subtract-line" />{x}</span>)}{d.changed.map((x: string) => <span key={'c' + x} className="chip chg"><I n="edit-line" />{x}</span>)}</div>}</div>)}</>}</div></div>}
  </div></div>;
}

/* ---------- prompt template settings ---------- */
export function PromptTplSettings() {
  const st = useStore(); const t = { ...defaultTpl, ...(st.prefs.aiTpl || {}) }; const set = (x: any) => st.setPrefs({ aiTpl: { ...t, ...x } });
  return <div className="tpl-set" data-testid="tpl-settings"><h4><I n="quill-pen-line" /> 提示词模板</h4>
    <div className="cols2 tight"><label className="field"><span>行业预设</span><select data-testid="tpl-industry" value={t.industry} onChange={e => set({ industry: e.target.value })}>{Object.keys(INDUSTRIES).map(k => <option key={k}>{k}</option>)}</select></label>
      <label className="field"><span>写作风格</span><select data-testid="tpl-style" value={t.style} onChange={e => set({ style: e.target.value })}>{Object.keys(STYLES).map(k => <option key={k}>{k}</option>)}</select></label></div>
    <label className="field"><span>团队补充约定（会附加到所有提示词）</span><textarea data-testid="tpl-custom" rows={2} value={t.custom} placeholder="例如：需求编号使用 FR-xxx；所有金额单位为人民币万元；优先考虑国产化方案" onChange={e => set({ custom: e.target.value })} /></label>
    {tplText(t) && <div className="tpl-preview muted small"><I n="eye-line" /> 注入内容：{tplText(t)}</div>}
    <div className="cols3"><label className="chk"><input type="checkbox" data-testid="opt-clarify" checked={st.prefs.clarifyOn !== false} onChange={e => st.setPrefs({ clarifyOn: e.target.checked })} /> 一键生成前先做需求澄清</label>
      <label className="chk"><input type="checkbox" checked={st.prefs.useCache !== false} onChange={e => st.setPrefs({ useCache: e.target.checked })} /> 启用结果缓存（相同输入不重复计费）</label>
      <label className="field inline"><span>并行章节数</span><select value={st.prefs.concurrency || 2} onChange={e => st.setPrefs({ concurrency: +e.target.value })}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></label></div></div>;
}
