const latest=require('../dist/ai.js'),old=require('../dist/cortana-v1.4/ai.js');
const deck=[1,1,1,1.5,2,2,2.5,3];
const rng=seed=>()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};
function play(ai,model,seed){
 const cRandom=rng(seed*31+42),pRandom=rng(seed*17+91),c=[...deck],p=[...deck],history=[];
 let ch=3,ph=3,cs=false,ps=false,models=[1/3,1/3,1/3];
 while(ch&&ph&&c.length){
  const plan=ai.planRound({ownCards:c,publicHistory:history,ownHp:ch,opponentHp:ph,skillUsed:cs,modelWeights:models},cRandom(),cRandom());
  let pi=Math.floor(pRandom()*p.length);const ticket=pRandom();const legal=p.map((v,i)=>v>1?i:-1).filter(i=>i>=0);
  let swapped=false;
  if(!ps&&legal.length){
   if(model==='counter'&&plan.skillActive){pi=legal.reduce((a,b)=>p[a]<=p[b]?a:b);swapped=true;}
   else if(model==='random'&&ticket<.15&&p[pi]>1)swapped=true;
   else if(model==='active'&&ticket<.6){pi=legal.reduce((a,b)=>p[a]<=p[b]?a:b);swapped=true;}
  }
  const player=p[pi],cpu=c[plan.index];
  if(plan.skillActive)cs=true;
  if(swapped){p[pi]=cpu;c[plan.index]=player;ps=true;}
  else{p.splice(pi,1);c.splice(plan.index,1);const damage=plan.skillActive?2:1;if(cpu>player)ph=Math.max(0,ph-damage);else if(cpu<player)ch=Math.max(0,ch-damage);}
  history.push({player,cpu,swapped,amplified:plan.skillActive});
  if(ai.updateBeliefs)models=ai.updateBeliefs(plan.evidence,{player,swapped});
 }
 return Math.sign(ch-ph);
}
const offset=Number(process.argv[2]||0),gameCount=Number(process.argv[3]||500);
for(const opponent of ['random','counter','never','active'])for(const [version,ai]of [['v1.4',old],['v1.4.1',latest]]){
 const scores={win:0,tie:0,loss:0};const games=gameCount;for(let n=0;n<games;n++){const result=play(ai,opponent,n+offset);scores[result>0?'win':result<0?'loss':'tie']++;}
 console.log(JSON.stringify({version,opponent,games,...scores,scoreRate:(scores.win+.5*scores.tie)/games}));
}
