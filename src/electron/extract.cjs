// Minimal, dependency-free text extraction for txt/md/docx/pdf (best effort).
const fs = require('fs'); const zlib = require('zlib'); const path = require('path');

function unzipEntry(buf, name) {
  // locate End Of Central Directory
  let eocd = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('不是有效的 docx（zip）文件');
  const n = buf.readUInt16LE(eocd + 10); let off = buf.readUInt32LE(eocd + 16);
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10), csize = buf.readUInt32LE(off + 20), nlen = buf.readUInt16LE(off + 28), xlen = buf.readUInt16LE(off + 30), clen = buf.readUInt16LE(off + 32), lho = buf.readUInt32LE(off + 42);
    const fname = buf.slice(off + 46, off + 46 + nlen).toString('utf8');
    if (fname === name) {
      const ln = buf.readUInt16LE(lho + 26), lx = buf.readUInt16LE(lho + 28); const start = lho + 30 + ln + lx;
      const data = buf.slice(start, start + csize);
      return method === 0 ? data : zlib.inflateRawSync(data);
    }
    off += 46 + nlen + xlen + clen;
  }
  throw new Error('docx 中未找到正文 word/document.xml');
}
const unxml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
function docxText(buf) {
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  return unxml(xml.replace(/<w:tab\/>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<w:br\/>/g, '\n').replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim();
}
function pdfStr(s) { // literal string (...) with escapes
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, c) => ({ n: '\n', r: '', t: '\t', b: '', f: '', '(': '(', ')': ')', '\\': '\\' }[c] ?? String.fromCharCode(parseInt(c, 8))));
}
function pdfText(buf) {
  const bin = buf.toString('latin1'); const out = [];
  const re = /stream\r?\n([\s\S]*?)endstream/g; let m;
  while ((m = re.exec(bin))) {
    let data = Buffer.from(m[1], 'latin1'); let txt;
    try { txt = zlib.inflateSync(data).toString('latin1'); } catch { txt = m[1]; }
    const parts = [];
    const tj = /\((?:\\.|[^\\)])*\)\s*Tj|\[((?:\((?:\\.|[^\\)])*\)|[^\]])*)\]\s*TJ|(T\*|Td|TD|')/g; let t;
    while ((t = tj.exec(txt))) {
      if (t[2]) { parts.push('\n'); continue; }
      const seg = t[1] != null ? t[1] : t[0];
      const strs = seg.match(/\((?:\\.|[^\\)])*\)/g) || [];
      parts.push(strs.map(x => pdfStr(x.slice(1, -1))).join(''));
    }
    const s = parts.join('').trim(); if (s) out.push(s);
  }
  const text = out.join('\n').replace(/[^\S\n]+/g, ' ').trim();
  // Latin-1 decode of UTF-16/CID fonts yields garbage; keep only if mostly printable
  const printable = (text.match(/[\x20-\x7E\n\u00A0-\u00FF]/g) || []).length;
  return text && printable / text.length > 0.85 ? text : '';
}
function extractText(file) {
  const ext = path.extname(file).toLowerCase(); const buf = fs.readFileSync(file);
  if (ext === '.docx') return docxText(buf);
  if (ext === '.pdf') { const t = pdfText(buf); if (!t) throw new Error('未能从 PDF 提取文字（可能为扫描件或使用了嵌入字体），请另存为 txt/docx 后导入'); return t; }
  return buf.toString('utf8');
}
module.exports = { extractText, docxText, pdfText };
