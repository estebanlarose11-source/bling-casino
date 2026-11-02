// SpinBet Casino · RoueOrGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/roueor.js ----
__mods['games/impl/roueor.js'] = (() => {
// La Roue d'Or: a dark metal wheel with one golden part (Simple 40 %, Moyen 25 %, Compliqué 12,5 % of the wheel;
// the smaller the gold, the bigger the cubes). Anywhere else: nothing. On the gold: the wheel goes
// and the bonus starts: 24 cubes hide multipliers. The player keeps one cube (hidden); a quarter of the others is
// revealed, then the player can cash out the offer (the average of the cubes still hidden, his included) or go on.
// When no other cube is left, his cube is opened. Cubes are drawn from the level's table: (gold share) × (mean cube)
// ≈ 0,95 in every level, whatever the choices (the offer is always the fair average), so the return is ≈ 95 %.

const { BaseGame, fmtC, wpick } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, audioContext, isMuted } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { mergeOpts, withRoom } = __mods['online.js'];

/* ===ENGINE */
const CUBES = 24;
// gold: share of the wheel that gives the bonus; vals: [multiplier, weight] of each cube (mean × gold ≈ 0,95)
const MODES = [
  { id: 'simple', label: 'Simple', gold: 0.40, vals: [[0.5, 3554], [1, 2294], [1.5, 1480], [2, 955], [3, 616], [4, 398], [5, 257], [8, 166], [10, 107], [15, 69], [25, 45], [50, 29], [100, 19], [250, 12]] },
  { id: 'moyen', label: 'Moyen', gold: 0.25, vals: [[0.5, 3622], [1, 2312], [1.5, 1477], [2, 943], [3, 602], [5, 384], [8, 245], [10, 157], [15, 100], [25, 64], [50, 41], [100, 26], [250, 15], [1000, 11]] },
  { id: 'dur', label: 'Compliqué', gold: 0.125, vals: [[1, 3807], [2, 2359], [3, 1461], [4, 905], [5, 561], [8, 348], [10, 215], [15, 133], [25, 83], [50, 51], [100, 32], [250, 20], [500, 12], [1000, 6], [5000, 5]] },
];
const drawCubes = (m) => Array.from({ length: CUBES }, () => wpick(m.vals));
const isGold = (deg, m) => deg < m.gold * 360; // pointer angle on the wheel, the gold arc is [0°, gold × 360°)
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const reveals = (left) => Math.max(1, Math.round(left / 4)); // a quarter of the other cubes still hidden
const offerOf = (hidden) => hidden.reduce((a, v) => a + v, 0) / hidden.length; // fair offer: their average
// The wheel's angle (the same for every player of an online table; each player's level decides if it is gold).
const outcome = (R = Math.random) => ({ deg: R() * 360 });
/* ===END ENGINE */

const xs = (m) => m.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const SL = 24, SA = 360 / SL;
const pt = (a, r) => { const t = ((a - 90) * Math.PI) / 180; return [150 + r * Math.cos(t), 150 + r * Math.sin(t)]; };
const arc = (a0, a1, r0, r1) => { const p0 = pt(a0, r1), p1 = pt(a1, r1), p2 = pt(a1, r0), p3 = pt(a0, r0), lg = a1 - a0 > 180 ? 1 : 0; return `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${r1} ${r1} 0 ${lg} 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} L${p2[0].toFixed(2)} ${p2[1].toFixed(2)} A${r0} ${r0} 0 ${lg} 0 ${p3[0].toFixed(2)} ${p3[1].toFixed(2)} Z`; };

const maxOf = (m) => m.vals[m.vals.length - 1][0];
const meanOf = (m) => m.vals.reduce((a, [v, w]) => a + v * w, 0) / m.vals.reduce((a, [, w]) => a + w, 0);
const big = (v, m) => v >= maxOf(m) / 40; // red "big" cubes

function wheelSVG(m) {
  const G = m.gold * 360;
  let s = '<g class="ro-wheel">';
  // dark brushed-metal slices
  for (let i = 0; i < SL; i++) s += `<path d="${arc(i * SA, (i + 1) * SA, 30, 146)}" fill="url(#roMetal${i % 2})" stroke="#0a0a0f" stroke-width="1.2"/>`;
  // the golden quarter, one piece, with shine
  s += `<path d="${arc(0, G, 30, 146)}" fill="url(#roGold)" stroke="#7c5a0b" stroke-width="2"/><path class="ro-shine" d="${arc(0, G, 30, 146)}" fill="url(#roShine)"/>`;
  s += `<text x="150" y="44" text-anchor="middle" font-family="KeCoin,'Bebas Neue',Impact,sans-serif" font-size="${G < 60 ? 16 : 22}" fill="#7c2d12" transform="rotate(${G / 2} 150 150)">BONUS</text>`;
  for (let i = 0; i < 3; i++) s += `<text x="150" y="${70 + i * 22}" text-anchor="middle" font-size="12" fill="#fff7d6" transform="rotate(${G / 2} 150 150)">★</text>`;
  s += '</g>';
  let bl = '';
  for (let b = 0; b < 40; b++) { const p = pt((b * 360) / 40, 148.5); bl += `<circle class="pt-bulb" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.5" fill="${b % 2 ? '#fff' : '#fbbf24'}" style="animation-delay:${b % 2 ? '.5' : '0'}s"/>`; }
  return `<svg class="pt-svg ro-svg" viewBox="0 0 300 300"><defs>
      <linearGradient id="roMetal0" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4b5563"/><stop offset=".5" stop-color="#1f2937"/><stop offset="1" stop-color="#374151"/></linearGradient>
      <linearGradient id="roMetal1" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#374151"/><stop offset=".5" stop-color="#111827"/><stop offset="1" stop-color="#4b5563"/></linearGradient>
      <linearGradient id="roGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7d6"/><stop offset=".3" stop-color="#fcd34d"/><stop offset=".6" stop-color="#d97706"/><stop offset="1" stop-color="#fde68a"/></linearGradient>
      <linearGradient id="roShine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs><circle cx="150" cy="150" r="149.5" fill="#0a0a0f"/>${s}<g>${bl}</g><circle cx="150" cy="150" r="30" fill="#111827" stroke="#fbbf24" stroke-width="3"/></svg>`;
}

function tick(v) {
  if (isMuted()) return;
  const ac = audioContext(); if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = 1300 + Math.random() * 300;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.05);
}

