// Réglages des miniatures (tools/covers/shots.js) : un bel instant de chaque jeu.
// G = l'expression qui donne le jeu ouvert (pages/game.js → currentGame()).
const BJ_HIDE = '.bjv-msg,.bjx-snd{display:none!important}';
// les cartes sortent du sabot par la fin (shoe.pop) : on pose les cartes voulues au bout, dans l'ordre inverse de la donne
const stack = (G, cards) => `(() => { const g = ${G}; g.shoe.push(...${JSON.stringify(cards)}.reverse().map(([r, s]) => ({ r, s }))); g.bets.main = 2500; g.onMain(); })()`;

// Le Poulet : la voie est tirée 380 ms après AVANCER ; pendant ce temps le hasard est poussé vers « pas de voiture »
const SAFE_STEP = (G) => `(() => { const r = Math.random; Math.random = () => 0.97; ${G}.step(); setTimeout(() => { Math.random = r; }, 700); })()`;

module.exports = (G) => ({
  // Le 21 : blackjack servi (A + K) devant la croupière
  blackjack: {
    mode: 'pc', rect: '.bjx-vp video', box: [0.21, 0, 0.58], hide: BJ_HIDE,
    steps: [{ click: '.bjv-full' }, { wait: 800 }, { eval: stack(G, [['A', '♠'], ['9', '♣'], ['K', '♥'], ['7', '♦']]) }, { wait: 7500 }],
  },
  lightningbj: {
    mode: 'pc', rect: '.bjx-vp video', box: [0.06, 0.05, 0.68], hide: BJ_HIDE,
    steps: [{ click: '.bjv-full' }, { wait: 800 }, { eval: stack(G, [['K', '♦'], ['6', '♠'], ['Q', '♥'], ['10', '♣']]) }, { wait: 7500 }],
  },
  // La Bataille : ton As contre son 7
  bataille: {
    mode: 'pc', rect: '.bjx-vp video', box: [0.22, 0.05, 0.56], hide: BJ_HIDE + '.btl-serie{display:none!important}',
    steps: [{ click: '.bjv-full' }, { wait: 800 }, { eval: stack(G, [['A', '♥'], ['7', '♣']]) }, { wait: 6600 }],
  },
  // La Roulette : la croupière, la roue qui tourne et les jetons sur le tapis (vidéo du téléphone, en hauteur)
  roulette: {
    mode: 'phone', rect: '.rlx-v', box: [0, 0, 1], hide: '.rl-tip,.rlx-snd,.rlx-led{display:none!important}',
    steps: [{ eval: `["n17", "n23", "n8", "n32", "n0"].forEach((k) => document.querySelector('.rlx-cell[data-k=' + k + ']')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))` }, { wait: 300 }, { eval: `${G}.onMain()` }, { wait: 3200 }],
  },
  // La Roue Folle : la présentatrice du Plateau Live devant le mur de canards du Tir aux Cibles (multiplicateurs affichés)
  madwheel: {
    mode: 'pc', dpr: 3, rect: '.mwb', fit: [0.64, 0.5], hide: '.mwb-snd{display:none!important}',
    steps: [{ eval: `(() => { const g = ${G}; g.board.chip = 10; g.round(async () => { await g.onBuy('ch'); }); })()` }, { wait: 10600 }],
  },
  // Le Speedball : la présentatrice, la sphère, le tableau en arc qui se remplit et le SPEEDBALL
  speedball: {
    mode: 'pc', dpr: 3, rect: '.sbx-art', fit: [0.42, 0.5], hide: '.sbx-snd{display:none!important}',
    steps: [{ click: '.sb-buy [data-n="5"]' }, { wait: 1600 }, { eval: `${G}.onMain()` }, { wait: 3900 }],
  },
  // La Pêche : la présentatrice, la main sur sa roue de glace (9,3 s de sa vidéo), et les éclairs sur notre roue
  // (serveur qui répond aux requêtes « Range » pour que la vidéo puisse avancer : SHOTS_URL=…)
  peche: {
    mode: 'pc', dpr: 3, rect: '.pex', fit: [0.36, 0.5], hide: '.pe-big{display:none!important}',
    steps: [{ click: '.pe-spot.fr' }, { click: '.pe-spot.w' }, { eval: `(() => { const v = document.querySelector('.pex-vid'); v.pause(); v.currentTime = 9.3; })()` }, { wait: 900 }, { eval: `${G}.onMain()` }, { wait: 1650 }],
  },
  // ---- jeux rapides : l'écran du jeu en pleine action, comme sur un téléphone ----
  // Le Champ de Mines : les compteurs et 8 gemmes déjà retournées
  mines: {
    mode: 'phone', rect: '.slot-stage', col: -64,
    steps: [{ eval: `${G}.onMain()` }, { wait: 800 }, { eval: `(() => { const g = ${G}, safe = [...g.tiles.keys()].filter((i) => !g.bombs.includes(i)); [1, 3, 6, 8, 11, 13, 16, 19].forEach((k, j) => setTimeout(() => g.tiles[safe[k % safe.length]].click(), j * 260)); })()` }, { wait: 3200 }],
  },
  // L'Avion : un long vol (le hasard du décollage est poussé vers un long vol), l'avion haut dans le ciel
  avion: {
    mode: 'phone', rect: '.slot-stage', col: 0,
    steps: [{ eval: `(() => { const r = Math.random; Math.random = () => 0.995; try { ${G}.onMain(); } finally { Math.random = r; } })()` }, { wait: 9000 }],
  },
  // La Cascade : 6 billes qui tombent entre les clous
  plinko: {
    mode: 'phone', rect: '.slot-stage', col: 0,
    steps: [{ eval: `(() => { const g = ${G}; for (let k = 0; k < 6; k++) setTimeout(() => g.onMain(), k * 260); })()` }, { wait: 2600 }],
  },
  // Le Vortex : les anneaux et le ×1000 au centre
  vortex: { mode: 'phone', rect: '.slot-stage', col: -10 },
  // Le Casse : des coffres percés (billets, alarme, butin ×2)
  casse: {
    mode: 'phone', rect: '.cs-room', fit: [0.5, 0.5],
    steps: [{ eval: `${G}.onMain()` }, { wait: 900 }, { click: '[data-v="1"]' }, { wait: 1600 }, { click: '[data-v="4"]' }, { wait: 1600 }, { click: '[data-v="7"]' }, { wait: 1300 }],
  },
  // La Pièce : la pièce retombée, la série lancée
  pileface: {
    mode: 'phone', rect: '.pf-arena', fit: [0.5, 0.5],
    steps: [{ eval: `${G}.onMain()` }, { wait: 900 }, { click: '[data-pick="face"]' }, { wait: 2400 }],
  },
  // La Course : les robots en pleine course
  robots: {
    mode: 'phone', rect: '.slot-stage', col: 0,
    steps: [{ click: '[data-bet="2:win"]' }, { wait: 300 }, { eval: `${G}.onMain()` }, { wait: 10800 }],
  },
  // Le Poulet : 3 voies traversées sans se faire écraser (le hasard de chaque voie est poussé du bon côté)
  poulet: {
    mode: 'phone', rect: '.slot-stage', col: -64,
    steps: [{ eval: `${G}.onMain()` }, { wait: 900 }, ...[0, 1, 2].flatMap(() => [{ eval: SAFE_STEP(G) }, { wait: 1300 }])],
  },
  // Le Gratte-Ciel : 5 cubes lâchés pile au-dessus de la tour
  gratteciel: {
    mode: 'phone', rect: '.slot-stage', col: 48,
    steps: [{ eval: `${G}.onMain()` }, { eval: `(() => { const g = ${G}; let n = 0; const tick = () => { if (n >= 5 || !g.playing) return; const m = g.mover, top = g.stack[g.stack.length - 1]; if (m && Math.abs(m.x - top.x) < 2.5) { n++; g.onMain(); setTimeout(tick, 900); } else requestAnimationFrame(tick); }; setTimeout(tick, 700); })()` }, { wait: 9500 }],
  },
  // Le Penalty : le tir part en lucarne, le gardien plonge
  penalty: {
    mode: 'phone', rect: '.slot-stage', col: 0,
    steps: [{ eval: `${G}.onMain()` }, { wait: 900 }, { click: '[data-spot="0"]' }, { wait: 380 }],
  },
  // Le Ticket : un ticket gagnant gratté
  ticket: {
    mode: 'phone', rect: '.slot-stage', col: 0,
    steps: [{ eval: `${G}.onMain()` }, { wait: 1200 }, { click: '.tk-all' }, { wait: 2400 }, { eval: `[...document.querySelectorAll('.tk-tab')].sort((a, b) => (parseFloat(b.textContent.split('+')[1]) || 0) - (parseFloat(a.textContent.split('+')[1]) || 0))[0]?.click()` }, { wait: 900 }],
  },
  // La Descente : les billes lâchées sur la pente
  billes: {
    mode: 'phone', rect: '.slot-stage', col: 0,
    steps: [{ click: '.rchip[data-chip="100"]' }, { click: '.mb-spot[data-k="b2"]' }, { wait: 300 }, { eval: `${G}.onMain()` }, { wait: 7000 }],
  },
  // Le Pilote : l'avion au-dessus des porte-avions
  pilote: {
    mode: 'phone', rect: '.slot-stage', fit: [0.5, 0.5], hide: '.pi-say{visibility:hidden!important}',
    steps: [{ eval: `${G}.onMain()` }, { until: `parseFloat(document.querySelector('.pi-total b').textContent.replace('×', '').replace(',', '.')) >= 3`, max: 25000 }, { wait: 250 }],
  },
  // La Roue d'Or : la roue qui tourne, le BONUS doré
  roueor: { mode: 'phone', rect: '.slot-stage', col: 0 },
  // Le Derby et Le Ring : un match d'entraînement contre l'ordinateur
  foot: { mode: 'phone', rect: '.game-host', fit: [0.5, 0.45], steps: [{ click: '[data-train]' }, { wait: 8000 }] },
  boxe: { mode: 'phone', rect: '.game-host', fit: [0.5, 0.56], steps: [{ click: '[data-train]' }, { wait: 8000 }] },
  // ---- tables en 3D ----
  // L'Éclair : la roue en bois qui tourne et le tableau des numéros frappés par la foudre (×50 à ×500)
  storm: {
    mode: 'pc', rect: '.rl', fit: [0.7, 0.5], hide: '.rl-tip{display:none!important}',
    steps: [{ eval: `["n17", "n23", "n8", "n32", "red", "d2"].forEach((k) => document.querySelector('.rl-cell[data-k=' + k + ']')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))` }, { wait: 300 }, { eval: `${G}.onMain()` }, { wait: 3600 }],
  },
  // La Double Bille : les 2 numéros gagnants (blanche et jaune) sur le tapis
  doublespin: {
    mode: 'pc', rect: '.rl', fit: [0.27, 0.5], hide: '.rl-tip{display:none!important}',
    steps: [{ eval: `["n17", "n23", "n8", "n32", "red", "d2"].forEach((k) => document.querySelector('.rl-cell[data-k=' + k + ']')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))` }, { wait: 300 }, { eval: `${G}.onMain()` }, { wait: 13800 }],
  },
  // Le Texas : la table, les bots, tes 2 cartes et le tableau (flop puis turn) ; PAROLE / SUIVRE joués tout seuls
  poker: {
    mode: 'pc', rect: '.pkx', fit: [0.5, 0.3],
    steps: [{ eval: `${G}.onMain()` }, { eval: `(() => { let n = 0; const t = setInterval(() => { const b = [...document.querySelectorAll('.game-host button')].find((x) => /SUIVRE|PAROLE/.test(x.textContent) && !x.disabled && x.offsetParent); if (b) { b.click(); n++; } if (n >= 3) clearInterval(t); }, 400); setTimeout(() => clearInterval(t), 20000); })()` }, { wait: 14000 }],
  },
  // Les Échecs : une ouverture jouée contre l'ordinateur (cases en 0x88 : e2 = 100, e4 = 68…)
  echecs: {
    mode: 'pc', rect: '.cx-board', box: [0, -0.04, 1],
    steps: [{ click: '[data-solo]' }, { wait: 1500 }, ...[[100, 68], [118, 85], [117, 66]].flatMap(([a, b]) => [{ eval: `(() => { const g = ${G}; g.select(${a}); g.tryMove(${a}, ${b}); })()` }, { wait: 3800 }])],
  },
});
