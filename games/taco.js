// SpinBet Casino · PizzaGame (La Pizza Yo-Yo) — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/taco.js ----
__mods['games/impl/taco.js'] = (() => {
// La Pizza Yo-Yo (replaces La Fiesta, same id 'taco'). The board is a round pizza cut in 8 slices of 4 cells; it
// spins clockwise and stops with a quarter open, where the symbols land. Painted symbols by the owner in
// assets/games/pizza/. Tuned by simulation (RTP ≈ 92 %, buys ≈ 88 %).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { el } = __mods['ui.js'];

/* ===ENGINE (original) */
// Round board: 8 slices × 4 rings (ring 0 = centre, ring 3 = crust). Cell = slice * 4 + ring. Only open slices play;
// slices open from 0 upwards. Cells touch along their slice (ring ± 1) and round the pizza (same ring, slice ± 1,
// wrapping once the whole pizza is open). 4+ identical symbols that touch (wild = any) pay, vanish, and the symbols
// fall toward the centre. A big connection (6+) pulls out a new slice. Trucks carry a multiplier, added up and
// applied to the spin. In the bonus, pepperonis are collected: every 4 open a slice for good and give 2 more spins.
const NS = 8, NR = 4, N = NS * NR;
const WILD = 8, SCAT = 9, TRUCK = 10, PEP = 11;
const PAY = [10, 6, 4.5, 3, 2.4, 2, 1.6, 1.2];           // × bet for a 4-cluster, chef → basilic
const SIZE = [0, 0, 0, 0, 1, 1.6, 2.6, 4, 6, 9, 13, 18]; // size factor by cluster size (≥ 11 → 18)
let K = 0.5735;                                            // global scale, tuned by simulation (RTP ≈ 92 %)
const SPREAD = 6, FULL = 20;                              // cluster size that pulls a slice; full pizza in the base game: × bet
const W_BASE = [1.6, 2.4, 3.2, 4.4, 6, 8, 10.5, 13, 4.2, 2.5, 1.4, 0];
const W_FREE = [1.6, 2.4, 3.2, 4.4, 6, 8, 10.5, 13, 2.5, 0, 1.6, 2.5];
const M_BASE = [[2, 50], [3, 25], [5, 15], [10, 7], [25, 3]];
const M_FREE = [[2, 40], [3, 28], [5, 18], [10, 10], [25, 3], [50, 1]];
const pick = (w, rng) => { let t = 0; for (const x of w) t += x; let r = rng() * t; for (let i = 0; i < w.length; i++) { if (r < w[i]) return i; r -= w[i]; } return 0; };
const pickM = (l, rng) => l[pick(l.map((x) => x[1]), rng)][0];
let SEQ = 0;
function draw(free, rng) { const s = pick(free ? W_FREE : W_BASE, rng); return { s, m: s === TRUCK ? pickM(free ? M_FREE : M_BASE, rng) : 0, id: ++SEQ }; }
function neighbours(i, open) {
  const k = Math.floor(i / NR), r = i % NR, out = [];
  if (r > 0) out.push(i - 1); if (r < NR - 1) out.push(i + 1);
  const full = open >= NS;
  if (k > 0) out.push(i - NR); else if (full) out.push((NS - 1) * NR + r);
  if (k < open - 1) out.push(i + NR); else if (full) out.push(r);
  return out;
}
function clusters(b, open) {
  const out = [], n = open * NR;
  for (let sym = 0; sym < 8; sym++) {
    const seen = new Uint8Array(N);
    for (let i = 0; i < n; i++) {
      if (seen[i] || b[i].s !== sym) continue;
      const st = [i], cs = []; seen[i] = 1;
      while (st.length) {
        const c = st.pop(); cs.push(c);
        for (const nb of neighbours(c, open)) if (!seen[nb] && (b[nb].s === sym || b[nb].s === WILD)) { seen[nb] = 1; st.push(nb); }
      }
      if (cs.length >= 4) out.push({ s: sym, cells: cs });
    }
  }
  return out;
}
const pay = (c) => PAY[c.s] * SIZE[Math.min(c.cells.length, SIZE.length - 1)] * K;
// Symbols in a slice fall toward the centre, new ones come in at the crust. Returns the indexes of new cells.
function collapse(b, gone, open, free, rng) {
  const fresh = [];
  for (let k = 0; k < open; k++) {
    const keep = [];
    for (let r = 0; r < NR; r++) { const i = k * NR + r; if (!gone.has(i)) keep.push(b[i]); }
    for (let r = 0; r < NR; r++) {
      const i = k * NR + r;
      if (r < keep.length) b[i] = keep[r]; else { b[i] = draw(free, rng); fresh.push(i); }
    }
  }
  return fresh;
}
// One spin. `open` slices at the start; returns frames for the animation and the totals (× bet).
function play({ open, free = false, rng = Math.random }) {
  const b = Array.from({ length: N }, (_, i) => (i < open * NR ? draw(free, rng) : null));
  const frames = [{ t: 'land', b: b.map((x) => x && { ...x }), open }];
  let win = 0, peps = 0, full = false;
  for (let step = 0; step < 40; step++) {
    if (free) {
      const got = [];
      for (let i = 0; i < open * NR; i++) if (b[i].s === PEP) got.push(i);
      if (got.length) {
        peps += got.length;
        const fresh = collapse(b, new Set(got), open, free, rng);
        frames.push({ t: 'peps', cells: got, n: peps, b: b.map((x) => x && { ...x }), fresh, open });
        continue;
      }
    }
    const cl = clusters(b, open);
    if (!cl.length) break;
    const gone = new Set(), p = cl.reduce((a, c) => a + pay(c), 0);
    cl.forEach((c) => c.cells.forEach((i) => gone.add(i)));
    win += p;
    frames.push({ t: 'win', clusters: cl.map((c) => ({ s: c.s, cells: c.cells, x: pay(c) })), x: p, open });
    let opened = -1;
    if (open < NS && cl.some((c) => c.cells.length >= SPREAD)) {
      opened = open; open++;
      for (let r = 0; r < NR; r++) b[opened * NR + r] = draw(free, rng);
      if (open === NS && !free) { full = true; win += FULL; }
    }
    const fresh = collapse(b, gone, opened >= 0 ? opened : open, free, rng);
    if (opened >= 0) for (let r = 0; r < NR; r++) fresh.push(opened * NR + r);
    frames.push({ t: 'drop', b: b.map((x) => x && { ...x }), fresh, open, opened, full: full && opened === NS - 1 });
  }
  let mult = 0; const trucks = [];
  for (let i = 0; i < open * NR; i++) if (b[i].s === TRUCK) { mult += b[i].m; trucks.push(i); }
  const scat = b.reduce((a, x) => a + (x && x.s === SCAT ? 1 : 0), 0);
  const total = win > 0 && mult > 0 ? win * mult : win;
  return { frames, win, mult: win > 0 ? mult : 0, trucks, total, open, peps, scat, full };
}
// A whole bonus (for the simulation; the game plays the same steps one by one with the animation).
const FS = { normal: { open: 2, spins: 8 }, super: { open: 2, spins: 14 } }, PEP_STEP = 4, PEP_SPINS = 2, MAX_SPINS = 40;
function bonus(kind, rng = Math.random) {
  let { open, spins } = FS[kind], cnt = 0, tot = 0, done = 0;
  while (done < spins && done < MAX_SPINS) {
    done++;
    const r = play({ open, free: true, rng });
    tot += r.total; open = r.open; cnt += r.peps;
    while (cnt >= PEP_STEP) { cnt -= PEP_STEP; spins += PEP_SPINS; if (open < NS) open++; }
  }
  return tot;
}
/* ===END ENGINE */

const BUYN = 70, BUYS = 350;
const IMG_V = 1;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images are inlined
const IMG = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 'wild', 'sc', 'truck', 'pep'];
const NAMES = ['Le Chef', 'Huile d’olive', 'Mozzarella', 'Tomate', 'Champignon', 'Poivron', 'Olive', 'Basilic', 'Pelle à pizza (WILD)', 'Roulette (bonus)', 'Food truck (multiplicateur)', 'Pepperoni'];
const src = (s) => asset(`assets/games/pizza/${IMG[s]}.webp`);
const symImg = (s) => `<img class="pz-img" src="${src(s)}" alt="" draggable="false" decoding="async">`;
const MUSIC = { sd: 0.2, len: 12, root: 220, lead: { wave: 'triangle', vol: 0.06, dur: 0.16, pat: [12, 15, 19, 17, 15, 14, 12, 15, 19, 24, 19, 15] }, bass: { wave: 'sine', vol: 0.14, dur: 0.22, pat: [-12, null, null, -5, null, null, -12, null, null, -7, null, null] }, kick: [0, 6], hat: [2, 4, 8, 10], kv: 0.18, hv: 0.02 };

// geometry (in % of the board): ring limits from the centre to the crust
const RING = [0.08, 0.29, 0.5, 0.71, 0.92];
const pol = (rad, deg) => ({ x: 50 + 50 * rad * Math.cos(deg * Math.PI / 180), y: 50 + 50 * rad * Math.sin(deg * Math.PI / 180) });
const sliceA = (k) => -135 + k * 45; // slices 0 and 1 make the open quarter at the top
function cellPos(i) {
  const k = Math.floor(i / NR), r = i % NR, a = sliceA(k) + 22.5, mid = (RING[r] + RING[r + 1]) / 2;
  const p = pol(mid, a), arc = mid * Math.PI / 4, w = Math.min((RING[r + 1] - RING[r]) * 1.12, arc * 1.02);
  return { x: p.x, y: p.y, size: w * 50, a, mid };
}
function sectorPath(r0, r1, a0, a1) {
  const p = (r, a) => { const q = pol(r, a); return `${q.x.toFixed(2)} ${q.y.toFixed(2)}`; };
  return r0 <= 0.001 ? `M50 50 L${p(r1, a0)} A${50 * r1} ${50 * r1} 0 0 1 ${p(r1, a1)} Z`
    : `M${p(r1, a0)} A${50 * r1} ${50 * r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${50 * r0} ${50 * r0} 0 0 0 ${p(r0, a0)} Z`;
}

function discSVG() {
  let rings = '';
  for (let k = 0; k < NS; k++) {
    const a0 = sliceA(k), a1 = a0 + 45;
    for (let r = 0; r < NR; r++) rings += `<path d="${sectorPath(RING[r] + 0.006, RING[r + 1] - 0.006, a0 + 0.9, a1 - 0.9)}" class="pz-hole"/>`;
  }
  return `<svg class="pz-svg pz-disc-svg" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="pzPlate"><stop offset="0" stop-color="#5b3416"/><stop offset=".9" stop-color="#2f1a0b"/><stop offset="1" stop-color="#1c0f06"/></radialGradient></defs>
    <circle cx="50" cy="50" r="50" fill="url(#pzPlate)"/>${rings}</svg>`;
}
function pizzaSVG() {
  const pz = asset('assets/games/pizza/pizza.webp');
  let defs = '', pieces = '';
  for (let k = 0; k < NS; k++) {
    const a0 = sliceA(k), a1 = a0 + 45;
    defs += `<clipPath id="pzc${k}"><path d="${sectorPath(0, 1.002, a0 - 0.15, a1 + 0.15)}"/></clipPath>`;
    const m = pol(0.55, a0 + 22.5);
    pieces += `<g class="pz-piece" data-k="${k}" style="--ox:${(m.x - 50) * 0.55}%;--oy:${(m.y - 50) * 0.55}%"><image href="${pz}" x="0" y="0" width="100" height="100" clip-path="url(#pzc${k})" preserveAspectRatio="none"/><path d="${sectorPath(0, 1, a0, a1)}" class="pz-cut"/></g>`;
  }
  return `<svg class="pz-svg pz-top" viewBox="0 0 100 100" aria-hidden="true"><defs>${defs}</defs>${pieces}</svg>`;
}

class PizzaGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: MUSIC,
      head: '<div class="head-meters"><div class="meter pz-mult"><small>Food trucks</small><b>×0</b></div></div>',
      stage: `<div class="pz-scene"><div class="pz-hud"><div class="pz-peps"><small>Pepperonis</small><span class="pz-dots">${'<i></i>'.repeat(4)}</span></div><div class="pz-spins"><small>Tours</small><b>0</b></div><div class="pz-parts"><small>Parts</small><b>2 / 8</b></div></div>
        <div class="pz-board"><div class="pz-rot">${discSVG()}<div class="pz-cells"></div></div>${pizzaSVG()}</div><div class="pz-word"></div></div>`,
      buys: [
        { id: 'normal', icon: '🍕', label: 'Bonus Le Four · 3 roulettes', desc: '8 tours, un quart de pizza ; 4 pepperonis = une part de plus et +2 tours', cost: (b) => b * BUYN },
        { id: 'super', icon: '🔥', label: 'Super Four · 4 roulettes', desc: '14 tours, un quart de pizza ; 4 pepperonis = une part de plus et +2 tours', cost: (b) => b * BUYS },
      ],
      hello: 'La pizza tourne : 4 symboles qui se touchent gagnent',
    });
    this.rot = this.q('.pz-rot');
    this.cellsEl = this.q('.pz-cells');
    this.multEl = this.q('.pz-mult');
    this.els = new Map(); // symbol id -> element
    this.spinN = 0;
    this.open = 2;
    this.setOpen(2, false);
    IMG.forEach((n) => { new Image().src = asset(`assets/games/pizza/${n}.webp`); });
    new Image().src = asset('assets/games/pizza/pizza.webp');
    // a first, still pizza
    const b = Array.from({ length: N }, (_, i) => (i < 2 * NR ? { s: Math.floor(Math.random() * 8), m: 0, id: `i${i}` } : null));
    this.showBoard(b, [], false);
  }

  // Open slices show the tray with the symbols, closed slices show the pizza.
  setOpen(n, anim = true) {
    this.open = n;
    this.qa('.pz-piece').forEach((p) => {
      const k = +p.dataset.k, out = k < n;
      if (out && !p.classList.contains('out') && anim) { p.classList.add('pulling'); setTimeout(() => p.classList.remove('pulling'), 900); }
      p.classList.toggle('out', out);
    });
    this.q('.pz-parts b').textContent = `${n} / ${NS}`;
  }

  cellEl(x, i) {
    let e = this.els.get(x.id);
    if (!e) {
      e = el('div', `pz-cell s${x.s}`, `${symImg(x.s)}${x.s === TRUCK ? `<b class="pz-m">×${x.m}</b>` : ''}`);
      this.cellsEl.appendChild(e); this.els.set(x.id, e);
    }
    const p = cellPos(i);
    e.style.left = `${p.x}%`; e.style.top = `${p.y}%`; e.style.width = e.style.height = `${p.size}%`;
    const c = pol(0.99, p.a); e.style.setProperty('--dx', `${((c.x - p.x) / p.size) * 100}%`); e.style.setProperty('--dy', `${((c.y - p.y) / p.size) * 100}%`);
    return e;
  }

  // Place the board; `fresh` cells come in from the crust.
  showBoard(b, fresh, anim = true) {
    const live = new Set();
    this.at = [];
    b.forEach((x, i) => { if (!x) return; live.add(x.id); const e = this.cellEl(x, i); this.at[i] = e; if (anim && fresh.includes(i)) { e.classList.remove('in'); void e.offsetWidth; e.classList.add('in'); } });
    for (const [id, e] of this.els) if (!live.has(id)) { e.remove(); this.els.delete(id); }
  }

  clearCells() {
    for (const e of this.els.values()) { e.classList.add('gone'); setTimeout(() => e.remove(), 260); }
    this.els.clear();
    this.at = [];
  }

  // The tray turns clockwise under the still pizza and stops after whole turns: the symbols placed on it come
  // round into the open quarter (they stay upright).
  spinTo(turns) {
    const from = -45 * (2 + Math.floor(Math.random() * 4)), to = 360 * turns;
    const dur = this.turbo ? 800 : 1700, t0 = performance.now();
    this.rot.style.setProperty('--a', `${from}deg`);
    return new Promise((res) => {
      const step = (t) => {
        if (this.dead) return res();
        const u = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - u, 3) + Math.sin(u * Math.PI) * 0.02 * (1 - u);
        this.rot.style.setProperty('--a', `${from + (to - from) * e}deg`);
        if (u < 1) requestAnimationFrame(step); else { this.rot.style.setProperty('--a', '0deg'); res(); }
      };
      requestAnimationFrame(step);
    });
  }

  word(text, cls = '') {
    const w = this.q('.pz-word');
    w.className = `pz-word ${cls}`; w.textContent = text; void w.offsetWidth; w.classList.add('on');
  }

  setMult(m, hot) { this.multEl.querySelector('b').textContent = `×${m}`; this.multEl.classList.toggle('hot', !!hot); }

  setPeps(n, spins) {
    this.qa('.pz-dots i').forEach((d, k) => d.classList.toggle('on', k < n));
    if (spins != null) this.q('.pz-spins b').textContent = spins;
  }

  onMain() {
    this.round(async () => {
      if (!this.pay(this.bet)) return;
      this.lastStake = this.bet;
      const r = await this.spinOnce(false, 2);
      if (r.scat >= 3) { this.stopAuto(); await this.freeSpins(r.scat >= 4 ? 'super' : 'normal'); }
    });
  }

  async onBuy(kind) { await this.freeSpins(kind); }

  async spinOnce(free, open) {
    const bet = this.bet;
    const r = play({ open, free });
    this.winAmt.textContent = '';
    if (!free) this.setLast(0);
    this.setMult(0);
    this.msg(free ? 'Le four tourne…' : 'La pizza tourne…');
    this.clearCells();
    if (!free) this.setOpen(open, false);
    // the tray is filled all round: the real symbols in the open slices, random ones under the pizza
    const land = r.frames[0].b, seq = ++this.spinN;
    this.showBoard(land.map((x, i) => x || { s: Math.floor(Math.random() * 8), m: 0, id: `d${seq}_${i}` }), [], false);
    sfx.click?.();
    await this.spinTo(free ? 1 : 2);
    sfx.reelStop?.();
    let shown = 0;
    for (const f of r.frames) {
      if (this.dead) break;
      if (f.t === 'land') {
        this.showBoard(f.b, [], false);
        this.q('.pz-board').classList.remove('stop'); void this.rot.offsetWidth; this.q('.pz-board').classList.add('stop');
        f.b.forEach((x, i) => { if (x && x.s === SCAT) { sfx.land(); const e = this.els.get(x.id); e?.classList.add('scat'); } });
        await this.wait(380);
      } else if (f.t === 'win') {
        const ids = []; f.clusters.forEach((c) => c.cells.forEach((i) => ids.push(this.cellAt(i))));
        ids.forEach((e) => e?.classList.add('win'));
        shown += f.x;
        const amt = Math.round(shown * bet);
        this.setLast(amt);
        this.msg(`Connexion ! +${fmtC(Math.round(f.x * bet))}`);
        ids.forEach((e) => { if (e) { const p = center(e); fx.burst(p.x, p.y, 5, ['#fde68a', '#f97316', '#fff'], 3); } });
        sfx.win();
        await this.wait(750);
        ids.forEach((e) => e?.classList.add('pop'));
        await this.wait(230);
      } else if (f.t === 'peps') {
        const es = f.cells.map((i) => this.cellAt(i));
        es.forEach((e) => e?.classList.add('collect'));
        sfx.upgrade?.();
        this.onPep?.(f.cells.length);
        await this.wait(520);
        es.forEach((e) => e?.classList.add('pop'));
        await this.wait(160);
        this.showBoard(f.b, f.fresh);
        await this.wait(380);
      } else if (f.t === 'drop') {
        if (f.opened >= 0) {
          this.setOpen(f.open);
          this.word(f.full ? 'PIZZA COMPLÈTE !' : 'UNE PART DE PLUS !', f.full ? 'full' : '');
          sfx.feature?.();
          this.shake();
          await this.wait(900);
          if (f.full) { this.msg(`Pizza complète ! +${fmtC(FULL * bet)}`); fx.confetti(60); await this.wait(700); }
        }
        this.showBoard(f.b, f.fresh);
        await this.wait(420);
      }
    }
    let total = Math.round(r.total * bet);
    if (r.mult > 0) {
      r.trucks.forEach((i) => this.cellAt(i)?.classList.add('fire'));
      this.setMult(r.mult, true);
      this.word(`×${r.mult}`, 'mult');
      sfx.upgrade?.();
      this.msg(`Food trucks ×${r.mult} !`);
      await this.wait(1000);
    }
    if (total > 0) {
      this.setLast(total);
      this.win(total, free ? 'Le Four' : null);
      if (!free) await this.celebrate(total); else this.winAmt.textContent = fmtC(total);
    }
    if (!free) this.msg(total > 0 ? `Total du tour : ${fmtC(total)}` : r.scat === 2 ? 'Presque… 2 roulettes' : 'Pas de gain');
    return { ...r, totalC: total };
  }

  cellAt(i) { return this.at[i] || null; }

  async freeSpins(kind) {
    const conf = FS[kind];
    let spins = conf.spins, done = 0, open = conf.open, cnt = 0, fsWin = 0;
    this.lastStake = this.bet;
    await this.featureIntro(kind === 'super' ? 'SUPER FOUR' : 'LE FOUR', `${spins} tours · chaque 4ᵉ pepperoni ouvre une part et donne +2 tours`, symImg(SCAT));
    this.slotEl.classList.add('in-free');
    this.setOpen(open, false);
    this.setPeps(0, spins);
    this.onPep = (n) => { cnt += n; this.setPeps(Math.min(cnt, PEP_STEP)); };
    while (done < spins && done < MAX_SPINS && !this.dead) {
      done++;
      this.setPeps(cnt, spins - done);
      this.setBanner(`<b>${kind === 'super' ? 'SUPER FOUR' : 'LE FOUR'}</b><span class="pill">Tour ${done} / ${spins}</span><span class="pill gold">Gain ${fmtC(fsWin)}</span>`);
      const r = await this.spinOnce(true, open);
      fsWin += r.totalC; open = r.open;
      while (cnt >= PEP_STEP && !this.dead) {
        cnt -= PEP_STEP; spins += PEP_SPINS;
        if (open < NS) { open++; this.setOpen(open); this.word('+1 PART · +2 TOURS'); } else this.word('+2 TOURS');
        sfx.feature?.(); fx.confetti(40);
        this.setPeps(cnt, spins - done);
        await this.wait(1100);
      }
      this.setPeps(cnt, spins - done);
      await this.wait(400);
    }
    this.onPep = null;
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    this.setOpen(2, false);
    this.setLast(fsWin);
    await this.celebrate(fsWin, { summary: kind === 'super' ? 'SUPER FOUR' : 'BONUS LE FOUR' });
    this.msg(`Bonus terminé : ${fmtC(fsWin)} gagnés`);
  }

  info() {
    const v = (s, n) => (PAY[s] * SIZE[n] * K).toFixed(2).replace('.', ',').replace(/,00$/, '');
    const rows = [0, 1, 2, 3, 4, 5, 6, 7].map((s) => `<div class="pay-item"><div class="pay-sym">${symImg(s)}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>4 : ×${v(s, 4)} · 6 : ×${v(s, 6)} · 8 : ×${v(s, 8)} · 11+ : ×${v(s, 11)}</span></div></div>`).join('')
      + [WILD, SCAT, TRUCK, PEP].map((s) => `<div class="pay-item"><div class="pay-sym">${symImg(s)}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>${['Remplace tous les symboles normaux', '3 = Le Four · 4 = Super Four', 'Porte ×2 à ×50 ; les camions s’additionnent et multiplient le gain du tour', 'Dans le bonus : 4 pepperonis = une part de plus et +2 tours'][s - WILD]}</span></div></div>`).join('');
    return this.rules(`<h4>Symboles (gains × la mise)</h4><div class="paytable">${rows}</div>
      <h4>La pizza</h4><p>La pizza est coupée en <b>8 parts de 4 cases</b>. Elle tourne et s’arrête avec <b>un quart ouvert</b> (2 parts) où tombent les symboles. <b>4 symboles identiques ou plus qui se touchent</b> (dans la même part, ou d’une part à la voisine sur le même anneau) gagnent, disparaissent, et les autres glissent vers le centre. Une connexion de <b>6 symboles ou plus</b> fait sortir une part de plus pour le reste du tour. Les 8 parts ouvertes : <b>Pizza complète, +×${FULL} la mise</b>.</p>
      <h4>Food trucks</h4><p>Chaque camion porte un multiplicateur. À la fin du tour, s’il y a un gain, les multiplicateurs des camions s’additionnent et multiplient le gain.</p>
      <h4>Bonus</h4><p>3 roulettes : <b>Le Four</b>, 8 tours. 4 roulettes : <b>Super Four</b>, 14 tours. On commence avec un quart de pizza ; chaque fois que <b>4 pepperonis</b> sont réunis, une part s’ouvre pour tout le bonus et on gagne <b>+2 tours</b>, jusqu’à la pizza entière.</p>
      <h4>Achats</h4><p>Le Four ×${BUYN} la mise · Super Four ×${BUYS} la mise.</p>`);
  }
}
return { PizzaGame };
})();
