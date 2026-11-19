import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import fs from 'fs'; import os from 'os'; import path from 'path';
// @ts-ignore
import { startMock } from './mock-llm.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cds-data-'));
const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cds-exp-'));
let app: ElectronApplication; let page: Page; const errors: string[] = []; let mock: any;
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
const AI_CH = ['vision', 'stakeholders', 'personas', 'journeys', 'scope', 'requirements', 'options', 'arch', 'risks', 'decisions', 'glossary'];

async function launch() {
  app = await electron.launch({ args: ['.', '--no-sandbox'], env: { ...process.env, CDS_DATA_DIR: dataDir, CDS_EXPORT_DIR: exportDir, CDS_BACKOFF_MS: '200', CDS_IMPORT_FILES: ['门店调研纪要.txt', '合规要求.docx', 'peak-load.pdf'].map(f => path.resolve('e2e/fixtures', f)).join(path.delimiter) } });
  page = await app.firstWindow(); page.on('pageerror', e => errors.push(String(e)));
  await page.waitForSelector('[data-testid="sec-dashboard"], [data-testid="page-projects"]');
}
const nav = (k: string) => page.getByTestId('nav-' + k).click();
const status = (k: string) => page.getByTestId('toc-status-' + k);
const sec = (k: string) => page.getByTestId('sec-' + k);
const shot = (n: string) => page.screenshot({ path: `screenshots/${n}.png` });
async function inView(k: string) {
  return page.evaluate(k => { const c = document.querySelector('[data-testid=content]')!; const e = document.getElementById('sec-' + k)!; return e.getBoundingClientRect().top - c.getBoundingClientRect().top; }, k);
}
async function toEdit() {
  if (await page.getByTestId('doc-root').getAttribute('data-mode') === 'edit') return;
  await page.getByTestId('mode-edit').click();
  await expect(page.getByTestId('doc-root')).toHaveAttribute('data-mode', 'edit');
}
async function toPreview() {
  if (await page.getByTestId('doc-root').getAttribute('data-mode') === 'preview') return;
  await page.getByTestId('mode-preview').click();
  await expect(page.getByTestId('doc-root')).toHaveAttribute('data-mode', 'preview');
}

