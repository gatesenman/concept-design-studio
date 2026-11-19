const { app, BrowserWindow, ipcMain, dialog, Menu, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.CDS_DATA_DIR || path.join(app.getPath('userData'), 'data');
const dataFile = () => path.join(dataDir, 'projects.json');
let win;

function resolveIcon() {
  const candidates = [
    path.join(__dirname, 'icons', 'icon.ico'),
    path.join(__dirname, 'icons', 'icon.png'),
    process.resourcesPath ? path.join(process.resourcesPath, 'icon.ico') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'icon.png') : '',
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon.png')
  ];
  for (const p of candidates) if (p && fs.existsSync(p)) return p;
  return undefined;
}

function createWindow() {
  if (process.platform === 'win32') app.setAppUserModelId('com.grokbot.conceptdesignstudio');
  const icon = resolveIcon();
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 800, minHeight: 560,
    title: '软件概念设计工作台', backgroundColor: '#f4f6fb',
    icon,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  });
  Menu.setApplicationMenu(null);
  if (process.env.VITE_DEV_URL) win.loadURL(process.env.VITE_DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

ipcMain.handle('data:load', () => {
  try { return JSON.parse(fs.readFileSync(dataFile(), 'utf8')); } catch { return null; }
});
ipcMain.handle('data:save', (_e, data) => {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = dataFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, dataFile());
  return { ok: true, path: dataFile() };
});
ipcMain.handle('data:path', () => dataFile());

async function pickPath(defaultName, filters) {
  if (process.env.CDS_EXPORT_DIR) {
    fs.mkdirSync(process.env.CDS_EXPORT_DIR, { recursive: true });
    return path.join(process.env.CDS_EXPORT_DIR, defaultName);
  }
  const r = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters });
  return r.canceled ? null : r.filePath;
}
ipcMain.handle('export:text', async (_e, { name, content, ext }) => {
  const p = await pickPath(name, [{ name: ext.toUpperCase(), extensions: [ext] }]);
  if (!p) return { ok: false };
  fs.writeFileSync(p, content, 'utf8');
  return { ok: true, path: p };
});
ipcMain.handle('export:pdf', async (_e, { name, html }) => {
  const p = await pickPath(name, [{ name: 'PDF', extensions: ['pdf'] }]);
  if (!p) return { ok: false };
  const w = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  const buf = await w.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
  w.destroy();
  fs.writeFileSync(p, buf);
  return { ok: true, path: p };
});
ipcMain.handle('import:json', async () => {
  const r = await dialog.showOpenDialog(win, { filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});


// ---------- LLM settings (API key encrypted with safeStorage, never sent back to renderer) ----------
const settingsFile = () => path.join(dataDir, 'settings.json');
function readSettings() { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; } }
function getKey(s) {
  if (!s.key) return '';
  try { return s.keyMode === 'safe' ? safeStorage.decryptString(Buffer.from(s.key, 'base64')) : Buffer.from(s.key, 'base64').toString('utf8'); } catch { return ''; }
}
ipcMain.handle('settings:get', () => { const s = readSettings(); return { preset: s.preset || 'deepseek', baseUrl: s.baseUrl || '', model: s.model || '', temperature: s.temperature ?? 0.7, jsonMode: s.jsonMode !== false, hasKey: !!s.key, keyMode: s.keyMode || null }; });
ipcMain.handle('settings:save', (_e, v) => {
  const s = readSettings();
  Object.assign(s, { preset: v.preset, baseUrl: (v.baseUrl || '').trim().replace(/\/+$/, ''), model: (v.model || '').trim(), temperature: Number(v.temperature ?? 0.7), jsonMode: v.jsonMode !== false });
  if (typeof v.apiKey === 'string' && v.apiKey.length) {
    if (safeStorage.isEncryptionAvailable()) { s.key = safeStorage.encryptString(v.apiKey).toString('base64'); s.keyMode = 'safe'; }
    else { s.key = Buffer.from(v.apiKey, 'utf8').toString('base64'); s.keyMode = 'obfuscated'; }
  }
  if (v.clearKey) { delete s.key; delete s.keyMode; }
  fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2));
  return { ok: true, keyMode: s.keyMode || null };
});

