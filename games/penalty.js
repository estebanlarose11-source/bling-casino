// SpinBet Casino · PenaltyGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/penalty.js ----
__mods['games/impl/penalty.js'] = (() => {
// Le Penalty: shoot up to 10 penalties in a row. Pick one of 6 spots in the goal (3 columns × 2 heights);
// the keeper dives to one column (left, middle or right, each 1/3) and saves everything in it. A goal
// multiplies the pot by 1,5 (×1,44 after one, ×2,16 after two… 0,96 × 1,5^k), a save loses everything.
// The keeper ignores the shot, so every shot scores with probability 2/3 and the return is 96 %.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
const SHOTS = 10, EDGE = 0.96;
const mult = (k) => (k ? Math.floor(EDGE * 1.5 ** k * 100) / 100 : 0);
const dive = () => Math.floor(Math.random() * 3); // column the keeper covers
/* ===END ENGINE */

const xs = (m) => (m >= 100 ? m.toFixed(1).replace('.', ',') : m.toFixed(2).replace('.', ','));
const SPOTS = ['Haut gauche', 'Haut milieu', 'Haut droite', 'Bas gauche', 'Bas milieu', 'Bas droite'];
const KEEPER = `<svg viewBox="0 0 80 100" aria-hidden="true">
  <path d="M10 34 Q4 20 8 10" stroke="#facc15" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M70 34 Q76 20 72 10" stroke="#facc15" stroke-width="9" stroke-linecap="round" fill="none"/>
  <circle cx="8" cy="9" r="7" fill="#22c55e"/><circle cx="72" cy="9" r="7" fill="#22c55e"/>
  <rect x="22" y="30" width="36" height="38" rx="10" fill="#facc15" stroke="#a16207" stroke-width="2"/><text x="40" y="56" text-anchor="middle" font-family="Orbitron,sans-serif" font-weight="900" font-size="16" fill="#111">1</text>
  <circle cx="40" cy="18" r="13" fill="#f2c39a" stroke="#7c4a24" stroke-width="2"/><path d="M27 15 Q30 3 40 4 Q51 3 53 15 Q46 9 40 10 Q33 9 27 15Z" fill="#3f2a14"/>
  <circle cx="35" cy="19" r="1.8" fill="#111"/><circle cx="45" cy="19" r="1.8" fill="#111"/><path d="M35 25 Q40 28 45 25" stroke="#7c4a24" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <rect x="24" y="66" width="32" height="10" rx="3" fill="#111827"/><path d="M30 76 L28 94 M50 76 L52 94" stroke="#f2c39a" stroke-width="8" stroke-linecap="round"/><path d="M22 96 H34 M46 96 H58" stroke="#111" stroke-width="6" stroke-linecap="round"/></svg>`;
const BALL = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#fff" stroke="#111" stroke-width="2"/>
  <path d="M20 11 L27 16 L24 24 L16 24 L13 16Z" fill="#111"/><path d="M20 11 V3 M27 16 L35 13 M24 24 L29 32 M16 24 L11 32 M13 16 L5 13" stroke="#111" stroke-width="2"/></svg>`;

class PenaltyGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.penalty, autoplay: false, mainLabel: 'TIRER LA SÉRIE',
      cls: 'table-game penalty',
      head: '<div class="head-meters"><div class="meter pn-sc"><small>Buts</small><b>0 / 10</b></div><div class="meter pn-pot"><small>Gain en jeu</small><b>—</b></div></div>',
      stage: `<div class="pn-pitch">
          <div class="pn-crowd"></div>
          <div class="pn-goal"><div class="pn-net"></div>
            <div class="pn-spots">${SPOTS.map((s, i) => `<button type="button" class="pn-spot" data-spot="${i}" disabled aria-label="${s}"><i></i></button>`).join('')}</div>
            <div class="pn-keeper">${KEEPER}</div>
          </div>
          <div class="pn-grass"><div class="pn-box"></div><div class="pn-dot"></div></div>
          <div class="pn-ball">${BALL}</div>
          <div class="pn-say">Mise, puis TIRER LA SÉRIE.</div>
          <div class="pn-row"><div class="pn-hist" aria-label="Tirs"></div><button type="button" class="pn-cash" disabled><small>ENCAISSER</small><b>—</b></button></div>
          <div class="pn-ladder">${Array.from({ length: SHOTS }, (_, k) => `<span data-k="${k + 1}"><i>${k + 1}</i>×${xs(mult(k + 1))}</span>`).join('')}</div>
        </div>`,
      hello: 'Marque pour multiplier ta mise, mais si le gardien arrête le tir, tu perds tout !',
    });
    this.goal = this.q('.pn-goal'); this.keeper = this.q('.pn-keeper'); this.ball = this.q('.pn-ball');
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-spot], .pn-cash');
      if (!b || b.disabled || !this.answer) return;
      const r = this.answer; this.answer = null; r(b.classList.contains('pn-cash') ? 'cash' : +b.dataset.spot);
    });
  }

  onMeters() { if (this.mainBtn) this.mainBtn.disabled = this.busy; }
  ask() { return new Promise((res) => { this.answer = res; }); }
  say(t) { this.q('.pn-say').innerHTML = t; }

  setState(k, bet) {
    this.q('.pn-sc b').textContent = `${k} / ${SHOTS}`;
    this.q('.pn-pot b').textContent = k ? fmtC(Math.floor(bet * mult(k))) : '—';
    this.q('.pn-cash b').textContent = k ? fmtC(Math.floor(bet * mult(k))) : '—';
    this.qa('.pn-ladder span').forEach((s) => { const n = +s.dataset.k; s.classList.toggle('done', n <= k); s.classList.toggle('next', n === k + 1); });
  }

  enable(on, k) {
    this.qa('.pn-spot').forEach((b) => { b.disabled = !on; });
    this.q('.pn-cash').disabled = !on || !k;
    this.slotEl.classList.toggle('pn-ask', on);
  }

  hist(ok) {
    this.q('.pn-hist').insertAdjacentHTML('beforeend', `<i class="${ok ? 'ok' : 'ko'}">${ok ? '⚽' : '✋'}</i>`);
  }

  resetPose() {
    this.keeper.getAnimations().forEach((a) => a.cancel());
    this.ball.getAnimations().forEach((a) => a.cancel());
    this.goal.classList.remove('scored');
    this.qa('.pn-spot').forEach((s) => s.classList.remove('aim', 'hit'));
  }

  // Ball flies to the chosen spot while the keeper dives to his column.
  async shoot(spot, col) {
    const T = this.turbo ? 520 : 900;
    const s = this.q(`[data-spot="${spot}"]`), sr = s.getBoundingClientRect(), br = this.ball.getBoundingClientRect(), gr = this.goal.getBoundingClientRect();
    s.classList.add('aim');
    const dx = sr.left + sr.width / 2 - (br.left + br.width / 2), dy = sr.top + sr.height / 2 - (br.top + br.height / 2);
    const row = spot < 3 ? 0 : 1, scol = spot % 3;
    // keeper: goes to his column, at the ball's height when he guessed right, random height otherwise
    const krow = col === scol ? row : Math.random() < 0.5 ? 0 : 1;
    const kx = (col - 1) * gr.width * 0.31, ky = krow === 0 ? -gr.height * 0.18 : gr.height * 0.06;
    const rot = col === 0 ? -75 : col === 2 ? 75 : 0;
    sfx.click();
    this.ball.animate([
      { transform: 'translate(0,0) scale(1) rotate(0)' },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(.8) rotate(360deg)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(.6) rotate(720deg)` },
    ], { duration: T, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
    this.keeper.animate([
      { transform: 'translate(-50%, 0) rotate(0)' },
      { transform: `translate(calc(-50% + ${kx * 0.3}px), ${ky - 6}px) rotate(${rot * 0.3}deg)`, offset: 0.25 },
      { transform: `translate(calc(-50% + ${kx}px), ${ky}px) rotate(${rot}deg)` },
    ], { duration: T * 0.95, delay: T * 0.08, easing: 'cubic-bezier(.3,.8,.4,1)', fill: 'forwards' });
    await this.wait(T + 40);
  }

  onMain() { this.round(() => this.series()); }

  async series() {
    const bet = this.bet;
    if (!this.pay(bet)) return;
    this.lastStake = bet;
    this.setLast(0); this.winAmt.textContent = '';
    this.slotEl.classList.remove('pn-lost', 'pn-won');
    this.q('.pn-hist').innerHTML = '';
    this.resetPose();
    let k = 0;
    this.setState(0, bet);
    this.say('Choisis où tirer : clique dans le but !');
    this.msg(`Mise ${fmtC(bet)} · premier but : ×${xs(mult(1))}`);
    while (!this.dead) {
      this.enable(true, k);
      const pick = await this.ask();
      this.enable(false, k);
      if (pick === 'cash') break;
      const col = dive();
      this.say(`Tir en <b>${SPOTS[pick].toLowerCase()}</b>…`);
      await this.shoot(pick, col);
      if (this.dead) return;
      const p = center(this.q(`[data-spot="${pick}"]`));
      if (col === pick % 3) {
        this.hist(false);
        this.slotEl.classList.add('pn-lost');
        this.ball.animate([{ opacity: 1 }, { opacity: 1, transform: getComputedStyle(this.ball).transform + ' translate(0, 60px)' }], { duration: 400, fill: 'forwards' });
        this.shake();
        sfx.puff();
        this.flash('rgba(248,113,113,.55)');
        this.say(`✋ ARRÊTÉ par le gardien !${k ? ` Tu perds les ${fmtC(Math.floor(bet * mult(k)))} en jeu.` : ''}`);
        this.msg('Série perdue');
        this.setState(0, bet);
        return;
      }
      k++;
      this.hist(true);
      this.goal.classList.add('scored');
      sfx.win();
      fx.burst(p.x, p.y, 20 + k * 3, ['#fde047', '#22c55e', '#fff', '#38bdf8'], 7);
      fx.floatText(p.x, p.y - 40, `BUT ! ×${xs(mult(k))}`, '#fde047', 24);
      this.setState(k, bet);
      if (k >= SHOTS) { this.say('⚽ 10 BUTS SUR 10 ! Série parfaite !'); await this.wait(900); break; }
      this.say(`⚽ BUUUT ! <b>×${xs(mult(k))}</b> · prochain but ×${xs(mult(k + 1))}. Encore un ?`);
      await this.wait(this.turbo ? 500 : 1000);
      if (this.dead) return;
      this.resetPose();
    }
    if (this.dead) return;
    const won = Math.floor(bet * mult(k));
    this.win(won);
    this.setLast(won);
    this.slotEl.classList.add('pn-won');
    this.say(`Encaissé : <b>${fmtC(won)}</b> après ${k} but${k > 1 ? 's' : ''} !`);
    this.msg(`Gain : ${fmtC(won)} (×${xs(mult(k))})`);
    await this.celebrate(won);
    this.setState(0, bet);
  }

  info() {
    return this.rules(`<h4>Comment jouer</h4><p>Choisis ta mise et appuie sur TIRER LA SÉRIE. À chaque tir, clique sur l’un des 6 endroits du but (en haut ou en bas, à gauche, au milieu ou à droite). Le gardien plonge à gauche, au milieu ou à droite et arrête tout ce qui arrive de son côté. <b>But</b> : ton gain est multiplié par 1,5. <b>Arrêt</b> : tu perds tout. Tu peux <b>encaisser</b> après chaque but, jusqu’à 10 tirs.</p>
      <h4>Gains (× la mise)</h4><p>${Array.from({ length: SHOTS }, (_, k) => `${k + 1} but${k ? 's' : ''} : ×${xs(mult(k + 1))}`).join(' · ')}</p>
      <h4>Équité</h4><p>Le gardien choisit son côté au hasard (1 chance sur 3 chacun), sans voir ton tir : chaque tir a 2 chances sur 3 d’être un but. Retour au joueur : 96 %.</p>`);
  }
}

return { PenaltyGame };
})();
