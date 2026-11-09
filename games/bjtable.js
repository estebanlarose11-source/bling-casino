// SpinBet Casino · table de blackjack commune — loaded on demand by games/impl/index.js (index.html), before
// Le 21 (blackjack.js), Le 21 Électrique (lightningbj.js) and Le 21 Online (bj-online.js), which only keep their rules.
// ---- games/impl/bjtable.js ----
__mods['games/impl/bjtable.js'] = (() => {
// Vue « table de casino » (demande du propriétaire, d'après une référence, couleurs à nous) : la table est un plan en
// perspective (.bjv-table, rotateX) vu depuis la place du joueur, la croupière debout derrière (tête hors du cadre, ses
// avant-bras et ses mains passent devant la table et distribuent), le rail de jetons et le sabot devant elle, les
// jetons à choisir posés sur le tapis devant le cercle de mise (toucher un jeton = le poser sur le cercle ; toucher un
// cercle = y poser le jeton choisi, mises annexes comprises), 4 grands boutons en bas avec l'avatar et le solde du
// joueur au milieu. La caméra s'approche du cercle pendant les mises et recule pour la partie.
// Tout ce qui est sur le tapis est en coordonnées du plan (W × H) ; les bulles de score et les plaques de résultat
// sont des « panneaux » redressés face au joueur (.bjv-up). Les 3 jeux étendent BjTableGame.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { sfx } = __mods['audio.js'];

let uid = 0;
// Chips in cents: [value, label, colour, edge inserts, text colour]. 5 of them are on the felt, chosen from the balance.
const CHIPS = [
  [100, '1', '#eef0f3', '#2b6cb0', '#1f2937'], [500, '5', '#c81e3a', '#fff', '#fff'], [2500, '25', '#138a52', '#fff', '#fff'],
  [10000, '100', '#17181c', '#e8c25a', '#e8c25a'], [50000, '500', '#6d28d9', '#fde68a', '#fff'], [100000, '1K', '#d9a520', '#5b3a00', '#3b2600'],
  [500000, '5K', '#0f7fb8', '#fff', '#fff'],
];
const MAXSTAKE = 1000000; // 10 000 KE
// Plane of the table (felt + rail) and the places on it.
const W = 1280, H = 830, CX = 640, TILT = 74;
const SHOE = { x: 1018, y: 150 }, DEALER = { x: CX, y: 126 }, HAND = { y: 446 }, SPOT = { x: CX, y: 590, r: 70 };
const PICK = [-184, -92, 0, 92, 184].map((dx) => ({ x: CX + dx, y: 716 - (dx * dx) / 640 }));
const CW = 88, CH = 124; // card size on the felt (other players' seats: MW × MH)
const MW = 62, MH = 88;
const DECO = [{ x: CX - 300, y: 520, r: 52 }, { x: CX + 300, y: 520, r: 52 }, { x: CX - 470, y: 330, r: 44 }, { x: CX + 470, y: 330, r: 44 }];
// other players' places (Le 21 Online): near left, near right, far left, far right
const SEATS = [{ x: CX - 296, y: 482 }, { x: CX + 296, y: 482 }, { x: CX - 440, y: 300 }, { x: CX + 440, y: 300 }];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], SUITS = ['♠', '♥', '♦', '♣'];
const isRed = (c) => c.s === '♥' || c.s === '♦';

const chipSVG = (c, size = 100) => {
  const [, t, col, ins, txt] = c;
  const r = 50, ticks = Array.from({ length: 8 }, (_, i) => `<rect x="45" y="1" width="10" height="13" rx="2" fill="${ins}" transform="rotate(${i * 45} 50 50)"/>`).join('');
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><circle cx="50" cy="50" r="${r}" fill="${col}"/><circle cx="50" cy="50" r="${r}" fill="url(#bjvChipShade)"/>${ticks}`
    + `<circle cx="50" cy="50" r="33" fill="none" stroke="${ins}" stroke-width="2" stroke-dasharray="4 3" opacity=".85"/><circle cx="50" cy="50" r="28" fill="${col}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>`
    + `<text x="50" y="${t.length > 2 ? 57 : 58}" text-anchor="middle" font-family="Archivo, Inter, sans-serif" font-weight="900" font-size="${t.length > 2 ? 21 : 24}" fill="${txt}">${t}</text></svg>`;
};

// The croupière: body behind the table (shoulders, vest, hair) and forearms + hands in front of it, same view box.
const DEALER_DEFS = `<defs>
  <linearGradient id="bjvSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3cfb4"/><stop offset="1" stop-color="#d9a17f"/></linearGradient>
  <linearGradient id="bjvSkinH" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d8c1"/><stop offset=".6" stop-color="#e2ad8b"/><stop offset="1" stop-color="#c98f6c"/></linearGradient>
  <linearGradient id="bjvShirt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7d8692"/><stop offset=".12" stop-color="#b7bfc9"/><stop offset=".26" stop-color="#e9edf2"/><stop offset=".5" stop-color="#f7f9fb"/><stop offset=".74" stop-color="#e3e8ee"/><stop offset=".88" stop-color="#aeb7c2"/><stop offset="1" stop-color="#737c88"/></linearGradient>
  <linearGradient id="bjvSleeve" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b94a0"/><stop offset=".35" stop-color="#d5dbe2"/><stop offset=".6" stop-color="#f1f4f7"/><stop offset="1" stop-color="#a3acb8"/></linearGradient>
  <linearGradient id="bjvVest" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#07080b"/><stop offset=".35" stop-color="#23252d"/><stop offset=".5" stop-color="#2c2f38"/><stop offset=".65" stop-color="#23252d"/><stop offset="1" stop-color="#07080b"/></linearGradient>
  <linearGradient id="bjvHair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a2a1a"/><stop offset=".5" stop-color="#2a160c"/><stop offset="1" stop-color="#120804"/></linearGradient>
  <linearGradient id="bjvTie" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9b1c33"/><stop offset="1" stop-color="#5a0d1c"/></linearGradient>
  <linearGradient id="bjvGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe7a1"/><stop offset=".5" stop-color="#d4a637"/><stop offset="1" stop-color="#8a6512"/></linearGradient>
</defs>`;
const DEALER_BODY = `<svg class="bjv-body" viewBox="0 0 600 640" aria-hidden="true">${DEALER_DEFS}
  <g class="bjv-breath">
    <path d="M262 -40 L338 -40 L342 74 Q300 100 258 74 Z" fill="url(#bjvSkin)"/>
    <path d="M262 52 Q300 82 338 52 L340 74 Q300 98 260 74 Z" fill="#b98466" opacity=".35"/>
    <path d="M300 64 L258 70 L176 96 Q104 116 94 200 L80 640 L520 640 L506 200 Q496 116 424 96 L342 70 Z" fill="url(#bjvShirt)"/>
    <path d="M172 128 C 162 230 166 360 176 470 M428 128 C 438 230 434 360 424 470" stroke="#5e6672" stroke-width="5" fill="none" opacity=".55"/>
    <path d="M120 300 Q 132 330 128 380 M 480 300 Q 468 330 472 380" stroke="#c3c9d2" stroke-width="2" fill="none"/>
    <path d="M238 92 L300 252 L362 92 L414 106 Q446 170 436 280 L426 640 L174 640 L164 280 Q154 170 186 106 Z" fill="url(#bjvVest)"/>
    <path d="M238 92 L300 252 L362 92" fill="none" stroke="url(#bjvGold)" stroke-width="2.5"/>
    <path d="M300 252 L300 640" stroke="#000" stroke-width="2" opacity=".55"/>
    <g fill="url(#bjvGold)"><circle cx="300" cy="300" r="6"/><circle cx="300" cy="352" r="6"/><circle cx="300" cy="404" r="6"/><circle cx="300" cy="456" r="6"/></g>
    <path d="M196 170 Q 214 176 228 172 M372 172 Q 386 176 404 170" stroke="#3a3d47" stroke-width="3" fill="none"/>
    <g transform="translate(346 150)"><rect width="62" height="18" rx="3" fill="url(#bjvGold)"/><text x="31" y="13" text-anchor="middle" font-family="Archivo, Inter, sans-serif" font-weight="900" font-size="10.5" fill="#3b2600" letter-spacing="1">SPINBET</text></g>
    <path d="M262 70 L300 90 L276 120 Z M338 70 L300 90 L324 120 Z" fill="#ffffff" stroke="#c7cdd6" stroke-width="1.5"/>
    <g><path d="M300 92 L266 78 Q258 92 266 108 Z M300 92 L334 78 Q342 92 334 108 Z" fill="url(#bjvTie)"/><rect x="292" y="84" width="16" height="16" rx="4" fill="#7a1428"/></g>
    <path class="bjv-hairL" d="M266 -60 C 214 -40 196 20 196 96 C 196 160 184 214 158 252 C 200 262 232 224 240 170 C 248 112 246 40 270 -20 Z" fill="url(#bjvHair)"/>
    <path d="M222 30 C 214 90 214 150 196 214" stroke="#6b3d22" stroke-width="3" fill="none" opacity=".6"/>
    <path class="bjv-hairR" d="M334 -60 C 386 -40 404 20 404 96 C 404 160 416 214 442 252 C 400 262 368 224 360 170 C 352 112 354 40 330 -20 Z" fill="url(#bjvHair)"/>
    <path d="M378 30 C 386 90 386 150 404 214" stroke="#6b3d22" stroke-width="3" fill="none" opacity=".6"/>
    <path d="M276 60 Q300 76 324 60" stroke="url(#bjvGold)" stroke-width="2" fill="none"/><circle cx="300" cy="74" r="4" fill="url(#bjvGold)"/>
  </g>
</svg>`;
const ARM = `
    <path d="M94 270 C 86 312 78 344 70 368 L 142 374 C 152 342 166 306 178 270 Z" fill="url(#bjvSleeve)"/>
    <path d="M112 300 C 104 330 96 350 90 366" stroke="#9aa3ae" stroke-width="3" fill="none"/>
    <path d="M68 364 L 144 372 L 142 390 L 64 382 Z" fill="#f4f6f9" stroke="#aeb6c1" stroke-width="2"/>
    <rect x="118" y="374" width="11" height="8" rx="2" fill="url(#bjvGold)"/>
    <path d="M70 386 C 72 404 100 418 130 416 C 154 414 168 406 162 394 C 174 392 176 382 166 378 C 158 370 142 370 134 378 C 118 372 92 374 74 382 Z" fill="url(#bjvSkinH)"/>
    <path d="M134 414 C 146 412 156 406 162 398 M 146 408 C 158 404 166 396 170 386 M 120 416 C 130 414 138 410 144 404" stroke="#b77c5c" stroke-width="2" fill="none" opacity=".75"/>
    <path d="M96 392 C 110 386 126 384 140 388" stroke="#c48b6a" stroke-width="2" fill="none" opacity=".5"/>`;
const DEALER_ARMS = `<svg class="bjv-arms" viewBox="0 0 600 640" aria-hidden="true">${DEALER_DEFS}
  <g class="bjv-arm l"><g transform="translate(0 94)">${ARM}</g></g>
  <g class="bjv-arm r"><g transform="translate(600 94) scale(-1 1)">${ARM}</g></g>
</svg>`;

// Felt, rail and everything printed on the table (plane coordinates).
const feltSVG = (o = {}) => `<svg class="bjv-felt" viewBox="-60 -30 1400 ${H + 60}" width="1400" height="${H + 60}" aria-hidden="true">
  <defs>
    <radialGradient id="bjvFelt" cx="50%" cy="10%" r="95%"><stop offset="0" stop-color="#22a77a"/><stop offset=".4" stop-color="#178a64"/><stop offset=".75" stop-color="#0f6a4d"/><stop offset="1" stop-color="#0a4f3a"/></radialGradient>
    <linearGradient id="bjvRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2e"/><stop offset=".5" stop-color="#121215"/><stop offset="1" stop-color="#050506"/></linearGradient>
    <linearGradient id="bjvMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe4e9"/><stop offset=".5" stop-color="#8d97a1"/><stop offset="1" stop-color="#4b535b"/></linearGradient>
    <radialGradient id="bjvSpot" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#fff8dc" stop-opacity=".16"/><stop offset=".6" stop-color="#fff8dc" stop-opacity=".05"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></radialGradient>
    <pattern id="bjvWeave" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6 L6 0" stroke="rgba(255,255,255,.035)" stroke-width="1"/></pattern>
    <path id="bjvT1" d="M290 262 Q640 432 990 262"/><path id="bjvT2" d="M356 306 Q640 452 924 306"/>
  </defs>
  <path d="M-40 -14 L1320 -14 L1320 0 A680 830 0 0 1 -40 0 Z" fill="url(#bjvRail)"/>
  <path d="M-40 0 A680 830 0 0 0 1320 0" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
  <path d="M-8 0 A648 792 0 0 0 1288 0" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="10"/>
  <path d="M36 0 A604 744 0 0 0 1244 0 Z" fill="url(#bjvGold)"/>
  <path d="M40 0 A600 740 0 0 0 1240 0 Z" fill="url(#bjvFelt)"/>
  <path d="M40 0 A600 740 0 0 0 1240 0 Z" fill="url(#bjvWeave)"/>
  <path d="M40 0 A600 740 0 0 0 1240 0 Z" fill="url(#bjvSpot)"/>
  <rect x="20" y="-22" width="1240" height="22" rx="4" fill="#111114"/><rect x="20" y="-4" width="1240" height="4" fill="url(#bjvGold)"/>
  <g fill="none" stroke="#e7c766" stroke-opacity=".55">
    <path d="M118 0 A522 650 0 0 0 1162 0" stroke-width="3"/>
    <path d="M128 0 A512 640 0 0 0 1152 0" stroke-width="1.2"/>
  </g>
  <g font-family="Cinzel, Georgia, serif" fill="#f6dc8a" fill-opacity=".95">
    <text font-size="40" font-weight="900" letter-spacing="4"><textPath href="#bjvT1" startOffset="50%" text-anchor="middle">${o.t1 || 'LE BLACKJACK PAIE 6 POUR 5'}</textPath></text>
    <text font-size="21" font-weight="700" letter-spacing="2" fill-opacity=".7"><textPath href="#bjvT2" startOffset="50%" text-anchor="middle">${o.t2 || 'LA CROUPIÈRE TIRE À 16 ET RESTE À 17'}</textPath></text>
  </g>
  ${(o.deco || DECO).map((d) => `<circle cx="${d.x}" cy="${d.y}" r="${d.r}" fill="none" stroke="#e7c766" stroke-opacity=".5" stroke-width="3"/>${d.r > 46 ? `<text x="${d.x}" y="${d.y + 5}" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="700" font-size="14" fill="#e7c766" fill-opacity=".45">SPINBET</text>` : ''}`).join('')}
  ${(o.sides || []).map((d) => `<circle cx="${d.x}" cy="${d.y}" r="${d.r + 7}" fill="none" stroke="#e7c766" stroke-opacity=".35" stroke-width="2"/><circle cx="${d.x}" cy="${d.y}" r="${d.r}" fill="rgba(0,0,0,.16)" stroke="${d.c || '#f0d27a'}" stroke-opacity=".85" stroke-width="3.5"/>`
    + `<text x="${d.x}" y="${d.y - d.r - 14}" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="900" font-size="${d.name.length > 10 ? 15 : 18}" letter-spacing="1.5" fill="${d.c || '#f0d27a'}" fill-opacity=".85">${d.name}</text>`
    + `<text x="${d.x}" y="${d.y + d.r + 22}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="13" fill="#f0d27a" fill-opacity=".6">${d.sub || ''}</text>`).join('')}
  <circle cx="${SPOT.x}" cy="${SPOT.y}" r="${SPOT.r + 10}" fill="none" stroke="#e7c766" stroke-opacity=".35" stroke-width="2"/>
  <circle cx="${SPOT.x}" cy="${SPOT.y}" r="${SPOT.r}" fill="rgba(0,0,0,.14)" stroke="#f0d27a" stroke-opacity=".9" stroke-width="4"/>
  <text x="${SPOT.x}" y="${SPOT.y - SPOT.r - 18}" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="900" font-size="20" letter-spacing="3" fill="#f0d27a" fill-opacity=".7">MISE</text>
  <g transform="translate(${CX - 190} 10)">
    <rect width="380" height="88" rx="10" fill="url(#bjvMetal)"/><rect x="8" y="8" width="364" height="72" rx="6" fill="#1b1f24"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const c = [CHIPS[1], CHIPS[2], CHIPS[3], CHIPS[4], CHIPS[5], CHIPS[6], CHIPS[0], CHIPS[1]][i], x = 14 + i * 44.5;
      return `<g transform="translate(${x} 12)"><rect width="38" height="64" rx="16" fill="${c[2]}"/><rect width="38" height="64" rx="16" fill="url(#bjvRackShade)"/>${Array.from({ length: 8 }, (_, k) => `<rect x="${k % 2 ? 4 : 26}" y="${4 + k * 7.6}" width="8" height="2.4" fill="${c[3]}" opacity=".9"/>`).join('')}</g>`;
    }).join('')}
    <linearGradient id="bjvRackShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".45" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
  </g>
