// SpinBet Casino · FootGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/foot.js ----
__mods['games/impl/foot.js'] = (() => {
// Le Derby (demande du propriétaire) : un vrai match de foot 11 contre 11 entre deux amis, en direct, avec une mise.
// - Moteur (bloc ===ENGINE) : simulation à 60 images/s, entièrement déterministe (pas de Math.random, pas de
//   sin/cos/exp du navigateur : seulement + − × ÷ et √), tout l'état dans un Float64Array. Les deux téléphones font
//   tourner le même match à partir des mêmes commandes : seules les commandes (stick + boutons) passent sur le réseau.
// - Réseau : WebRTC pair à pair (connexion préparée par Firestore, foot/{id}), « rollback » : chaque téléphone joue
//   tout de suite avec ses commandes, devine celles de l'autre, et corrige quand elles arrivent. Contrôle de
//   cohérence toutes les secondes ; en cas d'écart, l'hôte (celui qui a lancé le défi) renvoie l'état du match.
// - Rendu : caméra TV de bord de terrain (paysage) ou derrière l'action (portrait), canvas 2D.
// - Mises et paiements : module foot-defis.js d'index.html (défis entre amis, cagnotte, nul = mises rendues).

/* ===ENGINE */
// ---------- terrain, joueurs, ballon (mètres, secondes) ----------
const FPS = 60, DT = 1 / 60;
const HL = 50, HW = 32;                  // demi-longueur, demi-largeur
const GW = 3.66, GH = 2.44, GD = 2.2;    // buts : demi-largeur, hauteur, profondeur du filet
const BOXD = 16.5, BOXW = 20.16, SIXD = 5.5, SIXW = 9.16, SPOT = 11, CIRC = 9.15;
const BR = 0.11, POSTR = 0.06, NT = 11, NP = 22, GRAV = 11;
const RUN = 6.2, SPRINT = 8.3, RUNB = 5.8, SPRINTB = 7.7, ACC = 22, ACCB = 16;
const ROLL_C = 1.1, ROLL_D = 0.016, AIR_D = 0.0085, CTRL_R = 0.8;
// commandes : stick x et y (−100 à 100) sur 8 bits chacun, puis les boutons
const IN_P = 1 << 16, IN_S = 1 << 17, IN_T = 1 << 18, IN_R = 1 << 19, IN_ON = 1 << 20, IN_BTN = IN_P | IN_S | IN_T | IN_R;
const encIn = (jx, jy, b) => ((Math.round(jx) + 128) & 255) | (((Math.round(jy) + 128) & 255) << 8) | b;
const ijx = (v) => (v & 255) - 128, ijy = (v) => ((v >> 8) & 255) - 128;

const PH = { KICKOFF: 1, PLAY: 2, GOAL: 3, OUT: 4, SET: 5, FOUL: 6, HALF: 7, END: 8 };
const SP = { THROW: 1, CORNER: 2, GOALKICK: 3, FREE: 4, PEN: 5 };
const A = { NONE: 0, KICK: 1, SLIDE: 2, GETUP: 3, FALL: 4, DIVE: 5, HEAD: 6, LUNGE: 7, CELEB: 8, HOLD: 9, SKILL: 10, THROW: 11, SAD: 12 };
const EV = { GOAL: 1, POST: 2, SAVE: 3, CATCH: 4, OUT: 5, FOUL: 6, PEN: 7, WHISTLE: 8, HALF: 9, END: 10, KICK: 11, SHOT: 12, TACKLE: 13, BOUNCE: 14, BLOCK: 15, MISS: 16, BAR: 17, CORNER: 18, THROW: 19, GKICK: 20, FREE: 21, HEADER: 22, PASS: 23 };
const CELEB_F = 150, REPLAY_F = 330, REPLAY_BACK = 150;

// ---------- l'état du match : un seul Float64Array ----------
const GL = ['FRAME', 'TIME', 'HALF', 'PHASE', 'PT', 'SC0', 'SC1', 'KO1', 'KOT', 'SPK', 'SPT', 'SPX', 'SPY', 'TAKER', 'SPGO',
  'CT0', 'CT1', 'SW0', 'SW1', 'RNG', 'POSS', 'LT', 'LTT', 'PTO', 'PFROM', 'PAIR', 'PASSF', 'SHOT', 'SHOTF', 'SHOTT',
  'PB0', 'PB1', 'HP0', 'HP1', 'HS0', 'HS1', 'QA0', 'QA1', 'QF0', 'QF1', 'QP0', 'QP1', 'PRS0', 'PRS1',
  'EVN', 'ST0', 'ST1', 'OT0', 'OT1', 'PF0', 'PF1', 'PA0', 'PA1', 'PC0', 'PC1', 'SV0', 'SV1', 'TK0', 'TK1', 'FO0', 'FO1', 'CO0', 'CO1',
  'AIL0', 'AIL1', 'HUM0', 'HUM1', 'DUR', 'SIDE', 'GOALF', 'GOALP', 'GOALA', 'GOALT', 'GOALO', 'SKIP', 'PRES0', 'PRES1', 'COV0', 'COV1',
  'WALL', 'PENDIR', 'LASTKO', 'XTRA'];
const G = {}; GL.forEach((k, i) => { G[k] = i; });
const EVB = GL.length, EVS = 16;
const BB = EVB + EVS * 3;
const BX = 0, BY = 1, BZ = 2, BVX = 3, BVY = 4, BVZ = 5, BSPIN = 6, BOWN = 7, BHELD = 8, BLX = 9, BLY = 10, BLZ = 11, BNET = 12, BSZ = 13;
const PB = BB + BSZ;
const PX = 0, PY = 1, PVX = 2, PVY = 3, PFX = 4, PFY = 5, PACT = 6, PAT = 7, PAX = 8, PAY = 9, PCOOL = 10, PRUN = 11,
  PTX = 12, PTY = 13, PROLE = 14, PMARK = 15, PCF = 16, PHIT = 17, PSKC = 18, PDH = 19, PSZ = 20;
const SLEN = PB + NP * PSZ;
const R_ZONE = 0, R_PRESS = 1, R_COVER = 2, R_MARK = 3, R_CHASE = 4, R_RUN = 6;

// 4-4-2 : x de son but (−1) au but adverse (+1), y de −1 à 1, ligne (0 gardien, 1 défense, 2 milieu, 3 attaque)
const FORM = [
  [-0.95, 0, 0],
  [-0.58, -0.66, 1], [-0.66, -0.22, 1], [-0.66, 0.22, 1], [-0.58, 0.66, 1],
  [-0.16, -0.64, 2], [-0.27, -0.2, 2], [-0.27, 0.2, 2], [-0.16, 0.64, 2],
  [0.13, -0.2, 3], [0.13, 0.2, 3],
];
const KOFF = [[-0.95, 0], [-0.5, -0.62], [-0.57, -0.2], [-0.57, 0.2], [-0.5, 0.62], [-0.24, -0.6], [-0.27, -0.17], [-0.27, 0.17], [-0.24, 0.6], [-0.03, -0.26], [-0.03, 0.26]];
const FOLLOW = [0, 0.55, 0.68, 0.6], PUSH_A = [0, 0.18, 0.2, 0.22], PUSH_D = [0, -0.07, -0.1, -0.05];
const XMIN = [-1, -0.92, -0.8, -0.5], XMAX = [-0.6, 0.36, 0.72, 0.9];
const LVL_SAVE = [0.8, 0.95, 1.06], LVL_REACT = [13, 9, 5], LVL_ERR = [1.5, 1.12, 0.88], LVL_TACK = [0.48, 0.58, 0.68], LVL_BLOCK = [0.025, 0.045, 0.065];
const LVL_SPD = [0.9, 1, 1.05], LVL_SHOT = [0.7, 1, 1.5], LVL_SKILL = [0.04, 0.12, 0.22]; // the computer's speed and appetite for shooting (training levels; both teams are « normal » online)

// ---------- calculs déterministes ----------
function dexp(x) { // e^x with only + − × ÷ (same result on every phone)
  let k = 0;
  while (x > 0.0625 || x < -0.0625) { x *= 0.5; k++; }
  let s = 1 + x * (1 + (x / 2) * (1 + (x / 3) * (1 + (x / 4) * (1 + (x / 5) * (1 + x / 6)))));
  while (k-- > 0) s *= s;
  return s;
}
function rnd(S) { // xorshift32, state kept in the match
  let x = S[G.RNG] >>> 0;
  x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
  S[G.RNG] = x;
  return x / 4294967296;
}
const gauss = (S) => (rnd(S) + rnd(S) + rnd(S) - 1.5) * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sgn = (v) => (v < 0 ? -1 : 1);
const pOf = (i) => PB + i * PSZ;
const teamOf = (i) => (i < NT ? 0 : 1);
const dirOf = (S, t) => (t ? -S[G.SIDE] : S[G.SIDE]);
const isHum = (S, t) => S[G.HUM0 + t] > 0;
const ctrlOf = (S, t) => S[G.CT0 + t];
function ev(S, code, a) { const k = EVB + (S[G.EVN] % EVS) * 3; S[k] = code; S[k + 1] = S[G.FRAME]; S[k + 2] = a; S[G.EVN]++; }
function dist2(S, i, x, y) { const p = pOf(i), dx = S[p + PX] - x, dy = S[p + PY] - y; return dx * dx + dy * dy; }
function inBoxOf(S, t, x, y) { const gx = -dirOf(S, t) * HL; return Math.abs(x - gx) < BOXD + 0.3 && Math.abs(y) < BOXW + 0.3 && x * gx > 0; }

// scratch values of the current frame (derived from the inputs, never kept between frames)
const JX = [0, 0], JY = [0, 0], HELD = [0, 0], PRESS = [0, 0], REL = [0, 0], ON = [0, 0];
let DVX = 0, DVY = 0, BEST = 0;
const PRED = new Float64Array(3 * 40); // predicted ball path (x, y, z every 3 frames)
let predF = -1;

// ---------- un nouveau match ----------
function newMatch(o) {
  const S = new Float64Array(SLEN);
  S[G.RNG] = (o.seed >>> 0) || 0x2545f491;
  S[G.HALF] = 1; S[G.DUR] = o.dur || 7200; S[G.SIDE] = 1;
  S[G.HUM0] = o.hum ? o.hum[0] : 0; S[G.HUM1] = o.hum ? o.hum[1] : 0;
  S[G.AIL0] = o.ail ? o.ail[0] : 1; S[G.AIL1] = o.ail ? o.ail[1] : 1;
  for (const k of ['CT0', 'CT1', 'PTO', 'PFROM', 'LT', 'LTT', 'GOALP', 'GOALA', 'GOALT', 'TAKER', 'PRES0', 'PRES1', 'COV0', 'COV1']) S[G[k]] = -1;
  S[BB + BOWN] = -1;
  for (let i = 0; i < NP; i++) { const p = pOf(i); S[p + PMARK] = -1; S[p + PFX] = teamOf(i) ? -1 : 1; }
  const kt = (S[G.RNG] >>> 7) & 1;
  S[G.KO1] = kt;
  kickoff(S, kt, true);
  return S;
}

function place(S, i, x, y, fx, fy) {
  const p = pOf(i);
  S[p + PX] = x; S[p + PY] = y; S[p + PVX] = 0; S[p + PVY] = 0; S[p + PFX] = fx; S[p + PFY] = fy;
  S[p + PACT] = A.NONE; S[p + PAT] = 0; S[p + PCOOL] = 0; S[p + PTX] = x; S[p + PTY] = y; S[p + PROLE] = R_ZONE; S[p + PMARK] = -1; S[p + PHIT] = 0; S[p + PCF] = 0;
}
function kickoffPlaces(S, kt) {
  for (let i = 0; i < NP; i++) {
    const t = teamOf(i), s = i % NT, d = dirOf(S, t);
    let x = KOFF[s][0] * HL * d, y = KOFF[s][1] * HW * d;
    if (t !== kt && s >= 9) { x = -0.2 * HL * d; y = (s === 9 ? -6 : 6) * d; }
    if (t === kt && s === 9) { x = -0.55 * d; y = 0; }
    if (t === kt && s === 10) { x = -1.6 * d; y = 7 * d; }
    place(S, i, x, y, d, 0);
  }
}
function resetBall(S, x, y) {
  const b = BB;
  S[b + BX] = x; S[b + BY] = y; S[b + BZ] = 0; S[b + BVX] = 0; S[b + BVY] = 0; S[b + BVZ] = 0; S[b + BSPIN] = 0;
  S[b + BOWN] = -1; S[b + BHELD] = 0; S[b + BNET] = 0; S[b + BLX] = x; S[b + BLY] = y; S[b + BLZ] = 0;
}
function kickoff(S, kt, first) {
  S[G.PHASE] = PH.KICKOFF; S[G.PT] = 0; S[G.KOT] = kt; S[G.LASTKO] = first ? 1 : 0;
  resetBall(S, 0, 0);
  kickoffPlaces(S, kt);
  const tk = kt * NT + 9, d = dirOf(S, kt);
  S[G.TAKER] = tk;
  S[BB + BOWN] = tk; S[BB + BX] = S[pOf(tk) + PX] + d * 0.5;
  S[G.CT0] = kt === 0 ? tk : 9; S[G.CT1] = kt === 1 ? tk : NT + 9;
  S[G.PTO] = -1; S[G.PFROM] = -1; S[G.SHOT] = 0; S[G.POSS] = kt; S[G.LT] = tk; S[G.LTT] = kt;
  for (let t = 0; t < 2; t++) { S[G.QA0 + t] = 0; S[G.HP0 + t] = 0; S[G.HS0 + t] = 0; S[G.SW0 + t] = 0; }
  S[G.SKIP] = 0;
}

// ---------- une image du match ----------
function readInputs(S, t, v) {
  const on = isHum(S, t) && (v & IN_ON) ? 1 : 0;
  const held = on ? v & IN_BTN : 0, prev = S[G.PB0 + t];
  ON[t] = on; HELD[t] = held; PRESS[t] = held & ~prev; REL[t] = prev & ~held;
  S[G.PB0 + t] = held;
  if (on) { let x = ijx(v), y = ijy(v); const m = x * x + y * y; if (m > 10000) { const k = 100 / Math.sqrt(m); x *= k; y *= k; } JX[t] = x; JY[t] = y; } else { JX[t] = 0; JY[t] = 0; }
}

function step(S, in0, in1) {
  if (S[G.PHASE] === PH.END) return;
  S[G.FRAME]++; S[G.PT]++;
  readInputs(S, 0, in0); readInputs(S, 1, in1);
  predF = -1;
  const ph = S[G.PHASE], pt = S[G.PT];
  if (ph === PH.KICKOFF) {
    moveAll(S, false); separate(S); dribble(S);
    if (pt >= (S[G.LASTKO] ? 100 : 70)) { ev(S, EV.WHISTLE, 0); S[G.PHASE] = PH.PLAY; S[G.PT] = 0; S[pOf(S[G.TAKER]) + PCF] = 0; }
  } else if (ph === PH.PLAY) {
    play(S);
  } else if (ph === PH.OUT || ph === PH.FOUL) {
    S[G.TIME]++;
    moveAll(S, false); separate(S); freeBall(S, true);
    if (pt >= (ph === PH.OUT ? 42 : 72)) setPiece(S);
  } else if (ph === PH.SET) {
    S[G.TIME]++;
    setFrame(S);
  } else if (ph === PH.GOAL) {
    goalFrame(S);
  } else if (ph === PH.HALF) {
    skipFlags(S, 60);
    if (pt >= 330 || (pt > 60 && S[G.SKIP] === 3)) { S[G.SIDE] = -S[G.SIDE]; S[G.HALF] = 2; S[G.TIME] = 0; kickoff(S, 1 - S[G.KO1], true); }
  }
  for (let t = 0; t < 2; t++) if (S[G.QF0 + t] > 0 && --S[G.QF0 + t] <= 0) S[G.QA0 + t] = 0;
  if ((S[G.PHASE] === PH.PLAY || S[G.PHASE] === PH.OUT || S[G.PHASE] === PH.SET) && timeUp(S)) endHalf(S);
}

function skipFlags(S, from) {
  for (let t = 0; t < 2; t++) {
    if (!isHum(S, t)) S[G.SKIP] = S[G.SKIP] | (1 << t);
    else if (S[G.PT] > from && PRESS[t]) S[G.SKIP] = S[G.SKIP] | (1 << t);
  }
}

function timeUp(S) {
  if (S[G.TIME] < S[G.DUR]) return false;
  const extra = S[G.TIME] - S[G.DUR];
  if (S[G.PHASE] === PH.SET && S[G.SPK] === SP.PEN && extra < 1200) return false; // the penalty is taken
  if (extra > 480) return true;
  if (S[G.PHASE] !== PH.PLAY) return extra > 0;
  if (S[G.SHOT]) return false; // a shot on its way
  const b = BB;
  if (HL - Math.abs(S[b + BX]) < 26 && Math.abs(S[b + BY]) < 24) return false; // an attack near a goal
  return true;
}
function endHalf(S) {
  S[BB + BOWN] = -1; S[BB + BHELD] = 0;
  if (S[G.HALF] === 1) { ev(S, EV.HALF, 0); S[G.PHASE] = PH.HALF; S[G.PT] = 0; S[G.SKIP] = 0; }
  else { ev(S, EV.END, 0); S[G.PHASE] = PH.END; S[G.PT] = 0; }
}

function play(S) {
  S[G.TIME]++;
  const f = S[G.FRAME], own = S[BB + BOWN];
  if (own >= 0) S[G.PF0 + teamOf(own)]++;
  if (S[G.SHOT] && f - S[G.SHOTF] > 150) S[G.SHOT] = 0;
  if (f % 6 === 0) teamAI(S, 0); else if (f % 6 === 3) teamAI(S, 1);
  humans(S);
  if (S[G.PHASE] !== PH.PLAY) return;
  carrier(S);
  moveAll(S, true);
  separate(S);
  if (S[BB + BOWN] >= 0) dribble(S); else freeBall(S, false);
  tackles(S);
  if (S[G.PHASE] !== PH.PLAY) return;
  contacts(S);
  rules(S);
  if (S[G.PHASE] === PH.PLAY) autoSwitch(S);
}

// ---------- les joueurs humains ----------
function humans(S) {
  for (let t = 0; t < 2; t++) {
    if (!ON[t]) continue;
    const held = HELD[t], pr = PRESS[t], rl = REL[t];
    if (held & IN_P) S[G.HP0 + t]++;
    if (held & IN_S) S[G.HS0 + t]++;
    const c = ctrlOf(S, t);
    if (c >= 0) {
      const p = pOf(c), own = S[BB + BOWN], act = S[p + PACT];
      const busy = act === A.SLIDE || act === A.FALL || act === A.GETUP || act === A.DIVE || act === A.LUNGE;
      S[G.PRS0 + t] = 0;
      if (own === c && !busy) {
        if (S[BB + BHELD] === 1) { // the keeper has it in his hands: throw / long kick
          if (rl & IN_P) keeperOut(S, c, S[G.HP0 + t] > 14 ? 2 : 1, JX[t], JY[t]);
          else if (rl & IN_S) keeperOut(S, c, 2, JX[t], JY[t]);
        } else if (rl & IN_P) pass(S, c, JX[t], JY[t], S[G.HP0 + t] > 14, S[G.HP0 + t]);
        else if (rl & IN_S) shoot(S, c, JX[t], JY[t], S[G.HS0 + t], 0);
        else if (pr & IN_T) skill(S, c, JX[t], JY[t]);
      } else if (own >= 0 && teamOf(own) !== t) { // defending
        if (pr & IN_P) switchTo(S, t, nearestTo(S, t, S[BB + BX], S[BB + BY], c, false));
        if ((pr & IN_T) && !busy) tackle(S, c, JX[t], JY[t]);
        if (held & IN_S) S[G.PRS0 + t] = 1;
      } else if (own < 0) { // loose ball, or a pass on its way: one touch, volley, header, or later on receiving it
        const near = ballNear(S, c);
        if (rl & IN_S) { if (near && !busy) firstTime(S, c, 2, JX[t], JY[t], S[G.HS0 + t]); else queue(S, t, 2, S[G.HS0 + t]); }
        else if (rl & IN_P) { if (near && !busy) firstTime(S, c, 1, JX[t], JY[t], S[G.HP0 + t]); else queue(S, t, S[G.HP0 + t] > 14 ? 3 : 1, S[G.HP0 + t]); }
        if ((pr & IN_T) && !busy) tackle(S, c, JX[t], JY[t]);
      }
    }
    if (!(held & IN_P)) S[G.HP0 + t] = 0;
    if (!(held & IN_S)) S[G.HS0 + t] = 0;
  }
}
function queue(S, t, a, pw) { S[G.QA0 + t] = a; S[G.QF0 + t] = 24; S[G.QP0 + t] = pw; }
function ballNear(S, i) {
  const p = pOf(i), b = BB, dx = S[b + BX] - S[p + PX], dy = S[b + BY] - S[p + PY];
  return S[b + BOWN] < 0 && !S[b + BHELD] && dx * dx + dy * dy < 1.6 && S[b + BZ] < 2.4 && S[p + PCOOL] <= 0;
}
function switchTo(S, t, j) {
  if (j < 0) return;
  S[G.CT0 + t] = j; S[G.SW0 + t] = 40;
}
function nearestTo(S, t, x, y, except, withKeeper) {
  let best = -1, bd = 1e9;
  for (let s = withKeeper ? 0 : 1; s < NT; s++) {
    const i = t * NT + s;
    if (i === except) continue;
    const a = S[pOf(i) + PACT];
    const d = dist2(S, i, x, y) + (a === A.FALL || a === A.GETUP || a === A.SLIDE ? 30 : 0);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
// one-touch pass / volley / header straight away, the ball not under control
function firstTime(S, i, kind, jx, jy, hold) {
  const t = teamOf(i), b = BB;
  S[b + BOWN] = i; S[b + BHELD] = 0; // the kick functions take the ball from its owner
  if (kind === 2) shoot(S, i, jx, jy, Math.max(hold, 20), S[b + BZ] > 1.3 ? 2 : 1);
  else pass(S, i, jx, jy, hold > 14, hold);
  S[G.QA0 + t] = 0;
}

// ---------- frapper le ballon ----------
function kick(S, i, vx, vy, vz, spin) {
  const b = BB, p = pOf(i), t = teamOf(i);
  if (S[b + BOWN] === i && !S[b + BZ]) { S[b + BX] = S[p + PX] + S[p + PFX] * 0.45; S[b + BY] = S[p + PY] + S[p + PFY] * 0.45; }
  S[b + BOWN] = -1; S[b + BHELD] = 0;
  S[b + BVX] = vx; S[b + BVY] = vy; S[b + BVZ] = vz; S[b + BSPIN] = spin || 0;
  if (vz > 0 && S[b + BZ] < 0.02) S[b + BZ] = 0.02;
  S[p + PCOOL] = 16; S[p + PCF] = 0;
  if (S[p + PACT] === A.NONE || S[p + PACT] === A.SKILL || S[p + PACT] === A.HOLD) { S[p + PACT] = A.KICK; S[p + PAT] = 14; }
  S[G.LT] = i; S[G.LTT] = t; S[G.SHOT] = 0; S[G.PTO] = -1;
  ev(S, EV.KICK, i);
}
// ground pass speed so that the ball arrives with speed v1 after L metres
function groundSpeed(L, v1) {
  const c = ROLL_C + ROLL_D * v1 * v1;
  return Math.min(29, Math.sqrt(Math.max(0, (c * dexp(2 * ROLL_D * L) - ROLL_C) / ROLL_D)));
}
// the best teammate to pass to (with a preferred direction from the stick); BEST = its score
function bestPass(S, i, dx, dy, human) {
  const p = pOf(i), t = teamOf(i), d = dirOf(S, t), x = S[p + PX], y = S[p + PY], o = 1 - t;
  const dm = Math.sqrt(dx * dx + dy * dy);
  let best = -1; BEST = -1e9;
  for (let s = 0; s < NT; s++) {
    const j = t * NT + s;
    if (j === i) continue;
    const q = pOf(j);
    if (S[q + PACT] === A.FALL || S[q + PACT] === A.GETUP) continue;
    const tx = S[q + PX] + S[q + PVX] * 0.55, ty = S[q + PY] + S[q + PVY] * 0.55;
    const vx = tx - x, vy = ty - y, L = Math.sqrt(vx * vx + vy * vy);
    if (L < 3.5 || L > 46) continue;
    if (s === 0 && (!human || d * x > -HL * 0.4)) continue; // the keeper only for a back pass from the defence
    // interception risk along the way
    let safe = 6;
    for (let k = 0; k < NT; k++) {
      const r = pOf(o * NT + k), ox = S[r + PX] - x, oy = S[r + PY] - y;
      const u = clamp((ox * vx + oy * vy) / (L * L), 0, 1), cx = ox - vx * u, cy = oy - vy * u;
      const lane = Math.sqrt(cx * cx + cy * cy) - (0.8 + u * L * 0.16);
      if (lane < safe) safe = lane;
    }
    let open = 9;
    for (let k = 0; k < NT; k++) { const r = pOf(o * NT + k), ex = S[r + PX] - tx, ey = S[r + PY] - ty, e = Math.sqrt(ex * ex + ey * ey); if (e < open) open = e; }
    let sc = value(S, t, tx, ty) + Math.min(open, 7) * 0.016 - (safe < 0 ? 0.5 + safe * -0.1 : safe < 1 ? 0.12 : 0) - (L > 32 ? 0.06 : 0);
    if (human) {
      const cs = dm > 25 ? (vx * dx + vy * dy) / (L * dm) : (vx * S[p + PFX] + vy * S[p + PFY]) / L;
      if (cs < 0.35) continue;
      sc = cs * 4 + sc * 0.35 - L * 0.01;
    }
    if (sc > BEST) { BEST = sc; best = j; }
  }
  return best;
}
function pass(S, i, jx, jy, lofted, hold) {
  const p = pOf(i), t = teamOf(i), x = S[p + PX], y = S[p + PY];
  const hum = isHum(S, t) && ctrlOf(S, t) === i;
  const j = bestPass(S, i, jx, jy, hum);
  if (j < 0) { // nobody that way: into space
    const m = Math.sqrt(jx * jx + jy * jy);
    const ux = m > 25 ? jx / m : S[p + PFX], uy = m > 25 ? jy / m : S[p + PFY];
    passTo(S, i, -1, x + ux * (lofted ? 26 : 16), y + uy * (lofted ? 26 : 16), lofted);
    return;
  }
  passTo(S, i, j, 0, 0, lofted);
}
function passTo(S, i, j, tx, ty, lofted) {
  const p = pOf(i), t = teamOf(i), x = S[p + PX], y = S[p + PY], lvl = S[G.AIL0 + t];
  const hum = isHum(S, t) && ctrlOf(S, t) === i;
  if (j >= 0) {
    const q = pOf(j);
    let L = Math.sqrt(dist2(S, j, x, y));
    const T = lofted ? 0.8 + L / 26 : L / 15;
    tx = S[q + PX] + S[q + PVX] * T * 0.85; ty = S[q + PY] + S[q + PVY] * T * 0.85;
  }
  tx = clamp(tx, -HL + 1, HL - 1); ty = clamp(ty, -HW + 1, HW - 1);
  let vx = tx - x, vy = ty - y, L = Math.sqrt(vx * vx + vy * vy);
  if (L < 0.5) { vx = S[p + PFX]; vy = S[p + PFY]; L = 1; }
  const err = (hum ? 0.012 : 0.02 * LVL_ERR[lvl]) * gauss(S);
  const ux = vx / L - (vy / L) * err, uy = vy / L + (vx / L) * err;
  if (lofted) {
    const T = 0.8 + L / 26, vh = (L / T) * 1.06;
    kick(S, i, ux * vh, uy * vh, (GRAV * T) / 2, 0);
    S[G.PAIR] = 1;
  } else {
    const v0 = groundSpeed(L, 8 + L * 0.12);
    kick(S, i, ux * v0, uy * v0, 0, 0);
    S[G.PAIR] = 0;
  }
  S[G.PTO] = j; S[G.PFROM] = i; S[G.PASSF] = S[G.FRAME];
  S[G.PA0 + t]++;
  if (j >= 0 && isHum(S, t) && ctrlOf(S, t) === i) { S[G.CT0 + t] = j; S[G.SW0 + t] = 30; }
  ev(S, EV.PASS, i);
}
// a shot: power from the button hold, aim from the stick (else away from the keeper)
function shoot(S, i, jx, jy, hold, kind, force) {
  const p = pOf(i), t = teamOf(i), d = dirOf(S, t), b = BB, lvl = S[G.AIL0 + t];
  const hum = isHum(S, t) && ctrlOf(S, t) === i;
  const x = S[b + BOWN] === i ? S[p + PX] + S[p + PFX] * 0.45 : S[b + BX], y = S[b + BOWN] === i ? S[p + PY] + S[p + PFY] * 0.45 : S[b + BY];
  const gx = d * HL, gk = pOf((1 - t) * NT);
  const pw = clamp(0.28 + hold / 52, 0.28, 1.05);
  // aim across the goal: the stick component along the goal line, else the side away from the keeper
  let aim;
  if (force !== undefined) aim = force;
  else if (hum && Math.abs(jy) > 28) aim = clamp(jy / 100, -1, 1) * (GW - 0.32);
  else aim = (S[gk + PY] - y * 0.1 > 0 ? -1 : 1) * (GW - 0.55 - rnd(S) * 0.6);
  const D = Math.sqrt((gx - x) * (gx - x) + (aim - y) * (aim - y));
  // pressure and body angle make it harder
  let press = 0;
  for (let k = 0; k < NT; k++) { const e = Math.sqrt(dist2(S, (1 - t) * NT + k, x, y)); if (e < 2.2) press += (2.2 - e) * 0.35; }
  const fx = S[p + PFX], fy = S[p + PFY], tdx = (gx - x) / D, tdy = (aim - y) / D;
  const mis = 1 - (fx * tdx + fy * tdy);
  let sig = (0.22 + 0.75 * pw * pw + press + mis * 1.2) * (D / 20);
  if (!hum) sig *= LVL_ERR[lvl];
  if (kind === 2) sig *= 1.5;
  aim += gauss(S) * sig * 0.85;
  let h = 0.18 + 1.25 * pw * pw + Math.abs(gauss(S)) * 0.22 * (0.5 + pw) + (pw > 0.9 ? (pw - 0.9) * 13 : 0);
  let sp = kind === 2 ? 12 + 6 * pw : kind === 1 ? 15 + 13 * pw : 15 + 16 * pw;
  if (D > 26) sp += 2;
  const vx = gx - x, vy = aim - y, L = Math.sqrt(vx * vx + vy * vy);
  const T = L / (sp * 0.93), z0 = kind === 2 ? S[b + BZ] : 0.1;
  if (kind === 2) h = clamp(h * 0.55, 0.2, 2.3);
  const vz = (h - z0) / T + (GRAV * T) / 2;
  if (S[b + BOWN] !== i) { S[b + BOWN] = i; }
  kick(S, i, (vx / L) * sp, (vy / L) * sp, Math.max(kind === 2 ? -2 : 0, vz), clamp(gauss(S) * 1.2, -2.5, 2.5));
  if (kind === 2) { S[b + BX] = x; S[b + BY] = y; }
  S[G.SHOT] = 1; S[G.SHOTF] = S[G.FRAME]; S[G.SHOTT] = t;
  S[G.ST0 + t]++;
  if (kind === 2) { S[p + PACT] = A.HEAD; S[p + PAT] = 20; ev(S, EV.HEADER, i); }
  ev(S, EV.SHOT, i);
}
function skill(S, i, jx, jy) {
  const p = pOf(i);
  if (S[p + PSKC] > 0 || S[p + PACT] !== A.NONE) return;
  let ux = jx, uy = jy, m = Math.sqrt(ux * ux + uy * uy);
  if (m < 30) { // no direction: a cut away from the closest opponent
    const o = nearestTo(S, 1 - teamOf(i), S[p + PX], S[p + PY], -1, true), q = pOf(o);
    const ox = S[q + PX] - S[p + PX], oy = S[q + PY] - S[p + PY];
    ux = S[p + PFX] - oy * 0.4 * sgn(S[p + PFX] * oy - S[p + PFY] * ox); uy = S[p + PFY] + ox * 0.4 * sgn(S[p + PFX] * oy - S[p + PFY] * ox);
    m = Math.sqrt(ux * ux + uy * uy) || 1;
  }
  S[p + PACT] = A.SKILL; S[p + PAT] = 20; S[p + PAX] = ux / m; S[p + PAY] = uy / m; S[p + PSKC] = 75;
}
function tackle(S, i, jx, jy) {
  const p = pOf(i), b = BB;
  if (S[p + PACT] !== A.NONE && S[p + PACT] !== A.KICK) return;
  const dx = S[b + BX] - S[p + PX], dy = S[b + BY] - S[p + PY], d = Math.sqrt(dx * dx + dy * dy);
  S[p + PHIT] = 0;
  if (d < 2.4) { // standing tackle: a quick lunge at the ball
    S[p + PACT] = A.LUNGE; S[p + PAT] = 14; S[p + PAX] = (dx / (d || 1)) * 6.8; S[p + PAY] = (dy / (d || 1)) * 6.8;
  } else { // sliding tackle along the stick (or straight ahead)
    let ux = jx, uy = jy, m = Math.sqrt(ux * ux + uy * uy);
    if (m < 30) { ux = S[p + PFX]; uy = S[p + PFY]; m = 1; } else { ux /= m; uy /= m; }
    const v = Math.max(8.6, Math.sqrt(S[p + PVX] * S[p + PVX] + S[p + PVY] * S[p + PVY]) + 1.6);
    S[p + PACT] = A.SLIDE; S[p + PAT] = 34; S[p + PAX] = ux * v; S[p + PAY] = uy * v; S[p + PFX] = ux; S[p + PFY] = uy;
  }
}

// ---------- le gardien ----------
function keeperOut(S, i, kind, jx, jy) { // kind 1: throw/roll to a teammate, 2: long kick
  const p = pOf(i), t = teamOf(i), d = dirOf(S, t);
  S[BB + BHELD] = 0;
  if (kind === 1) {
    const j = bestPass(S, i, jx, jy, isHum(S, t) && ctrlOf(S, t) === i);
    if (j >= 0) { passTo(S, i, j, 0, 0, false); return; }
  }
  const m = Math.sqrt(jx * jx + jy * jy);
  let tx = d * HL * 0.18, ty = (S[p + PY] > 0 ? 1 : -1) * HW * 0.42;
  if (m > 30) { tx = S[p + PX] + (jx / m) * 52; ty = S[p + PY] + (jy / m) * 52; if ((tx - S[p + PX]) * d < 15) tx = S[p + PX] + d * 25; }
  else { const j = bestFwd(S, t); if (j >= 0) { const q = pOf(j); tx = S[q + PX] + d * 4; ty = S[q + PY]; } }
  passTo(S, i, -1, tx, ty, true);
}
function bestFwd(S, t) { // the most advanced, least marked forward
  let best = -1, bs = -1e9;
  const d = dirOf(S, t);
  for (let s = 5; s < NT; s++) {
    const i = t * NT + s, q = pOf(i);
    let open = 12;
    for (let k = 0; k < NT; k++) { const e = Math.sqrt(dist2(S, (1 - t) * NT + k, S[q + PX], S[q + PY])); if (e < open) open = e; }
    const sc = S[q + PX] * d * 0.05 + open * 0.2;
    if (sc > bs) { bs = sc; best = i; }
  }
  return best;
}
function keeper(S, i) { // sets DVX/DVY for a keeper; true when it moved him
  const p = pOf(i), t = teamOf(i), d = dirOf(S, t), gx = -d * HL, lvl = S[G.AIL0 + t], b = BB;
  const bx = S[b + BX], by = S[b + BY], bz = S[b + BZ], bvx = S[b + BVX], bvy = S[b + BVY], bvz = S[b + BVZ], own = S[b + BOWN];
  const x = S[p + PX], y = S[p + PY];
  if (own === i) {
    DVX = 0; DVY = 0;
    S[p + PCF]++;
    const hum = isHum(S, t) && ctrlOf(S, t) === i && ON[t];
    if (S[b + BHELD] === 1 && ((!hum && S[p + PCF] > 55 + (S[G.FRAME] % 3) * 12) || S[p + PCF] > 300)) keeperOut(S, i, rnd(S) < 0.55 ? 1 : 2, 0, 0);
    return true;
  }
  // a shot coming: step across or dive
  if (own < 0 && !S[b + BHELD] && S[G.LTT] !== t) {
    const toward = -bvx * d;
    if (toward > 4) {
      const tl = (gx - bx) / bvx;
      if (tl > 0 && tl < 1.9) {
        const yc = by + bvy * tl, zc = bz + bvz * tl - (GRAV * tl * tl) / 2;
        if (Math.abs(yc) < GW + 1.6 && zc < GH + 1.2) {
          if (!S[G.SHOT] || S[G.FRAME] - S[G.SHOTF] >= LVL_REACT[lvl]) {
            const tg = Math.max(0.04, (x - bx) / bvx);
            const yi = by + bvy * tg, need = yi - y;
            if (Math.abs(need) > 0.95 && tg < 1 && S[p + PACT] === A.NONE) {
              const sp = Math.min(9, Math.abs(need) / Math.max(tg, 0.22) + 1.6);
              S[p + PACT] = A.DIVE; S[p + PAT] = 44; S[p + PAX] = d * 0.9; S[p + PAY] = sgn(need) * sp;
              S[p + PDH] = clamp(bz + bvz * tg - (GRAV * tg * tg) / 2, 0, 2.4);
              return true;
            }
            DVX = clamp((gx + d * 0.6 - x) * 3, -RUN, RUN); DVY = clamp(need * 9, -SPRINT, SPRINT);
            return true;
          }
        }
      }
    }
  }
  // a loose ball in the box: go and get it if he is first
  if (own < 0 && !S[b + BHELD] && bz < 1.9 && inBoxOf(S, t, bx, by)) {
    const me = Math.sqrt((bx - x) * (bx - x) + (by - y) * (by - y));
    let them = 99;
    for (let k = 1; k < NT; k++) { const e = Math.sqrt(dist2(S, (1 - t) * NT + k, bx, by)); if (e < them) them = e; }
    const spd = Math.sqrt(bvx * bvx + bvy * bvy);
    if ((me < them * 0.9 || me < 3) && spd < 16) { chase(S, i, SPRINT); return true; }
  }
  // one against one: come out and narrow the angle, dive at the feet when close
  if (own >= 0 && teamOf(own) !== t) {
    const q = pOf(own), ox = S[q + PX], oy = S[q + PY], og = Math.sqrt((ox - gx) * (ox - gx) + oy * oy);
    if (og < 15 && inBoxOf(S, t, ox, oy)) {
      const k = Math.min(og - 1.4, og * 0.62), tx = gx + ((ox - gx) / og) * k, ty = (oy / og) * k;
      const e = Math.sqrt((ox - x) * (ox - x) + (oy - y) * (oy - y));
      if (e < 2.1 && S[p + PACT] === A.NONE && rnd(S) < 0.05 + lvl * 0.02) { tackle(S, i, 0, 0); return true; }
      steerTo(S, i, tx, ty, SPRINT, true);
      return true;
    }
  }
  // stand on the line between the ball and the middle of the goal
  const db = Math.sqrt((bx - gx) * (bx - gx) + by * by) || 1;
  const out = clamp(0.7 + (db - 6) * 0.085, 0.7, 4.4);
  let tx = gx + ((bx - gx) / db) * out, ty = (by / db) * out;
  ty = clamp(ty, -GW * 0.95, GW * 0.95);
  steerTo(S, i, tx, ty, RUN, true);
  return true;
}
function keeperTouch(S, i) { // the ball comes within reach of a keeper in his box: catch, parry or beaten
  const p = pOf(i), t = teamOf(i), b = BB, lvl = S[G.AIL0 + t], d = dirOf(S, t);
  if (S[p + PCOOL] > 0) return false;
  const act = S[p + PACT];
  if (act === A.FALL || act === A.GETUP || act === A.CELEB) return false;
  const bx = S[b + BX], by = S[b + BY], bz = S[b + BZ];
  if (!inBoxOf(S, t, bx, by)) return false;
  const dx = bx - S[p + PX], dy = by - S[p + PY], dh = Math.sqrt(dx * dx + dy * dy), diving = act === A.DIVE;
  const R = diving ? 1.5 : 1.1;
  if (dh > R || bz > (diving ? 2.55 : 2.6)) return false;
  const vx = S[b + BVX], vy = S[b + BVY], vz = S[b + BVZ], sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (S[G.LTT] === t && sp < 20) { gain(S, i); return true; }
  const shot = S[G.SHOT] && S[G.SHOTT] !== t;
  let ps = clamp(1.55 - sp / 30, 0.45, 0.98) * LVL_SAVE[lvl] * (1 - 0.22 * (dh / R)) * (diving ? 0.96 : 1);
  if (bz > 1.95) ps *= 0.86;
  if (rnd(S) < ps) {
    if (shot) S[G.OT0 + (1 - t)]++;
    S[G.SV0 + t]++; S[G.SHOT] = 0;
    if (sp < 15.5 || (sp < 22 && dh < 0.55 && bz < 1.75 && rnd(S) < 0.55)) { gain(S, i); ev(S, EV.CATCH, i); return true; }
    // parried: round the post or over the bar when it was close to them, else back into play
    const side = dy !== 0 ? sgn(dy) : (rnd(S) < 0.5 ? -1 : 1);
    if (Math.abs(by) > GW - 1.3 && rnd(S) < 0.6) { S[b + BVX] = -d * (1 + rnd(S) * 2); S[b + BVY] = sgn(by) * (4 + rnd(S) * 3); S[b + BVZ] = 1 + rnd(S) * 2; }
    else if (bz > 1.75 && rnd(S) < 0.6) { S[b + BVX] = -d * (2 + rnd(S) * 3); S[b + BVY] = vy * 0.3; S[b + BVZ] = 3.5 + rnd(S) * 2; }
    else { S[b + BVX] = d * (2.5 + rnd(S) * 5) - vx * 0.12; S[b + BVY] = side * (3 + rnd(S) * 6) + vy * 0.25; S[b + BVZ] = 1.5 + rnd(S) * 3.5; }
    S[b + BOWN] = -1; S[b + BHELD] = 0;
    S[p + PCOOL] = 28; S[G.LT] = i; S[G.LTT] = t; S[G.PTO] = -1;
    ev(S, EV.SAVE, i);
    return true;
  }
  S[p + PCOOL] = 45; // beaten
  S[b + BVX] *= 0.92; S[b + BVY] *= 0.92;
  return false;
}

// ---------- l'intelligence d'équipe (toutes les 6 images) ----------
function teamAI(S, t) {
  const d = dirOf(S, t), b = BB, own = S[b + BOWN], bx = S[b + BX], by = S[b + BY], f = S[G.FRAME];
  const ownT = own >= 0 ? teamOf(own) : -1;
  const pto = S[G.PTO];
  const inPoss = ownT === t || (own < 0 && pto >= 0 && teamOf(pto) === t);
  const bxn = clamp((bx * d) / HL, -1, 1), byn = clamp(by / HW, -1, 1);
  const hc = isHum(S, t) ? ctrlOf(S, t) : -1;
  const carrierX = own >= 0 ? S[pOf(own) + PX] : bx, carrierY = own >= 0 ? S[pOf(own) + PY] : by;
  for (let s = 1; s < NT; s++) {
    const i = t * NT + s, p = pOf(i), line = FORM[s][2];
    let xn = clamp(FORM[s][0] + FOLLOW[line] * bxn + (inPoss ? PUSH_A : PUSH_D)[line], XMIN[line], XMAX[line]);
    let yn = clamp(FORM[s][1] * d * (inPoss ? 1.05 : 0.74) + byn * (inPoss ? 0.16 : 0.3), -0.94, 0.94);
    if (inPoss) {
      if (line === 3 && bxn > -0.35) { // forwards: runs in behind
        xn = clamp(Math.max(xn, bxn + 0.18), XMIN[line], 0.88);
        yn = clamp(FORM[s][1] * d * 0.8 + (((f / 240) | 0) % 2 ? 0.14 : -0.14) * (s === 9 ? 1 : -1), -0.9, 0.9);
      }
      if (line === 2 && Math.abs(FORM[s][1]) > 0.5 && bxn > -0.1) { xn = Math.min(0.8, xn + 0.1); yn = clamp(FORM[s][1] * d * 1.25, -0.92, 0.92); }
    }
    let tx = xn * HL * d, ty = yn * HW;
    if (inPoss && own >= 0 && own !== i) { // do not crowd the ball carrier
      const ex = tx - carrierX, ey = ty - carrierY, e = Math.sqrt(ex * ex + ey * ey);
      if (e < 8) { const k = 9 / (e || 1); tx = carrierX + ex * k; ty = carrierY + ey * k; }
    }
    S[p + PTX] = clamp(tx, -HL + 1, HL - 1); S[p + PTY] = clamp(ty, -HW + 1, HW - 1); S[p + PROLE] = inPoss && line === 3 ? R_RUN : R_ZONE; S[p + PMARK] = -1;
  }
  S[G.PRES0 + t] = -1; S[G.COV0 + t] = -1;
  if (!inPoss) {
    // presser and cover: the quickest to the ball (a little stickiness to avoid swapping all the time)
    let p1 = -1, p2 = -1, t1 = 1e9, t2 = 1e9;
    const prev = S[G.PRES0 + t];
    for (let s = 1; s < NT; s++) {
      const i = t * NT + s;
      if (i === hc) continue;
      const a = S[pOf(i) + PACT];
      if (a === A.FALL || a === A.GETUP || a === A.SLIDE) continue;
      let tt = Math.sqrt(dist2(S, i, carrierX, carrierY)) / RUN;
      if (i === prev) tt -= 0.3;
      if (tt < t1) { t2 = t1; p2 = p1; t1 = tt; p1 = i; } else if (tt < t2) { t2 = tt; p2 = i; }
    }
    // the human's own player is the closest: the AI presser only comes when asked (PRESSING) or when far
    let hcT = 1e9;
    if (hc >= 0) hcT = Math.sqrt(dist2(S, hc, carrierX, carrierY)) / RUN;
    if (p1 >= 0 && (S[G.PRS0 + t] || hcT > t1 + 0.6 || hc < 0)) { S[pOf(p1) + PROLE] = R_PRESS; S[G.PRES0 + t] = p1; }
    else if (p1 >= 0) { p2 = p1; }
    if (p2 >= 0) {
      const gx = -d * HL, ex = gx - carrierX, ey = -carrierY, e = Math.sqrt(ex * ex + ey * ey) || 1;
      const q = pOf(p2);
      S[q + PTX] = carrierX + (ex / e) * 6; S[q + PTY] = carrierY + (ey / e) * 6; S[q + PROLE] = R_COVER; S[G.COV0 + t] = p2;
      if (S[G.AIL0 + t] === 2 && !isHum(S, t) && carrierX * d < 0 && t2 < 1.4) S[q + PROLE] = R_PRESS; // hard: two at the ball in our half
    }
    // markers: the dangerous opponents near each defender/midfielder's zone
    const o = 1 - t, gx = -d * HL;
    const used = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let s = 1; s < 9; s++) {
      const i = t * NT + s, p = pOf(i);
      if (i === hc || S[p + PROLE] !== R_ZONE) continue;
      let best = -1, bd = 15 * 15;
      for (let k = 1; k < NT; k++) {
        const j = o * NT + k;
        if (j === own || used[k]) continue;
        const q = pOf(j);
        if ((S[q + PX] - gx) * d > HL * 1.25) continue; // far up the pitch: no marking
        const ex = S[q + PX] - S[p + PTX], ey = S[q + PY] - S[p + PTY], e = ex * ex + ey * ey;
        if (e < bd) { bd = e; best = k; }
      }
      if (best < 0) continue;
      used[best] = 1;
      const q = pOf(o * NT + best), ox = S[q + PX], oy = S[q + PY], ex = gx - ox, ey = -oy, e = Math.sqrt(ex * ex + ey * ey) || 1;
      const mx = ox + (ex / e) * 1.7, my = oy + (ey / e) * 1.7;
      S[p + PTX] = mx * 0.72 + S[p + PTX] * 0.28; S[p + PTY] = my * 0.72 + S[p + PTY] * 0.28; S[p + PROLE] = R_MARK; S[p + PMARK] = o * NT + best;
    }
  }
  // a loose ball (not a pass to a teammate): the quickest player goes for it
  if (own < 0 && !S[b + BHELD] && !(pto >= 0 && teamOf(pto) === t)) {
    let best = -1, bt = 1e9;
    for (let s = 1; s < NT; s++) {
      const i = t * NT + s;
      if (i === hc) continue;
      const a = S[pOf(i) + PACT];
      if (a === A.FALL || a === A.GETUP || a === A.SLIDE) continue;
      const tt = arrival(S, i);
      if (tt < bt) { bt = tt; best = i; }
    }
    if (best >= 0) { S[pOf(best) + PROLE] = R_CHASE; }
  }
}
// time for player i to reach the moving ball (coarse prediction)
function predict(S) {
  if (predF === S[G.FRAME]) return;
  predF = S[G.FRAME];
  const b = BB;
  let x = S[b + BX], y = S[b + BY], z = S[b + BZ], vx = S[b + BVX], vy = S[b + BVY], vz = S[b + BVZ];
  const h = DT * 3;
  for (let k = 0; k < 40; k++) {
    PRED[k * 3] = x; PRED[k * 3 + 1] = y; PRED[k * 3 + 2] = z;
    if (z > 0 || vz > 0) { vz -= GRAV * h; z += vz * h; if (z < 0) { z = 0; vz = vz < -2 ? -vz * 0.5 : 0; } }
    else { const sp = Math.sqrt(vx * vx + vy * vy); if (sp > 0) { const ns = Math.max(0, sp - (ROLL_C + ROLL_D * sp * sp) * h); vx *= ns / sp; vy *= ns / sp; } }
    x += vx * h; y += vy * h;
  }
}
let ARX = 0, ARY = 0;
function arrival(S, i) {
  predict(S);
  const p = pOf(i), x = S[p + PX], y = S[p + PY];
  for (let k = 0; k < 40; k++) {
    const ex = PRED[k * 3] - x, ey = PRED[k * 3 + 1] - y, e = Math.sqrt(ex * ex + ey * ey), tk = k * 3 * DT;
    if (e - 0.6 <= SPRINT * tk * 0.92 && PRED[k * 3 + 2] < 2) { ARX = PRED[k * 3]; ARY = PRED[k * 3 + 1]; return tk + e * 0.01; }
  }
  ARX = PRED[39 * 3]; ARY = PRED[39 * 3 + 1];
  return 3 + Math.sqrt((ARX - x) * (ARX - x) + (ARY - y) * (ARY - y)) / SPRINT;
}
function chase(S, i, spd) { arrival(S, i); steerTo(S, i, ARX, ARY, spd, false); }

// how dangerous a place is for team t (0 near its own goal, ≈ 1.2 in front of the other goal)
function value(S, t, x, y) {
  const gx = dirOf(S, t) * HL, dx = gx - x, dg = Math.sqrt(dx * dx + y * y);
  return 1 - dg / 95 + (dg < 30 ? (30 - dg) / 75 : 0) - Math.abs(y) / 400;
}

// ---------- le porteur du ballon quand c'est l'ordinateur ----------
function carrier(S) {
  const own = S[BB + BOWN];
  if (own < 0) return;
  const t = teamOf(own), hum = isHum(S, t) && ctrlOf(S, t) === own && ON[t];
  if (S[BB + BHELD] === 1) { if (hum && ++S[pOf(own) + PCF] > 300) keeperOut(S, own, 2, 0, 0); return; }
  if (S[BB + BHELD] || hum) return;
  if (own % NT === 0) { // keeper with the ball at his feet: clear it
    const p = pOf(own);
    if (++S[p + PCF] > 25) keeperOut(S, own, rnd(S) < 0.5 ? 1 : 2, 0, 0);
    return;
  }
  aiCarrier(S, own);
}
function aiCarrier(S, i) {
  const p = pOf(i), t = teamOf(i), d = dirOf(S, t), lvl = S[G.AIL0 + t], o = 1 - t;
  S[p + PCF]++;
  const x = S[p + PX], y = S[p + PY], gx = d * HL;
  // pressure in front
  let pr = 99, near = -1;
  for (let k = 0; k < NT; k++) {
    const j = o * NT + k, q = pOf(j), ex = S[q + PX] - x, ey = S[q + PY] - y, e = Math.sqrt(ex * ex + ey * ey);
    const front = ex * d > -1;
    if (front && e < pr) { pr = e; near = j; }
  }
  if (S[p + PACT] !== A.NONE || S[p + PCF] < 7) { aiDribble(S, i, pr, near); return; }
  if ((S[p + PCF] + i) % 6 === 0) {
    // a defender right in front: sometimes a quick move past him
    if (pr < 2.2 && S[p + PSKC] <= 0 && rnd(S) < LVL_SKILL[lvl]) { const q = pOf(near), ox = S[q + PX] - x, oy = S[q + PY] - y, side = oy * d > 0 ? -1 : 1; skill(S, i, d * 70, side * 70 + (Math.abs(y) > HW - 8 ? -sgn(y) * 40 : 0)); void ox; return; }
    const dg = Math.sqrt((gx - x) * (gx - x) + y * y);
    if (dg < 28 + lvl * 2 && Math.abs(y) < 24) {
      // the shot: better close in and central, worse with a defender in the way
      const ang = Math.min(1, ((HL - Math.abs(x)) + 4) / (Math.abs(y) + 4));
      let q = Math.pow(1 - dg / 28, 1.4) * ang * (pr < 1.6 ? 0.5 : 1);
      if (dg < 11 || rnd(S) < q * 0.38 * LVL_SHOT[lvl]) { shoot(S, i, 0, 0, 14 + rnd(S) * 20, 0); return; }
    }
    if (x * d > HL - 24 && Math.abs(y) > 15 && rnd(S) < 0.22) { cross(S, i); return; }
    // a pass when it puts a teammate in a better place than me (or when I am under pressure)
    const vc = value(S, t, x, y) - (pr < 1.8 ? 0.22 : pr < 3.2 ? 0.1 : 0);
    const j = bestPass(S, i, 0, 0, false);
    if (j >= 0) {
      const gain = BEST - vc;
      if (gain > 0.24 || (gain > 0.1 && rnd(S) < 0.12) || (pr < 2 && gain > -0.1 && rnd(S) < 0.4)) { passTo(S, i, j, 0, 0, Math.sqrt(dist2(S, j, x, y)) > 34); return; }
    }
    if (x * d < -HL + 24 && pr < 2.2) { passTo(S, i, -1, x + d * 40, clamp(y * 1.3, -HW + 4, HW - 4), true); return; }
  }
  aiDribble(S, i, pr, near);
}
function cross(S, i) {
  const t = teamOf(i), d = dirOf(S, t), p = pOf(i);
  let best = -1, bs = -1e9;
  for (let s = 1; s < NT; s++) {
    const j = t * NT + s, q = pOf(j);
    if (j === i) continue;
    const bx = S[q + PX] * d;
    if (bx < HL - BOXD - 2 || Math.abs(S[q + PY]) > BOXW) continue;
    let open = 6;
    for (let k = 0; k < NT; k++) { const e = Math.sqrt(dist2(S, (1 - t) * NT + k, S[q + PX], S[q + PY])); if (e < open) open = e; }
    const sc = open + rnd(S) * 2;
    if (sc > bs) { bs = sc; best = j; }
  }
  if (best >= 0) { passTo(S, i, best, 0, 0, true); return; }
  passTo(S, i, -1, d * (HL - 9), -sgn(S[p + PY]) * 3, true);
}
function aiDribble(S, i, pr, near) {
  const p = pOf(i), t = teamOf(i), d = dirOf(S, t), x = S[p + PX], y = S[p + PY];
  let ux = d, uy = (x * d > HL - 30 ? -y * 0.04 : -y * 0.012);
  // steer away from the opponents in front
  for (let k = 0; k < NT; k++) {
    const q = pOf((1 - t) * NT + k), ex = x - S[q + PX], ey = y - S[q + PY], e2 = ex * ex + ey * ey;
    if (e2 > 64 || -ex * d < -1.5) continue;
    const w = 2.2 / (e2 + 1.5);
    ux += ex * w * 0.4; uy += ey * w * 1.4;
  }
  if (Math.abs(y) > HW - 5) uy -= sgn(y) * 0.6;
  const m = Math.sqrt(ux * ux + uy * uy) || 1;
  const fast = pr > 6;
  steerDir(S, i, ux / m, uy / m, fast ? SPRINTB : RUNB);
  void near;
}

// ---------- déplacements ----------
function steerTo(S, i, tx, ty, spd, arrive) {
  const p = pOf(i), dx = tx - S[p + PX], dy = ty - S[p + PY], d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.25) { DVX = 0; DVY = 0; return; }
  let s = spd;
  if (arrive && d < 4) s = Math.max(1.2, (spd * d) / 4);
  DVX = (dx / d) * s; DVY = (dy / d) * s;
}
function steerDir(S, i, ux, uy, spd) { DVX = ux * spd; DVY = uy * spd; void S; void i; }
function moveAll(S, live) {
  const b = BB, own = S[b + BOWN], ph = S[G.PHASE];
  for (let i = 0; i < NP; i++) {
    const p = pOf(i), t = teamOf(i);
    if (S[p + PCOOL] > 0) S[p + PCOOL]--;
    if (S[p + PSKC] > 0) S[p + PSKC]--;
    let act = S[p + PACT];
    if (act !== A.NONE) {
      if (--S[p + PAT] <= 0) {
        if (act === A.SLIDE) { S[p + PACT] = A.GETUP; S[p + PAT] = 22; }
        else if (act === A.DIVE) { S[p + PACT] = A.GETUP; S[p + PAT] = 24; }
        else if (act === A.FALL) { S[p + PACT] = A.GETUP; S[p + PAT] = 20; }
        else if (act === A.HOLD && own === i) S[p + PAT] = 1;
        else S[p + PACT] = A.NONE;
        act = S[p + PACT];
      }
    }
    if (act === A.SLIDE || act === A.DIVE || act === A.LUNGE) {
      const k = act === A.SLIDE ? 0.955 : act === A.DIVE ? 0.93 : 0.9;
      S[p + PVX] = S[p + PAX]; S[p + PVY] = S[p + PAY];
      S[p + PAX] *= k; S[p + PAY] *= k;
      S[p + PX] += S[p + PVX] * DT; S[p + PY] += S[p + PVY] * DT;
      clampPos(S, p);
      continue;
    }
    if (act === A.FALL || act === A.GETUP) {
      S[p + PVX] *= 0.86; S[p + PVY] *= 0.86;
      S[p + PX] += S[p + PVX] * DT; S[p + PY] += S[p + PVY] * DT;
      continue;
    }
    DVX = 0; DVY = 0;
    let acc = own === i ? ACCB : ACC;
    const hum = ON[t] && ctrlOf(S, t) === i;
    if (!live) {
      // set pieces, kick-off, out: everyone walks to his place (the human too)
      if (ph === PH.SET && i === S[G.TAKER]) { DVX = 0; DVY = 0; }
      else steerTo(S, i, S[p + PTX], S[p + PTY], ph === PH.KICKOFF ? 0 : RUN * 0.8, true);
    } else if (i % NT === 0 && !(hum && own === i)) {
      keeper(S, i);
    } else if (hum) {
      humanMove(S, i, t);
    } else if (own === i) {
      // DVX/DVY were set by aiCarrier
      if (act === A.SKILL) { DVX = S[p + PAX] * (RUNB + 2.2); DVY = S[p + PAY] * (RUNB + 2.2); acc = 40; }
      else aiCarrierMove(S, i);
    } else {
      aiMove(S, i, t);
    }
    if (act === A.SKILL && own === i && hum) { DVX = S[p + PAX] * (RUNB + 2.2); DVY = S[p + PAY] * (RUNB + 2.2); acc = 40; }
    if (!hum && live) { const k = LVL_SPD[S[G.AIL0 + t]]; DVX *= k; DVY *= k; }
    if (act === A.KICK || act === A.HEAD) acc *= 0.5;
    integrate(S, p, acc, own === i);
  }
}
let CAR_DX = 0, CAR_DY = 0;
function aiCarrierMove(S, i) {
  // the last dribble direction chosen by aiCarrier (steerDir left it in DVX/DVY): recompute it each frame
  const p = pOf(i), t = teamOf(i);
  let pr = 99, near = -1;
  for (let k = 0; k < NT; k++) { const j = (1 - t) * NT + k, e = Math.sqrt(dist2(S, j, S[p + PX], S[p + PY])); if (e < pr) { pr = e; near = j; } }
  aiDribble(S, i, pr, near);
  CAR_DX = DVX; CAR_DY = DVY;
}
function humanMove(S, i, t) {
  const p = pOf(i), b = BB, own = S[b + BOWN];
  const jx = JX[t] / 100, jy = JY[t] / 100, m = Math.sqrt(jx * jx + jy * jy);
  const sprint = (HELD[t] & IN_R) !== 0;
  if (own === i && S[b + BHELD] === 1) { // keeper with the ball in his hands: walks in his box
    if (m > 0.2) { DVX = (jx / m) * 3; DVY = (jy / m) * 3; }
    return;
  }
  if (m > 0.16) {
    const spd = own === i ? (sprint ? SPRINTB : RUNB) : sprint ? SPRINT : RUN;
    const k = Math.max(0.3, Math.min(1, (m - 0.16) / 0.55));
    DVX = (jx / m) * spd * k; DVY = (jy / m) * spd * k;
  } else if (own < 0 && !S[b + BHELD] && (S[G.PTO] === i || S[pOf(i) + PROLE] === R_CHASE)) {
    chase(S, i, sprint ? SPRINT : RUN); // help to meet the pass when the stick is let go
  }
}
function aiMove(S, i, t) {
  const p = pOf(i), b = BB, own = S[b + BOWN], role = S[p + PROLE], d = dirOf(S, t);
  if (own < 0 && !S[b + BHELD] && S[G.PTO] === i) { chase(S, i, SPRINT); return; }
  if (own < 0 && !S[b + BHELD] && role === R_CHASE) { chase(S, i, SPRINT); return; }
  if (own >= 0 && teamOf(own) !== t && role === R_PRESS) {
    const q = pOf(own), ox = S[q + PX], oy = S[q + PY], gx = -d * HL, ex = gx - ox, ey = -oy, e = Math.sqrt(ex * ex + ey * ey) || 1;
    const dd = Math.sqrt(dist2(S, i, ox, oy));
    const tx = ox + (ex / e) * Math.min(1.1, dd * 0.3) + S[q + PVX] * 0.25, ty = oy + (ey / e) * Math.min(1.1, dd * 0.3) + S[q + PVY] * 0.25;
    steerTo(S, i, tx, ty, dd > 7 ? SPRINT : dd > 2.5 ? RUN : RUN * 0.75, false);
    // a tackle when close and not from behind
    if (dd < 1.7 && S[p + PACT] === A.NONE && S[p + PCOOL] <= 0) {
      const lvl = S[G.AIL0 + t], fx = S[q + PFX], fy = S[q + PFY], rx = S[p + PX] - ox, ry = S[p + PY] - oy;
      if (fx * rx + fy * ry > -0.3 * dd && rnd(S) < [0.006, 0.01, 0.016][lvl]) tackle(S, i, 0, 0);
    } else if (dd > 2.6 && dd < 4.2 && S[p + PACT] === A.NONE && ox * d < -HL * 0.3 && rnd(S) < 0.004) {
      // a last-ditch sliding tackle near our goal: risky
      const lead = 0.35, ex2 = ox + S[q + PVX] * lead - S[p + PX], ey2 = oy + S[q + PVY] * lead - S[p + PY], e2 = Math.sqrt(ex2 * ex2 + ey2 * ey2) || 1;
      tackle(S, i, (ex2 / e2) * 100, (ey2 / e2) * 100);
    }
    return;
  }
  const dx = S[p + PTX] - S[p + PX], dy = S[p + PTY] - S[p + PY], dd = Math.sqrt(dx * dx + dy * dy);
  steerTo(S, i, S[p + PTX], S[p + PTY], dd > 16 ? SPRINT : RUN, true);
}
function integrate(S, p, acc, withBall) {
  let ax = DVX - S[p + PVX], ay = DVY - S[p + PVY];
  const a = Math.sqrt(ax * ax + ay * ay), m = acc * DT;
  if (a > m) { ax *= m / a; ay *= m / a; }
  const vx = (S[p + PVX] += ax), vy = (S[p + PVY] += ay);
  S[p + PX] += vx * DT; S[p + PY] += vy * DT;
  clampPos(S, p);
  const sp = Math.sqrt(vx * vx + vy * vy);
  S[p + PRUN] += sp * DT;
  let tx, ty;
  if (sp > 0.55) { tx = vx / sp; ty = vy / sp; }
  else { const b = BB, ex = S[b + BX] - S[p + PX], ey = S[b + BY] - S[p + PY], e = Math.sqrt(ex * ex + ey * ey); if (e < 0.3) return; tx = ex / e; ty = ey / e; }
  const k = withBall ? 0.3 : sp > 0.55 ? 0.2 : 0.08;
  let fx = S[p + PFX] + (tx - S[p + PFX]) * k, fy = S[p + PFY] + (ty - S[p + PFY]) * k;
  const fm = Math.sqrt(fx * fx + fy * fy);
  if (fm > 1e-6) { fx /= fm; fy /= fm; } else { fx = tx; fy = ty; }
  S[p + PFX] = fx; S[p + PFY] = fy;
}
function clampPos(S, p) {
  S[p + PX] = clamp(S[p + PX], -HL - 4, HL + 4); S[p + PY] = clamp(S[p + PY], -HW - 3, HW + 3);
}
function separate(S) {
  for (let i = 0; i < NP; i++) {
    const p = pOf(i);
    for (let j = i + 1; j < NP; j++) {
      const q = pOf(j), dx = S[q + PX] - S[p + PX];
      if (dx > 0.75 || dx < -0.75) continue;
      const dy = S[q + PY] - S[p + PY];
      if (dy > 0.75 || dy < -0.75) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 >= 0.5625) continue;
      const d = Math.sqrt(d2);
      const ux = d > 1e-6 ? dx / d : 1, uy = d > 1e-6 ? dy / d : 0, push = (0.75 - d) * 0.5;
      S[p + PX] -= ux * push; S[p + PY] -= uy * push; S[q + PX] += ux * push; S[q + PY] += uy * push;
    }
  }
}

// ---------- le ballon ----------
function dribble(S) {
  const b = BB, own = S[b + BOWN];
  if (own < 0) return;
  const p = pOf(own);
  S[b + BLX] = S[b + BX]; S[b + BLY] = S[b + BY]; S[b + BLZ] = S[b + BZ];
  if (S[b + BHELD] === 1) { // in the keeper's hands
    S[b + BX] = S[p + PX] + S[p + PFX] * 0.32; S[b + BY] = S[p + PY] + S[p + PFY] * 0.32; S[b + BZ] = 1.05;
    S[b + BVX] = S[p + PVX]; S[b + BVY] = S[p + PVY]; S[b + BVZ] = 0;
    return;
  }
  if (S[b + BHELD] === 2) return; // placed for a set piece
  const vx = S[p + PVX], vy = S[p + PVY], sp = Math.sqrt(vx * vx + vy * vy);
  const ph = S[p + PRUN] / 1.7, tri = ph - Math.floor(ph);
  const off = 0.4 + 0.22 * Math.min(1, sp / 6) + 0.16 * (tri < 0.5 ? tri * 2 : 2 - tri * 2) * Math.min(1, sp / 3);
  const tx = S[p + PX] + S[p + PFX] * off, ty = S[p + PY] + S[p + PFY] * off;
  S[b + BX] += (tx - S[b + BX]) * 0.55; S[b + BY] += (ty - S[b + BY]) * 0.55; S[b + BZ] = 0;
  S[b + BVX] = vx; S[b + BVY] = vy; S[b + BVZ] = 0; S[b + BSPIN] = 0;
}
function freeBall(S, dead) {
  const b = BB;
  S[b + BLX] = S[b + BX]; S[b + BLY] = S[b + BY]; S[b + BLZ] = S[b + BZ];
  if (S[b + BOWN] >= 0) { if (dead) { dribble(S); } return; }
  if (S[b + BHELD] === 2) return;
  let x = S[b + BX], y = S[b + BY], z = S[b + BZ], vx = S[b + BVX], vy = S[b + BVY], vz = S[b + BVZ];
  if (z > 0 || vz > 0) {
    vz -= GRAV * DT;
    const sp = Math.sqrt(vx * vx + vy * vy + vz * vz), k = AIR_D * sp * DT;
    vx -= vx * k; vy -= vy * k; vz -= vz * k;
    const spin = S[b + BSPIN], hs = Math.sqrt(vx * vx + vy * vy);
    if (spin && hs > 1) { vx += (-vy / hs) * spin * DT; vy += (vx / hs) * spin * DT; S[b + BSPIN] = spin * 0.985; }
    x += vx * DT; y += vy * DT; z += vz * DT;
    if (z <= 0) {
      z = 0;
      if (vz < -1.6) { vz = -vz * 0.52; vx *= 0.84; vy *= 0.84; if (vz > 2) ev(S, EV.BOUNCE, 0); } else vz = 0;
    }
  } else {
    const sp = Math.sqrt(vx * vx + vy * vy);
    if (sp > 0) { const ns = Math.max(0, sp - (ROLL_C + ROLL_D * sp * sp + (dead ? 3 : 0)) * DT); vx *= ns / sp; vy *= ns / sp; }
    x += vx * DT; y += vy * DT;
  }
  S[b + BX] = x; S[b + BY] = y; S[b + BZ] = z; S[b + BVX] = vx; S[b + BVY] = vy; S[b + BVZ] = vz;
  goalFrameHits(S);
  if (dead) { // out of play: stop at the boards
    if (Math.abs(S[b + BY]) > HW + 4) { S[b + BY] = sgn(S[b + BY]) * (HW + 4); S[b + BVY] *= -0.2; S[b + BVX] *= 0.5; }
    if (Math.abs(S[b + BX]) > HL + 4) { S[b + BX] = sgn(S[b + BX]) * (HL + 4); S[b + BVX] *= -0.2; S[b + BVY] *= 0.5; }
  }
}
// posts, crossbar and net
function goalFrameHits(S) {
  const b = BB;
  for (let s = -1; s <= 1; s += 2) {
    const gx = s * HL;
    let x = S[b + BX], y = S[b + BY], z = S[b + BZ];
    if (Math.abs(x - gx) > 2.6 + GD) continue;
    // posts
    for (let k = -1; k <= 1; k += 2) {
      const dx = x - gx, dy = y - k * GW, d2 = dx * dx + dy * dy, r = BR + POSTR;
      if (d2 < r * r && z < GH + 0.05) {
        const d = Math.sqrt(d2) || 1e-3, nx = dx / d, ny = dy / d;
        S[b + BX] = gx + nx * r; S[b + BY] = k * GW + ny * r;
        const vn = S[b + BVX] * nx + S[b + BVY] * ny;
        if (vn < 0) { S[b + BVX] -= 1.65 * vn * nx; S[b + BVY] -= 1.65 * vn * ny; if (-vn > 3) ev(S, EV.POST, S[G.LT]); }
        x = S[b + BX]; y = S[b + BY];
      }
    }
    // crossbar
    if (Math.abs(y) < GW) {
      const dx = x - gx, dz = z - GH, d2 = dx * dx + dz * dz, r = BR + POSTR;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 1e-3, nx = dx / d, nz = dz / d;
        S[b + BX] = gx + nx * r; S[b + BZ] = GH + nz * r;
        const vn = S[b + BVX] * nx + S[b + BVZ] * nz;
        if (vn < 0) { S[b + BVX] -= 1.65 * vn * nx; S[b + BVZ] -= 1.65 * vn * nz; if (-vn > 3) ev(S, EV.BAR, S[G.LT]); }
        x = S[b + BX]; z = S[b + BZ];
      }
    }
    // inside the goal: the net holds the ball
    if ((x - gx) * s > 0 && Math.abs(y) < GW + 0.2 && z < GH + 0.1 && (S[b + BNET] || (S[b + BLX] - gx) * s <= BR)) {
      if ((x - gx) * s > GD - BR) { S[b + BX] = gx + s * (GD - BR); S[b + BVX] *= -0.12; S[b + BVY] *= 0.4; S[b + BVZ] *= 0.4; }
      if (Math.abs(y) > GW - BR) { S[b + BY] = sgn(y) * (GW - BR); S[b + BVY] *= -0.15; S[b + BVX] *= 0.5; }
      if (z > GH - BR) { S[b + BZ] = GH - BR; S[b + BVZ] *= -0.1; S[b + BVX] *= 0.6; }
    }
  }
}

