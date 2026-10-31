// SpinBet Casino · AnubisGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/anubis.js ----
__mods['games/impl/anubis.js'] = (() => {
// Anubis Reborn, rebuilt on the shared cabinet. Cascades, Underworld and Judgment (original math).

const { BaseGame, fmtC, art } = __mods['core/base.js'];
const { SymbolGrid } = __mods['core/grid.js'];
const { DEFS } = __mods['art/anubis.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];

/* ===ENGINE (original) */
const C = 5, R = 6, N = 30, MINC = 5, F = 0.33, UINC = 3, CAPX = 10000;
const SYMN = 9, VAL = [40, 20, 12, 8, 3, 2, 1.5, 1, 0.8], W = [2, 3, 4, 5, 30, 30, 28, 26, 24], WILD = -2, SC = -1, WW = 1.3, SCW = 1.72;
const SW = W.reduce((a, b) => a + b, 0), TOT = SW + WW + SCW;
const PG = 0.002;
let GKT = null;
function gkVal() { if (!GKT) { GKT = []; let t = 0; for (let k = 2; k <= 100; k++) { t += Math.pow(k, -1.7); GKT.push([k, t]); } GKT.forEach((x) => { x[1] /= t; }); } const r = Math.random(); for (const x of GKT) if (r <= x[1]) return x[0]; return 100; }
function rnd() { let r = Math.random() * TOT; if (r < SW) { for (let i = 0; i < W.length; i++) { if (r < W[i]) return i; r -= W[i]; } } r -= SW; if (r < WW) return WILD; return SC; }
function rndU() { return Math.random() < PG ? 1000 + gkVal() : rnd(); }
function nbr(k) { const c = Math.floor(k / R), r = k % R, o = []; if (r > 0) o.push(k - 1); if (r < R - 1) o.push(k + 1); if (c > 0) o.push(k - R); if (c < C - 1) o.push(k + R); return o; }
const NB = Array.from({ length: N }, (_, q) => nbr(q));
function clusters(grid) {
  const out = [];
  for (let S = 0; S < SYMN; S++) {
    const seen = {};
    for (let k = 0; k < N; k++) {
      if (grid[k] !== S || seen[k]) continue;
      const st = [k], cs = []; seen[k] = 1;
      while (st.length) { const x = st.pop(); cs.push(x); NB[x].forEach((n) => { if (!seen[n] && (grid[n] === S || grid[n] === WILD)) { seen[n] = 1; st.push(n); } }); }
      if (cs.length >= MINC) out.push({ s: S, cells: cs });
    }
  }
  return out;
}
const JW = [['cube', 62], ['sk', 12], ['g', 0.2], ['red', 3]], JPC = 0.175;
// Judgment skulls add +2 to +500 to the value of the next cubes; a very rare 10 000 skull is an instant max win.
const SKV = [[2, 30], [3, 22], [4, 16], [5, 12], [6, 9], [8, 7], [10, 5], [15, 4], [20, 2.5], [25, 2], [40, 1.3], [60, 0.9], [100, 0.5], [150, 0.3], [250, 0.12], [500, 0.04], [10000, 0.0003]];
const SK_MAX = 10000;
function skVal() { let t = 0; SKV.forEach((x) => { t += x[1]; }); let r = Math.random() * t; for (const x of SKV) { if (r < x[1]) return x[0]; r -= x[1]; } return SKV[0][0]; }
function pickItem(cubes) {
  const ws = JW.filter((w) => !(w[0] === 'cube' && cubes >= R) && !(w[0] === 'red' && cubes === 0) && !(w[0] === 'g' && cubes === 0));
  let t = 0; ws.forEach((w) => { t += w[1]; }); let r = Math.random() * t;
  for (const w of ws) { if (r < w[1]) return w[0]; r -= w[1]; }
  return ws[ws.length - 1][0];
}
/* ===END ENGINE */

const MUSIC = { sd: 0.3, len: 16, root: 110, pad: { wave: 'sawtooth', vol: 0.02, dur: 2.2, map: { 0: [0, 3, 7], 8: [-4, 0, 3] } }, lead: { wave: 'triangle', vol: 0.06, dur: 0.5, pat: [null, null, null, null, 12, null, null, 15, null, null, null, null, 14, null, 12, null] }, bass: { wave: 'sine', vol: 0.16, dur: 0.9, pat: [-12, null, null, null, null, null, null, null, -16, null, null, null, null, null, null, null] }, kick: [0, 3, 8, 11], kv: 0.28 };
const NAMES = ['Anubis', 'Ankh', 'Œil d’Horus', 'Scarabée', 'Gemme bleue', 'Gemme verte', 'Gemme violette', 'Gemme jaune', 'Gemme orange'];
const BUYU = 100, BUYJ = 150;
const fxv = (v) => (v >= 10000 ? Math.round(v / 1000) + 'k' : v >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + 'k' : String(v));
const lab = (t) => `<b class="sg-lab">${t}</b>`;
function symArt(v) {
  if (v >= 1000) return art('gk') + lab('×' + (v - 1000));
  return art(v === WILD ? 'w' : v === SC ? 'sc' : 's' + v);
}

class AnubisGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      defs: DEFS, music: MUSIC,
      head: '<div class="head-meters"><div class="meter gm-meter"><small>Multiplicateur</small><b>×1</b></div></div>',
      stage: '<div class="col-row jrow"></div><div class="grid-host"></div><div class="col-row mrow"></div>',
      buys: [
        { id: 'U', icon: '💀', label: 'Monde souterrain · 3 scatters', desc: '10 tours, multiplicateurs par colonne et crânes dorés', cost: (b) => b * BUYU },
        { id: 'J', icon: '🧊', label: 'Jugement · 4 scatters', desc: 'Cubes de glace, crânes qui additionnent, crânes dorés jusqu’à ×100', cost: (b) => b * BUYJ },
      ],
      hello: 'Grappes de 5+ · les orbes rouges augmentent le multiplicateur',
    });
    this.gmEl = this.q('.gm-meter');
    this.mrow = this.q('.mrow');
    this.jrow = this.q('.jrow');
    this.mrow.innerHTML = Array.from({ length: C }, () => '<div>×0</div>').join('');
    this.jrow.innerHTML = Array.from({ length: C }, () => '<div><b>×1</b><small>= 0</small><i class="lbl"></i></div>').join('');
    this.grid = new SymbolGrid(this.q('.grid-host'), {
      cols: C, rows: R, game: this, art: symArt,
      cls: (v) => (v === WILD ? 'wild' : v === SC ? 'scatter' : v >= 1000 ? 'gskull' : ''),
    });
    this.grid.setAll(Array.from({ length: N }, () => Math.floor(Math.random() * SYMN)));
  }

  setG(v, bump) {
    this.gmEl.querySelector('b').textContent = '×' + v;
    if (bump) { this.grid.bump(this.gmEl); const p = center(this.gmEl); fx.burst(p.x, p.y, 20, ['#f87171', '#ef4444', '#fde68a']); sfx.upgrade(); }
  }

  renderM(M, bump) {
    [...this.mrow.children].forEach((d, i) => {
      d.textContent = '×' + fxv(M[i]);
      d.classList.toggle('hot', M[i] > 0);
      if (bump?.[i]) { this.grid.bump(d); const p = center(d); fx.burst(p.x, p.y, 12, ['#5eead4', '#14b8a6', '#fff']); }
    });
  }

  onMain() {
    this.round(async () => {
      if (!this.pay(this.bet)) return;
      this.lastStake = this.bet;
      this.setLast(0); this.winAmt.textContent = '';
      this.setG(1);
      const g = Array.from({ length: N }, rnd);
      this.msg('Les dieux lancent les dés…');
      let sc = 0;
      await this.grid.dropIn(g, {
        tease: (c) => { const t = sc >= 2; for (let r = 0; r < R; r++) if (g[c * R + r] === SC) sc++; return t; },
        onLand: (i, v) => { if (v === SC) { sfx.land(); this.grid.bump(this.grid.cells[i]); } },
      });
      const res = await this.sequence(g, 'base');
      let total = res.total;
      const startCells = [];
      g.forEach((v, k) => { if (v === SC) startCells.push(k); });
      const scat = startCells.length;
      if (total > 0) { this.win(total); this.setLast(total); await this.celebrate(total); }
      if (scat >= 3 && !res.capHit) {
        this.stopAuto();
        this.grid.mark(startCells);
        this.msg(scat === 3 ? '3 scatters : MONDE SOUTERRAIN !' : `${scat} scatters : JUGEMENT !`);
        sfx.jackpot();
        await this.wait(1400);
        this.grid.unmark();
        this.setG(1);
        const bonus = scat === 3 ? await this.underworld() : await this.judgment(startCells);
        this.win(bonus, scat === 3 ? 'Monde souterrain' : 'Jugement');
        total += bonus;
        this.setLast(total);
        await this.celebrate(bonus, { summary: scat === 3 ? 'MONDE SOUTERRAIN' : 'JUGEMENT' });
        this.resetBoard();
      }
      this.msg(total >= this.bet * CAPX ? `MAX WIN ! ${fmtC(total)}` : total > 0 ? `Total du tour : ${fmtC(total)}` : scat === 2 ? 'Presque… 2 scatters' : 'Pas de gain');
    });
  }

  async onBuy(kind) {
    this.setLast(0);
    let bonus;
    if (kind === 'U') bonus = await this.underworld();
    else {
      const pos = [...Array(N).keys()].sort(() => Math.random() - 0.5);
      bonus = await this.judgment(pos.slice(0, 4));
    }
    this.win(bonus, kind === 'U' ? 'Monde souterrain' : 'Jugement');
    this.setLast(bonus);
    await this.celebrate(bonus, { summary: kind === 'U' ? 'MONDE SOUTERRAIN' : 'JUGEMENT' });
    this.resetBoard();
    this.msg(bonus > 0 ? `Total du bonus : ${fmtC(bonus)}` : 'Pas de gain');
  }

  resetBoard() {
    this.grid.cells.forEach((c) => c.classList.remove('dim', 'win', 'cube', 'rc', 'sks', 'gsk'));
    this.grid.setAll(Array.from({ length: N }, () => Math.floor(Math.random() * SYMN)));
    this.setG(1);
  }

  // Cascades; mode 'base' (sequence multiplier) or 'under' (column multipliers M).
  async sequence(grid, mode, M, capLeft) {
    const bet = this.bet;
    let total = 0, Gm = 1, rounds = 0, capHit = false;
    const cap = capLeft === undefined ? bet * CAPX : capLeft;
    if (mode === 'base') this.setG(1);
    while (rounds < 60 && !this.dead) {
      const cl = clusters(grid);
      if (!cl.length) break;
      let paid = 0;
      const rem = new Set();
      cl.forEach((cu) => {
        let mult = Gm;
        if (mode === 'under') { const cols = {}; let sm = 0; cu.cells.forEach((k) => { cols[Math.floor(k / R)] = 1; }); for (const cc in cols) sm += M[cc]; mult = Math.max(1, sm); }
        const p = Math.round(bet * VAL[cu.s] * F * (cu.cells.length - MINC + 1) * mult);
        paid += p;
        this.grid.floatOver(cu.cells, `+${fmtC(p)}`);
        cu.cells.forEach((k) => rem.add(k));
      });
      if (total + paid >= cap) { paid = cap - total; capHit = true; }
      total += paid;
      this.setLast(total);
      this.grid.mark([...rem]);
      this.msg(`Connexion ! +${fmtC(paid)}${mode === 'base' && Gm > 1 ? ` <span class="pill hot">×${Gm}</span>` : ''}`);
      sfx.win();
      await this.wait(700);
      if (mode === 'under') {
        const up = {};
        cl.forEach((cu) => { const cs = {}; cu.cells.forEach((k) => { cs[Math.floor(k / R)] = 1; }); for (const cc in cs) { M[cc] += UINC; up[cc] = 1; } });
        this.renderM(M, up);
      } else {
        let orbs = 0;
        rem.forEach((k) => { if (grid[k] === WILD) orbs++; });
        if (orbs) { Gm += orbs; this.setG(Gm, true); }
      }
      this.grid.unmark();
      await this.grid.explode([...rem], ['#5eead4', '#fde68a', '#fff']);
      const skUp = {};
      let skTxt = '';
      for (let c = 0; c < C; c++) {
        const keep = [];
        for (let r = 0; r < R; r++) { const i = c * R + r; if (!rem.has(i)) keep.push(grid[i]); }
        const miss = R - keep.length;
        for (let r2 = 0; r2 < R; r2++) {
          const j = c * R + r2, nv = r2 < miss ? (mode === 'under' ? rndU() : rnd()) : keep[r2 - miss];
          grid[j] = nv;
          if (mode === 'under' && r2 < miss && nv >= 1000) { M[c] = Math.max(M[c], 1) * (nv - 1000); skUp[c] = 1; skTxt = `Crâne doré ×${nv - 1000} ! La colonne est multipliée`; }
        }
      }
      await this.grid.cascade(grid, rem);
      rounds++;
      if (skTxt) { this.renderM(M, skUp); this.msg(skTxt); this.flash('rgba(253,224,71,.6)'); sfx.jackpot(); await this.wait(900); }
      if (capHit) break;
    }
    return { total, capHit };
  }

  async underworld() {
    const M = [0, 0, 0, 0, 0], cap = this.bet * CAPX;
    let sum = 0;
    await this.featureIntro('MONDE SOUTERRAIN', '10 tours · chaque gain fait monter le multiplicateur de sa colonne', art('sc'));
    this.slotEl.classList.add('in-free', 'under');
    this.mrow.classList.add('on');
    this.renderM(M);
    for (let s = 10; s >= 1 && sum < cap && !this.dead; s--) {
      this.setBanner(`<b>MONDE SOUTERRAIN</b><span class="pill">${s} tour${s > 1 ? 's' : ''} restant${s > 1 ? 's' : ''}</span><span class="pill gold">Gain ${fmtC(sum)}</span>`);
      const g = Array.from({ length: N }, rndU);
      this.msg('Tour gratuit…');
      await this.grid.dropIn(g);
      const sk0 = {};
      let sk0t = '';
      g.forEach((v, i) => { if (v >= 1000) { const c0 = Math.floor(i / R); M[c0] = Math.max(M[c0], 1) * (v - 1000); sk0[c0] = 1; sk0t = `Crâne doré ×${v - 1000} ! La colonne est multipliée`; } });
      if (sk0t) { this.renderM(M, sk0); this.msg(sk0t); this.flash('rgba(253,224,71,.6)'); await this.wait(900); }
      const res = await this.sequence(g, 'under', M, cap - sum);
      sum += res.total;
      this.setLast(sum);
      if (res.capHit) break;
      await this.wait(450);
    }
    this.mrow.classList.remove('on');
    this.slotEl.classList.remove('in-free', 'under');
    this.setBanner('');
    return sum;
  }

  /* ---------- Judgment ---------- */
  cubeCell(c, j) { return c * R + (R - 1 - j); }

  paint(i, html, cls) {
    const cell = this.grid.cells[i];
    cell.firstChild.getAnimations().forEach((a) => a.cancel());
    cell.firstChild.innerHTML = html;
    cell.className = 'sg-cell ' + cls;
  }

  hide(i) { if (i >= 0) this.paint(i, '', 'dim'); }

  fall(i, row) {
    return this.grid.sym(i).animate([{ transform: `translateY(${-(row + 1) * 110}%)` }, { transform: 'translateY(0)' }],
      { duration: this.turbo ? 220 : 420, easing: 'cubic-bezier(.3,1.35,.55,1)' }).finished;
  }

  label(c, t, cls) {
    const l = this.jrow.children[c].querySelector('.lbl');
    l.textContent = t; l.className = 'lbl ' + cls;
    void l.offsetWidth; l.classList.add('go');
  }

  async judgment(startCells) {
    const bet = this.bet, cap = bet * CAPX;
    let respins = 3, capHit = false, rounds = 0, maxWin = false;
    const cols = Array.from({ length: C }, () => ({ n: 0, m: 1, mod: false, T: 0 }));
    const total = () => cols.reduce((a, x) => a + x.T, 0);
    const draw = () => cols.forEach((x, c) => { const d = this.jrow.children[c]; d.querySelector('b').textContent = '×' + fxv(x.m); d.querySelector('small').textContent = '= ' + fxv(x.T); });
    const info = () => { this.setBanner(`<b>JUGEMENT</b><span class="pill respins">${[0, 1, 2].map((k) => `<i class="dot${k < respins ? ' on' : ''}"></i>`).join('')} Relances</span><span class="pill gold">Total ×${fxv(total())} · ${fmtC(Math.min(cap, Math.round(bet * total())))}</span>`); };

    await this.featureIntro('JUGEMENT', 'Les cubes tombent · crânes, crânes dorés et cubes rouges', art('cb'));
    this.slotEl.classList.add('in-free', 'judge');
    for (let i = 0; i < N; i++) this.paint(i, '', 'dim');
    this.jrow.classList.add('on');
    draw(); info();
    await this.wait(400);

    const addCube = async (c) => {
      const x = cols[c];
      if (x.n >= R) return;
      const v = x.m, row = R - 1 - x.n, i = this.cubeCell(c, x.n);
      x.n++; x.T += v;
      this.paint(i, art('cb') + lab(fxv(v)), 'cube');
      draw();
      await this.fall(i, row);
      sfx.land();
      const p = center(this.grid.cells[i]); fx.burst(p.x, p.y, 12, ['#bae6fd', '#38bdf8', '#fff'], 4);
    };
    const showAt = (c, x, id, txt, cls) => {
      if (x.n >= R) return -1;
      const i = this.cubeCell(c, x.n);
      this.paint(i, art(id) + (txt ? lab(txt) : ''), cls);
      this.fall(i, R - 1 - x.n);
      return i;
    };
    const apply = async (c, k) => {
      const x = cols[c];
      if (k === 'cube') return addCube(c);
      if (k === 'sk') {
        const n = skVal(), big = n >= 500, i3 = showAt(c, x, 'sk', '+' + fxv(n), 'sks' + (big ? ' big' : ''));
        await this.wait(480);
        const p = center(this.grid.cells[i3 >= 0 ? i3 : this.cubeCell(c, R - 1)]);
        if (n >= SK_MAX) {
          maxWin = true;
          this.label(c, 'MAX WIN', 'lg');
          this.flash('rgba(253,224,71,.85)'); sfx.jackpot(); fx.confetti(160); fx.coins(80);
          fx.burst(p.x, p.y, 80, ['#fde047', '#fff', '#f59e0b'], 12);
          this.msg('💀 CRÂNE ×10 000 ! MAX WIN, le bonus s’arrête');
          await this.wait(1800);
          return;
        }
        if (!x.mod) { x.m = n; x.mod = true; } else x.m += n;
        this.label(c, '+' + fxv(n), big ? 'lg' : 'ls'); draw();
        fx.burst(p.x, p.y, big ? 40 : 16, big ? ['#fde047', '#fff', '#f59e0b'] : ['#e2e8f0', '#fff', '#94a3b8'], big ? 9 : 5);
        if (big) { this.flash('rgba(226,232,240,.6)'); sfx.jackpot(); } else sfx.upgrade();
        await this.wait(600); this.hide(i3);
      } else if (k === 'g') {
        const kk = gkVal(), i4 = showAt(c, x, 'gk', '×' + kk, 'gsk');
        await this.wait(480);
        x.T *= kk; this.label(c, '×' + kk, 'lg'); draw();
        this.flash('rgba(253,224,71,.6)'); sfx.jackpot();
        for (let j = 0; j < x.n; j++) this.grid.cells[this.cubeCell(c, j)].classList.add('win');
        await this.wait(800);
        for (let j = 0; j < x.n; j++) this.grid.cells[this.cubeCell(c, j)].classList.remove('win');
        this.hide(i4);
      } else if (k === 'red') {
        const S = x.T, ri = showAt(c, x, 'rc', '', 'rc');
        await this.wait(550);
        const jobs = [];
        for (let j = 1; j < x.n; j++) {
          const ci = this.cubeCell(c, j);
          jobs.push(this.grid.sym(ci).animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${j * 105}%)`, opacity: 0 }], { duration: 450, easing: 'ease-in', fill: 'forwards' }).finished);
        }
        if (ri >= 0) jobs.push(this.grid.sym(ri).animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${x.n * 105}%)`, opacity: 0 }], { duration: 450, easing: 'ease-in', fill: 'forwards' }).finished);
        await Promise.all(jobs);
        for (let j = 1; j < x.n; j++) this.hide(this.cubeCell(c, j));
        this.hide(ri);
        const fi = this.cubeCell(c, 0);
        this.paint(fi, art('cb') + lab(fxv(S)), 'cube win');
        x.n = 1; x.T = S;
        this.label(c, '= ' + fxv(S), 'lr'); draw(); sfx.coin();
        const p = center(this.grid.cells[fi]); fx.burst(p.x, p.y, 30, ['#f87171', '#ef4444', '#fff'], 7);
        await this.wait(850);
        this.grid.cells[fi].classList.remove('win');
      }
    };

    for (const s0 of startCells) await addCube(Math.floor(s0 / R));
    await this.wait(400); info();
    while (respins > 0 && !capHit && rounds < 120 && !this.dead) {
      rounds++;
      this.msg('Relance…');
      this.jrow.classList.add('roll');
      await this.wait(420);
      this.jrow.classList.remove('roll');
      let got = false;
      for (let c2 = 0; c2 < C && !capHit; c2++) {
        if (Math.random() < JPC) { got = true; await apply(c2, pickItem(cols[c2].n)); info(); if (maxWin || total() >= CAPX) capHit = true; }
      }
      respins = got ? 3 : respins - 1;
      info();
    }
    for (let c3 = 0; c3 < C; c3++) for (let j5 = 0; j5 < cols[c3].n; j5++) this.grid.cells[this.cubeCell(c3, j5)].classList.add('win');
    this.msg(maxWin || total() >= CAPX ? `MAX WIN ! ×${fxv(CAPX)}` : `Fin du bonus : ×${fxv(total())}`);
    await this.wait(1100);
    this.jrow.classList.remove('on');
    this.slotEl.classList.remove('in-free', 'judge');
    this.setBanner('');
    return maxWin ? cap : Math.min(Math.round(bet * total()), cap);
  }

  info() {
    const rows = NAMES.map((n, s) => `<div class="pay-item"><div class="pay-sym svg">${art('s' + s)}</div><div class="pay-vals"><b>${n}</b><br><span>Valeur ${VAL[s]}</span></div></div>`).join('');
    return this.rules(`<h4>Symboles</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym svg">${art('w')}</div><div class="pay-vals"><b>Orbe rouge (joker)</b><br><span>Remplace tout. Chaque orbe d’une grappe gagnante ajoute +1 au multiplicateur</span></div></div>
      <div class="pay-item"><div class="pay-sym svg">${art('sc')}</div><div class="pay-vals"><b>Scatter</b><br><span>3 = Monde souterrain · 4+ = Jugement</span></div></div></div>
      <h4>Cascades</h4><p>Grille 5×6. Une grappe de <b>5 symboles ou plus</b> paie mise × valeur × 0,33 × (taille − 4) × multiplicateur, disparaît et les symboles tombent.</p>
      <h4>Monde souterrain</h4><p>10 tours. Chaque colonne a son multiplicateur, qui monte de +3 à chaque gain qui la touche. Un <b>crâne doré</b> multiplie sa colonne (×2 à ×100).</p>
      <h4>Jugement</h4><p>Les cubes tombent dans les colonnes avec la valeur affichée en haut. 3 relances, remises à 3 à chaque nouvel objet. <b>Crâne</b> : ajoute de <b>+2 à +500</b> à la valeur des prochains cubes de sa colonne. Un crâne à <b>10 000</b>, très rare, donne directement le <b>MAX WIN</b> (×10 000) et arrête le bonus. <b>Crâne doré</b> : multiplie la colonne. <b>Cube rouge</b> : additionne toute la colonne dans un seul cube et libère de la place ; la valeur des prochains cubes ne change pas.</p>
      <h4>Achats</h4><p>Monde souterrain ×${BUYU} · Jugement ×${BUYJ}. Gain maximum ×10 000.</p>`);
  }
}

return { AnubisGame };
})();
