// SpinBet Casino · LaboGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/labo.js ----
__mods['games/impl/labo.js'] = (() => {
// Le Labo: an underground lab turned casino. 5×4 reels, 1024 ways, 9 symbols, WILD « Le Dealer », free spins
// « La Descente » (flame multiplier), bonus « La Mallette » and jackpot « Le Cartel » (×1000, inside the briefcase).
// Tuned by simulation (RTP ≈ 91.8 %, La Descente buy ≈ 87 %, La Mallette buy ≈ 87 %).

const { BaseGame, fmtC, art } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { el } = __mods['ui.js'];

/* ===ENGINE */
// 5×4, 1024 ways. 9 symbols pay by ways from the left; WILD (Le Dealer) on reels 2-5 replaces them.
// LE DEALER: on some spins the demon turns 3 to 6 symbols of reels 2-5 into WILDs.
// 3+ RAINBOW SPIRALS (scatter): LA DESCENTE, free spins where the flame multiplier climbs +1 after every winning spin.
// 3+ BRIEFCASES (base game): LA MALLETTE, a hold & spin of cups and green smoke (see malletteBonus); full screen = JACKPOT ×1000.
const COLS = 5, ROWS = 4, N = 20, WILD = 9, SC = 10, CASE = 11, CAPX = 5000, JPX = 1000;
const FS_N = { 3: 10, 4: 12, 5: 15 }, RETRIG = 5;
const P = {
  w: [26, 24, 22, 20, 15, 13, 11, 8, 5], wild: 2.2, wildFS: 2.6,
  pays: [[0.2, 0.5, 1.5], [0.2, 0.5, 1.5], [0.25, 0.6, 2], [0.25, 0.75, 2.5], [0.4, 1, 3], [0.5, 1.25, 4], [0.6, 1.5, 5], [0.8, 2.5, 8], [1.5, 5, 20]], K: 0.164,
  sc: 0.018, scFS: 0.02, cs: 0.018,
  dealer: 0.06, dealerFS: 0.12, dealerN: [[3, 40], [4, 30], [5, 20], [6, 10]],
};
function wpick(l) { let t = 0; for (const x of l) t += x[1]; let r = Math.random() * t; for (const x of l) { if (r < x[1]) return x[0]; r -= x[1]; } return l[l.length - 1][0]; }
function cell(c, fs) {
  const r = Math.random();
  const ps = fs ? P.scFS : P.sc, pc = fs ? 0 : P.cs;
  if (r < ps) return SC;
  if (r < ps + pc) return CASE;
  const ww = c >= 1 ? (fs ? P.wildFS : P.wild) : 0;
  let t = ww; for (const x of P.w) t += x;
  let q = Math.random() * t;
  if (q < ww) return WILD; q -= ww;
  for (let i = 0; i < P.w.length; i++) { if (q < P.w[i]) return i; q -= P.w[i]; }
  return 0;
}
function ways(g) {
  const wins = [];
  for (let s = 0; s < 9; s++) {
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
// One spin: the grid as it lands, the Dealer's WILDs (if he comes), the ways wins, the scatters and briefcases.
function spin(o) {
  const g = []; for (let i = 0; i < N; i++) g[i] = cell(Math.floor(i / ROWS), o.fs);
  if (o.force === 'fs') { const cs = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3); cs.forEach((c) => { g[c * ROWS + Math.floor(Math.random() * ROWS)] = SC; }); }
  if (o.force === 'case') { const cs = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3); cs.forEach((c) => { g[c * ROWS + Math.floor(Math.random() * ROWS)] = CASE; }); }
  const g0 = g.slice();
  let dealer = [];
  if (Math.random() < (o.fs ? P.dealerFS : P.dealer)) {
    const spots = []; for (let i = ROWS; i < N; i++) if (g[i] < 9) spots.push(i);
    spots.sort(() => Math.random() - 0.5);
    dealer = spots.slice(0, wpick(P.dealerN));
    dealer.forEach((i) => { g[i] = WILD; });
  }
  const wins = ways(g);
  let x = 0; wins.forEach((w) => { x += w.x; });
  const sc = g.filter((v) => v === SC).length, cases = g.filter((v) => v === CASE).length;
  return { g0, g, dealer, wins, x, sc, cases };
}
// LA MALLETTE (hold & spin): the briefcases that triggered it become the first cups. 5 respins, back to 5 each time
// a cup lands. Cups stick and carry a multiplier (green, blue or pink cup: small, medium, big values); every cup
// sends its value into the green smoke in the middle (the bonus total, × the bet). A cannabis leaf multiplies the
// cups around it (×2), a golden leaf multiplies every cup (×2), a magic cup sucks every cup in (it keeps their total
// and frees their cells). A full screen of cups = JACKPOT LE CARTEL ×1000.
const B = {
  spins: 5,
  land: [['g', 0.031], ['b', 0.007], ['p', 0.0017], ['leaf', 0.0045], ['gold', 0.0004], ['magic', 0.0024]],
  cupV: [[[0.2, 45], [0.5, 35], [1, 20]], [[1, 50], [2, 32], [3, 18]], [[5, 55], [10, 33], [20, 12]]],
  start: [[0, 70], [1, 25], [2, 5]], leafX: 2, goldX: 2,
};
const CUPK = { g: 0, b: 1, p: 2 };
function near(i) { const c = Math.floor(i / ROWS), r = i % ROWS, out = []; for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) { if (!dc && !dr) continue; const cc = c + dc, rr = r + dr; if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS) out.push(cc * ROWS + rr); } return out; }
function cup(k) { return { t: 'cup', k, v: wpick(B.cupV[k]) }; }
function malletteBonus(startCells) {
  const cells = new Array(N).fill(null);
  startCells.forEach((i) => { cells[i] = cup(wpick(B.start)); });
  const snap = () => cells.map((c) => (c ? { ...c } : null));
  const sum = () => cells.reduce((a, c) => a + (c ? c.v : 0), 0);
  const steps = [], start = snap();
  let left = B.spins, jp = false;
  while (left > 0) {
    left--;
    const lands = [];
    for (let i = 0; i < N; i++) {
      if (cells[i]) continue;
      let r = Math.random();
      for (const [t, p] of B.land) { if (r < p) { lands.push({ i, t }); break; } r -= p; }
    }
    const st = { cups: [], leaves: [], golds: [], magics: [] };
    let fresh = false;
    lands.filter((l) => CUPK[l.t] !== undefined).forEach((l) => { cells[l.i] = cup(CUPK[l.t]); st.cups.push({ i: l.i, ...cells[l.i] }); fresh = true; });
    lands.filter((l) => l.t === 'leaf').forEach((l) => {
      const hit = near(l.i).filter((j) => cells[j]);
      hit.forEach((j) => { cells[j].v *= B.leafX; });
      st.leaves.push({ i: l.i, hit, vals: hit.map((j) => cells[j].v) });
    });
    lands.filter((l) => l.t === 'gold').forEach((l) => {
      const hit = []; cells.forEach((c, j) => { if (c) { c.v *= B.goldX; hit.push(j); } });
      st.golds.push({ i: l.i, hit, vals: hit.map((j) => cells[j].v) });
    });
    lands.filter((l) => l.t === 'magic').forEach((l) => {
      if (cells[l.i]) return; // a cup already took the cell this spin
      const from = []; let v = 0;
      cells.forEach((c, j) => { if (c) { v += c.v; from.push(j); cells[j] = null; } });
      cells[l.i] = { t: 'magic', v: Math.max(v, 1) };
      st.magics.push({ i: l.i, from, v: cells[l.i].v });
      fresh = true;
    });
    if (fresh) left = B.spins;
    st.left = left; st.total = sum(); st.grid = snap();
    steps.push(st);
    if (cells.every((c) => c)) { jp = true; break; }
  }
  const total = Math.round(sum() * 100) / 100;
  return { start, steps, total, jp, x: Math.min(CAPX, total + (jp ? JPX : 0)) };
}
/* ===END ENGINE */