function llmConfig(override) {
  const s = readSettings(); const o = override || {};
  return { baseUrl: (o.baseUrl || s.baseUrl || '').replace(/\/+$/, ''), model: o.model || s.model, key: o.apiKey || getKey(s), temperature: s.temperature ?? 0.7, jsonMode: s.jsonMode !== false };
}
async function post(cfg, body, signal) {
  return fetch(cfg.baseUrl + '/chat/completions', { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key }, body: JSON.stringify(body) });
}
ipcMain.handle('llm:test', async (_e, override) => {
  const cfg = llmConfig(override);
  if (!cfg.baseUrl || !cfg.model) return { ok: false, error: '请填写 Base URL 与模型名称' };
  const t0 = Date.now();
  try {
    const r = await post(cfg, { model: cfg.model, messages: [{ role: 'user', content: '请回复：OK' }], max_tokens: 8, stream: false }, AbortSignal.timeout(20000));
    const txt = await r.text();
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}: ${txt.slice(0, 300)}` };
    const j = JSON.parse(txt); return { ok: true, ms: Date.now() - t0, reply: j.choices?.[0]?.message?.content || '', model: j.model || cfg.model };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});
const running = new Map();
const sleep = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')); }, { once: true }); });
const BACKOFF = Number(process.env.CDS_BACKOFF_MS || 1500);
ipcMain.on('llm:stream', async (e, { id, messages, opts = {} }) => {
  const send = (ch, d) => { if (!e.sender.isDestroyed()) e.sender.send(ch, { id, ...d }); };
  const cfg = llmConfig();
  if (!cfg.baseUrl || !cfg.model || !cfg.key) return send('llm:done', { error: '尚未配置 AI 模型，请先在“AI 设置”中填写 Base URL、API Key 与模型' });
  const ac = new AbortController(); running.set(id, ac);
  const json = opts.json !== false && cfg.jsonMode;
  const base = { model: cfg.model, messages, temperature: opts.temperature ?? cfg.temperature, stream: true };
  const withExtras = { ...base, stream_options: { include_usage: true }, ...(json ? { response_format: { type: 'json_object' } } : {}) };
  try {
    let r, attempt = 0;
    for (;;) {
      r = await post(cfg, withExtras, ac.signal);
      if (r.status === 400) r = await post(cfg, base, ac.signal); // provider may not support json mode / stream_options
      if ((r.status === 429 || r.status >= 500) && attempt < 3) {
        attempt++; const ra = Number(r.headers.get('retry-after')); const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 20000) : BACKOFF * 2 ** (attempt - 1);
        try { await r.text(); } catch {}
        send('llm:retry', { attempt, wait, status: r.status }); await sleep(wait, ac.signal); continue;
      }
      break;
    }
    if (!r.ok) { const t = await r.text(); return send('llm:done', { error: `HTTP ${r.status}: ${t.slice(0, 400)}` }); }
    let full = '', buf = '', usage = null;
    const dec = new TextDecoder();
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim(); if (data === '[DONE]') continue;
        try { const j = JSON.parse(data); if (j.usage) usage = j.usage; const d = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? ''; if (d) { full += d; send('llm:chunk', { delta: d }); } } catch {}
      }
    }
    send('llm:done', { text: full, usage });
  } catch (err) { send('llm:done', { error: ac.signal.aborted ? '已停止' : String(err.message || err) }); }
  finally { running.delete(id); }
});
ipcMain.on('llm:abort', (_e, id) => running.get(id)?.abort());
ipcMain.handle('file:readText', async () => {
  const r = await dialog.showOpenDialog(win, { filters: [{ name: '文本文档', extensions: ['txt', 'md', 'markdown', 'json', 'csv'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return { name: path.basename(r.filePaths[0]), text: fs.readFileSync(r.filePaths[0], 'utf8').slice(0, 50000) };
});
const { extractText } = require('./extract.cjs');
ipcMain.handle('file:readDocs', async () => {
  let files = process.env.CDS_IMPORT_FILES ? process.env.CDS_IMPORT_FILES.split(path.delimiter).filter(Boolean) : null;
  if (!files) {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: '资料文档', extensions: ['txt', 'md', 'markdown', 'docx', 'pdf', 'csv', 'json'] }], properties: ['openFile', 'multiSelections'] });
    if (r.canceled) return [];
    files = r.filePaths;
  }
  const out = [];
  for (const f of files) {
    try { const text = extractText(f); out.push({ name: path.basename(f), text: text.slice(0, 200000), ok: !!text.trim() }); }
    catch (err) { out.push({ name: path.basename(f), text: '', ok: false, error: String(err.message || err) }); }
  }
  return out;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
