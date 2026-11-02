// SpinBet Casino · ChasseGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/chasse.js ----
__mods['games/impl/chasse.js'] = (() => {
// La Chasse: one animal crosses the field per level (duck in the sky, rabbit, boar, deer on the ground…). Click it
// to shoot. A shot that misses the animal, or hits a bush, a wall, a trunk or a tree in front of it, loses the
// stake. A shot on the animal succeeds with the chance shown for the level (otherwise it dodges). Each level hit
// raises the multiplier; cash out whenever you like. Multiplier after k levels: 0,95 / (p1 × … × pk), so a perfect
// shooter gets 95 % back whatever the moment of the cash out, and any missed shot only lowers it.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
const EDGE = 0.95;
// kind, chance, crossing time (s), flight line (y % of the field, sky animals), zigzag amplitude (%) and speed,
// obstacles [type, x %], time of day (0 day, 1 sunset, 2 night)
const LEVELS = [
  { kind: 'duck', p: 0.80, dur: 5.2, y: 30, amp: 4, f: 0.35, obst: [], tod: 0 },
  { kind: 'rabbit', p: 0.75, dur: 4.6, obst: [['bush', 62]], tod: 0 },
  { kind: 'boar', p: 0.70, dur: 4.3, obst: [['bush', 30], ['rock', 70]], tod: 0 },
  { kind: 'duck', p: 0.65, dur: 3.8, y: 30, amp: 12, f: 0.8, obst: [['tree', 58]], tod: 0 },
  { kind: 'deer', p: 0.60, dur: 3.7, obst: [['wall', 28], ['bush', 68]], tod: 1 },
  { kind: 'boar', p: 0.55, dur: 3.0, obst: [['bush', 20], ['bush', 50], ['trunk', 78]], tod: 1 },
  { kind: 'pheasant', p: 0.50, dur: 3.0, y: 34, amp: 14, f: 1.1, obst: [['tree', 26], ['tree', 72]], tod: 1 },
  { kind: 'deer', p: 0.45, dur: 2.8, obst: [['bush', 16], ['trunk', 42], ['wall', 64], ['bush', 86]], tod: 2 },
  { kind: 'duck', p: 0.40, dur: 2.4, y: 32, amp: 18, f: 1.5, obst: [['tree', 20], ['tree', 52], ['tree', 82]], tod: 2 },
  { kind: 'golddeer', p: 0.35, dur: 2.4, obst: [['wall', 18], ['bush', 40], ['rock', 60], ['bush', 82]], tod: 2 },
];
const MAXL = LEVELS.length;
const mult = (k) => { let q = 1; for (let i = 0; i < k; i++) q *= LEVELS[i].p; return k ? Math.floor((EDGE / q) * 100) / 100 : 0; };
const lucky = (k) => Math.random() < LEVELS[k - 1].p; // the shot on the animal of level k succeeds
/* ===END ENGINE */

const xs = (m) => (m >= 1000 ? Math.round(m).toLocaleString('fr-FR') : m >= 100 ? m.toFixed(1).replace('.', ',') : m.toFixed(2).replace('.', ','));
const pct = (p) => `${Math.round(p * 100)} %`;
const GROUND = 84; // ground line, % of the field height

/* ---------- drawn art (side view, facing right) ---------- */
const ANIMALS = {
  duck: { name: 'Canard', w: 9, sky: true, vb: '0 0 80 56', svg: `
    <path d="M10 30 Q4 26 2 30 Q6 34 12 33Z" fill="#6b4423"/>
    <ellipse cx="34" cy="34" rx="24" ry="13" fill="#8b5a2b"/><ellipse cx="32" cy="38" rx="20" ry="8" fill="#c9a27a"/>
    <path d="M20 31 Q30 26 44 30" stroke="#5b3a1a" stroke-width="2" fill="none" opacity=".6"/>
    <rect x="50" y="18" width="7" height="12" rx="3" fill="#fff"/>
    <circle cx="60" cy="16" r="10" fill="#15803d"/><circle cx="63" cy="13" r="2.2" fill="#111"/><circle cx="63.6" cy="12.4" r=".7" fill="#fff"/>
    <path d="M68 16 L79 18 L68 21Z" fill="#f59e0b"/>
    <g class="ht-wing"><path d="M24 30 Q32 2 48 8 Q44 24 34 32Z" fill="#6b4423" stroke="#3f2810" stroke-width="1.2"/><path d="M30 18 Q38 10 45 11" stroke="#1d4ed8" stroke-width="3" fill="none"/></g>` },
  pheasant: { name: 'Faisan', w: 11, sky: true, vb: '0 0 100 52', svg: `
    <path d="M30 30 L0 22 L4 28 L0 34 L30 34Z" fill="#a16207"/><path d="M28 30 L4 26 M28 32 L6 32" stroke="#713f12" stroke-width="1.4"/>
    <ellipse cx="50" cy="32" rx="22" ry="12" fill="#c2410c"/><ellipse cx="50" cy="36" rx="18" ry="7" fill="#9a3412"/>
    <path d="M40 28 Q50 24 60 28" stroke="#fde68a" stroke-width="1.5" fill="none" stroke-dasharray="2 3"/>
    <rect x="66" y="16" width="6" height="12" rx="3" fill="#fff"/>
    <circle cx="74" cy="14" r="9" fill="#065f46"/><path d="M72 10 Q78 6 82 12 Q78 16 74 14Z" fill="#dc2626"/><circle cx="77" cy="12" r="1.8" fill="#111"/>
    <path d="M82 14 L92 16 L82 18Z" fill="#facc15"/>
    <g class="ht-wing"><path d="M40 30 Q48 4 64 10 Q60 24 50 32Z" fill="#9a3412" stroke="#431407" stroke-width="1.2"/></g>` },
  rabbit: { name: 'Lapin', w: 7, vb: '0 0 64 56', svg: `
    <ellipse cx="28" cy="38" rx="20" ry="13" fill="#9ca3af"/><circle cx="9" cy="34" r="6" fill="#f3f4f6"/>
    <ellipse cx="22" cy="48" rx="10" ry="5" fill="#6b7280"/><ellipse cx="42" cy="49" rx="6" ry="4" fill="#6b7280"/>
    <circle cx="46" cy="28" r="10" fill="#9ca3af"/><circle cx="50" cy="26" r="2" fill="#111"/><circle cx="55" cy="30" r="1.6" fill="#f472b6"/>
    <g class="ht-ears"><ellipse cx="42" cy="10" rx="4" ry="12" fill="#9ca3af" transform="rotate(-18 42 10)"/><ellipse cx="42" cy="10" rx="2" ry="9" fill="#fbcfe8" transform="rotate(-18 42 10)"/>
    <ellipse cx="48" cy="11" rx="4" ry="11" fill="#8b929c" transform="rotate(10 48 11)"/></g>` },
  boar: { name: 'Sanglier', w: 13, vb: '0 0 100 60', svg: `
    <path d="M8 26 Q2 22 4 30" stroke="#3f2a1a" stroke-width="2" fill="none"/>
    <g class="ht-legs"><rect x="18" y="40" width="7" height="16" rx="2" fill="#2a1a0e"/><rect x="34" y="42" width="7" height="14" rx="2" fill="#2a1a0e"/>
    <rect x="58" y="42" width="7" height="14" rx="2" fill="#2a1a0e"/><rect x="72" y="40" width="7" height="16" rx="2" fill="#2a1a0e"/></g>
    <path d="M10 30 Q14 12 40 12 Q66 10 76 20 L90 26 Q98 30 96 36 Q92 42 84 42 Q66 48 40 48 Q14 48 10 30Z" fill="#4a3324"/>
    <path d="M22 14 L26 6 L30 13 L34 5 L38 12 L42 5 L46 12 L50 6 L54 13" fill="#2a1a0e"/>
    <ellipse cx="94" cy="34" rx="5" ry="6" fill="#7c5a44"/><circle cx="95" cy="33" r="1.2" fill="#111"/><circle cx="95" cy="36" r="1.2" fill="#111"/>
    <path d="M86 38 Q90 30 92 26" stroke="#fffbeb" stroke-width="3" stroke-linecap="round" fill="none"/>
    <circle cx="80" cy="24" r="2.4" fill="#111"/><path d="M72 14 L76 6 L80 15Z" fill="#3a2618"/>` },
  deer: { name: 'Cerf', w: 15, vb: '0 0 100 90', svg: `
    <g class="ht-legs"><rect x="22" y="56" width="5" height="30" rx="2" fill="#6b3f1d"/><rect x="32" y="58" width="5" height="28" rx="2" fill="#6b3f1d"/>
    <rect x="62" y="58" width="5" height="28" rx="2" fill="#6b3f1d"/><rect x="72" y="56" width="5" height="30" rx="2" fill="#6b3f1d"/></g>
    <ellipse cx="48" cy="50" rx="32" ry="15" fill="#a0622d"/><ellipse cx="46" cy="56" rx="24" ry="7" fill="#d6a46c"/>
    <path d="M16 44 Q10 40 12 48 Q16 50 18 47Z" fill="#fff"/>
    <path d="M70 46 Q74 30 80 24 L88 28 Q82 38 80 50Z" fill="#a0622d"/>
    <ellipse cx="86" cy="24" rx="10" ry="7" fill="#a0622d"/><circle cx="90" cy="22" r="1.8" fill="#111"/><circle cx="96" cy="26" r="1.6" fill="#111"/>
    <path d="M80 18 L78 12 L76 2 M78 12 L72 6 M78 12 L84 4 M86 18 L88 8 L86 0 M88 8 L94 2 M88 8 L82 2" stroke="#5b3a1a" stroke-width="2.4" stroke-linecap="round" fill="none"/>` },
};
ANIMALS.golddeer = { ...ANIMALS.deer, name: 'Cerf doré', gold: true };
const OBST = {
  bush: { w: 14, h: 22, svg: '<svg viewBox="0 0 100 70" preserveAspectRatio="none"><path d="M4 70 Q0 46 16 40 Q14 18 36 20 Q44 2 62 14 Q82 8 84 30 Q100 34 96 70Z" fill="#2f6b1f"/><path d="M14 66 Q12 50 24 46 Q26 32 40 34 Q48 22 60 30 Q74 26 76 42 Q88 46 86 66Z" fill="#3f8a2a"/><circle cx="30" cy="44" r="3" fill="#ef4444"/><circle cx="62" cy="38" r="3" fill="#ef4444"/><circle cx="72" cy="54" r="3" fill="#ef4444"/></svg>' },
  wall: { w: 15, h: 18, svg: '<svg viewBox="0 0 100 60" preserveAspectRatio="none"><rect width="100" height="60" fill="#78716c"/><g fill="#a8a29e" stroke="#57534e" stroke-width="1.5"><rect x="0" y="0" width="34" height="15"/><rect x="34" y="0" width="34" height="15"/><rect x="68" y="0" width="32" height="15"/><rect x="0" y="15" width="18" height="15"/><rect x="18" y="15" width="34" height="15"/><rect x="52" y="15" width="34" height="15"/><rect x="86" y="15" width="14" height="15"/><rect x="0" y="30" width="34" height="15"/><rect x="34" y="30" width="34" height="15"/><rect x="68" y="30" width="32" height="15"/><rect x="0" y="45" width="18" height="15"/><rect x="18" y="45" width="34" height="15"/><rect x="52" y="45" width="34" height="15"/><rect x="86" y="45" width="14" height="15"/></g><path d="M8 0 Q20 -4 40 0" stroke="#4d7c0f" stroke-width="4" fill="none"/></svg>' },
  trunk: { w: 18, h: 12, svg: '<svg viewBox="0 0 120 50" preserveAspectRatio="none"><rect x="8" y="6" width="104" height="40" rx="8" fill="#7c4a22"/><path d="M14 16 H104 M18 28 H100 M14 38 H96" stroke="#5b3416" stroke-width="2.5"/><ellipse cx="110" cy="26" rx="10" ry="20" fill="#c08a52"/><ellipse cx="110" cy="26" rx="6" ry="13" fill="none" stroke="#7c4a22" stroke-width="2"/><ellipse cx="110" cy="26" rx="2.5" ry="5" fill="none" stroke="#7c4a22" stroke-width="2"/></svg>' },
  rock: { w: 11, h: 14, svg: '<svg viewBox="0 0 80 60" preserveAspectRatio="none"><path d="M4 60 Q0 34 16 24 Q26 6 46 10 Q66 8 74 28 Q82 42 76 60Z" fill="#6b7280"/><path d="M20 30 Q30 18 46 20 M50 34 Q62 30 68 40" stroke="#9ca3af" stroke-width="3" fill="none"/></svg>' },
  tree: { w: 20, top: 0, h: 52, svg: '<svg viewBox="0 0 100 120" preserveAspectRatio="none"><path d="M10 112 Q-4 80 18 64 Q6 34 34 28 Q38 2 62 10 Q90 6 88 38 Q104 54 92 80 Q100 108 80 116 Q50 124 10 112Z" fill="#1f4d14"/><path d="M22 100 Q12 80 28 70 Q22 46 42 42 Q48 22 64 28 Q82 26 80 50 Q92 64 84 84 Q86 102 70 106 Q46 112 22 100Z" fill="#2f6b1f"/></svg>' },
};
const SCENE = `<svg class="ht-scene" viewBox="0 0 160 90" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <circle class="ht-sun" cx="128" cy="18" r="9"/><circle class="ht-moon" cx="30" cy="16" r="6"/>
  <g class="ht-stars">${Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 37) % 160}" cy="${(i * 13) % 44}" r="${0.3 + (i % 3) * 0.2}"/>`).join('')}</g>
  <path class="ht-hill2" d="M0 60 Q20 46 44 54 Q70 40 96 52 Q124 42 160 54 V90 H0Z"/>
  <path class="ht-hill1" d="M0 66 Q30 56 60 64 Q92 54 120 64 Q142 58 160 62 V90 H0Z"/>
  <g class="ht-pines">${Array.from({ length: 22 }, (_, i) => { const x = i * 7.6 + (i % 2) * 2, h = 9 + (i * 5) % 7; return `<path d="M${x} 72 L${x + 3} ${72 - h} L${x + 6} 72Z"/>`; }).join('')}</g>
  <rect class="ht-grass" x="0" y="74" width="160" height="16"/>
  <g class="ht-blades">${Array.from({ length: 60 }, (_, i) => { const x = i * 2.7; return `<path d="M${x} 90 L${x + 0.6} ${84 - (i * 7) % 5} L${x + 1.2} 90Z"/>`; }).join('')}</g>
