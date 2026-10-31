// SpinBet Casino · MinesGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/mines.js ----
__mods['games/impl/mines.js'] = (() => {
// Mines, rebuilt on the shared cabinet. Multiplier table with a 96% return.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE (original) */
const SIZE = 25;
function mult(k, m) { let r = 0.96; for (let i = 0; i < k; i++) r *= (SIZE - i) / (SIZE - m - i); return r; }
/* ===END ENGINE */

const fm = (x) => '×' + x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GEM = '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="mgem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7f3d0"/><stop offset=".5" stop-color="#10b981"/><stop offset="1" stop-color="#065f46"/></linearGradient></defs><polygon points="32,6 54,22 32,58 10,22" fill="url(#mgem)" stroke="#ecfdf5" stroke-width="2" stroke-linejoin="round"/><path d="M10 22 H54 M32 6 L22 22 L32 58 L42 22 Z" fill="none" stroke="#ecfdf5" stroke-opacity=".7" stroke-width="1.5"/></svg>';
const BOMB = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="30" cy="38" r="18" fill="#1f2937" stroke="#f87171" stroke-width="2"/><circle cx="24" cy="32" r="5" fill="#fff" opacity=".35"/><path d="M40 22 L46 14" stroke="#9ca3af" stroke-width="4" stroke-linecap="round"/><circle cx="48" cy="11" r="5" fill="#fbbf24"/><circle cx="48" cy="11" r="2.5" fill="#fff"/></svg>';

class MinesGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.mines, autoplay: false, mainLabel: 'JOUER',
      cls: 'table-game mines',
      head: `<div class="head-meters"><div class="meter m-cur"><small>Multiplicateur</small><b>×0,96</b></div><div class="meter m-nxt"><small>Prochain</small><b>×1,09</b></div><div class="meter m-cash"><small>Encaissable</small><b>0,00 KE</b></div></div>`,
      stage: `<div class="mn-grid">${Array.from({ length: SIZE }, (_, i) => `<button class="mn-tile" data-i="${i}" disabled aria-label="Case ${i + 1}"><span class="mn-in"><span class="mn-front"></span><span class="mn-back"></span></span></button>`).join('')}</div>`,
      below: '<div class="mn-ctl"><span>Bombes</span><button class="round-btn" data-mines="-1">−</button><b class="mn-n">3</b><button class="round-btn" data-mines="1">+</button><div class="mn-presets">' + [1, 3, 5, 10, 24].map((n) => `<button data-mset="${n}">${n}</button>`).join('') + '</div></div>',
      hello: 'Choisis ta mise et le nombre de bombes.',
    });
    this.mines = this.loadNum('mines_n', 3, 1, 24);
    this.playing = false;
    this.bombs = []; this.opened = []; this.revealed = 0;
    this.tiles = this.qa('.mn-tile');
    this.root.addEventListener('click', (e) => {
      const t = e.target.closest('.mn-tile'); if (t && !t.disabled) this.pick(+t.dataset.i);
      const m = e.target.closest('[data-mines]'); if (m && !this.playing) this.setMines(this.mines + +m.dataset.mines);
      const s = e.target.closest('[data-mset]'); if (s && !this.playing) this.setMines(+s.dataset.mset);
    });
    this.setMines(this.mines);
  }

  setMines(n) {
    this.mines = Math.max(1, Math.min(24, n));
    this.saveKey('mines_n', this.mines);
    this.revealed = 0;
    this.paint();
  }

  paint() {
    if (!this.tiles) return;
    const k = this.revealed, cur = mult(k, this.mines), nx = k < SIZE - this.mines ? mult(k + 1, this.mines) : cur;
    this.q('.m-cur b').textContent = fm(cur);
    this.q('.m-nxt b').textContent = fm(nx);
    this.q('.m-cash b').textContent = this.playing ? fmtC(Math.floor(this.bet * cur)) : fmtC(0);
    this.q('.mn-n').textContent = this.mines;
    this.qa('[data-mset]').forEach((b) => b.classList.toggle('on', +b.dataset.mset === this.mines));
    const lab = this.mainBtn.querySelector('.main-label');
    if (this.playing) { lab.textContent = this.revealed ? `ENCAISSER ${fmtC(Math.floor(this.bet * cur))}` : 'CHOISIS UNE CASE'; this.mainBtn.disabled = !this.revealed; this.mainBtn.classList.add('cash'); }
    else { lab.textContent = 'JOUER'; this.mainBtn.disabled = false; this.mainBtn.classList.remove('cash'); }
    this.qa('[data-mines],[data-mset]').forEach((b) => { b.disabled = this.playing; });
    this.q('[data-act="bet-"]').disabled = this.playing || this.bi === 0;
    this.q('[data-act="bet+"]').disabled = this.playing || this.bi === this.cfg.bets.length - 1;
  }

  onMeters() { this.paint(); }
  onBetChange() { this.paint(); }

  onMain() {
    if (this.playing) return this.cash(false);
    if (!this.pay(this.bet)) return;
    this.lastStake = this.bet;
    this.playing = true; this.revealed = 0; this.opened = [];
    const idx = [...Array(SIZE).keys()];
    for (let j = idx.length - 1; j > 0; j--) { const r = Math.floor(Math.random() * (j + 1)); [idx[j], idx[r]] = [idx[r], idx[j]]; }
    this.bombs = idx.slice(0, this.mines);
    this.tiles.forEach((t, i) => {
      t.className = 'mn-tile'; t.disabled = false;
      t.querySelector('.mn-back').innerHTML = '';
      t.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 260, delay: i * 14, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'backwards' });
    });
    this.setLast(0); this.winAmt.textContent = '';
    this.msg('Retourne une case.');
    sfx.spin();
    this.paint();
  }

  reveal(i, kind, ghost) {
    const t = this.tiles[i];
    t.querySelector('.mn-back').innerHTML = kind === 'bomb' ? BOMB : GEM;
    t.classList.add('open', kind);
    if (ghost) t.classList.add('ghost');
    t.disabled = true;
  }

  showAll() {
    this.tiles.forEach((t, i) => { if (!this.opened.includes(i) && !t.classList.contains('open')) setTimeout(() => this.reveal(i, this.bombs.includes(i) ? 'bomb' : 'safe', true), i * 18); t.disabled = true; });
  }

  cash(auto) {
    if (!this.playing || !this.revealed) return;
    const x = mult(this.revealed, this.mines), win = Math.floor(this.bet * x);
    this.playing = false;
    this.win(win);
    this.setLast(win);
    this.msg(`${auto ? 'Toutes les cases sûres ! ' : 'Encaissé : '}${fmtC(win)} (${fm(x)})`);
    this.showAll();
    this.paint();
    this.celebrate(win);
  }

  pick(i) {
    if (!this.playing || this.opened.includes(i)) return;
    const t = this.tiles[i], p = center(t);
    if (this.bombs.includes(i)) {
      this.playing = false;
      this.reveal(i, 'bomb');
      t.classList.add('boom');
      fx.burst(p.x, p.y, 60, ['#f87171', '#fbbf24', '#fff', '#1f2937'], 11);
      this.flash('rgba(248,113,113,.7)');
      this.shake();
      sfx.puff();
      this.setLast(0);
      this.msg(`💥 Bombe ! Tu perds ${fmtC(this.bet)}.`);
      setTimeout(() => this.showAll(), 350);
      this.paint();
      return;
    }
    this.opened.push(i);
    this.revealed++;
    this.reveal(i, 'safe');
    fx.burst(p.x, p.y, 18, ['#6ee7b7', '#10b981', '#fff'], 5);
    const x = mult(this.revealed, this.mines);
    fx.floatText(p.x, p.y - 20, fm(x), '#6ee7b7', 18);
    sfx.coin();
    [this.q('.m-cur'), this.q('.m-cash')].forEach((n) => { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); });
    if (this.revealed === SIZE - this.mines) return this.cash(true);
    this.msg(`Sûr ! ${fm(x)} · prochain ${fm(mult(this.revealed + 1, this.mines))}`);
    this.paint();
  }

  info() {
    return this.rules(`<h4>Règles</h4><p>Grille 5×5. Choisis de 1 à 24 bombes puis retourne des cases. Chaque diamant augmente le multiplicateur ; une bombe fait perdre la mise. <b>Encaisse quand tu veux.</b></p>
      <p>Multiplicateur après k diamants : 0,96 × produit de (25 − i) / (25 − bombes − i). Plus il y a de bombes, plus il grimpe vite.</p>`);
  }
}

return { MinesGame };
})();
