// SpinBet Casino · NoelGame (La Tournée du Père Noël) — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/noel.js ----
__mods['games/impl/noel.js'] = (() => {
// La Tournée du Père Noël: a tall 5×7 machine (16 807 ways) over the owner's video of a snowy plain at sunset, with
// the owner's Christmas symbols. 3 letters to Santa: LA TOURNÉE, free spins at night where the sleigh WILD lands and
// climbs to the top of its column (×2 where it lands, +1 per cell, ×8 from the bottom; multipliers multiply).
// 6 snow globes: BOULES DE NEIGE (they stay, 3 respins; elf ×2, Santa collects, MINI, MAXI, GRAND for a full grid).
// Tuned by simulation (12 million spins): RTP ≈ 92 % (ways 52,5 %, free spins 25,5 %, globes 13,7 %), buys ≈ 88 %.

const { BaseGame, fmtC, shortC } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
// 5 reels × 7 rows, 16 807 ways (a symbol pays on 3+ reels side by side from the left, at any height).
// Symbols 0-4: cards 10 J Q K A; 5-8: sucre d'orge, boule, chaussette, houx; 9-11: cloche, bonhomme de neige, renne;
// 12-13: lutin, Père Noël. 14 = sleigh WILD (reels 2-5), 15 = letter SCATTER (one per reel at most), 16 = magic snow
// globe (carries a value), 17 = empty cell of the snow-globe bonus.
// FREE SPINS (3+ letters: 10 / 12 / 15, 3 letters again +5): on reels 2-5 the sleigh WILD lands on a cell and climbs
// to the top, filling the column above it: ×2 where it lands, +1 for every cell climbed (×8 from the bottom row).
// A win multiplies the multipliers of every wild column it goes through. A wild landed on the bottom row (×8) stays
// one more free spin.
// SNOW GLOBES (6+ globes): they stay, 3 respins, every new globe puts them back to 3. Globes carry ×1 to ×50 the bet,
// MINI ×20 or MAXI ×100; the elf globe doubles every globe on screen, Santa's globe takes the total of all of them.
// The whole grid (35 globes): GRAND ×1 000 on top.
const COLS = 5, ROWS = 7, N = 35, NS = 14, WILD = 14, SCAT = 15, GLOBE = 16, BLANK = 17, CAPX = 5000;
const FS_COUNT = { 3: 10, 4: 12, 5: 15 }, FS_RETRIG = 5;
const JPX = { mini: 20, maxi: 100, grand: 1000 };
const P = {
  w: [30, 30, 29, 28, 27, 22, 21, 20, 19, 14, 13, 12, 8, 6], wild: 2.2, scat: 0.0565, globe: 0.0402, stack: 0.4,
  pays: [[0.1, 0.2, 0.5], [0.1, 0.2, 0.5], [0.1, 0.25, 0.6], [0.12, 0.3, 0.75], [0.15, 0.35, 0.9], [0.2, 0.5, 1.2], [0.2, 0.5, 1.2], [0.25, 0.6, 1.5], [0.25, 0.6, 1.5],
    [0.4, 1, 2.5], [0.5, 1.2, 3], [0.6, 1.5, 4], [1, 2.5, 8], [1.5, 4, 12]],
  K: 0.37,
  // free spins: chance per reel (2-5) that a climbing wild lands, and the landing row (top → bottom)
  fsWild: 0.09, fsRow: [24, 20, 17, 14, 11, 8, 6], fsK: 0.4,
  // globes: values (× the bet) in the base game and in the bonus, what lands in the bonus, chance per empty cell
  val: [[1, 30], [2, 26], [3, 16], [5, 12], [8, 7], [10, 5], [15, 2.5], [25, 1.2], [50, 0.4]],
  land: [['v', 88], ['mini', 5], ['maxi', 1], ['elf', 3.2], ['santa', 2.4]],
  hp: 0.018,
};
function wp(R, l) { let t = 0; for (const x of l) t += x[1]; let q = R() * t; for (const x of l) { if (q < x[1]) return x[0]; q -= x[1]; } return l[l.length - 1][0]; }
function symbol(c, R, wild = true) {
  const ws = wild && c >= 1 ? P.wild : 0;
  let t = ws; for (const x of P.w) t += x;
  let q = R() * t;
  if (q < ws) return WILD; q -= ws;
  for (let i = 0; i < NS; i++) { if (q < P.w[i]) return i; q -= P.w[i]; }
  return 0;
}
// A screen: at most one letter per reel; globes (base game only) carry a value.
function screen(R, free) {
  const g = [], vals = {};
  for (let c = 0; c < COLS; c++) {
    const sr = R() < P.scat * (free ? 0.7 : 1) ? Math.floor(R() * ROWS) : -1;
    for (let r = 0; r < ROWS; r++) {
      const i = c * ROWS + r;
      if (r === sr) g[i] = SCAT;
      else if (!free && R() < P.globe) { g[i] = GLOBE; vals[i] = R() < 0.04 ? 'mini' : wp(R, P.val); }
      else if (r && g[i - 1] < NS && R() < P.stack) g[i] = g[i - 1]; // symbols come in stacks
      else g[i] = symbol(c, R, !free);
    }
  }
  return { g, vals };
}
// Ways: mul[c] = multiplier of a wild column (free spins), the win multiplies the ones it goes through.
function ways(g, mul = null, k = 1) {
  const wins = [];
  for (let s = 0; s < NS; s++) {
    let n = 0, w = 1, m = 1; const cells = [];
    for (let c = 0; c < COLS; c++) {
      let q = 0;
      for (let r = 0; r < ROWS; r++) { const v = g[c * ROWS + r]; if (v === s || v === WILD) { q++; cells.push(c * ROWS + r); } }
      if (!q) break; n++; w *= q;
      if (mul && mul[c] > 1) m *= mul[c];
    }
    if (n >= 3) wins.push({ s, n, ways: w, m, x: P.pays[s][n - 3] * P.K * k * w * m, cells: cells.filter((i) => Math.floor(i / ROWS) < n) });
  }
  return wins;
}
const scats = (g) => g.filter((v) => v === SCAT).length;
function spin(R = Math.random) {
  const { g, vals } = screen(R, false), wins = ways(g);
  const x = wins.reduce((a, w) => a + w.x, 0), sc = scats(g), globes = Object.keys(vals).map(Number);
  return { g, vals, wins, x, scat: sc, fs: sc >= 3 ? FS_COUNT[Math.min(5, sc)] : 0, globes, hold: globes.length >= 6 };
}
// One free spin. keep = { reel: true } for the wilds landed on the bottom row last spin (they stay ×8).
// Returns the screen, the climbing wilds [{ c, r, m, kept }] and the wins.
function freeSpin(keep, R = Math.random) {
  const { g } = screen(R, true);
  const wl = [];
  for (let c = 1; c < COLS; c++) {
    let r = -1, kept = false;
    if (keep[c]) { r = ROWS - 1; kept = true; }
    if (R() < P.fsWild) { const nr = wp(R, P.fsRow.map((w, i) => [i, w])); if (nr > r) { r = nr; kept = false; } }
    if (r < 0) continue;
    const top = [];
    for (let k = r; k >= 0; k--) top.push(c * ROWS + k);
    wl.push({ c, r, m: 2 + r, kept, cells: top });
  }
  const g2 = g.slice(), mul = {};
  for (const w of wl) { w.under = w.cells.map((i) => g[i]); w.cells.forEach((i) => { g2[i] = WILD; }); mul[w.c] = w.m; }
  const wins = ways(g2, mul, P.fsK);
  return { g, g2, wl, mul, wins, x: wins.reduce((a, w) => a + w.x, 0), scat: scats(g2) };
}
// The whole free-spins bonus: list of spins and total (× the bet, before the cap).
function freeRun(count, R = Math.random) {
  const spins = [];
  let left = count, keep = {}, total = 0, guard = 0;
  while (left > 0 && guard++ < 300) {
    left--;
    const s = freeSpin(keep, R);
    keep = {}; s.wl.forEach((w) => { if (w.r === ROWS - 1 && !w.kept) keep[w.c] = true; });
    if (s.scat >= 3) { left += FS_RETRIG; s.re = FS_RETRIG; }
    s.left = left; total += s.x; s.total = total;
    spins.push(s);
  }
  return { spins, total };
}
// The snow-globe bonus from the starting globes { cell: value }.
// cur[cell] = number (× the bet) | 'mini' | 'maxi'; steps = [{ add: [{ i, t, v }], left }]
const gv = (v) => (typeof v === 'number' ? v : JPX[v]);
function holdRun(start, R = Math.random) {
  const cur = { ...start }, steps = [];
  let left = 3, guard = 0;
  while (left > 0 && Object.keys(cur).length < N && guard++ < 300) {
    const add = [];
    for (let i = 0; i < N; i++) {
      if (i in cur || R() >= P.hp) continue;
      const t = wp(R, P.land);
      if (t === 'v') { cur[i] = wp(R, P.val); add.push({ i, t, v: cur[i] }); }
      else if (t === 'mini' || t === 'maxi') { cur[i] = t; add.push({ i, t, v: t }); }
      else if (t === 'elf') { // doubles every number globe on screen, then it is worth ×1
        for (const j in cur) if (typeof cur[j] === 'number') cur[j] *= 2;
        cur[i] = 1; add.push({ i, t, v: 1 });
      } else { // santa: takes the total of every globe on screen
        let s = 0; for (const j in cur) s += gv(cur[j]);
        cur[i] = Math.max(1, s); add.push({ i, t, v: cur[i] });
      }
    }
    left = add.length ? 3 : left - 1;
    steps.push({ add, left, snap: { ...cur } });
  }
  const full = Object.keys(cur).length === N;
  let total = 0; for (const j in cur) total += gv(cur[j]);
  if (full) total += JPX.grand;
  return { start: { ...start }, steps, cur, total, full };
}
function startGlobes(n = 6, R = Math.random) {
  const cells = [...Array(N).keys()];
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const o = {}; cells.slice(0, n).forEach((i) => { o[i] = wp(R, P.val); });
  return o;
}
/* ===END ENGINE */

const BUY_FS = 168, BUY_HOLD = 60;
const IMG_V = 1;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images and video are inlined
const src = (n) => asset(`assets/games/noel/${n}.webp`);
const img = (n, cls = 'nl-img') => `<img class="${cls}" src="${src(n)}" alt="" draggable="false" decoding="async">`;
const CARDS = ['10', 'J', 'Q', 'K', 'A'];
const NAMES = ['10', 'Valet', 'Dame', 'Roi', 'As', 'Sucre d’orge', 'Boule de Noël', 'Chaussette', 'Houx', 'Cloche dorée', 'Bonhomme de neige', 'Renne', 'Lutin', 'Père Noël'];
const SNOW = ['#ffffff', '#dbeafe', '#bfdbfe', '#fde68a'];
const GOLD = ['#fde047', '#facc15', '#fff7d6', '#f59e0b'];
const xs = (m) => (m >= 100 ? Math.round(m).toLocaleString('fr-FR') : String(Math.round(m * 100) / 100).replace('.', ','));
// card symbols: Christmas baubles (red, green, blue, purple, gold) with a white letter
const CARD_COL = [['#93c5fd', '#1d4ed8'], ['#86efac', '#15803d'], ['#c4b5fd', '#6d28d9'], ['#fca5a5', '#b91c1c'], ['#fde68a', '#b45309']];
const cardSVG = (v) => { const [a, b] = CARD_COL[v]; return `<svg class="nl-card" viewBox="0 0 100 100" aria-hidden="true"><defs>
  <radialGradient id="nlB${v}" cx=".38" cy=".34" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".18" stop-color="${a}"/><stop offset=".75" stop-color="${b}"/><stop offset="1" stop-color="#0b1020"/></radialGradient>
  <linearGradient id="nlC" x1="0" x2="1"><stop offset="0" stop-color="#7c5a12"/><stop offset=".45" stop-color="#fff3b0"/><stop offset="1" stop-color="#8a6414"/></linearGradient></defs>
  <rect x="40" y="4" width="20" height="13" rx="3" fill="url(#nlC)"/><circle cx="50" cy="5" r="4" fill="none" stroke="url(#nlC)" stroke-width="2.5"/>
  <circle cx="50" cy="57" r="40" fill="url(#nlB${v})"/>
  <path d="M18 50 Q50 40 82 50" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round"/>
  <ellipse cx="36" cy="38" rx="11" ry="6" fill="#fff" opacity=".45" transform="rotate(-30 36 38)"/>
  <text x="50" y="${v === 0 ? 70 : 73}" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="900" font-size="${v === 0 ? 34 : 42}" fill="#fff" stroke="#0b1020" stroke-width="3" paint-order="stroke">${CARDS[v]}</text>
</svg>`; };

class NoelGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.noel, cls: 'nl-slot',
      stage: `<div class="nl-reels"><div class="nl-cap" aria-hidden="true"></div><div class="reels-host"></div></div><div class="nl-word"></div>`,
      buys: [
        { id: 'fs', icon: '🛷', label: 'La Tournée · 10 tours gratuits', desc: 'Le traîneau WILD monte dans sa colonne : ×2 à ×8, et les multiplicateurs se multiplient', cost: (b) => b * BUY_FS },
        { id: 'hold', icon: '❄️', label: 'Boules de neige · 6 boules', desc: '6 boules de neige qui restent, 3 relances · lutin ×2, Père Noël qui ramasse tout, MINI, MAXI et GRAND', cost: (b) => b * BUY_HOLD },
      ],
      hello: ' ',
    });
    // the moving snowy plain behind the whole machine, a snowfall and the northern lights of the bonus
    const bg = this.q('.slot-bg');
    bg.innerHTML = `<video class="nl-video" src="${asset('assets/games/noel/bg.mp4')}" poster="${src('bg')}" muted autoplay loop playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video>
      <div class="nl-aurora" aria-hidden="true"><i></i><i></i><i></i></div><div class="nl-shade"></div>
      <div class="nl-snow" aria-hidden="true">${Array.from({ length: 36 }, (_, k) => `<i style="left:${(k * 37) % 100}%;--s:${2 + (k % 4)}px;--d:${7 + (k % 6) * 1.6}s;--x:${((k * 23) % 50) - 25}px;animation-delay:-${(k * 1.7) % 12}s"></i>`).join('')}</div>`;
    this.video = bg.querySelector('video');
    this.video.muted = true;
    const play = () => { if (!this.dead && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.video.play().catch(() => {}); };
    play();
    this.onVis = () => { if (document.hidden) this.video.pause(); else play(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.root.addEventListener('pointerdown', play, { once: true }); // a phone in power-saving mode waits for a touch

    this.gvals = {}; this.gkind = {}; this.under = new Set(); this.cols = {};
    this.reels = new Reels(this.q('.reels-host'), {
      cols: COLS, rows: ROWS, game: this, random: (c) => this.filler(c),
      art: (v, i) => this.cellArt(v, i),
      cls: (v, i) => (v === GLOBE ? `globe${this.gkind[i] ? ` ${this.gkind[i]}` : ''}` : v === SCAT ? 'scat' : v === WILD ? (this.under.has(i) ? 'wild under' : 'wild') : v === BLANK ? 'blank' : v < 5 ? `card c${v}` : `pic p${v}`),
    });
    this.reels.el.classList.add('nl-rs');
    this.reels.setAll(screen(Math.random, false).g);
    ['wild', 'scat', 'globe', 's7', 's8'].forEach((n) => { new Image().src = src(n); });
  }

  destroy() { document.removeEventListener('visibilitychange', this.onVis); this.video?.pause(); super.destroy(); }

  filler(c) { const r = Math.random(); return r < 0.03 ? GLOBE : r < 0.045 ? SCAT : symbol(c, Math.random, !this.inFree); }

  cellArt(v, i) {
    if (v === BLANK) return '<i class="nl-frost"></i>';
    if (v === WILD) return this.under.has(i) ? '' : `${img('wild')}<b class="nl-wild">WILD</b>`;
    if (v === SCAT) return `${img('scat')}<b class="nl-bonus">BONUS</b>`;
    if (v === GLOBE) {
      const val = i >= 0 && this.gvals[i] !== undefined ? this.gvals[i] : wp(Math.random, P.val), k = i >= 0 ? this.gkind[i] : null;
      const lab = typeof val === 'string' ? val.toUpperCase() : shortC(val * this.bet);
      return `${img('globe')}${k ? img(k === 'elf' ? 's7' : 's8', 'nl-gk') : ''}<b class="nl-gv${typeof val === 'string' ? ` jp ${val}` : ''}">${lab}</b>`;
    }
    return v < 5 ? cardSVG(v) : img(`s${v - 5}`);
  }

  word(t, cls = '') {
    const w = this.q('.nl-word');
    w.textContent = t; w.className = `nl-word ${cls}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.25 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%,-62%) scale(1.15)' }], { duration: this.turbo ? 800 : 1400, easing: 'ease-out' });
  }

  winMsg(wins, b) {
    const top = wins.slice().sort((p, q) => q.x - p.x);
    const t = top.slice(0, 3).map((w) => `${w.n} × ${NAMES[w.s]}${w.ways > 1 ? ` (${w.ways} façons)` : ''}${w.m > 1 ? ` <b class="nl-x">×${xs(w.m)}</b>` : ''} : +${fmtC(Math.round(w.x * b))}`).join(' · ');
    return top.length > 3 ? `${t} · +${top.length - 3} autre${top.length > 4 ? 's' : ''}` : t;
  }

  onMain() { this.round(() => this.playRound(null)); }
  async onBuy(kind) { await this.playRound(kind); }

  async playRound(buy) {
    const b = this.bet, cap = b * CAPX;
    if (!buy && !this.pay(b)) return;
    this.lastStake = b;
    this.setLast(0); this.winAmt.textContent = ''; this.setBanner('');
    let total = 0;
    if (buy === 'fs') total = await this.freeSpins(10, b, cap);
    else if (buy === 'hold') total = await this.snow(startGlobes(6), b, cap);
    else {
      const res = spin();
      this.gvals = res.vals; this.gkind = {};
      await this.reels.spin(res.g, {
        tease: (c, vals) => { let k = 0, m = 0; for (let j = 0; j < c * ROWS; j++) { if (vals[j] === SCAT) k++; if (vals[j] === GLOBE) m++; } return k >= 2 || m >= 4; },
        onStop: (c) => { for (let r = 0; r < ROWS; r++) { const v = res.g[c * ROWS + r]; if (v === SCAT || v === GLOBE) { sfx.land(); const p = center(this.reels.cell(c * ROWS + r)); fx.burst(p.x, p.y, 10, v === SCAT ? ['#ef4444', '#fde68a', '#fff'] : SNOW, 4); } } },
      });
      if (this.dead) return;
      total = Math.min(Math.round(res.x * b), cap);
      if (res.wins.length) {
        this.reels.mark([...new Set(res.wins.flatMap((w) => w.cells))]);
        this.msg(this.winMsg(res.wins, b));
        this.win(total); this.setLast(total); this.winAmt.textContent = fmtC(total);
      } else this.msg(res.scat === 2 ? 'Deux lettres au Père Noël… il en fallait une de plus !' : res.globes.length >= 4 ? `${res.globes.length} boules de neige… il en faut 6 !` : 'Pas de gain');
      if (res.fs || res.hold) {
        this.stopAuto();
        if (total > 0) { sfx.win(); await this.wait(900); }
        this.reels.unmark();
        if (res.fs) {
          this.reels.mark(res.g.map((v, i) => (v === SCAT ? i : -1)).filter((i) => i >= 0), 'win');
          this.word('LA TOURNÉE !', 'fs'); sfx.feature(); await this.wait(1300);
          this.reels.unmark();
          total += await this.freeSpins(res.fs, b, cap - total);
        }
        if (res.hold && total < cap) {
          this.gvals = res.vals;
          this.reels.mark(res.globes, 'win');
          this.word(`${res.globes.length} BOULES DE NEIGE !`, 'hold'); sfx.feature(); await this.wait(1300);
          this.reels.unmark();
          total += await this.snow(Object.fromEntries(res.globes.map((i) => [i, res.vals[i]])), b, cap - total);
        }
      } else if (total > 0) await this.celebrate(total);
      this.reels.unmark();
    }
    this.setLast(total);
    this.msg(total >= cap ? `GAIN MAXIMUM ! ${fmtC(total)}` : total > 0 ? `Total du tour : ${fmtC(total)}` : this.msgEl.innerHTML);
  }

  /* ---------- LA TOURNÉE (free spins with the climbing sleigh) ---------- */
  night(on) {
    this.slotEl.classList.toggle('nl-night', on);
    this.inFree = on;
    try { this.video.playbackRate = on ? 1.7 : 1; } catch { /* ignore */ }
  }

  async freeSpins(count, b, capLeft) {
    await this.featureIntro('LA TOURNÉE', `${count} tours gratuits · le traîneau WILD tombe et monte jusqu’en haut de sa colonne : ×2 là où il tombe, +1 à chaque case, jusqu’à ×8 · les multiplicateurs se multiplient`, img('wild', 'nl-intro'));
    if (this.dead) return 0;
    this.night(true);
    this.focusStage?.();
    const run = freeRun(count);
    let sum = 0, done = 0, max = count, capped = false;
    const banner = () => this.setBanner(`<b>LA TOURNÉE</b><span class="pill">Tour ${done} / ${max}</span><span class="pill gold">${fmtC(Math.round(Math.min(sum, capLeft)))}</span>`);
    banner();
    this.msg('Le traîneau du Père Noël s’envole…');
    for (const s of run.spins) {
      if (this.dead) return 0;
      done++; banner();
      // the sleigh kept from the last spin stays in place while the reels turn
      const keep = new Set(s.wl.filter((w) => w.kept).map((w) => w.c));
      Object.keys(this.cols).forEach((c) => { if (!keep.has(+c)) this.dropCol(+c); });
      this.under = new Set();
      s.wl.filter((w) => w.kept).forEach((w) => w.cells.forEach((i) => this.under.add(i)));
      const g = s.g.slice(); s.wl.filter((w) => w.kept).forEach((w) => w.cells.forEach((i) => { g[i] = WILD; }));
      await this.reels.spin(g, {
        tease: (c, vals) => { let k = 0; for (let j = 0; j < c * ROWS; j++) if (vals[j] === SCAT) k++; return k >= 2; },
        onStop: (c) => { for (let r = 0; r < ROWS; r++) if (g[c * ROWS + r] === SCAT) sfx.land(); },
      });
      if (this.dead) return 0;
      for (const w of s.wl) {
        if (w.kept) { this.cols[w.c]?.classList.remove('held'); continue; }
        await this.climb(w);
      }
      const won = Math.round(s.x * b);
      if (s.wins.length) {
        this.reels.mark([...new Set(s.wins.flatMap((w) => w.cells))]);
        s.wl.forEach((w) => { if (s.wins.some((x) => x.n > w.c)) this.cols[w.c]?.classList.add('win'); });
        this.msg(this.winMsg(s.wins, b));
        sum += won;
        this.winAmt.textContent = fmtC(Math.round(Math.min(sum, capLeft)));
        const best = Math.max(...s.wins.map((x) => x.m));
        if (best >= 16) { this.word(`×${xs(best)} !`, 'mult'); this.flash('rgba(253,224,71,.45)'); sfx.bigWin(); }
        else sfx.win();
        banner();
        await this.wait(best >= 16 ? 1500 : 900);
      } else { this.msg(s.wl.length ? 'Le traîneau est passé… sans gain cette fois' : 'Pas de gain'); await this.wait(350); }
      if (s.re) {
        this.reels.mark(s.g2.map((v, i) => (v === SCAT ? i : -1)).filter((i) => i >= 0), 'win');
        max += s.re; banner();
        this.word(`+${s.re} TOURS !`, 'fs'); sfx.feature(); fx.confetti(50);
        await this.wait(1300);
      }
      this.reels.unmark();
      Object.values(this.cols).forEach((n) => n.classList.remove('win'));
      // a sleigh landed on the bottom row stays one more spin
      s.wl.forEach((w) => { if (w.r === ROWS - 1 && !w.kept && this.cols[w.c]) { this.cols[w.c].classList.add('held'); } });
      if (sum >= capLeft) { capped = true; break; }
    }
    Object.keys(this.cols).forEach((c) => this.dropCol(+c));
    this.under = new Set();
    this.night(false);
    this.setBanner('');
    const won = Math.min(sum, capLeft);
    if (won > 0) { this.win(won, 'La Tournée'); this.setLast(won); }
    await this.celebrate(won, { summary: 'LA TOURNÉE', stake: b });
    this.msg(capped ? `GAIN MAXIMUM ! ${fmtC(won)}` : won > 0 ? `La Tournée : ${max} tours, ${fmtC(won)}` : 'La Tournée est finie : pas de gain cette fois');
    return won;
  }

  // The sleigh lands on its cell (×2) and climbs to the top of the column, +1 on every cell.
  async climb(w) {
    const c = w.c, reel = this.reels.reelEls[c], rs = this.reels.el;
    this.dropCol(c);
    const col = document.createElement('div');
    col.className = 'nl-col';
    col.style.left = `${reel.offsetLeft}px`; col.style.width = `${reel.offsetWidth}px`;
    col.style.top = `${(w.r / ROWS) * 100}%`; col.style.bottom = `${((ROWS - 1 - w.r) / ROWS) * 100}%`;
    col.innerHTML = `<i class="nl-trail"></i>${img('wild', 'nl-sleigh')}<b class="nl-m">×2</b>`;
    rs.appendChild(col);
    this.cols[c] = col;
    const m = col.querySelector('.nl-m');
    col.animate([{ transform: 'translateY(-40%) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    sfx.land();
    const p0 = center(reel.firstChild.children[w.r] || reel); fx.burst(p0.x, p0.y, 14, GOLD, 5);
    this.under.add(c * ROWS + w.r); this.reels.set(c * ROWS + w.r, WILD);
    await this.wait(380);
    for (let k = w.r - 1; k >= 0; k--) {
      if (this.dead) return;
      col.style.top = `${(k / ROWS) * 100}%`;
      m.textContent = `×${2 + w.r - k}`;
      m.animate([{ scale: 1.6 }, { scale: 1 }], { duration: 220, easing: 'ease-out' });
      this.under.add(c * ROWS + k); this.reels.set(c * ROWS + k, WILD);
      sfx.tick();
      await this.wait(this.turbo ? 90 : 170);
    }
    m.classList.add('done');
    if (w.m >= 6) { const p = center(col); fx.burst(p.x, p.y, 26, GOLD, 8); sfx.upgrade(); }
    await this.wait(this.turbo ? 120 : 260);
  }

  dropCol(c) {
    const n = this.cols[c]; if (!n) return;
    delete this.cols[c];
    n.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-20%)' }], { duration: 250, easing: 'ease-in' }).finished.then(() => n.remove(), () => n.remove());
  }

  /* ---------- BOULES DE NEIGE (globes that stay) ---------- */
  async snow(start, b, capLeft) {
    await this.featureIntro('BOULES DE NEIGE', `${Object.keys(start).length} boules de neige restent en place · 3 relances, remises à 3 à chaque nouvelle boule · le lutin double tout, le Père Noël ramasse tout · grille pleine : GRAND ×${JPX.grand}`, img('globe', 'nl-intro'));
    if (this.dead) return 0;
    const run = holdRun(start);
    this.slotEl.classList.add('nl-hold');
    this.focusStage?.();
    this.gvals = { ...run.start }; this.gkind = {};
    for (let i = 0; i < N; i++) this.reels.set(i, i in this.gvals ? GLOBE : BLANK);
    const sumNow = () => { let t = 0; for (const j in this.gvals) t += gv(this.gvals[j]); return t; };
    const banner = (left) => this.setBanner(`<b>BOULES DE NEIGE</b><span class="pill">Relances ${left}</span><span class="pill gold">${fmtC(Math.round(Math.min(sumNow() * b, capLeft)))}</span>`);
    banner(3);
    this.msg('Les boules de neige restent : 3 relances');
    await this.wait(700);
    for (const st of run.steps) {
      if (this.dead) return 0;
      await this.respin(st.add, b);
      banner(st.left);
      const nb = `${Object.keys(this.gvals).length} / ${N} boules`;
      this.msg(st.add.length ? `${nb} · ${st.add.length} nouvelle${st.add.length > 1 ? 's' : ''} boule${st.add.length > 1 ? 's' : ''} : les relances repartent à 3 !` : st.left ? `Pas de nouvelle boule · encore ${st.left} relance${st.left > 1 ? 's' : ''}` : 'Dernière relance terminée');
      if (!st.add.length) this.msg(`${nb} · ${this.msgEl.innerHTML}`);
      await this.wait(this.turbo ? 200 : 420);
    }
    // the count, globe by globe
    let tot = 0;
    for (let i = 0; i < N; i++) {
      if (!(i in this.gvals)) continue;
      tot += gv(this.gvals[i]) * b;
      this.reels.cell(i)?.classList.add('counted');
      this.winAmt.textContent = fmtC(Math.round(Math.min(tot, capLeft)));
      sfx.tick();
      await this.wait(this.turbo ? 35 : 80);
    }
    if (run.full) {
      this.word(`GRAND ×${JPX.grand} !`, 'grand'); this.flash('rgba(255,255,255,.8)'); fx.confetti(140); sfx.jackpot();
      tot += JPX.grand * b; this.winAmt.textContent = fmtC(Math.round(Math.min(tot, capLeft)));
      await this.wait(1600);
    }
    const won = Math.min(Math.round(tot), capLeft);
    if (won > 0) { this.win(won, 'Boules de neige'); this.setLast(won); }
    this.setBanner('');
    await this.celebrate(won, { summary: 'BOULES DE NEIGE', stake: b });
    this.slotEl.classList.remove('nl-hold');
    this.msg(`Boules de neige : ${fmtC(won)}${run.full ? ' · GRILLE PLEINE !' : ''}`);
    this.gvals = {}; this.gkind = {};
    this.reels.setAll(screen(Math.random, false).g);
    return won;
  }

  // One respin: the empty cells shimmer, then the new globes drop in, column after column (same order as holdRun).
  async respin(add, b) {
    const empties = [];
    for (let i = 0; i < N; i++) if (!(i in this.gvals)) empties.push(i);
    empties.forEach((i) => this.reels.cell(i)?.classList.add('rolling'));
    sfx.spin?.();
    await this.wait(this.turbo ? 260 : 560);
    empties.forEach((i) => this.reels.cell(i)?.classList.remove('rolling'));
    for (const a of add) {
      if (this.dead) return;
      const n0 = this.reels.cell(a.i);
      if (a.t === 'elf' || a.t === 'santa') {
        this.gkind[a.i] = a.t;
        if (a.t === 'elf') for (const j in this.gvals) if (typeof this.gvals[j] === 'number') this.gvals[j] *= 2;
        this.gvals[a.i] = a.v;
        this.reels.set(a.i, GLOBE);
        this.drop(a.i);
        this.word(a.t === 'elf' ? 'LE LUTIN DOUBLE TOUT !' : 'LE PÈRE NOËL RAMASSE TOUT !', a.t);
        this.flash(a.t === 'elf' ? 'rgba(34,197,94,.45)' : 'rgba(239,68,68,.45)'); sfx.upgrade();
        await this.wait(500);
        for (const j in this.gvals) if (+j !== a.i) { this.reels.set(+j, GLOBE); if (a.t === 'elf') this.pop(+j); }
        if (a.t === 'santa') await this.collect(a.i);
        await this.wait(this.turbo ? 300 : 700);
      } else {
        this.gvals[a.i] = a.v;
        this.reels.set(a.i, GLOBE);
        this.drop(a.i);
        if (typeof a.v === 'string') { this.word(`${a.v.toUpperCase()} ×${JPX[a.v]} !`, a.v); sfx.jackpot(); await this.wait(800); } else sfx.coin();
        const p = center(n0); fx.burst(p.x, p.y, 12, SNOW, 5);
        await this.wait(this.turbo ? 70 : 140);
      }
    }
  }

  drop(i) { this.reels.cell(i)?.animate([{ transform: 'translateY(-70%) scale(.7)', filter: 'blur(3px)', opacity: 0 }, { transform: 'translateY(6%)', filter: 'none', opacity: 1, offset: 0.7 }, { transform: 'none' }], { duration: 340, easing: 'ease-out' }); }
  pop(i) { this.reels.cell(i)?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 360, easing: 'ease-out' }); }

  // Santa's globe: every other globe sends a flake to it.
  async collect(to) {
    const t = this.reels.cell(to); if (!t) return;
    const q = center(t);
    for (const j in this.gvals) {
      if (+j === to) continue;
      const p = center(this.reels.cell(+j));
      fx.burst(p.x, p.y, 4, SNOW, 2);
      const f = document.createElement('i'); f.className = 'nl-flake g-overlay';
      f.style.cssText = `left:${p.x}px;top:${p.y}px`;
      document.body.appendChild(f);
      f.animate([{ transform: 'translate(-50%,-50%)' }, { transform: `translate(calc(${q.x - p.x}px - 50%), calc(${q.y - p.y}px - 50%)) scale(.4)`, opacity: 0.4 }], { duration: this.turbo ? 300 : 520, easing: 'cubic-bezier(.4,0,.6,1)' }).finished.then(() => f.remove(), () => f.remove());
    }
    await this.wait(this.turbo ? 300 : 540);
    this.reels.set(to, GLOBE); this.pop(to); fx.burst(q.x, q.y, 30, GOLD, 8); sfx.bigWin();
  }

  info() {
    const pay = (s) => `3 : ×${xs(P.pays[s][0] * P.K)} · 4 : ×${xs(P.pays[s][1] * P.K)} · 5 : ×${xs(P.pays[s][2] * P.K)}`;
    const art = (s) => (s < 5 ? cardSVG(s) : img(`s${s - 5}`));
    const rows = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((s) => `<div class="pay-item"><div class="pay-sym nl-pay">${art(s)}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>${pay(s)}</span></div></div>`).join('');
    return this.rules(`<h4>Symboles (× la mise, par façon)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym nl-pay">${img('wild')}</div><div class="pay-vals"><b>Traîneau WILD</b><br><span>Rouleaux 2 à 5, remplace tous les symboles sauf la lettre et la boule de neige</span></div></div>
      <div class="pay-item"><div class="pay-sym nl-pay">${img('scat')}</div><div class="pay-vals"><b>Lettre au Père Noël</b><br><span>3 : 10 tours gratuits · 4 : 12 · 5 : 15</span></div></div>
      <div class="pay-item"><div class="pay-sym nl-pay">${img('globe')}</div><div class="pay-vals"><b>Boule de neige magique</b><br><span>6 ou plus : le bonus Boules de neige</span></div></div></div>
      <h4>16 807 façons de gagner</h4><p>5 rouleaux de 7 cases. Un symbole paie dès qu’il apparaît sur 3 rouleaux d’affilée ou plus depuis la gauche, à n’importe quelle hauteur. Le gain est multiplié par le nombre de façons.</p>
      <h4>La Tournée (tours gratuits)</h4><p>3 lettres ou plus : <b>10, 12 ou 15 tours gratuits</b> de nuit, sous les aurores boréales. Sur les rouleaux 2 à 5, le <b>traîneau WILD</b> tombe sur une case et <b>monte jusqu’en haut</b> de sa colonne : il vaut <b>×2</b> là où il tombe, puis <b>+1 à chaque case</b> montée. Tombé tout en bas : toute la colonne, <b>×8</b>. Plus il tombe bas, plus il rapporte. Un gain qui passe par plusieurs traîneaux <b>multiplie</b> leurs multiplicateurs (×8 × ×8 × ×8 = ×512). Un traîneau tombé tout en bas <b>reste 1 tour de plus</b>. 3 lettres pendant le bonus : <b>+5 tours</b>.</p>
      <h4>Boules de neige</h4><p>6 boules de neige ou plus : elles <b>restent en place</b> et tu as 3 relances. Chaque nouvelle boule reste et remet les relances à 3. Les boules valent ×1 à ×50 la mise, <b>MINI ×${JPX.mini}</b> ou <b>MAXI ×${JPX.maxi}</b>. La boule du <b>lutin double toutes les boules</b> à l’écran, celle du <b>Père Noël ramasse le total</b> de toutes les boules. Les 35 cases remplies : <b>GRAND ×${xs(JPX.grand)}</b> en plus.</p>
      <h4>Achats</h4><p>La Tournée ×${BUY_FS} la mise · Boules de neige ×${BUY_HOLD}. Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { NoelGame };
})();
