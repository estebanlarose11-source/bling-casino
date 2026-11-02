// SpinBet Casino · PileFaceGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/pileface.js ----
__mods['games/impl/pileface.js'] = (() => {
// Pile ou Face Turbo: bet, then call Pile or Face up to 20 times in a row. Each right call doubles the pot
// (×1,92 after one, ×3,84 after two… ×0,96 × 2^k), cash out whenever you like; one wrong call loses the stake.
// Every flip is a fair 50/50, so whatever the strategy the return is exactly 96 %.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
const MAXF = 20, EDGE = 0.96;
const mult = (k) => (k ? EDGE * 2 ** k : 0);
const flip = () => (Math.random() < 0.5 ? 'pile' : 'face');
/* ===END ENGINE */

const xs = (m) => (m >= 1000 ? Math.round(m).toLocaleString('fr-FR') : m >= 100 ? String(Math.round(m)) : m.toFixed(2).replace('.', ','));
const FACE_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" fill="url(#pfGold)" stroke="#92400e" stroke-width="3"/><circle cx="50" cy="50" r="39" fill="none" stroke="#fef3c7" stroke-width="1.5" stroke-dasharray="2 3"/>
  <path d="M31 36 L35 22 L43 31 L50 18 L57 31 L65 22 L69 36 Z" fill="#fde68a" stroke="#92400e" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="50" cy="55" r="17" fill="#fcd34d" stroke="#92400e" stroke-width="2"/><circle cx="44" cy="52" r="2.4" fill="#78350f"/><circle cx="56" cy="52" r="2.4" fill="#78350f"/>
  <path d="M42 60 Q50 67 58 60" stroke="#78350f" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <text x="50" y="88" text-anchor="middle" font-family="KeCoin,Archivo,sans-serif" font-weight="900" font-size="9" fill="#78350f">FACE</text></svg>`;
const PILE_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" fill="url(#pfSilver)" stroke="#334155" stroke-width="3"/><circle cx="50" cy="50" r="39" fill="none" stroke="#f1f5f9" stroke-width="1.5" stroke-dasharray="2 3"/>
  <text x="50" y="62" text-anchor="middle" font-family="KeCoin,Archivo,sans-serif" font-weight="900" font-size="34" fill="#1e293b">×2</text>
  <path d="M26 30 l3 -6 l3 6 l-3 -2z M68 30 l3 -6 l3 6 l-3 -2z" fill="#1e293b"/>
  <text x="50" y="88" text-anchor="middle" font-family="KeCoin,Archivo,sans-serif" font-weight="900" font-size="9" fill="#1e293b">PILE</text></svg>`;
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <radialGradient id="pfGold" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fffbeb"/><stop offset=".45" stop-color="#fbbf24"/><stop offset="1" stop-color="#b45309"/></radialGradient>
  <radialGradient id="pfSilver" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#cbd5e1"/><stop offset="1" stop-color="#64748b"/></radialGradient></defs></svg>`;

class PileFaceGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.pileface, autoplay: false, mainLabel: 'LANCER LA SÉRIE',
      cls: 'table-game pileface',
      head: '<div class="head-meters"><div class="meter pf-streak"><small>Série</small><b>0 / 20</b></div><div class="meter pf-pot"><small>Gain en jeu</small><b>—</b></div></div>',
      stage: `${DEFS}<div class="pf-arena">
          <div class="pf-glow"></div>
          <div class="pf-toss"><div class="pf-coin"><div class="pf-side f">${FACE_SVG}</div><div class="pf-side p">${PILE_SVG}</div></div></div>
          <div class="pf-shadow"></div>
          <div class="pf-say">Mise, lance la série, puis choisis Pile ou Face.</div>
          <div class="pf-pick">
            <button type="button" class="pf-btn face" data-pick="face" disabled>${FACE_SVG}<b>FACE</b></button>
            <button type="button" class="pf-btn cash" data-pick="cash" disabled><small>ENCAISSER</small><b>—</b></button>
            <button type="button" class="pf-btn pile" data-pick="pile" disabled>${PILE_SVG}<b>PILE</b></button>
          </div>
          <div class="pf-ladder">${Array.from({ length: MAXF }, (_, k) => `<span data-k="${k + 1}"><i>${k + 1}</i>×${xs(mult(k + 1))}</span>`).join('')}</div>
          <div class="pf-hist" aria-label="Derniers lancers"></div>
        </div>`,
      hello: 'Chaque bonne prédiction double ton gain. Encaisse quand tu veux !',
    });
    this.coin = this.q('.pf-coin');
    this.turn = 0; // coin rotation in half turns
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (!b || b.disabled || !this.answer) return;
      const r = this.answer; this.answer = null; r(b.dataset.pick);
    });
    this.onKeyPick = (e) => {
      if (!this.answer || e.target.closest('input, textarea')) return;
      const k = { KeyF: 'face', KeyP: 'pile', Enter: 'cash' }[e.code];
      if (!k || (k === 'cash' && this.q('[data-pick="cash"]').disabled)) return;
      e.preventDefault(); const r = this.answer; this.answer = null; r(k);
    };
    addEventListener('keydown', this.onKeyPick);
  }

  destroy() { removeEventListener('keydown', this.onKeyPick); super.destroy(); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = this.busy; }
  ask() { return new Promise((res) => { this.answer = res; }); }
  say(t) { this.q('.pf-say').innerHTML = t; }

  setState(k, bet) {
    this.q('.pf-streak b').textContent = `${k} / ${MAXF}`;
    this.q('.pf-pot b').textContent = k ? fmtC(Math.round(bet * mult(k))) : '—';
    this.qa('.pf-ladder span').forEach((s) => { const n = +s.dataset.k; s.classList.toggle('done', n <= k); s.classList.toggle('next', n === k + 1); });
    this.q('.pf-ladder .next')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    const cash = this.q('[data-pick="cash"]');
    cash.querySelector('b').textContent = k ? fmtC(Math.round(bet * mult(k))) : '—';
  }

  enable(on, k) {
    this.qa('[data-pick="face"],[data-pick="pile"]').forEach((b) => { b.disabled = !on; });
    this.q('[data-pick="cash"]').disabled = !on || !k;
    this.slotEl.classList.toggle('pf-ask', on);
  }

  hist(r, ok) {
    const h = this.q('.pf-hist');
    h.insertAdjacentHTML('afterbegin', `<i class="${r} ${ok ? 'ok' : 'ko'}">${r === 'face' ? 'F' : 'P'}</i>`);
    while (h.children.length > 16) h.lastChild.remove();
  }

  // Tosses the coin and lands it on r (face = 0°, pile = 180°).
  async toss(r) {
    const T = this.turbo ? 650 : 1250, spins = this.turbo ? 6 : 10;
    const from = this.turn * 180;
    let to = from + spins * 180;
    if ((to / 180) % 2 !== (r === 'pile' ? 1 : 0)) to += 180;
    this.turn = to / 180;
    sfx.click();
    this.coin.animate([{ transform: `rotateX(${from}deg)` }, { transform: `rotateX(${to}deg)` }], { duration: T, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    this.q('.pf-toss').animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-46%) scale(1.15)', offset: 0.45 }, { transform: 'translateY(0) scale(1)' }], { duration: T, easing: 'ease-in-out' });
    this.q('.pf-shadow').animate([{ transform: 'scale(1)', opacity: 0.6 }, { transform: 'scale(.55)', opacity: 0.25, offset: 0.45 }, { transform: 'scale(1)', opacity: 0.6 }], { duration: T, easing: 'ease-in-out' });
    await this.wait(T / (this.turbo ? 0.45 : 1));
    sfx.reelStop?.(1);
  }

  onMain() { this.round(() => this.series()); }

  async series() {
    const bet = this.bet;
    if (!this.pay(bet)) return;
    this.lastStake = bet;
    this.setLast(0); this.winAmt.textContent = '';
    this.slotEl.classList.remove('pf-lost', 'pf-won');
    let k = 0;
    this.setState(0, bet);
    this.say('Pile ou Face ? Fais ton choix !');
    this.msg(`Mise ${fmtC(bet)} · une bonne prédiction : ×${xs(mult(1))}`);
    while (!this.dead) {
      this.enable(true, k);
      const pick = await this.ask();
      this.enable(false, k);
      if (pick === 'cash') break;
      this.say(`Tu as dit <b>${pick === 'face' ? 'FACE' : 'PILE'}</b>…`);
      const r = flip();
      await this.toss(r);
      if (this.dead) return;
      const p = center(this.coin);
      if (r !== pick) {
        this.hist(r, false);
        this.slotEl.classList.add('pf-lost');
        this.shake();
        sfx.lose?.();
        this.say(`C’est <b>${r === 'face' ? 'FACE' : 'PILE'}</b>… perdu !${k ? ` Tu avais ${fmtC(Math.round(bet * mult(k)))} en jeu.` : ''}`);
        this.msg('Série perdue');
        this.setState(0, bet);
        return;
      }
      k++;
      this.hist(r, true);
      sfx.win();
      fx.burst(p.x, p.y, 14 + k * 2, ['#fde047', '#fbbf24', '#fff', '#38bdf8'], 6);
      fx.floatText(p.x, p.y - 50, `×${xs(mult(k))}`, '#fde047', 26);
      this.setState(k, bet);
      if (k >= MAXF) { this.say('SÉRIE PARFAITE : 20 sur 20 !'); break; }
      this.say(`Gagné ! <b>×${xs(mult(k))}</b> · encore ${MAXF - k} lancer${MAXF - k > 1 ? 's' : ''} possible${MAXF - k > 1 ? 's' : ''}. On continue ?`);
    }
    if (this.dead) return;
    const won = Math.round(bet * mult(k));
    this.win(won);
    this.setLast(won);
    this.slotEl.classList.add('pf-won');
    this.say(`Encaissé : <b>${fmtC(won)}</b> après ${k} bonne${k > 1 ? 's' : ''} prédiction${k > 1 ? 's' : ''} !`);
    this.msg(`Gain : ${fmtC(won)} (×${xs(mult(k))})`);
    await this.celebrate(won);
    this.setState(0, bet);
  }

  info() {
    return this.rules(`<h4>Comment jouer</h4><p>Choisis ta mise et lance la série. À chaque lancer, prédis <b>Pile</b> ou <b>Face</b> (touches P et F au clavier). Bonne prédiction : ton gain double. Mauvaise : la série s’arrête et la mise est perdue. Tu peux <b>encaisser</b> après n’importe quel lancer gagné (touche Entrée), jusqu’à 20 lancers.</p>
      <h4>Gains (× la mise)</h4><p>${Array.from({ length: MAXF }, (_, k) => `${k + 1} : ×${xs(mult(k + 1))}`).join(' · ')}</p>
      <h4>Équité</h4><p>Chaque lancer est un vrai 50/50, indépendant des précédents et de ton choix. Quelle que soit ta façon de jouer, le retour au joueur est de 96 %.</p>`);
  }
}

return { PileFaceGame };
})();
