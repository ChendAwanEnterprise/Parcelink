const fs = require('fs');
const path = require('path');

function inline(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function toHtml(markdown, title) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let listTag = '';
  let inTable = false;
  let para = [];

  function flushPara() {
    if (!para.length) return;
    html.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  }
  function closeList() {
    if (!listTag) return;
    html.push(`</${listTag}>`);
    listTag = '';
  }
  function closeTable() {
    if (!inTable) return;
    html.push('</tbody></table>');
    inTable = false;
  }
  function openList(tag) {
    if (listTag && listTag !== tag) closeList();
    if (!listTag) {
      html.push(`<${tag}>`);
      listTag = tag;
    }
  }

  for (const line of lines) {
    if (line.startsWith('|')) {
      flushPara();
      closeList();
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
      if (!inTable) {
        html.push('<table><tbody>');
        inTable = true;
      }
      const tag = inTable && html[html.length - 1] === '<table><tbody>' ? 'th' : 'td';
      html.push(`<tr>${cells.map((cell) => `<${tag}>${inline(cell)}</${tag}>`).join('')}</tr>`);
      continue;
    }
    closeTable();
    if (line.startsWith('# ')) {
      flushPara();
      closeList();
      html.push(`<h1>${inline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushPara();
      closeList();
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('- ')) {
      flushPara();
      openList('ul');
      html.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    const numbered = line.match(/^\d+\. (.*)$/);
    if (numbered) {
      flushPara();
      openList('ol');
      html.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }
    if (line.trim() === '') {
      flushPara();
      closeList();
      continue;
    }
    closeList();
    para.push(line.trim());
  }
  flushPara();
  closeList();
  closeTable();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: "Segoe UI", sans-serif; color: #17211c; line-height: 1.45; margin: 28px 36px; }
    h1 { font-size: 26px; margin-bottom: 0.3em; }
    h2 { font-size: 18px; margin-top: 1.3em; }
    table { border-collapse: collapse; width: 100%; margin: 0.5em 0 1em; }
    th, td { border: 1px solid #c9d7ce; padding: 6px 8px; vertical-align: top; text-align: left; }
    th { background: #e7efe8; }
    code { font-family: Consolas, monospace; background: #f3f6f2; padding: 0 3px; }
  </style>
</head>
<body>
${html.join('\n')}
</body>
</html>`;
}

const root = path.join(__dirname, '..');
const out = path.join(root, 'print');
fs.mkdirSync(out, { recursive: true });
const guides = [
  ['HANDOVER.md', 'handover.html', 'Prototype builder handover'],
  ['docs/Client-User-Guide.md', 'client-guide.html', 'Client user guide'],
];
for (const [source, file, title] of guides) {
  const markdown = fs.readFileSync(path.join(root, source), 'utf8');
  fs.writeFileSync(path.join(out, file), toHtml(markdown, title));
  console.log(file);
}
