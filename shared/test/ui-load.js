'use strict';
// Smoke test: every page loads its classic scripts, in order, into one shared global scope against a
// stub DOM, and none throws while loading (a redeclared const, a helper used before it exists...).
// Build/render functions are not run; that needs a real window.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const pages = ['windows/app.html', 'linux/app.html', 'mac/control.html', 'windows/mesh/app.html', 'linux/mesh/app.html', 'mac/mesh/control.html'];

// A value that answers every property, call and construction, so top-level setup code runs.
function stub() {
  const f = function () {};
  const p = new Proxy(f, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'then' ? undefined : p),
    set: () => true,
    apply: () => p,
    construct: () => p,
    has: () => true,
  });
  return p;
}

const errors = [];
for (const page of pages) {
  const dir = path.dirname(path.join(root, page));
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    requestAnimationFrame() { return 0; }, addEventListener() {}, matchMedia: () => stub(),
    navigator: { language: 'pt-BR', userAgent: '', platform: '' }, localStorage: { getItem: () => null, setItem() {} },
    document: stub(), location: { reload() {}, href: '' }, MutationObserver: function () { return { observe() {}, disconnect() {} }; },
    ResizeObserver: function () { return { observe() {}, disconnect() {} }; }, IntersectionObserver: function () { return { observe() {}, disconnect() {} }; },
    CustomEvent: function () { return stub(); }, getComputedStyle: () => stub(), CSS: { supports: () => false }, Image: function () { return stub(); },
    // the preload bridge
    twin: stub(), api: stub(), macshare: stub(), duodesk: stub(),
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const m of html.matchAll(/<script src="([^"]+)"/g)) {
    if (/^https?:/.test(m[1])) continue;
    const file = [dir, path.dirname(dir), root].map((d) => path.resolve(d, m[1])).find((f) => fs.existsSync(f));
    if (!file) continue;
    try {
      vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
    } catch (e) {
      // a stub-only failure (the page's own code poking a missing browser API) is not what this test is for
      if (e instanceof SyntaxError || /already been declared|is not defined|before initialization/.test(e.message)) {
        errors.push(`${page}: ${path.relative(root, file)}: ${e.name}: ${e.message}`);
      }
    }
  }
  // Build every registered tab once: a helper used before its `const`, or a name that no longer exists
  const UI = vm.runInContext('typeof UI !== "undefined" ? UI : null', sandbox);
  if (UI && UI.tabs) {
    for (const def of UI.tabs) {
      try { def.build(stub(), stub()); } catch (e) {
        if (e instanceof ReferenceError) errors.push(`${page}: tab ${def.id}: ${e.name}: ${e.message}`);
      }
    }
  }
}
assert.strictEqual(errors.length, 0, errors.slice(0, 30).join('\n'));
console.log('ui-load: ok (' + pages.length + ' pages)');
