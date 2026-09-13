// Reproducible balance check; this is a simulated opponent, not human play.
const AI=require('../dist/ai.js');
const DECK=[1,1,1,1.5,2,2,2.5,3];
const rng=seed=>()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};
function simulate(tactical,reactToSkill,game){
 const cRandom=rng(42+game*17),pRandom=rng(91+game*31);
 const cpu=[...DECK],player=[...DECK],history=[];
 let ownHp=3,opponentHp=3,skillUsed=false,swapUsed=false;
 while(ownHp>0&&opponentHp>0&&cpu.length){
  const gate=cRandom(),ticket=cRandom();
  const view={ownCards:cpu,publicHistory:history,ownHp,opponentHp,skillUsed};
  const plan=AI.planRound(view,gate,ticket);
  const ci=tactical||plan.skillActive?plan.index:Math.floor(ticket*cpu.length);
  const pi=Math.floor(pRandom()*player.length),swapTicket=pRandom();
  const swapped=!swapUsed&&(reactToSkill?plan.skillActive:swapTicket<.15);
  const pCard=player[pi],cCard=cpu[ci];
  if(plan.skillActive)skillUsed=true;
  if(swapped){player[pi]=cCard;cpu[ci]=pCard;swapUsed=true;}
  else{player.splice(pi,1);cpu.splice(ci,1);const damage=plan.skillActive?2:1;if(cCard>pCard)opponentHp=Math.max(0,opponentHp-damage);if(cCard<pCard)ownHp=Math.max(0,ownHp-damage);}
  history.push({player:pCard,cpu:cCard,swapped});
 }
 return Math.sign(ownHp-opponentHp);
}
const games=6000;
for(const react of [false,true]){
 for(const tactical of [false,true]){
  const results={wins:0,draws:0,losses:0};
  for(let i=0;i<games;i++){const outcome=simulate(tactical,react,i);results[outcome>0?'wins':outcome<0?'losses':'draws']++;}
  console.log(JSON.stringify({opponent:react?'uniform cards, saves swap to counter skill':'uniform cards, random swap',normalStrategy:tactical?'v1.3 public-information scoring':'uniform baseline with same skill rules',games,...results,score:((results.wins+.5*results.draws)/games*100).toFixed(2)+'%'}));
 }
}
