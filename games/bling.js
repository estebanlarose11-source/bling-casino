// SpinBet Casino · BlingGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/bling.js ----
__mods['games/impl/bling.js'] = (() => {
// Bling Tower, rebuilt on the shared cabinet. Math, weights and bonuses are the original game's.

const { BaseGame, fmtC, art } = __mods['core/base.js'];
const { SymbolGrid } = __mods['core/grid.js'];
const { DEFS, MAP } = __mods['art/bling.js'];
const { sfx } = __mods['audio.js'];
const { fx } = __mods['fx.js'];

/* ===ENGINE (original) */
const SYM = [['💎', 40, 2], ['👑', 20, 3], ['💰', 10, 4], ['💵', 5, 6], ['🪙', 3, 8], ['🍾', 2, 9], ['💸', 1.5, 9]];
const SC = '💲', SCW = 0.35, TOT = SYM.reduce((a, s) => a + s[2], SCW);
const COLS = 6, ROWS = 7, N = 42, MINC = 5, CAPX = 10000, BUYN = 83, BUYB = 262;
function rnd() { let r = Math.random() * TOT; if (r < SCW) return SC; r -= SCW; for (let i = 0; i < SYM.length; i++) { if (r < SYM[i][2]) return SYM[i][0]; r -= SYM[i][2]; } return SYM[5][0]; }
function val(s) { for (const x of SYM) if (x[0] === s) return x[1]; return 0; }
function clusters(grid) {
  const seen = {}, out = [];
  for (let i = 0; i < N; i++) {
    if (seen[i] || grid[i] === SC) continue;
    const st = [i], cs = []; seen[i] = 1;
    while (st.length) {
      const k = st.pop(); cs.push(k);
      const col = Math.floor(k / ROWS), row = k % ROWS, nb = [];
      if (row > 0) nb.push(k - 1); if (row < ROWS - 1) nb.push(k + 1); if (col > 0) nb.push(k - ROWS); if (col < COLS - 1) nb.push(k + ROWS);
      nb.forEach((n) => { if (!seen[n] && grid[n] === grid[i]) { seen[n] = 1; st.push(n); } });
    }
    if (cs.length >= MINC) out.push({ s: grid[i], cells: cs });
  }
  return out;
}
/* ===END ENGINE */

const MUSIC = { sd: 0.2308, len: 16, root: 196, lead: { wave: 'square', vol: 0.035, dur: 0.16, pat: [12, null, 15, null, 19, null, 15, 12, 10, null, 12, null, 15, null, 10, null] }, bass: { wave: 'triangle', vol: 0.12, dur: 0.28, pat: [-12, null, null, -12, null, null, -12, null, -14, null, null, -14, null, null, -17, null] }, kick: [0, 6, 8, 14], hat: [2, 4, 6, 10, 12, 14], kv: 0.22, hv: 0.025 };
const BWORDS = ['BLING !', 'CASH !', 'SHINY !', 'MILLIONNAIRE !', 'JACKPOT VIBES !', 'TOWER OF GOLD !'];
const BLING = ['#fde047', '#f472b6', '#fff', '#a855f7', '#fbbf24'];
const NAMES = { '💎': 'Diamant', '👑': 'Couronne', '💰': 'Sac d’or', '💵': 'Billets', '🪙': 'Pièce', '🍾': 'Champagne', '💸': 'Billets volants', '💲': 'Scatter' };

class BlingGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      defs: DEFS, music: MUSIC,
      stage: '<div class="bt-bg"><i class="bt-beam b1"></i><i class="bt-beam b2"></i><i class="bt-city"></i><i class="bt-glitter"></i></div><div class="grid-host"></div><div class="bt-word"></div><div class="bt-combo"></div>',
      buys: [
        { id: 'normal', icon: '💲', label: 'Bonus 3 scatters · ×2', desc: '10 tours gratuits, toutes les cases démarrent à ×2', cost: (b) => b * BUYN },
        { id: 'bounty', icon: '💎', label: 'Bonus 4 scatters · ×5', desc: '15 tours gratuits, toutes les cases démarrent à ×5', cost: (b) => b * BUYB },
      ],
      hello: 'Grappes de 5+ · chaque case gagnante garde un multiplicateur',
    });
    this.mm = new Array(N).fill(0);
    this.startM = 0;
    this.grid = new SymbolGrid(this.q('.grid-host'), {
      cols: COLS, rows: ROWS, game: this,
      art: (v) => art(MAP[v]),
      cls: (v) => (v === SC ? 'scatter' : ''),
    });
    this.grid.setAll(Array.from({ length: N }, () => SYM[Math.floor(Math.random() * SYM.length)][0]));
  }

  word(k, text) {
    const w = this.q('.bt-word');
    w.textContent = text || BWORDS[Math.min(k, BWORDS.length - 1)];
    w.className = `bt-word t${Math.min(k, 5)}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3) rotate(-6deg)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.12) rotate(2deg)', offset: 0.22 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%,-65%) scale(1.2)' }], { duration: this.turbo ? 650 : 1100, easing: 'ease-out' });
  }

  combo(n) {
    const c = this.q('.bt-combo');
    c.textContent = n > 1 ? `CASCADE ×${n}` : '';
    c.classList.toggle('on', n > 1);
    if (n > 1) c.animate([{ transform: 'translateX(-50%) scale(1.4)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 300, easing: 'ease-out' });
  }

  showBadge(i, pop) {
    const m = this.mm[i];
    this.grid.badge(i, m > 0 ? `×${m}` : '', m >= 20 ? 't4' : m >= 10 ? 't3' : m >= 6 ? 't2' : '');
    if (pop && m > 0) this.grid.bump(this.grid.cells[i].lastChild);
  }

  resetMM() { for (let i = 0; i < N; i++) { this.mm[i] = this.startM; this.showBadge(i, false); } }

  onMain() {
    this.round(async () => {
      if (!this.pay(this.bet)) return;
      this.lastStake = this.bet;
      this.startM = 0;
      const r = await this.spinOnce(false, 0);
      if (r.scat >= 3) {
        this.stopAuto();
        const bounty = r.scat >= 4;
        await this.freeSpins(bounty ? 'bounty' : 'normal');
      }
    });
  }

  async onBuy(kind) {
    this.msg('Bonus acheté !');
    await this.freeSpins(kind);
  }

  // One spin with its cascades. Returns { total, scat, capHit }.
  async spinOnce(isFree, fsWin) {
    const bet = this.bet;
    this.setLast(0);
    this.winAmt.textContent = '';
    if (!isFree) this.resetMM();
    this.msg(isFree ? 'Tour gratuit…' : 'Les gemmes tombent…');
    const g = Array.from({ length: N }, rnd);
    let scSoFar = 0;
    await this.grid.dropIn(g, {
      tease: (c) => { const t = scSoFar >= 2; for (let r = 0; r < ROWS; r++) if (g[c * ROWS + r] === SC) scSoFar++; return t; },
      onLand: (i, v) => { if (v === SC) { sfx.land(); this.grid.bump(this.grid.cells[i]); } },
    });
    const scat = g.filter((s) => s === SC).length;
    let total = 0, round = 0, capHit = false;
    while (round < 40 && !this.dead) {
      const cl = clusters(g);
      if (!cl.length) break;
      let paid = 0, best = 1;
      const ups = [], rem = new Set(), groups = [];
      cl.forEach((c) => {
        groups.push(c.cells);
        let mx = 1, sm = 0;
        c.cells.forEach((i) => { if (this.mm[i] > mx) mx = this.mm[i]; sm += this.mm[i]; ups.push(i); rem.add(i); });
        if (isFree) mx = Math.max(1, sm);
        if (mx > best) best = mx;
        const p = Math.round(bet * val(c.s) * 0.0786 * (c.cells.length - 3) * mx);
        paid += p;
        this.grid.floatOver(c.cells, `+${fmtC(p)}`);
      });
      const room = bet * CAPX - (isFree ? fsWin : 0) - total;
      if (paid >= room) { paid = Math.max(0, room); capHit = true; }
      total += paid;
      this.grid.mark(ups);
      this.grid.link(groups, ['#fde047', '#f472b6', '#22d3ee', '#a855f7']);
      this.setLast(total);
      this.combo(round + 1);
      this.msg(`Connexion ! +${fmtC(paid)}${best > 1 ? ` <span class="pill hot">×${best}</span>` : ''}`);
      if (round > 0 || paid >= bet * 5 || best > 1) this.word(round);
      sfx.win();
      await this.wait(760);
      ups.forEach((i) => { this.mm[i] += 2; this.showBadge(i, true); });
      this.grid.unmark();
      this.grid.unlink();
      if (ups.length >= 10) this.shake();
      await this.grid.shatter(ups, BLING);
      for (let c = 0; c < COLS; c++) {
        const keep = [];
        for (let r = 0; r < ROWS; r++) { const i = c * ROWS + r; if (!rem.has(i)) keep.push(g[i]); }
        const miss = ROWS - keep.length;
        for (let r = 0; r < ROWS; r++) g[c * ROWS + r] = r < miss ? rnd() : keep[r - miss];
      }
      await this.grid.richCascade(g, rem, 'rgba(244,114,182,.6)');
      round++;
      await this.wait(200);
      if (capHit) break;
    }
    this.combo(0);
    if (total > 0) {
      this.win(total, isFree ? 'Free Spins' : null);
      if (!isFree) await this.celebrate(total);
      else this.winAmt.textContent = fmtC(total);
    }
    if (total > 0 && !isFree) { await this.wait(300); this.resetMM(); this.msg('Multiplicateurs remis à zéro'); await this.wait(400); }
    else if (!isFree) this.msg(total > 0 ? `Total du tour : ${fmtC(total)}` : scat === 2 ? 'Presque… 2 scatters' : 'Pas de gain');
    return { total, scat, capHit };
  }

  async freeSpins(kind) {
    const bounty = kind === 'bounty';
    let free = bounty ? 15 : 10, fsWin = 0, done = 0;
    const totalSpins = () => done + free;
    this.startM = bounty ? 5 : 2;
    this.resetMM();
    this.lastStake = this.bet;
    await this.featureIntro(bounty ? 'BONUS ×5' : 'BONUS ×2', `${free} tours gratuits · toutes les cases à ×${this.startM}`, art(MAP[SC]));
    this.slotEl.classList.add('in-free');
    const rain = setInterval(() => fx.coins(4), 900);
    while (free > 0 && !this.dead) {
      free--; done++;
      this.setBanner(`<b>${bounty ? 'BONUS ×5' : 'BONUS ×2'}</b><span class="pill">Tour ${done} / ${totalSpins()}</span><span class="pill gold">Gain ${fmtC(fsWin)}</span>`);
      const r = await this.spinOnce(true, fsWin);
      fsWin += r.total;
      if (r.scat >= 3) { free += 3; await this.featureIntro('+3 TOURS', 'Retrigger !', art(MAP[SC]), 1300); }
      if (r.capHit) { free = 0; this.msg(`MAX WIN ! ${fmtC(fsWin)}`); }
      await this.wait(500);
    }
    clearInterval(rain);
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    this.startM = 0;
    this.resetMM();
    this.setLast(fsWin);
    await this.celebrate(fsWin, { summary: bounty ? 'BONUS ×5' : 'BONUS ×2' });
    this.msg(`Bonus terminé : ${fmtC(fsWin)} gagnés`);
  }

  info() {
    const rows = SYM.map(([s, v]) => `<div class="pay-item"><div class="pay-sym svg">${art(MAP[s])}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>Valeur ${v} · gain = mise × ${v} × 0,0786 × (taille − 3) × multiplicateur</span></div></div>`).join('');
    return this.rules(`<h4>Symboles</h4><div class="paytable">${rows}</div>
      <h4>Cascades et multiplicateurs</h4><p>Grille 6×7. Une grappe de <b>5 symboles identiques ou plus</b> (côte à côte) paie, disparaît et de nouveaux symboles tombent. Chaque case qui gagne <b>garde un multiplicateur qui monte de +2</b> à chaque connexion ; une grappe paie avec le plus grand multiplicateur de ses cases. En jeu de base, les multiplicateurs repartent à zéro après un tour gagnant.</p>
      <h4>Bonus</h4><p>${art(MAP[SC]).replace('<svg', '<svg style="width:22px;height:22px;vertical-align:middle"')} 3 scatters : 10 tours, toutes les cases à ×2. 4 scatters : 15 tours à ×5. Pendant le bonus, les multiplicateurs restent et une grappe paie avec <b>la somme</b> des multiplicateurs de ses cases. 3 scatters de plus : +3 tours. Gain maximum ×10 000.</p>
      <h4>Achats</h4><p>Bonus ×2 : ×${BUYN} la mise · Bonus ×5 : ×${BUYB} la mise.</p>`);
  }
}

return { BlingGame };
})();
