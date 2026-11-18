// SpinBet Casino · SpeedballGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/speedball.js ----
__mods['games/impl/speedball.js'] = (() => {
// Le Speedball (demande du propriétaire du 18 novembre 2026, à la place du Super Keno) : sur sa vidéo (une présentatrice, une
// sphère pleine de boules, un tube en spirale), on achète des grilles de 5 × 5 (+1, +5, +10, +50, autant de fois qu'on veut,
// MAXG au plus) : elles tombent en pile les unes sur les autres. 20 boules blanches sortent (1 à 50), puis la boule dorée,
// le SPEEDBALL, avec son multiplicateur annoncé au départ. Chaque ligne, colonne ou diagonale complète paie (PAY selon le
// nombre de lignes de la grille), × le multiplicateur si le SPEEDBALL est dans une de ses lignes. La meilleure grille est
// toujours en haut de la pile (le numéro qui lui manque clignote) ; à la fin, la fenêtre « Mes grilles » les montre toutes.
// Simulation : node tools/sim/speedball.js (≈ 95 %).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, isMuted, duck } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { modal } = __mods['ui.js'];

/* ===ENGINE */
const N = 50, D = 20, MAXG = 200, CAPX = 50000;
// the 12 lines of a card (5 rows, 5 columns, 2 diagonals), cells 0..24 row by row
const LINES = [];
for (let r = 0; r < 5; r++) LINES.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
for (let c = 0; c < 5; c++) LINES.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
LINES.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
// what a card pays (× its stake) for its number of complete lines; × the SPEEDBALL multiplier when the gold ball is in one of them
const PAY = [0, 2, 12, 80, 300, 1000, 2500, 5000, 10000, 10000, 10000, 10000, 10000];
const MULT = [[2, 30], [3, 25], [5, 20], [10, 13], [20, 7], [50, 3.5], [100, 1.2], [200, 0.3]];
const pickW = (R, l) => { let t = 0; for (const x of l) t += x[1]; let q = R() * t; for (const x of l) { if (q < x[1]) return x[0]; q -= x[1]; } return l[l.length - 1][0]; };
// a card: column c holds 5 numbers among 10c+1 … 10c+10, the smallest on top
function makeCard(R = Math.random) {
  const g = new Array(25);
  for (let c = 0; c < 5; c++) {
    const a = Array.from({ length: 10 }, (_, i) => c * 10 + i + 1);
    for (let i = 0; i < 5; i++) { const j = i + Math.floor(R() * (10 - i)); [a[i], a[j]] = [a[j], a[i]]; }
    a.slice(0, 5).sort((x, y) => x - y).forEach((n, r) => { g[r * 5 + c] = n; });
  }
  return g;
}
// one draw: 20 white balls, then the gold SPEEDBALL (the 21st) and its multiplier
function draw(R = Math.random) {
  const a = Array.from({ length: N }, (_, i) => i + 1);
  for (let i = 0; i <= D; i++) { const j = i + Math.floor(R() * (N - i)); [a[i], a[j]] = [a[j], a[i]]; }
  return { balls: a.slice(0, D), gold: a[D], m: pickW(R, MULT) };
}
// a card against the balls out so far (set) and the gold ball (0 = not out yet): its lines, its best unfinished line (k / 5)
// and the cells it misses, its cells in a complete line, the gold ball in one of them
function cardState(g, set, gold = 0) {
  let lines = 0, best = 0, inGold = false, hits = 0; const hot = new Set(), miss = new Set();
  for (const n of g) if (set.has(n)) hits++;
  for (const l of LINES) {
    let k = 0; for (const i of l) if (set.has(g[i])) k++;
    if (k === 5) { lines++; l.forEach((i) => hot.add(i)); if (gold && l.some((i) => g[i] === gold)) inGold = true; }
    else if (k > best) best = k;
    if (k === 4) l.forEach((i) => { if (!set.has(g[i])) miss.add(i); });
  }
  return { lines, best, hits, inGold, hot, miss, score: lines * 1000 + best * 100 + hits };
}
// what a card returns (× its stake) on a whole draw
function cardResult(g, O) {
  const set = new Set(O.balls); set.add(O.gold);
  const s = cardState(g, set, O.gold);
  s.base = PAY[s.lines] || 0;
  s.x = Math.min(CAPX, s.base * (s.inGold ? O.m : 1));
  return s;
}
/* ===END ENGINE */

// her video (tools/art/speedball/build.py): tirage.mp4 starts 3 s into it; the wide shot until CUT, then the close-up on the tube
const LOOP = 165 / 24, CUT = 4.875;
const BT = [0.7, 1.25, 1.8, 2.35, 2.9, 3.45, 4.0, 4.55, 5.3, 5.8, 6.3, 6.8, 7.3, 7.8, 8.3, 8.8, 9.3, 9.8, 10.3, 10.8]; // the 20 white balls
const GOLD_T = 11.5, END_T = 12.05;
const asset = (p) => window.__assets?.[p] || `${p}?v=1`;
const store = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const xs = (v) => `×${Number(v).toLocaleString('fr-FR')}`;
const okCard = (g) => Array.isArray(g) && g.length === 25 && g.every((n, i) => n >= (i % 5) * 10 + 1 && n <= (i % 5) * 10 + 10);

// the board of the show, over hers (an arc in the video's pixels, 832 × 480): 2 rows of 10 balls, the counter, the SPEEDBALL plate
const CX = 421, CY = 464;
const pt = (r, a) => [CX + r * Math.sin(a * Math.PI / 180), CY - r * Math.cos(a * Math.PI / 180)];
const arc = (ro, ri, a) => { const [x0, y0] = pt(ro, -a), [x1, y1] = pt(ro, a), [x2, y2] = pt(ri, a), [x3, y3] = pt(ri, -a); return `M${x0} ${y0}A${ro} ${ro} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 0 0 ${x3} ${y3}Z`; };
const SLOTS = Array.from({ length: D }, (_, i) => { const row = i < 10 ? 0 : 1, k = i % 10; return pt(row ? 392 : 426, -22.5 + k * 5); });
const ballG = (x, y, r, cls) => `<g class="${cls}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle class="h" r="${r}"/><circle class="b" r="${r}"/><text y="${(r * 0.36).toFixed(1)}" font-size="${(r * 1.02).toFixed(1)}"></text></g>`;
const HUD = `<svg class="sbx-hud" viewBox="0 0 832 480" aria-hidden="true">
  <defs>
    <linearGradient id="sbNavy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2a4e"/><stop offset="1" stop-color="#0b1330"/></linearGradient>
    <linearGradient id="sbGoldE" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b8"/><stop offset=".5" stop-color="#e7b24a"/><stop offset="1" stop-color="#8a5a12"/></linearGradient>
    <radialGradient id="sbBall" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#f3eee2"/><stop offset="1" stop-color="#b9b09c"/></radialGradient>
    <radialGradient id="sbGoldB" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#fff8cf"/><stop offset=".45" stop-color="#f2c14e"/><stop offset="1" stop-color="#8a5a12"/></radialGradient>
  </defs>
  <path class="sbx-arc" d="${arc(455, 365, 29.6)}" fill="url(#sbNavy)" stroke="url(#sbGoldE)" stroke-width="7" stroke-linejoin="round"/>
  <path d="${arc(447, 373, 28.6)}" fill="none" stroke="rgba(255,220,140,.22)" stroke-width="1.5" stroke-linejoin="round"/>
  ${SLOTS.map(([x, y], i) => ballG(x, y, 13, `sbx-sl s${i}`)).join('')}
  <g class="sbx-cnt"><rect x="168" y="10" width="92" height="54" rx="27" fill="url(#sbNavy)" stroke="url(#sbGoldE)" stroke-width="4"/>
    <text x="214" y="29" class="lab">BOULE</text><text x="214" y="55" class="big"><tspan class="cn">0</tspan><tspan class="of">/${D}</tspan></text></g>
  <g class="sbx-mp mp-l"><rect x="624" y="8" width="204" height="58" rx="29" fill="url(#sbNavy)" stroke="url(#sbGoldE)" stroke-width="4"/>
    <text x="706" y="29" class="lab">SPEEDBALL</text><text x="706" y="57" class="big mv">×?</text>${ballG(796, 37, 20, 'sbx-gold')}</g>
  <g class="sbx-mp mp-p"><rect x="586" y="8" width="150" height="58" rx="29" fill="url(#sbNavy)" stroke="url(#sbGoldE)" stroke-width="4"/>
    <text x="646" y="29" class="lab">SPEEDBALL</text><text x="646" y="57" class="big mv">×?</text>${ballG(709, 37, 20, 'sbx-gold')}</g>
</svg>`;

class SpeedballGame extends BaseGame {
  constructor(root, game, ov) {
    super(root, game, {
      music: EXTRA_THEMES.speedball, autoplay: true, mainLabel: 'LANCER', betLabel: 'Mise par grille', cls: 'table-game sb-game',
      head: '<div class="hist sb-hist"></div>',
      stage: `<div class="sbx sbx-l"><div class="sbx-art">
          <video class="sbx-vid" playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video>
          <video class="sbx-idle" playsinline muted preload="auto" disablepictureinpicture aria-hidden="true"></video>
          ${HUD}
          <b class="sbx-now"></b>
        </div>
        <div class="sbx-res"></div>
        <button class="plx-snd sbx-snd" type="button" aria-label="Son de l’émission"></button></div>`,
      below: `<div class="sb-panel">
          <button class="sb-deck" type="button" aria-label="Voir toutes mes grilles"><span class="sb-pile"></span><span class="sb-cnt"><b>0</b> grille</span></button>
          <div class="sb-side">
            <div class="sb-buy">${[1, 5, 10, 50].map((n) => `<button type="button" data-n="${n}"><b>+${n}</b><small>grille${n > 1 ? 's' : ''}</small></button>`).join('')}</div>
            <div class="sb-sum"></div>
            <div class="sb-tools"><button type="button" data-t="all">📋 Mes grilles</button><button type="button" data-t="new">🔄 Changer</button><button type="button" class="red" data-t="clear" aria-label="Enlever toutes les grilles">🗑</button></div>
          </div>
        </div>`,
      hello: 'Achète tes grilles (+1, +5, +10, +50) puis appuie sur LANCER : 20 boules, puis le SPEEDBALL doré !',
    });
    this.cards = store('spinbet_speedball_grids', []).filter(okCard).slice(0, MAXG);
    this.hist = []; this.set = new Set(); this.gold = 0; this.res = null; this.topI = -1;
    this.sc = this.q('.sbx'); this.vid = this.q('.sbx-vid'); this.idle = this.q('.sbx-idle');
    this.vid.muted = true;
    this.vid.poster = asset('assets/games/speedball/tirage.webp');
    this.vid.src = asset('assets/games/speedball/tirage.mp4');
    this.vid.addEventListener('error', () => { this.vidBad = true; });
    this.vid.addEventListener('ended', () => { this.vidOn = false; this.toIdle(); });
    // the wait: her wide shot in a loop from the arrival (silent); LANCER melts it into the draw (the same camera)
    const iv = this.idle;
    iv.muted = true;
    iv.poster = asset('assets/games/speedball/attente.webp');
    iv.src = asset('assets/games/speedball/attente.mp4');
    iv.addEventListener('timeupdate', () => { if (iv.currentTime >= LOOP) iv.currentTime -= LOOP; });
    iv.addEventListener('error', () => { this.idleBad = true; iv.classList.add('off'); });
    this.root.addEventListener('pointerdown', () => { if (this.idleOn && iv.paused) this.playIdle(); });
    this.idleOn = true;
    this.onVis = () => {
      if (document.hidden) { this.vid.pause(); iv.pause(); }
      else if (this.idleOn) this.playIdle();
      else if (this.vidOn && this.vid.paused && !this.vid.ended) this.vid.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', this.onVis);
    this.sndOn = false; // like Le Plateau Live: the sound of the show is off when one arrives
    this.paintSnd();
    this.q('.sbx-snd').addEventListener('click', () => { this.sndOn = !this.sndOn; this.paintSnd(); this.vid.muted = !this.sndOn || isMuted(); if (!this.vid.muted && this.vidOn) duck?.(0.12, 6); });
    this.q('.sb-buy').addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (b) this.buy(+b.dataset.n); });
    this.q('.sb-tools').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) this.tool(b.dataset.t); });
    this.q('.sb-deck').addEventListener('click', () => { if (this.cards.length) this.showAll(); else this.msg('Pas encore de grille : appuie sur +1, +5, +10 ou +50.'); });
    this.ro = new ResizeObserver(() => this.layout()); this.ro.observe(this.sc);
    this.onRs = () => requestAnimationFrame(() => this.layout()); addEventListener('resize', this.onRs);
    this.layout();
    this.pile(true);
    this.paintSum();
    this.playIdle();
  }

  onMeters() { if (this.mainBtn) this.mainBtn.disabled = !this.auto && (this.busy || !this.cards?.length); this.paintSum?.(); }
  save() { keep('spinbet_speedball_grids', this.cards); }
  paintSnd() {
    const b = this.q('.sbx-snd'); if (!b) return;
    b.innerHTML = `<i>${this.sndOn ? '🔊' : '🔇'}</i><b>SON ${this.sndOn ? 'ON' : 'OFF'}</b>`;
    b.classList.toggle('on', this.sndOn); b.setAttribute('aria-pressed', String(this.sndOn));
  }
  paintSum() {
    const s = this.q('.sb-sum'); if (!s || !this.cards) return;
    const n = this.cards.length;
    s.innerHTML = n ? `<b>${n}</b> grille${n > 1 ? 's' : ''} × ${fmtC(this.bet)} = <b>${fmtC(this.bet * n)}</b>` : `Jusqu’à ${MAXG} grilles par tirage`;
    this.q('.sb-cnt').innerHTML = `<b>${n}</b> grille${n > 1 ? 's' : ''}`;
  }

  /* ---------- the show: her wide shot in a loop, then the draw ---------- */
  // computers and phones held sideways: the whole picture; a phone held upright: its middle (the board, the sphere, the tube)
  layout() {
    if (this.dead) return;
    const full = !!this.slotEl.closest('.is-full');
    const port = full ? innerWidth < innerHeight && innerWidth < 900 : innerWidth < 700 && innerHeight > innerWidth;
    this.sc.classList.toggle('sbx-p', port); this.sc.classList.toggle('sbx-l', !port);
  }
  playIdle() {
    const v = this.idle;
    if (this.dead || this.idleBad || !this.idleOn || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    v.play()?.catch(() => {});
  }
  toIdle() {
    if (this.dead || this.idleBad) return;
    this.idleOn = true; this.sc.classList.remove('close');
    const i = this.idle; i.classList.add('cut'); i.classList.remove('off'); void i.offsetWidth; i.classList.remove('cut');
    this.playIdle();
  }
  // LANCER (in the tap itself, so that the sound may play): the draw starts, it replaces the wait at its first frame
  startShow() {
    const v = this.vid;
    if (this.vidBad || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      v.pause(); if (v.currentTime > 0.03) v.currentTime = 0;
      v.playbackRate = this.turbo ? 1.6 : 1;
      v.muted = !this.sndOn || isMuted();
      const p = v.play(); this.vidOn = true;
      const go = () => { if (!this.vidOn || this.dead) return; this.idleOn = false; this.idle.classList.add('off'); setTimeout(() => { if (!this.idleOn) this.idle.pause(); }, 450); };
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(go); else v.addEventListener('playing', () => setTimeout(go, 60), { once: true });
      p?.catch(() => { v.muted = true; v.play().catch(() => { this.vidOn = false; this.toIdle(); }); });
      if (!v.muted) duck?.(0.12, END_T / v.playbackRate);
      return true;
    } catch { this.vidOn = false; return false; }
  }
  // until the moment t of the draw (its video, or the clock without it)
  async until(t, t0) {
    const rate = this.turbo ? 1.6 : 1;
    while (!this.dead) {
      const live = this.vidOn && !this.vid.paused && !this.vid.ended;
      const now = live ? this.vid.currentTime : (performance.now() - t0) / 1000 * rate;
      this.sc.classList.toggle('close', now >= CUT && (live || !this.vidBad));
      if (now >= t) return;
      if (!live && performance.now() - t0 > (t / rate) * 1000 + 80) return;
      await sleep(25);
    }
  }

  /* ---------- the cards ---------- */
  cardHTML(g, i, st, cls = '') {
    const set = this.set, gold = this.gold;
    const cells = g.map((n, k) => `<i class="${set.has(n) ? 'on' : ''}${st?.hot.has(k) ? ' ln' : ''}${n === gold && set.has(n) ? ' gd' : ''}${st?.miss.has(k) ? ' ms' : ''}">${n}</i>`).join('');
    return `<div class="sb-card ${cls}" data-i="${i}"><div class="sb-ch"><span>SPEEDBALL</span><em>N° ${i + 1}</em></div><div class="sb-cg">${cells}</div></div>`;
  }
  // the pile under the show: the best card on top (the last one bought before a draw), a few others under it
  pile(rebuild, top = this.cards.length - 1) {
    const p = this.q('.sb-pile'); if (!p) return;
    if (rebuild || !p.children.length) {
      const n = Math.min(3, Math.max(0, this.cards.length - 1));
      p.innerHTML = Array.from({ length: n }, (_, k) => `<div class="sb-card bk" style="--r:${(k % 2 ? 1 : -1) * (3 + k * 2.5)}deg;--dx:${(k % 2 ? 1 : -1) * (2 + k)}px"></div>`).join('') + (this.cards.length ? '<div class="sb-top"></div>' : '<div class="sb-card empty"><b>+</b><small>Achète<br>tes grilles</small></div>');
    }
    this.paintTop(top);
  }
  paintTop(i, st) {
    const t = this.q('.sb-top'); if (!t || i < 0 || !this.cards[i]) return;
    st = st || cardState(this.cards[i], this.set, this.gold);
    const res = this.res?.[i];
    const tag = res ? (res.x > 0 ? `<u class="w">+${fmtC(Math.round(this.lastBet * res.x))}${res.inGold ? ` ${xs(this.res.m)}` : ''}</u>` : '')
      : st.lines ? `<u class="w">${st.lines} ligne${st.lines > 1 ? 's' : ''} !</u>` : st.best === 4 ? '<u class="hot">1 numéro !</u>' : '';
    const changed = this.topI !== i; this.topI = i;
    t.innerHTML = this.cardHTML(this.cards[i], i, st, `sb-pk${st.lines ? ' sb-won' : st.best === 4 ? ' sb-near' : ''}`) + tag;
    if (changed && this.drawing) { t.classList.remove('swap'); void t.offsetWidth; t.classList.add('swap'); }
  }
  // +1 / +5 / +10 / +50: new cards fall on the pile one after another, each a little turned (at most 14 shown flying)
  async buy(n) {
    if (this.busy || this.buyAnim) return;
    const room = MAXG - this.cards.length;
    if (room <= 0) { this.msg(`${MAXG} grilles au plus par tirage.`); return; }
    n = Math.min(n, room);
    const from = this.cards.length;
    for (let i = 0; i < n; i++) this.cards.push(makeCard());
    this.res = null; this.save();
    await this.dealAnim(from, n);
    this.msg(`${n > 1 ? `${n} grilles ajoutées` : 'Grille ajoutée'} : ${this.cards.length} en tout. Appuie sur LANCER !`);
  }
  async dealAnim(from, n) {
    this.buyAnim = true;
    const p = this.q('.sb-pile'), cnt = this.q('.sb-cnt b');
    if (!this.q('.sb-top')) this.pile(true, from);
    const show = Math.min(n, 14), step = Math.max(45, Math.min(170, 900 / show)), fly = [];
    for (let k = 0; k < show && !this.dead; k++) {
      const i = from + Math.round((k + 1) * n / show) - 1;
      const d = document.createElement('div');
      d.className = 'sb-fly';
      d.style.cssText = `--r:${(Math.random() * 16 - 8).toFixed(1)}deg;--dx:${(Math.random() * 14 - 7).toFixed(0)}px;--dy:${(Math.random() * 8 - 4).toFixed(0)}px;--fx:${(Math.random() * 120 - 60).toFixed(0)}px;--fr:${(Math.random() * 60 - 30).toFixed(0)}deg`;
      d.innerHTML = this.cardHTML(this.cards[i], i, null);
      p.appendChild(d); fly.push(d);
      while (fly.length > 4) fly.shift().remove();
      cnt.textContent = from + Math.round((k + 1) * n / show);
      sfx.click();
      await sleep(step);
    }
    await sleep(260);
    fly.forEach((d) => d.remove());
    this.topI = -1; this.pile(true); this.paintSum(); this.updateMeters();
    this.buyAnim = false;
  }
  async tool(t) {
    if (this.busy || this.buyAnim) return;
    sfx.click();
    if (t === 'all') { if (this.cards.length) this.showAll(); else this.msg('Pas encore de grille : appuie sur +1, +5, +10 ou +50.'); return; }
    if (!this.cards.length) { this.msg('Pas encore de grille : appuie sur +1, +5, +10 ou +50.'); return; }
    this.res = null; this.set = new Set(); this.gold = 0;
    if (t === 'clear') { this.cards = []; this.save(); this.pile(true); this.paintSum(); this.updateMeters(); this.msg('Plus de grille : rachètes-en avec +1, +5, +10 ou +50.'); return; }
    const n = this.cards.length; this.cards = Array.from({ length: n }, () => makeCard()); this.save();
    await this.dealAnim(0, n);
    this.msg(`${n} nouvelle${n > 1 ? 's' : ''} grille${n > 1 ? 's' : ''} !`);
  }
  // the window of all the cards: the best first, the winning ones lit, the cross to go on playing
  async showAll() {
    if (this.allOpen) return;
    this.allOpen = true;
    const ord = this.cards.map((g, i) => ({ i, st: this.res?.[i] || cardState(g, this.set, this.gold) }));
    ord.sort((a, b) => (b.st.x || 0) - (a.st.x || 0) || b.st.score - a.st.score || a.i - b.i);
    const done = !!this.res, win = done ? ord.filter((o) => o.st.x > 0) : [];
    const tot = win.reduce((a, o) => a + Math.round(this.lastBet * o.st.x), 0);
    const near = ord.filter((o) => !o.st.lines && o.st.best === 4).length;
    const head = done
      ? `<h3>${win.length ? `🎉 ${win.length} grille${win.length > 1 ? 's' : ''} gagnante${win.length > 1 ? 's' : ''} · +${fmtC(tot)}` : 'Pas de ligne cette fois'}</h3>
         <p class="sb-mh">SPEEDBALL <b class="sb-gb">${this.res.gold}</b> ${xs(this.res.m)}${near ? ` · ${near} grille${near > 1 ? 's' : ''} à 1 numéro d’une ligne` : ''}</p>`
      : `<h3>📋 Mes ${this.cards.length} grille${this.cards.length > 1 ? 's' : ''}</h3><p class="sb-mh">${this.set.size ? 'Les plus avancées d’abord' : `${fmtC(this.bet)} la grille · ${fmtC(this.bet * this.cards.length)} le tirage`}</p>`;
    const body = ord.map((o, k) => {
      const r = o.st, lab = done ? (r.x > 0 ? `<u class="w">+${fmtC(Math.round(this.lastBet * r.x))}${r.inGold ? ` ${xs(this.res.m)}` : ''}</u>` : r.best === 4 ? '<u>1 numéro manquant</u>' : '<u>—</u>')
        : r.lines ? `<u class="w">${r.lines} ligne${r.lines > 1 ? 's' : ''}</u>` : r.best === 4 ? '<u class="hot">1 numéro !</u>' : '';
      return `<div class="sb-mc${k === 0 && (r.x > 0 || r.score >= 400) ? ' sb-best' : ''}">${this.cardHTML(this.cards[o.i], o.i, r, r.x > 0 || r.lines ? 'sb-won' : r.best === 4 ? 'sb-near' : '')}${lab}</div>`;
    }).join('');
    await modal(`<div class="sb-mhead">${head}</div><div class="sb-mgrid">${body}</div><div class="ct-menu"><button class="btn primary" data-value="">Rejouer</button></div>`, { cls: 'sb-modal' });
    this.allOpen = false;
  }

  /* ---------- the draw ---------- */
  onMain() {
    if (this.buyAnim) return;
    const n = this.cards.length;
    if (!n) { this.msg('Achète au moins une grille (+1, +5, +10 ou +50).'); this.stopAuto(); return; }
    const total = this.bet * n;
    if (this.busy) return;
    if (total > this.balC()) { this.msg(`Il faut ${fmtC(total)} pour ${n} grille${n > 1 ? 's' : ''} : baisse la mise ou enlève des grilles.`); this.stopAuto(true); return; }
    this.showStarted = this.startShow();
    this.round(async () => {
      if (!this.pay(total)) { this.vid.pause(); this.vidOn = false; this.toIdle(); return; }
      this.roundStake = total; this.lastStake = total; this.lastBet = this.bet;
      this.setLast(0); this.winAmt.textContent = '';
      this.focusStage?.();
      await this.play(draw());
    });
  }

  async play(O) {
    const t0 = performance.now();
    if (!this.vidOn) this.startShow();
    this.res = null; this.set = new Set(); this.gold = 0; this.drawing = true; this.topI = -1;
    const cards = this.cards, mine = new Set(cards.flat());
    this.qa('.sbx-sl').forEach((s) => s.classList.remove('on', 'hit'));
    this.qa('.sbx-gold').forEach((s) => s.classList.remove('on'));
    this.q('.sbx-res').className = 'sbx-res';
    const cn = this.q('.sbx-cnt .cn'), now = this.q('.sbx-now'), mv = this.qa('.sbx-mp .mv');
    cn.textContent = '0'; now.className = 'sbx-now'; now.textContent = '';
    this.pile(true, 0);
    // the SPEEDBALL multiplier, announced first
    const mp = this.qa('.sbx-mp'); mp.forEach((g) => g.classList.add('roll'));
    const tr = performance.now();
    while (performance.now() - tr < (this.turbo ? 350 : 650) && !this.dead) { const v = xs(MULT[Math.floor(Math.random() * MULT.length)][0]); mv.forEach((m) => { m.textContent = v; }); sfx.tick(); await sleep(70); }
    mv.forEach((m) => { m.textContent = xs(O.m); }); mp.forEach((g) => { g.classList.remove('roll'); g.classList.add('hit'); }); sfx.upgrade();
    setTimeout(() => mp.forEach((g) => g.classList.remove('hit')), 900);
    this.msg(`SPEEDBALL ${xs(O.m)} ! Les boules sortent…`);
    const sl = this.qa('.sbx-sl');
    let bestI = 0, near0 = 0;
    for (let i = 0; i <= D; i++) {
      const g = i === D, n = g ? O.gold : O.balls[i];
      await this.until(g ? GOLD_T : BT[i], t0);
      if (this.dead) return;
      this.set.add(n); if (g) this.gold = n;
      const hit = mine.has(n);
      if (!g) { const s = sl[i]; s.querySelector('text').textContent = n; s.classList.add('on'); if (hit) s.classList.add('hit'); cn.textContent = i + 1; }
      else this.qa('.sbx-gold').forEach((s) => { s.querySelector('text').textContent = n; s.classList.add('on'); });
      now.textContent = n; now.className = `sbx-now${g ? ' gold' : ''}${hit ? ' hit' : ''}`; void now.offsetWidth; now.classList.add('pop');
      // the most advanced card goes on top of the pile
      let bs = -1, near = 0, lines = 0;
      for (let k = 0; k < cards.length; k++) { const st = cardState(cards[k], this.set, this.gold); if (st.score > bs) { bs = st.score; bestI = k; } if (st.lines) lines++; else if (st.best === 4) near++; }
      this.paintTop(bestI);
      if (g) { sfx.jackpot?.(); this.msg(`SPEEDBALL : ${n} ${xs(O.m)} !${hit ? ' Il est sur tes grilles !' : ''}`); }
      else if (hit) sfx.upgrade(); else sfx.tick();
      if (!g && (lines || near > near0)) this.msg(lines ? `🔥 ${lines} grille${lines > 1 ? 's' : ''} avec une ligne !` : `${near} grille${near > 1 ? 's' : ''} à 1 numéro d’une ligne !`);
      near0 = near;
    }
    await this.until(END_T, t0);
    this.drawing = false;
    // the results
    const res = cards.map((g) => cardResult(g, O)); res.m = O.m; res.gold = O.gold; this.res = res;
    const winC = res.reduce((a, r) => a + Math.round(this.lastBet * r.x), 0), nw = res.filter((r) => r.x > 0).length, nb = res.filter((r) => r.inGold && r.x > 0).length;
    let top = 0; res.forEach((r, k) => { if (r.x > res[top].x || (r.x === res[top].x && r.score > res[top].score)) top = k; });
    this.paintTop(top);
    this.hist.unshift({ n: O.gold, m: O.m, w: winC > 0 }); this.hist = this.hist.slice(0, 8);
    this.q('.sb-hist').innerHTML = this.hist.map((h) => `<span class="${h.w ? 'w' : ''}" title="SPEEDBALL ${h.n} ${xs(h.m)}">${xs(h.m)}</span>`).join('');
    const all = this.lastStake, rb = this.q('.sbx-res');
    rb.innerHTML = nw ? `<b>+${fmtC(winC)}</b><small>${nw} grille${nw > 1 ? 's' : ''} gagnante${nw > 1 ? 's' : ''}${nb ? ` · ${nb} ${xs(O.m)}` : ''}</small>` : '<b>Pas de ligne</b><small>On rejoue ?</small>';
    rb.classList.add('on', nw ? 'w' : 'l');
    this.msg(nw ? `${nw} grille${nw > 1 ? 's' : ''} gagnante${nw > 1 ? 's' : ''}${nb ? ` (dont ${nb} avec le SPEEDBALL ${xs(O.m)})` : ''} · +${fmtC(winC)} · Bilan : ${winC - all >= 0 ? '+' : '−'}${fmtC(Math.abs(winC - all))}` : 'Pas de ligne cette fois. On rejoue ?');
    if (winC > 0) {
      this.win(winC);
      this.setLast(winC);
      if (nb) { const p = center(this.q('.sbx-now')); fx.burst(p.x, p.y, 40, ['#ffd23f', '#fff']); }
      if (winC > all) await this.celebrate(winC, { summary: 'SPEEDBALL' });
    }
    setTimeout(() => rb.classList.remove('on'), 4500);
    if (!this.auto && !this.dead) setTimeout(() => { if (!this.busy && !this.auto && !this.dead && this.res === res) this.showAll(); }, 650);
    return winC;
  }

  destroy() {
    this.ro?.disconnect(); removeEventListener('resize', this.onRs); document.removeEventListener('visibilitychange', this.onVis);
    for (const v of [this.vid, this.idle]) try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* ignore */ }
    super.destroy();
  }

  info() {
    return this.rules(`<h4>Le tirage</h4><p>Achète tes grilles de 5 × 5 numéros (+1, +5, +10 ou +50, autant de fois que tu veux, ${MAXG} au plus) : chaque grille coûte la mise par grille. Au LANCER, le multiplicateur du SPEEDBALL est annoncé (×2 à ×200), puis 20 boules blanches sortent parmi les numéros 1 à 50, et enfin la boule dorée : le SPEEDBALL.</p>
      <h4>Les gains (× la mise d’une grille)</h4><p>Une ligne, une colonne ou une diagonale complète (12 en tout par grille) :</p>
      <ul class="rules">${[1, 2, 3, 4, 5].map((l) => `<li class="pay-item"><b>${l} ligne${l > 1 ? 's' : ''}${l === 5 ? ' ou plus' : ''}</b> : ${xs(PAY[l])}</li>`).join('')}</ul>
      <h4>Le SPEEDBALL</h4><p>Si la boule dorée est dans une ligne complète d’une grille, le gain de cette grille est multiplié par le multiplicateur du SPEEDBALL. Gain maximum ${xs(CAPX)} la mise d’une grille.</p>
      <h4>Tes grilles</h4><p>La grille la plus avancée est toujours en haut de la pile (le numéro qui lui manque clignote). À la fin du tirage, la fenêtre « Mes grilles » les montre toutes, les meilleures d’abord. Tes grilles restent pour le tirage suivant : 🔄 Changer en donne de nouvelles.</p>`);
  }
}

return { SpeedballGame, draw, makeCard, cardResult, cardState, PAY, MULT };
})();
