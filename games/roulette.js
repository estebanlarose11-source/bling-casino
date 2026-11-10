// SpinBet Casino · RouletteGame — loaded on demand by games/impl/index.js (index.html), after games/bjtable.js (jetons).
// ---- games/impl/roulette.js ----
__mods['games/impl/roulette.js'] = (() => {
// La Roulette (demande du propriétaire, d'après des captures d'un autre jeu : même principe, couleurs et dessins à nous) :
// une vraie table de roulette européenne en 3D. Le plan de la table (.rl-table, W × H) est incliné (rotateX) et la
// caméra (camera(), animée en JS image par image) cadre soit le tapis pour miser (presque vu de dessus), soit la roue
// en bois pendant le lancer (vue penchée). Tapis bleu : cylindre (Tiers, Orphelins, Voisins, Jeu zéro, et chaque numéro
// = le numéro + 2 voisins de chaque côté), grille 0 à droite / colonnes « 2 à 1 » à gauche, douzaines, chances simples.
// Tableau lumineux des derniers numéros (statistiques au toucher), panneau « NUMÉRO GAGNANT », marqueur sur le numéro.
// Barre du bas : Vider, Répéter, Annuler, 5 jetons (choisis selon le solde, ceux du 21 : games/bjtable.js), ×2, Lancer.
// Limites : 5 000 KE par case, 10 000 KE de mise totale. Paiements classiques (plein 35 pour 1…) : retour 97,3 %.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { ORDER, colr, buildDefs, ballTick } = __mods['core/roulette.js'];
const { CHIPS, chipSVG } = __mods['games/impl/bjtable.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx } = __mods['fx.js'];
const { modal } = __mods['ui.js'];

/* ===ENGINE */
const NP = 37, A = 360 / NP;
const L = buildDefs(35); // plein 35, cheval 17, transversale 11, carré 8, sixain 5, douzaines / colonnes 2, chances 1
const MAXSPOT = 500000, MAXTOTAL = 1000000; // 5 000 KE par case, 10 000 KE en tout (centimes)
function settle(bets, r) { let t = 0; for (const k in bets) { const d = L.DEF[k]; if (d && d.n.includes(r)) t += bets[k] * (d.p + 1); } return t; }
/* ===END ENGINE */

// Bets by their numbers (announced bets of the racetrack put chips on these)
const BYSET = {};
for (const k in L.DEF) if (/^[nszqtx]/.test(k)) BYSET[[...L.DEF[k].n].sort((a, b) => a - b).join('-')] = k;
const keyOf = (...nums) => BYSET[nums.sort((a, b) => a - b).join('-')];
const ANNOUNCED = {
  tiers: { name: 'Tiers du cylindre', parts: [[5, 8], [10, 11], [13, 16], [23, 24], [27, 30], [33, 36]] },
  orph: { name: 'Orphelins', parts: [[1], [6, 9], [14, 17], [17, 20], [31, 34]] },
  voisins: { name: 'Voisins du zéro', parts: [[0, 2, 3], [0, 2, 3], [4, 7], [12, 15], [18, 21], [19, 22], [32, 35], [25, 26, 28, 29], [25, 26, 28, 29]] },
  zero: { name: 'Jeu zéro', parts: [[0, 3], [12, 15], [26], [32, 35]] },
};
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

/* ---------- the plane of the table (px) ---------- */
const W = 2000, H = 860;
const CW = 76, CH = 88, GX = 150, GY = 300, DH = 74; // grid cell, grid origin (left edge of the « 2 à 1 »), outside rows
const NR = GX + 13 * CW; // right edge of the numbers (the zero is on the right)
const colX = (c) => GX + CW + (11 - c) * CW; // number column c (1-2-3 = 0 … 34-35-36 = 11), mirrored: 36 at the left
const numXY = (n) => { if (!n) return [NR + CW / 2, GY + 1.5 * CH]; const c = Math.floor((n - 1) / 3), r = 2 - ((n - 1) % 3); return [colX(c) + CW / 2, GY + r * CH + CH / 2]; };
const RT = { cx: (GX + CW + NR + CW) / 2, cy: 150, rw: 56, rh: 50, R: 86, r: 36 }; // racetrack
RT.x0 = RT.cx - 7.5 * RT.rw; RT.x1 = RT.cx + 7.5 * RT.rw;
const LED = { x: 1262, y: GY, w: 96, h: 3 * CH + 2 * DH };
const WH = { x: 1655, y: 430, r: 300 }; // the wheel (its wooden bowl)
// ball radii in the wheel (wheel units: radius 300)
const R_TRACK = 236, R_POCKET = 150;
const CAMS = {
  bet: { box: [GX - 30, RT.cy - RT.R - 26, LED.x + LED.w + 26, GY + 3 * CH + 2 * DH + 30], tilt: 12 },
  spin: { box: [WH.x - 318, WH.y - 318, WH.x + 318, WH.y + 318], tilt: 44 },
  over: { box: [40, 30, W - 40, H - 30], tilt: 30 },
};
const PERSP = 1900;

const fmtK = (c) => { const v = c / 100; return v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0).replace('.', ',')}K` : String(Math.round(v)); };
const chipOf = (amt) => [...CHIPS].reverse().find((c) => c[0] <= amt) || CHIPS[0];
const colName = (n) => (n === 0 ? 'zéro' : REDS.has(n) ? 'rouge' : 'noir');

/* ---------- drawings ---------- */
function wheelSVG() {
  const segs = [], nums = [], frets = [];
  const P = (a, r) => { const t = ((a - 90) * Math.PI) / 180; return `${(r * Math.cos(t)).toFixed(2)} ${(r * Math.sin(t)).toFixed(2)}`; };
  for (let i = 0; i < NP; i++) {
    const n = ORDER[i], a0 = i * A - A / 2, a1 = a0 + A, f = n === 0 ? '#14883f' : REDS.has(n) ? '#b3172a' : '#16181d';
    segs.push(`<path d="M${P(a0, 164)} L${P(a0, 202)} A202 202 0 0 1 ${P(a1, 202)} L${P(a1, 164)} A164 164 0 0 0 ${P(a0, 164)}Z" fill="${f}"/>`);
    segs.push(`<path d="M${P(a0, 128)} L${P(a0, 164)} A164 164 0 0 1 ${P(a1, 164)} L${P(a1, 128)} A128 128 0 0 0 ${P(a0, 128)}Z" fill="${f}" filter="url(#rlPocketSh)"/>`);
    nums.push(`<text transform="rotate(${(i * A).toFixed(2)}) translate(0 -177)" text-anchor="middle" dominant-baseline="middle" font-size="${n > 9 ? 19 : 21}">${n}</text>`);
    frets.push(`<path d="M${P(a0, 128)} L${P(a0, 202)}" />`);
  }
  const dia = Array.from({ length: 8 }, (_, k) => { const a = k * 45 + 22.5; return `<g transform="rotate(${a}) translate(0 -224)"><path d="M0 -10 L5 0 L0 10 L-5 0Z" fill="url(#rlChrome)" stroke="#58606b" stroke-width=".8"/></g>`; }).join('');
  return `<svg class="rl-wheel" viewBox="-300 -300 600 600" width="600" height="600" aria-hidden="true">
  <defs>
    <radialGradient id="rlRim" r=".5"><stop offset=".86" stop-color="#3a1806"/><stop offset=".9" stop-color="#8a4a1c"/><stop offset=".95" stop-color="#c9823f"/><stop offset=".98" stop-color="#7a3d12"/><stop offset="1" stop-color="#2a1004"/></radialGradient>
    <radialGradient id="rlTrack" r=".5"><stop offset=".66" stop-color="#2b1306"/><stop offset=".72" stop-color="#6e3812"/><stop offset=".82" stop-color="#a5632a"/><stop offset=".88" stop-color="#c88a4b"/></radialGradient>
    <radialGradient id="rlCone" cx=".42" cy=".38" r=".62"><stop offset="0" stop-color="#f0b46a"/><stop offset=".35" stop-color="#c47a32"/><stop offset=".7" stop-color="#8d4b17"/><stop offset="1" stop-color="#4d2308"/></radialGradient>
    <radialGradient id="rlBurl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#3a1806" stop-opacity=".18"/><stop offset="1" stop-color="#3a1806" stop-opacity=".45"/></radialGradient>
    <linearGradient id="rlChrome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbfdff"/><stop offset=".45" stop-color="#aab3bd"/><stop offset=".55" stop-color="#e8edf2"/><stop offset="1" stop-color="#5b636d"/></linearGradient>
    <radialGradient id="rlDome" cx=".38" cy=".32" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#cfd6dd"/><stop offset=".75" stop-color="#7c8691"/><stop offset="1" stop-color="#3b424b"/></radialGradient>
    <radialGradient id="rlBall" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#e9ecf2"/><stop offset="1" stop-color="#8c93a3"/></radialGradient>
    <linearGradient id="rlGoldR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe7a1"/><stop offset=".5" stop-color="#c9952f"/><stop offset="1" stop-color="#7a5510"/></linearGradient>
    <filter id="rlPocketSh" x="-10%" y="-10%" width="120%" height="120%"><feComponentTransfer><feFuncR type="linear" slope=".72"/><feFuncG type="linear" slope=".72"/><feFuncB type="linear" slope=".72"/></feComponentTransfer></filter>
    <filter id="rlSoft"><feGaussianBlur stdDeviation="6"/></filter>
    <pattern id="rlGrain" width="40" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><path d="M0 6 Q10 2 20 6 T40 6" stroke="#3a1806" stroke-opacity=".22" fill="none" stroke-width="1.4"/></pattern>
  </defs>
  <circle r="300" fill="url(#rlRim)"/>
  <circle r="300" fill="url(#rlGrain)" opacity=".7"/>
  <circle r="268" fill="none" stroke="url(#rlChrome)" stroke-width="5"/>
  <circle r="265" fill="url(#rlTrack)"/>
  <circle r="262" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
  ${dia}
  <circle r="208" fill="#120803" filter="url(#rlSoft)" opacity=".8"/>
  <g class="rl-rotor">
    <circle r="206" fill="url(#rlGoldR)"/>
    ${segs.join('')}
    <g fill="#fff" font-family="Archivo, Inter, sans-serif" font-weight="900">${nums.join('')}</g>
    <g stroke="url(#rlChrome)" stroke-width="2.2" fill="none">${frets.join('')}<circle r="164"/><circle r="202"/><circle r="128" stroke-width="3"/></g>
    <circle r="126" fill="url(#rlCone)"/>
    <circle r="126" fill="url(#rlGrain)" opacity=".8"/>
    <circle r="126" fill="url(#rlBurl)"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<path d="M0 0 L0 -124" transform="rotate(${k * 45})" stroke="#2a1205" stroke-opacity=".35" stroke-width="2"/>`).join('')}
    <g class="rl-turret">
      ${[0, 90, 180, 270].map((a) => `<g transform="rotate(${a})"><path d="M-5 -30 L-3.5 -104 L3.5 -104 L5 -30Z" fill="url(#rlChrome)" stroke="#4b525b" stroke-width=".8"/><circle cy="-108" r="9" fill="url(#rlDome)" stroke="#4b525b" stroke-width=".8"/></g>`).join('')}
      <circle r="36" fill="url(#rlDome)" stroke="#4b525b" stroke-width="1"/>
      <circle r="18" fill="url(#rlChrome)" stroke="#59616b"/>
      <circle cx="-6" cy="-8" r="6" fill="#fff" opacity=".8"/>
    </g>
  </g>
  <circle class="rl-ball" r="8.5" cx="0" cy="${-R_TRACK}" fill="url(#rlBall)" stroke="#6b7280" stroke-width=".8"/>
</svg>`;
}

const ROOM = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140"><rect width="140" height="140" fill="#16314f"/><g fill="none" stroke="#b08a3e" stroke-opacity=".55"><circle cx="70" cy="70" r="20" stroke-width="2"/><circle cx="70" cy="70" r="12" stroke-width="1.5"/><path d="M70 44 L74 56 L70 52 L66 56Z M70 96 L74 84 L70 88 L66 84Z M44 70 L56 74 L52 70 L56 66Z M96 70 L84 74 L88 70 L84 66Z" fill="#b08a3e" fill-opacity=".5"/></g><g fill="#24456a"><circle cx="0" cy="0" r="5"/><circle cx="140" cy="0" r="5"/><circle cx="0" cy="140" r="5"/><circle cx="140" cy="140" r="5"/></g></svg>')}")`;

// The felt, the rail and everything printed on the table; interactive shapes carry data-k (a bet), data-rt (a
// number of the racetrack) or data-an (an announced bet).
function feltSVG() {
  const o = [];
  const line = 'stroke="#f2f6fa" stroke-opacity=".85" stroke-width="3"';
  // table body: leather pad, wood strip with cups, felt
  o.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="70" fill="url(#rlLeather)"/>`);
  o.push(`<rect x="10" y="8" width="${W - 20}" height="${H - 20}" rx="62" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="3"/>`);
  o.push(`<rect x="46" y="44" width="${W - 92}" height="${H - 88}" rx="34" fill="url(#rlWood)"/>`);
  o.push(`<rect x="70" y="66" width="${W - 140}" height="${H - 132}" rx="22" fill="url(#rlFelt)"/>`);
  o.push(`<rect x="70" y="66" width="${W - 140}" height="${H - 132}" rx="22" fill="url(#rlWeave)"/>`);
  o.push(`<rect x="70" y="66" width="${W - 140}" height="${H - 132}" rx="22" fill="url(#rlLamp)"/>`);
  [[58, 160], [58, 430], [58, 700], [400, H - 56], [900, H - 56], [1400, H - 56]].forEach(([x, y]) => o.push(`<ellipse cx="${x}" cy="${y}" rx="15" ry="11" fill="url(#rlGold)" stroke="#5a3a08"/><ellipse cx="${x}" cy="${y}" rx="9" ry="6" fill="#3b2405"/>`));
  // wheel recess
  o.push(`<circle cx="${WH.x}" cy="${WH.y}" r="${WH.r + 26}" fill="url(#rlWood)"/><circle cx="${WH.x}" cy="${WH.y}" r="${WH.r + 10}" fill="#160a03" opacity=".75"/>`);
  // racetrack
  const { cx, cy, rw, rh, R, r, x0, x1 } = RT;
  const top = ORDER.slice(1, 16).reverse(); // 30 … 32 (left → right)
  const left = ORDER.slice(16, 20); // 8 23 10 5 (top → bottom)
  const bottom = ORDER.slice(20, 35); // 24 … 35
  const right = [ORDER[0], ORDER[36], ORDER[35]]; // 0 26 3 (top → bottom)
  const fillOf = (n) => (n === 0 ? '#14883f' : REDS.has(n) ? '#b3172a' : '#16222c');
  const cell = (n, d) => `<g class="rl-rt" data-rt="${n}"><path d="${d}" fill="${fillOf(n)}" ${line}/>`;
  top.forEach((n, i) => { const x = x0 + i * rw; o.push(`${cell(n, `M${x} ${cy - R} h${rw} v${rh} h${-rw}Z`)}<text x="${x + rw / 2}" y="${cy - R + rh / 2 + 1}">${n}</text></g>`); });
  bottom.forEach((n, i) => { const x = x0 + i * rw; o.push(`${cell(n, `M${x} ${cy + R - rh} h${rw} v${rh} h${-rw}Z`)}<text x="${x + rw / 2}" y="${cy + R - rh / 2 + 1}">${n}</text></g>`); });
  const wedge = (ox, a0, a1) => { const p = (a, rr) => `${(ox + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`; return `M${p(a0, r)} L${p(a0, R)} A${R} ${R} 0 0 ${a1 > a0 ? 1 : 0} ${p(a1, R)} L${p(a1, r)} A${r} ${r} 0 0 ${a1 > a0 ? 0 : 1} ${p(a0, r)}Z`; };
  const mid = (ox, a0, a1) => { const a = (a0 + a1) / 2, rr = (R + r) / 2; return [ox + rr * Math.cos(a), cy + rr * Math.sin(a)]; };
  left.forEach((n, i) => { const a0 = -Math.PI / 2 - (i * Math.PI) / 4, a1 = a0 - Math.PI / 4, m = mid(x0, a0, a1); o.push(`${cell(n, wedge(x0, a0, a1))}<text x="${m[0].toFixed(1)}" y="${(m[1] + 1).toFixed(1)}">${n}</text></g>`); });
  right.forEach((n, i) => { const a0 = -Math.PI / 2 + (i * Math.PI) / 3, a1 = a0 + Math.PI / 3, m = mid(x1, a0, a1); o.push(`${cell(n, wedge(x1, a0, a1))}<text x="${m[0].toFixed(1)}" y="${(m[1] + 1).toFixed(1)}">${n}</text></g>`); });
  // inner sections (slanted dividers like a real racetrack)
  const yT = cy - R + rh, yB = cy + R - rh, at = (row, k) => x0 + k * rw; // boundary k of a row
  const idx = (arr, n) => arr.indexOf(n);
  const d1 = [at(0, idx(top, 6)), at(0, idx(bottom, 1))]; // tiers | orphelins : top 27|6, bottom 33|1
  const d2 = [at(0, idx(top, 17) + 1), at(0, idx(bottom, 22))]; // orphelins | voisins : top 17|25, bottom 9|22
  const d3 = [at(0, idx(top, 15)), at(0, idx(bottom, 12))]; // voisins | jeu zéro : top 19|15, bottom 28|12
  const sec = (id, pts, label, lx) => `<g class="rl-an" data-an="${id}"><path d="${pts}" fill="rgba(6,22,34,.45)" ${line}/><text class="rl-an-t" x="${lx}" y="${cy + 1}">${label}</text></g>`;
  o.push(sec('tiers', `M${x0} ${yT} L${d1[0]} ${yT} L${d1[1]} ${yB} L${x0} ${yB} A${r} ${r} 0 0 1 ${x0} ${yT}Z`, 'TIERS', (x0 + (d1[0] + d1[1]) / 2) / 2 - 6));
  o.push(sec('orph', `M${d1[0]} ${yT} L${d2[0]} ${yT} L${d2[1]} ${yB} L${d1[1]} ${yB}Z`, 'ORPHELINS', (d1[0] + d1[1] + d2[0] + d2[1]) / 4));
  o.push(sec('voisins', `M${d2[0]} ${yT} L${d3[0]} ${yT} L${d3[1]} ${yB} L${d2[1]} ${yB}Z`, 'VOISINS', (d2[0] + d2[1] + d3[0] + d3[1]) / 4));
  o.push(sec('zero', `M${d3[0]} ${yT} L${x1} ${yT} A${r} ${r} 0 0 1 ${x1} ${yB} L${d3[1]} ${yB}Z`, 'JEU 0', (d3[0] + d3[1]) / 4 + x1 / 2 + 6));
  // grid: columns « 2 à 1 », numbers, zero
  [3, 2, 1].forEach((k, row) => o.push(`<g class="rl-cell" data-k="k${k}"><rect x="${GX}" y="${GY + row * CH}" width="${CW}" height="${CH}" fill="rgba(0,0,0,.08)" ${line}/><text class="rl-out" x="${GX + CW / 2}" y="${GY + row * CH + CH / 2 - 10}">2</text><text class="rl-out sm" x="${GX + CW / 2}" y="${GY + row * CH + CH / 2 + 14}">POUR 1</text></g>`));
  for (let n = 1; n <= 36; n++) {
    const [x, y] = numXY(n);
    o.push(`<g class="rl-cell" data-k="n${n}"><rect x="${x - CW / 2}" y="${y - CH / 2}" width="${CW}" height="${CH}" fill="rgba(0,0,0,0)" ${line}/><circle cx="${x}" cy="${y}" r="30" fill="${REDS.has(n) ? '#c21d30' : '#132531'}" stroke="rgba(255,255,255,.25)" stroke-width="2"/><text class="rl-num" x="${x}" y="${y + 1}">${n}</text></g>`);
  }
  o.push(`<g class="rl-cell" data-k="n0"><path d="M${NR} ${GY} h${CW * 0.55} q${CW * 0.45} 0 ${CW * 0.45} ${CH * 0.5} v${CH * 2} q0 ${CH * 0.5} ${-CW * 0.45} ${CH * 0.5} h${-CW * 0.55}Z" fill="rgba(0,0,0,0)" ${line}/><circle cx="${NR + CW / 2}" cy="${GY + 1.5 * CH}" r="32" fill="#14883f" stroke="rgba(255,255,255,.3)" stroke-width="2"/><text class="rl-num" x="${NR + CW / 2}" y="${GY + 1.5 * CH + 1}">0</text></g>`);
  // dozens and even chances (mirrored like the reference: 3e douzaine at the left)
  const yD = GY + 3 * CH, yE = yD + DH;
  [['d3', '3e DOUZAINE'], ['d2', '2e DOUZAINE'], ['d1', '1re DOUZAINE']].forEach(([k, t], i) => { const x = GX + CW + i * 4 * CW; o.push(`<g class="rl-cell" data-k="${k}"><rect x="${x}" y="${yD}" width="${4 * CW}" height="${DH}" fill="rgba(0,0,0,0)" ${line}/><text class="rl-out" x="${x + 2 * CW}" y="${yD + DH / 2 + 1}">${t}</text></g>`); });
  [['high', '19-36'], ['odd', 'IMPAIR'], ['black', ''], ['red', ''], ['even', 'PAIR'], ['low', '1-18']].forEach(([k, t], i) => {
    const x = GX + CW + i * 2 * CW, mx = x + CW, my = yE + DH / 2;
    const dia = k === 'red' || k === 'black' ? `<path d="M${mx - 62} ${my} L${mx} ${my - 24} L${mx + 62} ${my} L${mx} ${my + 24}Z" fill="${k === 'red' ? '#c21d30' : '#0f1d27'}" stroke="rgba(255,255,255,.35)" stroke-width="2"/>` : `<text class="rl-out" x="${mx}" y="${my + 1}">${t}</text>`;
    o.push(`<g class="rl-cell" data-k="${k}"><rect x="${x}" y="${yE}" width="${2 * CW}" height="${DH}" fill="rgba(0,0,0,0)" ${line}/>${dia}</g>`);
  });
  o.push(`<rect x="${GX}" y="${GY}" width="${NR - GX}" height="${3 * CH}" fill="none" stroke="#f2f6fa" stroke-opacity=".95" stroke-width="5"/>`);
  // the statistics board (lights drawn by paintLed)
  o.push(`<g class="rl-ledbox" data-led="1"><rect x="${LED.x - 8}" y="${LED.y - 8}" width="${LED.w + 16}" height="${LED.h + 16}" rx="10" fill="url(#rlMetal)"/><rect x="${LED.x}" y="${LED.y}" width="${LED.w}" height="${LED.h - 40}" rx="4" fill="#07090b"/><rect x="${LED.x}" y="${LED.y}" width="${LED.w}" height="${LED.h - 40}" rx="4" fill="url(#rlDots)"/><g class="rl-led"></g><rect x="${LED.x}" y="${LED.y + LED.h - 34}" width="${LED.w}" height="34" rx="4" fill="#24384d"/><text class="rl-out sm" x="${LED.x + LED.w / 2}" y="${LED.y + LED.h - 16}">STATISTIQUES</text></g>`);
  // the croupière's chip float next to the wheel (decoration)
  const stack = (x, y, c, n) => Array.from({ length: n }, (_, k) => `<ellipse cx="${x}" cy="${y - k * 5}" rx="26" ry="26" fill="${c[2]}" stroke="${c[3]}" stroke-width="3" stroke-dasharray="7 6"/>`).join('');
  o.push(`<g opacity=".95">${stack(1880, 150, CHIPS[1], 6)}${stack(1880, 214, CHIPS[2], 8)}${stack(1882, 278, CHIPS[3], 5)}${stack(1300, 790, CHIPS[4], 4)}${stack(1360, 794, CHIPS[5], 5)}</g>`);
  return `<svg class="rl-felt" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs>
      <linearGradient id="rlLeather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2b30"/><stop offset=".5" stop-color="#151518"/><stop offset="1" stop-color="#050506"/></linearGradient>
      <linearGradient id="rlWood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a5320"/><stop offset=".3" stop-color="#6b3410"/><stop offset=".55" stop-color="#a8622a"/><stop offset=".8" stop-color="#5d2c0c"/><stop offset="1" stop-color="#8a4818"/></linearGradient>
      <radialGradient id="rlFelt" cx="40%" cy="40%" r="80%"><stop offset="0" stop-color="#2a76a8"/><stop offset=".55" stop-color="#1d5b85"/><stop offset="1" stop-color="#123c5a"/></radialGradient>
      <radialGradient id="rlLamp" cx="35%" cy="45%" r="45%"><stop offset="0" stop-color="#fff8dc" stop-opacity=".14"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></radialGradient>
      <pattern id="rlWeave" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6 L6 0" stroke="rgba(255,255,255,.04)" stroke-width="1"/></pattern>
      <pattern id="rlDots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.1" fill="#1a2026"/></pattern>
      <linearGradient id="rlGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe7a1"/><stop offset=".5" stop-color="#d4a637"/><stop offset="1" stop-color="#8a6512"/></linearGradient>
      <linearGradient id="rlMetal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#58616b"/><stop offset=".5" stop-color="#c9d1d9"/><stop offset="1" stop-color="#4a525b"/></linearGradient>
      <radialGradient id="bjvChipShade" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
      <filter id="rlChipSh" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="2.5" flood-color="#000" flood-opacity=".6"/></filter>
    </defs>
    ${o.join('')}
    <g class="rl-hots">${L.HOTS.map((h) => { const [x, y] = hotXY(h); return `<circle class="rl-hot" data-k="${h.key}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="19"/>`; }).join('')}</g>
    <g class="rl-hl"></g>
    <g class="rl-chips"></g>
  </svg>`;
}
// the hot spots of buildDefs (splits, corners, streets, six lines…) moved to this mirrored grid
function hotXY(h) {
  const u = (h.x - 36) / 38; let v = h.y / 46;
  if (v > 2.7) v = 3;
  return [GX + CW + (12 - u) * CW, GY + v * CH];
}
// where the chip of a bet sits
const ANCH = {};
L.CELLS.forEach((c) => { if (c.key[0] === 'n') ANCH[c.key] = numXY(+c.key.slice(1)); });
[3, 2, 1].forEach((k, row) => { ANCH['k' + k] = [GX + CW / 2, GY + row * CH + CH / 2]; });
['d3', 'd2', 'd1'].forEach((k, i) => { ANCH[k] = [GX + CW + i * 4 * CW + 2 * CW, GY + 3 * CH + DH / 2]; });
['high', 'odd', 'black', 'red', 'even', 'low'].forEach((k, i) => { ANCH[k] = [GX + 2 * CW + i * 2 * CW, GY + 3 * CH + DH + DH / 2]; });
L.HOTS.forEach((h) => { ANCH[h.key] = hotXY(h); });

const SIGN = `<div class="rl-up rl-sign" style="left:${WH.x - 250}px;top:${WH.y - 290}px"><svg viewBox="0 0 260 120" width="260" height="120" aria-hidden="true"><path d="M8 6 H252 L246 114 H14Z" fill="url(#rlSignG)" stroke="#6b4a10" stroke-width="2"/><defs><linearGradient id="rlSignG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7e3a0"/><stop offset="1" stop-color="#c79a3c"/></linearGradient></defs><path d="M20 30 H240 M20 98 H240" stroke="#5b3d0a" stroke-width="1.4"/><text x="130" y="24" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="900" font-size="17" fill="#3d2804">Mises de la table</text><text x="130" y="58" text-anchor="middle" font-family="KeCoin, Archivo, sans-serif" font-weight="800" font-size="19" fill="#3d2804">Min : 1 </text><text x="130" y="86" text-anchor="middle" font-family="KeCoin, Archivo, sans-serif" font-weight="800" font-size="19" fill="#3d2804">Max : 5 000  / case</text></svg></div>`;
const DOLLY = '<svg viewBox="0 0 60 110" width="44" height="80" aria-hidden="true"><defs><linearGradient id="rlDol" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8f99a5"/><stop offset=".35" stop-color="#ffffff"/><stop offset=".6" stop-color="#cfd6dd"/><stop offset="1" stop-color="#5e6670"/></linearGradient></defs><ellipse cx="30" cy="102" rx="24" ry="7" fill="#000" opacity=".45"/><path d="M8 100 Q8 88 22 82 L24 40 Q14 34 14 22 A16 16 0 0 1 46 22 Q46 34 36 40 L38 82 Q52 88 52 100Z" fill="url(#rlDol)" stroke="#4b535c" stroke-width="1.2"/><ellipse cx="30" cy="20" rx="9" ry="6" fill="#fff" opacity=".7"/></svg>';

function sceneHTML() {
  return `<div class="rl" data-cam="bet" style="--tilt:12deg">
    <div class="rl-room" style="background-image:${ROOM}"></div>
    <div class="rl-world">
      <div class="rl-persp"><div class="rl-table">
        ${feltSVG()}
        <div class="rl-wheelbox" style="left:${WH.x - 300}px;top:${WH.y - 300}px">${wheelSVG()}</div>
        ${SIGN}
        <div class="rl-up rl-dolly" hidden>${DOLLY}</div>
      </div></div>
    </div>
    <div class="rl-shade"></div>
    <div class="rl-top">
      <button class="rl-sq" data-act="menu" aria-label="Menu et règles"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
      <div class="rl-me"><span class="rl-av"></span><div><b class="rl-name"></b><em class="rl-bal"></em></div></div>
      <div class="rl-total"><i></i><span>Mise totale : <b class="rl-tot"></b></span></div>
      <div class="rl-gain"><small>Gain</small><b class="rl-win"></b></div>
      <button class="rl-sq rl-full" data-act="full" aria-label="Plein écran">⛶<span>Plein écran</span></button>
    </div>
    <div class="rl-tip"></div>
    <div class="rl-wn" hidden><small>NUMÉRO GAGNANT</small><b></b><em></em></div>
    <div class="rl-turn">📱 Tourne ton téléphone pour une plus grande table</div>
    <div class="rl-hud">
      <button class="rl-b" data-rl="clear" aria-label="Vider la table"><svg viewBox="0 0 40 40"><ellipse cx="20" cy="30" rx="13" ry="5" fill="currentColor" opacity=".55"/><ellipse cx="20" cy="25" rx="13" ry="5" fill="currentColor" opacity=".8"/><path d="M8 4 L18 14 M18 4 L8 14" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg><span>Vider</span></button>
      <button class="rl-b" data-rl="repeat" aria-label="Répéter les mises"><svg viewBox="0 0 40 40"><ellipse cx="20" cy="31" rx="13" ry="5" fill="currentColor" opacity=".55"/><ellipse cx="20" cy="26" rx="13" ry="5" fill="currentColor" opacity=".8"/><path d="M11 15 A10 10 0 1 1 20 21" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M6 11 L11 17 L16 11Z" fill="currentColor"/></svg><span>Répéter</span></button>
      <button class="rl-b" data-rl="undo" aria-label="Annuler le dernier jeton"><svg viewBox="0 0 40 40"><path d="M14 10 L6 17 L14 24" stroke="currentColor" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 17 H24 A9 9 0 0 1 24 35 H16" stroke="currentColor" stroke-width="3.4" fill="none" stroke-linecap="round"/></svg><span>Annuler</span></button>
      <div class="rl-chipbar"></div>
      <button class="rl-b" data-rl="x2" aria-label="Doubler les mises"><b>×2</b><span>Doubler</span></button>
      <button class="rl-b rl-go" data-act="main" aria-label="Lancer la bille"><svg viewBox="0 0 40 40"><ellipse cx="20" cy="22" rx="17" ry="11" fill="none" stroke="currentColor" stroke-width="3"/><ellipse cx="20" cy="21" rx="9" ry="5.5" fill="currentColor" opacity=".55"/><path d="M20 21 V8 M12 9 H28" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="31" cy="18" r="2.6" fill="#fff"/></svg><span class="rl-go-t">LANCER</span></button>
    </div>
  </div>`;
}

class RouletteGame extends BaseGame {
  constructor(root, game) {
    super(root, game, { music: EXTRA_THEMES.roulette || EXTRA_THEMES.doublespin, stepper: false, autoplay: true, turbo: true, mainLabel: 'LANCER', betLabel: 'Mise totale', cls: 'table-game rl-game', stage: sceneHTML(), hello: 'Pose tes jetons puis lance la bille.' });
    this.view = this.q('.rl');
    this.world = this.q('.rl-world');
    this.persp = this.q('.rl-persp');
    this.tableEl = this.q('.rl-table');
    this.chipsG = this.q('.rl-chips');
    this.bets = {}; this.stack = []; this.lastBets = null; this.pickI = 2; this.phase = 'bet';
    this.wcur = 0; // rotor angle
    try { this.hist = JSON.parse(localStorage.getItem('spinbet_roulette_hist') || '[]').filter((x) => x >= 0 && x <= 36).slice(0, 500); } catch { this.hist = []; }
    this.cam = { ...CAMS.bet, box: [...CAMS.bet.box] };
    this.root.addEventListener('click', (e) => this.onTap(e));
    this.ro = new ResizeObserver(() => this.applyCam(this.cam));
    this.ro.observe(this.view);
    this.applyCam(this.cam);
    this.paintLed();
    this.paintAll();
    this.tip('Choisis un jeton en bas, puis touche le tapis pour miser.');
  }
  destroy() { this.ro?.disconnect(); cancelAnimationFrame(this.camRaf); super.destroy(); }

  /* ---------- camera ---------- */
  // Fits a box of the plane (tilted by `tilt` degrees, seen through the perspective) into the free part of the view.
  applyCam(c) {
    const v = this.view; if (!v || this.dead) return;
    const cw = v.clientWidth; let ch = v.clientHeight; if (!cw || !ch) return;
    const full = !!this.root.closest('.is-full');
    const top = (this.q('.rl-top')?.offsetHeight || 46) + 10, hud = (this.q('.rl-hud')?.offsetHeight || 70) + 8;
    const t = (c.tilt * Math.PI) / 180, [x0, y0, x1, y1] = c.box, ox = (x0 + x1) / 2, oy = (y0 + y1) / 2;
    const pr = (x, y) => { const dy = y - oy, s = PERSP / (PERSP - dy * Math.sin(t)); return [ox + (x - ox) * s, oy + dy * Math.cos(t) * s]; };
    const P = [pr(x0, y0), pr(x1, y0), pr(x0, y1), pr(x1, y1)];
    const bx0 = Math.min(...P.map((p) => p[0])), bx1 = Math.max(...P.map((p) => p[0])), by0 = Math.min(...P.map((p) => p[1])), by1 = Math.max(...P.map((p) => p[1]));
    // outside full screen the scene is as tall as the betting view needs (phones), within limits
    if (!full && c === this.cam && this.view.dataset.cam === 'bet' && !this.camAnim) {
      const want = Math.round(top + hud + ((by1 - by0) * (cw - 16)) / (bx1 - bx0));
      const lim = matchMedia('(orientation: portrait)').matches ? Math.max(340, Math.min(want + 16, innerHeight - 110)) : Math.max(420, Math.min(innerHeight * 0.86, cw * 0.62, 860));
      if (Math.abs(v.clientHeight - lim) > 2) { v.style.height = `${lim}px`; ch = lim; }
    } else if (full && v.style.height) { v.style.height = ''; ch = v.clientHeight; }
    const aw = cw - 16, ah = ch - top - hud;
    const k = Math.min(aw / (bx1 - bx0), ah / (by1 - by0));
    const tx = cw / 2 - ((bx0 + bx1) / 2) * k, ty = top + ah / 2 - ((by0 + by1) / 2) * k;
    this.persp.style.perspectiveOrigin = `${ox}px ${oy}px`;
    this.tableEl.style.transformOrigin = `${ox}px ${oy}px`;
    this.tableEl.style.transform = `rotateX(${c.tilt}deg)`;
    this.view.style.setProperty('--tilt', `${c.tilt}deg`);
    this.world.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${k.toFixed(4)})`;
    this.q('.rl-room').style.backgroundSize = `${Math.max(40, 140 * k * 1.6)}px`;
  }
  setCam(name, ms = 1000) {
    const to = CAMS[name]; this.view.dataset.cam = name;
    const from = { tilt: this.cam.tilt, box: [...this.cam.box] };
    cancelAnimationFrame(this.camRaf);
    if (this.turbo) ms *= 0.6;
    return new Promise((res) => {
      const t0 = performance.now();
      this.camAnim = true;
      const step = (now) => {
        if (this.dead) return res();
        const u = Math.min(1, (now - t0) / ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        this.cam = { tilt: from.tilt + (to.tilt - from.tilt) * e, box: from.box.map((v, i) => v + (to.box[i] - v) * e) };
        this.applyCam(this.cam);
        if (u < 1) this.camRaf = requestAnimationFrame(step); else { this.camAnim = false; this.cam = { tilt: to.tilt, box: [...to.box] }; this.applyCam(this.cam); res(); }
      };
      this.camRaf = requestAnimationFrame(step);
    });
  }

  /* ---------- taps ---------- */
  onTap(e) {
    const t = e.target;
    const b = t.closest('[data-rl]');
    if (b) { if (!b.disabled) { this.wake(); this.tool(b.dataset.rl); } return; }
    const ch = t.closest('[data-pick]');
    if (ch) { this.wake(); this.pickI = +ch.dataset.pick; sfx.click(); this.paintChips(); return; }
    if (t.closest('[data-led]')) { this.wake(); this.showStats(); return; }
    if (this.phase !== 'bet' || this.busy) return;
    const k = t.closest('[data-k]')?.dataset.k;
    if (k) { this.wake(); this.place([[k, 1]], t.closest('[data-k]')); return; }
    const rt = t.closest('[data-rt]')?.dataset.rt;
    if (rt != null) { this.wake(); const i = ORDER.indexOf(+rt); this.place([-2, -1, 0, 1, 2].map((d) => ['n' + ORDER[(i + d + NP) % NP], 1]), t.closest('[data-rt]'), `${rt} et ses voisins`); return; }
    const an = t.closest('[data-an]')?.dataset.an;
    if (an) { this.wake(); const A2 = ANNOUNCED[an]; this.place(A2.parts.map((p) => [keyOf(...p), 1]), t.closest('[data-an]'), A2.name); }
  }
  wake() { sfx.unlock(); this.music?.start?.(); }

  /* ---------- bets ---------- */
  picks() {
    const bal = this.balC();
    let top = CHIPS.findIndex((c) => c[0] > bal); if (top < 0) top = CHIPS.length;
    const end = Math.max(5, Math.min(CHIPS.length, top));
    return CHIPS.slice(end - 5, end);
  }
  chipV() { return this.picks()[this.pickI][0]; }
  total(b = this.bets) { let t = 0; for (const k in b) t += b[k]; return t; }
  // puts the chosen chip (× units) on each bet of a group, all or nothing
  place(parts, node, label) {
    if (this.phase !== 'bet' || this.busy) return;
    const v = this.chipV(), next = { ...this.bets }, add = [];
    for (const [k, u] of parts) { if (!k) continue; next[k] = (next[k] || 0) + v * u; add.push([k, v * u]); }
    const over = Object.keys(next).find((k) => next[k] > MAXSPOT);
    if (over) { this.tip(`Mise maximum par case : ${fmtC(MAXSPOT)}.`, true); this.buzz(node); return; }
    if (this.total(next) > MAXTOTAL) { this.tip(`Ta mise totale dépasse la limite. La mise totale maximale est de ${fmtC(MAXTOTAL)}.`, true); this.buzz(node); return; }
    if (this.total(next) > this.balC()) { this.tip('Solde insuffisant pour ce jeton : choisis-en un plus petit.', true); this.buzz(node); return; }
    this.bets = next; this.stack.push(add);
    sfx.click(); setTimeout(() => sfx.coin?.(), 90);
    if (label) this.tip(`${label} : ${add.length} jeton${add.length > 1 ? 's' : ''} de ${fmtC(v)} (${fmtC(v * add.length)})`);
    this.paintAll(add.map((a) => a[0]));
  }
  buzz(node) { if (!node) return; node.classList.remove('rl-no'); void node.getBoundingClientRect(); node.classList.add('rl-no'); sfx.reelStop?.(0); }
  tool(k) {
    if (this.busy && k !== 'x') return;
    if (k === 'clear') { if (!this.total()) return; this.bets = {}; this.stack = []; this.tip('Table vidée.'); }
    if (k === 'undo') { const g = this.stack.pop(); if (!g) return; g.forEach(([key, a]) => { this.bets[key] -= a; if (this.bets[key] <= 0) delete this.bets[key]; }); }
    if (k === 'repeat') { if (!this.rebet()) return; }
    if (k === 'x2') {
      const next = Object.fromEntries(Object.entries(this.bets).map(([key, a]) => [key, a * 2]));
      if (!this.total()) return;
      if (Object.values(next).some((a) => a > MAXSPOT) || this.total(next) > MAXTOTAL) { this.tip(`Ta mise totale dépasse la limite. La mise totale maximale est de ${fmtC(MAXTOTAL)}.`, true); return; }
      if (this.total(next) > this.balC()) { this.tip('Solde insuffisant pour doubler.', true); return; }
      this.stack.push(Object.entries(this.bets).map(([key, a]) => [key, a]));
      this.bets = next;
    }
    sfx.click();
    this.paintAll();
  }
  rebet() {
    if (!this.lastBets) { this.tip('Pas encore de mises à répéter.'); return false; }
    if (this.total(this.lastBets) > this.balC()) { this.tip('Solde insuffisant pour répéter ces mises.', true); return false; }
    this.bets = { ...this.lastBets };
    this.stack = [Object.entries(this.bets)];
    return true;
  }
  tip(t, warn = false) {
    const e = this.q('.rl-tip'); if (!e || this.dead) return;
    e.innerHTML = t; e.classList.toggle('warn', warn); e.classList.add('show');
    clearTimeout(this.tipT); this.tipT = setTimeout(() => e.classList.remove('show'), warn ? 3800 : 3000);
  }

  /* ---------- painting ---------- */
  paintAll(fresh = []) { this.paintBets(fresh); this.paintChips(); this.paintTop(); }
  paintBets(fresh = []) {
    const out = [];
    for (const k in this.bets) {
      const a = this.bets[k], p = ANCH[k]; if (!p || !a) continue;
      const c = chipOf(a), n = Math.min(4, Math.max(1, Math.ceil(a / c[0])));
      const discs = Array.from({ length: n - 1 }, (_, i) => `<ellipse cx="0" cy="${-i * 5 + 3}" rx="23" ry="23" fill="${c[2]}" stroke="${c[3]}" stroke-width="3" stroke-dasharray="6 5"/>`).join('');
      out.push(`<g class="rl-ch${fresh.includes(k) ? ' fresh' : ''}" data-c="${k}" transform="translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})" filter="url(#rlChipSh)">${discs}<g transform="translate(0 ${-(n - 1) * 5})"><svg x="-24" y="-24" width="48" height="48" viewBox="0 0 100 100" overflow="visible">${chipSVG([c[0], fmtK(a), c[2], c[3], c[4]], 100)}</svg></g></g>`);
    }
    this.chipsG.innerHTML = out.join('');
  }
  paintChips() {
    const P = this.picks(), bar = this.q('.rl-chipbar');
    if (this.pickI > 4) this.pickI = 4;
    const key = P.map((c) => c[1]).join() + '|' + this.pickI;
    if (bar.dataset.k !== key) { bar.dataset.k = key; bar.innerHTML = P.map((c, i) => `<button class="rl-pick${i === this.pickI ? ' on' : ''}" data-pick="${i}" aria-label="Jeton ${c[1]}">${chipSVG(c, 100)}</button>`).join(''); }
    const free = this.balC() - this.total();
    this.qa('.rl-pick').forEach((b, i) => b.classList.toggle('off', P[i][0] > free));
  }
  paintTop() {
    const prof = __mods['profile.js']?.profiles?.current, look = __mods['shop.js']?.publicLook?.(prof);
    const av = this.q('.rl-av'), html = look ? __mods['shop.js']?.lookHTML?.(look, 'md') : '';
    const name = String(prof?.name || 'Invité').slice(0, 16), k = `${html}|${name}`;
    if (av && av.dataset.k !== k) { av.dataset.k = k; av.innerHTML = html || `<span class="rl-ini">${name.charAt(0).toUpperCase()}</span>`; this.q('.rl-name').textContent = name; }
    this.q('.rl-bal').textContent = fmtC(this.balC());
    const tot = this.phase === 'bet' ? this.total() : this.lastStake || 0;
    this.q('.rl-tot').textContent = fmtC(tot);
    this.q('.rl-total i').style.width = `${Math.min(100, (tot / MAXTOTAL) * 100)}%`;
    this.q('.rl-win').textContent = fmtC(this.lastPay || 0);
    const bet = this.phase === 'bet' && !this.busy, any = this.total() > 0;
    const set = (k, on) => { const e = this.q(`[data-rl="${k}"]`); if (e) e.disabled = !on; };
    set('clear', bet && any); set('undo', bet && this.stack.length > 0); set('repeat', bet && !any && !!this.lastBets); set('x2', bet && any);
    const go = this.q('.rl-go');
    if (go) {
      go.classList.toggle('stop', !!this.auto);
      go.disabled = !this.auto && (!bet || (!any && !this.lastBets));
      this.q('.rl-go-t').textContent = this.auto ? `STOP (${this.auto})` : !any && this.lastBets ? 'REJOUER' : 'LANCER';
    }
    this.view.dataset.phase = this.phase;
  }
  onMeters() { if (this.view) { this.paintTop(); this.paintChips(); } }
  stakeLabel() { return this.total ? this.total() : 0; }

  // the lit board: the last numbers (red on the right, black on the left, zero in the middle)
  paintLed() {
    const g = this.q('.rl-led'); if (!g) return;
    const rows = this.hist.slice(0, 11);
    g.innerHTML = rows.map((n, i) => {
      const y = LED.y + 30 + i * 30, c = colr(n), x = c === 'r' ? LED.x + LED.w - 22 : c === 'g' ? LED.x + LED.w / 2 : LED.x + 22;
      return `<text x="${x}" y="${y}" class="rl-ledn ${c}${i === 0 ? ' last' : ''}">${n}</text>`;
    }).join('');
  }
  showStats() {
    const H2 = this.hist.slice(0, 100), n = H2.length;
    if (!n) { this.tip('Pas encore de tirage : lance la bille !'); return; }
    const pc = (f) => `${Math.round((H2.filter(f).length / n) * 100)} %`;
    const cnt = Array(NP).fill(0); H2.forEach((x) => cnt[x]++);
    const by = [...cnt.keys()].sort((a, b) => cnt[b] - cnt[a] || a - b);
    const ball = (x) => `<span class="rl-sb ${colr(x)}">${x}</span>`;
    modal(`<h3>Statistiques</h3><p class="muted">Les ${n} derniers tirages de cette table.</p>
      <div class="rl-stats">
        <div><b>Rouge</b><span>${pc((x) => REDS.has(x))}</span></div><div><b>Noir</b><span>${pc((x) => x && !REDS.has(x))}</span></div><div><b>Zéro</b><span>${pc((x) => x === 0)}</span></div>
        <div><b>Pair</b><span>${pc((x) => x && x % 2 === 0)}</span></div><div><b>Impair</b><span>${pc((x) => x % 2 === 1)}</span></div><div><b>1-18 / 19-36</b><span>${pc((x) => x >= 1 && x <= 18)} / ${pc((x) => x >= 19)}</span></div>
        <div><b>Douzaines</b><span>${pc((x) => x >= 1 && x <= 12)} · ${pc((x) => x >= 13 && x <= 24)} · ${pc((x) => x >= 25)}</span></div>
      </div>
      <h4>🔥 Numéros chauds</h4><div class="rl-sbs">${by.slice(0, 6).map((x) => `${ball(x)}<small>×${cnt[x]}</small>`).join('')}</div>
      <h4>❄️ Numéros froids</h4><div class="rl-sbs">${by.slice(-6).reverse().map((x) => `${ball(x)}<small>×${cnt[x]}</small>`).join('')}</div>
      <h4>Derniers tirages</h4><div class="rl-sbs">${this.hist.slice(0, 20).map(ball).join('')}</div>
      <p class="muted small">Chaque tirage est indépendant : la bille ne se souvient pas des tours d’avant.</p>`, { cls: 'wide' });
  }

  /* ---------- the spin ---------- */
  onMain() {
    if (this.busy || this.phase !== 'bet') return;
    if (!this.total() && this.lastBets) this.rebet();
    if (!this.total()) { this.stopAuto(); this.tip('Pose au moins un jeton sur le tapis.', true); return; }
    if (this.total() > this.balC()) { this.stopAuto(); this.tip('Solde insuffisant pour ces mises.', true); return; }
    this.paintAll();
    this.round(async () => {
      const placed = { ...this.bets }, tt = this.total();
      if (!this.pay(tt)) return;
      this.roundStake = tt; this.lastStake = tt; this.lastBets = placed; this.lastPay = 0;
      this.phase = 'spin'; this.paintTop();
      this.q('.rl-wn').hidden = true;
      this.q('.rl-dolly').hidden = true;
      this.q('.rl-hl').innerHTML = '';
      this.tip('Rien ne va plus…');
      const r = Math.floor(Math.random() * NP);
      const cam = this.setCam('spin', 1100);
      await this.wait(250);
      await this.spinTo(ORDER.indexOf(r));
      await cam;
      if (this.dead) return;
      this.hist.unshift(r); this.hist = this.hist.slice(0, 500);
      try { localStorage.setItem('spinbet_roulette_hist', JSON.stringify(this.hist)); } catch { /* ignore */ }
      this.showWinner(r);
      sfx.reelStop?.(0);
      await this.wait(1500);
      await this.setCam('bet', 1000);
      if (this.dead) return;
      this.paintLed();
      await this.resolve(placed, r, tt);
    });
  }

  spinTo(idx) {
    const svg = this.q('.rl-wheel'), rotor = svg.querySelector('.rl-rotor'), ball = svg.querySelector('.rl-ball');
    const T = this.turbo ? 4.2 : 7.4, T2 = T + 0.01;
    const w0 = this.wcur, wEnd = w0 + 300 + Math.random() * 120;
    const rel = idx * A + (Math.random() - 0.5) * A * 0.35;
    const E0 = 360 * (this.turbo ? 6 : 9) + Math.random() * 120;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = null;
    const pos = (ang, rad) => { const t = ((ang - 90) * Math.PI) / 180; ball.setAttribute('cx', (rad * Math.cos(t)).toFixed(2)); ball.setAttribute('cy', (rad * Math.sin(t)).toFixed(2)); };
    return new Promise((res) => {
      const t0 = performance.now();
      const frame = (now) => {
        if (this.dead) return res();
        const t = Math.min(T2, ((now - t0) / 1000) * (reduced ? 6 : 1)), u = Math.min(1, t / T);
        const wa = w0 + (wEnd - w0) * (1 - Math.pow(1 - u, 1.8));
        rotor.setAttribute('transform', `rotate(${wa.toFixed(2)})`);
        const Tb = T - 1.4;
        const bounce = t > Tb && t < T ? 10 * Math.exp(-3.6 * (t - Tb)) * Math.sin(16 * (t - Tb)) : 0;
        const E = t >= T ? 0 : E0 * Math.pow(1 - u, 2.4);
        const ba = wa + rel + E + bounce;
        const rad = u < 0.55 ? R_TRACK : u < 0.84 ? R_TRACK - (R_TRACK - R_POCKET) * ((x) => x * x * (3 - 2 * x))((u - 0.55) / 0.29) : R_POCKET + (t > Tb && t < T ? Math.abs(bounce) * 0.6 : 0);
        pos(ba, rad);
        if (u > 0.5 && t < T) { const nn = Math.floor((ba - wa) / A); if (last !== null && nn !== last) ballTick(Math.max(0.04, 0.15 * (1 - u) + 0.04)); last = nn; }
        if (t >= T2) { this.wcur = wEnd % 360; rotor.setAttribute('transform', `rotate(${this.wcur.toFixed(2)})`); pos(this.wcur + rel, R_POCKET); return res(); }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  showWinner(r) {
    const c = colr(r), wn = this.q('.rl-wn');
    wn.className = `rl-wn ${c}`; wn.hidden = false;
    wn.querySelector('b').textContent = r;
    wn.querySelector('em').textContent = r === 0 ? 'ZÉRO' : `${colName(r).toUpperCase()} · ${r % 2 ? 'IMPAIR' : 'PAIR'} · ${r <= 18 ? 'MANQUE' : 'PASSE'}`;
    // the marker on the number and the winning places lit
    const [x, y] = numXY(r), d = this.q('.rl-dolly');
    d.style.left = `${x + 22}px`; d.style.top = `${y + 14}px`; d.hidden = false;
    const hl = [];
    for (const k in L.DEF) {
      if (!L.DEF[k].n.includes(r)) continue;
      if (k[0] === 'n' || /^(d\d|k\d|low|high|even|odd|red|black)$/.test(k)) {
        const node = this.q(`.rl-cell[data-k="${k}"] rect, .rl-cell[data-k="${k}"] path`);
        if (node) hl.push(node.outerHTML.replace(/fill="[^"]*"/, 'fill="rgba(255,236,150,.32)"').replace(/stroke="[^"]*"/, 'stroke="#ffe680"'));
      }
    }
    this.q('.rl-hl').innerHTML = hl.join('');
  }

  async resolve(placed, r, tt) {
    const ret = settle(placed, r), net = ret - tt;
    const chips = this.qa('.rl-ch');
    const wins = chips.filter((g) => L.DEF[g.dataset.c]?.n.includes(r)), loses = chips.filter((g) => !wins.includes(g));
    // the croupière takes the losing chips (toward the wheel), the winning ones glow and get paid
    loses.forEach((g, i) => { const p = ANCH[g.dataset.c]; g.animate([{ opacity: 1, transform: `translate(${p[0]}px, ${p[1]}px)` }, { opacity: 0, transform: `translate(${p[0] + (WH.x - p[0]) * 0.35}px, ${p[1] - 60}px) scale(.6)` }], { duration: this.turbo ? 300 : 650, delay: i * 25, easing: 'ease-in', fill: 'forwards' }); });
    wins.forEach((g) => g.classList.add('win'));
    await this.wait(loses.length ? 650 : 200);
    if (ret > 0) {
      wins.forEach((g) => { const k = g.dataset.c, b = g.getBoundingClientRect(); fx.floatText(b.left + b.width / 2, b.top, `+${fmtC(placed[k] * (L.DEF[k].p + 1))}`, '#fde047', 18); fx.burst(b.left + b.width / 2, b.top + b.height / 2, 14, ['#fde047', '#fff', '#4ade80'], 6); });
      this.win(ret);
      this.lastPay = ret;
      this.setLast(ret);
      this.tip(`Le <b>${r}</b> ${colName(r)} : ${net > 0 ? `tu gagnes ${fmtC(net)} !` : net < 0 ? `tu récupères ${fmtC(ret)} (−${fmtC(-net)})` : 'mise rendue'}`);
      if (net > 0) { sfx.win(); if (ret >= tt * 10) await this.celebrate(ret, { stake: tt }); }
    } else {
      this.lastPay = 0;
      this.tip(`Le <b>${r}</b> ${colName(r)} : perdu (${fmtC(tt)}).`);
    }
    this.paintTop();
    await this.wait(ret > 0 ? 1300 : 700);
    if (this.dead) return;
    // clear the felt for the next bets (the marker stays on the last number)
    this.bets = {}; this.stack = [];
    this.phase = 'bet';
    if (this.auto > 1) this.rebet();
    this.q('.rl-hl').innerHTML = '';
    this.paintAll();
  }

  info() {
    return this.rules(`<h4>Roulette européenne</h4><p>Un seul zéro, 37 numéros. Choisis un jeton en bas puis touche le tapis : un numéro pour un plein, une ligne ou un coin entre les numéros pour un cheval, une transversale, un carré ou un sixain, les cases du bas pour les douzaines et les chances simples, « 2 pour 1 » pour une colonne.</p>
      <ul class="rules"><li>Plein : 35 pour 1 · Cheval : 17 · Transversale : 11 · Carré et 0-1-2-3 : 8 · Sixain : 5</li><li>Douzaines et colonnes : 2 pour 1 · Rouge/Noir, Pair/Impair, 1-18/19-36 : 1 pour 1</li><li>Limites : de 1 à ${fmtC(MAXSPOT)} par case, ${fmtC(MAXTOTAL)} de mise totale par tour.</li></ul>
      <h4>Le cylindre (en haut)</h4><ul class="rules"><li>Un numéro du cylindre : ce numéro et ses 2 voisins de chaque côté sur la roue (5 jetons).</li><li><b>Tiers</b> (6 jetons) : chevaux 5/8, 10/11, 13/16, 23/24, 27/30, 33/36.</li><li><b>Orphelins</b> (5 jetons) : plein 1, chevaux 6/9, 14/17, 17/20, 31/34.</li><li><b>Voisins du zéro</b> (9 jetons) : 0/2/3 (2 jetons), 4/7, 12/15, 18/21, 19/22, 32/35, carré 25/29 (2 jetons).</li><li><b>Jeu zéro</b> (4 jetons) : 0/3, 12/15, plein 26, 32/35.</li></ul>
      <h4>Boutons</h4><ul class="rules"><li><b>Vider</b> reprend tous tes jetons, <b>Annuler</b> le dernier, <b>Répéter</b> remet les mises du tour d’avant, <b>×2</b> double tout.</li><li><b>Lancer</b> sans jeton sur la table rejoue les mises du tour d’avant.</li><li>Le tableau lumineux montre les derniers numéros : touche-le pour les statistiques.</li></ul>`);
  }
}

return { RouletteGame };
})();
