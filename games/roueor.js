// SpinBet Casino · RoueOrGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/roueor.js ----
__mods['games/impl/roueor.js'] = (() => {
// La Roue d'Or: a dark metal wheel with one golden quarter. Anywhere else: nothing. On the gold: the wheel goes
// and the bonus starts: 24 cubes hide multipliers. The player keeps one cube (hidden); a quarter of the others is
// revealed, then the player can cash out the offer (the average of the cubes still hidden, his included) or go on.
// When no other cube is left, his cube is opened. Every cube is drawn from VALS (mean ≈ 3,8): the bonus is worth
// 3,8 × the stake on average, whatever the choices (the offer is always the fair average), so the return is ≈ 95 %.

const { BaseGame, fmtC, wpick } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, audioContext, isMuted } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
const GOLD = 0.25; // share of the wheel that is gold
const CUBES = 24;
const VALS = [[0.5, 3622], [1, 2312], [1.5, 1477], [2, 943], [3, 602], [5, 384], [8, 245], [10, 157], [15, 100], [25, 64], [50, 41], [100, 26], [250, 15], [1000, 11]];
const drawCubes = () => Array.from({ length: CUBES }, () => wpick(VALS));
const isGold = (deg) => deg < GOLD * 360; // pointer angle on the wheel, the gold arc is [0°, 90°)
const reveals = (left) => Math.max(1, Math.round(left / 4)); // a quarter of the other cubes still hidden
const offerOf = (hidden) => hidden.reduce((a, v) => a + v, 0) / hidden.length; // fair offer: their average
/* ===END ENGINE */

const xs = (m) => m.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const SL = 24, SA = 360 / SL;
const pt = (a, r) => { const t = ((a - 90) * Math.PI) / 180; return [150 + r * Math.cos(t), 150 + r * Math.sin(t)]; };
const arc = (a0, a1, r0, r1) => { const p0 = pt(a0, r1), p1 = pt(a1, r1), p2 = pt(a1, r0), p3 = pt(a0, r0), lg = a1 - a0 > 180 ? 1 : 0; return `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${r1} ${r1} 0 ${lg} 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} L${p2[0].toFixed(2)} ${p2[1].toFixed(2)} A${r0} ${r0} 0 ${lg} 0 ${p3[0].toFixed(2)} ${p3[1].toFixed(2)} Z`; };

function wheelSVG() {
  let s = '<g class="ro-wheel">';
  // dark brushed-metal slices
  for (let i = 0; i < SL; i++) s += `<path d="${arc(i * SA, (i + 1) * SA, 30, 146)}" fill="url(#roMetal${i % 2})" stroke="#0a0a0f" stroke-width="1.2"/>`;
  // the golden quarter, one piece, with shine
  s += `<path d="${arc(0, 90, 30, 146)}" fill="url(#roGold)" stroke="#7c5a0b" stroke-width="2"/><path class="ro-shine" d="${arc(0, 90, 30, 146)}" fill="url(#roShine)"/>`;
  s += `<text x="150" y="44" text-anchor="middle" font-family="'Bebas Neue',Impact,sans-serif" font-size="22" fill="#7c2d12" transform="rotate(45 150 150)">BONUS</text>`;
  for (let i = 0; i < 3; i++) s += `<text x="150" y="${70 + i * 22}" text-anchor="middle" font-size="12" fill="#fff7d6" transform="rotate(45 150 150)">★</text>`;
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
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.roueor, autoplay: true, mainLabel: 'LANCER',
      cls: 'table-game roueor',
      head: '<div class="hist pt-hist ro-hist"></div>',
      stage: `<div class="pt-view ro-view">
          <div class="pt-zone ro-zone"><div class="pt-ptr ro-ptr"></div>${wheelSVG()}<div class="pt-hub ro-hub">LA ROUE<br>D’OR</div></div>
          <div class="ro-bonus" hidden>
            <div class="ro-top"><h3>BONUS DES 24 CUBES</h3><div class="ro-mine"><small>TON CUBE</small><div class="ro-cube mine"><b>?</b></div></div></div>
            <div class="ro-grid">${Array.from({ length: CUBES }, (_, i) => `<button type="button" class="ro-cube" data-c="${i}" disabled><i>${i + 1}</i><b></b></button>`).join('')}</div>
            <div class="ro-say">Choisis ton cube !</div>
            <div class="ro-deal" hidden><div class="ro-offer"><small>OFFRE (moyenne des cubes cachés)</small><b>—</b></div>
              <div class="ro-btns"><button type="button" class="ro-cash">ENCAISSER</button><button type="button" class="ro-go">CONTINUER</button></div></div>
          </div>
        </div>`,
      hello: 'Un quart de la roue est en or : si elle s’arrête dessus, c’est le bonus des 24 cubes !',
    });
    this.cur = 0; this.histArr = [];
    this.wheel = this.q('.ro-wheel');
    this.root.addEventListener('click', (e) => {
      if (!this.answer) return;
      const c = e.target.closest('.ro-cube[data-c]');
      const k = c && !c.disabled ? +c.dataset.c : e.target.closest('.ro-cash') ? 'cash' : e.target.closest('.ro-go') ? 'go' : null;
      if (k === null) return;
      const r = this.answer; this.answer = null; r(k);
    });
  }

  ask() { return new Promise((res) => { this.answer = res; }); }
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

  onMain() { this.round(() => this.play()); }

  async play() {
    const bet = this.bet;
    if (!this.pay(bet)) return;
    this.lastStake = bet;
    this.setLast(0); this.winAmt.textContent = '';
    this.focusStage();
    const deg = Math.random() * 360, gold = isGold(deg);
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
      this.msg(`Pas d’or cette fois · −${fmtC(bet)}`);
      await this.zoomResult(false);
      return;
    }
    fx.burst(p.x, p.y + 20, 40, ['#fde047', '#fbbf24', '#fff']);
    sfx.feature(); fx.confetti(70);
    this.q('.ro-hub').innerHTML = '★';
    await this.zoomResult(true);
    if (this.dead) return;
    if (this.auto) this.stopAuto(); // the bonus needs the player's choices
    this.msg('★ BONUS DES 24 CUBES ★');
    const M = await this.bonus();
    if (this.dead) return;
    const won = Math.round(bet * M);
    this.win(won, 'Bonus des cubes');
    this.setLast(won);
    this.msg(`Bonus des 24 cubes : ×${xs(M)} → ${fmtC(won)}`);
    await this.celebrate(won, { summary: 'BONUS DES CUBES' });
  }

  async bonus() {
    const vals = drawCubes(), zone = this.q('.ro-zone'), box = this.q('.ro-bonus'), deal = this.q('.ro-deal');
    const cubes = this.qa('.ro-grid .ro-cube'), mine = this.q('.ro-cube.mine');
    cubes.forEach((c) => { c.className = 'ro-cube'; c.disabled = false; c.querySelector('b').textContent = ''; });
    mine.className = 'ro-cube mine'; mine.querySelector('b').textContent = '?';
    deal.hidden = true;
    // the wheel disappears, the cubes take its place
    zone.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6) rotate(40deg)' }], { duration: 500, easing: 'ease-in' });
    await this.wait(480);
    zone.hidden = true; box.hidden = false;
    box.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    cubes.forEach((c, i) => c.animate([{ transform: 'translateY(-30px) scale(.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 350, delay: i * 40, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'backwards' }));
    this.say('Choisis ton cube ! Il restera caché jusqu’à la fin.');
    this.slotEl.classList.add('ro-ask');
    const pick = await this.ask();
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
        c.classList.add('open', v >= 25 ? 'big' : v >= 5 ? 'mid' : 'low');
        const p = center(c);
        if (v >= 25) { fx.burst(p.x, p.y, 20, ['#f87171', '#fff'], 6); sfx.puff(); } else { fx.burst(p.x, p.y, 8, ['#fde047', '#fff'], 4); sfx.tick(); }
      }
      if (this.dead) return 0;
      if (!others.length) break;
      const hidden = [pick, ...others].map((i) => vals[i]), offer = offerOf(hidden);
      deal.hidden = false;
      this.q('.ro-offer b').textContent = `×${xs(Math.round(offer * 100) / 100)} · ${fmtC(Math.round(this.lastStake * offer))}`;
      this.say(`Encore ${others.length} autre${others.length > 1 ? 's' : ''} cube${others.length > 1 ? 's' : ''} caché${others.length > 1 ? 's' : ''} + le tien. Tu encaisses ou tu continues ?`);
      this.slotEl.classList.add('ro-deciding');
      const d = await this.ask();
      this.slotEl.classList.remove('ro-deciding');
      deal.hidden = true;
      if (d === 'cash') { result = Math.round(offer * 100) / 100; break; }
    }
    if (this.dead) return 0;
    // open the player's cube in any case
    const mv = vals[pick];
    await this.wait(400);
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
    const t = VALS.map(([v]) => `×${xs(v)}`).join(' · ');
    return this.rules(`<h4>La roue</h4><p>Choisis ta mise et lance. Un quart de la roue est en or : si la flèche s’arrête sur l’or, la roue disparaît et le <b>bonus des 24 cubes</b> commence. Sinon, la mise est perdue.</p>
      <h4>Le bonus des 24 cubes</h4><p>Chaque cube cache un multiplicateur. Choisis ton cube : il reste caché. Un quart des autres cubes s’ouvre, puis tu peux <b>encaisser l’offre</b> ou <b>continuer</b>. L’offre est la moyenne exacte des cubes encore cachés (le tien compris). Quand tous les autres sont ouverts, ton cube s’ouvre et tu gagnes sa valeur.</p>
      <p class="muted small">Valeurs possibles : ${t}.</p>
      <h4>Équité</h4><p>Un lancer sur 4 donne le bonus, qui vaut en moyenne ×3,8 la mise, que tu encaisses ou non. Retour au joueur ≈ 95 %.</p>`);
  }
}

return { RoueOrGame };
})();
