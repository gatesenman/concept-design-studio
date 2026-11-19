const { contextBridge, ipcRenderer } = require('electron');
let seq = 0;
contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (d) => ipcRenderer.invoke('data:save', d),
  dataPath: () => ipcRenderer.invoke('data:path'),
  exportText: (o) => ipcRenderer.invoke('export:text', o),
  exportPdf: (o) => ipcRenderer.invoke('export:pdf', o),
  importJson: () => ipcRenderer.invoke('import:json'),
  readTextFile: () => ipcRenderer.invoke('file:readText'),
  readDocs: () => ipcRenderer.invoke('file:readDocs'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  testLlm: (o) => ipcRenderer.invoke('llm:test', o),
  /** streams a chat completion; onDelta(text) per chunk; resolves with full text */
  llmStream: (messages, onDelta, opts = {}, onRetry) => {
    const id = 'r' + (++seq) + Date.now();
    const p = new Promise((resolve, reject) => {
      const onChunk = (_e, d) => { if (d.id === id) onDelta(d.delta); };
      const onRetryEv = (_e, d) => { if (d.id === id && onRetry) onRetry(d); };
      const onDone = (_e, d) => { if (d.id !== id) return; ipcRenderer.removeListener('llm:chunk', onChunk); ipcRenderer.removeListener('llm:done', onDone); ipcRenderer.removeListener('llm:retry', onRetryEv); d.error ? reject(new Error(d.error)) : resolve({ text: d.text, usage: d.usage }); };
      ipcRenderer.on('llm:chunk', onChunk); ipcRenderer.on('llm:done', onDone); ipcRenderer.on('llm:retry', onRetryEv);
      ipcRenderer.send('llm:stream', { id, messages, opts });
    });
    return { id, promise: p };
  },
  llmAbort: (id) => ipcRenderer.send('llm:abort', id)
});