</svg>`;
const SHOE_SVG = `<svg viewBox="0 0 150 120" aria-hidden="true">
  <path d="M8 112 L142 112 L142 100 L8 100 Z" fill="#1c1d22"/><path d="M8 100 L142 100 L142 96 L8 96 Z" fill="url(#bjvGold)"/>
  <path d="M14 96 L136 96 L136 34 Q 120 14 92 14 L14 14 Z" fill="rgba(30,34,44,.78)" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
  <g fill="#7a1428" stroke="#e7c766" stroke-width="1">${Array.from({ length: 9 }, (_, i) => `<rect x="${24 + i * 9}" y="${30 + i * 0.5}" width="12" height="62" rx="2"/>`).join('')}</g>
  <path d="M100 96 L136 96 L136 34 Q 124 20 104 18 Z" fill="rgba(255,255,255,.12)"/>
  <path d="M16 18 L60 18" stroke="rgba(255,255,255,.5)" stroke-width="2"/>
</svg>`;
const DISCARD_SVG = `<svg viewBox="0 0 90 100" aria-hidden="true"><path d="M6 94 L84 94 L84 20 L6 20 Z" fill="rgba(200,220,240,.16)" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
  <g fill="#7a1428" stroke="#e7c766" stroke-width="1">${Array.from({ length: 5 }, (_, i) => `<rect x="14" y="${84 - i * 5}" width="62" height="8" rx="1.5"/>`).join('')}</g></svg>`;

const ROOM_BG = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#3d1020"/><path d="M60 0 L120 60 L60 120 L0 60 Z" fill="none" stroke="#5e2231" stroke-width="2"/><path d="M60 22 L98 60 L60 98 L22 60 Z" fill="#46142a" stroke="#74352f" stroke-width="1.5"/><circle cx="60" cy="60" r="10" fill="none" stroke="#a06a3a" stroke-width="2"/><circle cx="60" cy="60" r="3" fill="#a06a3a"/><circle cx="0" cy="0" r="6" fill="#5e2231"/><circle cx="120" cy="0" r="6" fill="#5e2231"/><circle cx="0" cy="120" r="6" fill="#5e2231"/><circle cx="120" cy="120" r="6" fill="#5e2231"/></svg>')}")`;
const CHIP_SHADE = '<svg class="bjv-defs" width="0" height="0" aria-hidden="true"><defs><radialGradient id="bjvChipShade" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient></defs></svg>';
const spotHTML = (t, x, y, r, label) => `<button class="bjv-spot${t === 'main' ? ' main' : ' bjv-sb'}" data-t="${t}" style="left:${x}px;top:${y}px;--d:${(r + 5) * 2}px" aria-label="Poser le jeton choisi sur ${label}"><span class="bjv-stack"></span><b class="bjv-up bjv-amt" hidden></b><b class="bjv-up bjv-sres" hidden></b></button>`;

