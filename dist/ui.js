'use strict';
// Presentation only. The AI and its locked plan are never read by the panels.
const DuelUI = (() => {
  const el = id => document.getElementById(id);
  const heart = '<svg class="heart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-9-5.5-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12Z" fill="currentColor"/></svg>';
  let active = null;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function closePanels() {
    for (const id of ['rules-dialog', 'recorder-dialog']) if (el(id).open) el(id).close();
  }
  function init() {
    for (const name of ['rules', 'recorder']) {
      const button = el(`${name}-button`), dialog = el(`${name}-dialog`);
      button.addEventListener('click', () => { if (!button.disabled) dialog.showModal(); });
      dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
      });
      dialog.addEventListener('close', () => { if (!button.disabled) button.focus({ preventScroll: true }); });
    }
    // Finish a turn safely if its screen geometry or motion preference changes.
    window.addEventListener('resize', cancel);
    window.addEventListener('scroll', () => {
      if (active && (window.scrollX !== active.scrollX || window.scrollY !== active.scrollY)) cancel();
    }, { passive: true });
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', cancel);
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  }
  function hearts(id, hp, name) {
    el(id).innerHTML = `<span class="hp-icons">${heart.repeat(hp)}</span><span class="hp-number" aria-hidden="true">${hp}<small>/3</small></span>`;
    el(id).setAttribute('aria-label', `${name}剩余 ${hp} 点血量，满血 3 点`);
  }
  function inventory(deck, history) {
    const counts = new Map([...new Set(deck)].map(value => [value, deck.filter(v => v === value).length]));
    for (const turn of history) {
      counts.set(turn.cpu, counts.get(turn.cpu) - 1);
      if (turn.swapped) counts.set(turn.player, counts.get(turn.player) + 1);
    }
    el('recorder-cards').innerHTML = [...counts].map(([value, count]) => `<div class="count-card${count === 0 ? ' exhausted' : ''}" aria-label="${value} 点，剩余 ${count} 张"><strong>${value}</strong><span>× ${count}</span></div>`).join('');
    el('recorder-total').textContent = `剩余 ${[...counts.values()].reduce((a, b) => a + b, 0)} 张`;
    el('recorder-round').textContent = history.length ? `已记录 ${history.length} 个回合` : '初始牌组';
  }
  function cancel() { active?.controller.abort(); }
  function wait(ms, job) {
    return new Promise(resolve => {
      if (job.controller.signal.aborted) return resolve();
      const finish = () => { clearTimeout(timer); job.controller.signal.removeEventListener('abort', finish); resolve(); };
      const timer = setTimeout(finish, ms);
      job.controller.signal.addEventListener('abort', finish, { once: true });
    });
  }
  function motion(node, frames, duration, job) {
    if (job.controller.signal.aborted || !node?.animate) return Promise.resolve();
    return new Promise(resolve => {
      const animation = node.animate(frames, { duration, easing: 'cubic-bezier(.22,.7,.25,1)', fill: 'forwards' });
      job.animations.add(animation);
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        clearTimeout(timer);
        job.controller.signal.removeEventListener('abort', finish);
        animation.cancel(); job.animations.delete(animation); resolve();
      };
      const timer = setTimeout(finish, duration + 120);
      job.controller.signal.addEventListener('abort', finish, { once: true });
      // Cancellation does not emit animationend; both rejection and a timeout finish safely.
      animation.finished.then(finish, finish);
    });
  }
  function hide(node, job) { if (node) { node.classList.add('in-transit'); job.hidden.add(node); } }
  async function fly(source, target, value, job, duration = 320) {
    if (!source || !target || job.controller.signal.aborted) return;
    const from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
    if (!from.width || !to.width) return;
    const copy = document.createElement('div');
    copy.className = `flying-card ${value === null ? 'card-back' : 'card-face'}`;
    copy.textContent = value === null ? '♦' : value;
    copy.setAttribute('aria-hidden', 'true');
    Object.assign(copy.style, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` });
    document.body.append(copy); job.nodes.add(copy);
    await motion(copy, [
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` },
      { transform: 'translate(0, 0) scale(1, 1)' },
    ], duration, job);
    copy.remove(); job.nodes.delete(copy);
  }
  async function play(turn) {
    cancel();
    const job = { controller: new AbortController(), scrollX: window.scrollX, scrollY: window.scrollY, animations: new Set(), nodes: new Set(), hidden: new Set() };
    active = job;
    const stopped = () => job.controller.signal.aborted;
    try {
      if (reduced() || typeof el('your-card').animate !== 'function') return;
      const yours = el('your-card'), theirs = el('their-card');
      const playerSource = el('hand').querySelector(`[data-id="${turn.id}"]`);
      // All C backs are anonymous; the source position must not encode its chosen index.
      const cpuSource = el('cpu-hand').firstElementChild;
      hide(playerSource, job); hide(cpuSource, job);
      await Promise.all([fly(playerSource, yours, null, job), fly(cpuSource, theirs, null, job)]);
      if (stopped()) return;
      for (const card of [yours, theirs]) { card.className = 'battle-card card-back'; card.textContent = '♦'; }
      await Promise.all([yours, theirs].map(card => motion(card, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg)' }], 150, job)));
      if (stopped()) return;
      yours.className = 'battle-card revealed'; theirs.className = 'battle-card revealed enemy';
      yours.textContent = turn.player; theirs.textContent = turn.cpu;
      await Promise.all([yours, theirs].map(card => motion(card, [{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0deg)' }], 180, job)));
      if (stopped()) return;
      await wait(130, job);
      if (stopped()) return;
      const result = Math.sign(turn.player - turn.cpu), damage = turn.amplified ? 2 : 1;
      el('comparison').textContent = turn.swapped ? '⇄' : result > 0 ? '>' : result < 0 ? '<' : '=';
      el('status-title').textContent = turn.swapped ? '移花接木 · 交换卡牌' : result > 0 ? '你的牌更大' : result < 0 ? 'Cortana 的牌更大' : '点数相同';
      el('status-desc').textContent = turn.swapped ? '本轮不扣血，交换的牌回到双方手中。' : result ? `${result > 0 ? 'Cortana' : '你'}扣除 ${damage} 点血量。` : '本轮不扣血。';
      if (turn.swapped) {
        hide(yours, job); hide(theirs, job);
        await Promise.all([fly(yours, cpuSource, turn.player, job, 280), fly(theirs, playerSource, turn.cpu, job, 280)]);
      } else if (result) {
        const icons = [...el(result > 0 ? 'cpu-hp' : 'your-hp').querySelectorAll('.heart-icon')];
        await Promise.all(icons.slice(Math.max(0, icons.length - damage)).map(icon => motion(icon, [
          { opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.2) translateY(-6px)' },
        ], 180, job)));
      }
    } finally {
      for (const animation of job.animations) animation.cancel();
      for (const node of job.nodes) node.remove();
      for (const node of job.hidden) node.classList.remove('in-transit');
      if (active === job) active = null;
    }
  }
  return { init, closePanels, hearts, inventory, play, cancel };
})();
