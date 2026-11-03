// SpinBet Casino · RobotsGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/robots.js ----
__mods['games/impl/robots.js'] = (() => {
// Course de Robots: six robots race over 15 seconds. Each race the robots get a form rating (their chances,
// shuffled every race); bet on the winner or on a podium finish. The finishing order is drawn from those chances
// (each place in turn, among the robots left), and every payout is 0,95 / chance, so the return is 95 % whatever
// the bet.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { toast } = __mods['ui.js'];

/* ===ENGINE */
const RTP = 0.95, STRENGTH = [0.3, 0.22, 0.17, 0.13, 0.1, 0.08];
function shuffled(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Chance of finishing in the top 3 for each robot (exact, over the 120 possible podiums).
function podiumChances(p) {
  const q = p.map(() => 0), n = p.length;
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) {
    if (a === b || a === c || b === c) continue;
    const pr = p[a] * (p[b] / (1 - p[a])) * (p[c] / (1 - p[a] - p[b]));
    q[a] += pr; q[b] += pr; q[c] += pr;
  }
  return q;
}
function newRace() {
  const p = shuffled(STRENGTH), q = podiumChances(p);
  return { p, win: p.map((x) => Math.floor((RTP / x) * 100) / 100), podium: q.map((x) => Math.floor((RTP / x) * 100) / 100) };
}
function finishOrder(p) {
  const left = p.map((_, i) => i), out = [];
  while (left.length) {
    let t = 0; left.forEach((i) => { t += p[i]; });
    let r = Math.random() * t, k = 0;
    for (; k < left.length - 1; k++) { r -= p[left[k]]; if (r < 0) break; }
    out.push(left.splice(k, 1)[0]);
  }
  return out;
}
/* ===END ENGINE */

const BOTS = [
  { name: 'Turbo-9', c: '#22d3ee' }, { name: 'Volt', c: '#facc15' }, { name: 'Rouille', c: '#f97316' },
  { name: 'Nova', c: '#e879f9' }, { name: 'Boulon', c: '#4ade80' }, { name: 'Zap', c: '#f43f5e' },
];
const xs = (m) => m.toFixed(2).replace('.', ',');
// 3D pieces drawn by code (tools/render3d), wrapped in the same viewBox as the old drawings so the CSS still applies
const PIC = (n, v = 1) => window.__assets?.[`assets/games/robots/${n}.webp`] || `assets/games/robots/${n}.webp?v=${v}`;
const botSVG = (c, k) => `<svg viewBox="0 0 64 48" aria-hidden="true">
  <path d="M2 30 H14 M0 36 H12 M4 24 H12" stroke="${c}" stroke-width="2.5" stroke-linecap="round" class="rb-trail"/>
  <image href="${PIC('bot' + (k % 6))}" x="10" y="-6" width="56" height="56"/>
  <circle cx="30" cy="30" r="6" fill="#0f172a" stroke="${c}" stroke-width="1.5"/><text x="30" y="32.6" text-anchor="middle" font-family="KeCoin,Archivo,sans-serif" font-weight="900" font-size="7.5" fill="#fff">${k + 1}</text></svg>`;

class RobotsGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.robots, autoplay: false, mainLabel: 'LANCER LA COURSE',
      cls: 'table-game robots',
      head: '<div class="head-meters"><div class="meter rb-bet-m"><small>Ton pari</small><b>—</b></div><div class="meter rb-pay-m"><small>Gain possible</small><b>—</b></div></div>',
      stage: `<div class="rb-arena">
          <div class="rb-track">${BOTS.map((b, k) => `<div class="rb-lane" data-k="${k}" style="--c:${b.c}"><span class="rb-num">${k + 1}</span><div class="rb-bot">${botSVG(b.c, k)}</div><span class="rb-place"></span></div>`).join('')}<div class="rb-finish"></div><div class="rb-count"></div></div>
          <div class="rb-board"></div>
        </div>`,
      hello: 'Choisis un robot et ton pari, puis lance la course.',
    });
    this.sel = null;
    this.race = newRace();
    this.board();
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-bet]');
      if (!b || this.busy) return;
      const [k, t] = b.dataset.bet.split(':');
      this.sel = { k: +k, t };
      sfx.click();
      this.board();
    });
  }

  onMeters() {
    if (this.mainBtn) this.mainBtn.disabled = this.busy;
    if (this.race) this.showBet();
  }

  showBet() {
    const s = this.sel;
    this.q('.rb-bet-m b').textContent = s ? `${BOTS[s.k].name} · ${s.t === 'win' ? 'Vainqueur' : 'Podium'}` : '—';
    this.q('.rb-pay-m b').textContent = s ? fmtC(Math.round(this.bet * this.race[s.t][s.k])) : '—';
  }

  board() {
    const r = this.race, s = this.sel;
    const order = BOTS.map((_, k) => k).sort((a, b) => r.p[b] - r.p[a]);
    this.q('.rb-board').innerHTML = `<div class="rb-head"><span>Robot</span><span>Forme</span><span>Vainqueur</span><span>Podium (top 3)</span></div>${order.map((k) => {
      const b = BOTS[k], f = Math.round(r.p[k] * 100);
      return `<div class="rb-row${s?.k === k ? ' on' : ''}" style="--c:${b.c}">
        <span class="rb-name"><i>${k + 1}</i>${b.name}</span>
        <span class="rb-form"><em style="width:${f * 3}%"></em><small>${f} %</small></span>
        <button type="button" class="rb-odd${s?.k === k && s.t === 'win' ? ' sel' : ''}" data-bet="${k}:win">×${xs(r.win[k])}</button>
        <button type="button" class="rb-odd${s?.k === k && s.t === 'podium' ? ' sel' : ''}" data-bet="${k}:podium">×${xs(r.podium[k])}</button>
      </div>`;
    }).join('')}`;
    this.showBet();
  }

  onMain() {
    if (!this.sel) { toast('Choisis d’abord un robot et ton pari', 'warn'); return; }
    this.round(() => this.run());
  }

  async run() {
    const bet = this.bet, s = { ...this.sel }, r = this.race;
    if (!this.pay(bet)) return;
    this.lastStake = bet;
    this.setLast(0); this.winAmt.textContent = '';
    this.slotEl.classList.add('rb-racing');
    this.slotEl.classList.remove('rb-won');
    this.qa('.rb-lane').forEach((l) => { l.classList.remove('mine', 'p1', 'p2', 'p3'); l.querySelector('.rb-place').textContent = ''; });
    this.q(`.rb-lane[data-k="${s.k}"]`).classList.add('mine');
    this.focusStage();
    // countdown
    const cnt = this.q('.rb-count');
    for (const t of ['3', '2', '1', 'GO !']) {
      cnt.textContent = t; cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop');
      sfx.tick(); await this.wait(t === 'GO !' ? 350 : 650);
    }
    cnt.textContent = '';
    const order = finishOrder(r.p), rank = []; order.forEach((k, i) => { rank[k] = i; });
    const T = this.turbo ? 6000 : 15000;
    // finish times: the winner first, then about 0,35 s per place; each robot gets its own speed wobble
    const fin = BOTS.map((_, k) => T * (0.86 + rank[k] * 0.028 + Math.random() * 0.01));
    const wob = BOTS.map(() => [Math.random() * 6.28, 0.05 + Math.random() * 0.05, 1.5 + Math.random() * 2]);
    const bots = this.qa('.rb-bot'), lanes = this.qa('.rb-lane');
    const track = this.q('.rb-track');
    const span = () => track.clientWidth - 92;
    let W = span();
    const onR = () => { W = span(); };
    addEventListener('resize', onR);
    const t0 = performance.now();
    let placed = 0, lastLead = -1;
    await new Promise((done) => {
      const frame = () => {
        if (this.dead) return done();
        const t = performance.now() - t0;
        let lead = 0, best = -1;
        BOTS.forEach((_, k) => {
          const u = Math.min(1, t / fin[k]);
          const [ph, amp, fq] = wob[k];
          const x = u >= 1 ? 1 : Math.min(0.999, u + amp * Math.sin(ph + u * fq * Math.PI) * u * (1 - u) * 4);
          bots[k].style.transform = `translateX(${(x * W).toFixed(1)}px)`;
          if (x > best) { best = x; lead = k; }
          if (u >= 1 && !lanes[k].dataset.done) {
            lanes[k].dataset.done = '1';
            placed++;
            const pl = rank[k] + 1;
            if (pl <= 3) lanes[k].classList.add(`p${pl}`);
            lanes[k].querySelector('.rb-place').textContent = pl === 1 ? '🥇' : pl === 2 ? '🥈' : pl === 3 ? '🥉' : `${pl}e`;
            if (pl === 1) { const p = center(lanes[k].querySelector('.rb-bot')); fx.burst(p.x, p.y, 24, [BOTS[k].c, '#fff', '#fde047'], 7); sfx.feature(); }
          }
        });
        if (lead !== lastLead && t < T * 0.85) { lastLead = lead; this.msg(`En tête : <b style="color:${BOTS[lead].c}">${BOTS[lead].name}</b>`); }
        if (placed >= BOTS.length) return done();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    removeEventListener('resize', onR);
    lanes.forEach((l) => { delete l.dataset.done; });
    this.slotEl.classList.remove('rb-racing');
    if (this.dead) return;
    const ok = s.t === 'win' ? rank[s.k] === 0 : rank[s.k] <= 2;
    const podium = order.slice(0, 3).map((k, i) => `${i + 1}. ${BOTS[k].name}`).join(' · ');
    if (ok) {
      const won = Math.round(bet * r[s.t][s.k]);
      this.win(won); this.setLast(won);
      this.slotEl.classList.add('rb-won');
      this.msg(`Gagné ! ${BOTS[s.k].name} ${s.t === 'win' ? 'remporte la course' : 'monte sur le podium'} · ${podium}`);
      await this.celebrate(won);
    } else {
      this.msg(`Perdu · ${podium}`);
      await this.wait(900);
    }
    // next race: new form ratings, same robot and bet type kept selected
    this.race = newRace();
    this.board();
    BOTS.forEach((_, k) => { bots[k].style.transform = ''; });
  }

  info() {
    return this.rules(`<h4>Comment jouer</h4><p>Choisis un robot et ton type de pari, puis lance la course (15 secondes, 6 en turbo). <b>Vainqueur</b> : ton robot doit finir premier. <b>Podium</b> : il doit finir dans les 3 premiers.</p>
      <h4>Forme et cotes</h4><p>Avant chaque course, les robots reçoivent une forme : leur chance de gagner (30 %, 22 %, 17 %, 13 %, 10 % et 8 %, redistribuées à chaque course). L’arrivée est tirée selon ces chances : le premier, puis le deuxième parmi les robots restants, etc. Chaque cote vaut 0,95 divisé par la chance de réussite du pari : le retour au joueur est de 95 % quel que soit ton choix.</p>`);
  }
}

return { RobotsGame };
})();
