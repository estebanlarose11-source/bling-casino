#!/usr/bin/env node
// Essai du jeu en ligne du Derby sans téléphone : deux matchs « rollback » (games/foot.js) qui s'envoient leurs
// commandes à travers un faux réseau (retard, variations, paquets perdus), puis on vérifie que les deux matchs
// finissent exactement pareil.   node tools/sim/foot-net.js [ping ms, défaut 120] [pertes %, défaut 5] [minutes, défaut 4]
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../games/foot.js'), 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const E = new Function(`${engine}; return ENGINE;`)();
const PING = +process.argv[2] || 120, LOSS = (+process.argv[3] || 5) / 100, MIN = +process.argv[4] || 4;
const { G, PH } = E;
function bot(seed) {
  let s = seed >>> 0 || 1, jx = 0, jy = 0, held = 0, left = 0;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  return () => {
    if (--left <= 0) { left = 8 + Math.floor(r() * 40); const a = r() * Math.PI * 2, m = r() < 0.15 ? 0 : 60 + r() * 40; jx = Math.round(Math.cos(a) * m); jy = Math.round(Math.sin(a) * m); const k = r(); held = k < 0.12 ? E.IN_P : k < 0.2 ? E.IN_S : k < 0.26 ? E.IN_T : k < 0.45 ? E.IN_R : 0; }
    else if (left < 4) held &= E.IN_R;
    return E.encIn(jx, jy, held | E.IN_ON);
  };
}
const delay = Math.max(1, Math.min(6, Math.round(PING / 2 / 16.7) - 1));
const peers = [0, 1].map((me) => ({ me, rb: new E.Rollback({ me, delay, seed: 4242, dur: MIN * 30 * 60, ail: [1, 1] }), bot: bot(77 + me * 99), acc: 0, inbox: [], speed: me ? 1.003 : 0.998, stall: 0, start: me ? 35 : 0 }));
let now = 0, sent = 0, lost = 0, maxStall = 0;
const lat = () => PING / 2 * (0.7 + Math.random() * 0.6) + (Math.random() < 0.03 ? 120 : 0);
while (now < MIN * 60000 * 1.6) {
  now += 4; // 4 ms steps of the fake clock
  for (const p of peers) {
    const o = peers[1 - p.me];
    // deliver
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
  if (peers.every((p) => p.rb.S[G.PHASE] === PH.END && p.rb.confirmed >= p.rb.frame)) break;
}
const [a, b] = peers.map((p) => p.rb);
const ha = E.hashState(a.S), hb = E.hashState(b.S);
console.log(`ping ${PING} ms, ${(LOSS * 100).toFixed(0)} % de paquets perdus, délai ${delay} images`);
console.log(`score ${a.S[G.SC0]}-${a.S[G.SC1]} / ${b.S[G.SC0]}-${b.S[G.SC1]} · fin ${a.S[G.PHASE] === PH.END && b.S[G.PHASE] === PH.END ? 'atteinte' : 'PAS atteinte'}`);
console.log(`retours en arrière : ${a.rolls} (${(a.rolled / Math.max(1, a.rolls)).toFixed(1)} images en moyenne) / ${b.rolls} · plus longue attente ${maxStall.toFixed(0)} ms`);
console.log(`états finaux ${ha === hb ? 'IDENTIQUES' : 'DIFFÉRENTS'} (${ha.toString(16)} / ${hb.toString(16)})`);
