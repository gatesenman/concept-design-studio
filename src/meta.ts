import { Project } from './types';
import { defaultArch, defaultContext } from './templates';

export interface ModMeta { key: string; group: string; icon: string; label: string; short?: string; help: string[]; }
export const NAV: ModMeta[] = [
  { key: 'projects', group: '总览', icon: 'folder-3-line', label: '项目管理', help: ['在此创建新项目或从行业模板起步；“载入示例项目”可快速了解完整用法。', '复制项目可用于做方案分支对比，删除前会二次确认。'] },
  { key: 'dashboard', group: '总览', icon: 'dashboard-3-line', label: '概览仪表盘', help: ['仪表盘汇总各模块完成情况，点击检查项可直接跳转到对应模块补齐内容。', '顶部流程条显示 发现 → 定义 → 设计 → 治理 四个阶段的进度。'] },
  { key: 'ai', group: '总览', icon: 'sparkling-2-line', label: 'AI 构思助手', help: ['输入项目构想（可附参考文档），点击“AI 一键生成全部章节”，AI 会按顺序逐章生成草稿。', '每章生成后都需要人工审核：可整体采纳、逐条勾选采纳、编辑后采纳、驳回或带附加要求重新生成。', '“一致性检查”会结合规则与 AI 找出章节之间的矛盾和遗漏。'] },
  { key: 'vision', group: '发现', icon: 'focus-3-line', label: '问题与愿景', help: ['先写清“谁在什么场景下遇到什么问题”，再描述理想状态（愿景）。', '非目标同样重要：明确不做什么可以有效控制范围。', '电梯演讲会根据填写内容自动生成，可直接用于汇报。'] },
  { key: 'stakeholders', group: '发现', icon: 'group-line', label: '干系人分析', help: ['列出所有受项目影响或能影响项目的人/组织。', '根据影响力与关注度自动落入权力/利益矩阵，据此制定沟通策略。'] },
  { key: 'personas', group: '发现', icon: 'user-heart-line', label: '用户画像', help: ['为每类核心用户建立 1 个画像，聚焦目标、痛点与行为。', '需求可关联到画像，确保每个功能都服务于具体的人。'] },
  { key: 'journeys', group: '发现', icon: 'route-line', label: '用户旅程', help: ['按时间顺序拆分阶段，记录用户行为、触点与情绪。', '情绪低谷处的痛点通常就是最有价值的机会点。'] },
  { key: 'scope', group: '定义', icon: 'puzzle-line', label: '功能范围', help: ['按史诗（模块）和版本组织功能，形成故事地图。', '把“不做”的功能也写下来，避免范围蔓延。'] },
  { key: 'requirements', group: '定义', icon: 'file-list-3-line', label: '需求池', help: ['使用“作为…我希望…以便…”格式编写用户故事。', '每条 Must 需求都应有可验证的验收标准（Given/When/Then）。', '快捷键 Ctrl+N 可随时新增需求。'] },
  { key: 'priority', group: '定义', icon: 'scales-3-line', label: '优先级排序', help: ['拖拽卡片在 MoSCoW 列之间移动即可调整优先级。', '价值/工作量矩阵左上角为“快速见效”项，建议优先纳入 MVP。'] },
  { key: 'trace', group: '定义', icon: 'links-line', label: '追溯矩阵', help: ['点击单元格建立或取消关联。', '底部会提示孤立需求和无需求支撑的功能，帮助发现遗漏或镀金。'] },
  { key: 'options', group: '设计', icon: 'trophy-line', label: '方案对比', help: ['先确定评估维度和权重（合计 100%），再为各方案打 0-10 分。', '得分最高的方案会被标记为“推荐”，但仍需结合优劣势判断。'] },
  { key: 'arch', group: '设计', icon: 'node-tree', label: '架构草图', help: ['使用 Mermaid 语法绘图，右侧实时预览。', '可用工具栏按钮快速插入常用节点；语法错误会在预览上方提示。'] },
  { key: 'decisions', group: '设计', icon: 'pushpin-line', label: '决策记录', help: ['每个关键设计决策记录背景、结论与影响（ADR）。', '已废弃的决策不要删除，保留以便追溯。'] },
  { key: 'risks', group: '治理', icon: 'error-warning-line', label: '风险与假设', help: ['概率 × 影响 ≥ 15 视为高风险，会在仪表盘中提示。', '“假设”需要设计验证方式，验证后将状态改为“已验证”。'] },
  { key: 'glossary', group: '治理', icon: 'book-2-line', label: '术语表', help: ['统一团队对业务名词的理解，减少沟通歧义。'] },
  { key: 'export', group: '治理', icon: 'upload-2-line', label: '导出', help: ['导出 Markdown/PDF 用于评审，导出 JSON 用于备份或迁移到其他电脑。'] }
];
export const PHASES = ['发现', '定义', '设计', '治理'];
export const metaOf = (k: string) => NAV.find(n => n.key === k)!;
const r = (n: number, of: number) => Math.min(n / of, 1);

export function progress(p: Project, k: string): number | null {
  switch (k) {
    case 'vision': return Object.values(p.vision).filter(x => x.trim()).length / 7;
    case 'stakeholders': return r(p.stakeholders.length, 3);
    case 'personas': return r(p.personas.length, 2);
    case 'journeys': { const s = p.journeys.flatMap(j => j.stages); return s.length ? s.filter(x => x.action.trim()).length / s.length : 0; }
    case 'requirements': return p.requirements.length ? r(p.requirements.length, 5) * p.requirements.filter(x => x.acceptance.trim()).length / p.requirements.length : 0;
    case 'priority': return p.requirements.length ? p.requirements.filter(x => x.status !== '草稿').length / p.requirements.length : 0;
    case 'trace': return p.requirements.length ? p.requirements.filter(x => x.featureId).length / p.requirements.length : 0;
    case 'scope': return r(p.features.length, 3);
    case 'options': return r(p.options.length, 2);
    case 'arch': return ((p.architecture.trim() && p.architecture !== defaultArch ? 1 : 0) + (p.contextDiagram.trim() && p.contextDiagram !== defaultContext ? 1 : 0)) / 2;
    case 'decisions': return r(p.decisions.length, 1);
    case 'risks': return r(p.risks.length, 3);
    case 'glossary': return r(p.glossary.length, 3);
    default: return null;
  }
}
export function phaseProgress(p: Project, ph: string) {
  const v = NAV.filter(n => n.group === ph).map(n => progress(p, n.key)).filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}