</svg>`;
const SCOPE = '<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="#fff" stroke-width="2"/><circle cx="30" cy="30" r="22" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="4" transform="scale(1.02) translate(-.6 -.6)"/><path d="M30 2 V20 M30 40 V58 M2 30 H20 M40 30 H58" stroke="#fff" stroke-width="2"/><circle cx="30" cy="30" r="2" fill="#ef4444"/></svg>';
const icon = (k) => `<svg viewBox="${ANIMALS[k].vb}" aria-hidden="true">${ANIMALS[k].svg}</svg>`;

class ChasseGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.chasse, autoplay: false, mainLabel: 'JOUER', turbo: false,
      cls: 'table-game chasse',
      head: '<div class="head-meters"><div class="meter ht-cur"><small>Multiplicateur</small><b>—</b></div><div class="meter ht-nxt"><small>Prochain tir</small><b>—</b></div><div class="meter ht-cash"><small>Encaissable</small><b>—</b></div></div>',
      stage: `<div class="ht-field t0">${SCENE}<div class="ht-obst"></div><div class="ht-scope">${SCOPE}</div><div class="ht-banner"></div></div>
        <div class="ht-bar"><span class="ht-say">Choisis ta mise puis JOUER. Clique sur le gibier pour tirer !</span><button type="button" class="ht-go" disabled>NIVEAU SUIVANT ➜</button></div>`,
      below: `<div class="ht-ladder">${LEVELS.map((l, i) => `<div data-l="${i + 1}"><i>${icon(l.kind)}</i><b>×${xs(mult(i + 1))}</b><small>${pct(l.p)}</small></div>`).join('')}</div>`,
      hello: 'Vise le gibier : chaque tir réussi multiplie ta mise !',
    });
    this.field = this.q('.ht-field');
    this.scope = this.q('.ht-scope');
    this.playing = false; this.k = 0; this.running = false; this.busyShot = false;
    this.field.addEventListener('pointerdown', (e) => this.shoot(e));
    this.field.addEventListener('pointermove', (e) => this.aim(e));
    this.field.addEventListener('pointerleave', () => this.scope.classList.remove('on'));
    this.q('.ht-go').addEventListener('click', () => this.nextLevel());
    this.setScene(LEVELS[0]);
    this.paint();
  }

  destroy() { cancelAnimationFrame(this.raf); super.destroy(); }
  say(t) { this.q('.ht-say').innerHTML = t; }

  aim(e) {
    if (e.pointerType !== 'mouse') return;
    const r = this.field.getBoundingClientRect();
    this.scope.style.left = `${e.clientX - r.left}px`; this.scope.style.top = `${e.clientY - r.top}px`;
    this.scope.classList.toggle('on', this.running);
  }

  // obstacles and time of day of a level
  setScene(L) {
    this.field.classList.remove('t0', 't1', 't2'); this.field.classList.add(`t${L.tod}`);
    this.q('.ht-obst').innerHTML = L.obst.map(([t, x]) => {
      const o = OBST[t], top = o.top ?? GROUND - o.h + 3;
      return `<div class="ht-o ht-${t}" style="left:${x - o.w / 2}%;top:${top}%;width:${o.w}%;height:${o.h}%">${o.svg}</div>`;
    }).join('');
  }

  paint() {
    const k = this.k, cur = mult(k), nx = k < MAXL ? mult(k + 1) : 0;
    this.q('.ht-cur b').textContent = this.playing && k ? `×${xs(cur)}` : '—';
    this.q('.ht-nxt b').textContent = nx ? `×${xs(nx)} · ${pct(LEVELS[k].p)}` : '—';
    this.q('.ht-cash b').textContent = fmtC(this.playing ? Math.floor(this.bet * cur) : 0);
    const lab = this.mainBtn.querySelector('.main-label');
    if (this.playing) { lab.textContent = k ? `ENCAISSER ${fmtC(Math.floor(this.bet * cur))}` : 'EN CHASSE…'; this.mainBtn.disabled = !k || this.running || this.busyShot; this.mainBtn.classList.add('cash'); }
    else { lab.textContent = 'JOUER'; this.mainBtn.disabled = false; this.mainBtn.classList.remove('cash'); }
    this.q('.ht-go').disabled = !this.playing || this.running || this.busyShot || !k;
    this.qa('.ht-ladder > div').forEach((d) => { const l = +d.dataset.l; d.classList.toggle('done', this.playing && l <= k); d.classList.toggle('next', this.playing ? l === k + 1 : l === 1); });
    this.q('[data-act="bet-"]').disabled = this.playing || this.bi === 0;
    this.q('[data-act="bet+"]').disabled = this.playing || this.bi === this.cfg.bets.length - 1;
    this.slotEl.classList.toggle('ht-on', this.playing);
  }

  onMeters() { if (this.field) this.paint(); }
  onBetChange() { this.paint(); }

  onMain() {
    if (this.playing) return this.cash(false);
    if (this.running || !this.pay(this.bet)) return;
    this.lastStake = this.bet;
    this.playing = true; this.k = 0;
    this.setLast(0); this.winAmt.textContent = '';
    this.slotEl.classList.remove('ht-lost', 'ht-won');
    this.msg(`Mise ${fmtC(this.bet)}`);
    sfx.spin();
    this.startLevel();
  }

  nextLevel() { if (this.playing && !this.running && !this.busyShot && this.k < MAXL) this.startLevel(); }

  // Shows the level, then lets the animal cross the field.
  async startLevel() {
    const n = this.k + 1, L = LEVELS[n - 1], A = ANIMALS[L.kind];
    this.setScene(L);
    this.busyShot = true; this.paint();
    const b = this.q('.ht-banner');
    b.innerHTML = `<small>Niveau ${n} / ${MAXL}</small><b>${A.name}</b><span>${pct(L.p)} de réussite · ×${xs(mult(n))}</span>`;
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    this.say(`Niveau ${n} : <b>${A.name}</b>${L.obst.length ? ' · attention aux obstacles !' : ''} Clique dessus pour tirer.`);
    await this.wait(1300);
    if (this.dead || !this.playing) return;
    this.busyShot = false;
    this.run(L, A);
  }

  run(L, A) {
    this.animal?.remove();
    const el = document.createElement('div');
    const dir = Math.random() < 0.5 ? 1 : -1;
    el.className = `ht-animal ht-${L.kind}${A.gold ? ' gold' : ''}${A.sky ? ' sky' : ''}`;
    const fw = this.field.getBoundingClientRect().width, aw = A.w * (fw < 520 ? 1.4 : 1); // bigger animals on phones
    el.style.width = `${aw}%`;
    el.innerHTML = `<svg viewBox="${A.vb}" style="transform:scaleX(${dir})">${A.svg}</svg>`;
    this.q('.ht-obst').before(el);
    this.animal = el;
    const [vw, vh] = A.vb.split(' ').slice(2).map(Number), fr = this.field.getBoundingClientRect();
    const hPct = (aw / 100 * fr.width * vh / vw) / fr.height * 100;
    const baseY = A.sky ? L.y : GROUND - hPct / 2;
    const x0 = dir > 0 ? -aw : 100 + aw, x1 = dir > 0 ? 100 + aw : -aw;
    const dur = L.dur * 1000, t0 = performance.now(), ph = Math.random() * 6;
    this.running = true; this.paint();
    this.scope.classList.toggle('on', matchMedia('(pointer: fine)').matches);
    const step = (t) => {
      if (this.dead || this.animal !== el || !this.running) return;
      const u = (t - t0) / dur;
      const x = x0 + (x1 - x0) * u;
      let y = baseY;
      if (A.sky) y += (L.amp || 0) * Math.sin(ph + u * Math.PI * 2 * (L.f || 0.5) * L.dur);
      else if (L.kind === 'rabbit') y -= Math.abs(Math.sin(u * Math.PI * 9)) * 6;
      el.style.left = `${x}%`; el.style.top = `${y}%`;
      if (u >= 1) return this.escaped();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  // A shot: on an obstacle in front, beside the animal, or on it (then the level's chance decides).
  shoot(e) {
    if (!this.running || this.busyShot) return;
    e.preventDefault();
    const px = e.clientX, py = e.clientY, fr = this.field.getBoundingClientRect();
    this.mark(px - fr.left, py - fr.top);
    sfx.puff();
    this.field.classList.remove('recoil'); void this.field.offsetWidth; this.field.classList.add('recoil');
    const inside = (r, m = 0) => px >= r.left + r.width * m && px <= r.right - r.width * m && py >= r.top + r.height * m && py <= r.bottom - r.height * m;
    const cover = this.qa('.ht-o').find((o) => inside(o.getBoundingClientRect(), 0.12));
    const onAnimal = this.animal && inside(this.animal.getBoundingClientRect(), -0.08);
    this.running = false; cancelAnimationFrame(this.raf);
    this.scope.classList.remove('on');
    const n = this.k + 1, A = ANIMALS[LEVELS[n - 1].kind];
    if (cover && onAnimal) return this.lose(`💥 Tu as tiré dans ${cover.classList.contains('ht-tree') ? 'l’arbre' : cover.classList.contains('ht-wall') ? 'le muret' : cover.classList.contains('ht-trunk') ? 'le tronc' : cover.classList.contains('ht-rock') ? 'le rocher' : 'le buisson'} : le ${A.name.toLowerCase()} était caché derrière !`, 'flee');
    if (!onAnimal) return this.lose(cover ? '💥 Tir dans le décor, le gibier s’est enfui !' : `💨 Raté ! Le ${A.name.toLowerCase()} s’est enfui.`, 'flee');
    if (!lucky(n)) return this.lose(`😮 Le ${A.name.toLowerCase()} a esquivé au dernier moment !`, 'dodge');
    this.hit(n);
  }

  mark(x, y) {
    const m = document.createElement('i');
    m.className = 'ht-shot'; m.style.left = `${x}px`; m.style.top = `${y}px`;
    this.field.appendChild(m); setTimeout(() => m.remove(), 900);
  }

  hit(n) {
    const el = this.animal, p = center(el);
    el.classList.add('down');
    fx.burst(p.x, p.y, 28, ANIMALS[LEVELS[n - 1].kind].sky ? ['#fff', '#d6b48c', '#8b5a2b'] : ['#fde047', '#fbbf24', '#fff'], 7);
    fx.floatText(p.x, p.y - 30, `×${xs(mult(n))}`, '#fde047', 26);
    sfx.coin();
    this.k = n;
    [this.q('.ht-cur'), this.q('.ht-cash')].forEach((m) => { m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); });
    if (n >= MAXL) { this.paint(); return this.cash(true); }
    this.say(`🎯 Touché ! <b>×${xs(mult(n))}</b> · niveau suivant : ${ANIMALS[LEVELS[n].kind].name}, ${pct(LEVELS[n].p)} de réussite, ×${xs(mult(n + 1))}. On continue ?`);
    this.msg(`Niveau ${n} / ${MAXL} réussi`);
    this.paint();
  }

  escaped() {
    this.running = false;
    this.scope.classList.remove('on');
    const A = ANIMALS[LEVELS[this.k].kind];
    this.lose(`🌿 Le ${A.name.toLowerCase()} est passé sans que tu tires !`, null);
  }

  lose(text, how) {
    const el = this.animal;
    if (el && how) el.classList.add(how);
    this.flash('rgba(248,113,113,.45)');
    sfx.tick?.();
    const had = this.k ? ` Tu avais ×${xs(mult(this.k))} en jeu.` : '';
    this.playing = false;
    this.slotEl.classList.add('ht-lost');
    this.say(`${text}${had}`);
    this.msg(`Perdu · mise ${fmtC(this.bet)}`);
    this.setLast(0);
    this.paint();
  }

  cash(all) {
    if (!this.playing || !this.k || this.running) return;
    const x = mult(this.k), won = Math.floor(this.bet * x);
    this.playing = false;
    this.win(won);
    this.setLast(won);
    this.slotEl.classList.add('ht-won');
    this.say(all ? `🏆 Le cerf doré est à toi ! <b>${fmtC(won)}</b>` : `Encaissé : <b>${fmtC(won)}</b> (×${xs(x)})`);
    this.msg(`Gain : ${fmtC(won)} (×${xs(x)})`);
    this.paint();
    this.celebrate(won);
  }

  info() {
    const rows = LEVELS.map((l, i) => `<tr><td>${i + 1}</td><td>${ANIMALS[l.kind].name}</td><td>${l.obst.length || '—'}</td><td>${pct(l.p)}</td><td>×${xs(mult(i + 1))}</td></tr>`).join('');
    return this.rules(`<h4>Comment jouer</h4><p>Choisis ta mise et appuie sur JOUER. Un gibier traverse le terrain : <b>clique (ou touche) dessus pour tirer</b>. Si le tir est réussi, ton gain est multiplié et tu choisis : <b>ENCAISSER</b>, ou <b>NIVEAU SUIVANT</b> pour un multiplicateur plus gros. Un tir raté fait perdre la mise.</p>
      <h4>Le tir</h4><p>Un tir à côté de l’animal, ou dans un buisson, un muret, un tronc, un rocher ou un arbre derrière lequel il se cache, est raté. Si l’animal laisse le terrain sans être visé, c’est raté aussi. Un tir sur l’animal réussit avec la chance affichée pour le niveau ; sinon, il esquive.</p>
      <table class="ht-rules"><tr><th>Niv.</th><th>Gibier</th><th>Obstacles</th><th>Chance</th><th>Gain</th></tr>${rows}</table>
      <h4>Équité</h4><p>Multiplicateur après k niveaux : 0,95 ÷ (produit des chances), arrondi au centième inférieur. Un tireur parfait récupère 95 % de ses mises, quel que soit le moment où il encaisse.</p>`);
  }
}

return { ChasseGame };
})();
