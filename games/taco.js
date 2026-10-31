// SpinBet Casino · TacoGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/taco.js ----
__mods['games/impl/taco.js'] = (() => {
// Taco Fiesta: 5×3, 243 ways (left to right, a sombrero wild on reels 2 to 4). Piñatas can land anywhere: hit them
// (or let them burst) to reveal cash, multipliers that add up and multiply the spin, or a FIESTA that starts
// 8 free spins. In the free spins piñatas are far more common and every multiplier found raises a global
// multiplier for the rest of the bonus. Tuned by simulation (RTP ≈ 92 %, buy ≈ 88 %).

const { BaseGame, fmtC, art } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { el } = __mods['ui.js'];

/* ===ENGINE */
const COLS = 5, ROWS = 3, N = 15, WILD = 8, PIN = 9, CAPX = 5000, FS_SPINS = 8;
const P = {
  w: [22, 20, 18, 16, 10, 8, 6, 4], wild: 3, // weights per cell; wild only on reels 2-4
  pays: [[0.2, 0.5, 1.5], [0.2, 0.6, 1.8], [0.3, 0.8, 2], [0.4, 1, 2.5], [0.6, 1.5, 4], [0.8, 2, 6], [1, 3, 10], [1.5, 5, 20]], K: 0.45,
  pin: 0.012, pinFS: 0.075,
  prize: [['c', 72], ['m', 24], ['f', 2]],
  cash: [[0.2, 32], [0.5, 28], [1, 18], [2, 11], [5, 7], [10, 3], [25, 1]],
  mult: [[2, 60], [3, 28], [5, 12]],
};
function wpick(l) { let t = 0; for (const x of l) t += x[1]; let r = Math.random() * t; for (const x of l) { if (r < x[1]) return x[0]; r -= x[1]; } return l[l.length - 1][0]; }
function cell(c, fs) {
  if (Math.random() < (fs ? P.pinFS : P.pin)) return PIN;
  const ws = c >= 1 && c <= 3 ? P.wild : 0;
  let t = ws; for (const x of P.w) t += x;
  let r = Math.random() * t;
  if (r < ws) return WILD; r -= ws;
  for (let i = 0; i < P.w.length; i++) { if (r < P.w[i]) return i; r -= P.w[i]; }
  return 0;
}
// 243 ways: for each symbol, reels in a row from the left holding it (or a wild); ways = product of the counts.
function ways(g) {
  const wins = [];
  for (let s = 0; s < 8; s++) {
    let n = 0, w = 1; const cells = [];
    for (let c = 0; c < COLS; c++) {
      let k = 0;
      for (let r = 0; r < ROWS; r++) { const v = g[c * ROWS + r]; if (v === s || v === WILD) { k++; cells.push(c * ROWS + r); } }
      if (!k) break; n++; w *= k;
    }
    if (n >= 3) {
      const keep = cells.filter((i) => Math.floor(i / ROWS) < n);
      wins.push({ s, n, ways: w, x: P.pays[s][n - 3] * P.K * w, cells: keep });
    }
  }
  return wins;
}
function spin(o) {
  const g = []; for (let i = 0; i < N; i++) g.push(cell(Math.floor(i / ROWS), o.fs));
  if (o.forcePin) { let has = false; for (const v of g) if (v === PIN) has = true; if (!has) g[Math.floor(Math.random() * N)] = PIN; }
  const wins = ways(g);
  let base = 0; wins.forEach((w) => { base += w.x; });
  const pins = [];
  let cash = 0, madd = 0, fs = 0;
  for (let i = 0; i < N; i++) if (g[i] === PIN) {
    const k = wpick(P.prize);
    if (k === 'c') { const v = wpick(P.cash); cash += v; pins.push({ i, k, v }); }
    else if (k === 'm') { const v = wpick(P.mult); madd += v; pins.push({ i, k, v }); }
    else { fs++; pins.push({ i, k }); }
  }
  // spin multiplier: the piñata multipliers add up (×2 and ×3 → ×5); in free spins the global multiplier applies too
  const m = (madd || 1) * (o.gm || 1);
  const total = (base + cash) * m;
  return { g, wins, base, cash, madd, m, pins, fs, total };
}
/* ===END ENGINE */

const NAMES = ['Citron vert', 'Avocat', 'Piment', 'Taco', 'Maracas', 'Guitare', 'Calavera', 'Luchador'];
const ART = ['tf0', 'tf1', 'tf2', 'tf3', 'tf4', 'tf5', 'tf6', 'tf7', 'tfw', 'tfp'];
const BUYC = 84;
const FIESTA = ['#f43f5e', '#fde047', '#22d3ee', '#4ade80', '#f97316', '#e879f9', '#fff'];
const xs = (m) => (m >= 10 ? String(Math.round(m * 10) / 10).replace('.', ',') : m.toFixed(2).replace(/\.?0+$/, '').replace('.', ','));

class TacoGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.taco,
      frameCls: 'taco-frame',
      stage: `<div class="tf-stage"><div class="tf-papel">${Array.from({ length: 14 }, (_, k) => `<i style="--c:${FIESTA[k % 6]}"></i>`).join('')}</div><div class="reels-host"></div><div class="tf-word"></div></div>`,
      head: '<div class="tf-meter"><small>Multiplicateur</small><b>×1</b></div>',
      buys: [{ id: 'fs', icon: '🪅', label: 'Fiesta · 8 tours gratuits', desc: 'Piñatas fréquentes et multiplicateur global qui grimpe', cost: (b) => b * BUYC }],
      hello: '243 façons de gagner · frappe les piñatas !',
    });
    this.gm = 1;
    this.reels = new Reels(this.q('.reels-host'), {
      cols: COLS, rows: ROWS, game: this, random: (c) => cell(c, this.inFree),
      art: (v) => art(ART[v]) + (v === WILD ? '<i class="lbl tfl">WILD</i>' : ''),
      cls: (v) => (v === PIN ? 'pin' : v === WILD ? 'wild' : v >= 6 ? 'hi' : ''),
    });
    this.reels.setAll(Array.from({ length: N }, (_, i) => cell(Math.floor(i / ROWS), false)));
  }

  setMeter(m, bump) {
    const b = this.q('.tf-meter b');
    b.textContent = `×${m}`;
    this.q('.tf-meter').classList.toggle('hot', m > 1);
    if (bump) b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.5)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 500 });
  }

  word(t, cls = '') {
    const w = this.q('.tf-word');
    w.textContent = t; w.className = `tf-word ${cls}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3) rotate(-8deg)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1) rotate(3deg)', offset: 0.25 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%,-60%) scale(1.2)' }], { duration: this.turbo ? 700 : 1100, easing: 'ease-out' });
  }

  onMain() { this.round(() => this.playRound(false)); }
  async onBuy() { await this.playRound(true); }

  async playRound(buy) {
    const b = this.bet;
    if (!buy && !this.pay(b)) return;
    this.lastStake = b;
    this.setLast(0); this.winAmt.textContent = ''; this.setBanner('');
    let total = 0;
    if (buy) total = await this.freeSpins();
    else {
      const res = spin({ fs: false });
      total = Math.min(res.total * b, b * CAPX);
      await this.show(res, b, total);
      if (total > 0) { this.win(Math.round(total)); this.setLast(total); }
      if (res.fs) {
        this.stopAuto();
        if (total > 0) await this.celebrate(Math.round(total));
        total += await this.freeSpins();
      } else if (total > 0) await this.celebrate(Math.round(total));
    }
    this.setLast(total);
    this.msg(total >= b * CAPX ? `GAIN MAXIMUM ! ${fmtC(total)}` : total > 0 ? `Total du tour : ${fmtC(total)}` : 'Pas de gain');
  }

  // Spins the reels, shows the ways wins, then the piñatas. Returns once everything is on screen.
  async show(res, b, capped) {
    await this.reels.spin(res.g, {
      tease: (c, vals) => { let n = 0; for (let j = 0; j < c * ROWS; j++) if (vals[j] === PIN) n++; return n >= 2; },
      onStop: (c) => { for (let r = 0; r < ROWS; r++) if (res.g[c * ROWS + r] === PIN) { sfx.land(); const p = center(this.reels.cell(c * ROWS + r)); fx.burst(p.x, p.y, 10, FIESTA, 5); } },
    });
    if (this.dead) return;
    if (res.wins.length) {
      const cells = new Set(); res.wins.forEach((w) => w.cells.forEach((i) => cells.add(i)));
      this.reels.mark([...cells]);
      this.msg(res.wins.map((w) => `${w.n} × ${NAMES[w.s]}${w.ways > 1 ? ` (${w.ways} façons)` : ''} : +${fmtC(Math.round(w.x * b))}`).join(' · '));
      sfx.win();
      await this.wait(1100);
      this.reels.unmark();
    }
    if (res.pins.length) await this.smash(res, b);
    if (res.m > 1 && (res.base + res.cash) > 0) {
      this.word(`×${res.m}`, 'mult');
      this.msg(`(${fmtC(Math.round((res.base + res.cash) * b))}) × ${res.m} = ${fmtC(Math.round(capped))}`);
      sfx.bigWin();
      await this.wait(1000);
    }
  }

  // The piñatas wait to be hit (tap them); they burst on their own after a moment, or straight away in autoplay.
  async smash(res, b) {
    this.msg(res.pins.length > 1 ? `${res.pins.length} piñatas ! Frappe-les !` : 'Une piñata ! Frappe-la !');
    this.slotEl.classList.add('tf-smash');
    const jobs = res.pins.map((pn) => new Promise((resolve) => {
      const cellEl = this.reels.cell(pn.i);
      const hit = el('button', 'tf-hit', '<span>👊</span>');
      hit.type = 'button'; hit.setAttribute('aria-label', 'Frapper la piñata');
      cellEl.appendChild(hit);
      let done = false;
      const burst = () => {
        if (done) return; done = true;
        hit.remove();
        cellEl.classList.add('opened');
        const p = center(cellEl);
        fx.burst(p.x, p.y, 26, FIESTA, 8);
        sfx.coin();
        const prize = el('div', `tf-prize ${pn.k}`, pn.k === 'c' ? `<b>${fmtC(Math.round(pn.v * b))}</b>` : pn.k === 'm' ? `<b>×${pn.v}</b>` : '<b>FIESTA</b><small>8 tours</small>');
        cellEl.appendChild(prize);
        if (pn.k === 'f') { sfx.feature(); fx.confetti(60); }
        resolve();
      };
      hit.addEventListener('click', burst, { once: true });
      setTimeout(burst, this.auto || this.turbo ? 350 : 2600);
    }));
    await Promise.all(jobs);
    this.slotEl.classList.remove('tf-smash');
    const parts = [];
    if (res.cash) parts.push(`gains ${fmtC(Math.round(res.cash * b))}`);
    if (res.madd) parts.push(`multiplicateur ×${res.madd}`);
    if (res.fs) parts.push(res.fs > 1 ? `${res.fs} FIESTAS` : 'FIESTA');
    this.msg(`Piñatas : ${parts.join(' · ')}`);
    await this.wait(1200);
    this.reels.el.querySelectorAll('.tf-prize').forEach((n) => n.remove());
    this.reels.el.querySelectorAll('.opened').forEach((n) => n.classList.remove('opened'));
  }

  // Same rules as the simulator: 8 spins, +3 per FIESTA, multipliers found raise the global multiplier.
  async freeSpins() {
    const b = this.bet, cap = b * CAPX;
    let left = FS_SPINS, gm = 1, tot = 0, done = 0;
    this.lastStake = b;
    await this.featureIntro('¡ FIESTA !', `${FS_SPINS} tours gratuits · piñatas partout · chaque multiplicateur trouvé reste pour tout le bonus`, art('tfp'));
    this.inFree = true;
    this.slotEl.classList.add('in-free');
    this.setMeter(1);
    while (left > 0 && tot < cap && !this.dead) {
      left--; done++;
      this.setBanner(`<b>¡ FIESTA !</b><span class="pill">Tour ${done} / ${done + left}</span><span class="pill">Multiplicateur ×${gm}</span><span class="pill gold">Gain ${fmtC(Math.round(tot))}</span>`);
      const res = spin({ fs: true, gm });
      const add = Math.min(res.total * b, cap - tot);
      await this.show(res, b, add);
      tot += add;
      if (add > 0) this.win(Math.round(add), 'Fiesta');
      this.setLast(Math.round(tot));
      if (res.madd) { gm += res.madd; this.setMeter(gm, true); this.msg(`Le multiplicateur global passe à ×${gm} !`); await this.wait(700); }
      if (res.fs) { left += 3 * res.fs; await this.featureIntro(`+${3 * res.fs} TOURS`, 'Encore une fiesta !', art('tfp'), 1300); }
      await this.wait(250);
    }
    this.inFree = false;
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    this.setMeter(1);
    await this.celebrate(Math.round(tot), { summary: '¡ FIESTA !', stake: b });
    return tot;
  }

  info() {
    const rows = NAMES.map((n, s) => `<div class="pay-item"><div class="pay-sym svg">${art(ART[s])}</div><div class="pay-vals"><b>${n}</b><br><span>3 : ×${xs(P.pays[s][0] * P.K)} · 4 : ×${xs(P.pays[s][1] * P.K)} · 5 : ×${xs(P.pays[s][2] * P.K)}</span></div></div>`).join('');
    return this.rules(`<h4>Symboles (× la mise, par façon)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym svg">${art('tfw')}</div><div class="pay-vals"><b>Sombrero WILD</b><br><span>Rouleaux 2 à 4, remplace tous les symboles sauf la piñata</span></div></div>
      <div class="pay-item"><div class="pay-sym svg">${art('tfp')}</div><div class="pay-vals"><b>Piñata</b><br><span>Gains, multiplicateur ou FIESTA</span></div></div></div>
      <h4>243 façons de gagner</h4><p>Un symbole paie dès qu’il apparaît sur 3 rouleaux d’affilée ou plus en partant de la gauche, à n’importe quelle hauteur. Le gain est multiplié par le nombre de façons (combinaisons de positions).</p>
      <h4>Piñatas</h4><p>Frappe chaque piñata : elle révèle des <b>gains</b> (×0,2 à ×25 la mise), un <b>multiplicateur</b> (×2, ×3 ou ×5, ils s’additionnent et multiplient tout le tour) ou une <b>FIESTA</b>.</p>
      <h4>Fiesta</h4><p>${FS_SPINS} tours gratuits, piñatas 6 fois plus fréquentes. Chaque multiplicateur trouvé s’ajoute à un <b>multiplicateur global</b> qui s’applique à tous les tours suivants du bonus. FIESTA en bonus : +3 tours. Achat : ×${BUYC} la mise. Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { TacoGame };
})();
