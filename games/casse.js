// SpinBet Casino · CasseGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/casse.js ----
__mods['games/impl/casse.js'] = (() => {
// Le Casse: 9 vaults hide cash multipliers, one gold vault (doubles the loot) and one alarm. Drill them one by one;
// after each vault the fence offers to buy the loot and what is left in the room. Sell, or carry on and risk the
// alarm (you flee with 25 % of the loot). Offers are the true value of carrying on, scaled by KAPPA: no strategy
// can beat the room's value, ≈ 96 % (≈ 93 % for a player who sells along the way).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, audioContext, isMuted } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
const N = 9, KEEP = 0.25, CAPX = 2000;
const CASH = [[0.05, 30], [0.1, 26], [0.25, 20], [0.5, 12], [1, 7], [2, 3.5], [5, 1.2], [25, 0.25], [100, 0.06]];
const KAPPA = [0.96, 0.97, 0.975, 0.98, 0.985, 0.99, 1, 1]; // offer = KAPPA[vaults opened - 1] × value of carrying on
function pickCash() { let t = 0; CASH.forEach((x) => { t += x[1]; }); let r = Math.random() * t; for (const x of CASH) { if (r < x[1]) return x[0]; r -= x[1]; } return CASH[0][0]; }
function deal() {
  const d = [{ t: 'alarm' }, { t: 'gold' }];
  for (let i = 0; i < 7; i++) d.push({ t: 'cash', v: pickCash() });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
// Value of carrying on to the end from the closed vaults in mask with loot L, as A·L + B (vaults opened in random order).
function solver(d) {
  const memo = new Map();
  const AB = (mask) => {
    if (memo.has(mask)) return memo.get(mask);
    const idx = []; for (let i = 0; i < N; i++) if (mask >> i & 1) idx.push(i);
    let A = 0, B = 0;
    if (idx.length === 1 && d[idx[0]].t === 'alarm') { A = 1; B = 0; } else {
      for (const j of idx) {
        const m = mask & ~(1 << j), c = d[j];
        if (c.t === 'alarm') A += KEEP;
        else { const [a, b] = AB(m); if (c.t === 'gold') { A += 2 * a; B += b; } else { A += a; B += a * c.v + b; } }
      }
      A /= idx.length; B /= idx.length;
    }
    const r = [A, B]; memo.set(mask, r); return r;
  };
  return (mask, L) => { const [a, b] = AB(mask); return a * L + b; };
}
/* ===END ENGINE */

const xs = (m) => (m >= 100 ? m.toLocaleString('fr-FR') : String(m).replace('.', ','));
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <radialGradient id="csDoor" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#e2e8f0"/><stop offset=".45" stop-color="#94a3b8"/><stop offset="1" stop-color="#334155"/></radialGradient>
  <linearGradient id="csFrame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#475569"/><stop offset=".5" stop-color="#1e293b"/><stop offset="1" stop-color="#0f172a"/></linearGradient>
  <linearGradient id="csBill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86efac"/><stop offset="1" stop-color="#15803d"/></linearGradient>
  <linearGradient id="csGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fef3c7"/><stop offset=".4" stop-color="#fbbf24"/><stop offset="1" stop-color="#92400e"/></linearGradient>
  <radialGradient id="csSiren" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#fecaca"/><stop offset=".5" stop-color="#ef4444"/><stop offset="1" stop-color="#7f1d1d"/></radialGradient>
</defs></svg>`;
const bolts = Array.from({ length: 12 }, (_, k) => { const a = (k / 12) * Math.PI * 2; return `<circle cx="${(60 + Math.cos(a) * 41).toFixed(1)}" cy="${(60 + Math.sin(a) * 41).toFixed(1)}" r="2.6" fill="#cbd5e1" stroke="#1e293b" stroke-width=".8"/>`; }).join('');
const spokes = Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2; return `<line x1="60" y1="60" x2="${(60 + Math.cos(a) * 19).toFixed(1)}" y2="${(60 + Math.sin(a) * 19).toFixed(1)}" stroke="#e2e8f0" stroke-width="3.2" stroke-linecap="round"/><circle cx="${(60 + Math.cos(a) * 21).toFixed(1)}" cy="${(60 + Math.sin(a) * 21).toFixed(1)}" r="3.4" fill="#f1f5f9" stroke="#334155"/>`; }).join('');
const doorSVG = (n) => `<svg viewBox="0 0 120 120" aria-hidden="true">
  <circle cx="60" cy="60" r="50" fill="url(#csDoor)" stroke="#0f172a" stroke-width="2.5"/>
  <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(15,23,42,.5)" stroke-width="1.5"/>${bolts}
  <g class="cs-wheel"><circle cx="60" cy="60" r="21" fill="none" stroke="#e2e8f0" stroke-width="2.5"/>${spokes}<circle cx="60" cy="60" r="6" fill="#475569" stroke="#e2e8f0" stroke-width="2"/></g>
  <rect x="49" y="94" width="22" height="12" rx="3" fill="#0f172a" stroke="#fbbf24" stroke-width="1"/><text x="60" y="103.5" text-anchor="middle" font-family="KeCoin,Orbitron,Inter,sans-serif" font-weight="900" font-size="9" fill="#fbbf24">${n}</text>
</svg>`;
const CASH_SVG = `<svg viewBox="0 0 100 70" aria-hidden="true">${[0, 1, 2, 3].map((k) => `<g transform="translate(${14 + (k % 2) * 4} ${40 - k * 8})"><rect width="64" height="22" rx="3" fill="url(#csBill)" stroke="#14532d"/><rect x="26" y="0" width="12" height="22" fill="#fde68a" opacity=".85"/><circle cx="12" cy="11" r="5" fill="none" stroke="#dcfce7" stroke-width="1.2"/></g>`).join('')}</svg>`;
const GOLD_SVG = `<svg viewBox="0 0 100 70" aria-hidden="true">${[[18, 44], [50, 44], [34, 26]].map(([x, y]) => `<path d="M${x} ${y + 18} L${x + 6} ${y} H${x + 30} L${x + 36} ${y + 18} Z" fill="url(#csGold)" stroke="#78350f"/><path d="M${x + 8} ${y + 3} H${x + 28}" stroke="#fffbeb" stroke-width="1.5" opacity=".8"/>`).join('')}</svg>`;
const ALARM_SVG = `<svg viewBox="0 0 100 70" aria-hidden="true"><g class="cs-rays">${[-50, -25, 0, 25, 50].map((a) => `<path d="M50 34 L${50 + Math.sin((a * Math.PI) / 180) * 48} ${34 - Math.cos((a * Math.PI) / 180) * 30}" stroke="#ef4444" stroke-width="3" stroke-linecap="round" opacity=".7"/>`).join('')}</g><rect x="30" y="50" width="40" height="10" rx="2" fill="#1f2937"/><path d="M34 50 V36 A16 16 0 0 1 66 36 V50 Z" fill="url(#csSiren)" stroke="#7f1d1d"/></svg>`;
const FENCE_SVG = `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="38" fill="#111827" stroke="#fbbf24" stroke-width="2"/><path d="M14 74 Q18 50 40 48 Q62 50 66 74 Z" fill="#1f2937"/><path d="M33 50 L40 64 L47 50" fill="#e5e7eb"/><path d="M38 52 L40 66 L42 52" fill="#b91c1c"/><ellipse cx="40" cy="34" rx="13" ry="15" fill="#d6a77a"/><path d="M20 24 Q40 14 60 24 L56 26 Q40 21 24 26 Z" fill="#0b0b0f"/><rect x="25" y="9" width="30" height="15" rx="4" fill="#0b0b0f"/><rect x="25" y="20" width="30" height="3" fill="#7f1d1d"/><rect x="28" y="31" width="10" height="6" rx="2" fill="#0b0b0f"/><rect x="42" y="31" width="10" height="6" rx="2" fill="#0b0b0f"/><path d="M38 34 H42" stroke="#0b0b0f" stroke-width="1.5"/><path d="M35 43 Q40 46 46 42" stroke="#7c2d12" stroke-width="1.6" fill="none"/></svg>`;

// Little synth effects: drill whine and the two-tone alarm.
function tone(f0, f1, dur, type, vol, when = 0) {
  if (isMuted()) return; const c = audioContext(); if (!c) return;
  const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
const drillSound = (d) => { tone(900, 1400, d, 'sawtooth', 0.025); tone(450, 700, d, 'square', 0.015); };
const sirenSound = () => { for (let k = 0; k < 4; k++) { tone(880, 880, 0.22, 'sawtooth', 0.05, k * 0.45); tone(620, 620, 0.22, 'sawtooth', 0.05, k * 0.45 + 0.22); } };

class CasseGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.casse, autoplay: false, mainLabel: 'NOUVEAU CASSE',
      cls: 'table-game casse',
      head: `<div class="head-meters"><div class="meter cs-loot"><small>Butin</small><b>0,00\u00a0\uE1E0</b></div><div class="meter cs-offer-m"><small>Offre</small><b>—</b></div></div>`,
      // gradients inline: the cabinet only mounts shared art defs once per page
      stage: `${DEFS}<div class="cs-room"><div class="cs-beam"></div><div class="cs-grid">${Array.from({ length: N }, (_, i) => `<button type="button" class="cs-vault" data-v="${i}" disabled aria-label="Coffre ${i + 1}">
          <span class="cs-inner"></span><span class="cs-door">${doorSVG(i + 1)}</span><span class="cs-drill"><i></i></span></button>`).join('')}</div>
        <div class="cs-fence"><span class="cs-face">${FENCE_SVG}</span><div class="cs-talk"><small>LE RECELEUR</small><p>Mise ta part et lance le casse. Je rachète tout ce que tu trouves.</p></div>
          <div class="cs-deal" hidden><button type="button" class="btn primary" data-deal="sell">VENDRE</button><button type="button" class="btn ghost" data-deal="go">CONTINUER</button></div></div></div>`,
      hello: 'Mise, puis perce les coffres un par un. Attention à l’alarme.',
    });
    this.vaults = this.qa('.cs-vault');
    this.active = false;
    this.offer = 0;
    // one pending answer at a time: a vault index, true (sell) or false (carry on)
    this.root.addEventListener('click', (e) => {
      const v = e.target.closest('.cs-vault'), d = e.target.closest('[data-deal]');
      const ans = v && !v.disabled ? +v.dataset.v : d ? d.dataset.deal === 'sell' : null;
      if (ans === null || !this.answer) return;
      const r = this.answer; this.answer = null; r(ans);
    });
  }

  ask() { return new Promise((res) => { this.answer = res; }); }

  talk(html) { this.q('.cs-talk p').innerHTML = html; this.q('.cs-talk').classList.remove('pop'); void this.q('.cs-talk').offsetWidth; this.q('.cs-talk').classList.add('pop'); }
  setLoot(c) { this.q('.cs-loot b').textContent = fmtC(c); this.q('.cs-loot').classList.remove('bump'); void this.q('.cs-loot').offsetWidth; this.q('.cs-loot').classList.add('bump'); }
  setOffer(c) { this.q('.cs-offer-m b').textContent = c == null ? '—' : fmtC(c); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = this.busy; }

  reset() {
    this.vaults.forEach((v) => { v.className = 'cs-vault'; v.disabled = true; v.querySelector('.cs-inner').innerHTML = ''; });
    this.slotEl.classList.remove('cs-alarm', 'cs-win');
  }

  contentHTML(c, bet) {
    if (c.t === 'alarm') return `${ALARM_SVG}<b class="cs-lab al">ALARME</b>`;
    if (c.t === 'gold') return `${GOLD_SVG}<b class="cs-lab gd">BUTIN ×2</b>`;
    return `${CASH_SVG}<b class="cs-lab">×${xs(c.v)}</b><small>${fmtC(Math.round(c.v * bet))}</small>`;
  }

  async drill(i) {
    const v = this.vaults[i];
    const p = center(v), T = this.turbo ? 550 : 1100;
    v.style.setProperty('--dd', `${T}ms`);
    v.classList.add('drilling');
    drillSound(T / 1000);
    const sparks = setInterval(() => fx.burst(p.x + 10, p.y + 6, 6, ['#fde68a', '#fbbf24', '#fff'], 5), 90);
    await this.wait(T);
    clearInterval(sparks);
    v.classList.remove('drilling');
  }

  // Drills vault i and applies what it held. Returns how the heist ends, if it does.
  async openVault(i, st) {
    await this.drill(i);
    if (this.dead) return { end: 'dead' };
    st.mask &= ~(1 << i); st.opened++;
    const c = st.d[i], v = this.vaults[i], p = center(v), bet = st.bet;
    v.querySelector('.cs-inner').innerHTML = this.contentHTML(c, bet);
    v.classList.add('open', `c-${c.t}`);
    if (c.t === 'alarm') {
      sirenSound(); this.slotEl.classList.add('cs-alarm'); this.shake();
      return { end: 'alarm', payout: KEEP * st.L };
    }
    if (c.t === 'gold') {
      st.L *= 2; sfx.jackpot();
      fx.burst(p.x, p.y, 40, ['#fde047', '#fbbf24', '#fff'], 8); fx.floatText(p.x, p.y - 30, 'BUTIN ×2', '#fde047', 24);
    } else {
      st.L += c.v;
      if (c.v >= 5) { sfx.bigWin(); fx.coins(20, v); } else sfx.coin();
      fx.floatText(p.x, p.y - 30, `+${fmtC(Math.round(c.v * bet))}`, '#86efac', 20);
    }
    this.setLoot(Math.round(st.L * bet));
    if (st.mask === 1 << st.d.findIndex((x) => x.t === 'alarm')) return { end: 'perfect', payout: st.L }; // only the alarm is left
    return null;
  }

  onMain() {
    if (this.active) return;
    this.round(async () => {
      const bet = this.bet;
      if (!this.pay(bet)) return;
      this.lastStake = bet;
      this.active = true; this.offer = 0;
      this.reset();
      this.setLast(0); this.winAmt.textContent = '';
      const d = deal(), value = solver(d), st = { d, bet, mask: (1 << N) - 1, L: 0, opened: 0 };
      const deal_ = this.q('.cs-deal');
      this.setLoot(0); this.setOffer(null);
      const enable = () => this.vaults.forEach((v, k) => { v.disabled = !(st.mask >> k & 1); });
      enable();
      this.talk('Choisis le premier coffre à percer.');
      this.msg('Clique sur un coffre pour le percer.');
      sfx.spin();
      let next = await this.ask(), res = null;
      while (!this.dead) {
        this.vaults.forEach((v) => { v.disabled = true; });
        deal_.hidden = true;
        res = await this.openVault(next, st);
        if (res) break;
        this.offer = Math.round(KAPPA[st.opened - 1] * value(st.mask, st.L) * bet);
        this.setOffer(this.offer);
        this.talk(`Je te rachète tout pour <b>${fmtC(this.offer)}</b>. Tu vends, ou tu tentes un autre coffre ?`);
        this.msg(`Butin ${fmtC(Math.round(st.L * bet))} · offre du receleur ${fmtC(this.offer)}`);
        deal_.querySelector('[data-deal="sell"]').textContent = `VENDRE ${fmtC(this.offer)}`;
        deal_.hidden = false;
        enable();
        let ans = await this.ask();
        if (ans === true) { res = { end: 'sell', payout: this.offer / bet }; break; }
        if (ans === false) {
          deal_.hidden = true;
          this.talk('Comme tu veux… choisis le prochain coffre.');
          this.msg('Choisis le prochain coffre.');
          do ans = await this.ask(); while (typeof ans !== 'number');
        }
        next = ans;
      }
      if (this.dead || !res || res.end === 'dead') return;
      this.finish(d, bet, res.payout, res.end);
    });
  }

  finish(d, bet, payout, kind) {
    this.active = false;
    this.answer = null;
    this.q('.cs-deal').hidden = true;
    const win = Math.round(Math.min(CAPX, payout) * bet);
    // show what the other vaults hid
    this.vaults.forEach((v, i) => {
      v.disabled = true;
      if (!v.classList.contains('open')) setTimeout(() => { v.querySelector('.cs-inner').innerHTML = this.contentHTML(d[i], bet); v.classList.add('open', 'ghost', `c-${d[i].t}`); }, 250 + i * 70);
    });
    this.setOffer(null);
    if (win > 0) { this.win(win); this.setLast(win); }
    if (kind === 'alarm') {
      this.talk(win ? `L’alarme ! Je ne te prends que <b>${fmtC(win)}</b>, file !` : 'L’alarme dès le premier coffre… rien à revendre.');
      this.msg(`🚨 ALARME ! Tu fuis avec 25 % du butin : ${fmtC(win)}`);
      setTimeout(() => this.slotEl.classList.remove('cs-alarm'), 2600);
    } else if (kind === 'perfect') {
      this.slotEl.classList.add('cs-win');
      this.talk(`Casse parfait ! Tout le butin est à toi : <b>${fmtC(win)}</b>.`);
      this.msg(`💰 CASSE PARFAIT ! +${fmtC(win)}`);
      fx.confetti(140);
      this.celebrate(win, { summary: 'CASSE PARFAIT' });
    } else {
      this.talk(`Marché conclu : <b>${fmtC(win)}</b>. Regarde ce que tu as laissé…`);
      this.msg(`🤝 Vendu au receleur : +${fmtC(win)}`);
      if (win >= bet * 10) this.celebrate(win, { summary: 'MARCHÉ CONCLU' }); else sfx.win();
    }
  }

  destroy() {
    // leaving mid-heist: the fence buys at his last offer (or the stake comes back before the first vault)
    if (this.active) { const c = this.offer || this.bet; this.lastStake = this.bet; this.win(c); }
    this.answer = null;
    super.destroy();
  }

  info() {
    const tot = CASH.reduce((a, x) => a + x[1], 0);
    return this.rules(`<h4>Règles</h4><p>9 coffres : <b>7 coffres de billets</b> (×0,05 à ×100 la mise), <b>1 coffre doré</b> qui double ton butin et <b>1 alarme</b>. Perce les coffres un par un : leur contenu s’ajoute à ton butin.</p>
      <p>Après chaque coffre, le <b>receleur</b> te propose de racheter tout ce que tu as, d’après ce qu’il reste vraiment dans la salle. <b>Vendre</b> : tu encaisses son offre. <b>Continuer</b> : tu perces un autre coffre.</p>
      <p>Si l’<b>alarme</b> sonne, tu fuis avec 25 % du butin. S’il ne reste plus que l’alarme, c’est le <b>casse parfait</b> : tout le butin est à toi. Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>
      <h4>Billets dans les coffres</h4><ul class="rules">${CASH.map(([v, w]) => `<li>×${xs(v)} · ${((w / tot) * 100).toFixed(w / tot < 0.01 ? 2 : 0).replace('.', ',')} % des coffres de billets</li>`).join('')}</ul>
      <p class="muted small">Le receleur paie entre 96 % et 100 % de ce que vaut la suite du casse. Retour ≈ 93 à 96 % selon ta façon de jouer.</p>`);
  }
}

return { CasseGame };
})();
