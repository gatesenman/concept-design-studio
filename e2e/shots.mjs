// usage: node e2e/shots.mjs <outdir>   (screenshots every module as a first-time user)
import { _electron as electron } from '@playwright/test';
import fs from 'fs'; import os from 'os'; import path from 'path';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const app = await electron.launch({ args: ['.', '--no-sandbox'], env: { ...process.env, CDS_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'shot-')) } });
const page = await app.firstWindow(); await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/00-first-launch.png` });
const skip = page.getByTestId('tour-skip'); if (await skip.count()) await skip.click();
for (const [i, k] of ['projects','dashboard','vision','stakeholders','personas','journeys','requirements','priority','trace','scope','options','arch','decisions','risks','glossary','export'].entries()) {
  await page.getByTestId('nav-' + k).click(); await page.waitForTimeout(k === 'arch' ? 1500 : 400);
  await page.screenshot({ path: `${out}/${String(i + 1).padStart(2, '0')}-${k}.png` });
}
// blank project empty states
await page.getByTestId('nav-projects').click(); await page.getByTestId('new-name').fill('空白项目'); await page.getByTestId('new-create').click(); await page.waitForTimeout(400);
for (const k of ['dashboard', 'personas', 'requirements']) { await page.getByTestId('nav-' + k).click(); await page.waitForTimeout(400); await page.screenshot({ path: `${out}/blank-${k}.png` }); }
await page.setViewportSize({ width: 1000, height: 700 }); await page.getByTestId('nav-requirements').click(); await page.waitForTimeout(400); await page.screenshot({ path: `${out}/small-window.png` });
await app.close();
