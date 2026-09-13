'use strict';
(function (root) {
  const INITIAL_DECK = Object.freeze([1, 1, 1, 1.5, 2, 2, 2.5, 3]);
  const EXPLORATION = 0.2;
  const TEMPERATURE = 0.45;
  const RESERVE_COST = 0.3;

  // Pure decisions: only Cortana's own hand and settled, publicly visible data.
  // There is no access to the DOM, game state, player hand or current input.
  function reconstructPlayerCards(publicHistory) {
    const cards = [...INITIAL_DECK];
    for (const round of publicHistory) {
      const index = cards.indexOf(round.player);
      if (index < 0) throw new Error('公开出牌记录与牌组不一致');
      cards.splice(index, 1);
      if (round.swapped) {
        if (!INITIAL_DECK.includes(round.cpu)) throw new Error('无效的公开交换记录');
        cards.push(round.cpu);
      }
    }
    return cards;
  }
  function validateCards(cards) {
    if (!Array.isArray(cards) || cards.length === 0 || cards.some(card => !INITIAL_DECK.includes(card))) {
      throw new Error('没有有效的可用手牌');
    }
  }
  function normalize(weights) {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return weights.map(weight => weight / total);
  }
  function skillProbabilities(ownCards) {
    validateCards(ownCards);
    const low = Math.min(...ownCards), high = Math.max(...ownCards);
    if (low === high) return ownCards.map(() => 1 / ownCards.length);
    const lows = ownCards.filter(card => card === low).length;
    const highs = ownCards.filter(card => card === high).length;
    const middle = ownCards.length - lows - highs;
    return normalize(ownCards.map(card => card === high ? 1 / 3 / highs : card === low ? 1 / 4 / lows : 5 / 12 / middle));
  }
  function normalProbabilities({ ownCards, publicHistory, ownHp, opponentHp }) {
    validateCards(ownCards);
    const opponentCards = reconstructPlayerCards(publicHistory);
    if (!opponentCards.length) throw new Error('对局已无可用手牌');
    const low = Math.min(...ownCards), high = Math.max(...ownCards);
    const winReward = opponentHp === 1 ? 2 : 1;
    const lossCost = ownHp === 1 ? 2 : 1;
    const remainingFactor = (ownCards.length - 1) / (INITIAL_DECK.length - 1);
    const scores = ownCards.map(card => {
      const win = opponentCards.filter(other => card > other).length / opponentCards.length;
      const lose = opponentCards.filter(other => card < other).length / opponentCards.length;
      const strength = high === low ? 0 : (card - low) / (high - low);
      return winReward * win - lossCost * lose - RESERVE_COST * strength * remainingFactor;
    });
    const best = Math.max(...scores);
    const weighted = normalize(scores.map(score => Math.exp((score - best) / TEMPERATURE)));
    return weighted.map(probability => EXPLORATION / ownCards.length + (1 - EXPLORATION) * probability);
  }
  function sampleIndex(probabilities, ticket) {
    if (!Number.isFinite(ticket) || ticket < 0 || ticket >= 1) throw new Error('无效的随机采样值');
    let sum = 0;
    for (let i = 0; i < probabilities.length; i++) {
      sum += probabilities[i];
      if (ticket < sum) return i;
    }
    return probabilities.length - 1;
  }
  function planRound(publicView, skillTicket, cardTicket) {
    if (!Number.isFinite(skillTicket) || skillTicket < 0 || skillTicket >= 1) throw new Error('无效的技能采样值');
    const skillActive = !publicView.skillUsed && skillTicket < 0.25;
    const probabilities = skillActive ? skillProbabilities(publicView.ownCards) : normalProbabilities(publicView);
    return Object.freeze({ skillActive, index: sampleIndex(probabilities, cardTicket) });
  }
  const api = Object.freeze({ reconstructPlayerCards, skillProbabilities, normalProbabilities, sampleIndex, planRound });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CortanaAI = api;
})(globalThis);
