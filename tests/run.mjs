// Runs every suite against a throwaway static server.
//
//   npx playwright install chromium   # once
//   node tests/run.mjs
//
// Set COZY_URL to test an already-running server (e.g. a deploy preview)
// and no local server is started.

import { spawn } from 'child_process';
import { readdirSync } from 'fs';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TESTS = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.COZY_PORT || 8087);
const external = Boolean(process.env.COZY_URL);
const base = process.env.COZY_URL || `http://127.0.0.1:${PORT}`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

let server;
if (!external) {
  server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, base).pathname);
      if (p === '/') p = '/companion.html';
      const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Service-Worker-Allowed': '/',
      }).end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', resolve);
  });
  console.log(`serving ${ROOT} on ${base}\n`);
}

const suites = readdirSync(TESTS).filter(f => /^\d\d-.*\.mjs$/.test(f)).sort();
let failed = 0;

for (const suite of suites) {
  console.log('── ' + suite);
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, [join(TESTS, suite)], {
      stdio: 'inherit',
      env: { ...process.env, COZY_URL: base },
    });
    child.on('exit', resolve);
  });
  if (code !== 0) failed++;
  console.log();
}

if (server) server.close();
console.log(failed ? `${failed} suite(s) failed` : `all ${suites.length} suites passed`);
process.exit(failed ? 1 : 0);