// o: { t1, t2 (texts printed on the felt), sides: [{ id, name, sub, x, y, r, c }] (side bets), seats: true (other
// players' places), overlay: HTML over the scene (screen space) }
function tableHTML(o = {}) {
  const sides = o.sides || [];
  const deco = DECO.filter((d) => !sides.some((s) => Math.hypot(s.x - d.x, s.y - d.y) < 120) && !(o.seats && d));
  return `<div class="bjv" data-cam="bet" data-phase="bet" style="--tilt:${TILT}deg">
    <div class="bjv-world">
      <div class="bjv-room" style="background-image:${ROOM_BG}"></div>
      <div class="bjv-glow"></div>
      <div class="bjv-dealer">${DEALER_BODY}</div>
      <div class="bjv-persp"><div class="bjv-table">
        ${feltSVG({ ...o, deco })}
        ${CHIP_SHADE}
        <div class="bjv-up bjv-discard" style="left:262px;top:120px">${DISCARD_SVG}</div>
        <div class="bjv-up bjv-shoe" style="left:${SHOE.x}px;top:${SHOE.y}px">${SHOE_SVG}</div>
        <div class="bjv-dcards" style="left:${DEALER.x}px;top:${DEALER.y}px"><div class="bjv-up bjv-bub d" hidden></div></div>
        ${o.seats ? SEATS.map((p, i) => `<div class="bjv-seat" data-s="${i}" data-mini="1" style="left:${p.x}px;top:${p.y}px"><div class="bjv-up bjv-tag" hidden></div><div class="bjv-up bjv-bub" hidden></div><div class="bjv-up bjv-res" hidden></div></div>`).join('') : ''}
        <div class="bjv-hands"></div>
        ${spotHTML('main', SPOT.x, SPOT.y, SPOT.r, 'le cercle de mise')}
        ${sides.map((s) => spotHTML(s.id, s.x, s.y, s.r, s.name)).join('')}
        ${PICK.map((p, i) => `<button class="bjv-pick" data-pick="${i}" style="left:${p.x}px;top:${p.y}px"></button>`).join('')}
        <i class="bjv-mark" data-m="edge" style="left:${CX}px;top:0"></i><i class="bjv-mark" data-m="cards" style="left:${CX}px;top:${HAND.y - 120}px"></i><i class="bjv-mark" data-m="pick" style="left:${CX}px;top:${PICK[2].y + 46}px"></i>
      </div></div>
      <div class="bjv-dealer front">${DEALER_ARMS}</div>
    </div>
    <div class="bjv-shade"></div>
    <div class="bjv-top">
      <button class="bjv-sq" data-act="menu" aria-label="Menu et règles"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
      <div class="bjv-meter"><small>Mise</small><b class="bjv-m-bet"></b></div><div class="bjv-meter"><small>Gain</small><b class="bjv-m-win"></b></div>
      <div class="bjv-state"><i></i><b>FAITES VOS JEUX</b></div>
      <button class="bjv-sq bjv-full" data-act="full" aria-label="Plein écran">⛶<span>Plein écran</span></button>
    </div>
    <div class="bjv-msg"></div>
    ${o.overlay || ''}
    <div class="bjv-turn">📱 Tourne ton téléphone pour voir toute la table</div>
    <div class="bjv-hud">
      <button class="bjv-b" data-b="0"></button><button class="bjv-b" data-b="1"></button>
      <div class="bjv-me"><span class="bjv-av"></span><b class="bjv-name"></b><em class="bjv-bal"></em></div>
      <button class="bjv-b" data-b="2"></button><button class="bjv-b" data-b="3"></button>
    </div>
  </div>`;
}

