// TwinDesk — Copyright (C) 2026 inukaasith, Erdoğan Yeşil. GPL-3.0, see LICENSE.
// Multi-device settings: ../settings.js as it is, plus what only the mesh uses (the cursor edges, the
// shared layout and Join every device automatically). Loaded with Multi-device on only; the one-to-one
// app never sees these keys.
const base = require('../settings.js');
const E = require('../../shared/kvm-edges.js');
const L = require('../../shared/layout.js');

const bool = (v, d) => (typeof v === 'boolean' ? v : d);

function normalize(s) {
  s = s || {};
  const out = base.normalize(s);
  const kvm = s.kvm || {};
  const ms = s.mesh || {};
  out.kvm.edges = E.normalizeEdges(kvm.edges); // each side of this screen -> the paired device behind it (shared/kvm-edges.js)
  out.layout = storedLayout(s.layout); // the mesh's shared layout (mesh/layout-sync.js); null until one was edited
  // Joining everyone (docs/mesh.md): off until switched on in the Multi-device tab, as it lets a paired
  // device add others to this computer without a pairing code.
  out.mesh = { autoJoin: bool(ms.autoJoin, false) };
  return out;
}

// The stored shared layout: a valid layout with at least one edit (rev >= 1), else null.
function storedLayout(v) {
  const l = L.normalize(v);
  return l.rev > 0 ? l : null;
}

// Settings from before the edges (kvm.pcSide): with exactly one paired device, its edge is set.
// Returns true when settings changed (the caller saves). pcSide stays for the one-to-one app.
function migrateKvm(settings, deviceIds) {
  const k = settings.kvm;
  const next = E.migrateEdges(k, deviceIds);
  if (JSON.stringify(next) === JSON.stringify(E.normalizeEdges(k.edges))) return false;
  settings.kvm = { ...k, edges: next };
  return true;
}

module.exports = { normalize, apply: base.apply, migrateKvm };