class RoueOrGame extends BaseGame {
  constructor(root, game, ov) {
    super(root, game, mergeOpts(ov, {
      music: EXTRA_THEMES.roueor, autoplay: true, mainLabel: 'LANCER',
      cls: 'table-game roueor',
      head: '<div class="hist pt-hist ro-hist"></div>',
      stage: `<div class="pt-view ro-view">
          <div class="pt-zone ro-zone"><div class="pt-ptr ro-ptr"></div><div class="ro-wheelhost"></div><div class="pt-hub ro-hub">LA ROUE<br>D’OR</div></div>
          <div class="ro-bonus" hidden>
            <div class="ro-top"><h3>BONUS DES 24 CUBES</h3><div class="ro-mine"><small>TON CUBE</small><div class="ro-cube mine"><b>?</b></div></div></div>
            <div class="ro-grid">${Array.from({ length: CUBES }, (_, i) => `<button type="button" class="ro-cube" data-c="${i}" disabled><i>${i + 1}</i><b></b></button>`).join('')}</div>
            <div class="ro-say">Choisis ton cube !</div>
            <div class="ro-deal" hidden><div class="ro-offer"><small>OFFRE (moyenne des cubes cachés)</small><b>—</b></div>
              <div class="ro-btns"><button type="button" class="ro-cash">ENCAISSER</button><button type="button" class="ro-go">CONTINUER</button></div></div>
          </div>
        </div>`,
      below: `<div class="ro-modes">${MODES.map((m, i) => `<button type="button" data-mode="${i}"><b>${m.label}</b><small>Bonus ${Math.round(m.gold * 1000) / 10} % · jusqu’à ×${maxOf(m).toLocaleString('fr-FR')}</small></button>`).join('')}</div>
        <div class="rt-tools"><button type="button" class="rt-autoplay" data-ro-auto>▶ Tours auto</button></div>
        <div class="rt-autopick" hidden><span>Combien de tours ?</span>${[10, 25, 50, 100, 250].map((n) => `<button type="button" data-ro-n="${n}">${n}</button>`).join('')}</div>`,
      hello: 'Si la roue s’arrête sur l’or, c’est le bonus des 24 cubes ! Choisis ton niveau : plus c’est compliqué, plus les cubes sont gros.',
    }));
    this.mi = this.loadNum('roueor_mode', 1, 0, MODES.length - 1);
    this.cur = 0; this.histArr = [];
    this.setMode(this.mi);
    this.root.addEventListener('click', (e) => {
      if (e.target.closest('[data-ro-auto]')) {
        if (this.auto) this.stopAuto(); else this.q('.rt-autopick').hidden = !this.q('.rt-autopick').hidden;
        return;
      }
      const rn = e.target.closest('[data-ro-n]');
      if (rn) { this.q('.rt-autopick').hidden = true; if (!this.busy && !this.auto) { this.auto = +rn.dataset.roN; this.updateMeters(); this.onMain(); } return; }
      const md = e.target.closest('[data-mode]');
      if (md && !this.busy && !md.disabled) { this.setMode(+md.dataset.mode); sfx.click(); }
      if (!this.answer) return;
      const c = e.target.closest('.ro-cube[data-c]');
      const k = c && !c.disabled ? +c.dataset.c : e.target.closest('.ro-cash') ? 'cash' : e.target.closest('.ro-go') ? 'go' : null;
      if (k === null) return;
      const r = this.answer; this.answer = null; r(k);
    });
  }

