'use strict';
const DECK=[1,1,1,1.5,2,2,2.5,3];
let state;
const $=id=>document.getElementById(id);
function start(){state={player:DECK.map((value,id)=>({value,id,used:false})),cpu:[...DECK],hp:3,cpuHp:3,round:1,selected:null,phase:'select',history:[],skillUsed:false,skillArmed:false};render();}
function choose(id){if(state.phase!=='select'||!Number.isInteger(id)||!state.player[id]||state.player[id].used)return false;state.selected=id;render();return true;}
function toggleSkill(){if(state.phase!=='select'||state.skillUsed)return false;state.skillArmed=!state.skillArmed;render();return true;}
function confirm(){
 if(state.phase!=='select'||state.selected===null)return false;
 const card=state.player[state.selected];if(card.used)return false;
 const index=Math.floor(Math.random()*state.cpu.length);
 const enemy=state.cpu[index],played=card.value,swapped=state.skillArmed&&!state.skillUsed;
 const result=swapped?0:Math.sign(played-enemy);
 if(swapped){card.value=enemy;state.cpu[index]=played;state.skillUsed=true;state.skillArmed=false;}
 else{state.cpu.splice(index,1);card.used=true;if(result<0)state.hp--;if(result>0)state.cpuHp--;}
 state.history.push({round:state.round,player:played,cpu:enemy,result,swapped});
 state.phase=state.hp===0||state.cpuHp===0||state.cpu.length===0?'over':'reveal';render();return true;
}function next(){if(state.phase!=='reveal')return false;state.round++;state.selected=null;state.phase='select';render();return true;}
function hearts(id,hp,name){$(id).innerHTML=[0,1,2].map(i=>`<span class="${i<hp?'':'lost'}" aria-hidden="true">♥</span>`).join('');$(id).setAttribute('aria-label',`${name}剩余 ${hp} 点血量`);}
function render(){hearts('your-hp',state.hp,'你');hearts('cpu-hp',state.cpuHp,'电脑');$('round').textContent=`第 ${String(state.round).padStart(2,'0')} 回合`;$('cpu-count').textContent=`· ${state.cpu.length} 张手牌`;$('cpu-hand').innerHTML=state.cpu.map(()=>'<div class="back" aria-hidden="true">♦</div>').join('');$('hand-count').textContent=`${state.player.filter(c=>!c.used).length} 张可用 · 点击选择`;
 $('hand').innerHTML=state.player.map(c=>`<button class="card ${c.used?'used':''} ${state.selected===c.id&&!c.used?'selected':''}" data-id="${c.id}" aria-label="${c.value} 点卡牌${c.used?'，已使用':''}" aria-pressed="${state.selected===c.id&&!c.used}" ${c.used||state.phase!=='select'?'disabled':''}><span class="corner">${c.value}</span><strong>${c.value}</strong><span class="diamond">♦</span></button>`).join('');
 const show=state.phase!=='select',last=state.history.at(-1);$('your-card').className=`battle-card ${show?'revealed':'empty'}`;$('their-card').className=`battle-card ${show?'revealed enemy':'empty'}`;$('your-card').textContent=show?last.player:'?';$('their-card').textContent=show?last.cpu:'?';
 let title='这一回合，你出几？',desc='选择一张手牌，确认后双方同时亮牌。',action='请先选择卡牌';
 if(state.phase==='select'&&state.selected!==null){desc=`已选择 ${state.player[state.selected].value} 点，确认前可以换牌。`;action='确认出牌';}
 if(show){title=last.result>0?'漂亮，这一回合你赢了':last.result<0?'这一回合，电脑胜出':'势均力敌，本回合平局';desc=last.result>0?'电脑扣除 1 点血量。':last.result<0?'你扣除 1 点血量。':'双方点数相同，血量不变。';action='下一回合';}
 if(show&&last.swapped){title='移花接木 · 交换完成';desc=`本回合不扣血。你获得 ${last.cpu} 点，电脑获得 ${last.player} 点；下回合可用。`;}
 if(state.phase==='select'&&state.skillArmed){desc='已开启移花接木：确认后本回合不扣血，交换双方出牌。';if(state.selected!==null)action='确认出牌并换牌';}
 const skill=$('skill');skill.disabled=state.skillUsed||state.phase!=='select';skill.setAttribute('aria-pressed',String(state.skillArmed));skill.textContent=state.skillUsed?'⇄ 移花接木 · 已用完':state.skillArmed?'✓ 本回合换牌 · 点击取消':'⇄ 移花接木 · 1 次';
 $('skill-description').textContent=state.skillUsed?'本局技能已消耗，新对局恢复。':'确认前开启：本回合不扣血，交换的牌回到双方手中。'; if(state.phase==='over'){const win=Math.sign(state.hp-state.cpuHp);title=win>0?'对局胜利！':win<0?'对局结束，惜败':'对局结束，平局';desc=`${state.hp===0||state.cpuHp===0?'一方血量归零。':'双方手牌已用完。'}最终血量 ${state.hp} : ${state.cpuHp}，${win>0?'你赢下了这场对决。':win<0?'再来一局，试试新的策略。':'这一局不分高下。'}`;action='再来一局';}
 $('status-title').textContent=title;$('status-desc').textContent=desc;$('action').innerHTML=`${action} <span>→</span>`;$('action').disabled=state.phase==='select'&&state.selected===null;$('selection-hint').textContent=state.phase==='over'?'相同的起点，下一局重新开始。':state.phase==='reveal'?'本回合已结算，继续你的对决。':'普通出牌会弃置；技能交换的牌可再用。';$('history-count').textContent=String(state.history.length).padStart(2,'0');$('history').innerHTML=state.history.length?[...state.history].reverse().map(h=>`<div class="history-item"><span>回合 ${String(h.round).padStart(2,'0')}</span><span class="nums">${h.player} : ${h.cpu}</span><span class="${h.result>0?'win':h.result<0?'loss':'draw'}">${h.swapped?'⇄ 换牌 · 不扣血':h.result>0?'电脑 −1 ♥':h.result<0?'你 −1 ♥':'平局'}</span></div>`).join(''):'<p class="history-empty">牌桌已就绪。<br>你的第一步，会是什么？</p>';
}
$('hand').addEventListener('click',e=>{const button=e.target.closest('[data-id]');if(button)choose(Number(button.dataset.id));});$('action').addEventListener('click',()=>{if(state.phase==='select')confirm();else if(state.phase==='reveal')next();else start();});$('restart').addEventListener('click',start);start();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'play_card',description:'选择并确认一张当前可用的手牌，立即结算本回合。回合结算后请使用界面的下一回合。',inputSchema:{type:'object',properties:{cardId:{type:'integer',minimum:0,maximum:7}},required:['cardId'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{if(!input||!choose(input.cardId))throw new Error('卡牌不可用，或当前不在选牌阶段');confirm();return{round:state.round,hp:state.hp,cpuHp:state.cpuHp,phase:state.phase,result:state.history.at(-1)};}})).catch(()=>{});}catch{}}
$('skill').addEventListener('click',toggleSkill);