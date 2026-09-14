const {strict:assert}=require('node:assert');
const fs=require('node:fs'),vm=require('node:vm');
const AI=require('../dist/cortana-v1.4/ai.js');
const deck=[1,1,1,1.5,2,2,2.5,3];
const view={ownCards:deck,publicHistory:[],ownHp:3,opponentHp:3,skillUsed:false,modelWeights:[1/3,1/3,1/3]};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function verifyMode(mode){close(mode.probabilities.reduce((a,b)=>a+b,0),1);mode.probabilities.forEach(p=>assert.ok(Number.isFinite(p)&&p>0));for(const model of mode.evidence.models)close(model.reduce((a,b)=>a+b,0),1);assert.ok(mode.swapProbability>=0&&mode.swapProbability<=1);}
const opening=AI.analyzeRound(view);verifyMode(opening.normal);verifyMode(opening.powered);
assert.ok(opening.skillProbability>0&&opening.skillProbability<1);
assert.ok(opening.normal.swapProbability>0&&opening.normal.swapProbability<1);assert.ok(opening.powered.swapProbability>0&&opening.powered.swapProbability<1);
assert.ok(opening.powered.swapProbability>opening.normal.swapProbability);
assert.ok(opening.normal.evidence.actions.every(a=>!a.swapped||a.value>1));
const noSwap=AI.analyzePosition({c:[1,2,3],p:[1,2,3],ch:3,ph:2,cs:true,ps:false});assert.equal(noSwap.normal.swapProbability,0);assert.equal(noSwap.powered.swapProbability,0);
const allOne=AI.analyzePosition({c:[1.5,2],p:[1,1],ch:3,ph:2,cs:true,ps:true});assert.equal(allOne.normal.swapProbability,0);assert.equal(allOne.powered.swapProbability,0);
const singleLegal=AI.playerActions({p:[1,1,1.5],ps:true}).filter(a=>a.swapped);assert.deepEqual(singleLegal,[{value:1.5,count:1,swapped:true}]);
const usedHistory=[{player:1.5,cpu:3,swapped:true}];const used=AI.analyzeRound({...view,publicHistory:usedHistory});assert.equal(used.normal.swapProbability,0);assert.equal(used.powered.swapProbability,0);
assert.equal(AI.analyzeRound({...view,skillUsed:true}).skillProbability,0);assert.equal(AI.analyzeRound({...view,skillUsed:true}).powered,null);
// A lethal two-HP opportunity: without the power, C's low remaining card loses next.
const lethal=AI.analyzePosition({c:[1,3],p:[2,2.5],ch:1,ph:2,cs:true,ps:false});assert.ok(lethal.powered.value>lethal.normal.value);assert.ok(lethal.skillProbability>.25);
const p1=AI.analyzePosition({c:[1,3],p:[2,2.5],ch:1,ph:1,cs:true,ps:false});assert.ok(lethal.skillProbability>p1.skillProbability);
// Terminal risk and exchange transitions use real rules, including skill consumption.
const position={c:[1,3],p:[1.5,2],ch:2,ph:2,cs:true,ps:true};
assert.throws(()=>AI.transition({...position,p:[1,2]},3,{value:1,swapped:true},true));
const counter=AI.transition(position,3,{value:1.5,swapped:true},true);assert.deepEqual(counter,{c:[1,1.5],p:[2,3],ch:2,ph:2,cs:false,ps:false});
const loss=AI.transition(position,1,{value:2,swapped:false},true);assert.equal(AI.leafValue(loss),-1);assert.equal(loss.ch,0);
const win=AI.transition(position,3,{value:2,swapped:false},true);assert.equal(AI.leafValue(win),1);assert.equal(win.ph,0);
const tie=AI.transition({...position,c:[1,2]},2,{value:2,swapped:false},true);assert.equal(tie.cs,false);assert.equal(tie.ch,2);assert.equal(tie.ph,2);
// Unknown fields are poisonous: fair decisions must ignore them.
const poisoned={...view};for(const key of ['player','selected','skillArmed','playerSkillUsed'])Object.defineProperty(poisoned,key,{get(){throw Error('Hidden input '+key)}});
assert.deepEqual(AI.planRound(poisoned,.3,.6),AI.planRound(view,.3,.6));
const plan=AI.planRound(view,0,.99);assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.evidence)&&Object.isFrozen(plan.evidence.models[0]));
const observation={player:1.5,swapped:true};Object.defineProperty(observation,'cpu',{get(){throw Error('Do not condition likelihood on revealed C card')}});
const posterior=AI.updateBeliefs(plan.evidence,observation);close(posterior.reduce((a,b)=>a+b,0),1);assert.ok(posterior.every(w=>w>=.1));assert.ok(Object.isFrozen(posterior));
function game(){const els={};const context={document:{getElementById:id=>els[id]??(els[id]={attributes:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(){}})},Math:Object.create(Math)};context.Math.random=()=>.99;vm.createContext(context);vm.runInContext(fs.readFileSync('dist/cortana-v1.4/ai.js','utf8'),context);vm.runInContext(fs.readFileSync('dist/cortana-v1.4/game.js','utf8'),context);return{context,els,run:s=>vm.runInContext(s,context)};}
const g=game(),run=g.run,data=s=>JSON.parse(JSON.stringify(run(s)));
const fresh=(a=.99,b=.99)=>run(`Math.random=(()=>{let d=[${a},${b}];return()=>d.length?d.shift():.99})();start()`);
// UI restriction, auto-cancel, no charge and actual settlement guard.
fresh();run('choose(0)');assert.equal(g.els.skill.disabled,true);assert.match(g.els['skill-description'].textContent,/1 点牌不能/);assert.equal(run('toggleSkill()'),false);
run('choose(3);toggleSkill()');assert.equal(run('state.skillArmed'),true);assert.equal(g.els.skill.disabled,false);
run('choose(1)');assert.equal(run('state.skillArmed'),false);assert.equal(run('state.skillUsed'),false);assert.equal(g.els.skill.disabled,true);
run('choose(3)');assert.equal(g.els.skill.disabled,false);assert.equal(run('state.skillArmed'),false);
run('choose(0);state.skillArmed=true');const before=data('[state.hp,state.cpuHp,state.history.length,state.cpuSkillUsed,state.cpu.length]');assert.equal(run('confirm()'),false);assert.deepEqual(data('[state.hp,state.cpuHp,state.history.length,state.cpuSkillUsed,state.cpu.length]'),before);
fresh();run('toggleSkill();choose(0)');assert.equal(run('state.skillArmed'),false);assert.equal(run('state.skillUsed'),false);
// Preparing C cannot touch player inputs, even the internal player skill flag.
fresh();run(`(()=>{const names=['player','selected','skillArmed','skillUsed'];const saved=names.map(n=>Object.getOwnPropertyDescriptor(state,n));try{names.forEach(n=>Object.defineProperty(state,n,{configurable:true,get(){throw Error('Hidden field accessed')}}));prepareRound();}finally{names.forEach((n,i)=>Object.defineProperty(state,n,saved[i]));}})()`);
// Same locked card with or without exchange, and no RNG after player input.
for(const swap of [false,true]){
 fresh(0,.8);const locked=run('state.cpu[state.cpuPlan.index]'),saved=data('state.cpuPlan');
 run('Math.random=()=>{throw Error("Reroll")};choose(3);toggleSkill();toggleSkill();choose(4);choose(3)');if(swap)run('toggleSkill()');assert.deepEqual(data('state.cpuPlan'),saved);run('confirm()');assert.equal(run('state.history[0].cpu'),locked);assert.equal(run('confirm()'),false);assert.doesNotMatch(g.els['cpu-ready'].className,/lit/);
}
fresh(0,.99);run('choose(3);toggleSkill();confirm()');assert.deepEqual(data('[state.hp,state.cpuHp,state.skillUsed,state.cpuSkillUsed]'),[3,3,true,true]);assert.equal(run('state.history[0].countered'),true);assert.equal(run('state.cpu.length'),8);assert.equal(run('state.player[3].value'),3);assert.equal(run('state.history[0].player'),1.5);
run('Math.random=()=>0;next()');assert.equal(run('state.cpuSkillActive'),false);assert.equal(run('toggleSkill()'),false);
fresh();assert.deepEqual(data('state.cpuModels'),[1/3,1/3,1/3]);assert.equal(run('state.skillUsed'),false);
// Take ties in ascending order, then exchange the last legal card and reach round 9.
fresh(.99,0);run('Math.random=(()=>{let i=0;return()=>i++%2===0?.99:0})()');for(let n=0;n<7;n++){const id=run('state.player.find(c=>!c.used&&c.value===state.cpu[state.cpuPlan.index]).id');run(`choose(${id});confirm();next()`);}
assert.equal(run('state.player.find(c=>!c.used).value'),3);
run('choose(state.player.find(c=>!c.used).id);toggleSkill();confirm()');assert.equal(run('state.phase'),'reveal');
run('next();choose(state.player.find(c=>!c.used).id);confirm()');assert.equal(run('state.round'),9);assert.equal(run('state.phase'),'over');// Full seeded games, auditing public inventory and simulator against actual resolution.
let seed=8142026;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};g.context.Math.random=random;
for(let i=0;i<80;i++){
 run('start()');let steps=0;
 while(run('state.phase')!=='over'){
  if(run('state.phase')==='reveal')run('next()');
  const cards=data('state.player.filter(c=>!c.used)');run(`choose(${cards[Math.floor(random()*cards.length)].id})`);if(random()<.4)run('toggleSkill()');
  const position=data('({c:[...state.cpu],p:state.player.filter(c=>!c.used).map(c=>c.value),ch:state.cpuHp,ph:state.hp,cs:!state.cpuSkillUsed,ps:!state.skillUsed})');
  const played=data('({value:state.player[state.selected].value,swapped:state.skillArmed})');const expected=AI.transition(position,run('state.cpu[state.cpuPlan.index]'),played,run('state.cpuSkillActive'));run('confirm()');
  assert.deepEqual(data('state.cpu.slice().sort((a,b)=>a-b)'),expected.c);assert.deepEqual(data('state.player.filter(c=>!c.used).map(c=>c.value).sort((a,b)=>a-b)'),expected.p);assert.equal(run('state.cpuHp'),expected.ch);assert.equal(run('state.hp'),expected.ph);
  const history=data('state.history');assert.deepEqual(AI.reconstructPlayerCards(history).sort((a,b)=>a-b),expected.p);assert.ok(history.every(h=>!h.swapped||h.player>1));assert.ok(history.filter(h=>h.swapped).length<=1);assert.ok(history.filter(h=>h.amplified).length<=1);assert.ok(++steps<=9);
 }
}
const html=fs.readFileSync('dist/cortana-v1.4/index.html','utf8');assert.match(html,/对 Cortana 隐藏/);assert.match(html,/大于 1 点/);assert(!/softmax|概率|权重|记牌|后验|前瞻/.test(html));
console.log('PASS: legal moves, UI disable/cancel, hidden-input isolation, joint predictions, adaptive skill, two-HP lethal, frozen evidence, posterior, counters, simulator parity and 80 complete games.');
console.log(JSON.stringify({lethalSkillProbability:lethal.skillProbability,openingSkillProbability:opening.skillProbability,openingSwapGuess:opening.normal.swapProbability,openingPoweredSwapGuess:opening.powered.swapProbability}));
