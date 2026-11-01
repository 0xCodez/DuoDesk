'use strict';
const assert = require('assert');
const i18n = require('../i18n.js');

// Teste 1: Chave básica em inglês padrão
i18n.setLanguage('en');
assert.strictEqual(i18n.t('sidebar.connected'), 'Connected');

// Teste 2: Alternância para pt-BR
i18n.setLanguage('pt-BR');
assert.strictEqual(i18n.t('nav.overview'), 'Visão Geral');

// Teste 3: Interpolação de parâmetros
assert.strictEqual(
  i18n.t('overview.waiting_allow', { name: 'Mac' }),
  'Aguardando Mac permitir…'
);

// Teste 4: Fallback para chave inexistente
assert.strictEqual(i18n.t('non.existent.key', null, 'Texto Fallback'), 'Texto Fallback');

// Teste 5: Listener de mudança de idioma
let changedTo = null;
const unsubscribe = i18n.onLanguageChange((lang) => { changedTo = lang; });
i18n.setLanguage('en');
assert.strictEqual(changedTo, 'en');
unsubscribe();

// Teste 6: Paridade de chaves entre en e pt-BR
const enKeys = Object.keys(require('../locales/en.js')());
const ptKeys = Object.keys(require('../locales/pt-BR.js')());
assert.deepStrictEqual(enKeys.sort(), ptKeys.sort(), 'Chaves en e pt-BR devem ser idênticas');

// Teste 7: cada {param} aparece igual nas duas línguas
const en = require('../locales/en.js')();
const pt = require('../locales/pt-BR.js')();
const tokens = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort().join();
for (const k of Object.keys(en)) assert.strictEqual(tokens(pt[k]), tokens(en[k]), 'parâmetros diferentes em ' + k);

// Teste 8: tokens sem valor ficam no texto (o UI.fill das telas os preenche depois)
i18n.setLanguage('pt-BR');
assert.strictEqual(i18n.t('sidebar.via', { name: 'Mac' }), 'via Mac');
assert.strictEqual(i18n.t('non.existent.key'), 'non.existent.key');
assert.strictEqual(i18n.t('files.on_peer', null), 'Em {name}');
assert.strictEqual(i18n.t('files.on_peer', { other: 1 }), 'Em {name}');
assert.strictEqual(i18n.t('phone.battery', { battery: 0 }), 'Bateria 0%');

// Teste 9: toda chave literal usada nas telas existe no dicionário
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const scanDirs = ['windows', 'linux', 'mac', 'shared', 'windows/mesh', 'linux/mesh', 'mac/mesh'];
const codeFiles = [];
for (const dir of ['windows', 'linux', 'mac', 'shared', 'windows/mesh', 'linux/mesh', 'mac/mesh']) {
  const dirPath = path.join(root, dir);
  if (!fs.existsSync(dirPath)) continue;
  for (const f of fs.readdirSync(dirPath)) if (/^(ui-.*|app|control|main|notifs|sidebar-model|pairpop|aurora-shell)\.js$/.test(f)) codeFiles.push(dir + '/' + f);
}
for (const f of codeFiles) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  for (const m of src.matchAll(/(?<![\w$])(?:t|tr|tt|tFn|UI\.t|UI\.tr)\(\s*'([a-z_]+\.[a-z_0-9-]+)'/g)) assert.ok(m[1] in en, f + ' usa a chave inexistente ' + m[1]);
}

