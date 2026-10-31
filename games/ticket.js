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

class TicketGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.ticket, autoplay: false, mainLabel: 'ACHETER 5 TICKETS', betLabel: 'Prix du ticket',
      cls: 'table-game ticket',
      head: '<div class="head-meters"><div class="meter tk-left"><small>Tickets à gratter</small><b>0 / 5</b></div><div class="meter tk-won"><small>Gagné</small><b>0,00 KE</b></div><div class="meter tk-res"><small>Bilan</small><b>—</b></div></div>',
      stage: `<div class="tk-wrap">
          <div class="tk-tabs">${Array.from({ length: PACK }, (_, i) => `<button type="button" class="tk-tab" data-tab="${i}" disabled><i>${i + 1}</i><span>—</span></button>`).join('')}</div>
          <div class="tk-card">
            <div class="tk-top"><b>LE TICKET</b><span class="tk-max"></span></div>
            <div class="tk-rule">3 montants identiques = tu gagnes ce montant</div>
            <div class="tk-zone"><div class="tk-grid">${Array.from({ length: 9 }, () => '<div class="tk-cell"><b></b></div>').join('')}</div><canvas class="tk-foil"></canvas></div>
            <div class="tk-foot"><span class="tk-say">Achète 5 tickets puis gratte-les du doigt ou à la souris.</span><button type="button" class="tk-all" disabled>GRATTER CE TICKET</button></div>
          </div>
        </div>`,
      hello: 'Gratte tes tickets : 3 montants identiques et c’est gagné !',
    });
    this.tickets = []; this.cur = 0; this.playing = false;
    this.foil = this.q('.tk-foil'); this.ctx = this.foil.getContext('2d', { willReadFrequently: true });
    this.root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]'); if (t && !t.disabled) this.show(+t.dataset.tab);
      if (e.target.closest('.tk-all')) this.reveal(this.cur);
    });
    this.bindScratch();
    this.paintIdle();
    this.ro = new ResizeObserver(() => { if (this.tickets[this.cur] && !this.tickets[this.cur].done) this.drawFoil(); });
    this.ro.observe(this.q('.tk-zone'));
  }

  destroy() { this.ro?.disconnect(); super.destroy(); }
  say(t) { this.q('.tk-say').innerHTML = t; }

  paintIdle() {
    this.q('.tk-max').textContent = `Jusqu’à ${fmtC(this.bet * 1000)}`;
    if (!this.tickets.length) {
      this.qa('.tk-cell b').forEach((b, i) => { b.textContent = fmtC(this.bet * VALUES[[1, 0, 2, 4, 3, 5, 8, 6, 7][i]]); });
      this.drawFoil();
    }
  }

  onBetChange() { if (!this.playing) this.paintIdle(); }
  onMeters() {
    if (!this.mainBtn) return;
    const lab = this.mainBtn.querySelector('.main-label');
    if (this.playing) { lab.textContent = 'TOUT RÉVÉLER'; }
    else lab.textContent = `ACHETER 5 TICKETS · ${fmtC(this.bet * PACK)}`;
    this.q('[data-act="bet-"]').disabled = this.playing || this.bi === 0;
    this.q('[data-act="bet+"]').disabled = this.playing || this.bi === this.cfg.bets.length - 1;
    if (!this.playing && this.q('.tk-max')) this.q('.tk-max').textContent = `Jusqu’à ${fmtC(this.bet * 1000)}`;
  }

  /* ---------- scratching ---------- */
  drawFoil() {
    const z = this.q('.tk-zone').getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (!z.width) return;
    const c = this.foil, x = this.ctx;
    c.width = Math.round(z.width * dpr); c.height = Math.round(z.height * dpr);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.globalCompositeOperation = 'source-over';
    const g = x.createLinearGradient(0, 0, z.width, z.height);
    g.addColorStop(0, '#e5e7eb'); g.addColorStop(0.35, '#9ca3af'); g.addColorStop(0.5, '#f3f4f6'); g.addColorStop(0.7, '#9ca3af'); g.addColorStop(1, '#d1d5db');
    x.fillStyle = g; x.fillRect(0, 0, z.width, z.height);
    x.fillStyle = 'rgba(255,255,255,.18)';
    for (let i = 0; i < 260; i++) x.fillRect(Math.random() * z.width, Math.random() * z.height, 2, 2);
    x.fillStyle = 'rgba(55,65,81,.55)'; x.font = `900 ${Math.max(16, z.width / 14)}px Orbitron, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('GRATTEZ ICI', z.width / 2, z.height / 2);
    x.font = `700 ${Math.max(11, z.width / 30)}px Inter, sans-serif`;
    x.fillText('★ ★ ★', z.width / 2, z.height / 2 + Math.max(22, z.width / 11));
    c.style.opacity = '1'; c.style.pointerEvents = '';
    this.strokes = 0;
  }

  bindScratch() {
    const c = this.foil;
    let down = false, last = null;
    const pt = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const scratch = (p) => {
      const t = this.tickets[this.cur];
      if (!this.playing || !t || t.done) return;
      const x = this.ctx, r = Math.max(16, c.getBoundingClientRect().width / 16);
      x.globalCompositeOperation = 'destination-out';
      x.lineCap = 'round'; x.lineWidth = r * 2;
      x.beginPath(); x.moveTo((last || p).x, (last || p).y); x.lineTo(p.x, p.y); x.stroke();
      last = p;
      if (++this.strokes % 6 === 0) { sfx.tick?.(); this.check(); }
    };
    c.addEventListener('pointerdown', (e) => { if (!this.playing) return; down = true; last = null; c.setPointerCapture(e.pointerId); scratch(pt(e)); });
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
    if (clear / n > 0.6) this.reveal(this.cur);
  }

  /* ---------- tickets ---------- */
  show(i) {
    this.cur = i;
    const t = this.tickets[i];
    this.qa('.tk-tab').forEach((b, k) => b.classList.toggle('on', k === i));
    this.qa('.tk-cell').forEach((cell, k) => {
      cell.querySelector('b').textContent = fmtC(this.bet * t.cells[k]);
      cell.className = 'tk-cell' + (t.done && t.prize && t.cells[k] === t.prize ? ' win' : '');
    });
    this.slotEl.classList.toggle('tk-done', !!t.done);
    if (t.done) { this.foil.style.opacity = '0'; this.foil.style.pointerEvents = 'none'; } else this.drawFoil();
    this.q('.tk-all').disabled = !this.playing || t.done;
    this.q('.tk-card').animate([{ transform: 'translateX(18px)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'ease-out' });
    this.say(t.done ? (t.prize ? `Ticket ${i + 1} : gagné <b>${fmtC(this.bet * t.prize)}</b>` : `Ticket ${i + 1} : perdu`) : `Ticket ${i + 1} : gratte !`);
  }

  reveal(i) {
    const t = this.tickets[i];
    if (!this.playing || !t || t.done) return;
    t.done = true;
    if (i === this.cur) {
      this.foil.style.transition = 'opacity .35s'; this.foil.style.opacity = '0'; this.foil.style.pointerEvents = 'none';
      this.q('.tk-all').disabled = true;
      this.slotEl.classList.add('tk-done');
    }
    const tab = this.q(`[data-tab="${i}"]`);
    tab.classList.add(t.prize ? 'won' : 'lost');
    tab.querySelector('span').textContent = t.prize ? fmtC(this.bet * t.prize) : 'Perdu';
    if (t.prize) {
      const amt = this.bet * t.prize;
      this.won += amt;
      this.win(amt);
      if (i === this.cur) {
        this.qa('.tk-cell').forEach((cell, k) => { if (t.cells[k] === t.prize) cell.classList.add('win'); });
        const p = center(this.q('.tk-zone'));
        fx.burst(p.x, p.y, 20 + Math.min(60, t.prize * 2), ['#fde047', '#fbbf24', '#fff', '#22c55e'], 7);
        fx.floatText(p.x, p.y - 40, `+${fmtC(amt)}`, '#fde047', 26);
      }
      sfx.win();
      this.say(`Ticket ${i + 1} : 3 × ${fmtC(amt)} : <b>gagné !</b>`);
    } else {
      sfx.click();
      if (i === this.cur) this.say(`Ticket ${i + 1} : pas de chance…`);
    }
    this.left--;
    this.meters();
    if (!this.left) return this.finish();
    if (i === this.cur) {
      const nx = this.tickets.findIndex((x) => !x.done);
      setTimeout(() => { if (!this.dead && this.playing && this.cur === i) this.show(nx); }, this.turbo ? 500 : 1200);
    }
  }

  meters() {
    this.q('.tk-left b').textContent = `${this.left} / ${PACK}`;
    this.q('.tk-won b').textContent = fmtC(this.won);
    const res = this.q('.tk-res b'), d = this.won - this.paid;
    res.textContent = this.playing || this.tickets.length ? `${d >= 0 ? '+' : '−'}${fmtC(Math.abs(d))}` : '—';
    res.parentElement.classList.toggle('pos', d >= 0); res.parentElement.classList.toggle('neg', d < 0);
  }

  onMain() {
    if (this.playing) { this.tickets.forEach((t, i) => { if (!t.done && i !== this.cur) this.reveal(i); }); this.reveal(this.cur); return; }
    const cost = this.bet * PACK;
    if (!this.pay(cost)) return;
    this.lastStake = cost;
    this.paid = cost; this.won = 0; this.left = PACK;
    this.tickets = Array.from({ length: PACK }, makeTicket);
    this.playing = true;
    this.setLast(0); this.winAmt.textContent = '';
    this.slotEl.classList.remove('tk-profit', 'tk-loss');
    this.qa('.tk-tab').forEach((b) => { b.disabled = false; b.classList.remove('won', 'lost'); b.querySelector('span').textContent = 'À gratter'; });
    sfx.spin();
    this.msg(`5 tickets à ${fmtC(this.bet)} · total ${fmtC(cost)}`);
    this.meters();
    this.updateMeters();
    this.show(0);
  }

  finish() {
    this.playing = false;
    const d = this.won - this.paid;
    this.setLast(this.won);
    this.slotEl.classList.add(d >= 0 ? 'tk-profit' : 'tk-loss');
    this.msg(d > 0 ? `💰 Rentable ! +${fmtC(d)} sur tes 5 tickets` : d === 0 ? 'Remboursé : tu récupères ta mise' : `Pas rentable cette fois : ${fmtC(this.won)} gagnés pour ${fmtC(this.paid)}`);
    this.q('.tk-all').disabled = true;
    this.meters();
    this.updateMeters();
    if (this.won > 0) setTimeout(() => this.celebrate(this.won, { stake: this.paid }), this.turbo ? 300 : 900);
  }

  info() {
    const rows = PRIZES.map(([m, p]) => `${fmtC(this.bet * m)} (×${xm(m)}) : 1 ticket sur ${xm(Math.round(1 / p))}`).join('<br>');
    return this.rules(`<h4>Comment jouer</h4><p>Choisis le prix du ticket et achète un lot de <b>5 tickets</b>. Gratte chaque ticket du doigt ou à la souris (ou appuie sur « Gratter ce ticket »). Si <b>3 montants identiques</b> apparaissent, tu gagnes ce montant. À la fin du lot, le bilan te dit si tu es rentable.</p>
      <h4>Gains pour un ticket à ${fmtC(this.bet)}</h4><p>${rows}</p><p>Un ticket sur ${(1 / PRIZES.reduce((a, x) => a + x[1], 0)).toFixed(1).replace('.', ',')} est gagnant. Les montants suivent le prix du ticket.</p>
      <h4>Équité</h4><p>Retour au joueur : ${(RTP * 100).toFixed(0)} %.</p>`);
  }
}

return { TicketGame };
})();
