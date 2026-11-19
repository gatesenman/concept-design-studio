import { Project } from './types';

export function weighted(p: Project) {
  const tw = p.criteria.reduce((s, c) => s + c.weight, 0) || 1;
  return p.options.map(o => ({ o, score: p.criteria.reduce((s, c) => s + (o.scores[c.id] ?? 0) * c.weight, 0) / tw }));
}
const tbl = (head: string[], rows: (string | number)[][]) => `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n` + rows.map(r => `| ${r.map(x => String(x ?? '').replace(/\n/g, '<br>').replace(/\|/g, '\\|')).join(' | ')} |`).join('\n') + '\n';

export function toMarkdown(p: Project): string {
  const v = p.vision; const fname = (id: string) => p.features.find(f => f.id === id)?.name || '-';
  let md = `# ${p.name}\n\n> ${p.description || ''}\n\n- 负责人：${p.owner || '-'}\n- 阶段：${p.phase}\n- 模板：${p.template}\n- 更新时间：${new Date(p.updatedAt).toLocaleString('zh-CN')}\n\n`;
    const ai = p.ai;
  if (ai?.brief) md += `## 项目构想\n\n${ai.brief}\n\n`;
  if (ai?.chapters) {
    const rows = Object.entries(ai.chapters).map(([k, v]: any) => [k, v.status === 'accepted' ? '已采纳' : v.status === 'pending' ? '待审核' : '待生成', v.updatedAt ? new Date(v.updatedAt).toLocaleString('zh-CN') : '-']);
    if (rows.length) md += `## 审核进度\n\n` + tbl(['章节', '状态', '更新时间'], rows) + '\n';
  }
  md += `## 1. 问题与愿景\n\n**问题陈述：** ${v.problem}\n\n**目标用户：** ${v.target}\n\n**愿景：** ${v.vision}\n\n**业务目标：**\n\n${v.goals}\n\n**非目标：** ${v.nonGoals}\n\n**成功指标：** ${v.metrics}\n\n**约束：** ${v.constraints}\n\n`;
  md += `## 2. 干系人\n\n` + tbl(['名称', '角色', '影响力', '关注度', '期望', '策略'], p.stakeholders.map(s => [s.name, s.role, s.influence, s.interest, s.expectations, s.strategy])) + '\n';
  md += `## 3. 用户画像\n\n` + p.personas.map(x => `### ${x.name}（${x.role}，${x.age} 岁）\n\n> “${x.quote}”\n\n- 目标：${x.goals}\n- 痛点：${x.pains}\n- 行为：${x.behaviors}\n`).join('\n') + '\n';
  md += `## 4. 用户旅程\n\n` + p.journeys.map(j => `### ${j.title}\n\n${j.scenario}\n\n` + tbl(['阶段', '行为', '触点', '情绪(1-5)', '痛点', '机会'], j.stages.map(s => [s.name, s.action, s.touchpoint, s.emotion, s.pain, s.opportunity]))).join('\n') + '\n';
  md += `## 5. 需求清单\n\n` + tbl(['编号', '类型', '标题', '描述', '验收标准', 'MoSCoW', 'Kano', '状态', '关联功能'], p.requirements.map(r => [r.code, r.type, r.title, r.type === '用户故事' ? `作为${r.asA}，我希望${r.iWant}，以便${r.soThat}` : r.iWant, r.acceptance, r.moscow, r.kano, r.status, fname(r.featureId)])) + '\n';
  md += `## 6. 功能范围\n\n` + tbl(['功能', '史诗', '版本', '说明'], p.features.map(f => [f.name, f.epic, f.release, f.desc])) + '\n';
  md += `## 7. 方案对比（加权评分）\n\n` + tbl(['方案', ...p.criteria.map(c => `${c.name}(${c.weight}%)`), '加权得分'], weighted(p).map(({ o, score }) => [o.name, ...p.criteria.map(c => o.scores[c.id] ?? 0), score.toFixed(2)])) + '\n';
  md += `## 8. 架构草图\n\n### 系统上下文\n\n\`\`\`mermaid\n${p.contextDiagram}\n\`\`\`\n\n### 逻辑架构\n\n\`\`\`mermaid\n${p.architecture}\n\`\`\`\n\n`;
  md += `## 9. 风险与假设\n\n` + tbl(['类型', '描述', '概率', '影响', '风险值', '应对', '负责人', '状态'], p.risks.map(r => [r.kind, r.desc, r.probability, r.impact, r.probability * r.impact, r.mitigation, r.owner, r.status])) + '\n';
  md += `## 10. 决策记录\n\n` + p.decisions.map(d => `### ${d.title}（${d.status}，${d.date}）\n\n- 背景：${d.context}\n- 决策：${d.decision}\n- 影响：${d.consequences}\n`).join('\n') + '\n';
  md += `## 11. 术语表\n\n` + tbl(['术语', '英文', '定义'], p.glossary.map(g => [g.term, g.en, g.definition]));
  return md;
}

const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
export function mdToHtml(md: string, title: string): string {
  const lines = md.split('\n'); let out = ''; let i = 0;
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/&lt;br&gt;/g, '<br>');
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('```')) { let code = ''; i++; while (i < lines.length && !lines[i].startsWith('```')) code += lines[i++] + '\n'; out += `<pre>${esc(code)}</pre>`; i++; continue; }
    if (l.startsWith('|')) { const rows: string[][] = []; while (i < lines.length && lines[i].startsWith('|')) { if (!/^\|---/.test(lines[i])) rows.push(lines[i].slice(2, -2).split(' | ')); i++; }
      out += '<table>' + rows.map((r, k) => `<tr>${r.map(c => k ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`).join('')}</tr>`).join('') + '</table>'; continue; }
    const h = l.match(/^(#{1,3}) (.*)/); if (h) out += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
    else if (l.startsWith('> ')) out += `<blockquote>${inline(l.slice(2))}</blockquote>`;
    else if (l.startsWith('- ')) out += `<li>${inline(l.slice(2))}</li>`;
    else if (l.trim()) out += `<p>${inline(l)}</p>`;
    i++;
  }
  const footer=`<footer>由「软件概念设计工作台」导出 · ${new Date().toLocaleString('zh-CN',{hour12:false})}</footer>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{margin:18mm 16mm}body{font-family:"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif;color:#1f2937;font-size:11.5px;line-height:1.65;padding:4px}
h1{color:#1e3a8a;border-bottom:3px solid #2563eb;padding-bottom:8px;font-size:22px;margin:0 0 12px}
.meta{color:#64748b;font-size:11px;margin-bottom:16px}h2{color:#1e40af;border-left:4px solid #2563eb;padding-left:8px;margin-top:20px;font-size:15px;page-break-after:avoid}
h3{color:#334155;font-size:13px;margin-top:14px;page-break-after:avoid}
table{border-collapse:collapse;width:100%;margin:8px 0;page-break-inside:auto}tr{page-break-inside:avoid}th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;vertical-align:top}th{background:#eff6ff;font-weight:600}
pre{background:#f1f5f9;padding:8px;border-radius:4px;white-space:pre-wrap;font-size:10.5px}blockquote{color:#475569;border-left:3px solid #94a3b8;margin:4px 0;padding-left:8px}
footer{margin-top:28px;padding-top:8px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:10px}</style></head><body><p class="meta">概念设计说明书</p>${out}${footer}</body></html>`;
}
