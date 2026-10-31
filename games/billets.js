// SpinBet Casino · BilletsGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/billets.js ----
__mods['games/impl/billets.js'] = (() => {
// Coffre aux Billets: 5×3 slot in a gold vault, 243 ways with euro-style KE banknotes (5 to 200 KE) and a safe WILD.
// Cash bills carry a value or a MINI / MAJEUR / JACKPOT ×500 prize and are collected by the briefcase on reel 5.
// 3 FREE SPINS bills: 8 free spins with briefcases on every reel. Tuned by simulation (RTP ≈ 92 %, buys ≈ 88 %).

const { BaseGame, fmtC, shortC } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { el } = __mods['ui.js'];

/* ===ENGINE */
// 5×3, 243 ways. Bills 5 to 500 KE pay by ways; WILD safe on reels 2-4. Cash bills carry a value (× the bet) or a
// MINI / MAJEUR / JACKPOT prize; a briefcase on reel 5 collects every cash bill on screen. 3+ FREE SPINS bills: 8 free
// spins where briefcases can land on every reel and cash bills are more common.
const COLS = 5, ROWS = 3, N = 15, WILD = 6, CASH = 7, CASE = 8, FSB = 9, CAPX = 5000, FS_SPINS = 8;
const JP = { mini: 10, major: 50, grand: 500 };
const P = {
  w: [24, 22, 19, 16, 11, 8], wild: 2.5,
  pays: [[0.2, 0.5, 1.5], [0.25, 0.6, 2], [0.3, 0.8, 2.5], [0.5, 1.2, 4], [0.8, 2, 6], [1.2, 4, 12]], K: 0.355,
  cash: 0.06, cashFS: 0.15, case: 0.04, caseFS: 0.077, fsb: 0.022,
  val: [[0.5, 30], [1, 26], [2, 18], [3, 10], [5, 8], [10, 4.5], [20, 2], [50, 0.6], ['mini', 1.4], ['major', 0.3], ['grand', 0.025]],
};
function wpick(l) { let t = 0; for (const x of l) t += x[1]; let r = Math.random() * t; for (const x of l) { if (r < x[1]) return x[0]; r -= x[1]; } return l[l.length - 1][0]; }
function cell(c, fs) {
  const r = Math.random();
  const pc = fs ? P.cashFS : P.cash, pk = (fs || c === COLS - 1) ? (fs ? P.caseFS : P.case) : 0, pf = fs ? 0 : P.fsb;
  if (r < pc) return CASH;
  if (r < pc + pk) return CASE;
  if (r < pc + pk + pf) return FSB;
  const ws = c >= 1 && c <= 3 ? P.wild : 0;
  let t = ws; for (const x of P.w) t += x;
  let q = Math.random() * t;
  if (q < ws) return WILD; q -= ws;
  for (let i = 0; i < P.w.length; i++) { if (q < P.w[i]) return i; q -= P.w[i]; }
  return 0;
}
function ways(g) {
  const wins = [];
  for (let s = 0; s < 6; s++) {
    let n = 0, w = 1; const cells = [];
    for (let c = 0; c < COLS; c++) {
      let k = 0;
      for (let r = 0; r < ROWS; r++) { const v = g[c * ROWS + r]; if (v === s || v === WILD) { k++; cells.push(c * ROWS + r); } }
      if (!k) break; n++; w *= k;
    }
    if (n >= 3) wins.push({ s, n, ways: w, x: P.pays[s][n - 3] * P.K * w, cells: cells.filter((i) => Math.floor(i / ROWS) < n) });
  }
  return wins;
}
const cashX = (v) => (typeof v === 'number' ? v : JP[v]);
function spin(o) {
  const g = []; for (let i = 0; i < N; i++) g.push(cell(Math.floor(i / ROWS), o.fs));
  if (o.forceCase) { const i = (COLS - 1) * ROWS + Math.floor(Math.random() * ROWS); g[i] = CASE; }
  const vals = {}; let cashSum = 0, cases = 0, fsb = 0;
  g.forEach((v, i) => { if (v === CASH) { vals[i] = wpick(P.val); cashSum += cashX(vals[i]); } else if (v === CASE) cases++; else if (v === FSB) fsb++; });
  const wins = ways(g);
  let base = 0; wins.forEach((w) => { base += w.x; });
  const collect = cases ? cashSum * cases : 0;
  return { g, vals, wins, base, cashSum, cases, collect, fsb, total: base + collect };
}
/* ===END ENGINE */

const NOTE_IDS = ['bv0', 'bv1', 'bv2', 'bv3', 'bv4', 'bv5'], NOTE_VALS = [5, 10, 20, 50, 100, 200];
const JPID = { mini: 'bvm', major: 'bvj', grand: 'bvg' }, JPN = { mini: 'MINI', major: 'MAJEUR', grand: 'JACKPOT' };
const BUY_FS = 68, BUY_CASE = 3.5;
const bill = (id) => `<svg viewBox="0 0 112 64" aria-hidden="true"><use href="#${id}" width="112" height="64"/></svg>`;
const xv = (m) => (m >= 10 ? String(Math.round(m)) : String(m).replace('.', ','));
const MONEY = ['#4caf6e', '#fde047', '#3b82c4', '#f08c2e', '#fff'];

class BilletsGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.billets,
      frameCls: 'bv-frame',
      stage: `<div class="bv-vault"><i class="bv-boxes l"></i><i class="bv-boxes r"></i><i class="bv-gold l"></i><i class="bv-gold r"></i><i class="bv-shine"></i></div>
        <div class="bv-top"><div class="bv-jp mini"><small>MINI</small><b data-jp="mini"></b></div><div class="bv-grand"><small>JACKPOT</small><b data-jp="grand"></b></div><div class="bv-jp major"><small>MAJEUR</small><b data-jp="major"></b></div></div>
        <div class="reels-host"></div><div class="bv-word"></div>`,
      buys: [
        { id: 'case', icon: '💼', label: 'Mallette garantie', desc: 'Un tour avec une mallette de collecte sur le rouleau 5', cost: (b) => Math.round(b * BUY_CASE) },
        { id: 'fs', icon: '💵', label: `Free spins · ${FS_SPINS} tours`, desc: 'Mallettes sur tous les rouleaux et billets cash plus fréquents', cost: (b) => b * BUY_FS },
      ],
      hello: '243 façons de gagner · la mallette collecte tous les billets cash',
    });
    this.vals = {};
    this.reels = new Reels(this.q('.reels-host'), {
      cols: COLS, rows: ROWS, game: this, random: (c) => cell(c, this.inFree),
      art: (v, i) => this.cellArt(v, i),
      cls: (v) => (v === CASH ? 'cash' : v === CASE ? 'case' : v === FSB ? 'fsb' : v === WILD ? 'wild' : `n${v}`),
    });
    this.reels.setAll(Array.from({ length: N }, (_, i) => cell(Math.floor(i / ROWS), false)));
    this.onBetChange();
  }

  // A cash bill shows its value (or its jackpot note); the reel filler draws random values.
  cellArt(v, i) {
    if (v === CASH) {
      const val = i >= 0 && this.vals[i] !== undefined ? this.vals[i] : wpick(P.val);
      if (typeof val === 'string') return bill(JPID[val]);
      return bill('bvc') + `<b class="bv-val">${shortC(val * this.bet)}</b>`;
    }
    if (v === CASE) return bill('bvk') + (this.caseAmt?.[i] ? `<b class="bv-val case">${shortC(this.caseAmt[i])}</b>` : '');
    if (v === FSB) return bill('bvf');
    if (v === WILD) return bill('bvw');
    return bill(NOTE_IDS[v]);
  }

  onBetChange() {
    this.qa('[data-jp]').forEach((n) => { n.textContent = shortC(JP[n.dataset.jp] * this.bet); });
  }

  word(t, cls = '') {
    const w = this.q('.bv-word');
    w.textContent = t; w.className = `bv-word ${cls}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.25 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%,-62%) scale(1.15)' }], { duration: this.turbo ? 700 : 1200, easing: 'ease-out' });
  }

  // Banknotes raining over the screen (big wins, jackpots).
  rain(n = 18) {
    const ids = [...NOTE_IDS, 'bvc'];
    for (let k = 0; k < Math.min(n, 30); k++) {
      const d = el('div', 'bv-rain', bill(ids[k % ids.length]));
      d.style.cssText = `left:${Math.random() * 100}vw;--r:${Math.random() * 720 - 360}deg;--dx:${(Math.random() - 0.5) * 160}px;animation-duration:${1.8 + Math.random() * 1.4}s;animation-delay:${k * 60}ms`;
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 3800 + k * 60);
    }
  }

  onMain() { this.round(() => this.playRound(null)); }
  async onBuy(kind) { await this.playRound(kind); }

  async playRound(buy) {
    const b = this.bet;
    if (!buy && !this.pay(b)) return;
    this.lastStake = b;
    this.setLast(0); this.winAmt.textContent = ''; this.setBanner('');
    let total = 0;
    if (buy === 'fs') total = await this.freeSpins();
    else {
      const res = spin({ fs: false, forceCase: buy === 'case' });
      total = Math.min(res.total * b, b * CAPX);
      await this.show(res, b);
      if (total > 0) { this.win(Math.round(total)); this.setLast(total); }
      if (res.fsb >= 3) {
        this.stopAuto();
        if (total > 0) await this.celebrate(Math.round(total));
        total += await this.freeSpins();
      } else if (total > 0) { if (total >= b * 20) this.rain(20); await this.celebrate(Math.round(total)); }
    }
    this.setLast(total);
    this.msg(total >= b * CAPX ? `GAIN MAXIMUM ! ${fmtC(total)}` : total > 0 ? `Total du tour : ${fmtC(total)}` : 'Pas de gain');
  }

  async show(res, b) {
    this.vals = res.vals; this.caseAmt = {};
    let nf = 0;
    await this.reels.spin(res.g, {
      tease: (c, vals) => { let k = 0; for (let j = 0; j < c * ROWS; j++) if (vals[j] === FSB) k++; return k >= 2; },
      onStop: (c) => {
        for (let r = 0; r < ROWS; r++) {
          const i = c * ROWS + r, v = res.g[i];
          if (v === FSB) { nf++; sfx.land(); }
          if (v === CASH || v === CASE || v === FSB) { const p = center(this.reels.cell(i)); fx.burst(p.x, p.y, 8, v === FSB ? ['#4ade80', '#fde047'] : MONEY, 4); }
          if (v === CASH && typeof res.vals[i] === 'string') { sfx.feature(); this.q(`.bv-jp.${res.vals[i]}, .bv-grand`)?.classList.add('flash'); }
        }
      },
    });
    if (this.dead) return;
    if (res.wins.length) {
      const cells = new Set(); res.wins.forEach((w) => w.cells.forEach((i) => cells.add(i)));
      this.reels.mark([...cells]);
      this.msg(res.wins.map((w) => `${w.n} × billet de ${NOTE_VALS[w.s]}${w.ways > 1 ? ` (${w.ways} façons)` : ''} : +${fmtC(Math.round(w.x * b))}`).join(' · '));
      sfx.win();
      await this.wait(1100);
      this.reels.unmark();
    }
    if (res.cases) await this.collect(res, b);
    else if (res.cashSum > 0 && !res.wins.length) this.msg('Des billets cash… mais pas de mallette pour les collecter');
    this.qa('.flash').forEach((n) => n.classList.remove('flash'));
    if (nf >= 3) { this.word('FREE SPINS !', 'fs'); await this.wait(900); }
  }

  // Every cash bill flies into the briefcase(s), whose counter climbs.
  async collect(res, b) {
    const cases = [], cashes = [];
    res.g.forEach((v, i) => { if (v === CASE) cases.push(i); else if (v === CASH) cashes.push(i); });
    if (!cashes.length) { this.msg(cases.length > 1 ? 'Mallettes vides : pas de billet cash à collecter' : 'Mallette vide : pas de billet cash à collecter'); return; }
    this.msg(cases.length > 1 ? `${cases.length} mallettes collectent les billets cash !` : 'La mallette collecte les billets cash !');
    cases.forEach((i) => this.reels.cell(i)?.classList.add('collecting'));
    sfx.feature();
    await this.wait(500);
    const per = this.turbo ? 120 : 260;
    for (const ci of cases) {
      let amt = 0;
      for (const i of cashes) {
        if (this.dead) return;
        const from = this.reels.cell(i), to = this.reels.cell(ci);
        const r1 = from.getBoundingClientRect(), r2 = to.getBoundingClientRect();
        const fly = el('div', 'bv-fly', from.innerHTML);
        fly.style.cssText = `left:${r1.left}px;top:${r1.top}px;width:${r1.width}px;height:${r1.height}px`;
        document.body.appendChild(fly);
        await fly.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${(r2.left - r1.left) * 0.5}px,${(r2.top - r1.top) * 0.5 - 40}px) rotate(-8deg) scale(.8)`, offset: 0.5 },
          { transform: `translate(${r2.left - r1.left}px,${r2.top - r1.top}px) scale(.35)`, opacity: 0.3 }], { duration: per + 160, easing: 'ease-in' }).finished;
        fly.remove();
        const v = res.vals[i];
        amt += cashX(v) * b;
        this.caseAmt[ci] = amt;
        this.reels.set(ci, CASE);
        this.reels.cell(ci)?.classList.add('collecting');
        if (typeof v === 'string') { this.word(`${JPN[v]} !`, v); this.flash(v === 'grand' ? 'rgba(253,224,71,.8)' : 'rgba(255,255,255,.5)'); sfx.jackpot(); this.rain(v === 'grand' ? 30 : 12); await this.wait(900); }
        else sfx.coin();
      }
      const p = center(this.reels.cell(ci)); fx.burst(p.x, p.y, 24, MONEY, 7);
    }
    sfx.bigWin();
    this.msg(`Collecte : ${fmtC(Math.round(res.collect * b))}`);
    await this.wait(900);
    this.caseAmt = {};
    cases.forEach((i) => this.reels.cell(i)?.classList.remove('collecting'));
  }

  async freeSpins() {
    const b = this.bet, cap = b * CAPX;
    let left = FS_SPINS, tot = 0, done = 0;
    this.lastStake = b;
    await this.featureIntro('FREE SPINS', `${FS_SPINS} tours gratuits · mallettes sur tous les rouleaux · billets cash plus fréquents`, bill('bvf'));
    this.inFree = true;
    this.slotEl.classList.add('in-free');
    while (left > 0 && tot < cap && !this.dead) {
      left--; done++;
      this.setBanner(`<b>FREE SPINS</b><span class="pill">Tour ${done} / ${done + left}</span><span class="pill gold">Gain ${fmtC(Math.round(tot))}</span>`);
      const res = spin({ fs: true });
      const add = Math.min(res.total * b, cap - tot);
      await this.show(res, b);
      tot += add;
      if (add > 0) this.win(Math.round(add), 'Free spins');
      this.setLast(Math.round(tot));
      await this.wait(300);
    }
    this.inFree = false;
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    if (tot >= b * 20) this.rain(28);
    await this.celebrate(Math.round(tot), { summary: 'FREE SPINS', stake: b });
    return tot;
  }

  info() {
    const rows = NOTE_IDS.map((id, s) => `<div class="pay-item"><div class="pay-sym svg bvp">${bill(id)}</div><div class="pay-vals"><b>Billet de ${NOTE_VALS[s]} KE</b><br><span>3 : ×${xv(P.pays[s][0] * P.K)} · 4 : ×${xv(P.pays[s][1] * P.K)} · 5 : ×${xv(P.pays[s][2] * P.K)} (par façon)</span></div></div>`).join('');
    return this.rules(`<h4>Billets (× la mise, par façon)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym svg bvp">${bill('bvw')}</div><div class="pay-vals"><b>Coffre-fort WILD</b><br><span>Rouleaux 2 à 4, remplace tous les billets</span></div></div></div>
      <h4>243 façons de gagner</h4><p>Un billet paie dès qu’il apparaît sur 3 rouleaux d’affilée ou plus depuis la gauche, à n’importe quelle hauteur.</p>
      <h4>Billets cash et mallette</h4><p>Les <b>billets cash</b> affichent un gain (×0,5 à ×50 la mise) ou un jackpot : <b>MINI</b> ×${JP.mini}, <b>MAJEUR</b> ×${JP.major}, <b>JACKPOT</b> ×${JP.grand}. Une <b>mallette</b> sur le rouleau 5 collecte tous les billets cash visibles (chaque mallette collecte une fois).</p>
      <h4>Free spins</h4><p>3 billets <b>FREE SPINS</b> ou plus : ${FS_SPINS} tours gratuits, mallettes possibles sur tous les rouleaux et billets cash plus fréquents.</p>
      <h4>Achats</h4><p>Mallette garantie ×${String(BUY_CASE).replace('.', ',')} · Free spins ×${BUY_FS}. Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { BilletsGame };
})();
