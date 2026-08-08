// Regression tests for the four findings in the security review of
// commit 1180811. Each test fails if the corresponding fix is reverted.
import { chromium } from 'playwright';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const BASE = process.env.COZY_URL || 'http://127.0.0.1:8087';
const APP_URL = BASE + '/companion.html';
let pass = 0, fail = 0;
const ok  = (n) => { console.log('  PASS  ' + n); pass++; };
const bad = (n, e) => { console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); fail++; };

const TMP = mkdtempSync(join(tmpdir(), 'cozy-sec-'));
const writeBackup = (name, obj) => {
  const p = join(TMP, name);
  writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return p;
};

const browser = await chromium.launch();

const freshPage = async (ctx) => {
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('cozyCompanion') || '{}');
    s.settings = Object.assign(s.settings || {}, { onboarded: true });
    s.sessions = [{ date: '2026-08-01', duration: 60, notes: '' }];
    localStorage.setItem('cozyCompanion', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  return page;
};

// ── Finding 3: stored XSS through a crafted backup ───
{
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await freshPage(ctx);

  const PAYLOAD = `<img src=x onerror="window.__PWNED=(window.__PWNED||0)+1">`;
  const file = writeBackup('evil.json', {
    app: 'cozy-companion', version: 1,
    state: {
      lessons: { '1-1': { completed: true, stars: PAYLOAD }, [PAYLOAD]: { completed: true, stars: 3 } },
      sessions: [{ date: PAYLOAD, duration: PAYLOAD, notes: PAYLOAD }],
      streak: { current: PAYLOAD, best: PAYLOAD, lastDate: PAYLOAD },
      settings: { onboarded: true, theme: PAYLOAD, volume: PAYLOAD, activeSounds: [PAYLOAD] },
    },
  });

  await page.setInputFiles('#dash-import-file', file);
  await page.waitForTimeout(2500);

  const pwned = await page.evaluate(() => window.__PWNED || 0);
  pwned === 0 ? ok('crafted backup does not execute script') : bad('crafted backup does not execute script', `fired ${pwned}x`);

  const stored = await page.evaluate(() => localStorage.getItem('cozyCompanion') || '');
  !stored.includes('<img') ? ok('payload is not persisted to storage') : bad('payload is not persisted to storage');

  // The schema should have dropped every malformed value.
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('cozyCompanion')));
  typeof st.streak.current === 'number' && typeof st.streak.best === 'number'
    ? ok('streak counters coerced to numbers') : bad('streak counters coerced to numbers', JSON.stringify(st.streak));
  st.streak.lastDate === null ? ok('invalid date rejected') : bad('invalid date rejected', String(st.streak.lastDate));
  st.sessions.length === 0 ? ok('session with invalid date dropped') : bad('session with invalid date dropped', JSON.stringify(st.sessions));
  Object.keys(st.lessons).every(k => /^\d+-\d+$/.test(k))
    ? ok('unknown lesson ids dropped') : bad('unknown lesson ids dropped', Object.keys(st.lessons).join(','));
  st.lessons['1-1'] && st.lessons['1-1'].stars === 0
    ? ok('non-numeric stars clamped') : bad('non-numeric stars clamped', JSON.stringify(st.lessons['1-1']));
  ['auto', 'light', 'dark'].includes(st.settings.theme)
    ? ok('theme restricted to known values') : bad('theme restricted to known values', String(st.settings.theme));
  st.settings.activeSounds.length === 0
    ? ok('unknown sound ids dropped') : bad('unknown sound ids dropped', JSON.stringify(st.settings.activeSounds));

  await ctx.close();
}

// ── Finding 3b: a legitimate backup still imports ────
{
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await freshPage(ctx);
  const file = writeBackup('good.json', {
    app: 'cozy-companion', version: 1,
    state: {
      lessons: { '1-1': { completed: true, stars: 3 }, '1-2': { completed: true, stars: 2 } },
      sessions: [{ date: '2026-08-04', duration: 1800, notes: 'blending' }],
      streak: { current: 4, best: 9, lastDate: '2026-08-04' },
      settings: { onboarded: true, theme: 'dark', volume: 70, activeSounds: ['rain'] },
    },
  });
  await page.setInputFiles('#dash-import-file', file);
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('cozyCompanion')));
  const good = Object.keys(st.lessons).length === 2 && st.sessions.length === 1 &&
               st.streak.best === 9 && st.settings.theme === 'dark' &&
               st.settings.activeSounds.includes('rain');
  good ? ok('valid backup still imports intact') : bad('valid backup still imports intact', JSON.stringify(st).slice(0, 200));
  await ctx.close();
}

