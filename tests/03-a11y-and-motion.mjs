import { chromium } from 'playwright';

const APP_URL = (process.env.COZY_URL || 'http://127.0.0.1:8087') + '/companion.html';
let pass = 0, fail = 0;
const ok  = (n) => { console.log('  PASS  ' + n); pass++; };
const bad = (n, e) => { console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); fail++; };

const browser = await chromium.launch();

// ── Reduced-motion context ───────────────────────────
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cozyCompanion') || '{}'); s.settings = Object.assign(s.settings || {}, { onboarded: true }); localStorage.setItem('cozyCompanion', JSON.stringify(s)); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  // With reduced motion the rAF loop must not be running.
  const frameHandle = await page.evaluate(() => particleFrame);
  frameHandle === null ? ok('reduced motion: particle loop stopped') : bad('reduced motion: particle loop stopped', 'frame=' + frameHandle);

  // ...but the canvas should still have a still frame drawn on it.
  const painted = await page.evaluate(() => {
    const c = document.getElementById('ambient-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
    return false;
  });
  painted ? ok('reduced motion: still frame still drawn') : bad('reduced motion: still frame still drawn');

  errors.length === 0 ? ok('reduced motion: no JS errors') : bad('reduced motion: no JS errors', errors.join(' | '));
  await ctx.close();
}

// ── Normal context: battery, a11y, clipboard ─────────
{
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cozyCompanion') || '{}'); s.settings = Object.assign(s.settings || {}, { onboarded: true }); localStorage.setItem('cozyCompanion', JSON.stringify(s)); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const running = await page.evaluate(() => particleFrame !== null);
  running ? ok('particles animate when visible') : bad('particles animate when visible');

  // Sound cards expose button semantics and respond to the keyboard.
  await page.click('button[data-tab="ambient"]');
  await page.waitForTimeout(300);
  const roles = await page.locator('.sound-card[role="button"][tabindex="0"]').count();
  roles === 6 ? ok('sound cards have button semantics') : bad('sound cards have button semantics', 'count=' + roles);

  const card = page.locator('.sound-card[data-sound="fire"]');
  await card.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const pressed = await card.getAttribute('aria-pressed');
  const onNow = await page.evaluate(() => JSON.parse(localStorage.getItem('cozyCompanion')).settings.activeSounds);
  onNow.includes('fire') ? ok('sound card toggles via keyboard') : bad('sound card toggles via keyboard', JSON.stringify(onNow));
  pressed === 'true' ? ok('aria-pressed reflects state') : bad('aria-pressed reflects state', String(pressed));

  // Palette swatch copies via keyboard, with feedback.
  await page.click('button[data-tab="kleuren"]');
  await page.waitForTimeout(300);
  const sw = page.locator('.palette-swatch').first();
  const hex = await sw.getAttribute('data-hex');
  await sw.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  clip.toLowerCase() === String(hex).toLowerCase()
    ? ok('palette swatch copies hex via keyboard (' + clip + ')')
    : bad('palette swatch copies hex via keyboard', 'clip="' + clip + '" expected "' + hex + '"');

  const toast = await page.locator('#toast, .toast').first().textContent().catch(() => '');
  toast && toast.includes('gekopieerd') ? ok('copy shows confirmation toast') : bad('copy shows confirmation toast', '"' + toast + '"');

  errors.length === 0 ? ok('no JS errors') : bad('no JS errors', errors.join(' | '));
  await ctx.close();
}

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
