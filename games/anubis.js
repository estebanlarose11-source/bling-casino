// SpinBet Casino · AnubisGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/anubis.js ----
__mods['games/impl/anubis.js'] = (() => {
// Anubis Reborn, rebuilt on the shared cabinet. Cascades, Underworld and Judgment (original math).
// Visuals: animated temple, glowing cluster links, shattering wins; Judgment over flowing lava, black skull cubes
// and red cubes that melt the ice below them.

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
// A column that reaches the top melts into one cube and keeps going (JPC retuned: same bonus value, ≈ ×130).
const JW = [['cube', 62], ['sk', 12], ['g', 0.2], ['red', 3]], JPC = 0.176;
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
const cubeSVG = (top, left, right, edge, inner) => `<path d="M32 4 L58 18 L58 46 L32 60 L6 46 L6 18 Z" fill="${left}" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M32 4 L58 18 L32 32 L6 18 Z" fill="${top}"/><path d="M32 32 L58 18 L58 46 L32 60 Z" fill="${right}"/>
  <path d="M6 18 L32 32 L58 18 M32 32 V60" stroke="${edge}" stroke-width="1.4" fill="none" opacity=".8"/>${inner}`;
const SKULL = (c, eye) => `<g transform="translate(19 30) scale(.42)"><path d="M32 4 C16 4 8 16 8 29 C8 37 12 42 18 45 L18 54 H46 L46 45 C52 42 56 37 56 29 C56 16 48 4 32 4Z" fill="${c}"/>
  <circle cx="22" cy="29" r="7" fill="${eye}"/><circle cx="42" cy="29" r="7" fill="${eye}"/><path d="M28 41 L32 35 L36 41Z" fill="${eye}"/><path d="M24 54 V47 M32 54 V47 M40 54 V47" stroke="${eye}" stroke-width="3"/></g>`;
const EXTRA_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <symbol id="cbk" viewBox="0 0 64 64">${cubeSVG('#3f3f46', '#18181b', '#09090b', '#a855f7', SKULL('#e4e4e7', '#a855f7'))}</symbol>
  <symbol id="cbg" viewBox="0 0 64 64">${cubeSVG('#fde68a', '#d97706', '#92400e', '#fff7c2', SKULL('#fff7c2', '#92400e'))}</symbol>
  <symbol id="cbr" viewBox="0 0 64 64">${cubeSVG('#fca5a5', '#dc2626', '#7f1d1d', '#fecaca', '<path d="M20 40 Q24 30 28 38 Q32 26 36 36 Q40 28 44 40" stroke="#fde047" stroke-width="3" fill="none" stroke-linecap="round"/>')}</symbol>
</defs></svg>`;
const WORDS = ['DIVIN !', 'SACRÉ !', 'PHARAONIQUE !', 'ÉTERNEL !', 'IMMORTEL !', 'JUGEMENT DIVIN !'];
const GOLD = ['#fde68a', '#f59e0b', '#fff', '#5eead4'];
function symArt(v) {
  if (v >= 1000) return art('gk') + lab('×' + (v - 1000));
  return art(v === WILD ? 'w' : v === SC ? 'sc' : 's' + v);
}

class AnubisGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      defs: DEFS, music: MUSIC,
      head: '<div class="head-meters"><div class="meter gm-meter"><small>Multiplicateur</small><b>×1</b></div></div>',
      stage: '<div class="an-bg"><i class="an-sun"></i><i class="an-torch l"></i><i class="an-torch r"></i><i class="an-sand"></i></div><div class="an-word"></div><div class="col-row jrow"></div><div class="grid-host"></div><div class="col-row mrow"></div>',
      buys: [
        { id: 'U', icon: '💀', label: 'Monde souterrain · 3 scatters', desc: '10 tours, multiplicateurs par colonne et crânes dorés', cost: (b) => b * BUYU },
        { id: 'J', icon: '🧊', label: 'Jugement · 4 scatters', desc: 'Cubes de glace, crânes qui additionnent, crânes dorés jusqu’à ×100', cost: (b) => b * BUYJ },
      ],
      hello: 'Grappes de 5+ · les orbes rouges augmentent le multiplicateur',
    });
    if (!document.getElementById('an-extra')) { const d = document.createElement('div'); d.id = 'an-extra'; d.className = 'art-defs'; d.innerHTML = EXTRA_DEFS; document.body.appendChild(d); }
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

  word(k, text) {
    const w = this.q('.an-word');
    w.textContent = text || WORDS[Math.min(k, WORDS.length - 1)];
    w.className = `an-word t${Math.min(k, 5)}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.4)', filter: 'blur(6px)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.08)', filter: 'blur(0)', offset: 0.22 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%,-62%) scale(1.15)' }], { duration: this.turbo ? 650 : 1100, easing: 'ease-out' });
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
    this.grid.unlink();
    this.grid.cells.forEach((c) => c.classList.remove('dim', 'win', 'cube', 'rc', 'sks', 'gsk', 'lava', 'spin', 'heat', 'melting', 'golden', 'big'));
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
      const groups = [];
      cl.forEach((cu) => {
        groups.push(cu.cells);
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
      this.grid.link(groups, mode === 'under' ? ['#5eead4', '#a78bfa', '#fde047'] : ['#fde047', '#5eead4', '#f87171']);
      this.msg(`Connexion ! +${fmtC(paid)}${mode === 'base' && Gm > 1 ? ` <span class="pill hot">×${Gm}</span>` : ''}`);
      if (rounds > 0 || paid >= bet * 5) this.word(rounds);
      sfx.win();
      await this.wait(760);
      if (mode === 'under') {
        const up = {};
        cl.forEach((cu) => { const cs = {}; cu.cells.forEach((k) => { cs[Math.floor(k / R)] = 1; }); for (const cc in cs) { M[cc] += UINC; up[cc] = 1; } });
        this.renderM(M, up);
      } else {
        let orbs = 0;
        const to = center(this.gmEl);
        rem.forEach((k) => { if (grid[k] === WILD) { orbs++; fx.trail(center(this.grid.cells[k]), to, '#f87171', 10); } });
        if (orbs) { await this.wait(350); Gm += orbs; this.setG(Gm, true); this.word(5, `×${Gm}`); }
      }
      this.grid.unmark();
      this.grid.unlink();
      if (rem.size >= 10) this.shake();
      await this.grid.shatter([...rem], mode === 'under' ? ['#5eead4', '#a78bfa', '#fff'] : GOLD);
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
      await this.grid.richCascade(grid, rem, 'rgba(253,230,138,.6)');
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

  lava(i) { if (i >= 0) this.paint(i, '', 'lava'); }

  fall(i, row) {
    return this.grid.sym(i).animate([{ transform: `translateY(${-(row + 1) * 110}%)` }, { transform: 'translateY(0)', offset: 0.75 }, { transform: 'scale(1.12,.86) translateY(6%)', offset: 0.88 }, { transform: 'none' }],
      { duration: this.turbo ? 260 : 480, easing: 'cubic-bezier(.45,0,.7,1)' }).finished;
  }

  label(c, t, cls) {
    const l = this.jrow.children[c].querySelector('.lbl');
    l.textContent = t; l.className = 'lbl ' + cls;
    void l.offsetWidth; l.classList.add('go');
  }

  // Melts every ice cube of column c into the bottom one (red cube, or a column that reached the top).
  async melt(c, x, why) {
    const S = x.T, cells = [];
    for (let j = x.n - 1; j >= 1; j--) cells.push(this.cubeCell(c, j));
    this.label(c, why === 'full' ? 'FUSION !' : '= ' + fxv(S), 'lr');
    for (let j = 0; j < x.n; j++) this.grid.cells[this.cubeCell(c, j)].classList.add('heat');
    sfx.feature();
    await this.wait(380);
    for (const ci of cells) {
      if (this.dead) return;
      const cell = this.grid.cells[ci], p = center(cell);
      cell.classList.add('melting');
      fx.burst(p.x, p.y - 10, 9, ['#e0f2fe', '#cbd5e1', '#fff'], 3);
      fx.burst(p.x, p.y + 14, 5, ['#38bdf8', '#7dd3fc'], 2);
      await this.grid.sym(ci).animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(30%) scaleY(.2)', opacity: 0.1 }], { duration: this.turbo ? 120 : 230, easing: 'ease-in', fill: 'forwards' }).finished;
      this.lava(ci);
      sfx.tick();
    }
    const fi = this.cubeCell(c, 0);
    this.paint(fi, art('cb') + lab(fxv(S)), 'cube merged');
    this.grid.sym(fi).animate([{ transform: 'scale(.75)', filter: 'brightness(2)' }, { transform: 'scale(1.22)', filter: 'brightness(1.5)', offset: 0.55 }, { transform: 'none', filter: 'none' }], { duration: 520, easing: 'ease-out' });
    const p = center(this.grid.cells[fi]);
    fx.burst(p.x, p.y, 30, ['#7dd3fc', '#fff', '#fb923c'], 7);
    sfx.coin();
    x.n = 1; x.T = S;
    await this.wait(650);
    this.grid.cells[fi].classList.remove('merged', 'heat');
  }

  async judgment(startCells) {
    const bet = this.bet, cap = bet * CAPX;
    let respins = 3, capHit = false, rounds = 0, maxWin = false;
    const cols = Array.from({ length: C }, () => ({ n: 0, m: 1, mod: false, T: 0 }));
    const total = () => cols.reduce((a, x) => a + x.T, 0);
    const draw = () => cols.forEach((x, c) => { const d = this.jrow.children[c]; d.querySelector('b').textContent = '×' + fxv(x.m); d.querySelector('small').textContent = '= ' + fxv(x.T); d.classList.toggle('mod', x.mod); });
    const info = () => { this.setBanner(`<b>JUGEMENT</b><span class="pill respins">${[0, 1, 2].map((k) => `<i class="dot${k < respins ? ' on' : ''}"></i>`).join('')} Relances</span><span class="pill gold">Total ×${fxv(total())} · ${fmtC(Math.min(cap, Math.round(bet * total())))}</span>`); };

    await this.featureIntro('JUGEMENT', 'Les cubes de glace tombent sur la lave · crânes noirs, crânes dorés et cubes rouges', art('cb'));
    this.slotEl.classList.add('in-free', 'judge');
    for (let i = 0; i < N; i++) this.lava(i);
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
      const p = center(this.grid.cells[i]); fx.burst(p.x, p.y + 10, 14, ['#bae6fd', '#38bdf8', '#fff'], 4);
      if (x.n >= R) await this.melt(c, x, 'full'); // the column reached the top: it melts and keeps going
    };
    const showAt = async (c, x, id, txt, cls) => {
      const i = this.cubeCell(c, x.n);
      this.paint(i, art(id) + (txt ? lab(txt) : ''), cls);
      await this.fall(i, R - 1 - x.n);
      sfx.land();
      return i;
    };
    const apply = async (c, k) => {
      const x = cols[c];
      if (k === 'cube') return addCube(c);
      if (k === 'sk') {
        const n = skVal(), big = n >= 500;
        const i3 = await showAt(c, x, 'cbk', '+' + fxv(n), 'sks' + (big ? ' big' : ''));
        await this.wait(300);
        const p = center(this.grid.cells[i3]);
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
        fx.trail(p, center(this.jrow.children[c]), big ? '#fde047' : '#a855f7', 10);
        this.label(c, '+' + fxv(n), big ? 'lg' : 'ls');
        await this.grid.shatter([i3], big ? ['#fde047', '#fff', '#f59e0b'] : ['#a855f7', '#27272a', '#e4e4e7']);
        draw();
        this.grid.bump(this.jrow.children[c]);
        if (big) { this.flash('rgba(226,232,240,.6)'); sfx.jackpot(); } else sfx.upgrade();
        await this.wait(300); this.lava(i3);
      } else if (k === 'g') {
        const kk = gkVal(), i4 = await showAt(c, x, 'cbg', '×' + kk, 'gsk');
        await this.wait(420);
        x.T *= kk; this.label(c, '×' + kk, 'lg'); draw();
        this.flash('rgba(253,224,71,.6)'); sfx.jackpot();
        for (let j = 0; j < x.n; j++) this.grid.cells[this.cubeCell(c, j)].classList.add('win', 'golden');
        await this.grid.shatter([i4], ['#fde047', '#fff', '#f59e0b']);
        await this.wait(700);
        for (let j = 0; j < x.n; j++) this.grid.cells[this.cubeCell(c, j)].classList.remove('win', 'golden');
        this.lava(i4);
      } else if (k === 'red') {
        const ri = await showAt(c, x, 'cbr', '', 'rc');
        this.msg('Cube rouge : la glace fond !');
        await this.wait(350);
        const p = center(this.grid.cells[ri]);
        fx.burst(p.x, p.y, 20, ['#f87171', '#fb923c', '#fde047'], 6);
        this.grid.sym(ri).animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(40%) scale(.6)', opacity: 0 }], { duration: 300, fill: 'forwards' });
        await this.wait(250);
        this.lava(ri);
        await this.melt(c, x, 'red');
      }
    };

    for (const s0 of startCells) await addCube(Math.floor(s0 / R));
    await this.wait(400); info();
    while (respins > 0 && !capHit && rounds < 120 && !this.dead) {
      rounds++;
      this.msg('Relance…');
      // the lava under every column scrolls like a reel, then the columns stop one after the other
      const spinning = cols.map((x, c) => { const cs = []; for (let j = x.n; j < R; j++) cs.push(this.grid.cells[this.cubeCell(c, j)]); cs.forEach((el) => el.classList.add('spin')); return cs; });
      sfx.reelStop?.(0);
      await this.wait(this.turbo ? 200 : 420);
      let got = false;
      for (let c2 = 0; c2 < C && !capHit; c2++) {
        await this.wait(this.turbo ? 50 : 120);
        spinning[c2].forEach((el) => el.classList.remove('spin'));
        sfx.tick();
        if (Math.random() < JPC) { got = true; await apply(c2, pickItem(cols[c2].n)); info(); if (maxWin || total() >= CAPX) capHit = true; }
      }
      spinning.flat().forEach((el) => el.classList.remove('spin'));
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
      <h4>Jugement</h4><p>Les cubes tombent dans les colonnes avec la valeur affichée en haut. 3 relances, remises à 3 à chaque nouvel objet. <b>Crâne noir</b> : ajoute de <b>+2 à +500</b> à la valeur des prochains cubes de sa colonne. Un crâne à <b>10 000</b>, très rare, donne directement le <b>MAX WIN</b> (×10 000) et arrête le bonus. <b>Crâne doré</b> : multiplie la colonne. <b>Cube rouge</b> : fait fondre toute la glace de sa colonne dans un seul cube (la somme est gardée) et libère de la place ; la valeur des prochains cubes ne change pas. <b>Fusion</b> : quand une colonne atteint le haut, elle fond toute seule en un cube et continue de se remplir.</p>
      <h4>Achats</h4><p>Monde souterrain ×${BUYU} · Jugement ×${BUYJ}. Gain maximum ×10 000.</p>`);
  }
}

return { AnubisGame };
})();
