const {strict:assert}=require('node:assert');
const vm=require('node:vm'),fs=require('node:fs');
const elements={};
const context={document:{getElementById:id=>elements[id]??(elements[id]={attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(){}})},Math:Object.create(Math)};
context.Math.random=()=>.999;
vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/cortana-v1.2/game.js','utf8'),context);
const run=s=>vm.runInContext(s,context);
const data=s=>JSON.parse(JSON.stringify(run(s)));
function fresh(skillTicket,cardTicket){run(`Math.random=(()=>{let draws=[${skillTicket},${cardTicket}];return()=>draws.length?draws.shift():0})();start()`);}
// Exact stratified samples, avoiding flaky random-frequency assertions.
const frequencies=run(`(()=>{const hits={};for(let n=0;n<12000;n++){const i=weightedIndex(swapWeights(DECK),(n+.5)/12000);hits[DECK[i]]=(hits[DECK[i]]||0)+1}return hits})()`);
assert.deepEqual(JSON.parse(JSON.stringify(frequencies)),{'1':3000,'1.5':3000,'2':3000,'2.5':1500,'3':1500});
const weights=data('swapWeights([1,2,3])');assert.deepEqual(weights,[.25,.125,.125]);
assert.equal(run('weightedIndex(swapWeights([2.5]),.999)'),0);
assert.deepEqual(data('swapWeights([1.5,1.5,2])'),[.125,.125,.125]);
// Round 1 announces the skill before any player selection.
fresh(0,.999);
assert.equal(run('state.selected'),null);assert.equal(run('state.cpuSkillActive'),true);
assert.match(elements['cpu-ready'].className,/lit/);assert.match(elements['cpu-skill'].className,/lit/);
assert.equal(elements['cpu-skill'].textContent,'伤害 ×2');
const choices=data('[state.cpuChoice,state.cpuSwapChoice]');
run('choose(0);toggleSkill();toggleSkill();choose(1);choose(0)');
assert.deepEqual(data('[state.cpuChoice,state.cpuSwapChoice]'),choices);
run('confirm()');assert.equal(run('state.hp'),1);assert.equal(run('state.history[0].damage'),2);
assert.equal(run('state.cpuSkillUsed'),true);assert.equal(run('confirm()'),false);
assert.doesNotMatch(elements['cpu-ready'].className,/lit/);assert.doesNotMatch(elements['cpu-skill'].className,/lit/);
run('Math.random=()=>.999;next();choose(1);confirm()');
assert.equal(run('state.history[1].damage'),1);assert.equal(run('state.hp'),0);assert.equal(run('state.phase'),'over');
// The losing party takes double damage, even when it is Cortana.
fresh(0,0);run('choose(7);confirm()');assert.equal(run('state.cpuHp'),1);assert.equal(run('state.hp'),3);
// A tie consumes the skill without causing damage.
fresh(0,0);run('choose(0);confirm()');assert.equal(run('state.hp'),3);assert.equal(run('state.cpuHp'),3);assert.equal(run('state.cpuSkillUsed'),true);
// Swap cancels the amplified round and spends both skills; cards return.
fresh(0,.999);run('choose(0);toggleSkill();confirm()');
assert.deepEqual(data('[state.hp,state.cpuHp,state.skillUsed,state.cpuSkillUsed]'),[3,3,true,true]);
assert.equal(run('state.history[0].countered'),true);assert.equal(run('state.history[0].damage'),0);
assert.equal(run('state.player[0].value'),3);assert.equal(run('state.cpu[7]'),1);
assert.equal(run('state.cpu.length'),8);assert.equal(run('state.player[0].used'),false);
assert.match(elements['status-title'].textContent,/抵消/);
run('next()');assert.equal(run('toggleSkill()'),false);assert.equal(run('choose(0)'),true);assert.equal(run('state.cpuSkillActive'),false);
// Weighted conditional plan really differs from normal uniform choice.
fresh(.999,.2);assert.equal(run('state.cpu[state.cpuSwapChoice]'),1);
fresh(.999,.3);assert.equal(run('state.cpu[state.cpuSwapChoice]'),1.5);
run('choose(0);toggleSkill();confirm()');assert.equal(run('state.history[0].cpu'),1.5);
// HP clamps at zero even when only one HP remains.
fresh(0,.999);run('state.hp=1;choose(0);confirm()');assert.equal(run('state.hp'),0);
// Last card swap preserves another round; the ninth round resolves normally.
fresh(.999,0);run('for(let i=0;i<7;i++){choose(i);confirm();next()}toggleSkill();choose(7);confirm()');
assert.equal(run('state.phase'),'reveal');assert.equal(run('state.cpu.length'),1);assert.equal(run('state.cpuSkillUsed'),true);
run('next();choose(7);confirm()');assert.equal(run('state.round'),9);assert.equal(run('state.phase'),'over');
fresh(.999,0);assert.equal(run('state.cpuSkillUsed'),false);assert.equal(run('state.skillUsed'),false);
// Simulate complete games to exercise late/depleted hands and state invariants.
context.Math.random=Math.random;
for(let game=0;game<300;game++){
 run('start()');let steps=0;
 while(run('state.phase')!=='over'){
  if(run('state.phase')==='reveal')run('next()');
  const ids=data('state.player.filter(c=>!c.used).map(c=>c.id)');
  run(`choose(${ids[Math.floor(Math.random()*ids.length)]})`);
  if(Math.random()<.4)run('toggleSkill()');
  run('confirm()');steps++;
  assert.equal(run('state.cpu.length'),run('state.player.filter(c=>!c.used).length'));
  assert.ok(run('state.hp>=0&&state.hp<=3&&state.cpuHp>=0&&state.cpuHp<=3'));
  assert.ok(run('state.history.filter(h=>h.amplified).length<=1'));
  assert.ok(run('state.history.filter(h=>h.swapped).length<=1'));
  assert.ok(steps<=9);
 }
}
console.log('PASS: exact weights, depleted hands, committed choices, status badges, double damage, ties, counter, single-use, reset, ninth round, 300 complete games.');