// Painted images from the owner (assets/games/labo/<name>.webp) replace the drawn art as soon as their name is
// listed here: s0..s8 (symbols: leaf, joint, pills, mushroom, blotter, pink pill, powder bag, brick, boss), w (WILD), sc (rainbow spiral), case (briefcase), bg (lab background), demon (boss on his throne).
const PAINTED = new Set(['s0', 's2', 's4', 's5', 's6', 's7', 's8', 'w', 'sc', 'bg', 'leaf', 'gleaf']); // + La Mallette: cup0, cup1, cup2 (green, blue, pink cups), leaf, gleaf (golden leaf), magic (magic cup)
const IMG_V = 1;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images are inlined
const FILE = (v) => (v === WILD ? 'w' : v === SC ? 'sc' : v === CASE ? 'case' : `s${v}`);
const SVGID = (v) => (v === WILD ? 'lbw' : v === SC ? 'lbsc' : v === CASE ? 'lbcase' : `lb${v}`);
const painted = (name) => PAINTED.has(name);
const img = (name, cls = 'lb-img') => `<img class="${cls}" src="${asset(`assets/games/labo/${name}.webp`)}" alt="" draggable="false" decoding="async">`;
const symArt = (v) => (painted(FILE(v)) ? img(FILE(v)) : art(SVGID(v)));

