'use strict';
const { strict: assert } = require('node:assert');
const fs = require('node:fs'), vm = require('node:vm');
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function load(modern, seed = 815) {
  const els = {}, tools = {};
  const context = { document: { getElementById: id => els[id] ??= { setAttribute() {}, addEventListener() {} }, modelContext: { registerTool: t => { tools[t.name] = t; } } }, Math: Object.create(Math), DuelUI: { cancel() {}, closePanels() {}, init() {}, hearts() {}, inventory() {}, play: () => Promise.resolve() } };
  context.Math.random = rng(seed); vm.createContext(context);
  const base = modern ? 'dist/' : 'dist/cortana-v1.4.1/';
  vm.runInContext(fs.readFileSync(base + 'ai.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync(base + 'game.js', 'utf8'), context);
  const run = code => vm.runInContext(code, context);
  return { run, context, els, tools, snapshot: () => JSON.parse(run('JSON.stringify(state)')) };
}
(async () => {
  assert.deepEqual(fs.readFileSync('dist/ai.js'), fs.readFileSync('dist/cortana-v1.4.1/ai.js'), 'v1.4.1 AI must stay byte-identical');
  const old = load(false), game = load(true), random = rng(1500);
  let rounds = 0;
  for (let n = 0; n < 80; n++) {
    old.run('start()'); game.run('start()');
    assert.deepEqual(game.snapshot(), old.snapshot());
    while (old.run('state.phase') !== 'over') {
      if (old.run('state.phase') === 'reveal') { old.run('next()'); game.run('next()'); }
      const cards = old.run('state.player.filter(c => !c.used)');
      const id = cards[Math.floor(random() * cards.length)].id;
      old.run(`choose(${id})`); game.run(`choose(${id})`);
      if (random() < .45) { old.run('toggleSkill()'); game.run('toggleSkill()'); }
      assert.deepEqual(game.snapshot(), old.snapshot(), 'selection must not change the locked plan');
      old.run('confirm()'); assert.equal(await game.run('confirm()'), true);
      assert.deepEqual(game.snapshot(), old.snapshot(), 'AI plan, posterior, inventory, damage and terminal state must match');
      rounds++;
    }
  }
  const g = load(true);
  let finish;
  g.context.DuelUI.play = () => new Promise(resolve => { finish = resolve; });
  g.run('choose(3);toggleSkill()'); const before = g.snapshot();
  const pending = g.run('confirm()');
  assert.equal(g.run('state.phase'), 'animating');
  const during = g.snapshot(); during.phase = 'select'; assert.deepEqual(during, before, 'no public or hidden game mutations before reveal');
  assert.equal(g.run('choose(4)'), false); assert.equal(g.run('toggleSkill()'), false);
  assert.equal(g.run('confirm()'), false); assert.equal(g.run('next()'), false);
  assert.equal(g.els.action.disabled, true);
  finish(); assert.equal(await pending, true); assert.equal(g.run('state.history.length'), 1);
  g.run('next();choose(4)'); const cancelled = g.run('confirm()'); g.run('start()'); const restarted = g.snapshot(); finish();
  assert.equal(await cancelled, false); assert.deepEqual(g.snapshot(), restarted, 'old animation cannot write into restarted game');
  let completed = false;
  const toolPlay = g.tools.play_card.execute({ cardId: 3 }).then(x => { completed = true; return x; });
  await Promise.resolve(); assert.equal(completed, false, 'tool waits for reveal');
  finish(); const response = await toolPlay; assert.equal(response.result.player, 1.5); assert.equal(response.phase, g.run('state.phase'));
  g.run('start()'); const toolCancelled = g.tools.play_card.execute({ cardId: 3 }); g.run('start()'); finish();
  await assert.rejects(toolCancelled, /取消/);
  g.context.DuelUI.play = () => Promise.reject(Error('Animation unavailable'));
  g.run('choose(0)'); assert.equal(await g.run('confirm()'), true, 'animation failure falls back to one settlement');
  assert.equal(g.run('state.history.length'), 1);
  console.log(`PASS v1.5: byte-identical AI; ${rounds} rounds in 80 games match v1.4.1; deferred settlement, double-click lock, restart cancellation, tool completion/cancellation and animation failure fallback.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
