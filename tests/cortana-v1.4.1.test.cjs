const {strict:assert}=require('node:assert');
const fs=require('node:fs'),vm=require('node:vm');
const AI=require('../dist/cortana-v1.4.1/ai.js');
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
const lethal=AI.analyzePosition({c:[1,3],p:[2,2.5],ch:1,ph:2,cs:true,ps:false});assert.ok(lethal.powered.value>lethal.normal.value);assert.equal(lethal.skillProbability,1);
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
function game(){const els={};const context={document:{getElementById:id=>els[id]??(els[id]={attributes:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(){}})},Math:Object.create(Math)};context.Math.random=()=>.99;vm.createContext(context);vm.runInContext(fs.readFileSync('dist/cortana-v1.4.1/ai.js','utf8'),context);vm.runInContext(fs.readFileSync('dist/cortana-v1.4.1/game.js','utf8'),context);return{context,els,run:s=>vm.runInContext(s,context)};}
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
const html=fs.readFileSync('dist/cortana-v1.4.1/index.html','utf8');assert.match(html,/对 Cortana 隐藏/);assert.match(html,/大于 1 点/);assert(!/softmax|概率|权重|记牌|后验|前瞻/.test(html));
console.log('PASS: legal moves, UI disable/cancel, hidden-input isolation, joint predictions, adaptive skill, two-HP lethal, frozen evidence, posterior, counters, simulator parity and 80 complete games.');
console.log(JSON.stringify({lethalSkillProbability:lethal.skillProbability,openingSkillProbability:opening.skillProbability,openingSwapGuess:opening.normal.swapProbability,openingPoweredSwapGuess:opening.powered.swapProbability}));


// v1.4.1: exact support checks, an independent game oracle, and reachable histories.
function step141(s, cv, pv, power, swap) {
  const c = [...s.c], p = [...s.p];
  const ci = c.indexOf(cv), pi = p.indexOf(pv);
  assert.ok(ci >= 0 && pi >= 0 && (!power || s.cs) && (!swap || (s.ps && pv > 1)));
  c.splice(ci, 1); p.splice(pi, 1);
  let ch = s.ch, ph = s.ph;
  if (swap) { c.push(pv); p.push(cv); }
  else if (cv > pv) ph = Math.max(0, ph - (power ? 2 : 1));
  else if (cv < pv) ch = Math.max(0, ch - (power ? 2 : 1));
  return {c:c.sort((a,b)=>a-b),p:p.sort((a,b)=>a-b),ch,ph,cs:s.cs&&!power,ps:s.ps&&!swap};
}
function replies141(s) {
  return [...new Set(s.p)].flatMap(v => s.ps && v > 1 ? [[v,false],[v,true]] : [[v,false]]);
}
function supported141(s, a) {
  const result = [];
  for (const power of [false,true]) {
    const chance = power ? a.skillProbability : 1-a.skillProbability;
    if (!chance) continue;
    const mode = power ? a.powered : a.normal;
    close(mode.probabilities.reduce((x,y)=>x+y,0),1);
    for (const model of mode.evidence.models) close(model.reduce((x,y)=>x+y,0),1);
    mode.probabilities.forEach((p,i) => {
      assert.ok(Number.isFinite(p)&&p>=0);
      if (p) result.push({value:s.c[i],power,evidence:mode.evidence});
    });
  }
  assert.ok(result.length);
  return result;
}
const oracleMemo141 = new Map();
function oracle141(s, lethal) {
  if (s.ch<=0) return false;
  if (s.ph<=0) return true;
  if (!s.c.length || !s.p.length) return !lethal && s.ch>s.ph;
  const key=JSON.stringify([s,lethal]);
  if(oracleMemo141.has(key)) return oracleMemo141.get(key);
  const won=[...new Set(s.c)].some(cv=>(s.cs?[false,true]:[false]).some(power=>
    replies141(s).every(([pv,swap])=>oracle141(step141(s,cv,pv,power,swap),lethal))));
  oracleMemo141.set(key,won); return won;
}
let basic141=0;
for (const maximum of [1,1.5,2,2.5]) for (const killer of [1.5,2,2.5,3].filter(v=>v>maximum))
for (const hp of [1,2]) {
  basic141++;
  for (const ownHp of [1,2,3]) for (const weights of [[1,0,0],[0,1,0],[0,0,1],[1,1,1]]) {
    const s={c:[killer,1,killer],p:[1,maximum,maximum],ch:ownHp,ph:hp,cs:true,ps:false};
    const a=AI.analyzePosition(s,weights);
    assert.equal(a.guarantee.kind,'lethal'); assert.equal(a.guarantee.rounds,1);
    assert.equal(a.skillProbability,hp===2?1:0);
    for(const move of supported141(s,a)) for(const [pv,swap]of replies141(s))
      assert.equal(step141(s,move.value,pv,move.power,swap).ph,0);
  }
}
assert.equal(basic141,20);
for(const hp of [1,2]) {
  const a=AI.analyzePosition({c:[1,1.5,2],p:[1,1,1],ch:1,ph:hp,cs:true,ps:true});
  assert.equal(a.guarantee.kind,'lethal');assert.equal(a.guarantee.rounds,1);
}
assert.equal(AI.analyzePosition({c:[3],p:[2],ch:1,ph:1,cs:false,ps:false}).guarantee.kind,'lethal');
// These are not one-round lethal: ties, legal swaps, three HP, and spent power.
for(const s of [
 {c:[3],p:[3],ch:2,ph:2,cs:true,ps:false},
 {c:[2.5],p:[2.5],ch:2,ph:2,cs:true,ps:false},
 {c:[3],p:[2],ch:2,ph:2,cs:true,ps:true},
 {c:[3],p:[2],ch:2,ph:3,cs:true,ps:false},
 {c:[3],p:[2],ch:2,ph:2,cs:false,ps:false},
]) {
 const a=AI.analyzePosition(s);
 assert.ok(!a.guarantee||a.guarantee.kind!=='lethal'||a.guarantee.rounds!==1);
}
const exhausted141=AI.analyzePosition({c:[1],p:[1],ch:3,ph:2,cs:false,ps:false});
assert.equal(exhausted141.guarantee.kind,'win');assert.equal(exhausted141.guarantee.rounds,1);
assert.equal(AI.sampleIndex([.49999999999999994,.49999999999999994,0],1-Number.EPSILON/2),1);
assert.equal(AI.sampleIndex([0,1,0],0),1);assert.equal(AI.sampleIndex([0,1,0],1-Number.EPSILON),1);
assert.throws(()=>AI.sampleIndex([0,0],.9));
assert.throws(()=>AI.sampleIndex([1],1));

