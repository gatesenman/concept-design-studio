// OpenAI-compatible mock LLM server (streaming SSE) for e2e tests.
import http from 'http';

const DATA = {
  vision: { description: '连锁健身房会员小程序：约课、体测记录、私教排班与续费提醒', problem: '会员约课依赖电话和微信群，私教排班冲突频繁，续费提醒靠人工，流失率高。', target: '连锁健身房会员（22-40 岁白领）、私教、门店店长', vision: '让每一位会员都能轻松坚持健身。', goals: '1. 约课耗时降低 80%\n2. 续费率提升 15%\n3. 私教排班冲突降为 0', nonGoals: '首期不做线上商城与直播课', metrics: '周活跃会员率、续费率、课程满员率', constraints: '4 个月上线 MVP；微信小程序；对接现有门禁系统' },
  stakeholders: { items: [{ name: '会员', role: '终端用户', influence: '中', interest: '高', expectations: '约课方便、看到进步', strategy: '保持知情' }, { name: '私教', role: '服务提供者', influence: '中', interest: '高', expectations: '排班清晰、课时结算准确', strategy: '重点管理' }, { name: '门店店长', role: '运营管理', influence: '高', interest: '高', expectations: '提升续费与满员率', strategy: '重点管理' }, { name: '总部 IT', role: '技术支持', influence: '高', interest: '中', expectations: '安全稳定、易对接门禁', strategy: '保持满意' }] },
  personas: { items: [{ name: '林悦', role: '白领会员', age: '29', goals: '下班后高效训练，看到体脂变化', pains: '热门课总约不上', behaviors: '通勤时用手机安排日程', quote: '我想抢到周三晚上的普拉提。' }, { name: '王教练', role: '私教', age: '34', goals: '排满课时、减少沟通成本', pains: '会员临时改约导致空档', behaviors: '每天用微信和 30 位会员沟通', quote: '排班表要是能自动更新就好了。' }] },
  journeys: { items: [{ title: '会员预约一节团课', persona: '林悦', scenario: '林悦午休时预约当晚的团课', stages: [{ name: '发现', action: '打开小程序查看课表', touchpoint: '小程序首页', emotion: 3, pain: '课表信息分散', opportunity: '个性化推荐' }, { name: '预约', action: '选择课程并预约', touchpoint: '课程详情页', emotion: 4, pain: '热门课已满', opportunity: '候补自动递补' }, { name: '上课', action: '到店扫码签到', touchpoint: '门禁闸机', emotion: 5, pain: '', opportunity: '' }, { name: '复盘', action: '查看训练记录', touchpoint: '我的页面', emotion: 4, pain: '数据不直观', opportunity: '体测趋势图' }] }] },
  scope: { items: [{ name: '课程预约', epic: '会员端', release: 'MVP', desc: '团课/私教课预约与取消' }, { name: '候补递补', epic: '会员端', release: 'MVP', desc: '满员自动排队' }, { name: '体测记录', epic: '会员端', release: 'V1.x', desc: '体测数据与趋势' }, { name: '私教排班', epic: '教练端', release: 'MVP', desc: '可视化排班与冲突检测' }, { name: '续费提醒', epic: '运营端', release: 'MVP', desc: '到期前自动提醒' }, { name: '线上商城', epic: '运营端', release: '不做', desc: '首期非目标' }] },
  requirements: { items: [
    { code: 'US-001', type: '用户故事', title: '预约团课', asA: '会员', iWant: '在小程序中一键预约团课', soThat: '不再依赖电话', acceptance: 'Given 课程未满\nWhen 点击预约\nThen 预约成功并收到通知', moscow: 'Must', kano: '基本型', feature: '课程预约', persona: '林悦', value: 9, effort: 4 },
    { code: 'US-002', type: '用户故事', title: '候补自动递补', asA: '会员', iWant: '课程满员时加入候补', soThat: '有人取消时自动获得名额', acceptance: 'Given 已候补 When 有人取消 Then 自动递补并通知', moscow: 'Should', kano: '兴奋型', feature: '候补递补', persona: '林悦', value: 7, effort: 5 },
    { code: 'US-003', type: '用户故事', title: '私教排班冲突检测', asA: '私教', iWant: '排班时自动提示冲突', soThat: '避免重复预约', acceptance: 'Given 时段已占用 When 新增排班 Then 提示冲突', moscow: 'Must', kano: '基本型', feature: '私教排班', persona: '王教练', value: 8, effort: 6 },
    { code: 'US-004', type: '用户故事', title: '续费到期提醒', asA: '店长', iWant: '会员到期前 7 天自动提醒', soThat: '提升续费率', acceptance: '到期前 7/3/1 天推送服务通知', moscow: 'Must', kano: '期望型', feature: '续费提醒', persona: '', value: 8, effort: 3 },
    { code: 'NFR-001', type: '非功能需求', title: '预约高峰性能', asA: '', iWant: '整点放课时支持 2000 并发预约', soThat: '', acceptance: 'P95 < 500ms', moscow: 'Must', kano: '基本型', feature: '课程预约', persona: '', value: 7, effort: 6 }] },
  options: { criteria: [{ name: '用户价值', weight: 40 }, { name: '实施成本', weight: 30 }, { name: '上线速度', weight: 30 }], items: [{ name: '自研小程序 + 云函数', desc: '微信云开发', pros: '上线快、成本低', cons: '复杂报表受限', scores: { 用户价值: 8, 实施成本: 9, 上线速度: 9 } }, { name: '采购健身 SaaS', desc: '第三方系统定制', pros: '功能全', cons: '难以对接门禁', scores: { 用户价值: 6, 实施成本: 6, 上线速度: 8 } }] },
  arch: { contextDiagram: 'flowchart TB\n  SYS[[会员小程序平台]]\n  M[会员] -->|约课| SYS\n  C[私教] -->|排班| SYS\n  SYS -->|开门| G[门禁系统]', architecture: 'flowchart LR\n  MP[小程序] --> CF[云函数]\n  CF --> DB[(云数据库)]\n  CF --> MSG[订阅消息]' },
  risks: { items: [{ kind: '风险', desc: '整点放课高并发导致预约失败', probability: 3, impact: 4, mitigation: '排队削峰 + 压测', owner: '技术负责人' }, { kind: '假设', desc: '会员愿意从微信群迁移到小程序约课', probability: 3, impact: 5, mitigation: '两家门店试点验证', owner: '产品经理' }, { kind: '依赖', desc: '门禁厂商开放接口', probability: 2, impact: 4, mitigation: '提前签署对接协议', owner: '总部 IT' }] },
  decisions: { items: [{ title: 'ADR-001 采用微信云开发', context: '团队小、上线时间紧', decision: '使用微信云开发作为后端', consequences: '上线快；后期迁移有成本' }] },
  glossary: { items: [{ term: '团课', en: 'Group Class', definition: '多人同时参加的固定时段课程' }, { term: '候补', en: 'Waitlist', definition: '课程满员时排队等待名额' }, { term: '体测', en: 'Body Test', definition: '体脂、肌肉量等身体指标测量' }] }
};
const REGEN = {
  risks: { items: [{ kind: '风险', desc: '【重生成】私教流失导致课程供给不足', probability: 3, impact: 4, mitigation: '课时激励方案', owner: '店长' }] },
  vision: { description: '连锁健身房会员小程序：约课、体测记录、私教排班与续费提醒', problem: '【重生成】会员约课仍依赖纸质登记和多个微信群，私教排班冲突频发，续费提醒靠店长人工打电话，流失率居高不下。', target: '连锁健身房会员（22-40 岁白领）、私教、门店店长', vision: '让每一位会员都能轻松坚持健身，并看见自己的进步。', goals: '1. 约课耗时降低 80%\n2. 续费率提升 15%\n3. 私教排班冲突降为 0', nonGoals: '首期不做线上商城与直播课', metrics: '周活跃会员率、续费率、课程满员率', constraints: '4 个月上线 MVP；微信小程序；对接现有门禁系统' }
};
const COMPLETE = { glossary: { items: [{ term: '课时包', en: 'Class Pack', definition: '预付费购买的若干节私教课' }] }, requirements: { items: [{ code: 'US-005', type: '用户故事', title: '体测趋势查看', asA: '会员', iWant: '查看体测数据趋势图', soThat: '看到进步', acceptance: 'Given 有 2 次以上体测 Then 显示折线图', moscow: 'Could', kano: '兴奋型', feature: '体测记录', persona: '林悦', value: 6, effort: 4 }] } };
const CONSIST = { issues: [{ chapter: '需求池', level: '中', issue: '体测记录功能缺少对应需求', suggestion: '补充体测相关用户故事' }, { chapter: '风险与假设', level: '低', issue: '未覆盖数据隐私合规风险', suggestion: '补充个人健康数据合规风险' }] };

