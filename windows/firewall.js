// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Portions adapted from Beamer (https://github.com/kalkman-code/beamer), Copyright (C) Kalkman Code,
// GPL-3.0. Changed: JS port of win_app/firewall_win.py (status script + interpret), simplified to
// one program rule and no ports.
// Firewall self-check: the network must be Private, an enabled inbound allow rule for
// this electron.exe must cover it, and no block rule may apply. Fix adds the rule (and makes the
// LAN Private) with one elevated PowerShell (one UAC prompt).
const { run: powershell, runElevated, q } = require('./ps');

const statusScript = (exe) => `
$ErrorActionPreference = 'SilentlyContinue'
$exe = ${q(exe)}
$rules = @()
$readable = $true
try {
  foreach ($f in @(Get-NetFirewallApplicationFilter -ErrorAction Stop | Where-Object { $_.Program -eq $exe })) {
    $r = $f | Get-NetFirewallRule
    if ([string]$r.Direction -ne 'Inbound') { continue }
    $pf = $r | Get-NetFirewallPortFilter
    $rules += [pscustomobject]@{ enabled = [string]$r.Enabled; action = [string]$r.Action; profile = [string]$r.Profile; protocol = [string]$pf.Protocol }
  }
} catch { $readable = $false }
# A member of Administrators (even unelevated) gets a Yes/No prompt; anyone else needs an admin's password.
$admin = [bool](([Security.Principal.WindowsIdentity]::GetCurrent()).Groups | Where-Object { $_.Value -eq 'S-1-5-32-544' })
$nets = @(Get-NetConnectionProfile | ForEach-Object {
  [pscustomobject]@{ alias = $_.InterfaceAlias; index = [int]$_.InterfaceIndex; category = [string]$_.NetworkCategory; ipv4 = [string]$_.IPv4Connectivity }
})
[pscustomobject]@{ rules = @($rules); networks = $nets; readable = $readable; admin = $admin } | ConvertTo-Json -Depth 4 -Compress
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
  // Rules a standard account can't read (some managed PCs): the installer added them, so trust it
  // rather than ask for a Fix that account can't do.
  const unread = payload.readable === false;
  const covered = unread || (allows.length > 0 && lanProfiles.every((name) => allows.some((p) => touches(p, [name]))));
  // A Public network only matters when no allow rule covers Public (the installer's rule does).
  const publicNets = lan.filter((n) => n.category === 'Public' && !unread && !allows.some((p) => touches(p, ['Public']))).map((n) => ({ index: n.index, alias: n.alias }));
  let message = 'OK';
  if (!lan.length) message = 'No network connection.';
  else if (publicNets.length) message = 'The network "' + publicNets[0].alias + '" is Public, so Windows blocks {name}’s broadcasts.';
  else if (blocked) message = 'A Windows Firewall rule blocks TwinDesk.';
  else if (!covered) message = 'TwinDesk isn’t allowed through Windows Firewall on this network.';
  return { ok: lan.length > 0 && !publicNets.length && !blocked && covered, message, publicNets, blocked, covered, admin: payload.admin !== false, unread };
}

async function check(exe = process.execPath) {
  try {
    return { ...interpret(JSON.parse(await powershell(statusScript(exe)) || '{}')), checkedAt: Date.now() };
  } catch (e) {
    return { ok: false, message: 'Couldn’t check the firewall: ' + e.message, error: true, checkedAt: Date.now() };
  }
}

// One elevated PowerShell: make Public LAN interfaces Private, remove our block rules, add the allow rule.
// The rules cover every profile, so a Public network works too (TwinDesk's link is TLS, pinned to
// the pair, and a new pairing needs Allow on both sides); networks are still made Private when we
// can, for the shared folder. Needs an administrator: a standard account's UAC prompt asks for an
// admin's password, and declining it (or not having one) says so.
async function fix(status, exe = process.execPath) {
  const lines = ["$ErrorActionPreference = 'Continue'"];
  for (const n of (status && status.publicNets) || []) lines.push('Set-NetConnectionProfile -InterfaceIndex ' + Number(n.index) + ' -NetworkCategory Private');
  if (status && status.blocked) {
    lines.push('$b = @(Get-NetFirewallApplicationFilter | Where-Object { $_.Program -eq ' + q(exe) + ' } | Get-NetFirewallRule | Where-Object { [string]$_.Action -eq \'Block\' -and [string]$_.Direction -eq \'Inbound\' })');
    lines.push('if ($b.Count -gt 0) { $b | Remove-NetFirewallRule }');
  }
  lines.push('netsh advfirewall firewall delete rule name="MacShare" | Out-Null'); // the app's old name
  lines.push('netsh advfirewall firewall delete rule name="MacShare (TCP 47800)" | Out-Null');
  lines.push('netsh advfirewall firewall delete rule name="TwinDesk" program=' + JSON.stringify(exe) + ' | Out-Null');
  lines.push('netsh advfirewall firewall add rule name="TwinDesk" dir=in action=allow program=' + JSON.stringify(exe) + ' profile=any enable=yes | Out-Null');
  // This PC also listens (PC ↔ PC host), so the port gets its own rule.
  lines.push('netsh advfirewall firewall delete rule name="TwinDesk (TCP 47800)" | Out-Null');
  lines.push('netsh advfirewall firewall add rule name="TwinDesk (TCP 47800)" dir=in action=allow protocol=TCP localport=47800 program=' + JSON.stringify(exe) + ' profile=any enable=yes | Out-Null');
  try {
    await runElevated(lines.join('\n')); // throws if the UAC prompt is declined
  } catch (e) {
    if (status && status.admin === false) throw new Error('it needs an administrator’s password. Ask someone with one to click Fix, or to reinstall TwinDesk (the installer adds the rule)');
    throw e;
  }
  return check(exe);
}

module.exports = { check, fix, interpret };
