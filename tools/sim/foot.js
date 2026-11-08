#!/usr/bin/env node
// Simulation du Derby (games/foot.js) : fait jouer des matchs complets avec le moteur du jeu (bloc ===ENGINE),
// ordinateur contre ordinateur (ou avec des « humains » qui appuient au hasard), et vérifie qu'un même match rejoué
// avec les mêmes commandes donne exactement le même résultat (indispensable pour le jeu en ligne).
//   node tools/sim/foot.js [matchs, défaut 20] [minutes par match, défaut 6] [--bots]
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../games/foot.js'), 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const E = new Function(`${engine}; return ENGINE;`)();
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = +args[0] || 20, MIN = +args[1] || 6, BOTS = process.argv.includes('--bots');
const { G, PH, EV, EVB, EVS } = E;

// a « human » that plays at random but sensibly: holds a direction for a while, presses buttons now and then
function bot(seed) {
  let s = seed >>> 0 || 1, jx = 0, jy = 0, held = 0, left = 0;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  return () => {
    if (--left <= 0) {
      left = 8 + Math.floor(r() * 40);
      const a = r() * Math.PI * 2, m = r() < 0.15 ? 0 : 60 + r() * 40;
      jx = Math.round(Math.cos(a) * m); jy = Math.round(Math.sin(a) * m);
      const k = r();
      held = k < 0.12 ? E.IN_P : k < 0.2 ? E.IN_S : k < 0.26 ? E.IN_T : k < 0.45 ? E.IN_R : 0;
    } else if (left < 4) held &= E.IN_R;
    return E.encIn(jx, jy, held | E.IN_ON);
  };
}

function play(seed, withBots) {
  const S = E.newMatch({ seed, dur: MIN * 30 * 60, hum: withBots ? [1, 1] : [0, 0], ail: [1, 1] });
  const b0 = bot(seed * 7 + 1), b1 = bot(seed * 13 + 5);
  const ins = [];
  const phases = {};
  let frames = 0, evn = 0, still = 0, maxStill = 0, lastX = 0, lastY = 0;
  const evc = {};
  while (S[G.PHASE] !== PH.END && frames < MIN * 60 * 60 * 3) {
    const i0 = withBots ? b0() : 0, i1 = withBots ? b1() : 0;
    ins.push(i0, i1);
    E.step(S, i0, i1);
    frames++;
    phases[S[G.PHASE]] = (phases[S[G.PHASE]] || 0) + 1;
    for (; evn < S[G.EVN]; evn++) { const k = EVB + (evn % EVS) * 3; evc[S[k]] = (evc[S[k]] || 0) + 1; if (S[k] === EV.PASS && S[G.PAIR]) evc.air = (evc.air || 0) + 1; }
    for (let k = 0; k < S.length; k++) if (!Number.isFinite(S[k])) throw new Error(`NaN/Infinity à l'index ${k}, image ${frames}`);
    if (S[G.PHASE] === PH.PLAY) {
      const x = S[E.BB + E.BX], y = S[E.BB + E.BY];
      if (Math.abs(x - lastX) + Math.abs(y - lastY) < 0.004) { still++; if (still > maxStill) maxStill = still; } else still = 0;
      lastX = x; lastY = y;
    } else still = 0;
  }
  return { S, frames, phases, evc, maxStill, ins, hash: E.hashState(S) };
}

const tot = { blk: 0, hd: 0, g: 0, st: 0, ot: 0, pa: 0, pc: 0, sv: 0, tk: 0, fo: 0, co: 0, pen: 0, post: 0, out: 0, throw: 0, gk: 0, free: 0, draws: 0, still: 0, frames: 0, play: 0 };
const scores = [];
for (let m = 0; m < N; m++) {
  const r = play(1000 + m * 7919, BOTS);
  const S = r.S;
  const g0 = S[G.SC0], g1 = S[G.SC1];
  scores.push(`${g0}-${g1}`);
  tot.g += g0 + g1; if (g0 === g1) tot.draws++;
  tot.st += S[G.ST0] + S[G.ST1]; tot.ot += S[G.OT0] + S[G.OT1]; tot.pa += S[G.PA0] + S[G.PA1]; tot.pc += S[G.PC0] + S[G.PC1];
  tot.sv += S[G.SV0] + S[G.SV1]; tot.tk += S[G.TK0] + S[G.TK1]; tot.fo += S[G.FO0] + S[G.FO1]; tot.co += S[G.CO0] + S[G.CO1];
  tot.pen += r.evc[EV.PEN] || 0; tot.post += (r.evc[EV.POST] || 0) + (r.evc[EV.BAR] || 0); tot.out += r.evc[EV.OUT] || 0;
  tot.air = (tot.air || 0) + (r.evc.air || 0); tot.blk += r.evc[EV.BLOCK] || 0; tot.hd += r.evc[EV.HEADER] || 0;
  tot.throw += r.evc[EV.THROW] || 0; tot.gk += r.evc[EV.GKICK] || 0; tot.free += r.evc[EV.FREE] || 0;
  tot.still = Math.max(tot.still, r.maxStill); tot.frames += r.frames; tot.play += r.phases[PH.PLAY] || 0;
  if (m === 0) {
    // the same match again with the same commands: it must end in exactly the same state
    const S2 = E.newMatch({ seed: 1000, dur: MIN * 30 * 60, hum: BOTS ? [1, 1] : [0, 0], ail: [1, 1] });
    for (let k = 0; k < r.ins.length; k += 2) E.step(S2, r.ins[k], r.ins[k + 1]);
    console.log(`déterminisme : ${E.hashState(S2) === r.hash ? 'OK (même état final)' : 'ÉCHEC'}`);
  }
}
const pm = (x) => (x / N).toFixed(1);
console.log(`${N} matchs de ${MIN} min${BOTS ? ' (joueurs « humains » au hasard)' : ' (ordinateur contre ordinateur)'} : ${scores.join(', ')}`);
console.log(`buts/match ${pm(tot.g)} · nuls ${tot.draws} · tirs ${pm(tot.st)} (cadrés ${pm(tot.ot)}) · arrêts ${pm(tot.sv)} · poteaux ${pm(tot.post)}`);
console.log(`passes ${pm(tot.pa)} (réussies ${((tot.pc / Math.max(1, tot.pa)) * 100).toFixed(0)} %) · tacles gagnés ${pm(tot.tk)} · fautes ${pm(tot.fo)} · penaltys ${pm(tot.pen)}`);
console.log(`contres ${pm(tot.blk)} · têtes ${pm(tot.hd)} · passes aériennes ${pm(tot.air)}`);
console.log(`sorties ${pm(tot.out)} : touches ${pm(tot.throw)}, corners ${pm(tot.co)}, 6 m ${pm(tot.gk)}, coups francs ${pm(tot.free)}`);
console.log(`temps de jeu effectif ${((tot.play / tot.frames) * 100).toFixed(0)} % · ballon immobile en jeu au plus ${(tot.still / 60).toFixed(1)} s · ${(tot.frames / N / 3600).toFixed(1)} min par match`);