  get mode() { return MODES[this.mi]; }

  // Level: redraws the wheel with its gold share (keeping the wheel's current angle).
  setMode(i) {
    this.mi = i; this.saveKey('roueor_mode', i);
    this.q('.ro-wheelhost').innerHTML = wheelSVG(this.mode);
    this.wheel = this.q('.ro-wheel');
    this.wheel.style.transform = `rotate(${this.cur}deg)`;
    this.qa('[data-mode]').forEach((b) => b.classList.toggle('on', +b.dataset.mode === i));
  }

  onMeters() {
    this.qa('[data-mode]').forEach((b) => { b.disabled = this.busy; });
    const ab = this.q('[data-ro-auto]');
    if (ab) { ab.classList.toggle('on', !!this.auto); ab.textContent = this.auto ? `■ Stop (${this.auto})` : '▶ Tours auto'; }
  }

  // the player's answer; online, `def` is chosen for him after ms (so a table never waits for an absent player)
  ask(def, ms = 0) {
    return new Promise((res) => {
      let t = 0;
      this.answer = (v) => { clearTimeout(t); res(v); };
      if (ms) t = setTimeout(() => { if (!this.answer) return; const r = this.answer; this.answer = null; r(typeof def === 'function' ? def() : def); }, ms);
    });
  }
  say(t) { this.q('.ro-say').innerHTML = t; }

  histAdd(g) {
    this.histArr.unshift(g); this.histArr = this.histArr.slice(0, 14);
    this.q('.ro-hist').innerHTML = this.histArr.map((x) => `<span class="${x ? 'gold' : ''}">${x ? '★' : '·'}</span>`).join('');
  }

  // Lands the pointer on a random angle of the wheel (gold or not), with the same zoom as the other wheels.
  spin(deg, onFrame) {
    const from = this.cur, delta = ((-deg - from) % 360 + 360) % 360;
    const to = from + 360 * (this.turbo ? 3 : 5) + delta;
    this.cur = to;
    const T = this.turbo ? 2600 : 5400, ptr = this.q('.ro-ptr');
    return new Promise((res) => {
      let t0 = null, lastN = Math.floor(from / SA);
      const frame = (ts) => {
        if (this.dead) return res();
        if (t0 === null) t0 = ts;
        const p = Math.min(1, (ts - t0) / T), e = 1 - Math.pow(1 - p, 4), a = from + (to - from) * e;
        this.wheel.style.transform = `rotate(${a}deg)`;
        const n = Math.floor(a / SA);
        if (n !== lastN) { lastN = n; tick(p > 0.7 ? 0.16 : 0.05); ptr.animate([{ transform: 'translateX(-50%) rotate(-16deg)' }, { transform: 'translateX(-50%)' }], { duration: 140 }); }
        onFrame?.(p);
        if (p < 1) requestAnimationFrame(frame); else res();
      };
      requestAnimationFrame(frame);
    });
  }

  zoomTo(p) {
    const view = this.q('.ro-view');
    if (!view || this.dead) return;
    const e = p * p * (3 - 2 * p) * 0.35 + Math.pow(p, 2.2) * 0.65;
    view.style.setProperty('--zs', (1 + 1.4 * e).toFixed(4));
    view.style.setProperty('--zp', e.toFixed(3));
  }