const CLARIFY = { questions: [
  { q: '首期覆盖多少家门店？', why: '决定是否需要多门店数据隔离', options: ['单店试点', '3-5 家', '全部门店'] },
  { q: '是否需要对接现有门禁系统？', why: '影响架构与工期', options: ['需要', '暂不需要'] },
  { q: '会员体测数据由谁录入？', why: '影响隐私授权与流程', options: ['教练录入', '智能体测仪自动上传'] },
  { q: '上线时间要求？', options: ['1 个月', '3 个月', '半年'] }] };
const REVIEW = {
  product: [{ chapter: '产品愿景', severity: '中', issue: '成功指标缺少基线值', suggestion: '为续费率与爽约率补充当前基线' }],
  arch: [{ chapter: '架构概览', severity: '高', issue: '未说明整点放课的削峰方案', suggestion: '在架构中加入排队/令牌桶组件' }],
  security: [{ chapter: '风险与假设', severity: '高', issue: '体测数据属于个人健康信息，未识别合规风险', suggestion: '新增个人健康信息授权与加密存储风险项' }, { chapter: '需求池', severity: '中', issue: '缺少数据加密与访问审计需求', suggestion: '补充 NFR：敏感数据加密与访问日志' }],
  ops: [{ chapter: '功能范围', severity: '低', issue: '缺少门店运营培训计划', suggestion: '在 MVP 范围中加入运营后台使用培训' }],
  user: [{ chapter: '用户旅程', severity: '中', issue: '候补失败后的用户反馈缺失', suggestion: '补充候补未成功时的通知与补偿' }] };
