import React, { useEffect, useRef, useState } from 'react';
import { uid } from './util';
import { useStore } from './store';
import { useNav } from './nav';

export const I = ({ n, c = '' }: { n: string; c?: string }) => <i className={`ri-${n} ${c}`} aria-hidden="true" />;
export const Search = ({ value, onChange, placeholder, testid }: { value: string; onChange: (v: string) => void; placeholder: string; testid?: string }) =>
  <span className="search"><I n="search-line" /><input placeholder={placeholder} value={value} data-testid={testid} onChange={e => onChange(e.target.value)} />{value && <button className="clear" onClick={() => onChange('')} data-tip="清除"><I n="close-circle-fill" /></button>}</span>;

export type Col<T> = { key: keyof T & string; label: string; type?: 'text' | 'area' | 'select' | 'number' | 'date'; options?: string[]; width?: number; min?: number; max?: number; placeholder?: string };

/** 通用可编辑表格：行内编辑、拖拽排序、删除可撤销、空状态引导 */
export function EditTable<T extends { id: string }>({ rows, cols, onChange, make, testid, addLabel = '新增', extra, emptyIcon = 'inbox-line', emptyText, itemName = '条目' }: {
  rows: T[]; cols: Col<T>[]; onChange: (r: T[]) => void; make: () => Omit<T, 'id'>; testid: string; addLabel?: string; extra?: (r: T) => React.ReactNode; emptyIcon?: string; emptyText?: string; itemName?: string;
}) {
  const { toast, undo } = useStore(); const { arg } = useNav();
  const [drag, setDrag] = useState<string | null>(null); const [over, setOver] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(arg?.flash || null); const tb = useRef<HTMLTableSectionElement>(null);
  useEffect(() => { if (!fresh) return; const el = tb.current?.querySelector(`tr[data-id="${fresh}"] input, tr[data-id="${fresh}"] textarea`) as HTMLInputElement | null;
    el?.focus(); el?.select?.(); el?.closest('tr')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); const t = setTimeout(() => setFresh(null), 1800); return () => clearTimeout(t); }, [fresh]);
  const set = (id: string, k: string, v: any) => onChange(rows.map(r => r.id === id ? { ...r, [k]: v } : r));
  const add = () => { const id = uid(); onChange([...rows, { id, ...make() } as T]); setFresh(id); };
  const del = (r: T) => { onChange(rows.filter(x => x.id !== r.id)); toast(`已删除${itemName}`, 'ok', { label: '撤销', run: undo }); };
  const drop = (target: string) => { if (!drag || drag === target) return; const a = [...rows]; const from = a.findIndex(x => x.id === drag); const [m] = a.splice(from, 1); a.splice(a.findIndex(x => x.id === target) + (from <= a.findIndex(x => x.id === target) ? 1 : 0), 0, m); onChange(a); };
  return <div className="card">
    <div className="toolbar"><button className="btn primary" data-testid={`${testid}-add`} onClick={add}><I n="add-line" /> {addLabel}</button><span className="muted">共 {rows.length} 条{rows.length > 1 && ' · 拖动左侧手柄可调整顺序'}</span></div>
    {rows.length === 0 ? <div className="empty-state sm" data-testid="empty-state"><div className="es-ic"><I n={emptyIcon} /></div><h4>还没有{itemName}</h4><p>{emptyText || '点击下方按钮添加第一条，所有内容都会自动保存。'}</p><button className="btn primary" data-testid="empty-cta" onClick={add}><I n="add-line" /> {addLabel}</button></div> :
    <div className="table-wrap"><table className="grid" data-testid={`${testid}-table`}>
      <thead><tr><th style={{ width: 26 }} />{cols.map(c => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}{extra && <th style={{ width: 80 }}>指标</th>}<th style={{ width: 44 }} /></tr></thead>
      <tbody ref={tb}>{rows.map(r => <tr key={r.id} data-id={r.id} className={(fresh === r.id ? 'flash ' : '') + (over === r.id && drag ? 'drop-over ' : '') + (drag === r.id ? 'dragging' : '')}
        onDragOver={e => { e.preventDefault(); setOver(r.id); }} onDrop={() => { drop(r.id); setDrag(null); setOver(null); }}>
        <td className="handle" draggable data-testid="drag-handle" onDragStart={() => setDrag(r.id)} onDragEnd={() => { setDrag(null); setOver(null); }} data-tip="拖动排序"><I n="draggable" /></td>
        {cols.map(c => <td key={c.key}><Cell col={c} value={(r as any)[c.key]} onChange={v => set(r.id, c.key, v)} /></td>)}
        {extra && <td>{extra(r)}</td>}
        <td><button className="icon-btn sm danger" data-testid="row-del" data-tip="删除" onClick={() => del(r)}><I n="delete-bin-6-line" /></button></td></tr>)}
      </tbody></table></div>}</div>;
}
function Cell<T>({ col, value, onChange }: { col: Col<T>; value: any; onChange: (v: any) => void }) {
  if (col.type === 'area') return <textarea className="cell" rows={2} placeholder={col.placeholder || '点击输入…'} value={value ?? ''} onChange={e => onChange(e.target.value)} />;
  if (col.type === 'select') return <select className="cell" value={value} onChange={e => onChange(e.target.value)}>{col.options!.map(o => <option key={o}>{o}</option>)}</select>;
  if (col.type === 'number') return <input className="cell" type="number" min={col.min} max={col.max} value={value} onChange={e => onChange(Number(e.target.value))} />;
  return <input className="cell" type={col.type === 'date' ? 'date' : 'text'} placeholder={col.placeholder || '点击输入…'} value={value ?? ''} onChange={e => onChange(e.target.value)} />;
}
export function Field({ label, value, onChange, area, rows = 3, testid, placeholder, hint }: { label: React.ReactNode; value: string; onChange: (v: string) => void; area?: boolean; rows?: number; testid?: string; placeholder?: string; hint?: string }) {
  return <label className="field"><span>{label}{hint && <i className="ri-information-line hint" data-tip={hint} />}</span>{area
    ? <textarea rows={rows} value={value} placeholder={placeholder} data-testid={testid} onChange={e => onChange(e.target.value)} />
    : <input value={value} placeholder={placeholder} data-testid={testid} onChange={e => onChange(e.target.value)} />}</label>;
}
export const Header = ({ title, desc, children }: { title: string; desc: string; children?: React.ReactNode }) =>
  <div className="page-head sub"><p className="muted" title={title}>{desc}</p><div className="actions">{children}</div></div>;
export const Tag = ({ c, children }: { c: string; children: React.ReactNode }) => <span className={`tag ${c}`}>{children}</span>;
