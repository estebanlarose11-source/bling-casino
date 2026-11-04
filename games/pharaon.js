// SpinBet Casino · PharaonGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/pharaon.js ----
__mods['games/impl/pharaon.js'] = (() => {
// Le Totem 2.0. Same engine and same payouts as before (locked winning cells, a multiplier that climbs at each
// connection, 8 or 12 free spins where the multiplier stays); everything on screen is new: the totem of
// multipliers beside the grid, the temple frame with its torches, sealed cells, connection pops, suns counter and a
// night temple for the bonus. Layout and decoration are written with Tailwind classes (prefix tw-), compiled by
// tools/tailwind/build.mjs into <style id="tw-games"> of index.html (with tools/tailwind/pharaon.css).

const { BaseGame, fmtC, art } = __mods['core/base.js'];
const { SymbolGrid } = __mods['core/grid.js'];
const { DEFS, MAP } = __mods['art/pharaon.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE (original) */
const SYM = [['👑', 8, 3], ['🦅', 6, 4], ['☥', 4, 6], ['🐍', 3, 8], ['🪲', 2, 10], ['🏺', 1, 12]];
const SC = '☀️', SCW = 1.05, TOT = SYM.reduce((a, s) => a + s[2], SCW);
const N = 20, ROWS = 4, COLS = 5, BUYN = 22, BUYB = 62;
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
      if (row > 0) nb.push(k - 1); if (row < ROWS - 1) nb.push(k + 1); if (col > 0) nb.push(k - ROWS); if (col < 4) nb.push(k + ROWS);
      nb.forEach((n) => { if (!seen[n] && grid[n] === grid[i]) { seen[n] = 1; st.push(n); } });
    }
    if (cs.length >= 5) out.push({ s: grid[i], cells: cs });
  }
  return out;
}
/* ===END ENGINE */

const MUSIC = { sd: 0.3261, len: 16, root: 164.81, lead: { wave: 'triangle', vol: 0.07, dur: 0.4, pat: [12, null, 13, null, 16, 13, 12, null, 8, null, 7, null, 4, null, 5, null] }, bass: { wave: 'sawtooth', vol: 0.05, dur: 0.6, pat: [-12, null, null, null, -12, null, null, null, -12, null, null, null, -7, null, -5, null] }, kick: [0, 6, 10], hat: [3, 7, 11, 14, 15], kv: 0.2, hv: 0.02 };
// Painted symbols by the owner: assets/games/pharaon/s0..s5.webp + sc.webp (sun scatter), bg.webp / bg-m.webp, cover.webp.
const IMG_V = 1;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images are inlined
const IMG = { '👑': 's0', '🦅': 's1', '☥': 's2', '🐍': 's3', '🪲': 's4', '🏺': 's5', '☀️': 'sc' };
const symArt = (v) => (IMG[v] ? `<img class="ph-img" src="${asset(`assets/games/pharaon/${IMG[v]}.webp`)}" alt="" draggable="false" decoding="async">` : art(MAP[v]));
const NAMES = { '👑': 'Masque du pharaon', '🦅': 'Faucon d’Horus', '☥': 'Ankh', '🐍': 'Cobra', '🪲': 'Scarabée', '🏺': 'Amphore', '☀️': 'Soleil (scatter)' };
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Dust in the light of the temple: a few motes rising slowly (transform only, cheap on phones).
const motes = Array.from({ length: 9 }, (_, i) => `<i class="tm-mote tw-absolute tw-bottom-0 tw-block tw-w-1 tw-h-1 tw-rounded-full tw-bg-sand-200 tw-shadow-[0_0_6px_2px_rgba(253,230,138,.6)] tw-animate-tm-float" style="left:${6 + i * 11}%;animation-delay:${-(i * 0.8).toFixed(1)}s;animation-duration:${6 + (i % 4)}s"></i>`).join('');

