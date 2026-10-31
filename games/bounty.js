// SpinBet Casino · BountyGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/bounty.js ----
__mods['games/impl/bounty.js'] = (() => {
// Bounty Reef, rebuilt on the shared cabinet. "Pays anywhere" math from the original game.

const { BaseGame, fmtC, art } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { DEFS, MAP } = __mods['art/bounty.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE (original) */
const SYM = [['💎', 8, 3], ['👑', 6, 4], ['🗝️', 4, 6], ['⚓', 3, 8], ['🧭', 2, 10], ['🍺', 1, 12]];
const SC = '⭐', SCW = 3, TOT = SYM.reduce((a, s) => a + s[2], SCW);
const BUYN = 6.7, BUYB = 25;
function rnd() { let r = Math.random() * TOT; if (r < SCW) return SC; r -= SCW; for (let i = 0; i < SYM.length; i++) { if (r < SYM[i][2]) return SYM[i][0]; r -= SYM[i][2]; } return SYM[5][0]; }
const sym = () => SYM[Math.floor(Math.random() * SYM.length)][0];
function resolveWin(grid, bet) {
  const cnt = {}; let scat = 0;
  grid.forEach((s) => { if (s === SC) scat++; else cnt[s] = (cnt[s] || 0) + 1; });
  let win = 0; const hits = [];
  SYM.forEach((s) => { const n = cnt[s[0]] || 0; if (n >= 6) { win += Math.round(bet * s[1] * 0.243 * (n - 4)); hits.push(s[0]); } });
  return { win, scat, hits };
}
/* ===END ENGINE */

const MUSIC = { sd: 0.18, len: 12, root: 146.83, lead: { wave: 'square', vol: 0.035, dur: 0.2, pat: [12, null, 15, 17, null, 15, 14, null, 12, 10, null, 7] }, bass: { wave: 'triangle', vol: 0.12, dur: 0.3, pat: [0, null, null, 7, null, null, 0, null, null, 7, null, null] }, kick: [0, 6], hat: [3, 9], kv: 0.2, hv: 0.022 };
const NAMES = { '💎': 'Rubis', '👑': 'Tricorne du capitaine', '🗝️': 'Clé du trésor', '⚓': 'Ancre', '🧭': 'Boussole', '🍺': 'Rhum', '⭐': 'Étoile de mer (scatter)' };

class BountyGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      defs: DEFS, music: MUSIC,
      stage: '<div class="reels-host"></div><div class="bubbles"></div>',
      buys: [
        { id: 'normal', icon: '⭐', label: 'Bonus 3 étoiles · ×2', desc: '8 tours gratuits, gains ×2', cost: (b) => Math.round(b * BUYN) },
        { id: 'bounty', icon: '🏴‍☠️', label: 'Bonus Bounty · 4 étoiles · ×5', desc: '12 tours gratuits, gains ×5', cost: (b) => Math.round(b * BUYB) },
      ],
      hello: '6 symboles identiques n’importe où pour gagner',
    });
    this.reels = new Reels(this.q('.reels-host'), {
      cols: 5, rows: 3, game: this, random: rnd,
      art: (v) => art(MAP[v]),
      cls: (v) => (v === SC ? 'scatter' : ''),
    });
    this.reels.setAll(Array.from({ length: 15 }, sym));
    const bub = this.q('.bubbles');
    bub.innerHTML = Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 7.3) % 100}%;animation-delay:${-(i * 0.9)}s;animation-duration:${6 + (i % 5)}s"></i>`).join('');
  }

  onMain() {
    this.round(async () => {
      if (!this.pay(this.bet)) return;
      this.lastStake = this.bet;
      const r = await this.spinOnce(1);
      if (r.scat >= 3) { this.stopAuto(); await this.freeSpins(r.scat >= 4 ? 'bounty' : 'normal'); }
    });
  }

  async onBuy(kind) { await this.freeSpins(kind); }

  async spinOnce(mult, inFree = false) {
    const bet = this.bet;
    this.reels.unmark();
    this.setLast(0);
    this.winAmt.textContent = '';
    this.msg(inFree ? 'Tour gratuit…' : 'Les rouleaux tournent…');
    const grid = Array.from({ length: 15 }, rnd);
    sfx.spin();
    await this.reels.spin(grid, {
      tease: (c, vals) => c >= 2 && vals.slice(0, c * 3).filter((s) => s === SC).length >= 2,
      onStop: (c) => { for (let r = 0; r < 3; r++) { const i = c * 3 + r; if (grid[i] === SC) { const n = this.reels.cell(i); n?.classList.add('pop'); const p = center(n); fx.burst(p.x, p.y, 14, ['#fde68a', '#fb923c', '#fff']); sfx.land(); } } },
    });
    if (this.dead) return { win: 0, scat: 0 };
    const res = resolveWin(grid, bet);
    let win = res.win * mult;
    if (win > 0) {
      const idx = grid.map((s, i) => (res.hits.includes(s) ? i : -1)).filter((i) => i >= 0);
      this.reels.mark(idx);
      sfx.coin();
      this.win(win, inFree ? 'Free Spins' : null);
      this.setLast(win);
      this.msg(`${res.hits.map((s) => `${grid.filter((x) => x === s).length} × ${NAMES[s]}`).join(' · ')} : +${fmtC(win)}${mult > 1 ? ` <span class="pill hot">×${mult}</span>` : ''}`);
      if (!inFree) await this.celebrate(win); else { this.winAmt.textContent = fmtC(win); await this.wait(700); }
    } else this.msg(res.scat === 2 ? 'Presque… 2 étoiles' : 'Pas de gain');
    return { win, scat: res.scat };
  }

  async freeSpins(kind) {
    const bounty = kind === 'bounty';
    const mult = bounty ? 5 : 2;
    let free = bounty ? 12 : 8, fsWin = 0, done = 0;
    this.lastStake = this.bet;
    await this.featureIntro(bounty ? 'BONUS BOUNTY' : 'BONUS', `${free} tours gratuits · gains ×${mult}`, art(MAP[SC]));
    this.slotEl.classList.add('in-free');
    while (free > 0 && !this.dead) {
      free--; done++;
      this.setBanner(`<b>${bounty ? 'BOUNTY ×5' : 'BONUS ×2'}</b><span class="pill">Tour ${done} / ${done + free}</span><span class="pill gold">Gain ${fmtC(fsWin)}</span>`);
      const r = await this.spinOnce(mult, true);
      fsWin += r.win;
      if (r.scat >= 3) { free += 3; await this.featureIntro('+3 TOURS', 'Retrigger !', art(MAP[SC]), 1300); }
      await this.wait(450);
    }
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    this.reels.unmark();
    this.setLast(fsWin);
    await this.celebrate(fsWin, { summary: bounty ? 'BONUS BOUNTY' : 'BONUS' });
    this.msg(`Bonus terminé : ${fmtC(fsWin)} gagnés`);
  }

  info() {
    const rows = [...SYM, [SC, 0]].map(([s, v]) => `<div class="pay-item"><div class="pay-sym svg">${art(MAP[s])}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>${s === SC ? '3 = 8 tours ×2 · 4+ = 12 tours ×5' : `6 : ×${(v * 0.486).toFixed(2).replace('.', ',')} · 8 : ×${(v * 0.972).toFixed(2).replace('.', ',')} · 10 : ×${(v * 1.458).toFixed(2).replace('.', ',')}`}</span></div></div>`).join('');
    return this.rules(`<h4>Symboles (× la mise)</h4><div class="paytable">${rows}</div>
      <h4>Gains n’importe où</h4><p>Grille 5×3. <b>6 symboles identiques ou plus</b>, où qu’ils soient, paient mise × valeur × 0,243 × (nombre − 4).</p>
      <h4>Bonus</h4><p>3 étoiles : 8 tours gratuits avec gains ×2. 4 étoiles ou plus : Bounty, 12 tours avec gains ×5. 3 étoiles pendant le bonus : +3 tours.</p>
      <h4>Achats</h4><p>Bonus ×${String(BUYN).replace('.', ',')} la mise · Bonus Bounty ×${BUYB} la mise.</p>`);
  }
}

return { BountyGame };
})();