  async zoomResult(gold) {
    const view = this.q('.ro-view');
    view.dataset.seg = gold ? '★ BONUS ★' : 'RIEN';
    view.style.setProperty('--seg', gold ? '#d97706' : '#374151');
    view.classList.add('done');
    await this.wait(gold ? 1500 : 1000);
    if (this.dead) return;
    view.classList.add('unzoom');
    view.style.setProperty('--zs', 1); view.style.setProperty('--zp', 0);
    await this.wait(900);
    view.classList.remove('zooming', 'done', 'unzoom');
  }

  onMain() {
    this.round(async () => {
      const bet = this.bet;
      if (!this.pay(bet)) return;
      this.lastStake = bet;
      this.setLast(0); this.winAmt.textContent = '';
      this.focusStage();
      await this.play(outcome(), { [this.mode.id]: bet });
    });
  }

  // Plays a drawn round on screen: placed = { level id: stake } (empty online when the player only watches).
  async play(O, placed) {
    const id = Object.keys(placed)[0], bet = id ? placed[id] : 0;
    if (id) { const i = MODES.findIndex((x) => x.id === id); if (i > -1 && i !== this.mi) this.setMode(i); }
    const m = this.mode, deg = O.deg, gold = isGold(deg, m);
    this.msg('La roue tourne…');
    this.q('.ro-hub').innerHTML = 'BONNE<br>CHANCE';
    const view = this.q('.ro-view');
    view.classList.remove('done', 'unzoom'); view.classList.add('zooming'); this.zoomTo(0);
    await this.spin(deg, (p) => this.zoomTo(p));
    if (this.dead) return;
    this.zoomTo(1);
    this.histAdd(gold);
    const p = center(this.q('.ro-ptr'));
    if (!gold) {
      this.q('.ro-hub').innerHTML = '✕';
      fx.burst(p.x, p.y + 20, 12, ['#6b7280', '#9ca3af']);
      this.msg(bet ? `Pas d’or cette fois · −${fmtC(bet)}` : 'Pas d’or cette fois');
      await this.zoomResult(false);
      return 0;
    }
    fx.burst(p.x, p.y + 20, 40, ['#fde047', '#fbbf24', '#fff']);
    sfx.feature(); fx.confetti(70);
    this.q('.ro-hub').innerHTML = '★';
    await this.zoomResult(true);
    if (this.dead) return;
    if (this.auto) this.stopAuto(); // the bonus needs the player's choices
    if (!bet) { this.msg('★ De l’or ! Les joueurs qui ont misé jouent leur bonus des 24 cubes…'); return 0; }
    this.msg('★ BONUS DES 24 CUBES ★');
    const M = await this.bonus(m);
    if (this.dead) return 0;
    const won = Math.round(bet * M);
    this.win(won, 'Bonus des cubes');
    this.setLast(won);
    this.msg(`Bonus des 24 cubes : ×${xs(M)} → ${fmtC(won)}`);
    await this.celebrate(won, { summary: 'BONUS DES CUBES', quick: this.online });
    return won;
  }

