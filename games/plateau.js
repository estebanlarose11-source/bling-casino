// SpinBet Casino · PlateauGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/plateau.js ----
__mods['games/impl/plateau.js'] = (() => {
// Le Plateau: a money wheel of 78 cases. Bet on 1, 2, 5, 10 (paid 1, 2, 5, 10 to 1) or on the two bonus games,
// "2 lancers" and "4 lancers": a board of 28 cases with multipliers, crossed by a pawn moved with two dice.
// Every case the pawn lands on adds its multiplier; a double gives one more roll. The CHANCE case cannot be bet
// on: it spins the wheel again with the same bets and multiplies that result by 10.
// Segment counts and board values are set so that every spot returns about 95 % (see tools in the commit / info()).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { BetBoard } = __mods['core/roulette.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, audioContext, isMuted } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];

/* ===ENGINE */
const SEG_COUNT = [['1', 33, 0.5], ['2', 22, 0.5], ['5', 11, 0.5], ['10', 6, 0.5], ['b2', 4, 0.37], ['b4', 1, 0.62], ['ch', 1, 0.12]];
const SEGS = SEG_COUNT.flatMap(([k, n, ph], j) => Array.from({ length: n }, (_, i) => ({ k, at: (i + ph) / n + j * 1e-4 }))).sort((a, b) => a.at - b.at).map((x) => x.k);
const NS = SEGS.length, A = 360 / NS; // 78 cases
const CHANCE_X = 10;
// the board: case 0 is DÉPART, the pawn goes round clockwise
const BOARD = [0, 1, 3, 2, 5, 2, 3, 5, 2, 2, 3, 3, 2, 6, 4, 5, 2, 3, 5, 3, 10, 3, 5, 20, 3, 100, 40, 200];
const NB = BOARD.length;
const CAPX = 10000;
const die = () => 1 + Math.floor(Math.random() * 6);
// Plays a whole bonus: rolls (plus one per double) → the list of moves and the sum of the multipliers.
function boardRun(rolls) {
  let pos = 0, left = rolls, M = 0; const moves = [];
  while (left > 0 && moves.length < 40) {
    const a = die(), b = die(), from = pos;
    pos = (pos + a + b) % NB;
    M += BOARD[pos];
    left += a === b ? 0 : -1;
    moves.push({ a, b, from, pos, v: BOARD[pos], dbl: a === b });
  }
  return { moves, M };
}
/* ===END ENGINE */

const COL = { 1: '#f5c518', 2: '#3aa0ff', 5: '#ff5fa8', 10: '#a259ff', b2: '#22c55e', b4: '#ff8a3d', ch: '#e11d48' };
const NAME = { 1: '1', 2: '2', 5: '5', 10: '10', b2: '2 lancers', b4: '4 lancers', ch: 'Chance' };
const SPOTS = ['1', '2', '5', '10', 'b2', 'b4'];
const HINT = { 1: '1 pour 1', 2: '2 pour 1', 5: '5 pour 1', 10: '10 pour 1', b2: 'Bonus 2 lancers', b4: 'Bonus 4 lancers' };
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const pips = (n) => Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n].includes(i) ? 'on' : ''}"></i>`).join('');
const dieHTML = (n) => `<div class="pt-die" data-n="${n}">${pips(n)}</div>`;
const dieIcon = (n, sz, bg) => `<svg viewBox="-12 -12 24 24" width="${sz}" height="${sz}" aria-hidden="true"><rect x="-10" y="-10" width="20" height="20" rx="5" fill="#fff" stroke="${bg}" stroke-width="2"/>${PIPS[n].map((i) => `<circle cx="${((i % 3) - 1) * 5.5}" cy="${(Math.floor(i / 3) - 1) * 5.5}" r="2.2" fill="#111"/>`).join('')}</svg>`;
const ICON = {
  b2: (sz) => dieIcon(2, sz, COL.b2),
  b4: (sz) => dieIcon(4, sz, COL.b4),
  ch: (sz) => `<svg viewBox="-12 -12 24 24" width="${sz}" height="${sz}" aria-hidden="true"><circle r="10.5" fill="#fff" stroke="#7f1d1d" stroke-width="2"/><text y="5.5" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="16" fill="#e11d48">?</text></svg>`,
};
const label = (k, sz) => (ICON[k] ? ICON[k](sz) : k);
const pt = (a, r) => { const t = ((a - 90) * Math.PI) / 180; return [150 + r * Math.cos(t), 150 + r * Math.sin(t)]; };
const slicePath = (i, r = 146) => { const p0 = pt(i * A, r), p1 = pt((i + 1) * A, r); return `M150 150 L${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${r} ${r} 0 0 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} Z`; };
const tier = (v) => (v >= 100 ? 't5' : v >= 20 ? 't4' : v >= 5 ? 't3' : v >= 3 ? 't2' : 't1');