// Reachable fixtures: [C card, player card, swap=false, power=false].
const fixtures141=[
 {name:'three HP, two hits',rounds:2,s:{c:[1,2,2,2],p:[1,1,1,1.5],ch:1,ph:3,cs:true,ps:false},
  history:[[2.5,2.5],[3,3],[1.5,2,true],[1,2],[1,1.5]]},
 {name:'power already spent',rounds:2,s:{c:[2,2.5,3],p:[1,1,1],ch:1,ph:2,cs:false,ps:false},
  history:[[1.5,1.5],[1,2.5],[1,3,true,true],[1,2],[2,2],[3,1]]},
 {name:'three twos exhaust the equal card',rounds:3,s:{c:[2,2,2],p:[1,1,2],ch:1,ph:2,cs:true,ps:false},
  history:[[1,2.5],[1,3],[2.5,2,true],[3,2.5],[1.5,1.5],[1,1]]},
 {name:'force the three or absorb one hit',rounds:3,s:{c:[2,2.5,3],p:[1,1.5,3],ch:2,ph:2,cs:true,ps:false},
  history:[[1,2.5,true],[1,1],[1,1],[1.5,2],[2,2],[2.5,1]]},
 {name:'save three against a swap',rounds:2,s:{c:[1,1,2.5,3],p:[1,1,2,2],ch:1,ph:1,cs:true,ps:true},
  history:[[2,1.5],[2,1],[1,2.5],[1.5,3]]},
 {name:'smaller card covers every reply',rounds:2,s:{c:[1,1,1.5,2],p:[1,1,1,2.5],ch:2,ph:1,cs:true,ps:true},
  history:[[2.5,2],[3,3],[2,1.5],[1,2]]},
 {name:'finish with the received card',rounds:3,s:{c:[1,1,2,2],p:[1,1,1,1.5],ch:1,ph:1,cs:true,ps:true},
  history:[[3,2.5],[1,3],[1.5,2],[2.5,2]]},
 {name:'reported seven-card lethal',rounds:1,s:{c:[1,1,1,2,2,2.5,3],p:[1,1,1,1.5,1.5,2,2],ch:3,ph:2,cs:true,ps:false},
  history:[[1.5,3,true],[3,2.5]]},
];
function view141(s,history,weights) {
  return {ownCards:s.c,publicHistory:history,ownHp:s.ch,opponentHp:s.ph,skillUsed:!s.cs,modelWeights:weights};
}
function replay141(fixture) {
 let s={c:[...deck],p:[...deck],ch:3,ph:3,cs:true,ps:true},history=[],weights=[1/3,1/3,1/3];
 for(const [cv,pv,swap=false,power=false] of fixture.history) {
   const analysis=AI.analyzeRound(view141(s,history,weights));
   const observation={cpu:cv,player:pv,swapped:swap};
   weights=AI.updateBeliefs((power?analysis.powered:analysis.normal).evidence,observation);
   s=step141(s,cv,pv,power,swap);history.push(observation);
 }
 assert.deepEqual(s,fixture.s,fixture.name);
 assert.deepEqual(AI.reconstructPlayerCards(history).sort((a,b)=>a-b),s.p);
 return {s,history,weights};
}
let policyBranches141=0;
function auditPolicy141(s,history,weights,left) {
 if(s.ph===0){assert.ok(s.ch>0);return;}
 assert.ok(left>0&&s.ch>0&&s.c.length>0);
 const a=AI.analyzeRound(view141(s,history,weights));
 assert.equal(a.guarantee?.kind,'lethal');
 for(const move of supported141(s,a)) for(const [pv,swap]of replies141(s)) {
   policyBranches141++;
   const obs={cpu:move.value,player:pv,swapped:swap};
   const next=step141(s,move.value,pv,move.power,swap);
   auditPolicy141(next,[...history,obs],AI.updateBeliefs(move.evidence,obs),left-1);
 }
}
for(const fixture of fixtures141) {
 const {s,history,weights}=replay141(fixture);
 auditPolicy141(s,history,weights,fixture.rounds);
 if(fixture.name==='reported seven-card lethal') {
   // Test the public API with unordered cards, zero-probability trailing cards,
   // extreme RNG tickets and every independent player-model weighting.
   for(const ownCards of [s.c,[3,2,1,2.5,1,2,1]]) for(const modelWeights of [[1,0,0],[0,1,0],[0,0,1],weights])
   for(const skillTicket of [0,.5,1-Number.EPSILON]) for(const cardTicket of [0,.5,1-Number.EPSILON]) {
     const plan=AI.planRound({...view141(s,history,modelWeights),ownCards},skillTicket,cardTicket);
     assert.equal(plan.skillActive,true);assert.ok([2.5,3].includes(ownCards[plan.index]));
     assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.evidence.models));
   }
 }
}
const saveThree141=AI.analyzePosition(fixtures141[4].s);
assert.equal(saveThree141.skillProbability,0);assert.equal(saveThree141.normal.probabilities[2],1);
const noSuicide141=AI.analyzePosition(fixtures141[5].s);
assert.equal(noSuicide141.skillProbability,0);