// ---------- contacts : contrôle, tacles, arrêts, déviations, têtes ----------
function gain(S, i) {
  const b = BB, t = teamOf(i), p = pOf(i);
  const pto = S[G.PTO];
  if (pto === i && S[G.LTT] === t) S[G.PC0 + t]++;
  S[b + BOWN] = i; S[b + BHELD] = 0; S[b + BZ] = 0; S[b + BVZ] = 0; S[b + BVX] = S[p + PVX]; S[b + BVY] = S[p + PVY]; S[b + BSPIN] = 0;
  S[G.LT] = i; S[G.LTT] = t; S[G.POSS] = t; S[G.PTO] = -1; S[G.SHOT] = 0;
  S[p + PCF] = 0; S[p + PCOOL] = 0;
  if (i % NT === 0 && inBoxOf(S, t, S[p + PX], S[p + PY])) { S[b + BHELD] = 1; S[p + PACT] = A.HOLD; S[p + PAT] = 2; S[b + BZ] = 1.05; }
  if (isHum(S, t)) {
    S[G.CT0 + t] = i;
    const qa = S[G.QA0 + t];
    if (qa && S[G.QF0 + t] > 0 && ON[t] && !S[b + BHELD]) {
      S[G.QA0 + t] = 0;
      if (qa === 2) shoot(S, i, JX[t], JY[t], S[G.QP0 + t], 0);
      else pass(S, i, JX[t], JY[t], qa === 3, S[G.QP0 + t]);
    }
  }
}
function tackles(S) {
  const b = BB;
  for (let i = 0; i < NP; i++) {
    const p = pOf(i), act = S[p + PACT];
    if (act !== A.LUNGE && act !== A.SLIDE) continue;
    if (S[p + PHIT]) continue;
    const t = teamOf(i), own = S[b + BOWN];
    if (own >= 0 && teamOf(own) === t) continue;
    if (own >= 0 && S[b + BHELD]) continue;
    const reach = act === A.SLIDE ? 0.55 : 0.2;
    const fx = act === A.SLIDE ? S[p + PFX] : 0, fy = act === A.SLIDE ? S[p + PFY] : 0;
    const footX = S[p + PX] + fx * reach, footY = S[p + PY] + fy * reach;
    const dx = S[b + BX] - footX, dy = S[b + BY] - footY, d = Math.sqrt(dx * dx + dy * dy);
    if (act === A.SLIDE && S[p + PAT] < 10) continue;
    if (d < (act === A.SLIDE ? 0.82 : 0.78) && S[b + BZ] < 0.7) {
      S[p + PHIT] = 1;
      if (own < 0) { if (act === A.SLIDE) { knock(S, i, S[p + PFX], S[p + PFY], 5 + rnd(S) * 3); } continue; }
      const q = pOf(own), behind = (S[p + PX] - S[q + PX]) * S[q + PFX] + (S[p + PY] - S[q + PY]) * S[q + PFY] < -0.35 * d - 0.2;
      const hum = isHum(S, t) && ctrlOf(S, t) === i;
      let ps = act === A.SLIDE ? 0.78 : hum ? 0.72 : LVL_TACK[S[G.AIL0 + t]];
      if (S[q + PACT] === A.SKILL) ps *= 0.3;
      if (behind) ps *= 0.5;
      if (rnd(S) < ps) {
        S[G.TK0 + t]++;
        S[q + PCOOL] = 26;
        if (act === A.SLIDE) { knock(S, i, S[p + PFX], S[p + PFY], 4.5 + rnd(S) * 3); if (rnd(S) < 0.35) { S[q + PACT] = A.FALL; S[q + PAT] = 30; } }
        else if (rnd(S) < 0.55) gain(S, i);
        else knock(S, i, dx / (d || 1), dy / (d || 1), 3.5 + rnd(S) * 2);
        ev(S, EV.TACKLE, i);
      } else if (behind || (act === A.SLIDE && rnd(S) < 0.4) || rnd(S) < 0.08) { // from behind, or just clumsy
        foul(S, own, i);
        return;
      } else if (act === A.LUNGE) { S[p + PACT] = A.GETUP; S[p + PAT] = 16; }
      continue;
    }
    // a slide that hits the ball carrier before the ball: foul
    if (act === A.SLIDE && own >= 0) {
      const q = pOf(own), ex = S[q + PX] - footX, ey = S[q + PY] - footY;
      if (ex * ex + ey * ey < 0.45) { S[p + PHIT] = 1; foul(S, own, i); return; }
    }
  }
}
function knock(S, i, ux, uy, v) { // the ball goes loose after a tackle
  const b = BB, own = S[b + BOWN];
  if (own >= 0) S[pOf(own) + PCOOL] = Math.max(S[pOf(own) + PCOOL], 24);
  S[b + BOWN] = -1; S[b + BHELD] = 0;
  const side = (rnd(S) - 0.5) * 0.6;
  S[b + BVX] = (ux - uy * side) * v; S[b + BVY] = (uy + ux * side) * v; S[b + BVZ] = rnd(S) < 0.15 ? 1.2 + rnd(S) * 1.6 : 0;
  S[G.LT] = i; S[G.LTT] = teamOf(i); S[G.PTO] = -1;
  S[pOf(i) + PCOOL] = 6;
}
function foul(S, victim, culprit) {
  const vt = teamOf(victim), q = pOf(victim);
  ev(S, EV.FOUL, culprit);
  S[G.FO0 + teamOf(culprit)]++;
  S[q + PACT] = A.FALL; S[q + PAT] = 46; S[q + PVX] *= 0.5; S[q + PVY] *= 0.5;
  const x = S[q + PX], y = S[q + PY];
  const pen = inBoxOf(S, 1 - vt, x, y);
  S[G.SPT] = vt; S[G.SPK] = pen ? SP.PEN : SP.FREE; S[G.SPX] = clamp(x, -HL + 1, HL - 1); S[G.SPY] = clamp(y, -HW + 1, HW - 1);
  S[G.PHASE] = PH.FOUL; S[G.PT] = 0;
  S[BB + BOWN] = -1; S[BB + BHELD] = 0; S[G.SHOT] = 0; S[G.PTO] = -1;
  if (pen) ev(S, EV.PEN, victim);
}
function contacts(S) {
  const b = BB, own = S[b + BOWN];
  if (own >= 0) {
    // body in the way: an opponent standing on the ball can take it off the dribbler
    if (S[b + BHELD]) return;
    const q = pOf(own);
    if (S[q + PACT] === A.SKILL) return;
    const o = 1 - teamOf(own);
    for (let k = 0; k < NT; k++) {
      const i = o * NT + k, p = pOf(i);
      if (S[p + PCOOL] > 0 || S[p + PACT] !== A.NONE) continue;
      const dx = S[b + BX] - S[p + PX], dy = S[b + BY] - S[p + PY];
      if (dx * dx + dy * dy > 0.3) continue;
      const hum = isHum(S, o) && ctrlOf(S, o) === i;
      if (rnd(S) < (hum ? 0.09 : LVL_BLOCK[S[G.AIL0 + o]])) {
        S[G.TK0 + o]++;
        if (rnd(S) < 0.5) gain(S, i); else knock(S, i, -S[q + PFX], -S[q + PFY], 2.5 + rnd(S) * 2);
        ev(S, EV.TACKLE, i);
        return;
      }
    }
    return;
  }
  if (S[b + BHELD] || S[b + BNET]) return;
  // keepers first
  for (let t = 0; t < 2; t++) if (keeperTouch(S, t * NT)) return;
  const bx = S[b + BX], by = S[b + BY], bz = S[b + BZ], vx = S[b + BVX], vy = S[b + BVY];
  const sp = Math.sqrt(vx * vx + vy * vy);
  let best = -1, bd = 9, kind = 0;
  for (let i = 0; i < NP; i++) {
    const p = pOf(i);
    if (S[p + PCOOL] > 0) continue;
    const act = S[p + PACT];
    if (act === A.SLIDE || act === A.FALL || act === A.GETUP || act === A.DIVE || act === A.CELEB) continue;
    const dx = bx - S[p + PX], dy = by - S[p + PY];
    if (dx > 1.2 || dx < -1.2 || dy > 1.2 || dy < -1.2) continue;
    const dh = Math.sqrt(dx * dx + dy * dy);
    const rx = vx - S[p + PVX], ry = vy - S[p + PVY], rel = Math.sqrt(rx * rx + ry * ry);
    const lim = S[G.PTO] === i ? 27 : 18;
    let k = 0;
    if (dh < CTRL_R && (bz < 0.75 || (bz < 1.65 && sp < 14)) && rel < lim) k = 1;
    else if (dh < 0.95 && bz >= 1.45 && bz < 2.75) k = 2;
    else if (dh < 0.5 && bz < 1.9 && rel >= lim && S[G.LT] !== i) k = 3;
    if (k && dh < bd) { bd = dh; best = i; kind = k; }
  }
  if (best < 0) return;
  if (kind === 1) gain(S, best);
  else if (kind === 2) header(S, best);
  else { // deflection off a body
    const p = pOf(best), side = rnd(S) < 0.5 ? -1 : 1;
    S[b + BVX] = -vx * 0.22 - (vy / (sp || 1)) * side * (2 + rnd(S) * 3); S[b + BVY] = -vy * 0.22 + (vx / (sp || 1)) * side * (2 + rnd(S) * 3); S[b + BVZ] = 1 + rnd(S) * 3;
    S[G.LT] = best; S[G.LTT] = teamOf(best); S[G.SHOT] = 0; S[G.PTO] = -1; S[p + PCOOL] = 10;
    ev(S, EV.BLOCK, best);
  }
}
function header(S, i) {
  const t = teamOf(i), d = dirOf(S, t), p = pOf(i), b = BB, x = S[p + PX], y = S[p + PY];
  const hum = isHum(S, t) && ctrlOf(S, t) === i && ON[t];
  const qa = hum ? S[G.QA0 + t] : 0;
  S[p + PACT] = A.HEAD; S[p + PAT] = 20;
  if ((d * x > HL - 19 && Math.abs(y) < 15 && qa !== 1) || qa === 2) {
    S[b + BOWN] = i;
    shoot(S, i, hum ? JX[t] : 0, hum ? JY[t] : 0, 30, 2);
    S[G.QA0 + t] = 0;
    return;
  }
  let ux, uy, v = 11, vz = 2.4;
  if (d * x < -HL * 0.35 && !qa) { ux = d; uy = sgn(y) * 0.7; v = 13; vz = 4.5; } // clearance
  else {
    const j = bestPass(S, i, hum ? JX[t] : 0, hum ? JY[t] : 0, hum);
    if (j >= 0) { const q = pOf(j), ex = S[q + PX] - x, ey = S[q + PY] - y, e = Math.sqrt(ex * ex + ey * ey) || 1; ux = ex / e; uy = ey / e; v = clamp(e * 0.55 + 4, 7, 14); S[G.PTO] = j; }
    else { ux = d; uy = 0; }
  }
  const m = Math.sqrt(ux * ux + uy * uy) || 1;
  const pto = S[G.PTO];
  S[b + BOWN] = i;
  kick(S, i, (ux / m) * v, (uy / m) * v, vz, 0);
  S[G.PTO] = pto;
  S[p + PACT] = A.HEAD; S[p + PAT] = 20;
  S[G.QA0 + t] = 0;
  if (hum && pto >= 0) { S[G.CT0 + t] = pto; S[G.SW0 + t] = 30; }
  ev(S, EV.HEADER, i);
}

