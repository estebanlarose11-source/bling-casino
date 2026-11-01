// SpinBet Casino · CandyGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/candy.js ----
__mods['games/impl/candy.js'] = (() => {
// Candy Queen: 6×5 cluster pays with cascades. Every cascade raises the Queen's multiplier (×1, ×2, ×3, ×5, ×8, ×12,
// ×20); big clusters leave a special candy behind (8+: exploding heart, row and column; 10+: candy-jar bomb, 3×3;
// 12+: magic wand, every candy of the most common kind). In the Queen's Ball free spins the multiplier never resets.
// Tuned by simulation (RTP ≈ 92 %, buys ≈ 88 %).

const { BaseGame, fmtC, art: svgArt } = __mods['core/base.js'];
// Painted images from the owner (assets/games/candy): the 10 sweets s0..s9, the crown (scatter), the exploding heart,
// the candy-jar bomb and the magic wand. Background bg.webp, cover cover.webp.
const IMG_V = 1;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images are inlined
const PAINT = { cq0: 's0', cq1: 's1', cq2: 's2', cq3: 's3', cq4: 's4', cq5: 's5', cq6: 's6', cq7: 's7', cq8: 's8', cq9: 's9', cqs: 'crown', cqh: 'heart', cqj: 'jar', cqw: 'wand' };
const art = (id) => (PAINT[id] ? `<img class="cq-img" src="${asset(`assets/games/candy/${PAINT[id]}.webp`)}" alt="" draggable="false" decoding="async">` : svgArt(id));
const { SymbolGrid } = __mods['core/grid.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { el, toast } = __mods['ui.js'];

/* ===ENGINE */
const C = 6, R = 5, N = 30, MINC = 5, CAPX = 10000, CROWN = 10, HEART = 12, JAR = 13, WAND = 14;
const P = {
  w: [40, 34, 26, 18, 12, 8, 6, 4, 3, 2],
  val: [0.06, 0.08, 0.1, 0.14, 0.2, 0.35, 0.5, 1, 2, 4], F: 4.25, piece: 0.25,
  ps: 0.016, psFS: 0.018, huntF: 1.56, spFS: 0.01,
  ladder: [1, 2, 3, 5, 8, 12, 20],
};
function draw(o) {
  const r = Math.random(), ps = (o.fs ? P.psFS : P.ps) * (o.hunt ? P.huntF : 1);
  if (r < ps) return CROWN;
  if (o.fs && r < ps + P.spFS) return [HEART, JAR, WAND][Math.floor(Math.random() * 3)];
  let t = 0; for (const x of P.w) t += x;
  let x = Math.random() * t; for (let i = 0; i < P.w.length; i++) { if (x < P.w[i]) return i; x -= P.w[i]; } return 0;
}
const NB = [];
for (let k = 0; k < N; k++) { const c = Math.floor(k / R), r = k % R, o = []; if (r > 0) o.push(k - 1); if (r < R - 1) o.push(k + 1); if (c > 0) o.push(k - R); if (c < C - 1) o.push(k + R); NB.push(o); }
function clusters(g) {
  const out = [], seen = {};
  for (let k = 0; k < N; k++) {
    const t = g[k]; if (t > 9 || seen[k]) continue;
    const st = [k], cs = []; seen[k] = 1;
    while (st.length) { const x = st.pop(); cs.push(x); for (const n of NB[x]) if (!seen[n] && g[n] === t) { seen[n] = 1; st.push(n); } }
    if (cs.length >= MINC) out.push({ t, cells: cs });
  }
  return out;
}
const special = (n) => (n >= 12 ? WAND : n >= 10 ? JAR : n >= 8 ? HEART : null);
// Cells a special candy clears (regular candies only): heart = its row and column, jar = 3×3, wand = every candy of
// the most common kind on the grid.
function blast(g, i) {
  const c0 = Math.floor(i / R), r0 = i % R, out = [];
  if (g[i] === HEART) { for (let k = 0; k < N; k++) if (k !== i && g[k] < 10 && (Math.floor(k / R) === c0 || k % R === r0)) out.push(k); }
  else if (g[i] === JAR) { for (let k = 0; k < N; k++) if (k !== i && g[k] < 10 && Math.abs(Math.floor(k / R) - c0) <= 1 && Math.abs(k % R - r0) <= 1) out.push(k); }
  else {
    const cnt = new Array(10).fill(0); for (const v of g) if (v < 10) cnt[v]++;
    let best = 0; for (let s = 1; s < 10; s++) if (cnt[s] > cnt[best] || (cnt[s] === cnt[best] && P.val[s] > P.val[best])) best = s;
    for (let k = 0; k < N; k++) if (g[k] === best) out.push(k);
  }
  return out;
}
function fall(g, rem, o) {
  for (let c = 0; c < C; c++) {
    const keep = []; for (let r = 0; r < R; r++) { const j = c * R + r; if (!rem[j]) keep.push(g[j]); }
    const miss = R - keep.length;
    for (let r = 0; r < R; r++) g[c * R + r] = r < miss ? draw(o) : keep[r - miss];
  }
}
// One spin. o.lv = multiplier ladder step to start from (free spins keep it), o.forceSp drops a special candy.
function spin(o) {
  const bet = o.bet, g = [], steps = [];
  let lv = o.lv || 0, total = 0, rounds = 0;
  for (let i = 0; i < N; i++) g.push(draw(o));
  if (o.forceSp) g[Math.floor(Math.random() * N)] = [HEART, JAR, WAND][Math.floor(Math.random() * 3)];
  steps.push({ k: 'init', grid: g.slice(), lv });
  while (rounds < 60) {
    const m = P.ladder[Math.min(lv, P.ladder.length - 1)];
    const cl = clusters(g);
    if (cl.length) {
      let paid = 0; const rem = {}, wins = [], made = [];
      cl.forEach((c) => {
        const p = bet * P.val[c.t] * P.F * (c.cells.length - MINC + 1) * m;
        paid += p; wins.push({ t: c.t, n: c.cells.length, p, cells: c.cells });
        c.cells.forEach((x) => { rem[x] = 1; });
        const sp = special(c.cells.length);
        if (sp) { const at = c.cells[Math.floor(Math.random() * c.cells.length)]; delete rem[at]; g[at] = sp; made.push({ i: at, sp }); }
      });
      total += paid; fall(g, rem, o); lv++; rounds++;
      steps.push({ k: 'win', wins, paid, m, made, rem: Object.keys(rem).map(Number), after: g.slice(), lv });
      continue;
    }
    // no cluster left: the special candies on the grid go off, one after the other
    const sps = []; for (let k = 0; k < N; k++) if (g[k] >= HEART) sps.push(k);
    if (!sps.length) break;
    const rem = {}, fx = []; let paid = 0;
    for (const i of sps) {
      const cells = blast(g, i).filter((k) => !rem[k]);
      let p = 0; cells.forEach((k) => { p += bet * P.val[g[k]] * P.F * P.piece * m; rem[k] = 1; });
      rem[i] = 1; paid += p; fx.push({ i, sp: g[i], cells, p });
    }
    total += paid; fall(g, rem, o); lv++; rounds++;
    steps.push({ k: 'blast', fx, paid, m, rem: Object.keys(rem).map(Number), after: g.slice(), lv });
  }
  let scat = 0; for (const v of g) if (v === CROWN) scat++;
  let capped = false; if (total >= bet * CAPX) { total = bet * CAPX; capped = true; }
  steps.push({ k: 'end', scat });
  return { steps, total, scat, lv, capped };
}
const FS = { trig: 4, spins: 10, retrig: 3, extra: 5 };
/* ===END ENGINE */

const NAMES = ['Boule de gomme', 'Bonbon bleu', 'Étoile sucrée', 'Cœur gélifié', 'Sucette', 'Donut', 'Cupcake', 'Glace', 'Potion d’amour', 'Bague diamant'];
const SPN = { [HEART]: 'Cœur explosif', [JAR]: 'Bocal bombe', [WAND]: 'Baguette magique' };
const SPD = { [HEART]: 'efface sa ligne et sa colonne', [JAR]: 'efface les 8 cases autour', [WAND]: 'efface tous les bonbons de la sorte la plus présente' };
const SPART = { [HEART]: 'cqh', [JAR]: 'cqj', [WAND]: 'cqw' };
const SPLBL = { [HEART]: 'CŒUR', [JAR]: 'BOCAL', [WAND]: 'BAGUETTE' };
const HUNTC = 2, SPC = 4.3, PFS = 144;
const WORDS = ['SWEET !', 'DÉLICIEUX !', 'SUGAR RUSH !', 'DIVIN !', 'ROYAL !', 'QUEEN !'];
const NEON = ['#ff4fb8', '#ff9ee0', '#38bdf8', '#fde047', '#c084fc', '#a3e635', '#fff'];
const sym = (c) => (c < 10 ? art('cq' + c) : c === CROWN ? art('cqs') + '<i class="lbl cql">COURONNE</i>' : art(SPART[c]) + `<i class="lbl cql w">${SPLBL[c]}</i>`);
const mOf = (lv) => P.ladder[Math.min(lv, P.ladder.length - 1)];

class CandyGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.candy,
      frameCls: 'candy-frame',
      stage: `<div class="cq-stage">
        <div class="cq-sky"><i class="cq-lolli l1"></i><i class="cq-lolli l2"></i></div>
        <div class="cq-board">
          <div class="cq-ladder">${P.ladder.map((m, k) => `<span data-lv="${k}">×${m}</span>`).join('')}</div>
          <div class="grid-host"></div>
          <div class="cq-word"></div>
        </div>
      </div>`,
      head: '<div class="cq-meter"><small>Multiplicateur</small><b>×1</b></div>',
      opts: [{ id: 'hunt', icon: '👑', label: 'Chasse aux couronnes (mise ×2, couronnes ×1,56)' }],
      buys: [
        { id: 'sp', icon: '🍬', label: 'Bonbon spécial garanti', desc: 'Un tour avec un cœur, un bocal ou une baguette sur la grille', cost: (b) => Math.round(b * SPC) },
        { id: 'fs', icon: '👑', label: `Bal de la Reine · ${FS.spins} tours`, desc: 'Le multiplicateur ne redescend jamais pendant le bonus', cost: (b) => b * PFS },
      ],
      hello: 'Grappes de 5+ · chaque cascade monte le multiplicateur · grosses grappes = bonbons spéciaux',
    });
    this.hunt = false;
    this.meterVal = this.q('.cq-meter b');
    this.q('.cq-sky').style.setProperty('--cq-bg', `url("${asset('assets/games/candy/bg.webp')}")`);
    Object.values(PAINT).forEach((n) => { new Image().src = asset(`assets/games/candy/${n}.webp`); });
    this.grid = new SymbolGrid(this.q('.grid-host'), {
      cols: C, rows: R, game: this, art: sym,
      cls: (v) => (v === CROWN ? 'scatter' : v >= HEART ? 'rainbow special' : v >= 7 ? 'hi' : ''),
    });
    this.grid.setAll(Array.from({ length: N }, () => Math.floor(Math.random() * 10)));
    this.setLv(0);
  }

  setLv(lv, bump) {
    const m = mOf(lv);
    this.meterVal.textContent = `×${m}`;
    this.q('.cq-meter').classList.toggle('hot', m > 1);
    this.qa('.cq-ladder span').forEach((s) => { const k = +s.dataset.lv; s.classList.toggle('on', k === Math.min(lv, P.ladder.length - 1)); s.classList.toggle('past', k < lv); });
    if (bump) this.meterVal.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.4)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 400 });
  }

  word(k, text) {
    const w = this.q('.cq-word');
    w.textContent = text || WORDS[Math.min(k, WORDS.length - 1)];
    w.className = `cq-word t${Math.min(k, 5)}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.2 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.35 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.7 },
      { opacity: 0, transform: 'translate(-50%,-70%) scale(1.15)' },
    ], { duration: this.turbo ? 600 : 1000, easing: 'ease-out' });
  }

  overlay(html, cls = '') { return super.overlay(html, `${cls} cq-ov`); }

  stakeLabel() { return Math.round(this.bet * (this.hunt ? HUNTC : 1)); }
  optOn(id) { return id === 'hunt' && this.hunt; }
  onOpt(id) {
    if (id !== 'hunt' || this.busy) return;
    this.hunt = !this.hunt;
    this.slotEl.classList.toggle('hunting', this.hunt);
    toast(this.hunt ? 'Chasse aux couronnes : mise ×2, couronnes 1,56 fois plus fréquentes' : 'Chasse aux couronnes désactivée');
    this.updateMeters();
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
    if (kind === 'fs') total = await this.bonus();
    else {
      const res = spin({ bet: b, fs: false, hunt: kind === 'spin' && this.hunt, forceSp: kind === 'sp' });
      await this.play(res);
      total = res.total;
      if (total > 0) { this.win(Math.round(total)); this.setLast(total); }
      if (res.scat >= FS.trig) {
        this.stopAuto();
        if (total > 0) await this.celebrate(Math.round(total));
        total += await this.bonus();
      } else if (total > 0) await this.celebrate(Math.round(total));
      this.setLv(0);
    }
    this.setLast(total);
    this.msg(total >= b * CAPX ? `GAIN MAXIMUM ! ${fmtC(total)}` : total > 0 ? `Total du tour : ${fmtC(total)}` : 'Pas de gain');
  }

  async play(res) {
    let run = 0, k = 0;
    for (const st of res.steps) {
      if (this.dead) return;
      if (st.k === 'init') {
        this.setLv(st.lv);
        await this.grid.dropIn(st.grid, {
          tease: (c) => { let sc = 0; for (let j = 0; j < c * R; j++) if (st.grid[j] === CROWN) sc++; return sc >= 3; },
          onLand: (i, v) => {
            if (v < 10) return;
            sfx.land();
            const p = center(this.grid.cells[i]);
            fx.burst(p.x, p.y, 10, v === CROWN ? ['#fde047', '#fff', '#ff9ee0'] : NEON, 5);
          },
        });
      } else if (st.k === 'win') {
        st.wins.forEach((w) => this.grid.floatOver(w.cells, `+${fmtC(Math.round(w.p))}`, '#ffe1f3'));
        this.grid.mark(st.wins.flatMap((w) => w.cells));
        this.msg(`${st.wins.map((w) => `${w.n} × ${NAMES[w.t]}`).join(' · ')}${st.m > 1 ? ` · ×${st.m}` : ''} : +${fmtC(Math.round(st.paid))}`);
        this.word(k);
        sfx.win();
        await this.wait(750);
        this.grid.unmark();
        await this.grid.explode(st.rem, NEON);
        for (const mk of st.made) {
          this.grid.set(mk.i, mk.sp);
          this.grid.cells[mk.i].animate([{ transform: 'scale(.2)' }, { transform: 'scale(1.2)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' });
          sfx.upgrade();
          this.msg(`Grappe de ${st.wins.find((w) => w.cells.includes(mk.i))?.n || 8} : ${SPN[mk.sp]} créé !`);
          await this.wait(500);
        }
        await this.grid.cascade(st.after, new Set(st.rem));
        run += st.paid; k++;
        this.setLv(st.lv, true);
        this.setLast(Math.round(run));
        await this.wait(180);
      } else if (st.k === 'blast') {
        for (const b of st.fx) {
          if (this.dead) return;
          const src = this.grid.cells[b.i];
          src.classList.add('pulse');
          b.cells.forEach((c) => this.grid.cells[c].classList.add('beam'));
          this.msg(`${SPN[b.sp]} : ${SPD[b.sp]} !${b.p > 0 ? ` +${fmtC(Math.round(b.p))}` : ''}`);
          this.word(5, b.sp === WAND ? 'MAGIE !' : 'BOUM !');
          this.shake();
          sfx.feature();
          const p = center(src);
          fx.burst(p.x, p.y, 30, NEON, 9);
          await this.wait(800);
          b.cells.forEach((c) => this.grid.cells[c].classList.remove('beam'));
          src.classList.remove('pulse');
        }
        await this.grid.explode(st.rem, NEON);
        await this.grid.cascade(st.after, new Set(st.rem));
        run += st.paid; k++;
        this.setLv(st.lv, true);
        this.setLast(Math.round(run));
        await this.wait(180);
      }
    }
  }

  // Same rules as the simulator: the multiplier carries over from spin to spin, +5 spins for 3 crowns.
  async bonus() {
    let left = FS.spins, lv = 0, tot = 0, done = 0;
    const b = this.bet, cap = b * CAPX;
    this.lastStake = b;
    await this.featureIntro('BAL DE LA REINE', `${FS.spins} tours gratuits · le multiplicateur ne redescend jamais`, art('cqs'));
    this.slotEl.classList.add('in-free');
    this.setLv(0);
    while (left > 0 && tot < cap && !this.dead) {
      left--; done++;
      this.setBanner(`<b>BAL DE LA REINE</b><span class="pill">Tour ${done} / ${done + left}</span><span class="pill">Multiplicateur ×${mOf(lv)}</span><span class="pill gold">Gain ${fmtC(Math.round(tot))}</span>`);
      const res = spin({ bet: b, fs: true, lv });
      await this.play(res);
      lv = res.lv;
      const add = Math.min(res.total, cap - tot);
      tot += add;
      if (add > 0) this.win(Math.round(add), 'Bal de la Reine');
      this.setLast(Math.round(tot));
      if (res.scat >= FS.retrig) { left += FS.extra; await this.featureIntro(`+${FS.extra} TOURS`, 'Encore des couronnes !', art('cqs'), 1300); }
      await this.wait(300);
    }
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    this.setLv(0);
    await this.celebrate(Math.round(tot), { summary: 'BAL DE LA REINE', stake: b });
    return tot;
  }

  info() {
    const pay = (s) => (P.val[s] * P.F).toFixed(2).replace('.', ',');
    const rows = NAMES.map((n, s) => `<div class="pay-item"><div class="pay-sym svg">${art('cq' + s)}</div><div class="pay-vals"><b>${n}</b><br><span>5 : ×${pay(s)} · chaque case de plus : +×${pay(s)}</span></div></div>`).join('');
    const sp = [HEART, JAR, WAND].map((s, k) => `<div class="pay-item"><div class="pay-sym svg">${art(SPART[s])}</div><div class="pay-vals"><b>${SPN[s]}</b><br><span>Grappe de ${[8, 10, 12][k]}+ · ${SPD[s]}</span></div></div>`).join('');
    return this.rules(`<h4>Symboles (× la mise)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym svg">${art('cqs')}</div><div class="pay-vals"><b>Couronne</b><br><span>4 ou plus : Bal de la Reine</span></div></div></div>
      <h4>Multiplicateur de cascades</h4><p>Grille 6×5, grappes de 5+ (horizontal ou vertical). Les bonbons gagnants disparaissent et d’autres tombent. Chaque cascade fait monter le multiplicateur du tour : ${P.ladder.map((m) => `×${m}`).join(', ')}.</p>
      <h4>Bonbons spéciaux</h4><div class="paytable">${sp}</div><p>Une grande grappe laisse un bonbon spécial à sa place. Quand plus aucune grappe ne se forme, les bonbons spéciaux explosent : chaque bonbon effacé paie ${String(P.piece * 100)} % de sa valeur de grappe, multiplicateur compris, puis les cascades reprennent.</p>
      <h4>Bal de la Reine</h4><p>4 couronnes ou plus : ${FS.spins} tours gratuits. Le multiplicateur <b>ne redescend jamais</b> pendant le bonus et des bonbons spéciaux tombent parfois du ciel. 3 couronnes : +${FS.extra} tours.</p>
      <h4>Options</h4><p>Chasse aux couronnes : mise ×2, couronnes 1,56 fois plus fréquentes. Achats : bonbon spécial garanti ×${String(SPC).replace('.', ',')} · Bal de la Reine ×${PFS}. Gain maximum ×10 000.</p>`);
  }
}

return { CandyGame };
})();