const TORCH = (d = 0) => `<span class="tm-torch tw-relative tw-mt-6 tw-shrink-0" aria-hidden="true"><i class="tw-animate-tm-flicker" style="animation-delay:${d}s"></i></span>`;
const HEAD = `<div class="tw-flex tw-items-end tw-gap-4 max-md:tw-hidden">${TORCH()}<div class="tm-plaque tw-flex tw-items-center tw-gap-3 tw-px-4 tw-py-1.5 tw-rounded-full tw-border tw-border-sand-400/50 tw-bg-gradient-to-b tw-from-sand-900/90 tw-to-sand-950/90 tw-shadow-[0_0_24px_rgba(251,191,36,.25)]">
    <span class="tw-text-xl tw-leading-none">☥</span>
    <span class="tw-font-cinzel tw-font-black tw-tracking-[.25em] tw-text-transparent tw-bg-clip-text tw-bg-gradient-to-b tw-from-sand-50 tw-via-sand-400 tw-to-sand-600 tw-text-lg">LE TOTEM</span>
    <span class="tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-widest tw-text-sand-200/70">Temple du multiplicateur</span>
  </div>${TORCH(-0.4)}</div>`;

const STAGE = `<div class="tm tw-relative tw-flex tw-items-stretch tw-justify-center tw-gap-3 max-md:tw-flex-col max-md:tw-gap-2">
    <aside class="tm-totem tw-relative tw-flex tw-flex-col tw-shrink-0 tw-w-[86px] tw-rounded-xl tw-overflow-hidden tw-border tw-border-sand-400/40 tw-bg-gradient-to-b tw-from-sand-900/85 tw-via-[#0d0702]/90 tw-to-sand-900/85 tw-shadow-[0_0_26px_rgba(251,191,36,.22),inset_0_0_18px_rgba(0,0,0,.7)] max-md:tw-w-full max-md:tw-flex-row max-md:tw-h-[54px]" aria-label="Multiplicateur">
      <div class="tw-z-10 tw-flex tw-items-center tw-justify-center tw-py-1.5 tw-bg-gradient-to-b tw-from-sand-200 tw-via-sand-400 tw-to-sand-600 tw-text-sand-950 tw-font-black tw-text-[10px] tw-tracking-[.22em] tw-shadow-[0_2px_8px_rgba(0,0,0,.5)] max-md:tw-px-2.5 max-md:tw-py-0 max-md:tw-flex-col max-md:tw-leading-tight">
        <span class="max-md:tw-hidden">TOTEM</span><span class="md:tw-hidden tw-text-[9px] tw-tracking-[.12em]">MULTI</span><b class="tm-cur md:tw-hidden tw-font-num tw-text-lg tw-tracking-normal">×1</b>
      </div>
      <div class="tm-lad tw-relative tw-flex-1 tw-overflow-hidden">
        <div class="tm-steps tw-absolute tw-left-0 tw-top-0 tw-flex tw-flex-col-reverse tw-items-center tw-gap-2 tw-w-full tw-py-3 tw-transition-transform tw-duration-500 max-md:tw-w-auto max-md:tw-h-full max-md:tw-flex-row max-md:tw-px-3 max-md:tw-py-0"></div>
        <div class="tm-lens tw-pointer-events-none tw-absolute tw-left-1.5 tw-right-1.5 tw-top-1/2 tw-h-[58px] tw--translate-y-1/2 tw-rounded-lg tw-border-2 tw-border-sand-400 tw-shadow-[0_0_18px_rgba(251,191,36,.6),inset_0_0_14px_rgba(251,191,36,.35)] tw-animate-tm-glow max-md:tw-hidden"></div>
        <div class="tw-pointer-events-none tw-absolute tw-inset-0 tw-bg-[linear-gradient(180deg,#0d0702_0%,transparent_22%,transparent_78%,#0d0702_100%)] max-md:tw-bg-[linear-gradient(90deg,#0d0702_0%,transparent_14%,transparent_86%,#0d0702_100%)]"></div>
      </div>
    </aside>
    <div class="tm-board tw-relative tw-flex-initial tw-min-w-0">
      <div class="tm-rays tw-pointer-events-none tw-absolute tw-left-1/2 tw-top-1/2 tw-w-[150%] tw-aspect-square tw--translate-x-1/2 tw--translate-y-1/2 tw-opacity-40 tw-animate-tm-rays" aria-hidden="true"></div>
      <div class="tm-motes tw-pointer-events-none tw-absolute tw-inset-0 tw-overflow-hidden" aria-hidden="true">${motes}</div>
      <div class="tm-frame tw-relative tw-w-fit tw-max-w-full tw-mx-auto tw-rounded-2xl tw-p-2 tw-border-2 tw-border-sand-400/70 tw-bg-gradient-to-b tw-from-sand-900/70 tw-to-[#0d0702]/80 tw-shadow-[0_0_0_4px_rgba(20,11,2,.85),0_0_0_6px_rgba(251,191,36,.35),0_18px_50px_rgba(0,0,0,.6),inset_0_0_40px_rgba(0,0,0,.65)] max-md:tw-p-1.5">
        <i class="tm-gem tw-absolute tw--top-2 tw-left-1/2 tw--translate-x-1/2 tw-w-5 tw-h-5 tw-rotate-45 tw-rounded-sm tw-bg-gradient-to-br tw-from-faience-300 tw-to-faience-500 tw-shadow-[0_0_14px_rgba(94,234,212,.8)] tw-border-2 tw-border-sand-400"></i>
        <div class="grid-host"></div>
        <div class="tm-pop tw-pointer-events-none tw-absolute tw-left-1/2 tw-top-1/2 tw-z-20 tw-whitespace-nowrap tw-text-center tw-opacity-0" aria-live="polite"></div>
      </div>
      <div class="tm-hud tw-relative tw-z-10 tw-flex tw-justify-center tw-gap-2 max-md:tw-gap-1 tw-mt-2 tw-flex-wrap tw-text-[12px] max-md:tw-text-[10.5px] tw-font-bold tw-text-sand-50">
        <span class="tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1 max-md:tw-px-2 max-md:tw-gap-1 tw-rounded-full tw-bg-black/55 tw-border tw-border-sand-400/40">🔒 Scellées <b class="tm-locked tw-font-num tw-text-sand-400">0</b><small class="tw-opacity-60">/ 20</small></span>
        <span class="tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1 max-md:tw-px-2 max-md:tw-gap-1 tw-rounded-full tw-bg-black/55 tw-border tw-border-sand-400/40">⛓️ Connexions <b class="tm-chain tw-font-num tw-text-sand-400">0</b></span>
        <span class="tm-sunchip tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1 max-md:tw-px-2 max-md:tw-gap-1 tw-rounded-full tw-bg-black/55 tw-border tw-border-sand-400/40 tw-transition-all">☀️ Soleils <b class="tm-suns tw-font-num tw-text-sand-400">0</b><small class="tw-opacity-60">/ 3</small></span>
      </div>
    </div>
  </div>`;

class PharaonGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      defs: DEFS, music: MUSIC, cls: 'tm-game',
      head: HEAD,
      stage: STAGE,
      buys: [
        { id: 'normal', icon: '☀️', label: 'Bonus 3 soleils', desc: '8 tours gratuits, multiplicateur de départ ×4', cost: (b) => b * BUYN },
        { id: 'bounty', icon: '👑', label: 'Bonus Royal · 4 soleils', desc: '12 tours gratuits, multiplicateur de départ ×10', cost: (b) => b * BUYB },
      ],
      hello: 'Relie 5 symboles : ils se scellent et le totem monte',
    });
    this.steps = this.q('.tm-steps');
    this.lad = this.q('.tm-lad');
    this.popEl = this.q('.tm-pop');
    this.frame = this.q('.tm-frame');
    this.mult = 1;
    this.stepMax = 0;
    Object.values(IMG).forEach((n) => { new Image().src = asset(`assets/games/pharaon/${n}.webp`); });
    this.grid = new SymbolGrid(this.q('.grid-host'), {
      cols: COLS, rows: ROWS, game: this,
      art: symArt,
      cls: (v) => (v === SC ? 'scatter' : ''),
    });
    this.grid.setAll(Array.from({ length: N }, () => SYM[Math.floor(Math.random() * SYM.length)][0]));
    this.onResize = () => this.placeLadder();
    addEventListener('resize', this.onResize);
    this.setMult(1);
    this.hud(0, 0, 0);
  }

  destroy() { removeEventListener('resize', this.onResize); super.destroy(); }

  // Overlays (bonus intro, big wins) wear the temple's colours too.
  overlay(html, cls = '') { return super.overlay(html, `${cls} tm-ov`); }

  /* ---------- the totem of multipliers ---------- */
  ensureSteps(m) {
    const want = Math.max(16, m + 8);
    if (want <= this.stepMax) return;
    let h = '';
    for (let v = this.stepMax + 1; v <= want; v++) h += `<div class="tm-step" data-v="${v}"><span>×${v}</span></div>`;
    this.steps.insertAdjacentHTML('beforeend', h);
    this.stepMax = want;
  }
  placeLadder() {
    const on = this.steps.querySelector('.tm-step.on');
    if (!on) return;
    const row = getComputedStyle(this.steps).flexDirection.startsWith('row');
    const t = row
      ? `translateX(${Math.round(this.lad.clientWidth / 2 - (on.offsetLeft + on.offsetWidth / 2))}px)`
      : `translateY(${Math.round(this.lad.clientHeight / 2 - (on.offsetTop + on.offsetHeight / 2))}px)`;
    this.steps.style.transform = t;
  }
  setMult(m, bump) {
    this.mult = m;
    this.ensureSteps(m);
    this.steps.querySelectorAll('.tm-step').forEach((s) => {
      const v = +s.dataset.v;
      s.classList.toggle('on', v === m);
      s.classList.toggle('done', v < m);
    });
    this.q('.tm-cur').textContent = `×${m}`;
    this.placeLadder();
    if (!bump) return;
    const on = this.steps.querySelector('.tm-step.on');
    on?.classList.remove('tm-bump'); void on?.offsetWidth; on?.classList.add('tm-bump');
    this.frame.classList.remove('tm-flash'); void this.frame.offsetWidth; this.frame.classList.add('tm-flash');
    setTimeout(() => { if (!on?.isConnected) return; const p = center(on); fx.burst(p.x, p.y, 22, ['#fff8e6', '#fde68a', '#fbbf24', '#5eead4'], 6); }, 260);
    sfx.upgrade();
  }

  hud(locked, chain, suns) {
    this.q('.tm-locked').textContent = locked;
    this.q('.tm-chain').textContent = chain;
    this.q('.tm-suns').textContent = suns;
    this.q('.tm-sunchip').classList.toggle('tm-hot', suns >= 2);
  }

  // A big word in the middle of the grid (CONNEXION ×3 !, +12,50, RESPIN…).
  pop(main, sub = '', kind = '') {
    if (this.dead) return;
    const p = this.popEl;
    p.className = `tm-pop tw-pointer-events-none tw-absolute tw-left-1/2 tw-top-1/2 tw-z-20 tw-whitespace-nowrap tw-text-center ${kind}`;
    p.innerHTML = `<b class="tw-block tw-font-cinzel tw-font-black tw-leading-none tw-text-[clamp(26px,6vw,54px)]">${main}</b>${sub ? `<small class="tw-block tw-mt-1 tw-font-num tw-font-black tw-text-[clamp(15px,3vw,24px)] tw-text-sand-50">${sub}</small>` : ''}`;
    void p.offsetWidth;
    p.classList.add('go');
  }

  onMain() {
    this.round(async () => {
      if (!this.pay(this.bet)) return;
      this.lastStake = this.bet;
      const r = await this.spinOnce(false, 1);
      if (r.scat >= 3) { this.stopAuto(); await this.freeSpins(r.scat >= 4 ? 'bounty' : 'normal'); }
    });
  }

  async onBuy(kind) { await this.freeSpins(kind); }

  async spinOnce(isFree, base) {
    const bet = this.bet;
    const g = Array.from({ length: N }, rnd);
    const locked = new Set();
    let m = isFree ? base : 1, total = 0, round = 0, scat = 0;
    this.grid.cells.forEach((c) => c.classList.remove('lock', 'seal'));
    this.grid.el.classList.remove('tm-respin');
    this.setMult(m);
    this.hud(0, 0, 0);
    this.setLast(0);
    this.winAmt.textContent = '';
    this.msg(isFree ? 'Tour gratuit : le totem garde sa hauteur…' : 'Le temple s’ouvre…');
    while (!this.dead) {
      let sc = 0;
      await this.grid.dropIn(g, {
        keep: locked,
        tease: round === 0 ? (c) => { const t = sc >= 2; for (let r = 0; r < ROWS; r++) if (g[c * ROWS + r] === SC) sc++; return t; } : null,
        onLand: (i, v) => {
          if (v !== SC) return;
          sfx.land(); this.grid.bump(this.grid.cells[i]);
          if (round === 0) this.hud(locked.size, round, g.slice(0, i + 1).filter((s) => s === SC).length);
          else { const n = g.filter((s, k) => s === SC && (k <= i || locked.has(k))).length; if (n > scat) this.hud(locked.size, round, n); }
        },
      });
      this.grid.el.classList.remove('tm-respin');
      // the suns count at every fall of the round, respins included: the most suns on screen at the same time
      // (simulation 2 M spins with SCW 1,05: RTP ≈ 91,8 %, bonus 1 spin in 76, buys ≈ 88 %)
      const sunsNow = g.filter((s) => s === SC).length;
      if (round === 0 || sunsNow > scat) {
        const was = scat; scat = Math.max(scat, sunsNow); this.hud(locked.size, round, scat);
        if (round > 0 && scat >= 3 && was < 3) { this.pop('☀️ 3 SOLEILS !', isFree ? '+3 tours à la fin du tour' : 'Bonus à la fin du tour', 'hot'); sfx.land(); await this.wait(700); }
      }
      const cl = clusters(g);
      let paid = 0, fresh = false;
      const newIdx = [];
      cl.forEach((c) => {
        if (c.cells.some((i) => !locked.has(i))) {
          fresh = true;
          const nk = c.cells.filter((i) => !locked.has(i)).length;
          paid += bet * val(c.s) * 0.0675 * (c.cells.length - 2) * (nk / c.cells.length);
          c.cells.forEach((i) => { if (!locked.has(i)) newIdx.push(i); });
        }
      });
      if (!fresh) break;
      paid = Math.round(paid * m);
      total += paid;
      this.grid.mark(newIdx);
      this.setLast(total);
      this.pop(round ? `CONNEXION ×${round + 1}` : 'CONNEXION !', `+${fmtC(paid)} · ×${m}`, round >= 2 ? 'hot' : '');
      this.msg(`Connexion ! +${fmtC(paid)} <span class="pill hot">×${m}</span>`);
      sfx.win();
      await this.wait(850);
      this.grid.unmark();
      cl.forEach((c) => c.cells.forEach((i) => { locked.add(i); this.grid.cells[i].classList.add('lock'); }));
      // the new cells are sealed: a gold ring closes on each, one after the other
      newIdx.forEach((i, k) => {
        const cell = this.grid.cells[i];
        setTimeout(() => { if (this.dead) return; cell.classList.remove('seal'); void cell.offsetWidth; cell.classList.add('seal'); const p = center(cell); fx.burst(p.x, p.y, 7, ['#fde68a', '#fbbf24', '#fff'], 3); }, calm() ? 0 : k * 45);
      });
      this.hud(locked.size, round + 1, scat);
      m++;
      this.setMult(m, true);
      round++;
      if (round >= 15) break;
      this.msg(`Le totem monte : <span class="pill hot">×${m}</span> · respin des cases libres…`);
      for (let j = 0; j < N; j++) if (!locked.has(j)) g[j] = rnd();
      await this.wait(420);
      this.grid.el.classList.add('tm-respin');
      await this.wait(160);
    }
    if (total > 0) {
      this.win(total, isFree ? 'Free Spins' : null);
      if (!isFree) await this.celebrate(total); else this.winAmt.textContent = fmtC(total);
    }
    if (!isFree) this.msg(total > 0 ? `Total du tour : ${fmtC(total)}` : scat === 2 ? 'Presque… 2 soleils sur 3' : 'Pas de connexion cette fois');
    return { total, scat, m };
  }

  async freeSpins(kind) {
    const bounty = kind === 'bounty';
    let free = bounty ? 12 : 8, base = bounty ? 10 : 4, fsWin = 0, done = 0;
    this.lastStake = this.bet;
    await this.featureIntro(bounty ? 'BONUS ROYAL' : 'BONUS', `${free} tours gratuits · le totem part de ×${base} et ne redescend pas`, symArt(SC));
    this.slotEl.classList.add('in-free');
    while (free > 0 && !this.dead && !this.maxHit) { // stops at the max win (core/base.js)
      free--; done++;
      this.setBanner(`<b>🌙 ${bounty ? 'BONUS ROYAL' : 'BONUS DU TEMPLE'}</b><span class="pill">Tour ${done} / ${done + free}</span><span class="pill hot">Totem ×${base}</span><span class="pill gold">Gain ${fmtC(fsWin)}</span>`);
      const r = await this.spinOnce(true, base);
      fsWin += r.total;
      base = r.m; // the multiplier carries over to the next spin
      if (r.scat >= 3) { free += 3; await this.featureIntro('+3 TOURS', 'Trois soleils de plus !', symArt(SC), 1300); }
      await this.wait(500);
    }
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    this.setMult(1);
    this.hud(0, 0, 0);
    this.grid.cells.forEach((c) => c.classList.remove('lock', 'seal'));
    this.setLast(fsWin);
    await this.celebrate(fsWin, { summary: bounty ? 'BONUS ROYAL' : 'BONUS DU TEMPLE' });
    this.msg(`Bonus terminé : ${fmtC(fsWin)} gagnés`);
  }

  info() {
    const rows = [...SYM.map((s) => s[0]), SC].map((s) => `<div class="tw-flex tw-items-center tw-gap-3 tw-p-2 tw-rounded-lg tw-bg-gradient-to-r tw-from-amber-500/10 tw-to-transparent tw-border tw-border-amber-400/20">
        <div class="pay-sym tw-shrink-0">${symArt(s)}</div>
        <div class="tw-leading-tight"><b class="tw-block">${NAMES[s]}</b><span class="tw-text-[13px] tw-opacity-75">${s === SC ? '3 = bonus 8 tours ×4 · 4+ = Bonus Royal 12 tours ×10' : `Valeur ${val(s)} · grappe de 5 = mise × ${(val(s) * 0.0675 * 3).toFixed(2).replace('.', ',')}`}</span></div>
      </div>`).join('');
    return this.rules(`<h4>Symboles</h4><div class="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-2">${rows}</div>
      <h4>Les cases scellées</h4><p>Grille 5×4. Une grappe de <b>5 symboles identiques ou plus</b> qui se touchent paie (mise × valeur × 0,0675 × (taille − 2), au prorata des nouvelles cases), puis <b>se scelle</b>. Les cases libres sont relancées, et chaque nouvelle connexion fait <b>monter le totem d’un cran</b> (×1, ×2, ×3…), jusqu’à 15 connexions par tour.</p>
      <h4>Bonus</h4><p>3 soleils : 8 tours gratuits, le totem part de ×4. 4 soleils ou plus : le Bonus Royal, 12 tours à partir de ×10. Pendant le bonus, <b>le totem ne redescend jamais</b> d’un tour à l’autre. 3 soleils de plus : +3 tours, même au dernier tour. <b>Les soleils comptent à chaque chute du tour</b>, relances comprises : 3 soleils en même temps sur la grille suffisent.</p>
      <h4>Achats</h4><p>Bonus ×${BUYN} la mise · Bonus Royal ×${BUYB} la mise.</p>`);
  }
}

return { PharaonGame };
})();
