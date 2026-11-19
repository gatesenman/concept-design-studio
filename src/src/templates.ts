import { Project, Vision } from './types';
import { uid, now } from './util';

const emptyVision: Vision = { problem: '', target: '', vision: '', goals: '', nonGoals: '', metrics: '', constraints: '' };
export const defaultArch = `flowchart LR
  User((用户)) --> UI[前端应用]
  UI --> API[API 网关]
  API --> SVC[业务服务]
  SVC --> DB[(数据库)]`;
export const defaultContext = `flowchart TB
  SYS[[待设计系统]]
  A[主要用户] -->|使用| SYS
  SYS -->|调用| B[外部系统]`;

export function blankProject(name: string, template = '空白项目'): Project {
  const p: Project = {
    id: uid(), name, description: '', template, owner: '', phase: '概念探索', createdAt: now(), updatedAt: now(),
    vision: { ...emptyVision }, stakeholders: [], personas: [], journeys: [], requirements: [], features: [],
    criteria: [
      { id: uid(), name: '用户价值', weight: 30 }, { id: uid(), name: '技术可行性', weight: 25 },
      { id: uid(), name: '实施成本', weight: 20 }, { id: uid(), name: '上市时间', weight: 15 }, { id: uid(), name: '风险', weight: 10 }
    ],
    options: [], architecture: defaultArch, contextDiagram: defaultContext, risks: [], decisions: [], glossary: [], ai: { brief: '', chapters: {} }
  };
  if (template === 'SaaS 产品') {
    p.vision.constraints = '多租户隔离；SOC2 合规；按订阅计费';
    p.stakeholders.push({ id: uid(), name: '客户管理员', role: '付费方', influence: '高', interest: '高', expectations: '易于管理团队与账单', strategy: '重点管理' });
    p.features.push({ id: uid(), name: '租户与订阅管理', epic: '平台基础', release: 'MVP', desc: '' }, { id: uid(), name: '用户与权限', epic: '平台基础', release: 'MVP', desc: '' });
    p.architecture = `flowchart LR\n  B[浏览器] --> CDN --> FE[SPA 前端]\n  FE --> GW[API 网关]\n  GW --> AUTH[认证服务]\n  GW --> CORE[核心业务服务]\n  CORE --> PG[(PostgreSQL 多租户)]\n  CORE --> MQ[[消息队列]]\n  MQ --> BILL[计费服务]`;
  } else if (template === '移动应用') {
    p.vision.constraints = 'iOS / Android 双端；弱网可用；应用商店审核';
    p.features.push({ id: uid(), name: '账号注册登录', epic: '账号', release: 'MVP', desc: '' }, { id: uid(), name: '消息推送', epic: '触达', release: 'V1.x', desc: '' });
    p.architecture = `flowchart LR\n  APP[移动 App] --> BFF[BFF 层]\n  BFF --> SVC[微服务集群]\n  SVC --> DB[(数据库)]\n  SVC --> PUSH[推送服务 APNs/FCM]`;
  } else if (template === '企业内部系统') {
    p.vision.constraints = '对接 LDAP/SSO；内网部署；审计日志';
    p.stakeholders.push({ id: uid(), name: 'IT 部门', role: '运维/安全', influence: '高', interest: '中', expectations: '安全合规，易运维', strategy: '保持满意' });
    p.architecture = `flowchart LR\n  EMP[员工] --> PORTAL[内部门户]\n  PORTAL --> SSO[SSO/LDAP]\n  PORTAL --> WF[流程引擎]\n  WF --> ERP[ERP 系统]\n  WF --> DB[(业务库)]`;
  } else if (template === 'AI 智能应用') {
    p.vision.constraints = '模型调用成本可控；数据隐私；输出可解释与可回溯';
    p.risks.push({ id: uid(), kind: '风险', desc: '大模型输出幻觉影响决策准确性', probability: 4, impact: 4, mitigation: 'RAG + 引用溯源 + 人工复核', owner: '', status: '开放' });
    p.architecture = `flowchart LR\n  U[用户] --> APP[应用前端]\n  APP --> ORCH[Agent 编排层]\n  ORCH --> LLM[大模型服务]\n  ORCH --> RAG[检索增强]\n  RAG --> VDB[(向量库)]\n  ORCH --> TOOLS[工具/插件]`;
  }
  return p;
}
export const TEMPLATES = ['空白项目', 'SaaS 产品', '移动应用', '企业内部系统', 'AI 智能应用'];

