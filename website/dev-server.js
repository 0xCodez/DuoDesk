// Local stand-in for Vercel: serves the static site with the headers from vercel.json (so the CSP is
// tested too) and runs api/*.js the way Vercel does. Not deployed (.vercelignore).
//   DASHBOARD_PASSWORD=test node dev-server.js   ->   http://localhost:5320/dashboard
// Without Upstash env vars the API uses the in-memory store, which empties when the server stops.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 5320;
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

// vercel.json "source" patterns here are simple enough to read as anchored regular expressions.
// HSTS and upgrade-insecure-requests only make sense over https, so they're left out on localhost.
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rules = (config.headers || []).map((r) => ({ re: new RegExp(`^${r.source}$`), headers: r.headers }));
function applyHeaders(res, pathname) {
  for (const rule of rules) {
    if (!rule.re.test(pathname)) continue;
    for (const { key, value } of rule.headers) {
      if (/^strict-transport-security$/i.test(key)) continue;
      res.setHeader(key, /^content-security-policy$/i.test(key) ? value.replace(/;?\s*upgrade-insecure-requests/, '') : value);
    }
  }
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    applyHeaders(res, url.pathname);
    const api = url.pathname.match(/^\/api\/([a-z]+)$/);
    if (api) {
      const file = path.join(root, 'api', `${api[1]}.js`);
      if (!fs.existsSync(file)) {
        res.statusCode = 404;
        return res.end();
      }
      const { default: handler } = await import(pathToFileURL(file).href);
      try {
        return await handler(req, res);
      } catch (err) {
        console.error(err);
        res.statusCode = 500;
        return res.end();
      }
    }
    // cleanUrls: /dashboard -> dashboard.html
    let file = path.join(root, decodeURIComponent(url.pathname));
    const rel = path.relative(root, file).replace(/\\/g, '/');
    // like the deploy: no files outside the site, no function sources, no local env or Vercel link
    if (!rel.startsWith('..') && !/^(api\/|partials\/|\.env|\.vercel|dev-server\.js|package\.json)/.test(rel)) {
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      else if (!path.extname(file)) file += '.html';
      if (fs.existsSync(file)) {
        res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
        return fs.createReadStream(file).pipe(res);
      }
    }
    res.statusCode = 404;
    res.setHeader('content-type', types['.html']);
    fs.createReadStream(path.join(root, '404.html')).pipe(res);
  })
  .listen(port, () => console.log(`http://localhost:${port}`));