const FIX = {
  risks: { items: [...[{ kind: '风险', desc: '【修复】体测等个人健康信息未单独授权，存在合规风险', probability: 3, impact: 5, mitigation: '单独授权 + 加密存储 + 访问审计', owner: '法务/技术负责人' }]] },
  requirements: { items: [{ code: 'NFR-002', type: '非功能需求', title: '【修复】敏感数据加密与审计', asA: '', iWant: '体测等敏感数据加密存储，访问留痕', soThat: '', acceptance: 'AES-256 加密；访问日志保留 180 天', moscow: 'Must', kano: '基本型', feature: '课程预约', value: 8, effort: 4 }] } };
const CHAT = (u) => /风险/.test(u)
  ? { reply: '我检查了「风险与假设」章节：目前缺少个人健康信息合规风险，也没有覆盖私教流失。\n建议补充下面这条修改，生成后会进入待审核草稿。', actions: [{ chapter: 'risks', instruction: '补充个人健康信息合规风险，修复评审问题', label: '补充合规风险' }] }
  : /总结/.test(u) ? { reply: '这是一个面向连锁健身房的会员小程序：解决约课难、排班冲突与续费流失三大问题，MVP 聚焦约课、候补与续费提醒。', actions: [] }
  : { reply: '最薄弱的三处：1）成功指标缺少基线；2）架构缺少高峰削峰设计；3）缺少敏感数据安全需求。', actions: [{ chapter: 'requirements', instruction: '补充敏感数据加密与审计的非功能需求，修复评审问题', label: '补充安全需求' }] };