export function sampleProject(): Project {
  const p = blankProject('智慧社区团购平台（示例）', 'SaaS 产品');
  p.description = '面向社区团长与居民的生鲜团购平台，涵盖拼团下单、团长履约、供应链协同。';
  p.owner = '产品部 · 张伟'; p.phase = '方案评审';
  p.vision = {
    problem: '社区居民购买生鲜价格高、品质不稳定；团长依靠微信群手工接龙，统计订单与对账效率低、易出错。',
    target: '一二线城市社区居民（25-45 岁家庭主理人）与社区团长、区域供应商。',
    vision: '让每个社区都拥有一个高效、透明、可信赖的“家门口的菜市场”。',
    goals: '1. 团长订单处理时间降低 70%\n2. 居民次日达履约率 ≥ 98%\n3. 首年覆盖 500 个社区',
    nonGoals: '首期不做即时配送（30 分钟达）；不做自营仓储。',
    metrics: 'GMV、复购率（30 日）、团长人效（单/人/日）、售后率 < 1.5%',
    constraints: '6 个月内上线 MVP；团队 12 人；需接入微信支付与小程序'
  };
  const sh = [
    { id: uid(), name: '社区团长', role: '核心用户/渠道', influence: '高', interest: '高', expectations: '省时省力、佣金透明', strategy: '重点管理' },
    { id: uid(), name: '社区居民', role: '终端消费者', influence: '中', interest: '高', expectations: '便宜、新鲜、售后无忧', strategy: '保持知情' },
    { id: uid(), name: '区域供应商', role: '货源', influence: '中', interest: '中', expectations: '稳定订单、及时回款', strategy: '保持满意' },
    { id: uid(), name: '运营总监', role: '业务决策者', influence: '高', interest: '中', expectations: '快速扩张、成本可控', strategy: '保持满意' }
  ];
  p.stakeholders = [...p.stakeholders, ...sh];
  const per1 = { id: uid(), name: '李阿姨', role: '社区团长', age: '48', goals: '轻松管理 3 个群 600 位邻居的订单，多赚佣金', pains: '手工接龙统计耗时 2 小时/天；对账经常出错', behaviors: '每天早晚高频使用微信；不熟悉复杂软件', quote: '我只想点几下就把单子理清楚。', color: '#f59e0b' };
  const per2 = { id: uid(), name: '小王', role: '上班族居民', age: '32', goals: '下班前下单，第二天在小区自提新鲜蔬果', pains: '超市太远，外卖生鲜贵且品质不稳', behaviors: '通勤时刷手机比价，重视评价', quote: '便宜又新鲜，取货别太麻烦就行。', color: '#3b82f6' };
  p.personas = [per1, per2];
  const f = (name: string, epic: string, release: any, desc = '') => ({ id: uid(), name, epic, release, desc });
  const feats = [
    f('商品拼团与下单', '交易', 'MVP', '居民在小程序浏览团购商品并下单支付'),
    f('团长订单看板', '团长工具', 'MVP', '自动汇总订单、分拣单、提货码核销'),
    f('佣金结算与对账', '团长工具', 'MVP'),
    f('供应商备货协同', '供应链', 'V1.x'),
    f('售后与退款', '交易', 'MVP'),
    f('智能选品推荐', '增长', '未来'),
    f('即时配送', '履约', '不做', '首期非目标')
  ];
  p.features = [...p.features.filter(x => false), ...feats];
  const r = (code: string, title: string, asA: string, iWant: string, soThat: string, acc: string, moscow: any, kano: any, fi: number, status: any, value: number, effort: number, shIdx: number[], per: any) => ({
    id: uid(), code, type: '用户故事' as const, title, asA, iWant, soThat, acceptance: acc, moscow, kano, status, featureId: feats[fi].id,
    stakeholderIds: shIdx.map(i => sh[i].id), personaId: per.id, value, effort
  });
  p.requirements = [
    r('US-001', '一键下单支付', '社区居民', '在团购页选择商品后一键微信支付', '快速完成购买', 'Given 已登录\nWhen 点击“立即支付”\nThen 3 秒内跳转微信支付并回写订单状态', 'Must', '基本型', 0, '已确认', 9, 5, [1], per2),
    r('US-002', '订单自动汇总', '社区团长', '查看按商品与楼栋自动汇总的订单', '不再手工接龙统计', '截团后 1 分钟内生成汇总；支持导出 Excel', 'Must', '期望型', 1, '已确认', 10, 6, [0], per1),
    r('US-003', '提货码核销', '社区团长', '扫描居民提货码完成核销', '快速准确地交付商品', '扫码后显示订单明细；重复核销给出提示', 'Must', '基本型', 1, '评审中', 8, 3, [0, 1], per1),
    r('US-004', '佣金实时查看', '社区团长', '实时看到每单佣金与月度汇总', '收入清晰透明', '佣金在订单完成后 T+0 可见', 'Should', '期望型', 2, '评审中', 7, 4, [0], per1),
    r('US-005', '售后极速退款', '社区居民', '对问题商品拍照申请退款', '售后无忧', '50 元以下自动审批，24h 内到账', 'Should', '兴奋型', 4, '草稿', 7, 5, [1], per2),
    r('US-006', '供应商备货单', '区域供应商', '每日自动收到按团长汇总的备货单', '准确备货减少损耗', '截团后自动推送；支持确认/缺货回填', 'Could', '期望型', 3, '草稿', 6, 6, [2], per1),
    r('US-007', '个性化推荐', '社区居民', '看到基于历史购买的推荐商品', '发现想买的商品', 'CTR 提升 ≥ 10%', "Won't", '兴奋型', 5, '草稿', 4, 8, [1, 3], per2)
  ];
  p.requirements.push({ id: uid(), code: 'NFR-001', type: '非功能需求', title: '高峰并发能力', asA: '', iWant: '截团高峰 5000 TPS 下单', soThat: '', acceptance: 'P95 响应 < 300ms；错误率 < 0.1%', moscow: 'Must', kano: '基本型', status: '已确认', featureId: feats[0].id, stakeholderIds: [sh[3].id], personaId: '', value: 8, effort: 7 });
  p.journeys = [{
    id: uid(), title: '居民一次团购下单到提货', personaId: per2.id, scenario: '小王在下班地铁上看到团长发的团购链接，下单次日蔬果。',
    stages: [
      { id: uid(), name: '发现', action: '在微信群看到团购链接', touchpoint: '微信群', emotion: 3, pain: '信息刷屏易错过', opportunity: '订阅提醒' },
      { id: uid(), name: '选购', action: '浏览商品、看评价', touchpoint: '小程序', emotion: 4, pain: '商品图与实物不符担忧', opportunity: '真实买家秀' },
      { id: uid(), name: '支付', action: '微信一键支付', touchpoint: '小程序/微信支付', emotion: 4, pain: '', opportunity: '' },
      { id: uid(), name: '等待', action: '等待次日到货通知', touchpoint: '服务通知', emotion: 2, pain: '不知道何时到货', opportunity: '物流节点推送' },
      { id: uid(), name: '提货', action: '到团长处出示提货码', touchpoint: '团长自提点', emotion: 5, pain: '排队', opportunity: '分时段提货' }
    ]
  }];
  const c = p.criteria;
  const sc = (a: number[]) => Object.fromEntries(c.map((x, i) => [x.id, a[i]]));
  p.options = [
    { id: uid(), name: '方案A：微信小程序 + 云原生微服务', desc: '小程序前端，K8s 微服务后端', pros: '扩展性强，适合规模化', cons: '初期研发成本高', scores: sc([9, 7, 5, 6, 6]) },
    { id: uid(), name: '方案B：小程序 + 单体 BaaS', desc: '基于云开发/BaaS 快速搭建', pros: '上线快、成本低', cons: '后期扩展受限', scores: sc([7, 9, 9, 9, 7]) },
    { id: uid(), name: '方案C：采购 SaaS 团购系统二开', desc: '基于第三方 SaaS 定制', pros: '最快上线', cons: '差异化弱，数据受制于人', scores: sc([5, 8, 7, 10, 4]) }
  ];
  p.contextDiagram = `flowchart TB\n  SYS[[智慧社区团购平台]]\n  R[社区居民] -->|下单/提货| SYS\n  L[社区团长] -->|管理订单/核销| SYS\n  S[区域供应商] -->|备货/发货| SYS\n  SYS -->|支付| WX[微信支付]\n  SYS -->|消息| MSG[微信服务通知]\n  SYS -->|配送| TMS[第三方物流]`;
  p.risks = [
    { id: uid(), kind: '风险', desc: '截团高峰期并发导致下单失败', probability: 3, impact: 5, mitigation: '压测 + 限流 + 库存预扣', owner: '架构组', status: '处理中' },
    { id: uid(), kind: '风险', desc: '生鲜损耗率高侵蚀毛利', probability: 4, impact: 4, mitigation: '以销定采，预售模式', owner: '供应链', status: '开放' },
    { id: uid(), kind: '假设', desc: '团长愿意从微信接龙迁移到小程序工具', probability: 3, impact: 5, mitigation: '10 位团长原型测试验证', owner: '产品', status: '开放' },
    { id: uid(), kind: '依赖', desc: '微信小程序类目审核通过', probability: 2, impact: 4, mitigation: '提前准备食品经营资质', owner: '法务', status: '处理中' }
  ];
  p.decisions = [{ id: uid(), title: 'ADR-001 前端采用微信小程序', context: '目标用户集中在微信生态，团长依赖微信群传播', decision: '首期仅做微信小程序，不做独立 App', consequences: '获客成本低；受平台规则约束', status: '已采纳', date: '2026-09-20' }];
  p.glossary = [
    { id: uid(), term: '团长', en: 'Group Leader', definition: '负责社区团购组织、分发与售后的社区合伙人' },
    { id: uid(), term: '截团', en: 'Cut-off', definition: '团购活动停止接单的时间点，之后进入备货流程' },
    { id: uid(), term: '自提点', en: 'Pickup Point', definition: '居民领取商品的地点，通常为团长家或便利店' }
  ];
  p.ai = { brief: '面向社区团长与居民的生鲜团购平台：居民小程序下单次日自提，团长用工具管理订单与佣金，供应商按需备货。', chapters: Object.fromEntries(['vision','stakeholders','personas','journeys','scope','requirements','options','arch','risks','decisions','glossary'].map(k => [k, { status: 'accepted' as const }])) };
  return p;
}
