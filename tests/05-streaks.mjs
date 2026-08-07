import { chromium } from 'playwright';
import fs from 'fs';

const APP_URL = process.env.COZY_URL ? process.env.COZY_URL + '/companion.html' : 'http://127.0.0.1:8087/companion.html';
const SHOTS = process.env.COZY_SHOTS || new URL('./shots', import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok  = (n) => { console.log('  PASS  ' + n); pass++; };
const bad = (n, e) => { console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); fail++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(APP_URL, { waitUntil: 'networkidle' });

const seed = async (daysAgo, current, best) => {
  await page.evaluate(({ daysAgo, current, best }) => {
    const d = new Date(Date.now() - daysAgo * 86400000);
    const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const s = JSON.parse(localStorage.getItem('cozyCompanion') || '{}');
    s.settings = Object.assign(s.settings || {}, { onboarded: true, theme: 'light' });
    s.lessons = { '1-1': { completed: true, stars: 3 } };
    s.sessions = [{ date: iso, duration: 1800, notes: '' }];
    s.streak = { current, best, lastDate: iso };
    s.timer = { startedAt: null, accumulated: 0, running: false, paused: false, notes: '' };
    localStorage.setItem('cozyCompanion', JSON.stringify(s));
  }, { daysAgo, current, best });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
};

// Coloured today -> no nudge at all.
await seed(0, 5, 9);
const statusToday = await page.evaluate(() => streakStatus());
const noteToday = await page.locator('.streak-note').count();
statusToday === 'safe' && noteToday === 0
  ? ok('coloured today: no nudge (' + statusToday + ')')
  : bad('coloured today: no nudge', statusToday + ' notes=' + noteToday);

// Coloured yesterday -> streak at risk.
await seed(1, 5, 9);
const statusRisk = await page.evaluate(() => streakStatus());
const riskNote = await page.locator('.streak-note:not(.calm)').count();
statusRisk === 'risk' && riskNote === 1
  ? ok('streak at risk surfaces a nudge')
  : bad('streak at risk surfaces a nudge', statusRisk + ' notes=' + riskNote);
const riskText = await page.locator('.streak-note').first().textContent();
riskText.includes('5 dagen') ? ok('nudge names the streak length') : bad('nudge names the streak length', riskText);
await page.screenshot({ path: SHOTS + '/streak-risk.png' });

// The nudge's Start button jumps to the timer and starts it.
await page.click('#streak-go');
await page.waitForTimeout(600);
const started = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('cozyCompanion'));
  return { running: s.timer.running, tab: document.querySelector('.tab-panel.active')?.id };
});
started.running && started.tab === 'tab-sessie'
  ? ok('nudge starts a session on the timer tab')
  : bad('nudge starts a session on the timer tab', JSON.stringify(started));

// Broken streak. current is stale (5) because it is only recomputed on save;
// the UI must report 0, not keep claiming a streak that has lapsed.
await seed(4, 5, 9);
const statusBroken = await page.evaluate(() => streakStatus());
const shownStreak = await page.evaluate(() => effectiveStreak());
shownStreak === 0 ? ok('lapsed streak reports 0, not the stale count') : bad('lapsed streak reports 0', 'shown=' + shownStreak);
const statCard = await page.locator('.stat-card').first().textContent();
!/\b5\b/.test(statCard) ? ok('dashboard stat does not show a dead streak') : bad('dashboard stat does not show a dead streak', statCard);
const calmNote = await page.locator('.streak-note.calm').count();
statusBroken === 'broken' && calmNote === 1
  ? ok('broken streak shows the calm variant')
  : bad('broken streak shows the calm variant', statusBroken + ' calm=' + calmNote);
const calmText = await page.locator('.streak-note.calm').textContent();
/geen probleem/i.test(calmText) ? ok('broken-streak copy stays encouraging') : bad('broken-streak copy stays encouraging', calmText);
await page.screenshot({ path: SHOTS + '/streak-broken.png' });

// Brand-new user with no history gets no streak messaging.
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('cozyCompanion'));
  s.streak = { current: 0, best: 0, lastDate: null };
  s.sessions = [];
  localStorage.setItem('cozyCompanion', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const noneNote = await page.locator('.streak-note').count();
noneNote === 0 ? ok('no streak history: stays quiet') : bad('no streak history: stays quiet', 'notes=' + noneNote);

errors.length === 0 ? ok('no JS errors') : bad('no JS errors', errors.join(' | '));

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
