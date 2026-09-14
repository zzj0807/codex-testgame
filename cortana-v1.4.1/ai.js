'use strict';
(function (root) {
  const INITIAL_DECK = Object.freeze([1, 1, 1, 1.5, 2, 2, 2.5, 3]);
  const DEFAULT_BELIEFS = Object.freeze([1 / 3, 1 / 3, 1 / 3]);
  const sum = values => values.reduce((a, b) => a + b, 0);
  const normalize = values => { const total = sum(values); return values.map(value => value / total); };
  const dot = (a, b) => a.reduce((total, value, i) => total + value * b[i], 0);
  const sigmoid = value => 1 / (1 + Math.exp(-value));
  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  function groups(cards) {
    return [...new Set(cards)].sort((a, b) => a - b).map(value => ({ value, count: cards.filter(card => card === value).length }));
  }
  function remove(cards, value) {
    const copy = [...cards], index = copy.indexOf(value);
    if (index < 0) throw new Error('公开记录与可用牌组不一致');
    copy.splice(index, 1);
    return copy;
  }
  function reconstructPlayerCards(history) {
    let cards = [...INITIAL_DECK];
    for (const round of history) {
      cards = remove(cards, round.player);
      if (round.swapped) cards.push(round.cpu);
    }
    return cards;
  }
  function playerActions(position) {
    const normal = groups(position.p).map(({ value, count }) => ({ value, count, swapped: false }));
    if (!position.ps) return normal;
    return normal.concat(normal.filter(action => action.value > 1).map(action => ({ ...action, swapped: true })));
  }
  // The simulator and the real resolver both reject one-point swaps.
  function transition(position, cCard, action, powered) {
    if (powered && !position.cs) throw new Error('C 的技能已经使用');
    if (action.swapped && (!position.ps || action.value <= 1)) throw new Error('此行动不能使用移花接木');
    let c = remove(position.c, cCard), p = remove(position.p, action.value);
    let ch = position.ch, ph = position.ph;
    if (action.swapped) { c.push(action.value); p.push(cCard); }
    else if (cCard > action.value) ph = Math.max(0, ph - (powered ? 2 : 1));
    else if (cCard < action.value) ch = Math.max(0, ch - (powered ? 2 : 1));
    return { c: c.sort((a, b) => a - b), p: p.sort((a, b) => a - b), ch, ph, cs: position.cs && !powered, ps: position.ps && !action.swapped };
  }
  function terminal(position) {
    if (position.ch <= 0) return -1;
    if (position.ph <= 0) return 1;
    if (!position.c.length || !position.p.length) return Math.sign(position.ch - position.ph);
    return null;
  }
  function leafValue(position) {
    const end = terminal(position);
    if (end !== null) return end;
    let matchup = 0;
    for (const c of position.c) for (const p of position.p) matchup += Math.sign(c - p);
    matchup /= position.c.length * position.p.length;
    const best = Math.max(...position.c);
    const winChance = position.p.filter(card => best > card).length / position.p.length;
    const retainedPower = position.cs ? winChance * (position.ph === 2 ? 1.4 : 0.5) * (position.ch === 2 ? 0.6 : 1) : 0;
    const retainedSwap = position.ps ? position.p.filter(card => card > 1).length / position.p.length : 0;
    return Math.tanh(0.65 * (position.ch - position.ph) + 0.7 * matchup + 0.12 * retainedPower - 0.14 * retainedSwap);
  }
  function softmax(scores, prior, temperature) {
    const best = Math.max(...scores);
    return normalize(scores.map((value, i) => prior[i] * Math.exp((value - best) / temperature)));
  }
  function beliefs(input = DEFAULT_BELIEFS) {
    if (input.length !== 3 || input.some(value => !Number.isFinite(value) || value < 0) || sum(input) <= 0) throw new Error('无效的模型权重');
    return normalize(input);
  }
  function actionPrior(actions, swapPrior, smallestSwapOnly = false) {
    const normalCount = sum(actions.filter(a => !a.swapped).map(a => a.count));
    const legal = actions.filter(a => a.swapped);
    const smallest = legal.length ? Math.min(...legal.map(a => a.value)) : null;
    const swaps = legal.filter(a => !smallestSwapOnly || a.value === smallest);
    const swapCount = sum(swaps.map(a => a.count));
    return actions.map(action => action.swapped
      ? (smallestSwapOnly && action.value !== smallest ? 0 : swapPrior * action.count / swapCount)
      : (swapCount ? 1 - swapPrior : 1) * action.count / normalCount);
  }  function responses(position, actions, matrix, deaths, cDistribution, powered) {
    // Each model sees the same distribution of C's possible cards, never the
    // actual hidden card and never one hypothetical C row in isolation.
    const expected = actions.map((_, j) => dot(cDistribution, matrix.map(row => row[j])));
    const danger = actions.map((_, j) => dot(cDistribution, deaths.map(row => row[j])));
    const low = Math.min(...position.p), high = Math.max(...position.p);
    const random = actionPrior(actions, 0.15);
    const safe = softmax(expected.map((value, j) => -value - 0.4 * danger[j]), actionPrior(actions, 0.25), 0.35);
    const resource = softmax(expected.map((value, j) => {
      const action = actions[j], remaining = (position.p.length - 1) / 7;
      const cost = action.swapped ? 0.06 * remaining : 0.04 * (high === low ? 0 : (action.value - low) / (high - low)) * remaining;
      return -value - cost;
    }), actionPrior(actions, powered ? 0.55 : 0.08, true), 0.45);
    return [random, safe, resource];
  }
  // Proofs cover every legal player response, independently of the learned models.
  // Search three rounds with large hands, and the entire game at four cards or fewer.
  function createTactics() {
    const memo = new Map();
    const key = (s, depth, lethal) => JSON.stringify([s.c.slice().sort((a,b)=>a-b), s.p.slice().sort((a,b)=>a-b), s.ch, s.ph, s.cs, s.ps, depth, lethal]);
    const moves = s => groups(s.c).reverse().flatMap(({ value }) => s.cs
      ? [{ value, powered: false }, { value, powered: true }]
      : [{ value, powered: false }]);
    const replies = s => playerActions(s).sort((a,b) => Number(b.swapped) - Number(a.swapped) || b.value - a.value);
    function force(s, depth, lethal) {
      const end = terminal(s);
      if (end !== null) return lethal ? s.ph === 0 && s.ch > 0 : end === 1;
      if (depth === 0 || (lethal && s.ph > Math.min(depth, s.c.length) + Number(s.cs))) return false;
      const id = key(s, depth, lethal);
      if (memo.has(id)) return memo.get(id);
      const actions = replies(s);
      const won = moves(s).some(move => actions.every(action => force(transition(s, move.value, action, move.powered), depth - 1, lethal)));
      memo.set(id, won);
      return won;
    }
    return position => {
      const actions = replies(position);
      const candidates = moves(position).map(move => ({ ...move, next: actions.map(action => transition(position, move.value, action, move.powered)) }));
      function select(depth, lethal) {
        const safe = candidates.filter(move => move.next.every(next => force(next, depth - 1, lethal)));
        if (!safe.length) return null;
        // Equally fast ordinary wins do not need the double-damage skill.
        const ordinary = safe.filter(move => !move.powered);
        return { kind: lethal ? 'lethal' : 'win', rounds: depth, moves: (ordinary.length ? ordinary : safe).map(({value,powered}) => ({value,powered})) };
      }
      const immediate = select(1, true) || select(1, false);
      if (immediate) return immediate;
      const limit = position.c.length <= 4 ? position.c.length + Number(position.ps) : 3;
      for (const lethal of [true, false]) for (let depth = 2; depth <= limit; depth++) {
        const found = select(depth, lethal);
        if (found) return found;
      }
      return null;
    };
  }
  function createSolver(modelWeights) {
    const memo = new Map();
    const tactics = createTactics();
    function mode(position, powered, depth, forcedCards = null) {
      const cGroups = groups(position.c).filter(group => !forcedCards || forcedCards.includes(group.value)), actions = playerActions(position);
      const prior = normalize(cGroups.map(group => group.count));
      const deaths = [], matrix = cGroups.map(group => {
        const rowDeaths = []; deaths.push(rowDeaths);
        return actions.map(action => {
          const next = transition(position, group.value, action, powered);
          rowDeaths.push(next.ph === 0 ? 1 : 0);
          const end = terminal(next);
          return forcedCards ? 1 : end !== null ? end : depth > 1 ? future(next, depth - 1) : leafValue(next);
        });
      });
      let cDistribution = [...prior];
      function predict() {
        const models = responses(position, actions, matrix, deaths, cDistribution, powered);
        const probabilities = actions.map((_, j) => models.reduce((v, model, i) => v + modelWeights[i] * model[j], 0));
        const scores = matrix.map(row => dot(row, probabilities));
        return { models, probabilities, scores };
      }
      for (let i = 0; !forcedCards && i < 4; i++) {
        const { scores } = predict();
        const scored = softmax(scores, prior, 0.22);
        const target = scored.map((p, j) => 0.2 * prior[j] + 0.8 * p);
        cDistribution = cDistribution.map((p, j) => 0.5 * p + 0.5 * target[j]);
      }
      const predicted = predict();
      return {
        value: dot(cDistribution, predicted.scores),
        probabilities: position.c.map(card => { const i = cGroups.findIndex(group => group.value === card); return i < 0 ? 0 : cDistribution[i] / cGroups[i].count; }),
        swapProbability: sum(predicted.probabilities.filter((_, j) => actions[j].swapped)),
        evidence: { weights: [...modelWeights], actions: actions.map(({ value, swapped }) => ({ value, swapped })), models: predicted.models },
      };
    }
    function decision(position, depth) {
      const guarantee = tactics(position);
      if (guarantee) {
        const powered = guarantee.moves[0].powered;
        const cards = guarantee.moves.map(move => move.value);
        return {
          normal: mode(position, false, 1, powered ? null : cards),
          powered: position.cs ? mode(position, true, 1, powered ? cards : null) : null,
          skillProbability: powered ? 1 : 0,
          guarantee,
        };
      }
      const normal = mode(position, false, depth);
      const powered = position.cs ? mode(position, true, depth) : null;
      const skillProbability = powered ? sigmoid(Math.log(1 / 3) + 6 * (powered.value - normal.value)) : 0;
      return { normal, powered, skillProbability, guarantee: null };
    }
    function future(position, depth) {
      const key = JSON.stringify([position.c, position.p, position.ch, position.ph, position.cs, position.ps, depth]);
      if (memo.has(key)) return memo.get(key);
      const result = decision(position, depth);
      const value = result.powered ? (1 - result.skillProbability) * result.normal.value + result.skillProbability * result.powered.value : result.normal.value;
      memo.set(key, value);
      return value;
    }
    return decision;
  }
  function analyzePosition(position, modelWeights = DEFAULT_BELIEFS) {
    if (!position.c.length || !position.p.length || position.ch <= 0 || position.ph <= 0 || [...position.c, ...position.p].some(card => !INITIAL_DECK.includes(card))) throw new Error('没有可分析的对局');
    return createSolver(beliefs(modelWeights))({ ...position, c: [...position.c], p: [...position.p].sort((a, b) => a - b) }, 2);
  }
  function analyzeRound(publicView) {
    const playerCards = reconstructPlayerCards(publicView.publicHistory);
    const position = { c: [...publicView.ownCards], p: playerCards, ch: publicView.ownHp, ph: publicView.opponentHp, cs: !publicView.skillUsed, ps: !publicView.publicHistory.some(round => round.swapped) };
    // Keep the actual own-card order so the sampled index matches the game.
    if (!position.c.length || !position.p.length) throw new Error('对局已无可用手牌');
    return createSolver(beliefs(publicView.modelWeights))(position, 2);
  }
  function sampleIndex(probabilities, ticket) {
    if (!Number.isFinite(ticket) || ticket < 0 || ticket >= 1) throw new Error('无效的随机采样值');
    let cumulative = 0, lastPositive = -1;
    for (let i = 0; i < probabilities.length; i++) {
      const probability = probabilities[i];
      if (!Number.isFinite(probability) || probability < 0) throw new Error('无效的出牌概率');
      if (probability === 0) continue;
      lastPositive = i;
      cumulative += probability;
      if (ticket < cumulative) return i;
    }
    if (lastPositive < 0) throw new Error('没有可抽取的牌');
    return lastPositive;
  }
  function planRound(publicView, skillTicket, cardTicket) {
    if (!Number.isFinite(skillTicket) || skillTicket < 0 || skillTicket >= 1) throw new Error('无效的技能采样值');
    const analysis = analyzeRound(publicView);
    const skillActive = skillTicket < analysis.skillProbability;
    const choice = skillActive ? analysis.powered : analysis.normal;
    return freeze({ skillActive, index: sampleIndex(choice.probabilities, cardTicket), evidence: choice.evidence });
  }
  function updateBeliefs(evidence, publishedAction) {
    const matching = evidence.actions.map((action, i) => action.value === publishedAction.player && action.swapped === publishedAction.swapped ? i : -1).filter(i => i >= 0);
    if (!matching.length) throw new Error('公开行动不在合法预测动作中');
    const posterior = normalize(evidence.weights.map((weight, i) => weight * Math.pow(Math.max(1e-6, sum(matching.map(j => evidence.models[i][j]))), 0.35)));
    return Object.freeze(posterior.map(weight => 0.1 + 0.7 * weight));
  }
  const api = Object.freeze({ reconstructPlayerCards, playerActions, transition, leafValue, analyzePosition, analyzeRound, sampleIndex, planRound, updateBeliefs });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CortanaAI = api;
})(globalThis);
