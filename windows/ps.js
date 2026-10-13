// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Run PowerShell scripts: normally, or elevated (one UAC prompt, waits for it to finish). Scripts
// go in as -EncodedCommand so nothing needs quoting.
const { execFile } = require('child_process');
const path = require('path');

const PS = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"; // PowerShell single-quoted literal
const encode = (script) => Buffer.from(script, 'utf16le').toString('base64');

// Started from a PowerShell 7 terminal, PSModulePath lists PowerShell 7's modules first and
// Windows PowerShell 5.1 then loads the wrong PKI/NetSecurity modules. Without it, 5.1 uses its own.
const env = { ...process.env };
delete env.PSModulePath;

function run(script, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    execFile(PS, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encode(script)],
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env },
      (err, stdout, stderr) => (err ? reject(new Error(String(stderr || err.message).trim().split('\n')[0])) : resolve(String(stdout))));
  });
}

// Elevated: throws if the UAC prompt is declined. The script's errors can't be read back
// directly, so callers re-check the state afterwards.
function runElevated(script, timeoutMs = 120000) {
  const outer = 'Start-Process -FilePath ' + q(PS) + " -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','" + encode(script) + "'";
  return run(outer, timeoutMs);
}

module.exports = { run, runElevated, q, PS };
