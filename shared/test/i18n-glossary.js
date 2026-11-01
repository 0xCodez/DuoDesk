'use strict';
// Forbidden terms of docs/i18n-glossary.md in every pt-BR text (desktop, Android, website).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const FORBIDDEN = [
  [/emparelh/i, 'emparelhar → parear'],
  [/\bapps?\b/i, 'app → aplicativo'],
  // "ligado a/em" (connected, plugged in) is fine; a feature state is "ativado/desativado"
  [/\b(desligad[oa]s?|deslig(ar|ue)|ligar|ligad[oa]s?(?! (a|ao|à|em)\b))/i, 'ligar/desligar → ativar/desativar'],
  [/\bcelular(es)?\b|smartphone/i, 'celular → telefone'],
  [/clipboard/i, 'clipboard → área de transferência'],
  [/\bdebug/i, 'debug → depuração'],
  [/hotspot/i, 'hotspot → ponto de acesso'],
  [/\bwireless\b/i, 'wireless → sem fio'],
  [/\b(tu|teu|tua|teus|tuas)\b/i, 'tu/teu → você/seu'],
];
// the last one quotes an English command that the assistant bar understands
const EXCEPT = [/desligar o computador/i, /\bLigar\b/, /“turn on clipboard”/];

const texts = [];
const dict = require('../locales/pt-BR.js')();
for (const [k, v] of Object.entries(dict)) texts.push(['desktop ' + k, v]);
const xml = fs.readFileSync(path.join(root, 'android/app/src/main/res/values-pt-rBR/strings.xml'), 'utf8');
for (const m of xml.matchAll(/<string name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g)) texts.push(['android ' + m[1], m[2]]);
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [[p + k, v]] : flat(v, p + k + '.')));
for (const [k, v] of flat(JSON.parse(fs.readFileSync(path.join(root, 'website/locales/pt-BR.json'), 'utf8')))) texts.push(['site ' + k, v]);

const bad = [];
for (const [where, text] of texts) {
  if (EXCEPT.some((re) => re.test(text))) continue;
  const plain = text.replace(/\{\w+\}|%\d\$[sd]/g, ' ');
  for (const [re, hint] of FORBIDDEN) if (re.test(plain)) bad.push(where + ' [' + hint + ']: ' + text.slice(0, 80));
}
assert.strictEqual(bad.length, 0, 'termos fora do glossário:\n' + bad.slice(0, 40).join('\n') + (bad.length > 40 ? '\n… +' + (bad.length - 40) : ''));
console.log('i18n-glossary: ok (' + texts.length + ' textos)');