// ---------- règles : but, sorties ----------
function rules(S) {
  const b = BB, x = S[b + BX], y = S[b + BY], z = S[b + BZ], lx = S[b + BLX], ly = S[b + BLY], lz = S[b + BLZ];
  for (let s = -1; s <= 1; s += 2) {
    const line = s * (HL + BR);
    if (x * s > HL + BR && lx * s <= HL + BR) {
      const k = (line - lx) / ((x - lx) || 1e-9), yc = ly + (y - ly) * k, zc = lz + (z - lz) * k;
      if (Math.abs(yc) < GW - BR && zc < GH - BR) { goal(S, s); return; }
      outGoalLine(S, s, yc);
      return;
    }
  }
  if (Math.abs(y) > HW + BR) {
    const t = 1 - S[G.LTT];
    S[G.SPK] = SP.THROW; S[G.SPT] = t < 0 || t > 1 ? 0 : t; S[G.SPX] = clamp(x, -HL + 1, HL - 1); S[G.SPY] = sgn(y) * HW;
    outOfPlay(S);
  }
}
function outOfPlay(S) {
  if (S[G.SHOT]) ev(S, EV.MISS, S[G.LT]);
  ev(S, EV.OUT, S[G.SPK]);
  S[G.PHASE] = PH.OUT; S[G.PT] = 0; S[G.SHOT] = 0; S[G.PTO] = -1;
  if (S[BB + BOWN] >= 0) { const p = pOf(S[BB + BOWN]); S[BB + BVX] = S[p + PVX]; S[BB + BVY] = S[p + PVY]; }
  S[BB + BOWN] = -1; S[BB + BHELD] = 0;
  for (let i = 0; i < NP; i++) { const p = pOf(i); S[p + PTX] = S[p + PX] + S[p + PVX] * 0.4; S[p + PTY] = S[p + PY] + S[p + PVY] * 0.4; }
}
function outGoalLine(S, s, yc) {
  // s: which goal line; the team defending it
  const def = dirOf(S, 0) === -s ? 0 : 1;
  if (S[G.LTT] === def) { S[G.SPK] = SP.CORNER; S[G.SPT] = 1 - def; S[G.SPX] = s * HL; S[G.SPY] = sgn(yc) * HW; S[G.CO0 + (1 - def)]++; }
  else { S[G.SPK] = SP.GOALKICK; S[G.SPT] = def; S[G.SPX] = s * HL; S[G.SPY] = sgn(yc) * HW; }
  outOfPlay(S);
}
function goal(S, s) {
  const t = dirOf(S, 0) === s ? 0 : 1, lt = S[G.LT];
  S[G.SC0 + t]++;
  const og = lt >= 0 && teamOf(lt) !== t;
  if (S[G.SHOT] && S[G.SHOTT] === t) S[G.OT0 + t]++;
  S[G.GOALP] = lt; S[G.GOALO] = og ? 1 : 0; S[G.GOALT] = t; S[G.GOALF] = S[G.FRAME];
  const pf = S[G.PFROM];
  S[G.GOALA] = !og && pf >= 0 && teamOf(pf) === t && pf !== lt && S[G.FRAME] - S[G.PASSF] < 420 ? pf : -1;
  ev(S, EV.GOAL, lt);
  S[G.PHASE] = PH.GOAL; S[G.PT] = 0; S[G.SKIP] = 0; S[G.SHOT] = 0; S[G.PTO] = -1;
  S[BB + BNET] = 1; S[BB + BOWN] = -1; S[BB + BHELD] = 0;
  // celebration: the scorer runs to the corner flag, his teammates follow, the others walk back
  const sc = lt >= 0 && !og ? lt : t * NT + 9, q = pOf(sc), cy = sgn(S[q + PY] || 1) * (HW - 3);
  for (let i = 0; i < NP; i++) {
    const p = pOf(i);
    if (teamOf(i) === t) {
      if (i === sc) { S[p + PTX] = s * (HL - 4); S[p + PTY] = cy; S[p + PACT] = A.CELEB; S[p + PAT] = CELEB_F + 20; }
      else if (i % NT !== 0) { S[p + PTX] = s * (HL - 7) + (i % 3) - 1; S[p + PTY] = cy * 0.82 + ((i % 5) - 2) * 1.2; S[p + PACT] = A.NONE; }
    } else { S[p + PTX] = S[p + PX] - s * 6; S[p + PTY] = S[p + PY] * 0.9; S[p + PACT] = i % NT === 0 ? A.NONE : A.SAD; S[p + PAT] = CELEB_F; }
  }
}
function goalFrame(S) {
  const pt = S[G.PT];
  if (pt < CELEB_F) {
    // walk / run for the celebration
    for (let i = 0; i < NP; i++) {
      const p = pOf(i);
      let act = S[p + PACT];
      if (act !== A.CELEB && act !== A.SAD && act !== A.NONE && --S[p + PAT] <= 0) { S[p + PACT] = A.NONE; act = A.NONE; }
      DVX = 0; DVY = 0;
      if (act === A.CELEB) { steerTo(S, i, S[p + PTX], S[p + PTY], RUN, true); S[p + PAT] = Math.max(S[p + PAT], 2); }
      else if (act === A.SAD) steerTo(S, i, S[p + PTX], S[p + PTY], 1.6, true);
      else if (teamOf(i) === S[G.GOALT] && i % NT !== 0) { const sc = S[G.GOALP] >= 0 && !S[G.GOALO] ? S[G.GOALP] : S[G.GOALT] * NT + 9, q = pOf(sc); steerTo(S, i, S[q + PX] - dirOf(S, S[G.GOALT]) * 1.5, S[q + PY], RUN, true); }
      else steerTo(S, i, S[p + PTX], S[p + PTY], 2, true);
      integrate(S, p, ACC, false);
    }
    separate(S);
    freeBall(S, false);
    return;
  }
  if (pt === CELEB_F) { kickoffPlaces(S, 1 - S[G.GOALT]); resetBall(S, 0, 0); S[G.SKIP] = 0; }
  skipFlags(S, CELEB_F + 30);
  if (pt >= CELEB_F + REPLAY_F || (pt > CELEB_F + 30 && S[G.SKIP] === 3)) kickoff(S, 1 - S[G.GOALT], false);
}