function wheelSVG() {
  let s = '<g class="pt-wheel">';
  for (let i = 0; i < NS; i++) {
    const k = SEGS[i], ang = ((i + 0.5) * A).toFixed(2);
    s += `<path d="${slicePath(i)}" fill="${COL[k]}" stroke="#0b0716" stroke-width=".8"/>`;
    if (ICON[k]) s += `<g transform="rotate(${ang} 150 150) translate(150 18) scale(.5)"><g transform="translate(-12 -12)">${ICON[k](24)}</g></g>`;
    else {
      const rs = k.length === 2 ? [[133, 12], [121, 12]] : [[128, 15]];
      [...k].forEach((d, j) => { const [r, fs] = rs[j]; s += `<text x="150" y="${(150 - r + fs * 0.35).toFixed(1)}" text-anchor="middle" font-family="'Bebas Neue',Impact,sans-serif" font-size="${fs}" fill="#fff" stroke="#0b0716" stroke-width="2" stroke-linejoin="round" paint-order="stroke" transform="rotate(${ang} 150 150)">${d}</text>`; });
    }
  }
  s += '</g>';
  let bl = '';
  for (let b = 0; b < 52; b++) { const p = pt((b * 360) / 52, 148.5); bl += `<circle class="pt-bulb" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.5" fill="${b % 2 ? '#fff' : '#ffd23f'}" style="animation-delay:${b % 2 ? '.5' : '0'}s"/>`; }
  return `<svg class="pt-svg" viewBox="0 0 300 300"><circle cx="150" cy="150" r="149.5" fill="#0b0716"/>${s}<g>${bl}</g><circle cx="150" cy="150" r="30" fill="#140b2a" stroke="#ffd23f" stroke-width="3"/></svg>`;
}

// 8 × 8 grid, the 28 cases on its border: 0 (DÉPART) bottom right, then left, up, right and down.
function cellRC(i) {
  if (i <= 7) return [7, 7 - i];
  if (i <= 14) return [14 - i, 0];
  if (i <= 21) return [0, i - 14];
  return [i - 21, 7];
}
function boardHTML() {
  return BOARD.map((v, i) => {
    const [r, c] = cellRC(i);
    const corner = i % 7 === 0;
    return `<div class="pt-cell ${i ? tier(v) : 'start'}${corner ? ' corner' : ''}" data-i="${i}" style="grid-row:${r + 1};grid-column:${c + 1}"><i>${i}</i>${i ? `<b>×${v}</b>${v >= 20 ? '<em>★</em>' : ''}` : '<b>DÉPART</b><small>⟲</small>'}</div>`;
  }).join('');
}

function tick(v) {
  if (isMuted()) return;
  const ac = audioContext(); if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = 1500 + Math.random() * 300;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.05);
}

class PlateauGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.plateau, stepper: false, autoplay: false, mainLabel: 'LANCER', betLabel: 'Mise totale',
      cls: 'table-game plateau',
      head: '<div class="hist pt-hist"></div>',
      stage: `<div class="pt-view">
          <div class="pt-zone"><div class="pt-ptr"></div>${wheelSVG()}<div class="pt-hub">LE<br>PLATEAU</div></div>
          <div class="pt-boardwrap" hidden>
            <div class="pt-board">${boardHTML()}
              <div class="pt-mid"><div class="pt-logo">LE PLATEAU</div><h3 class="pt-title">2 LANCERS</h3><div class="pt-dice">${dieHTML(1)}${dieHTML(1)}</div>
                <div class="pt-info"><span><small>LANCERS</small><b class="pt-left">2</b></span><span class="tot"><small>TOTAL</small><b class="pt-tot">×0</b></span></div><div class="pt-say"></div></div>
              <div class="pt-pawn"><i></i></div>
            </div>
          </div>
        </div>`,
      below: `<div class="felt pt-felt"><div class="pt-spots">${SPOTS.map((k) => `<button class="pt-spot" data-k="${k}" style="--sc:${COL[k]}"><b>${label(k, 30)}</b><small>${HINT[k]}</small></button>`).join('')}</div>
        <p class="pt-note">${ICON.ch(16)}<span><b>Chance</b> : on ne mise pas dessus. Elle relance la roue avec tes mises, et ce tour-là paie <b>×${CHANCE_X}</b> !</span></p>${BetBoard.chipsHTML()}</div>`,
      hello: 'Pose tes jetons sur 1, 2, 5, 10 ou les bonus, puis lance la roue.',
    });
    this.cur = 0; this.histArr = [];
    this.board = new BetBoard(this, this.q('.pt-felt'), null);
    this.board.paint();
    this.wheel = this.q('.pt-wheel');
  }

  stakeLabel() { return this.board ? this.board.total() : 0; }
  chipSound() { sfx.click(); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = this.busy || !this.board?.total(); }

  histAdd(seg) {
    this.histArr.unshift(seg); this.histArr = this.histArr.slice(0, 12);
    this.q('.pt-hist').innerHTML = this.histArr.map((s) => `<span style="background:${COL[s]}">${ICON[s] ? ICON[s](16) : s}</span>`).join('');
  }

  // Spins the wheel to case idx: fast start, long slow end, a tick on every case.
  spin(idx, onFrame) {
    const from = this.cur, delta = ((-(idx + 0.5) * A - from) % 360 + 360) % 360;
    const to = from + 360 * (this.turbo ? 3 : 5) + delta + (Math.random() - 0.5) * A * 0.6;
    this.cur = to;
    const T = this.turbo ? 2600 : 5600, ptr = this.q('.pt-ptr');
    return new Promise((res) => {
      let t0 = null, lastN = Math.floor(from / A);
      const frame = (ts) => {
        if (this.dead) return res();
        if (t0 === null) t0 = ts;
        const p = Math.min(1, (ts - t0) / T), e = 1 - Math.pow(1 - p, 4), a = from + (to - from) * e;
        this.wheel.style.transform = `rotate(${a}deg)`;
        const n = Math.floor(a / A);
        if (n !== lastN) { lastN = n; tick(p > 0.7 ? 0.16 : 0.05); ptr.animate([{ transform: 'translateX(-50%) rotate(-16deg)' }, { transform: 'translateX(-50%)' }], { duration: 140 }); }
        onFrame?.(p);
        if (p < 1) requestAnimationFrame(frame); else res();
      };
      requestAnimationFrame(frame);
    });
  }

  // Camera: closes in on the pointer for the whole spin (gentle start, fully in at the stop), like La Roue Folle.
  zoomStart() {
    const view = this.q('.pt-view');
    view.classList.remove('done', 'unzoom');
    view.classList.add('zooming');
    this.zoomTo(0);
  }
  zoomTo(p) {
    const view = this.q('.pt-view');
    if (!view || this.dead) return;
    const e = p * p * (3 - 2 * p) * 0.35 + Math.pow(p, 2.2) * 0.65;
    view.style.setProperty('--zs', (1 + 1.4 * e).toFixed(4));
    view.style.setProperty('--zp', e.toFixed(3));
  }
  async zoomOnResult(seg, mult) {
    const view = this.q('.pt-view');
    this.zoomTo(1);
    view.dataset.seg = (ICON[seg] ? NAME[seg].toUpperCase() : seg) + (mult > 1 ? ` · ×${mult}` : '');
    view.style.setProperty('--seg', COL[seg]);
    view.classList.add('done');
    sfx.upgrade?.();
    await this.wait(1500);
    if (this.dead) return;
    view.classList.add('unzoom');
    view.style.setProperty('--zs', 1);
    view.style.setProperty('--zp', 0);
    await this.wait(900);
    view.classList.remove('zooming', 'done', 'unzoom');
  }

  onMain() {
    if (!this.board.total()) return;
    this.round(async () => {
      const placed = {}, tt = this.board.total();
      SPOTS.forEach((k) => { placed[k] = this.board.bets[k] || 0; });
      if (!this.pay(tt)) return;
      this.lastStake = tt;
      this.board.last = Object.fromEntries(Object.entries(placed).filter(([, v]) => v));
      this.focusStage();
      this.setLast(0); this.winAmt.textContent = '';
      this.qa('.pt-spot').forEach((b) => b.classList.remove('hit'));
      let mult = 1, seg;
      for (let n = 0; n < 10; n++) {
        this.msg(mult > 1 ? `CHANCE : ce tour paie ×${mult} !` : 'La roue tourne…');
        this.q('.pt-hub').innerHTML = mult > 1 ? `<b class="x">×${mult}</b>` : 'BONNE<br>CHANCE';
        this.q('.pt-hl')?.remove();
        const idx = Math.floor(Math.random() * NS);
        seg = SEGS[idx];
        this.zoomStart();
        await this.spin(idx, (p) => this.zoomTo(p));
        if (this.dead) return;
        this.histAdd(seg);
        this.wheel.insertAdjacentHTML('beforeend', `<path class="pt-hl" d="${slicePath(idx)}" fill="#fff"/>`);
        this.q('.pt-hub').innerHTML = ICON[seg] ? ICON[seg](40) : `<b class="big">${seg}</b>`;
        const p = center(this.q('.pt-ptr')); fx.burst(p.x, p.y + 20, 30, [COL[seg], '#fff']);
        await this.zoomOnResult(seg, mult);
        if (this.dead) return;
        if (seg !== 'ch') break;
        mult = CHANCE_X;
        sfx.feature(); fx.confetti(50);
        this.msg(`CHANCE ! La roue repart avec tes mises, et ce tour paie ×${CHANCE_X} !`);
        await this.wait(1600);
      }
      this.q(`.pt-spot[data-k="${seg}"]`)?.classList.add('hit');
      const b = placed[seg] || 0;
      let ret = 0, M = 0, cap = false;
      if (b > 0) {
        if (ICON[seg]) {
          this.msg(`Bonus ${NAME[seg]} !`);
          M = await this.bonus(seg === 'b2' ? 2 : 4, mult);
          if (this.dead) return;
        } else M = +seg;
        ret = b * (M + 1) * mult;
        if (ret > b * CAPX) { ret = b * CAPX; cap = true; }
      }
      const all = Object.values(placed).reduce((a, x) => a + x, 0);
      const what = ICON[seg] ? NAME[seg] : `le ${seg}`;
      this.msg((b ? `${ICON[seg] ? `${NAME[seg]} : ×${M}` : `Le ${seg} paie ${seg} pour 1`}${mult > 1 ? ` · Chance ×${mult}` : ''} → ${fmtC(ret)}${cap ? ' · GAIN MAXIMUM !' : ''}` : `La roue s’arrête sur ${what}. Pas de mise dessus.`) + ` · Bilan : ${ret - all >= 0 ? '+' : '−'}${fmtC(Math.abs(ret - all))}`);
      if (ret > 0) {
        this.win(ret, ICON[seg] ? NAME[seg] : null);
        this.setLast(ret);
        if (ret > b) await this.celebrate(ret, { summary: ICON[seg] ? NAME[seg].toUpperCase() : null });
      }
      this.board.bets = {}; this.board.stack = [];
      this.board.paint();
    });
  }

  // The board bonus: dice, pawn hopping case by case, multipliers adding up.
  async bonus(rolls, mult) {
    const run = boardRun(rolls), wrap = this.q('.pt-boardwrap'), zone = this.q('.pt-zone');
    sfx.feature(); fx.confetti(60);
    this.q('.pt-title').textContent = `${rolls} LANCERS${mult > 1 ? ` · ×${mult}` : ''}`;
    this.qa('.pt-cell').forEach((c) => c.classList.remove('hit', 'pass'));
    let left = rolls, M = 0;
    const setInfo = () => { this.q('.pt-left').textContent = left; this.q('.pt-tot').textContent = `×${M}`; };
    setInfo();
    this.q('.pt-say').textContent = 'Lance les dés et avance sur le plateau !';
    zone.hidden = true; wrap.hidden = false;
    wrap.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    this.placePawn(0, false);
    const br = this.q('.pt-board').getBoundingClientRect();
    if (br.top < 60 || br.bottom > innerHeight - 20) scrollBy({ top: br.top - 70, behavior: 'smooth' });
    await this.wait(1100);
    for (const m of run.moves) {
      if (this.dead) return 0;
      this.qa('.pt-cell.hit').forEach((c) => c.classList.remove('hit'));
      await this.rollDice(m.a, m.b);
      this.q('.pt-say').innerHTML = `${m.a} + ${m.b} = <b>${m.a + m.b}</b>${m.dbl ? ' · <b class="dbl">DOUBLE ! +1 lancer</b>' : ''}`;
      for (let s = 1; s <= m.a + m.b; s++) {
        const i = (m.from + s) % NB;
        this.placePawn(i, true);
        this.q(`.pt-cell[data-i="${i}"]`).classList.add('pass');
        sfx.tick();
        await this.wait(150);
      }
      const cell = this.q(`.pt-cell[data-i="${m.pos}"]`);
      cell.classList.add('hit');
      M += m.v;
      if (!m.dbl) left--;
      setInfo();
      const tb = this.q('.pt-tot'); tb.classList.remove('bump'); void tb.offsetWidth; tb.classList.add('bump');
      const p = center(cell);
      if (m.v) { fx.burst(p.x, p.y, 14 + Math.min(40, m.v), ['#fde047', '#fff', COL.b4], 6); fx.floatText(p.x, p.y - 20, `+×${m.v}`, '#fde047', m.v >= 20 ? 28 : 20); }
      m.v >= 20 ? sfx.bigWin?.() : sfx.coin();
      await this.wait(m.v >= 20 ? 1100 : 650);
    }
    this.q('.pt-say').innerHTML = `Total du bonus : <b>×${M}</b>${mult > 1 ? ` × ${mult} (Chance)` : ''}`;
    await this.wait(1500);
    wrap.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.92)' }], { duration: 300 });
    await this.wait(280);
    wrap.hidden = true; zone.hidden = false;
    zone.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    return M;
  }

  async rollDice(a, b) {
    const dice = this.qa('.pt-die');
    sfx.click();
    const t0 = performance.now(), T = this.turbo ? 350 : 750;
    dice.forEach((d) => d.classList.add('rolling'));
    while (performance.now() - t0 < T) {
      dice.forEach((d) => { d.innerHTML = pips(1 + Math.floor(Math.random() * 6)); });
      await sleep(70);
    }
    [a, b].forEach((n, k) => { dice[k].dataset.n = n; dice[k].innerHTML = pips(n); dice[k].classList.remove('rolling'); });
    dice.forEach((d) => d.animate([{ transform: 'scale(1.3) rotate(-12deg)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.3,1.6,.5,1)' }));
    await this.wait(380);
  }

  placePawn(i, hop) {
    const cell = this.q(`.pt-cell[data-i="${i}"]`), pawn = this.q('.pt-pawn'), bd = this.q('.pt-board');
    const r = cell.getBoundingClientRect(), br = bd.getBoundingClientRect();
    pawn.style.left = `${r.left - br.left + r.width / 2}px`; pawn.style.top = `${r.top - br.top + r.height / 2}px`;
    if (hop) pawn.animate([{ translate: '-50% -50%' }, { translate: '-50% -95%' }, { translate: '-50% -50%' }], { duration: 150 });
  }

  info() {
    const cells = BOARD.map((v, i) => (i ? `×${v}` : 'DÉPART')).join(' · ');
    return this.rules(`<h4>La roue</h4><p>78 cases : 33 × <b>1</b>, 22 × <b>2</b>, 11 × <b>5</b>, 6 × <b>10</b>, 4 × <b>2 lancers</b>, 1 × <b>4 lancers</b> et 1 × <b>Chance</b>. Pose tes jetons sur une ou plusieurs cases, puis lance. Le 1 paie 1 pour 1, le 2 paie 2 pour 1, le 5 paie 5 pour 1, le 10 paie 10 pour 1 (ta mise est rendue en plus).</p>
      <h4>Chance</h4><p>On ne peut pas miser sur la case Chance. Si la roue s’arrête dessus, elle repart avec les mêmes mises et ce tour-là paie <b>×${CHANCE_X}</b>.</p>
      <h4>Bonus 2 lancers et 4 lancers</h4><p>Le pion part de DÉPART sur un plateau de 28 cases. Tu lances 2 dés et le pion avance du total. Chaque case où il s’arrête ajoute son multiplicateur. Un <b>double</b> donne un lancer en plus. À la fin, ta mise sur le bonus est payée le total des multiplicateurs pour 1.</p>
      <p class="muted small">Plateau : ${cells}.</p>
      <h4>Équité</h4><p>Retour au joueur d’environ 95 % sur chaque case (gain maximum ×${CAPX.toLocaleString('fr-FR')} la mise d’une case).</p>`);
  }
}

return { PlateauGame };
})();
