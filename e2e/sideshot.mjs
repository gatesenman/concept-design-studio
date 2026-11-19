// usage: node e2e/sideshot.mjs <out-prefix>  — screenshots sidebar at 1280x800 (expanded + collapsed)
import { _electron as electron } from '@playwright/test';
import fs from 'fs'; import os from 'os'; import path from 'path';
const out = process.argv[2];
const app = await electron.launch({ args: ['.', '--no-sandbox'], env: { ...process.env, CDS_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'ss-')) } });
await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1280, 800); });
const page = await app.firstWindow(); await page.waitForTimeout(1500);
const skip = page.getByTestId('tour-skip'); if (await skip.count()) await skip.click();
await page.waitForTimeout(500);
const m = await page.evaluate(() => { const n = document.querySelector('nav'); const it = document.querySelector('.nav'); return { navScroll: n.scrollHeight, navClient: n.clientHeight, itemH: it.getBoundingClientRect().height, winH: innerHeight }; });
console.log(JSON.stringify(m));
await page.screenshot({ path: `${out}-expanded.png` });
await page.getByTestId('toggle-sidebar').click(); await page.waitForTimeout(400);
await page.screenshot({ path: `${out}-collapsed.png` });
await app.close();
