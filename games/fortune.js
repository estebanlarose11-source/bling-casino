// SpinBet Casino · FortuneGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/fortune.js ----
__mods['games/impl/fortune.js'] = (() => {
// La Fortune: Chinese New Year slot, 5×3 and 243 ways, in the owner's painted frame (assets/games/fortune). Gold coins
// fly up into the pot when fewer than 6 land; 6 coins start the HOLD & SPIN (MAJOR and JACKPOT coins, progressive;
// a row can light up ×2 or ×5); 4 scatters start the MÉGA BONUS (every coin ×2 to ×5, rows light up more often).
// Tuned by simulation: RTP ≈ 92 % (ways 43 %, pot 12 %, Hold & Spin 19 %, Méga 16 %, progressive 0,65 %), buys ≈ 88 %.

const { BaseGame, fmtC, shortC } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { el } = __mods['ui.js'];

/* ===ENGINE */
// 5×3, 243 ways. J Q K A, lantern, gold ingots, red envelope, lucky cats; golden dragon WILD on reels 2-4.
// Gold coins carry a value (× the bet). 6 coins or more: HOLD & SPIN (the coins stay, 3 respins, every new coin puts
// them back to 3; MAJOR ×50 and JACKPOT ×500 coins; sometimes a whole row lights up ×2 or ×5 its coins).
// Fewer than 6 coins: they fly up into the pot (a share of their value); the pot is paid with the next bonus at
// that stake. 4 SCATTERS: MÉGA BONUS, a Hold & Spin where every coin is ×2 to ×5 and the rows light up more often.
const COLS = 5, ROWS = 3, N = 15, WILD = 8, COIN = 9, SCAT = 10, BLANK = 11, CAPX = 5000, NS = 8;
const JP = { major: 50, jackpot: 500 };
// Progressive jackpots: every paid spin adds a share of the stake to MAJOR and JACKPOT (shown climbing at the top);
// a MAJOR / JACKPOT coin pays the pot at that moment, which then goes back to ×50 / ×500.
const PROG = { major: 0.004, jackpot: 0.0025 };
const P = {
  w: [26, 24, 22, 20, 12, 10, 8, 6], wild: 3,
  pays: [[0.2, 0.5, 1.5], [0.2, 0.5, 1.5], [0.3, 0.8, 2], [0.3, 0.8, 2], [0.5, 1.2, 4], [0.6, 1.5, 5], [0.8, 2, 7], [1.2, 4, 12]], K: 1.12,
  coin: 0.12, scat: 0.115, pot: 0.035,
  val: [[0.5, 34], [1, 28], [2, 18], [3, 9], [5, 6], [10, 3], [20, 1.2], [50, 0.3]],
  bval: [[0.5, 34], [1, 28], [2, 18], [3, 9], [5, 6], [10, 3], [20, 1.2], [50, 0.3], ['major', 0.55], ['jackpot', 0.045]],
  hold: { p: 0.097, light: 0.12, l5: 0.2 },
  mega: { p: 0.055, light: 0.32, l5: 0.35, cm: [[2, 50], [3, 30], [5, 20]] },
};
function wp(R, l) { let t = 0; for (const x of l) t += x[1]; let q = R() * t; for (const x of l) { if (q < x[1]) return x[0]; q -= x[1]; } return l[l.length - 1][0]; }
const cv = (v) => (typeof v === 'number' ? v : JP[v]); // a coin's value in × the bet
function symbol(c, R) {
  const ws = c >= 1 && c <= 3 ? P.wild : 0;
  let t = ws; for (const x of P.w) t += x;
  let q = R() * t;
  if (q < ws) return WILD; q -= ws;
  for (let i = 0; i < NS; i++) { if (q < P.w[i]) return i; q -= P.w[i]; }
  return 0;
}
// a whole screen: at most one scatter per reel, coins anywhere
function screen(R = Math.random) {
  const g = [], vals = {};
  for (let c = 0; c < COLS; c++) {
    const sr = R() < P.scat ? Math.floor(R() * ROWS) : -1;
    for (let r = 0; r < ROWS; r++) {
      const i = c * ROWS + r;
      if (r === sr) g[i] = SCAT;
      else if (R() < P.coin) { g[i] = COIN; vals[i] = wp(R, P.val); }
      else g[i] = symbol(c, R);
    }
  }
  return { g, vals };
}
function ways(g) {
  const wins = [];
  for (let s = 0; s < NS; s++) {
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
function spin(R = Math.random) {
  const { g, vals } = screen(R), wins = ways(g);
  let base = 0; wins.forEach((w) => { base += w.x; });
  const coins = Object.keys(vals).map(Number), scat = g.filter((v) => v === SCAT).length;
  const mega = scat >= 4, hold = !mega && coins.length >= 6;
  const pot = !mega && !hold ? coins.reduce((a, i) => a + cv(vals[i]) * P.pot, 0) : 0;
  return { g, vals, wins, base, coins, scat, mega, hold, pot };
}
// Hold & Spin from the starting coins { cell: value }: the list of respins (new coins, a lit row) and the total.
function holdRun(start, mega, R = Math.random) {
  const H = mega ? P.mega : P.hold, cur = {}, mul = {};
  const put = (i, v, m) => { cur[i] = v; mul[i] = m; };
  for (const i in start) put(+i, start[i], mega ? wp(R, H.cm) : 1);
  const steps = [];
  let left = 3, guard = 0;
  while (left > 0 && Object.keys(cur).length < N && guard++ < 200) {
    const add = [];
    for (let i = 0; i < N; i++) if (!(i in cur) && R() < H.p) { const v = wp(R, P.bval), m = mega && typeof v === 'number' ? wp(R, H.cm) : 1; put(i, v, m); add.push({ i, v, m }); }
    let light = null;
    if (R() < H.light) {
      const row = Math.floor(R() * ROWS), x = R() < H.l5 ? 5 : 2;
      light = { row, x, hit: [] };
      for (let c = 0; c < COLS; c++) { const i = c * ROWS + row; if (i in cur && typeof cur[i] === 'number') { mul[i] *= x; light.hit.push(i); } }
    }
    left = add.length ? 3 : left - 1;
    steps.push({ add, light, left });
  }
  let total = 0;
  for (const i in cur) total += typeof cur[i] === 'number' ? cur[i] * mul[i] : JP[cur[i]];
  return { start: { ...start }, steps, cur, mul, total, full: Object.keys(cur).length === N };
}
// A bought bonus starts with 6 coins in random cells.
function startCoins(n = 6, R = Math.random) {
  const cells = [...Array(N).keys()];
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const o = {}; cells.slice(0, n).forEach((i) => { o[i] = wp(R, P.val); });
  return o;
}
/* ===END ENGINE */

const BUY_HOLD = 46, BUY_MEGA = 245;
const IMG_V = 1;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images are inlined
const src = (n) => asset(`assets/games/fortune/${n}.webp`);
const IMG = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 'wild', 'coin', 'scatter'];
const NAMES = ['J', 'Q', 'K', 'A', 'Lanterne', 'Lingots', 'Enveloppe rouge', 'Chats porte-bonheur'];
const img = (n, cls = 'ft-img') => `<img class="${cls}" src="${src(n)}" alt="" draggable="false" decoding="async">`;
const GOLD = ['#fde047', '#facc15', '#fff7d6', '#f59e0b'];
// Saved per stake on this browser: the pot and the two progressive jackpots (in cents).
const KEY = 'fortune_pots_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* ignore */ } };

// The pot drawn as a heap of gold coins in the bowl: the more it holds (in × the stake), the bigger the heap.
function heapSVG(x) {
  const n = x <= 0 ? 0 : Math.min(28, Math.round(3 + Math.sqrt(x) * 3.2));
  let s = '', k = 0;
  for (let row = 0; k < n; row++) {
    const w = Math.max(1, 7 - row);
    for (let j = 0; j < w && k < n; j++, k++) {
      const cx = 50 + (j - (w - 1) / 2) * 12 + (row % 2 ? 3 : -3), cy = 92 - row * 7;
      s += `<g transform="translate(${cx.toFixed(1)} ${cy})"><ellipse rx="7" ry="3.4" fill="#a16207"/><ellipse ry="3.4" rx="7" cy="-1.6" fill="url(#ftCoin)"/><rect x="-1.6" y="-3" width="3.2" height="2.4" fill="#92400e" opacity=".7"/></g>`;
    }
  }
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><defs><linearGradient id="ftCoin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7d6"/><stop offset=".45" stop-color="#facc15"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs>${s}</svg>`;
}

class FortuneGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.fortune,
      frameCls: 'ft-frame',
      stage: `<div class="ft-scene"><div class="ft-art">
          <div class="ft-jp major"><small>MAJOR</small><b data-jp="major"></b></div>
          <div class="ft-jp jackpot"><small>JACKPOT</small><b data-jp="jackpot"></b></div>
          <div class="ft-bowl"><div class="ft-heap"></div><b class="ft-pot"></b></div>
          <div class="ft-win"><div class="reels-host"></div><div class="ft-rows">${[0, 1, 2].map((r) => `<i data-row="${r}"></i>`).join('')}</div></div>
          <div class="ft-word"></div>
        </div></div>`,
      buys: [
        { id: 'hold', icon: '🪙', label: 'Hold & Spin · 6 pièces', desc: '6 pièces d’or verrouillées, 3 respins · MAJOR et JACKPOT en jeu · lignes ×2 et ×5', cost: (b) => b * BUY_HOLD },
        { id: 'mega', icon: '🐉', label: 'MÉGA BONUS', desc: 'Hold & Spin où chaque pièce vaut ×2 à ×5 · les lignes s’allument plus souvent', cost: (b) => b * BUY_MEGA },
      ],
      hello: '243 façons de gagner · 6 pièces d’or = HOLD & SPIN · 4 scatters = MÉGA BONUS',
    });
    this.vals = {}; this.mul = {};
    this.reels = new Reels(this.q('.reels-host'), {
      cols: COLS, rows: ROWS, game: this, random: (c) => this.filler(c),
      art: (v, i) => this.cellArt(v, i),
      cls: (v) => (v === COIN ? 'coin' : v === SCAT ? 'scat' : v === WILD ? 'wild' : v === BLANK ? 'blank' : `n${v}`),
    });
    this.reels.setAll(screen().g);
    IMG.concat(['major', 'jackpot', 'bg']).forEach((n) => { new Image().src = src(n); });
    this.onBetChange();
  }

  filler(c) { const r = Math.random(); return r < P.coin ? COIN : r < P.coin + 0.04 ? SCAT : symbol(c, Math.random); }

  cellArt(v, i) {
    if (v === BLANK) return '';
    if (v === COIN) {
      const val = i >= 0 && this.vals[i] !== undefined ? this.vals[i] : wp(Math.random, P.val), m = (i >= 0 && this.mul[i]) || 1;
      if (typeof val === 'string') return img(val, 'ft-img ft-coin') + `<b class="ft-cv jp">${shortC(this.jp(val))}</b>`;
      return img('coin', 'ft-img ft-coin') + `<b class="ft-cv">${shortC(val * m * this.bet)}</b>${m > 1 ? `<em class="ft-m">×${m}</em>` : ''}`;
    }
    if (v === SCAT) return img('scatter') + '<b class="ft-sc">SCATTER</b>';
    return img(IMG[v]);
  }

  /* ---------- pot and progressive jackpots (per stake) ---------- */
  store() { const all = load(), k = String(this.bet); all[k] = { pot: 0, major: JP.major * this.bet, jackpot: JP.jackpot * this.bet, ...(all[k] || {}) }; return { all, me: all[k] }; }
  jp(kind) { return this.store().me[kind]; }
  setStore(fn) { const { all, me } = this.store(); fn(me); save(all); this.paintTop(); }
  onBetChange() { this.paintTop(true); }
  // MAJOR and JACKPOT climb: the shown amount counts up to the saved one, little by little
  paintTop(now) {
    const me = this.store().me;
    for (const kind of ['major', 'jackpot']) {
      const n = this.q(`[data-jp="${kind}"]`); if (!n) continue;
      const from = now ? me[kind] : +n.dataset.v || me[kind], to = me[kind];
      n.dataset.v = to;
      if (now || from >= to) { n.textContent = fmtC(to); continue; }
      const t0 = performance.now(), T = 1400;
      const step = (ts) => { if (this.dead || +n.dataset.v !== to) return; const p = Math.min(1, (ts - t0) / T); n.textContent = fmtC(from + (to - from) * p); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
    const potEl = this.q('.ft-pot'), heap = this.q('.ft-heap');
    if (potEl) potEl.textContent = me.pot > 0 ? fmtC(me.pot) : '';
    if (heap) { const h = heapSVG(me.pot / this.bet); if (heap.dataset.h !== h) { heap.dataset.h = h; heap.innerHTML = h; } }
  }

  word(t, cls = '') {
    const w = this.q('.ft-word');
    w.textContent = t; w.className = `ft-word ${cls}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.25 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%,-62%) scale(1.15)' }], { duration: this.turbo ? 800 : 1300, easing: 'ease-out' });
  }

  // A coin (cell i) flies up into the bowl.
  async flyToBowl(i, delay = 0) {
    const from = this.reels.cell(i), to = this.q('.ft-bowl');
    if (!from || !to) return;
    const r1 = from.getBoundingClientRect(), r2 = to.getBoundingClientRect();
    const f = el('div', 'ft-fly', img('coin', 'ft-img'));
    const s = Math.min(r1.width, r1.height) * 0.8;
    f.style.cssText = `left:${r1.left + (r1.width - s) / 2}px;top:${r1.top + (r1.height - s) / 2}px;width:${s}px;height:${s}px`;
    document.body.appendChild(f);
    await sleep(delay);
    const dx = r2.left + r2.width / 2 - (r1.left + r1.width / 2), dy = r2.top + r2.height * 0.35 - (r1.top + r1.height / 2);
    await f.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx * 0.4}px, ${dy * 0.55 - 60}px) rotate(200deg) scale(.9)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) rotate(400deg) scale(.35)`, opacity: 0.6 }], { duration: this.turbo ? 520 : 820, easing: 'cubic-bezier(.4,0,.6,1)' }).finished;
    f.remove();
    sfx.coin();
    const p = center(to); fx.burst(p.x, p.y, 10, GOLD, 5);
  }

  onMain() { this.round(() => this.playRound(null)); }
  async onBuy(kind) { await this.playRound(kind); }

  async playRound(buy) {
    const b = this.bet;
    if (!buy && !this.pay(b)) return;
    this.lastStake = b;
    this.setLast(0); this.winAmt.textContent = ''; this.setBanner('');
    // every paid spin feeds MAJOR and JACKPOT
    if (!buy) this.setStore((me) => { me.major += b * PROG.major; me.jackpot += b * PROG.jackpot; });
    let total = 0;
    if (buy) {
      const start = startCoins(6);
      this.vals = start; this.mul = {};
      this.reels.setAll(Array.from({ length: N }, (_, i) => (i in start ? COIN : BLANK)));
      total = await this.bonus(start, buy === 'mega');
    } else {
      const res = spin();
      this.vals = res.vals; this.mul = {};
      await this.reels.spin(res.g, {
        tease: (c, vals) => { let k = 0, m = 0; for (let j = 0; j < c * ROWS; j++) { if (vals[j] === SCAT) k++; if (vals[j] === COIN) m++; } return k >= 3 || m >= 4; },
        onStop: (c) => { for (let r = 0; r < ROWS; r++) { const v = res.g[c * ROWS + r]; if (v === COIN || v === SCAT) { sfx.land(); const p = center(this.reels.cell(c * ROWS + r)); fx.burst(p.x, p.y, 8, GOLD, 4); } } },
      });
      if (this.dead) return;
      if (res.wins.length) {
        const cells = new Set(); res.wins.forEach((w) => w.cells.forEach((i) => cells.add(i)));
        this.reels.mark([...cells]);
        const w = Math.round(res.base * b);
        this.msg(res.wins.map((x) => `${x.n} × ${NAMES[x.s]}${x.ways > 1 ? ` (${x.ways} façons)` : ''} : +${fmtC(Math.round(x.x * b))}`).join(' · '));
        this.win(w); total += w; this.setLast(total); this.winAmt.textContent = fmtC(total);
        sfx.win();
        await this.wait(res.hold || res.mega ? 1100 : 600);
        this.reels.unmark();
      }
      if (res.mega || res.hold) {
        this.stopAuto();
        let start = Object.fromEntries(res.coins.map((i) => [i, res.vals[i]]));
        if (res.mega) {
          this.word('MÉGA BONUS !', 'mega'); this.flash('rgba(253,224,71,.7)'); sfx.jackpot();
          await this.wait(1100);
          if (Object.keys(start).length < 6) start = { ...startCoins(6), ...start };
        } else { this.word(`${res.coins.length} PIÈCES !`, 'hold'); await this.wait(900); }
        total += await this.bonus(start, res.mega);
      } else if (res.coins.length) {
        // fewer than 6 coins: they go up into the pot
        this.msg(`${res.coins.length} pièce${res.coins.length > 1 ? 's' : ''} d’or montent dans le tas : +${fmtC(res.pot * b)}`);
        await Promise.all(res.coins.map((i, k) => this.flyToBowl(i, k * 90)));
        this.setStore((me) => { me.pot += res.pot * b; });
        const bowl = this.q('.ft-bowl'); bowl.classList.remove('grow'); void bowl.offsetWidth; bowl.classList.add('grow');
        if (total > 0) await this.celebrate(total);
      } else if (total > 0) await this.celebrate(total);
    }
    this.setLast(total);
    this.msg(total >= b * CAPX ? `GAIN MAXIMUM ! ${fmtC(total)}` : total > 0 ? `Total du tour : ${fmtC(total)}` : 'Pas de gain');
  }

  /* ---------- HOLD & SPIN / MÉGA BONUS ---------- */
  async bonus(start, mega) {
    const b = this.bet, cap = b * CAPX, run = holdRun(start, mega);
    await this.featureIntro(mega ? 'MÉGA BONUS' : 'HOLD & SPIN', mega ? 'Chaque pièce vaut ×2 à ×5 · les lignes ×2 et ×5 s’allument plus souvent · 3 respins' : `${Object.keys(start).length} pièces d’or verrouillées · 3 respins, remis à 3 à chaque nouvelle pièce`, img(mega ? 'scatter' : 'coin', 'ft-intro'));
    if (this.dead) return 0;
    this.slotEl.classList.add('ft-hold'); this.slotEl.classList.toggle('ft-mega', !!mega);
    // the start: only the coins stay
    this.vals = {}; this.mul = {};
    for (const i in run.start) { this.vals[i] = run.start[i]; }
    // the first multipliers (Méga) were drawn by holdRun: show them when the coins lock
    const firstMul = {};
    for (const i in run.start) firstMul[i] = mega ? this.startMul(run, +i) : 1;
    for (let i = 0; i < N; i++) this.reels.set(i, i in this.vals ? COIN : BLANK);
    for (const i in firstMul) if (firstMul[i] > 1) { this.mul[i] = firstMul[i]; this.reels.set(+i, COIN); this.pop(+i); await this.wait(160); }
    let shown = this.sumNow(b);
    const banner = (left) => this.setBanner(`<b>${mega ? 'MÉGA BONUS' : 'HOLD & SPIN'}</b><span class="pill">Respins ${left}</span><span class="pill gold">${fmtC(Math.round(Math.min(shown, cap)))}</span>`);
    banner(3);
    await this.wait(600);
    for (const st of run.steps) {
      if (this.dead) return 0;
      // empty cells shimmer, then the new coins drop in
      this.reels.el.classList.add('ft-rolling'); sfx.spin?.();
      await this.wait(this.turbo ? 380 : 700);
      this.reels.el.classList.remove('ft-rolling');
      for (const a of st.add) {
        this.vals[a.i] = a.v; this.mul[a.i] = a.m;
        this.reels.set(a.i, COIN);
        const n = this.reels.cell(a.i);
        n?.animate([{ transform: 'translateY(-120%) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.3,1.5,.5,1)' });
        sfx.coin(); const p = center(n); fx.burst(p.x, p.y, 14, GOLD, 6);
        if (typeof a.v === 'string') { this.word(a.v === 'jackpot' ? 'JACKPOT !' : 'MAJOR !', a.v); this.flash(a.v === 'jackpot' ? 'rgba(239,68,68,.6)' : 'rgba(34,197,94,.5)'); sfx.jackpot(); this.q(`.ft-jp.${a.v}`)?.classList.add('hot'); await this.wait(900); }
        await this.wait(this.turbo ? 90 : 180);
      }
      if (st.light) await this.lightRow(st.light);
      shown = this.sumNow(b);
      banner(st.left);
      if (st.add.length) this.msg(`${st.add.length} nouvelle${st.add.length > 1 ? 's' : ''} pièce${st.add.length > 1 ? 's' : ''} : les respins repartent à 3 !`);
      else this.msg(st.left ? `Pas de nouvelle pièce · encore ${st.left} respin${st.left > 1 ? 's' : ''}` : 'Dernier respin terminé');
      await this.wait(this.turbo ? 250 : 450);
    }
    // the count: every coin lights up, MAJOR / JACKPOT pay their progressive pot
    let tot = 0;
    const jps = [];
    for (let i = 0; i < N; i++) {
      if (!(i in this.vals)) continue;
      const v = this.vals[i];
      let amt;
      if (typeof v === 'string') { amt = this.jp(v); jps.push(v); this.setStore((me) => { me[v] = JP[v] * b; }); } else amt = v * (this.mul[i] || 1) * b;
      tot += amt;
      this.reels.cell(i)?.classList.add('counted');
      this.winAmt.textContent = fmtC(Math.round(Math.min(tot, cap)));
      sfx.tick();
      await this.wait(this.turbo ? 50 : 110);
    }
    if (run.full) { this.word('ÉCRAN PLEIN !', 'mega'); fx.confetti(80); await this.wait(900); }
    tot = Math.min(Math.round(tot), cap);
    // the pot of this stake is paid with the bonus
    const pot = Math.round(this.store().me.pot);
    if (pot > 0) {
      this.word('LE TAS DE PIÈCES !', 'pot');
      const bowl = this.q('.ft-bowl'); bowl.classList.add('pour');
      const p = center(bowl); fx.burst(p.x, p.y, 40, GOLD, 9); sfx.bigWin();
      this.msg(`Le tas de pièces est à toi : +${fmtC(pot)}`);
      this.setStore((me) => { me.pot = 0; });
      await this.wait(1300);
      bowl.classList.remove('pour');
    }
    const won = Math.min(tot + pot, cap);
    if (won > 0) this.win(won, mega ? 'Méga Bonus' : 'Hold & Spin');
    this.setBanner('');
    this.slotEl.classList.remove('ft-hold', 'ft-mega');
    this.qa('.ft-jp.hot').forEach((n) => n.classList.remove('hot'));
    this.msg(`${mega ? 'MÉGA BONUS' : 'HOLD & SPIN'} : ${fmtC(tot)}${pot ? ` + le tas ${fmtC(pot)}` : ''}${jps.length ? ` · ${jps.map((j) => (j === 'jackpot' ? 'JACKPOT' : 'MAJOR')).join(' + ')} !` : ''}`);
    await this.celebrate(won, { summary: mega ? 'MÉGA BONUS' : 'HOLD & SPIN', stake: b });
    this.vals = {}; this.mul = {};
    return won;
  }

  startMul(run, i) { return run.mul[i] ? this.firstOf(run, i) : 1; }
  // The multiplier a starting coin had before any row lit up (rows multiply on top of it).
  firstOf(run, i) {
    let m = run.mul[i];
    for (const st of run.steps) if (st.light && st.light.hit.includes(i)) m /= st.light.x;
    return Math.round(m);
  }

  sumNow(b) { let t = 0; for (const i in this.vals) { const v = this.vals[i]; t += typeof v === 'string' ? this.jp(v) : v * (this.mul[i] || 1) * b; } return t; }
  pop(i) { const n = this.reels.cell(i); n?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 360, easing: 'ease-out' }); }

  // A whole row lights up: its coins are multiplied ×2 or ×5 (nothing happens if the row is empty).
  async lightRow({ row, x, hit }) {
    const band = this.q(`.ft-rows [data-row="${row}"]`);
    band.textContent = `×${x}`; band.className = `on x${x}`;
    this.flash(x === 5 ? 'rgba(253,224,71,.55)' : 'rgba(255,255,255,.35)');
    sfx.upgrade();
    await this.wait(this.turbo ? 350 : 650);
    if (!hit.length) this.msg(`La ligne ${row + 1} s’allume ×${x}… mais elle est vide !`);
    else {
      this.msg(`La ligne ${row + 1} s’allume : ${hit.length} pièce${hit.length > 1 ? 's' : ''} ×${x} !`);
      for (const i of hit) { this.mul[i] = (this.mul[i] || 1) * x; this.reels.set(i, COIN); this.pop(i); const p = center(this.reels.cell(i)); fx.burst(p.x, p.y, 16, GOLD, 7); sfx.coin(); await this.wait(this.turbo ? 80 : 150); }
    }
    await this.wait(this.turbo ? 250 : 500);
    band.className = ''; band.textContent = '';
  }

  info() {
    const rows = NAMES.map((nm, s) => `<div class="pay-item"><div class="pay-sym ft-pay">${img(IMG[s])}</div><div class="pay-vals"><b>${nm}</b><br><span>3 : ×${shortX(P.pays[s][0] * P.K)} · 4 : ×${shortX(P.pays[s][1] * P.K)} · 5 : ×${shortX(P.pays[s][2] * P.K)} (par façon)</span></div></div>`).join('');
    return this.rules(`<h4>Symboles (× la mise, par façon)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym ft-pay">${img('wild')}</div><div class="pay-vals"><b>Dragon d’or WILD</b><br><span>Rouleaux 2 à 4, remplace tous les symboles</span></div></div></div>
      <h4>243 façons de gagner</h4><p>Un symbole paie dès qu’il apparaît sur 3 rouleaux d’affilée ou plus depuis la gauche, à n’importe quelle hauteur.</p>
      <h4>Pièces d’or et tas de pièces</h4><p>Chaque pièce d’or porte un gain (×0,5 à ×50 la mise). Avec <b>moins de 6 pièces</b>, elles s’envolent dans le bol en haut : le <b>tas de pièces</b> grandit à chaque fois. Il est gardé pour chaque mise et il est <b>gagné en entier avec le prochain bonus</b> joué à cette mise.</p>
      <h4>HOLD & SPIN</h4><p><b>6 pièces ou plus</b> : elles restent en place et tu as 3 respins. Chaque nouvelle pièce reste et remet les respins à 3. Pendant le bonus tombent aussi des pièces <b>MAJOR</b> (verte) et <b>JACKPOT</b> (rouge). Parfois, <b>toute une ligne s’allume ×2 ou ×5</b> : les pièces de cette ligne sont multipliées, et si elle est vide… elle s’est allumée pour rien !</p>
      <h4>MAJOR et JACKPOT progressifs</h4><p>Ils grimpent à chaque spin (départ ×${JP.major} et ×${JP.jackpot} la mise). Une pièce MAJOR ou JACKPOT paie le montant affiché, qui repart ensuite à sa valeur de départ. Un montant par mise.</p>
      <h4>MÉGA BONUS</h4><p><b>4 SCATTERS</b> (rare !) : un Hold & Spin avec au moins 6 pièces, où <b>chaque pièce vaut ×2 à ×5</b> et où les lignes ×2 / ×5 s’allument bien plus souvent.</p>
      <h4>Achats</h4><p>Hold & Spin ×${BUY_HOLD} · MÉGA BONUS ×${BUY_MEGA}. Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}
const shortX = (m) => String(Math.round(m * 100) / 100).replace('.', ',');

return { FortuneGame };
})();
