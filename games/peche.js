// SpinBet Casino · PecheGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/peche.js ----
__mods['games/impl/peche.js'] = (() => {
// La Pêche: a money wheel of 54 cases. White and sky-blue cases pay ×2 the stake; the blue, orange and red fish
// open a fishing bonus: a pond full of fish showing multipliers (blue ×3 to ×100, orange ×8 to ×500, red ×20 to
// ×5 000) and the fisherman hooks one of them; the bigger the fish, the longer the fight. Before every spin, lightning
// strikes 4 cases of the wheel with a multiplier (fish included). Every spot returns about 95 %.

const { BaseGame, fmtC, wpick } = __mods['core/base.js'];
const { BetBoard } = __mods['core/roulette.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, audioContext, isMuted } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { mergeOpts, withRoom, wpickR } = __mods['online.js'];

/* ===ENGINE */
const SEG_COUNT = [['w', 22, 0.5], ['s', 22, 0.25], ['fb', 6, 0.4], ['fo', 3, 0.15], ['fr', 1, 0.66]];
const SEGS = SEG_COUNT.flatMap(([k, n, ph], j) => Array.from({ length: n }, (_, i) => ({ k, at: (i + ph) / n + j * 1e-4 }))).sort((a, b) => a.at - b.at).map((x) => x.k);
const NS = SEGS.length, A = 360 / NS; // 54 cases
const STRIKES = 4;
const LN = [[2, 55], [3, 25], [5, 13], [10, 7]]; // lightning on a ×2 case
const LF = [[2, 60], [3, 30], [5, 10]]; // lightning on a fish
// fish multipliers (× the stake) and their weights
const FISH = {
  fb: [[3, 2921], [4, 2089], [5, 1494], [6, 1069], [8, 764], [10, 547], [15, 391], [20, 280], [25, 200], [50, 143], [100, 102]],
  fo: [[8, 3690], [10, 2334], [12, 1476], [15, 934], [20, 591], [25, 374], [30, 236], [50, 149], [75, 95], [100, 60], [200, 38], [500, 24]],
  fr: [[20, 3923], [25, 2388], [30, 1454], [40, 885], [50, 539], [75, 328], [100, 200], [150, 121], [250, 74], [500, 45], [1000, 27], [5000, 17]],
};
// The painted pond (assets/games/peche/pond.webp, 1600 × 729) has 10 glowing rings on the sand: one fish waits in each.
const POND_W = 1600, POND_H = 729;
const RINGS = [[510, 413, 74], [1012, 413, 74], [343, 472, 92], [805, 462, 96], [1235, 472, 92], [590, 540, 120], [1015, 540, 120], [258, 575, 118], [1355, 577, 118], [805, 640, 170]];
const POND = RINGS.length; // fish in the pond
const CAPX = 25000;
// every draw takes its random source R (Math.random, or the shared seed of an online table)
function strikes(R = Math.random) {
  const pos = new Set(); while (pos.size < STRIKES) pos.add(Math.floor(R() * NS));
  return [...pos].map((i) => ({ i, m: wpickR(R, SEGS[i][0] === 'f' ? LF : LN) }));
}
// The pond: POND fish drawn from the table; the fisherman hooks one of them at random.
function pond(k, R = Math.random) { return Array.from({ length: POND }, () => wpickR(R, FISH[k])); }
// A whole round drawn in advance (the same for every player of an online table): lightning, case, and the fish.
function outcome(R = Math.random) {
  const hits = strikes(R), idx = Math.floor(R() * NS), seg = SEGS[idx], L = hits.find((h) => h.i === idx)?.m || 1;
  const O = { hits, idx, seg, L };
  if (seg[0] === 'f') { O.vals = pond(seg, R); O.pick = Math.floor(R() * POND); }
  return O;
}
// What a set of bets returns on that round.
function payout(O, bets) {
  const b = bets[O.seg] || 0;
  if (!b) return { ret: 0, M: 0, cap: false };
  const M = O.vals ? O.vals[O.pick] : 2;
  let ret = b * M * O.L, cap = false;
  if (ret > b * CAPX) { ret = b * CAPX; cap = true; }
  return { ret, M, cap };
}
/* ===END ENGINE */

// Painted art by the owner (assets/games/peche/): fish, golden fish, fisherman (2 poses), float, wheel frame, hub, pond, room.
const IMG_V = 1;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images are inlined
const src = (n) => asset(`assets/games/peche/${n}.webp`);
const fishImg = (k, cls = 'pe-ico') => `<img class="${cls}" src="${src(k)}" alt="" draggable="false">`;
const FILL = { w: '#f8fafc', s: '#7dd3fc', fb: '#1e40af', fo: '#9a3412', fr: '#7f1d1d' };
const COL = { w: '#f8fafc', s: '#7dd3fc', fb: '#2563eb', fo: '#f97316', fr: '#dc2626' };
const NAME = { w: '×2 blanc', s: '×2 ciel', fb: 'Poisson bleu', fo: 'Poisson orange', fr: 'Poisson rouge' };
const RANGE = { fb: '×3 à ×100', fo: '×8 à ×500', fr: '×20 à ×5 000' };
const SPOTS = ['w', 's', 'fb', 'fo', 'fr'];
const fishSVG = (c, sz, txt = '') => `<svg viewBox="0 0 64 40" width="${sz}" height="${sz * 0.625}" aria-hidden="true"><path d="M50 20 L63 7 L60 20 L63 33 Z" fill="${c}" stroke="rgba(0,0,0,.4)" stroke-width="1.5"/>
  <ellipse cx="28" cy="20" rx="25" ry="15" fill="${c}" stroke="rgba(0,0,0,.4)" stroke-width="1.5"/><path d="M22 6 Q30 0 36 7" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>
  <ellipse cx="25" cy="25" rx="16" ry="6" fill="#fff" opacity=".25"/><circle cx="12" cy="16" r="3.6" fill="#fff"/><circle cx="11.2" cy="16" r="1.9" fill="#111"/>
  <path d="M5 23 Q8 25 11 23" stroke="#111" stroke-width="1.3" fill="none" stroke-linecap="round"/>${txt ? `<text x="30" y="24.5" text-anchor="middle" font-family="KeCoin,'Bebas Neue',Impact,sans-serif" font-size="13" fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="2.2" paint-order="stroke">${txt}</text>` : ''}</svg>`;
const label = (k) => (k[0] === 'f' ? fishImg(k) : '×2');
const pt = (a, r) => { const t = ((a - 90) * Math.PI) / 180; return [150 + r * Math.cos(t), 150 + r * Math.sin(t)]; };
const slicePath = (i, r = 146) => { const p0 = pt(i * A, r), p1 = pt((i + 1) * A, r); return `M150 150 L${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${r} ${r} 0 0 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} Z`; };
const xs = (m) => m.toLocaleString('fr-FR');

function wheelSVG() {
  let s = '<g class="pe-wheel">';
  for (let i = 0; i < NS; i++) {
    const k = SEGS[i], ang = ((i + 0.5) * A).toFixed(2);
    s += `<path d="${slicePath(i)}" fill="${FILL[k]}" stroke="#0b1626" stroke-width=".9"/>`;
    if (k[0] === 'f') s += `<g transform="rotate(${ang} 150 150) translate(150 30) rotate(90) scale(.42)"><image href="${src(k)}" x="-34" y="-17" width="68" height="34" preserveAspectRatio="xMidYMid meet"/></g>`;
    else s += `<text x="150" y="32" text-anchor="middle" font-family="KeCoin,'Bebas Neue',Impact,sans-serif" font-size="15" fill="${k === 'w' ? '#0f172a' : '#0c4a6e'}" transform="rotate(${ang} 150 150)">×2</text>`;
  }
  s += '<g class="pe-bolts"></g></g>';
  let bl = '';
  for (let b = 0; b < 48; b++) { const p = pt((b * 360) / 48, 148.5); bl += `<circle class="pt-bulb" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.5" fill="${b % 2 ? '#fff' : '#7dd3fc'}" style="animation-delay:${b % 2 ? '.5' : '0'}s"/>`; }
  return `<svg class="pt-svg" viewBox="0 0 300 300"><circle cx="150" cy="150" r="149.5" fill="#0b1626"/>${s}<g>${bl}</g><circle cx="150" cy="150" r="30" fill="#0c2a4a" stroke="#7dd3fc" stroke-width="3"/></svg>`;
}

const FISHER = () => `<img class="pe-f1" src="${src('fisher1')}" alt="" draggable="false"><img class="pe-f2" src="${src('fisher2')}" alt="" draggable="false"><i class="pe-rod"></i><i class="pe-arm"></i>`;

function tick(v) {
  if (isMuted()) return;
  const ac = audioContext(); if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = 1400 + Math.random() * 300;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.05);
}

class PecheGame extends BaseGame {
  constructor(root, game, ov) {
    super(root, game, mergeOpts(ov, {
      music: EXTRA_THEMES.peche, stepper: false, autoplay: true, mainLabel: 'LANCER', betLabel: 'Mise totale',
      cls: 'table-game peche',
      head: '<div class="hist pt-hist pe-hist"></div>',
      stage: `<div class="pe-view">
          <div class="pt-zone pe-zone"><div class="pt-ptr pe-ptr"><img src="${src('float')}" alt="" draggable="false"></div>${wheelSVG()}<img class="pe-frame" src="${src('frame')}" alt="" draggable="false"><div class="pt-hub pe-hub">LA<br>PÊCHE</div><div class="pe-flash"></div></div>
          <div class="pe-bonus" hidden>
            <div class="pe-sky"><div class="pe-sun"></div><div class="pe-fisher">${FISHER()}</div><h3 class="pe-title">PÊCHE AU POISSON BLEU</h3></div>
            <div class="pe-water"><div class="pe-waves"></div><div class="pe-fishes"></div><div class="pe-hook"></div></div>
            <svg class="pe-line" aria-hidden="true"><path d="" fill="none" stroke="#e2e8f0" stroke-width="1.6"/></svg>
            <div class="pe-say">Le pêcheur lance sa ligne…</div>
          </div>
        </div>`,
      below: `<div class="felt pe-felt"><div class="pt-spots pe-spots">${SPOTS.map((k) => `<button class="pt-spot pe-spot ${k}" data-k="${k}" style="--sc:${COL[k]}"><b>${label(k)}</b><small>${k[0] === 'f' ? `${NAME[k]} · ${RANGE[k]}` : NAME[k]}</small></button>`).join('')}</div>
        <p class="pt-note pe-note">⚡<span>À chaque lancer, <b>4 éclairs</b> frappent la roue : la case touchée est multipliée (jusqu’à ×10 sur les ×2, ×5 sur les poissons).</span></p>${BetBoard.chipsHTML()}</div>`,
      hello: 'Mise sur ×2 blanc, ×2 ciel ou un poisson, puis lance la roue.',
    }));
    this.cur = 0; this.histArr = [];
    this.board = new BetBoard(this, this.q('.pe-felt'), null);
    this.board.paint();
    this.wheel = this.q('.pe-wheel');
    ['fb', 'fo', 'fr', 'gold', 'fisher1', 'fisher2', 'pond'].forEach((n) => { new Image().src = src(n); });
  }

  stakeLabel() { return this.board ? this.board.total() : 0; }
  chipSound() { sfx.click(); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = !this.auto && (this.busy || !this.board?.total()); }

  histAdd(seg, m) {
    this.histArr.unshift([seg, m]); this.histArr = this.histArr.slice(0, 12);
    this.q('.pe-hist').innerHTML = this.histArr.map(([s, mm]) => `<span style="background:${COL[s]};color:${s === 'w' || s === 's' ? '#0f172a' : '#fff'}">${s[0] === 'f' ? fishImg(s, 'pe-hico') : '×2'}${mm > 1 ? `<em>⚡${mm}</em>` : ''}</span>`).join('');
  }

  spin(idx) {
    const from = this.cur, delta = ((-(idx + 0.5) * A - from) % 360 + 360) % 360;
    const to = from + 360 * (this.turbo ? 3 : 5) + delta + (Math.random() - 0.5) * A * 0.6;
    this.cur = to;
    const T = this.turbo ? 2600 : 5400, ptr = this.q('.pe-ptr');
    return new Promise((res) => {
      let t0 = null, lastN = Math.floor(from / A);
      const frame = (ts) => {
        if (this.dead) return res();
        if (t0 === null) t0 = ts;
        const p = Math.min(1, (ts - t0) / T), e = 1 - Math.pow(1 - p, 4), a = from + (to - from) * e;
        this.wheel.style.transform = `rotate(${a}deg)`;
        const n = Math.floor(a / A);
        if (n !== lastN) { lastN = n; tick(p > 0.7 ? 0.16 : 0.05); ptr.animate([{ transform: 'translateX(-50%) rotate(-16deg)' }, { transform: 'translateX(-50%)' }], { duration: 140 }); }
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
      g.insertAdjacentHTML('beforeend', `<g class="pe-strike" transform="rotate(${ang} 150 150)"><path d="${slicePath(i)}" transform="rotate(${-ang} 150 150)" fill="#fde047" opacity=".55"/>
        <circle cx="150" cy="${fish ? 74 : 62}" r="11" fill="#fde047" stroke="#713f12" stroke-width="2"/><text x="150" y="${fish ? 78.5 : 66.5}" text-anchor="middle" font-family="KeCoin,Archivo,sans-serif" font-weight="900" font-size="10" fill="#713f12">×${m}</text></g>`);
      fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
      sfx.tease?.() || sfx.click();
      const p = center(this.q('.pe-zone')); fx.burst(p.x, p.y - 60, 16, ['#fde047', '#fff', '#7dd3fc'], 6);
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

  // Plays a drawn round on screen (lightning, wheel, fishing) and pays the bets in `placed`.
  async play(O, placed) {
    this.qa('.pe-spot').forEach((b) => b.classList.remove('hit'));
    this.q('.pt-hl')?.remove();
    this.q('.pe-hub').innerHTML = '⚡';
    this.msg('Les éclairs frappent la roue…');
    await this.lightning(O.hits);
    if (this.dead) return 0;
    this.msg('La roue tourne…');
    this.q('.pe-hub').innerHTML = 'BONNE<br>PÊCHE';
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
    if (seg[0] === 'f' && (b > 0 || this.online)) { this.msg(`${NAME[seg]} ! Direction l’étang…`); await this.wait(900); await this.fishing(seg, L, O); if (this.dead) return 0; }
    const { ret, M, cap } = payout(O, placed);
    const all = Object.values(placed).reduce((a, x) => a + x, 0);
    this.msg((b ? `${NAME[seg]} : ×${xs(M)}${L > 1 ? ` · éclair ×${L}` : ''} → ${fmtC(ret)}${cap ? ' · GAIN MAXIMUM !' : ''}` : `La roue s’arrête sur ${NAME[seg]}.${all ? ' Pas de mise dessus.' : ''}`) + (all ? ` · Bilan : ${ret - all >= 0 ? '+' : '−'}${fmtC(Math.abs(ret - all))}` : ''));
    if (ret > 0) {
      this.win(ret, seg[0] === 'f' ? NAME[seg] : null);
      this.setLast(ret);
      if (ret > b) await this.celebrate(ret, { summary: seg[0] === 'f' ? NAME[seg].toUpperCase() : null, quick: this.online });
    }
    return ret;
  }

  /* ---------- fishing bonus ---------- */
  async fishing(k, L, O = null) {
    const vals = O ? O.vals : pond(k), pick = O ? O.pick : Math.floor(Math.random() * POND), v = vals[pick];
    const box = this.q('.pe-bonus'), zone = this.q('.pe-zone'), water = this.q('.pe-water'), list = this.q('.pe-fishes');
    const range = FISH[k], lo = range[0][0], hi = range[range.length - 1][0];
    const grow = (x) => 0.85 + 0.35 * (Math.log(x / lo + 1) / Math.log(hi / lo + 1)); // bigger multiplier, bigger fish
    this.q('.pe-title').innerHTML = `PÊCHE AU ${NAME[k].toUpperCase()}${L > 1 ? ` · ⚡×${L}` : ''}`;
    zone.hidden = true; box.hidden = false;
    // the pond is drawn with background-size: cover, centred: map each painted ring to the box
    const bw = box.clientWidth, bh = box.clientHeight, sc = Math.max(bw / POND_W, bh / POND_H);
    const ox = (bw - POND_W * sc) / 2, oy = (bh - POND_H * sc) / 2;
    list.innerHTML = vals.map((x, i) => {
      const [cx, cy, rx] = RINGS[i], w = Math.round(rx * 1.5 * sc * grow(x)), h = Math.round(w * 0.62);
      const left = Math.round(ox + cx * sc - w / 2), top = Math.round(oy + cy * sc - h * 0.85);
      return `<div class="pe-fish${x >= 100 ? ' gold' : ''}" data-i="${i}" style="left:${left}px;top:${top}px;--w:${w}px;--del:-${((i * 0.37) % 2.4).toFixed(2)}s;--dir:${cx > POND_W / 2 ? -1 : 1}">${fishImg(x >= 100 ? 'gold' : k, 'pe-fimg')}<b>×${xs(x)}</b></div>`;
    }).join('');
    box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
    const br = box.getBoundingClientRect();
    if (br.top < 60 || br.bottom > innerHeight - 20) scrollBy({ top: br.top - 70, behavior: 'smooth' });
    sfx.feature(); fx.confetti(40);
    const say = (t) => { this.q('.pe-say').innerHTML = t; };
    say(`${POND} poissons dans l’étang (${RANGE[k]}). Le pêcheur lance sa ligne…`);
    await this.wait(1600);
    if (this.dead) return 0;
    // the hook drifts over a few fish (teasing), then bites the chosen one
    const fishEls = this.qa('.pe-fish'), target = fishEls[pick];
    const others = fishEls.filter((_, i) => i !== pick).sort(() => Math.random() - 0.5).slice(0, 3);
    this.q('.pe-arm').classList.add('cast');
    for (const f of [...others, target]) {
      await this.hookTo(f, 520);
      if (this.dead) return 0;
      sfx.tick();
      await this.wait(f === target ? 200 : 380);
    }
    // hooked: the fish stops swimming and fights; the bigger it is, the longer it takes
    const wr = water.getBoundingClientRect(), fr = target.getBoundingClientRect();
    target.style.animation = 'none';
    target.style.left = `${fr.left - wr.left}px`; target.style.top = `${fr.top - wr.top}px`;
    target.classList.add('hooked');
    this.q('.pe-hook').hidden = true;
    fishEls.forEach((f) => { if (f !== target) f.classList.add('flee'); });
    const fight = (1800 + 4200 * (Math.log(v / lo + 1) / Math.log(hi / lo + 1))) * (this.turbo ? 0.5 : 1);
    say(v >= hi / 4 ? '😱 Énorme poisson ! Il se débat…' : v >= hi / 20 ? 'Un beau poisson ! Ça tire…' : 'Ça mord !');
    this.q('.pe-arm').classList.remove('cast'); this.q('.pe-arm').classList.add('reel');
    const tip = () => { const r = this.q('.pe-rod').getBoundingClientRect(); return { x: r.right - wr.left, y: r.top - wr.top }; };
    const start = { x: fr.left - wr.left, y: fr.top - wr.top }, t0 = performance.now();
    await new Promise((res) => {
      const step = (ts) => {
        if (this.dead) return res();
        const p = Math.min(1, (ts - t0) / fight), e = p < 0.85 ? p * 0.55 / 0.85 : 0.55 + ((p - 0.85) / 0.15) * 0.45, tp = tip();
        const wob = Math.sin(ts / 70) * 14 * (1 - p), x = start.x + (tp.x - 30 - start.x) * e + wob, y = start.y + (tp.y - start.y) * e + Math.cos(ts / 55) * 6 * (1 - p);
        target.style.left = `${x}px`; target.style.top = `${y}px`; target.style.rotate = `${wob * 1.5}deg`;
        this.drawLine(tp, { x: x + target.offsetWidth * 0.15, y: y + target.offsetHeight * 0.5 });
        if (Math.random() < 0.04) sfx.tick();
        if (p < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    if (this.dead) return 0;
    target.classList.add('caught');
    const c = center(target);
    fx.burst(c.x, c.y, 30 + Math.min(80, v / 10), ['#fde047', '#fff', COL[k], '#7dd3fc'], 8);
    fx.floatText(c.x, c.y - 30, `×${xs(v)}${L > 1 ? ` ⚡×${L}` : ''}`, '#fde047', 34);
    v >= hi / 20 ? sfx.bigWin() : sfx.win();
    say(`Pris ! Un poisson à <b>×${xs(v)}</b>${L > 1 ? ` · éclair ×${L} = <b>×${xs(v * L)}</b>` : ''}`);
    await this.wait(2200);
    box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    await this.wait(280);
    box.hidden = true; zone.hidden = false;
    zone.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    this.q('.pe-arm').classList.remove('reel');
    this.drawLine(null);
    return v;
  }

  hookTo(fish, ms) {
    const water = this.q('.pe-water'), hook = this.q('.pe-hook'), wr = water.getBoundingClientRect(), r = fish.getBoundingClientRect();
    const x = r.left - wr.left + r.width * 0.2, y = r.top - wr.top + r.height * 0.45;
    const from = { x: parseFloat(hook.style.left) || wr.width * 0.3, y: parseFloat(hook.style.top) || 0 }, t0 = performance.now();
    hook.hidden = false;
    return new Promise((res) => {
      const step = (ts) => {
        if (this.dead) return res();
        const p = Math.min(1, (ts - t0) / ms), e = p * p * (3 - 2 * p), hx = from.x + (x - from.x) * e, hy = from.y + (y - from.y) * e;
        hook.style.left = `${hx}px`; hook.style.top = `${hy}px`;
        const rr = this.q('.pe-rod').getBoundingClientRect();
        this.drawLine({ x: rr.right - wr.left, y: rr.top - wr.top }, { x: hx, y: hy });
        if (p < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }

  // Fishing line from the rod tip, in the water's coordinates (the svg covers the whole bonus box).
  drawLine(a, b) {
    const svg = this.q('.pe-line'), path = svg.querySelector('path');
    if (!a) { path.setAttribute('d', ''); this.q('.pe-hook').hidden = true; return; }
    const off = this.q('.pe-water').getBoundingClientRect(), sb = svg.getBoundingClientRect(), dx = off.left - sb.left, dy = off.top - sb.top;
    const ax = a.x + dx, ay = a.y + dy, bx = b.x + dx, by = b.y + dy;
    path.setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)} Q${((ax + bx) / 2).toFixed(1)} ${(Math.max(ay, by) + 20).toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`);
  }

  info() {
    const t = (k) => FISH[k].map(([v]) => `×${xs(v)}`).join(' · ');
    return this.rules(`<h4>La roue</h4><p>54 cases : 22 × <b>×2 blanc</b>, 22 × <b>×2 ciel</b>, 6 × <b>poisson bleu</b>, 3 × <b>poisson orange</b> et 1 × <b>poisson rouge</b>. Les cases ×2 rendent 2 fois la mise posée dessus.</p>
      <h4>Les éclairs</h4><p>Avant chaque lancer, 4 éclairs frappent 4 cases : sur une case ×2 l’éclair vaut ×2, ×3, ×5 ou ×10 ; sur un poisson ×2, ×3 ou ×5. Si la roue s’arrête sur une case frappée, le gain est multiplié.</p>
      <h4>La pêche</h4><p>Sur un poisson, on quitte la roue pour l’étang : ${POND} poissons y nagent avec leur multiplicateur. Le pêcheur en attrape un au hasard ; plus il est gros, plus il se débat longtemps. Ta mise sur ce poisson est payée son multiplicateur (× l’éclair).</p>
      <p class="muted small">Bleu : ${t('fb')}<br>Orange : ${t('fo')}<br>Rouge : ${t('fr')}</p>
      <h4>Équité</h4><p>Retour au joueur d’environ 95 % sur chaque case. Gain maximum ×${xs(CAPX)} la mise d’une case.</p>`);
  }
}

// La Pêche Online: the same lightning, wheel and fish for the whole salon (online.js, withRoom).
const PecheOnlineGame = withRoom(PecheGame, {
  cls: 'g-peche',
  outcome: (R) => outcome(R),
  payout: (O, d) => payout(O, d).ret,
  // lightning, spin, then the fishing (the bigger the fish, the longer the fight) and the results
  resultMs: (O) => 14000 + (O.vals ? 12000 + 2100 * Math.log(O.vals[O.pick] / FISH[O.seg][0][0] + 1) / Math.log(FISH[O.seg].at(-1)[0] / FISH[O.seg][0][0] + 1) : 0),
  reset() { this.q('.pt-hl')?.remove(); this.qa('.pe-spot').forEach((b) => b.classList.remove('hit')); this.q('.pe-hub').innerHTML = 'LA<br>PÊCHE'; this.q('.pe-bolts').innerHTML = ''; },
  hello: 'Mise sur ×2 blanc, ×2 ciel ou un poisson, puis appuie sur PRÊT : la roue part quand tout le salon est prêt.',
});

return { PecheGame, PecheOnlineGame, outcome };
})();