// ---------- coups de pied arrêtés ----------
function setPiece(S) {
  const k = S[G.SPK], t = S[G.SPT], d = dirOf(S, t), o = 1 - t, b = BB;
  let sx = S[G.SPX], sy = S[G.SPY];
  if (k === SP.CORNER) { sx = sgn(sx) * (HL - 0.35); sy = sgn(sy) * (HW - 0.35); }
  else if (k === SP.GOALKICK) { sx = -d * (HL - SIXD); sy = sgn(sy) * 4.5; }
  else if (k === SP.THROW) { sx = clamp(sx, -HL + 1, HL - 1); sy = sgn(sy) * (HW + 0.25); }
  else if (k === SP.PEN) { sx = d * (HL - SPOT); sy = 0; }
  else if (k === SP.FREE) {
    sx = clamp(sx, -HL + 1.5, HL - 1.5); sy = clamp(sy, -HW + 1, HW - 1);
    if (inBoxOf(S, t, sx, sy)) { sx = -d * (HL - SIXD); sy = sgn(sy) * 4.5; } // a foul in his own box: from the six-yard line
  }
  S[G.SPX] = sx; S[G.SPY] = sy;
  let tk;
  if (k === SP.GOALKICK) tk = t * NT;
  else if (k === SP.PEN) tk = t * NT + 9;
  else tk = nearestTo(S, t, sx, sy, -1, false);
  S[G.TAKER] = tk;
  // aim: towards the goal, or into the pitch for a throw / corner
  let ax = d, ay = 0;
  if (k === SP.THROW) { ax = d * 0.6; ay = -sgn(sy); }
  else if (k === SP.CORNER) { ax = d * HL - sx - d * 11; ay = -sy; }
  const am = Math.sqrt(ax * ax + ay * ay) || 1; ax /= am; ay /= am;
  resetBall(S, sx, sy);
  S[b + BZ] = k === SP.THROW ? 2.1 : 0; S[b + BOWN] = tk; S[b + BHELD] = 2;
  for (let i = 0; i < NP; i++) { const p = pOf(i); S[p + PACT] = S[p + PACT] === A.FALL ? A.GETUP : A.NONE; S[p + PAT] = 18; S[p + PCOOL] = 0; S[p + PHIT] = 0; if (S[p + PACT] === A.NONE) S[p + PAT] = 0; }
  place(S, tk, sx - ax * (k === SP.THROW ? 0.15 : 0.55), k === SP.THROW ? sgn(sy) * (HW + 0.45) : sy - ay * 0.55, ax, ay);
  setTargets(S, k, t, sx, sy);
  S[G.PHASE] = PH.SET; S[G.PT] = 0; S[G.SPGO] = 60 + Math.floor(rnd(S) * 50);
  S[G.SHOT] = 0; S[G.PTO] = -1; S[G.QA0] = 0; S[G.QA1] = 0;
  if (k !== SP.PEN) ev(S, k === SP.CORNER ? EV.CORNER : k === SP.THROW ? EV.THROW : k === SP.GOALKICK ? EV.GKICK : EV.FREE, tk);
  if (isHum(S, t)) S[G.CT0 + t] = tk;
  if (isHum(S, o)) S[G.CT0 + o] = nearestTo(S, o, sx, sy, -1, false);
}
function setTargets(S, k, t, sx, sy) {
  const d = dirOf(S, t), o = 1 - t, tk = S[G.TAKER];
  // start from the usual places (the team with the ball pushing up)
  const save = S[BB + BOWN];
  S[BB + BOWN] = tk;
  teamAI(S, 0); teamAI(S, 1);
  S[BB + BOWN] = save;
  for (let i = 0; i < NP; i++) { const p = pOf(i); S[p + PROLE] = R_ZONE; }
  const gx = d * HL; // the goal attacked by t
  if (k === SP.CORNER || (k === SP.FREE && (gx - sx) * d < 34 && Math.abs(sy) < 26)) {
    // attackers in the box
    const spots = [[HL - 5, 3.2], [HL - 7, -3.8], [HL - 11.5, 0.5], [HL - 9, 7], [HL - 15, -6]];
    let n = 0;
    for (const s of [2, 3, 9, 10, 6]) {
      const i = t * NT + s;
      if (i === tk) continue;
      const sp = spots[n++ % spots.length], p = pOf(i);
      S[p + PTX] = d * sp[0]; S[p + PTY] = sp[1] * sgn(sy || 1);
    }
    // defenders: mark them goal-side, two near the posts
    const used = {};
    for (let s = 1; s < NT; s++) {
      const i = o * NT + s, p = pOf(i);
      let best = -1, bd = 1e9;
      for (let a = 1; a < NT; a++) {
        const j = t * NT + a; if (used[j] || j === tk) continue;
        const q = pOf(j); if ((S[q + PTX] - gx) * d < -BOXD - 6) continue;
        const e = (S[q + PTX] - S[p + PX]) * (S[q + PTX] - S[p + PX]) + (S[q + PTY] - S[p + PY]) * (S[q + PTY] - S[p + PTY]);
        if (e < bd) { bd = e; best = j; }
      }
      if (best >= 0 && s !== 9) { used[best] = 1; const q = pOf(best); S[p + PTX] = S[q + PTX] + d * 1.2; S[p + PTY] = S[q + PTY] * 0.92; }
    }
  }
  if (k === SP.FREE && (gx - sx) * d < 34 && Math.abs(sy) < 26) {
    // the wall: 3 or 4 players 9,15 m away on the line to the goal
    const ex = gx - sx, ey = -sy, e = Math.sqrt(ex * ex + ey * ey) || 1, ux = ex / e, uy = ey / e;
    const n = e < 24 ? 4 : 3;
    S[G.WALL] = n;
    for (let w = 0; w < n; w++) {
      const i = o * NT + [6, 7, 5, 8][w], p = pOf(i), off = (w - (n - 1) / 2) * 0.62;
      place(S, i, sx + ux * CIRC - uy * off, sy + uy * CIRC + ux * off, -ux, -uy);
    }
  } else S[G.WALL] = 0;
  if (k === SP.PEN) { // everyone outside the box, behind the ball
    let n = 0;
    for (let i = 0; i < NP; i++) {
      if (i === tk || i === o * NT) continue;
      if (i === t * NT) continue;
      const p = pOf(i), col = n % 9, row = (n / 9) | 0;
      place(S, i, d * (HL - BOXD - 1.6 - row * 2.2), (col - 4) * 3.4, d, 0);
      n++;
    }
    place(S, o * NT, d * HL - d * 0.2, 0, -d, 0);
    S[G.PENDIR] = 0;
  }
  if (k === SP.THROW || k === SP.GOALKICK) { // two teammates come to receive
    const a = nearestTo(S, t, sx, sy, tk, false);
    let b2 = -1, bd = 1e9;
    for (let s = 1; s < NT; s++) { const i = t * NT + s; if (i === tk || i === a) continue; const e = dist2(S, i, sx, sy); if (e < bd) { bd = e; b2 = i; } }
    [a, b2].forEach((i, n) => {
      if (i < 0) return;
      const p = pOf(i);
      S[p + PTX] = clamp(sx + d * (6 + n * 7), -HL + 2, HL - 2); S[p + PTY] = clamp(sy * (k === SP.THROW ? 0.72 : 1.6) + (n ? 7 : -4) * sgn(sy || 1), -HW + 3, HW - 3);
    });
  }
  for (let tt = 0; tt < 2; tt++) { // keepers back in their goals (unless taking it)
    const i = tt * NT;
    if (i === tk || (k === SP.PEN && tt === o)) continue;
    const p = pOf(i), dd = dirOf(S, tt);
    S[p + PTX] = -dd * (HL - 1.2); S[p + PTY] = clamp(sy * 0.08, -2, 2);
  }
  if (k === SP.GOALKICK) { // opponents out of the box
    for (let s = 1; s < NT; s++) { const p = pOf(o * NT + s); if (inBoxOf(S, t, S[p + PTX], S[p + PTY])) S[p + PTX] = -d * (HL - BOXD - 2); }
  }
}
function setFrame(S) {
  const pt = S[G.PT], t = S[G.SPT], tk = S[G.TAKER], k = S[G.SPK], tp = pOf(tk), b = BB, o = 1 - t;
  const sx = S[G.SPX], sy = S[G.SPY];
  moveAll(S, false);
  // opponents 9,15 m from the ball
  if (k !== SP.THROW) {
    for (let s = 0; s < NT; s++) {
      const i = o * NT + s, p = pOf(i);
      if (k === SP.PEN) { if (s && inBoxOf(S, o, S[p + PX], S[p + PY])) S[p + PX] = -dirOf(S, o) * (HL - BOXD - 1.2); continue; }
      if (k === SP.FREE && S[G.WALL] && (s === 5 || s === 6 || s === 7 || s === 8)) continue;
      const ex = S[p + PX] - sx, ey = S[p + PY] - sy, e = Math.sqrt(ex * ex + ey * ey);
      if (e < CIRC && e > 0.01) { S[p + PX] = sx + (ex / e) * CIRC; S[p + PY] = sy + (ey / e) * CIRC; }
    }
  }
  separate(S);
  // the taker stays on the ball and aims with the stick
  const d = dirOf(S, t);
  const hum = isHum(S, t) && ctrlOf(S, t) === tk && ON[t];
  if (hum && Math.sqrt(JX[t] * JX[t] + JY[t] * JY[t]) > 30) {
    const m = Math.sqrt(JX[t] * JX[t] + JY[t] * JY[t]);
    S[tp + PFX] = JX[t] / m; S[tp + PFY] = JY[t] / m;
  }
  if (k === SP.THROW) { S[b + BX] = S[tp + PX] + S[tp + PFX] * 0.1; S[b + BY] = S[tp + PY] + S[tp + PFY] * 0.1; S[b + BZ] = 2.1; }
  if (pt < 34) return;
  const go = hum ? (REL[t] & (IN_P | IN_S)) : pt >= S[G.SPGO];
  if (!go && pt < 380) return;
  // the kick
  S[G.PHASE] = PH.PLAY; S[G.PT] = 0;
  S[b + BHELD] = 0; S[b + BOWN] = tk;
  const isShot = hum ? (REL[t] & IN_S) !== 0 : false;
  const jx = hum ? JX[t] : 0, jy = hum ? JY[t] : 0, hold = hum ? (isShot ? S[G.HS0 + t] : S[G.HP0 + t]) : 0;
  S[G.HS0 + t] = 0; S[G.HP0 + t] = 0;
  if (k === SP.THROW) {
    S[tp + PACT] = A.THROW; S[tp + PAT] = 16;
    const j = bestPass(S, tk, jx || S[tp + PFX] * 100, jy || S[tp + PFY] * 100, true);
    if (j >= 0) { const q = pOf(j), ex = S[q + PX] - sx, ey = S[q + PY] - sy, e = Math.sqrt(ex * ex + ey * ey) || 1, T = 0.45 + e / 22, vh = e / T; S[b + BZ] = 2.1; kickRaw(S, tk, (ex / e) * vh, (ey / e) * vh, (GRAV * T) / 2 - 2.1 / T, j); }
    else kickRaw(S, tk, S[tp + PFX] * 11, S[tp + PFY] * 11, 4, -1);
    S[tp + PACT] = A.THROW; S[tp + PAT] = 16;
    return;
  }
  if (k === SP.PEN) {
    // the keeper guesses a side the moment the ball is struck
    const gk = o * NT, gp = pOf(gk), r = rnd(S), side = r < 0.42 ? -1 : r < 0.84 ? 1 : 0;
    if (hum) shoot(S, tk, jx, jy, Math.max(hold, 18), 1);
    else shoot(S, tk, 0, 0, 16 + rnd(S) * 18, 1, (rnd(S) < 0.5 ? -1 : 1) * (GW - 0.7 - rnd(S) * 1.1));
    if (side) { S[gp + PACT] = A.DIVE; S[gp + PAT] = 44; S[gp + PAX] = -d * 0.4; S[gp + PAY] = side * (4.6 + rnd(S) * 1.6); S[gp + PDH] = 0.4 + rnd(S) * 1.4; }
    S[G.PENDIR] = side;
    return;
  }
  if (k === SP.CORNER) {
    if (hum ? isShot : rnd(S) < 0.82) { cross(S, tk); S[b + BSPIN] = -sgn(sy) * d * 1.5; }
    else passTo(S, tk, nearestTo(S, t, sx, sy, tk, false), 0, 0, false);
    return;
  }
  if (k === SP.FREE) {
    const dg = Math.sqrt((d * HL - sx) * (d * HL - sx) + sy * sy);
    if (hum) {
      if (isShot) { shoot(S, tk, jx, jy, Math.max(hold, 16), 0); S[b + BSPIN] = clamp(-sy * 0.12, -3, 3); }
      else pass(S, tk, jx, jy, hold > 14, hold);
    } else if (dg < 30 && Math.abs(sy) < 22 && rnd(S) < 0.65) { shoot(S, tk, 0, 0, 26 + rnd(S) * 14, 0); S[b + BSPIN] = clamp(-sy * 0.12, -3, 3) + (rnd(S) - 0.5); }
    else if (dg < 38 && rnd(S) < 0.5) cross(S, tk);
    else { const j = bestPass(S, tk, 0, 0, false); if (j >= 0) passTo(S, tk, j, 0, 0, Math.sqrt(dist2(S, j, sx, sy)) > 30); else passTo(S, tk, -1, sx + d * 30, sy * 0.5, true); }
    return;
  }
  // goal kick
  if (hum) { if (isShot || hold > 14) keeperOut(S, tk, 2, jx, jy); else { S[b + BHELD] = 0; const j = bestPass(S, tk, jx, jy, true); if (j >= 0) passTo(S, tk, j, 0, 0, false); else keeperOut(S, tk, 2, jx, jy); } }
  else keeperOut(S, tk, rnd(S) < 0.35 ? 1 : 2, 0, 0);
}
function kickRaw(S, i, vx, vy, vz, j) {
  kick(S, i, vx, vy, vz, 0);
  S[G.PTO] = j; S[G.PFROM] = i; S[G.PASSF] = S[G.FRAME]; S[G.PA0 + teamOf(i)]++;
  const t = teamOf(i);
  if (j >= 0 && isHum(S, t)) { S[G.CT0 + t] = j; S[G.SW0 + t] = 30; }
}

// ---------- changement automatique du joueur contrôlé ----------
function autoSwitch(S) {
  const b = BB, own = S[b + BOWN];
  for (let t = 0; t < 2; t++) {
    if (!isHum(S, t)) continue;
    if (S[G.SW0 + t] > 0) S[G.SW0 + t]--;
    if (own >= 0 && teamOf(own) === t) { S[G.CT0 + t] = own; continue; }
    const pto = S[G.PTO];
    if (own < 0 && pto >= 0 && teamOf(pto) === t) { S[G.CT0 + t] = pto; continue; }
    const c = ctrlOf(S, t);
    if (c >= 0 && c % NT === 0) { S[G.CT0 + t] = nearestTo(S, t, S[b + BX], S[b + BY], -1, false); continue; }
    if (S[G.SW0 + t] > 0) continue;
    const bx = S[b + BX], by = S[b + BY];
    const best = nearestTo(S, t, bx, by, -1, false);
    if (best < 0 || best === c) continue;
    const dc = Math.sqrt(dist2(S, c, bx, by)), db = Math.sqrt(dist2(S, best, bx, by));
    const moving = Math.abs(JX[t]) + Math.abs(JY[t]) > 40;
    if ((own < 0 && db < dc - 4 && (!moving || dc > 12)) || (own >= 0 && dc > (moving ? 24 : 14) && db < dc * 0.55)) { S[G.CT0 + t] = best; S[G.SW0 + t] = 36; }
  }
}

/* ---------- jeu en ligne : « rollback » ----------
   Chaque téléphone joue tout de suite avec ses propres commandes (prévues DELAY images plus tard), devine celles de
   l'adversaire (les dernières reçues) et, quand les vraies arrivent et diffèrent, rejoue les images concernées
   depuis un état gardé (≤ 2 s). Les deux matchs restent identiques puisque le moteur est déterministe. */