// Online cards are numbers 0..51 (suit = floor / 13, rank = % 13): same look as the solo cards.
const fromIndex = (i, id) => ({ r: RANKS[i % 13], s: SUITS[Math.floor(i / 13) % 4], id });

class BjTableGame extends BaseGame {
  // cfg: the BaseGame options (music, mainLabel…), o: the table (see tableHTML), key: localStorage key of the stake
  constructor(root, game, cfg, o = {}) {
    super(root, game, { autoplay: false, stepper: false, betLabel: 'Mise', ...cfg, cls: `table-game bj bjv-game ${cfg.cls || ''}`, stage: tableHTML(o) });
    this.o = o;
    this.view = this.q('.bjv');
    this.world = this.q('.bjv-world');
    this.table = this.q('.bjv-table');
    this.msgEl = this.q('.bjv-msg');
    this.bets = { ...Object.fromEntries((o.sides || []).map((s) => [s.id, 0])), main: this.bet };
    this.pickI = 0;
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-b]');
      if (b && !b.disabled) { this.wake(); this.button(b.dataset.k); return; }
      const p = e.target.closest('[data-pick]');
      if (p && !p.disabled) { this.wake(); this.pick(+p.dataset.pick); return; }
      const s = e.target.closest('.bjv-spot');
      if (s) { this.wake(); this.placeChip(s.dataset.t); }
    });
    this.ro = new ResizeObserver(() => this.camera(false));
    this.ro.observe(this.view);
    requestAnimationFrame(() => { this.measure(); this.camera(false); });
    this.idleT = setInterval(() => { if (!document.hidden && this.betting()) this.dealerDo('idle', 1400); }, 9000);
  }
  wake() { sfx.unlock(); this.music?.start?.(); }
  destroy() { clearInterval(this.idleT); this.ro?.disconnect(); super.destroy(); }

  /* ---------- to be completed by each game ---------- */
  betting() { return this.phase === 'bet' || this.phase === 'end'; }
  // what the bets cost (Le 21 Électrique adds its lightning fee)
  costOf(b = this.bets) { return Object.values(b).reduce((a, x) => a + (x || 0), 0); }
  // 4 buttons: [icon, label, key]; can(key) = enabled; onButton(key) for the game's own keys
  buttons() { return [['×2', 'DOUBLER', 'x2'], ['', 'VIDER', 'clear'], ['', 'RÉPÉTER', 'repeat'], ['', 'DISTRIBUER', 'deal']]; }
  can(k) { return this.canBetKey(k); }
  onButton(k) { if (k === 'deal') this.onMain(); }
  inPlayStake() { return this.lastStake || 0; }
  onBetsChanged() {}

  /* ---------- camera ---------- */
  // World positions of a few places, measured once with no camera (the table is drawn in 3D by the browser).
  measure() {
    const w = this.world, keep = w.style.transform;
    w.style.transition = 'none'; w.style.transform = 'none';
    const o = w.getBoundingClientRect(), r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left - o.left, y: b.top - o.top, w: b.width, h: b.height, b: b.bottom - o.top }; };
    this.M = { edge: r(this.q('[data-m="edge"]')), dealer: r(this.q('.bjv-dealer svg')), cards: r(this.q('[data-m="cards"]')), pick: r(this.q('[data-m="pick"]')), spot: r(this.q('.bjv-spot.main')) };
    w.style.transform = keep; void w.offsetWidth; w.style.transition = '';
  }
  camera(animate = true) {
    const v = this.view, M = this.M; if (!v || !M) return;
    const cw = v.clientWidth; let ch = v.clientHeight; if (!cw || !ch) return;
    const hud = this.q('.bjv-hud').offsetHeight || 70, top = 34, wide = cw / ch > 1.15;
    const bet = v.dataset.cam === 'bet', more = this.o.seats ? (cw / ch > 1.15 ? 1.1 : 1.3) : 1;
    // focus: what must be seen. Bottom = the chips on the felt (bets) or the circle (play), just above the buttons.
    const cx = M.spot.x + M.spot.w / 2;
    const y2 = bet ? M.pick.y : M.spot.b + 10;
    const y1 = bet ? M.edge.y + 30 : M.dealer.y + M.dealer.h * 0.12;
    const fw = (bet ? (wide ? 760 : 470) : (wide ? 860 : 540)) * (bet && this.o.sides ? 1.08 : more);
    // not in full screen, the scene is as tall as needed: no empty room above the croupière (her head is out of frame)
    const full = !!this.root.closest('.is-full');
    if (!full) {
      const want = wide ? Math.round(Math.max(420, Math.min(cw / 1.95, innerHeight * 0.82)))
        : Math.round(top + hud + (M.spot.b + 10 - (M.dealer.y + M.dealer.h * 0.12)) * (cw / (540 * more)));
      if (Math.abs(v.clientHeight - want) > 2) { v.style.height = `${want}px`; ch = want; }
    } else if (v.style.height) { v.style.height = ''; ch = v.clientHeight; }
    const neck = M.dealer.y + M.dealer.h * 0.09;
    let s = Math.min(cw / fw, (ch - hud - top) / (y2 - y1));
    s = Math.max(s, Math.min((ch - hud - top) / ((bet ? M.pick.y : y2) - neck), cw / 380));
    const tx = cw / 2 - cx * s, ty = ch - hud - y2 * s;
    this.world.style.transition = animate ? '' : 'none';
    this.world.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    if (!animate) { void this.world.offsetWidth; this.world.style.transition = ''; }
  }
  setCam(k) { if (this.view.dataset.cam === k) return; this.view.dataset.cam = k; this.camera(true); }

  msg(t) {
    if (this.dead || !this.msgEl) return;
    this.msgEl.innerHTML = t; this.msgEl.classList.add('show');
    clearTimeout(this.msgT); this.msgT = setTimeout(() => this.msgEl?.classList.remove('show'), 4500);
  }
  dealerDo(cls, ms) {
    const d = this.view; d.classList.remove(cls); void d.offsetWidth; d.classList.add(cls);
    clearTimeout(this['t_' + cls]); this['t_' + cls] = setTimeout(() => d.classList.remove(cls), ms);
  }
  setState(c, t) { const S = this.q('.bjv-state'); if (S) { S.dataset.s = c; S.querySelector('b').textContent = t; } }

  /* ---------- bets & chips ---------- */
  get bet() { return this.bets ? this.bets.main : this.loadStake(); }
  set bet(v) { if (this.bets) this.bets.main = v; }
  get stake() { return this.bets?.main || 0; }
  get stakeKey() { return `bjx_stake${this.game.id === 'blackjack' ? '' : '_' + this.game.id}`; }
  loadStake() { let v = 100; try { v = Math.max(100, Math.min(MAXSTAKE, +localStorage.getItem(this.stakeKey) || 100)); } catch { /* ignore */ } return v; }
  saveStake() { try { if (this.bets.main) localStorage.setItem(this.stakeKey, String(this.bets.main)); } catch { /* ignore */ } }
  // the 5 chips on the felt: the window of CHIPS that fits the balance best
  picks() {
    const bal = this.balC();
    let top = CHIPS.findIndex((c) => c[0] > bal); if (top < 0) top = CHIPS.length;
    const end = Math.max(5, Math.min(CHIPS.length, top));
    return CHIPS.slice(end - 5, end);
  }
  paintPicks() {
    const P = this.picks(), key = P.map((c) => c[1]).join();
    if (key !== this.pickKey) {
      this.pickKey = key;
      this.qa('[data-pick]').forEach((b, i) => { b.innerHTML = chipSVG(P[i], 100); b.dataset.v = P[i][0]; b.setAttribute('aria-label', `Jeton ${P[i][1]}`); });
    }
    const betting = this.betting(), free = this.balC() - this.costOf();
    this.qa('[data-pick]').forEach((b, i) => { b.classList.toggle('on', i === this.pickI); b.disabled = !betting || (+b.dataset.v > free && i !== this.pickI); });
  }
  pick(i) {
    if (!this.betting()) return;
    this.pickI = i; this.paintPicks();
    this.placeChip('main');
  }
  maxFor(t) { return t === 'main' ? MAXSTAKE : (this.o.sideMax || MAXSTAKE); }
  placeChip(t = 'main') {
    if (!this.betting() || !(t in this.bets)) return;
    const v = +this.q(`[data-pick="${this.pickI}"]`).dataset.v;
    if (this.phase === 'end') this.clearForBet();
    const next = { ...this.bets, [t]: this.bets[t] + v };
    const spot = this.q(`.bjv-spot[data-t="${t}"]`);
    if (next[t] > this.maxFor(t)) { this.msg(`Mise maximum ici : ${fmtC(this.maxFor(t))}`); this.shake(spot); return; }
    if (this.costOf(next) > this.balC()) { this.msg('Solde insuffisant pour ce jeton : choisis-en un plus petit'); this.shake(spot); return; }
    this.setCam('bet');
    // the chip slides on the felt from its place to the circle
    const p = PICK[this.pickI], fly = document.createElement('i');
    fly.className = 'bjv-flychip'; fly.innerHTML = chipSVG(CHIPS.find((c) => c[0] === v), 100);
    fly.style.left = `${p.x}px`; fly.style.top = `${p.y}px`;
    this.table.appendChild(fly);
    const tx = parseFloat(spot.style.left), ty = parseFloat(spot.style.top);
    const dx = tx - p.x, dy = ty - p.y, z = 8 + Math.min(10, this.split(this.bets[t]).length) * 7;
    fly.animate([{ transform: 'translate(-50%,-50%) translateZ(4px)' }, { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${dy / 2}px)) translateZ(70px)`, offset: 0.5 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) translateZ(${z}px)` }],
      { duration: this.turbo ? 220 : 340, easing: 'cubic-bezier(.3,.7,.4,1)' }).finished.then(() => fly.remove());
    sfx.click();
    this.bets = next; // counted at once (several quick taps add up), drawn when the chip lands
    if (t === 'main') this.saveStake();
    setTimeout(() => { sfx.coin?.(); this.betsChanged(); }, this.turbo ? 200 : 320);
  }
  setBets(b) { this.bets = { ...this.bets, ...b }; this.saveStake(); this.betsChanged(); }
  betsChanged() { this.onBetsChanged(); this.paintStacks(); this.updateMeters(); this.renderActions(); }
  split(v) { const out = []; for (let k = CHIPS.length - 1; k >= 0; k--) while (v >= CHIPS[k][0] && out.length < 40) { out.push(CHIPS[k][0]); v -= CHIPS[k][0]; } return out.reverse(); }
  // each circle: its bet in the biggest chips (12 discs at most), with its amount above
  paintStacks() {
    this.qa('.bjv-spot').forEach((sp) => {
      const t = sp.dataset.t, v = this.bets[t] || 0, st = sp.querySelector('.bjv-stack');
      const chips = this.split(v).sort((a, b) => b - a).slice(0, 12), key = chips.join();
      if (st.dataset.k !== key) { st.dataset.k = key; st.innerHTML = chips.map((c, k) => `<i style="--k:${k};--r:${((k * 47) % 11) - 5}deg">${chipSVG(CHIPS.find((x) => x[0] === c), 100)}</i>`).join(''); }
      const a = sp.querySelector('.bjv-amt'); a.hidden = !v; a.textContent = fmtC(v); a.style.setProperty('--z', `${chips.length * 7 + 40}px`);
    });
    this.paintMe();
  }
  paintMe() {
    const prof = __mods['profile.js']?.profiles?.current, look = __mods['shop.js']?.publicLook?.(prof);
    const av = this.q('.bjv-av'), html = look ? __mods['shop.js']?.lookHTML?.(look, 'md') : '';
    const name = String(prof?.name || 'Invité').slice(0, 16), k = `${html}|${name}`;
    if (av && av.dataset.k !== k) { av.dataset.k = k; av.innerHTML = html || `<span class="bjv-ini">${name.charAt(0).toUpperCase()}</span>`; this.q('.bjv-name').textContent = name; }
    const bal = this.q('.bjv-bal'); if (bal) bal.textContent = fmtC(this.balC());
    const mb = this.q('.bjv-m-bet'); if (mb) mb.textContent = fmtC(this.betting() ? this.costOf() : this.inPlayStake());
    const mw = this.q('.bjv-m-win'); if (mw) mw.textContent = fmtC(this.lastPay || 0);
  }
  // betting helpers of the 4 buttons
  canBetKey(k) {
    const b = this.betting(), any = this.costOf() > 0;
    if (k === 'x2') return b && any && this.bets.main < MAXSTAKE && this.costOf(this.doubled()) <= this.balC() && this.costOf(this.doubled()) > this.costOf();
    if (k === 'clear') return b && any;
    if (k === 'repeat') return b && !!this.lastBets && JSON.stringify(this.lastBets) !== JSON.stringify(this.bets);
    if (k === 'rebet') return b;
    return false;
  }
  doubled() { return Object.fromEntries(Object.entries(this.bets).map(([k, v]) => [k, Math.min(this.maxFor(k), v * 2)])); }
  button(k) {
    if (['x2', 'clear', 'repeat', 'rebet'].includes(k)) {
      if (!this.betting()) return;
      if (this.phase === 'end') this.clearForBet();
      if (k === 'clear') { this.setBets(Object.fromEntries(Object.keys(this.bets).map((x) => [x, 0]))); this.msg('Table vidée : choisis un jeton.'); }
      if (k === 'x2') this.setBets(this.doubled());
      if (k === 'repeat' && this.lastBets) { let b = { ...this.lastBets }; if (this.costOf(b) > this.balC()) b = { main: Math.min(this.lastBets.main, this.balC()) }; this.setBets(b); }
      if (k === 'rebet') { this.msg('Change ta mise avec les jetons.'); this.renderActions(); }
      this.setCam('bet'); sfx.click();
      return;
    }
    this.onButton(k);
  }
  // paints the 4 buttons, the state of the table and the chips
  paintHud() {
    const B = this.buttons();
    this.qa('[data-b]').forEach((b, i) => {
      const [ico, label, k] = B[i] || ['', '', ''];
      const html = `${ico ? `<i>${ico}</i>` : ''}<span>${label}</span>`;
      if (b.dataset.h !== html) { b.dataset.h = html; b.innerHTML = html; }
      b.disabled = !k || !this.can(k); b.classList.toggle('go', k === 'deal' || k === 'ready'); b.dataset.k = k;
    });
    this.view.dataset.phase = this.betting() ? (this.phase === 'end' ? 'end' : 'bet') : 'play';
    this.paintPicks();
    this.paintStacks();
  }
  clearForBet() { this.clearTable(); this.phase = 'bet'; }
  clearTable() {
    this.q('.bjv-hands').innerHTML = '';
    this.qa('.bjv-dcards .bjv-card, .bjv-seat .bjv-card').forEach((c) => c.remove());
    this.qa('.bjv-bub, .bjv-res, .bjv-sres, .bjv-seat .bjv-tag').forEach((e) => { e.hidden = true; });
    this.qa('.bjv-dcards, .bjv-seat, .bjv-hand').forEach((r) => { r.dataset.cards = ''; });
    this.view.classList.remove('done');
  }
  // the table is ready for a new deal: cards of the last hand go, the camera goes back
  newDeal() { this.clearTable(); this.lastBets = { ...this.bets }; this.setCam('play'); }

  /* ---------- cards on the felt ---------- */
  cardEl(c) {
    const face = 'JQK'.includes(c.r);
    const d = document.createElement('div');
    d.className = 'bjv-card down' + (isRed(c) ? ' red' : '');
    d.dataset.id = c.id ?? ++uid;
    const mid = face ? `<span class="fc"><b>${c.r}</b><i>${c.s}</i></span>` : c.r === 'A' ? `<span class="ace">${c.s}</span>` : `<span class="mid">${c.s}</span>`;
    d.innerHTML = `<div class="bjv-lean"><div class="bjv-in"><div class="bjv-f"><span class="tl">${c.r}<i>${c.s}</i></span>${mid}<span class="br">${c.r}<i>${c.s}</i></span></div><div class="bjv-k"></div></div></div>`;
    return d;
  }
  // card i of n in a row: [left, top] inside its row (centred), slightly fanned like on a real table
  slot(i, n, row) {
    const dealer = row.classList.contains('bjv-dcards'), mini = !!row.dataset.mini, w = mini ? MW : CW;
    const sp = dealer ? 50 : mini ? 26 : 40, dy = dealer ? 3 : mini ? 5 : 7;
    return [i * sp - ((n - 1) * sp) / 2 - w / 2, i * dy, w];
  }
  layout(row) {
    const cards = [...row.querySelectorAll(':scope > .bjv-card')];
    cards.forEach((c, i) => { const [x, y] = this.slot(i, cards.length, row); c.style.left = `${x}px`; c.style.top = `${y}px`; c.style.zIndex = i + 1; });
    const bub = row.querySelector(':scope > .bjv-bub');
    if (bub && cards.length) { const [x, , w] = this.slot(cards.length - 1, cards.length, row); bub.style.left = `${x + w + (row.dataset.mini ? 20 : 30)}px`; }
  }
  // deals card c (from the shoe) into a row (the croupière's, a hand of the player, a seat)
  async deal(row, c, down = false, to = 'p') {
    const node = this.cardEl(c);
    row.appendChild(node);
    this.layout(row);
    const rx = parseFloat(row.style.left) || 0, ry = parseFloat(row.style.top) || 0;
    const tx = rx + parseFloat(node.style.left), ty = ry + parseFloat(node.style.top);
    const dx = SHOE.x - CW / 2 - tx, dy = SHOE.y - ty;
    const t = this.turbo ? 230 : 420;
    node.animate([{ transform: `translate3d(${dx}px, ${dy}px, 30px) rotateZ(-70deg)`, opacity: 0.6 }, { transform: `translate3d(${dx * 0.35}px, ${dy * 0.35}px, 26px) rotateZ(-12deg)`, opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }],
      { duration: t, easing: 'cubic-bezier(.25,.75,.3,1)' });
    sfx.click();
    this.dealerDo(to === 'd' ? 'dealD' : 'dealP', t + 120);
    if (!down) setTimeout(() => node.classList.remove('down'), t * 0.55);
    await this.wait(t + 60);
    return node;
  }
  // a row of cards drawn at once (no flight: cards already on the table, e.g. coming back to an online hand)
  putCards(row, cards) {
    row.querySelectorAll(':scope > .bjv-card').forEach((c) => c.remove());
    cards.forEach((c) => { const n = this.cardEl(c); n.classList.toggle('down', !!c.down); row.appendChild(n); });
    this.layout(row);
  }
  dealerRow() { return this.q('.bjv-dcards'); }
  handEl(i) { return this.q('.bjv-hands').children[i]; }
  buildHand() {
    const el = document.createElement('div');
    el.className = 'bjv-hand';
    el.innerHTML = '<div class="bjv-up bjv-bub" hidden></div><div class="bjv-up bjv-res" hidden></div>';
    this.q('.bjv-hands').appendChild(el);
    return el;
  }
  placeHands(n) {
    [...this.q('.bjv-hands').children].forEach((el, i) => { el.style.left = `${CX + (n === 2 ? (i ? 150 : -150) : 0)}px`; el.style.top = `${HAND.y}px`; this.layout(el); });
  }
  seatEl(i) { return this.q(`.bjv-seat[data-s="${i}"]`); }
  bubble(el, t, cls = '') { if (!el) return; el.hidden = !t; el.innerHTML = t; el.className = `bjv-up bjv-bub ${el.classList.contains('d') ? 'd ' : ''}${cls}`; }
  result(el, k, t) { if (!el) return; el.hidden = !t; if (t) { el.className = `bjv-up bjv-res ${k}`; el.innerHTML = t; } }
  sideResult(t, k, text) { const e = this.q(`.bjv-spot[data-t="${t}"] .bjv-sres`); if (!e) return; e.hidden = !text; if (text) { e.className = `bjv-up bjv-sres ${k}`; e.innerHTML = text; } }
}

return { BjTableGame, CHIPS, MAXSTAKE, CX, SPOT, HAND, RANKS, SUITS, fromIndex, chipSVG };
})();
