'use strict';
// The scripts of one page share a global lexical scope: a second top-level `const`/`let`/`class` with the
// same name is a SyntaxError and the whole script (a tab, a shared UI module) never loads. This caught
// several UI files that each declared `const tr = …` at the top level. Use `var` for a shared helper, or
// put it inside the file's IIFE / build().
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const pages = ['windows/app.html', 'linux/app.html', 'mac/control.html', 'windows/mesh/app.html', 'linux/mesh/app.html', 'mac/mesh/control.html'];
const errors = [];
for (const p of pages) {
  const dir = path.dirname(path.join(root, p));
  const html = fs.readFileSync(path.join(root, p), 'utf8');
  const seen = new Map();
  for (const m of html.matchAll(/<script src="([^"]+)"/g)) {
    if (/^https?:/.test(m[1])) continue;
    // the mesh pages are served from the app folder, so resolve against it, its parent and the repo root
    const file = [dir, path.dirname(dir), root].map((d) => path.resolve(d, m[1])).find((f) => fs.existsSync(f));
    if (!file) { errors.push(p + ': missing script ' + m[1]); continue; }
    const src = fs.readFileSync(file, 'utf8');
    for (const d of src.matchAll(/^(?:const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      const rel = path.relative(root, file);
      if (seen.has(d[1])) errors.push(`${p}: "${d[1]}" declared in ${rel} and ${seen.get(d[1])}`);
      else seen.set(d[1], rel);
    }
  }
}
assert.strictEqual(errors.length, 0, errors.slice(0, 30).join('\n'));
console.log('i18n-scope: ok');
