import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const order = [
  'README.md',
  '00_EXECUTIVE_OVERVIEW.md',
  '01_CURRENT_STATE.md',
  '02_MASTER_BUILD_LIST.md',
  '03_PHASE_TIMELINE.md',
  '04_COMPLIANCE_FOUNDATION.md',
  '05_UTILITIES_WALLET.md',
  '06_PAYMENT_AGGREGATORS.md',
  '07_P2P_TRADER_UPGRADES.md',
  '08_MULTI_COUNTRY.md',
  '09_CROSS_CHAIN.md',
  '10_PLATFORM_OPS.md',
  '11_DECISION_RECORD.md',
  '12_IMPLEMENTATION_STARTER.md',
];

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inCode = false;
  let codeBuf = [];
  let tableRows = [];

  function flushTable() {
    if (!tableRows.length) return;
    out.push('<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;margin:12pt 0;font-size:11pt">');
    tableRows.forEach((row, i) => {
      const tag = i === 0 ? 'th' : 'td';
      out.push('<tr>' + row.map((c) => `<${tag}>${c}</${tag}>`).join('') + '</tr>');
    });
    out.push('</table>');
    tableRows = [];
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        out.push(`<pre style="background:#f5f5f5;padding:10pt;font-size:10pt;font-family:Consolas,monospace">${escapeHtml(codeBuf.join('\n'))}</pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        flushTable();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    if (line.trim().startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => escapeHtml(c.trim()));
      if (cells.every((c) => /^[-:\s]+$/.test(c))) continue;
      tableRows.push(cells);
      continue;
    } else {
      flushTable();
    }

    if (line.startsWith('# ')) out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    else if (line.startsWith('## ')) out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    else if (line.startsWith('### ')) out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    else if (line.startsWith('#### ')) out.push(`<h4>${escapeHtml(line.slice(5))}</h4>`);
    else if (line.trim() === '---') out.push('<hr/>');
    else if (line.startsWith('- ')) {
      let t = escapeHtml(line.slice(2));
      t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      out.push(`<p style="margin-left:24pt;text-indent:-12pt">&#8226; ${t}</p>`);
    } else if (line.trim() === '') out.push('');
    else {
      let t = escapeHtml(line);
      t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      out.push(`<p>${t}</p>`);
    }
  }
  flushTable();
  if (inCode && codeBuf.length) {
    out.push(`<pre style="background:#f5f5f5;padding:10pt;font-size:10pt">${escapeHtml(codeBuf.join('\n'))}</pre>`);
  }
  return out.join('\n');
}

const body = order
  .map((f) => {
    const content = fs.readFileSync(path.join(__dirname, f), 'utf8');
    return `<div class="section" style="page-break-before:always"><p style="font-size:10pt;color:#666;font-style:italic">Document source: ${f}</p>${mdToHtml(content)}</div>`;
  })
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Rowan Product Roadmap — Beta Tech Labs</title>
<style>
  @page { margin: 2.54cm; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #000;
    margin: 0;
    padding: 24pt;
  }
  h1 { font-size: 16pt; font-weight: bold; margin: 18pt 0 12pt 0; }
  h2 { font-size: 14pt; font-weight: bold; margin: 14pt 0 10pt 0; }
  h3 { font-size: 12pt; font-weight: bold; margin: 12pt 0 8pt 0; }
  h4 { font-size: 12pt; font-weight: bold; font-style: italic; margin: 10pt 0 6pt 0; }
  p { margin: 0 0 8pt 0; text-align: justify; }
  table { font-size: 11pt; }
  td, th { padding: 4pt 6pt; vertical-align: top; border: 1px solid #000; }
  th { font-weight: bold; background: #f0f0f0; }
  code { font-family: Consolas, monospace; font-size: 10pt; }
  hr { margin: 18pt 0; border: none; border-top: 1px solid #999; }
  .cover { text-align: center; padding: 100pt 0 60pt 0; page-break-after: always; }
  .cover h1 { font-size: 22pt; }
  .cover .sub { font-size: 14pt; margin: 8pt 0; }
</style>
</head>
<body>
<div class="cover">
  <h1>Rowan Product Roadmap</h1>
  <p class="sub"><strong>Beta Tech Labs Company Limited</strong></p>
  <p class="sub">Complete Pre-Implementation Documentation</p>
  <p class="sub">Version 1.0 — 24 July 2026</p>
  <p class="sub">Font: Times New Roman, 12pt</p>
  <p class="sub">55 Build Items | Phase 2A → Phase 3</p>
  <p class="sub">Team: Edyelu Andrew, Eragu Enoch, Laloyo Joshua, Kabuye Wamala</p>
</div>
${body}
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'ROWAN_ROADMAP_PRINT.html'), html);
console.log('OK:', html.length, 'bytes');
