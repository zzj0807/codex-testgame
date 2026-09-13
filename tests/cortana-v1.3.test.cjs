const {strict:assert}=require('node:assert');
const fs=require('node:fs'),vm=require('node:vm');
const AI=require('../dist/cortana-v1.3/ai.js');
const deck=[1,1,1,1.5,2,2,2.5,3];
const view={ownCards:deck,publicHistory:[],ownHp:3,opponentHp:3,skillUsed:false};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const total=a=>a.reduce((s,n)=>s+n,0);
// Skill roll boundary and all phases of the specified distribution.
let triggers=0;for(let n=0;n<1000;n++)triggers+=AI.planRound(view,(n+.5)/1000,.5).skillActive;
assert.equal(triggers,250);assert.equal(AI.planRound(view,.25,.5).skillActive,false);
assert.equal(AI.planRound({...view,skillUsed:true},0,.5).skillActive,false);
const power=AI.skillProbabilities(deck);close(total(power),1);
close(total(power.slice(0,3)),1/4);close(power[7],1/3);
for(const i of [3,4,5,6])close(power[i],5/48);
const hits=Array(8).fill(0);for(let n=0;n<4800;n++)hits[AI.sampleIndex(power,(n+.5)/4800)]++;
assert.deepEqual(hits,[400,400,400,500,500,500,500,1600]);
const two=AI.skillProbabilities([1,1,3]);close(two[0],3/14);close(two[1],3/14);close(two[2],4/7);
assert.deepEqual(AI.skillProbabilities([2,2]),[.5,.5]);assert.deepEqual(AI.skillProbabilities([3]),[1]);
// Public record reconstruction handles duplicate cards and swapped cards.
assert.deepEqual(AI.reconstructPlayerCards([{player:1,cpu:3,swapped:true},{player:3,cpu:1,swapped:false}]).sort((a,b)=>a-b),[1,1,1.5,2,2,2.5,3]);
assert.throws(()=>AI.reconstructPlayerCards([{player:9,cpu:1,swapped:false}]));
// Uniform opponent model, bounded probabilities and conservation of equal winners.
const normal=AI.normalProbabilities(view);close(total(normal),1);normal.forEach(p=>assert.ok(p>=.2/8));
close(normal[0],normal[1]);close(normal[1],normal[2]);assert.ok(normal[7]>normal[0]);
const spent=deck.slice(1).map(player=>({player,cpu:1,swapped:false}));
const conservation=AI.normalProbabilities({...view,ownCards:[2,3],publicHistory:spent});assert.ok(conservation[0]>conservation[1]);
const urgency=AI.normalProbabilities({...view,ownHp:1});
assert.ok(total(urgency.map((p,i)=>p*deck[i]))>total(normal.map((p,i)=>p*deck[i])));
const poisoned={...view};for(const name of ['player','selected','skillArmed'])Object.defineProperty(poisoned,name,{get(){throw Error('Forbidden hidden input: '+name)}});
assert.deepEqual(AI.planRound(poisoned,.9,.5),AI.planRound(view,.9,.5));
assert.ok(Object.isFrozen(AI.planRound(view,.9,.5)));
const frozen=Object.freeze({...view,ownCards:Object.freeze([...deck]),publicHistory:Object.freeze([])});AI.planRound(frozen,.9,.2);
function game(){const els={};const context={document:{getElementById:id=>els[id]??(els[id]={attributes:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(){}})},Math:Object.create(Math)};context.Math.random=()=>.99;vm.createContext(context);vm.runInContext(fs.readFileSync('dist/cortana-v1.3/ai.js','utf8'),context);vm.runInContext(fs.readFileSync('dist/cortana-v1.3/game.js','utf8'),context);return{context,els,run:s=>vm.runInContext(s,context)};}
const g=game(),run=g.run;
const data=s=>JSON.parse(JSON.stringify(run(s)));
const fresh=(a,b)=>run(`Math.random=(()=>{let draws=[${a},${b}];return()=>draws.length?draws.shift():.9})();start()`);
// Skill activates after earlier misses; used skill never gets another chance.
fresh(.9,0);assert.equal(run('state.cpuSkillActive'),false);
run('choose(0);confirm();Math.random=(()=>{let d=[.9,0];return()=>d.shift()})();next();choose(1);confirm();Math.random=(()=>{let d=[.1,0];return()=>d.shift()})();next()');
assert.equal(run('state.round'),3);assert.equal(run('state.cpuSkillActive'),true);assert.match(g.els['cpu-skill'].className,/lit/);
run('choose(2);confirm();Math.random=()=>0;next()');assert.equal(run('state.cpuSkillActive'),false);assert.equal(run('state.cpuSkillUsed'),true);
// Round preparation cannot inspect actual hand, current card or current skill toggle.
fresh(.9,.7);
run(`(()=>{const names=['player','selected','skillArmed'];const saved=names.map(n=>Object.getOwnPropertyDescriptor(state,n));try{names.forEach(n=>Object.defineProperty(state,n,{configurable:true,get(){throw Error('Hidden input accessed')}}));prepareRound();}finally{names.forEach((n,i)=>Object.defineProperty(state,n,saved[i]));}})()`);
// Both normal and swap settlement reveal the SAME locked card, no new RNG calls.
for(const swap of [false,true]){
 fresh(.9,.3);const value=run('state.cpu[state.cpuPlan.index]');const plan=data('state.cpuPlan');
 run('Math.random=()=>{throw Error("Unexpected reroll")};choose(0);choose(7);choose(0);toggleSkill();toggleSkill()');
 if(swap)run('toggleSkill()');assert.deepEqual(data('state.cpuPlan'),plan);
 run('confirm()');assert.equal(run('state.history[0].cpu'),value);assert.equal(run('confirm()'),false);
 assert.doesNotMatch(g.els['cpu-ready'].className,/lit/);
}
// Skill cancellation and double damage on either losing side.
fresh(0,.99);run('choose(0);toggleSkill();confirm()');assert.deepEqual(data('[state.hp,state.cpuHp,state.skillUsed,state.cpuSkillUsed]'),[3,3,true,true]);assert.equal(run('state.history[0].countered'),true);assert.equal(run('state.player[0].value'),3);
fresh(0,.99);run('choose(0);confirm()');assert.equal(run('state.hp'),1);assert.equal(run('state.history[0].damage'),2);
fresh(0,0);run('choose(7);confirm()');assert.equal(run('state.cpuHp'),1);
fresh(0,0);run('choose(0);confirm()');assert.equal(run('state.hp'),3);assert.equal(run('state.cpuSkillUsed'),true);
fresh(0,.99);run('state.hp=1;choose(0);confirm()');assert.equal(run('state.hp'),0);assert.equal(run('state.phase'),'over');
// Full draw through round 9 including a last-card swap.
fresh(.99,0);run('Math.random=()=>.99');
for(let n=0;n<7;n++){const id=run('state.player.find(c=>!c.used&&c.value===state.cpu[state.cpuPlan.index]).id');run(`choose(${id});confirm();next()`);}
run('choose(state.player.find(c=>!c.used).id);toggleSkill();confirm()');assert.equal(run('state.phase'),'reveal');
run('next();choose(state.player.find(c=>!c.used).id);confirm()');assert.equal(run('state.round'),9);assert.equal(run('state.phase'),'over');
// Seeded complete games check public inventory inference after every action.
let seed=123456789;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};g.context.Math.random=random;
for(let n=0;n<500;n++){
 run('start()');let count=0;
 while(run('state.phase')!=='over'){
  if(run('state.phase')==='reveal')run('next()');
  const ids=data('state.player.filter(c=>!c.used).map(c=>c.id)');run(`choose(${ids[Math.floor(random()*ids.length)]})`);if(random()<.4)run('toggleSkill()');run('confirm()');
  const history=data('state.history');assert.deepEqual(AI.reconstructPlayerCards(history).sort((a,b)=>a-b),data('state.player.filter(c=>!c.used).map(c=>c.value).sort((a,b)=>a-b)'));
  assert.equal(run('state.cpu.length'),run('state.player.filter(c=>!c.used).length'));
  assert.ok(run('state.hp>=0&&state.hp<=3&&state.cpuHp>=0&&state.cpuHp<=3'));
  assert.ok(history.filter(h=>h.amplified).length<=1);assert.ok(history.filter(h=>h.swapped).length<=1);assert.ok(++count<=9);
 }
}
const html=fs.readFileSync('dist/cortana-v1.3/index.html','utf8');assert(!/25%|1\/3|1\/4|softmax|概率|权重|记牌/.test(html));
console.log('PASS: exact 25% gate, skill groups, probability scoring, public-only inference, no rerolls, UI states, skill counter, 9-round draw, 500 seeded games.');
console.log('Opening normal probabilities by card: '+normal.map(p=>(100*p).toFixed(2)+'%').join(', '));
