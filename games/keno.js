// SpinBet Casino · KenoGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/keno.js ----
__mods['games/impl/keno.js'] = (() => {
// Le Super Keno (demande du propriétaire du 16 novembre 2026 : « le Keno, en mode big loto ») : sur le plateau de ses 2 vidéos,
// l'animateur fait tomber 20 boules une par une dans un tube ; nos numéros (tirés au hasard parmi 70) s'affichent à chaque
// boule. Le joueur achète autant de grilles qu'il veut (1 à 10 numéros chacune, MAXG au plus), chacune à la mise choisie.
// La colonne lumineuse derrière l'animateur montre le multiplicateur de la DERNIÈRE BOULE (×2 à ×50, tiré à chaque tirage) :
// une grille gagnante qui contient la dernière boule est multipliée. Simulation : node tools/sim/keno.js (≈ 94 à 96 % pour
// chaque nombre de numéros cochés).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, isMuted, duck } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];

/* ===ENGINE */
const N = 70, D = 20, MAXK = 10, MAXG = 50, CAPX = 100000;
// what a grid of k numbers pays (× its stake) for h good numbers; a winning grid holding the last ball is × the multiplier
const PAY = {
  1: { 1: 3 }, 2: { 2: 10 }, 3: { 2: 1, 3: 26 }, 4: { 2: 1, 3: 3, 4: 50 }, 5: { 3: 1.5, 4: 11, 5: 200 },
  6: { 3: 1, 4: 3, 5: 30, 6: 500 }, 7: { 3: 1, 4: 2, 5: 7, 6: 50, 7: 1000 }, 8: { 0: 1, 4: 1, 5: 5, 6: 27, 7: 250, 8: 2500 },
  9: { 0: 1, 4: 1, 5: 2, 6: 11, 7: 60, 8: 600, 9: 5000 }, 10: { 0: 2, 5: 1.5, 6: 6.5, 7: 30, 8: 250, 9: 1500, 10: 10000 },
};
const MULT = [[2, 60], [3, 22], [5, 12], [10, 5], [25, 0.8], [50, 0.2]];
const pickW = (R, l) => { let t = 0; for (const x of l) t += x[1]; let q = R() * t; for (const x of l) { if (q < x[1]) return x[0]; q -= x[1]; } return l[l.length - 1][0]; };
// one draw: 20 different numbers in their order (the last one is the bonus ball) and its multiplier
function draw(R = Math.random) {
  const a = Array.from({ length: N }, (_, i) => i + 1);
  for (let i = 0; i < D; i++) { const j = i + Math.floor(R() * (N - i)); [a[i], a[j]] = [a[j], a[i]]; }
  return { balls: a.slice(0, D), m: pickW(R, MULT) };
}
// a grid (its numbers) on a draw: good numbers, the last ball in it, what it returns (× its stake)
function gridResult(nums, O) {
  const set = new Set(O.balls), last = O.balls[D - 1];
  const h = nums.filter((n) => set.has(n)).length, base = (PAY[nums.length] || {})[h] || 0;
  const bonus = base > 0 && nums.includes(last);
  return { h, base, bonus, x: Math.min(CAPX, base * (bonus ? O.m : 1)) };
}
/* ===END ENGINE */

// the moments (in s) when each of the 20 balls drops into the box of the tube, the same in his 2 videos (tools/art/keno/build.py)
const BALLS = [0.84, 2.36, 3.04, 3.96, 4.88, 5.88, 6.8, 7.56, 8.4, 9.3, 9.84, 10.44, 11.24, 12.24, 13.88, 14.7, 15.44, 16.32, 17.28, 18.8];
const BCOL = ['#e8222f', '#f97316', '#f5c518', '#16a34a', '#0ea5b7', '#2563eb', '#7c3aed']; // a colour per ten, like the balls of a lottery
const ballCol = (n) => BCOL[Math.floor((n - 1) / 10)];
const asset = (p) => window.__assets?.[p] || `${p}?v=1`;
const store = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const rnd = (k, not = []) => { const a = Array.from({ length: N }, (_, i) => i + 1).filter((n) => !not.includes(n)); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k); };
const xs = (v) => `×${String(v).replace('.', ',')}`;

class KenoGame extends BaseGame {
  constructor(root, game, ov) {
    super(root, game, {
      music: EXTRA_THEMES.keno, autoplay: true, mainLabel: 'TIRAGE', betLabel: 'Mise par grille', cls: 'table-game kn-game',
      head: '<div class="hist kn-hist"></div>',
      stage: `<div class="kn-stage"><div class="kn-art">
          <video class="kn-vid" playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video>
          <div class="kn-col"><small>DERNIÈRE BOULE</small><b class="kn-m">×?</b><small>MULTIPLICATEUR</small></div>
          <div class="kn-now"><small>BOULE <i>0</i> / 20</small><b class="kn-ball"></b></div>
          <b class="kn-lastb"></b>
          <button class="kn-snd" type="button" aria-label="Son de l’émission">🔊</button>
        </div></div>`,
      below: `<div class="kn-panel">
          <div class="kn-drawn">${Array.from({ length: D }, (_, i) => `<i class="kn-d${i === D - 1 ? ' last' : ''}"></i>`).join('')}</div>
          <div class="kn-edit-bar"></div>
          <div class="kn-board">${Array.from({ length: N }, (_, i) => `<button class="kn-n" type="button" data-n="${i + 1}" style="--bc:${ballCol(i + 1)}">${i + 1}</button>`).join('')}</div>
          <div class="kn-tools">
            <button class="kn-t" data-k="new" type="button">＋ Grille</button>
            <div class="kn-k"><button type="button" data-k="k-">−</button><span><b class="kn-kv"></b> numéros</span><button type="button" data-k="k+">+</button></div>
            <button class="kn-t gold" data-k="f1" type="button">🎲 Flash</button>
            <button class="kn-t gold" data-k="f5" type="button">🎲 ×5</button>
            <button class="kn-t gold" data-k="f10" type="button">🎲 ×10</button>
            <button class="kn-t red" data-k="clear" type="button">🗑 Tout</button>
          </div>
          <div class="kn-sum"></div>
          <div class="kn-grids"></div>
        </div>`,
      hello: 'Achète tes grilles (＋ Grille ou 🎲 Flash) puis appuie sur TIRAGE : l’animateur fait tomber les 20 boules.',
    });
    this.grids = store('spinbet_keno_grids', []).filter((g) => Array.isArray(g) && g.length && g.length <= MAXK).slice(0, MAXG);
    this.kq = Math.min(MAXK, Math.max(1, +store('spinbet_keno_k', 6) || 6));
    this.edit = -1; this.res = null; this.drawn = []; this.hist = [];
    this.vid = this.q('.kn-vid'); this.sc = this.q('.kn-stage');
    this.vid.muted = true;
    this.vid.addEventListener('error', () => { this.vidBad = true; });
    this.vid.addEventListener('ended', () => { this.vidOn = false; });
    this.onVis = () => { if (document.hidden && this.vidOn) this.vid.pause(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.sndOn = (() => { try { return localStorage.getItem('spinbet_keno_snd') !== '0'; } catch { return true; } })();
    this.paintSnd();
    this.q('.kn-snd').addEventListener('click', () => { this.sndOn = !this.sndOn; try { localStorage.setItem('spinbet_keno_snd', this.sndOn ? '1' : '0'); } catch { /* ignore */ } this.paintSnd(); this.vid.muted = !this.sndOn || isMuted(); });
    this.q('.kn-board').addEventListener('click', (e) => { const b = e.target.closest('.kn-n'); if (b) this.tapNum(+b.dataset.n); });
    this.q('.kn-tools').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) this.tool(b.dataset.k); });
    this.q('.kn-grids').addEventListener('click', (e) => {
      const del = e.target.closest('.kn-gx'); const card = e.target.closest('.kn-g');
      if (!card || this.busy) return;
      const i = +card.dataset.i;
      if (del) { this.grids.splice(i, 1); if (this.edit === i) this.edit = -1; else if (this.edit > i) this.edit--; this.res = null; this.save(); this.paint(); return; }
      this.edit = this.edit === i ? -1 : i; this.res = null; this.paint();
    });
    this.q('.kn-edit-bar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-e]'); if (!b || this.busy || this.edit < 0) return;
      const g = this.grids[this.edit];
      if (b.dataset.e === 'ok') this.endEdit();
      else if (b.dataset.e === 'rnd') { g.push(...rnd(Math.max(0, Math.max(this.kq, g.length + 1) - g.length), g)); g.splice(MAXK); g.sort((x, y) => x - y); this.save(); this.paint(); } // up to the chosen count (one more if already there)
      else if (b.dataset.e === 'wipe') { this.grids[this.edit] = []; this.paint(); }
    });
    this.ro = new ResizeObserver(() => this.layout()); this.ro.observe(this.sc);
    this.onRs = () => requestAnimationFrame(() => this.layout()); addEventListener('resize', this.onRs);
    this.layout();
    this.paint();
  }

  stakeLabel() { return this.bet * (this.grids?.filter((g) => g.length).length || 0); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = !this.auto && (this.busy || !this.grids?.some((g) => g.length)); }
  paintSnd() { const b = this.q('.kn-snd'); if (b) { b.textContent = this.sndOn ? '🔊' : '🔇'; b.title = this.sndOn ? 'Couper le son de l’émission' : 'Remettre le son de l’émission'; } }
  save() { keep('spinbet_keno_grids', this.grids.filter((g) => g.length)); }

  /* ---------- the video: wide on computers, tall (its middle) on a phone held upright ---------- */
  layout() {
    if (this.dead) return;
    const full = !!this.slotEl.closest('.is-full');
    const port = full ? innerWidth < innerHeight && innerWidth < 900 : innerWidth < 700 && innerHeight > innerWidth;
    const name = port ? 'haut' : 'large';
    if (this.name === name) return;
    this.name = name;
    this.sc.classList.toggle('kn-p', port); this.sc.classList.toggle('kn-l', !port);
    this.vidOn = false;
    this.vid.poster = asset(`assets/games/keno/show-${name}.webp`);
    this.vid.src = asset(`assets/games/keno/show-${name}.mp4`);
    this.vid.load();
  }
  startShow() {
    const v = this.vid;
    if (this.vidBad || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      v.pause(); v.currentTime = 0; v.playbackRate = this.turbo ? 1.6 : 1;
      v.muted = !this.sndOn || isMuted();
      const p = v.play(); this.vidOn = true;
      p?.catch(() => { v.muted = true; v.play().catch(() => { this.vidOn = false; }); });
      if (!v.muted) duck?.(0.12, 20 / v.playbackRate);
      return true;
    } catch { this.vidOn = false; return false; }
  }
  // until the moment t of the show (its video, or the clock when there is no video)
  async until(t, t0) {
    const rate = this.turbo ? 1.6 : 1;
    while (!this.dead) {
      const now = this.vidOn && !this.vid.paused ? this.vid.currentTime : (performance.now() - t0) / 1000 * rate;
      if (now >= t) return;
      if (!this.vidOn && performance.now() - t0 > (t / rate) * 1000 + 50) return;
      await sleep(25);
    }
  }

  /* ---------- the grids ---------- */
  tool(k) {
    if (this.busy) return;
    sfx.click();
    if (k === 'k-' || k === 'k+') { this.kq = Math.max(1, Math.min(MAXK, this.kq + (k === 'k+' ? 1 : -1))); keep('spinbet_keno_k', this.kq); this.paint(); return; }
    this.res = null;
    if (k === 'clear') { this.grids = []; this.edit = -1; this.save(); this.paint(); this.msg('Plus de grille : ajoute-en avec ＋ Grille ou 🎲 Flash.'); return; }
    this.endEdit(true);
    const room = MAXG - this.grids.length;
    if (room <= 0) { this.msg(`${MAXG} grilles au plus par tirage.`); return; }
    if (k === 'new') { this.grids.push([]); this.edit = this.grids.length - 1; this.paint(); this.msg('Touche les numéros de ta grille sur le tableau (1 à 10), puis Valider.'); this.q('.kn-board').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    const n = Math.min(room, k === 'f10' ? 10 : k === 'f5' ? 5 : 1);
    for (let i = 0; i < n; i++) this.grids.push(rnd(this.kq).sort((a, b) => a - b));
    this.save(); this.paint();
    this.msg(`${n > 1 ? `${n} grilles flash ajoutées` : 'Grille flash ajoutée'} (${this.kq} numéros au hasard).`);
  }
  tapNum(n) {
    if (this.busy) return;
    if (this.edit < 0) { this.msg('Pour choisir tes numéros : ＋ Grille, ou touche une de tes grilles.'); return; }
    const g = this.grids[this.edit], i = g.indexOf(n);
    if (i >= 0) g.splice(i, 1);
    else if (g.length >= MAXK) { this.msg(`${MAXK} numéros au plus par grille.`); return; }
    else g.push(n);
    g.sort((a, b) => a - b); sfx.click();
    this.paint();
  }
  endEdit(quiet) {
    if (this.edit < 0) return;
    if (!this.grids[this.edit]?.length) this.grids.splice(this.edit, 1);
    this.edit = -1; this.save();
    if (!quiet) { this.paint(); this.msg('Grille validée. Appuie sur TIRAGE !'); }
  }
  paint() {
    const live = this.grids.filter((g) => g.length).length, set = new Set(this.drawn), last = this.drawn.length === D ? this.drawn[D - 1] : 0;
    const mine = new Set(this.grids.flat()), eg = this.edit >= 0 ? new Set(this.grids[this.edit]) : null;
    this.q('.kn-kv').textContent = this.kq;
    this.qa('.kn-n').forEach((b) => {
      const n = +b.dataset.n;
      b.className = `kn-n${set.has(n) ? ' out' : ''}${n === last ? ' lastn' : ''}${eg ? (eg.has(n) ? ' sel' : '') : mine.has(n) ? ' mine' : ''}`;
    });
    this.q('.kn-board').classList.toggle('picking', !!eg);
    const eb = this.q('.kn-edit-bar');
    eb.innerHTML = eg ? `<b>Grille ${this.edit + 1}</b><span>${eg.size} / ${MAXK} numéros</span><button type="button" data-e="rnd">🎲 Compléter</button><button type="button" data-e="wipe">Vider</button><button type="button" class="ok" data-e="ok">✔ Valider</button>` : '';
    eb.classList.toggle('on', !!eg);
    this.q('.kn-sum').innerHTML = live ? `<b>${live}</b> grille${live > 1 ? 's' : ''} × ${fmtC(this.bet)} = <b>${fmtC(this.bet * live)}</b>` : 'Pas encore de grille';
    this.q('.kn-grids').innerHTML = this.grids.map((g, i) => {
      const r = this.res?.[i];
      const chips = g.map((n) => `<i class="${set.has(n) ? 'hit' : ''}${n === last && set.has(n) ? ' gold' : ''}">${n}</i>`).join('');
      const pay = PAY[g.length] || {}, top = pay[g.length];
      const st = r ? (r.x > 0 ? `<em class="w">+${fmtC(Math.round(this.lastBet * r.x))}${r.bonus ? ` <u>${xs(this.res.m)}</u>` : ''}</em>` : '<em>—</em>') : `<em class="t">${g.length ? `${set.size ? `${g.filter((n) => set.has(n)).length} / ${g.length}` : `max ${xs(top)}`}` : 'vide'}</em>`;
      return `<div class="kn-g${i === this.edit ? ' edit' : ''}${r?.x > 0 ? ' won' : ''}${r?.bonus ? ' bonus' : ''}" data-i="${i}"><div class="kn-gh"><span>Grille ${i + 1}</span>${st}<button class="kn-gx" type="button" aria-label="Supprimer la grille ${i + 1}">✕</button></div><div class="kn-gc">${chips || '<small>Touche les numéros du tableau</small>'}</div></div>`;
    }).join('');
    this.updateMeters();
  }

  /* ---------- the draw ---------- */
  onMain() {
    if (this.edit >= 0) this.endEdit(true);
    const live = this.grids.filter((g) => g.length);
    if (!live.length) { this.paint(); this.msg('Ajoute au moins une grille (＋ Grille ou 🎲 Flash).'); this.stopAuto(); return; }
    const total = this.bet * live.length;
    if (this.busy) return;
    if (total > this.balC()) { this.msg(`Il faut ${fmtC(total)} pour ${live.length} grille${live.length > 1 ? 's' : ''} : baisse la mise ou enlève des grilles.`); this.stopAuto(true); return; }
    this.showStarted = this.startShow(); // in the tap itself: the sound of the show may play (iPhone)
    this.round(async () => {
      if (!this.pay(total)) { this.vid.pause(); this.vidOn = false; return; }
      this.roundStake = total; this.lastStake = total; this.lastBet = this.bet;
      this.grids = live; this.res = null; this.drawn = [];
      this.setLast(0); this.winAmt.textContent = '';
      this.focusStage?.();
      await this.play(draw(), live);
    });
  }

  async play(O, grids) {
    const t0 = performance.now();
    if (!this.vidOn) this.startShow();
    this.qa('.kn-d').forEach((d) => { d.textContent = ''; d.className = d.className.replace(/ (on|hit)/g, ''); d.style.removeProperty('--bc'); });
    const lb = this.q('.kn-lastb'); lb.className = 'kn-lastb'; lb.textContent = '';
    this.q('.kn-now i').textContent = '0'; const ball = this.q('.kn-ball'); ball.textContent = ''; ball.className = 'kn-ball';
    this.paint();
    // the multiplier of the last ball, shown on the column behind the host
    const col = this.q('.kn-col'), mv = this.q('.kn-m');
    col.classList.remove('hit'); col.classList.add('roll');
    this.msg('Le multiplicateur de la dernière boule…');
    const tr = performance.now();
    while (performance.now() - tr < (this.turbo ? 350 : 700) && !this.dead) { mv.textContent = xs(MULT[Math.floor(Math.random() * MULT.length)][0]); sfx.tick(); await sleep(70); }
    mv.textContent = xs(O.m); col.classList.remove('roll'); col.classList.add('hit'); sfx.upgrade();
    this.msg(`Dernière boule ${xs(O.m)} ! Les boules tombent…`);
    const set = new Set(grids.flat());
    for (let i = 0; i < D; i++) {
      await this.until(BALLS[i], t0);
      if (this.dead) return;
      const n = O.balls[i], lastB = i === D - 1;
      this.drawn.push(n);
      this.q('.kn-now i').textContent = i + 1;
      ball.textContent = n; ball.style.setProperty('--bc', ballCol(n));
      ball.className = `kn-ball${lastB ? ' gold' : ''}`; void ball.offsetWidth; ball.classList.add('pop');
      const d = this.qa('.kn-d')[i]; d.textContent = n; d.style.setProperty('--bc', ballCol(n)); d.classList.add('on'); if (set.has(n)) d.classList.add('hit');
      this.paint();
      if (set.has(n)) { sfx.upgrade(); const c = this.q(`.kn-n[data-n="${n}"]`); if (c) { const p = center(c); fx.burst(p.x, p.y, 10, [ballCol(n), '#fff']); } } else sfx.tick();
      if (lastB) {
        this.msg(`Dernière boule : ${n} ${xs(O.m)} !${set.has(n) ? ' Tu l’as !' : ''}`);
        lb.textContent = n; lb.style.setProperty('--bc', ballCol(n)); lb.classList.add('on');
      }
    }
    await this.wait(500);
    // the results
    const res = grids.map((g) => gridResult(g, O)); res.m = O.m; this.res = res;
    const winC = res.reduce((a, r) => a + Math.round(this.lastBet * r.x), 0), nw = res.filter((r) => r.x > 0).length, nb = res.filter((r) => r.bonus).length;
    this.paint();
    this.hist.unshift(O.balls[D - 1]); this.hist = this.hist.slice(0, 10);
    this.q('.kn-hist').innerHTML = this.hist.map((n) => `<span style="background:${ballCol(n)}">${n}</span>`).join('');
    const all = this.lastStake;
    this.msg(nw ? `${nw} grille${nw > 1 ? 's' : ''} gagnante${nw > 1 ? 's' : ''}${nb ? ` (dont ${nb} avec la dernière boule ${xs(O.m)})` : ''} · +${fmtC(winC)} · Bilan : ${winC - all >= 0 ? '+' : '−'}${fmtC(Math.abs(winC - all))}` : 'Pas de grille gagnante cette fois. On retente ?');
    if (winC > 0) {
      this.win(winC);
      this.setLast(winC);
      if (nb) { const p = center(this.q('.kn-col')); fx.burst(p.x, p.y, 40, ['#ffd23f', '#fff']); }
      if (winC > all) await this.celebrate(winC, { summary: 'SUPER KENO' });
    }
    return winC;
  }

  destroy() {
    this.ro?.disconnect(); removeEventListener('resize', this.onRs); document.removeEventListener('visibilitychange', this.onVis);
    try { this.vid.pause(); this.vid.removeAttribute('src'); this.vid.load(); } catch { /* ignore */ }
    super.destroy();
  }

  info() {
    const row = (k) => Object.entries(PAY[k]).sort((a, b) => b[0] - a[0]).map(([h, v]) => `${h} bons ${xs(v)}`).join(' · ');
    return this.rules(`<h4>Le tirage</h4><p>L’animateur fait tomber 20 boules parmi les numéros 1 à 70. Avant le tirage, la colonne lumineuse derrière lui donne le multiplicateur de la <b>dernière boule</b> (×2 à ×50).</p>
      <h4>Tes grilles</h4><p>Achète autant de grilles que tu veux (${MAXG} au plus) : ＋ Grille pour choisir tes numéros sur le tableau, ou 🎲 Flash pour des grilles au hasard (choisis combien de numéros, 1 à 10). Chaque grille coûte la mise par grille.</p>
      <h4>Les gains (× la mise de la grille)</h4><ul class="rules">${Array.from({ length: MAXK }, (_, i) => MAXK - i).map((k) => `<li class="pay-item"><b>${k} numéro${k > 1 ? 's' : ''}</b> : ${row(k)}</li>`).join('')}</ul>
      <h4>La dernière boule</h4><p>Une grille gagnante qui contient la dernière boule est multipliée par le multiplicateur de la colonne. Gain maximum ${xs(CAPX)} la mise d’une grille.</p>`);
  }
}

return { KenoGame, draw, gridResult, PAY };
})();
