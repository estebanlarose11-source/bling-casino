// SpinBet Casino · PokerGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/poker.js ----
__mods['games/impl/poker.js'] = (() => {
// Texas Hold'em No Limit against 1 to 8 bots (table of 9). The buy-in comes from the wallet and goes back to it on leaving.
// Bots decide from a Monte Carlo equity of their hand, their profile and some noise.
// Table drawn after the owner's 2 mock-ups (16 November 2026): phone = oval table, seats on the rail, panel
// COUCHER / PAROLE-SUIVRE / RELANCER, − mise +, ½ POT ⅔ POT POT TAPIS ; computer = rounded table, numbered seats,
// red / blue / gold buttons, slider with stops, +25 % / +50 % du pot, ×2 ×3 ×4. Same DOM, `data-m` = phone | pc | land.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, isMuted, setMuted } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { wallet } = __mods['wallet.js'];
const { toast } = __mods['ui.js'];

/* ===ENGINE */
const SUITS = ['♠', '♥', '♦', '♣'];
const FULL = []; for (let v = 2; v <= 14; v++) for (const s of SUITS) FULL.push({ v, s });
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const newDeck = () => shuffle(FULL.map((c) => ({ ...c })));
const mk = (cat, r) => ({ cat, r, score: cat * 759375 + r.reduce((a, x, i) => a + x * 15 ** (4 - i), 0) });
function straightHigh(vals) {
  const has = new Array(15).fill(false);
  vals.forEach((v) => { has[v] = true; if (v === 14) has[1] = true; });
  for (let h = 14; h >= 5; h--) { let ok = true; for (let k = 0; k < 5; k++) if (!has[h - k]) { ok = false; break; } if (ok) return h; }
  return 0;
}
// Best 5-card hand out of 5 to 7 cards. Categories: 0 high card … 8 straight flush.
function eval7(cards) {
  const cnt = new Array(15).fill(0), bySuit = {};
  for (const c of cards) { cnt[c.v]++; (bySuit[c.s] = bySuit[c.s] || []).push(c.v); }
  let fl = null; for (const s in bySuit) if (bySuit[s].length >= 5) fl = bySuit[s];
  if (fl) { const sf = straightHigh(fl); if (sf) return mk(8, [sf]); }
  const quads = [], trips = [], pairs = [], singles = [];
  for (let v = 14; v >= 2; v--) { if (cnt[v] === 4) quads.push(v); else if (cnt[v] === 3) trips.push(v); else if (cnt[v] === 2) pairs.push(v); else if (cnt[v] === 1) singles.push(v); }
  if (quads.length) return mk(7, [quads[0], Math.max(trips[0] || 0, pairs[0] || 0, singles[0] || 0)]);
  if (trips.length && (trips.length > 1 || pairs.length)) return mk(6, [trips[0], Math.max(trips[1] || 0, pairs[0] || 0)]);
  if (fl) return mk(5, fl.slice().sort((a, b) => b - a).slice(0, 5));
  const st = straightHigh(cards.map((c) => c.v));
  if (st) return mk(4, [st]);
  if (trips.length) return mk(3, [trips[0], ...singles.slice(0, 2)]);
  if (pairs.length >= 2) return mk(2, [pairs[0], pairs[1], Math.max(pairs[2] || 0, singles[0] || 0)]);
  if (pairs.length) return mk(1, [pairs[0], ...singles.slice(0, 3)]);
  return mk(0, singles.slice(0, 5));
}
const NM = (v) => (v <= 10 ? String(v) : ['Valet', 'Dame', 'Roi', 'As'][v - 11]);
const PL = (v) => (v <= 10 ? String(v) : ['Valets', 'Dames', 'Rois', 'As'][v - 11]);
const DE = (v) => (v === 14 ? 'd’As' : `de ${PL(v)}`);
function handName(h) {
  const r = h.r;
  return [`Carte haute ${NM(r[0])}`, `Paire ${DE(r[0])}`, `Double paire ${PL(r[0])} et ${PL(r[1])}`, `Brelan ${DE(r[0])}`, `Quinte hauteur ${NM(r[0])}`,
    `Couleur hauteur ${NM(r[0])}`, `Full aux ${PL(r[0])} par les ${PL(r[1])}`, `Carré ${DE(r[0])}`, r[0] === 14 ? 'Quinte flush royale' : `Quinte flush hauteur ${NM(r[0])}`][h.cat];
}
// Monte Carlo share of the pot won against nOpp random hands (ties split).
function equity(hole, board, nOpp, sims = 220) {
  const key = (c) => c.v * 4 + SUITS.indexOf(c.s);
  const known = new Set([...hole, ...board].map(key));
  const rest = FULL.filter((c) => !known.has(key(c)));
  const need = nOpp * 2 + (5 - board.length);
  let won = 0;
  for (let n = 0; n < sims; n++) {
    for (let i = 0; i < need; i++) { const j = i + Math.floor(Math.random() * (rest.length - i)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const b = board.concat(rest.slice(nOpp * 2, need));
    const me = eval7(hole.concat(b)).score;
    let lose = false, ties = 0;
    for (let o = 0; o < nOpp && !lose; o++) { const s = eval7([rest[o * 2], rest[o * 2 + 1], ...b]).score; if (s > me) lose = true; else if (s === me) ties++; }
    if (!lose) won += 1 / (ties + 1);
  }
  return won / sims;
}
// Main pot and side pots from what each player put in this hand.
function buildPots(players) {
  const con = players.filter((p) => p.total > 0);
  const levels = [...new Set(con.map((p) => p.total))].sort((a, b) => a - b);
  const pots = []; let prev = 0;
  for (const lv of levels) {
    const amount = con.reduce((a, p) => a + Math.min(p.total, lv) - Math.min(p.total, prev), 0);
    const elig = con.filter((p) => !p.folded && p.total >= lv);
    prev = lv;
    if (!amount) continue;
    const last = pots[pots.length - 1];
    if (!elig.length && last) last.amount += amount;
    else if (last && last.elig.length === elig.length && last.elig.every((p) => elig.includes(p))) last.amount += amount;
    else pots.push({ amount, elig });
  }
  return pots;
}
/* ===END ENGINE */

const BOTS = [
  { name: 'Tex', av: '🤠', style: 'Requin', tight: 0.04, agg: 0.6, bluff: 0.08, col: '#b45309' },
  { name: 'Lola', av: '👩‍🦰', style: 'Agressive', tight: -0.04, agg: 0.85, bluff: 0.14, col: '#be185d' },
  { name: 'Big Ben', av: '🐻', style: 'Prudent', tight: 0.12, agg: 0.25, bluff: 0.02, col: '#78350f' },
  { name: 'Renard', av: '🦊', style: 'Bluffeur', tight: -0.07, agg: 0.7, bluff: 0.26, col: '#c2410c' },
  { name: 'Mamie Jo', av: '👵', style: 'Suiveuse', tight: -0.1, agg: 0.15, bluff: 0.03, station: true, col: '#6d28d9' },
  { name: 'Ace', av: '🕶️', style: 'Imprévisible', tight: 0, agg: 0.55, bluff: 0.18, wild: 0.14, col: '#1e3a8a' },
  { name: 'Le Prof', av: '🧐', style: 'Calculateur', tight: 0.07, agg: 0.45, bluff: 0.05, col: '#0f766e' },
  { name: 'Mimi', av: '🐱', style: 'Joueuse', tight: -0.05, agg: 0.5, bluff: 0.12, col: '#a21caf' },
  { name: 'Rocky', av: '🥊', style: 'Kamikaze', tight: -0.12, agg: 0.9, bluff: 0.2, col: '#b91c1c' },
];
const MAXB = 8;
const BLINDS = [[100, 200], [500, 1000], [2500, 5000], [10000, 20000]]; // cents: 1/2 to 100/200 KE
const DEPTHS = [50, 100, 200]; // starting stack in big blinds
// 9 places around the table, clockwise from the player (0 = bottom centre); which ones are taken for n players
const SLOTS = { 2: [0, 4], 3: [0, 3, 6], 4: [0, 2, 4, 7], 5: [0, 2, 3, 6, 7], 6: [0, 2, 3, 4, 6, 7], 7: [0, 1, 2, 4, 5, 7, 8], 8: [0, 1, 2, 3, 5, 6, 7, 8], 9: [0, 1, 2, 3, 4, 5, 6, 7, 8] };
const RANK = (c) => (c.v <= 10 ? c.v : 'JQKA'[c.v - 11]);
const RED = (c) => c.s === '♥' || c.s === '♦';
const FACE = (c) => `<b class="ck">${RANK(c)}<i>${c.s}</i></b><span class="cs">${c.s}</span>`;
const STREETS = ['Pré-flop', 'Flop', 'Turn', 'River'];
const TABLE_NO = 1 + Math.floor(Math.random() * 24);

const SPADE = '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="pkxGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#f2c94c"/><stop offset="1" stop-color="#a06a12"/></linearGradient></defs><path d="M32 4C24 16 8 24 8 37c0 8 6 13 13 13 4 0 7-2 9-4-1 6-4 10-8 13h20c-4-3-7-7-8-13 2 2 5 4 9 4 7 0 13-5 13-13C56 24 40 16 32 4z" fill="url(#pkxGold)" stroke="#5a3a05" stroke-width="1.5"/><path d="M32 14c-5 8-14 14-15 22" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const ICONS = {
  fold: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="6" width="13" height="19" rx="2.5" transform="rotate(-14 11 15)" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="13" y="5" width="13" height="19" rx="2.5" transform="rotate(10 19 14)" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="2.2"/></svg>',
  call: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M11 16l4 4 7-8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  raise: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="20" width="5" height="8" rx="1" fill="currentColor"/><rect x="12" y="15" width="5" height="13" rx="1" fill="currentColor"/><rect x="20" y="10" width="5" height="18" rx="1" fill="currentColor"/><path d="M5 15L13 8l5 4 9-8M21 4h6v6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  snd: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path class="w" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="x" d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  cards: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="6" width="15" height="21" rx="2.5" transform="rotate(-10 11 16)" fill="#16110a" stroke="url(#pkxGold)" stroke-width="1.8"/><rect x="13" y="5" width="15" height="21" rx="2.5" transform="rotate(8 20 15)" fill="#16110a" stroke="url(#pkxGold)" stroke-width="1.8"/><path d="M20.5 10c-2 3-5 4-5 7 0 2 3 3 5 1-.3 2-1 3-2 4h4c-1-1-1.7-2-2-4 2 2 5 1 5-1 0-3-3-4-5-7z" fill="url(#pkxGold)"/></svg>',
  user: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7.5" fill="currentColor"/><path d="M6 37c1-8 7-12 14-12s13 4 14 12z" fill="currentColor"/></svg>',
};
// a pile of chips (amount in cents): colours of the casino values
const CHIP_COL = [[1000000, '#d9a520', '#fff3c4'], [100000, '#6d28d9', '#e9d5ff'], [10000, '#17181c', '#e8c25a'], [2500, '#138a52', '#d1fae5'], [500, '#c81e3a', '#fee2e2'], [100, '#e9edf3', '#2b6cb0']];
const chipHTML = (amount) => {
  const out = []; let left = amount;
  for (const [v, c, e] of CHIP_COL) while (left >= v && out.length < 5) { out.push([c, e]); left -= v; }
  if (!out.length) out.push(CHIP_COL[CHIP_COL.length - 1].slice(1));
  return out.map(([c, e], k) => `<i style="--c:${c};--e:${e};--k:${k}"></i>`).join('');
};

class PokerGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.blackjack, stepper: false, autoplay: false, turbo: true, mainLabel: 'S’ASSEOIR', betLabel: 'Ton tapis',
      cls: 'table-game poker pkx-game',
      stage: `<div class="pkx" data-m="phone" data-st="setup">
        <div class="pkx-top">
          <div class="pkx-logo">${SPADE}<span><b>LE TEXAS</b><small>POKER</small></span></div>
          <div class="pkx-title"><b class="pkx-t1"></b><small><i></i>No Limit</small></div>
          <div class="pkx-bal" title="Ton solde"><i></i><b></b></div>
          <button class="pkx-rebuy" data-pk="rebuy" type="button">Recave <b>+</b></button>
          <button class="pkx-sq pkx-snd" data-pk="snd" type="button" aria-label="Son">${ICONS.snd}</button>
          <button class="pkx-sq pkx-fs" data-act="full" type="button" aria-label="Plein écran">⛶<span>Plein écran</span></button>
          <button class="pkx-sq" data-pk="menu" type="button" aria-label="Menu">${ICONS.menu}</button>
          <div class="pkx-menu" hidden>
            <button data-pk="rebuy" type="button">💰 Recave (remettre mon tapis)</button>
            <button data-pk="rules" type="button">📖 Règles du jeu</button>
            <button data-pk="opts" type="button">⚙️ Turbo, musique et son</button>
            <button data-pk="quit" type="button">🚪 Quitter la table</button>
          </div>
        </div>
        <div class="pkx-strip">
          <div><b class="pkx-s1"></b><small>NL Hold’em</small></div>
          <div class="pkx-s-tb">${ICONS.cards}<span><b>Table ${TABLE_NO}</b><small class="pkx-s2"></small></span></div>
          <div><b class="pkx-s3"></b><small class="pkx-s4"></small></div>
        </div>
        <div class="pkx-room">
          <div class="pkx-table">
            <div class="pkx-rail"><div class="pkx-felt"><span class="pkx-print">LE TEXAS · SPINBET</span></div></div>
            <div class="pkx-center">
              <div class="pkx-emb">${SPADE}</div>
              <div class="pkx-pot"><small>POT</small><b>0</b></div>
              <div class="pkx-board">${'<i class="pkx-slot"></i>'.repeat(5)}</div>
              <div class="pkx-hand"></div>
              <div class="pkx-log"></div>
            </div>
            <div class="pkx-seats"></div>
          </div>
          <div class="pkx-setup">
            <h3>${SPADE}<span>Choisis ta table</span></h3>
            <div class="pkx-opt"><label>Adversaires</label><div class="pkx-seg" data-o="bots">${Array.from({ length: MAXB }, (_, i) => `<button type="button" data-v="${i + 1}">${i + 1}</button>`).join('')}</div></div>
            <div class="pkx-opt"><label>Blindes (petite / grosse)</label><div class="pkx-seg" data-o="blind">${BLINDS.map((b, i) => `<button type="button" data-v="${i}">${fmtC(b[0])} / ${fmtC(b[1])}</button>`).join('')}</div></div>
            <div class="pkx-opt"><label>Tapis de départ (le même pour tous)</label><div class="pkx-seg" data-o="depth"></div></div>
            <p>Ton tapis est pris sur ton solde et rendu avec tes gains quand tu quittes la table.</p>
          </div>
          <div class="pkx-over" hidden></div>
        </div>
        <div class="pkx-panel">
          <div class="pkx-acts">
            <button type="button" data-pa="fold" class="fold">${ICONS.fold}<b>COUCHER</b><small></small></button>
            <button type="button" data-pa="call" class="call">${ICONS.call}<b>PAROLE</b><small></small></button>
            <button type="button" data-pa="raise" class="raise">${ICONS.raise}<b>RELANCER</b><small></small></button>
            <button type="button" data-pk="main" class="pkx-main"><b>S’ASSEOIR</b><small></small></button>
          </div>
          <div class="pkx-amtrow">
            <button type="button" data-pq="-" aria-label="Moins">−</button>
            <div class="pkx-amt"><b></b></div>
            <button type="button" data-pq="+" aria-label="Plus">+</button>
          </div>
          <div class="pkx-slide">
            <label>Mise</label><div class="pkx-amt2"><b></b></div>
            <div class="pkx-track"><input type="range" class="pkx-range" min="0" max="1000" value="0" aria-label="Montant de la mise"><div class="pkx-ticks"></div></div>
            <div class="pkx-plus"><button type="button" data-pq="p25">+25 % du pot</button><button type="button" data-pq="p50">+50 % du pot</button></div>
          </div>
          <div class="pkx-quick pkx-qph"><button type="button" data-pq=".5"><b>½</b><small>POT</small></button><button type="button" data-pq=".667"><b>⅔</b><small>POT</small></button><button type="button" data-pq="1"><b>POT</b></button><button type="button" data-pq="all" class="all"><b>TAPIS</b></button></div>
          <div class="pkx-quick pkx-qpc"><button type="button" data-pq="x2"><b>×2</b><small></small></button><button type="button" data-pq="x3"><b>×3</b><small></small></button><button type="button" data-pq="x4"><b>×4</b><small></small></button><button type="button" data-pq="all" class="all"><b>TAPIS</b><small></small></button></div>
        </div>
      </div>`,
      hello: 'Choisis tes adversaires, les blindes et ton tapis, puis assieds-toi.',
    });
    this.opt = { bots: 5, blind: 0, depth: 1 };
    try { Object.assign(this.opt, JSON.parse(localStorage.getItem('poker_opt') || '{}')); } catch { /* ignore */ }
    this.opt.bots = Math.max(1, Math.min(MAXB, +this.opt.bots || 5));
    this.state = 'setup';
    this.tok = 0;
    this.players = [];
    this.raiseTo = 0;
    this.view = this.q('.pkx');
    this.logEl = this.q('.pkx-log');
    this.onPk = (e) => this.onTap(e);
    this.root.addEventListener('click', this.onPk);
    this.q('.pkx-range').addEventListener('input', (e) => { this.raiseTo = this.fromSlider(+e.target.value); this.paintRaise(false); });
    this.onKeys = (e) => this.keys(e);
    addEventListener('keydown', this.onKeys);
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.view);
    this.ro.observe(this.q('.pkx-room'));
    this.paintSetup();
    requestAnimationFrame(() => this.layout());
  }

  /* ---------- setup ---------- */
  bb() { return BLINDS[this.opt.blind][1]; }
  sb() { return BLINDS[this.opt.blind][0]; }
  buyIn() { return DEPTHS[this.opt.depth] * this.bb(); }
  stakeLabel() { return this.state === 'setup' || !this.me ? (this.opt ? this.buyIn() : 0) : this.me.stack; }
  onMeters() { if (this.view) this.paintTop(); }

  paintSetup() {
    this.q('.pkx-seg[data-o="depth"]').innerHTML = DEPTHS.map((d, i) => `<button type="button" data-v="${i}">${fmtC(d * this.bb())}<small>${d} BB</small></button>`).join('');
    this.qa('.pkx-seg').forEach((s) => s.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.v === this.opt[s.dataset.o])));
    try { localStorage.setItem('poker_opt', JSON.stringify(this.opt)); } catch { /* ignore */ }
    // the table shows who will sit down
    const bots = BOTS.slice(0, this.opt.bots);
    this.players = [this.meProfile(), ...bots.map((b) => ({ ...b }))].map((p, i) => ({ ...p, i, stack: this.buyIn(), cards: [], bet: 0, total: 0 }));
    this.me = null;
    this.buildSeats();
    this.updateMeters();
  }

  meProfile() {
    const prof = __mods['profile.js']?.profiles?.current, look = __mods['shop.js']?.publicLook?.(prof);
    const html = look ? __mods['shop.js']?.lookHTML?.(look, 'md') : '';
    const name = String(prof?.name || 'Toi').slice(0, 14);
    return { name, human: true, avHTML: html || `<span class="pkx-ini">${name.charAt(0).toUpperCase()}</span>`, col: '#b8860b' };
  }

  // top bar, strip and the big button
  paintTop() {
    const set = (s, t) => { const e = this.q(s); if (e && e.textContent !== t) e.textContent = t; };
    set('.pkx-bal b', fmtC(this.balC()));
    const bl = `${fmtC(this.sb())} / ${fmtC(this.bb())}`;
    set('.pkx-t1', `Texas Hold’em · ${bl}`);
    set('.pkx-s1', bl);
    const seated = this.players.filter((p) => !p.out).length;
    set('.pkx-s2', this.state === 'setup' ? `${this.opt.bots + 1} joueurs · 9 max` : `Main n°${this.handNo || 0} · ${seated} joueurs`);
    set('.pkx-s3', `Tapis ${fmtC(this.state === 'setup' || !this.buy ? this.buyIn() : this.buy)}`);
    set('.pkx-s4', `${DEPTHS[this.opt.depth]} grosses blindes`);
    this.view.dataset.st = this.humanRes ? 'act' : this.state;
    const M = { setup: ['S’ASSEOIR', `Tapis ${fmtC(this.buyIn())}`], between: ['MAIN SUIVANTE', this.cd ? `dans ${this.cd} s` : ''], over: ['NOUVELLE PARTIE', 'retour au choix de la table'] }[this.state];
    const mb = this.q('.pkx-main');
    if (M) { mb.querySelector('b').textContent = M[0]; mb.querySelector('small').textContent = M[1]; }
    const rb = this.canRebuy();
    this.qa('[data-pk="rebuy"]').forEach((b) => { b.disabled = !rb; });
    this.q('.pkx-snd').classList.toggle('off', isMuted());
    if (!this.humanRes) this.paintIdle();
  }

  // buttons when it is not the player's turn: greyed, with what they would do
  paintIdle() {
    const p = this.me;
    this.qa('[data-pa], [data-pq], .pkx-range').forEach((b) => { b.disabled = true; });
    const tc = p && !p.folded ? this.toCall(p) : 0;
    this.q('[data-pa="call"] b').textContent = tc ? 'SUIVRE' : 'PAROLE';
    this.q('[data-pa="call"] small').textContent = tc ? fmtC(Math.min(tc, p.stack)) : '';
    this.q('[data-pa="fold"] small').textContent = '';
    this.q('[data-pa="raise"] b').textContent = this.cur ? 'RELANCER' : 'MISER';
    this.q('[data-pa="raise"] small').textContent = '';
    const w = this.state === 'play' ? (p?.folded ? 'Couché · attends la main suivante' : 'En attente des autres joueurs…') : '';
    this.q('.pkx-amt b').textContent = w || fmtC(this.bb());
    this.q('.pkx-amt2 b').textContent = fmtC(this.bb());
    this.q('.pkx-amt').classList.toggle('wait', !!w);
  }

  onTap(e) {
    const t = e.target.closest('button');
    const menu = this.q('.pkx-menu');
    if (!t || !t.closest('.pkx-menu, [data-pk="menu"]')) menu.hidden = true;
    if (!t || t.disabled) return;
    sfx.unlock(); this.music?.start?.();
    const seg = t.closest('.pkx-seg');
    if (seg && this.state === 'setup') { this.opt[seg.dataset.o] = +t.dataset.v; sfx.click(); this.paintSetup(); return; }
    const k = t.dataset.pk;
    if (k === 'main') return this.onMain();
    if (k === 'menu') { menu.hidden = !menu.hidden; sfx.click(); return; }
    if (k === 'rebuy') { menu.hidden = true; return this.rebuy(); }
    if (k === 'rules') { menu.hidden = true; return this.showInfo(); }
    if (k === 'opts') { menu.hidden = true; return this.openMenu(); }
    if (k === 'quit') { menu.hidden = true; return this.quit(); }
    if (k === 'snd') { setMuted(!isMuted()); this.paintTop(); return; }
    if (t.dataset.pq) return this.quickRaise(t.dataset.pq);
    if (t.dataset.pa) this.act(t.dataset.pa);
  }

  act(a) {
    if (!this.humanRes) return;
    const res = this.humanRes; this.humanRes = null;
    const p = this.me;
    if (a === 'raise') res({ a: 'raise', to: this.raiseTo });
    else if (a === 'allin') res({ a: 'raise', to: p.bet + p.stack });
    else res({ a: this.toCall(p) ? (a === 'call' ? 'call' : 'fold') : (a === 'call' ? 'check' : 'fold') });
    this.paintTop();
  }

  // computer: F coucher, C parole / suivre, R relancer, ↑ ↓ the amount, A tapis
  keys(e) {
    if (e.target.closest?.('input:not(.pkx-range), textarea') || document.querySelector('.modal-back') || !this.humanRes) return;
    const k = e.key.toLowerCase();
    if (k === 'f') this.act('fold');
    else if (k === 'c') this.act('call');
    else if (k === 'r' || k === 'enter') this.act('raise');
    else if (k === 'arrowup' || k === '+') { e.preventDefault(); this.quickRaise('+'); }
    else if (k === 'arrowdown' || k === '-') { e.preventDefault(); this.quickRaise('-'); }
    else if (k === 'a') this.quickRaise('all');
  }

  onMain() {
    if (this.state === 'setup') this.start();
    else if (this.state === 'between') this.nextNow?.();
    else if (this.state === 'over') this.toSetup();
  }

  start() {
    const buy = this.buyIn();
    if (!this.pay(buy)) return;
    this.buy = buy; this.invested = buy; this.cashed = false; this.handNo = 0; this.pot = 0; this.board = []; this.cur = 0; this.tok++;
    const bots = BOTS.slice(0, this.opt.bots);
    this.players = [this.meProfile(), ...bots.map((b) => ({ ...b }))].map((p, i) => ({ ...p, i, stack: buy, cards: [], folded: false, allIn: false, bet: 0, total: 0, out: false }));
    this.me = this.players[0];
    this.dealer = Math.floor(Math.random() * this.players.length);
    this.q('.pkx-over').hidden = true;
    this.buildSeats();
    this.state = 'play';
    this.updateMeters();
    sfx.click();
    this.loop(this.tok);
  }

  toSetup() {
    this.tok++;
    this.state = 'setup';
    this.q('.pkx-over').hidden = true;
    this.clearTable();
    this.msg('Choisis tes adversaires, les blindes et ton tapis, puis assieds-toi.');
    this.paintSetup();
  }

  clearTable() {
    this.pot = 0; this.board = []; this.cur = 0;
    this.qa('.pkx-slot').forEach((e) => { e.innerHTML = ''; });
    this.q('.pkx-hand').textContent = '';
    this.q('.pkx-pot b').textContent = fmtC(0);
  }

  canRebuy() {
    const p = this.me;
    return !!p && !this.cashed && !p.out && (this.state === 'between' || (this.state === 'play' && p.folded)) && p.stack < this.buy;
  }

  // Recave: tops the stack up to the starting stack, from the balance (between two hands or once folded)
  rebuy() {
    if (!this.canRebuy()) { toast('Recave possible entre deux mains (ou quand tu es couché), si ton tapis est sous le tapis de départ', 'info'); return; }
    const add = this.buy - this.me.stack;
    if (!this.pay(add)) return;
    this.me.stack += add; this.invested += add;
    sfx.coin();
    toast(`Recave : +${fmtC(add)} sur ton tapis`);
    this.paintSeats();
  }

  // Leaving the table: your stack goes back to your balance (chips already in the pot are lost, like a fold).
  quit() {
    if (this.state === 'setup') { toast('Tu n’es pas encore assis à la table', 'info'); return; }
    const back = this.cashOut();
    if (this.humanRes) { const r = this.humanRes; this.humanRes = null; r({ a: 'fold' }); }
    toast(back > 0 ? `Tu quittes la table : ${fmtC(back)} rendus sur ton solde` : 'Tu quittes la table');
    this.toSetup();
  }

  cashOut() {
    if (this.cashed || !this.me) return 0;
    this.cashed = true;
    const s = this.me.stack;
    if (s > 0) wallet.credit(s / 100, s > this.invested ? { game: 'Le Texas', x: s / this.invested } : undefined);
    this.updateMeters();
    return s;
  }

  destroy() {
    this.tok++;
    if (this.state !== 'setup') this.cashOut();
    this.ro?.disconnect();
    removeEventListener('keydown', this.onKeys);
    clearInterval(this.cdT);
    super.destroy();
  }

  msg(t) {
    if (this.dead || !this.logEl) return;
    this.logEl.innerHTML = t;
    this.logEl.classList.remove('on'); void this.logEl.offsetWidth; this.logEl.classList.add('on');
  }

  /* ---------- table drawing ---------- */
  buildSeats() {
    const n = this.players.length, slots = SLOTS[n], used = new Set(slots);
    let html = '';
    for (let k = 0; k < 9; k++) {
      if (used.has(k)) continue;
      html += `<div class="pkx-seat empty" data-k="${k}"><i class="pkx-num">${k + 1}</i><div class="pkx-av">${ICONS.user}</div><div class="pkx-plate"><b>Place libre</b><em>${k + 1}</em></div></div>`;
    }
    html += this.players.map((p, i) => {
      const k = slots[i];
      const av = p.human ? p.avHTML : `<span class="pkx-emo">${p.av}</span>`;
      return `<div class="pkx-seat${p.human ? ' me' : ''}" data-i="${i}" data-k="${k}" style="--col:${p.col}">
          <i class="pkx-num">${k + 1}</i>
          <div class="pkx-av">${av}<svg class="pkx-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" pathLength="100"/></svg><i class="pkx-dbtn">D</i></div>
          <div class="pkx-plate"><b>${p.human ? 'Toi' : p.name}</b><em class="pkx-stack"></em></div>
          <div class="pkx-cards"></div>
          <div class="pkx-bub"></div><div class="pkx-hn"></div>
        </div>
        <div class="pkx-bet" data-i="${i}" data-k="${k}"><span class="pkx-pile"></span><b></b></div>`;
    }).join('');
    this.q('.pkx-seats').innerHTML = html;
    this.layout();
    this.paintSeats();
  }

  // Sizes and places everything from the room's size (ResizeObserver): mode, table box, rail, seats, bets.
  layout() {
    const v = this.view, room = this.q('.pkx-room'), T = this.q('.pkx-table');
    if (!v || !room) return;
    const W = v.clientWidth, H = v.clientHeight;
    const mode = W > H * 1.2 && H < 600 ? 'land' : W >= 760 ? 'pc' : 'phone';
    if (v.dataset.m !== mode) v.dataset.m = mode;
    const rw = room.clientWidth, rh = room.clientHeight;
    if (!rw || !rh) return;
    const round = mode !== 'pc';
    const [amin, amax] = round ? [0.62, 1.75] : [1.15, 2.25];
    let w = rw, h = rh;
    if (w / h > amax) w = h * amax;
    if (w / h < amin) h = w / amin;
    w = Math.floor(w); h = Math.floor(h);
    const m = Math.min(w, h);
    const d = Math.round(round ? Math.max(40, Math.min(66, w * 0.135, h * 0.14)) : Math.max(36, Math.min(58, m * 0.1)));
    const pw = round ? Math.round(d * 1.62) : Math.round(Math.max(116, Math.min(170, w * 0.125))), ph = round ? 0 : Math.round(Math.max(48, Math.min(70, h * 0.11)));
    const cw = Math.round(Math.max(28, Math.min(round ? 52 : 72, w * (round ? 0.092 : 0.06), h * (round ? 0.1 : 0.11))));
    T.style.width = `${w}px`; T.style.height = `${h}px`;
    T.style.setProperty('--d', `${d}px`); T.style.setProperty('--pw', `${pw}px`); T.style.setProperty('--ph', `${ph}px`); T.style.setProperty('--cw', `${cw}px`);
    T.style.setProperty('--hw', `${Math.round(Math.max(36, Math.min(round ? 56 : 76, d * 0.9, h * (round ? 0.115 : 0.12))))}px`);
    // rail box: seats sit on it, their boxes must stay in the table box
    const top = round ? d / 2 + 6 : ph / 2 + 14, bottom = round ? d / 2 + 36 : ph / 2 + 10, side = round ? Math.max(pw / 2, d / 2) + 2 : pw / 2 + 6;
    const rail = this.q('.pkx-rail');
    Object.assign(rail.style, { left: `${side}px`, top: `${top}px`, width: `${w - 2 * side}px`, height: `${h - top - bottom}px`, borderRadius: round ? '50%' : `${Math.round(Math.min(h - top - bottom, w) * 0.2)}px` });
    const thick = Math.max(10, Math.round(m * 0.045));
    rail.style.setProperty('--thick', `${thick}px`);
    this.q('.pkx-felt').style.borderRadius = round ? '50%' : `${Math.max(8, Math.round(Math.min(h - top - bottom, w) * 0.2) - thick)}px`;
    const cx = w / 2, cy = top + (h - top - bottom) / 2, rx = (w - 2 * side) / 2 - thick / 2, ry = (h - top - bottom) / 2 - thick / 2;
    const ex = round ? 2 : 4.5;
    const pt = (k) => {
      const a = (90 + 40 * k) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      let x = cx + rx * Math.sign(c) * Math.abs(c) ** (2 / ex), y = cy + ry * Math.sign(s) * Math.abs(s) ** (2 / ex);
      x = Math.max(side, Math.min(w - side, x));
      return [x, y];
    };
    this.P = { cx, cy };
    this.qa('.pkx-seat').forEach((s) => { const [x, y] = pt(+s.dataset.k); s.style.left = `${x}px`; s.style.top = `${y}px`; s.dataset.side = x < cx - 4 ? 'l' : x > cx + 4 ? 'r' : 'c'; s.dataset.vy = y < cy ? 't' : 'b'; });
    this.qa('.pkx-bet').forEach((b) => {
      const k = +b.dataset.k; const [x, y] = pt(k);
      let bx = x + (cx - x) * (round ? 0.34 : 0.36), by = y + (cy - y) * (round ? 0.36 : 0.42);
      if (k === 0) { bx = cx - Math.min(w * 0.2, rx * 0.42); by = y - (y - cy) * (round ? 0.42 : 0.35); }
      b.style.left = `${bx}px`; b.style.top = `${by}px`;
    });
    this.q('.pkx-center').style.top = `${cy - (round ? h * 0.07 : h * 0.05)}px`;
  }

  seat(p) { return this.q(`.pkx-seat[data-i="${p.i}"]`); }
  betEl(p) { return this.q(`.pkx-bet[data-i="${p.i}"]`); }

  paintSeats() {
    for (const p of this.players) {
      const s = this.seat(p); if (!s) continue;
      s.querySelector('.pkx-stack').textContent = p.out ? 'Éliminé' : p.allIn ? 'TAPIS' : fmtC(p.stack);
      s.classList.toggle('out', !!p.out);
      s.classList.toggle('folded', !!p.folded && !p.out);
      s.classList.toggle('dealer', this.state !== 'setup' && p.i === this.dealer);
      const be = this.betEl(p);
      be.classList.toggle('on', p.bet > 0);
      if (p.bet) { be.querySelector('b').textContent = fmtC(p.bet); be.querySelector('.pkx-pile').innerHTML = chipHTML(p.bet); }
    }
    const inPlay = (this.pot || 0) + this.players.reduce((a, p) => a + (p.bet || 0), 0);
    this.q('.pkx-pot b').textContent = fmtC(inPlay || 0);
    this.updateMeters();
  }

  say(p, text, cls = '') {
    const b = this.seat(p).querySelector('.pkx-bub');
    b.textContent = text;
    b.className = `pkx-bub on ${cls}`;
    clearTimeout(p.sayT);
    p.sayT = setTimeout(() => b.classList.remove('on'), 1900);
  }

  cardNode(c, faceUp, cls = '') {
    const d = document.createElement('div');
    d.className = `pkx-card ${cls}${faceUp ? '' : ' back'}${RED(c) ? ' red' : ''}`;
    if (faceUp) d.innerHTML = FACE(c);
    return d;
  }

  // card flies from the dealer's deck (the spade in the middle of the table)
  fly(node, ms) {
    const from = this.q('.pkx-emb').getBoundingClientRect(), r = node.getBoundingClientRect();
    node.animate([{ transform: `translate(${from.left + from.width / 2 - r.left - r.width / 2}px, ${from.top + from.height / 2 - r.top - r.height / 2}px) rotate(-40deg) scale(.45)`, opacity: 0 }, { opacity: 1, offset: 0.18 }, { transform: 'none', opacity: 1 }],
      { duration: ms, easing: 'cubic-bezier(.2,.75,.3,1)' });
  }

  flip(node, c) {
    const d = this.turbo ? 90 : 150;
    node.animate([{ transform: 'perspective(500px) rotateY(0)' }, { transform: 'perspective(500px) rotateY(90deg) scale(1.08)' }], { duration: d, easing: 'ease-in' }).finished.then(() => {
      if (!node.isConnected) return;
      node.classList.remove('back'); node.innerHTML = FACE(c);
      node.animate([{ transform: 'perspective(500px) rotateY(-90deg) scale(1.08)' }, { transform: 'perspective(500px) rotateY(0)' }], { duration: d * 1.4, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    });
  }

  // bets slide into the pot at the end of each betting round
  async collect() {
    const pot = this.q('.pkx-pot').getBoundingClientRect();
    let any = false;
    const ms = this.turbo ? 200 : 380;
    for (const p of this.players) {
      if (!p.bet) continue;
      any = true;
      const e = this.betEl(p), r = e.getBoundingClientRect();
      e.animate([{ transform: 'translate(-50%,-50%)' }, { transform: `translate(calc(-50% + ${pot.left + pot.width / 2 - r.left - r.width / 2}px), calc(-50% + ${pot.top + pot.height / 2 - r.top - r.height / 2}px)) scale(.6)`, opacity: 0.1 }], { duration: ms, easing: 'cubic-bezier(.5,0,.75,0)' });
    }
    if (any) { sfx.coin(); await sleep(ms); }
    for (const p of this.players) { this.pot += p.bet; p.bet = 0; }
    this.paintSeats();
  }

  // the pot flies to the winner: a pile of chips and the amount
  chipsTo(p, amount) {
    const pot = this.q('.pkx-pot').getBoundingClientRect(), s = this.seat(p).querySelector('.pkx-av').getBoundingClientRect();
    const c = document.createElement('div');
    c.className = 'pkx-fly';
    c.innerHTML = `<span class="pkx-pile">${chipHTML(amount)}</span><b>+${fmtC(amount)}</b>`;
    c.style.cssText = `left:${pot.left + pot.width / 2}px;top:${pot.top + pot.height / 2}px`;
    document.body.appendChild(c);
    const ms = this.turbo ? 500 : 900;
    c.animate([{ transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.15 }, { transform: `translate(calc(-50% + ${s.left + s.width / 2 - pot.left - pot.width / 2}px), calc(-50% + ${s.top + s.height / 2 - pot.top - pot.height / 2}px)) scale(1)`, opacity: 1, offset: 0.8 }, { transform: `translate(calc(-50% + ${s.left + s.width / 2 - pot.left - pot.width / 2}px), calc(-50% + ${s.top + s.height / 2 - pot.top - pot.height / 2 - 18}px)) scale(1.05)`, opacity: 0 }],
      { duration: ms + 600, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' });
    setTimeout(() => c.remove(), ms + 700);
  }

  paintHand() {
    const el = this.q('.pkx-hand');
    if (!this.me?.cards.length || this.me.out) { el.textContent = ''; return; }
    const h = eval7(this.me.cards.concat(this.board));
    el.innerHTML = `${this.me.folded ? 'Couché · ' : 'Ta main : '}<b>${handName(h)}</b>`;
  }

  /* ---------- game loop ---------- */
  async loop(tok) {
    const ok = () => !this.dead && tok === this.tok;
    while (ok()) {
      await this.playHand(tok);
      if (!ok()) return;
      this.players.forEach((p) => { if (p.stack <= 0) p.out = true; });
      this.paintSeats();
      const alive = this.players.filter((p) => !p.out);
      if (this.me.out || alive.length === 1) return this.gameOver(this.me.out ? 'lose' : 'win');
      this.state = 'between';
      this.cd = 5;
      this.updateMeters();
      clearInterval(this.cdT);
      this.cdT = setInterval(() => { if (this.cd > 1) { this.cd--; this.paintTop(); } }, this.turbo ? 450 : 1000);
      await Promise.race([this.wait(5000), new Promise((r) => { this.nextNow = r; })]);
      clearInterval(this.cdT); this.cd = 0;
      this.nextNow = null;
      if (!ok()) return;
      this.state = 'play';
      this.updateMeters();
    }
  }

  gameOver(kind) {
    this.state = 'over';
    const s = this.me.stack, back = this.cashOut(), net = s - this.invested;
    const ov = this.q('.pkx-over');
    ov.innerHTML = kind === 'win'
      ? `<div><h3>🏆 Tu as raflé la table !</h3><p>Tous les adversaires sont éliminés.</p><p><b>${fmtC(back)}</b> rendus sur ton solde (${net >= 0 ? '+' : '−'}${fmtC(Math.abs(net))})</p></div>`
      : '<div><h3>Éliminé…</h3><p>Tu n’as plus de jetons. Retente ta chance !</p></div>';
    ov.hidden = false;
    if (kind === 'win') { fx.confetti(90); sfx.bigWin(); } else sfx.reelStop(0);
    this.msg(kind === 'win' ? 'Victoire ! Relance une partie quand tu veux.' : 'Partie terminée.');
    this.updateMeters();
  }

  live() { return this.players.filter((p) => !p.out && !p.folded); }
  nextFrom(i, f = (p) => !p.out) { const n = this.players.length; for (let k = 1; k <= n; k++) { const p = this.players[(i + k) % n]; if (f(p)) return p; } return null; }
  toCall(p) { return Math.max(0, (this.cur || 0) - p.bet); }

  put(p, amount) {
    const a = Math.min(amount, p.stack);
    p.stack -= a; p.bet += a; p.total += a;
    if (p.stack === 0) p.allIn = true;
    return a;
  }

  async playHand(tok) {
    const ok = () => !this.dead && tok === this.tok;
    const W = (ms) => this.wait(ms);
    this.handNo++;
    this.pot = 0; this.board = []; this.cur = 0;
    for (const p of this.players) Object.assign(p, { cards: [], folded: p.out, allIn: false, bet: 0, total: 0 });
    this.qa('.pkx-cards').forEach((e) => { e.innerHTML = ''; });
    this.qa('.pkx-hn').forEach((e) => { e.textContent = ''; e.className = 'pkx-hn'; });
    this.qa('.pkx-seat').forEach((e) => e.classList.remove('win', 'lose', 'turn', 'shown'));
    this.qa('.pkx-slot').forEach((e) => { e.innerHTML = ''; });
    this.q('.pkx-hand').textContent = '';
    // button and blinds (heads-up: the button posts the small blind)
    this.dealer = this.nextFrom(this.dealer).i;
    const D = this.players[this.dealer], heads = this.players.filter((p) => !p.out).length === 2;
    const SB = heads ? D : this.nextFrom(D.i), BB = this.nextFrom(SB.i);
    this.put(SB, this.sb()); this.put(BB, this.bb());
    this.cur = this.bb(); this.minRaise = this.bb();
    this.paintSeats();
    this.say(SB, `Petite blinde ${fmtC(SB.bet)}`); this.say(BB, `Grosse blinde ${fmtC(BB.bet)}`);
    this.msg(`Main n°${this.handNo} : ${D.human ? 'tu as' : `${D.name} a`} le bouton.`);
    // two private cards each, one at a time, starting left of the button
    const deck = newDeck();
    for (let r = 0; r < 2; r++) {
      let p = SB;
      do {
        const c = deck.pop(); p.cards.push(c);
        const node = this.cardNode(c, p.human, p.human ? 'big' : 'mini');
        this.seat(p).querySelector('.pkx-cards').appendChild(node);
        this.fly(node, this.turbo ? 160 : 300);
        sfx.click();
        await sleep(this.turbo ? 50 : 100);
        p = this.nextFrom(p.i);
      } while (p !== SB);
    }
    if (!ok()) return;
    this.paintHand();
    await W(300);
    for (let st = 0; st < 4; st++) {
      if (st > 0) {
        await this.collect();
        const n = st === 1 ? 3 : 1;
        deck.pop(); // burn
        for (let k = 0; k < n; k++) {
          const c = deck.pop(); this.board.push(c);
          const node = this.cardNode(c, false, 'board');
          this.qa('.pkx-slot')[this.board.length - 1].appendChild(node);
          this.fly(node, this.turbo ? 160 : 300);
          await sleep(this.turbo ? 160 : 300);
          this.flip(node, c);
          sfx.click();
          await sleep(this.turbo ? 80 : 160);
        }
        this.msg(`${STREETS[st]} : ${this.board.map((c) => RANK(c) + c.s).join(' ')}`);
        this.paintHand();
        if (!ok()) return;
        await W(350);
        this.cur = 0; this.minRaise = this.bb();
      }
      if (this.live().length > 1) await this.betting(st, st === 0 ? this.nextFrom(BB.i) : this.nextFrom(D.i), ok);
      if (!ok()) return;
      if (this.live().length === 1) break;
    }
    if (!ok()) return;
    await this.collect();
    await this.showdown(ok);
  }

  async betting(st, first, ok) {
    const acted = new Set();
    let p = first;
    for (let guard = 0; guard < 300; guard++) {
      if (!ok()) return;
      const live = this.live();
      if (live.length <= 1) return;
      const can = live.filter((x) => !x.allIn);
      if (can.every((x) => acted.has(x) && x.bet === this.cur)) return;
      if (can.length <= 1 && can.every((x) => x.bet >= this.cur)) return;
      if (!p.folded && !p.out && !p.allIn && !(acted.has(p) && p.bet === this.cur)) {
        this.qa('.pkx-seat').forEach((e) => e.classList.remove('turn'));
        const s = this.seat(p);
        if (p.human) s.style.setProperty('--think', '20000ms');
        s.classList.add('turn');
        const act = p.human ? await this.humanAct(p) : await this.botAct(p, st);
        if (!ok()) return;
        s.classList.remove('turn');
        this.apply(p, act, acted);
        await this.wait(p.human ? 150 : 320);
      }
      p = this.nextFrom(p.i);
    }
  }

  apply(p, act, acted) {
    const tc = this.toCall(p), who = p.human ? 'Tu' : p.name;
    let text, cls = '';
    if (act.a === 'fold') { p.folded = true; text = 'Couché'; cls = 'fold'; this.msg(`${who} ${p.human ? 'te couches' : 'se couche'}.`); this.seat(p).querySelectorAll('.pkx-card').forEach((c) => c.classList.add('dead')); }
    else if (act.a === 'check' || (act.a === 'call' && !tc)) { text = 'Parole'; cls = 'check'; this.msg(`${who} ${p.human ? 'checkes' : 'checke'}.`); sfx.tick?.(); }
    else if (act.a === 'call') { const a = this.put(p, tc); text = p.allIn ? 'Tapis !' : `Suit ${fmtC(a)}`; cls = p.allIn ? 'allin' : 'call'; this.msg(`${who} ${p.human ? 'suis' : 'suit'} ${fmtC(a)}.`); sfx.coin(); }
    else {
      const to = Math.min(Math.max(act.to, this.cur + this.minRaise), p.bet + p.stack);
      const before = this.cur;
      this.put(p, to - p.bet);
      if (p.bet > before) { const inc = p.bet - before; if (inc >= this.minRaise) this.minRaise = inc; this.cur = p.bet; acted.clear(); }
      text = p.allIn ? 'Tapis !' : before ? `Relance ${fmtC(p.bet)}` : `Mise ${fmtC(p.bet)}`;
      cls = p.allIn ? 'allin' : 'raise';
      this.msg(p.allIn ? `${who} ${p.human ? 'fais' : 'fait'} tapis : ${fmtC(p.total)} au total !` : before ? `${who} ${p.human ? 'relances' : 'relance'} à ${fmtC(p.bet)}.` : `${who} ${p.human ? 'mises' : 'mise'} ${fmtC(p.bet)}.`);
      sfx.coin();
    }
    acted.add(p);
    this.say(p, text, cls);
    this.paintSeats();
    if (p.human) this.paintHand();
  }

  /* ---------- the player ---------- */
  raiseBounds(p) {
    const max = p.bet + p.stack, min = Math.min(max, this.cur ? this.cur + this.minRaise : this.bb());
    return { min, max };
  }
  potNow() { return this.pot + this.players.reduce((a, x) => a + x.bet, 0); }

  humanAct(p) {
    const tc = this.toCall(p), { min, max } = this.raiseBounds(p);
    const canRaise = p.stack > tc && this.live().some((x) => x !== p && !x.allIn);
    this.canRaiseNow = canRaise;
    this.qa('[data-pa], [data-pq], .pkx-range').forEach((b) => { b.disabled = false; });
    this.q('[data-pa="raise"]').disabled = !canRaise;
    this.qa('[data-pq]').forEach((b) => { b.disabled = !canRaise; });
    this.q('.pkx-range').disabled = !canRaise;
    this.q('.pkx-amt').classList.remove('wait');
    const cb = this.q('[data-pa="call"]');
    cb.querySelector('b').textContent = tc ? (tc >= p.stack ? 'TAPIS' : 'SUIVRE') : 'PAROLE';
    cb.querySelector('small').textContent = tc ? fmtC(Math.min(tc, p.stack)) : '';
    this.q('[data-pa="fold"] small').textContent = '';
    this.raiseTo = min;
    this.anchors = this.makeAnchors(min, max);
    const pr = new Promise((res) => { this.humanRes = res; });
    this.paintRaise(true);
    this.msg(tc ? `À toi : ${fmtC(Math.min(tc, p.stack))} à suivre.` : 'À toi de parler.');
    sfx.tick?.();
    navigator.vibrate?.(20);
    this.paintTop();
    return pr;
  }

  // the slider (computer): evenly spaced stops Min, ½ pot, ⅔ pot, pot, 2× pot, Tapis, straight lines in between
  makeAnchors(min, max) {
    const pot = this.potNow(), tc = this.toCall(this.me), base = this.cur;
    const val = (k) => this.snap(base + (pot + tc) * k);
    const raw = [['Min', min], ['½ pot', val(0.5)], ['⅔ pot', val(0.667)], ['Pot', val(1)], ['2× pot', val(2)], ['Tapis', max]];
    const out = [];
    for (const [l, v] of raw) { const x = Math.max(min, Math.min(max, v)); if (!out.length || x > out[out.length - 1][1]) out.push([l, x]); else if (l === 'Tapis') out[out.length - 1] = [l, x]; }
    if (out.length === 1) out.push(['Tapis', max]);
    return out;
  }
  snap(v) { return Math.round(v / this.sb()) * this.sb(); }
  fromSlider(t) {
    const A = this.anchors; if (!A || A.length < 2) return this.raiseTo;
    const f = (t / 1000) * (A.length - 1), i = Math.min(A.length - 2, Math.floor(f)), k = f - i;
    let v = A[i][1] + (A[i + 1][1] - A[i][1]) * k;
    v = t >= 1000 ? A[A.length - 1][1] : this.snap(v);
    return Math.max(A[0][1], Math.min(A[A.length - 1][1], v));
  }
  toSlider(v) {
    const A = this.anchors; if (!A || A.length < 2) return 0;
    for (let i = 0; i < A.length - 1; i++) if (v <= A[i + 1][1]) return Math.round(((i + (v - A[i][1]) / Math.max(1, A[i + 1][1] - A[i][1])) / (A.length - 1)) * 1000);
    return 1000;
  }

  quickRaise(k) {
    const p = this.me;
    if (!this.humanRes || !this.canRaiseNow) return;
    const { min, max } = this.raiseBounds(p);
    const pot = this.potNow(), tc = this.toCall(p), step = this.bb();
    let v = this.raiseTo;
    if (k === '+') v += step;
    else if (k === '-') v -= step;
    else if (k === 'all') v = max;
    else if (k === 'p25' || k === 'p50') v += (pot + tc) * (k === 'p25' ? 0.25 : 0.5);
    else if (k[0] === 'x') v = Math.max(this.cur, this.bb()) * +k.slice(1);
    else v = this.cur + (pot + tc) * +k;
    v = k === 'all' ? max : this.snap(v);
    this.raiseTo = Math.max(min, Math.min(max, v));
    sfx.click();
    this.paintRaise(true);
  }

  paintRaise(moveSlider) {
    const p = this.me; if (!p || !this.humanRes) return;
    const v = this.raiseTo, all = v >= p.bet + p.stack;
    this.q('.pkx-amt b').textContent = fmtC(v);
    this.q('.pkx-amt2 b').textContent = fmtC(v);
    const rb = this.q('[data-pa="raise"]');
    rb.querySelector('b').textContent = all ? 'TAPIS' : this.cur ? 'RELANCER' : 'MISER';
    rb.querySelector('small').textContent = this.canRaiseNow ? fmtC(all ? p.bet + p.stack : v) : '';
    rb.classList.toggle('allin', all);
    const rg = this.q('.pkx-range');
    if (moveSlider) rg.value = this.toSlider(v);
    rg.style.setProperty('--fill', `${+rg.value / 10}%`);
    const A = this.anchors || [];
    const key = A.map((a) => a[1]).join();
    const tk = this.q('.pkx-ticks');
    if (tk.dataset.k !== key) { tk.dataset.k = key; tk.innerHTML = A.map((a, i) => `<button type="button" data-tv="${a[1]}" style="left:${(i / Math.max(1, A.length - 1)) * 100}%"><i></i>${a[0]}</button>`).join(''); tk.querySelectorAll('button').forEach((b) => { b.onclick = () => { if (!this.humanRes) return; this.raiseTo = +b.dataset.tv; sfx.click(); this.paintRaise(true); }; }); }
    const base = Math.max(this.cur, this.bb()), max = p.bet + p.stack;
    this.qa('.pkx-quick.pkx-qpc [data-pq^="x"]').forEach((b) => { const x = Math.min(max, this.snap(base * +b.dataset.pq.slice(1))); b.querySelector('small').textContent = fmtC(x); b.disabled = !this.canRaiseNow || x < this.raiseBounds(p).min; });
    this.qa('.pkx-quick .all small').forEach((s) => { s.textContent = fmtC(max); });
  }

  /* ---------- the bots ---------- */
  async botAct(p, st) {
    const seat = this.seat(p);
    const ms = 650 + Math.random() * 800;
    seat.style.setProperty('--think', `${Math.round(ms * (this.turbo ? 0.45 : 1))}ms`);
    seat.classList.add('think');
    await this.wait(ms);
    seat.classList.remove('think');
    return this.decide(p, st);
  }

  // Hand strength (Monte Carlo equity against the players still in) + the bot's profile + a little noise.
  decide(p, st) {
    const opp = this.live().length - 1, eq = equity(p.cards, this.board, Math.max(1, opp), opp > 5 ? 110 : opp > 3 ? 150 : 220);
    const e = eq + (Math.random() - 0.5) * (0.08 + (p.wild || 0)) - p.tight;
    const tc = this.toCall(p), pot = this.pot + this.players.reduce((a, x) => a + x.bet, 0);
    const odds = tc / (pot + tc), fair = 1 / (opp + 1), r = Math.random();
    const strong = e > Math.max(0.5, fair * 1.9), monster = e > Math.max(0.72, fair * 2.7);
    const { min, max } = this.raiseBounds(p);
    const canRaise = p.stack > tc && this.live().some((x) => x !== p && !x.allIn);
    const size = (k) => {
      let to = st === 0 && this.cur <= this.bb() ? this.bb() * (2.5 + Math.random() * 1.5) : this.cur + (pot + tc) * k;
      if (st === 0 && this.cur > this.bb()) to = this.cur * (2.5 + Math.random());
      to = Math.round(to / this.sb()) * this.sb();
      to = Math.max(min, Math.min(max, to));
      if (to > max * 0.7 || (monster && p.stack < this.bb() * 12)) to = max;
      return { a: 'raise', to };
    };
    if (!tc) {
      if (canRaise && (monster || (strong && r < 0.3 + p.agg * 0.5) || (st > 0 && r < p.bluff))) return size(monster ? 0.6 + Math.random() * 0.5 : 0.45 + Math.random() * 0.4);
      return { a: 'check' };
    }
    if (canRaise && monster && r < 0.35 + p.agg * 0.5) return size(0.7 + Math.random() * 0.6);
    if (e >= odds * 1.05 + 0.02 || (p.station && e >= odds * 0.7)) {
      if (canRaise && strong && r < p.agg * 0.4) return size(0.6 + Math.random() * 0.4);
      return { a: 'call' };
    }
    if (canRaise && r < p.bluff * 0.4 && tc < pot * 0.6) return size(0.6 + Math.random() * 0.4);
    if (tc <= this.bb() && e > fair * 0.8) return { a: 'call' };
    return { a: 'fold' };
  }


  /* ---------- showdown ---------- */
  async showdown(ok) {
    this.qa('.pkx-seat').forEach((e) => e.classList.remove('turn'));
    const live = this.live();
    const lines = [];
    if (live.length === 1) {
      const w = live[0], amt = this.pot;
      w.stack += amt;
      this.chipsTo(w, amt);
      lines.push(`${w.human ? 'Tu remportes' : `${w.name} remporte`} ${fmtC(amt)}${w.human ? '' : ' (tout le monde s’est couché)'}.`);
      this.seat(w).classList.add('win');
      if (w.human) { this.setLast(amt); sfx.win(); }
    } else {
      // reveal the bots' cards, one hand after the other
      for (const p of live) {
        if (!p.human) { this.seat(p).classList.add('shown'); this.seat(p).querySelectorAll('.pkx-card').forEach((n, k) => this.flip(n, p.cards[k])); await this.wait(320); }
        p.hand = eval7(p.cards.concat(this.board));
        const hn = this.seat(p).querySelector('.pkx-hn'); hn.textContent = handName(p.hand); hn.className = 'pkx-hn on';
      }
      await this.wait(700);
      if (!ok()) return;
      const pots = buildPots(this.players);
      const winners = new Set();
      pots.forEach((pt, k) => {
        const best = Math.max(...pt.elig.map((p) => p.hand.score));
        const ws = pt.elig.filter((p) => p.hand.score === best);
        if (pt.elig.length === 1) { ws[0].stack += pt.amount; this.chipsTo(ws[0], pt.amount); if (k) lines.push(`${ws[0].human ? 'Ta mise non suivie t’est rendue' : `Mise non suivie rendue à ${ws[0].name}`} (${fmtC(pt.amount)}).`); return; }
        const share = Math.floor(pt.amount / ws.length), rest = pt.amount - share * ws.length;
        ws.forEach((w, j) => { const a = share + (j === 0 ? rest : 0); w.stack += a; this.chipsTo(w, a); winners.add(w); if (w.human) this.setLast(a); });
        const label = pots.length > 1 ? (k === 0 ? 'Pot principal' : `Pot secondaire ${k}`) : 'Pot';
        lines.push(`${label} ${fmtC(pt.amount)} : ${ws.map((w) => (w.human ? 'toi' : w.name)).join(' et ')}${ws.length > 1 ? ' (partagé)' : ''} avec ${handName(ws[0].hand)}`);
      });
      live.forEach((p) => this.seat(p).classList.add(winners.has(p) ? 'win' : 'lose'));
      if (winners.has(this.me)) { sfx.win(); const c = center(this.seat(this.me).querySelector('.pkx-av')); fx.burst(c.x, c.y, 30, ['#fde047', '#f5c542', '#fff'], 7); }
    }
    this.pot = 0;
    this.players.forEach((p) => { p.allIn = false; });
    this.msg(lines.join(' · '));
    this.paintSeats();
    this.q('.pkx-pot b').textContent = fmtC(0);
  }

  info() {
    return this.rules(`<h4>Déroulement</h4><ul class="rules"><li>Choisis 1 à 8 adversaires (table de 9 places), les blindes et ton tapis de départ (le même pour tout le monde), puis assieds-toi.</li><li>Le bouton du donneur (D) tourne à chaque main : le joueur à sa gauche paie la <b>petite blinde</b>, le suivant la <b>grosse blinde</b> (à deux joueurs, le donneur paie la petite blinde).</li><li>Chacun reçoit 2 cartes cachées. Quatre tours d’enchères : <b>pré-flop</b>, <b>flop</b> (3 cartes communes), <b>turn</b> (4e carte) et <b>river</b> (5e carte).</li><li>À ton tour : <b>Coucher</b>, <b>Parole</b> (checker), <b>Suivre</b> ou <b>Miser / Relancer</b>. Règle le montant avec − et +, les raccourcis ½ pot, ⅔ pot, Pot, ×2, ×3, ×4 la mise, +25 % / +50 % du pot, le curseur, ou <b>Tapis</b>. No limit : tu peux miser tout ton tapis.</li><li>Au <b>showdown</b>, les cartes des adversaires encore en jeu sont retournées : la meilleure main de 5 cartes (parmi tes 2 cartes et les 5 communes) gagne. Égalité = pot partagé, avec pots secondaires si quelqu’un est à tapis.</li><li>Sur ordinateur : <b>F</b> coucher, <b>C</b> parole / suivre, <b>R</b> ou Entrée relancer, <b>↑ ↓</b> le montant, <b>A</b> tapis, <b>Espace</b> main suivante.</li></ul>
      <h4>Valeur des mains (de la plus forte à la plus faible)</h4><p>Quinte flush · Carré · Full · Couleur · Quinte · Brelan · Double paire · Paire · Carte haute.</p>
      <h4>Les adversaires</h4><p>Ils jouent selon la force réelle de leur main (calculée à chaque décision) et leur caractère : Big Ben et Le Prof sont prudents, Lola et Rocky agressifs, Renard bluffe, Mamie Jo suit beaucoup, Tex joue solide, Mimi s’amuse et Ace est imprévisible.</p>
      <h4>Jetons</h4><p>Ton tapis est pris sur ton solde quand tu t’assieds et rendu (avec tes gains) quand tu quittes la table ou que tu élimines tous les adversaires. <b>Recave</b> (menu ☰ ou bouton du haut) : entre deux mains, ou quand tu es couché, remets ton tapis au niveau du tapis de départ. Si tu quittes en pleine main, les jetons déjà misés sont perdus, comme si tu te couchais.</p>`);
  }
}

return { PokerGame };
})();
