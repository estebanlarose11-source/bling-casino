// SpinBet Casino · BoxeGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/boxe.js ----
__mods['games/impl/boxe.js'] = (() => {
// Le Ring (demande du propriétaire) : un combat de boxe entre deux amis, en direct, avec une mise (même principe que
// Le Derby, games/foot.js : le gagnant prend les deux mises, nul = mises rendues, abandon = défaite).
// - Moteur (bloc ===ENGINE) : 60 images/s, entièrement déterministe (seulement + − × ÷, √ et Math.floor, hasard
//   rangé dans l'état) : les deux téléphones calculent exactement le même combat à partir des commandes.
//   Coups : DROITE (direct du bras arrière), CROCHET (bras avant), UPPERCUT ; stick vers le bas + coup = au corps.
//   ESQUIVE : stick à gauche / à droite = rotation du buste (évite droite et uppercut), stick en bas = esquive basse
//   (évite droite et crochet, mais un uppercut fait très mal). GARDE (tenir) : garde haute, avec le stick en bas =
//   garde basse (protège le corps). Une esquive réussie ouvre un CONTRE (coup plus rapide et 1,5 fois plus fort).
//   Endurance : chaque coup en coûte, un coup à vide encore plus ; coups au corps = l'adversaire s'épuise.
//   Knockdown à 0 de vie : l'arbitre compte jusqu'à 10 (taper vite sur les boutons pour se relever, compte de 8
//   obligatoire), 3 knockdowns dans le même round = arrêt de l'arbitre. Sinon décision de 3 juges (10 points par
//   round, −1 par knockdown) ; égalité = match nul.
// - Réseau, défis et mises : comme Le Derby (classe Link + Rollback, module foot-defis.js d'index.html, documents
//   foot/{id} avec ka / kb ≥ 10 = un combat de boxe : aucune règle Firestore en plus).
// - Rendu : petite 3D maison en canvas 2D (boxeurs articulés, ring, cordes, public, arbitre) avec 3 caméras au
//   choix : 1re personne (on voit ses gants et l'adversaire en face), 3e personne (derrière son boxeur) et TV.

/* ===ENGINE */
const FPS = 60, DT = 1 / 60;
const RING = 2.55;                      // demi-côté de l'intérieur des cordes (m)
const B_R = 1, B_C = 2, B_U = 4, B_E = 8, B_G = 16, B_ON = 32, B_ANY = B_R | B_C | B_U | B_E;
const PH = { INTRO: 1, FIGHT: 2, DOWN: 3, BREAK: 4, END: 5 };
const A = { IDLE: 0, PUNCH: 1, DODGE: 2, HURT: 3, BLOCK: 4, DOWN: 5, UP: 6, KO: 7, WIN: 8 };
const K = { R: 1, C: 2, U: 3 };
const HOW = { KO: 1, TKO: 2, DEC: 3, DRAW: 4, FORF: 5 };
// [mise en route, coup actif, retour, dégâts, endurance, portée (m, centre à centre), part qui passe la garde]
const PU = [null, [7, 3, 13, 6.2, 5, 1.0, 0.12], [11, 4, 18, 9.5, 8, 0.9, 0.3], [13, 4, 22, 12.5, 10, 0.82, 0.48]];
const HURT_F = [0, 13, 17, 21], DODGE_F = 24, DODGE_ON = 2, DODGE_OFF = 17, COUNTER_F = 42, BLOCK_F = 9;
const COUNT_F = 54, UP_F = 52, BREAK_F = 600, INTRO_F = 170, END_F = 600, HPMAX = 150, STMAX = 100;
const EV = { HIT: 1, BLOCK: 2, WHIFF: 3, DODGE: 4, KD: 5, COUNT: 6, UP: 7, KO: 8, TKO: 9, BELL: 10, RBELL: 11, END: 12, SWING: 13, BOX: 14, ROUND: 15, LOW: 16 };
// l'ordinateur (entraînement) : Facile, Normal, Difficile
const AI_REACT = [0.3, 0.55, 0.82], AI_DELAY = [11, 7, 4], AI_AGG = [0.016, 0.028, 0.042], AI_DODGE = [0.3, 0.5, 0.66];
const AI_TAP = [0.07, 0.1, 0.13], AI_STAY = [0.45, 0.3, 0.18], AI_DIST = [0.95, 0.88, 0.84];

const GL = ['FRAME', 'PHASE', 'PT', 'ROUND', 'NR', 'RLEN', 'RT', 'RNG', 'EVN', 'DOWNI', 'COUNT', 'WIN', 'HOW', 'RDY0', 'RDY1',
  'HUM0', 'HUM1', 'AIL0', 'AIL1', 'C00', 'C01', 'C10', 'C11', 'C20', 'C21', 'W00', 'W01', 'W02', 'W10', 'W11', 'W12', 'W20', 'W21', 'W22', 'STAY'];
const G = {}; GL.forEach((k, i) => { G[k] = i; });
const EVB = GL.length, EVS = 16;
const FL = ['X', 'Z', 'HP', 'CAP', 'ST', 'ACT', 'AT', 'AK', 'PS', 'CF', 'BUF', 'BUFT', 'GD', 'DK', 'LDK', 'HITK', 'CNT', 'UPM', 'UPN', 'PREV',
  'QUIET', 'SX', 'SY', 'RJ', 'RH', 'RU', 'RB', 'RTH', 'RKD', 'TT', 'TL', 'TP', 'TKD', 'TDMG', 'TBK', 'TDG', 'AIW', 'AIR', 'AIX', 'AIY', 'AIG', 'AIS', 'AIM'];
const F = {}; FL.forEach((k, i) => { F[k] = i; });
const PB = EVB + EVS * 3, PSZ = FL.length, SLEN = PB + 2 * PSZ;
const pOf = (i) => PB + i * PSZ;

function rnd(S) { // xorshift32, état gardé dans le combat
  let x = S[G.RNG] >>> 0;
  x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
  S[G.RNG] = x;
  return x / 4294967296;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function ev(S, code, a) { const k = EVB + (S[G.EVN] % EVS) * 3; S[k] = code; S[k + 1] = S[G.FRAME]; S[k + 2] = a; S[G.EVN]++; }
function encIn(x, y, b) { // stick −100…100 (x à droite, y vers l'avant), boutons
  const qx = clamp(Math.round(x / 12.5), -8, 8), qy = clamp(Math.round(y / 12.5), -8, 8);
  return (qx + 8) | ((qy + 8) << 5) | (b << 10);
}
const NEUTRAL = encIn(0, 0, B_ON);

function newMatch(o) { // { seed, rounds, rlen, hum: [1, 0], ail: [0, 2] }
  const S = new Float64Array(SLEN);
  S[G.RNG] = (o.seed >>> 0) || 1;
  for (let k = 0; k < 4; k++) rnd(S);
  S[G.NR] = o.rounds || 3; S[G.RLEN] = o.rlen || 60 * FPS; S[G.ROUND] = 1;
  S[G.HUM0] = o.hum ? o.hum[0] : 1; S[G.HUM1] = o.hum ? o.hum[1] : 1;
  S[G.AIL0] = o.ail ? o.ail[0] : 0; S[G.AIL1] = o.ail ? o.ail[1] : 0;
  S[G.DOWNI] = -1; S[G.WIN] = -1;
  // trois juges, chacun avec sa façon de compter (directs, coups puissants, envie d'avancer)
  for (let j = 0; j < 3; j++) { S[G.W00 + j * 3] = 0.75 + rnd(S) * 0.5; S[G.W01 + j * 3] = 1.6 + rnd(S) * 0.8; S[G.W02 + j * 3] = 0.06 + rnd(S) * 0.12; }
  for (let i = 0; i < 2; i++) { const p = pOf(i); S[p + F.HP] = HPMAX; S[p + F.CAP] = HPMAX; S[p + F.LDK] = 1 + i; }
  startRound(S);
  return S;
}
function startRound(S) {
  S[G.PHASE] = PH.INTRO; S[G.PT] = 0; S[G.RT] = 0; S[G.RDY0] = 0; S[G.RDY1] = 0;
  for (let i = 0; i < 2; i++) {
    const p = pOf(i), s = i ? 1 : -1;
    S[p + F.X] = s * 1.55; S[p + F.Z] = s * 1.55; S[p + F.ST] = STMAX; S[p + F.ACT] = A.IDLE; S[p + F.AT] = 0; S[p + F.BUF] = 0; S[p + F.GD] = 0;
    S[p + F.CNT] = 0; S[p + F.QUIET] = 999; S[p + F.RKD] = 0;
    for (const k of ['RJ', 'RH', 'RU', 'RB', 'RTH']) S[p + F[k]] = 0;
  }
  ev(S, EV.ROUND, S[G.ROUND]);
}

function step(S, in0, in1) {
  S[G.FRAME]++;
  const ph = S[G.PHASE];
  const ins = [in0, in1];
  for (let i = 0; i < 2; i++) if (!S[G.HUM0 + i]) ins[i] = aiInput(S, i);
  // les commandes de l'image : stick et boutons qui viennent d'être appuyés
  const press = [0, 0], held = [0, 0];
  for (let i = 0; i < 2; i++) {
    const v = ins[i] | 0, p = pOf(i), b = v >> 10;
    S[p + F.SX] = ((v & 31) - 8) / 8; S[p + F.SY] = (((v >> 5) & 31) - 8) / 8;
    held[i] = b; press[i] = b & ~S[p + F.PREV]; S[p + F.PREV] = b;
  }
  S[G.PT]++;
  if (ph === PH.INTRO) intro(S);
  else if (ph === PH.FIGHT) fight(S, press, held);
  else if (ph === PH.DOWN) down(S, press);
  else if (ph === PH.BREAK) rest(S, press);
  else if (ph === PH.END) ending(S);
}

function dirTo(S, i) { // vers l'adversaire : [fx, fz, distance]
  const p = pOf(i), q = pOf(1 - i), dx = S[q + F.X] - S[p + F.X], dz = S[q + F.Z] - S[p + F.Z], d = Math.sqrt(dx * dx + dz * dz) || 0.001;
  return [dx / d, dz / d, d];
}
function move(S, i, fwd, side) {
  const p = pOf(i), [fx, fz] = dirTo(S, i);
  S[p + F.X] = clamp(S[p + F.X] + (fx * fwd + fz * side) * DT, -RING + 0.32, RING - 0.32);
  S[p + F.Z] = clamp(S[p + F.Z] + (fz * fwd - fx * side) * DT, -RING + 0.32, RING - 0.32);
}
function separate(S, min) {
  const p = pOf(0), q = pOf(1), [fx, fz, d] = dirTo(S, 0);
  if (d >= min) return;
  const push = (min - d) / 2;
  for (const [r, s] of [[p, -1], [q, 1]]) {
    S[r + F.X] = clamp(S[r + F.X] + fx * push * s, -RING + 0.32, RING - 0.32);
    S[r + F.Z] = clamp(S[r + F.Z] + fz * push * s, -RING + 0.32, RING - 0.32);
  }
}
// les boxeurs marchent jusqu'au centre puis « BOX ! »
function intro(S) {
  const pt = S[G.PT];
  for (let i = 0; i < 2; i++) { const [, , d] = dirTo(S, i); if (pt > 40 && d > 1.25) move(S, i, 1.25, 0); }
  if (pt >= INTRO_F) { S[G.PHASE] = PH.FIGHT; S[G.PT] = 0; ev(S, EV.BOX, S[G.ROUND]); ev(S, EV.BELL, 1); }
}

function fight(S, press, held) {
  const d0 = dirTo(S, 0)[2];
  for (let i = 0; i < 2; i++) control(S, i, press[i], held[i], d0);
  for (let i = 0; i < 2; i++) advance(S, i);
  separate(S, 0.6);
  // deux coups qui arrivent en même temps : les deux touchent (échange)
  const hit0 = S[pOf(0) + F.ACT] === A.PUNCH && S[pOf(0) + F.AT] === S[pOf(0) + F.PS], hit1 = S[pOf(1) + F.ACT] === A.PUNCH && S[pOf(1) + F.AT] === S[pOf(1) + F.PS];
  if (hit0) resolve(S, 0);
  if (hit1 && S[G.PHASE] === PH.FIGHT) resolve(S, 1);
  if (S[G.PHASE] !== PH.FIGHT) return;
  S[G.RT]++;
  if (S[G.RT] >= S[G.RLEN]) endRound(S);
}

function control(S, i, press, held, d) {
  const p = pOf(i), act = S[p + F.ACT], sx = S[p + F.SX], sy = S[p + F.SY], low = sy < -0.45;
  let want = 0;
  if (press & B_U) want = K.U; else if (press & B_C) want = K.C; else if (press & B_R) want = K.R;
  const free = act === A.IDLE;
  // esquive
  if (press & B_E && (free || act === A.BLOCK)) {
    let dk;
    if (sy < -0.4) dk = 3; else if (sx < -0.3) dk = 1; else if (sx > 0.3) dk = 2; else { dk = 3 - S[p + F.LDK]; }
    if (dk < 3) S[p + F.LDK] = dk;
    S[p + F.ACT] = A.DODGE; S[p + F.AT] = 0; S[p + F.DK] = dk; S[p + F.GD] = 0; S[p + F.BUF] = 0;
    S[p + F.ST] = Math.max(0, S[p + F.ST] - 3.5);
    return;
  }
  if (want) {
    if (free) { startPunch(S, i, want, low); return; }
    S[p + F.BUF] = want + (low ? 4 : 0); S[p + F.BUFT] = 14;
  }
  if (free && S[p + F.BUF] && S[p + F.BUFT] > 0) { const b = S[p + F.BUF]; S[p + F.BUF] = 0; startPunch(S, i, b & 3, b > 4); return; }
  if (S[p + F.BUFT] > 0) S[p + F.BUFT]--; else S[p + F.BUF] = 0;
  // garde, déplacements
  S[p + F.GD] = free && held & B_G ? (low ? 2 : 1) : 0;
  if (free || act === A.BLOCK) {
    const k = (S[p + F.GD] ? 0.55 : 1) * (S[p + F.ST] < 15 ? 0.8 : 1) * (act === A.BLOCK ? 0.4 : 1);
    let fwd = sy * 1.5 * k;
    if (S[p + F.GD] === 2) fwd = 0;
    move(S, i, fwd, sx * 1.25 * k);
  } else if (act === A.DODGE && S[p + F.DK] < 3) move(S, i, 0, (S[p + F.DK] === 1 ? -0.5 : 0.5));
  void d;
}
function startPunch(S, i, k, body) {
  const p = pOf(i), P = PU[k], cf = S[p + F.CNT] > 0 ? 1 : 0;
  S[p + F.ACT] = A.PUNCH; S[p + F.AT] = 0; S[p + F.AK] = k + (body ? 4 : 0); S[p + F.GD] = 0;
  S[p + F.PS] = P[0] + (S[p + F.ST] < 18 ? 3 : 0) - (cf ? Math.floor(P[0] * 0.3) : 0);
  S[p + F.CF] = cf; S[p + F.CNT] = 0;
  S[p + F.ST] = Math.max(0, S[p + F.ST] - P[4]);
  S[p + F.TT]++; S[p + F.RTH]++;
  ev(S, EV.SWING, i + 2 * k);
}
function advance(S, i) {
  const p = pOf(i), act = S[p + F.ACT];
  S[p + F.AT]++;
  const at = S[p + F.AT];
  if (act === A.PUNCH) {
    const P = PU[S[p + F.AK] & 3];
    if (at <= S[p + F.PS] && (S[p + F.AK] & 3) !== K.C) move(S, i, 0.55, 0); // le corps suit le coup
    if (at >= S[p + F.PS] + P[1] + P[2]) S[p + F.ACT] = A.IDLE;
  } else if (act === A.DODGE) { if (at >= DODGE_F) S[p + F.ACT] = A.IDLE; }
  else if (act === A.HURT) { if (at >= HURT_F[S[p + F.HITK] & 3] + (S[p + F.HITK] > 8 ? 6 : 0)) S[p + F.ACT] = A.IDLE; }
  else if (act === A.BLOCK) { if (at >= BLOCK_F) S[p + F.ACT] = A.IDLE; }
  if (S[p + F.CNT] > 0) S[p + F.CNT]--;
  S[p + F.QUIET]++;
  // endurance et vie qui reviennent un peu
  const st = S[p + F.ACT] === A.IDLE ? (S[p + F.GD] ? 0.1 : 0.21) : 0.05;
  S[p + F.ST] = Math.min(STMAX, S[p + F.ST] + st);
  if (S[p + F.QUIET] > 150 && S[p + F.HP] < S[p + F.CAP]) S[p + F.HP] = Math.min(S[p + F.CAP], S[p + F.HP] + 0.008);
}

function resolve(S, i) {
  const o = 1 - i, p = pOf(i), q = pOf(o), k = S[p + F.AK] & 3, body = S[p + F.AK] > 4, P = PU[k];
  const d = dirTo(S, i)[2], tact = S[q + F.ACT], tat = S[q + F.AT];
  if (tact === A.DOWN || tact === A.UP || tact === A.KO) return;
  // esquivé ?
  if (tact === A.DODGE && tat >= DODGE_ON && tat <= DODGE_OFF) {
    const dk = S[q + F.DK], slip = dk < 3;
    const miss = body ? slip && k === K.R : slip ? k !== K.C : k !== K.U;
    if (miss) {
      S[q + F.CNT] = COUNTER_F; S[q + F.TDG]++; S[p + F.ST] = Math.max(0, S[p + F.ST] - 2);
      ev(S, EV.DODGE, o + 2 * k);
      return;
    }
  }
  if (d > P[5] + (body ? -0.03 : 0)) { S[p + F.ST] = Math.max(0, S[p + F.ST] - 2.5); ev(S, EV.WHIFF, i + 2 * k); return; }
  let dmg = P[3] * (0.55 + 0.45 * S[p + F.ST] / STMAX) * (body ? 0.62 : 1);
  let counter = S[p + F.CF] ? 1 : 0;
  if (counter) dmg *= 1.5;
  if (tact === A.PUNCH && tat < S[q + F.PS]) { dmg *= 1.3; counter = 1; S[q + F.BUF] = 0; } // coup coupé dans son élan
  if (tact === A.DODGE && S[q + F.DK] === 3 && k === K.U && !body) { dmg *= 1.5; counter = 1; } // uppercut dans l'esquive basse
  const g = (tact === A.IDLE || tact === A.BLOCK) ? S[q + F.GD] : 0;
  if ((g === 1 && !body) || (g === 2 && body)) {
    dmg *= body ? 0.15 : P[6];
    S[q + F.ST] = Math.max(0, S[q + F.ST] - P[3] * 0.55);
    S[q + F.ACT] = A.BLOCK; S[q + F.AT] = 0; S[q + F.TBK]++;
    move(S, o, -3, 0);
    ev(S, EV.BLOCK, i + 2 * k + (body ? 8 : 0));
  } else {
    S[q + F.ACT] = A.HURT; S[q + F.AT] = 0; S[q + F.HITK] = k + (body ? 4 : 0) + (counter ? 8 : 0); S[q + F.GD] = 0; S[q + F.BUF] = 0;
    if (body) S[q + F.ST] = Math.max(0, S[q + F.ST] - dmg * 1.6);
    S[q + F.QUIET] = 0;
    S[p + F.TL]++; if (k > 1) S[p + F.TP]++;
    if (body) S[p + F.RB]++; else if (k === K.R) S[p + F.RJ]++; else if (k === K.C) S[p + F.RH]++; else S[p + F.RU]++;
    move(S, o, -7, 0);
    ev(S, EV.HIT, i + 2 * k + (body ? 8 : 0) + (counter ? 16 : 0));
  }
  S[q + F.HP] -= dmg; S[p + F.TDMG] += dmg;
  if (S[q + F.HP] <= 0) knockdown(S, o);
  else if (S[q + F.HP] < HPMAX * 0.2 && S[q + F.HP] + dmg >= HPMAX * 0.2) ev(S, EV.LOW, o);
}

function knockdown(S, o) {
  const q = pOf(o);
  S[q + F.HP] = 0; S[q + F.ACT] = A.DOWN; S[q + F.AT] = 0; S[q + F.UPM] = 0; S[q + F.GD] = 0; S[q + F.BUF] = 0;
  S[q + F.RKD]++; S[q + F.TKD]++;
  S[q + F.UPN] = 13 + 9 * (S[q + F.TKD] - 1);
  S[pOf(1 - o) + F.ACT] = A.IDLE;
  ev(S, EV.KD, o);
  if (S[q + F.RKD] >= 3) { finish(S, 1 - o, HOW.TKO); return; }
  S[G.PHASE] = PH.DOWN; S[G.PT] = 0; S[G.DOWNI] = o; S[G.COUNT] = 0;
  // l'ordinateur reste parfois au tapis (plus souvent à chaque knockdown)
  S[G.STAY] = !S[G.HUM0 + o] && rnd(S) < AI_STAY[S[G.AIL0 + o] - 1] * S[q + F.TKD] ? 1 : 0;
}
function down(S, press) {
  const o = S[G.DOWNI], q = pOf(o), w = pOf(1 - o), pt = S[G.PT];
  // l'autre boxeur va dans un coin neutre
  const d = dirTo(S, 1 - o)[2];
  if (d < 2.1) move(S, 1 - o, -1.3, 0);
  S[w + F.ACT] = A.IDLE; S[w + F.GD] = 0;
  const c = Math.floor(pt / COUNT_F);
  if (c > S[G.COUNT]) { S[G.COUNT] = c; if (c <= 10) ev(S, EV.COUNT, c); }
  const act = S[q + F.ACT];
  if (act === A.DOWN) {
    if (pt > 24 && press[o] & B_ANY) S[q + F.UPM]++;
    if (S[q + F.UPM] > 0 && pt % 20 === 0) S[q + F.UPM] -= 0.5; // il faut taper sans s'arrêter
    if (S[q + F.UPM] >= S[q + F.UPN] && c >= 1) { S[q + F.ACT] = A.UP; S[q + F.AT] = 0; }
    else if (c >= 10) { S[q + F.ACT] = A.KO; finish(S, 1 - o, HOW.KO); }
  } else if (act === A.UP) {
    S[q + F.AT]++;
    if (S[q + F.AT] >= UP_F && c >= 8) {
      S[q + F.ACT] = A.IDLE; S[q + F.AT] = 0;
      S[q + F.HP] = S[q + F.CAP] * 0.45; S[q + F.CAP] *= 0.88; S[q + F.ST] = Math.max(S[q + F.ST], 55);
      S[G.PHASE] = PH.FIGHT; S[G.PT] = 0; S[G.DOWNI] = -1;
      ev(S, EV.UP, o); ev(S, EV.BOX, 0);
      if (S[G.RT] >= S[G.RLEN]) endRound(S);
    }
  }
}
// fin d'un round : les juges notent (10 au meilleur, 9 à l'autre, 10-10 si serré, −1 par knockdown)
function endRound(S) {
  const p = pOf(0), q = pOf(1);
  for (let j = 0; j < 3; j++) {
    const w = G.W00 + j * 3;
    const sc = (r) => S[w] * S[r + F.RJ] + S[w + 1] * (S[r + F.RH] + S[r + F.RU]) + 0.9 * S[r + F.RB] + S[w + 2] * S[r + F.RTH];
    const diff = sc(p) - sc(q);
    let a = 10, b = 10;
    if (diff > 1.2) b = 9; else if (diff < -1.2) a = 9;
    a -= S[p + F.RKD]; b -= S[q + F.RKD];
    const m = a > b ? a : b; a += 10 - m; b += 10 - m;
    S[G.C00 + j * 2] += a; S[G.C01 + j * 2] += b;
  }
  ev(S, EV.RBELL, S[G.ROUND]);
  if (S[G.ROUND] >= S[G.NR]) { decision(S); return; }
  S[G.PHASE] = PH.BREAK; S[G.PT] = 0; S[G.RDY0] = S[G.HUM0] ? 0 : 1; S[G.RDY1] = S[G.HUM1] ? 0 : 1;
  for (let i = 0; i < 2; i++) { const r = pOf(i); S[r + F.ACT] = A.IDLE; S[r + F.GD] = 0; }
}
function decision(S) {
  let va = 0, vb = 0;
  for (let j = 0; j < 3; j++) { const a = S[G.C00 + j * 2], b = S[G.C01 + j * 2]; if (a > b) va++; else if (b > a) vb++; }
  if (va >= 2) finish(S, 0, HOW.DEC); else if (vb >= 2) finish(S, 1, HOW.DEC); else finish(S, 2, HOW.DRAW);
}
function rest(S, press) {
  for (let i = 0; i < 2; i++) if (press[i] & (B_ANY | B_G) && S[G.PT] > 60) S[G.RDY0 + i] = 1;
  if (S[G.PT] === 60) for (let i = 0; i < 2; i++) { const p = pOf(i); S[p + F.HP] = Math.min(S[p + F.CAP], S[p + F.HP] + S[p + F.CAP] * 0.3); }
  if (S[G.PT] >= BREAK_F || (S[G.RDY0] && S[G.RDY1] && S[G.PT] > 120)) { S[G.ROUND]++; startRound(S); }
}
function finish(S, w, how) {
  S[G.WIN] = w; S[G.HOW] = how; S[G.PHASE] = PH.END; S[G.PT] = 0;
  if (w < 2) { const p = pOf(w); S[p + F.ACT] = A.WIN; S[p + F.AT] = 0; }
  ev(S, how === HOW.KO ? EV.KO : how === HOW.TKO ? EV.TKO : EV.END, w);
}
function ending(S) {
  if (S[G.PT] < 40 && S[G.HOW] >= HOW.DEC) for (let i = 0; i < 2; i++) { const p = pOf(i); if (S[p + F.ACT] !== A.WIN) S[p + F.ACT] = A.IDLE; }
}

// ---------- l'ordinateur (entraînement) ----------
function aiInput(S, i) {
  const p = pOf(i), q = pOf(1 - i), L = clamp((S[G.AIL0 + i] | 0) - 1, 0, 2), ph = S[G.PHASE], fr = S[G.FRAME];
  let x = 0, y = 0, b = 0;
  if (ph === PH.DOWN) {
    if (S[G.DOWNI] === i && S[p + F.ACT] === A.DOWN && !S[G.STAY] && S[G.PT] > 60 + L * 10 && !(S[p + F.PREV] & B_E) && rnd(S) < AI_TAP[L] * 2) b = B_E;
    return encIn(0, 0, b | B_ON);
  }
  if (ph !== PH.FIGHT) return NEUTRAL;
  const [, , d] = dirTo(S, i), act = S[p + F.ACT], oact = S[q + F.ACT];
  // une réaction prévue (esquive ou garde) au coup qui arrive
  if (oact === A.PUNCH && S[q + F.AT] === 1 && d < 1.2 && !S[p + F.AIW]) {
    if (rnd(S) < AI_REACT[L] * (S[p + F.ST] < 12 ? 0.5 : 1)) {
      const ok = S[q + F.AK] & 3, body = S[q + F.AK] > 4;
      S[p + F.AIW] = fr + AI_DELAY[L] + Math.floor(rnd(S) * 3);
      if (!body && rnd(S) < AI_DODGE[L]) { S[p + F.AIR] = 1; S[p + F.AIX] = ok === K.C ? 0 : rnd(S) < 0.5 ? -1 : 1; S[p + F.AIY] = ok === K.C ? -1 : 0; }
      else { S[p + F.AIR] = 2; S[p + F.AIY] = body ? -1 : 0; }
    }
  }
  if (S[p + F.AIW] && fr >= S[p + F.AIW]) {
    S[p + F.AIW] = 0;
    if (S[p + F.AIR] === 1) return encIn(S[p + F.AIX] * 100, S[p + F.AIY] * 100, B_E | B_ON);
    S[p + F.AIG] = fr + 22 + Math.floor(rnd(S) * 14); S[p + F.AIM] = S[p + F.AIY];
  }
  // se déplacer : rester à bonne distance, tourner autour
  if (fr >= S[p + F.AIS]) { S[p + F.AIS] = fr + 40 + Math.floor(rnd(S) * 90); S[p + F.AIX] = rnd(S) < 0.4 ? 0 : rnd(S) < 0.5 ? -0.6 : 0.6; }
  x = S[p + F.AIX];
  const want = AI_DIST[L] + (S[p + F.HP] < 40 ? 0.25 : 0) + (S[p + F.ST] < 20 ? 0.2 : 0);
  if (d > want + 0.08) y = 0.9; else if (d < 0.66) y = -0.8;
  // garde
  if (S[p + F.AIG] > fr) { b |= B_G; if (S[p + F.AIM] < 0) y = -1; return encIn(x * 100, y * 100, b | B_ON); }
  if (d < 1.05 && rnd(S) < 0.004 + (S[p + F.HP] < 50 ? 0.008 : 0)) { S[p + F.AIG] = fr + 30 + Math.floor(rnd(S) * 40); S[p + F.AIM] = rnd(S) < 0.25 ? -1 : 0; }
  // frapper
  if ((act === A.IDLE || act === A.PUNCH) && d < 1.0) {
    const cnt = S[p + F.CNT] > 0, agg = AI_AGG[L] * (S[p + F.ST] > 25 ? 1 : 0.3) * (oact === A.HURT ? 2.5 : 1);
    if ((cnt && rnd(S) < 0.35 + L * 0.2) || rnd(S) < agg) {
      const r = rnd(S), k = cnt ? (r < 0.5 ? B_C : B_U) : d > 0.9 ? B_R : r < 0.5 ? B_R : r < 0.8 ? B_C : B_U;
      if (!(S[p + F.PREV] & k)) { b |= k; if (rnd(S) < 0.22 && !cnt) y = -1; }
    }
  }
  return encIn(x * 100, y * 100, b | B_ON);
}

/* ---------- jeu en ligne : « rollback » (comme Le Derby) ---------- */
const RB_SLOTS = 128, RB_IN = 8192, MAXPRED = 24;
class Rollback {
  constructor(o) { // { me, delay, seed, rounds, rlen, onFrame(S, again) }
    this.me = o.me; this.op = 1 - o.me; this.D = o.delay; this.onFrame = o.onFrame || (() => {});
    this.S = newMatch({ seed: o.seed, rounds: o.rounds, rlen: o.rlen, hum: [1, 1], ail: [0, 0] });
    this.ring = Array.from({ length: RB_SLOTS }, () => new Float64Array(SLEN));
    this.inp = [new Int32Array(RB_IN), new Int32Array(RB_IN)]; this.used = new Int32Array(RB_IN);
    for (let f = 0; f < this.D; f++) { this.inp[0][f] = NEUTRAL; this.inp[1][f] = NEUTRAL; }
    this.known = [this.D - 1, this.D - 1];
    this.frame = 0; this.rollFrom = Infinity; this.ackOut = this.D - 1;
    this.hashes = new Map(); this.checks = []; this.lastCheck = 0;
  }
  local(v) { const f = this.frame + this.D; if (f > this.known[this.me] + 1) return; this.inp[this.me][f % RB_IN] = v; this.known[this.me] = f; }
  remote(start, vals) {
    const o = this.op;
    for (let k = 0; k < vals.length; k++) {
      const f = start + k;
      if (f <= this.known[o]) continue;
      if (f !== this.known[o] + 1) break;
      this.inp[o][f % RB_IN] = vals[k]; this.known[o] = f;
      if (f < this.frame && this.used[f % RB_IN] !== vals[k] && f < this.rollFrom) this.rollFrom = f;
    }
  }
  get confirmed() { return Math.min(this.known[0], this.known[1]) + 1; }
  canStep() { return this.frame - this.known[this.op] < MAXPRED && this.known[this.me] >= this.frame; }
  input(f) {
    // l'autre : sa dernière commande connue, sans les boutons (un coup deviné à tort coûterait plus qu'il ne rapporte)
    const o = this.op, last = this.inp[o][this.known[o] % RB_IN], vr = f <= this.known[o] ? this.inp[o][f % RB_IN] : (last & 1023) | ((last >> 10) & B_G ? B_G << 10 : 0) | (B_ON << 10);
    this.used[f % RB_IN] = vr;
    return this.me === 0 ? [this.inp[0][f % RB_IN], vr] : [vr, this.inp[1][f % RB_IN]];
  }
  stepOnce(again) {
    const f = this.frame;
    this.ring[f % RB_SLOTS].set(this.S);
    const [a, b] = this.input(f);
    step(this.S, a, b);
    this.frame = f + 1;
    this.onFrame(this.S, again);
  }
  step() { if (this.rollFrom < this.frame) this.resim(); this.stepOnce(false); this.check(); }
  resim() {
    const f0 = this.rollFrom, end = this.frame;
    this.rollFrom = Infinity;
    if (f0 < end - RB_SLOTS + 1 || this.ring[f0 % RB_SLOTS][G.FRAME] !== f0) return;
    this.S.set(this.ring[f0 % RB_SLOTS]);
    this.frame = f0;
    while (this.frame < end) this.stepOnce(true);
  }
  check() {
    const c = Math.floor(Math.min(this.confirmed, this.frame - 1) / 60) * 60;
    if (c <= this.lastCheck || c < 60) return;
    const st = this.ring[c % RB_SLOTS];
    if (st[G.FRAME] !== c) { if (this.frame - c > RB_SLOTS - 8) this.lastCheck = c; return; }
    this.lastCheck = c;
    const h = hashState(st);
    this.hashes.set(c, h);
    if (this.hashes.size > 30) this.hashes.delete(this.hashes.keys().next().value);
    this.checks.push({ f: c, h, s: this.me === 0 ? Float64Array.from(st) : null });
    if (this.checks.length > 4) this.checks.shift();
    this.newCheck = { f: c, h };
  }
  load(f, data) {
    if (f > this.frame || f < this.frame - RB_SLOTS + 1) return false;
    if (this.rollFrom < this.frame) this.resim();
    if (f === this.frame) { this.S.set(data); return true; }
    this.ring[f % RB_SLOTS].set(data);
    this.rollFrom = f;
    return true;
  }
  packet() {
    const from = this.ackOut + 1, to = Math.min(this.known[this.me], from + 180);
    const rle = [];
    for (let f = from; f <= to; f++) { const v = this.inp[this.me][f % RB_IN]; if (rle.length && rle[rle.length - 2] === v) rle[rle.length - 1]++; else rle.push(v, 1); }
    return { t: 'in', f: this.frame, a: this.known[this.op], s: from, i: rle };
  }
  adv(now, rtt) { return this.rfAt ? this.frame - this.known[this.op] + this.D - rtt / 2 / (1000 / FPS) : 0; }
  onPacket(m, now) {
    if (m.f > (this.rf || -1)) { this.rf = m.f; this.rfAt = now; }
    if (m.a > this.ackOut) this.ackOut = Math.min(m.a, this.known[this.me]);
    const vals = [];
    for (let k = 0; k < m.i.length; k += 2) for (let n = 0; n < m.i[k + 1]; n++) vals.push(m.i[k]);
    this.remote(m.s, vals);
  }
}
function hashState(S) {
  const u = new Uint32Array(S.buffer, S.byteOffset, S.length * 2);
  let h = 2166136261;
  for (let k = 0; k < u.length; k++) { h ^= u[k]; h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const ENGINE = { FPS, DT, RING, B_R, B_C, B_U, B_E, B_G, B_ON, PH, A, K, HOW, EV, G, F, EVB, EVS, PB, PSZ, SLEN, PU, HPMAX, STMAX, COUNT_F, UP_F,
  INTRO_F, BREAK_F, newMatch, step, encIn, pOf, dirTo, hashState, Rollback, NEUTRAL, aiInput };
/* ===END ENGINE */

/* ---------- couleurs ---------- */
const KITS = [
  { n: 'Rouge', c: '#dc2626', d: '#7f1d1d', t: '#fde047' },
  { n: 'Bleu', c: '#2563eb', d: '#1e3a8a', t: '#f8fafc' },
  { n: 'Or', c: '#eab308', d: '#854d0e', t: '#1c1917' },
  { n: 'Noir', c: '#27272a', d: '#09090b', t: '#ef4444' },
  { n: 'Vert', c: '#16a34a', d: '#14532d', t: '#f8fafc' },
  { n: 'Violet', c: '#7c3aed', d: '#3b0764', t: '#fbbf24' },
];
const SKIN = [['#e9b48a', '#a8714a'], ['#8a5634', '#4a2a16'], ['#c98d5e', '#7a4b2a'], ['#f1c7a3', '#b98563'], ['#6b4026', '#3a200f'], ['#d9a066', '#8f5d33']];
const HAIR = ['#1a120c', '#0b0b0b', '#3b2416', '#7a4a1e', '#0b0b0b', '#2a1a10'];
const kitPair = (a, b) => { a = clamp(a | 0, 0, 5); b = clamp(b | 0, 0, 5); if (a === b) b = a === 1 ? 0 : 1; return [a, b]; };

/* ---------- petite 3D : caméra, projection, formes triées par profondeur ---------- */
const NEAR = 0.06;
class View {
  constructor() { this.p = [0, 1.6, -3]; this.F = [0, 0, 1]; this.R = [1, 0, 0]; this.U = [0, 1, 0]; this.f = 600; this.cx = 0; this.cy = 0; this.list = []; }
  look(p, t, f, roll) {
    this.p = p;
    let fx = t[0] - p[0], fy = t[1] - p[1], fz = t[2] - p[2];
    const l = Math.hypot(fx, fy, fz) || 1; fx /= l; fy /= l; fz /= l;
    let rx = fz, rz = -fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    // U = F × R
    let ux = fy * rz - fz * 0, uy = fz * rx - fx * rz, uz = fx * 0 - fy * rx;
    let Rx = rx, Ry = 0, Rz = rz;
    if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const nRx = Rx * c + ux * s, nRy = Ry * c + uy * s, nRz = Rz * c + uz * s; ux = ux * c - Rx * s; uy = uy * c - Ry * s; uz = uz * c - Rz * s; Rx = nRx; Ry = nRy; Rz = nRz; }
    this.F = [fx, fy, fz]; this.R = [Rx, Ry, Rz]; this.U = [ux, uy, uz]; this.f = f;
  }
  cam(q) { const dx = q[0] - this.p[0], dy = q[1] - this.p[1], dz = q[2] - this.p[2]; return [dx * this.R[0] + dy * this.R[1] + dz * this.R[2], dx * this.U[0] + dy * this.U[1] + dz * this.U[2], dx * this.F[0] + dy * this.F[1] + dz * this.F[2]]; }
  scr(c) { return [this.cx + (c[0] * this.f) / c[2], this.cy - (c[1] * this.f) / c[2], c[2]]; }
  pt(q) { const c = this.cam(q); return c[2] < NEAR ? null : this.scr(c); }
  seg(a, b) { // segment coupé au plan proche
    let A2 = this.cam(a), B2 = this.cam(b);
    if (A2[2] < NEAR && B2[2] < NEAR) return null;
    if (A2[2] < NEAR) { const t = (NEAR - A2[2]) / (B2[2] - A2[2]); A2 = [A2[0] + (B2[0] - A2[0]) * t, A2[1] + (B2[1] - A2[1]) * t, NEAR]; }
    else if (B2[2] < NEAR) { const t = (NEAR - B2[2]) / (A2[2] - B2[2]); B2 = [B2[0] + (A2[0] - B2[0]) * t, B2[1] + (A2[1] - B2[1]) * t, NEAR]; }
    return [this.scr(A2), this.scr(B2)];
  }
  poly(pts) { // polygone coupé au plan proche
    const c = pts.map((q) => this.cam(q)), out = [];
    for (let k = 0; k < c.length; k++) {
      const a = c[k], b = c[(k + 1) % c.length], ia = a[2] >= NEAR, ib = b[2] >= NEAR;
      if (ia) out.push(a);
      if (ia !== ib) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
    }
    return out.length >= 3 ? out.map((q) => this.scr(q)) : null;
  }
  add(d, fn) { this.list.push({ d, fn }); }
  flush(g) { this.list.sort((a, b) => b.d - a.d); for (const o of this.list) o.fn(g); this.list.length = 0; }
}
const shade = (hex, k) => { // éclaircir (k > 0) ou foncer (k < 0) une couleur
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};
// a limb: a tapered capsule (the end nearer the camera is bigger)
function capsule(V, a, b, r, col, hi, rb) {
  const s = V.seg(a, b); if (!s) return;
  const [A2, B2] = s, ra = Math.max(0.6, (r * V.f) / A2[2]), rB = Math.max(0.6, ((rb ?? r) * V.f) / B2[2]);
  const d = (A2[2] + B2[2]) / 2;
  V.add(d, (g) => {
    const dx = B2[0] - A2[0], dy = B2[1] - A2[1], L = Math.hypot(dx, dy) || 0.001, nx = -dy / L, ny = dx / L;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(A2[0] + nx * ra, A2[1] + ny * ra); g.lineTo(B2[0] + nx * rB, B2[1] + ny * rB);
    g.lineTo(B2[0] - nx * rB, B2[1] - ny * rB); g.lineTo(A2[0] - nx * ra, A2[1] - ny * ra); g.closePath(); g.fill();
    g.beginPath(); g.arc(A2[0], A2[1], ra, 0, 6.2832); g.fill();
    g.beginPath(); g.arc(B2[0], B2[1], rB, 0, 6.2832); g.fill();
    if (hi && ra > 2.5) { // un reflet sur le dessus
      const s2 = ny < 0 ? 1 : -1;
      g.strokeStyle = hi; g.lineCap = 'round'; g.lineWidth = Math.max(1, (ra + rB) * 0.32);
      g.beginPath(); g.moveTo(A2[0] + nx * ra * 0.45 * s2, A2[1] + ny * ra * 0.45 * s2); g.lineTo(B2[0] + nx * rB * 0.45 * s2, B2[1] + ny * rB * 0.45 * s2); g.stroke();
    }
  });
}
function ball(V, c, r, col, dark, extra, bias = 0) {
  const p = V.pt(c); if (!p) return;
  const R = (r * V.f) / p[2];
  if (R < 0.5) return;
  V.add(p[2] + bias, (g) => {
    const gr = g.createRadialGradient(p[0] - R * 0.35, p[1] - R * 0.4, R * 0.1, p[0], p[1], R);
    gr.addColorStop(0, shade(col, 0.35)); gr.addColorStop(0.55, col); gr.addColorStop(1, dark || shade(col, -0.45));
    g.fillStyle = gr; g.beginPath(); g.arc(p[0], p[1], R, 0, 6.2832); g.fill();
    extra?.(g, p, R);
  });
}

/* ---------- les boxeurs : une pose par image, calculée depuis l'état du combat ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const STANCE = () => ({
  hip: [0, 0.98, 0], chest: [0, 1.3, 0.03], neck: [0, 1.5, 0.03], head: [0, 1.66, 0.05],
  shL: [-0.2, 1.45, 0.05], shR: [0.2, 1.44, -0.03], glL: [-0.1, 1.5, 0.34], glR: [0.11, 1.46, 0.25],
  hpL: [-0.1, 0.96, 0.03], hpR: [0.1, 0.96, -0.03], ftL: [-0.15, 0.05, 0.24], ftR: [0.17, 0.05, -0.24],
});
const LYING = () => ({
  hip: [0, 0.16, -0.5], chest: [0, 0.17, -0.82], neck: [0, 0.17, -1.02], head: [0.04, 0.16, -1.17],
  shL: [-0.21, 0.17, -0.96], shR: [0.21, 0.17, -0.96], glL: [-0.62, 0.09, -0.84], glR: [0.52, 0.09, -1.2],
  hpL: [-0.1, 0.15, -0.48], hpR: [0.1, 0.15, -0.48], ftL: [-0.24, 0.06, 0.32], ftR: [0.22, 0.06, 0.12],
  kneeUp: 1,
});
const KNEEL = () => ({
  hip: [0, 0.55, -0.2], chest: [0, 0.88, -0.12], neck: [0, 1.06, -0.06], head: [0, 1.2, -0.02],
  shL: [-0.2, 1.0, -0.08], shR: [0.2, 1.0, -0.1], glL: [-0.14, 0.62, 0.2], glR: [0.18, 0.56, 0.06],
  hpL: [-0.1, 0.53, -0.18], hpR: [0.1, 0.53, -0.22], ftL: [-0.15, 0.05, 0.25], ftR: [0.14, 0.05, -0.62],
});
const UPPER = ['chest', 'neck', 'head', 'shL', 'shR', 'glL', 'glR'];
function offset(J, keys, dx, dy, dz) { for (const k of keys) { J[k][0] += dx; J[k][1] += dy; J[k][2] += dz; } }
function twist(J, keys, ang, cx, cz) { const c = Math.cos(ang), s = Math.sin(ang); for (const k of keys) { const x = J[k][0] - cx, z = J[k][2] - cz; J[k][0] = cx + x * c + z * s; J[k][2] = cz - x * s + z * c; } }
function ik(a, b, L1, L2, bend) { // elbow / knee between a and b, pushed along `bend`
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz) || 0.001;
  const t = L1 / (L1 + L2), m = [a[0] + dx * t, a[1] + dy * t, a[2] + dz * t];
  const h = d >= L1 + L2 ? 0 : Math.sqrt(Math.max(0, L1 * L1 - (d * t) * (d * t)));
  // bend direction made perpendicular to the segment
  const ux = dx / d, uy = dy / d, uz = dz / d, k = bend[0] * ux + bend[1] * uy + bend[2] * uz;
  let bx = bend[0] - ux * k, by = bend[1] - uy * k, bz = bend[2] - uz * k; const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
  return [m[0] + bx * h, m[1] + by * h, m[2] + bz * h];
}
function reach(from, to, max) { const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2], d = Math.hypot(dx, dy, dz) || 0.001; const k = d > max ? max / d : 1; return [from[0] + dx * k, from[1] + dy * k, from[2] + dz * k]; }

// pose locale (x à droite, y en haut, z vers l'adversaire) ; tgt = tête / corps de l'adversaire dans ce repère
function poseOf(S, i, t, tgt, walk, ph) {
  const p = pOf(i), act = S[p + F.ACT], at = S[p + F.AT], st = S[p + F.ST] / STMAX;
  let J = STANCE();
  const bob = Math.sin(t * 6.3 + i * 1.7) * 0.012, sway = Math.sin(t * 3.1 + i) * 0.02;
  let cr = 0.04, sl = 0, back = 0, snap = 0, tw = 0, lean = 0, gm = S[p + F.GD];
  const tired = st < 0.25 ? (0.25 - st) * 2.4 : 0;
  // les jambes marchent
  if (walk) { const w = Math.sin(walk * 9) * 0.07; J.ftL[2] += w; J.ftR[2] -= w; J.ftL[1] += Math.max(0, Math.sin(walk * 9)) * 0.05; J.ftR[1] += Math.max(0, -Math.sin(walk * 9)) * 0.05; }
  if (act === A.DODGE) {
    const u = Math.sin(Math.PI * Math.min(1, at / DODGE_F)), dk = S[p + F.DK];
    if (dk === 3) { cr += 0.36 * u; lean += 0.1 * u; } else { sl = (dk === 1 ? -1 : 1) * u; cr += 0.06 * u; }
  } else if (act === A.HURT) {
    const k = S[p + F.HITK] & 3, body = (S[p + F.HITK] & 4) > 0, n = HURT_F[k] + ((S[p + F.HITK] & 8) ? 6 : 0), u = Math.sin(Math.PI * Math.min(1, (at + 2) / n));
    if (body) { cr += 0.14 * u; lean += 0.12 * u; } else if (k === K.U) { snap = u; back = 0.6 * u; } else if (k === K.C) { sl = (0.7 * u); back = 0.4 * u; } else back = u;
  } else if (act === A.BLOCK) back = 0.35 * Math.sin(Math.PI * Math.min(1, at / BLOCK_F));
  if (act === A.WIN) {
    const j = Math.abs(Math.sin(t * 7)) * 0.06;
    offset(J, ['hip', 'hpL', 'hpR', ...UPPER], 0, j, 0);
    J.glL = [-0.32, 2.12 + j, 0.08]; J.glR = [0.32, 2.12 + j, 0.04];
    J.head[1] += 0.02; J.head[2] -= 0.03;
  }
  // un coup de poing
  let arm = null, armGl = null, bend = null;
  if (act === A.PUNCH) {
    const k = S[p + F.AK] & 3, body = S[p + F.AK] > 4, P = PU[k], ps = S[p + F.PS];
    const ext = at < ps ? (at / ps) : at < ps + P[1] ? 1 : 1 - (at - ps - P[1]) / P[2];
    const wind = at < ps ? Math.sin(Math.PI * Math.min(1, at / ps)) * (at / ps < 0.5 ? 1 : 0.4) : 0;
    const e = ease(at < ps ? Math.max(0, (at / ps - 0.35) / 0.65) : ext);
    const T = body ? tgt.body : tgt.head;
    if (k === K.R) {
      arm = 'R'; tw = 0.55 * e; lean = 0.08 * e; if (body) cr += 0.12 * e;
      armGl = (J2) => lerp3(J2.glR, reach(J2.shR, [T[0] + 0.02, T[1], T[2] - 0.1], 0.6), e);
      bend = [0.4, -1, -0.2];
    } else if (k === K.C) {
      arm = 'L'; tw = -0.55 * e + 0.25 * wind; if (body) cr += 0.14 * e;
      armGl = (J2) => { const w = [-0.46, body ? 1.15 : 1.5, 0.18], hit = reach(J2.shL, [T[0] + 0.04, T[1], T[2] - 0.08], 0.55); const mid = lerp3(J2.glL, w, wind); return lerp3(mid, hit, e); };
      bend = [-1, 0.25, -0.2];
    } else {
      arm = 'R'; tw = 0.38 * e; cr += 0.22 * wind - 0.05 * e; lean = 0.06 * e;
      armGl = (J2) => { const w = [0.16, 1.02, 0.2], hit = reach(J2.shR, [T[0], T[1] - 0.02, T[2] - 0.08], 0.57); return lerp3(lerp3(J2.glR, w, wind), hit, e); };
      bend = [0.5, -1, 0];
    }
  }
  // la garde
  if (gm === 1) { J.glL = [-0.075, 1.64, 0.22]; J.glR = [0.075, 1.63, 0.21]; }
  else if (gm === 2) { J.glL = [-0.11, 1.22, 0.26]; J.glR = [0.1, 1.2, 0.24]; cr += 0.06; }
  if (tired && act !== A.WIN) { J.glL[1] -= 0.12 * tired; J.glR[1] -= 0.12 * tired; }
  // le haut du corps bouge
  const dx = sl * 0.25 + sway, dy = -cr * 0.85 + bob - Math.abs(sl) * 0.05, dz = lean - back * 0.13;
  offset(J, UPPER, dx, dy, dz);
  offset(J, ['hip', 'hpL', 'hpR'], dx * 0.35, -cr * 0.45, dz * 0.3);
  J.head[2] -= back * 0.06; J.head[1] += snap * 0.05;
  if (tw) twist(J, ['shL', 'shR', 'glL', 'glR', 'chest'], tw, J.chest[0], J.chest[2]);
  if (arm === 'R') J.glR = armGl(J); else if (arm === 'L') J.glL = armGl(J);
  // au tapis, à genoux, debout
  if (act === A.DOWN || act === A.KO || act === A.UP) {
    const ly = LYING(), kn = KNEEL();
    let tgtPose;
    if (act === A.UP) { const u = Math.min(1, at / UP_F); tgtPose = u < 0.5 ? mix(ly, kn, ease(u * 2)) : mix(kn, J, ease((u - 0.5) * 2)); }
    else { const fall = act === A.DOWN && ph === PH.DOWN ? Math.min(1, S[G.PT] / 26) : 1; tgtPose = mix(J, ly, ease(fall)); if (act === A.DOWN && ph === PH.DOWN && S[G.PT] > 30) { const w = Math.sin(t * 3) * 0.03; tgtPose.head[0] += w; tgtPose.glR[1] += Math.max(0, w); } }
    J = tgtPose;
  }
  if (ph === PH.END && act !== A.WIN && act !== A.KO && act !== A.DOWN && S[G.WIN] < 2 && S[G.PT] > 40) { J.head[1] -= 0.06; J.head[2] += 0.05; J.glL = [-0.2, 1.05, 0.12]; J.glR = [0.2, 1.05, 0.1]; }
  // coudes et genoux
  J.elL = ik(J.shL, J.glL, 0.3, 0.3, arm === 'L' && bend ? bend : [-0.7, -1, -0.15]);
  J.elR = ik(J.shR, J.glR, 0.3, 0.3, arm === 'R' && bend ? bend : [0.7, -1, -0.15]);
  const kb = J.kneeUp ? [0, 1, 0.2] : [0, 0.15, 1];
  J.knL = ik(J.hpL, J.ftL, 0.47, 0.47, [-0.25 + kb[0], kb[1], kb[2]]);
  J.knR = ik(J.hpR, J.ftR, 0.47, 0.47, [0.25 + kb[0], kb[1], kb[2]]);
  return J;
}
function mix(a, b, t) { const o = {}; for (const k in a) { if (Array.isArray(a[k]) && b[k]) o[k] = lerp3(a[k], b[k], t); } o.kneeUp = t > 0.5 ? b.kneeUp : a.kneeUp; return o; }

/* ---------- le dessin du ring ---------- */
const CROWD = (() => { // gradins tout autour : des têtes et des épaules
  const out = []; let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const cols = ['#1e293b', '#334155', '#7f1d1d', '#1e3a8a', '#e2e8f0', '#78350f', '#0f172a', '#4c1d95', '#a16207', '#0e7490'];
  for (let row = 0; row < 9; row++) {
    const rad = 5.6 + row * 0.95, y = -0.2 + row * 0.62, n = Math.floor(rad * 6.3 * 1.25);
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + r() * 0.08; out.push([Math.cos(a) * rad + (r() - 0.5) * 0.3, y + r() * 0.15, Math.sin(a) * rad + (r() - 0.5) * 0.3, cols[(r() * cols.length) | 0], r()]); }
  }
  return out;
})();
const ROPE_Y = [0.48, 0.86, 1.24], ROPE_C = ['#dc2626', '#f8fafc', '#2563eb'];
const POSTS = [[-1, -1, '#dc2626'], [1, -1, '#f8fafc'], [1, 1, '#2563eb'], [-1, 1, '#f8fafc']];

class Painter {
  constructor(cv) {
    this.cv = cv; this.g = cv.getContext('2d'); this.V = new View(); this.maxDpr = 2; this.parts = []; this.shake = 0; this.flash = 0; this.red = 0; this.roll = 0;
    this.camPos = null; this.camTgt = null; this.tvSide = 1; this.walk = [0, 0]; this.prevPos = [null, null]; this.J = [null, null];
  }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(this.maxDpr, devicePixelRatio || 1);
    this.W = Math.max(1, Math.round(r.width * dpr)); this.H = Math.max(1, Math.round(r.height * dpr)); this.dpr = dpr;
    this.cv.width = this.W; this.cv.height = this.H;
  }
  setKits(k, skins) { this.kits = k; this.skins = skins; }
  // world position of a point given in a fighter's local frame
  toWorld(S, i, q) { const p = pOf(i), [fx, fz] = dirTo(S, i), x = S[p + F.X], z = S[p + F.Z]; return [x + q[0] * fz + q[2] * fx, q[1], z - q[0] * fx + q[2] * fz]; }
  toLocal(S, i, w) { const p = pOf(i), [fx, fz] = dirTo(S, i), dx = w[0] - S[p + F.X], dz = w[2] - S[p + F.Z]; return [dx * fz - dz * fx, w[1], dx * fx + dz * fz]; }
  draw(S, ui) {
    const g = this.g, V = this.V, W = this.W, H = this.H, t = ui.t, ph = S[G.PHASE];
    if (!W || !H) return;
    // les boxeurs (pose de chacun d'après l'autre)
    const J = [];
    for (let i = 0; i < 2; i++) {
      const p = pOf(i), x = S[p + F.X], z = S[p + F.Z], pp = this.prevPos[i];
      if (pp) this.walk[i] += Math.min(0.2, Math.hypot(x - pp[0], z - pp[1])) * 1.4;
      this.prevPos[i] = [x, z];
    }
    for (let i = 0; i < 2; i++) {
      const o = 1 - i, oj = this.J[o];
      const head = oj ? this.toLocal(S, i, oj.head) : [0, 1.62, dirTo(S, i)[2] - 0.05], body = oj ? this.toLocal(S, i, oj.chest) : [0, 1.25, dirTo(S, i)[2] - 0.1];
      body[1] -= 0.05;
      const loc = poseOf(S, i, t, { head, body }, this.walk[i], ph), wj = {};
      for (const k in loc) if (Array.isArray(loc[k])) wj[k] = this.toWorld(S, i, loc[k]);
      wj.fwd = dirTo(S, i);
      J.push(wj);
    }
    this.J = J;
    // la caméra
    const me = ui.me, op = 1 - me, mj = J[me], oj = J[op], mode = ui.cam;
    const [fx, fz] = dirTo(S, me), mp = pOf(me);
    let pos, tgt, f = H * 0.95, roll = this.roll;
    const meDown = S[mp + F.ACT] === A.DOWN || S[mp + F.ACT] === A.KO || (S[mp + F.ACT] === A.UP && S[mp + F.AT] < UP_F * 0.6);
    if (mode === 0 && !(ph === PH.END && S[G.PT] > 150)) { // 1re personne
      const h = mj.head;
      pos = [h[0] - fx * 0.3, h[1] + 0.1, h[2] - fz * 0.3];
      tgt = meDown ? [h[0] + fx * 0.6, h[1] + 2.5, h[2] + fz * 0.6] : [oj.chest[0] * 0.4 + oj.head[0] * 0.6, oj.chest[1] * 0.4 + oj.head[1] * 0.6 - 0.04, oj.chest[2] * 0.4 + oj.head[2] * 0.6];
      if (!meDown && ph === PH.DOWN) tgt[1] = Math.max(0.4, tgt[1]);
      f = Math.min(H * 0.78, W * 0.62);
    } else if (mode === 1 || mode === 0) { // 3e personne
      const x = S[mp + F.X], z = S[mp + F.Z];
      pos = [x - fx * 1.9 + fz * 0.62, 2.15, z - fz * 1.9 - fx * 0.62];
      tgt = [x * 0.35 + oj.chest[0] * 0.65, 1.2, z * 0.35 + oj.chest[2] * 0.65];
      f = Math.min(H * 1.05, W * 0.8);
    } else { // TV
      const cx = (S[pOf(0) + F.X] + S[pOf(1) + F.X]) / 2, cz = (S[pOf(0) + F.Z] + S[pOf(1) + F.Z]) / 2, [ax, az] = dirTo(S, 0);
      const want = ax * 0 + az * 0 + (-az * 1 >= 0 ? 1 : -1), side = this.tvSide;
      if (Math.abs(az) > 0.25 && want !== side) this.tvSide = want;
      const s = this.tvSide;
      pos = [cx - az * 4.4 * s, 2.35, cz + ax * 4.4 * s];
      tgt = [cx, 1.05, cz];
      f = Math.min(H * 1.15, W * 0.85);
    }
    // un peu de souplesse pour les caméras éloignées
    const k = mode === 0 ? 1 : 0.12;
    if (!this.camPos || this.lastMode !== mode) { this.camPos = pos; this.camTgt = tgt; this.lastMode = mode; }
    this.camPos = lerp3(this.camPos, pos, k); this.camTgt = lerp3(this.camTgt, tgt, mode === 0 ? 0.5 : 0.15);
    let cp = this.camPos;
    if (this.shake > 0) { const s = this.shake * 0.05; cp = [cp[0] + (Math.random() - 0.5) * s, cp[1] + (Math.random() - 0.5) * s, cp[2] + (Math.random() - 0.5) * s]; this.shake = Math.max(0, this.shake - ui.dt * 2.6); }
    this.roll *= Math.pow(0.02, ui.dt);
    if (meDown && mode === 0) roll += 0.5;
    V.cx = W / 2; V.cy = H * (mode === 0 ? 0.47 : 0.5);
    V.look(cp, this.camTgt, f, roll);
    // le fond : la salle dans le noir
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#05070f'); bg.addColorStop(0.5, '#0b1224'); bg.addColorStop(1, '#04060c');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    this.crowd(t);
    this.lights(t);
    this.ring();
    this.fighter(J[op], op, S, ui, false);
    this.fighter(J[me], me, S, ui, mode === 0);
    this.referee(S, J, t, mode, me);
    V.flush(g);
    this.effects(ui.dt);
    // 1re personne : bords rouges quand on a mal, éclair blanc sur un gros coup
    const hp = S[mp + F.HP] / HPMAX;
    if (mode === 0 || this.red > 0.05) {
      const low = mode === 0 ? Math.max(0, 0.45 - hp) * 1.4 * (0.75 + 0.25 * Math.sin(t * 6)) : 0, a = Math.min(0.85, low + this.red);
      if (a > 0.02) { const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(127,0,0,0)'); vg.addColorStop(1, `rgba(150,0,0,${a})`); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
    }
    this.red = Math.max(0, this.red - ui.dt * 1.6);
    if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${this.flash * 0.55})`; g.fillRect(0, 0, W, H); this.flash = Math.max(0, this.flash - ui.dt * 3.5); }
  }
  crowd(t) {
    const g = this.g, V = this.V;
    for (let k = 0; k < CROWD.length; k++) {
      const c = CROWD[k], p = V.pt(c); if (!p) continue;
      const R = (0.17 * V.f) / p[2]; if (R < 0.4 || p[0] < -R * 3 || p[0] > this.W + R * 3 || p[1] < -R * 3 || p[1] > this.H + R * 3) continue;
      const jump = Math.max(0, Math.sin(t * 5 + c[4] * 20)) * (this.excite || 0) * R * 0.5;
      g.fillStyle = c[3]; g.fillRect(p[0] - R * 1.3, p[1] + R * 0.6 - jump, R * 2.6, R * 2.6);
      g.fillStyle = c[4] > 0.5 ? '#3a2416' : '#c18d63'; g.beginPath(); g.arc(p[0], p[1] - jump, R * 0.75, 0, 6.2832); g.fill();
      if (c[4] > 0.995 - (this.excite || 0) * 0.01 && ((t * 7 + c[4] * 100) % 3) < 0.12) { g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(p[0] + R, p[1] - jump, R * 1.6, 0, 6.2832); g.fill(); }
    }
    // un voile sombre sur les gradins
    g.fillStyle = 'rgba(3,6,14,.45)'; g.fillRect(0, 0, this.W, this.H);
  }
  lights() {
    const g = this.g, V = this.V;
    for (let a = -1; a <= 1; a += 2) for (let b = -1; b <= 1; b += 2) {
      const p = V.pt([a * 2.2, 5.6, b * 2.2]); if (!p) continue;
      const R = (1.6 * V.f) / p[2];
      const gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], R);
      gr.addColorStop(0, 'rgba(255,250,230,.9)'); gr.addColorStop(0.15, 'rgba(255,240,200,.35)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(p[0], p[1], R, 0, 6.2832); g.fill();
    }
  }
  ring() {
    const g = this.g, V = this.V, E = RING + 0.45, Rg = RING;
    // le tablier et la jupe du ring
    const apron = V.poly([[-E, 0, -E], [E, 0, -E], [E, 0, E], [-E, 0, E]]);
    if (apron) { g.fillStyle = '#1e293b'; g.beginPath(); apron.forEach((q, n) => (n ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); }
    for (const [a, b] of [[[-E, 0, -E], [E, 0, -E]], [[E, 0, -E], [E, 0, E]], [[E, 0, E], [-E, 0, E]], [[-E, 0, E], [-E, 0, -E]]]) {
      const s = V.poly([a, b, [b[0], -1.1, b[2]], [a[0], -1.1, a[2]]]);
      if (s) { g.fillStyle = '#0f172a'; g.beginPath(); s.forEach((q, n) => (n ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); g.strokeStyle = 'rgba(234,179,8,.6)'; g.lineWidth = 2; g.stroke(); }
    }
    const fl = V.poly([[-Rg, 0.001, -Rg], [Rg, 0.001, -Rg], [Rg, 0.001, Rg], [-Rg, 0.001, Rg]]);
    if (fl) {
      let mx = 0, my = 0; fl.forEach((q) => { mx += q[0]; my += q[1]; }); mx /= fl.length; my /= fl.length;
      const gr = g.createRadialGradient(this.W / 2, this.H * 0.6, 10, this.W / 2, this.H * 0.6, Math.max(this.W, this.H));
      gr.addColorStop(0, '#e5ebf3'); gr.addColorStop(0.6, '#b8c4d6'); gr.addColorStop(1, '#7d8aa0');
      g.fillStyle = gr; g.beginPath(); fl.forEach((q, n) => (n ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill();
    }
    // le logo au centre
    const circ = (r, y) => Array.from({ length: 28 }, (_, k) => [Math.cos((k / 28) * 6.2832) * r, y, Math.sin((k / 28) * 6.2832) * r]);
    const c1 = V.poly(circ(1.05, 0.002)), c2 = V.poly(circ(0.82, 0.003));
    if (c1) { g.fillStyle = 'rgba(234,179,8,.55)'; g.beginPath(); c1.forEach((q, n) => (n ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); }
    if (c2) { g.fillStyle = 'rgba(30,41,59,.55)'; g.beginPath(); c2.forEach((q, n) => (n ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); }
    const star = V.poly(Array.from({ length: 10 }, (_, k) => { const r = k % 2 ? 0.28 : 0.66, a = (k / 10) * 6.2832 - 1.5708; return [Math.cos(a) * r, 0.004, Math.sin(a) * r]; }));
    if (star) { g.fillStyle = 'rgba(250,204,21,.7)'; g.beginPath(); star.forEach((q, n) => (n ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); }
    // poteaux, coussins et cordes (triés avec les boxeurs)
    for (const [a, b, col] of POSTS) {
      const x = a * (Rg + 0.08), z = b * (Rg + 0.08);
      capsule(V, [x, 0, z], [x, 1.42, z], 0.045, '#94a3b8', 'rgba(255,255,255,.5)');
      capsule(V, [x - a * 0.06, 0.4, z - b * 0.06], [x - a * 0.06, 1.34, z - b * 0.06], 0.085, col, 'rgba(255,255,255,.35)');
    }
    for (let s = 0; s < 4; s++) {
      const [a1, b1] = POSTS[s], [a2, b2] = POSTS[(s + 1) % 4];
      for (let r = 0; r < 3; r++) {
        const y = ROPE_Y[r];
        for (let n = 0; n < 4; n++) {
          const u0 = n / 4, u1 = (n + 1) / 4, sag = (u) => -0.035 * Math.sin(Math.PI * u);
          capsule(V, [lerp(a1, a2, u0) * Rg, y + sag(u0), lerp(b1, b2, u0) * Rg], [lerp(a1, a2, u1) * Rg, y + sag(u1), lerp(b1, b2, u1) * Rg], 0.022, ROPE_C[r], 'rgba(255,255,255,.45)');
        }
      }
    }
  }
  fighter(J, i, S, ui, fp) {
    const V = this.V, kit = KITS[this.kits[i]], [sk, skd] = SKIN[this.skins[i]], hair = HAIR[this.skins[i]];
    const p = pOf(i), hurt = S[p + F.ACT] === A.HURT && S[p + F.AT] < 5;
    const skin = hurt ? shade(sk, 0.25) : sk, gl = kit.c, gld = kit.d;
    const hi = 'rgba(255,255,255,.28)';
    if (fp) { // 1re personne : seulement le bout de mes avant-bras et mes gants, écartés pour bien voir l'adversaire
      const [fx, fz] = J.fwd, c = J.chest;
      for (const [gk, ek, sd] of [['glL', 'elL', -1], ['glR', 'elR', 1]]) {
        const g0 = J[gk], fwd = (g0[0] - c[0]) * fx + (g0[2] - c[2]) * fz, k = clamp((0.5 - fwd) / 0.2, 0, 1);
        const gp = [g0[0] + fz * sd * 0.13 * k, g0[1] - 0.07 * k, g0[2] - fx * sd * 0.13 * k], ep = [J[ek][0] + fz * sd * 0.16 * k, J[ek][1] - 0.1 * k, J[ek][2] - fx * sd * 0.16 * k];
        capsule(V, lerp3(ep, gp, 0.35), gp, 0.05, skin, hi, 0.045);
        this.glove(V, gp, ep, gl, gld, kit.t, -0.02);
      }
      return;
    }
    // ombre au sol
    const sh = V.poly(Array.from({ length: 12 }, (_, k) => [J.hip[0] + Math.cos(k / 12 * 6.2832) * 0.42, 0.006, J.hip[2] + Math.sin(k / 12 * 6.2832) * 0.42]));
    if (sh) V.add(1e6, (g) => { g.fillStyle = 'rgba(15,23,42,.28)'; g.beginPath(); sh.forEach((q, n) => (n ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); });
    // jambes et chaussures
    for (const s of ['L', 'R']) {
      capsule(V, J[`hp${s}`], J[`kn${s}`], 0.085, skin, hi, 0.07);
      capsule(V, J[`kn${s}`], J[`ft${s}`], 0.065, skin, hi, 0.05);
      const ft = J[`ft${s}`], f2 = [ft[0] + J.fwd[0] * 0.12, ft[1] - 0.02, ft[2] + J.fwd[1] * 0.12];
      capsule(V, [ft[0], ft[1] + 0.02, ft[2]], f2, 0.055, '#111827', 'rgba(255,255,255,.25)');
      capsule(V, [ft[0], ft[1] + 0.05, ft[2]], [ft[0], ft[1] + 0.16, ft[2]], 0.058, '#f8fafc', null);
    }
    // short
    const hc = J.hip, wb = lerp3(hc, J.chest, 0.18);
    capsule(V, J.hpL, lerp3(J.hpL, J.knL, 0.42), 0.11, kit.c, 'rgba(255,255,255,.3)', 0.1);
    capsule(V, J.hpR, lerp3(J.hpR, J.knR, 0.42), 0.11, kit.c, 'rgba(255,255,255,.3)', 0.1);
    capsule(V, [hc[0], hc[1] - 0.05, hc[2]], wb, 0.17, kit.c, 'rgba(255,255,255,.25)');
    capsule(V, lerp3(hc, J.chest, 0.2), lerp3(hc, J.chest, 0.3), 0.168, kit.t, null);
    // torse
    capsule(V, lerp3(hc, J.chest, 0.35), J.chest, 0.15, skin, hi, 0.17);
    capsule(V, J.chest, J.neck, 0.155, skin, hi, 0.1);
    capsule(V, J.shL, J.shR, 0.085, skin, hi);
    // bras
    capsule(V, J.shL, J.elL, 0.06, skin, hi, 0.05); capsule(V, J.shR, J.elR, 0.06, skin, hi, 0.05);
    capsule(V, J.elL, J.glL, 0.05, skin, hi, 0.045); capsule(V, J.elR, J.glR, 0.05, skin, hi, 0.045);
    this.glove(V, J.glL, J.elL, gl, gld, kit.t, 0); this.glove(V, J.glR, J.elR, gl, gld, kit.t, 0);
    // tête
    this.head(V, J, skin, skd, hair, S, i, ui);
  }
  glove(V, gp, ep, c, d, trim, bias) {
    const cuff = lerp3(gp, ep, 0.42);
    capsule(V, cuff, lerp3(gp, ep, 0.28), 0.052, '#f8fafc', null);
    ball(V, gp, 0.088, c, d, (g, p, R) => { g.strokeStyle = trim; g.globalAlpha = 0.55; g.lineWidth = Math.max(1, R * 0.12); g.beginPath(); g.arc(p[0], p[1], R * 0.62, 3.6, 5.6); g.stroke(); g.globalAlpha = 1; }, bias);
  }
  head(V, J, skin, skd, hair, S, i, ui) {
    const h = J.head, r = 0.115, [fx, fz] = J.fwd, up = [0, 1, 0];
    const nose = V.pt([h[0] + fx * r, h[1], h[2] + fz * r]), c = V.pt(h);
    if (!c) return;
    const facing = nose && nose[2] < c[2];
    const hairP = V.pt([h[0] - fx * r * 0.2, h[1] + r * 0.98, h[2] - fz * r * 0.2]), hairB = V.pt([h[0] - fx * r * 0.95, h[1] + r * 0.28, h[2] - fz * r * 0.95]);
    const backSeen = nose && hairB && nose[2] > c[2] - r * 0.35;
    // the face: eyes, eyebrows, nose, mouthguard
    const rx = fz, rz = -fx, P = (a, b, cc) => V.pt([h[0] + fx * r * a + rx * r * b, h[1] + up[1] * r * cc, h[2] + fz * r * a + rz * r * b]);
    const p = pOf(i), hurt = S[p + F.ACT] === A.HURT, ko = S[p + F.ACT] === A.KO || S[p + F.ACT] === A.DOWN;
    ball(V, h, r, skin, skd, (g, pc, R) => {
      if (hairP) {
        g.save(); g.beginPath(); g.arc(pc[0], pc[1], R, 0, 6.2832); g.clip(); g.fillStyle = hair;
        g.beginPath(); g.arc(hairP[0], hairP[1], R * 0.8, 0, 6.2832); g.fill();
        if (backSeen) { g.beginPath(); g.arc(hairB[0], hairB[1], R * 0.85, 0, 6.2832); g.fill(); }
        g.restore();
      }
      if (!facing) return;
      const e1 = P(0.86, -0.36, 0.12), e2 = P(0.86, 0.36, 0.12), n1 = P(1.02, 0, -0.1), m1 = P(0.9, 0, -0.45), b1 = P(0.9, -0.38, 0.32), b2 = P(0.9, 0.38, 0.32);
      if (!e1 || !e2 || !n1 || !m1) return;
      const s = R * 0.13;
      if (hurt || ko) { g.strokeStyle = '#111'; g.lineWidth = Math.max(1, s * 0.6); for (const e of [e1, e2]) { g.beginPath(); g.moveTo(e[0] - s, e[1] - s); g.lineTo(e[0] + s, e[1] + s); g.moveTo(e[0] + s, e[1] - s); g.lineTo(e[0] - s, e[1] + s); g.stroke(); } }
      else { g.fillStyle = '#fff'; for (const e of [e1, e2]) { g.beginPath(); g.ellipse(e[0], e[1], s * 1.25, s * 0.8, 0, 0, 6.2832); g.fill(); } g.fillStyle = '#111'; for (const e of [e1, e2]) { g.beginPath(); g.arc(e[0], e[1], s * 0.6, 0, 6.2832); g.fill(); } }
      if (b1 && b2) { g.strokeStyle = '#1a120c'; g.lineWidth = Math.max(1, s * 0.7); g.beginPath(); g.moveTo(b1[0] - s * 1.4, b1[1] + s * 0.3); g.lineTo(b1[0] + s * 1.2, b1[1]); g.moveTo(b2[0] - s * 1.2, b2[1]); g.lineTo(b2[0] + s * 1.4, b2[1] + s * 0.3); g.stroke(); }
      g.fillStyle = skd; g.beginPath(); g.ellipse(n1[0], n1[1], s * 0.9, s * 1.2, 0, 0, 6.2832); g.fill();
      g.fillStyle = KITS[this.kits[i]].c; g.beginPath(); g.ellipse(m1[0], m1[1], s * 2.2, s * (hurt ? 1.3 : 0.75), 0, 0, 6.2832); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(m1[0] - s * 1.6, m1[1] - s * 0.3, s * 3.2, s * 0.35);
    });
    // oreilles
    for (const sd of [-1, 1]) { const e = [h[0] + rx * r * sd * 0.98, h[1] - 0.01, h[2] + rz * r * sd * 0.98]; ball(V, e, 0.028, skin, skd); }
    void ui;
  }
  referee(S, J, t, mode, me) {
    const V = this.V, ph = S[G.PHASE], o = S[G.DOWNI];
    const a = J[0].hip, b = J[1].hip, mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2, [fx, fz] = dirTo(S, 0);
    let x, z, count = 0;
    if (ph === PH.DOWN && o >= 0) { const d = J[o].head; x = (J[o].hip[0] + d[0]) / 2 - fz * 0.75; z = (J[o].hip[2] + d[2]) / 2 + fx * 0.75; count = 1; }
    else if (mode === 2) { const s = this.tvSide || 1; x = mx + fz * 2.0 * s; z = mz - fx * 2.0 * s; }
    else { const [gx, gz] = dirTo(S, me), s = -1; x = mx + gz * 2.2 * s + gx * 0.7; z = mz - gx * 2.2 * s + gz * 0.7; } // à gauche du joueur, vers l'adversaire (la caméra est à droite)
    x = clamp(x, -RING + 0.35, RING - 0.35); z = clamp(z, -RING + 0.35, RING - 0.35);
    this.refPos = this.refPos ? lerp3(this.refPos, [x, 0, z], 0.08) : [x, 0, z];
    const [rx0, , rz0] = this.refPos, tx = (mx - rx0), tz = (mz - rz0), tl = Math.hypot(tx, tz) || 1, ux = tx / tl, uz = tz / tl, vx = uz, vz = -ux;
    const L = (q) => [rx0 + q[0] * vx + q[2] * ux, q[1], rz0 + q[0] * vz + q[2] * uz];
    const crouch = count ? 0.25 : 0, arm = count ? Math.abs(Math.sin(t * Math.PI * (FPS / COUNT_F))) : 0;
    const hip = L([0, 0.98 - crouch * 0.5, 0]), chest = L([0, 1.36 - crouch, 0.05 + crouch * 0.3]), head = L([0, 1.62 - crouch, 0.08 + crouch * 0.35]);
    const shL = L([-0.2, 1.46 - crouch, 0.04 + crouch * 0.3]), shR = L([0.2, 1.46 - crouch, 0.04 + crouch * 0.3]);
    const hL = L([-0.3, 1.0, 0.05]), hR = count ? L([0.25, 1.1 + arm * 0.7 - crouch, 0.35]) : L([0.3, 1.0, 0.05]);
    for (const [s, k] of [[-1, 0], [1, 1]]) { const hp = L([s * 0.1, 0.96 - crouch * 0.5, 0]), ft = L([s * 0.16, 0.05, k ? -0.1 : 0.1]); capsule(V, hp, ik(hp, ft, 0.47, 0.47, [0, 0, 1]), 0.075, '#111827', null); capsule(V, ik(hp, ft, 0.47, 0.47, [0, 0, 1]), ft, 0.06, '#111827', null); }
    capsule(V, hip, chest, 0.16, '#f1f5f9', 'rgba(255,255,255,.4)', 0.17);
    capsule(V, shL, shR, 0.08, '#f1f5f9', null);
    capsule(V, shL, hL, 0.055, '#f1f5f9', null); capsule(V, shR, hR, 0.055, '#f1f5f9', null);
    capsule(V, L([0, 1.48 - crouch, 0.12 + crouch * 0.3]), L([0, 1.47 - crouch, 0.13 + crouch * 0.3]), 0.03, '#111', null);
    ball(V, hL, 0.045, '#d9a066'); ball(V, hR, 0.045, '#d9a066');
    ball(V, head, 0.11, '#e9b48a', '#a8714a');
    void J; void t;
  }
  // impacts : étincelles et sueur
  burst(w, n, col, sp) { for (let k = 0; k < n; k++) this.parts.push({ x: w[0], y: w[1], z: w[2], vx: (Math.random() - 0.5) * sp, vy: Math.random() * sp * 0.8, vz: (Math.random() - 0.5) * sp, l: 0.35 + Math.random() * 0.3, c: col }); }
  effects(dt) {
    const g = this.g, V = this.V;
    for (let k = this.parts.length - 1; k >= 0; k--) {
      const q = this.parts[k];
      q.l -= dt; if (q.l <= 0) { this.parts.splice(k, 1); continue; }
      q.vy -= 6 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const p = V.pt([q.x, q.y, q.z]); if (!p) continue;
      const R = Math.max(1, (0.012 * V.f) / p[2]);
      g.globalAlpha = Math.min(1, q.l * 3); g.fillStyle = q.c; g.beginPath(); g.arc(p[0], p[1], R, 0, 6.2832); g.fill();
    }
    g.globalAlpha = 1;
    if (this.star && this.star.l > 0) {
      const s = this.star, p = V.pt(s.w); s.l -= dt;
      if (p) {
        const R = ((0.16 + (0.3 - s.l) * 0.6) * V.f * s.k) / p[2];
        g.save(); g.translate(p[0], p[1]); g.rotate(s.a); g.globalAlpha = Math.min(1, s.l * 5);
        g.fillStyle = s.c; g.beginPath();
        for (let k = 0; k < 16; k++) { const r = k % 2 ? R * 0.42 : R, a = (k / 16) * 6.2832; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, R * 0.3, 0, 6.2832); g.fill();
        g.restore(); g.globalAlpha = 1;
      }
    }
  }
  impact(w, big, blocked) {
    this.star = { w, l: 0.3, a: Math.random() * 3, k: blocked ? 0.6 : big ? 1.3 : 0.9, c: blocked ? 'rgba(186,230,253,.85)' : big ? 'rgba(253,224,71,.95)' : 'rgba(255,255,255,.9)' };
    this.burst(w, blocked ? 5 : big ? 22 : 12, blocked ? '#e0f2fe' : '#bfdbfe', blocked ? 1.2 : 2.2);
  }
}

/* ---------- les sons : coups, cloche, public ---------- */
class Sound {
  ac() { try { return __mods['audio.js'].audioContext(); } catch { return null; } }
  muted() { try { return __mods['audio.js'].isMuted(); } catch { return false; } }
  noise(c, sec, brown) {
    const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = brown ? (last + 0.02 * w) / 1.02 : w; d[i] = brown ? last * 3.5 : w; }
    return b;
  }
  start() {
    const c = this.ac(); if (!c || this.nodes) return;
    this.buf = this.buf || this.noise(c, 3, true); this.wb = this.wb || this.noise(c, 1, false);
    const src = c.createBufferSource(); src.buffer = this.buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.6;
    const gn = c.createGain(); gn.gain.value = 0;
    src.connect(f).connect(gn).connect(c.destination); src.start();
    this.nodes = { src, f, gn }; this.level(0.25);
  }
  stop() { try { this.nodes?.src.stop(); } catch { /* ignore */ } this.nodes = null; }
  level(x) { if (!this.nodes) return; const c = this.ac(); this.nodes.gn.gain.setTargetAtTime(this.muted() ? 0 : 0.04 + x * 0.3, c.currentTime, 0.35); this.nodes.f.frequency.setTargetAtTime(450 + x * 800, c.currentTime, 0.4); }
  hiss(dur, vol, f0, f1, q) {
    const c = this.ac(); if (!c || this.muted()) return;
    this.wb = this.wb || this.noise(c, 1, false);
    const t = c.currentTime, s = c.createBufferSource(); s.buffer = dur > 1 ? this.buf || this.wb : this.wb; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 0.8;
    const gn = c.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.2, dur * 0.25)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(gn).connect(c.destination); s.start(t); s.stop(t + dur + 0.05);
  }
  tone(fr, dur, type, vol, slide, when = 0) {
    const c = this.ac(); if (!c || this.muted()) return;
    const t = c.currentTime + when, o = c.createOscillator(), gn = c.createGain();
    o.type = type; o.frequency.setValueAtTime(fr, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.006); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  swing(k) { this.hiss(0.16 + k * 0.03, 0.09, 900, 2600 + k * 300, 1.4); }
  hit(k, counter) { this.tone(130 - k * 12, 0.16, 'sine', 0.5 + (counter ? 0.2 : 0), 45); this.hiss(0.09, 0.32, 2200, 700, 0.9); if (counter || k === 3) this.hiss(1.2, 0.22, 400, 1200, 0.6); }
  body() { this.tone(90, 0.2, 'sine', 0.5, 40); this.hiss(0.08, 0.2, 900, 300, 0.9); }
  block() { this.tone(220, 0.07, 'triangle', 0.18, 120); this.hiss(0.06, 0.15, 3000, 1500, 1.2); }
  whoosh() { this.hiss(0.22, 0.07, 700, 300, 1); }
  bell(n = 1) { for (let k = 0; k < n; k++) { const w = k * 0.32; this.tone(1180, 1.4, 'sine', 0.22, null, w); this.tone(2360, 0.9, 'sine', 0.08, null, w); this.tone(3540, 0.5, 'sine', 0.04, null, w); } }
  roar(x = 1) { this.hiss(3.4, 0.45 * x, 300, 1300, 0.5); this.hiss(2.6, 0.2 * x, 900, 2400, 0.8); }
  ooh() { this.hiss(1.3, 0.3, 380, 250, 1.2); }
  count() { this.tone(160, 0.09, 'square', 0.08, 120); }
}

/* ---------- les commandes : stick + boutons, clavier, manette ---------- */
const KEYS = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', KeyW: 'u', KeyS: 'd', KeyA: 'l', KeyD: 'r', KeyK: 'R', KeyJ: 'C', KeyI: 'U', KeyU: 'U', Space: 'E', KeyL: 'E', ShiftLeft: 'G', ShiftRight: 'G', KeyH: 'G' };
const BTN = { R: B_R, C: B_C, U: B_U, E: B_E, G: B_G };
class Pad {
  constructor(el) {
    this.el = el; this.keys = {}; this.btn = { R: 0, C: 0, U: 0, E: 0, G: 0 }; this.latch = { R: 0, C: 0, U: 0, E: 0, G: 0 };
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.base = el.querySelector('.fo-stick'); this.knob = this.base?.querySelector('i');
    this.on = (e) => this.down(e); this.mv = (e) => this.move(e); this.up = (e) => this.release(e);
    this.kd = (e) => this.key(e, 1); this.ku = (e) => this.key(e, 0);
    el.addEventListener('pointerdown', this.on); addEventListener('pointermove', this.mv, { passive: false }); addEventListener('pointerup', this.up); addEventListener('pointercancel', this.up);
    addEventListener('keydown', this.kd); addEventListener('keyup', this.ku);
    this.blur = () => { this.keys = {}; for (const k in this.btn) this.btn[k] = 0; this.stick.id = null; this.paintStick(); };
    addEventListener('blur', this.blur);
    this.touch = matchMedia('(pointer: coarse)').matches;
  }
  destroy() {
    this.el.removeEventListener('pointerdown', this.on); removeEventListener('pointermove', this.mv); removeEventListener('pointerup', this.up); removeEventListener('pointercancel', this.up);
    removeEventListener('keydown', this.kd); removeEventListener('keyup', this.ku); removeEventListener('blur', this.blur);
  }
  down(e) {
    const b = e.target.closest('[data-b]');
    this.touch = this.touch || e.pointerType === 'touch';
    if (b) { e.preventDefault(); const k = b.dataset.b; this.btn[k] = e.pointerId; this.latch[k] = 1; b.classList.add('on'); this.vibe(8); return; }
    if (e.target.closest('button, a, .fo-over')) return;
    const r = this.el.getBoundingClientRect();
    if (e.clientX - r.left > r.width * 0.55 || this.stick.id !== null) return;
    e.preventDefault();
    Object.assign(this.stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
    if (this.base) { this.base.style.left = `${e.clientX - r.left}px`; this.base.style.top = `${e.clientY - r.top}px`; this.base.classList.add('on'); }
    this.paintStick();
  }
  move(e) {
    if (e.pointerId !== this.stick.id) return;
    e.preventDefault();
    const R = 52;
    let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
    const m = Math.hypot(dx, dy);
    if (m > R * 1.6) { const k = (m - R * 1.6) / m; this.stick.ox += dx * k; this.stick.oy += dy * k; const r = this.el.getBoundingClientRect(); if (this.base) { this.base.style.left = `${this.stick.ox - r.left}px`; this.base.style.top = `${this.stick.oy - r.top}px`; } dx = e.clientX - this.stick.ox; dy = e.clientY - this.stick.oy; }
    const mm = Math.hypot(dx, dy), k = mm > R ? R / mm : 1;
    this.stick.x = (dx * k) / R; this.stick.y = (-dy * k) / R;
    this.paintStick();
  }
  release(e) {
    if (e.pointerId === this.stick.id) { this.stick.id = null; this.stick.x = 0; this.stick.y = 0; this.base?.classList.remove('on'); this.paintStick(); }
    for (const k in this.btn) if (this.btn[k] === e.pointerId) { this.btn[k] = 0; this.el.querySelector(`[data-b="${k}"]`)?.classList.remove('on'); }
  }
  paintStick() { if (this.knob) this.knob.style.transform = `translate(${this.stick.x * 40}px, ${-this.stick.y * 40}px)`; }
  key(e, v) {
    if (e.code === 'KeyV' && v && !e.repeat) { this.onCam?.(); return; }
    const k = KEYS[e.code];
    if (!k || e.target.closest?.('input, textarea')) return;
    e.preventDefault();
    if (v && !this.keys[k] && BTN[k]) this.latch[k] = 1;
    this.keys[k] = v;
  }
  vibe(ms) { try { if (localStorage.getItem('spinbet_vibe') !== '0') navigator.vibrate?.(ms); } catch { /* ignore */ } }
  read() {
    let x = this.stick.x, y = this.stick.y;
    const kx = (this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0), ky = (this.keys.u ? 1 : 0) - (this.keys.d ? 1 : 0);
    if (kx || ky) { const m = Math.hypot(kx, ky); x = kx / m; y = ky / m; }
    let b = 0;
    for (const k in BTN) if (this.btn[k] || this.keys[k] || this.latch[k]) b |= BTN[k];
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((q) => q && q.connected) : null;
    if (gp) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.2) { x = ax; y = -ay; }
      const bt = (n) => gp.buttons[n]?.pressed;
      if (bt(14)) x = -1; if (bt(15)) x = 1; if (bt(12)) y = 1; if (bt(13)) y = -1;
      if (bt(0)) b |= B_R; if (bt(2)) b |= B_C; if (bt(3)) b |= B_U; if (bt(1)) b |= B_E; if (bt(4) || bt(5) || bt(6) || bt(7)) b |= B_G;
    }
    for (const k in this.latch) this.latch[k] = 0;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    return { x: x * 100, y: y * 100, b };
  }
}

/* ---------- un combat à l'écran (entraînement ou en ligne) ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const CAMS = ['1re personne', '3e personne', 'Vue TV'];
const PADHTML = `<div class="fo-pad"><div class="fo-stick"><i></i></div>
  <div class="bx-btns">
    <button type="button" class="bx-b gd" data-b="G"><span>GARDE</span></button>
    <button type="button" class="bx-b es" data-b="E"><span>ESQUIVE</span></button>
    <button type="button" class="bx-b up" data-b="U"><span>UPPER<br>CUT</span></button>
    <button type="button" class="bx-b cr" data-b="C"><span>CROCHET</span></button>
    <button type="button" class="bx-b dr" data-b="R"><span>DROITE</span></button>
  </div></div>`;
const clock = (S) => { const left = Math.max(0, Math.ceil((S[G.RLEN] - S[G.RT]) / FPS)); return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; };
const howTxt = (S) => ['', 'K.-O.', 'Arrêt de l’arbitre', 'Décision', 'Match nul', 'Abandon'][S[G.HOW]] || '';
class Bout {
  // o: { online, me, seed, rounds, rlen, kits [a, b], skins, names [a, b], lvl, delay, net, cam, onEnd(result, bout), onQuit() }
  constructor(host, o) {
    this.o = o; this.me = o.online ? o.me : 0; this.host = host; this.cam = o.cam ?? 0;
    const k = o.kits;
    host.insertAdjacentHTML('beforeend', `<div class="fo-match bx-match">
      <canvas class="fo-cv"></canvas>
      <div class="bx-top">
        <div class="bx-side me"><b>${esc(o.names[this.me])}</b><div class="bx-hp"><i></i><u></u></div><div class="bx-st"><i></i></div><span class="bx-kd"></span></div>
        <div class="bx-mid"><small class="rd">ROUND 1</small><b class="clk">1:00</b></div>
        <div class="bx-side op"><b>${esc(o.names[1 - this.me])}</b><div class="bx-hp"><i></i><u></u></div><div class="bx-st"><i></i></div><span class="bx-kd"></span></div>
      </div>
      <div class="bx-tools"><div class="fo-net" hidden><i></i><span></span></div><button type="button" class="bx-cam" aria-label="Changer de caméra">🎥 <span>${CAMS[this.cam]}</span></button><button type="button" class="fo-menu" aria-label="Menu">☰</button></div>
      <div class="fo-banner"></div>
      <div class="bx-count" hidden><b></b><small></small><div class="bx-upbar"><i></i></div></div>
      <div class="bx-tip" hidden></div>
      ${PADHTML}
      <div class="fo-keys" hidden>⌨️ <b>Flèches / ZQSD</b> bouger · <b>K</b> droite · <b>J</b> crochet · <b>I</b> uppercut · <b>Espace</b> esquive · <b>Maj</b> garde (tenir) · <b>↓ + coup</b> au corps · <b>V</b> caméra</div>
      <div class="fo-over" hidden></div>
    </div>`);
    this.el = host.lastElementChild;
    this.el.querySelector('.bx-side.me').style.setProperty('--k', KITS[k[this.me]].c);
    this.el.querySelector('.bx-side.op').style.setProperty('--k', KITS[k[1 - this.me]].c);
    this.cv = this.el.querySelector('.fo-cv');
    this.painter = new Painter(this.cv); this.painter.setKits(k, o.skins);
    this.pad = new Pad(this.el); this.pad.onCam = () => this.nextCam();
    this.snd = new Sound();
    this.P = new Float64Array(SLEN); this.evKeys = new Set(); this.hud = {}; this.t = 0;
    if (!this.pad.touch) { this.el.classList.add('kb'); const kk = this.el.querySelector('.fo-keys'); kk.hidden = false; setTimeout(() => { kk.hidden = true; }, 10000); }
    if (o.online) {
      this.rb = new Rollback({ me: o.me, delay: o.delay, seed: o.seed, rounds: o.rounds, rlen: o.rlen });
      this.S = this.rb.S;
      this.el.querySelector('.fo-net').hidden = false;
    } else {
      this.S = newMatch({ seed: o.seed, rounds: o.rounds, rlen: o.rlen, hum: [1, 0], ail: [0, (o.lvl ?? 1) + 1] });
    }
    this.el.querySelector('.fo-menu').onclick = () => this.menu();
    this.el.querySelector('.bx-cam').onclick = () => this.nextCam();
    this.onResize = () => this.painter.resize();
    addEventListener('resize', this.onResize);
    this.painter.resize();
    this.snd.start();
    this.last = performance.now(); this.acc = 0;
    this.raf = requestAnimationFrame((t) => this.tick(t));
    this.tip(this.pad.touch ? 'Stick à gauche pour bouger · ↓ + coup = au corps · ESQUIVE avec le stick : ← → rotation, ↓ esquive basse' : '');
  }
  destroy() { this.dead = true; cancelAnimationFrame(this.raf); removeEventListener('resize', this.onResize); this.pad.destroy(); this.snd.stop(); this.el.remove(); }
  nextCam() { this.cam = (this.cam + 1) % 3; this.el.querySelector('.bx-cam span').textContent = CAMS[this.cam]; try { localStorage.setItem('spinbet_boxe_cam', String(this.cam)); } catch { /* ignore */ } this.o.onCam?.(this.cam); }
  tip(txt) { const t = this.el.querySelector('.bx-tip'); t.textContent = txt; t.hidden = !txt; clearTimeout(this.tipT); if (txt) this.tipT = setTimeout(() => { t.hidden = true; }, 7000); }
  sample() { const r = this.pad.read(); return encIn(r.x, r.y, r.b | B_ON); }
  tick(now) {
    if (this.dead) return;
    this.raf = requestAnimationFrame((t) => this.tick(t));
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000)); this.last = now; this.t += dt;
    if (!this.paused && !this.over) {
      let speed = 1;
      if (this.rb) { this.adv = (this.adv || 0) * 0.9 + this.rb.adv(now, this.o.net?.rtt || 80) * 0.1; speed = this.adv > 5 ? 0.86 : this.adv > 1.5 ? 0.95 : 1; }
      this.acc += dt * speed;
      let n = 0;
      while (this.acc >= DT && n < 5) {
        const v = this.sample();
        if (this.rb) {
          this.rb.local(v);
          if (!this.rb.canStep()) { this.stall = (this.stall || 0) + DT; this.acc = Math.min(this.acc, DT); break; }
          this.stall = 0;
          this.rb.step();
          this.o.net?.sendInputs(this.rb);
        } else step(this.S, v, 0);
        this.acc -= DT; n++;
        this.events();
      }
      if (n >= 5) this.acc = 0;
    }
    this.painter.draw(this.S, { me: this.me, t: this.t, dt, cam: this.cam });
    this.paintHud();
    const S = this.S;
    if (!this.over && S[G.PHASE] === PH.END && S[G.PT] > 150 && (!this.rb || this.rb.confirmed >= S[G.FRAME])) this.finish();
    if (this.over && this.rb && this.o.net && this.t - (this.overT ??= this.t) < 8 && (this.resend = (this.resend || 0) + 1) % 6 === 0) this.o.net.sendInputs(this.rb);
    if (this.rb && (this.saveT = (this.saveT || 0) + 1) % 120 === 0) { const r = this.leader(); try { localStorage.setItem('spinbet_foot_live', JSON.stringify({ id: this.o.id, a: r.a, b: r.b })); } catch { /* ignore */ } }
  }
  // who leads on the judges' cards (a connection cut for good: that result stands)
  leader(st) {
    const S = st || this.S;
    if (S[G.PHASE] === PH.END) return S[G.WIN] === 0 ? { a: 1, b: 0 } : S[G.WIN] === 1 ? { a: 0, b: 1 } : { a: 0, b: 0 };
    let va = 0, vb = 0;
    for (let j = 0; j < 3; j++) { const a = S[G.C00 + j * 2], b = S[G.C01 + j * 2]; if (a > b) va++; else if (b > a) vb++; }
    return va >= 2 ? { a: 1, b: 0 } : vb >= 2 ? { a: 0, b: 1 } : { a: 0, b: 0 };
  }
  paintHud() {
    const S = this.S, h = this.hud, me = this.me;
    for (const [cls, i] of [['me', me], ['op', 1 - me]]) {
      const p = pOf(i), hp = Math.max(0, S[p + F.HP] / HPMAX), cap = S[p + F.CAP] / HPMAX, st = S[p + F.ST] / STMAX;
      const key = `${cls}${hp.toFixed(3)}${st.toFixed(2)}${cap.toFixed(2)}${S[p + F.TKD]}`;
      if (h[cls] === key) continue;
      h[cls] = key;
      const el = this.el.querySelector(`.bx-side.${cls}`);
      el.querySelector('.bx-hp i').style.width = `${hp * 100}%`; el.querySelector('.bx-hp u').style.width = `${(1 - cap) * 100}%`;
      el.querySelector('.bx-hp').classList.toggle('low', hp < 0.25);
      el.querySelector('.bx-st i').style.width = `${st * 100}%`;
      el.querySelector('.bx-kd').textContent = S[p + F.TKD] ? '●'.repeat(S[p + F.TKD]) : '';
    }
    const ph = S[G.PHASE], rd = ph === PH.END ? 'FIN' : `ROUND ${S[G.ROUND]}/${S[G.NR]}`, ck = ph === PH.BREAK ? 'PAUSE' : clock(S);
    if (h.rd !== rd) { h.rd = rd; this.el.querySelector('.bx-mid .rd').textContent = rd; }
    if (h.ck !== ck) { h.ck = ck; this.el.querySelector('.bx-mid .clk').textContent = ck; }
    // le compte de l'arbitre
    const cnt = this.el.querySelector('.bx-count'), down = ph === PH.DOWN;
    if (down !== h.down) { h.down = down; cnt.hidden = !down; }
    if (down) {
      const o = S[G.DOWNI], q = pOf(o), c = Math.max(1, Math.min(10, S[G.COUNT]));
      const mine = o === me, up = S[q + F.ACT] === A.UP;
      const k = `${c}${mine}${up}${Math.floor(S[q + F.UPM])}`;
      if (h.cnt !== k) {
        h.cnt = k;
        cnt.querySelector('b').textContent = S[G.COUNT] ? String(c) : '';
        cnt.querySelector('small').textContent = mine ? (up ? 'Debout ! Compte de 8…' : '👊 TAPE VITE SUR LES BOUTONS POUR TE RELEVER !') : (up ? `${this.o.names[o]} se relève…` : `${this.o.names[o]} est au tapis !`);
        cnt.classList.toggle('mine', mine && !up);
        cnt.querySelector('.bx-upbar').hidden = !mine || up;
        cnt.querySelector('.bx-upbar i').style.width = `${Math.min(100, (S[q + F.UPM] / S[q + F.UPN]) * 100)}%`;
      }
    }
    if (this.o.net) {
      const q = this.o.net, bad = this.stall > 0.5 || q.silent > 2500;
      const txt = bad ? 'Connexion lente…' : `${Math.round(q.rtt || 0)} ms`;
      if (h.net !== txt) { h.net = txt; const n = this.el.querySelector('.fo-net'); n.querySelector('span').textContent = txt; n.classList.toggle('bad', bad); }
    }
    const pause = ph === PH.BREAK;
    if (pause !== h.pause) { h.pause = pause; if (pause) this.breakCard(); else this.closeCard('break'); }
    if (pause && this.S[G.PT] % 30 === 0) { const s = this.el.querySelector('.bx-brk-t'); if (s) s.textContent = `Round ${S[G.ROUND] + 1} dans ${Math.max(0, Math.ceil((BREAK_F - S[G.PT]) / FPS))} s`; }
  }
  banner(title, sub, cls) {
    const b = this.el.querySelector('.fo-banner');
    b.className = `fo-banner show ${cls || ''}`;
    b.innerHTML = `<b>${title}</b>${sub ? `<small>${sub}</small>` : ''}`;
    clearTimeout(this.bt); this.bt = setTimeout(() => { b.className = 'fo-banner'; }, cls === 'goal' ? 3000 : 1300);
  }
  events() {
    const S = this.S, n = S[G.EVN];
    for (let k = Math.max(0, n - EVS); k < n; k++) {
      const o = EVB + (k % EVS) * 3, code = S[o], f = S[o + 1], a = S[o + 2], key = `${code}:${f}:${a}`;
      if (this.evKeys.has(key)) continue;
      this.evKeys.add(key);
      if (this.evKeys.size > 400) this.evKeys = new Set([...this.evKeys].slice(-200));
      this.event(code, a, S);
    }
  }
  event(code, a, S) {
    const P = this.painter, s = this.snd, me = this.me, nm = (i) => esc(this.o.names[i]);
    const J = P.J;
    switch (code) {
      case EV.SWING: s.swing(a >> 1); break;
      case EV.WHIFF: s.whoosh(); break;
      case EV.HIT: {
        const att = a & 1, k = (a >> 1) & 3, body = (a & 8) > 0, counter = (a & 16) > 0, vic = 1 - att;
        if (body) s.body(); else s.hit(k, counter);
        const w = J?.[vic] ? (body ? J[vic].chest : J[vic].head) : null;
        if (w) P.impact(w, counter || k === K.U, false);
        if (vic === me) { P.shake = Math.min(1, (P.shake || 0) + (counter ? 0.9 : 0.5)); P.red = Math.min(0.7, P.red + (counter ? 0.5 : 0.28)); P.roll = (Math.random() - 0.5) * (k === K.C ? 0.18 : 0.08); if (counter) P.flash = 0.6; this.pad.vibe(counter ? 60 : 25); }
        else if (counter) P.shake = 0.3;
        if (counter) { this.banner(att === me ? 'CONTRE !' : 'AÏE, LE CONTRE…', k === K.U ? 'uppercut' : k === K.C ? 'crochet' : 'droite', 'mini'); s.roar(0.5); }
        P.excite = Math.min(1, (P.excite || 0) + 0.15);
        break;
      }
      case EV.BLOCK: { s.block(); const vic = 1 - (a & 1); if (J?.[vic]) P.impact(lerp3(J[vic].glL, J[vic].glR, 0.5), false, true); if (vic === me) this.pad.vibe(10); break; }
      case EV.DODGE: { s.whoosh(); const who = a & 1; if (who === me) { this.banner('ESQUIVÉ !', 'contre-attaque maintenant !', 'mini'); } s.ooh(); break; }
      case EV.KD: s.roar(1); P.flash = a === me ? 1 : 0.4; P.shake = 1; P.excite = 1; this.banner('KNOCKDOWN !', '', 'big'); this.pad.vibe(a === me ? [80, 40, 160] : 60); s.level(1); break;
      case EV.COUNT: s.count(); break;
      case EV.UP: s.roar(0.6); this.banner('IL SE RELÈVE !', nm(a), 'mini'); s.level(0.4); break;
      case EV.KO: s.bell(3); s.roar(1.3); P.excite = 1; this.banner('K.-O. !', `${nm(a)} gagne par K.-O.`, 'goal'); s.level(1); break;
      case EV.TKO: s.bell(3); s.roar(1.2); P.excite = 1; this.banner('ARRÊT DE L’ARBITRE', `3 knockdowns : ${nm(a)} gagne`, 'goal'); s.level(1); break;
      case EV.END: s.bell(3); this.banner('DÉCISION DES JUGES', a === 2 ? 'match nul' : `${nm(a)} l’emporte`, 'big'); break;
      case EV.BELL: s.bell(1); break;
      case EV.RBELL: s.bell(2); s.level(0.5); break;
      case EV.ROUND: this.banner(`ROUND ${a}`, `${nm(0)} contre ${nm(1)}`, 'big'); s.level(0.35); P.excite = 0.2; break;
      case EV.BOX: this.banner('BOX !', '', 'goal'); break;
      case EV.LOW: if (a === me) this.tip('Tu es sonné : garde haute, recule et récupère !'); break;
      default: break;
    }
    if (P.excite > 0) P.excite = Math.max(0, P.excite - 0.02);
  }
  stats(S) {
    const row = (l, x, y) => `<div class="fo-st"><b>${x}</b><span>${l}</span><b>${y}</b></div>`, a = pOf(0), b = pOf(1);
    const pc = (p) => (S[p + F.TT] ? `${Math.round((S[p + F.TL] / S[p + F.TT]) * 100)} %` : '—');
    return `<div class="fo-stats">${row('Coups lancés', S[a + F.TT], S[b + F.TT])}${row('Coups touchés', S[a + F.TL], S[b + F.TL])}${row('Précision', pc(a), pc(b))}${row('Coups puissants', S[a + F.TP], S[b + F.TP])}${row('Coups bloqués', S[a + F.TBK], S[b + F.TBK])}${row('Esquives', S[a + F.TDG], S[b + F.TDG])}${row('Knockdowns subis', S[a + F.TKD], S[b + F.TKD])}</div>`;
  }
  cards(S) {
    if (!S[G.C00] && !S[G.C01]) return '';
    return `<div class="bx-cards"><small>Cartes des 3 juges</small>${[0, 1, 2].map((j) => `<span>${S[G.C00 + j * 2]} - ${S[G.C01 + j * 2]}</span>`).join('')}</div>`;
  }
  scoreLine(S, title) { return `<div class="fo-final bx-final"><span><i style="background:${KITS[this.o.kits[0]].c}"></i>${esc(this.o.names[0])}</span><b>${title}</b><span>${esc(this.o.names[1])}<i style="background:${KITS[this.o.kits[1]].c}"></i></span></div>`; }
  breakCard() {
    const o = this.el.querySelector('.fo-over'), S = this.S;
    o.hidden = false; o.className = 'fo-over half break';
    o.innerHTML = `<div class="fo-card"><small>FIN DU ROUND ${S[G.ROUND]}</small>${this.scoreLine(S, 'VS')}${this.cards(S)}${this.stats(S)}<p class="muted bx-brk-t">Round ${S[G.ROUND] + 1} dans 10 s</p><div class="fo-acts"><button type="button" class="btn primary" data-ready>🥊 Prêt !</button></div><p class="muted small">Le round suivant part dès que ${this.o.online ? 'vous êtes prêts tous les deux' : 'tu es prêt'}.</p></div>`;
    o.onclick = (e) => { const b = e.target.closest('[data-ready]'); if (!b) return; this.pad.latch.E = 1; b.disabled = true; b.textContent = this.o.online ? '✓ En attente de l’autre…' : '✓ C’est parti'; };
  }
  closeCard(cls) { const o = this.el.querySelector('.fo-over'); if (o.classList.contains(cls)) o.hidden = true; }
  finish() {
    this.over = true;
    const S = this.S, w = S[G.WIN];
    this.snd.level(w === this.me ? 1 : 0.4);
    this.o.onEnd?.({ res: w === 2 ? 'tie' : w === this.me ? 'win' : 'lose', how: howTxt(S), ...this.leader() }, this);
  }
  showEnd(html) {
    const o = this.el.querySelector('.fo-over');
    o.hidden = false; o.className = 'fo-over end';
    o.innerHTML = `<div class="fo-card">${html}</div>`;
    return o;
  }
  menu() {
    if (this.over) return;
    const o = this.el.querySelector('.fo-over');
    if (!this.o.online) this.paused = true;
    o.hidden = false; o.className = 'fo-over menu';
    o.innerHTML = `<div class="fo-card"><small>${this.o.online ? 'COMBAT EN DIRECT' : 'PAUSE'}</small>${this.scoreLine(this.S, `R${this.S[G.ROUND]}`)}
      <div class="fo-acts"><button type="button" class="btn primary" data-m="go">▶ ${this.o.online ? 'Revenir au combat' : 'Reprendre'}</button>
      <button type="button" class="btn ghost" data-m="cam">🎥 Caméra : ${CAMS[this.cam]}</button>
      <button type="button" class="btn ghost" data-m="snd">${__mods['audio.js'].isMuted() ? '🔇 Son coupé' : '🔊 Son'}</button>
      <button type="button" class="btn ghost danger" data-m="quit">${this.o.online ? '🏳️ Abandonner (défaite)' : '🚪 Quitter l’entraînement'}</button></div>
      ${HELP}</div>`;
    o.onclick = (e) => {
      const m = e.target.closest('[data-m]')?.dataset.m;
      if (!m) return;
      if (m === 'go') { o.hidden = true; this.paused = false; this.last = performance.now(); }
      if (m === 'cam') { this.nextCam(); this.menu(); }
      if (m === 'snd') { const Au = __mods['audio.js']; Au.setMuted(!Au.isMuted()); this.snd.level(0.3); this.menu(); }
      if (m === 'quit') { if (this.o.online) { if (confirm('Abandonner le combat ? Ton adversaire gagne la mise.')) { o.hidden = true; this.o.onQuit?.(); } } else this.o.onQuit?.(); }
    };
  }
}

/* ---------- la liaison entre les deux téléphones : WebRTC, préparée par Firestore (foot/{id}) ---------- */
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
const QS = new URLSearchParams(location.search), DBG_DUR = +QS.get('boxdur') || 0, DBG_LAG = +QS.get('boxlag') || 0;
const NETV = (() => { let h = 2166136261; const s = [newMatch, startRound, step, fight, control, startPunch, advance, resolve, knockdown, down, endRound, decision, rest, finish, aiInput, move, separate, intro].map(String).join('|') + JSON.stringify(PU); for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619) >>> 0; } return `b${h.toString(36)}`; })();
class Link {
  constructor(host, sig, hooks) {
    this.host = host; this.sig = sig; this.h = hooks;
    this.gen = 0; this.ansGen = 0; this.pc = null; this.ug = null; this.rl = null; this.open = false;
    this.rtt = 0; this.lastIn = 0; this.tries = 0; this.dead = false;
  }
  get silent() { return this.lastIn ? performance.now() - this.lastIn : 0; }
  start() { this.stop = this.sig.watch((d) => this.onDoc(d)); }
  close() { try { this.ug?.close(); this.rl?.close(); this.pc?.close(); } catch { /* ignore */ } this.pc = null; this.ug = null; this.rl = null; this.open = false; }
  destroy() { this.dead = true; clearTimeout(this.retry); clearInterval(this.pinger); this.stop?.(); this.close(); }
  onDoc(d) {
    if (this.dead || !d) return;
    this.doc = d;
    if (this.host) {
      const here = !!d.jb, ans = d.aw;
      if (here && !this.pc && !this.offering) this.offer(Math.max(this.gen, d.of?.g || 0) + 1);
      if (ans && ans.g === this.gen && this.pc && !this.answered) { this.answered = true; this.pc.setRemoteDescription({ type: 'answer', sdp: ans.sdp }).catch((e) => console.warn(e)); }
    } else if (d.of && d.of.g > this.ansGen && d.ja) this.answer(d.of);
  }
  newPc() {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (pc !== this.pc) return;
      if (s === 'failed' || s === 'closed') this.lost();
      else if (s === 'disconnected') { clearTimeout(this.dt); this.dt = setTimeout(() => { if (pc === this.pc && pc.connectionState !== 'connected') this.lost(); }, 4000); }
    };
    return pc;
  }
  gathered(pc) {
    return new Promise((ok) => {
      if (pc.iceGatheringState === 'complete') return ok();
      const t = setTimeout(ok, 2600);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); ok(); } });
    });
  }
  bind(ch) {
    ch.onopen = () => this.chOpen();
    ch.onmessage = (e) => {
      this.lastIn = performance.now();
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (DBG_LAG) { if (m.t === 'in' && Math.random() < 0.05) return; setTimeout(() => this.recv(m), DBG_LAG * (0.5 + Math.random())); return; }
      this.recv(m);
    };
    ch.onclose = () => { if (ch === this.ug || ch === this.rl) this.lost(); };
  }
  chOpen() {
    if (this.open || !this.ug || !this.rl || this.ug.readyState !== 'open' || this.rl.readyState !== 'open') return;
    this.open = true; this.tries = 0; this.lastIn = performance.now();
    clearTimeout(this.retry); clearInterval(this.pinger);
    this.pinger = setInterval(() => this.sendR({ t: 'pi', k: performance.now() }), 700);
    this.h.state?.('connected'); this.h.open?.();
  }
  async offer(g) {
    if (this.dead) return;
    this.offering = true; this.close(); this.answered = false; this.gen = g;
    this.h.state?.('connecting');
    try {
      const pc = (this.pc = this.newPc());
      this.ug = pc.createDataChannel('g', { ordered: false, maxRetransmits: 0 }); this.rl = pc.createDataChannel('r', { ordered: true });
      this.bind(this.ug); this.bind(this.rl);
      await pc.setLocalDescription(await pc.createOffer());
      await this.gathered(pc);
      if (pc !== this.pc) return;
      await this.sig.write({ of: { g, sdp: pc.localDescription.sdp } });
    } catch (e) { console.warn('offre', e); }
    finally { this.offering = false; }
    clearTimeout(this.retry);
    this.retry = setTimeout(() => { if (!this.open && !this.dead) { this.tries++; this.h.state?.(this.tries >= 3 ? 'failed' : 'retry'); if (this.tries < 6) this.offer(this.gen + 1); } }, 14000);
  }
  async answer(of) {
    this.ansGen = of.g; this.close();
    this.h.state?.('connecting');
    try {
      const pc = (this.pc = this.newPc());
      pc.ondatachannel = (e) => { if (e.channel.label === 'g') this.ug = e.channel; else this.rl = e.channel; this.bind(e.channel); if (e.channel.readyState === 'open') this.chOpen(); };
      await pc.setRemoteDescription({ type: 'offer', sdp: of.sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await this.gathered(pc);
      if (pc !== this.pc) return;
      await this.sig.write({ aw: { g: of.g, sdp: pc.localDescription.sdp } });
    } catch (e) { console.warn('réponse', e); }
  }
  lost() {
    if (this.dead || !this.open && !this.pc) return;
    const was = this.open;
    this.close(); clearInterval(this.pinger);
    if (was) this.h.lost?.();
    if (this.host) { clearTimeout(this.retry); this.retry = setTimeout(() => { if (!this.dead && !this.open) this.offer(this.gen + 1); }, 1200); }
  }
  send(m) { if (this.ug?.readyState === 'open') try { this.ug.send(JSON.stringify(m)); } catch { /* ignore */ } }
  sendR(m) { if (this.rl?.readyState === 'open') try { this.rl.send(JSON.stringify(m)); } catch { /* ignore */ } }
  sendInputs(rb) { this.send(rb.packet()); }
  recv(m) {
    if (m.t === 'pi') return this.sendR({ t: 'po', k: m.k });
    if (m.t === 'po') { const r = performance.now() - m.k; this.rtt = this.rtt ? this.rtt * 0.8 + r * 0.2 : r; return; }
    this.h.msg?.(m);
  }
}

/* ---------- le jeu dans la page : vestiaire, entraînement, défis en ligne ---------- */
const { Music, EXTRA_THEMES } = __mods['core/music.js'];
const { setFull } = __mods['core/chrome.js'];
const { toast } = __mods['ui.js'];
const { wallet, fmt } = __mods['wallet.js'];
const { sfx } = __mods['audio.js'];
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, String(v)); } catch { /* ignore */ } } };
const DURS = [4, 6, 8], ROUNDS = { 4: 3, 6: 5, 8: 7 }, LVLS = ['Facile', 'Normal', 'Difficile'], STAKE_CHIPS = [0, 1000, 5000, 10000, 50000, 100000];
const RLEN = DBG_DUR || 60 * FPS;
const kitDots = (sel) => KITS.map((k, n) => `<button type="button" class="fo-kit bx-kit${n === sel ? ' on' : ''}" data-kit="${n}" title="${k.n}" style="--a:${k.c};--b:${k.d}"><i></i></button>`).join('');
const camSeg = (sel) => `<div class="fo-seg" data-seg="cam">${CAMS.map((c, n) => `<button type="button" data-v="${n}" class="${n === sel ? 'on' : ''}">${['👀', '🎥', '📺'][n]} ${c}</button>`).join('')}</div>`;
const HELP = `<div class="fo-help-grid">
    <div><b>👊 Les coups</b><p><b>DROITE</b> : direct rapide, la plus longue portée. <b>CROCHET</b> : plus lent, plus fort, il contourne en partie la garde. <b>UPPERCUT</b> : le plus fort, de près, il traverse la garde. Stick vers le bas + coup = <b>au corps</b> (il fatigue l’adversaire).</p></div>
    <div><b>🛡️ Se défendre</b><p><b>ESQUIVE</b> avec le stick à gauche ou à droite : rotation du buste (évite la droite et l’uppercut). Stick en bas + <b>ESQUIVE</b> : esquive basse (évite la droite et le crochet, mais gare à l’uppercut !). <b>GARDE</b> (tenir) : garde haute ; avec le stick en bas, garde basse qui protège le corps. Après une esquive réussie : <b>CONTRE</b> plus rapide et 1,5 fois plus fort.</p></div>
    <div><b>📏 Les règles</b><p>Chaque coup use l’<b>endurance</b> (barre jaune) : un boxeur épuisé frappe mou. À 0 de vie, c’est le <b>knockdown</b> : l’arbitre compte jusqu’à 10, tape vite sur les boutons pour te relever (compte de 8 obligatoire). 3 knockdowns dans le même round = arrêt de l’arbitre. Sinon, <b>3 juges</b> notent chaque round (10-9, −1 par knockdown) : la décision se fait à la majorité.</p></div>
    <div><b>💻 Ordinateur</b><p><b>Flèches</b> ou <b>ZQSD</b> bouger, <b>K</b> droite, <b>J</b> crochet, <b>I</b> uppercut, <b>Espace</b> esquive, <b>Maj</b> garde (tenir), <b>V</b> caméra. Manette : A droite, X crochet, Y uppercut, B esquive, gâchettes garde.</p></div>
  </div>`;
const resKey = (r) => `${r.a ?? ''}-${r.b ?? ''}-${r.f || ''}-${r.v ? 1 : 0}`;
const skinOf = (uid, n) => { let h = 7; for (const c of String(uid || n)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % SKIN.length; };

class BoxeGame {
  constructor(root, game) {
    this.root = root; this.game = game;
    this.FD = __mods['foot-defis.js'];
    this.music = new Music(EXTRA_THEMES.boxe || EXTRA_THEMES.foot);
    this.kit = clamp(+LS.get('spinbet_boxe_kit', 0) || 0, 0, KITS.length - 1);
    this.dur = +LS.get('spinbet_boxe_dur', 4) || 4; this.lvl = +LS.get('spinbet_boxe_lvl', 1); this.cam = clamp(+LS.get('spinbet_boxe_cam', 0) || 0, 0, 2);
    root.innerHTML = '<div class="derby boxe"><div class="fo-lobby"></div></div>';
    this.box = root.querySelector('.derby'); this.lob = root.querySelector('.fo-lobby');
    this.lobby();
    this.autoIn = new Set();
    this.off = this.FD?.on?.(() => { if (this.dead) return; if (this.room && !this.match) this.roomPaint(); else if (this.match?.over) this.lateResult(); else if (!this.match) this.refresh(); });
    const j = this.FD?.takeJoin?.();
    if (j) setTimeout(() => this.enterRoom(j), 50);
    this.onUnload = (e) => { if (this.match && this.online && !this.match.over) { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('beforeunload', this.onUnload);
  }
  destroy() {
    this.dead = true;
    if (this.match && this.online && !this.match.over) this.forfeit(true);
    this.leaveRoom(); this.endMatch();
    this.off?.(); this.music.stop();
    removeEventListener('beforeunload', this.onUnload);
  }
  me() { return this.FD?.me?.() || null; }
  list() { return this.FD?.list?.('boxe') || []; }

  /* ----- le vestiaire ----- */
  lobby(soft) {
    if (this.dead) return;
    const keep = soft && this.lob.querySelector('.fo-defy');
    const me = this.me(), fr = this.FD?.friends?.() || [], list = this.list();
    const stakeVal = keep ? this.lob.querySelector('[name=stake]')?.value : LS.get('spinbet_boxe_stake', '1000');
    const pick = keep ? this.lob.querySelector('[name=fr]:checked')?.value : null;
    this.meKey = me?.uid || '';
    this.frSig = fr.map((f) => f.uid + (f.on ? 1 : 0)).join();
    this.lob.innerHTML = `
      <section class="fo-hero bx-hero">
        <div class="fo-hero-art" aria-hidden="true"><span>🥊</span></div>
        <div><small>🥊 LE RING · COMBAT DE BOXE EN DIRECT</small><h2>La boxe entre amis</h2>
        <p>Défie un ami, misez chacun la même somme : <b>le vainqueur rafle la bourse</b>, match nul = <b>chacun récupère sa mise</b>. Droite, crochet, uppercut, esquives et garde, en <b>1re personne</b>, en <b>3e personne</b> ou en <b>vue TV</b>.</p></div>
      </section>
      <div class="fo-grid">
        <section class="fo-panel fo-defy"><h3>⚔️ Défier un ami</h3>${this.defyHTML(me, fr, stakeVal, pick)}</section>
        <section class="fo-panel fo-mine"><h3>📨 Mes combats</h3>${this.listHTML(me, list)}</section>
        <section class="fo-panel fo-train"><h3>🏋️ Entraînement contre l’ordinateur</h3>
          <p class="muted small">Sans mise, pour apprendre les coups. Ta couleur :</p>
          <div class="fo-kits">${kitDots(this.kit)}</div>
          <label class="fo-lab">Adversaire</label>
          <div class="fo-seg" data-seg="lvl">${LVLS.map((l, n) => `<button type="button" data-v="${n}" class="${n === this.lvl ? 'on' : ''}">${l}</button>`).join('')}</div>
          <label class="fo-lab">Rounds (1 min)</label>
          <div class="fo-seg" data-seg="dur">${DURS.map((d) => `<button type="button" data-v="${d}" class="${d === this.dur ? 'on' : ''}">${ROUNDS[d]} rounds</button>`).join('')}</div>
          <label class="fo-lab">Caméra</label>${camSeg(this.cam)}
          <button type="button" class="btn primary lg fo-go" data-train>▶ Monter sur le ring</button>
        </section>
        <section class="fo-panel fo-helpp"><h3>🎮 Les commandes et les règles</h3>${HELP}</section>
      </div>`;
    this.bindLobby();
  }
  refresh() {
    if (this.dead || this.match || this.room) return;
    const me = this.me(), key = me?.uid || '';
    if (key !== this.meKey) { this.meKey = key; this.lobby(true); return; }
    const list = this.list(), mine = this.lob.querySelector('.fo-mine');
    if (mine) mine.innerHTML = `<h3>📨 Mes combats</h3>${this.listHTML(me, list)}`;
    const fr = this.FD?.friends?.() || [], sig = fr.map((f) => f.uid + (f.on ? 1 : 0)).join();
    if (sig !== this.frSig) { const first = this.frSig === undefined; this.frSig = sig; if (!first) this.lobby(true); }
    for (const d of list) {
      if (d.view === 'ready' && me && d.a === me.uid && d.accMs && Date.now() - d.accMs < 90000 && !this.autoIn.has(d.id)) {
        this.autoIn.add(d.id); toast(`🥊 ${esc(d.other)} a accepté ton défi : direction le ring !`, 'ok'); this.enterRoom(d.id); break;
      }
    }
  }
  defyHTML(me, fr, stakeVal, pick) {
    if (!this.FD) return '<p class="muted">Les défis arrivent bientôt.</p>';
    if (!me) return '<p class="ref-need">Les combats entre amis demandent un <b>compte</b> (gratuit) : ta mise et tes gains y sont gardés.</p><button type="button" class="btn primary" data-signup>Créer mon compte</button>';
    const bal = Math.floor(wallet.balance);
    const friends = fr.length ? `<div class="fo-frs">${fr.map((f, n) => `<label class="fo-fr${f.on ? ' on' : ''}"><input type="radio" name="fr" value="${esc(f.uid)}" ${pick ? (pick === f.uid ? 'checked' : '') : n === 0 ? 'checked' : ''}><span class="dot"></span><b>${esc(f.name)}</b><small>${f.on ? 'en ligne' : 'hors ligne'}</small></label>`).join('')}</div>`
      : '<p class="ref-need">Ajoute d’abord tes amis avec leur pseudo :</p>';
    return `${friends}
      <div class="fo-addfr" data-friends></div>
      ${fr.length ? `<label class="fo-lab">Ta mise (ton ami mise la même somme)</label>
      <div class="fo-stake"><input name="stake" type="number" inputmode="numeric" min="0" max="${bal}" step="1" value="${esc(stakeVal)}"><span> </span></div>
      <div class="fo-chips">${STAKE_CHIPS.map((v) => `<button type="button" data-st="${v}" ${v > bal ? 'disabled' : ''}>${v ? fmt(v) : 'Pour l’honneur'}</button>`).join('')}<button type="button" data-st="${bal}">Tout (${fmt(bal)})</button></div>
      <label class="fo-lab">Nombre de rounds (1 min chacun)</label>
      <div class="fo-seg" data-seg="dur">${DURS.map((d) => `<button type="button" data-v="${d}" class="${d === this.dur ? 'on' : ''}">${ROUNDS[d]} rounds</button>`).join('')}</div>
      <label class="fo-lab">Ta couleur</label><div class="fo-kits">${kitDots(this.kit)}</div>
      <label class="fo-lab">Ta caméra</label>${camSeg(this.cam)}
      <p class="fo-pot muted small"></p>
      <button type="button" class="btn primary lg fo-go" data-defy>🥊 Envoyer le défi</button>` : ''}`;
  }
  listHTML(me, list) {
    if (!me) return '<p class="muted small">Connecte-toi pour voir tes combats.</p>';
    const rows = list.filter((d) => d.view !== 'old').map((d) => {
      const vs = esc(d.other), stake = (d.s ? `${fmt(d.s)} chacun` : 'pour l’honneur') + (d.d ? ` · ${ROUNDS[d.d] || 3} rounds` : '');
      let act = '';
      if (d.view === 'in') act = `<button type="button" class="btn primary sm" data-acc="${d.id}">🥊 Accepter et combattre</button><button type="button" class="btn ghost sm" data-ref="${d.id}">Refuser</button>`;
      else if (d.view === 'out') act = `<span class="muted small">En attente de sa réponse · ${esc(d.left)}</span><button type="button" class="btn ghost sm" data-cancel="${d.id}">Annuler</button>`;
      else if (d.view === 'ready') act = `<button type="button" class="btn primary sm" data-play="${d.id}">🥊 Combattre maintenant</button>`;
      else if (d.view === 'live') act = '<span class="muted small">Combat en cours…</span>';
      else if (d.view === 'done') act = `<span class="fo-res ${d.res}">${d.resTxt}</span>`;
      return `<div class="fo-row ${d.view}"><div><b>${d.view === 'in' ? `${vs} te défie !` : `Toi contre ${vs}`}</b><small>${stake}</small></div><div class="fo-row-act">${act}</div></div>`;
    }).join('');
    return rows || '<p class="muted small">Aucun combat pour l’instant. Choisis un ami et lance-lui un défi !</p>';
  }
  bindLobby() {
    const L = this.lob;
    try { __mods['friends.js']?.paint?.(); } catch { /* ignore */ }
    const pot = () => {
      const p = L.querySelector('.fo-pot'), v = Math.max(0, Math.floor(+L.querySelector('[name=stake]')?.value || 0)), f = L.querySelector('[name=fr]:checked');
      if (!p) return;
      const nm = f ? f.closest('label').querySelector('b').textContent : 'ton ami';
      p.innerHTML = v ? `Si ${esc(nm)} accepte, la bourse sera de <b>${fmt(v * 2)}</b> : le vainqueur la prend, nul = chacun récupère ${fmt(v)}.` : 'Combat pour l’honneur : aucune mise.';
    };
    pot();
    L.oninput = (e) => { if (e.target.name === 'stake') { LS.set('spinbet_boxe_stake', e.target.value); pot(); } };
    L.onchange = pot;
    L.onclick = (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      sfx.click?.();
      if (b.dataset.kit !== undefined) { this.kit = +b.dataset.kit; LS.set('spinbet_boxe_kit', this.kit); L.querySelectorAll('.fo-kit').forEach((k) => k.classList.toggle('on', +k.dataset.kit === this.kit)); return; }
      const seg = b.closest('[data-seg]');
      if (seg) {
        const v = +b.dataset.v, kind = seg.dataset.seg;
        if (kind === 'dur') { this.dur = v; LS.set('spinbet_boxe_dur', v); }
        else if (kind === 'cam') { this.cam = v; LS.set('spinbet_boxe_cam', v); }
        else { this.lvl = v; LS.set('spinbet_boxe_lvl', v); }
        L.querySelectorAll(`[data-seg=${kind}] button`).forEach((x) => x.classList.toggle('on', +x.dataset.v === v));
        return;
      }
      if (b.dataset.st !== undefined) { const i = L.querySelector('[name=stake]'); if (i) { i.value = b.dataset.st; LS.set('spinbet_boxe_stake', i.value); pot(); } return; }
      if (b.hasAttribute('data-train')) return this.startTraining();
      if (b.hasAttribute('data-defy')) return this.sendDefy(b);
      if (b.dataset.acc) return this.accept(b.dataset.acc, b);
      if (b.dataset.ref) { b.disabled = true; this.FD.decline(b.dataset.ref).catch(() => toast('Impossible pour le moment', 'warn')); return; }
      if (b.dataset.cancel) { b.disabled = true; this.FD.cancel(b.dataset.cancel).catch(() => toast('Annulation impossible : ton ami a peut-être déjà répondu', 'warn')); return; }
      if (b.dataset.play) return this.enterRoom(b.dataset.play);
    };
  }
  async sendDefy(b) {
    const L = this.lob, f = L.querySelector('[name=fr]:checked');
    if (!f) return toast('Choisis l’ami à défier', 'warn');
    const stake = Math.max(0, Math.floor(+L.querySelector('[name=stake]').value || 0));
    if (stake > wallet.balance) return toast(`Solde insuffisant pour miser ${fmt(stake)}`, 'warn');
    b.disabled = true;
    try {
      await this.FD.create({ to: f.value, toName: f.closest('label').querySelector('b').textContent, stake, dur: this.dur, kit: this.kit, game: 'boxe' });
      toast('🥊 Défi envoyé ! Dès que ton ami accepte, le combat commence.', 'ok');
    } catch (e) { toast(e?.message || 'Défi impossible pour le moment', 'warn'); }
    b.disabled = false;
  }
  async accept(id, b) {
    if (b) b.disabled = true;
    try { await this.FD.accept(id, this.kit); this.enterRoom(id); }
    catch (e) { if (b) b.disabled = false; toast(e?.message || 'Impossible d’accepter ce défi', 'warn'); }
  }

  /* ----- entraînement ----- */
  startTraining() {
    const me = this.me(), nm = me?.name || __mods['profile.js']?.profiles?.current?.name || 'Toi';
    const [a, b] = kitPair(this.kit, (this.kit + 1 + Math.floor(Math.random() * 5)) % KITS.length);
    const sa = skinOf(me?.uid, nm), sb = (sa + 1 + Math.floor(Math.random() * (SKIN.length - 1))) % SKIN.length;
    this.online = false;
    this.play({ online: false, seed: (Math.random() * 4294967296) >>> 0, rounds: ROUNDS[this.dur] || 3, rlen: RLEN, kits: [a, b], skins: [sa, sb], names: [nm, ['Kid Carton', 'Le Bûcheron', 'Iron Max'][this.lvl] || 'Le Bûcheron'], lvl: this.lvl, cam: this.cam,
      onEnd: (r, m) => this.soloEnd(r, m), onQuit: () => this.endMatch(), onCam: (c) => { this.cam = c; } });
  }
  soloEnd(r, m) {
    const t = r.res === 'win' ? '🏆 Victoire !' : r.res === 'lose' ? 'Défaite…' : '🤝 Match nul';
    const S = m.S;
    const o = m.showEnd(`<small>FIN DU COMBAT · ${esc(r.how)}</small><h2>${t}</h2>${m.scoreLine(S, r.res === 'tie' ? 'NUL' : S[G.WIN] === 0 ? '1 - 0' : '0 - 1')}${m.cards(S)}${m.stats(S)}<div class="fo-acts"><button type="button" class="btn primary" data-e="again">↻ Revanche</button><button type="button" class="btn ghost" data-e="out">Retour au vestiaire</button></div>`);
    if (r.res === 'win') { try { __mods['fx.js'].fx.confetti(120); sfx.bigWin(); } catch { /* ignore */ } }
    o.onclick = (e) => { const k = e.target.closest('[data-e]')?.dataset.e; if (k === 'again') { this.endMatch(); this.startTraining(); } if (k === 'out') this.endMatch(); };
  }
  play(o) {
    this.music.stop();
    this.lob.hidden = true;
    this.box.classList.add('playing');
    setFull(this.root, true);
    document.body.classList.add('derby-on');
    this.keepFull?.disconnect();
    this.keepFull = new MutationObserver(() => { if (this.match && !this.root.classList.contains('is-full')) { this.root.classList.add('is-full'); document.body.classList.add('fs-on'); } });
    this.keepFull.observe(this.root, { attributes: true, attributeFilter: ['class'] });
    this.match = new Bout(this.box, o);
    if (location.search.includes('debug')) window.__boxe = this.match;
  }
  endMatch() {
    this.keepFull?.disconnect(); this.keepFull = null;
    if (this.match) { this.match.destroy(); this.match = null; }
    document.body.classList.remove('derby-on');
    if (this.dead) return;
    this.box.classList.remove('playing');
    setFull(this.root, false);
    this.lob.hidden = false;
    this.lobby();
  }

  /* ----- défi en ligne : vestiaire d'attente, connexion, combat ----- */
  enterRoom(id) {
    const d = this.FD?.get?.(id), me = this.me();
    if (!d || !me) return toast('Ce défi n’est plus disponible', 'warn');
    if (d.st !== 'go' && d.st !== 'live') return toast(d.st === 'wait' ? 'Ton ami n’a pas encore accepté' : 'Ce combat est terminé', 'info');
    this.leaveRoom();
    const host = d.a === me.uid;
    this.room = { id, host, me: host ? 0 : 1, st: 'wait', t0: Date.now() };
    this.lob.hidden = true;
    this.box.insertAdjacentHTML('beforeend', '<div class="fo-room"></div>');
    this.roomEl = this.box.lastElementChild;
    this.roomPaint();
    this.roomEl.onclick = (e) => { const b = e.target.closest('[data-r]'); if (!b) return; if (b.dataset.r === 'cancel') this.voidMatch('Combat annulé : les mises sont rendues'); if (b.dataset.r === 'back') { this.leaveRoom(); this.lobby(); } };
    this.FD.join(id).catch(() => {});
    this.joinT = setInterval(() => this.FD.join(id).catch(() => {}), 40000);
    this.link = new Link(host, { write: (p) => this.FD.update(id, p), watch: (cb) => this.FD.watch(id, cb) }, {
      state: (s) => { this.room.net = s; this.roomPaint(); },
      open: () => this.link.sendR({ t: 'hi', v: NETV, uid: this.me()?.uid }),
      msg: (m) => this.onMsg(m),
      lost: () => this.onLost(),
    });
    this.link.start();
  }
  kitsOf(d) { return kitPair((d.ka | 0) - 10, ((d.kb ?? 11) | 0) - 10); }
  roomPaint() {
    const R = this.room; if (!R || !this.roomEl || this.match) return;
    const d = this.FD.get(R.id);
    if (!d) { this.roomEl.innerHTML = '<div class="fo-card"><p>Ce combat n’existe plus.</p><button type="button" class="btn primary" data-r="back">Retour</button></div>'; return; }
    if (d.r && !this.match) { this.leaveRoom(); this.lobby(); toast(d.r.v ? 'Combat annulé : les mises sont rendues' : 'Ce combat est terminé', 'info'); return; }
    const k = this.kitsOf(d), otherHere = R.host ? !!d.jb : !!d.ja, oname = R.host ? d.bn : d.an;
    const net = R.net === 'connected' ? 'Connectés ! Le combat arrive…' : R.net === 'connecting' ? 'Connexion entre vos deux appareils…' : R.net === 'retry' ? 'Connexion difficile, on réessaie…' : R.net === 'failed' ? 'La connexion directe n’arrive pas à passer (réseau). Essayez tous les deux en Wi-Fi, ou annulez : les mises sont rendues.' : otherHere ? `${esc(oname)} est là, connexion…` : `En attente de ${esc(oname)}… (dis-lui d’ouvrir Le Ring)`;
    this.roomEl.innerHTML = `<div class="fo-card fo-wait">
      <small>🥊 LE RING · ${ROUNDS[d.d] || 3} ROUNDS</small>
      <div class="fo-vs"><span><i style="background:${KITS[k[0]].c}"></i><b>${esc(d.an)}</b></span><em>VS</em><span><i style="background:${KITS[k[1]].c}"></i><b>${esc(d.bn)}</b></span></div>
      <div class="fo-potbig"><small>Bourse</small><b>${d.s ? fmt(d.s * 2) : 'Pour l’honneur'}</b>${d.s ? `<small>le vainqueur prend tout · nul : ${fmt(d.s)} rendus à chacun</small>` : ''}</div>
      <p class="fo-status${R.net === 'failed' ? ' bad' : ''}"><span class="fo-spin"></span>${net}</p>
      <div class="fo-acts"><button type="button" class="btn ghost" data-r="cancel">Annuler le combat (mises rendues)</button></div>
      <p class="muted small">Le combat se joue en direct sur vos deux appareils : restez sur cette page. Quitter pendant le combat = abandon (ton ami gagne).</p>
    </div>`;
  }
  leaveRoom() {
    clearInterval(this.joinT); clearTimeout(this.goT); clearTimeout(this.cutT);
    if (this.link && !this.match) { this.link.destroy(); this.link = null; }
    this.roomEl?.remove(); this.roomEl = null;
    if (!this.match) this.room = null;
  }
  async voidMatch(msg) {
    const R = this.room; if (!R) return;
    try { await this.FD.result(R.id, { v: true }); } catch { /* the other side may have written first */ }
    this.leaveRoom(); this.lobby(); toast(msg, 'info');
  }
  onMsg(m) {
    const R = this.room, L = this.link;
    if (!R || !L) return;
    if (m.t === 'hi') {
      if (m.v !== NETV) { const s = this.roomEl?.querySelector('.fo-status'); if (s) s.innerHTML = '⚠️ Vos deux versions du jeu sont différentes : rechargez la page tous les deux (tirer vers le bas), puis relancez le défi.'; return; }
      R.ok = true;
      if (R.host && !this.match) {
        clearTimeout(this.goT);
        this.goT = setTimeout(() => {
          const d = this.FD.get(R.id); if (!d || this.match) return;
          const rtt = L.rtt || 100, delay = Math.max(1, Math.min(5, Math.round(rtt / 2 / 16.7)));
          const cfg = { t: 'go', seed: (Math.random() * 4294967296) >>> 0, delay, wait: 1600 };
          L.sendR(cfg); this.startOnline(cfg, 1600);
        }, 1500);
      }
      return;
    }
    if (m.t === 'go' && !R.host && !this.match && R.ok) { this.startOnline(m, Math.max(200, m.wait - (L.rtt || 100) / 2)); return; }
    const M = this.match;
    if (!M || !M.rb) return;
    if (m.t === 'in') { M.rb.onPacket(m, performance.now()); return; }
    if (m.t === 'h' && !R.host) { const mine = M.rb.hashes.get(m.f); if (mine !== undefined && mine !== m.h && !R.asked) { R.asked = true; L.sendR({ t: 'need' }); console.warn('Ring : écart à l’image', m.f); } return; }
    if (m.t === 'need' && R.host) { const c = M.rb.checks[M.rb.checks.length - 1]; if (c?.s) L.sendR({ t: 'st', f: c.f, s: Array.from(c.s) }); return; }
    if (m.t === 'st' && !R.host) { M.rb.load(m.f, Float64Array.from(m.s)); R.asked = false; return; }
    if (m.t === 'bye') this.opponentLeft();
  }
  startOnline(cfg, wait) {
    const R = this.room, d = this.FD.get(R.id);
    if (!d || this.match) return;
    clearInterval(this.joinT);
    this.roomEl?.remove(); this.roomEl = null;
    this.online = true;
    const st = this.link, k = this.kitsOf(d);
    setTimeout(() => {
      if (this.dead || this.match) return;
      this.play({ online: true, id: R.id, me: R.me, seed: cfg.seed, delay: cfg.delay, rounds: ROUNDS[d.d] || 3, rlen: RLEN, kits: k, skins: [skinOf(d.a, d.an), (skinOf(d.b, d.bn) === skinOf(d.a, d.an) ? (skinOf(d.b, d.bn) + 2) % SKIN.length : skinOf(d.b, d.bn))],
        names: [d.an, d.bn], net: st, cam: this.cam, onEnd: () => this.onlineEnd(), onQuit: () => this.forfeit(), onCam: (c) => { this.cam = c; } });
      const M = this.match;
      M.netT = setInterval(() => { const c = M.rb?.newCheck; if (c && R.host) { M.rb.newCheck = null; st.sendR({ t: 'h', f: c.f, h: c.h }); } }, 250);
      if (R.host) this.FD.update(R.id, { st: 'live' }).catch(() => {});
    }, wait);
  }
  onLost() {
    const M = this.match;
    if (!M || M.over) return;
    M.banner('CONNEXION PERDUE', 'on se reconnecte…', 'mini');
    clearTimeout(this.cutT);
    this.cutT = setTimeout(() => { if (this.match === M && !M.over && (!this.link?.open || this.link.silent > 20000)) this.cutMatch(); }, 25000);
  }
  cutMatch() {
    const M = this.match; if (!M || M.over) return;
    const rb = M.rb, c = Math.min(rb.confirmed, rb.frame), st = rb.ring[c % RB_SLOTS][G.FRAME] === c ? rb.ring[c % RB_SLOTS] : rb.S;
    M.over = true;
    this.report(M.leader(st), 'cut', st);
  }
  onlineEnd() { this.report(this.match.leader(), 'end'); }
  opponentLeft() {
    const M = this.match; if (!M || M.over) return;
    M.over = true;
    const d = this.FD.get(this.room.id);
    this.report({ a: 0, b: 0, f: this.room.host ? d?.b : d?.a }, 'bye');
  }
  forfeit(silent) {
    const M = this.match, R = this.room; if (!M || !R) return;
    M.over = true;
    const me = this.me();
    try { this.link?.sendR({ t: 'bye' }); } catch { /* ignore */ }
    this.FD.result(R.id, { a: 0, b: 0, f: me?.uid || '' }).catch(() => {});
    if (!silent) this.report({ a: 0, b: 0, f: me?.uid }, 'quit');
  }
  lateResult() {
    const R = this.room, d = R && this.FD.get(R.id);
    if (!d?.r || !this.shownR || resKey(d.r) === this.shownR || this.relate) return;
    this.relate = true;
    this.report({ a: d.r.a, b: d.r.b, f: d.r.f }, d.r.f ? (d.r.f === this.me()?.uid ? 'quit' : 'bye') : 'end', null, true).finally(() => { this.relate = false; });
  }
  async report(r, why, st, again) {
    const R = this.room, M = this.match;
    if (!R || !M) return;
    if (why !== 'quit' && !again) { try { await this.FD.result(R.id, { a: r.a, b: r.b, f: r.f || '' }); } catch { /* the other phone wrote it first */ } }
    const d = this.FD.get(R.id) || {}, fin = d.r || r, me = R.me;
    this.shownR = resKey(fin);
    const mine = me === 0 ? fin.a : fin.b, theirs = me === 0 ? fin.b : fin.a, my = this.me()?.uid;
    const res = fin.v ? 'void' : fin.f ? (fin.f === my ? 'lose' : 'win') : mine > theirs ? 'win' : mine < theirs ? 'lose' : 'tie';
    const s = d.s || 0;
    const money = res === 'win' ? `+${fmt(s * 2)}` : res === 'tie' || res === 'void' ? `${fmt(s)} rendus` : s ? `−${fmt(s)}` : '';
    const title = res === 'win' ? '🏆 Victoire !' : res === 'lose' ? 'Défaite…' : res === 'void' ? 'Combat annulé' : '🤝 Match nul';
    const why2 = why === 'bye' ? '<p class="muted">Ton adversaire a abandonné.</p>' : why === 'quit' ? '<p class="muted">Tu as abandonné le combat.</p>' : why === 'cut' ? '<p class="muted">La connexion a été coupée : les cartes des juges à ce moment comptent.</p>' : '';
    const S = st || M.S;
    const o = M.showEnd(`<small>FIN DU COMBAT${S[G.PHASE] === PH.END ? ` · ${esc(howTxt(S))}` : ''}</small><h2>${title}</h2>${why2}${M.scoreLine(S, res === 'tie' || res === 'void' ? 'NUL' : (res === 'win') === (me === 0) ? '1 - 0' : '0 - 1')}
      ${s ? `<div class="fo-money ${res}">${money}</div>` : ''}${M.cards(S)}${M.stats(S)}
      <div class="fo-acts"><button type="button" class="btn primary" data-e="again">⚔️ Revanche</button><button type="button" class="btn ghost" data-e="out">Retour au vestiaire</button></div>`);
    if (res === 'win') { try { __mods['fx.js'].fx.confetti(120); sfx.bigWin(); } catch { /* ignore */ } }
    o.onclick = async (e) => {
      const k = e.target.closest('[data-e]')?.dataset.e;
      if (k === 'out') this.closeOnline();
      if (k === 'again') {
        const other = me === 0 ? { uid: d.b, name: d.bn } : { uid: d.a, name: d.an };
        try { await this.FD.create({ to: other.uid, toName: other.name, stake: d.s || 0, dur: d.d || 4, kit: this.kit, game: 'boxe' }); toast(`⚔️ Revanche proposée à ${esc(other.name)} !`, 'ok'); } catch (err) { toast(err?.message || 'Revanche impossible pour le moment', 'warn'); }
        this.closeOnline();
      }
    };
  }
  closeOnline() {
    if (this.match?.netT) clearInterval(this.match.netT);
    this.link?.destroy(); this.link = null; this.room = null;
    this.endMatch();
  }
}

return { BoxeGame, ENGINE };
})();
