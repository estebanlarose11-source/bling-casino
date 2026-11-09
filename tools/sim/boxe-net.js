#!/usr/bin/env node
// Essai du jeu en ligne du Ring sans téléphone : deux combats « rollback » (games/boxe.js) qui s'envoient leurs
// commandes à travers un faux réseau (retard, variations, paquets perdus), puis on vérifie que les deux téléphones
// ont calculé exactement le même combat (empreintes de chaque seconde confirmée + résultat).
//   node tools/sim/boxe-net.js [ping ms, défaut 120] [pertes %, défaut 5] [rounds, défaut 3]
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../games/boxe.js'), 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const E = new Function(`${engine}; return ENGINE;`)();
const PING = +process.argv[2] || 120, LOSS = (+process.argv[3] || 5) / 100, R = +process.argv[4] || 3;
const { G, PH } = E;
function bot(seed) { // un boxeur qui tape, esquive et se garde au hasard (et tape vite au tapis)
  let s = seed >>> 0 || 1, x = 0, y = 0, b = 0, left = 0, n = 0;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  return () => {
    n++;
    if (--left <= 0) { left = 5 + Math.floor(r() * 25); x = r() < 0.5 ? 0 : (r() - 0.5) * 200; y = (r() - 0.3) * 200; const k = r(); b = k < 0.14 ? E.B_R : k < 0.22 ? E.B_C : k < 0.27 ? E.B_U : k < 0.34 ? E.B_E : k < 0.45 ? E.B_G : 0; }
    else if (left < 3) b &= E.B_G;
    return E.encIn(x, y, (n % 6 < 2 && r() < 0.5 ? E.B_E : b) | E.B_ON);
  };
}
const delay = Math.max(1, Math.min(5, Math.round(PING / 2 / 16.7)));
const peers = [0, 1].map((me) => ({ me, rb: new E.Rollback({ me, delay, seed: 4242, rounds: R, rlen: 60 * 60 }), bot: bot(77 + me * 99), acc: 0, inbox: [], speed: me ? 1.003 : 0.998, stall: 0, start: me ? 35 : 0 }));
let now = 0, sent = 0, lost = 0, maxStall = 0;
const lat = () => PING / 2 * (0.7 + Math.random() * 0.6) + (Math.random() < 0.03 ? 120 : 0);
while (now < R * 75000 * 1.6) {
  now += 4;
  for (const p of peers) {
    const o = peers[1 - p.me];
    p.inbox = p.inbox.filter((m) => { if (m.at > now) return true; p.rb.onPacket(m.msg, now); return false; });
    if (now < p.start) continue;
    const adv = p.rb.adv(now, PING);
    p.acc += 4 * p.speed * (adv > 4 ? 0.9 : adv > 1 ? 0.96 : 1);
    while (p.acc >= 1000 / 60) {
      p.acc -= 1000 / 60;
      p.rb.local(p.bot());
      if (!p.rb.canStep()) { p.stall += 1000 / 60; break; }
      if (p.stall > maxStall) maxStall = p.stall;
      p.stall = 0;
      p.rb.step();
      sent++;
      if (Math.random() < LOSS) { lost++; continue; }
      o.inbox.push({ at: now + lat(), msg: JSON.parse(JSON.stringify(p.rb.packet())) });
    }
  }
  if (peers.every((p) => p.rb.S[G.PHASE] === PH.END && p.rb.S[G.PT] > 200 && p.rb.confirmed >= p.rb.frame - 1)) break;
}
const [a, b] = peers.map((p) => p.rb);
let same = 0, diff = 0;
for (const [f, h] of a.hashes) if (b.hashes.has(f)) { if (b.hashes.get(f) === h) same++; else diff++; }
const how = ['', 'K.-O.', 'arrêt de l’arbitre', 'décision', 'nul'];
console.log(`ping ${PING} ms, ${(LOSS * 100).toFixed(0)} % de paquets perdus, délai ${delay} images, ${R} rounds`);
console.log(`fin : ${a.S[G.PHASE] === PH.END && b.S[G.PHASE] === PH.END ? 'atteinte' : 'PAS atteinte'} · vainqueur ${a.S[G.WIN]} / ${b.S[G.WIN]} (${how[a.S[G.HOW]] || '?'} / ${how[b.S[G.HOW]] || '?'}) · round ${a.S[G.ROUND]}`);
console.log(`plus longue attente ${maxStall.toFixed(0)} ms · ${sent} images, ${lost} paquets perdus`);
console.log(`empreintes communes : ${same} identiques, ${diff} différentes → ${diff === 0 && same > 5 ? 'OK' : 'PROBLÈME'}`);
