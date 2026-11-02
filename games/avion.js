// SpinBet Casino · AvionGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/avion.js ----
__mods['games/impl/avion.js'] = (() => {
// Avion (crash game), rebuilt on the shared cabinet. Crash distribution and growth curve are the original's.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx } = __mods['fx.js'];

/* ===ENGINE (original) */
const AUTOS = [0, 1.5, 2, 3, 5, 10, 20, 50, 100], MAXM = 1000;
function crashPoint() { const r = Math.random(); let c = Math.floor((100 * 0.95) / (1 - r)) / 100; if (c < 1) c = 1; return Math.min(c, MAXM); }
const growth = (t) => Math.exp(0.1 * t + 0.003 * t * t);
/* ===END ENGINE */

const fm = (x) => '×' + x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

class AvionGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.avion, autoplay: false, mainLabel: 'DÉCOLLER',
      cls: 'table-game avion',
      head: '<div class="hist av-hist"></div>',
      stage: '<div class="av-sky"><canvas class="av-cv"></canvas><div class="av-big">×1,00</div><div class="av-sub"></div><div class="stars"></div></div>',
      below: `<div class="mn-ctl av-ctl"><span>Encaissement auto</span><button class="round-btn" data-auto="-1">−</button><b class="av-auto">Non</b><button class="round-btn" data-auto="1">+</button></div>`,
      hello: 'Choisis ta mise et décolle. Encaisse avant l’explosion !',
    });
    this.ai = this.loadNum('avion_ai', 0, 0, AUTOS.length - 1);
    this.state = 'idle'; this.t = 0; this.m = 1; this.pts = []; this.histArr = []; this.cashed = false;
    this.cv = this.q('.av-cv');
    this.ctx = this.cv.getContext('2d');
    this.big = this.q('.av-big');
    this.q('.stars').innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 37) % 100}%;top:${(i * 53) % 100}%;animation-delay:${-(i % 7)}s"></i>`).join('');
    this.root.addEventListener('click', (e) => { const a = e.target.closest('[data-auto]'); if (a && this.state !== 'fly') { this.ai = Math.max(0, Math.min(AUTOS.length - 1, this.ai + +a.dataset.auto)); this.saveKey('avion_ai', this.ai); this.paint(); } });
    this.onResize = () => this.resize();
    addEventListener('resize', this.onResize);
    this.resize();
    this.paint();
  }

  destroy() { cancelAnimationFrame(this.raf); removeEventListener('resize', this.onResize); super.destroy(); }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = this.cv.clientWidth, H = this.cv.clientHeight;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    this.dpr = dpr;
    this.draw(this.state === 'crash');
  }

  paint() {
    if (!this.big) return;
    this.q('.av-auto').textContent = AUTOS[this.ai] ? fm(AUTOS[this.ai]) : 'Non';
    const fly = this.state === 'fly', lab = this.mainBtn.querySelector('.main-label');
    this.qa('[data-auto]').forEach((b) => { b.disabled = fly; });
    this.q('[data-act="bet-"]').disabled = fly || this.bi === 0;
    this.q('[data-act="bet+"]').disabled = fly || this.bi === this.cfg.bets.length - 1;
    if (fly) {
      if (this.cashed) { lab.textContent = 'ENCAISSÉ'; this.mainBtn.disabled = true; }
      else { lab.textContent = `ENCAISSER ${fmtC(Math.floor(this.stake * this.m))}`; this.mainBtn.disabled = false; }
      this.mainBtn.classList.toggle('cash', !this.cashed);
    } else { lab.textContent = 'DÉCOLLER'; this.mainBtn.disabled = false; this.mainBtn.classList.remove('cash'); }
  }

  onMeters() { this.paint(); }

  draw(boom) {
    const g = this.ctx, W = this.cv.clientWidth, H = this.cv.clientHeight;
    if (!W) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const xmax = Math.max(8, this.t * 1.15), ymax = Math.max(2, this.m * 1.25);
    const X = (tt) => 34 + ((W - 60) * tt) / xmax, Y = (mm) => H - 30 - ((H - 70) * (mm - 1)) / (ymax - 1);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.fillStyle = 'rgba(255,255,255,.45)'; g.font = '600 11px KeCoin, Archivo, sans-serif';
    const step = ymax > 40 ? 10 : ymax > 12 ? 5 : ymax > 6 ? 2 : 1;
    for (let k = 1 + step; k < ymax; k += step) { g.beginPath(); g.moveTo(34, Y(k)); g.lineTo(W - 10, Y(k)); g.stroke(); g.fillText('×' + Math.round(k), 4, Y(k) - 3); }
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(34, H - 30); g.lineTo(W - 10, H - 30); g.stroke();
    let px = X(0), py = Y(1), ang = 0;
    const pts = this.pts;
    if (pts.length > 1) {
      g.beginPath(); g.moveTo(X(pts[0][0]), Y(pts[0][1]));
      for (let i = 1; i < pts.length; i++) g.lineTo(X(pts[i][0]), Y(pts[i][1]));
      const lp = pts[pts.length - 1]; px = X(lp[0]); py = Y(lp[1]);
      const pp = pts[Math.max(0, pts.length - 6)]; ang = Math.atan2(py - Y(pp[1]), px - X(pp[0]));
      const col = boom ? '#ff4d5e' : this.cashed ? '#4ade80' : '#ff3b6b';
      g.shadowColor = col; g.shadowBlur = 16; g.strokeStyle = col; g.lineWidth = 4; g.stroke(); g.shadowBlur = 0;
      g.lineTo(px, H - 30); g.lineTo(X(0), H - 30); g.closePath();
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, boom ? 'rgba(255,77,94,.4)' : 'rgba(255,59,107,.35)'); gr.addColorStop(1, 'rgba(255,59,107,0)');
      g.fillStyle = gr; g.fill();
    }
    if (!boom) {
      g.save(); g.translate(px, py); g.rotate(ang);
      // plane
      g.shadowColor = '#ff3b6b'; g.shadowBlur = 18;
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(22, 0); g.lineTo(-14, -7); g.lineTo(-10, 0); g.lineTo(-14, 7); g.closePath(); g.fill();
      g.fillStyle = '#ff3b6b';
      g.beginPath(); g.moveTo(4, 0); g.lineTo(-6, -18); g.lineTo(-10, -18); g.lineTo(-4, 0); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(4, 0); g.lineTo(-6, 18); g.lineTo(-10, 18); g.lineTo(-4, 0); g.closePath(); g.fill();
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(-15, 0, 3 + Math.random() * 2.5, 0, 6.28); g.fill();
      g.restore();
    }
    this.planeAt = [px, py];
  }

  histAdd(v) {
    this.histArr.unshift(v);
    this.histArr = this.histArr.slice(0, 12);
    this.q('.av-hist').innerHTML = this.histArr.map((x) => `<span class="${x < 2 ? 'lo' : x < 10 ? 'mid' : 'hi'}">${fm(x)}</span>`).join('');
  }

  onMain() {
    if (this.state === 'fly') { if (!this.cashed) this.cashAt(this.m); return; }
    const bet = this.bet;
    if (!this.pay(bet)) return;
    this.stake = bet; this.lastStake = bet;
    this.cp = crashPoint(); this.t = 0; this.m = 1; this.cashed = false; this.pts = [[0, 1]]; this.state = 'fly';
    this.big.className = 'av-big fly'; this.big.textContent = fm(1);
    this.q('.av-sub').textContent = '';
    this.q('.av-sky').classList.remove('boom'); this.q('.av-sky').classList.add('flying');
    this.setLast(0); this.winAmt.textContent = '';
    this.msg('Décollage…');
    sfx.spin();
    this.last = performance.now();
    this.paint();
    this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  cashAt(x) {
    if (this.state !== 'fly' || this.cashed) return;
    this.cashed = true;
    const win = Math.floor(this.stake * x);
    this.win(win); this.setLast(win);
    this.big.className = 'av-big cashed';
    this.q('.av-sub').textContent = `Encaissé à ${fm(x)} : +${fmtC(win)}`;
    this.msg(`Tu as encaissé ${fmtC(win)}. Regarde jusqu’où il monte…`);
    const r = this.cv.getBoundingClientRect();
    if (this.planeAt) fx.burst(r.left + this.planeAt[0], r.top + this.planeAt[1], 40, ['#4ade80', '#fde047', '#fff'], 8);
    sfx.win();
    this.paint();
    if (win / this.stake >= 10) this.celebrate(win);
  }

  crash() {
    this.state = 'crash'; this.m = this.cp; this.pts.push([this.t, this.cp]);
    this.draw(true);
    const r = this.cv.getBoundingClientRect();
    if (this.planeAt) { fx.burst(r.left + this.planeAt[0], r.top + this.planeAt[1], 80, ['#ff4d5e', '#fbbf24', '#fff', '#1f2937'], 12); }
    this.flash('rgba(255,77,94,.6)'); this.shake(); sfx.puff();
    this.big.className = 'av-big crash'; this.big.textContent = fm(this.cp);
    this.q('.av-sky').classList.remove('flying'); this.q('.av-sky').classList.add('boom');
    this.q('.av-sub').textContent = this.cashed ? 'L’avion explose' : 'L’avion explose, mise perdue';
    if (!this.cashed) { this.setLast(0); this.msg(`💥 Explosion à ${fm(this.cp)}. Tu perds ${fmtC(this.stake)}.`); }
    else this.msg(`💥 Explosion à ${fm(this.cp)}. Tu avais encaissé à temps.`);
    this.histAdd(this.cp);
    this.paint();
  }

  frame(now) {
    if (this.state !== 'fly' || this.dead) return;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now; this.t += dt;
    this.m = growth(this.t);
    const au = AUTOS[this.ai];
    if (au && !this.cashed && au <= this.cp && this.m >= au) this.cashAt(au);
    if (this.t > 0.5 && this.m >= this.cp) return this.crash();
    if (this.m >= this.cp && this.t <= 0.5) this.m = 1 + (this.cp - 1) * (this.t / 0.5);
    this.pts.push([this.t, this.m]);
    if (this.pts.length > 600) this.pts = this.pts.filter((_, i) => i % 2 === 0 || i > this.pts.length - 40);
    this.big.textContent = fm(this.m);
    if (!this.cashed) this.mainBtn.querySelector('.main-label').textContent = `ENCAISSER ${fmtC(Math.floor(this.stake * this.m))}`;
    this.draw(false);
    this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  info() {
    return this.rules(`<h4>Règles</h4><p>L’avion décolle et le multiplicateur grimpe. <b>Encaisse</b> avant qu’il explose : tu gagnes ta mise × le multiplicateur du moment. S’il explose avant, la mise est perdue.</p>
      <p>Tu peux régler un <b>encaissement automatique</b> (×1,5 à ×100). Multiplicateur maximum ×1 000. Retour théorique ≈ 95 %.</p>`);
  }
}

return { AvionGame };
})();
