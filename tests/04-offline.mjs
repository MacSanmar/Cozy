import { chromium } from 'playwright';

const APP_URL = (process.env.COZY_URL || 'http://127.0.0.1:8087') + '/companion.html';
let pass = 0, fail = 0;
const ok  = (n) => { console.log('  PASS  ' + n); pass++; };
const bad = (n, e) => { console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); fail++; };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

await page.goto(APP_URL, { waitUntil: 'networkidle' });

// Wait for the service worker to take control.
const controlled = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return false;
  for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) {
    await new Promise(r => setTimeout(r, 100));
  }
  return !!navigator.serviceWorker.controller;
});
controlled ? ok('service worker registers and controls the page') : bad('service worker registers and controls the page');

// Seed some progress, then verify the app still opens with the network cut.
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('cozyCompanion') || '{}');
  s.settings = Object.assign(s.settings || {}, { onboarded: true });
  s.sessions = [{ date: '2026-08-06', duration: 1800, notes: 'offline test' }];
  localStorage.setItem('cozyCompanion', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// Cut the network entirely and reload: the SW must serve the cached page.
await ctx.setOffline(true);
const offlineResp = await page.reload({ waitUntil: 'domcontentloaded' }).catch(e => String(e));
await page.waitForTimeout(700);

const offlineWorks = await page.evaluate(() => {
  const nav = document.getElementById('bottom-nav');
  return !!nav && nav.children.length > 0;
});
offlineWorks ? ok('app loads offline from cache') : bad('app loads offline from cache', String(offlineResp).slice(0, 120));

const offlineData = await page.evaluate(() => {
  try { return (JSON.parse(localStorage.getItem('cozyCompanion')).sessions || []).length; } catch { return -1; }
});
offlineData === 1 ? ok('progress readable offline') : bad('progress readable offline', 'sessions=' + offlineData);

// Tabs still switch offline (no network dependency in the UI).
await page.click('button[data-tab="kleuren"]').catch(() => {});
await page.waitForTimeout(300);
const swatches = await page.locator('.palette-swatch').count();
swatches > 0 ? ok('palettes render offline (' + swatches + ' swatches)') : bad('palettes render offline');

await ctx.setOffline(false);
await page.waitForTimeout(300);

// A page request must be network-first so a new deploy is picked up.
const fresh = await page.evaluate(async () => {
  const res = await fetch('./companion.html', { cache: 'no-store' });
  return res.ok && (await res.text()).includes('Cozy Color Companion');
});
fresh ? ok('page fetch goes to network when online') : bad('page fetch goes to network when online');

const late = errors.filter(e => !/favicon|manifest/i.test(e));
late.length === 0 ? ok('no JS errors') : bad('no JS errors', late.join(' | '));

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
