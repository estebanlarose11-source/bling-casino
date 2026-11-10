// La Bataille (games/bataille.js) : simulation du retour au joueur.
// node tools/sim/bataille.js [millions de mains]
// Règles : sabot de 6 jeux (mélangé sous 60 cartes), la carte la plus haute gagne (As le plus fort), gain 1 pour 1 ;
// égalité = la banque gagne la mise principale ; mise ÉGALITÉ payée TIE_PAY pour 1 ; 5 victoires d'affilée (même mise)
// = la 5e main paie STREAK_X fois la mise, puis la série repart à zéro.
const N = (+process.argv[2] || 5) * 1e6;
const TIE_PAY = 12, STREAK_X = 5, STREAK_N = 5;
let shoe = [];
const fresh = () => { shoe = []; for (let d = 0; d < 6; d++) for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) shoe.push(r); for (let i = shoe.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; } };
const draw = () => { if (shoe.length < 60) fresh(); return shoe.pop(); };
fresh();
let main = 0, tie = 0, ties = 0, wins = 0, bonus = 0, streak = 0, bonusPart = 0;
for (let i = 0; i < N; i++) {
  const p = draw(), d = draw();
  if (p > d) {
    streak++;
    if (streak >= STREAK_N) { main += STREAK_X; bonus++; bonusPart += STREAK_X - 2; streak = 0; } else main += 2;
    wins++;
  } else { streak = 0; if (p === d) { ties++; tie += TIE_PAY + 1; } }
}
const pc = (x) => (x * 100).toFixed(2) + ' %';
console.log(`${N / 1e6} M mains`);
console.log(`mise principale : retour ${pc(main / N)} (dont bonus ×${STREAK_X} : ${pc(bonusPart / N)})`);
console.log(`gagnées ${pc(wins / N)}, égalités ${pc(ties / N)}, bonus 1 main sur ${Math.round(N / bonus)}`);
console.log(`mise ÉGALITÉ (${TIE_PAY} pour 1) : retour ${pc(tie / N)}`);