// Exhaustive synthetic small hands, including repeated cards and both skills.
// The independent oracle implements the rules above, not the AI's transition.
const values141=[1,1.5,2,2.5,3];
const hands141=[values141.map(v=>[v]),values141.flatMap((v,i)=>values141.slice(i).map(w=>[v,w]))];
let exhaustive141=0,proven141=0;
for(const hands of hands141) for(const c of hands) for(const p of hands)
for(const ch of [1,2,3]) for(const ph of [1,2,3]) for(const cs of [false,true]) for(const ps of [false,true]) {
 const s={c,p,ch,ph,cs,ps},a=AI.analyzePosition(s);
 const win=oracle141(s,false);
 assert.equal(Boolean(a.guarantee),win,JSON.stringify(s));
 if(a.guarantee) {
   proven141++;
   for(const move of supported141(s,a)) for(const [pv,swap]of replies141(s))
     assert.ok(oracle141(step141(s,move.value,pv,move.power,swap),a.guarantee.kind==='lethal'),JSON.stringify(s));
 }
 exhaustive141++;
}
// Four-card search must continue past the large-hand three-round cutoff.
for(const ps of [false,true]) {
 const s={c:[2,2,2.5,3],p:[1,1,2.5,3],ch:3,ph:2,cs:false,ps};
 const a=AI.analyzePosition(s);
 assert.equal(a.guarantee.kind,'lethal');assert.equal(a.guarantee.rounds,4);
 for(const move of supported141(s,a)) for(const [pv,swap]of replies141(s))
   assert.ok(oracle141(step141(s,move.value,pv,move.power,swap),true));
}
// The real UI resolver must honor the same locked, public-history-based kill.
fresh();
const actual141=fixtures141.at(-1);
run('state.cpu=[1,1,1,2,2,2.5,3];state.player=[1,1,1,1.5,1.5,2,2].map((value,id)=>({value,id,used:false}));state.hp=2;state.cpuHp=3;state.skillUsed=true;state.history=[{round:1,player:3,cpu:1.5,swapped:true},{round:2,player:2.5,cpu:3,swapped:false}];state.cpuModels=[1/3,1/3,1/3];state.cpuSkillUsed=false;state.phase="select";prepareRound();render()');
assert.equal(run('state.cpuSkillActive'),true);
run('Math.random=()=>{throw Error("No reroll during confirmation")};choose(5);confirm()');
assert.equal(run('state.hp'),0);assert.equal(run('state.cpuHp'),3);assert.equal(run('state.phase'),'over');
console.log(JSON.stringify({version:'1.4.1',basicLethalClasses:basic141,reachableFixtures:fixtures141.length,policyBranches:policyBranches141,exhaustivePositions:exhaustive141,provenPositions:proven141}));