const RB_SLOTS = 128, RB_IN = 8192, MAXPRED = 24, NEUTRAL = encIn(0, 0, IN_ON);
class Rollback {
  constructor(o) { // { me, delay, seed, dur, ail, onFrame(S, again) }
    this.me = o.me; this.op = 1 - o.me; this.D = o.delay; this.onFrame = o.onFrame || (() => {});
    this.S = newMatch({ seed: o.seed, dur: o.dur, hum: [1, 1], ail: o.ail || [1, 1] });
    this.ring = Array.from({ length: RB_SLOTS }, () => new Float64Array(SLEN));
    this.inp = [new Int32Array(RB_IN), new Int32Array(RB_IN)]; this.used = new Int32Array(RB_IN);
    for (let f = 0; f < this.D; f++) { this.inp[0][f] = NEUTRAL; this.inp[1][f] = NEUTRAL; }
    this.known = [this.D - 1, this.D - 1];
    this.frame = 0; this.rollFrom = Infinity; this.ackOut = this.D - 1; this.rolls = 0; this.rolled = 0;
    this.hashes = new Map(); this.checks = []; this.lastCheck = 0;
  }
  local(v) { const f = this.frame + this.D; if (f > this.known[this.me] + 1) return; this.inp[this.me][f % RB_IN] = v; this.known[this.me] = f; }
  remote(start, vals) {
    const o = this.op;
    for (let k = 0; k < vals.length; k++) {
      const f = start + k;
      if (f <= this.known[o]) continue;
      if (f !== this.known[o] + 1) break; // a gap: wait for the next packet (they always start at the last ack)
      this.inp[o][f % RB_IN] = vals[k]; this.known[o] = f;
      if (f < this.frame && this.used[f % RB_IN] !== vals[k] && f < this.rollFrom) this.rollFrom = f;
    }
  }
  get confirmed() { return Math.min(this.known[0], this.known[1]) + 1; } // states up to this frame are final
  canStep() { return this.frame - this.known[this.op] < MAXPRED && this.known[this.me] >= this.frame; }
  input(f) {
    const o = this.op, vr = f <= this.known[o] ? this.inp[o][f % RB_IN] : this.inp[o][this.known[o] % RB_IN];
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
  step() {
    if (this.rollFrom < this.frame) this.resim();
    this.stepOnce(false);
    this.check();
  }
  resim() {
    const f0 = this.rollFrom, end = this.frame;
    this.rollFrom = Infinity;
    if (f0 < end - RB_SLOTS + 1 || this.ring[f0 % RB_SLOTS][G.FRAME] !== f0) return; // too old (should not happen)
    if (this.onCorrect) { this.pre ??= new Float64Array(SLEN); this.pre.set(this.S); }
    this.S.set(this.ring[f0 % RB_SLOTS]);
    this.frame = f0;
    while (this.frame < end) this.stepOnce(true);
    this.rolls++; this.rolled += end - f0;
    this.onCorrect?.(this.pre, this.S);
  }
  // a fingerprint of the confirmed states every second, to catch a difference between the two phones
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
  // the host's state for frame f replaces ours, and we play again from there
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
  // how many frames ahead of the other phone we are (> 0: we should slow down a little)
  adv(now, rtt) { return this.rfAt ? this.frame - this.known[this.op] + this.D - rtt / 2 / (1000 / FPS) : 0; }
  onPacket(m, now) {
    if (m.f > (this.rf || -1)) { this.rf = m.f; this.rfAt = now; }
    if (m.a > this.ackOut) this.ackOut = Math.min(m.a, this.known[this.me]);
    const vals = [];
    for (let k = 0; k < m.i.length; k += 2) for (let n = 0; n < m.i[k + 1]; n++) vals.push(m.i[k]);
    this.remote(m.s, vals);
  }
}

// ---------- utilitaires pour le réseau ----------
function hashState(S) { // FNV-1a over the bytes of the state
  const u = new Uint32Array(S.buffer, S.byteOffset, S.length * 2);
  let h = 2166136261;
  for (let k = 0; k < u.length; k++) { h ^= u[k]; h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const ENGINE = { FPS, DT, HL, HW, GW, GH, GD, BOXD, BOXW, SIXD, SIXW, SPOT, CIRC, BR, NT, NP, IN_P, IN_S, IN_T, IN_R, IN_ON, PH, SP, A, EV, G, EVB, EVS, BB, PB, PSZ, SLEN,
  BX, BY, BZ, BVX, BVY, BVZ, BOWN, BHELD, BNET, PX, PY, PVX, PVY, PFX, PFY, PACT, PAT, PRUN, PDH, PCOOL, CELEB_F, REPLAY_F, REPLAY_BACK,
  newMatch, step, encIn, hashState, dirOf, teamOf, pOf, ctrlOf, Rollback, NEUTRAL };
/* ===END ENGINE */

/* ---------- l'allure du match : maillots, caméra, dessin ---------- */
const KITS = [
  { n: 'Bleu', c: '#1d4ed8', c2: '#93c5fd', sh: '#f8fafc', so: '#1d4ed8', nu: '#ffffff' },
  { n: 'Rouge', c: '#dc2626', c2: '#fecaca', sh: '#f8fafc', so: '#dc2626', nu: '#ffffff' },
  { n: 'Blanc', c: '#f1f5f9', c2: '#94a3b8', sh: '#1e293b', so: '#f1f5f9', nu: '#0f172a' },
  { n: 'Noir', c: '#1c1917', c2: '#facc15', sh: '#1c1917', so: '#1c1917', nu: '#facc15' },
  { n: 'Jaune', c: '#facc15', c2: '#1d4ed8', sh: '#1e3a8a', so: '#facc15', nu: '#1e3a8a' },
  { n: 'Vert', c: '#15803d', c2: '#bbf7d0', sh: '#f8fafc', so: '#15803d', nu: '#ffffff' },
  { n: 'Orange', c: '#f97316', c2: '#1c1917', sh: '#1c1917', so: '#f97316', nu: '#1c1917' },
  { n: 'Violet', c: '#7c3aed', c2: '#ddd6fe', sh: '#f8fafc', so: '#7c3aed', nu: '#ffffff' },
  { n: 'Ciel', c: '#38bdf8', c2: '#0c4a6e', sh: '#f8fafc', so: '#38bdf8', nu: '#0c4a6e' },
  { n: 'Rayé', c: '#f8fafc', c2: '#1c1917', sh: '#1c1917', so: '#1c1917', nu: '#1c1917', stripes: true },
];
const KEEPERS = [
  { c: '#22c55e', c2: '#14532d', sh: '#14532d', so: '#22c55e', nu: '#052e16', gl: '#f8fafc' },
  { c: '#f59e0b', c2: '#78350f', sh: '#1c1917', so: '#f59e0b', nu: '#1c1917', gl: '#f8fafc' },
  { c: '#ec4899', c2: '#831843', sh: '#1c1917', so: '#ec4899', nu: '#ffffff', gl: '#f8fafc' },
  { c: '#64748b', c2: '#0f172a', sh: '#0f172a', so: '#64748b', nu: '#ffffff', gl: '#facc15' },
];
const SKIN = ['#f1c7a3', '#d9a066', '#a8714a', '#7a4b2a', '#5a3820', '#e8b896', '#c68a5a'];
const HAIR = ['#1f1a17', '#3b2416', '#6b4423', '#d4a24c', '#0b0b0b', '#5c3d1e', '#2a1a10'];
const rgbOf = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const colDist = (a, b) => { const x = rgbOf(a), y = rgbOf(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
// the guest changes shirt when both teams would look alike
function kitsFor(ka, kb) {
  ka = KITS[ka] ? ka : 0; kb = KITS[kb] ? kb : 1;
  const clash = (a, b) => a === b || colDist(KITS[a].c, KITS[b].c) < 110;
  if (clash(ka, kb)) kb = [2, 3, 4, 1, 0, 5, 7].find((k) => !clash(ka, k));
  const kpa = KEEPERS.findIndex((k) => colDist(k.c, KITS[ka].c) > 110 && colDist(k.c, KITS[kb].c) > 110);
  const kpb = KEEPERS.findIndex((k, n) => n !== kpa && colDist(k.c, KITS[ka].c) > 110 && colDist(k.c, KITS[kb].c) > 110);
  return { kit: [KITS[ka], KITS[kb]], gk: [KEEPERS[Math.max(0, kpa)], KEEPERS[Math.max(0, kpb === -1 ? (kpa + 1) % 4 : kpb)]], ids: [ka, kb] };
}

let SX = 0, SY = 0, SZ = 0;
const NEAR = 0.6;
class Cam {
  constructor() { this.x = 0; this.y = -60; this.z = 22; this.rx = 1; this.ry = 0; this.fx = 0; this.fy = 1; this.fz = 0; this.ux = 0; this.uy = 0; this.uz = 1; this.F = 800; this.cx = 0; this.cy = 0; }
  aim(px, py, pz, lx, ly, lz, W, H, viewW, cyk) {
    this.x = px; this.y = py; this.z = pz;
    let fx = lx - px, fy = ly - py, fz = lz - pz;
    const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    const hl = Math.hypot(fx, fy) || 1;
    this.rx = fy / hl; this.ry = -fx / hl;
    this.ux = this.ry * fz; this.uy = -this.rx * fz; this.uz = this.rx * fy - this.ry * fx;
    this.fx = fx; this.fy = fy; this.fz = fz;
    this.F = (W * fl) / viewW; this.cx = W / 2; this.cy = H * cyk;
  }
  p(x, y, z) {
    const dx = x - this.x, dy = y - this.y, dz = z - this.z;
    const zc = dx * this.fx + dy * this.fy + dz * this.fz;
    SZ = zc;
    if (zc < 0.4) return false;
    const k = this.F / zc;
    SX = this.cx + (dx * this.rx + dy * this.ry) * k;
    SY = this.cy - (dx * this.ux + dy * this.uy + dz * this.uz) * k;
    return true;
  }
  depth(x, y, z) { return (x - this.x) * this.fx + (y - this.y) * this.fy + (z - this.z) * this.fz; }
}

// textures made once: the crowd (2 frames), the LED boards, the grass grain
function makeCrowd(cols) {
  const W = 1024, H = 420, c = document.createElement('canvas');
  c.width = W; c.height = H * 2;
  const g = c.getContext('2d');
  const pal = [...cols, ...cols, '#f8fafc', '#e2e8f0', '#1e293b', '#334155', '#dc2626', '#f59e0b', '#16a34a', '#7c3aed', '#0ea5e9', '#f472b6', '#111827'];
  const skins = ['#f1c7a3', '#d9a066', '#a8714a', '#7a4b2a', '#e8b896'];
  const seed = []; for (let k = 0; k < 5000; k++) seed.push(Math.random());
  for (let f = 0; f < 2; f++) {
    const oy = f * H;
    const bg = g.createLinearGradient(0, oy, 0, oy + H); bg.addColorStop(0, '#0b1020'); bg.addColorStop(1, '#1e2638');
    g.fillStyle = bg; g.fillRect(0, oy, W, H);
    let n = 0;
    for (let r = 0; r < 40; r++) {
      const y = oy + 8 + r * 10.3;
      g.fillStyle = r % 2 ? '#273248' : '#222b3e'; g.fillRect(0, y + 3, W, 2);
      const shade = 0.55 + (r / 40) * 0.45; // the top rows are further from the lights
      for (let x = (r % 2) * 3.5 + 2; x < W; x += 7) {
        const a = seed[n++ % 5000], b = seed[(n * 7) % 5000];
        if (a < 0.05) continue; // empty seat
        const col = pal[Math.floor(b * pal.length)], up = f && seed[(n * 13) % 5000] < 0.45 ? 1.5 : 0;
        g.globalAlpha = 1 - (1 - shade) * 0.6;
        g.fillStyle = col; g.fillRect(x - 2.6, y - 1 - up, 5.2, 5.5);
        g.fillStyle = skins[Math.floor(a * 97) % skins.length];
        g.beginPath(); g.arc(x, y - 3 - up, 2, 0, 6.283); g.fill();
        if (f && up && seed[(n * 3) % 5000] < 0.3) { g.fillRect(x - 3.4, y - 7.5, 1.2, 4); g.fillRect(x + 2.4, y - 7.5, 1.2, 4); } // arms up
      }
    }
    g.globalAlpha = 1;
    // big flags in the club colours
    for (let k = 0; k < 7; k++) { g.fillStyle = cols[k % cols.length]; g.globalAlpha = 0.8; g.fillRect(40 + k * 145 + (f ? 3 : 0), oy + 40 + (k % 4) * 80, 46, 30); g.fillStyle = cols[(k + 1) % cols.length]; g.fillRect(40 + k * 145 + (f ? 3 : 0), oy + 50 + (k % 4) * 80, 46, 8); g.globalAlpha = 1; }
  }
  return c;
}
function makeBoards() {
  const W = 2048, H = 48, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const items = [['SPINBET', '#38bdf8', '#020617'], ['LE DERBY', '#facc15', '#111827'], ['WWW.SPINBETCAZ.COM', '#ffffff', '#1d4ed8'], ['JOUE ENTRE AMIS', '#f8fafc', '#16a34a'], ['⚽ SPINBET CASINO', '#fde047', '#7c3aed'], ['ARGENT FICTIF · 18+', '#e2e8f0', '#334155']];
  let x = 0, k = 0;
  while (x < W) {
    const [t, fg, bg] = items[k++ % items.length], w = 340;
    g.fillStyle = bg; g.fillRect(x, 0, w, H);
    g.fillStyle = fg; g.font = '900 26px Archivo, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(t, x + w / 2, H / 2 + 1, w - 20);
    g.fillStyle = 'rgba(255,255,255,.06)'; for (let yy = 0; yy < H; yy += 3) g.fillRect(x, yy, w, 1);
    x += w;
  }
  return c;
}
function makeGrain() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 96;
  const g = c.getContext('2d');
  for (let k = 0; k < 900; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.05)'; g.fillRect(Math.random() * 96, Math.random() * 96, 1 + Math.random(), 1 + Math.random() * 2); }
  return c;
}

// the snapshot used to draw one moment (live, between two frames, or from the replay)
const ENT = 11;
class Snap {
  constructor() { this.p = new Float32Array(NP * ENT); this.b = new Float32Array(6); this.ct = [-1, -1]; this.frame = 0; }
  fromState(S, P, a) {
    const w = P && P[G.FRAME] === S[G.FRAME] - 1 ? a : 1;
    for (let i = 0; i < NP; i++) {
      const q = pOf(i), o = i * ENT, x = S[q + PX], y = S[q + PY];
      const ox = w < 1 ? P[q + PX] : x, oy = w < 1 ? P[q + PY] : y;
      const jump = Math.abs(x - ox) + Math.abs(y - oy) > 3; // teleported (set piece): no in-between
      this.p[o] = jump ? x : ox + (x - ox) * w; this.p[o + 1] = jump ? y : oy + (y - oy) * w;
      this.p[o + 2] = S[q + PFX]; this.p[o + 3] = S[q + PFY]; this.p[o + 4] = S[q + PACT]; this.p[o + 5] = S[q + PAT];
      this.p[o + 6] = S[q + PRUN]; this.p[o + 7] = Math.hypot(S[q + PVX], S[q + PVY]); this.p[o + 8] = S[q + PDH];
      this.p[o + 9] = S[q + PAX]; this.p[o + 10] = S[q + PAY];
    }
    const b = BB, bx = S[b + BX], by = S[b + BY], bz = S[b + BZ];
    const ox = w < 1 ? P[b + BX] : bx, oy = w < 1 ? P[b + BY] : by, oz = w < 1 ? P[b + BZ] : bz;
    const jump = Math.abs(bx - ox) + Math.abs(by - oy) > 4;
    this.b[0] = jump ? bx : ox + (bx - ox) * w; this.b[1] = jump ? by : oy + (by - oy) * w; this.b[2] = jump ? bz : oz + (bz - oz) * w;
    this.b[3] = Math.hypot(S[b + BVX], S[b + BVY], S[b + BVZ]); this.b[4] = S[b + BOWN]; this.b[5] = S[b + BNET];
    this.ct[0] = S[G.CT0]; this.ct[1] = S[G.CT1]; this.frame = S[G.FRAME];
    return this;
  }
  copyTo(arr, off) { arr.set(this.p, off); arr.set(this.b, off + NP * ENT); arr[off + NP * ENT + 6] = this.ct[0]; arr[off + NP * ENT + 7] = this.ct[1]; }
  from(arr, off) { this.p.set(arr.subarray(off, off + NP * ENT)); this.b.set(arr.subarray(off + NP * ENT, off + NP * ENT + 6)); this.ct[0] = arr[off + NP * ENT + 6]; this.ct[1] = arr[off + NP * ENT + 7]; return this; }
}
const SNAPLEN = NP * ENT + 8, HIST = 720;
// last frames, for the goal replays (overwritten when a frame is played again after a correction)
class History {
  constructor() { this.buf = new Float32Array(SNAPLEN * HIST); this.fr = new Int32Array(HIST).fill(-1); this.tmp = new Snap(); }
  save(S) { const f = S[G.FRAME], k = f % HIST; this.tmp.fromState(S, null, 1); this.tmp.copyTo(this.buf, k * SNAPLEN); this.fr[k] = f; }
  get(f, out) { const k = ((f % HIST) + HIST) % HIST; if (this.fr[k] !== f) return null; return out.from(this.buf, k * SNAPLEN); }
}

const PAL = { grassA: '#2f8a3b', grassB: '#277a33', grassOut: '#1f6a2c', line: 'rgba(248,250,252,.88)', track: '#1a5426' };
class Painter {
  constructor(cv) {
    this.cv = cv; this.g = cv.getContext('2d', { alpha: false });
    this.cam = new Cam(); this.W = 0; this.H = 0; this.dpr = 1;
    this.camX = 0; this.camY = 0; this.mode = 'tv'; this.zoom = 1;
    this.boards = makeBoards(); this.grain = makeGrain(); this.grainPat = null;
    this.crowd = null; this.crowdCols = '';
    this.parts = []; this.trail = []; this.flash = 0; this.shake = 0; this.jump = 0; this.netHit = 0; this.netX = 0; this.netY = 0;
    this.items = []; this.j = new Float64Array(14 * 3); this.js = new Float64Array(14 * 3);
    this.snap = new Snap(); this.rsnap = new Snap();
  }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, r.width * r.height > 900000 ? 1.5 : 2, this.maxDpr || 3);
    const W = Math.max(200, Math.round(r.width)), H = Math.max(150, Math.round(r.height));
    if (W === this.W && H === this.H && dpr === this.dpr) return;
    this.W = W; this.H = H; this.dpr = dpr;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
  }
  setTeams(kits) {
    this.kits = kits;
    const key = kits.kit[0].c + kits.kit[1].c;
    if (key !== this.crowdCols) { this.crowd = makeCrowd([kits.kit[0].c, kits.kit[1].c, kits.kit[0].c2, kits.kit[1].c2]); this.crowdCols = key; }
  }
  // the camera follows the ball: from the side (TV) in landscape, from behind in portrait
  camera(bx, by, bvx, bvy, myDir, dt, replay) {
    const W = this.W, H = this.H, portrait = H > W * 1.05;
    this.mode = portrait ? 'back' : 'tv';
    const k = 1 - Math.pow(replay ? 0.86 : 0.93, dt * 60);
    const near = Math.max(0, 1 - (HL - bx * myDir) / 30); // close to the goal I attack: show more of it
    const tx = bx + bvx * 0.35 + (replay ? 0 : myDir * (3.5 + near * 6)), ty = by + bvy * 0.25;
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
    if (Math.abs(tx - this.camX) > 40) { this.camX = tx; this.camY = ty; }
    const s = myDir;
    if (!portrait) {
      const viewW = (W / H > 1.9 ? 44 : 40) * this.zoom * (replay ? 0.72 : 1) * (W > 1000 ? 1.08 : 1);
      const fx = clamp(this.camX, -HL + viewW * 0.1, HL - viewW * 0.1), fy = this.camY * 0.55;
      this.cam.aim(fx, fy - s * 50, 24, fx, fy, 0, W, H, viewW, 0.58);
    } else {
      const viewW = 32 * this.zoom * (replay ? 0.8 : 1);
      const fx = clamp(this.camX, -HL - 4, HL - 4), fy = clamp(this.camY * 0.8, -HW + 8, HW - 8);
      this.cam.aim(fx - s * 19, fy * 0.9, 18, fx + s * 13, fy, 0, W, H, viewW, 0.47);
    }
    if (this.shake > 0) { this.cam.cx += (Math.random() - 0.5) * this.shake * 8; this.cam.cy += (Math.random() - 0.5) * this.shake * 6; }
  }

  /* ----- drawing helpers ----- */
  poly(pts, n) { // fills a world polygon (flat array x,y,z), clipped in front of the camera
    const c = this.cam, g = this.g;
    let px = pts[(n - 1) * 3], py = pts[(n - 1) * 3 + 1], pz = pts[(n - 1) * 3 + 2], pd = c.depth(px, py, pz), m = 0;
    g.beginPath();
    const emit = (x, y, z) => { c.p(x, y, z); if (m++) g.lineTo(SX, SY); else g.moveTo(SX, SY); };
    for (let k = 0; k < n; k++) {
      const x = pts[k * 3], y = pts[k * 3 + 1], z = pts[k * 3 + 2], d = c.depth(x, y, z);
      if (d >= NEAR) {
        if (pd < NEAR) { const t = (NEAR - pd) / (d - pd); emit(px + (x - px) * t, py + (y - py) * t, pz + (z - pz) * t); }
        emit(x, y, z);
      } else if (pd >= NEAR) { const t = (NEAR - pd) / (d - pd); emit(px + (x - px) * t, py + (y - py) * t, pz + (z - pz) * t); }
      px = x; py = y; pz = z; pd = d;
    }
    return m >= 3;
  }
  seg(x0, y0, z0, x1, y1, z1) { // adds a clipped segment to the current path
    const c = this.cam, g = this.g;
    let d0 = c.depth(x0, y0, z0), d1 = c.depth(x1, y1, z1);
    if (d0 < NEAR && d1 < NEAR) return;
    if (d0 < NEAR) { const t = (NEAR - d0) / (d1 - d0); x0 += (x1 - x0) * t; y0 += (y1 - y0) * t; z0 += (z1 - z0) * t; }
    else if (d1 < NEAR) { const t = (NEAR - d0) / (d1 - d0); x1 = x0 + (x1 - x0) * t; y1 = y0 + (y1 - y0) * t; z1 = z0 + (z1 - z0) * t; }
    c.p(x0, y0, z0); g.moveTo(SX, SY); c.p(x1, y1, z1); g.lineTo(SX, SY);
  }
  arc(cx, cy, r, a0, a1, n) { let px = cx + Math.cos(a0) * r, py = cy + Math.sin(a0) * r; for (let k = 1; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; this.seg(px, py, 0, x, y, 0); px = x; py = y; } }
  // an image stretched over a 3D quad (origin O, along U, up V), cut in cells so the perspective holds
  tex(img, sx, sy, sw, sh, O, U, V, nu, nv, alpha) {
    const c = this.cam, g = this.g, d = this.dpr;
    g.globalAlpha = alpha ?? 1;
    for (let iu = 0; iu < nu; iu++) {
      const u0 = iu / nu, u1 = (iu + 1) / nu;
      for (let iv = 0; iv < nv; iv++) {
        const v0 = iv / nv, v1 = (iv + 1) / nv;
        if (!c.p(O[0] + U[0] * u0 + V[0] * v1, O[1] + U[1] * u0 + V[1] * v1, O[2] + U[2] * u0 + V[2] * v1)) continue;
        const ax = SX, ay = SY;
        if (!c.p(O[0] + U[0] * u1 + V[0] * v1, O[1] + U[1] * u1 + V[1] * v1, O[2] + U[2] * u1 + V[2] * v1)) continue;
        const bx = SX, by = SY;
        if (!c.p(O[0] + U[0] * u0 + V[0] * v0, O[1] + U[1] * u0 + V[1] * v0, O[2] + U[2] * u0 + V[2] * v0)) continue;
        const dx = SX, dy = SY;
        if ((ax < -200 && bx < -200) || (ax > this.W + 200 && bx > this.W + 200)) continue;
        g.setTransform((bx - ax) * d, (by - ay) * d, (dx - ax) * d, (dy - ay) * d, ax * d, ay * d);
        g.drawImage(img, sx + sw * u0, sy + sh * (1 - v1), sw / nu, sh / nv, -0.004, -0.01, 1.008, 1.02);
      }
    }
    g.setTransform(d, 0, 0, d, 0, 0); g.globalAlpha = 1;
  }

  /* ----- the stadium ----- */
  stadium(t) {
    const g = this.g, W = this.W, H = this.H;
    const sky = g.createLinearGradient(0, 0, 0, H * 0.6); sky.addColorStop(0, '#02040b'); sky.addColorStop(1, '#0d1730');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    if (!this.crowd) return;
    const fr = this.jump > 0 ? (Math.floor(t * 9) % 2) : (Math.floor(t * 1.6) % 2), ch = this.crowd.height / 2, cw = this.crowd.width;
    const back = 34, rise = 24, gap = 7;
    // four stands, each a slope going up and away from the boards; the board strips in front
    const stands = [
      [[-HL - 30, HW + gap, 0], [2 * HL + 60, 0, 0], [0, back, rise]],
      [[HL + 30, -HW - gap, 0], [-2 * HL - 60, 0, 0], [0, -back, rise]],
      [[HL + gap, HW + 30, 0], [0, -2 * HW - 60, 0], [back, 0, rise]],
      [[-HL - gap, -HW - 30, 0], [0, 2 * HW + 60, 0], [-back, 0, rise]],
    ];
    const cfx = this.cam.fx, cfy = this.cam.fy;
    for (const [O, U, V] of stands) {
      const facing = V[0] * cfx + V[1] * cfy; // the stand rises away from the camera: visible
      if (facing <= 0) continue;
      const len = Math.hypot(U[0], U[1]), along = Math.abs(U[0] * cfx + U[1] * cfy) / len, reps = Math.max(1, Math.round(len / 52));
      for (let r = 0; r < reps; r++) {
        const O2 = [O[0] + (U[0] * r) / reps, O[1] + (U[1] * r) / reps, 0], U2 = [U[0] / reps, U[1] / reps, 0];
        this.tex(this.crowd, 0, fr * ch, cw, ch, O2, U2, V, along > 0.35 ? 6 : 1, 8);
      }
      if (along <= 0.35) { // a dark wall under the stand facing the camera
        g.fillStyle = '#060a14';
        if (this.poly([O[0], O[1], 0, O[0] + U[0], O[1] + U[1], 0, O[0] + U[0], O[1] + U[1], 1.4, O[0], O[1], 1.4], 4)) g.fill();
      }
    }
    // floodlights at the four corners
    g.globalCompositeOperation = 'lighter';
    for (const [x, y] of [[-HL - 16, -HW - 22], [HL + 16, -HW - 22], [-HL - 16, HW + 22], [HL + 16, HW + 22]]) {
      if (!this.cam.p(x, y, 44) || SX < -300 || SX > W + 300) continue;
      const r = Math.max(30, (this.cam.F / SZ) * 14), gr = g.createRadialGradient(SX, SY, 0, SX, SY, r);
      gr.addColorStop(0, 'rgba(255,255,240,.95)'); gr.addColorStop(0.15, 'rgba(255,250,220,.45)'); gr.addColorStop(1, 'rgba(255,250,220,0)');
      g.fillStyle = gr; g.fillRect(SX - r, SY - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';
  }
  boardsDraw(t) {
    const off = (t * 40) % 1, img = this.boards, w = img.width, h = img.height;
    const B = 3.6, Hb = 0.95;
    const runs = [
      [[-HL - B, HW + B, 0], [2 * HL + 2 * B, 0, 0], [0, 0, Hb], 0, 1],
      [[HL + B, -HW - B, 0], [-2 * HL - 2 * B, 0, 0], [0, 0, Hb], 0, -1],
      [[HL + B, HW + B, 0], [0, -2 * HW - 2 * B, 0], [0, 0, Hb], 1, 1],
      [[-HL - B, -HW - B, 0], [0, 2 * HW + 2 * B, 0], [0, 0, Hb], 1, -1],
    ];
    for (const [O, U, V] of runs) {
      // boards facing the camera only (their front is towards the pitch)
      const nx = -U[1], ny = U[0], toCam = (this.cam.x - O[0]) * nx + (this.cam.y - O[1]) * ny;
      if (toCam > 0) continue;
      const len = Math.hypot(U[0], U[1]), reps = Math.max(1, Math.round(len / 34));
      for (let r = 0; r < reps; r++) {
        const a = r / reps, b2 = (r + 1) / reps;
        const O2 = [O[0] + U[0] * a, O[1] + U[1] * a, 0], U2 = [U[0] * (b2 - a), U[1] * (b2 - a), 0];
        const sx = ((r * 0.37 + off) % 1) * (w * 0.5);
        this.tex(img, sx, 0, w * 0.5, h, O2, U2, V, 3, 1);
      }
    }
  }
  pitch() {
    const g = this.g;
    g.fillStyle = PAL.track;
    if (this.poly([-HL - 9, -HW - 8, 0, HL + 9, -HW - 8, 0, HL + 9, HW + 8, 0, -HL - 9, HW + 8, 0], 4)) g.fill();
    // mowing stripes
    const n = 18, w = (2 * HL + 10) / n;
    for (let k = 0; k < n; k++) {
      const x0 = -HL - 5 + k * w, x1 = x0 + w;
      g.fillStyle = k % 2 ? PAL.grassA : PAL.grassB;
      if (this.poly([x0, -HW - 4, 0, x1, -HW - 4, 0, x1, HW + 4, 0, x0, HW + 4, 0], 4)) g.fill();
    }
    if (!this.grainPat) this.grainPat = g.createPattern(this.grain, 'repeat');
    g.fillStyle = this.grainPat;
    if (this.poly([-HL - 5, -HW - 4, 0, HL + 5, -HW - 4, 0, HL + 5, HW + 4, 0, -HL - 5, HW + 4, 0], 4)) g.fill();
    // the lines
    const mid = this.cam.depth(this.camX, this.camY * 0.5, 0);
    g.strokeStyle = PAL.line; g.lineWidth = Math.max(1, (0.13 * this.cam.F) / Math.max(10, mid)); g.lineCap = 'round';
    g.beginPath();
    this.seg(-HL, -HW, 0, HL, -HW, 0); this.seg(-HL, HW, 0, HL, HW, 0);
    this.seg(-HL, -HW, 0, -HL, HW, 0); this.seg(HL, -HW, 0, HL, HW, 0); this.seg(0, -HW, 0, 0, HW, 0);
    this.arc(0, 0, CIRC, 0, Math.PI * 2, 48);
    for (const s of [-1, 1]) {
      const gx = s * HL;
      this.seg(gx, -BOXW, 0, gx - s * BOXD, -BOXW, 0); this.seg(gx - s * BOXD, -BOXW, 0, gx - s * BOXD, BOXW, 0); this.seg(gx - s * BOXD, BOXW, 0, gx, BOXW, 0);
      this.seg(gx, -SIXW, 0, gx - s * SIXD, -SIXW, 0); this.seg(gx - s * SIXD, -SIXW, 0, gx - s * SIXD, SIXW, 0); this.seg(gx - s * SIXD, SIXW, 0, gx, SIXW, 0);
      const px = gx - s * SPOT, a = Math.acos((BOXD - SPOT) / CIRC);
      if (s > 0) this.arc(px, 0, CIRC, Math.PI - a, Math.PI + a, 14); else this.arc(px, 0, CIRC, -a, a, 14);
      for (const k of [-1, 1]) this.arc(gx, k * HW, 1, s > 0 ? (k > 0 ? Math.PI : Math.PI / 2) : (k > 0 ? -Math.PI / 2 : 0), s > 0 ? (k > 0 ? Math.PI * 1.5 : Math.PI) : (k > 0 ? 0 : Math.PI / 2), 6);
    }
    g.stroke();
    g.fillStyle = PAL.line;
    for (const [x, y] of [[0, 0], [HL - SPOT, 0], [-HL + SPOT, 0]]) { if (this.poly([x - 0.18, y - 0.18, 0, x + 0.18, y - 0.18, 0, x + 0.18, y + 0.18, 0, x - 0.18, y + 0.18, 0], 4)) g.fill(); }
  }

  /* ----- players, ball, goals ----- */
  // the 14 joints of a player in the world (hips, knees, feet, neck, shoulders, elbows, hands, head)
  skeleton(x, y, fx, fy, act, at, run, spd, dh, ax, ay, isGK) {
    const j = this.j;
    let Fx = fx, Fy = fy, Fz = 0, Ux = 0, Uy = 0, Uz = 1, hz = 0.95;
    const ph = (run / 1.85) * Math.PI * 2, amp = Math.min(0.78, spd * 0.12);
    let lA = Math.sin(ph) * amp, rA = -lA, lB = Math.max(0, Math.sin(ph + 1.2)) * amp * 1.3, rB = Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * amp * 1.3;
    let armL = -lA * 0.9, armR = -rA * 0.9, spread = 0.12, raise = 0, lean = Math.min(0.25, spd * 0.03);
    hz += Math.abs(Math.cos(ph)) * 0.035 * Math.min(1, spd / 5);
    let jumpZ = 0;
    if (act === A.KICK) { const k = 1 - at / 14; rA = -0.9 + k * 2.1; rB = k < 0.4 ? 1.2 : 0.2; lA = -0.15; lB = 0.2; armL = 0.5; armR = -0.6; spread = 0.4; lean = -0.1; }
    else if (act === A.THROW) { const k = 1 - at / 16; raise = 1; armL = armR = Math.PI - 0.4 + k * 1.2; lean = -0.15 + k * 0.4; }
    else if (act === A.HOLD) { armL = armR = 1.1; spread = 0.05; }
    else if (act === A.HEAD) { const k = 1 - at / 20; jumpZ = Math.sin(k * Math.PI) * 0.45; lA = 0.3; rA = -0.2; lB = rB = 0.9; armL = armR = -0.4; spread = 0.6; lean = 0.25; }
    else if (act === A.CELEB) { armL = armR = Math.PI - 0.35; spread = 0.5; lean = -0.1; }
    else if (act === A.SAD) { armL = armR = 0.05; lean = 0.35; }
    else if (act === A.LUNGE) { lA = 0.9; rA = -0.6; lB = 0.1; rB = 0.5; lean = 0.35; armL = 0.4; armR = -0.4; spread = 0.4; }
    else if (act === A.SKILL) { lA = Math.sin(at * 0.6) * 0.8; rA = -lA; armL = 0.3; armR = 0.3; spread = 0.7; }
    if (act === A.SLIDE) { // half lying back, legs first
      const m = Math.hypot(ax, ay) || 1; Fx = ax / m; Fy = ay / m;
      Ux = -Fx * 0.82; Uy = -Fy * 0.82; Uz = 0.57; hz = 0.28; lA = 1.45; rA = 1.25; lB = 0.1; rB = 0.6; armL = -0.4; armR = 0.9; spread = 0.7; lean = 0;
    } else if (act === A.DIVE || (act === A.GETUP && isGK && at > 12)) { // the keeper flies sideways
      const m = Math.hypot(ax, ay) || 1, sx = ax / m, sy = ay / m;
      Ux = sx * 0.94; Uy = sy * 0.94; Uz = 0.34; hz = act === A.DIVE ? Math.max(0.35, dh * (at > 30 ? 1 : at / 30) + 0.2) : 0.3;
      Fx = fx; Fy = fy; lA = 0.25; rA = -0.15; lB = rB = 0.3; armL = armR = Math.PI; spread = 0.25; lean = 0;
    } else if (act === A.FALL || act === A.GETUP) { // on the ground, getting up
      const k = act === A.FALL ? 0 : 1 - at / 20;
      Ux = -fx * (1 - k) * 0.97; Uy = -fy * (1 - k) * 0.97; Uz = 0.24 + k * 0.76; hz = 0.22 + k * 0.7;
      lA = 0.3 * (1 - k); rA = 0.6 * (1 - k); lB = rB = 0.9 * (1 - k) + 0.1; armL = 1.4 * (1 - k); armR = 0.4; spread = 0.5 * (1 - k) + 0.12; lean = 0;
    }
    const um = Math.hypot(Ux, Uy, Uz); Ux /= um; Uy /= um; Uz /= um;
    // forward axis of the body: perpendicular to up, close to the facing
    let fdot = Fx * Ux + Fy * Uy + Fz * Uz; let Gx = Fx - Ux * fdot, Gy = Fy - Uy * fdot, Gz = Fz - Uz * fdot;
    let gm = Math.hypot(Gx, Gy, Gz);
    if (gm < 0.1) { Gx = 0; Gy = 0; Gz = 1; gm = 1; }
    Gx /= gm; Gy /= gm; Gz /= gm;
    const Sx = Uy * Gz - Uz * Gy, Sy = Uz * Gx - Ux * Gz, Sz = Ux * Gy - Uy * Gx; // side (left)
    const hx = x, hy = y, hzz = hz + jumpZ;
    const set = (k, px, py, pz) => { j[k * 3] = px; j[k * 3 + 1] = py; j[k * 3 + 2] = pz; };
    const limb = (k, ox, oy, oz, a, len) => { set(k, ox + (Gx * Math.sin(a) - Ux * Math.cos(a)) * len, oy + (Gy * Math.sin(a) - Uy * Math.cos(a)) * len, oz + (Gz * Math.sin(a) - Uz * Math.cos(a)) * len); };
    // hips
    set(0, hx + Sx * 0.11, hy + Sy * 0.11, hzz + Sz * 0.11); set(1, hx - Sx * 0.11, hy - Sy * 0.11, hzz - Sz * 0.11);
    limb(2, j[0], j[1], j[2], lA, 0.47); limb(3, j[3], j[4], j[5], rA, 0.47);
    limb(4, j[6], j[7], j[8], lA - lB, 0.46); limb(5, j[9], j[10], j[11], rA - rB, 0.46);
    // neck and shoulders (the torso leans forward with speed)
    const nx = hx + (Ux * Math.cos(lean) + Gx * Math.sin(lean)) * 0.55, ny = hy + (Uy * Math.cos(lean) + Gy * Math.sin(lean)) * 0.55, nz = hzz + (Uz * Math.cos(lean) + Gz * Math.sin(lean)) * 0.55;
    set(6, nx, ny, nz);
    set(7, nx + Sx * 0.2 - Ux * 0.05, ny + Sy * 0.2 - Uy * 0.05, nz + Sz * 0.2 - Uz * 0.05); set(8, nx - Sx * 0.2 - Ux * 0.05, ny - Sy * 0.2 - Uy * 0.05, nz - Sz * 0.2 - Uz * 0.05);
    const arm = (k, o, a, side) => {
      const ox = j[o * 3], oy = j[o * 3 + 1], oz = j[o * 3 + 2], sp = spread * side;
      const dx = Gx * Math.sin(a) - Ux * Math.cos(a) + Sx * sp, dy = Gy * Math.sin(a) - Uy * Math.cos(a) + Sy * sp, dz = Gz * Math.sin(a) - Uz * Math.cos(a) + Sz * sp, m = Math.hypot(dx, dy, dz);
      set(k, ox + (dx / m) * 0.28, oy + (dy / m) * 0.28, oz + (dz / m) * 0.28);
      const b = raise ? a : a + 0.5, ex = Gx * Math.sin(b) - Ux * Math.cos(b) + Sx * sp * 0.5, ey = Gy * Math.sin(b) - Uy * Math.cos(b) + Sy * sp * 0.5, ez = Gz * Math.sin(b) - Uz * Math.cos(b) + Sz * sp * 0.5, n = Math.hypot(ex, ey, ez);
      set(k + 2, j[k * 3] + (ex / n) * 0.26, j[k * 3 + 1] + (ey / n) * 0.26, j[k * 3 + 2] + (ez / n) * 0.26);
    };
    arm(9, 7, armL, 1); arm(10, 8, armR, -1);
    set(13, nx + Ux * 0.17 + Gx * lean * 0.12, ny + Uy * 0.17 + Gy * lean * 0.12, nz + Uz * 0.17 + Gz * lean * 0.12);
    return [Gx, Gy, Sx, Sy];
  }
  player(i, s, kit, me) {
    const g = this.g, c = this.cam, o = i * ENT, p = s.p;
    const x = p[o], y = p[o + 1], act = p[o + 4];
    const isGK = i % NT === 0;
    const [Gx, Gy] = this.skeleton(x, y, p[o + 2], p[o + 3], act, p[o + 5], p[o + 6], p[o + 7], p[o + 8], p[o + 9], p[o + 10], isGK);
    const j = this.j, js = this.js;
    for (let k = 0; k < 14; k++) { if (!c.p(j[k * 3], j[k * 3 + 1], j[k * 3 + 2])) return; js[k * 3] = SX; js[k * 3 + 1] = SY; js[k * 3 + 2] = SZ; }
    const sc = c.F / js[13 * 3 + 2]; // pixels per metre at the head
    const skin = SKIN[(i * 5 + 3) % SKIN.length], hair = HAIR[(i * 3 + 1) % HAIR.length];
    const lw = (m) => Math.max(1, m * sc);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const line = (a, b, col, w) => { g.strokeStyle = col; g.lineWidth = lw(w); g.beginPath(); g.moveTo(js[a * 3], js[a * 3 + 1]); g.lineTo(js[b * 3], js[b * 3 + 1]); g.stroke(); };
    const half = (a, b, c1, c2, w) => { // first half one colour, second half another
      const mx = (js[a * 3] + js[b * 3]) / 2, my = (js[a * 3 + 1] + js[b * 3 + 1]) / 2;
      g.lineWidth = lw(w); g.strokeStyle = c1; g.beginPath(); g.moveTo(js[a * 3], js[a * 3 + 1]); g.lineTo(mx, my); g.stroke();
      g.strokeStyle = c2; g.beginPath(); g.moveTo(mx, my); g.lineTo(js[b * 3], js[b * 3 + 1]); g.stroke();
    };
    const leg = (h, k, f) => {
      half(h, k, kit.sh, skin, 0.17);
      line(k, f, kit.so, 0.13);
      // boot
      g.strokeStyle = '#0f0f12'; g.lineWidth = lw(0.12); g.beginPath(); g.moveTo(js[f * 3], js[f * 3 + 1]);
      c.p(j[f * 3] + Gx * 0.16, j[f * 3 + 1] + Gy * 0.16, j[f * 3 + 2] + 0.02); g.lineTo(SX, SY); g.stroke();
    };
    const armD = (sh, el, hd) => { half(sh, el, kit.c, isGK ? kit.c : skin, 0.11); line(el, hd, isGK ? kit.c : skin, 0.095); if (isGK) { g.fillStyle = kit.gl; g.beginPath(); g.arc(js[hd * 3], js[hd * 3 + 1], lw(0.06), 0, 6.283); g.fill(); } };
    // far side first: compare the depth of the two hips
    const leftFar = js[2] > js[5];
    if (leftFar) { armD(7, 9, 11); leg(0, 2, 4); } else { armD(8, 10, 12); leg(1, 3, 5); }
    // shorts and shirt
    g.fillStyle = kit.sh;
    g.beginPath(); g.moveTo(js[0], js[1]); g.lineTo(js[3], js[4]); g.lineTo((js[3] + js[9]) / 2, (js[4] + js[10]) / 2); g.lineTo((js[0] + js[6]) / 2, (js[1] + js[7]) / 2); g.closePath(); g.fill();
    g.fillStyle = kit.c;
    g.beginPath(); g.moveTo(js[21], js[22]); g.lineTo(js[24], js[25]); g.lineTo(js[3], js[4]); g.lineTo(js[0], js[1]); g.closePath(); g.fill();
    g.strokeStyle = kit.c; g.lineWidth = lw(0.16); g.stroke();
    if (kit.stripes) { g.strokeStyle = kit.c2; g.lineWidth = lw(0.06); g.beginPath(); for (const t of [0.3, 0.7]) { g.moveTo(js[21] + (js[24] - js[21]) * t, js[22] + (js[25] - js[22]) * t); g.lineTo(js[0] + (js[3] - js[0]) * t, js[1] + (js[4] - js[1]) * t); } g.stroke(); }
    // number on the back when the back faces the camera
    const backToCam = Gx * c.fx + Gy * c.fy > 0.2;
    if (backToCam && sc > 14) {
      g.fillStyle = kit.nu; g.font = `900 ${Math.round(0.24 * sc)}px Archivo, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(isGK ? 1 : [1, 2, 4, 5, 3, 7, 6, 8, 11, 9, 10][i % NT]), (js[18] + js[0] + js[3]) / 3, (js[19] + js[1] + js[4]) / 3 - 0.02 * sc);
    } else if (sc > 10) { g.strokeStyle = kit.c2; g.lineWidth = lw(0.035); g.beginPath(); g.moveTo(js[21], js[22]); g.lineTo(js[24], js[25]); g.stroke(); }
    if (leftFar) { leg(1, 3, 5); armD(8, 10, 12); } else { leg(0, 2, 4); armD(7, 9, 11); }
    // head
    const hr = Math.max(1.6, 0.115 * sc);
    g.fillStyle = skin; g.beginPath(); g.arc(js[39], js[40], hr, 0, 6.283); g.fill();
    g.fillStyle = hair; g.beginPath(); g.arc(js[39], js[40] - hr * 0.25, hr * 0.98, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    if (backToCam) { g.beginPath(); g.arc(js[39], js[40], hr, Math.PI * 0.9, Math.PI * 2.1); g.fill(); }
    void me;
  }
  shadows(s) {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,.26)';
    g.beginPath();
    for (let i = 0; i < NP; i++) {
      const x = s.p[i * ENT], y = s.p[i * ENT + 1];
      // two long floodlight shadows and a round one under the feet
      for (const [dx, dy, l] of [[0.75, 0.6, 1.6], [-0.75, 0.6, 1.6]]) {
        if (!this.cam.p(x, y, 0)) continue;
        const ax = SX, ay = SY; this.cam.p(x + dx * l, y + dy * l, 0); const bx = SX, by = SY;
        const w = Math.max(1, (this.cam.F / SZ) * 0.18);
        g.moveTo(ax - w, ay); g.lineTo(bx - w * 0.6, by); g.lineTo(bx + w * 0.6, by); g.lineTo(ax + w, ay); g.closePath();
      }
    }
    g.fill();
    g.fillStyle = 'rgba(0,0,0,.34)';
    for (let i = 0; i < NP; i++) {
      if (!this.cam.p(s.p[i * ENT], s.p[i * ENT + 1], 0)) continue;
      const r = (this.cam.F / SZ) * 0.36;
      g.beginPath(); g.ellipse(SX, SY, r, r * 0.38, 0, 0, 6.283); g.fill();
    }
  }
  ball(s, t) {
    const g = this.g, c = this.cam, x = s.b[0], y = s.b[1], z = s.b[2];
    if (c.p(x, y, 0)) {
      const r = (c.F / SZ) * 0.15;
      g.fillStyle = `rgba(0,0,0,${Math.max(0.12, 0.4 - z * 0.06)})`;
      g.beginPath(); g.ellipse(SX, SY, r * (1 + z * 0.05), r * 0.42, 0, 0, 6.283); g.fill();
    }
    if (!c.p(x, y, z + BR)) return;
    const r = Math.max(2, (c.F / SZ) * BR * 1.35), bx = SX, by = SY;
    // trail of a hard strike
    if (s.b[3] > 19 && s.b[4] < 0) {
      this.trail.push(bx, by); if (this.trail.length > 16) this.trail.splice(0, 2);
      g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = r * 1.4; g.lineCap = 'round'; g.beginPath();
      for (let k = 0; k < this.trail.length; k += 2) (k ? g.lineTo : g.moveTo).call(g, this.trail[k], this.trail[k + 1]); g.stroke();
    } else this.trail.length = 0;
    const gr = g.createRadialGradient(bx - r * 0.35, by - r * 0.35, r * 0.1, bx, by, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.75, '#e5e7eb'); gr.addColorStop(1, '#9ca3af');
    g.fillStyle = gr; g.beginPath(); g.arc(bx, by, r, 0, 6.283); g.fill();
    if (r > 3) { // patches turning with the roll
      const a = (this.roll || 0);
      g.fillStyle = '#1f2937';
      for (let k = 0; k < 3; k++) { const aa = a + k * 2.1, px = bx + Math.cos(aa) * r * 0.5, py = by + Math.sin(aa) * r * 0.42; if (Math.cos(aa * 0.7 + k) < -0.2) continue; g.beginPath(); g.arc(px, py, r * 0.28, 0, 6.283); g.fill(); }
    }
    void t;
  }
  goalParts(list) { // the goals as pieces, sorted with the players
    for (const s of [-1, 1]) {
      const gx = s * HL;
      list.push({ d: this.cam.depth(gx + s * GD, 0, 1), f: () => this.netBack(s) });
      for (const k of [-1, 1]) {
        list.push({ d: this.cam.depth(gx + s * GD * 0.5, k * GW, 1), f: () => this.netSide(s, k) });
        list.push({ d: this.cam.depth(gx, k * GW, 1.2), f: () => this.post(s, k) });
      }
      list.push({ d: this.cam.depth(gx, 0, GH), f: () => this.bar(s) });
      for (const k of [-1, 1]) list.push({ d: this.cam.depth(gx, k * HW, 0.8), f: () => this.flag(gx, k * HW, s) });
    }
  }
  netLines(pts, nu, nv, A, B, C, D, bulge) {
    const g = this.g;
    g.beginPath();
    for (let u = 0; u <= nu; u++) { const t = u / nu; this.seg(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, D[0] + (C[0] - D[0]) * t + (bulge ? bulge(t, 1) : 0), D[1] + (C[1] - D[1]) * t, D[2] + (C[2] - D[2]) * t); }
    for (let v = 0; v <= nv; v++) { const t = v / nv; this.seg(A[0] + (D[0] - A[0]) * t, A[1] + (D[1] - A[1]) * t, A[2] + (D[2] - A[2]) * t, B[0] + (C[0] - B[0]) * t, B[1] + (C[1] - B[1]) * t, B[2] + (C[2] - B[2]) * t); }
    g.stroke();
    void pts;
  }
  netBack(s) {
    const g = this.g, gx = s * HL, bx = gx + s * GD, push = this.netHit > 0 && Math.sign(this.netX) === s ? this.netHit * 0.6 : 0;
    g.strokeStyle = 'rgba(241,245,249,.32)'; g.lineWidth = 1;
    const A = [bx + s * push, -GW, 0], B = [bx + s * push, GW, 0], C = [gx + s * 0.6, GW, GH], D = [gx + s * 0.6, -GW, GH];
    this.netLines(null, 24, 9, A, B, C, D);
    g.strokeStyle = 'rgba(248,250,252,.75)'; g.lineWidth = 1.4; g.beginPath(); this.seg(bx, -GW, 0, bx, GW, 0); this.seg(gx + s * 0.6, -GW, GH, bx, -GW, 0); this.seg(gx + s * 0.6, GW, GH, bx, GW, 0); g.stroke();
  }
  netSide(s, k) {
    const g = this.g, gx = s * HL, bx = gx + s * GD;
    g.strokeStyle = 'rgba(241,245,249,.26)'; g.lineWidth = 1;
    this.netLines(null, 7, 8, [gx, k * GW, 0], [bx, k * GW, 0], [gx + s * 0.6, k * GW, GH], [gx, k * GW, GH]);
  }
  post(s, k) {
    const g = this.g, c = this.cam, gx = s * HL;
    if (!c.p(gx, k * GW, 0)) return; const ax = SX, ay = SY, w = Math.max(2, (c.F / SZ) * 0.12);
    if (!c.p(gx, k * GW, GH)) return;
    g.strokeStyle = '#f8fafc'; g.lineWidth = w; g.lineCap = 'butt'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(SX, SY); g.stroke();
  }
  bar(s) {
    const g = this.g, c = this.cam, gx = s * HL;
    if (!c.p(gx, -GW, GH)) return; const ax = SX, ay = SY, w = Math.max(2, (c.F / SZ) * 0.12);
    if (!c.p(gx, GW, GH)) return;
    g.strokeStyle = '#f8fafc'; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(SX, SY); g.stroke();
  }
  flag(x, y, s) {
    const g = this.g, c = this.cam;
    if (!c.p(x, y, 0)) return; const ax = SX, ay = SY, sc = c.F / SZ;
    if (!c.p(x, y, 1.5)) return;
    g.strokeStyle = '#e5e7eb'; g.lineWidth = Math.max(1, sc * 0.04); g.beginPath(); g.moveTo(ax, ay); g.lineTo(SX, SY); g.stroke();
    g.fillStyle = '#facc15'; g.beginPath(); g.moveTo(SX, SY); c.p(x - s * 0.5, y, 1.35); g.lineTo(SX, SY); c.p(x, y, 1.2); g.lineTo(SX, SY); g.fill();
  }
  marker(i, s, col, label, power) { // ring under the controlled player and an arrow over his head
    const g = this.g, c = this.cam, x = s.p[i * ENT], y = s.p[i * ENT + 1];
    if (!c.p(x, y, 0)) return;
    const r = (c.F / SZ) * 0.62, cx = SX, cy = SY;
    g.strokeStyle = col; g.lineWidth = Math.max(1.5, r * 0.14); g.globalAlpha = 0.9;
    g.beginPath(); g.ellipse(cx, cy, r, r * 0.4, 0, 0, 6.283); g.stroke(); g.globalAlpha = 1;
    if (!c.p(x, y, 2.25)) return;
    const a = Math.max(5, (c.F / SZ) * 0.22);
    g.fillStyle = col; g.beginPath(); g.moveTo(SX - a, SY - a * 1.2); g.lineTo(SX + a, SY - a * 1.2); g.lineTo(SX, SY); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.stroke();
    if (label) { g.font = `800 ${Math.round(Math.max(10, a * 1.3))}px Archivo, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(label, SX, SY - a * 1.35); g.fillStyle = '#fff'; g.fillText(label, SX, SY - a * 1.35); }
    if (power > 0) { // charging bar
      const w = Math.max(34, a * 6), h = Math.max(5, a * 0.7), bx = SX - w / 2, by = SY - a * 1.35 - (label ? a * 1.6 : 0) - h - 4;
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(bx - 2, by - 2, w + 4, h + 4);
      g.fillStyle = power > 0.9 ? '#ef4444' : power > 0.65 ? '#facc15' : '#22c55e'; g.fillRect(bx, by, w * Math.min(1, power), h);
    }
  }
  aimArrow(s, i, fx, fy) {
    const g = this.g, c = this.cam, x = s.b[0], y = s.b[1];
    if (!c.p(x, y, 0.02)) return; const ax = SX, ay = SY;
    if (!c.p(x + fx * 6, y + fy * 6, 0.02)) return;
    g.strokeStyle = 'rgba(253,224,71,.85)'; g.lineWidth = 3; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(ax, ay); g.lineTo(SX, SY); g.stroke(); g.setLineDash([]);
    void i;
  }
  particles(dt) {
    const g = this.g;
    for (let k = this.parts.length - 1; k >= 0; k--) {
      const q = this.parts[k];
      q.t -= dt; if (q.t <= 0) { this.parts.splice(k, 1); continue; }
      q.vz -= 9 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z = Math.max(0, q.z + q.vz * dt);
      if (!this.cam.p(q.x, q.y, q.z)) continue;
      g.fillStyle = q.c; g.globalAlpha = Math.min(1, q.t * 2);
      const r = Math.max(1, (this.cam.F / SZ) * q.r); g.fillRect(SX - r / 2, SY - r / 2, r, r);
    }
    g.globalAlpha = 1;
  }
  burst(x, y, n, col, sp, up, size) { for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, v = sp * (0.3 + Math.random()); this.parts.push({ x, y, z: 0.1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: up * (0.5 + Math.random()), t: 0.5 + Math.random() * 0.6, c: col, r: size }); } }
  radar(s, me, myDir, kits) {
    const g = this.g, W = this.W, H = this.H, portrait = this.mode === 'back';
    const rw = portrait ? Math.min(70, W * 0.18) : Math.min(132, W * 0.15), rh = portrait ? rw * 1.5 : rw * 0.64;
    const x0 = portrait ? W - rw - 10 : (W - rw) / 2, y0 = portrait ? 64 : H - rh - 8;
    g.fillStyle = 'rgba(2,6,23,.55)'; g.fillRect(x0 - 3, y0 - 3, rw + 6, rh + 6);
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1; g.strokeRect(x0, y0, rw, rh);
    const map = (x, y) => (portrait ? [x0 + rw / 2 - (y / HW) * (rw / 2) * myDir, y0 + rh / 2 - (x / HL) * (rh / 2) * myDir] : [x0 + rw / 2 + (x / HL) * (rw / 2) * myDir, y0 + rh / 2 - (y / HW) * (rh / 2) * myDir]);
    g.beginPath(); if (portrait) { g.moveTo(x0, y0 + rh / 2); g.lineTo(x0 + rw, y0 + rh / 2); } else { g.moveTo(x0 + rw / 2, y0); g.lineTo(x0 + rw / 2, y0 + rh); } g.stroke();
    for (let i = 0; i < NP; i++) {
      const [px, py] = map(s.p[i * ENT], s.p[i * ENT + 1]), t = teamOf(i);
      g.fillStyle = i % NT === 0 ? kits.gk[t].c : kits.kit[t].c;
      g.beginPath(); g.arc(px, py, i === s.ct[me] ? 3.4 : 2.4, 0, 6.283); g.fill();
      if (i === s.ct[me]) { g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke(); }
      else if (kits.kit[t].c === '#f8fafc' || kits.kit[t].c === '#f1f5f9') { g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 0.8; g.stroke(); }
    }
    const [bx, by] = map(s.b[0], s.b[1]);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 2, 0, 6.283); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 0.8; g.stroke();
  }
  // one picture: s = the snapshot, ui = { me, myDir, kits, t, dt, replay, aim, power, oppMark }
  draw(s, ui) {
    const g = this.g, W = this.W, H = this.H;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.camera(s.b[0], s.b[1], 0, 0, ui.myDir, ui.dt, ui.replay);
    this.roll = (this.roll || 0) + s.b[3] * ui.dt * 1.4;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - ui.dt * 1.8);
    if (this.jump > 0) this.jump -= ui.dt;
    if (this.netHit > 0) this.netHit = Math.max(0, this.netHit - ui.dt * 0.9);
    this.stadium(ui.t);
    this.boardsDraw(ui.t);
    this.pitch();
    this.shadows(s);
    if (ui.aim) this.aimArrow(s, ui.aim.i, ui.aim.fx, ui.aim.fy);
    // markers on the ground go under the players
    const items = this.items; items.length = 0;
    for (let i = 0; i < NP; i++) items.push({ d: this.cam.depth(s.p[i * ENT], s.p[i * ENT + 1], 1), i });
    items.push({ d: this.cam.depth(s.b[0], s.b[1], s.b[2]) - 0.05, ball: 1 });
    this.goalParts(items);
    items.sort((a, b) => b.d - a.d);
    if (ui.mark >= 0) this.ring(ui.mark, s, ui.markCol);
    if (ui.oppMark >= 0) this.ring(ui.oppMark, s, ui.oppCol);
    for (const it of items) {
      if (it.f) it.f();
      else if (it.ball) this.ball(s, ui.t);
      else { const t = teamOf(it.i); this.player(it.i, s, it.i % NT === 0 ? ui.kits.gk[t] : ui.kits.kit[t], ui.me); }
    }
    this.particles(ui.dt);
    if (ui.mark >= 0) this.marker(ui.mark, s, ui.markCol, ui.markLabel, ui.power);
    if (ui.oppMark >= 0) this.marker(ui.oppMark, s, ui.oppCol, '', 0);
    // light: a soft vignette, a flash on goals
    const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.42)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${this.flash * 0.5})`; g.fillRect(0, 0, W, H); this.flash = Math.max(0, this.flash - ui.dt * 2.5); }
    if (ui.replay) { g.fillStyle = 'rgba(0,0,0,.85)'; const bh = H * 0.07; g.fillRect(0, 0, W, bh); g.fillRect(0, H - bh, W, bh); }
    else if (ui.radar !== false) this.radar(s, ui.me, ui.myDir, ui.kits);
  }
  ring(i, s, col) {
    const g = this.g, c = this.cam;
    if (!c.p(s.p[i * ENT], s.p[i * ENT + 1], 0)) return;
    const r = (c.F / SZ) * 0.62;
    g.fillStyle = col; g.globalAlpha = 0.22; g.beginPath(); g.ellipse(SX, SY, r, r * 0.4, 0, 0, 6.283); g.fill(); g.globalAlpha = 1;
  }
}

/* ---------- les sons du stade (tout est fabriqué, pas de fichier) ---------- */
class Crowd {
  constructor() { this.on = false; this.ex = 0; this.nodes = null; }
  ac() { try { return __mods['audio.js'].audioContext(); } catch { return null; } }
  muted() { try { return __mods['audio.js'].isMuted(); } catch { return false; } }
  noiseBuf(c, sec, brown) {
    const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = brown ? (last + 0.02 * w) / 1.02 : w; d[i] = brown ? last * 3.5 : w; } }
    return b;
  }
  start() {
    const c = this.ac();
    if (!c || this.on) return;
    this.on = true;
    if (!this.buf) { this.buf = this.noiseBuf(c, 3, true); this.wbuf = this.noiseBuf(c, 1, false); }
    const src = c.createBufferSource(); src.buffer = this.buf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 520; lp.Q.value = 0.6;
    const gain = c.createGain(); gain.gain.value = 0;
    const out = c.createGain(); out.gain.value = 0.9;
    src.connect(lp).connect(gain).connect(out).connect(c.destination);
    src.start();
    this.nodes = { src, lp, gain, out };
    this.level(0.25);
  }
  stop() { if (!this.nodes) return; try { this.nodes.src.stop(); } catch { /* ignore */ } this.nodes = null; this.on = false; }
  level(x) { // 0 calm … 1 roaring
    if (!this.nodes) return;
    const c = this.ac(), v = this.muted() ? 0 : 0.05 + x * 0.32;
    this.nodes.gain.gain.setTargetAtTime(v, c.currentTime, 0.4);
    this.nodes.lp.frequency.setTargetAtTime(420 + x * 700, c.currentTime, 0.5);
  }
  burst(dur, vol, f0, f1, q, hp) { // a swell of noise (ooh, roar, net)
    const c = this.ac(); if (!c || this.muted()) return;
    if (!this.wbuf) this.wbuf = this.noiseBuf(c, 1, false);
    const t = c.currentTime, src = c.createBufferSource(); src.buffer = dur > 1 ? this.buf || this.wbuf : this.wbuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = hp ? 'highpass' : 'bandpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 0.7;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.25, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination); src.start(t); src.stop(t + dur + 0.05);
  }
  tone(freq, dur, type, vol, slide, when = 0) {
    const c = this.ac(); if (!c || this.muted()) return;
    const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  whistle(n = 1, long = 0.28) {
    const c = this.ac(); if (!c || this.muted()) return;
    for (let k = 0; k < n; k++) {
      const t = c.currentTime + k * (long + 0.12), o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = 2950; lfo.frequency.value = 34; lg.gain.value = 90; lfo.connect(lg).connect(o.frequency);
      const d = k === n - 1 ? long * (n > 1 ? 2.2 : 1) : long;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); g.gain.setValueAtTime(0.16, t + d - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(c.destination); o.start(t); lfo.start(t); o.stop(t + d + 0.02); lfo.stop(t + d + 0.02);
    }
  }
  kick(p) { this.tone(150, 0.09, 'sine', 0.35 * p + 0.12, 55); this.burst(0.06, 0.12 * p + 0.04, 1800, 900, 0.8); }
  bounce() { this.tone(110, 0.06, 'sine', 0.12, 70); }
  post() { this.tone(980, 0.5, 'triangle', 0.18); this.tone(1420, 0.4, 'sine', 0.1); this.burst(1.6, 0.3, 300, 900, 0.6); }
  net() { this.burst(0.45, 0.25, 2500, 6000, 0.5, true); }
  ooh() { this.burst(1.4, 0.35, 380, 260, 1.2); }
  roar() { this.burst(4.2, 0.55, 300, 1400, 0.5); this.burst(3, 0.25, 900, 2400, 0.8); }
}

/* ---------- les commandes : stick + boutons tactiles, clavier, manette ---------- */
const KEYS = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', KeyW: 'u', KeyS: 'd', KeyA: 'l', KeyD: 'r', KeyK: 'p', KeyX: 'p', KeyL: 's', KeyC: 's', Space: 's', KeyJ: 't', KeyV: 't', ShiftLeft: 'R', ShiftRight: 'R' };
class Pad {
  constructor(el) {
    this.el = el; this.keys = {}; this.btn = { p: 0, s: 0, t: 0, r: 0 }; this.latch = { p: 0, s: 0, t: 0, r: 0 };
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
    if (m > R * 1.6) { // the base follows a finger that goes too far
      const k = (m - R * 1.6) / m; this.stick.ox += dx * k; this.stick.oy += dy * k;
      const r = this.el.getBoundingClientRect(); if (this.base) { this.base.style.left = `${this.stick.ox - r.left}px`; this.base.style.top = `${this.stick.oy - r.top}px`; }
      dx = e.clientX - this.stick.ox; dy = e.clientY - this.stick.oy;
    }
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
    const k = KEYS[e.code];
    if (!k || e.target.closest?.('input, textarea')) return;
    e.preventDefault();
    if (v && !this.keys[k] && 'pstR'.includes(k)) { const b = k === 'R' ? 'r' : k; this.latch[b] = 1; }
    this.keys[k] = v;
  }
  vibe(ms) { try { if (localStorage.getItem('spinbet_vibe') !== '0') navigator.vibrate?.(ms); } catch { /* ignore */ } }
  // the stick (screen: x right, y up, −100…100) and the buttons, for this frame
  read() {
    let x = this.stick.x, y = this.stick.y;
    const kx = (this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0), ky = (this.keys.u ? 1 : 0) - (this.keys.d ? 1 : 0);
    if (kx || ky) { const m = Math.hypot(kx, ky); x = kx / m; y = ky / m; }
    let b = 0;
    const held = (k, kk) => this.btn[k] || this.keys[kk] || this.latch[k];
    if (held('p', 'p')) b |= IN_P; if (held('s', 's')) b |= IN_S; if (held('t', 't')) b |= IN_T; if (held('r', 'R')) b |= IN_R;
    // a gamepad
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g && g.connected) : null;
    if (gp) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.2) { x = ax; y = -ay; }
      const bt = (n) => gp.buttons[n]?.pressed;
      if (bt(14)) x = -1; if (bt(15)) x = 1; if (bt(12)) y = 1; if (bt(13)) y = -1;
      if (bt(0)) b |= IN_P; if (bt(1)) b |= IN_S; if (bt(2)) b |= IN_T; if (bt(5) || bt(7) || bt(6)) b |= IN_R;
    }
    this.latch.p = this.latch.s = this.latch.t = this.latch.r = 0; // a tap shorter than a frame still counts once
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    return { x: x * 100, y: y * 100, b };
  }
  labels(ctx) { // what the buttons do right now
    const L = ctx === 'att' ? ['PASSE', 'TIR', 'DRIBBLE'] : ctx === 'def' ? ['CHANGER', 'PRESSING', 'TACLE'] : ctx === 'set' ? ['PASSE', 'TIR', '—'] : ['PASSE', 'TIR', 'TACLE'];
    const set = (k, t) => { const b = this.el.querySelector(`[data-b="${k}"] span`); if (b && b.textContent !== t) b.textContent = t; };
    set('p', L[0]); set('s', L[1]); set('t', L[2]);
  }
}

/* ---------- un match à l'écran (entraînement ou en ligne) ---------- */
const NUM = [1, 2, 4, 5, 3, 7, 6, 8, 11, 9, 10];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const abbr = (n) => (String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'EQU').slice(0, 3).padEnd(3, 'X');
const minute = (S) => { const d = S[G.DUR] || 1, t = S[G.TIME], h = S[G.HALF]; if (t > d) return `${h === 2 ? 90 : 45}+${Math.min(9, Math.ceil(((t - d) / d) * 45))}'`; return `${Math.min(45, Math.floor((t / d) * 45)) + (h === 2 ? 45 : 0) + (t > 0 ? 1 : 0)}'`; };
const PADHTML = `<div class="fo-pad"><div class="fo-stick"><i></i></div>
  <div class="fo-btns"><button type="button" class="fo-b sp" data-b="r"><span>SPRINT</span></button><button type="button" class="fo-b tk" data-b="t"><span>TACLE</span></button><button type="button" class="fo-b ps" data-b="p"><span>PASSE</span></button><button type="button" class="fo-b sh" data-b="s"><span>TIR</span></button></div></div>`;

class Match {
  // o: { online, me, seed, dur (frames per half), kitIds [a, b], names [a, b], lvl, delay, net, onEnd(result) }
  constructor(host, o) {
    this.o = o; this.me = o.online ? o.me : 0; this.host = host;
    this.kits = kitsFor(o.kitIds[0], o.kitIds[1]);
    host.insertAdjacentHTML('beforeend', `<div class="fo-match">
      <canvas class="fo-cv"></canvas>
      <div class="fo-top">
        <div class="fo-score"><i style="background:${this.kits.kit[0].c}"></i><b class="n0">${esc(abbr(o.names[0]))}</b><span class="sc">0 - 0</span><b class="n1">${esc(abbr(o.names[1]))}</b><i style="background:${this.kits.kit[1].c}"></i><em class="clk">0'</em></div>
        <div class="fo-net" hidden><i></i><span></span></div>
        <button type="button" class="fo-menu" aria-label="Menu">☰</button>
      </div>
      <div class="fo-banner"></div>
      <div class="fo-hint" hidden></div>
      ${PADHTML}
      <div class="fo-keys" hidden>⌨️ <b>Flèches / ZQSD</b> courir · <b>K</b> passe (tenir : en l'air) · <b>L</b> ou <b>Espace</b> tir (tenir : puissance) · <b>J</b> tacle / dribble · <b>Maj</b> sprint</div>
      <div class="fo-over" hidden></div>
    </div>`);
    this.el = host.lastElementChild;
    this.cv = this.el.querySelector('.fo-cv');
    this.painter = new Painter(this.cv); this.painter.setTeams(this.kits);
    this.pad = new Pad(this.el); this.crowd = new Crowd(); this.hist = new History();
    this.snap = new Snap(); this.rsnap = new Snap();
    this.P = new Float64Array(SLEN); this.seen = 0; this.evKeys = new Set(); this.hud = {}; this.t = 0;
    if (!this.pad.touch) { this.el.classList.add('kb'); this.el.querySelector('.fo-keys').hidden = false; setTimeout(() => { const k = this.el.querySelector('.fo-keys'); if (k) k.hidden = true; }, 9000); }
    if (o.online) {
      this.rb = new Rollback({ me: o.me, delay: o.delay, seed: o.seed, dur: o.dur, ail: [1, 1], onFrame: (S) => this.hist.save(S) });
      this.S = this.rb.S;
      // a correction moves people a little: the picture glides to the right place instead of jumping
      this.off = new Float32Array(NP * 2 + 2);
      this.rb.onCorrect = (a, b) => {
        for (let i = 0; i < NP; i++) { const q = pOf(i); this.off[i * 2] += a[q + PX] - b[q + PX]; this.off[i * 2 + 1] += a[q + PY] - b[q + PY]; }
        if (a[BB + BOWN] === b[BB + BOWN]) { this.off[NP * 2] += a[BB + BX] - b[BB + BX]; this.off[NP * 2 + 1] += a[BB + BY] - b[BB + BY]; }
      };
      this.el.querySelector('.fo-net').hidden = false;
    } else {
      this.S = newMatch({ seed: o.seed, dur: o.dur, hum: [1, 0], ail: [1, o.lvl ?? 1] });
    }
    this.hist.save(this.S);
    this.el.querySelector('.fo-menu').onclick = () => this.menu();
    this.onResize = () => this.painter.resize();
    addEventListener('resize', this.onResize);
    this.painter.resize();
    this.crowd.start();
    this.last = performance.now(); this.acc = 0;
    this.raf = requestAnimationFrame((t) => this.tick(t));
    this.banner('COUP D’ENVOI', `${esc(o.names[0])} contre ${esc(o.names[1])}${innerHeight > innerWidth ? ' · tourne ton téléphone pour voir plus de terrain' : ''}`, 'ko');
  }
  destroy() {
    this.dead = true; cancelAnimationFrame(this.raf); removeEventListener('resize', this.onResize);
    this.pad.destroy(); this.crowd.stop(); this.el.remove();
  }
  // the stick turned into the pitch's directions (as seen by this player's camera)
  sample() {
    const r = this.pad.read(), c = this.painter.cam, hl = Math.hypot(c.fx, c.fy) || 1;
    const wx = r.x * c.rx + r.y * (c.fx / hl), wy = r.x * c.ry + r.y * (c.fy / hl);
    return encIn(wx, wy, r.b | IN_ON);
  }
  myDir() { return dirOf(this.S, this.me); }
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
          this.P.set(this.S); this.rb.step();
          this.o.net?.sendInputs(this.rb);
        } else { this.P.set(this.S); step(this.S, v, 0); this.hist.save(this.S); }
        this.acc -= DT; n++;
        this.events();
      }
      if (n >= 5) this.acc = 0;
    }
    this.render(dt);
    this.paintHud();
    if (!this.over && this.S[G.PHASE] === PH.END && (!this.rb || this.rb.confirmed >= this.S[G.FRAME])) this.finish();
    // after the whistle, our last commands are sent again for a while: the other phone needs them to finish too
    if (this.over && this.rb && this.o.net && this.t - (this.overT ??= this.t) < 8 && (this.resend = (this.resend || 0) + 1) % 6 === 0) this.o.net.sendInputs(this.rb);
    if (this.rb && this.S[G.PHASE] === PH.PLAY && (this.saveT = (this.saveT || 0) + 1) % 120 === 0) {
      const c = Math.min(this.rb.confirmed, this.rb.frame - 1), st = this.rb.ring[c % RB_SLOTS];
      if (st[G.FRAME] === c) try { localStorage.setItem('spinbet_foot_live', JSON.stringify({ id: this.o.id, a: st[G.SC0], b: st[G.SC1] })); } catch { /* ignore */ }
    }
  }
  render(dt) {
    const S = this.S, ph = S[G.PHASE], pt = S[G.PT];
    let snap, replay = false;
    if (ph === PH.GOAL && pt >= CELEB_F) {
      const f = S[G.GOALF] - REPLAY_BACK + Math.floor((pt - CELEB_F) * 0.5);
      snap = this.hist.get(f, this.rsnap);
      replay = !!snap;
    }
    if (!snap) {
      snap = this.snap.fromState(S, this.P, this.acc / DT);
      if (this.off) {
        const k = Math.pow(0.82, dt * 60);
        for (let i = 0; i < NP; i++) {
          const ox = this.off[i * 2], oy = this.off[i * 2 + 1];
          if (Math.abs(ox) + Math.abs(oy) > 4) { this.off[i * 2] = 0; this.off[i * 2 + 1] = 0; continue; } // a real jump (set piece): no gliding
          snap.p[i * ENT] += ox; snap.p[i * ENT + 1] += oy; this.off[i * 2] = ox * k; this.off[i * 2 + 1] = oy * k;
        }
        const bx2 = this.off[NP * 2], by2 = this.off[NP * 2 + 1];
        if (Math.abs(bx2) + Math.abs(by2) < 4) { snap.b[0] += bx2; snap.b[1] += by2; this.off[NP * 2] = bx2 * k; this.off[NP * 2 + 1] = by2 * k; } else { this.off[NP * 2] = 0; this.off[NP * 2 + 1] = 0; }
      }
    }
    const me = this.me, ct = snap.ct[me], own = S[BB + BOWN];
    const ui = { me, myDir: this.myDir(), kits: this.kits, t: this.t, dt, replay, mark: -1, oppMark: -1 };
    if (!replay && ph !== PH.GOAL && ph !== PH.HALF && ph !== PH.END) {
      ui.mark = ct; ui.markCol = '#facc15'; ui.markLabel = ct >= 0 ? String(NUM[ct % NT]) : '';
      const hp = S[G.HP0 + me], hs = S[G.HS0 + me];
      ui.power = hs > 2 ? Math.min(1.05, 0.28 + hs / 52) : hp > 14 ? Math.min(1, hp / 40) : 0;
      if (this.o.online) { ui.oppMark = snap.ct[1 - me]; ui.oppCol = '#f472b6'; }
      if (ph === PH.SET && S[G.TAKER] === ct) { const q = pOf(ct); ui.aim = { i: ct, fx: S[q + PFX], fy: S[q + PFY] }; }
    }
    this.painter.draw(snap, ui);
    // what the buttons do now
    const ctx = ph === PH.SET ? 'set' : own >= 0 && own === ct ? 'att' : own >= 0 && teamOf(own) !== me ? 'def' : 'free';
    if (ctx !== this.ctx) { this.ctx = ctx; this.pad.labels(ctx); this.el.dataset.ctx = ctx; }
    // set pieces: what to do, when it is my kick
    const hint = ph === PH.SET && S[G.TAKER] === ct && teamOf(ct) === me && S[G.PT] > 30 ? ({ [SP.THROW]: 'Touche : vise avec le stick, PASSE pour lancer', [SP.CORNER]: 'Corner : TIR pour centrer, PASSE pour jouer court', [SP.GOALKICK]: 'Six mètres : PASSE courte, TIR pour dégager loin', [SP.FREE]: 'Coup franc : vise avec le stick, TIR (tenir = plus fort) ou PASSE', [SP.PEN]: 'Penalty : vise un côté avec le stick, puis TIR' })[S[G.SPK]] : '';
    if (hint !== this.hint) { this.hint = hint; const h = this.el.querySelector('.fo-hint'); h.textContent = hint; h.hidden = !hint; }
    // a slow phone: a lighter picture
    this.ft = (this.ft || 16) * 0.97 + Math.min(100, dt * 1000) * 0.03;
    if (this.ft > 24 && this.t > 5 && !this.lowQ) { this.lowQ = true; this.painter.maxDpr = 1.25; this.painter.resize(); }
    // the crowd follows the danger
    const bx = S[BB + BX], danger = Math.max(0, 1 - (HL - Math.abs(bx)) / 30);
    if (!this.lastLvl || Math.abs(this.lastLvl - danger) > 0.08) { this.lastLvl = danger; this.crowd.level(ph === PH.GOAL ? 1 : 0.2 + danger * 0.6); }
  }
  paintHud() {
    const S = this.S, h = this.hud;
    const sc = `${S[G.SC0]} - ${S[G.SC1]}`, clk = minute(S);
    if (h.sc !== sc) { h.sc = sc; this.el.querySelector('.fo-score .sc').textContent = sc; }
    if (h.clk !== clk) { h.clk = clk; this.el.querySelector('.fo-score .clk').textContent = clk; }
    if (this.o.net) {
      const q = this.o.net, bad = this.stall > 0.5 || q.silent > 2500;
      const txt = bad ? 'Connexion lente…' : `${Math.round(q.rtt || 0)} ms`;
      if (h.net !== txt) { h.net = txt; const n = this.el.querySelector('.fo-net'); n.querySelector('span').textContent = txt; n.classList.toggle('bad', bad); }
    }
  }
  banner(title, sub, cls) {
    const b = this.el.querySelector('.fo-banner');
    b.className = `fo-banner show ${cls || ''}`;
    b.innerHTML = `<b>${title}</b>${sub ? `<small>${sub}</small>` : ''}`;
    clearTimeout(this.bt); this.bt = setTimeout(() => { b.className = 'fo-banner'; }, cls === 'goal' ? 3400 : 1900);
  }
  // sounds, banners and effects of what just happened (once each, even when frames are played again)
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
    const c = this.crowd, P = this.painter, nm = (t) => esc(this.o.names[t]);
    const teamName = (i) => nm(teamOf(i));
    switch (code) {
      case EV.KICK: c.kick(Math.min(1, Math.hypot(S[BB + BVX], S[BB + BVY]) / 28)); P.burst(S[BB + BX], S[BB + BY], 4, '#4ade80', 2, 1.5, 0.05); break;
      case EV.BOUNCE: c.bounce(); break;
      case EV.POST: case EV.BAR: c.post(); this.banner(code === EV.POST ? 'POTEAU !' : 'TRANSVERSALE !', '', 'mini'); P.shake = 0.4; break;
      case EV.SAVE: c.ooh(); this.banner('QUEL ARRÊT !', `le gardien de ${teamName(a)} sauve`, 'mini'); this.pad.vibe(20); break;
      case EV.CATCH: if (S[G.ST0] + S[G.ST1] > 0) c.ooh(); this.banner('ARRÊT DU GARDIEN', '', 'mini'); break;
      case EV.MISS: c.ooh(); this.banner('À CÔTÉ !', '', 'mini'); break;
      case EV.TACKLE: c.kick(0.4); if (teamOf(a) === this.me) this.pad.vibe(15); break;
      case EV.FOUL: c.whistle(1, 0.35); this.banner('FAUTE !', '', 'mini'); break;
      case EV.PEN: c.whistle(2, 0.25); this.banner('PENALTY !', `pour ${nm(teamOf(a))}`, 'big'); break;
      case EV.CORNER: this.banner('CORNER', nm(S[G.SPT]), 'mini'); break;
      case EV.THROW: this.banner('TOUCHE', nm(S[G.SPT]), 'mini'); break;
      case EV.GKICK: this.banner('SIX MÈTRES', nm(S[G.SPT]), 'mini'); break;
      case EV.FREE: this.banner('COUP FRANC', nm(S[G.SPT]), 'mini'); break;
      case EV.WHISTLE: c.whistle(1, 0.3); break;
      case EV.GOAL: {
        const t = S[G.GOALT], og = S[G.GOALO], p = S[G.GOALP];
        c.roar(); c.net(); c.whistle(1, 0.2);
        P.flash = 1; P.shake = 1; P.jump = 6; P.netHit = 1; P.netX = S[BB + BX];
        P.burst(S[BB + BX], S[BB + BY], 26, '#ffffff', 3, 4, 0.06);
        const who = og ? `contre son camp` : p >= 0 ? `n°${NUM[p % NT]} · ${nm(t)}` : nm(t);
        this.banner(t === this.me || !this.o.online && t === 0 ? 'BUUUT !' : 'BUT…', `${who} · ${S[G.SC0]} - ${S[G.SC1]}`, 'goal');
        this.pad.vibe(t === this.me ? [60, 40, 120] : 40);
        break;
      }
      case EV.HALF: c.whistle(2, 0.3); this.halfTime(); break;
      case EV.END: c.whistle(3, 0.3); break;
      default: break;
    }
  }
  stats(S) {
    const pf = S[G.PF0] + S[G.PF1] || 1, pos = Math.round((S[G.PF0] / pf) * 100);
    const row = (l, a, b) => `<div class="fo-st"><b>${a}</b><span>${l}</span><b>${b}</b></div>`;
    return `<div class="fo-stats">${row('Possession', `${pos} %`, `${100 - pos} %`)}${row('Tirs', S[G.ST0], S[G.ST1])}${row('Cadrés', S[G.OT0], S[G.OT1])}${row('Passes réussies', S[G.PC0], S[G.PC1])}${row('Corners', S[G.CO0], S[G.CO1])}${row('Fautes', S[G.FO0], S[G.FO1])}</div>`;
  }
  scoreLine(S) { return `<div class="fo-final"><span><i style="background:${this.kits.kit[0].c}"></i>${esc(this.o.names[0])}</span><b>${S[G.SC0]} - ${S[G.SC1]}</b><span>${esc(this.o.names[1])}<i style="background:${this.kits.kit[1].c}"></i></span></div>`; }
  halfTime() {
    const o = this.el.querySelector('.fo-over'), S = this.S;
    o.hidden = false; o.className = 'fo-over half';
    o.innerHTML = `<div class="fo-card"><small>MI-TEMPS</small>${this.scoreLine(S)}${this.stats(S)}<p class="muted">2e mi-temps dans quelques secondes · appuie sur un bouton pour y aller tout de suite${this.o.online ? ' (les deux joueurs)' : ''}.</p></div>`;
    clearTimeout(this.ht); this.ht = setTimeout(() => { if (this.S[G.PHASE] !== PH.HALF) o.hidden = true; else this.ht = setTimeout(() => this.halfDone(), 300); }, 1200);
  }
  halfDone() { const o = this.el.querySelector('.fo-over'); if (this.S[G.PHASE] === PH.HALF) { this.ht = setTimeout(() => this.halfDone(), 250); return; } if (o.classList.contains('half')) o.hidden = true; }
  finish() {
    this.over = true;
    const S = this.S, mine = this.me, a = S[G.SC0 + mine], b = S[G.SC0 + 1 - mine];
    this.crowd.level(a > b ? 1 : 0.4);
    this.o.onEnd?.({ sa: S[G.SC0], sb: S[G.SC1], res: a > b ? 'win' : a < b ? 'lose' : 'tie', stats: this.stats(S), line: this.scoreLine(S) }, this);
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
    const z = this.painter.zoom;
    o.innerHTML = `<div class="fo-card"><small>${this.o.online ? 'MATCH EN DIRECT' : 'PAUSE'}</small>${this.scoreLine(this.S)}
      <div class="fo-acts"><button type="button" class="btn primary" data-m="go">▶ ${this.o.online ? 'Revenir au match' : 'Reprendre'}</button>
      <button type="button" class="btn ghost" data-m="zoom">🎥 Caméra : ${z < 0.95 ? 'proche' : z > 1.05 ? 'large' : 'normale'}</button>
      <button type="button" class="btn ghost" data-m="snd">${__mods['audio.js'].isMuted() ? '🔇 Son coupé' : '🔊 Son'}</button>
      <button type="button" class="btn ghost danger" data-m="quit">${this.o.online ? '🏳️ Abandonner (défaite)' : '🚪 Quitter l’entraînement'}</button></div>
      <p class="muted small">Commandes : stick à gauche pour courir · PASSE (tenir : passe en l’air) · TIR (tenir : plus fort, le stick vise) · TACLE (avec le ballon : DRIBBLE) · SPRINT. En défense, PASSE change de joueur et TIR appelle un coéquipier au pressing.</p></div>`;
    o.onclick = (e) => {
      const m = e.target.closest('[data-m]')?.dataset.m;
      if (!m) return;
      if (m === 'go') { o.hidden = true; this.paused = false; this.last = performance.now(); }
      if (m === 'zoom') { this.painter.zoom = z < 0.95 ? 1 : z < 1.05 ? 1.22 : 0.84; try { localStorage.setItem('spinbet_foot_zoom', String(this.painter.zoom)); } catch { /* ignore */ } this.menu(); }
      if (m === 'snd') { const A = __mods['audio.js']; A.setMuted(!A.isMuted()); this.crowd.level(0.3); this.menu(); }
      if (m === 'quit') { if (this.o.online) { if (confirm('Abandonner le match ? Ton adversaire gagne la mise.')) { o.hidden = true; this.o.onQuit?.(); } } else { this.o.onQuit?.(); } }
    };
  }
}

/* ---------- la liaison entre les deux téléphones : WebRTC, préparée par Firestore (foot/{id}) ---------- */
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
const QS = new URLSearchParams(location.search), DBG_DUR = +QS.get('footdur') || 0, DBG_LAG = +QS.get('footlag') || 0;
// the engine's own fingerprint: two phones with different versions of the game cannot play together
const NETV = (() => { let h = 2166136261; const s = [newMatch, step, play, humans, pass, passTo, shoot, keeper, keeperTouch, teamAI, aiCarrier, aiMove, moveAll, integrate, freeBall, contacts, tackles, header, rules, goal, goalFrame, setPiece, setTargets, setFrame, autoSwitch].map(String).join('|'); for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); })();
class Link {
  // sig: { write(patch) → Promise, watch(cb(doc)) → stop }   host: true for the one who sent the challenge
  constructor(host, sig, hooks) {
    this.host = host; this.sig = sig; this.h = hooks; // hooks: { msg(m), open(), lost(), state(text) }
    this.gen = 0; this.ansGen = 0; this.pc = null; this.ug = null; this.rl = null; this.open = false;
    this.rtt = 0; this.lastIn = 0; this.tries = 0; this.dead = false;
  }
  get silent() { return this.lastIn ? performance.now() - this.lastIn : 0; }
  start() { this.stop = this.sig.watch((d) => this.onDoc(d)); }
  close() {
    try { this.ug?.close(); this.rl?.close(); this.pc?.close(); } catch { /* ignore */ }
    this.pc = null; this.ug = null; this.rl = null; this.open = false;
  }
  destroy() { this.dead = true; clearTimeout(this.retry); clearInterval(this.pinger); this.stop?.(); this.close(); }
  onDoc(d) {
    if (this.dead || !d) return;
    this.doc = d;
    if (this.host) {
      const here = !!d.jb, ans = d.aw;
      if (here && !this.pc && !this.offering) this.offer(Math.max(this.gen, d.of?.g || 0) + 1);
      if (ans && ans.g === this.gen && this.pc && !this.answered) { this.answered = true; this.pc.setRemoteDescription({ type: 'answer', sdp: ans.sdp }).catch((e) => console.warn(e)); }
    } else if (d.of && d.of.g > this.ansGen && d.ja) {
      this.answer(d.of);
    }
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
    ch.binaryType = 'arraybuffer';
    ch.onopen = () => this.chOpen();
    ch.onmessage = (e) => {
      this.lastIn = performance.now();
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (DBG_LAG) { if (m.t === 'in' && Math.random() < 0.05) return; setTimeout(() => this.recv(m), DBG_LAG * (0.5 + Math.random())); return; } // test: a slow, lossy network
      this.recv(m);
    };
    ch.onclose = () => { if (ch === this.ug || ch === this.rl) this.lost(); };
  }
  chOpen() {
    if (this.open || !this.ug || !this.rl || this.ug.readyState !== 'open' || this.rl.readyState !== 'open') return;
    this.open = true; this.tries = 0; this.lastIn = performance.now();
    clearTimeout(this.retry);
    clearInterval(this.pinger);
    this.pinger = setInterval(() => this.sendR({ t: 'pi', k: performance.now() }), 700);
    this.h.state?.('connected');
    this.h.open?.();
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
    this.close();
    clearInterval(this.pinger);
    if (was) this.h.lost?.();
    // the host offers again (new connection), the guest waits for it
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
const DURS = [4, 6, 8], LVLS = ['Facile', 'Normal', 'Difficile'], STAKE_CHIPS = [0, 1000, 5000, 10000, 50000, 100000];
const durF = (min) => Math.round((min * 60 * FPS) / 2); // frames per half
const kitDots = (sel) => KITS.map((k, n) => `<button type="button" class="fo-kit${n === sel ? ' on' : ''}" data-kit="${n}" title="${k.n}" style="--a:${k.c};--b:${k.stripes ? k.c2 : k.sh}"><i></i></button>`).join('');
const HELP = `<div class="fo-help-grid">
    <div><b>📱 Téléphone</b><p>Pose le pouce n’importe où à gauche : le <b>stick</b> apparaît, ton joueur court. À droite : <b>PASSE</b> (tenir = passe en l’air ou centre), <b>TIR</b> (tenir = plus fort, le stick vise un côté du but), <b>TACLE</b> (près du ballon : tacle debout, de loin : tacle glissé ; avec le ballon : <b>DRIBBLE</b>), <b>SPRINT</b> (tenir).</p></div>
    <div><b>💻 Ordinateur</b><p><b>Flèches</b> ou <b>ZQSD</b> pour courir, <b>K</b> passe, <b>L</b> ou <b>Espace</b> tir, <b>J</b> tacle / dribble, <b>Maj</b> sprint. Une <b>manette</b> marche aussi (A passe, B tir, X tacle, gâchette sprint).</p></div>
    <div><b>🛡️ En défense</b><p><b>PASSE</b> devient <b>CHANGER</b> (le joueur le plus proche du ballon), <b>TIR</b> devient <b>PRESSING</b> (un coéquipier presse avec toi). Un tacle glissé par derrière = faute, dans ta surface = penalty !</p></div>
  </div>`;

const resKey = (r) => `${r.a ?? ''}-${r.b ?? ''}-${r.f || ''}-${r.v ? 1 : 0}`;
class FootGame {
  constructor(root, game) {
    this.root = root; this.game = game;
    this.FD = __mods['foot-defis.js'];
    this.music = new Music(EXTRA_THEMES.foot || EXTRA_THEMES.penalty);
    this.kit = Math.max(0, Math.min(KITS.length - 1, +LS.get('spinbet_foot_kit', 0) || 0));
    this.dur = +LS.get('spinbet_foot_dur', 6) || 6; this.lvl = +LS.get('spinbet_foot_lvl', 1);
    root.innerHTML = '<div class="derby"><div class="fo-lobby"></div></div>';
    this.box = root.querySelector('.derby'); this.lob = root.querySelector('.fo-lobby');
    this.lobby();
    this.autoIn = new Set();
    this.off = this.FD?.on?.(() => { if (this.dead) return; if (this.room && !this.match) this.roomPaint(); else if (this.match?.over) this.lateResult(); else if (!this.match) this.refresh(); });
    const j = this.FD?.takeJoin?.();
    if (j) setTimeout(() => this.enterRoom(j), 50);
    this.onUnload = (e) => { if (this.match && this.online && !this.match.over) { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('beforeunload', this.onUnload);
    // the friends list arrives a few seconds after the page (Firestore), and friends come online or leave:
    // the lobby follows (before, it stayed on « Ajoute d'abord tes amis »)
    const idle = () => { if (!this.dead && !this.match && !this.room) this.refresh(); };
    const FB = __mods['friends.js']?.bus;
    FB?.addEventListener('change', idle);
    this.offFr = () => FB?.removeEventListener('change', idle);
    this.frT = setInterval(idle, 10000);
  }
  destroy() {
    this.dead = true;
    if (this.match && this.online && !this.match.over) this.forfeit(true);
    this.leaveRoom(); this.endMatch();
    this.off?.(); this.offFr?.(); clearInterval(this.frT); this.music.stop();
    removeEventListener('beforeunload', this.onUnload);
  }
  me() { return this.FD?.me?.() || null; }

  /* ----- le vestiaire ----- */
  lobby(soft) {
    if (this.dead) return;
    const keep = soft && this.lob.querySelector('.fo-defy');
    const me = this.me(), fr = this.FD?.friends?.() || [], list = this.FD?.list?.() || [];
    const stakeVal = keep ? this.lob.querySelector('[name=stake]')?.value : LS.get('spinbet_foot_stake', '1000');
    const pick = keep ? this.lob.querySelector('[name=fr]:checked')?.value : null;
    this.meKey = me?.uid || '';
    this.frSig = fr.map((f) => f.uid + (f.on ? 1 : 0)).join();
    this.lob.innerHTML = `
      <section class="fo-hero">
        <div class="fo-hero-art" aria-hidden="true"><i class="b1"></i><i class="b2"></i><span>⚽</span></div>
        <div><small>⚽ LE DERBY · 11 CONTRE 11 EN DIRECT</small><h2>Le match de foot entre amis</h2>
        <p>Défie un ami, misez chacun la même somme : <b>le gagnant rafle la cagnotte</b>, match nul = <b>chacun récupère sa mise</b>.</p></div>
      </section>
      <div class="fo-grid">
        <section class="fo-panel fo-defy"><h3>⚔️ Défier un ami</h3>${this.defyHTML(me, fr, stakeVal, pick)}</section>
        <section class="fo-panel fo-mine"><h3>📨 Mes défis</h3>${this.listHTML(me, list)}</section>
        <section class="fo-panel fo-train"><h3>🏋️ Entraînement contre l’ordinateur</h3>
          <p class="muted small">Sans mise, pour apprendre les commandes. Ton maillot :</p>
          <div class="fo-kits">${kitDots(this.kit)}</div>
          <div class="fo-seg" data-seg="lvl">${LVLS.map((l, n) => `<button type="button" data-v="${n}" class="${n === this.lvl ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="fo-seg" data-seg="dur">${DURS.map((d) => `<button type="button" data-v="${d}" class="${d === this.dur ? 'on' : ''}">${d} min</button>`).join('')}</div>
          <button type="button" class="btn primary lg fo-go" data-train>▶ Jouer l’entraînement</button>
        </section>
        <section class="fo-panel fo-helpp"><h3>🎮 Les commandes</h3>${HELP}</section>
      </div>`;
    this.bindLobby();
  }
  // a change in the challenges: only the list moves (the stake being typed stays as it is)
  refresh() {
    if (this.dead || this.match || this.room) return;
    const me = this.me(), key = me?.uid || '';
    if (key !== this.meKey) { this.meKey = key; this.lobby(true); return; }
    const list = this.FD?.list?.() || [], mine = this.lob.querySelector('.fo-mine');
    if (mine) mine.innerHTML = `<h3>📨 Mes défis</h3>${this.listHTML(me, list)}`;
    const fr = this.FD?.friends?.() || [], sig = fr.map((f) => f.uid + (f.on ? 1 : 0)).join();
    if (sig !== this.frSig) { const first = this.frSig === undefined; this.frSig = sig; if (!first) this.lobby(true); }
    // my challenge was just accepted: straight to the pitch
    for (const d of list) {
      if (d.view === 'ready' && me && d.a === me.uid && d.accMs && Date.now() - d.accMs < 90000 && !this.autoIn.has(d.id)) {
        this.autoIn.add(d.id); toast(`⚽ ${esc(d.other)} a accepté ton défi : direction le terrain !`, 'ok'); this.enterRoom(d.id); break;
      }
    }
  }
  defyHTML(me, fr, stakeVal, pick) {
    if (!this.FD) return '<p class="muted">Les défis arrivent bientôt.</p>';
    if (!me) return '<p class="ref-need">Les défis entre amis demandent un <b>compte</b> (gratuit) : ta mise et tes gains y sont gardés.</p><button type="button" class="btn primary" data-signup>Créer mon compte</button>';
    const bal = Math.floor(wallet.balance);
    const friends = fr.length ? `<div class="fo-frs">${fr.map((f, n) => `<label class="fo-fr${f.on ? ' on' : ''}"><input type="radio" name="fr" value="${esc(f.uid)}" ${pick ? (pick === f.uid ? 'checked' : '') : n === 0 ? 'checked' : ''}><span class="dot"></span><b>${esc(f.name)}</b><small>${f.on ? 'en ligne' : 'hors ligne'}</small></label>`).join('')}</div>`
      : '<p class="ref-need">Ajoute d’abord tes amis avec leur pseudo :</p>';
    return `${friends}
      <div class="fo-addfr" data-friends></div>
      ${fr.length ? `<label class="fo-lab">Ta mise (ton ami mise la même somme)</label>
      <div class="fo-stake"><input name="stake" type="number" inputmode="numeric" min="0" max="${bal}" step="1" value="${esc(stakeVal)}"><span> </span></div>
      <div class="fo-chips">${STAKE_CHIPS.map((v) => `<button type="button" data-st="${v}" ${v > bal ? 'disabled' : ''}>${v ? fmt(v) : 'Pour l’honneur'}</button>`).join('')}<button type="button" data-st="${bal}">Tout (${fmt(bal)})</button></div>
      <label class="fo-lab">Durée du match</label>
      <div class="fo-seg" data-seg="dur">${DURS.map((d) => `<button type="button" data-v="${d}" class="${d === this.dur ? 'on' : ''}">${d} min</button>`).join('')}</div>
      <label class="fo-lab">Ton maillot</label><div class="fo-kits">${kitDots(this.kit)}</div>
      <p class="fo-pot muted small"></p>
      <button type="button" class="btn primary lg fo-go" data-defy>⚽ Envoyer le défi</button>` : ''}`;
  }
  listHTML(me, list) {
    if (!me) return '<p class="muted small">Connecte-toi pour voir tes défis.</p>';
    const rows = list.filter((d) => d.view !== 'old').map((d) => {
      const vs = esc(d.other), stake = (d.s ? `${fmt(d.s)} chacun` : 'pour l’honneur') + (d.d ? ` · ${d.d} min` : '');
      let act = '';
      if (d.view === 'in') act = `<button type="button" class="btn primary sm" data-acc="${d.id}">⚽ Accepter et jouer</button><button type="button" class="btn ghost sm" data-ref="${d.id}">Refuser</button>`;
      else if (d.view === 'out') act = `<span class="muted small">En attente de sa réponse · ${esc(d.left)}</span><button type="button" class="btn ghost sm" data-cancel="${d.id}">Annuler</button>`;
      else if (d.view === 'ready') act = `<button type="button" class="btn primary sm" data-play="${d.id}">⚽ Jouer maintenant</button>`;
      else if (d.view === 'live') act = '<span class="muted small">Match en cours…</span>';
      else if (d.view === 'done') act = `<span class="fo-res ${d.res}">${d.resTxt}</span>`;
      return `<div class="fo-row ${d.view}"><div><b>${d.view === 'in' ? `${vs} te défie !` : `Toi contre ${vs}`}</b><small>${stake}</small></div><div class="fo-row-act">${act}</div></div>`;
    }).join('');
    return rows || '<p class="muted small">Aucun défi pour l’instant. Choisis un ami et lance-lui un défi !</p>';
  }
  bindLobby() {
    const L = this.lob;
    try { __mods['friends.js']?.paint?.(); } catch { /* ignore */ }
    const pot = () => {
      const p = L.querySelector('.fo-pot'), v = Math.max(0, Math.floor(+L.querySelector('[name=stake]')?.value || 0)), f = L.querySelector('[name=fr]:checked');
      if (!p) return;
      const nm = f ? f.closest('label').querySelector('b').textContent : 'ton ami';
      p.innerHTML = v ? `Si ${esc(nm)} accepte, la cagnotte sera de <b>${fmt(v * 2)}</b> : le gagnant la prend, nul = chacun récupère ${fmt(v)}.` : 'Match pour l’honneur : aucune mise.';
    };
    pot();
    L.oninput = (e) => { if (e.target.name === 'stake') { LS.set('spinbet_foot_stake', e.target.value); pot(); } };
    L.onchange = pot;
    L.onclick = (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      sfx.click?.();
      if (b.dataset.kit !== undefined) { this.kit = +b.dataset.kit; LS.set('spinbet_foot_kit', this.kit); L.querySelectorAll('.fo-kit').forEach((k) => k.classList.toggle('on', +k.dataset.kit === this.kit)); return; }
      const seg = b.closest('[data-seg]');
      if (seg) { const v = +b.dataset.v; if (seg.dataset.seg === 'dur') { this.dur = v; LS.set('spinbet_foot_dur', v); L.querySelectorAll('[data-seg=dur] button').forEach((x) => x.classList.toggle('on', +x.dataset.v === v)); } else { this.lvl = v; LS.set('spinbet_foot_lvl', v); seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); } return; }
      if (b.dataset.st !== undefined) { const i = L.querySelector('[name=stake]'); if (i) { i.value = b.dataset.st; LS.set('spinbet_foot_stake', i.value); pot(); } return; }
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
      await this.FD.create({ to: f.value, toName: f.closest('label').querySelector('b').textContent, stake, dur: this.dur, kit: this.kit });
      toast(`⚽ Défi envoyé ! Dès que ton ami accepte, le match commence.`, 'ok');
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
    const ai = (this.kit + 1) % KITS.length === this.kit ? 2 : [1, 0, 3, 2, 6, 7, 4, 5, 9, 8][this.kit];
    this.online = false;
    this.play({ online: false, seed: (Math.random() * 4294967296) >>> 0, dur: durF(this.dur), kitIds: [this.kit, ai], names: [nm, 'SpinBet FC'], lvl: this.lvl,
      onEnd: (r, m) => this.soloEnd(r, m), onQuit: () => this.endMatch() });
  }
  soloEnd(r, m) {
    const t = r.res === 'win' ? '🏆 Victoire !' : r.res === 'lose' ? 'Défaite…' : '🤝 Match nul';
    const o = m.showEnd(`<small>FIN DU MATCH</small><h2>${t}</h2>${r.line}${r.stats}<div class="fo-acts"><button type="button" class="btn primary" data-e="again">↻ Rejouer</button><button type="button" class="btn ghost" data-e="out">Retour au vestiaire</button></div>`);
    o.onclick = (e) => { const k = e.target.closest('[data-e]')?.dataset.e; if (k === 'again') { this.endMatch(); this.startTraining(); } if (k === 'out') this.endMatch(); };
  }
  play(o) {
    this.music.stop();
    this.lob.hidden = true;
    this.box.classList.add('playing');
    setFull(this.root, true);
    try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch { /* ignore */ }
    document.body.classList.add('derby-on');
    this.keepFull?.disconnect();
    this.keepFull = new MutationObserver(() => { if (this.match && !this.root.classList.contains('is-full')) { this.root.classList.add('is-full'); document.body.classList.add('fs-on'); } });
    this.keepFull.observe(this.root, { attributes: true, attributeFilter: ['class'] });
    this.match = new Match(this.box, o);
    this.match.painter.zoom = +LS.get('spinbet_foot_zoom', 1) || 1;
    if (location.search.includes('debug')) window.__foot = this.match;
  }
  endMatch() {
    this.keepFull?.disconnect(); this.keepFull = null;
    if (this.match) { this.match.destroy(); this.match = null; }
    document.body.classList.remove('derby-on');
    try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
    if (this.dead) return;
    this.box.classList.remove('playing');
    setFull(this.root, false);
    this.lob.hidden = false;
    this.lobby();
  }

  /* ----- défi en ligne : vestiaire d'attente, connexion, match ----- */
  enterRoom(id) {
    const d = this.FD?.get?.(id), me = this.me();
    if (!d || !me) return toast('Ce défi n’est plus disponible', 'warn');
    if (d.st !== 'go' && d.st !== 'live') return toast(d.st === 'wait' ? 'Ton ami n’a pas encore accepté' : 'Ce match est terminé', 'info');
    this.leaveRoom();
    const host = d.a === me.uid;
    this.room = { id, host, me: host ? 0 : 1, st: 'wait', t0: Date.now() };
    this.lob.hidden = true;
    this.box.insertAdjacentHTML('beforeend', '<div class="fo-room"></div>');
    this.roomEl = this.box.lastElementChild;
    this.roomPaint();
    this.roomEl.onclick = (e) => { const b = e.target.closest('[data-r]'); if (!b) return; if (b.dataset.r === 'cancel') this.voidMatch('Match annulé : les mises sont rendues'); if (b.dataset.r === 'back') { this.leaveRoom(); this.lobby(); } };
    this.FD.join(id).catch(() => {});
    this.joinT = setInterval(() => this.FD.join(id).catch(() => {}), 40000);
    this.link = new Link(host, { write: (p) => this.FD.update(id, p), watch: (cb) => this.FD.watch(id, cb) }, {
      state: (s) => { this.room.net = s; this.roomPaint(); },
      open: () => this.hello(),
      msg: (m) => this.onMsg(m),
      lost: () => this.onLost(),
    });
    this.link.start();
  }
  roomPaint() {
    const R = this.room; if (!R || !this.roomEl || this.match) return;
    const d = this.FD.get(R.id);
    if (!d) { this.roomEl.innerHTML = '<div class="fo-card"><p>Ce match n’existe plus.</p><button type="button" class="btn primary" data-r="back">Retour</button></div>'; return; }
    if (d.r && !this.match) { this.leaveRoom(); this.lobby(); toast(d.r.v ? 'Match annulé : les mises sont rendues' : 'Ce match est terminé', 'info'); return; }
    const k = kitsFor(d.ka, d.kb ?? 1), otherHere = R.host ? !!d.jb : !!d.ja, oname = R.host ? d.bn : d.an;
    const net = R.net === 'connected' ? 'Connectés ! Le coup d’envoi arrive…' : R.net === 'connecting' ? 'Connexion entre vos deux appareils…' : R.net === 'retry' ? 'Connexion difficile, on réessaie…' : R.net === 'failed' ? 'La connexion directe n’arrive pas à passer (réseau). Essayez tous les deux en Wi-Fi, ou annulez : les mises sont rendues.' : otherHere ? `${esc(oname)} est là, connexion…` : `En attente de ${esc(oname)}… (dis-lui d’ouvrir Le Derby)`;
    this.roomEl.innerHTML = `<div class="fo-card fo-wait">
      <small>⚽ LE DERBY · ${d.d} MIN</small>
      <div class="fo-vs"><span><i style="background:${k.kit[0].c}"></i><b>${esc(d.an)}</b></span><em>VS</em><span><i style="background:${k.kit[1].c}"></i><b>${esc(d.bn)}</b></span></div>
      <div class="fo-potbig"><small>Cagnotte</small><b>${d.s ? fmt(d.s * 2) : 'Pour l’honneur'}</b>${d.s ? `<small>le gagnant prend tout · nul : ${fmt(d.s)} rendus à chacun</small>` : ''}</div>
      <p class="fo-status${R.net === 'failed' ? ' bad' : ''}"><span class="fo-spin"></span>${net}</p>
      <div class="fo-acts"><button type="button" class="btn ghost" data-r="cancel">Annuler le match (mises rendues)</button></div>
      <p class="muted small">Le match se joue en direct sur vos deux appareils : restez sur cette page. Quitter pendant le match = abandon (ton ami gagne).</p>
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
  hello() {
    const me = this.me();
    this.link.sendR({ t: 'hi', v: NETV, uid: me?.uid });
  }
  onMsg(m) {
    const R = this.room, L = this.link;
    if (!R || !L) return;
    if (m.t === 'hi') {
      if (m.v !== NETV) { this.roomEl && (this.roomEl.querySelector('.fo-status').innerHTML = '⚠️ Vos deux versions du jeu sont différentes : rechargez la page tous les deux (tirer vers le bas), puis relancez le défi.'); return; }
      R.ok = true;
      if (R.host && !this.match) {
        clearTimeout(this.goT);
        this.goT = setTimeout(() => { // a moment to measure the ping, then the kick-off for both
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
    if (m.t === 'h' && !R.host) { const mine = M.rb.hashes.get(m.f); if (mine !== undefined && mine !== m.h && !R.asked) { R.asked = true; L.sendR({ t: 'need' }); console.warn('Derby : écart à l’image', m.f, '— on reprend l’état de l’hôte'); } return; }
    if (m.t === 'need' && R.host) { const c = M.rb.checks[M.rb.checks.length - 1]; if (c?.s) L.sendR({ t: 'st', f: c.f, s: Array.from(c.s) }); return; }
    if (m.t === 'st' && !R.host) { M.rb.load(m.f, Float64Array.from(m.s)); R.asked = false; return; }
    if (m.t === 'bye') { this.opponentLeft(); return; }
  }
  startOnline(cfg, wait) {
    const R = this.room, d = this.FD.get(R.id);
    if (!d || this.match) return;
    clearInterval(this.joinT);
    this.roomEl?.remove(); this.roomEl = null;
    this.online = true;
    const st = this.link;
    setTimeout(() => {
      if (this.dead || this.match) return;
      this.play({ online: true, id: R.id, me: R.me, seed: cfg.seed, delay: cfg.delay, dur: DBG_DUR || durF(d.d), kitIds: [d.ka, d.kb ?? 1], names: [d.an, d.bn], net: st,
        onEnd: (r) => this.onlineEnd(r), onQuit: () => this.forfeit() });
      const M = this.match;
      // fingerprints of the match, every second
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
  // the connection never came back: the score of the last moment both phones agree on stands
  cutMatch() {
    const M = this.match; if (!M || M.over) return;
    const rb = M.rb, c = Math.min(rb.confirmed, rb.frame), st = rb.ring[c % RB_SLOTS][G.FRAME] === c ? rb.ring[c % RB_SLOTS] : rb.S;
    M.over = true;
    this.report({ a: st[G.SC0], b: st[G.SC1] }, 'cut', st);
  }
  onlineEnd(r) { this.report({ a: r.sa, b: r.sb }, 'end'); }
  opponentLeft() {
    const M = this.match; if (!M || M.over) return;
    M.over = true;
    const S = M.S;
    this.report({ a: S[G.SC0], b: S[G.SC1], f: this.room.host ? this.FD.get(this.room.id)?.b : this.FD.get(this.room.id)?.a }, 'bye');
  }
  forfeit(silent) {
    const M = this.match, R = this.room; if (!M || !R) return;
    M.over = true;
    const S = M.S, me = this.me();
    try { this.link?.sendR({ t: 'bye' }); } catch { /* ignore */ }
    this.FD.result(R.id, { a: S[G.SC0], b: S[G.SC1], f: me?.uid || '' }).catch(() => {});
    if (!silent) this.report({ a: S[G.SC0], b: S[G.SC1], f: me?.uid }, 'quit');
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
    const title = res === 'win' ? '🏆 Victoire !' : res === 'lose' ? 'Défaite…' : res === 'void' ? 'Match annulé' : '🤝 Match nul';
    const why2 = why === 'bye' ? '<p class="muted">Ton adversaire a abandonné.</p>' : why === 'quit' ? '<p class="muted">Tu as abandonné le match.</p>' : why === 'cut' ? '<p class="muted">La connexion a été coupée : le score du moment compte.</p>' : '';
    const S = st || M.S;
    const o = M.showEnd(`<small>FIN DU MATCH</small><h2>${title}</h2>${why2}${M.scoreLine(Object.assign(new Float64Array(S), { [G.SC0]: fin.a ?? S[G.SC0], [G.SC1]: fin.b ?? S[G.SC1] }))}
      ${s ? `<div class="fo-money ${res}">${money}</div>` : ''}${M.stats(S)}
      <div class="fo-acts"><button type="button" class="btn primary" data-e="again">⚔️ Revanche</button><button type="button" class="btn ghost" data-e="out">Retour au vestiaire</button></div>`);
    if (res === 'win') { try { __mods['fx.js'].fx.confetti(120); sfx.bigWin(); } catch { /* ignore */ } }
    o.onclick = async (e) => {
      const k = e.target.closest('[data-e]')?.dataset.e;
      if (k === 'out') { this.closeOnline(); }
      if (k === 'again') {
        const other = me === 0 ? { uid: d.b, name: d.bn } : { uid: d.a, name: d.an };
        try { await this.FD.create({ to: other.uid, toName: other.name, stake: d.s || 0, dur: d.d || 6, kit: this.kit }); toast(`⚔️ Revanche proposée à ${esc(other.name)} !`, 'ok'); } catch (err) { toast(err?.message || 'Revanche impossible pour le moment', 'warn'); }
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

return { FootGame, ENGINE };
})();
