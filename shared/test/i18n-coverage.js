'use strict';
// Counts user-visible English literals that are not behind t(), per surface, and compares them with the
// ceiling in i18n-baseline.json (it only goes down). `node shared/test/i18n-coverage.js --write` rewrites
// docs/i18n-coverage.md; `--baseline` lowers the ceilings to the current counts.
//   Not counted: tab definition fields (title/heading/desc/blurb: the shell translates them by id),
//   lines that already carry data-i18n*, logs, comments, and the phrases in i18n-allow.json.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const list = (dir, re) => (fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter((f) => re.test(f)).map((f) => dir + '/' + f) : []);
const PLAT = ['windows', 'linux', 'mac'];

const surfaces = {
  'Páginas do desktop': PLAT.flatMap((d) => list(d, /^(ui-.*|app|control)\.js$/)),
  'Mesh': PLAT.flatMap((d) => list(d + '/mesh', /^(ui-.*|app)\.js$/)),
  'Módulos shared/ui': list('shared', /^(ui-.*|pairpop|aurora-shell|feature-art)\.js$/),
  'Processo principal': PLAT.flatMap((d) => list(d, /\.js$/).filter((f) => !/\/(ui-|app\.js|control\.js|.*renderer|preload)/.test(f))).concat(list('shared', /^(support|vcam|rezume|screen-mesh|phonedrive|updates|about|received|camshare)\.js$/)),
  'Efeitos e módulos shared': list('shared/pagefx', /\.js$/).concat(list('shared', /^(mesh-intro|callpop|kvm-map-ui|camera-view|camshare-mesh|adbqr|callwin|intro|phone-remote|netlink|btaudio)\.js$/)),
  'Janelas pequenas': PLAT.flatMap((d) => list(d, /(renderer\.js|\.html)$/).filter((f) => !/\/(app|control)\.html$/.test(f))),
};

const allow = JSON.parse(read('shared/test/i18n-allow.json')).phrases;
const attr = /(?:\b(?:text|label|hint|title|placeholder|message|error|tooltip|textContent|setHint|aria-label)\b\s*[:=(]\s*|\bUI\.(?:button|row|card|note|switch)\(\s*)(['"])([A-Z][^'"]*)\1/g;
const htmlText = />\s*([A-Z][A-Za-z’'.,:;!?…()\- ]{5,}?)\s*</g;
// a sentence glued from pieces: 'Select files, press ' + keys + ...   or   ... + ' on the other computer'
const concat = /(['"])([A-Z][a-z]+ [^'"]{4,})\1\s*\+|\+\s*(['"])( ?[a-z][a-z ,']{4,}[a-z ])\3/g;
const wrapped = /(?<![\w$])(?:t|tr|tt|tFn|UI\.t|UI\.tr)\(/;

function suspects(file) {
  const out = [];
  const isHtml = file.endsWith('.html');
  read(file).split('\n').forEach((line, i) => {
    if (/data-i18n/.test(line) || /^\s*(\/\/|\*|<!--)/.test(line) || /console\.|applog|require\(/.test(line)) return;
    if (/^\s{2,4}(title|heading|desc|blurb|group|tag):/.test(line)) return;
    const found = [];
    for (const re of isHtml ? [attr, htmlText] : [attr, concat]) {
      re.lastIndex = 0;
      if (re === concat && wrapped.test(line)) continue; // pieces inside a t() default are the English default
      let m;
      while ((m = re.exec(line))) found.push(m.slice(1).filter((x) => x && !/^['"]$/.test(x)).pop());
    }
    for (const txt of found) {
      if (!/[a-z]{3}/.test(txt) || /^[A-Z_]+$/.test(txt)) continue;
      if (!/ /.test(txt) && !/[…:.!?]$/.test(txt) && txt.length < 5) continue;
      if (allow.some((p) => txt.startsWith(p))) continue;
      if (!isHtml && wrapped.test(line.replace(/(?<![\w$])(?:t|tr|tt|tFn|UI\.t|UI\.tr)\([^)]*\)/g, ''))) {
        // the literal may still be a default inside t(): drop it only if it is the 3rd argument of a t() call
        if (new RegExp('(?<![\\w$])(?:t|tr|tt|tFn|UI\\.t|UI\\.tr)\\([^)]*[\'"]' + txt.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(line)) continue;
      }
      out.push(file + ':' + (i + 1) + ' ' + txt.slice(0, 60));
    }
  });
  return out;
}

const result = {};
for (const [name, files] of Object.entries(surfaces)) {
  const list_ = files.flatMap(suspects);
  // t() calls, to show a ratio
  const calls = files.reduce((n, f) => n + (read(f).match(/(?<![\w$])(?:t|tr|tt|tFn|UI\.t|UI\.tr)\(\s*['"`][\w.-]+['"`]/g) || []).length, 0);
  result[name] = { files: files.length, calls, left: list_.length, examples: list_ };
}

const basePath = path.join(__dirname, 'i18n-baseline.json');
if (process.argv.includes('--baseline')) {
  fs.writeFileSync(basePath, JSON.stringify(Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.left])), null, 2) + '\n');
}
const baseline = JSON.parse(fs.readFileSync(basePath, 'utf8'));

if (process.argv.includes('--write')) {
  const rows = Object.entries(result).map(([k, v]) => `| ${k} | ${v.files} | ${v.calls} | ${v.left} | ${((100 * v.left) / Math.max(1, v.left + v.calls)).toFixed(1)}% |`);
  const md = ['# Cobertura de tradução (gerado por `node shared/test/i18n-coverage.js --write`)', '',
    'Literais de interface em inglês fora de `t()`, por superfície. Heurística: ver o cabeçalho do teste.', '',
    '| Superfície | Arquivos | Chamadas `t()` | Literais em inglês | % pendente |', '|---|---|---|---|---|', ...rows, '',
    '## Pendentes', '', ...Object.entries(result).flatMap(([k, v]) => (v.left ? ['### ' + k, '', ...v.examples.map((e) => '- ' + e), ''] : []))].join('\n');
  fs.writeFileSync(path.join(root, 'docs', 'i18n-coverage.md'), md + '\n');
}

for (const [name, v] of Object.entries(result)) {
  assert.ok(name in baseline, 'sem teto em i18n-baseline.json para ' + name);
  assert.ok(v.left <= baseline[name], `${name}: ${v.left} literais em inglês, teto ${baseline[name]}\n` + v.examples.slice(0, 15).join('\n'));
}
console.log('i18n-coverage: ' + Object.entries(result).map(([k, v]) => `${k} ${v.left}/${baseline[k]}`).join(' · '));
