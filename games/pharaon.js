// SpinBet Casino · PharaonGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/pharaon.js ----
__mods['games/impl/pharaon.js'] = (() => {
// Pharaon Gold, rebuilt on the shared cabinet. Locked winning cells and a climbing multiplier (original math).

const { BaseGame, fmtC, art } = __mods['core/base.js'];
const { SymbolGrid } = __mods['core/grid.js'];
const { DEFS, MAP } = __mods['art/pharaon.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE (original) */
const SYM = [['👑', 8, 3], ['🦅', 6, 4], ['☥', 4, 6], ['🐍', 3, 8], ['🪲', 2, 10], ['🏺', 1, 12]];
const SC = '☀️', SCW = 1.1, TOT = SYM.reduce((a, s) => a + s[2], SCW);
const N = 20, ROWS = 4, COLS = 5, BUYN = 22, BUYB = 62;
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
      if (row > 0) nb.push(k - 1); if (row < ROWS - 1) nb.push(k + 1); if (col > 0) nb.push(k - ROWS); if (col < 4) nb.push(k + ROWS);
      nb.forEach((n) => { if (!seen[n] && grid[n] === grid[i]) { seen[n] = 1; st.push(n); } });
    }
    if (cs.length >= 5) out.push({ s: grid[i], cells: cs });
  }
  return out;
}
/* ===END ENGINE */

const MUSIC = { sd: 0.3261, len: 16, root: 164.81, lead: { wave: 'triangle', vol: 0.07, dur: 0.4, pat: [12, null, 13, null, 16, 13, 12, null, 8, null, 7, null, 4, null, 5, null] }, bass: { wave: 'sawtooth', vol: 0.05, dur: 0.6, pat: [-12, null, null, null, -12, null, null, null, -12, null, null, null, -7, null, -5, null] }, kick: [0, 6, 10], hat: [3, 7, 11, 14, 15], kv: 0.2, hv: 0.02 };
const NAMES = { '👑': 'Masque du pharaon', '🦅': 'Faucon d’Horus', '☥': 'Ankh', '🐍': 'Cobra', '🪲': 'Scarabée', '🏺': 'Amphore', '☀️': 'Soleil (scatter)' };

class PharaonGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      defs: DEFS, music: MUSIC,
      head: '<div class="head-meters"><div class="meter mult-meter"><small>Multiplicateur</small><b>×1</b></div></div>',
      stage: '<div class="grid-host"></div>',
      buys: [
        { id: 'normal', icon: '☀️', label: 'Bonus 3 soleils', desc: '8 tours gratuits, multiplicateur de départ ×4', cost: (b) => b * BUYN },
        { id: 'bounty', icon: '👑', label: 'Bonus Bounty · 4 soleils', desc: '12 tours gratuits, multiplicateur de départ ×10', cost: (b) => b * BUYB },
      ],
      hello: 'Les cases gagnantes se verrouillent, le multiplicateur grimpe',
    });
    this.multEl = this.q('.mult-meter');
    this.grid = new SymbolGrid(this.q('.grid-host'), {
      cols: COLS, rows: ROWS, game: this,
      art: (v) => art(MAP[v]),
      cls: (v) => (v === SC ? 'scatter' : ''),
    });
    this.grid.setAll(Array.from({ length: N }, () => SYM[Math.floor(Math.random() * SYM.length)][0]));
  }

  setMult(m, bump) {
    this.multEl.querySelector('b').textContent = `×${m}`;
    if (bump) { this.grid.bump(this.multEl); const p = center(this.multEl); fx.burst(p.x, p.y, 18, ['#fde68a', '#f59e0b', '#fff'], 5); sfx.upgrade(); }
  }

  onMain() {
    this.round(async () => {
      if (!this.pay(this.bet)) return;
      this.lastStake = this.bet;
      const r = await this.spinOnce(false, 1);
      if (r.scat >= 3) { this.stopAuto(); await this.freeSpins(r.scat >= 4 ? 'bounty' : 'normal'); }
    });
  }

  async onBuy(kind) { await this.freeSpins(kind); }

  async spinOnce(isFree, base) {
    const bet = this.bet;
    const g = Array.from({ length: N }, rnd);
    const locked = new Set();
    let m = isFree ? base : 1, total = 0, round = 0, scat = 0;
    this.grid.cells.forEach((c) => c.classList.remove('lock'));
    this.setMult(m);
    this.setLast(0);
    this.winAmt.textContent = '';
    this.msg(isFree ? 'Tour gratuit…' : 'Le temple s’ouvre…');
    while (!this.dead) {
      let sc = 0;
      await this.grid.dropIn(g, {
        keep: locked,
        tease: round === 0 ? (c) => { const t = sc >= 2; for (let r = 0; r < ROWS; r++) if (g[c * ROWS + r] === SC) sc++; return t; } : null,
        onLand: (i, v) => { if (v === SC) { sfx.land(); this.grid.bump(this.grid.cells[i]); } },
      });
      if (round === 0) scat = g.filter((s) => s === SC).length;
      const cl = clusters(g);
      let paid = 0, fresh = false;
      const newIdx = [];
      cl.forEach((c) => {
        if (c.cells.some((i) => !locked.has(i))) {
          fresh = true;
          const nk = c.cells.filter((i) => !locked.has(i)).length;
          paid += bet * val(c.s) * 0.0675 * (c.cells.length - 2) * (nk / c.cells.length);
          c.cells.forEach((i) => { if (!locked.has(i)) newIdx.push(i); });
        }
      });
      if (!fresh) break;
      paid = Math.round(paid * m);
      total += paid;
      this.grid.mark(newIdx);
      this.grid.floatOver(newIdx, `+${fmtC(paid)}`);
      this.setLast(total);
      this.msg(`Connexion ! +${fmtC(paid)} <span class="pill hot">×${m}</span>`);
      sfx.win();
      await this.wait(800);
      this.grid.unmark();
      cl.forEach((c) => c.cells.forEach((i) => { locked.add(i); this.grid.cells[i].classList.add('lock'); }));
      newIdx.forEach((i) => { const p = center(this.grid.cells[i]); fx.burst(p.x, p.y, 6, ['#fde68a', '#fbbf24'], 3); });
      m++;
      this.setMult(m, true);
      round++;
      if (round >= 15) break;
      this.msg('Respin des cases libres…');
      for (let j = 0; j < N; j++) if (!locked.has(j)) g[j] = rnd();
      await this.wait(250);
    }
    if (total > 0) {
      this.win(total, isFree ? 'Free Spins' : null);
      if (!isFree) await this.celebrate(total); else this.winAmt.textContent = fmtC(total);
    }
    if (!isFree) this.msg(total > 0 ? `Total du tour : ${fmtC(total)}` : scat === 2 ? 'Presque… 2 soleils' : 'Pas de gain');
    return { total, scat, m };
  }

  async freeSpins(kind) {
    const bounty = kind === 'bounty';
    let free = bounty ? 12 : 8, base = bounty ? 10 : 4, fsWin = 0, done = 0;
    this.lastStake = this.bet;
    await this.featureIntro(bounty ? 'BONUS BOUNTY' : 'BONUS', `${free} tours gratuits · départ ×${base} · le multiplicateur reste`, art(MAP[SC]));
    this.slotEl.classList.add('in-free');
    while (free > 0 && !this.dead) {
      free--; done++;
      this.setBanner(`<b>${bounty ? 'BOUNTY ×10' : 'BONUS ×4'}</b><span class="pill">Tour ${done} / ${done + free}</span><span class="pill hot">×${base}</span><span class="pill gold">Gain ${fmtC(fsWin)}</span>`);
      const r = await this.spinOnce(true, base);
      fsWin += r.total;
      base = r.m; // the multiplier carries over to the next spin
      if (r.scat >= 3) { free += 3; await this.featureIntro('+3 TOURS', 'Retrigger !', art(MAP[SC]), 1300); }
      await this.wait(500);
    }
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    this.setMult(1);
    this.grid.cells.forEach((c) => c.classList.remove('lock'));
    this.setLast(fsWin);
    await this.celebrate(fsWin, { summary: bounty ? 'BONUS BOUNTY' : 'BONUS PHARAON' });
    this.msg(`Bonus terminé : ${fmtC(fsWin)} gagnés`);
  }

  info() {
    const rows = [...SYM.map((s) => s[0]), SC].map((s) => `<div class="pay-item"><div class="pay-sym svg">${art(MAP[s])}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>${s === SC ? '3 = bonus 8 tours ×4 · 4+ = Bounty 12 tours ×10' : `Valeur ${val(s)}`}</span></div></div>`).join('');
    return this.rules(`<h4>Symboles</h4><div class="paytable">${rows}</div>
      <h4>Cases verrouillées</h4><p>Grille 5×4. Une grappe de <b>5 symboles identiques ou plus</b> paie (mise × valeur × 0,0675 × (taille − 2), au prorata des nouvelles cases), puis <b>se verrouille</b>. Les autres cases sont relancées et le <b>multiplicateur monte de +1</b> à chaque nouvelle connexion, jusqu’à 15 fois.</p>
      <h4>Bonus</h4><p>3 soleils : 8 tours qui démarrent à ×4. 4 soleils ou plus : Bounty, 12 tours à ×10. Pendant le bonus, <b>le multiplicateur reste</b> d’un tour à l’autre. 3 soleils de plus : +3 tours.</p>
      <h4>Achats</h4><p>Bonus ×${BUYN} la mise · Bonus Bounty ×${BUYB} la mise.</p>`);
  }
}

return { PharaonGame };
})();