// ── Finding 4: oversized backup rejected before parsing ──
{
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await freshPage(ctx);
  const before = await page.evaluate(() => localStorage.getItem('cozyCompanion'));
  // ~6MB, over the 5MB bound.
  const huge = '{"lessons":{},"sessions":[],"pad":"' + 'A'.repeat(6 * 1024 * 1024) + '"}';
  const file = writeBackup('huge.json', huge);
  const t0 = Date.now();
  await page.setInputFiles('#dash-import-file', file);
  await page.waitForTimeout(1500);
  const elapsed = Date.now() - t0;
  const after = await page.evaluate(() => localStorage.getItem('cozyCompanion'));
  after === before ? ok(`oversized backup rejected, state untouched (${elapsed}ms)`) : bad('oversized backup rejected');
  const toast = await page.locator('#toast, .toast').first().textContent().catch(() => '');
  /te groot/i.test(toast || '') ? ok('oversized backup explains itself') : bad('oversized backup explains itself', `"${toast}"`);
  await ctx.close();
}

// ── Finding 1: activation must not delete other apps' caches ──
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 100));
    return !!reg;
  });
  // Plant a neighbour's cache and a stale Cozy cache, then force activation.
  await page.evaluate(async () => {
    const other = await caches.open('some-other-app-v1');
    await other.put('/neighbour', new Response('keep me'));
    const stale = await caches.open('cozy-draw-v1');
    await stale.put('/old', new Response('drop me'));
  });
  // update() is a no-op when sw.js is byte-identical, so no activate event
  // fires. Unregister first to force a genuine install + activate cycle.
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.unregister();
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready.catch(() => null);
    for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 100));
  });
  await page.waitForTimeout(1200);

  const keys = await page.evaluate(() => caches.keys());
  keys.includes('some-other-app-v1')
    ? ok("another app's cache survives activation") : bad("another app's cache survives activation", keys.join(','));
  !keys.includes('cozy-draw-v1')
    ? ok('stale Cozy cache is cleaned up') : bad('stale Cozy cache is cleaned up', keys.join(','));
  await ctx.close();
}

// ── Finding 2: navigation caching is bounded ─────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready.catch(() => null);
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 100));
  });
  const baseline = await page.evaluate(async () => {
    const c = await caches.open('cozy-draw-v4');
    return (await c.keys()).length;
  });
  // Hit the same document under many distinct query strings.
  await page.evaluate(async () => {
    for (let i = 0; i < 25; i++) await fetch('./companion.html?bust=' + i, { headers: { accept: 'text/html' } });
  });
  await page.waitForTimeout(1200);
  const after = await page.evaluate(async () => {
    const c = await caches.open('cozy-draw-v4');
    return (await c.keys()).map(r => r.url);
  });
  const busted = after.filter(u => u.includes('bust='));
  busted.length === 0 ? ok('query strings do not create cache entries') : bad('query strings do not create cache entries', `${busted.length} entries`);
  after.length <= baseline + 2 ? ok(`cache stayed bounded (${baseline} -> ${after.length})`) : bad('cache stayed bounded', `${baseline} -> ${after.length}`);

  // An unknown page under scope is served but never stored.
  await page.evaluate(() => fetch('./nope-not-a-page.html', { headers: { accept: 'text/html' } }).catch(() => {}));
  await page.waitForTimeout(600);
  const keys2 = await page.evaluate(async () => (await (await caches.open('cozy-draw-v4')).keys()).map(r => r.url));
  !keys2.some(u => u.includes('nope-not-a-page'))
    ? ok('non-allowlisted page is not cached') : bad('non-allowlisted page is not cached');
  await ctx.close();
}

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
