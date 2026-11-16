// SpinBet Casino · TotemXGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/totemx.js ----
__mods['games/impl/totemx.js'] = (() => {
// Le Totem Extrême: the big brother of Le Totem. A 6×5 grid; clusters of 5+ touching symbols pay, seal, and the free
// cells respin (10 connections at most per spin). Each connection lifts the totem one step on an escalating ladder
// (×1 ×2 ×3 ×4 ×5, then the numbers burn: ×8 ×10 ×15 ×20 ×30 ×50 ×100). Sealing the 30 cells is the FULL SCREEN:
// FULL_X × the bet × the totem's multiplier. 3 suns: Bonus de feu (8 spins from ×3), 4+: Feu Royal (12 spins from
// ×5); in the bonus the totem never goes down. Math tuned by simulation: RTP ≈ 92.3 %, buys ≈ 87.4 / 88.2 %,
// full screen ≈ 1 spin in 1 700, max win ×2 000 (catalogue) ≈ 1 spin in 55 000.
// Layout and decoration are Tailwind classes (prefix tw-), compiled by tools/tailwind/build.mjs (totemx.css).

const { BaseGame, fmtC, art } = __mods['core/base.js'];
const { SymbolGrid } = __mods['core/grid.js'];
const { DEFS, MAP } = __mods['art/pharaon.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { Scene, sceneHTML } = __mods['core/videobg.js'];
// The owner's 2 animated decors of 16 November 2026 (tools/art/totemx/clean.py): the temple and its loading bar. The
// video is not a loop: it is the bar. Its first frames fill the bar (gold, then red) up to FULL, then it catches fire
// from FIRE. The game plays it forward to the frame of the totem's height (the bar grows at each connection) and plays
// the fire on a FULL SCREEN (owner's wish), then goes back to the start for the next spin.
const SCENE = { id: 'tz', dir: 'totemx', ver: 1, video: { large: 0, haut: 0 }, manual: true, size: { large: [672, 448], haut: [448, 672] }, key: { large: [10, 10, 662, 445], haut: [0, 0, 448, 672] } };
const BAR = { haut: { full: 100, fire: 136 }, large: { full: 132, fire: 136 } }, NF = 193, FPS = 24;
class BarVideo {
  constructor(v) {
    this.v = v; v.muted = true; v.loop = false;
    this.frac = 0; this.stopAt = null; this.burn = false;
    const tick = () => {
      if (this.dead) return;
      const t = v.currentTime;
      if (this.stopAt !== null && t >= this.stopAt) { v.pause(); this.stopAt = null; }
      if (this.burn && t >= (NF - 3) / FPS) v.currentTime = (this.bar.fire + 20) / FPS; // the flames go on
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    this.onVis = () => { if (document.hidden) v.pause(); else if (this.burn || this.stopAt !== null) this.play(); };
    document.addEventListener('visibilitychange', this.onVis);
  }
  calmPlay() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  play() { if (!this.dead && !this.calmPlay()) this.v.play().catch(() => {}); }
  // the whole file in memory (a jump to any frame works at once), then back to the bar's height
  async load(url, poster, name) {
    this.bar = BAR[name]; this.v.poster = poster;
    const n = ++this.n || (this.n = 1);
    let src = url;
    try { const r = await fetch(url); if (r.ok) src = URL.createObjectURL(await r.blob()); } catch { /* the plain file */ }
    if (this.dead || n !== this.n) return;
    if (this.blob) URL.revokeObjectURL(this.blob);
    this.blob = src.startsWith('blob:') ? src : null;
    this.v.src = src;
    this.v.addEventListener('loadeddata', () => this.go(this.frac, true), { once: true });
  }
  // the bar at frac (0..1): played forward (it grows), or put there at once (back to the start)
  go(frac, jump) {
    this.frac = frac; this.burn = false;
    if (!this.bar || !this.v.src) return;
    const t = (frac * this.bar.full) / FPS;
    if (jump || t < this.v.currentTime - 0.02 || this.calmPlay()) { this.v.pause(); this.stopAt = null; this.v.currentTime = t; return; }
    this.stopAt = t; this.play();
  }
  fire() {
    if (!this.bar || !this.v.src) return;
    this.burn = true; this.stopAt = null;
    if (this.v.currentTime < this.bar.full / FPS) this.v.currentTime = this.bar.full / FPS;
    this.play();
  }
  destroy() {
    this.dead = true; cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVis);
    this.v.pause(); this.v.removeAttribute('src'); this.v.load();
    if (this.blob) URL.revokeObjectURL(this.blob);
  }
}

/* ===ENGINE */
const SYM = [['👑', 8, 10], ['🦅', 6, 10], ['☥', 4, 10], ['🐍', 3, 10], ['🪲', 2, 10], ['🏺', 1, 10]];
const SC = '☀️', SCW = 0.7, TOT = SYM.reduce((a, s) => a + s[2], SCW);
const COLS = 6, ROWS = 5, N = COLS * ROWS;
const K = 0.012; // cluster pay: bet × value × K × (size − 2), prorated to the new cells, × the totem
const LAD = [1, 2, 3, 4, 5, 8, 10, 15, 20, 30, 50, 100];
const HOT = 5; // from LAD[HOT] (×8) the numbers burn
const MAX_ROUNDS = 10;
const FULL_X = 21; // FULL SCREEN: 21 × the bet × the totem's multiplier
const FS = { n: { spins: 8, lv: 2 }, r: { spins: 12, lv: 4 } };
const BUYN = 43, BUYR = 99;
function rnd() { let r = Math.random() * TOT; if (r < SCW) return SC; r -= SCW; for (let i = 0; i < SYM.length; i++) { if (r < SYM[i][2]) return SYM[i][0]; r -= SYM[i][2]; } return SYM[5][0]; }
function val(s) { for (const x of SYM) if (x[0] === s) return x[1]; return 0; }
function clusters(grid) {
  const seen = {}, out = [];
  for (let i = 0; i < N; i++) {
    if (seen[i] || grid[i] === SC) continue;
    const st = [i], cs = []; seen[i] = 1;
    while (st.length) {
      const k = st.pop(); cs.push(k);
      const col = Math.floor(k / ROWS), row = k % ROWS, nb = [];
      if (row > 0) nb.push(k - 1); if (row < ROWS - 1) nb.push(k + 1); if (col > 0) nb.push(k - ROWS); if (col < COLS - 1) nb.push(k + ROWS);
      nb.forEach((n) => { if (!seen[n] && grid[n] === grid[i]) { seen[n] = 1; st.push(n); } });
    }
    if (cs.length >= 5) out.push({ s: grid[i], cells: cs });
  }
  return out;
}
/* ===END ENGINE */

const MUSIC = { sd: 0.27, len: 16, root: 146.83, lead: { wave: 'sawtooth', vol: 0.05, dur: 0.3, pat: [12, null, 13, 12, 16, null, 13, null, 12, null, 8, 7, 8, null, 4, 5] }, bass: { wave: 'square', vol: 0.045, dur: 0.5, pat: [-12, null, -12, null, -12, null, -11, null, -12, null, -12, null, -7, null, -5, null] }, kick: [0, 4, 8, 10, 12], hat: [2, 6, 10, 14, 15], kv: 0.24, hv: 0.025 };
// The painted symbols of Le Totem (assets/games/pharaon), set on fire by the CSS.
const IMG_V = 1;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images are inlined
const IMG = { '👑': 's0', '🦅': 's1', '☥': 's2', '🐍': 's3', '🪲': 's4', '🏺': 's5', '☀️': 'sc' };
const symArt = (v) => (IMG[v] ? `<img class="ph-img" src="${asset(`assets/games/pharaon/${IMG[v]}.webp`)}" alt="" draggable="false" decoding="async">` : art(MAP[v]));
const NAMES = { '👑': 'Masque du pharaon', '🦅': 'Faucon d’Horus', '☥': 'Ankh', '🐍': 'Cobra', '🪲': 'Scarabée', '🏺': 'Amphore', '☀️': 'Soleil (scatter)' };
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const STAGE = sceneHTML('tz', {
  host: 'grid-host',
  inWin: '<div class="tx-pop tw-pointer-events-none tw-absolute tw-left-1/2 tw-top-1/2 tw-z-20 tw-whitespace-nowrap tw-text-center tw-opacity-0" aria-live="polite"></div>',
  plates: '<div class="sx-pl sx-bal"><small>SOLDE</small><b></b></div><div class="sx-pl sx-totem"><small>TOTEM</small><b class="tx-cur">×1</b></div><div class="sx-pl sx-gain"><small>GAIN</small><b>0</b></div>',
  inArt: '<div class="sx-pl sx-full-n"><small>FULL SCREEN</small><b><i class="tx-locked">0</i> / 30</b></div><div hidden><i class="tx-chain"></i><i class="tx-suns"></i><i class="tx-sunchip"></i><i class="tx-fullchip"></i></div>',
});

class TotemXGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      defs: DEFS, music: MUSIC, cls: 'tx-game',
      stage: STAGE,
      buys: [
        { id: 'n', icon: '🔥', label: 'Bonus de feu · 3 soleils', desc: '8 tours gratuits, le totem part de ×3 et ne redescend pas', cost: (b) => b * BUYN },
        { id: 'r', icon: '👑', label: 'Feu Royal · 4 soleils', desc: '12 tours gratuits, le totem part de ×5 et ne redescend pas', cost: (b) => b * BUYR },
      ],
      hello: 'Relie 5 symboles : le totem monte… et au-dessus de ×5, il brûle',
    });
    this.popEl = this.q('.tx-pop');
    this.frame = this.q('.sx-win');
    this.lv = 0;
    Object.values(IMG).forEach((n) => { new Image().src = asset(`assets/games/pharaon/${n}.webp`); });
    this.grid = new SymbolGrid(this.q('.grid-host'), {
      cols: COLS, rows: ROWS, game: this,
      art: symArt,
      cls: (v) => (v === SC ? 'scatter' : ''),
    });
    this.grid.setAll(Array.from({ length: N }, () => SYM[Math.floor(Math.random() * SYM.length)][0]));
    this.bar = new BarVideo(this.q('.sx-vid'));
    this.sx = new Scene(this, { ...SCENE, onOrient: (name) => this.bar.load(asset(`assets/games/totemx/fond-${name}.mp4`), asset(`assets/games/totemx/scene-${name}.webp`), name) });
    this.setLevel(0);
    this.hud(0, 0, 0);
  }

  destroy() { this.bar?.destroy(); this.sx?.destroy(); super.destroy(); }
  onMeters() { this.sx?.meters(); }

  // Overlays (bonus intro, big wins) burn too.
  overlay(html, cls = '') { return super.overlay(html, `${cls} tx-ov`); }

  /* ---------- the extreme totem ---------- */
  // the totem's height = the loading bar of the temple (the video goes forward to it; back to the start for a new spin)
  setLevel(lv, bump) {
    const was = this.lv;
    this.lv = lv;
    this.q('.tx-cur').textContent = `×${LAD[lv]}`;
    this.bar?.go(lv / (LAD.length - 1), lv < was || !bump);
    // the temple heats up with the totem: hot from ×8, inferno from ×30
    this.slotEl.classList.toggle('tx-hot', lv >= HOT);
    this.slotEl.classList.toggle('tx-inferno', lv >= 9);
    if (!bump) return;
    const on = this.q('.sx-totem');
    on?.classList.remove('tx-bump'); void on?.offsetWidth; on?.classList.add('tx-bump');
    this.frame.classList.remove('tx-flash'); void this.frame.offsetWidth; this.frame.classList.add('tx-flash');
    const hot = lv >= HOT;
    setTimeout(() => { if (!on?.isConnected) return; const p = center(on); fx.burst(p.x, p.y, hot ? 34 : 20, hot ? ['#fff7c2', '#fde047', '#f97316', '#ef4444'] : ['#fff8e6', '#fde68a', '#fbbf24'], hot ? 8 : 6); }, 260);
    sfx.upgrade();
    if (lv === HOT && was < HOT) this.shake(this.frame);
  }

  hud(locked, chain, suns) {
    this.q('.tx-locked').textContent = locked;
    this.q('.tx-chain').textContent = chain;
    this.q('.tx-suns').textContent = suns;
    this.q('.tx-sunchip').classList.toggle('tx-hot', suns >= 2);
    this.q('.tx-fullchip').classList.toggle('tx-hot', locked >= 24);
  }

  // A big word in the middle of the grid.
  pop(main, sub = '', kind = '') {
    if (this.dead) return;
    const p = this.popEl;
    p.className = `tx-pop tw-pointer-events-none tw-absolute tw-left-1/2 tw-top-1/2 tw-z-20 tw-whitespace-nowrap tw-text-center ${kind}`;
    p.innerHTML = `<b class="tw-block tw-font-cinzel tw-font-black tw-leading-none tw-text-[clamp(26px,6vw,58px)]">${main}</b>${sub ? `<small class="tw-block tw-mt-1 tw-font-num tw-font-black tw-text-[clamp(15px,3vw,26px)] tw-text-orange-50">${sub}</small>` : ''}`;
    void p.offsetWidth;
    p.classList.add('go');
  }

  onMain() {
    this.round(async () => {
      if (!this.pay(this.bet)) return;
      this.lastStake = this.bet;
      const r = await this.spinOnce(false, 0);
      if (r.scat >= 3) { this.stopAuto(); await this.freeSpins(r.scat >= 4 ? 'r' : 'n'); }
    });
  }

  async onBuy(kind) { await this.freeSpins(kind); }

  async spinOnce(isFree, lv0) {
    const bet = this.bet;
    const g = Array.from({ length: N }, rnd);
    const locked = new Set();
    let lv = lv0, total = 0, round = 0, scat = 0, full = false;
    this.grid.cells.forEach((c) => c.classList.remove('lock', 'seal'));
    this.grid.el.classList.remove('tx-respin');
    this.slotEl.classList.remove('tx-full');
    this.setLevel(lv);
    this.hud(0, 0, 0);
    this.setLast(0);
    this.winAmt.textContent = '';
    this.msg(isFree ? 'Tour gratuit : le totem garde sa hauteur…' : 'Le temple s’embrase…');
    while (!this.dead) {
      let sc = 0;
      await this.grid.dropIn(g, {
        keep: locked,
        tease: round === 0 ? (c) => { const t = sc >= 2; for (let r = 0; r < ROWS; r++) if (g[c * ROWS + r] === SC) sc++; return t; } : null,
        onLand: (i, v) => {
          if (v !== SC) return;
          sfx.land(); this.grid.bump(this.grid.cells[i]);
          if (round === 0) this.hud(0, 0, g.slice(0, i + 1).filter((s) => s === SC).length);
        },
      });
      this.grid.el.classList.remove('tx-respin');
      if (round === 0) { scat = g.filter((s) => s === SC).length; this.hud(locked.size, round, scat); }
      const cl = clusters(g);
      let paid = 0, fresh = false;
      const newIdx = [];
      cl.forEach((c) => {
        if (c.cells.some((i) => !locked.has(i))) {
          fresh = true;
          const nk = c.cells.filter((i) => !locked.has(i)).length;
          paid += bet * val(c.s) * K * (c.cells.length - 2) * (nk / c.cells.length);
          c.cells.forEach((i) => { if (!locked.has(i)) newIdx.push(i); });
        }
      });
      if (!fresh) break;
      const m = LAD[lv];
      paid = Math.round(paid * m);
      total += paid;
      this.grid.mark(newIdx);
      this.setLast(total);
      this.pop(round ? `CONNEXION ×${round + 1}` : 'CONNEXION !', `+${fmtC(paid)} · ×${m}`, lv >= HOT ? 'fire' : '');
      this.msg(`Connexion ! +${fmtC(paid)} <span class="pill hot">×${m}</span>`);
      sfx.win();
      await this.wait(lv >= HOT ? 950 : 850);
      this.grid.unmark();
      cl.forEach((c) => c.cells.forEach((i) => { locked.add(i); this.grid.cells[i].classList.add('lock'); }));
      newIdx.forEach((i, k) => {
        const cell = this.grid.cells[i];
        setTimeout(() => { if (this.dead) return; cell.classList.remove('seal'); void cell.offsetWidth; cell.classList.add('seal'); const p = center(cell); fx.burst(p.x, p.y, 7, ['#fde047', '#f97316', '#fff'], 3); }, calm() ? 0 : k * 35);
      });
      round++;
      this.hud(locked.size, round, scat);
      // FULL SCREEN: the 30 cells are sealed
      if (locked.size === N) {
        full = true;
        const prize = Math.round(bet * FULL_X * m);
        total += prize;
        this.setLast(total);
        await this.fullScreen(prize, m);
        lv = Math.min(lv + 1, LAD.length - 1); // the totem still climbs (it carries over in the bonus)
        this.setLevel(lv, true);
        break;
      }
      const next = Math.min(lv + 1, LAD.length - 1);
      if (next !== lv) {
        lv = next;
        this.setLevel(lv, true);
        if (lv === HOT) this.pop('LE TOTEM BRÛLE !', `×${LAD[lv]} · ×${LAD[lv + 1]} · ×${LAD[lv + 2]}…`, 'fire');
        if (lv === LAD.length - 1) this.pop('SOMMET DU TOTEM', '×100 !', 'fire');
      }
      if (round >= MAX_ROUNDS) break;
      this.msg(`Le totem monte : <span class="pill hot">×${LAD[lv]}</span> · respin des cases libres…`);
      for (let j = 0; j < N; j++) if (!locked.has(j)) g[j] = rnd();
      await this.wait(lv >= HOT ? 520 : 420);
      this.grid.el.classList.add('tx-respin');
      await this.wait(160);
    }
    if (total > 0) {
      this.win(total, isFree ? 'Free Spins' : null);
      if (!isFree) await this.celebrate(total, full ? { summary: 'FULL SCREEN' } : undefined); else this.winAmt.textContent = fmtC(total);
    }
    if (!isFree) this.msg(full ? `FULL SCREEN ! Total du tour : ${fmtC(total)}` : total > 0 ? `Total du tour : ${fmtC(total)}` : scat === 2 ? 'Presque… 2 soleils sur 3' : 'Pas de connexion cette fois');
    return { total, scat, lv, full };
  }

  // The whole grid is sealed: the temple bursts into flames.
  async fullScreen(prize, m) {
    this.slotEl.classList.add('tx-full');
    this.bar?.fire(); // the bar of the temple catches fire
    sfx.bigWin?.();
    fx.confetti?.(120);
    fx.coins?.(50);
    this.shake(this.frame);
    this.pop('FULL SCREEN !', `+${fmtC(prize)} · ${FULL_X} × ×${m}`, 'fire full');
    this.msg(`<b>FULL SCREEN !</b> Les 30 cases sont scellées : +${fmtC(prize)}`);
    await this.wait(2200);
  }

  async freeSpins(kind) {
    const royal = kind === 'r';
    let free = FS[kind].spins, lv = FS[kind].lv, fsWin = 0, done = 0;
    this.lastStake = this.bet;
    await this.featureIntro(royal ? 'FEU ROYAL' : 'BONUS DE FEU', `${free} tours gratuits · le totem part de ×${LAD[lv]} et ne redescend jamais`, symArt(SC));
    this.slotEl.classList.add('in-free');
    while (free > 0 && !this.dead && !this.maxHit) { // stops at the max win (core/base.js)
      free--; done++;
      this.setBanner(`<b>🔥 ${royal ? 'FEU ROYAL' : 'BONUS DE FEU'}</b><span class="pill">Tour ${done} / ${done + free}</span><span class="pill hot">Totem ×${LAD[lv]}</span><span class="pill gold">Gain ${fmtC(fsWin)}</span>`);
      const r = await this.spinOnce(true, lv);
      fsWin += r.total;
      lv = r.lv; // the totem carries over to the next spin
      if (r.scat >= 3) { free += 3; await this.featureIntro('+3 TOURS', 'Trois soleils de plus !', symArt(SC), 1300); }
      await this.wait(500);
    }
    this.slotEl.classList.remove('in-free', 'tx-full');
    this.setBanner('');
    this.setLevel(0);
    this.hud(0, 0, 0);
    this.grid.cells.forEach((c) => c.classList.remove('lock', 'seal'));
    this.setLast(fsWin);
    await this.celebrate(fsWin, { summary: royal ? 'FEU ROYAL' : 'BONUS DE FEU' });
    this.msg(`Bonus terminé : ${fmtC(fsWin)} gagnés`);
  }

  info() {
    const rows = [...SYM.map((s) => s[0]), SC].map((s) => `<div class="tw-flex tw-items-center tw-gap-3 tw-p-2 tw-rounded-lg tw-bg-gradient-to-r tw-from-orange-500/10 tw-to-transparent tw-border tw-border-orange-400/20">
        <div class="pay-sym tw-shrink-0">${symArt(s)}</div>
        <div class="tw-leading-tight"><b class="tw-block">${NAMES[s]}</b><span class="tw-text-[13px] tw-opacity-75">${s === SC ? '3 = Bonus de feu (8 tours dès ×3) · 4+ = Feu Royal (12 tours dès ×5)' : `Valeur ${val(s)} · grappe de 5 = mise × ${(val(s) * K * 3).toFixed(3).replace('.', ',')} × le totem`}</span></div>
      </div>`).join('');
    return this.rules(`<h4>Symboles</h4><div class="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-2">${rows}</div>
      <h4>Le totem extrême</h4><p>Grille 6×5. Une grappe de <b>5 symboles identiques ou plus</b> qui se touchent paie (mise × valeur × ${String(K).replace('.', ',')} × (taille − 2), au prorata des nouvelles cases) <b>× le totem</b>, puis se scelle. Les cases libres sont relancées et chaque connexion fait monter le totem : <b>${LAD.map((v) => `×${v}`).join(' · ')}</b>. Au-dessus de ×5, les chiffres brûlent. ${MAX_ROUNDS} connexions au plus par tour.</p>
      <h4>FULL SCREEN</h4><p>Si les <b>30 cases</b> finissent scellées : <b>${FULL_X} × la mise × le multiplicateur du totem</b> en plus (un full screen à ×30 paie ${FULL_X * 30} fois la mise).</p>
      <h4>Bonus</h4><p>3 soleils : Bonus de feu, 8 tours gratuits, le totem part de ×3. 4 soleils ou plus : Feu Royal, 12 tours à partir de ×5. Pendant le bonus, <b>le totem ne redescend jamais</b>. 3 soleils de plus : +3 tours.</p>
      <h4>Achats</h4><p>Bonus de feu ×${BUYN} la mise · Feu Royal ×${BUYR} la mise. Gain maximum : ×${this.game.maxX.toLocaleString('fr-FR')} la mise par tour, bonus compris.</p>`);
  }
}

return { TotemXGame };
})();