  async bonus(m) {
    const vals = drawCubes(m), zone = this.q('.ro-zone'), box = this.q('.ro-bonus'), deal = this.q('.ro-deal');
    const cubes = this.qa('.ro-grid .ro-cube'), mine = this.q('.ro-cube.mine');
    cubes.forEach((c) => { c.className = 'ro-cube'; c.disabled = false; c.querySelector('b').textContent = ''; });
    mine.className = 'ro-cube mine'; mine.querySelector('b').textContent = '?';
    deal.hidden = true;
    // the wheel disappears, the cubes take its place
    zone.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6) rotate(40deg)' }], { duration: 500, easing: 'ease-in' });
    await this.wait(480);
    zone.hidden = true; box.hidden = false;
    box.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    this.q('.ro-top h3').textContent = `BONUS ${m.label.toUpperCase()} · 24 CUBES`;
    // 1. every multiplier is shown face up
    cubes.forEach((c, i) => {
      c.disabled = true;
      c.querySelector('b').textContent = `×${xs(vals[i])}`;
      c.classList.add('show', big(vals[i], m) ? 'big' : vals[i] >= 5 ? 'mid' : 'low');
      c.animate([{ transform: 'translateY(-30px) scale(.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 350, delay: i * 40, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'backwards' });
    });
    this.say('Voici les 24 multiplicateurs de ce bonus… retiens bien les gros !');
    await this.wait(this.turbo ? 2200 : 4200);
    if (this.dead) return 0;
    // 2. they turn face down
    this.say('Les cubes se cachent…');
    for (let i = 0; i < CUBES; i++) {
      const c = cubes[i];
      c.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }, { transform: 'rotateY(0)' }], { duration: 360 });
      setTimeout(() => { c.className = 'ro-cube'; c.querySelector('b').textContent = ''; }, 180);
      if (i % 3 === 0) sfx.tick();
      await this.wait(this.turbo ? 25 : 45);
    }
    await this.wait(500);
    // 3. shuffle: the cubes swap places for a moment, and the multipliers are mixed for real
    this.say('On mélange !');
    shuffle(vals);
    const rects = cubes.map((c) => c.getBoundingClientRect());
    for (let round = 0; round < 3 && !this.dead; round++) {
      const to = shuffle([...Array(CUBES).keys()]);
      cubes.forEach((c, i) => {
        const dx = rects[to[i]].left - rects[i].left, dy = rects[to[i]].top - rects[i].top;
        c.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) rotate(${(Math.random() - 0.5) * 40}deg)` }, { transform: 'none' }], { duration: this.turbo ? 420 : 700, easing: 'ease-in-out' });
      });
      sfx.spin?.();
      await this.wait(this.turbo ? 420 : 700);
    }
    if (this.dead) return 0;
    cubes.forEach((c) => { c.disabled = false; });
    this.say(`Choisis ton cube ! Il restera caché jusqu’à la fin.${this.online ? ' <small>(choix auto dans 15 s)</small>' : ''}`);
    this.slotEl.classList.add('ro-ask');
    const pick = await this.ask(() => Math.floor(Math.random() * CUBES), this.online ? 15000 : 0);
    this.slotEl.classList.remove('ro-ask');
    if (this.dead) return 0;
    sfx.click();
    cubes.forEach((c) => { c.disabled = true; });
    cubes[pick].classList.add('taken');
    mine.querySelector('b').textContent = pick + 1;
    mine.classList.add('set');
    let others = [...Array(CUBES).keys()].filter((i) => i !== pick);
    let result = null;
    while (!this.dead) {
      // a quarter of the other hidden cubes opens, one by one
      const n = reveals(others.length);
      const open = others.sort(() => Math.random() - 0.5).slice(0, n);
      others = others.filter((i) => !open.includes(i));
      this.say(`Ouverture de ${n} cube${n > 1 ? 's' : ''}…`);
      for (const i of open) {
        await this.wait(this.turbo ? 250 : 550);
        const c = cubes[i], v = vals[i];
        c.querySelector('b').textContent = `×${xs(v)}`;
        c.classList.add('open', big(v, m) ? 'big' : v >= 5 ? 'mid' : 'low');
        const p = center(c);
        if (big(v, m)) { fx.burst(p.x, p.y, 20, ['#f87171', '#fff'], 6); sfx.puff(); } else { fx.burst(p.x, p.y, 8, ['#fde047', '#fff'], 4); sfx.tick(); }
      }
      if (this.dead) return 0;
      if (!others.length) break;
      const hidden = [pick, ...others].map((i) => vals[i]), offer = offerOf(hidden);
      deal.hidden = false;
      this.q('.ro-offer b').textContent = `×${xs(Math.round(offer * 100) / 100)} · ${fmtC(Math.round(this.lastStake * offer))}`;
      this.say(`Encore ${others.length} autre${others.length > 1 ? 's' : ''} cube${others.length > 1 ? 's' : ''} caché${others.length > 1 ? 's' : ''} + le tien. Tu encaisses ou tu continues ?${this.online ? ' <small>(sans réponse en 10 s, tu encaisses)</small>' : ''}`);
      this.slotEl.classList.add('ro-deciding');
      const d = await this.ask('cash', this.online ? 10000 : 0);
      this.slotEl.classList.remove('ro-deciding');
      deal.hidden = true;
      if (d === 'cash') { result = Math.round(offer * 100) / 100; break; }
    }
    if (this.dead) return 0;
    // open the player's cube in any case
    const mv = vals[pick];
    await this.wait(400);
    // then every cube still closed shows what it was hiding
    if (others.length) {
      this.say('Voici ce que cachaient les autres cubes…');
      for (const i of others) {
        const c = cubes[i], v = vals[i];
        c.querySelector('b').textContent = `×${xs(v)}`;
        c.classList.add('open', 'late', big(v, m) ? 'big' : v >= 5 ? 'mid' : 'low');
        sfx.tick();
        await this.wait(this.turbo ? 60 : 140);
      }
      await this.wait(500);
    }
    cubes[pick].classList.remove('taken');
    cubes[pick].classList.add('open', 'mine-open');
    cubes[pick].querySelector('b').textContent = `×${xs(mv)}`;
    mine.querySelector('b').textContent = `×${xs(mv)}`;
    mine.classList.add('open');
    const p = center(mine);
    fx.burst(p.x, p.y, 40, ['#fde047', '#fbbf24', '#fff'], 8);
    sfx.bigWin();
    const M = result ?? mv;
    this.say(result !== null ? `Tu as encaissé ×${xs(result)}. Ton cube valait ×${xs(mv)} ${mv > result ? '😬' : '😎'}` : `Ton cube vaut <b>×${xs(mv)}</b> !`);
    await this.wait(2600);
    box.hidden = true; zone.hidden = false;
    zone.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 400 });
    return M;
  }

  info() {
    const lv = MODES.map((m) => `<b>${m.label}</b> : ${Math.round(m.gold * 1000) / 10} % de la roue en or, cubes de ×${xs(m.vals[0][0])} à ×${xs(maxOf(m))} (moyenne ×${xs(Math.round(meanOf(m) * 10) / 10)})`).join('<br>');
    return this.rules(`<h4>La roue</h4><p>Choisis ta mise, ton niveau, et lance. Si la flèche s’arrête sur l’or, la roue disparaît et le <b>bonus des 24 cubes</b> commence. Sinon, la mise est perdue.</p>
      <h4>Les niveaux</h4><p>${lv}</p><p>Plus c’est compliqué, moins il y a d’or sur la roue, mais plus les multiplicateurs des cubes sont gros.</p>
      <h4>Le bonus des 24 cubes</h4><p>Les 24 multiplicateurs sont d’abord montrés, puis les cubes se retournent et sont mélangés. Choisis ton cube : il reste caché. Un quart des autres cubes s’ouvre, puis tu peux <b>encaisser l’offre</b> ou <b>continuer</b>. L’offre est la moyenne exacte des cubes encore cachés (le tien compris). Quand tous les autres sont ouverts, ton cube s’ouvre et tu gagnes sa valeur.</p>
      <h4>Équité</h4><p>Dans chaque niveau, (part d’or) × (valeur moyenne d’un cube) ≈ 0,95 : retour au joueur ≈ 95 %, que tu encaisses ou non.</p>`);
  }
}

// La Roue d’Or Online: one wheel for the whole salon, each player at his own level (online.js, withRoom). The bonus of
// the 24 cubes is each player's own (his choices); his result reaches the others when he has finished.
const RoueOrOnlineGame = withRoom(RoueOrGame, {
  cls: 'g-roueor',
  outcome: (R) => outcome(R),
  bets() { return { [this.mode.id]: this.bet }; },
  payout: (O, d, { seat }) => {
    const id = Object.keys(d)[0], m = MODES.find((x) => x.id === id);
    if (!m || !isGold(O.deg, m)) return 0;
    return seat?.done && seat.acts !== '' ? +seat.acts || 0 : null; // null: still in the bonus
  },
  // a long result when the wheel is gold for one of the levels played (the bonus), a short one otherwise
  resultMs: (O, a) => ((a.p || []).some((p) => { const m = MODES.find((x) => x.id === Object.keys(p.d || {})[0]); return m && isGold(O.deg, m); }) ? 90000 : 10000),
  reset() { this.q('.ro-hub').innerHTML = 'BONNE<br>CHANCE'; },
  belowWrap: 'ro-felt',
  hello: 'Choisis ton niveau et ta mise, puis appuie sur PRÊT : la roue part quand tout le salon est prêt.',
  rules: '<p>Chaque joueur choisit son niveau : la même roue tombe dans l’or pour certains niveaux et pas pour d’autres. Le bonus des 24 cubes se joue chacun pour soi ; sans réponse, ton cube est choisi au hasard au bout de 15 s et tu encaisses l’offre au bout de 10 s.</p>',
});

return { RoueOrGame, RoueOrOnlineGame, outcome };
})();