export const log = [];
let failNext = null; // { code, message } | null
export function startMock(port = 0, { delay = 8, chunk = 48 } = {}) {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url.startsWith('/__log')) { res.end(JSON.stringify(log)); return; }
    if (req.method === 'POST' && req.url.startsWith('/__fail')) {
      let body = ''; for await (const c of req) body += c;
      failNext = body ? JSON.parse(body) : { code: 429, message: 'rate limit' }; failNext.count = failNext.count || 1;
      res.end(JSON.stringify({ ok: true, failNext })); return;
    }
    if (req.method === 'POST' && req.url.startsWith('/__clear-fail')) { failNext = null; res.end('{"ok":true}'); return; }
    let body = ''; for await (const c of req) body += c;
    if (!req.url.endsWith('/chat/completions')) { res.writeHead(404); res.end(); return; }
    if (req.headers.authorization !== 'Bearer sk-test-123') { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"error":{"message":"invalid api key"}}'); return; }
    if (failNext) {
      const f = failNext; if (--failNext.count <= 0) failNext = null;
      if (f.retryAfter) res.setHeader('Retry-After', String(f.retryAfter));
      res.writeHead(f.code || 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: f.message || 'mock fail' } })); return;
    }
    const j = JSON.parse(body); const sys = j.messages[0].content; const user = j.messages.at(-1).content; log.push({ sys, user });
    let out;
    const ch = (sys.match(/\[\[CHAPTER:(\w+)\]\]/) || [])[1];
    const role = (sys.match(/\[\[ROLE:(\w+)\]\]/) || [])[1];
    const fixing = /修复/.test(user);
    if (/\[\[TASK:consistency\]\]/.test(sys)) out = CONSIST;
    else if (/\[\[TASK:clarify\]\]/.test(sys)) out = CLARIFY;
    else if (/\[\[TASK:review\]\]/.test(sys)) out = { findings: REVIEW[role] || [] };
    else if (/\[\[TASK:chat\]\]/.test(sys)) out = CHAT(user);
    else if (ch && !/\[\[REPAIR\]\]/.test(user) && /BADJSON/.test(user)) out = '抱歉，这是一段不是 JSON 的输出 {items: [坏的';
    else if (ch && fixing && FIX[ch]) out = /# 补全模式/.test(user) ? FIX[ch] : { ...DATA[ch], items: [...FIX[ch].items, ...DATA[ch].items] };
    else if (ch && /# 补全模式/.test(user) && COMPLETE[ch]) out = COMPLETE[ch];
    else if (ch && /REGEN/.test(user) && REGEN[ch]) out = REGEN[ch];
    else if (ch) out = DATA[ch];
    else out = 'OK';
    // citations: when evidence is provided, cite S1/S2
    const allUser = j.messages.filter(m => m.role === 'user').map(m => m.content).join('\n');
    if (ch && typeof out === 'object' && /\[S1\]/.test(allUser)) {
      out = JSON.parse(JSON.stringify(out));
      if (Array.isArray(out.items)) out.items.forEach((x, i) => { if (i < 2) x.sources = i === 0 ? ['S1'] : (/\[S2\]/.test(allUser) ? ['S2'] : ['S1']); });
      else out.sources = ['S1'];
    }
    const text = typeof out === 'string' ? out : JSON.stringify(out, null, 1);
    if (!j.stream) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: j.model, choices: [{ message: { role: 'assistant', content: text } }] })); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    for (let i = 0; i < text.length; i += chunk) {
      if (res.destroyed) return;
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + chunk) } }] })}\n\n`);
      await new Promise(r => setTimeout(r, delay));
    }
    const pt = Math.ceil(j.messages.reduce((s, m) => s + m.content.length, 0) * 0.7), ct = Math.ceil(text.length * 0.7);
    res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: pt, completion_tokens: ct, total_tokens: pt + ct } })}\n\n`);
    res.write('data: [DONE]\n\n'); res.end();
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r({ server, url: `http://127.0.0.1:${server.address().port}/v1` })));
}
if (process.argv[1] && process.argv[1].endsWith('mock-llm.mjs')) startMock(Number(process.argv[2] || 8787)).then(({ url }) => console.log('mock LLM at', url));