const NAMES = ['Feuille', 'Joint', 'Cachet diamant', 'Champignon magique', 'Buvard LSD', 'Cachet rose', 'Poudre', 'Cachet brique', 'Le Boss'];
const BUY_FS = 50, BUY_CASE = 33;
const CUPN = ['Tasse verte', 'Tasse bleue', 'Tasse rose'], CUPC = ['#4ade80', '#38bdf8', '#f472b6'];
const bArt = (name, svg) => (painted(name) ? img(name) : art(svg));
const cupArt = (k) => bArt(`cup${k}`, `lbcup${k}`);
const HELL = ['#f472b6', '#fde047', '#4ade80', '#22d3ee', '#a855f7', '#f97316'];
const GOLD = ['#fde047', '#fbbf24', '#fff7c2', '#f59e0b'];
const xv = (m) => (m >= 10 ? String(Math.round(m * 10) / 10).replace('.', ',') : String(Math.round(m * 100) / 100).replace('.', ','));

class LaboGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.labo,
      frameCls: 'lb-frame',
      stage: `<div class="lb-scene">
          <svg class="lb-room" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <g class="lb-neon" fill="none" stroke-width="5" stroke-linecap="round">${['#f472b6', '#fde047', '#4ade80', '#22d3ee', '#a855f7'].map((c, k) => `<path d="M${40 + k * 12} 300 A${160 - k * 12} ${160 - k * 12} 0 0 1 ${360 - k * 12} 300" stroke="${c}"/>`).join('')}</g>
            <g class="lb-shelf"><rect x="0" y="70" width="80" height="5" fill="#4c1d95"/><rect x="320" y="70" width="80" height="5" fill="#4c1d95"/><rect x="0" y="150" width="70" height="5" fill="#4c1d95"/><rect x="330" y="150" width="70" height="5" fill="#4c1d95"/>
              <path d="M12 70 v-14 l-6 -12 h18 l-6 12 v14z" fill="#4ade80" opacity=".85"/><path d="M36 70 v-24 h10 v24z" fill="#f472b6" opacity=".85"/><circle cx="62" cy="62" r="8" fill="#22d3ee" opacity=".85"/>
              <path d="M340 70 v-20 l-7 -10 h20 l-7 10 v20z" fill="#fde047" opacity=".85"/><path d="M366 70 v-26 h9 v26z" fill="#a855f7" opacity=".85"/><circle cx="388" cy="63" r="7" fill="#4ade80" opacity=".85"/>
              <use href="#lb3" x="6" y="118" width="32" height="32"/><use href="#lb3" x="40" y="128" width="22" height="22"/><use href="#lb3" x="360" y="118" width="32" height="32"/><use href="#lb3" x="338" y="128" width="22" height="22"/></g>
            <g class="lb-signs"><use href="#lb0" x="66" y="6" width="54" height="54"/><use href="#lb0" x="280" y="6" width="54" height="54"/></g>
          </svg>
          <i class="lb-flames"></i><i class="lb-flames b"></i>
          <div class="lb-bills">${Array.from({ length: 7 }, (_, k) => `<svg viewBox="0 0 64 64" style="--k:${k}" aria-hidden="true"><use href="#${['lbbill', 'lb2', 'lb5', 'lbbill', 'lb4', 'lb2', 'lbbill'][k]}" width="64" height="64"/></svg>`).join('')}</div>
        </div>
        <div class="lb-throne">${painted('demon') ? img('demon', 'lb-demon-img') : '<svg viewBox="0 0 400 300" aria-hidden="true"><use href="#lbdemon" width="400" height="300"/></svg>'}</div>
        <div class="lb-meter"><small>TRIP</small><b>×1</b></div>
        <div class="reels-host"></div><div class="lb-word"></div>`,
      buys: [
        { id: 'case', icon: '💼', label: 'La Mallette · 3 mallettes', desc: 'Un tour avec 3 mallettes garanties : tasses, feuilles et fumée verte, écran plein = jackpot Le Cartel', cost: (b) => b * BUY_CASE },
        { id: 'fs', icon: '🔥', label: 'La Descente · 3 spirales', desc: `${FS_N[3]} tours gratuits, le multiplicateur monte à chaque gain`, cost: (b) => b * BUY_FS },
      ],
      hello: '1024 façons de gagner · le Dealer peut poser des WILD à tout moment',
    });
    if (painted('bg')) this.q('.lb-scene').style.backgroundImage = `url("${asset('assets/games/labo/bg.webp')}")`;
    this.q('.lb-scene').classList.toggle('photo', painted('bg'));
    [...PAINTED].forEach((n) => { new Image().src = asset(`assets/games/labo/${n}.webp`); });
    this.meter = this.q('.lb-meter');
    this.reels = new Reels(this.q('.reels-host'), {
      cols: COLS, rows: ROWS, game: this, random: (c) => cell(c, this.inFree),
      art: symArt,
      cls: (v) => (v === WILD ? 'wild' : v === SC ? 'scat' : v === CASE ? 'case' : v === 8 ? 'boss' : ''),
    });
    this.reels.setAll(Array.from({ length: N }, (_, i) => cell(Math.floor(i / ROWS), false)));
    // La Mallette board: a 5×4 grid of cups over the reels, the green smoke in the middle
    this.board = el('div', 'lb-bonus', `<div class="lb-bgrid">${Array.from({ length: N }, () => '<div class="lb-bc"></div>').join('')}</div>
      <div class="lb-smoke"><i></i><small>FUMÉE VERTE</small><b>×0</b><em></em></div>`);
    this.q('.reels-host').appendChild(this.board);
    // the grid is filled column by column like the reels: cell i = column i / ROWS, row i % ROWS
    const bc = [...this.board.querySelectorAll('.lb-bc')];
    this.bcells = Array.from({ length: N }, (_, i) => bc[(i % ROWS) * COLS + Math.floor(i / ROWS)]);
    this.smoke = this.board.querySelector('.lb-smoke');
  }

  word(t, cls = '') {
    const w = this.q('.lb-word');
    w.textContent = t; w.className = `lb-word ${cls}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.25 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%,-62%) scale(1.15)' }], { duration: this.turbo ? 700 : 1300, easing: 'ease-out' });
  }

  setMult(m, pop) {
    this.meter.querySelector('b').textContent = `×${m}`;
    if (pop) this.meter.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'cubic-bezier(.3,1.6,.5,1)' });
  }

  // Leaves, pills and blotters raining over the whole screen.
  rain(n = 18) {
    for (let k = 0; k < Math.min(n, 30); k++) {
      const d = el('div', 'lb-rain', `<svg viewBox="0 0 64 64"><use href="#${['lbbill', 'lb2', 'lb5', 'lb4'][k % 4]}" width="64" height="64"/></svg>`);
      d.style.cssText = `left:${Math.random() * 100}vw;--r:${Math.random() * 720 - 360}deg;--dx:${(Math.random() - 0.5) * 160}px;animation-duration:${1.8 + Math.random() * 1.4}s;animation-delay:${k * 60}ms`;
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 3800 + k * 60);
    }
  }

  onMain() { this.round(() => this.playRound(null)); }
  async onBuy(kind) { await this.playRound(kind); }

  async playRound(buy) {
    const b = this.bet, cap = b * CAPX;
    if (!buy && !this.pay(b)) return;
    this.lastStake = b;
    this.setLast(0); this.winAmt.textContent = ''; this.setBanner('');
    const res = spin({ fs: false, force: buy });
    await this.show(res, b, 1);
    if (this.dead) return;
    let total = Math.min(Math.round(res.x * b), cap);
    if (total > 0) { this.win(total); this.setLast(total); }
    if (res.cases >= 3 || res.sc >= 3) {
      this.stopAuto();
      if (total > 0) await this.celebrate(total, { quick: true });
      if (res.cases >= 3) {
        const add = Math.min(await this.mallette(res.g.map((v, i) => (v === CASE ? i : -1)).filter((i) => i >= 0), b), cap - total);
        total += add;
      }
      if (res.sc >= 3 && total < cap && !this.dead) {
        const add = Math.min(await this.descent(FS_N[Math.min(5, res.sc)], cap - total), cap - total);
        total += add;
      }
    } else if (total > 0) { if (total >= b * 20) this.rain(20); await this.celebrate(total); }
    this.setLast(total);
    this.msg(total >= cap ? `GAIN MAXIMUM ! ${fmtC(total)}` : total > 0 ? `Total du tour : ${fmtC(total)}` : res.sc === 2 ? 'Presque… 2 spirales' : 'Pas de gain');
  }

  // Reels land, the Dealer may come, then the ways wins light up.
  async show(res, b, mult) {
    await this.reels.spin(res.g0, {
      tease: (c, vals) => { let s = 0, k = 0; for (let j = 0; j < c * ROWS; j++) { if (vals[j] === SC) s++; if (vals[j] === CASE) k++; } return s >= 2 || k >= 2; },
      onStop: (c) => { for (let r = 0; r < ROWS; r++) this.landFx(c * ROWS + r, res.g0[c * ROWS + r]); },
    });
    if (this.dead) return;
    if (res.dealer.length) await this.dealer(res.dealer);
    if (this.dead || !res.wins.length) return;
    const cells = new Set(); res.wins.forEach((w) => w.cells.forEach((i) => cells.add(i)));
    this.reels.mark([...cells]);
    const amt = Math.round(res.x * b * mult);
    this.msg(res.wins.slice(0, 3).map((w) => `${w.n} × ${NAMES[w.s]}${w.ways > 1 ? ` (${w.ways} façons)` : ''}`).join(' · ') + (res.wins.length > 3 ? ` · +${res.wins.length - 3}` : '') + ` : +${fmtC(amt)}${mult > 1 ? ` <span class="pill hot">×${mult}</span>` : ''}`);
    this.winAmt.textContent = fmtC(amt);
    sfx.win();
    if (res.x >= 5) { this.word(res.x * mult >= 20 ? 'QUEL TRIP !' : 'PLANANT !', 'big'); this.shake(); }
    await this.wait(this.turbo ? 500 : 1000);
    this.reels.unmark();
  }

  landFx(i, v) {
    if (v === SC || v === CASE) {
      sfx.land();
      const p = center(this.reels.cell(i)); fx.burst(p.x, p.y, 10, v === SC ? ['#4ade80', '#f97316', '#fde047'] : GOLD, 4);
    }
  }

  // WILD – LE DEALER: the demon leans over the machine and turns some symbols into WILDs.
  async dealer(cells) {
    this.slotEl.classList.add('dealer');
    this.word('LE DEALER !', 'dealer');
    sfx.feature();
    await this.wait(this.turbo ? 350 : 750);
    for (const i of cells) {
      if (this.dead) return;
      const n = this.reels.cell(i);
      if (n) { const p = center(n); fx.burst(p.x, p.y, 12, ['#a855f7', '#fde047', '#22c55e'], 5); }
      this.reels.set(i, WILD);
      this.reels.cell(i)?.classList.add('pop');
      sfx.coin();
      await this.wait(this.turbo ? 80 : 170);
    }
    await this.wait(this.turbo ? 150 : 350);
    this.slotEl.classList.remove('dealer');
  }

  // BONUS – LA MALLETTE: hold & spin. The briefcases become cups, 5 respins (back to 5 when a cup lands), every cup
  // sends its multiplier into the green smoke; leaves multiply the cups around them, the golden leaf every cup, the
  // magic cup sucks them all in. Full screen = JACKPOT LE CARTEL.
  cupHTML(c) {
    if (!c) return '';
    if (c.t === 'magic') return `${bArt('magic', 'lbmagic')}<i class="lb-glit"></i><b class="lb-cv">×${xv(c.v)}</b>`;
    return `${cupArt(c.k)}<b class="lb-cv">×${xv(c.v)}</b>`;
  }

  setCell(i, c, pop) {
    const n = this.bcells[i];
    n._c = c ? { ...c } : null;
    n.className = `lb-bc${c ? (c.t === 'magic' ? ' magic' : ` cup k${c.k}`) : ''}`;
    n.innerHTML = this.cupHTML(c);
    if (pop && c) n.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }], { duration: this.turbo ? 220 : 420, easing: 'ease-out' });
  }

  setSmoke(x, b, pump) {
    this.smoke.querySelector('b').textContent = `×${xv(x)}`;
    this.smoke.querySelector('em').textContent = fmtC(Math.round(x * b));
    if (pump) this.smoke.querySelector('b').animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.3,1.6,.5,1)' });
  }

  // A cell's value flies into the green smoke (or into another cell).
  async fly(from, to, color) {
    fx.trail(center(this.bcells[from]), center(to === 'smoke' ? this.smoke : this.bcells[to]), color, 10);
    await this.wait(this.turbo ? 120 : 260);
  }

  async showOnCell(i, html, cls) {
    const n = this.bcells[i];
    n._c = null; n.className = `lb-bc ${cls}`; n.innerHTML = html;
    n.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }], { duration: this.turbo ? 220 : 420 });
    const p = center(n); fx.burst(p.x, p.y, 14, cls === 'gleaf' ? GOLD : ['#4ade80', '#bef264', '#fff'], 5);
    await this.wait(this.turbo ? 200 : 450);
  }

  async mallette(startCells, b) {
    const m = malletteBonus(startCells);
    await this.featureIntro('LA MALLETTE', 'La fumée verte récolte les tasses · 5 tours, remis à 5 à chaque tasse · écran plein = JACKPOT LE CARTEL', symArt(CASE));
    this.slotEl.classList.add('in-case');
    this.msg('La Mallette est ouverte : la fumée verte récolte les tasses, remplis l’écran !');
    // the briefcases open into the first cups
    let run = 0;
    this.bcells.forEach((n, i) => this.setCell(i, null));
    this.setSmoke(0, b);
    const initial = startCells.map((i) => ({ i, c: m.start[i] }));
    for (const { i, c } of initial) {
      if (this.dead) return 0;
      this.setCell(i, c, true); sfx.land();
      await this.fly(i, 'smoke', CUPC[c.k]);
      run += c.v; this.setSmoke(run, b, true);
    }
    let done = 0;
    for (const st of m.steps) {
      if (this.dead) return 0;
      done++;
      this.setBanner(`<b>LA MALLETTE</b><span class="pill">Tour ${done}</span><span class="pill hot">Tours restants ${st.left}</span><span class="pill gold">${fmtC(Math.round(run * b))}</span>`);
      // the empty cells spin
      const empty = this.bcells.filter((n) => !n.classList.contains('cup') && !n.classList.contains('magic'));
      empty.forEach((n) => n.classList.add('roll'));
      sfx.click();
      await this.wait(this.turbo ? 260 : 560);
      empty.forEach((n) => n.classList.remove('roll'));
      for (const c of st.cups) {
        this.setCell(c.i, c, true); sfx.land();
        await this.fly(c.i, 'smoke', CUPC[c.k]);
        run += c.v; this.setSmoke(run, b, true);
      }
      for (const l of st.leaves) {
        await this.showOnCell(l.i, bArt('leaf', 'lbbill'), 'leaf');
        for (let k = 0; k < l.hit.length; k++) {
          const j = l.hit[k], c = { ...this.cellAt(j), v: l.vals[k] };
          await this.fly(l.i, j, '#4ade80');
          run += c.v - this.cellAt(j).v;
          this.setCell(j, c, true); this.setSmoke(run, b, true); sfx.coin();
        }
        if (!l.hit.length) this.msg('Une feuille… mais aucune tasse à côté');
        this.setCell(l.i, null);
      }
      for (const g of st.golds) {
        await this.showOnCell(g.i, bArt('gleaf', 'lbgleaf'), 'gleaf');
        this.flash('rgba(253,224,71,.6)'); sfx.feature(); this.word('FEUILLE D’OR ×2', 'big');
        g.hit.forEach((j, k) => { const c = { ...this.cellAt(j), v: g.vals[k] }; run += c.v - this.cellAt(j).v; this.setCell(j, c, true); });
        this.setSmoke(run, b, true);
        await this.wait(this.turbo ? 300 : 700);
        this.setCell(g.i, null);
      }
      for (const g of st.magics) {
        this.setCell(g.i, { t: 'magic', v: 0 }, true);
        sfx.feature(); this.word('TASSE MAGIQUE !', 'dealer');
        await this.wait(this.turbo ? 200 : 450);
        for (const j of g.from) { fx.trail(center(this.bcells[j]), center(this.bcells[g.i]), '#e879f9', 10); this.setCell(j, null); }
        await this.wait(this.turbo ? 250 : 550);
        this.setCell(g.i, { t: 'magic', v: g.v }, true);
        const p = center(this.bcells[g.i]); fx.burst(p.x, p.y, 24, ['#e879f9', '#fde047', '#fff', '#22d3ee'], 6);
      }
      // the step's final state is the truth (values, magic cup, freed cells)
      st.grid.forEach((c, i) => { if (JSON.stringify(c) !== JSON.stringify(this.cellAt(i))) this.setCell(i, c); });
      run = st.total; this.setSmoke(run, b);
      this.setBanner(`<b>LA MALLETTE</b><span class="pill">Tour ${done}</span><span class="pill hot">Tours restants ${st.left}</span><span class="pill gold">${fmtC(Math.round(run * b))}</span>`);
      await this.wait(this.turbo ? 120 : 320);
    }
    if (m.jp && !this.dead) { this.msg('ÉCRAN PLEIN DE TASSES !'); await this.cartel(b); }
    await this.wait(this.turbo ? 300 : 700);
    this.slotEl.classList.remove('in-case');
    this.setBanner('');
    const tot = Math.round(m.x * b);
    this.win(tot, 'La Mallette');
    this.setLast(tot);
    if (tot >= b * 20) this.rain(24);
    await this.celebrate(tot, { summary: m.jp ? 'LE CARTEL' : 'LA MALLETTE', stake: b });
    return tot;
  }

  cellAt(i) {
    const n = this.bcells[i];
    return n._c ?? null;
  }

  // JACKPOT – LE CARTEL: the demon rises from his throne, the reels burst in red and gold light.
  async cartel(b) {
    this.slotEl.classList.add('cartel');
    sfx.jackpot();
    this.flash('rgba(239,68,68,.8)');
    this.shake();
    this.word('LE CARTEL !', 'jp');
    for (let k = 0; k < N; k++) { const n = this.slotEl.classList.contains('in-case') ? this.bcells[k] : this.reels.cell(k); if (n) { const p = center(n); fx.burst(p.x, p.y, 6, ['#ef4444', '#fde047', '#fff'], 6); } }
    this.rain(30);
    fx.coins(60);
    await this.wait(this.turbo ? 900 : 2200);
    this.flash('rgba(253,224,71,.8)');
    await this.wait(this.turbo ? 300 : 700);
    this.slotEl.classList.remove('cartel');
    const ov = this.overlay(`<div class="intro-glyph">${symArt(8)}</div><h3>JACKPOT · LE CARTEL</h3><p>×${JPX} la mise : ${fmtC(JPX * b)}</p><small>Touchez pour continuer</small>`, 'intro lb-jp');
    await new Promise((resolve) => {
      const done = () => { ov.classList.add('out'); setTimeout(() => { ov.remove(); resolve(); }, 300); };
      const t = setTimeout(done, this.turbo ? 1500 : 3200);
      ov.addEventListener('click', () => { clearTimeout(t); done(); }, { once: true });
    });
  }

  // FREE SPINS – LA DESCENTE: flames invade the screen, the flame multiplier climbs +1 after every winning spin.
  async descent(n, room) {
    const b = this.bet;
    let left = n, tot = 0, done = 0, m = 1;
    this.lastStake = b;
    await this.featureIntro('LA DESCENTE', `${n} tours gratuits · le trip monte : +1 au multiplicateur à chaque gain`, symArt(SC));
    this.inFree = true;
    this.slotEl.classList.add('in-free');
    this.setMult(1);
    while (left > 0 && tot < room && !this.dead) {
      left--; done++;
      this.setBanner(`<b>LA DESCENTE</b><span class="pill">Tour ${done} / ${done + left}</span><span class="pill hot">Trip ×${m}</span><span class="pill gold">Gain ${fmtC(tot)}</span>`);
      const res = spin({ fs: true });
      await this.show(res, b, m);
      if (this.dead) break;
      const add = Math.min(Math.round(res.x * b * m), room - tot);
      tot += add;
      if (add > 0) { this.win(add, 'La Descente'); this.setLast(tot); }
      if (res.x > 0) { m++; this.setMult(m, true); this.flames(); }
      if (res.sc >= 3) { left += RETRIG; await this.featureIntro(`+${RETRIG} TOURS`, 'Le trip continue…', symArt(SC), 1300); }
      await this.wait(this.turbo ? 120 : 300);
    }
    this.inFree = false;
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    if (tot >= b * 20) this.rain(28);
    await this.celebrate(tot, { summary: 'LA DESCENTE', stake: b });
    return tot;
  }

  flames() {
    const r = this.stage.getBoundingClientRect();
    for (let k = 0; k < 6; k++) fx.burst(r.left + Math.random() * r.width, r.bottom - 10, 8, HELL, 6);
  }

  info() {
    const rows = [8, 7, 6, 5, 4, 3, 2, 1, 0].map((s) => `<div class="pay-item"><div class="pay-sym svg">${symArt(s)}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>3 : ×${xv(P.pays[s][0] * P.K)} · 4 : ×${xv(P.pays[s][1] * P.K)} · 5 : ×${xv(P.pays[s][2] * P.K)} (par façon)</span></div></div>`).join('');
    return this.rules(`<h4>Symboles (× la mise, par façon)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym svg">${symArt(WILD)}</div><div class="pay-vals"><b>WILD · Le Dealer</b><br><span>Rouleaux 2 à 5, remplace tous les symboles</span></div></div></div>
      <h4>1024 façons de gagner</h4><p>Un symbole paie dès qu’il apparaît sur 3 rouleaux d’affilée ou plus depuis la gauche, à n’importe quelle hauteur.</p>
      <h4>WILD – Le Dealer</h4><p>À n’importe quel tour, le démon peut se pencher sur la machine et transformer 3 à 6 symboles des rouleaux 2 à 5 en WILD.</p>
      <h4>Free spins – La Descente</h4><p>${symArt(SC).replace('<svg', '<svg style="width:22px;height:22px;vertical-align:middle"')} 3, 4 ou 5 spirales : ${FS_N[3]}, ${FS_N[4]} ou ${FS_N[5]} tours gratuits. Le trip commence, les flammes arc-en-ciel envahissent l’écran : chaque tour gagnant ajoute +1 au multiplicateur, qui ne redescend jamais. 3 spirales de plus : +${RETRIG} tours. Le Dealer passe deux fois plus souvent.</p>
      <h4>Bonus – La Mallette</h4><p>3 mallettes ou plus : chaque mallette devient une tasse et le bonus démarre avec <b>${B.spins} tours</b>. Les tasses restent en place, et chaque nouvelle tasse remet les tours à ${B.spins}. Chaque tasse envoie son multiplicateur dans la <b>fumée verte</b> au milieu, qui fait le total.</p>
      <div class="paytable">${[0, 1, 2].map((k) => `<div class="pay-item"><div class="pay-sym svg">${cupArt(k)}</div><div class="pay-vals"><b>${CUPN[k]}</b><br><span>×${B.cupV[k].map((v) => xv(v[0])).join(', ×')} la mise</span></div></div>`).join('')}
      <div class="pay-item"><div class="pay-sym svg">${bArt('leaf', 'lbbill')}</div><div class="pay-vals"><b>Feuille</b><br><span>Multiplie par ${B.leafX} toutes les tasses qui la touchent</span></div></div>
      <div class="pay-item"><div class="pay-sym svg">${bArt('gleaf', 'lbgleaf')}</div><div class="pay-vals"><b>Feuille d’or</b><br><span>Multiplie par ${B.goldX} toutes les tasses de l’écran</span></div></div>
      <div class="pay-item"><div class="pay-sym svg">${bArt('magic', 'lbmagic')}</div><div class="pay-vals"><b>Tasse magique</b><br><span>Aspire toutes les tasses et garde leur valeur : ça libère de la place</span></div></div></div>
      <h4>Jackpot – Le Cartel</h4><p>Remplis <b>tout l’écran de tasses</b> pendant La Mallette : le démon se lève de son trône et ajoute <b>×${JPX} la mise</b>.</p>
      <h4>Achats</h4><p>La Mallette ×${BUY_CASE} · La Descente ×${BUY_FS}. Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { LaboGame };
})();
