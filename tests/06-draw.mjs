import { chromium } from 'playwright';

const APP_URL = (process.env.COZY_URL || 'http://127.0.0.1:8087') + '/index.html';
let pass = 0, fail = 0;
const ok  = (n) => { console.log('  PASS  ' + n); pass++; };
const bad = (n, e) => { console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); fail++; };

const browser = await chromium.launch();

/** Drag across the canvas to lay down a stroke. */
async function stroke(page, from = [80, 80], to = [240, 200]) {
  const box = await page.locator('#drawing-canvas').boundingBox();
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + (from[0] + to[0]) / 2, box.y + (from[1] + to[1]) / 2, { steps: 8 });
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

/** Count pixels that differ from the background — a proxy for "something is drawn". */
const inkCount = (page) => page.evaluate(() => {
  const c = document.getElementById('drawing-canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) n++;
  }
  return n;
});

// ── HiDPI, drawing, undo/redo, persistence ───────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  // Backing store should be 2x the CSS size on a 2x display.
  const dims = await page.evaluate(() => {
    const c = document.getElementById('drawing-canvas');
    return { w: c.width, h: c.height, cssW: parseFloat(c.style.width), cssH: parseFloat(c.style.height), dpr: window.devicePixelRatio };
  });
  dims.w === Math.round(dims.cssW * 2) && dims.h === Math.round(dims.cssH * 2)
    ? ok(`canvas is HiDPI (${dims.cssW}x${dims.cssH} css -> ${dims.w}x${dims.h} backing)`)
    : bad('canvas is HiDPI', JSON.stringify(dims));

  const blank = await inkCount(page);
  await stroke(page);
  const drawn = await inkCount(page);
  drawn > blank ? ok('drawing puts ink on the canvas') : bad('drawing puts ink on the canvas', `${blank} -> ${drawn}`);

  // Undo removes it, redo brings it back.
  await page.click('#btn-undo');
  await page.waitForTimeout(300);
  const undone = await inkCount(page);
  undone < drawn ? ok('undo removes the stroke') : bad('undo removes the stroke', `${drawn} -> ${undone}`);

  await page.click('#btn-redo');
  await page.waitForTimeout(300);
  const redone = await inkCount(page);
  redone > undone ? ok('redo restores the stroke') : bad('redo restores the stroke', `${undone} -> ${redone}`);

  // Undo button must be disabled at the start of history.
  await page.click('#btn-undo');
  await page.waitForTimeout(250);
  const disabled = await page.evaluate(() => document.getElementById('btn-undo').disabled);
  disabled ? ok('undo disables at the start of history') : bad('undo disables at the start of history');

  // The headline fix: a reload must not throw the drawing away.
  await page.click('#btn-redo');
  await page.waitForTimeout(300);
  const before = await inkCount(page);
  await page.waitForTimeout(1100);           // let the debounced autosave land
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const after = await inkCount(page);
  after > blank * 1.001 || after > 500
    ? ok(`drawing survives reload (${before} -> ${after} ink px)`)
    : bad('drawing survives reload', `${before} -> ${after}`);

  errors.length === 0 ? ok('no JS errors') : bad('no JS errors', errors.join(' | '));
  await ctx.close();
}

// ── Preferences, keyboard, music toggling ────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Pick a brush and size, reload, and confirm they stuck.
  await page.click('.brush-btn[data-brush="crayon"]');
  await page.evaluate(() => {
    const s = document.getElementById('brush-size');
    s.value = 33; s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const prefs = await page.evaluate(() => ({ brush: state.brush, size: state.size, slider: +document.getElementById('brush-size').value }));
  prefs.brush === 'crayon' && prefs.size === 33 && prefs.slider === 33
    ? ok('brush and size preferences persist')
    : bad('brush and size preferences persist', JSON.stringify(prefs));

  // Cmd+Z must undo on macOS, not just Ctrl+Z.
  await stroke(page, [100, 100], [260, 220]);
  const withStroke = await inkCount(page);
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(350);
  const afterMeta = await inkCount(page);
  afterMeta < withStroke ? ok('Cmd+Z undoes (macOS chord)') : bad('Cmd+Z undoes', `${withStroke} -> ${afterMeta}`);

  await page.keyboard.press('Meta+Shift+z');
  await page.waitForTimeout(350);
  const afterRedo = await inkCount(page);
  afterRedo > afterMeta ? ok('Cmd+Shift+Z redoes') : bad('Cmd+Shift+Z redoes', `${afterMeta} -> ${afterRedo}`);

  // Rapid music toggling used to schedule params on a closed context.
  for (let i = 0; i < 3; i++) {
    await page.click('#btn-music');
    await page.waitForTimeout(120);
    await page.click('#btn-music');
    await page.waitForTimeout(120);
  }
  await page.click('#btn-music');
  await page.waitForTimeout(600);
  const audioErrs = errors.filter(e => /InvalidState|closed|AudioContext/i.test(e));
  audioErrs.length === 0 ? ok('rapid music toggling does not throw') : bad('rapid music toggling does not throw', audioErrs.join(' | '));

  // Particles toggle actually stops the rAF loop.
  const onFrame = await page.evaluate(() => { if (!state.particlesOn) document.getElementById('btn-particles').click(); return particleFrame !== null; });
  await page.click('#btn-particles');
  await page.waitForTimeout(300);
  const offFrame = await page.evaluate(() => particleFrame);
  onFrame && offFrame === null ? ok('particles toggle stops the animation loop') : bad('particles toggle stops the loop', `on=${onFrame} off=${offFrame}`);

  errors.length === 0 ? ok('no JS errors') : bad('no JS errors', errors.join(' | '));
  await ctx.close();
}

// ── Reduced motion ───────────────────────────────────
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1100, height: 760 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const frame = await page.evaluate(() => particleFrame);
  frame === null ? ok('reduced motion: particle loop stays stopped') : bad('reduced motion: particle loop stays stopped', 'frame=' + frame);
  errors.length === 0 ? ok('reduced motion: no JS errors') : bad('reduced motion: no JS errors', errors.join(' | '));
  await ctx.close();
}

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