test.describe.serial('软件概念设计工作台 v1.5 E2E', () => {
  test.beforeAll(async () => { mock = await startMock(0, { delay: 25, chunk: 40 }); fs.mkdirSync('screenshots', { recursive: true }); await launch(); });
  test.afterAll(async () => { await app?.close(); mock?.server.close(); });

  test('新手引导后默认预览模式：报告封面与章节渲染', async () => {
    await expect(page.getByTestId('tour')).toBeVisible(); await shot('onboarding');
    for (let i = 0; i < 5; i++) await page.getByTestId('tour-next').click();
    await page.getByTestId('tour-done').click();
    await expect(page.getByTestId('report-cover')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('doc-root')).toHaveAttribute('data-mode', 'preview');
    await expect(page.getByTestId('mode-preview')).toHaveClass(/on/);
    await expect(page.getByTestId('report-cover')).toBeVisible();
    await expect(page.getByTestId('report-title')).toBeVisible();
    await expect(page.getByTestId('kpi-req')).toHaveText('8');
    for (const k of ['dashboard', 'ai', ...AI_CH, 'priority', 'trace', 'export']) await expect(sec(k)).toHaveCount(1);
    for (const k of AI_CH) await expect(status(k)).toHaveAttribute('data-status', 'accepted');
    // report blocks (not form widgets)
    await expect(page.getByTestId('req-table')).toBeVisible();
    await expect(page.locator('.rp-persona').first()).toBeVisible();
    await expect(page.getByTestId('fold-glossary')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toMatch(EMOJI);
    expect(await page.evaluate(() => document.fonts.check('16px remixicon'))).toBe(true);
    await shot('v14-preview-cover');
    await nav('requirements');
    await expect.poll(async () => Math.abs(await inView('requirements')), { timeout: 5000 }).toBeLessThan(40);
    await page.waitForTimeout(400); await shot('v14-preview-mid');
  });

  test('切换编辑模式后保留全部编辑能力', async () => {
    await toEdit();
    await expect(page.getByTestId('mode-edit')).toHaveClass(/on/);
    await expect(page.getByTestId('doc-root')).toHaveAttribute('data-mode', 'edit');
    await expect(page.getByTestId('stepper')).toBeVisible();
    await expect(page.getByTestId('fold-glossary')).toBeVisible();
    await expect(page.getByTestId('gen-vision')).toBeVisible();
    await expect(page.getByTestId('fab')).toBeVisible();
    await shot('v14-edit-mode');
  });

  test('目录点击平滑滚动到章节，滚动时 scrollspy 高亮当前章节', async () => {
    await toEdit();
    await nav('risks');
    await expect.poll(async () => Math.abs(await inView('risks')), { timeout: 5000 }).toBeLessThan(30);
    await expect(page.getByTestId('nav-risks')).toHaveClass(/on/);
    await page.waitForTimeout(1000);
    await page.evaluate(() => { const c = document.querySelector('[data-testid=content]')!; c.scrollTo({ top: document.getElementById('sec-personas')!.offsetTop + 20, behavior: 'instant' as any }); });
    await expect(page.getByTestId('nav-personas')).toHaveClass(/on/);
    await expect(page.locator('.crumb')).toContainText('用户画像');
    await page.evaluate(() => { const c = document.querySelector('[data-testid=content]')!; c.scrollTo({ top: document.getElementById('sec-options')!.offsetTop + 20, behavior: 'instant' as any }); });
    await expect(page.getByTestId('nav-options')).toHaveClass(/on/);
  });

  test('章节可折叠 / 展开；Ctrl+K 跳转到章节', async () => {
    await toEdit(); await nav('glossary'); await page.getByTestId('fold-glossary').click();
    await expect(sec('glossary')).toHaveClass(/collapsed/); await expect(page.getByTestId('page-glossary')).toHaveCount(0);
    await page.getByTestId('fold-glossary').click(); await expect(page.getByTestId('page-glossary')).toBeVisible();
    await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('决策记录'); await page.keyboard.press('Enter');
    await expect(page.getByTestId('nav-decisions')).toHaveClass(/on/);
    await expect.poll(async () => Math.abs(await inView('decisions')), { timeout: 5000 }).toBeLessThan(30);
  });

  test('AI 设置：预设、测试连接（失败/成功）、密钥加密保存', async () => {
    await toEdit(); await page.getByTestId('open-settings').click(); await expect(page.getByTestId('settings')).toBeVisible();
    await page.getByTestId('preset-dashscope').click(); await expect(page.getByTestId('set-baseurl')).toHaveValue(/dashscope/);
    await page.getByTestId('preset-deepseek').click(); await expect(page.getByTestId('set-model')).toHaveValue('deepseek-chat');
    await page.getByTestId('preset-custom').click();
    await page.getByTestId('set-baseurl').fill(mock.url); await page.getByTestId('set-model').fill('mock-model');
    await page.getByTestId('set-key').fill('wrong-key'); await page.getByTestId('set-test').click();
    await expect(page.getByTestId('test-result')).toContainText('连接失败');
    await page.getByTestId('set-key').fill('sk-test-123'); await page.getByTestId('set-test').click();
    await expect(page.getByTestId('test-result')).toContainText('连接成功');
    await shot('settings');
    await page.getByTestId('set-save').click(); await expect(page.getByTestId('settings')).toHaveCount(0);
    const raw = fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8');
    expect(raw).not.toContain('sk-test-123'); expect(JSON.parse(raw).key).toBeTruthy();
    expect(fs.readFileSync(path.join(dataDir, 'projects.json'), 'utf8')).not.toContain('sk-test-123');
    await page.getByTestId('open-settings').click(); await expect(page.getByTestId('set-key')).toHaveAttribute('placeholder', /已保存/);
    await page.keyboard.press('Escape'); await expect(page.getByTestId('settings')).toHaveCount(0);
  });

  test('用 AI 新建项目：流式逐章生成全部章节，后序章节基于前序内容', async () => {
    await nav('projects');
    await page.getByTestId('ai-new-name').fill('健身房会员小程序');
    await page.getByTestId('ai-new-brief').fill('为连锁健身房做会员小程序：约课、体测记录、私教排班、续费提醒');
    await page.getByTestId('ai-new-go').click();
    await expect(page.locator('.crumb')).toContainText('健身房会员小程序');
    // v1.5: clarifying questions before generation
    const cd = page.getByTestId('clarify-dialog'); await expect(cd).toBeVisible({ timeout: 10000 });
    await expect(cd.getByTestId('clarify-q')).toHaveCount(4);
    await cd.getByTestId('clarify-q').nth(0).getByTestId('clarify-opt').nth(1).click();
    await cd.getByTestId('clarify-a').nth(1).fill('需要，对接现有门禁');
    await page.waitForTimeout(300); await shot('v15-clarify');
    await cd.getByTestId('clarify-go').click(); await expect(cd).toHaveCount(0);
    await expect(page.getByTestId('ai-stream')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('ai-stop')).toBeVisible();
    await expect(page.getByTestId('gen-bar')).toBeVisible();
    await expect(page.getByTestId('gen-bar-meta')).toContainText(/第 \d+\/11 章/);
    await expect(page.getByTestId('gen-bar-meta')).toContainText('并行 2 章', { timeout: 20000 });
    await expect(page.getByTestId('gen-bar-stop')).toBeVisible();
    await expect(page.getByTestId('skip-accepted')).toBeChecked();
    await page.waitForTimeout(600); await shot('ai-generating');
    await expect(status('glossary')).toHaveAttribute('data-status', 'pending', { timeout: 90000 });
    for (const k of AI_CH) await expect(status(k)).toHaveAttribute('data-status', 'pending');
    await expect(page.getByTestId('review-pill')).toContainText('0/11');
    const log = await (await fetch(mock.url.replace('/v1', '/__log'))).json();
    const reqPrompt = log.find((x: any) => x.sys.includes('[[CHAPTER:requirements]]')).user;
    expect(reqPrompt).toContain('课程预约'); expect(reqPrompt).toContain('林悦'); expect(reqPrompt).toContain('约课、体测记录');
    expect(reqPrompt).toContain('需求澄清问答'); expect(reqPrompt).toContain('3-5 家'); expect(reqPrompt).toContain('对接现有门禁');
  });

  test('审核：整章采纳（问题与愿景）并显示差异', async () => {
    await nav('vision');
    const d = page.getByTestId('draft-vision'); await expect(d).toBeVisible();
    await expect(d.locator('.dfield.new').first()).toBeVisible();
    await expect(d.getByTestId('field-diff').first()).toBeVisible();
    await page.waitForTimeout(1000); await shot('review-vision');
    await d.getByTestId('draft-accept').click();
    await expect(status('vision')).toHaveAttribute('data-status', 'accepted');
    await expect(page.getByTestId('vision-problem')).toHaveValue(/电话和微信群/);
    await expect(page.getByTestId('draft-vision')).toHaveCount(0);
  });

  test('审核：编辑后采纳（干系人）', async () => {
    await nav('stakeholders'); const d = page.getByTestId('draft-stakeholders');
    await d.getByTestId('draft-edit-toggle').click();
    await d.getByTestId('draft-edit-id').first().fill('会员（VIP）');
    await d.getByTestId('draft-accept-edited').click();
    await expect(status('stakeholders')).toHaveAttribute('data-status', 'accepted');
    const vals = await page.getByTestId('sh-table').locator('input').evaluateAll(es => es.map(e => (e as HTMLInputElement).value));
    expect(vals).toContain('会员（VIP）'); expect(vals).toContain('门店店长');
  });

  test('审核：逐条勾选采纳（需求池），需求自动关联功能与画像', async () => {
    for (const k of ['personas', 'scope']) { await nav(k); await page.getByTestId('draft-' + k).getByTestId('draft-accept').click(); await expect(status(k)).toHaveAttribute('data-status', 'accepted'); }
    await nav('requirements'); const d = page.getByTestId('draft-requirements');
    await expect(d.getByTestId('draft-item')).toHaveCount(5);
    await d.getByTestId('draft-item').nth(1).getByTestId('draft-check').uncheck();
    await expect(d.getByTestId('draft-accept')).toContainText('所选（4）');
    await page.waitForTimeout(1000); await shot('review-requirements');
    await d.getByTestId('draft-accept').click();
    await expect(page.getByTestId('req-table').locator('tbody tr')).toHaveCount(4);
    await expect(page.getByTestId('req-table')).not.toContainText('候补自动递补');
    await expect(page.getByTestId('page-trace').locator('.tc.on')).toHaveCount(4);
  });

  test('审核：驳回后带附加要求重新生成（风险）', async () => {
    await nav('risks'); await page.getByTestId('draft-risks').getByTestId('draft-reject').click();
    await expect(status('risks')).toHaveAttribute('data-status', 'empty');
    await expect(page.getByTestId('page-risks').getByTestId('empty-state')).toBeVisible();
    await page.getByTestId('gen-risks').click(); await page.getByTestId('ins-risks').fill('REGEN 侧重人员风险');
    await page.getByTestId('ins-go-risks').click();
    await expect(page.getByTestId('draft-risks')).toContainText('【重生成】私教流失', { timeout: 15000 });
    await expect(page.getByTestId('draft-risks')).toContainText('附加要求：REGEN');
    await page.getByTestId('draft-risks').getByTestId('draft-accept').click();
    await expect(page.getByTestId('risk-table')).toBeVisible();
    expect(await page.getByTestId('risk-table').locator('textarea').evaluateAll(es => es.map(e => (e as HTMLTextAreaElement).value))).toContain('【重生成】私教流失导致课程供给不足');
  });

  test('审核草稿中的“重新生成”按钮可替换草稿', async () => {
    await nav('decisions'); await page.getByTestId('draft-decisions').getByTestId('draft-regen').click();
    await expect(page.getByTestId('ai-stream')).toBeVisible();
    await expect(page.getByTestId('draft-decisions')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('draft-decisions').getByTestId('draft-accept').click();
    await expect(status('decisions')).toHaveAttribute('data-status', 'accepted');
  });

  test('补全缺失：仅新增条目；撤销 / 重做 审核操作', async () => {
    await nav('glossary'); await page.getByTestId('draft-glossary').getByTestId('draft-accept').click();
    await expect(page.getByTestId('term-table').locator('tbody tr')).toHaveCount(3);
    await page.getByTestId('complete-glossary').click();
    const d = page.getByTestId('draft-glossary'); await expect(d).toContainText('课时包', { timeout: 15000 });
    await expect(d).toContainText('补全模式'); await expect(d.locator('.tag.green')).toHaveCount(1);
    await d.getByTestId('draft-accept').click();
    await expect(page.getByTestId('term-table').locator('tbody tr')).toHaveCount(4);
    await page.waitForTimeout(700); await page.mouse.click(700, 30);
    await page.keyboard.press('Control+z'); await expect(status('glossary')).toHaveAttribute('data-status', 'pending');
    await page.keyboard.press('Control+y'); await expect(status('glossary')).toHaveAttribute('data-status', 'accepted');
  });

  test('采纳全部章节后审核进度 11/11，架构图渲染 AI 生成的 Mermaid', async () => {
    for (const k of ['journeys', 'options', 'arch']) { await nav(k); await page.getByTestId('draft-' + k).getByTestId('draft-accept').click(); await expect(status(k)).toHaveAttribute('data-status', 'accepted'); }
    await expect(page.getByTestId('review-pill')).toContainText('11/11');
    await nav('ai'); await expect(page.getByTestId('review-progress')).toHaveText('11/11');
    await expect(page.getByTestId('page-options').getByTestId('opt-score').first()).toHaveText('8.60');
    await nav('arch'); await expect(page.getByTestId('arch-preview').locator('svg')).toContainText('门禁系统', { timeout: 15000 });
  });

  test('一致性检查：AI + 规则问题列表', async () => {
    await nav('ai'); await page.getByTestId('ai-check').click();
    await expect(page.getByTestId('issues')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('issues')).toContainText('体测记录功能缺少对应需求');
    expect(await page.getByTestId('issue-row').count()).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(400); await shot('ai-panel');
  });

  test('原有交互：删除可撤销、MoSCoW 拖拽、导出', async () => {
    await nav('glossary'); const rows = page.getByTestId('term-table').locator('tbody tr');
    await page.getByTestId('page-glossary').getByTestId('row-del').first().click(); await expect(rows).toHaveCount(3);
    await page.getByTestId('toast-action').first().click(); await expect(rows).toHaveCount(4);
    await nav('priority'); await page.waitForTimeout(900);
    await page.getByTestId('kcard-US-004').dragTo(page.getByTestId('lane-Could'), { targetPosition: { x: 60, y: 20 } });
    await expect(page.getByTestId('lane-Could')).toContainText('续费到期提醒');
    await page.keyboard.press('Control+e');
    for (const k of ['md', 'json', 'pdf']) { await page.getByTestId('export-' + k).click(); await expect(page.getByTestId('export-msg')).toContainText('.' + k); }
    const md = fs.readFileSync(path.join(exportDir, fs.readdirSync(exportDir).find(f => f.endsWith('.md'))!), 'utf8');
    expect(md).toContain('预约团课'); expect(md).not.toContain('sk-test-123');
  });

  test('删除项目需确认；主题切换', async () => {
    await nav('projects'); await page.getByTestId('new-name').fill('待删除项目'); await page.getByTestId('new-create').click();
    await nav('projects'); await expect(page.getByTestId('proj-card')).toHaveCount(3);
    await page.getByTestId('proj-del').last().click(); await page.getByTestId('confirm-cancel').click(); await expect(page.getByTestId('proj-card')).toHaveCount(3);
    await page.getByTestId('proj-del').last().click(); await page.getByTestId('confirm-ok').click(); await expect(page.getByTestId('proj-card')).toHaveCount(2);
    await page.getByTestId('proj-switch').selectOption({ label: '健身房会员小程序' });
    await page.getByTestId('theme-toggle').click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await nav('requirements'); await page.waitForTimeout(800); await shot('dark');
  });

  test('持久化：重启后审核状态、草稿、设置与主题保留', async () => {
    await page.waitForTimeout(800); await app.close(); await launch();
    await expect(page.getByTestId('tour')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('.crumb')).toContainText('健身房会员小程序');
    for (const k of AI_CH) await expect(status(k)).toHaveAttribute('data-status', 'accepted');
    await expect(page.getByTestId('issues')).toBeVisible();
    await page.getByTestId('open-settings').click(); await expect(page.getByTestId('settings')).toContainText('已保存');
    await page.keyboard.press('Escape');
    await nav('requirements'); await expect(page.getByTestId('req-table')).toContainText('预约团课');
    await page.getByTestId('gen-glossary').click(); await page.getByTestId('ins-go-glossary').click();
    await expect(page.getByTestId('draft-glossary')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800); await app.close(); await launch();
    await expect(status('glossary')).toHaveAttribute('data-status', 'pending');
    await expect(page.getByTestId('draft-glossary')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('v1.3：版本徽标、跳过已采纳、进度条停止、词级差异与 LLM 友好错误', async () => {
    await toEdit();
    await expect(page.locator('.ver')).toContainText('v1.5.1');
    // accept leftover pending glossary from persistence test so skip-accepted can short-circuit
    if (await status('glossary').getAttribute('data-status') === 'pending') {
      await nav('glossary');
      await page.getByTestId('draft-glossary').getByTestId('draft-accept').click();
      await expect(status('glossary')).toHaveAttribute('data-status', 'accepted');
    }
    // word-level diff after REGEN instruction on vision
    await nav('vision');
    await page.getByTestId('gen-vision').click();
    await page.getByTestId('ins-vision').fill('REGEN 改写问题陈述');
    await page.getByTestId('ins-go-vision').click();
    await expect(page.getByTestId('draft-vision')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('draft-vision').locator('.wdiff .w-add, .wdiff .w-del').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(600); await shot('v13-worddiff');
    await page.getByTestId('draft-vision').getByTestId('draft-accept').click();
    await expect(status('vision')).toHaveAttribute('data-status', 'accepted');

    // skip-accepted: generateAll should toast and skip when all accepted
    await nav('ai');
    await expect(page.getByTestId('skip-accepted')).toBeChecked();
    await page.getByTestId('ai-generate-all').click();
    await expect(page.getByTestId('toast').filter({ hasText: '所有章节均已采纳' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('gen-bar')).toHaveCount(0);

    // force LLM 429 and verify friendly error + retry
    await fetch(mock.url.replace('/v1', '/__fail'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 429, message: 'rate limit', count: 5 }) });
    await nav('glossary');
    await page.getByTestId('gen-glossary').click();
    await page.getByTestId('ins-go-glossary').click();
    await expect(page.getByTestId('toast').filter({ hasText: /自动重试（第 1\/3 次）/ }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('gen-error-glossary')).toContainText(/过于频繁|额度不足|HTTP 429/, { timeout: 15000 });
    await fetch(mock.url.replace('/v1', '/__clear-fail'), { method: 'POST' });
    await expect(page.getByTestId('retry-glossary')).toBeVisible();
    await page.waitForTimeout(500); await shot('v13-llm-error');
    await page.getByTestId('retry-glossary').click();
    await expect(page.getByTestId('draft-glossary')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('draft-glossary').getByTestId('draft-accept').click();

    // stop mid generate-all via gen-bar (uncheck skip so it actually runs)
    await nav('ai');
    await page.getByTestId('skip-accepted').uncheck();
    await page.getByTestId('ai-generate-all').click();
    await expect(page.getByTestId('gen-bar')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('gen-bar-stop').click();
    await expect(page.getByTestId('toast').filter({ hasText: /已停止：/ }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('gen-bar')).toHaveCount(0, { timeout: 20000 });
    await page.getByTestId('skip-accepted').check();
    expect(await page.locator('body').innerText()).not.toMatch(EMOJI);
    await page.waitForTimeout(400); await shot('v13-after-stop');

    // dark preview report
    await toPreview();
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await nav('dashboard');
    await expect(page.getByTestId('report-cover')).toBeVisible();
    await page.waitForTimeout(500); await shot('v14-preview-dark');
    await page.getByTestId('theme-toggle').click();
  });

  test('v1.5：限流自动退避重试后成功', async () => {
    await toEdit(); await nav('glossary');
    await fetch(mock.url.replace('/v1', '/__fail'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 429, message: 'rate limit', count: 1 }) });
    await page.getByTestId('gen-glossary').click(); await page.getByTestId('ins-go-glossary').click();
    await expect(page.getByTestId('toast').filter({ hasText: /限流.*自动重试/ }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('draft-glossary')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('gen-error-glossary')).toHaveCount(0);
    await page.getByTestId('draft-glossary').getByTestId('draft-accept').click();
    await expect(status('glossary')).toHaveAttribute('data-status', 'accepted');
  });

  test('v1.5：多文件资料导入 + BM25 检索 + 引用标注（审核与预览）', async () => {
    await toEdit(); await nav('ai');
    await page.getByTestId('ai-import-docs').click();
    await expect(page.getByTestId('mat-chip')).toHaveCount(3);
    await expect(page.getByTestId('materials')).toContainText('合规要求.docx');
    await expect(page.getByTestId('mat-stat')).toContainText('检索片段');
    await nav('risks'); await page.getByTestId('gen-risks').click(); await page.getByTestId('ins-risks').fill('侧重合规与隐私风险');
    await page.getByTestId('ins-go-risks').click();
    const d = page.getByTestId('draft-risks'); await expect(d).toBeVisible({ timeout: 15000 });
    await expect(d.getByTestId('cite-chip').first()).toBeVisible();
    await expect(d.getByTestId('cite-chip').first()).toContainText('S1');
    const log = await (await fetch(mock.url.replace('/v1', '/__log'))).json();
    const rp = log.filter((x: any) => x.sys.includes('[[CHAPTER:risks]]')).at(-1).user;
    expect(rp).toContain('参考资料片段'); expect(rp).toContain('[S1]'); expect(rp).toMatch(/合规要求\.docx|个人健康信息/);
    await d.scrollIntoViewIfNeeded(); await page.waitForTimeout(400); await shot('v15-citations-review');
    await d.getByTestId('draft-accept').click(); await expect(status('risks')).toHaveAttribute('data-status', 'accepted');
    await toPreview(); await nav('risks');
    await expect(page.getByTestId('report-cites-risks')).toBeVisible();
    await expect(page.getByTestId('risk-table').getByTestId('cite-chip').first()).toBeVisible();
    await page.getByTestId('report-cites-risks').scrollIntoViewIfNeeded(); await page.waitForTimeout(500); await shot('v15-citations-preview');
  });

  test('v1.5：JSON 结构校验失败时自动修复重试', async () => {
    await toEdit(); await nav('decisions');
    await page.getByTestId('gen-decisions').click(); await page.getByTestId('ins-decisions').fill('BADJSON 测试');
    await page.getByTestId('ins-go-decisions').click();
    const d = page.getByTestId('draft-decisions'); await expect(d).toBeVisible({ timeout: 20000 });
    await expect(d).toContainText('已自动修复格式');
    const log = await (await fetch(mock.url.replace('/v1', '/__log'))).json();
    expect(log.some((x: any) => x.user.includes('[[REPAIR]]'))).toBe(true);
    await d.getByTestId('draft-accept').click(); await expect(status('decisions')).toHaveAttribute('data-status', 'accepted');
  });

  test('v1.5：多角色并行评审 + 一键生成修复草稿', async () => {
    await toEdit(); await nav('ai');
    await page.getByTestId('ai-review').click();
    await expect(page.getByTestId('finding-row')).toHaveCount(6, { timeout: 20000 });
    const log = await (await fetch(mock.url.replace('/v1', '/__log'))).json();
    for (const r of ['product', 'arch', 'security', 'ops', 'user']) expect(log.some((x: any) => x.sys.includes('[[ROLE:' + r + ']]'))).toBe(true);
    await expect(page.getByTestId('rtab-security')).toContainText('2');
    await expect(page.getByTestId('finding-row').first()).toContainText('高');
    await page.getByTestId('review-panel').scrollIntoViewIfNeeded(); await page.waitForTimeout(400); await shot('v15-multi-review');
    await page.getByTestId('rtab-security').click(); await expect(page.getByTestId('finding-row')).toHaveCount(2);
    await page.getByTestId('finding-row').filter({ hasText: '风险与假设' }).getByTestId('finding-fix').click();
    await expect(page.getByTestId('draft-risks')).toContainText('【修复】体测等个人健康信息', { timeout: 15000 });
    await page.getByTestId('draft-risks').getByTestId('draft-accept').click(); await expect(status('risks')).toHaveAttribute('data-status', 'accepted');
    // consistency issue fix button
    await nav('ai'); await expect(page.getByTestId('issue-fix').first()).toBeVisible();
    await expect(page.getByTestId('usage')).toContainText('次调用');
  });

  test('v1.5：AI 对话侧栏，带项目上下文并提出可审核的修改', async () => {
    await toPreview();
    await page.keyboard.press('Control+j'); await expect(page.getByTestId('chat-panel')).toBeVisible();
    await page.getByTestId('chat-input').fill('帮我检查一下风险章节还缺什么');
    await page.getByTestId('chat-send').click();
    await expect(page.getByTestId('chat-msg-assistant').last()).toContainText('个人健康信息', { timeout: 15000 });
    const log = await (await fetch(mock.url.replace('/v1', '/__log'))).json();
    const ch = log.filter((x: any) => x.sys.includes('[[TASK:chat]]')).at(-1);
    expect(ch.user).toContain('风险章节');
    await page.getByTestId('chat-input').fill('用三句话总结这个项目'); await page.getByTestId('chat-send').click();
    await expect(page.getByTestId('chat-msg-assistant')).toHaveCount(2, { timeout: 15000 });
    await page.waitForTimeout(400); await shot('v15-chat-sidebar');
    await page.getByTestId('chat-action').first().click();
    await expect(page.getByTestId('doc-root')).toHaveAttribute('data-mode', 'edit');
    await expect(page.getByTestId('draft-risks')).toContainText('【修复】', { timeout: 15000 });
    await expect(page.getByTestId('chat-action').first()).toContainText('已生成草稿');
    await page.getByTestId('draft-risks').getByTestId('draft-accept').click(); await expect(status('risks')).toHaveAttribute('data-status', 'accepted');
    await page.getByTestId('chat-close').click(); await expect(page.getByTestId('chat-panel')).toHaveCount(0);
  });

  test('v1.5：预览中选中文字 -> AI 转成需求', async () => {
    await toPreview(); await nav('personas'); await page.waitForTimeout(600);
    const box = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('#sec-personas .rp-persona *')).find(e => e.childNodes.length === 1 && e.firstChild!.nodeType === 3 && (e.textContent || '').length > 4) as HTMLElement;
      const r = document.createRange(); r.selectNodeContents(el); const s = getSelection()!; s.removeAllRanges(); s.addRange(r);
      const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
    await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
    await expect(page.getByTestId('sel-bar')).toBeVisible();
    await page.waitForTimeout(200); await shot('v15-selection-toolbar');
    await page.getByTestId('sel-req').click();
    await expect(page.getByTestId('draft-requirements')).toContainText('US-005', { timeout: 15000 });
    await expect(page.getByTestId('draft-requirements')).toContainText('补全模式');
    await page.getByTestId('draft-requirements').getByTestId('draft-accept').click();
    await expect(status('requirements')).toHaveAttribute('data-status', 'accepted');
  });

  test('v1.5：版本历史快照、差异与恢复', async () => {
    await page.getByTestId('history-btn').click();
    const h = page.getByTestId('history'); await expect(h).toBeVisible();
    expect(await h.getByTestId('snap-item').count()).toBeGreaterThanOrEqual(5);
    await h.getByTestId('snap-item').nth(1).click();
    await expect(h.getByTestId('snap-diff-ch').first()).toBeVisible();
    await page.waitForTimeout(300); await shot('v15-history');
    const before = await h.getByTestId('snap-item').count();
    await h.getByTestId('snap-restore').click(); await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('toast').filter({ hasText: '已恢复历史版本' }).first()).toBeVisible();
    await toEdit(); await nav('requirements');
    await expect(page.getByTestId('req-table')).not.toContainText('US-005');
    await page.getByTestId('history-btn').click();
    await expect(page.getByTestId('history').getByTestId('snap-item')).toHaveCount(Math.min(20, before + 1));
    await expect(page.getByTestId('history').getByTestId('snap-item').first()).toContainText('恢复版本前');
    await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
    expect(await page.locator('body').innerText()).not.toMatch(EMOJI);
  });

  test('v1.5：设置中的提示词模板注入到生成提示词', async () => {
    await page.getByTestId('open-settings').click();
    await page.getByTestId('tpl-industry').selectOption('医疗'); await page.getByTestId('tpl-style').selectOption('咨询报告');
    await page.getByTestId('tpl-custom').fill('需求编号使用 FR-xxx');
    await expect(page.getByTestId('tpl-settings')).toContainText('患者隐私');
    await page.waitForTimeout(300); await shot('v15-settings-templates');
    await page.getByTestId('set-save').click();
    await toEdit(); await nav('glossary'); await page.getByTestId('gen-glossary').click(); await page.getByTestId('ins-go-glossary').click();
    await expect(page.getByTestId('draft-glossary')).toBeVisible({ timeout: 15000 });
    const log = await (await fetch(mock.url.replace('/v1', '/__log'))).json();
    const g = log.filter((x: any) => x.sys.includes('[[CHAPTER:glossary]]')).at(-1).sys;
    expect(g).toContain('医疗健康'); expect(g).toContain('结论先行'); expect(g).toContain('FR-xxx');
    await page.getByTestId('draft-glossary').getByTestId('draft-reject').click();
    expect(errors).toEqual([]);
  });

});
