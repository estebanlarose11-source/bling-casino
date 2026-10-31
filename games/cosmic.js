// SpinBet Casino · CosmicGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/cosmic.js ----
__mods['games/impl/cosmic.js'] = (() => {
// Cosmic Heist: 6×5 cluster pays with cascades. Every winning cell gains an energy charge (levels 1 to 3); a
// supernova cracks the charged cells open into loot worth more at higher charge, black holes that multiply their
// whole row and column, and vacuum ships that collect all the loot once more. Tuned by simulation (RTP ≈ 92 %, buys ≈ 88 %).

const { BaseGame, fmtC, art } = __mods['core/base.js'];
const { SymbolGrid } = __mods['core/grid.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { el, toast } = __mods['ui.js'];

/* ===ENGINE */
const C = 6, R = 5, N = 30, MINC = 5, CAPX = 10000;
const P = {
  w: [40, 34, 26, 18, 12, 8, 5, 3, 2],
  val: [0.1, 0.12, 0.15, 0.2, 0.3, 0.5, 0.8, 1.5, 3], F: 2.2,
  ps: 0.0092, psFS: 0.013, pn: 0.0032, pnFS: 0.012, radarF: 1.6,
  item: [['l', 92], ['h', 5], ['v', 3]],
  loot: [null,
    [[0.2, 40], [0.4, 35], [0.6, 15], [1, 10]],
    [[1, 40], [2, 35], [3, 15], [5, 10]],
    [[5, 40], [10, 30], [20, 18], [50, 10], [100, 2]]],
  hole: [[2, 50], [3, 30], [5, 15], [10, 5]],
  holeFS: [[2, 40], [3, 28], [5, 18], [10, 10], [25, 4]],
  boost: { A: 1.2, B: 0.52, C: 0.45 }, L: 0.7,
};
function wpick(l) { let t = 0; for (const x of l) t += x[1]; let r = Math.random() * t; for (const x of l) { if (r < x[1]) return x[0]; r -= x[1]; } return l[l.length - 1][0]; }
function draw(o) {
  const ps = (o.fs ? P.psFS : P.ps) * (o.radar ? P.radarF : 1), pn = o.fs ? P.pnFS : P.pn, r = Math.random();
  if (r < ps) return 9;
  if (r < ps + pn) return 10;
  let x = Math.random() * P.w.reduce((a, b) => a + b, 0); for (let i = 0; i < P.w.length; i++) { if (x < P.w[i]) return i; x -= P.w[i]; } return 0;
}
const NB = [];
for (let k = 0; k < N; k++) { const c = Math.floor(k / R), r = k % R, o = []; if (r > 0) o.push(k - 1); if (r < R - 1) o.push(k + 1); if (c > 0) o.push(k - R); if (c < C - 1) o.push(k + R); NB.push(o); }
function clusters(grid) {
  const out = [], seen = {};
  for (let k = 0; k < N; k++) {
    const t = grid[k]; if (t > 8 || seen[k]) continue;
    const st = [k], cs = []; seen[k] = 1;
    while (st.length) { const x = st.pop(); cs.push(x); for (const n of NB[x]) if (!seen[n] && grid[n] === t) { seen[n] = 1; st.push(n); } }
    if (cs.length >= MINC) out.push({ t, cells: cs });
  }
  return out;
}
const sameLine = (a, b) => Math.floor(a / R) === Math.floor(b / R) || a % R === b % R;
function crack(lv, o) {
  const k = wpick(P.item);
  if (k === 'h') return { k, f: wpick(o.fs ? P.holeFS : P.hole) };
  if (k === 'v') return { k };
  return { k: 'l', lv, v: wpick(P.loot[lv]) * P.L * (o.fs ? P.boost[o.mode] : 1) };
}
function spin(o) {
  const bet = o.bet, grid = [], steps = [];
  const charge = o.charge ? o.charge.slice() : new Array(N).fill(0);
  let i, total = 0, rounds = 0;
  for (i = 0; i < N; i++) grid.push(draw(o));
  if (o.forceNova) { let has = false; for (i = 0; i < N; i++) if (grid[i] === 10) has = true; if (!has) grid[Math.floor(Math.random() * N)] = 10; }
  steps.push({ k: 'init', grid: grid.slice(), charge: charge.slice() });
  while (rounds < 80) {
    const cl = clusters(grid); if (!cl.length) break;
    let paid = 0; const rem = {}, wins = [];
    cl.forEach((c) => { const p = bet * P.val[c.t] * P.F * (c.cells.length - MINC + 1); paid += p; wins.push({ t: c.t, n: c.cells.length, p, cells: c.cells }); c.cells.forEach((x) => { rem[x] = 1; if (charge[x] < 3) charge[x]++; }); });
    total += paid;
    for (let c = 0; c < C; c++) {
      const keep = []; for (let r = 0; r < R; r++) { const j = c * R + r; if (!rem[j]) keep.push(grid[j]); }
      const miss = R - keep.length;
      for (let r = 0; r < R; r++) grid[c * R + r] = r < miss ? draw(o) : keep[r - miss];
    }
    steps.push({ k: 'win', wins, paid, rem: Object.keys(rem).map(Number), after: grid.slice(), charge: charge.slice() });
    rounds++;
  }
  let scat = 0, nova = 0; for (i = 0; i < N; i++) { if (grid[i] === 9) scat++; else if (grid[i] === 10) nova++; }
  const base = total; let act = null, nc = 0;
  for (i = 0; i < N; i++) if (charge[i]) nc++;
  if (nova > 0 && nc > 0) {
    const surge = nova >= 2;
    if (surge) for (i = 0; i < N; i++) if (charge[i] && charge[i] < 3) charge[i]++;
    const items = [];
    for (i = 0; i < N; i++) if (charge[i]) { const it = crack(charge[i], o); it.i = i; it.lv = charge[i]; items.push(it); if (it.k === 'l') it.fv = it.v; }
    const holes = [];
    items.forEach((h) => { if (h.k !== 'h') return; const tg = []; items.forEach((t) => { if (t.k === 'l' && sameLine(h.i, t.i)) { t.fv *= h.f; tg.push(t.i); } }); holes.push({ i: h.i, f: h.f, targets: tg }); });
    let loot = 0, ships = 0; items.forEach((t) => { if (t.k === 'l') loot += t.fv * bet; else if (t.k === 'v') ships++; });
    const pay = loot * (1 + ships);
    act = { items, holes, loot, ships, pay, nova, surge };
    total += pay;
    if (o.mode !== 'B') charge.fill(o.mode === 'C' ? 1 : 0);
  }
  let capped = false; if (total >= bet * CAPX) { total = bet * CAPX; capped = true; }
  steps.push({ k: 'end', base, act, scat, nova, nc });
  return { steps, total, scat, nova, base, act, charge: o.fs ? charge : null, capped };
}
const modeOf = (s) => (s >= 5 ? 'C' : s === 4 ? 'B' : 'A');
const SPINS = { A: 8, B: 10, C: 10 };
/* ===END ENGINE */

const NAMES = ['Prisme vert', 'Cube cyan', 'Hexagone violet', 'Diamant rose', 'Météorite', 'Satellite', 'Fusée', 'OVNI', 'K-0B'];
const MODEN = { A: 'Orbite Basse', B: 'Ceinture d’Astéroïdes', C: 'Hyper-Espace' };
const MODESUB = {
  A: 'Les cellules chargées restent jusqu’à la supernova',
  B: 'Les charges ne disparaissent jamais et continuent de monter',
  C: 'Toute la grille est chargée et une supernova éclate à chaque tour',
};
const RADARC = 2, NOVAC = 3.15, PA = 93, PB = 275;
const WORDS = ['STELLAIRE !', 'COSMIQUE !', 'GALACTIQUE !', 'HYPERNOVA !', 'INTERSIDÉRAL !', 'BIG BANG !'];
const NEON = ['#22d3ee', '#f472b6', '#a855f7', '#facc15', '#4ade80', '#fff'];
const LVN = ['', 'Cristal bleu', 'Cristal rose', 'Cristal doré'];
const LVC = ['', '#22d3ee', '#f472b6', '#facc15'];
const sym = (c) => (c < 9 ? art('ch' + c) : c === 9 ? art('chs') + '<i class="lbl chl">BALISE</i>' : art('chn') + '<i class="lbl chl n">SUPERNOVA</i>');
const fxv = (v) => (v >= 10 ? String(Math.round(v)) : v.toFixed(2).replace(/\.?0+$/, '').replace('.', ','));
const lootRange = (lv) => `×${fxv(P.loot[lv][0][0] * P.L)} à ×${fxv(P.loot[lv][P.loot[lv].length - 1][0] * P.L)}`;

class CosmicGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.cosmic,
      frameCls: 'cosmic-frame',
      stage: `<div class="ch-stage">
        <div class="ch-space"><i class="ch-stars s1"></i><i class="ch-stars s2"></i><i class="ch-planet"></i><i class="ch-ring"></i></div>
        <div class="ch-board">
          <div class="grid-host"></div>
          <div class="ch-word"></div>
        </div>
      </div>`,
      head: '<div class="ch-meter"><small>Énergie</small><b>0</b><span class="ch-lv"><i class="l1">0</i><i class="l2">0</i><i class="l3">0</i></span></div>',
      opts: [{ id: 'radar', icon: '📡', label: 'Radar à balises (mise ×2, balises ×1,6)' }],
      buys: [
        { id: 'nova', icon: '💥', label: 'Supernova garantie', desc: 'Un tour avec une supernova sur la grille', cost: (b) => Math.round(b * NOVAC) },
        { id: 'A', icon: '🪐', label: `${MODEN.A} · 3 balises`, desc: `${SPINS.A} tours · ${MODESUB.A.toLowerCase()}`, cost: (b) => b * PA },
        { id: 'B', icon: '☄️', label: `${MODEN.B} · 4 balises`, desc: `${SPINS.B} tours · ${MODESUB.B.toLowerCase()}`, cost: (b) => b * PB },
      ],
      hello: 'Grappes de 5+ · chaque gain charge sa case · la supernova fait exploser le butin',
    });
    this.radar = false;
    this.charge = new Array(N).fill(0);
    this.meter = this.q('.ch-meter');
    this.meterVal = this.q('.ch-meter b');
    this.lvEls = this.qa('.ch-lv i');
    this.grid = new SymbolGrid(this.q('.grid-host'), {
      cols: C, rows: R, game: this, art: sym,
      cls: (v, i) => (this.charge[i] ? `chg c${this.charge[i]} ` : '') + (v === 9 ? 'scatter' : v === 10 ? 'nova' : v >= 7 ? 'hi' : ''),
    });
    this.grid.setAll(Array.from({ length: N }, () => Math.floor(Math.random() * 9)));
  }

  // Big word over the grid, restarted with WAAPI (no forced reflow).
  word(k, text) {
    const w = this.q('.ch-word');
    w.textContent = text || WORDS[Math.min(k, WORDS.length - 1)];
    w.className = `ch-word t${Math.min(k, 5)}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.2 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.35 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.7 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.4)' },
    ], { duration: this.turbo ? 600 : 1000, easing: 'ease-out' });
  }

  overlay(html, cls = '') { return super.overlay(html, `${cls} ch-ov`); }

  stakeLabel() { return Math.round(this.bet * (this.radar ? RADARC : 1)); }
  optOn(id) { return id === 'radar' && this.radar; }
  onOpt(id) {
    if (id !== 'radar' || this.busy) return;
    this.radar = !this.radar;
    this.slotEl.classList.toggle('radar', this.radar);
    toast(this.radar ? 'Radar activé : mise ×2, balises 1,6 fois plus fréquentes' : 'Radar désactivé');
    this.updateMeters();
  }

  // Paints the charge level of every cell and updates the energy meter.
  applyCharge(arr) {
    const cnt = [0, 0, 0, 0];
    for (let i = 0; i < N; i++) {
      const lv = arr?.[i] || 0;
      cnt[lv]++;
      if (this.charge[i] === lv) continue;
      const cell = this.grid.cells[i];
      cell.classList.remove('chg', 'c1', 'c2', 'c3');
      if (lv) cell.classList.add('chg', 'c' + lv);
      if (lv > this.charge[i]) cell.animate([{ filter: 'brightness(2.2)' }, { filter: 'none' }], { duration: 380 });
      this.charge[i] = lv;
    }
    const n = N - cnt[0];
    if (+this.meterVal.textContent !== n) {
      this.meterVal.textContent = n;
      this.meterVal.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 400 });
    }
    this.lvEls.forEach((e, k) => { e.textContent = cnt[k + 1]; });
    this.meter.classList.toggle('hot', n > 0);
    return n;
  }

  onMain() { this.round(() => this.playRound('spin')); }
  async onBuy(kind) { await this.playRound(kind, true); }

  async playRound(kind, prepaid = false) {
    const b = this.bet;
    const price = kind === 'spin' ? this.stakeLabel() : 0;
    if (!prepaid && !this.pay(price)) return;
    this.lastStake = kind === 'spin' ? price : b;
    this.setLast(0); this.winAmt.textContent = ''; this.setBanner('');
    let total = 0;
    if (kind === 'A' || kind === 'B') {
      total = await this.bonus(kind);
    } else {
      const res = spin({ bet: b, fs: false, radar: kind === 'spin' && this.radar, forceNova: kind === 'nova' });
      await this.play(res, false, null);
      total = res.total;
      if (total > 0) { this.win(Math.round(total)); this.setLast(total); }
      if (res.scat >= 3) {
        this.stopAuto();
        if (total > 0) await this.celebrate(Math.round(total));
        total += await this.bonus(modeOf(res.scat));
      } else if (total > 0) await this.celebrate(Math.round(total));
    }
    this.setLast(total);
    this.msg(total >= b * CAPX ? `GAIN MAXIMUM ! ${fmtC(total)}` : total > 0 ? `Total du tour : ${fmtC(total)}` : 'Pas de gain');
  }

  async play(res, fs, mode) {
    let run = 0, k = 0;
    for (const st of res.steps) {
      if (this.dead) return;
      if (st.k === 'init') {
        this.applyCharge(st.charge);
        await this.grid.dropIn(st.grid, {
          tease: (c) => { let sc = 0; for (let j = 0; j < c * R; j++) if (st.grid[j] === 9) sc++; return sc >= 2; },
          onLand: (i, v) => {
            if (v < 9) return;
            sfx.land();
            const p = center(this.grid.cells[i]);
            fx.burst(p.x, p.y, 10, v === 10 ? NEON : ['#facc15', '#fff', '#f0abfc'], 5);
          },
        });
      } else if (st.k === 'win') {
        st.wins.forEach((w) => this.grid.floatOver(w.cells, `+${fmtC(Math.round(w.p))}`, '#a5f3fc'));
        this.grid.mark(st.rem);
        this.msg(st.wins.map((w) => `${w.n} × ${NAMES[w.t]} : +${fmtC(Math.round(w.p))}`).join(' · '));
        this.word(k);
        sfx.win();
        await this.wait(750);
        this.grid.unmark();
        await this.grid.explode(st.rem, NEON);
        this.applyCharge(st.charge);
        await this.grid.cascade(st.after, new Set(st.rem));
        run += st.paid; k++;
        this.setLast(Math.round(run));
        await this.wait(180);
      } else if (st.k === 'end') {
        if (st.act) await this.activate(st.act);
        this.applyCharge(fs ? res.charge : null);
      }
    }
  }

  async activate(a) {
    const b = this.bet;
    for (let i = 0; i < N; i++) if (this.grid.values[i] === 10) this.grid.cells[i].classList.add('nvon');
    sfx.feature();
    this.flash('rgba(244,114,182,.55)');
    this.shake();
    this.slotEl.classList.add('ch-boom');
    this.msg(a.nova > 1 ? `${a.nova} supernovas ! Les cellules chargées explosent…` : 'Supernova ! Les cellules chargées explosent…');
    await this.wait(650);
    const items = a.items.slice().sort((x, y) => x.i - y.i), disp = {}, nodes = {};
    if (a.surge) {
      this.word(5, 'SURCHARGE !');
      this.msg('SURCHARGE : chaque cellule chargée monte d’un niveau !');
      sfx.upgrade();
      const up = this.charge.slice();
      items.forEach((it) => { up[it.i] = it.lv; });
      this.applyCharge(up);
      await this.wait(900);
    }
    const step = items.length > 16 ? (this.turbo ? 25 : 55) : (this.turbo ? 45 : 110);
    for (const it of items) {
      if (this.dead) return;
      const e = el('div', 'itm ch-itm');
      if (it.k === 'h') e.innerHTML = `<div class="clv hole">${art('chh')}<b>×${it.f}</b></div>`;
      else if (it.k === 'v') e.innerHTML = `<div class="clv ship">${art('chv')}</div>`;
      else { disp[it.i] = it.v; e.innerHTML = `<div class="loot l${it.lv}"><span>×${fxv(it.v)}</span></div>`; }
      const cell = this.grid.cells[it.i];
      cell.classList.add('revealed');
      cell.appendChild(e);
      nodes[it.i] = e;
      sfx.tick();
      if (it.k !== 'l' || it.lv === 3) { const p = center(cell); fx.burst(p.x, p.y, 8, it.k === 'l' ? ['#facc15', '#fff'] : NEON, 5); }
      await sleep(step);
    }
    await this.wait(400);
    for (const h of a.holes || []) {
      if (!h.targets.length || this.dead) continue;
      this.msg(`Trou noir ×${h.f} : tout le butin de sa ligne et de sa colonne est multiplié !`);
      const srcCell = this.grid.cells[h.i], src = center(srcCell);
      srcCell.classList.add('pulse');
      const hc = Math.floor(h.i / R), hr = h.i % R;
      const beam = this.grid.cells.filter((_, j) => Math.floor(j / R) === hc || j % R === hr);
      beam.forEach((c) => c.classList.add('beam'));
      sfx.upgrade();
      for (const ti of h.targets) {
        disp[ti] *= h.f;
        const cn = nodes[ti]?.querySelector('.loot span');
        fx.trail(src, center(this.grid.cells[ti]), '#a855f7', 5);
        await sleep(this.turbo ? 70 : 130);
        if (cn) { cn.textContent = '×' + fxv(disp[ti]); cn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 350 }); }
        sfx.tick();
      }
      await this.wait(450);
      beam.forEach((c) => c.classList.remove('beam'));
      srcCell.classList.remove('pulse');
    }
    if (a.ships > 0 && !this.dead) {
      const shipCells = items.filter((x) => x.k === 'v');
      shipCells.forEach((x) => this.grid.cells[x.i].classList.add('pulse'));
      this.msg(a.ships > 1 ? `${a.ships} vaisseaux aspirent tout le butin !` : 'Le vaisseau aspire tout le butin !');
      sfx.feature();
      await this.wait(500);
      // measure everything first, then animate (no layout reads inside the animation loop)
      const moves = [];
      for (const x of items) {
        if (disp[x.i] === undefined) continue;
        const cn = nodes[x.i]?.querySelector('.loot'); if (!cn) continue;
        let best = shipCells[0], bd = 1e9;
        shipCells.forEach((p) => { const d = Math.abs(Math.floor(p.i / R) - Math.floor(x.i / R)) + Math.abs((p.i % R) - (x.i % R)); if (d < bd) { bd = d; best = p; } });
        const r1 = this.grid.cells[x.i].getBoundingClientRect(), r2 = this.grid.cells[best.i].getBoundingClientRect();
        moves.push({ cn, dx: r2.left - r1.left, dy: r2.top - r1.top });
      }
      const gap = moves.length > 14 ? 30 : 60;
      moves.forEach((m, j) => {
        m.cn.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${m.dx}px,${m.dy}px) scale(.15)`, opacity: 0 }],
          { duration: 550, delay: j * gap, easing: 'cubic-bezier(.55,0,.9,.45)', fill: 'forwards' });
      });
      await sleep(550 + moves.length * gap);
      sfx.coin();
      sfx.bigWin();
      this.msg(`Butin aspiré : ×${fxv(a.loot / b)} compté ${1 + a.ships} fois !`);
      shipCells.forEach((x) => { const p = center(this.grid.cells[x.i]); fx.burst(p.x, p.y, 16, NEON, 7); });
      await this.wait(700);
      moves.forEach((m) => {
        m.cn.getAnimations().forEach((an) => an.cancel());
        m.cn.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'ease-out' });
      });
      await this.wait(700);
      shipCells.forEach((x) => this.grid.cells[x.i].classList.remove('pulse'));
    }
    const parts = [];
    if (a.loot > 0) parts.push(`butin ×${fxv(a.loot / b)}`);
    if (a.ships > 0) parts.push(`${a.ships} vaisseau${a.ships > 1 ? 'x' : ''} (butin compté ×${1 + a.ships})`);
    this.msg(`${parts.join(' · ') || 'Pas de butin'} → +${fmtC(Math.round(a.pay))}`);
    if (a.pay >= b * 10) { const p = center(this.grid.el); fx.burst(p.x, p.y, 24, NEON, 9); }
    await this.wait(1100);
    this.slotEl.classList.remove('ch-boom');
    this.grid.cells.forEach((c) => { c.querySelector('.itm')?.remove(); c.classList.remove('revealed', 'nvon', 'pulse'); });
  }

  // Same rules as the simulated bonus: +3 spins on 3 beacons, a supernova on every Hyper-Espace spin and at
  // least one on the last spin of the other two.
  async bonus(mode) {
    let left = SPINS[mode], tot = 0, hadNova = false, done = 0;
    let charge = mode === 'C' ? new Array(N).fill(1) : null;
    const b = this.bet, cap = b * CAPX;
    this.lastStake = b;
    await this.featureIntro(MODEN[mode].toUpperCase(), `${left} tours gratuits · ${MODESUB[mode]}`, art(mode === 'C' ? 'chn' : 'chs'));
    this.slotEl.classList.add('in-free', `fs-${mode}`);
    this.applyCharge(charge);
    while (left > 0 && tot < cap && !this.dead) {
      left--; done++;
      this.setBanner(`<b>${MODEN[mode].toUpperCase()}</b><span class="pill">Tour ${done} / ${done + left}</span><span class="pill gold">Gain ${fmtC(Math.round(tot))}</span>`);
      const res = spin({ bet: b, fs: true, mode, charge, forceNova: mode === 'C' || (left === 0 && !hadNova) });
      if (res.nova) hadNova = true;
      await this.play(res, true, mode);
      charge = res.charge;
      const add = Math.min(res.total, cap - tot);
      tot += add;
      if (add > 0) this.win(Math.round(add), MODEN[mode]);
      this.setLast(Math.round(tot));
      if (res.scat >= 3) { left += 3; await this.featureIntro('+3 TOURS', 'Nouvelles balises captées !', art('chs'), 1300); }
      await this.wait(300);
    }
    this.slotEl.classList.remove('in-free', `fs-${mode}`);
    this.setBanner('');
    this.applyCharge(null);
    await this.celebrate(Math.round(tot), { summary: MODEN[mode].toUpperCase(), stake: b });
    return tot;
  }

  info() {
    const pay = (s) => (P.val[s] * P.F).toFixed(2).replace('.', ',');
    const rows = NAMES.map((n, s) => `<div class="pay-item"><div class="pay-sym svg">${art('ch' + s)}</div><div class="pay-vals"><b>${n}</b><br><span>5 : ×${pay(s)} · chaque case de plus : +×${pay(s)}</span></div></div>`).join('');
    return this.rules(`<h4>Symboles (× la mise)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym svg">${art('chs')}</div><div class="pay-vals"><b>Balise (scatter)</b><br><span>3 / 4 / 5 = les 3 bonus</span></div></div>
      <div class="pay-item"><div class="pay-sym svg">${art('chn')}</div><div class="pay-vals"><b>Supernova</b><br><span>Fait exploser les cellules chargées</span></div></div></div>
      <h4>Cellules d’énergie</h4><p>Grille 6×5, grappes de 5+ (horizontal ou vertical) en cascade. Chaque case d’une grappe gagnante gagne <b>un niveau de charge</b> (bleu, puis rose, puis doré). Quand une <b>supernova</b> est sur la grille à la fin des cascades, toutes les cellules chargées explosent et livrent leur butin : ${LVN[1].toLowerCase()} (${lootRange(1)}), ${LVN[2].toLowerCase()} (${lootRange(2)}), ${LVN[3].toLowerCase()} (${lootRange(3)}).</p>
      <p><b>Trou noir</b> : multiplie tout le butin de sa ligne et de sa colonne (×2 à ×10, jusqu’à ×25 en bonus). <b>Vaisseau-aspirateur</b> : aspire tout le butin de la grille et le compte une fois de plus. <b>Surcharge</b> : avec 2 supernovas ou plus, chaque cellule chargée monte d’un niveau avant l’explosion.</p>
      <h4>Bonus</h4><p>3 balises : <b>${MODEN.A}</b> (${SPINS.A} tours, ${MODESUB.A.toLowerCase()}). 4 : <b>${MODEN.B}</b> (${SPINS.B} tours, ${MODESUB.B.toLowerCase()}). 5 : <b>${MODEN.C}</b> (${SPINS.C} tours, ${MODESUB.C.toLowerCase()}). +3 tours avec 3 balises. Au moins une supernova garantie par bonus.</p>
      <h4>Radar à balises</h4><p>Mise ×2, balises 1,6 fois plus fréquentes.</p>
      <h4>Achats</h4><p>Supernova garantie ×${String(NOVAC).replace('.', ',')} · ${MODEN.A} ×${PA} · ${MODEN.B} ×${PB}. ${MODEN.C} ne s’achète pas. Gain maximum ×10 000.</p>`);
  }
}

return { CosmicGame };
})();
