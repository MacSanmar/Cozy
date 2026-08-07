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
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(APP_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// 1. Loads without runtime errors
errors.length === 0 ? ok('loads with no JS errors') : bad('loads with no JS errors', errors.join(' | '));

// 2. Welcome screen for a first-time user
const welcome = await page.locator('#welcome-ambient').count();
welcome === 1 ? ok('first-run welcome shown') : bad('first-run welcome shown', 'count=' + welcome);

// 2b. Welcome links to a real lesson id (regression: was 'basis-1', which doesn't exist)
await page.click('#welcome-lesson');
await page.waitForTimeout(500);
const overlayOpen = await page.locator('#lesson-overlay.open').count();
overlayOpen === 1 ? ok('welcome "first lesson" opens a real lesson') : bad('welcome "first lesson" opens a real lesson');
await page.click('#lesson-back').catch(() => {});
await page.waitForTimeout(500);
const overlayClosed = await page.locator('#lesson-overlay.open').count();
overlayClosed === 0 ? ok('lesson overlay closes cleanly') : bad('lesson overlay closes cleanly');

// 3. Theme toggle flips the html attribute and persists
const before = await page.getAttribute('html', 'data-theme');
await page.click('#btn-theme');
await page.waitForTimeout(150);
const after = await page.getAttribute('html', 'data-theme');
before !== after ? ok('theme toggles (' + before + ' -> ' + after + ')') : bad('theme toggles', 'stayed ' + before);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const persisted = await page.getAttribute('html', 'data-theme');
persisted === after ? ok('theme persists across reload') : bad('theme persists across reload', persisted + ' != ' + after);

// 4. Timer: start, verify it counts, reload, verify time was NOT lost
await page.click('button[data-tab="sessie"]');
await page.waitForTimeout(200);
await page.click('#timer-start');
await page.waitForTimeout(2500);

const running = await page.textContent('#timer-display');
running !== '00:00:00' ? ok('timer counts up (' + running + ')') : bad('timer counts up', 'still 00:00:00');

// Simulate the app being closed for 60s mid-session by rewinding startedAt.
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('cozyCompanion'));
  s.timer.startedAt -= 60000;
  localStorage.setItem('cozyCompanion', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.click('button[data-tab="sessie"]');
await page.waitForTimeout(300);

const resumed = await page.textContent('#timer-display');
const secs = resumed.split(':').reduce((a, v) => a * 60 + Number(v), 0);
secs >= 60
  ? ok('timer survives reload + background (' + resumed + ')')
  : bad('timer survives reload + background', 'only ' + resumed);

// 5. Notes persist mid-session across reload
await page.fill('#session-notes', 'herfstbladeren');
await page.waitForTimeout(250);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.click('button[data-tab="sessie"]');
await page.waitForTimeout(250);
const notes = await page.inputValue('#session-notes');
notes === 'herfstbladeren' ? ok('session notes persist across reload') : bad('session notes persist across reload', '"' + notes + '"');

// 6. Stop saves the session with the full elapsed duration
await page.click('#timer-stop');
await page.waitForTimeout(400);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cozyCompanion')).sessions);
saved.length === 1 && saved[0].duration >= 60
  ? ok('session saved with full duration (' + saved[0].duration + 's)')
  : bad('session saved with full duration', JSON.stringify(saved));
saved[0] && saved[0].notes === 'herfstbladeren'
  ? ok('session saved with notes')
  : bad('session saved with notes', JSON.stringify(saved[0]));

// 7. Delete a session
await page.waitForTimeout(200);
const delCount = await page.locator('.session-del').count();
if (delCount > 0) {
  await page.click('.session-del');
  await page.waitForTimeout(300);
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('cozyCompanion')).sessions.length);
  left === 0 ? ok('session delete works') : bad('session delete works', 'left=' + left);
} else bad('session delete works', 'no delete button rendered');

// 8. Sleep timer buttons wire up
await page.click('button[data-tab="ambient"]');
await page.waitForTimeout(250);
const sleepBtns = await page.locator('.sleep-opt').count();
sleepBtns === 4 ? ok('sleep timer options render') : bad('sleep timer options render', 'count=' + sleepBtns);
await page.click('.sleep-opt[data-min="15"]');
await page.waitForTimeout(250);
const active15 = await page.locator('.sleep-opt[data-min="15"].active').count();
active15 === 1 ? ok('sleep timer selectable') : bad('sleep timer selectable');

// 9. Ambient sound toggles and persists
await page.click('.sound-card[data-sound="rain"]');
await page.waitForTimeout(400);
const rainOn = await page.evaluate(() => JSON.parse(localStorage.getItem('cozyCompanion')).settings.activeSounds);
rainOn.includes('rain') ? ok('sound state persists') : bad('sound state persists', JSON.stringify(rainOn));

// 10. Export produces a valid download
const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
  page.click('button[data-tab="dashboard"]').then(() => page.waitForTimeout(250)).then(() => page.click('#dash-export')),
]);
dl ? ok('export downloads a file (' + dl.suggestedFilename() + ')') : bad('export downloads a file');

// 11. No errors accumulated through the whole flow
const late = errors.filter(e => !e.includes('favicon') && !e.includes('sw.js') && !e.includes('manifest'));
late.length === 0 ? ok('no JS errors during full flow') : bad('no JS errors during full flow', late.join(' | '));

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
