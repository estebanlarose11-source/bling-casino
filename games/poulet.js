// SpinBet Casino · PouletGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/poulet.js ----
__mods['games/impl/poulet.js'] = (() => {
// Le Poulet: the chicken crosses a road lane by lane. Each lane it survives raises the multiplier,
// a car on the lane loses the stake; cash out whenever you like. Every lane is an independent draw
// with a fixed crash chance p (by difficulty) and the multiplier after k lanes is 0,96 / (1 − p)^k,
// so whatever the moment you cash out the return is 96 % (a hair less with the rounding down).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
const EDGE = 0.96;
const MODES = [
  { id: 'easy', label: 'Facile', p: 1 / 25, lanes: 24 },
  { id: 'mid', label: 'Moyen', p: 3 / 25, lanes: 22 },
  { id: 'hard', label: 'Difficile', p: 5 / 25, lanes: 20 },
  { id: 'xtrem', label: 'Extrême', p: 10 / 25, lanes: 15 },
];
const mult = (k, m) => (k ? Math.floor((EDGE / (1 - m.p) ** k) * 100) / 100 : 0);
const crash = (m) => Math.random() < m.p;
/* ===END ENGINE */

const xs = (m) => (m >= 1000 ? Math.round(m).toLocaleString('fr-FR') : m >= 100 ? m.toFixed(1).replace('.', ',') : m.toFixed(2).replace('.', ','));
const CAR_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#a855f7', '#22c55e', '#f97316', '#ec4899', '#14b8a6'];
const car = (c) => `<svg viewBox="0 0 40 70" aria-hidden="true"><rect x="3" y="4" width="34" height="62" rx="10" fill="${c}" stroke="rgba(0,0,0,.45)" stroke-width="2"/>
  <rect x="8" y="14" width="24" height="12" rx="4" fill="#0f172a" opacity=".85"/><rect x="8" y="44" width="24" height="9" rx="3" fill="#0f172a" opacity=".7"/>
  <rect x="9" y="29" width="22" height="12" rx="3" fill="#fff" opacity=".18"/><circle cx="10" cy="64" r="3" fill="#fde68a"/><circle cx="30" cy="64" r="3" fill="#fde68a"/>
  <rect x="0" y="16" width="4" height="10" rx="2" fill="#111"/><rect x="36" y="16" width="4" height="10" rx="2" fill="#111"/><rect x="0" y="46" width="4" height="10" rx="2" fill="#111"/><rect x="36" y="46" width="4" height="10" rx="2" fill="#111"/></svg>`;
const CHICK = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M26 54 L24 62 M24 62 L20 63 M24 62 L27 63 M36 54 L38 62 M38 62 L35 63 M38 62 L42 63" stroke="#f59e0b" stroke-width="2.6" stroke-linecap="round"/>
  <ellipse cx="32" cy="40" rx="18" ry="16" fill="#fff" stroke="#cbd5e1" stroke-width="2"/><path d="M16 38 Q8 30 12 24 Q18 30 20 34Z" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5"/>
  <ellipse cx="38" cy="42" rx="9" ry="6" fill="#e2e8f0" transform="rotate(-18 38 42)"/><circle cx="40" cy="20" r="12" fill="#fff" stroke="#cbd5e1" stroke-width="2"/>
  <path d="M34 9 Q36 3 39 8 Q41 2 44 8 Q47 4 47 11 Q42 10 34 11Z" fill="#ef4444"/><path d="M51 20 L58 23 L51 26Z" fill="#f59e0b"/><path d="M49 27 Q52 33 47 33 Q46 29 49 27Z" fill="#ef4444"/>
  <circle cx="44" cy="18" r="2.6" fill="#0f172a"/><circle cx="45" cy="17" r=".9" fill="#fff"/></svg>`;
const FEATHER = '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="44" rx="22" ry="8" fill="#fff" opacity=".9"/><path d="M14 40 Q20 30 26 40 M30 38 Q36 28 42 38 M40 42 Q48 34 52 44" stroke="#e2e8f0" stroke-width="3" fill="none"/><path d="M26 30 L30 36 L34 30" stroke="#ef4444" stroke-width="3" fill="none"/><text x="32" y="22" text-anchor="middle" font-size="16">💫</text></svg>';
const BARRIER = '<svg viewBox="0 0 80 20" aria-hidden="true"><rect x="2" y="4" width="76" height="12" rx="4" fill="#fff" stroke="#111" stroke-width="1.5"/><path d="M10 4 L4 16 M24 4 L16 16 M38 4 L30 16 M52 4 L44 16 M66 4 L58 16 M78 6 L72 16" stroke="#ef4444" stroke-width="6"/></svg>';

class PouletGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.poulet, autoplay: false, mainLabel: 'JOUER',
      cls: 'table-game poulet',
      head: '<div class="head-meters"><div class="meter pl-cur"><small>Multiplicateur</small><b>—</b></div><div class="meter pl-nxt"><small>Prochain</small><b>—</b></div><div class="meter pl-cash"><small>Encaissable</small><b>0,00 KE</b></div></div>',
      stage: '<div class="pl-road"><div class="pl-track"></div></div><div class="pl-bar"><span class="pl-say">Choisis ta mise et la difficulté, puis JOUER.</span><button type="button" class="pl-go" disabled>AVANCER ➜</button></div>',
      below: `<div class="pl-modes">${MODES.map((m, i) => `<button type="button" data-mode="${i}"><b>${m.label}</b><small>${m.lanes} voies · max ×${xs(mult(m.lanes, m))}</small></button>`).join('')}</div>`,
      hello: 'Fais traverser le poulet : chaque voie franchie multiplie ta mise !',
    });
    this.mi = this.loadNum('poulet_mode', 1, 0, MODES.length - 1);
    this.playing = false; this.k = 0; this.moving = false;
    this.road = this.q('.pl-road'); this.track = this.q('.pl-track');
    this.goBtn = this.q('.pl-go');
    this.root.addEventListener('click', (e) => {
      const m = e.target.closest('[data-mode]'); if (m && !this.playing) this.setMode(+m.dataset.mode);
      if (e.target.closest('.pl-go')) this.step();
      const l = e.target.closest('.pl-lane'); if (l && this.playing && +l.dataset.k === this.k + 1) this.step();
    });
    this.onArrow = (e) => { if (e.code === 'ArrowRight' && this.playing && !e.target.closest('input, textarea')) { e.preventDefault(); this.step(); } };
    addEventListener('keydown', this.onArrow);
    this.setMode(this.mi);
  }

  destroy() { removeEventListener('keydown', this.onArrow); super.destroy(); }
  get mode() { return MODES[this.mi]; }
  say(t) { this.q('.pl-say').innerHTML = t; }

  setMode(i) {
    this.mi = i; this.saveKey('poulet_mode', i);
    this.qa('[data-mode]').forEach((b) => b.classList.toggle('on', +b.dataset.mode === i));
    this.build();
    this.paint();
  }

  // Draws the road: start sidewalk, one lane per step with its multiplier, finish sidewalk.
  build() {
    const m = this.mode;
    let h = '<div class="pl-side start"><span>DÉPART</span></div>';
    for (let k = 1; k <= m.lanes; k++) {
      const c = CAR_COLORS[(k * 5 + this.mi) % CAR_COLORS.length];
      h += `<div class="pl-lane" data-k="${k}" style="--dur:${(1.3 + ((k * 7) % 5) * 0.28).toFixed(2)}s;--del:-${((k * 0.37) % 1.6).toFixed(2)}s">
        <div class="pl-car">${car(c)}</div><div class="pl-bar-x">${BARRIER}</div>
        <div class="pl-hole"><b>×${xs(mult(k, m))}</b></div></div>`;
    }
    h += '<div class="pl-side end"><span>🏁 ARRIVÉE</span></div><div class="pl-chick">' + CHICK + '</div>';
    this.track.innerHTML = h;
    this.chick = this.q('.pl-chick');
    this.lanes = this.qa('.pl-lane');
    this.place(0, false);
  }

  laneX(k) {
    const side = this.q('.pl-side.start').offsetWidth, lw = this.lanes[0]?.offsetWidth || 90;
    return k === 0 ? side / 2 : side + (k - 0.5) * lw;
  }

  place(k, anim = true) {
    const x = this.laneX(k);
    if (anim) {
      this.chick.animate([{ translate: '0 0' }, { translate: '0 -28px', offset: 0.45 }, { translate: '0 0' }], { duration: this.turbo ? 200 : 360, easing: 'ease-out' });
    }
    this.chick.style.left = `${x}px`;
    const target = x - this.road.clientWidth * 0.35;
    this.road.scrollTo({ left: Math.max(0, target), behavior: anim ? 'smooth' : 'auto' });
  }

  paint() {
    const m = this.mode, k = this.k, cur = mult(k, m), nx = k < m.lanes ? mult(k + 1, m) : 0;
    this.q('.pl-cur b').textContent = this.playing && k ? `×${xs(cur)}` : '—';
    this.q('.pl-nxt b').textContent = this.playing ? (nx ? `×${xs(nx)}` : '—') : `×${xs(mult(1, m))}`;
    this.q('.pl-cash b').textContent = fmtC(this.playing ? Math.floor(this.bet * cur) : 0);
    const lab = this.mainBtn.querySelector('.main-label');
    if (this.playing) { lab.textContent = k ? `ENCAISSER ${fmtC(Math.floor(this.bet * cur))}` : 'AVANCE !'; this.mainBtn.disabled = !k || this.moving; this.mainBtn.classList.add('cash'); }
    else { lab.textContent = 'JOUER'; this.mainBtn.disabled = false; this.mainBtn.classList.remove('cash'); }
    this.goBtn.disabled = !this.playing || this.moving;
    this.lanes.forEach((l) => l.classList.toggle('next', this.playing && +l.dataset.k === k + 1));
    this.qa('[data-mode]').forEach((b) => { b.disabled = this.playing; });
    this.q('[data-act="bet-"]').disabled = this.playing || this.bi === 0;
    this.q('[data-act="bet+"]').disabled = this.playing || this.bi === this.cfg.bets.length - 1;
    this.slotEl.classList.toggle('pl-on', this.playing);
  }

  onMeters() { if (this.lanes) this.paint(); }
  onBetChange() { this.paint(); }

  onMain() {
    if (this.playing) return this.cash(false);
    if (this.moving || !this.pay(this.bet)) return;
    this.lastStake = this.bet;
    this.build();
    this.playing = true; this.k = 0;
    this.setLast(0); this.winAmt.textContent = '';
    this.slotEl.classList.remove('pl-lost', 'pl-won');
    this.say('Appuie sur <b>AVANCER</b> (ou touche →) pour traverser la première voie.');
    this.msg(`Mise ${fmtC(this.bet)} · difficulté ${this.mode.label}`);
    sfx.spin();
    this.paint();
  }

  async step() {
    if (!this.playing || this.moving) return;
    const m = this.mode, k = this.k + 1, lane = this.lanes[k - 1];
    this.moving = true; this.paint();
    sfx.click();
    this.place(k);
    await this.wait(380);
    if (this.dead) return;
    if (crash(m)) {
      // the lane's car comes straight at the chicken
      lane.classList.add('hit');
      await this.wait(260);
      if (this.dead) return;
      this.chick.innerHTML = FEATHER;
      this.chick.classList.add('flat');
      const p = center(this.chick);
      fx.burst(p.x, p.y, 50, ['#fff', '#f1f5f9', '#ef4444', '#fbbf24'], 9);
      this.flash('rgba(248,113,113,.6)');
      this.shake();
      sfx.puff();
      this.playing = false; this.moving = false;
      this.slotEl.classList.add('pl-lost');
      this.say(`💥 Écrasé à la voie ${k} ! ${this.k ? `Tu avais ×${xs(mult(this.k, m))} en jeu.` : ''}`);
      this.msg(`Perdu · mise ${fmtC(this.bet)}`);
      this.setLast(0);
      this.paint();
      return;
    }
    this.k = k;
    lane.classList.add('safe');
    const p = center(lane.querySelector('.pl-hole'));
    fx.burst(p.x, p.y, 16, ['#fde047', '#fbbf24', '#fff'], 5);
    fx.floatText(p.x, p.y - 30, `×${xs(mult(k, m))}`, '#fde047', 22);
    sfx.coin();
    [this.q('.pl-cur'), this.q('.pl-cash')].forEach((n) => { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); });
    this.moving = false;
    if (k >= m.lanes) { this.place(k + 0.6); return this.cash(true); }
    this.say(`Ouf ! <b>×${xs(mult(k, m))}</b> · prochaine voie ×${xs(mult(k + 1, m))}. On continue ?`);
    this.msg(`Voie ${k} / ${m.lanes} franchie`);
    this.paint();
  }

  cash(all) {
    if (!this.playing || !this.k || this.moving) return;
    const x = mult(this.k, this.mode), won = Math.floor(this.bet * x);
    this.playing = false;
    this.win(won);
    this.setLast(won);
    this.slotEl.classList.add('pl-won');
    this.say(all ? `🏁 Le poulet a tout traversé ! <b>${fmtC(won)}</b>` : `Encaissé : <b>${fmtC(won)}</b> (×${xs(x)})`);
    this.msg(`Gain : ${fmtC(won)} (×${xs(x)})`);
    this.paint();
    this.celebrate(won);
  }

  info() {
    const rows = MODES.map((m) => `<b>${m.label}</b> : ${Math.round(m.p * 100)} % de risque par voie, ${m.lanes} voies, de ×${xs(mult(1, m))} à ×${xs(mult(m.lanes, m))}`).join('<br>');
    return this.rules(`<h4>Comment jouer</h4><p>Choisis ta mise et la difficulté, puis appuie sur JOUER. Le poulet attend sur le trottoir : appuie sur <b>AVANCER</b> (ou la touche →, ou la voie suivante) pour traverser une voie. S’il passe, le multiplicateur grimpe. Si une voiture arrive, la mise est perdue. Tu peux <b>encaisser</b> après chaque voie franchie.</p>
      <h4>Difficultés</h4><p>${rows}</p>
      <h4>Équité</h4><p>Chaque voie est un tirage indépendant. Multiplicateur après k voies : 0,96 ÷ (1 − risque)<sup>k</sup>, arrondi au centième inférieur. Retour au joueur : 96 %.</p>`);
  }
}

return { PouletGame };
})();
