// SpinBet Casino · TicketGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/ticket.js ----
__mods['games/impl/ticket.js'] = (() => {
// Le Ticket: scratch cards sold by 5. Each ticket hides 9 amounts; 3 identical amounts win that amount.
// Amounts are multiples of the ticket price (the bet), so the prizes follow the stake. The outcome of each
// ticket is drawn from PRIZES (return ≈ 95 %), then a grid is built to show it.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
const PACK = 5;
// [multiplier of the ticket price, probability]
const PRIZES = [[1, 0.12], [2, 0.095], [5, 0.05], [10, 0.018], [20, 0.0055], [50, 0.0012], [100, 0.0002], [500, 0.00002], [1000, 0.00001]];
const VALUES = PRIZES.map((p) => p[0]);
const RTP = PRIZES.reduce((a, [m, p]) => a + m * p, 0);
function drawPrize() {
  let r = Math.random();
  for (const [m, p] of PRIZES) { if (r < p) return m; r -= p; }
  return 0;
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// 9 cells: the prize 3 times (if any), every other amount at most twice.
function makeTicket() {
  const prize = drawPrize(), cells = prize ? [prize, prize, prize] : [];
  const pool = shuffle(VALUES.filter((v) => v !== prize).flatMap((v) => [v, v]));
  // small amounts show up more often, like real tickets
  const key = new Map(pool.map((v, i) => [i, Math.random() * (1 + Math.log10(v))]));
  const order = pool.map((v, i) => i).sort((a, b) => key.get(a) - key.get(b));
  const sorted = order.map((i) => pool[i]); pool.length = 0; pool.push(...sorted);
  while (cells.length < 9) cells.push(pool.shift());
  return { prize, cells: shuffle(cells) };
}
/* ===END ENGINE */

const xm = (m) => m.toLocaleString('fr-FR');
const tier = (m) => (m >= 100 ? 4 : m >= 20 ? 3 : m >= 5 ? 2 : 1);
const COIN = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="17" r="13" fill="rgba(0,0,0,.25)"/><circle cx="16" cy="15" r="13" fill="var(--t0)" stroke="var(--t2)" stroke-width="2"/><circle cx="16" cy="15" r="9" fill="none" stroke="var(--t1)" stroke-width="1.5" stroke-dasharray="2 2"/><path d="M12 9v12M12 15l6-6M13.5 14l5 7" stroke="var(--t2)" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>';
const serial = () => `N° ${Math.floor(Math.random() * 9e5 + 1e5)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;

class TicketGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.ticket, autoplay: false, mainLabel: 'ACHETER 5 TICKETS', betLabel: 'Prix du ticket',
      cls: 'table-game ticket',
      head: '<div class="head-meters"><div class="meter tk-left"><small>À gratter</small><b>0 / 5</b></div><div class="meter tk-won"><small>Gagné</small><b>0,00\u00a0\uE1E0</b></div><div class="meter tk-res"><small>Bilan</small><b>—</b></div></div>',
      stage: `<div class="tk-wrap">
          <div class="tk-tabs">${Array.from({ length: PACK }, (_, i) => `<button type="button" class="tk-tab" data-tab="${i}" disabled><i>${i + 1}</i><span>Ticket</span></button>`).join('')}</div>
          <div class="tk-card">
            <div class="tk-head"><div class="tk-logo"><small>LE</small><b>TICKET</b></div><div class="tk-jack"><small>JUSQU’À</small><b class="tk-max"></b></div></div>
            <div class="tk-rule">Trouve <b>3 montants identiques</b> et gagne ce montant !</div>
            <div class="tk-zone"><div class="tk-grid">${Array.from({ length: 9 }, () => `<div class="tk-cell">${COIN}<b></b></div>`).join('')}</div><canvas class="tk-foil"></canvas><div class="tk-stamp"></div></div>
            <div class="tk-foot"><span class="tk-serial">${serial()}</span><span class="tk-say">Achète 5 tickets puis gratte-les du doigt ou à la souris.</span><button type="button" class="tk-all" disabled>Tout révéler</button></div>
          </div>
        </div>`,
      hello: 'Gratte tes tickets : 3 montants identiques et c’est gagné !',
    });
    this.tickets = []; this.cur = 0; this.playing = false;
    this.foil = this.q('.tk-foil'); this.ctx = this.foil.getContext('2d', { willReadFrequently: true });
    this.root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]'); if (t && !t.disabled && +t.dataset.tab !== this.cur) this.show(+t.dataset.tab);
      if (e.target.closest('.tk-all')) this.revealAll();
    });
    this.bindScratch();
    this.paintIdle();
    // the foil follows the ticket's size, keeping what was already scratched
    this.ro = new ResizeObserver(() => this.refit());
    this.ro.observe(this.q('.tk-zone'));
  }

  destroy() { this.ro?.disconnect(); super.destroy(); }
  say(t) { this.q('.tk-say').innerHTML = t; }

  fillCells(cells, done, prize) {
    this.qa('.tk-cell').forEach((cell, k) => {
      const m = cells[k];
      cell.querySelector('b').textContent = fmtC(this.bet * m);
      cell.className = `tk-cell t${tier(m)}${done && prize && m === prize ? ' win' : ''}${done && prize && m !== prize ? ' dim' : ''}`;
    });
  }

  paintIdle() {
    this.q('.tk-max').textContent = fmtC(this.bet * 1000);
    if (!this.tickets.length) { this.fillCells([1, 2, 5, 10, 20, 50, 100, 500, 1000], false); this.drawFoil(); }
  }

  onBetChange() { if (!this.playing) this.paintIdle(); }
  onMeters() {
    if (!this.mainBtn) return;
    const lab = this.mainBtn.querySelector('.main-label');
    lab.textContent = this.playing ? 'RÉVÉLER CE TICKET' : `ACHETER 5 TICKETS · ${fmtC(this.bet * PACK)}`;
    this.mainBtn.disabled = this.playing && !!this.tickets[this.cur]?.done;
    this.q('[data-act="bet-"]').disabled = this.playing || this.bi === 0;
    this.q('[data-act="bet+"]').disabled = this.playing || this.bi === this.cfg.bets.length - 1;
    if (!this.playing && this.q('.tk-max')) this.q('.tk-max').textContent = fmtC(this.bet * 1000);
  }

  /* ---------- scratching ---------- */
  drawFoil() {
    const z = this.q('.tk-zone').getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (!z.width) return;
    const c = this.foil, x = this.ctx, W = z.width, H = z.height;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    this.fw = W; this.fh = H;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.globalCompositeOperation = 'source-over';
    // holographic silver-gold foil
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#d9dde4'); g.addColorStop(0.25, '#a8afba'); g.addColorStop(0.45, '#f4f1e6'); g.addColorStop(0.6, '#c9b77a'); g.addColorStop(0.8, '#aab1bd'); g.addColorStop(1, '#e5e7eb');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalAlpha = 0.18; x.strokeStyle = '#fff'; x.lineWidth = 10;
    for (let k = -H; k < W; k += 34) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + H, H); x.stroke(); }
    x.globalAlpha = 1;
    // little coin pattern
    x.fillStyle = 'rgba(90,96,110,.22)';
    for (let yy = 14; yy < H; yy += 30) for (let xx = (yy / 30) % 2 ? 14 : 29; xx < W; xx += 30) { x.beginPath(); x.arc(xx, yy, 5, 0, Math.PI * 2); x.fill(); }
    // centre badge
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.2;
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.roundRect?.(cx - W * 0.36, cy - r * 0.62, W * 0.72, r * 1.24, r * 0.6); x.fill();
    x.fillStyle = '#4a044e'; x.font = `900 ${Math.max(15, W / 15)}px Orbitron, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('GRATTEZ ICI', cx, cy - r * 0.12);
    x.fillStyle = '#7c2d12'; x.font = `800 ${Math.max(10, W / 34)}px Inter, sans-serif`;
    x.fillText('3 montants identiques = gagné', cx, cy + r * 0.36);
    c.style.transition = 'none'; c.style.opacity = '1'; c.style.pointerEvents = '';
    this.strokes = 0;
  }

  // Redraws the foil at the new size and puts back what was scratched (scaled).
  refit() {
    const t = this.tickets[this.cur], z = this.q('.tk-zone').getBoundingClientRect();
    if (!z.width || (Math.abs(z.width - (this.fw || 0)) < 1 && Math.abs(z.height - (this.fh || 0)) < 1)) return;
    if (t?.done) return;
    const old = document.createElement('canvas'); old.width = this.foil.width; old.height = this.foil.height;
    const had = this.strokes > 0 && old.width;
    if (had) old.getContext('2d').drawImage(this.foil, 0, 0);
    this.drawFoil();
    if (had) {
      const x = this.ctx; x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-in';
      x.drawImage(old, 0, 0, this.foil.width, this.foil.height); x.restore(); this.strokes = 1;
    }
  }

  bindScratch() {
    const c = this.foil;
    let down = false, last = null;
    const pt = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, cx: e.clientX, cy: e.clientY }; };
    const scratch = (p) => {
      const t = this.tickets[this.cur];
      if (!this.playing || !t || t.done) return;
      const x = this.ctx, r = Math.max(16, this.fw / 15);
      x.globalCompositeOperation = 'destination-out';
      x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = r * 2;
      x.beginPath(); x.moveTo((last || p).x, (last || p).y); x.lineTo(p.x, p.y); x.stroke();
      last = p;
      if (++this.strokes % 4 === 0) fx.burst(p.cx, p.cy, 3, ['#d1d5db', '#9ca3af', '#e5c76b'], 3);
      if (this.strokes % 7 === 0) { sfx.tick?.(); this.check(); }
    };
    c.addEventListener('pointerdown', (e) => { if (!this.playing) return; e.preventDefault(); down = true; last = null; c.setPointerCapture?.(e.pointerId); scratch(pt(e)); });
    c.addEventListener('pointermove', (e) => { if (down) scratch(pt(e)); });
    const up = () => { if (down) { down = false; last = null; this.check(); } };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }

  // Reveals the ticket once most of the foil is gone.
  check() {
    const c = this.foil; if (!c.width) return;
    const d = this.ctx.getImageData(0, 0, c.width, c.height).data;
    let clear = 0, n = 0;
    for (let i = 3; i < d.length; i += 4 * 37) { n++; if (d[i] < 40) clear++; }
    if (clear / n > 0.55) this.reveal(this.cur);
  }

  /* ---------- tickets ---------- */
  stamp(t) {
    const s = this.q('.tk-stamp');
    s.className = 'tk-stamp' + (t?.done ? (t.prize ? ' won show' : ' lost show') : '');
    s.innerHTML = t?.done ? (t.prize ? `<small>GAGNÉ</small><b>+${fmtC(this.bet * t.prize)}</b>` : '<b>PERDU</b>') : '';
  }

  show(i) {
    // keep what was scratched on the ticket we leave
    const prev = this.tickets[this.cur];
    if (prev && !prev.done && this.cur !== i && this.strokes) { prev.snap = this.ctx.getImageData(0, 0, this.foil.width, this.foil.height); }
    this.cur = i;
    const t = this.tickets[i];
    this.qa('.tk-tab').forEach((b, k) => b.classList.toggle('on', k === i));
    this.fillCells(t.cells, t.done, t.prize);
    this.q('.tk-serial').textContent = t.serial;
    this.stamp(t);
    if (t.done) { this.foil.style.opacity = '0'; this.foil.style.pointerEvents = 'none'; } else {
      this.drawFoil();
      if (t.snap && t.snap.width === this.foil.width && t.snap.height === this.foil.height) { this.ctx.putImageData(t.snap, 0, 0); this.strokes = 1; }
    }
    this.q('.tk-card').animate([{ transform: 'translateX(24px) rotate(1deg)', opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.3,1.3,.5,1)' });
    this.say(t.done ? (t.prize ? `Ticket ${i + 1} : gagné <b>${fmtC(this.bet * t.prize)}</b>` : `Ticket ${i + 1} : perdu`) : `Ticket ${i + 1} sur 5 : gratte !`);
    this.updateMeters();
  }

  reveal(i) {
    const t = this.tickets[i];
    if (!this.playing || !t || t.done) return;
    t.done = true; t.snap = null;
    if (i === this.cur) {
      this.foil.style.transition = 'opacity .4s'; this.foil.style.opacity = '0'; this.foil.style.pointerEvents = 'none';
      this.fillCells(t.cells, true, t.prize);
      this.stamp(t);
    }
    const tab = this.q(`[data-tab="${i}"]`);
    tab.classList.add(t.prize ? 'won' : 'lost');
    tab.querySelector('span').textContent = t.prize ? `+${fmtC(this.bet * t.prize)}` : 'Perdu';
    if (t.prize) {
      const amt = this.bet * t.prize;
      this.won += amt;
      this.win(amt);
      if (i === this.cur) {
        const p = center(this.q('.tk-zone'));
        fx.burst(p.x, p.y, 20 + Math.min(60, t.prize * 2), ['#fde047', '#fbbf24', '#fff', '#22c55e'], 7);
        fx.floatText(p.x, p.y - 40, `+${fmtC(amt)}`, '#fde047', 26);
        this.say(`Ticket ${i + 1} : 3 × ${fmtC(amt)}, <b>gagné !</b>`);
      }
      sfx.win();
    } else if (i === this.cur) { sfx.click(); this.say(`Ticket ${i + 1} : pas de chance…`); }
    this.left--;
    this.meters();
    this.updateMeters();
    if (!this.left) return this.finish();
    if (i === this.cur) {
      const nx = this.tickets.findIndex((x) => !x.done);
      setTimeout(() => { if (!this.dead && this.playing && this.cur === i) this.show(nx); }, this.turbo ? 700 : 1500);
    }
  }

  revealAll() {
    if (!this.playing) return;
    this.tickets.forEach((t, i) => { if (!t.done && i !== this.cur) this.reveal(i); });
    this.reveal(this.cur);
  }

  meters() {
    this.q('.tk-left b').textContent = `${this.left} / ${PACK}`;
    this.q('.tk-won b').textContent = fmtC(this.won);
    const res = this.q('.tk-res b'), d = this.won - this.paid;
    res.textContent = this.tickets.length ? `${d >= 0 ? '+' : '−'}${fmtC(Math.abs(d))}` : '—';
    res.parentElement.classList.toggle('pos', d >= 0); res.parentElement.classList.toggle('neg', d < 0);
    this.q('.tk-all').disabled = !this.playing;
  }

  onMain() {
    if (this.playing) return this.reveal(this.cur);
    const cost = this.bet * PACK;
    if (!this.pay(cost)) return;
    this.lastStake = cost;
    this.paid = cost; this.won = 0; this.left = PACK;
    this.tickets = Array.from({ length: PACK }, () => ({ ...makeTicket(), serial: serial() }));
    this.playing = true; this.cur = 0;
    this.setLast(0); this.winAmt.textContent = '';
    this.slotEl.classList.remove('tk-profit', 'tk-loss');
    this.qa('.tk-tab').forEach((b) => { b.disabled = false; b.classList.remove('won', 'lost'); b.querySelector('span').textContent = 'À gratter'; });
    sfx.spin();
    this.msg(`5 tickets à ${fmtC(this.bet)} · total ${fmtC(cost)}`);
    this.meters();
    this.show(0);
    // on phones the ticket is above the controls: bring it into view
    const r = this.q('.tk-tabs').getBoundingClientRect(), b = this.q('.tk-card').getBoundingClientRect();
    if (r.top < 70 || b.bottom > innerHeight - 70) scrollBy({ top: r.top - 80, behavior: 'smooth' });
  }

  finish() {
    this.playing = false;
    const d = this.won - this.paid;
    this.setLast(this.won);
    this.slotEl.classList.add(d >= 0 ? 'tk-profit' : 'tk-loss');
    this.msg(d > 0 ? `💰 Rentable ! +${fmtC(d)} sur tes 5 tickets` : d === 0 ? 'Remboursé : tu récupères ta mise' : `Pas rentable cette fois : ${fmtC(this.won)} gagnés pour ${fmtC(this.paid)}`);
    this.meters();
    this.updateMeters();
    if (this.won > 0) setTimeout(() => this.celebrate(this.won, { stake: this.paid }), this.turbo ? 300 : 900);
  }

  info() {
    const rows = PRIZES.map(([m, p]) => `${fmtC(this.bet * m)} (×${xm(m)}) : 1 ticket sur ${xm(Math.round(1 / p))}`).join('<br>');
    return this.rules(`<h4>Comment jouer</h4><p>Choisis le prix du ticket et achète un lot de <b>5 tickets</b>. Gratte chaque ticket du doigt ou à la souris, ou appuie sur « Révéler ce ticket ». Si <b>3 montants identiques</b> apparaissent, tu gagnes ce montant. Tu peux passer d’un ticket à l’autre avec les onglets 1 à 5 sans perdre ce que tu as gratté. À la fin du lot, le bilan te dit si tu es rentable.</p>
      <h4>Gains pour un ticket à ${fmtC(this.bet)}</h4><p>${rows}</p><p>Un ticket sur ${(1 / PRIZES.reduce((a, x) => a + x[1], 0)).toFixed(1).replace('.', ',')} est gagnant. Les montants suivent le prix du ticket.</p>
      <h4>Équité</h4><p>Retour au joueur : ${(RTP * 100).toFixed(0)} %.</p>`);
  }
}

return { TicketGame };
})();
