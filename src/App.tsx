import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { NavC } from './nav';
import { NAV } from './meta';
import { uid } from './util';
import * as P1 from './pages1';
import * as P2 from './pages2';
import { Sidebar, Topbar, Stepper, Toasts, ConfirmDialog, ShortcutHelp, Palette, Tour, QuickAdd, GenProgressBar } from './shell';
import { AIStartPanel, Section, SettingsDialog } from './aiui';
import { useAI } from './aiRunner';
import { ChatPanel, SelectionToolbar, ClarifyDialog, HistoryDrawer } from './aiui2';

const DOC = NAV.filter(n => n.key !== 'projects').map(n => n.key);

export default function App() {
  const st = useStore(); const ai = useAI(); const { project, prefs, setPrefs, update, toast } = st;
  const [view, setView] = useState<'doc' | 'projects'>(project ? 'doc' : 'projects');
  const [active, setActive] = useState('dashboard'); const [arg, setArg] = useState<any>(null); const [scrollTo, setScrollTo] = useState<string | null>(null);
  const [palette, setPalette] = useState(false); const [help, setHelp] = useState(false); const [tour, setTour] = useState(!prefs.onboarded);
  const [hist, setHist] = useState(false);
  useEffect(() => { const h = () => setHist(true); window.addEventListener('cds:history', h); return () => window.removeEventListener('cds:history', h); }, []);
  const contentRef = useRef<HTMLDivElement>(null); const lock = useRef(0);
  const curView = project ? view : 'projects';
  const go = (k: string, a: any = null) => {
    setArg(a);
    if (k === 'projects') { setView('projects'); setActive('projects'); contentRef.current?.scrollTo({ top: 0 }); return; }
    if (st.prefs.collapsedSections?.[k]) setPrefs({ collapsedSections: { ...st.prefs.collapsedSections, [k]: false } });
    setView('doc'); setActive(k); setScrollTo(k);
  };
  // perform smooth scroll after the doc view is rendered
  useLayoutEffect(() => {
    if (!scrollTo || curView !== 'doc') return;
    const el = document.getElementById('sec-' + scrollTo); const c = contentRef.current;
    if (el && c) { lock.current = Date.now() + 900; c.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' }); }
    setScrollTo(null);
  }, [scrollTo, curView]);
  // scrollspy via IntersectionObserver (more reliable with sticky headers)
  useEffect(() => {
    const c = contentRef.current; if (!c || curView !== 'doc') return;
    const secs = Array.from(c.querySelectorAll<HTMLElement>('[data-section]'));
    if (!secs.length) return;
    const ratios = new Map<string, number>();
    const io = new IntersectionObserver((entries) => {
      if (Date.now() < lock.current) return;
      for (const e of entries) {
        const k = (e.target as HTMLElement).dataset.section!;
        ratios.set(k, e.isIntersecting ? e.intersectionRatio : 0);
      }
      let best = secs[0].dataset.section!, bestR = -1;
      for (const s of secs) {
        const r = ratios.get(s.dataset.section!) || 0;
        // prefer sections whose top is near the top of the viewport
        const top = s.getBoundingClientRect().top - c.getBoundingClientRect().top;
        const score = r * 2 + (top >= -40 && top < 220 ? 1.5 : 0) - Math.max(0, top) / 2000;
        if (score > bestR) { bestR = score; best = s.dataset.section!; }
      }
      setActive(a => (a === best ? a : best));
    }, { root: c, threshold: [0, 0.15, 0.35, 0.55, 0.75], rootMargin: '-10% 0px -45% 0px' });
    secs.forEach(s => io.observe(s));
    return () => io.disconnect();
  }, [curView, project?.id]);

  // Auto-scroll to chapter being generated
  useEffect(() => {
    const h = (e: any) => { const k = e.detail?.key; if (k) go(k); };
    window.addEventListener('cds:gen-chapter', h); window.addEventListener('cds:goto', h); return () => { window.removeEventListener('cds:gen-chapter', h); window.removeEventListener('cds:goto', h); };
  });

  const quickAdd = (kind: string) => {
    if (!project) return;
    const id = uid();
    if (kind === 'requirement') { const n = Math.max(0, ...project.requirements.map(r => parseInt(r.code.replace(/\D/g, '')) || 0)) + 1;
      update(x => ({ ...x, requirements: [...x.requirements, { id, code: 'US-' + String(n).padStart(3, '0'), type: '用户故事', title: '新需求', asA: '', iWant: '', soThat: '', acceptance: '', moscow: 'Should', kano: '期望型', status: '草稿', featureId: '', stakeholderIds: [], personaId: '', value: 5, effort: 5 }] }));
      go('requirements', { open: id, focus: true }); }
    else if (kind === 'risk') { update(x => ({ ...x, risks: [...x.risks, { id, kind: '风险', desc: '', probability: 3, impact: 3, mitigation: '', owner: '', status: '开放' }] })); go('risks', { flash: id }); }
    else if (kind === 'feature') { update(x => ({ ...x, features: [...x.features, { id, name: '新功能', epic: x.features[0]?.epic || '核心', release: 'MVP', desc: '' }] })); go('scope', { flash: id }); }
    else if (kind === 'stakeholder') { update(x => ({ ...x, stakeholders: [...x.stakeholders, { id, name: '新干系人', role: '', influence: '中', interest: '中', expectations: '', strategy: '保持知情' }] })); go('stakeholders', { flash: id }); }
    else if (kind === 'term') { update(x => ({ ...x, glossary: [...x.glossary, { id, term: '新术语', en: '', definition: '' }] })); go('glossary', { flash: id }); }
    else if (kind === 'persona') { update(x => ({ ...x, personas: [...x.personas, { id, name: '新角色', role: '', age: '', goals: '', pains: '', behaviors: '', quote: '', color: ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'][x.personas.length % 5] }] })); go('personas', { flash: id }); }
    toast('已新增，可直接编辑');
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); const mod = e.ctrlKey || e.metaKey;
      if (mod && k === 'j') { e.preventDefault(); if (project) setPrefs({ chatOpen: !prefs.chatOpen }); }
      else if (mod && k === 'k') { e.preventDefault(); setPalette(p => !p); }
      else if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); st.undo(); }
      else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); st.redo(); }
      else if (mod && k === 'n') { e.preventDefault(); quickAdd('requirement'); }
      else if (mod && k === 'b') { e.preventDefault(); setPrefs({ collapsed: !prefs.collapsed }); }
      else if (mod && e.shiftKey && k === 'l') { e.preventDefault(); setPrefs({ theme: prefs.theme === 'dark' ? 'light' : 'dark' }); }
      else if (mod && e.shiftKey && k === 'p') { e.preventDefault(); if (project) setPrefs({ docMode: (prefs.docMode || 'preview') === 'preview' ? 'edit' : 'preview' }); }
      else if (mod && k === 'e') { e.preventDefault(); if (project) go('export'); }
      else if (mod && k === ',') { e.preventDefault(); ai.openSettings(); }
      else if (e.key === 'F1' || (mod && k === '/')) { e.preventDefault(); setHelp(h => !h); }
      else if (e.altKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); if (project) go(NAV[Number(e.key)].key); }
      else if (e.key === 'Escape') { setHelp(false); setPalette(false); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  const body: Record<string, React.ReactNode> = {
    dashboard: <P1.Dashboard />, ai: <AIStartPanel />, vision: <P1.VisionPage />, stakeholders: <P1.StakeholdersPage />, personas: <P1.PersonasPage />,
    journeys: <P1.JourneysPage />, scope: <P2.ScopePage />, requirements: <P1.RequirementsPage />, priority: <P2.PriorityPage />, trace: <P2.TracePage />,
    options: <P2.OptionsPage />, arch: <P2.ArchPage />, decisions: <P2.DecisionsPage />, risks: <P2.RisksPage />, glossary: <P2.GlossaryPage />, export: <P2.ExportPage />
  };
  const closeTour = (target?: string) => { setTour(false); setPrefs({ onboarded: true }); if (target) go(target); };
  const page = curView === 'projects' ? 'projects' : active;
  return <NavC.Provider value={{ page, arg, go, quickAdd, openPalette: () => setPalette(true), openHelp: () => setHelp(true), openTour: () => setTour(true) }}>
    <div className={'app ' + (prefs.collapsed ? 'is-collapsed' : '') + ' mode-' + (prefs.docMode || 'preview') + (prefs.chatOpen && project ? ' with-chat' : '')}>
      <Sidebar />
      <main className="main"><Topbar /><GenProgressBar />
        <div className="content" ref={contentRef} data-testid="content">
          {curView === 'projects' ? <div className="page" key="projects"><P2.ProjectsPage /></div> :
            <div className={'doc ' + ((prefs.docMode || 'preview') === 'preview' ? 'report-mode' : 'edit-mode')} key={project!.id} data-testid="doc-root" data-mode={prefs.docMode || 'preview'}>
              {(prefs.docMode || 'preview') === 'edit' && <Stepper />}
              {DOC.map((k, i) => <Section key={k} k={k} idx={i + 1}>{body[k]}</Section>)}
              <div className="doc-end muted"><i className="ri-flag-2-line" /> {(prefs.docMode || 'preview') === 'preview' ? '报告结束' : '文档结束'} · 共 {DOC.length} 个章节</div></div>}
        </div></main>
      {curView === 'doc' && <ChatPanel />}
      <QuickAdd /><HistoryDrawer open={hist} onClose={() => setHist(false)} /><SettingsDialog /><ClarifyDialog /><SelectionToolbar /><Toasts /><ConfirmDialog />
      {palette && <Palette onClose={() => setPalette(false)} />}{help && <ShortcutHelp onClose={() => setHelp(false)} />}{tour && <Tour onClose={closeTour} />}
    </div></NavC.Provider>;
}
