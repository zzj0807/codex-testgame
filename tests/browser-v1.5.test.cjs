'use strict';
const { strict: assert } = require('node:assert');
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve('dist'), output = path.resolve('.qa-v1.5');
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
});
(async () => {
  await fs.mkdir(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const url = `http://127.0.0.1:${server.address().port}/`;
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    await context.addInitScript(() => { Math.random = () => .99; });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); await page.waitForFunction(() => typeof state !== 'undefined');
    const run = code => page.evaluate(code);
    const settled = () => page.waitForFunction(() => ['reveal', 'over'].includes(state.phase));
    const snapshot = () => run('JSON.stringify(state)');
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
    await page.locator('[data-id="3"]').click(); await page.locator('#skill').click(); const beforeDialog = await snapshot();
    await page.locator('#rules-button').click(); assert.equal(await page.locator('#rules-dialog').evaluate(d => d.open), true);
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#rules-button').evaluate(b => b === document.activeElement), true);
    assert.equal(await snapshot(), beforeDialog);
    await page.locator('#recorder-button').click(); assert.equal(await page.locator('#recorder-total').textContent(), '剩余 8 张');
    assert.deepEqual(await page.locator('.count-card span').allTextContents(), ['× 3', '× 1', '× 2', '× 1', '× 1']);
    await page.locator('#recorder-dialog [data-close]').click(); assert.equal(await snapshot(), beforeDialog);
    await run('start();choose(3)'); const previous = await run('JSON.stringify([state.hp,state.cpuHp,state.cpu,state.history,state.cpuPlan])');
    await page.locator('#action').click();
    await page.waitForTimeout(180);
    assert.equal(await run('state.phase'), 'animating');
    assert.equal(await run('JSON.stringify([state.hp,state.cpuHp,state.cpu,state.history,state.cpuPlan])'), previous);
    assert.equal(await page.locator('#their-card').textContent(), '?');
    assert.equal(await page.locator('#action').isDisabled(), true); assert.equal(await page.locator('#recorder-button').isDisabled(), true);
    assert.equal(await page.locator('.flying-card').count(), 2);
    await page.screenshot({ path: path.join(output, 'in-flight.png'), fullPage: true });
    await settled(); assert.equal(await run('state.history.length'), 1); assert.equal(await run('state.hp'), 2);
    assert.equal(await page.locator('#your-hp .heart-icon').count(), 2); assert.equal(await page.locator('#your-hp .hp-number').textContent(), '2/3');
    await page.locator('#recorder-button').click(); assert.equal(await page.locator('#recorder-total').textContent(), '剩余 7 张');
    assert.deepEqual(await page.locator('.count-card span').allTextContents(), ['× 3', '× 1', '× 2', '× 1', '× 0']);
    await page.locator('#recorder-dialog [data-close]').click();
    await run('start();choose(3);toggleSkill()'); await page.locator('#action').click(); await settled();
    assert.equal(await run('state.history[0].swapped'), true); assert.equal(await run('state.hp'), 3);
    await page.locator('#recorder-button').click(); assert.equal(await page.locator('#recorder-total').textContent(), '剩余 8 张');
    assert.deepEqual(await page.locator('.count-card span').allTextContents(), ['× 3', '× 2', '× 2', '× 1', '× 0']);
    await page.screenshot({ path: path.join(output, 'recorder-after-swap.png'), fullPage: true });
    await page.locator('#recorder-dialog [data-close]').click();
    await run('start();choose(3)'); await page.locator('#action').click(); await page.waitForTimeout(90); await page.locator('#restart').click();
    const restarted = await snapshot(); await page.waitForTimeout(1100); assert.equal(await snapshot(), restarted); assert.equal(await page.locator('.flying-card').count(), 0);
    assert.equal(await run('state.history.length'), 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await run('Math.random=(()=>{let d=[0,.99];return()=>d.length?d.shift():.99})();start();choose(0)');
    assert.equal(await run('state.cpuSkillActive'), true); await page.locator('#action').click(); await settled();
    assert.equal(await run('state.hp'), 1); assert.equal(await page.locator('#your-hp .heart-icon').count(), 1);
    await run('next();choose(1)'); await page.locator('#action').click(); await settled();
    assert.equal(await run('state.phase'), 'over'); assert.equal(await run('state.hp'), 0);
    assert.equal(await page.locator('#your-hp .heart-icon').count(), 0); assert.equal(await page.locator('#your-hp .hp-number').textContent(), '0/3');
    assert.ok(!(await page.locator('#your-card').textContent()).includes('?'));
    // Countering x2 consumes both skills and keeps both inventories at eight.
    await run('Math.random=(()=>{let d=[0,.99];return()=>d.length?d.shift():.99})();start();choose(3);toggleSkill()');
    await page.locator('#action').click(); await settled(); assert.deepEqual(await run('[state.hp,state.cpuHp,state.skillUsed,state.cpuSkillUsed,state.history[0].countered,state.cpu.length]'), [3,3,true,true,true,8]);
    // Public tracker agrees with all nine rounds, including an exchange of the last card.
    await run('Math.random=(()=>{let d=[.99,0];return()=>d.length?d.shift():0})();start();Math.random=(()=>{let i=0;return()=>i++%2===0?.99:0})()');
    for (let i = 0; i < 9; i++) {
      await run('choose(state.player.find(c=>!c.used&&c.value===state.cpu[state.cpuPlan.index]).id)');
      if (i === 7) await run('toggleSkill()');
      await page.locator('#action').click(); await settled();
      const actual = await run('[1,1.5,2,2.5,3].map(v=>state.cpu.filter(c=>c===v).length)');
      assert.deepEqual(await page.locator('.count-card span').allTextContents(), actual.map(n => `× ${n}`));
      if (i < 8) await run('next()');
    }
    assert.equal(await run('state.round'), 9); assert.equal(await run('state.phase'), 'over'); assert.equal(await run('state.hp'), 3);
    // Missing Web Animations API is a supported immediate-reveal fallback.
    await run('(async()=>{start();choose(3);const animate=Element.prototype.animate;try{Element.prototype.animate=undefined;await confirm();}finally{Element.prototype.animate=animate}})()');
    assert.equal(await run('state.history.length'), 1);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await run('Math.random=()=>.99;start();choose(3)'); await page.locator('#action').click(); await page.waitForTimeout(70);
    await page.setViewportSize({ width: 1200, height: 900 }); await settled(); assert.equal(await run('state.history.length'), 1); assert.equal(await page.locator('.flying-card').count(), 0);
    // Desktop, tablet and narrow mobile layout, with both modal panels.
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width < 800 ? 844 : 1050 }); await run('start()');
      assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true, `overflow at ${width}`);
      await page.screenshot({ path: path.join(output, `layout-${width}.png`), fullPage: true });
      for (const name of ['rules', 'recorder']) {
        await page.locator(`#${name}-button`).click();
        const r = await page.locator(`#${name}-dialog`).boundingBox();
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= width + 1 && r.y + r.height <= (width < 800 ? 844 : 1050) + 1);
        if (width === 390) await page.screenshot({ path: path.join(output, `mobile-${name}.png`), fullPage: true });
        await page.locator(`#${name}-dialog [data-close]`).click();
      }
    }
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await mobile.addInitScript(() => { Math.random = () => .99; });
    const touch = await mobile.newPage(); touch.on('pageerror', e => errors.push(e.message));
    await touch.goto(url); await touch.locator('[data-id="3"]').tap(); await touch.locator('#action').tap();
    await touch.waitForTimeout(100);
    assert.equal(await touch.evaluate('state.phase'), 'animating', 'touch scrolling must not skip the reveal');
    assert.equal(await touch.locator('.flying-card').count(), 2);
    await touch.waitForFunction(() => state.phase === 'reveal');
    assert.equal(await touch.locator('#your-hp .heart-icon').count(), 2);
    await touch.locator('#recorder-button').tap();
    assert.equal(await touch.locator('#recorder-total').textContent(), '剩余 7 张');
    await mobile.close();
    assert.deepEqual(errors, []);
    console.log('PASS browser v1.5: real animation stages, no early disclosure, panels/focus, ordinary/swap/x2/counter/lethal/ninth-round settlement, tracker, SVG hearts, restart/resize cancellation, reduced motion, missing animation API, 320/390/768/1440 layouts; no page errors.');
    console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
