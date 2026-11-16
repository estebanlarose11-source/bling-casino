// SpinBet Casino · PecheGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/peche.js ----
__mods['games/impl/peche.js'] = (() => {
// La Pêche: a money wheel of 54 cases (the owner's glass wheel, 15 November 2026). Light-glass and night-glass cases
// pay ×2 the stake; the blue, orange and red fish open a fishing bonus played with the owner's videos: the size of the
// fish is drawn at random (small = caught with a rod, medium = lifted by a crane, big = pulled out by a helicopter) and
// gives a small, medium or big multiplier (a big fish can be the max win). Before every spin, lightning strikes 4 cases
// of the wheel with a multiplier (fish included). Every spot returns about 95 %. The fishing of each colour can also be
// bought (≈ 88 %, no lightning).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { BetBoard } = __mods['core/roulette.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, audioContext, isMuted } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { mergeOpts, withRoom, wpickR } = __mods['online.js'];

/* ===ENGINE */
const SEG_COUNT = [['w', 22, 0.5], ['s', 22, 0.25], ['fb', 6, 0.4], ['fo', 3, 0.15], ['fr', 1, 0.66]];
const SEGS = SEG_COUNT.flatMap(([k, n, ph], j) => Array.from({ length: n }, (_, i) => ({ k, at: (i + ph) / n + j * 1e-4 }))).sort((a, b) => a.at - b.at).map((x) => x.k);
const NS = SEGS.length, A = 360 / NS; // 54 cases (the glass disc roue-disc.webp is drawn in this order: tools/art/peche/clean.py)
const STRIKES = 4;
const LN = [[2, 55], [3, 25], [5, 13], [10, 7]]; // lightning on a ×2 case
const LF = [[2, 60], [3, 30], [5, 10]]; // lightning on a fish
const CAPX = 25000; // max win, × the stake on the case
// Fish multipliers (× the stake) by size: [weight of the size, [[×, weight]…]] for 1 small (rod), 2 medium (crane),
// 3 big (helicopter). CAPX in a big fish = the max win. Tuned by node tools/sim/peche.js (≈ 95 % per spot).
const FISH = {
  fb: [[62, [[2, 36], [3, 30], [4, 17], [5, 10], [6, 7]]],
    [30, [[7, 34], [8, 26], [10, 18], [12, 12], [15, 7], [20, 3]]],
    [8, [[25, 500], [30, 280], [40, 140], [50, 60], [75, 24], [100, 12], [250, 4], [500, 1.6], [1000, 0.6], [CAPX, 0.08]]]],
  fo: [[62, [[4, 26], [5, 25], [6, 22], [8, 15], [10, 12]]],
    [30, [[12, 32], [15, 26], [20, 19], [25, 12], [30, 8], [40, 3]]],
    [8, [[50, 480], [60, 280], [75, 150], [100, 80], [150, 36], [250, 14], [500, 6], [1000, 2.4], [2500, 0.8], [CAPX, 0.15]]]],
  fr: [[62, [[12, 38], [15, 27], [20, 19], [25, 10], [30, 6]]],
    [30, [[40, 38], [50, 27], [60, 17], [75, 10], [100, 6], [150, 2.5]]],
    [8, [[150, 500], [200, 280], [250, 140], [300, 76], [500, 36], [750, 16], [1000, 8], [2000, 3.5], [5000, 1.3], [CAPX, 0.3]]]],
};
// Price of a bought fishing, in × the chip (no lightning on a bought fishing): ≈ 88 %.
const PRICE = { fb: 8.75, fo: 17.4, fr: 52 };
// every draw takes its random source R (Math.random, or the shared seed of an online table)
function strikes(R = Math.random) {
  const pos = new Set(); while (pos.size < STRIKES) pos.add(Math.floor(R() * NS));
  return [...pos].map((i) => ({ i, m: wpickR(R, SEGS[i][0] === 'f' ? LF : LN) }));
}
// The fish on the hook: its size (1 rod, 2 crane, 3 helicopter) and its multiplier.
function fishDraw(k, R = Math.random) {
  const T = FISH[k], t = wpickR(R, T.map((x, i) => [i, x[0]]));
  return { size: t + 1, M: wpickR(R, T[t][1]) };
}
// A whole round drawn in advance (the same for every player of an online table): lightning, case, and the fish.
function outcome(R = Math.random) {
  const hits = strikes(R), idx = Math.floor(R() * NS), seg = SEGS[idx], L = hits.find((h) => h.i === idx)?.m || 1;
  const O = { hits, idx, seg, L };
  if (seg[0] === 'f') Object.assign(O, fishDraw(seg, R));
  return O;
}
// What a set of bets returns on that round.
function payout(O, bets) {
  const b = bets[O.seg] || 0;
  if (!b) return { ret: 0, M: 0, cap: false };
  const M = O.seg[0] === 'f' ? O.M : 2;
  let ret = b * M * O.L, cap = false;
  if (ret >= b * CAPX) { ret = b * CAPX; cap = true; }
  return { ret, M, cap };
}
/* ===END ENGINE */

// The owner's art (assets/games/peche/): painted fish (fb fo fr), the glass wheel (roue.webp = scene, roue-disc.webp =
// turning disc, roue-top.webp = pointer and hub) and the 9 fishing videos <fish>-<size>.mp4 (+ poster .webp).
const IMG_V = 2;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images and videos are inlined
const src = (n) => asset(`assets/games/peche/${n}.webp`);
const vidSrc = (k, n) => asset(`assets/games/peche/${k}-${n}.mp4`);
const fishImg = (k, cls = 'pe-ico') => `<img class="${cls}" src="${src(k)}" alt="" draggable="false">`;
const COL = { w: '#dbeafe', s: '#1e3a8a', fb: '#2563eb', fo: '#f97316', fr: '#dc2626' };
const TINT = { fb: '#38bdf8', fo: '#fb923c', fr: '#f43f5e' };
const NAME = { w: '×2 glace', s: '×2 nuit', fb: 'Poisson bleu', fo: 'Poisson orange', fr: 'Poisson rouge' };
const SPOTS = ['w', 's', 'fb', 'fo', 'fr'];
const lo = (k) => FISH[k][0][1][0][0];
const hiShown = (k) => FISH[k][2][1].at(-2)[0]; // biggest multiplier before the max win
const RANGE = Object.fromEntries(['fb', 'fo', 'fr'].map((k) => [k, `×${lo(k)} à ×${hiShown(k).toLocaleString('fr-FR')}`]));
// the three sizes: how the fish comes out of the ice hole, and the length of its video (s)
const SIZES = [null,
  { t: 'PETIT POISSON', how: 'à la canne', ico: '🎣', say: 'Ça mord ! Le pêcheur remonte sa ligne…', dur: 6 },
  { t: 'POISSON MOYEN', how: 'à la grue', ico: '🏗️', say: 'Trop lourd pour la canne : la grue le sort !', dur: 6 },
  { t: 'GROS POISSON', how: 'à l’hélicoptère', ico: '🚁', say: '😱 Un monstre ! Il faut un hélicoptère…', dur: 8 }];
const label = (k) => (k[0] === 'f' ? fishImg(k) : '×2');
const pt = (a, r) => { const t = ((a - 90) * Math.PI) / 180; return [150 + r * Math.cos(t), 150 + r * Math.sin(t)]; };
const slicePath = (i, r = 150) => { const p0 = pt(i * A, r), p1 = pt((i + 1) * A, r); return `M150 150 L${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${r} ${r} 0 0 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} Z`; };
const xs = (m) => m.toLocaleString('fr-FR');
const mx = (m) => (m >= CAPX ? 'MAX WIN' : `×${xs(m)}`);
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// The glass disc (roue-disc.webp turns with the cases drawn on it) + what each case shows: ×2, or a fish on a coloured glow.
function wheelSVG() {
  let s = `<g class="pe-wheel"><image href="${src('roue-disc')}" x="0" y="0" width="300" height="300"/>`;
  for (let i = 0; i < NS; i++) {
    const k = SEGS[i], ang = ((i + 0.5) * A).toFixed(2);
    if (k[0] === 'f') {
      s += `<path d="${slicePath(i, 148)}" fill="${TINT[k]}" opacity=".45"/>`;
      s += `<g transform="rotate(${ang} 150 150) translate(150 34) rotate(90) scale(.52)"><image href="${src(k)}" x="-34" y="-17" width="68" height="34" preserveAspectRatio="xMidYMid meet"/></g>`;
    } else s += `<text x="150" y="31" text-anchor="middle" font-family="KeCoin,'Bebas Neue',Impact,sans-serif" font-size="14" fill="#fff" stroke="${k === 'w' ? '#1e3a8a' : '#020617'}" stroke-width="2.4" paint-order="stroke" transform="rotate(${ang} 150 150)">×2</text>`;
  }
  return `<svg class="pe-svg" viewBox="0 0 300 300">${s}<g class="pe-bolts"></g></g></svg>`;
}

function tick(v) {
  if (isMuted()) return;
  const ac = audioContext(); if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'triangle'; o.frequency.value = 2200 + Math.random() * 400; // glass
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.06);
}

class PecheGame extends BaseGame {
  constructor(root, game, ov) {
    super(root, game, mergeOpts(ov, {
      music: EXTRA_THEMES.peche, stepper: false, autoplay: true, mainLabel: 'LANCER', betLabel: 'Mise totale',
      cls: 'table-game peche',
      head: '<div class="hist pt-hist pe-hist"></div>',
      // the fishing of each colour, bought at the chip chosen on the table (get bet)
      buys: ov?.online ? [] : ['fb', 'fo', 'fr'].map((k) => ({ id: k, icon: '🎣', label: `Pêche au ${NAME[k].toLowerCase()} · ${PRICE[k].toLocaleString('fr-FR')} × ton jeton`, desc: `Petit, moyen ou gros poisson au hasard : ${RANGE[k]}, gros poisson jusqu’au MAX WIN`, cost: (b) => Math.round(b * PRICE[k]) })),
      stage: `<div class="pe-view">${ov?.online ? '' : '<button class="pe-big" type="button" data-act="full">⛶ <span>Grand écran</span></button>'}
          <div class="pe-zone"><img class="pe-scene" src="${src('roue')}" alt="" draggable="false">
            <div class="pe-disc">${wheelSVG()}<div class="pe-flash"></div></div>
            <img class="pe-top" src="${src('roue-top')}" alt="" draggable="false"><i class="pe-ptr"></i><div class="pe-hub"></div></div>
          <div class="pe-bonus" hidden>
            <video class="pe-vid" muted playsinline preload="none" disablepictureinpicture></video>
            <div class="pe-btop"><h3 class="pe-title"></h3><div class="pe-size"></div></div>
            <div class="pe-say"></div>
            <div class="pe-plate"><small>MULTIPLICATEUR</small><b class="pe-mult">×?</b></div>
          </div>
        </div>`,
      below: `<div class="felt pe-felt"><div class="pt-spots pe-spots">${SPOTS.map((k) => `<button class="pt-spot pe-spot ${k}" data-k="${k}" style="--sc:${COL[k]}"><b>${label(k)}</b><small data-n="${k[0] === 'f' ? NAME[k].split(' ')[1] : ''}">${k[0] === 'f' ? `${NAME[k]} · ${RANGE[k]}` : NAME[k]}</small></button>`).join('')}</div>
        <p class="pt-note pe-note">⚡<span>À chaque lancer, <b>4 éclairs</b> frappent la roue : la case touchée est multipliée (jusqu’à ×10 sur les ×2, ×5 sur les poissons).</span></p>${BetBoard.chipsHTML(ov?.online ? '' : '<button class="pe-buy" type="button">🎣 Acheter une pêche</button>')}</div>`,
      hello: 'Mise sur ×2 glace, ×2 nuit ou un poisson, puis lance la roue.',
    }));
    this.cur = 0; this.histArr = [];
    this.board = new BetBoard(this, this.q('.pe-felt'), null);
    this.board.paint();
    this.wheel = this.q('.pe-wheel');
    this.q('.pe-buy')?.addEventListener('click', () => { if (!this.busy) this.openMenu(); });
    ['fb', 'fo', 'fr', 'roue-disc', 'roue-top'].forEach((n) => { new Image().src = src(n); });
  }

  // a bought fishing costs PRICE × the chip chosen on the table
  get bet() { return this.board?.chip || 100; }
  destroy() { const v = this.q('.pe-vid'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); } super.destroy(); }
  stakeLabel() { return this.board ? this.board.total() : 0; }
  chipSound() { sfx.click(); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = !this.auto && (this.busy || !this.board?.total()); }

  histAdd(seg, m) {
    this.histArr.unshift([seg, m]); this.histArr = this.histArr.slice(0, 12);
    this.q('.pe-hist').innerHTML = this.histArr.map(([s, mm]) => `<span style="background:${COL[s]};color:${s === 'w' ? '#0f172a' : '#fff'}">${s[0] === 'f' ? fishImg(s, 'pe-hico') : '×2'}${mm > 1 ? `<em>⚡${mm}</em>` : ''}</span>`).join('');
  }

  // The wheel turns like in the owner's video (a short start, then a long slow-down) and stops on case idx, at a
  // random place inside it.
  spin(idx) {
    const from = this.cur, delta = ((-(idx + 0.5) * A - from) % 360 + 360) % 360;
    const to = from + 360 * (this.turbo ? 3 : 6) + delta + (Math.random() - 0.5) * A * 0.7;
    this.cur = to;
    const T = this.turbo ? 3000 : 7200, glint = this.q('.pe-ptr');
    const ease = (p) => (1 - Math.pow(1 - p, 3.4)) * (1 - Math.exp(-p * 22)) / (1 - Math.exp(-22));
    return new Promise((res) => {
      let t0 = null, lastN = Math.floor(from / A);
      const frame = (ts) => {
        if (this.dead) return res();
        if (t0 === null) t0 = ts;
        const p = Math.min(1, (ts - t0) / T), a = from + (to - from) * ease(p);
        this.wheel.style.transform = `rotate(${a}deg)`;
        const n = Math.floor(a / A);
        if (n !== lastN) { lastN = n; tick(p > 0.7 ? 0.12 : 0.035); if (p > 0.55) glint.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 }); }
        if (p < 1) requestAnimationFrame(frame); else res();
      };
      requestAnimationFrame(frame);
    });
  }

  // Lightning: bolts hit 4 cases, which keep a ×N badge for this spin.
  async lightning(list) {
    const g = this.q('.pe-bolts'), fl = this.q('.pe-flash');
    g.innerHTML = '';
    for (const { i, m } of list) {
      const ang = ((i + 0.5) * A).toFixed(2), fish = SEGS[i][0] === 'f';
      g.insertAdjacentHTML('beforeend', `<g class="pe-strike" transform="rotate(${ang} 150 150)"><path d="${slicePath(i)}" transform="rotate(${-ang} 150 150)" fill="#fde047" opacity=".5"/>
        <circle cx="150" cy="${fish ? 72 : 60}" r="11" fill="#fde047" stroke="#713f12" stroke-width="2"/><text x="150" y="${fish ? 76.5 : 64.5}" text-anchor="middle" font-family="KeCoin,Archivo,sans-serif" font-weight="900" font-size="10" fill="#713f12">×${m}</text></g>`);
      fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
      sfx.tease?.() || sfx.click();
      const p = center(this.q('.pe-disc')); fx.burst(p.x, p.y - 60, 16, ['#fde047', '#fff', '#7dd3fc'], 6);
      await this.wait(420);
    }
  }

  onMain() {
    // automatic spins: the last bets go back on the table for each spin
    if (!this.board.total() && this.auto) { this.board.rebet(true); this.board.paint(); }
    if (!this.board.total()) { this.stopAuto(); return; }
    this.round(async () => {
      const placed = {}, tt = this.board.total();
      SPOTS.forEach((k) => { placed[k] = this.board.bets[k] || 0; });
      if (!this.pay(tt)) return;
      this.lastStake = tt;
      this.board.last = Object.fromEntries(Object.entries(placed).filter(([, v]) => v));
      this.focusStage();
      this.setLast(0); this.winAmt.textContent = '';
      await this.play(outcome(), placed);
      this.board.afterRound();
    });
  }

  // A bought fishing ("Bonus & menu"): straight to the ice hole, at the chip chosen on the table.
  async onBuy(k) {
    const stake = this.bet, O = { seg: k, L: 1, ...fishDraw(k) };
    this.focusStage(); this.setLast(0); this.winAmt.textContent = '';
    this.msg(`${NAME[k]} acheté ! Direction le trou dans la glace…`);
    this.q('.pe-hub').innerHTML = fishImg(k, 'pe-hubfish');
    await this.fishing(k, 1, O);
    if (this.dead) return;
    const { ret, cap } = payout(O, { [k]: stake });
    this.msg(`${NAME[k]} : ${mx(O.M)} → ${fmtC(ret)}${cap ? ' · GAIN MAXIMUM !' : ''}`);
    this.win(ret, NAME[k]); this.setLast(ret);
    await this.celebrate(ret, { summary: NAME[k].toUpperCase(), stake });
    this.q('.pe-hub').innerHTML = '';
  }

  // Plays a drawn round on screen (lightning, wheel, fishing) and pays the bets in `placed`.
  async play(O, placed) {
    this.qa('.pe-spot').forEach((b) => b.classList.remove('hit'));
    this.q('.pt-hl')?.remove();
    this.q('.pe-hub').innerHTML = '⚡';
    this.msg('Les éclairs frappent la roue…');
    const fishing = O.seg[0] === 'f' && ((placed[O.seg] || 0) > 0 || this.online);
    if (fishing) this.loadVid(O.seg, O.size); // the video arrives while the wheel turns
    await this.lightning(O.hits);
    if (this.dead) return 0;
    this.msg('La roue tourne…');
    this.q('.pe-hub').innerHTML = '';
    const idx = O.idx, seg = O.seg, L = O.L;
    await this.spin(idx);
    if (this.dead) return 0;
    this.histAdd(seg, L);
    this.wheel.insertAdjacentHTML('beforeend', `<path class="pt-hl" d="${slicePath(idx)}" fill="#fff"/>`);
    this.q('.pe-hub').innerHTML = seg[0] === 'f' ? fishImg(seg, 'pe-hubfish') : '<b class="big">×2</b>';
    if (L > 1) { this.q('.pe-hub').insertAdjacentHTML('beforeend', `<em class="pe-lx">⚡×${L}</em>`); sfx.upgrade?.(); }
    const p = center(this.q('.pe-ptr')); fx.burst(p.x, p.y + 20, 30, [COL[seg], '#fff']);
    this.q(`.pe-spot[data-k="${seg}"]`)?.classList.add('hit');
    const b = placed[seg] || 0;
    if (seg[0] === 'f' && b > 0) dispatchEvent(new CustomEvent('sb:bonus', { detail: { game: this.game.id, key: seg } })); // Défi spécial (special.js)
    // the fishing is played when there is a stake on the fish (always at an online table: everyone watches)
    if (fishing) { this.msg(`${NAME[seg]} ! Direction le trou dans la glace…`); await this.wait(900); await this.fishing(seg, L, O); if (this.dead) return 0; }
    const { ret, M, cap } = payout(O, placed);
    const all = Object.values(placed).reduce((a, x) => a + x, 0);
    this.msg((b ? `${NAME[seg]} : ${mx(M)}${L > 1 ? ` · éclair ×${L}` : ''} → ${fmtC(ret)}${cap ? ' · GAIN MAXIMUM !' : ''}` : `La roue s’arrête sur ${NAME[seg]}.${all ? ' Pas de mise dessus.' : ''}`) + (all ? ` · Bilan : ${ret - all >= 0 ? '+' : '−'}${fmtC(Math.abs(ret - all))}` : ''));
    if (ret > 0) {
      this.win(ret, seg[0] === 'f' ? NAME[seg] : null);
      this.setLast(ret);
      if (ret > b) await this.celebrate(ret, { summary: seg[0] === 'f' ? NAME[seg].toUpperCase() : null, quick: this.online });
    }
    return ret;
  }

  /* ---------- fishing bonus: the owner's videos ---------- */
  loadVid(k, n) {
    const v = this.q('.pe-vid'), want = vidSrc(k, n);
    if (v.dataset.v === want) return;
    v.dataset.v = want; v.poster = src(`${k}-${n}`); v.preload = 'auto'; v.src = want;
    try { v.load(); } catch { /* ignore */ }
  }

  // Plays the video to its end (or a time limit: a slow phone, a video that does not start).
  playVid(n) {
    const v = this.q('.pe-vid'), rate = this.turbo ? 1.5 : 1, lim = (SIZES[n].dur * 1000) / rate + 2500;
    return new Promise((res) => {
      let t = 0;
      const done = () => { clearTimeout(t); v.onended = null; res(); };
      if (calm()) { t = setTimeout(done, 2600); return; } // reduced motion: the poster only
      v.onended = done; t = setTimeout(done, lim);
      try {
        v.currentTime = 0; v.playbackRate = rate;
        v.play()?.catch?.(() => { clearTimeout(t); t = setTimeout(done, 2600); });
      } catch { clearTimeout(t); t = setTimeout(done, 2600); }
    });
  }

  async fishing(k, L, O) {
    const { size, M } = O, S = SIZES[size], vals = FISH[k][size - 1][1].map((x) => x[0]).filter((x) => x < CAPX);
    const box = this.q('.pe-bonus'), zone = this.q('.pe-zone'), plate = this.q('.pe-mult');
    this.loadVid(k, size);
    box.style.setProperty('--fc', TINT[k]);
    this.q('.pe-title').innerHTML = `${fishImg(k, 'pe-tico')} ${NAME[k].toUpperCase()}${L > 1 ? ` <em>⚡×${L}</em>` : ''}`;
    this.q('.pe-size').innerHTML = `${S.ico} ${S.t} <small>${S.how}</small>`;
    this.q('.pe-size').className = `pe-size z${size}`;
    this.q('.pe-say').textContent = S.say;
    plate.textContent = '×?'; plate.parentElement.classList.remove('done', 'max');
    zone.hidden = true; box.hidden = false;
    box.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'ease-out' });
    const br = box.getBoundingClientRect();
    if (br.top < 60 || br.bottom > innerHeight - 20) scrollBy({ top: br.top - 70, behavior: 'smooth' });
    sfx.feature(); if (size === 3) setTimeout(() => !this.dead && sfx.bigWin?.(), 600);
    // while the fish comes out, the multiplier rolls through the values of its size, slower and slower
    let rolling = true;
    const t0 = performance.now(), est = (S.dur * 1000) / (this.turbo ? 1.5 : 1);
    (async () => {
      let last = 0;
      while (rolling && !this.dead) {
        let v; do v = vals[Math.floor(Math.random() * vals.length)]; while (vals.length > 1 && v === last);
        last = v; plate.textContent = `×${xs(v)}`;
        if (Math.random() < 0.5) sfx.tick?.();
        const p = Math.min(1, (performance.now() - t0) / est);
        await this.wait(70 + 330 * p * p);
      }
    })();
    await this.playVid(size);
    rolling = false;
    if (this.dead) return M;
    // caught: the multiplier lands
    plate.textContent = mx(M);
    plate.parentElement.classList.add('done'); if (M >= CAPX) plate.parentElement.classList.add('max');
    plate.parentElement.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    const c = center(plate);
    fx.burst(c.x, c.y, 30 + size * 25, ['#fde047', '#fff', TINT[k], '#7dd3fc'], 8);
    if (L > 1) fx.floatText(c.x, c.y - 40, `⚡×${L}`, '#fde047', 30);
    size >= 2 || M >= 10 ? sfx.bigWin() : sfx.win();
    this.q('.pe-say').innerHTML = M >= CAPX ? '💰 MAX WIN ! Le poisson du siècle !' : `Pris ! Un poisson à <b>×${xs(M)}</b>${L > 1 ? ` · éclair ×${L} = <b>×${xs(Math.min(CAPX, M * L))}</b>` : ''}`;
    await this.wait(this.turbo ? 1400 : 2400);
    box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    await this.wait(280);
    if (this.dead) return M;
    this.q('.pe-vid').pause();
    box.hidden = true; zone.hidden = false;
    zone.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    return M;
  }

  info() {
    const t = (k) => FISH[k].map(([, l], i) => `${SIZES[i + 1].ico} ${l.filter(([v]) => v < CAPX).map(([v]) => `×${xs(v)}`).join(' · ')}${i === 2 ? ' · MAX WIN' : ''}`).join('<br>');
    return this.rules(`<h4>La roue</h4><p>Une roue en verre de 54 cases : 22 × <b>×2 glace</b> (verre clair), 22 × <b>×2 nuit</b> (verre foncé), 6 × <b>poisson bleu</b>, 3 × <b>poisson orange</b> et 1 × <b>poisson rouge</b>. Elle s’arrête au hasard sur n’importe quelle case. Les cases ×2 rendent 2 fois la mise posée dessus.</p>
      <h4>Les éclairs</h4><p>Avant chaque lancer, 4 éclairs frappent 4 cases : sur une case ×2 l’éclair vaut ×2, ×3, ×5 ou ×10 ; sur un poisson ×2, ×3 ou ×5. Si la roue s’arrête sur une case frappée, le gain est multiplié.</p>
      <h4>La pêche</h4><p>Sur un poisson, direction le trou dans la glace. La taille du poisson est tirée au hasard : <b>🎣 petit poisson</b> pêché à la canne = petit multiplicateur, <b>🏗️ poisson moyen</b> sorti par la grue = multiplicateur moyen, <b>🚁 gros poisson</b> sorti par l’hélicoptère = le plus gros multiplicateur, jusqu’au <b>MAX WIN</b>. Ta mise sur ce poisson est payée son multiplicateur (× l’éclair).</p>
      <p class="muted small"><b>Bleu</b><br>${t('fb')}<br><b>Orange</b><br>${t('fo')}<br><b>Rouge</b><br>${t('fr')}</p>
      <h4>Acheter une pêche</h4><p>Bouton « 🎣 Acheter une pêche » (ou « Bonus & menu ») : la pêche du poisson choisi, tout de suite, au prix de ${PRICE.fb.toLocaleString('fr-FR')} (bleu), ${PRICE.fo.toLocaleString('fr-FR')} (orange) ou ${PRICE.fr.toLocaleString('fr-FR')} (rouge) fois le jeton choisi. La taille du poisson est tirée au hasard, comme sur la roue (sans éclair).</p>
      <h4>Équité</h4><p>Retour au joueur d’environ 95 % sur chaque case, environ 88 % pour une pêche achetée. Gain maximum ×${xs(CAPX)} la mise d’une case.</p>`);
  }
}

// La Pêche Online: the same lightning, wheel and fish for the whole salon (online.js, withRoom).
const PecheOnlineGame = withRoom(PecheGame, {
  cls: 'g-peche',
  outcome: (R) => outcome(R),
  payout: (O, d) => payout(O, d).ret,
  // lightning, spin, then the fishing video (the helicopter takes 2 s more) and the results
  resultMs: (O) => 16000 + (O.size ? 6500 + SIZES[O.size].dur * 1000 : 0),
  reset() { this.q('.pt-hl')?.remove(); this.qa('.pe-spot').forEach((b) => b.classList.remove('hit')); this.q('.pe-hub').innerHTML = ''; this.q('.pe-bolts').innerHTML = ''; },
  hello: 'Mise sur ×2 glace, ×2 nuit ou un poisson, puis appuie sur PRÊT : la roue part quand tout le salon est prêt.',
});

return { PecheGame, PecheOnlineGame, outcome };
})();
