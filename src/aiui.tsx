import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store';
import { useAI } from './aiRunner';
import { useNav } from './nav';
import { I, Tag } from './ui';
import { CHAPTERS, chapterDef, chapterStatus, currentContent, diffItem, applyDraft, emptyAI, STATUS_LABEL, ChStatus, wordDiff } from './ai';
import { metaOf } from './meta';
import { now } from './util';
import { ReportChapter, ReportSectionHead } from './report';
import { MaterialsBar, ClarifySummary, UsageLine, ReviewPanel, PromptTplSettings, CiteChips } from './aiui2';
import { withSnapshot, chapterKeyOf } from './aiplus';

export const PRESETS: Record<string, { label: string; baseUrl: string; model: string; hint: string }> = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', hint: 'platform.deepseek.com 获取 API Key' },
  dashscope: { label: '通义千问（DashScope 兼容模式）', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', hint: '阿里云百炼控制台获取 API Key' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', hint: 'platform.openai.com 获取 API Key' },
  xai: { label: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', model: 'grok-3-mini', hint: 'console.x.ai 获取 API Key' },
  moonshot: { label: 'Moonshot（Kimi）', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-32k', hint: 'platform.moonshot.cn 获取 API Key' },
  custom: { label: '自定义（OpenAI 兼容）', baseUrl: '', model: '', hint: '任意兼容 /chat/completions 的服务，如本地 Ollama、vLLM' }
};

export function SettingsDialog() {
  const ai = useAI(); const { toast } = useStore();
  const [f, setF] = useState({ preset: 'deepseek', baseUrl: PRESETS.deepseek.baseUrl, model: PRESETS.deepseek.model, temperature: 0.7, jsonMode: true, apiKey: '' });
  const [show, setShow] = useState(false); const [test, setTest] = useState<any>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (ai.settings && ai.settings.baseUrl) setF(x => ({ ...x, preset: ai.settings!.preset, baseUrl: ai.settings!.baseUrl, model: ai.settings!.model, temperature: ai.settings!.temperature, jsonMode: ai.settings!.jsonMode })); }, [ai.settingsOpen]);
  useEffect(() => { if (!ai.settingsOpen) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') ai.openSettings(false); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [ai.settingsOpen]);
  if (!ai.settingsOpen) return null;
  const close = () => ai.openSettings(false);
  const preset = (k: string) => setF(x => ({ ...x, preset: k, baseUrl: PRESETS[k].baseUrl || x.baseUrl, model: PRESETS[k].model || x.model }));
  const doTest = async () => { setBusy(true); setTest(null); const r = await window.api.testLlm({ baseUrl: f.baseUrl, model: f.model, apiKey: f.apiKey || undefined }); setTest(r); setBusy(false); };
  const save = async () => { const r = await window.api.saveSettings(f); await ai.reloadSettings(); toast(r.keyMode === 'safe' ? 'AI 设置已保存（API Key 已加密存储）' : 'AI 设置已保存'); close(); };
  return <div className="overlay" onMouseDown={close}><div className="dialog wide settings" data-testid="settings" onMouseDown={e => e.stopPropagation()}>
    <div className="dlg-head"><h3><I n="settings-3-line" /> AI 模型设置</h3><button className="icon-btn" onClick={close}><I n="close-line" /></button></div>
    <p className="muted small">支持任意 OpenAI 兼容接口。请求由本机主进程直接发往模型服务商；API Key 使用系统加密（Electron safeStorage）保存在本机，不会写入项目文件或导出文档。</p>
    <div className="presets">{Object.entries(PRESETS).map(([k, v]) => <button key={k} data-testid={'preset-' + k} className={'preset ' + (f.preset === k ? 'on' : '')} onClick={() => preset(k)}>{v.label}</button>)}</div>
    <label className="field"><span>Base URL</span><input data-testid="set-baseurl" value={f.baseUrl} placeholder="https://.../v1" onChange={e => setF({ ...f, baseUrl: e.target.value })} /></label>
    <label className="field"><span>API Key {ai.settings?.hasKey && <Tag c="green">已保存{ai.settings.keyMode === 'safe' ? '（已加密）' : ''}</Tag>}</span>
      <span className="pw"><input data-testid="set-key" type={show ? 'text' : 'password'} value={f.apiKey} placeholder={ai.settings?.hasKey ? '已保存，留空则保持不变' : 'sk-...'} onChange={e => setF({ ...f, apiKey: e.target.value })} />
        <button className="icon-btn sm" onClick={() => setShow(!show)} data-tip={show ? '隐藏' : '显示'}><I n={show ? 'eye-off-line' : 'eye-line'} /></button></span>
      <small className="muted">{PRESETS[f.preset]?.hint}</small></label>
    <div className="cols2 tight"><label className="field"><span>模型名称</span><input data-testid="set-model" value={f.model} onChange={e => setF({ ...f, model: e.target.value })} /></label>
      <label className="field"><span>创造性（temperature）：{f.temperature}</span><input type="range" min={0} max={1.5} step={0.1} value={f.temperature} onChange={e => setF({ ...f, temperature: +e.target.value })} /></label></div>
    <PromptTplSettings />
    <label className="chk"><input type="checkbox" checked={f.jsonMode} onChange={e => setF({ ...f, jsonMode: e.target.checked })} /> 启用 JSON 结构化输出模式（不支持时自动降级）</label>
    {test && <div className={'alert ' + (test.ok ? 'ok' : 'err')} data-testid="test-result">{test.ok ? <><I n="checkbox-circle-fill" /> 连接成功：{test.model}，耗时 {test.ms} ms</> : <><I n="close-circle-fill" /> 连接失败：{test.error}</>}</div>}
    <div className="dlg-btns end"><button className="btn" data-testid="set-test" disabled={busy} onClick={doTest}>{busy ? <I n="loader-4-line" c="spin" /> : <I n="pulse-line" />} 测试连接</button>
      <button className="btn primary" data-testid="set-save" onClick={save}><I n="save-3-line" /> 保存</button></div></div></div>;
}

export function StatusBadge({ s, gen }: { s: ChStatus; gen?: boolean }) {
  if (gen) return <span className="sbadge gen" data-testid="status-badge"><I n="loader-4-line" c="spin" /> 生成中</span>;
  return <span className={'sbadge ' + s} data-testid="status-badge"><I n={s === 'accepted' ? 'checkbox-circle-fill' : s === 'pending' ? 'time-line' : 'checkbox-blank-circle-line'} /> {STATUS_LABEL[s]}</span>;
}

export function reviewProgress(p: any) { const n = CHAPTERS.length; const acc = CHAPTERS.filter(c => chapterStatus(p, c.key) === 'accepted').length; const pend = CHAPTERS.filter(c => chapterStatus(p, c.key) === 'pending').length; return { n, acc, pend }; }

export function AIStartPanel() {
  const { project: p, update, toast } = useStore(); const ai = useAI(); const { go } = useNav(); if (!p) return null;
  const st = p.ai || emptyAI(); const { n, acc, pend } = reviewProgress(p);
  const setAI = (patch: any) => update(x => ({ ...x, ai: { ...(x.ai || emptyAI()), ...patch } }));
  const importDoc = async () => { const r = await window.api?.readTextFile(); if (r) { setAI({ docName: r.name, docText: r.text }); toast(`已导入「${r.name}」（${r.text.length} 字）`); } };
  return <div data-testid="page-ai" className="ai-start">
    <div className="ai-hero card"><div className="ai-hero-l">
      <div className="ai-badge"><I n="sparkling-2-line" /> AI 生成 · 人工审核</div>
      <label className="field"><span>项目构想 / 一句话需求</span><textarea data-testid="ai-brief" rows={4} value={st.brief} placeholder="例如：为连锁健身房做一个会员小程序，支持约课、体测数据记录、私教排班和会员续费提醒……" onChange={e => setAI({ brief: e.target.value })} /></label>
      <MaterialsBar />
      {st.docName && st.docText && <div className="row"><span className="chip"><I n="file-text-line" /> {st.docName}<button className="chip-x" onClick={() => setAI({ docName: '', docText: '' })}><I n="close-line" /></button></span></div>}
      <details className="paste"><summary>或粘贴参考资料文本</summary><textarea rows={4} data-testid="ai-doc" value={st.docText || ''} onChange={e => setAI({ docText: e.target.value, docName: st.docName || '粘贴的资料' })} /></details>
      <ClarifySummary />
      <div className="row">{ai.running ? <button className="btn danger-solid" data-testid="ai-stop" disabled={ai.stopping} onClick={ai.stop}><I n="stop-circle-line" /> {ai.stopping ? "正在停止…" : "停止生成"}</button>
        : <button className="btn primary lg" data-testid="ai-generate-all" disabled={(!st.brief.trim() && !st.docText) || ai.clarifying} onClick={() => ai.generateAll()}>{ai.clarifying ? <I n="loader-4-line" c="spin" /> : null}<I n="magic-line" /> AI 一键生成全部章节</button>}
        <label className="chk skip-chk"><input type="checkbox" data-testid="skip-accepted" checked={ai.skipAccepted} onChange={e => ai.setSkipAccepted(e.target.checked)} disabled={ai.running} />跳过已采纳</label>
        <button className="btn" data-testid="ai-check" disabled={ai.checking} onClick={ai.checkConsistency}>{ai.checking ? <I n="loader-4-line" c="spin" /> : <I n="shield-check-line" />} 一致性检查</button>
        <button className="btn" onClick={() => ai.openSettings()} data-testid="ai-settings-btn"><I n="settings-3-line" /> AI 设置</button>
        {!ai.configured && <span className="warn-text"><I n="error-warning-line" /> 尚未配置模型</span>}</div><UsageLine /></div>
      <div className="ai-hero-r"><div className="rv-ring"><svg width="92" height="92"><circle cx="46" cy="46" r="40" className="ring-bg2" /><circle cx="46" cy="46" r="40" className="ring-fg2" strokeDasharray={251} strokeDashoffset={251 * (1 - acc / n)} transform="rotate(-90 46 46)" /></svg><b data-testid="review-progress">{acc}/{n}</b><small>已采纳</small></div>
        <div className="rv-legend"><span><i className="d accepted" />已采纳 {acc}</span><span><i className="d pending" />待审核 {pend}</span><span><i className="d empty" />待生成 {n - acc - pend}</span></div></div></div>
    <div className="chapter-chips">{CHAPTERS.map((c, i) => { const s = chapterStatus(p, c.key); const g = ai.gens[c.key]?.projectId === p.id; const q = ai.queue.includes(c.key) && !g;
      return <button key={c.key} className={'cchip ' + s + (g ? ' gen' : '') + (q ? ' queued' : '')} onClick={() => go(c.key)} data-testid={'chip-' + c.key}><span className="cn">{i + 1}</span>{c.title}{g ? <I n="loader-4-line" c="spin" /> : q ? <I n="time-line" /> : s === 'accepted' ? <I n="check-line" /> : s === 'pending' ? <I n="eye-line" /> : null}</button>; })}</div>
    {st.issues && <div className="card issues" data-testid="issues"><h3><I n="shield-check-line" /> 一致性检查结果 <span className="muted small">（{st.issues.length} 项，{st.checkedAt ? new Date(st.checkedAt).toLocaleString('zh-CN', { hour12: false }) : ''}）</span><button className="icon-btn sm" style={{ marginLeft: 'auto' }} onClick={() => setAI({ issues: undefined })}><I n="close-line" /></button></h3>
      {st.issues.length === 0 ? <p className="muted">未发现问题。</p> : <table className="grid"><thead><tr><th style={{ width: 60 }}>级别</th><th style={{ width: 110 }}>章节</th><th>问题</th><th>建议</th><th style={{ width: 60 }}>来源</th><th style={{ width: 70 }}></th></tr></thead>
        <tbody>{st.issues.map((x, i) => <tr key={i} data-testid="issue-row"><td><Tag c={x.level === '高' ? 'red' : x.level === '中' ? 'orange' : 'gray'}>{x.level}</Tag></td><td><a className="link" onClick={() => { const c = CHAPTERS.find(c => c.title === x.chapter || x.chapter.includes(c.title)); if (c) go(c.key); }}>{x.chapter}</a></td><td>{x.issue}</td><td className="muted">{x.suggestion}</td><td><Tag c={x.source === 'AI' ? 'blue' : 'gray'}>{x.source}</Tag></td><td>{chapterKeyOf(x.chapter) && <button className="btn sm ai-btn" data-testid="issue-fix" disabled={ai.running} onClick={() => ai.fixDraft(x.chapter, x.issue, x.suggestion)}><I n="magic-line" /> 修复</button>}</td></tr>)}</tbody></table>}</div>}
    <ReviewPanel />
  </div>;
}

function FieldVal({ v }: { v: any }) {
  if (Array.isArray(v)) return <ol className="stages">{v.map((s, i) => <li key={i}><b>{s.name}</b>：{s.action}{s.pain && <span className="muted">（痛点：{s.pain}）</span>}</li>)}</ol>;
  if (v && typeof v === 'object') return <span>{Object.entries(v).map(([a, b]) => `${a} ${b}`).join(' · ')}</span>;
  return <span className="pre">{String(v ?? '')}</span>;
}

function WordDiff({ oldS, newS }: { oldS: string; newS: string }) {
  const parts = wordDiff(oldS, newS);
  return <span className="wdiff">{parts.map((p, i) => <span key={i} className={'w-' + p.k}>{p.t}</span>)}</span>;
}

export function DraftReview({ k }: { k: string }) {
  const st = useStore(); const ai = useAI(); const p = st.project!; const def = chapterDef(k)!; const ch = p.ai?.chapters[k];
  const [draft, setDraft] = useState<any>(ch?.draft); const [edit, setEdit] = useState(false);
  useEffect(() => { setDraft(ch?.draft); setEdit(false); }, [ch?.draft]);
  const items: any[] = draft?.items || [];
  const allKeys = def.kind === 'object' ? Object.keys(def.fields).filter(f => draft?.[f]) : [...items.map((_, i) => String(i)), ...(k === 'options' && draft?.criteria?.length ? ['criteria'] : [])];
  const [sel, setSel] = useState<Set<string>>(new Set(allKeys));
  useEffect(() => { setSel(new Set(allKeys)); }, [draft === ch?.draft ? ch?.draft : null]);
  if (!ch?.draft || !draft) return null;
  const cur = currentContent(p, k);
  const toggle = (key: string) => setSel(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const setItem = (i: number, f: string, v: any) => setDraft((d: any) => ({ ...d, items: d.items.map((x: any, j: number) => j === i ? { ...x, [f]: v } : x) }));
  const setObj = (f: string, v: any) => setDraft((d: any) => ({ ...d, [f]: v }));
  const accept = (edited: boolean) => { st.update(x => applyDraft(withSnapshot(x, `采纳「${def.title}」前`), k, draft, sel)); st.toast(`已${edited ? '编辑后' : ''}采纳「${def.title}」${def.kind === 'list' ? `（${[...sel].filter(s => s !== 'criteria').length} 条）` : ''}`); };
  const reject = () => { st.update(x => ({ ...x, ai: { ...x.ai!, chapters: { ...x.ai!.chapters, [k]: { status: 'empty', updatedAt: now() } } } })); st.toast(`已驳回「${def.title}」AI 草稿`, 'info', { label: '撤销', run: st.undo }); };
  const editable = (f: string) => typeof (def.kind === 'object' ? draft[f] : items[0]?.[f]) === 'string';
  return <div className="draft" data-testid={'draft-' + k}>
    <div className="draft-head"><div className="draft-t"><I n="sparkling-2-fill" /> <b>AI 草稿 · 待审核</b>
      <span className="muted small">{ch.mode === 'complete' ? '补全模式：仅包含新增条目' : '与当前内容对比：绿色为新增，黄色为修改'}{ch.instruction ? ` · 附加要求：${ch.instruction.slice(0, 80)}` : ''}</span>{draft._repaired && <Tag c="purple">已自动修复格式</Tag>}{draft.sources && <CiteChips ids={draft.sources} cites={draft._cites} />}</div>
      <div className="draft-sel">{allKeys.length > 1 && <><button className="btn sm" onClick={() => setSel(new Set(allKeys))}>全选</button><button className="btn sm" onClick={() => setSel(new Set())}>全不选</button></>}<span className="muted small">已选 {[...sel].length}/{allKeys.length}</span></div></div>
    {def.kind === 'object' ? <div className="draft-fields">{Object.keys(def.fields).filter(f => draft[f]).map(f => { const changed = (cur?.[f] || '') !== draft[f]; return <div key={f} className={'dfield ' + (sel.has(f) ? '' : 'off ') + (changed ? (cur?.[f] ? 'upd' : 'new') : 'same')}>
        <label className="chk"><input type="checkbox" data-testid="draft-check" checked={sel.has(f)} onChange={() => toggle(f)} /><b>{def.fields[f]}</b>{changed ? <Tag c={cur?.[f] ? 'orange' : 'green'}>{cur?.[f] ? '修改' : '新增'}</Tag> : <Tag c="gray">无变化</Tag>}</label>
        {edit ? <textarea data-testid="draft-edit" rows={k === 'arch' ? 8 : 3} value={draft[f]} onChange={e => setObj(f, e.target.value)} /> :
          <div className="dv" data-testid="field-diff">{changed && cur?.[f]
            ? <div className="pre"><WordDiff oldS={String(cur[f])} newS={String(draft[f])} /></div>
            : <div className="new pre">{draft[f]}</div>}</div>}</div>; })}</div>
    : <>{k === 'options' && draft.criteria?.length > 0 && <div className={'dfield ' + (sel.has('criteria') ? '' : 'off')}><label className="chk"><input type="checkbox" checked={sel.has('criteria')} onChange={() => toggle('criteria')} /><b>评估维度（替换现有）</b></label>
        <div className="chips">{draft.criteria.map((c: any) => <span className="chip" key={c.name}>{c.name} {c.weight}%</span>)}</div></div>}
      <div className="draft-items">{items.map((it, i) => { const d = diffItem(p, k, it); const title = it[def.idKey!] || `#${i + 1}`;
        return <div key={i} className={'ditem ' + d.state + (sel.has(String(i)) ? '' : ' off')} data-testid="draft-item">
          <label className="chk ditem-h"><input type="checkbox" data-testid="draft-check" checked={sel.has(String(i))} onChange={() => toggle(String(i))} />
            <b>{k === 'requirements' ? `${it.code} ${it.title}` : title}</b>{d.state === 'new' ? <Tag c="green">新增</Tag> : d.state === 'update' ? <Tag c="orange">修改</Tag> : <Tag c="gray">无变化</Tag>}
            <CiteChips ids={it.sources} cites={draft._cites} />{k === 'requirements' && <Tag c={it.moscow === 'Must' ? 'red' : it.moscow === 'Should' ? 'orange' : 'blue'}>{it.moscow}</Tag>}</label>
          <div className="ditem-b">{Object.keys(def.fields).filter(f => f !== def.idKey && it[f] !== '' && it[f] != null).map(f => { const changed = d.state === 'update' && JSON.stringify(d.old?.[f] ?? '') !== JSON.stringify(it[f]);
            return <div key={f} className={'kv ' + (changed ? 'chg' : '')}><span className="k">{def.fields[f]}</span>{edit && editable(f) ? <textarea rows={1} data-testid="draft-edit" value={it[f]} onChange={e => setItem(i, f, e.target.value)} /> : <span className="v">{changed && <s className="oldv">{String(d.old?.[f] ?? '')}</s>}<FieldVal v={it[f]} /></span>}</div>; })}
            {edit && <div className="kv"><span className="k">{def.fields[def.idKey!]}</span><input data-testid="draft-edit-id" value={it[def.idKey!]} onChange={e => setItem(i, def.idKey!, e.target.value)} /></div>}</div></div>; })}</div></>}
    <div className="draft-actions">
      {edit ? <button className="btn primary" data-testid="draft-accept-edited" disabled={!sel.size} onClick={() => accept(true)}><I n="check-double-line" /> 确认采纳修改</button>
        : <button className="btn primary" data-testid="draft-accept" disabled={!sel.size} onClick={() => accept(false)}><I n="check-line" /> 采纳{sel.size < allKeys.length ? `所选（${sel.size}）` : ''}</button>}
      <button className={'btn ' + (edit ? 'on' : '')} data-testid="draft-edit-toggle" onClick={() => setEdit(!edit)}><I n="edit-2-line" /> {edit ? '退出编辑' : '编辑后采纳'}</button>
      <button className="btn danger" data-testid="draft-reject" onClick={reject}><I n="close-circle-line" /> 驳回</button>
      <button className="btn" data-testid="draft-regen" disabled={ai.running} onClick={() => ai.generate(k, { instruction: ch.instruction, complete: ch.mode === 'complete', noCache: true })}><I n="refresh-line" /> 重新生成</button></div></div>;
}

/** wrapper for every chapter in the single long page */
export function Section({ k, idx, children }: { k: string; idx: number; children: React.ReactNode }) {
  const st = useStore(); const ai = useAI(); const m = metaOf(k); const def = chapterDef(k); const p = st.project!;
  const preview = (st.prefs.docMode || 'preview') === 'preview';
  const collapsed = !preview && !!st.prefs.collapsedSections?.[k]; const [help, setHelp] = useState(false); const [ask, setAsk] = useState(false); const [ins, setIns] = useState('');
  const s = def ? chapterStatus(p, k) : null; const gg = ai.gens[k]; const g = gg?.projectId === p.id;
  const streamRef = useRef<HTMLPreElement>(null); useEffect(() => { if (streamRef.current) streamRef.current.scrollTop = 1e9; }, [gg?.text]);
  const toggle = () => st.setPrefs({ collapsedSections: { ...(st.prefs.collapsedSections || {}), [k]: !collapsed } });
  const run = (o: any) => { setAsk(false); ai.generate(k, o); setIns(''); };
  if (preview) {
    return <section className={'sec rp-sec ' + (s ? 's-' + s : '')} id={'sec-' + k} data-section={k} data-testid={'sec-' + k}>
      <ReportSectionHead k={k} idx={idx} />
      <div className="sec-body rp-body"><ReportChapter k={k} /></div>
    </section>;
  }
  return <section className={'sec ' + (collapsed ? 'collapsed ' : '') + (s ? 's-' + s : '')} id={'sec-' + k} data-section={k} data-testid={'sec-' + k}>
    <div className="sec-head"><button className="sec-fold icon-btn sm" data-testid={'fold-' + k} onClick={toggle} data-tip={collapsed ? '展开' : '折叠'}><I n={collapsed ? 'arrow-right-s-line' : 'arrow-down-s-line'} /></button>
      <span className="sec-n">{String(idx).padStart(2, '0')}</span><i className={'ri-' + m.icon + ' sec-ic'} /><h2>{m.label}</h2>
      {s && <StatusBadge s={s} gen={g} />}
      <div className="sec-actions">
        <button className="icon-btn sm" onClick={() => setHelp(!help)} data-tip="使用提示"><I n="lightbulb-line" /></button>
        {def && <>{s === 'accepted' && <button className="btn sm" data-testid={'complete-' + k} disabled={ai.running} onClick={() => run({ complete: true })} data-tip="让 AI 只补充缺失条目"><I n="add-box-line" /> 补全缺失</button>}
          <div className="ask-wrap"><button className="btn sm ai-btn" data-testid={'gen-' + k} disabled={ai.running} onClick={() => setAsk(!ask)}><I n="sparkling-2-line" /> {s === 'empty' ? 'AI 生成' : '重新生成'}<I n="arrow-down-s-line" /></button>
            {ask && <div className="ask-pop" data-testid={'ask-' + k}><textarea autoFocus rows={3} data-testid={'ins-' + k} placeholder="可选：补充要求，例如“更侧重 B 端管理员”“需求控制在 10 条以内”" value={ins} onChange={e => setIns(e.target.value)} />
              <div className="row end"><button className="btn sm" onClick={() => setAsk(false)}>取消</button><button className="btn sm primary" data-testid={'ins-go-' + k} onClick={() => run({ instruction: ins.trim() })}><I n="sparkling-2-line" /> 生成</button></div></div>}</div></>}</div></div>
    {!collapsed && <div className="sec-body">
      {help && <div className="module-help"><I n="lightbulb-line" c="mh-ic" /><ul>{m.help.map(h => <li key={h}>{h}</li>)}</ul></div>}
      {g && <div className="stream" data-testid="ai-stream"><div className="stream-h"><I n="loader-4-line" c="spin" /> AI 正在生成「{m.label}」… <span className="muted small">{gg!.status || `${gg!.text.length} 字 · 第 ${gg!.index}/${gg!.total} 章`}</span><button className="btn sm" style={{ marginLeft: 'auto' }} disabled={ai.stopping} onClick={ai.stop}><I n="stop-circle-line" /> {ai.stopping ? '停止中' : '停止'}</button></div><pre ref={streamRef}>{gg!.text}<span className="caret" /></pre></div>}
      {def && p.ai?.chapters[k]?.error && !g && <div className="alert err" data-testid={'gen-error-' + k}><I n="error-warning-fill" /> {p.ai.chapters[k].error}
        <button className="btn sm" style={{ marginLeft: 8 }} data-testid={'retry-' + k} disabled={ai.running} onClick={() => ai.generate(k, { noCache: true })}><I n="refresh-line" /> 重试本章</button></div>}
      {def && s === 'pending' && <DraftReview k={k} />}
      {children}</div>}
  </section>;
}
