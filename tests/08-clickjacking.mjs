// Regression tests for the second security review (commit da60e20):
// clickjacking of destructive controls, and workflow action pinning.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let pass = 0, fail = 0;
const ok  = (n) => { console.log('  PASS  ' + n); pass++; };
const bad = (n, e) => { console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); fail++; };

const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const APP_PORT = 8095, EVIL_PORT = 8096;

const appSrv = createServer(async (q, s) => {
  try {
    let p = new URL(q.url, 'http://x').pathname;
    if (p === '/') p = '/companion.html';
    const b = await readFile(join(ROOT, p));
    s.writeHead(200, { 'Content-Type': T[extname(p)] || 'text/plain', 'Cache-Control': 'no-store' }).end(b);
  } catch { s.writeHead(404).end('nf'); }
});
// sandbox blocks top-navigation, which is the case the guard must survive.
const evilPage = (target) => `<!doctype html><title>evil</title>
<iframe id="f" sandbox="allow-scripts allow-same-origin"
        src="http://127.0.0.1:${APP_PORT}/${target}" style="width:1200px;height:800px"></iframe>`;
let evilTarget = 'companion.html';
const evilSrv = createServer((q, s) =>
  s.writeHead(200, { 'Content-Type': 'text/html' }).end(evilPage(evilTarget)));

await new Promise(r => appSrv.listen(APP_PORT, '127.0.0.1', r));
await new Promise(r => evilSrv.listen(EVIL_PORT, '127.0.0.1', r));

const browser = await chromium.launch();

const seedCompanion = (page) => page.evaluate(() => {
  localStorage.setItem('cozyCompanion', JSON.stringify({
    lessons: { '1-1': { completed: true, stars: 3 } },
    sessions: [{ date: '2026-08-04', duration: 1800, notes: 'KEEP-ME' }],
    streak: { current: 4, best: 9, lastDate: '2026-08-04' },
    settings: { onboarded: true, volume: 50, activeSounds: [], theme: 'light' },
    timer: { startedAt: null, accumulated: 0, running: false, paused: false, notes: '' },
  }));
});

// ── Framed companion: session delete must be refused ──
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${APP_PORT}/companion.html`, { waitUntil: 'networkidle' });
  await seedCompanion(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  evilTarget = 'companion.html';
  const evil = await ctx.newPage();
  evil.on('dialog', d => d.accept());        // even if a confirm appears, accept it
  await evil.goto(`http://localhost:${EVIL_PORT}/`, { waitUntil: 'networkidle' });
  await evil.waitForTimeout(2000);

  const f = evil.frames().find(fr => fr.url().includes('companion.html'));
  if (!f) { bad('companion loads in a frame at all (test setup)'); }
  else {
    const framedFlag = await f.evaluate(() => (typeof isFramed !== 'undefined') ? isFramed : null).catch(() => null);
    framedFlag === true ? ok('companion detects it is framed') : bad('companion detects it is framed', String(framedFlag));

    await f.locator('button[data-tab="sessie"]').click().catch(() => {});
    await evil.waitForTimeout(400);
    const before = await f.evaluate(() => JSON.parse(localStorage.getItem('cozyCompanion')).sessions.length).catch(() => -1);
    await f.locator('.session-del').first().click().catch(() => {});
    await evil.waitForTimeout(700);
    const after = await f.evaluate(() => JSON.parse(localStorage.getItem('cozyCompanion')).sessions.length).catch(() => -1);
    after === before && after > 0
      ? ok(`framed session delete refused (${before} sessions intact)`)
      : bad('framed session delete refused', `${before} -> ${after}`);
  }
  await ctx.close();
}

// ── Framed draw app: clear must be refused ────────────
{
  const ctx = await browser.newContext();
  evilTarget = 'index.html';
  const evil = await ctx.newPage();
  evil.on('dialog', d => d.accept());
  await evil.goto(`http://localhost:${EVIL_PORT}/`, { waitUntil: 'networkidle' });
  await evil.waitForTimeout(2500);

  const f = evil.frames().find(fr => fr.url().includes('index.html'));
  if (!f) { bad('draw app loads in a frame at all (test setup)'); }
  else {
    const framedFlag = await f.evaluate(() => (typeof isFramed !== 'undefined') ? isFramed : null).catch(() => null);
    framedFlag === true ? ok('draw app detects it is framed') : bad('draw app detects it is framed', String(framedFlag));
    // Put ink on the canvas, then try to clear it through the frame.
    await f.evaluate(() => { drawStroke(40, 40, 300, 260); saveState(); }).catch(() => {});
    await evil.waitForTimeout(300);
    const inkBefore = await f.evaluate(() => {
      const c = document.getElementById('drawing-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n++;
      return n;
    }).catch(() => -1);
    await f.locator('#btn-clear').click().catch(() => {});
    await evil.waitForTimeout(600);
    const inkAfter = await f.evaluate(() => {
      const c = document.getElementById('drawing-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n++;
      return n;
    }).catch(() => -1);
    inkBefore > 0 && inkAfter === inkBefore
      ? ok(`framed clear refused (${inkBefore} ink px intact)`)
      : bad('framed clear refused', `${inkBefore} -> ${inkAfter}`);
  }
  await ctx.close();
}

// ── Unframed: destructive actions still work ──────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let sawConfirm = false;
  page.on('dialog', d => { sawConfirm = true; d.accept(); });
  await page.goto(`http://127.0.0.1:${APP_PORT}/companion.html`, { waitUntil: 'networkidle' });
  await seedCompanion(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const framed = await page.evaluate(() => isFramed);
  framed === false ? ok('top-level page is not treated as framed') : bad('top-level page is not treated as framed');

  await page.click('button[data-tab="sessie"]');
  await page.waitForTimeout(300);
  await page.click('.session-del');
  await page.waitForTimeout(600);
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('cozyCompanion')).sessions.length);
  sawConfirm ? ok('session delete asks for confirmation') : bad('session delete asks for confirmation');
  left === 0 ? ok('confirmed delete still works unframed') : bad('confirmed delete still works unframed', 'left=' + left);
  await ctx.close();
}

// ── Cancelling the confirmation keeps the session ─────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss());
  await page.goto(`http://127.0.0.1:${APP_PORT}/companion.html`, { waitUntil: 'networkidle' });
  await seedCompanion(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('button[data-tab="sessie"]');
  await page.waitForTimeout(300);
  await page.click('.session-del');
  await page.waitForTimeout(600);
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('cozyCompanion')).sessions.length);
  left === 1 ? ok('cancelling the confirmation keeps the session') : bad('cancelling keeps the session', 'left=' + left);
  await ctx.close();
}

// ── Workflow: every action pinned to a full SHA ───────
{
  const wf = readFileSync(join(ROOT, '.github/workflows/static.yml'), 'utf8');
  const uses = [...wf.matchAll(/uses:\s*(\S+)/g)].map(m => m[1]);
  const unpinned = uses.filter(u => !/@[0-9a-f]{40}$/.test(u));
  uses.length > 0 && unpinned.length === 0
    ? ok(`all ${uses.length} workflow actions pinned to a commit SHA`)
    : bad('all workflow actions pinned to a commit SHA', unpinned.join(', ') || 'no uses: found');

  let dep = '';
  try { dep = readFileSync(join(ROOT, '.github/dependabot.yml'), 'utf8'); } catch {}
  /github-actions/.test(dep)
    ? ok('dependabot watches the pinned actions') : bad('dependabot watches the pinned actions');
}

await browser.close();
appSrv.close(); evilSrv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
