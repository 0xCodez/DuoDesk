// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Firewall self-check (phase 6): the network must be Private, an enabled inbound allow rule for
// this electron.exe must cover it, and no block rule may apply. Fix adds the rule (and makes the
// LAN Private) with one elevated PowerShell (one UAC prompt).
// Portions adapted from Beamer (https://github.com/kalkman-code/beamer), Copyright (C) Kalkman Code,
// GPL-3.0. Changed: JS port of win_app/firewall_win.py (status script + interpret), simplified to
// one program rule and no ports.
const { execFile } = require('child_process');
const path = require('path');

const PS = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function powershell(script, timeoutMs = 60000) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve, reject) => {
    execFile(PS, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => (err ? reject(new Error(String(stderr || err.message).trim().split('\n')[0])) : resolve(String(stdout))));
  });
}

const statusScript = (exe) => `
$ErrorActionPreference = 'SilentlyContinue'
$exe = ${q(exe)}
$rules = @()
foreach ($f in @(Get-NetFirewallApplicationFilter | Where-Object { $_.Program -eq $exe })) {
  $r = $f | Get-NetFirewallRule
  if ([string]$r.Direction -ne 'Inbound') { continue }
  $pf = $r | Get-NetFirewallPortFilter
  $rules += [pscustomobject]@{ enabled = [string]$r.Enabled; action = [string]$r.Action; profile = [string]$r.Profile; protocol = [string]$pf.Protocol }
}
$nets = @(Get-NetConnectionProfile | ForEach-Object {
  [pscustomobject]@{ alias = $_.InterfaceAlias; index = [int]$_.InterfaceIndex; category = [string]$_.NetworkCategory; ipv4 = [string]$_.IPv4Connectivity }
})
[pscustomobject]@{ rules = @($rules); networks = $nets } | ConvertTo-Json -Depth 4 -Compress
`;

const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const profilesOf = (s) => (/any/i.test(s) || !s ? null : String(s).split(/,\s*/));
const touches = (set, wanted) => set === null || wanted.some((w) => set.includes(w));

// Same reading as Beamer's interpret(): a block rule on a connected profile wins over allows.
function interpret(payload) {
  const rules = arr(payload.rules).filter((r) => /true/i.test(r.enabled) && /^(any|udp)$/i.test(r.protocol || 'Any'));
  const nets = arr(payload.networks);
  // The LAN is the internet-connected interface(s); else every connected one.
  const lan = nets.some((n) => /internet/i.test(n.ipv4)) ? nets.filter((n) => /internet/i.test(n.ipv4)) : nets;
  const lanProfiles = [...new Set(lan.map((n) => n.category).filter(Boolean))];
  const active = [...new Set(nets.map((n) => n.category).filter(Boolean))];
  const allows = rules.filter((r) => /allow/i.test(r.action)).map((r) => profilesOf(r.profile));
  const blocks = rules.filter((r) => /block/i.test(r.action)).map((r) => profilesOf(r.profile));
  const blocked = blocks.some((p) => touches(p, active.length ? active : ['Domain', 'Private', 'Public']));
  const covered = allows.length > 0 && lanProfiles.every((name) => allows.some((p) => touches(p, [name])));
  const publicNets = lan.filter((n) => n.category === 'Public').map((n) => ({ index: n.index, alias: n.alias }));
  let message = 'OK — the network is Private and MacShare is allowed through the firewall.';
  if (!lan.length) message = 'No network connection.';
  else if (publicNets.length) message = 'The network "' + publicNets[0].alias + '" is Public, so Windows blocks the Mac’s broadcasts.';
  else if (blocked) message = 'A Windows Firewall rule blocks MacShare.';
  else if (!covered) message = 'MacShare isn’t allowed through Windows Firewall on this network.';
  return { ok: lan.length > 0 && !publicNets.length && !blocked && covered, message, publicNets, blocked, covered };
}

async function check(exe = process.execPath) {
  try {
    return { ...interpret(JSON.parse(await powershell(statusScript(exe)) || '{}')), checkedAt: Date.now() };
  } catch (e) {
    return { ok: false, message: 'Couldn’t check the firewall: ' + e.message, error: true, checkedAt: Date.now() };
  }
}

// One elevated PowerShell: make Public LAN interfaces Private, remove our block rules, add the allow rule.
async function fix(status, exe = process.execPath) {
  const lines = ["$ErrorActionPreference = 'Continue'"];
  for (const n of (status && status.publicNets) || []) lines.push('Set-NetConnectionProfile -InterfaceIndex ' + Number(n.index) + ' -NetworkCategory Private');
  if (status && status.blocked) {
    lines.push('$b = @(Get-NetFirewallApplicationFilter | Where-Object { $_.Program -eq ' + q(exe) + ' } | Get-NetFirewallRule | Where-Object { [string]$_.Action -eq \'Block\' -and [string]$_.Direction -eq \'Inbound\' })');
    lines.push('if ($b.Count -gt 0) { $b | Remove-NetFirewallRule }');
  }
  lines.push('netsh advfirewall firewall delete rule name="MacShare" program=' + JSON.stringify(exe) + ' | Out-Null');
  lines.push('netsh advfirewall firewall add rule name="MacShare" dir=in action=allow program=' + JSON.stringify(exe) + ' profile=private enable=yes | Out-Null');
  const inner = Buffer.from(lines.join('\n'), 'utf16le').toString('base64');
  const outer = "Start-Process -FilePath " + q(PS) + " -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','" + inner + "'";
  await powershell(outer, 120000); // throws if the UAC prompt is declined
  return check(exe);
}

module.exports = { check, fix, interpret };
