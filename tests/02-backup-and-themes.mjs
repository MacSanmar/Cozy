import { chromium } from 'playwright';
import fs from 'fs';

const APP_URL = (process.env.COZY_URL || 'http://127.0.0.1:8087') + '/companion.html';
const OUT = process.env.COZY_SHOTS || new URL('./shots', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok  = (n) => { console.log('  PASS  ' + n); pass++; };
const bad = (n, e) => { console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); fail++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },       // iPhone-ish
  deviceScaleFactor: 2,
  acceptDownloads: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

await page.goto(APP_URL, { waitUntil: 'networkidle' });

// Seed realistic progress so the dashboard has something to show.
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('cozyCompanion')) || {};
  s.lessons = { '1-1': { completed: true, stars: 3 }, '1-2': { completed: true, stars: 2 }, '2-1': { completed: true, stars: 3 } };
  s.sessions = [
    { date: '2026-08-06', duration: 2730, notes: 'Herfstbladeren, warme tinten' },
    { date: '2026-08-05', duration: 1520, notes: '' },
    { date: '2026-08-04', duration: 3600, notes: 'Blending geoefend' },
  ];
  s.streak = { current: 8, best: 12, lastDate: '2026-08-06' };
  s.settings = Object.assign(s.settings || {}, { onboarded: true, theme: 'light', volume: 50, activeSounds: [] });
  s.timer = { startedAt: null, accumulated: 0, running: false, paused: false, notes: '' };
  localStorage.setItem('cozyCompanion', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const tabs = ['dashboard', 'ambient', 'kleuren', 'sessie', 'lessen'];
for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => {
    const s = JSON.parse(localStorage.getItem('cozyCompanion'));
    s.settings.theme = t;
    localStorage.setItem('cozyCompanion', JSON.stringify(s));
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const t of tabs) {
    await page.click(`button[data-tab="${t}"]`);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/${theme}-${t}.png` });
  }
}
ok('captured ' + (tabs.length * 2) + ' screenshots');

// Dutch date formatting, including today/yesterday relative labels.
const dateChecks = await page.evaluate(() => {
  const iso = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  return { today: fmtDate(iso(0)), yest: fmtDate(iso(1)), fixed: fmtDate('2026-08-04'), old: fmtDate('2024-03-09'), junk: fmtDate('') };
});
dateChecks.today === 'vandaag' && dateChecks.yest === 'gisteren'
  ? ok('relative dates (vandaag/gisteren)')
  : bad('relative dates', JSON.stringify(dateChecks));
dateChecks.fixed === '4 augustus' && dateChecks.old === '9 maart 2024'
  ? ok('absolute dates in Dutch (' + dateChecks.fixed + ' / ' + dateChecks.old + ')')
  : bad('absolute dates in Dutch', JSON.stringify(dateChecks));

// Contrast sanity check in dark mode: text must not be near-black on dark bg.
await page.click('button[data-tab="dashboard"]');
await page.waitForTimeout(300);
const colors = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  return { bg: body.backgroundColor, text: body.color, accent: cs.getPropertyValue('--accent').trim() };
});
const lum = (rgb) => {
  const m = rgb.match(/\d+/g).map(Number);
  return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
};
const contrast = Math.abs(lum(colors.text) - lum(colors.bg));
contrast > 0.4
  ? ok('dark theme text/bg contrast adequate (' + contrast.toFixed(2) + ')')
  : bad('dark theme text/bg contrast adequate', contrast.toFixed(2) + ' ' + JSON.stringify(colors));

// Import round-trip: export -> wipe -> import -> progress restored.
const dl = await Promise.all([
  page.waitForEvent('download'),
  page.click('#dash-export'),
]).then(r => r[0]);
const path = await dl.path();
const exported = fs.readFileSync(path, 'utf8');
const parsed = JSON.parse(exported);
parsed.state && Object.keys(parsed.state.lessons).length === 3
  ? ok('export contains full progress')
  : bad('export contains full progress', exported.slice(0, 200));

await page.evaluate(() => localStorage.removeItem('cozyCompanion'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const wiped = await page.locator('#welcome-ambient').count();
wiped === 1 ? ok('wipe returns to first-run state') : bad('wipe returns to first-run state');

// Import the file we just exported. The confirm() is a real dialog — accept it.
page.on('dialog', d => d.accept());
const tmp = `${OUT}/backup.json`;
fs.writeFileSync(tmp, exported);
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cozyCompanion') || '{}'); s.settings = Object.assign(s.settings || {}, { onboarded: true }); localStorage.setItem('cozyCompanion', JSON.stringify(s)); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.setInputFiles('#dash-import-file', tmp);
await page.waitForTimeout(2200);

const restored = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('cozyCompanion'));
  return { lessons: Object.keys(s.lessons || {}).length, sessions: (s.sessions || []).length, streak: (s.streak || {}).current };
});
restored.lessons === 3 && restored.sessions === 3 && restored.streak === 8
  ? ok('import restores full progress (' + JSON.stringify(restored) + ')')
  : bad('import restores full progress', JSON.stringify(restored));

errors.length === 0 ? ok('no JS errors') : bad('no JS errors', errors.join(' | '));

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
