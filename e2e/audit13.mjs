import { _electron as electron } from '@playwright/test';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { startMock } from './mock-llm.mjs';
const out='/workspace/cds-v13';
const mock=await startMock(0,{delay:20,chunk:50});
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'a13-'));
const app=await electron.launch({args:['.','--no-sandbox'],env:{...process.env,CDS_DATA_DIR:dataDir,CDS_EXPORT_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'e13-'))}});
await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].setContentSize(1440,900);});
const page=await app.firstWindow();
await page.waitForTimeout(1200);
const skip=page.getByTestId('tour-skip'); if(await skip.count()) await skip.click();
await page.waitForTimeout(400);
await page.screenshot({path:`${out}/before-dashboard.png`});
// configure mock
await page.getByTestId('open-settings').click();
await page.getByTestId('preset-custom').click();
await page.getByTestId('set-baseurl').fill(mock.url);
await page.getByTestId('set-model').fill('mock');
await page.getByTestId('set-key').fill('sk-test-123');
await page.getByTestId('set-save').click();
await page.waitForTimeout(300);
await page.getByTestId('nav-projects').click();
await page.getByTestId('ai-new-name').fill('优化审计项目');
await page.getByTestId('ai-new-brief').fill('社区养老上门服务小程序：预约护理、健康档案、家属看板');
await page.getByTestId('ai-new-go').click();
await page.waitForTimeout(1500);
await page.screenshot({path:`${out}/before-generating.png`});
await page.getByTestId('toc-status-glossary').waitFor({state:'visible',timeout:90000});
// wait pending
for(;;){ const s=await page.getByTestId('toc-status-glossary').getAttribute('data-status'); if(s==='pending') break; await page.waitForTimeout(400); }
await page.getByTestId('nav-vision').click(); await page.waitForTimeout(800);
await page.screenshot({path:`${out}/before-review.png`});
await page.getByTestId('nav-requirements').click(); await page.waitForTimeout(800);
await page.screenshot({path:`${out}/before-req-draft.png`});
await app.close(); mock.server.close();
console.log('audit done');
