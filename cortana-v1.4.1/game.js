'use strict';
const DECK = [1, 1, 1, 1.5, 2, 2, 2.5, 3];
const $ = id => document.getElementById(id);
let state;

function prepareRound() {
  const publicView = {
    ownCards: [...state.cpu],
    publicHistory: state.history.map(({ player, cpu, swapped }) => ({ player, cpu, swapped })),
    ownHp: state.cpuHp,
    opponentHp: state.hp,
    skillUsed: state.cpuSkillUsed,
    modelWeights: state.cpuModels,
  };
  state.cpuPlan = CortanaAI.planRound(publicView, Math.random(), Math.random());
  state.cpuSkillActive = state.cpuPlan.skillActive;
}
function start() {
  state = {
    player: DECK.map((value, id) => ({ value, id, used: false })),
    cpu: [...DECK], hp: 3, cpuHp: 3, round: 1, selected: null,
    phase: 'select', history: [], skillUsed: false, skillArmed: false,

    cpuSkillUsed: false, cpuSkillActive: false,
    cpuPlan: null,
    cpuModels: [1 / 3, 1 / 3, 1 / 3],
  };
  prepareRound();
  render();
}
function choose(id) {
  if (state.phase !== 'select' || !Number.isInteger(id) || !state.player[id] || state.player[id].used) return false;
  state.selected = id;
  if (state.player[id].value === 1) state.skillArmed = false;
  render();
  return true;
}
function toggleSkill() {
  if (state.phase !== 'select' || state.skillUsed || (state.selected !== null && state.player[state.selected].value === 1)) return false;
  state.skillArmed = !state.skillArmed;
  render();
  return true;
}
function confirm() {
  if (state.phase !== 'select' || state.selected === null) return false;
  const card = state.player[state.selected];
  if (card.used || (state.skillArmed && card.value === 1)) return false;
  const swapped = state.skillArmed && !state.skillUsed;
  const index = state.cpuPlan.index;
  const enemy = state.cpu[index], played = card.value;
  const amplified = state.cpuSkillActive;
  const result = swapped ? 0 : Math.sign(played - enemy);
  const damage = result === 0 ? 0 : amplified ? 2 : 1;
  if (amplified) state.cpuSkillUsed = true;
  if (swapped) {
    card.value = enemy;
    state.cpu[index] = played;
    state.skillUsed = true;
    state.skillArmed = false;
  } else {
    state.cpu.splice(index, 1);
    card.used = true;
    if (result < 0) state.hp = Math.max(0, state.hp - damage);
    if (result > 0) state.cpuHp = Math.max(0, state.cpuHp - damage);
  }
  state.history.push({ round: state.round, player: played, cpu: enemy, result, damage, swapped, amplified, countered: swapped && amplified });
  state.cpuModels = CortanaAI.updateBeliefs(state.cpuPlan.evidence, { player: played, swapped });
  state.cpuSkillActive = false;
  state.phase = state.hp === 0 || state.cpuHp === 0 || state.cpu.length === 0 ? 'over' : 'reveal';
  render();
  return true;
}
function next() {
  if (state.phase !== 'reveal') return false;
  state.round++;
  state.selected = null;
  state.phase = 'select';
  prepareRound();
  render();
  return true;
}
function hearts(id, hp, name) {
  $(id).innerHTML = [0, 1, 2].map(i => `<span class="${i < hp ? '' : 'lost'}" aria-hidden="true">♥</span>`).join('');
  $(id).setAttribute('aria-label', `${name}剩余 ${hp} 点血量`);
}
function render() {
  const selecting = state.phase === 'select';
  const last = state.history.at(-1);
  hearts('your-hp', state.hp, '你');
  hearts('cpu-hp', state.cpuHp, 'Cortana');
  $('round').textContent = `第 ${String(state.round).padStart(2, '0')} 回合`;
  $('cpu-count').textContent = `${state.cpu.length} 张手牌`;
  $('cpu-hand').innerHTML = state.cpu.map(() => '<div class="back" aria-hidden="true">♦</div>').join('');
  $('cpu-ready').className = `state-badge ${selecting ? 'lit' : ''}`;
  $('cpu-ready').textContent = '已选牌';
  $('cpu-ready').setAttribute('aria-label', selecting ? 'Cortana 已选牌，等待你确认' : '本回合已亮牌，选牌状态熄灭');
  $('cpu-skill').className = `state-badge power-badge ${selecting && state.cpuSkillActive ? 'lit' : ''}`;
  $('cpu-skill').textContent = state.cpuSkillActive ? '伤害 ×2' : state.cpuSkillUsed ? '技能已用' : '技能待用';
  $('cpu-skill').setAttribute('aria-label', state.cpuSkillActive ? 'Cortana 已发动技能：本回合伤害翻倍' : state.cpuSkillUsed ? 'Cortana 本局技能已用完' : 'Cortana 技能尚未发动');
  $('hand-count').textContent = `${state.player.filter(c => !c.used).length} 张可用 · 点击选择`;
  $('hand').innerHTML = state.player.map(c => `<button class="card ${c.used ? 'used' : ''} ${state.selected === c.id && !c.used ? 'selected' : ''}" data-id="${c.id}" aria-label="${c.value} 点卡牌${c.used ? '，已使用' : ''}" aria-pressed="${state.selected === c.id && !c.used}" ${c.used || !selecting ? 'disabled' : ''}><span class="corner">${c.value}</span><strong>${c.value}</strong><span class="diamond">♦</span></button>`).join('');
  $('your-card').className = `battle-card ${selecting ? 'empty' : 'revealed'}`;
  $('their-card').className = `battle-card ${selecting ? 'empty' : 'revealed enemy'}`;
  $('your-card').textContent = selecting ? '?' : last.player;
  $('their-card').textContent = selecting ? '?' : last.cpu;
  let title = '这一回合，你出几？';
  let desc = 'C 已选牌。选择你的手牌，确认后双方同时亮牌。';
  let action = '请先选择卡牌';
  if (selecting && state.selected !== null) {
    desc = `已选择 ${state.player[state.selected].value} 点，确认前可以换牌。`;
    action = '确认出牌';
  }
  if (selecting && state.cpuSkillActive) {
    title = 'C 已发动技能 · 本回合伤害 ×2';
    desc = '本回合落败的一方扣 2 点血，平局不扣血。';
  }
  if (selecting && state.skillArmed) {
    desc = state.cpuSkillActive ? '移花接木已开启：不扣血、交换卡牌，并抵消 C 的技能。' : '已开启移花接木：本回合不扣血，交换双方出牌。';
    if (state.selected !== null) action = '确认出牌并换牌';
  }
  if (!selecting) {
    title = last.result > 0 ? '漂亮，这一回合你赢了' : last.result < 0 ? '这一回合，Cortana 胜出' : '势均力敌，本回合平局';
    desc = last.result > 0 ? `Cortana 扣除 ${last.damage} 点血量。` : last.result < 0 ? `你扣除 ${last.damage} 点血量。` : '双方点数相同，血量不变。';
    if (last.amplified) desc += 'C 的技能已消耗。';
    action = '下一回合';
    if (last.swapped) {
      title = last.countered ? '移花接木 · C 的技能已抵消' : '移花接木 · 交换完成';
      desc = `不扣血。你获得 ${last.cpu} 点，C 获得 ${last.player} 点，下回合可用。${last.countered ? '双方技能均已消耗。' : ''}`;
    }
  }
  const oneSelected = state.selected !== null && state.player[state.selected].value === 1;
  $('skill').disabled = state.skillUsed || !selecting || oneSelected;
  $('skill').setAttribute('aria-pressed', String(state.skillArmed));
  $('skill').textContent = state.skillUsed ? '⇄ 移花接木 · 已用完' : state.skillArmed ? '✓ 本回合换牌 · 点击取消' : '⇄ 移花接木 · 1 次';
  $('skill-description').textContent = state.skillUsed ? '本局技能已消耗，新对局恢复。' : oneSelected && selecting ? '1 点牌不能使用移花接木。技能未消耗，换一张牌即可开启。' : '选择大于 1 点的牌才能开启；不扣血并交换卡牌，C 无法得知你是否开启。';
  if (state.phase === 'over') {
    const win = Math.sign(state.hp - state.cpuHp);
    title = win > 0 ? '对局胜利！' : win < 0 ? '对局结束，惜败' : '对局结束，平局';
    desc = `${state.hp === 0 || state.cpuHp === 0 ? '一方血量归零。' : '双方手牌已用完。'}最终血量 ${state.hp} : ${state.cpuHp}，${win > 0 ? '你赢下了这场对决。' : win < 0 ? '再来一局，试试新的策略。' : '这一局不分高下。'}`;
    action = '再来一局';
  }
  $('status-title').textContent = title;
  $('status-desc').textContent = desc;
  $('action').innerHTML = `${action} <span>→</span>`;
  $('action').disabled = selecting && state.selected === null;
  $('selection-hint').textContent = state.phase === 'over' ? '相同的起点，下一局重新开始。' : selecting ? '普通出牌会弃置；技能交换的牌可再用。' : '本回合已结算，继续你的对决。';
  $('history-count').textContent = String(state.history.length).padStart(2, '0');
  $('history').innerHTML = state.history.length ? [...state.history].reverse().map(h => {
    const result = h.countered ? '⇄ 换牌 · 抵消 ×2' : h.swapped ? '⇄ 换牌 · 不扣血' : h.result > 0 ? `C −${h.damage} ♥` : h.result < 0 ? `你 −${h.damage} ♥` : h.amplified ? '平局 · ×2 已消耗' : '平局';
    return `<div class="history-item"><span>回合 ${String(h.round).padStart(2, '0')}</span><span class="nums">${h.player} : ${h.cpu}</span><span class="${h.result > 0 ? 'win' : h.result < 0 ? 'loss' : 'draw'}">${result}</span></div>`;
  }).join('') : '<p class="history-empty">牌桌已就绪。<br>你的第一步，会是什么？</p>';
}
$('hand').addEventListener('click', e => { const button = e.target.closest('[data-id]'); if (button) choose(Number(button.dataset.id)); });
$('action').addEventListener('click', () => { if (state.phase === 'select') confirm(); else if (state.phase === 'reveal') next(); else start(); });
$('restart').addEventListener('click', start);
$('skill').addEventListener('click', toggleSkill);
start();
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'play_card',
      description: '选择并确认一张当前可用手牌，按界面中已开启的双方技能结算本回合。',
      inputSchema: { type: 'object', properties: { cardId: { type: 'integer', minimum: 0, maximum: 7 } }, required: ['cardId'], additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute: async input => {
        if (!input || !choose(input.cardId)) throw new Error('卡牌不可用，或当前不在选牌阶段');
        confirm();
        return { round: state.round, hp: state.hp, cpuHp: state.cpuHp, phase: state.phase, result: state.history.at(-1) };
      },
    })).catch(() => {});
  } catch {}
}