// Parser auxiliar para chamadas t/tr/UI.t com parênteses balanceados
function parseCalls(src) {
  const calls = [];
  const re = /(?<![\w$])(UI\.t|UI\.tr|t|tr|tt|tFn)\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const fnName = m[1];
    let startIdx = m.index + m[0].length;
    let depthParen = 1;
    let depthBrace = 0;
    let depthBracket = 0;
    let inString = null;
    let escape = false;
    let args = [];
    let currentArg = '';

    for (let i = startIdx; i < src.length; i++) {
      const c = src[i];
      if (escape) { currentArg += c; escape = false; continue; }
      if (c === '\\') { currentArg += c; escape = true; continue; }
      if (inString) {
        currentArg += c;
        if (c === inString) inString = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { inString = c; currentArg += c; continue; }
      if (c === '{') depthBrace++;
      else if (c === '}') depthBrace--;
      else if (c === '[') depthBracket++;
      else if (c === ']') depthBracket--;
      else if (c === '(') depthParen++;
      else if (c === ')') {
        depthParen--;
        if (depthParen === 0) { args.push(currentArg.trim()); break; }
      } else if (c === ',' && depthParen === 1 && depthBrace === 0 && depthBracket === 0) {
        args.push(currentArg.trim());
        currentArg = '';
        continue;
      }
      currentArg += c;
    }
    if (args.length > 0) calls.push({ fnName, args });
  }
  return calls;
}

function unquoteLiteral(str) {
  if (!str) return null;
  str = str.trim();
  if ((str.startsWith("'") && str.endsWith("'") && !str.slice(1, -1).includes("' + ") && !str.slice(1, -1).includes('" + ')) ||
      (str.startsWith('"') && str.endsWith('"') && !str.slice(1, -1).includes("' + ") && !str.slice(1, -1).includes('" + '))) {
    return str.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
  }
  return null;
}

const fillTokens = new Set(['me', 'name', 'Name', 'the', 'There', 'there', 'them', 'Them']);

// Coletar todos os arquivos JS analisáveis
const allJsFiles = [];
for (const d of scanDirs) {
  const dirPath = path.join(root, d);
  if (!fs.existsSync(dirPath)) continue;
  for (const f of fs.readdirSync(dirPath)) {
    if (f.endsWith('.js') && !f.startsWith('.')) allJsFiles.push(path.join(dirPath, f));
  }
}

// Teste 10: Verificação de padrão em inglês (todo t literal deve bater com en.js)
for (const f of allJsFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const calls = parseCalls(src);
  for (const c of calls) {
    const rawKey = unquoteLiteral(c.args[0]);
    if (!rawKey || !(rawKey in en)) continue;
    const rawDefault = unquoteLiteral(c.args[2]);
    if (rawDefault !== null) {
      assert.strictEqual(rawDefault, en[rawKey], `Padrão em inglês divergente em ${path.relative(root, f)} para chave ${rawKey}`);
    }
  }
}

// Teste 11: Verificação de parâmetros (toda chave com {x} recebe x, exceto fillTokens)
for (const f of allJsFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const calls = parseCalls(src);
  for (const c of calls) {
    const rawKey = unquoteLiteral(c.args[0]);
    if (!rawKey || !(rawKey in en)) continue;
    const paramArg = c.args[1] || null;
    const neededParams = (en[rawKey].match(/\{(\w+)\}/g) || []).map(p => p.slice(1, -1));
    for (const p of neededParams) {
      if (fillTokens.has(p)) continue;
      assert.ok(paramArg && paramArg !== 'null' && paramArg !== 'undefined' && paramArg !== '{}',
        `Parâmetro {${p}} ausente no ponto de chamada em ${path.relative(root, f)} para chave ${rawKey}`);
    }
  }
}

// Teste 12: Verificação de chaves órfãs (todas as chaves do dicionário devem ter referência no projeto)
const projectDirs = ['windows', 'linux', 'mac', 'shared', 'website', 'android'];
const textSources = [];
function collectTexts(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return;
  for (const f of fs.readdirSync(full)) {
    const p = path.join(full, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'build') collectTexts(path.relative(root, p));
    } else if (/\.(js|html|kt|xml)$/.test(f)) {
      textSources.push(fs.readFileSync(p, 'utf8'));
    }
  }
}
for (const d of projectDirs) collectTexts(d);
const mergedText = textSources.join('\n');

for (const k of Object.keys(en)) {
  if (k === 'lang.name') continue;
  // Se for chave nav.*, pode ser chamada dinamicamente por 'nav.' + id
  if (k.startsWith('nav.')) continue;
  assert.ok(mergedText.includes(k), `Chave órfã detectada no dicionário: ${k}`);
}

console.log('i18n: ok');
