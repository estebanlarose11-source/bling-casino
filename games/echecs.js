// SpinBet Casino · EchecsGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/echecs.js ----
__mods['games/impl/echecs.js'] = (() => {
// Les Échecs (demande du propriétaire du 16 novembre 2026, d'après ses 2 maquettes : ordinateur = salon noir et or à 3
// colonnes, téléphone = pendules en haut, échiquier, 4 boutons en bas). Solo contre 4 adversaires (Facile, Moyen,
// Difficile, Expert, avec leur ELO), ou en ligne contre un ami avec une mise (jusqu'à 50 000 KE) par les défis de
// foot-defis.js (documents foot/{id}, ka = 20, d = 4 / 6 / 8 = cadence ; coups dans mv, pendules ck / mt, nulle dr).
// Pièces dessinées en 3D (tools/render3d/scenes.js → assets/games/echecs/<w|b><P|N|B|R|Q|K>.webp).
/* ===ENGINE */
// Les règles complètes et les adversaires, dans une seule fonction : le jeu l'appelle, et la même fonction (son texte)
// tourne dans un Web Worker pour que l'ordinateur réfléchisse sans figer l'écran.
// Échiquier 0x88 : case = rangée × 16 + colonne, rangée 0 = la 8e (en haut côté blancs), colonne 0 = a.
// Pièces : P N B R Q K (blancs), p n b r q k (noirs). Coups : { f, t, p, c, pr, k } (k : 'e' en passant, 'K' / 'Q' roques, '2' double pas).
function CHESS() {
  const KN = [-33, -31, -18, -14, 14, 18, 31, 33], KG = [-17, -16, -15, -1, 1, 15, 16, 17], DI = [-17, -15, 15, 17], OR = [-16, -1, 1, 16];
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const isW = (x) => x >= 'A' && x <= 'Z';
  const lo = (x) => x.toLowerCase();
  const sqName = (s) => 'abcdefgh'[s & 7] + (8 - (s >> 4));
  const sqOf = (n) => (8 - +n[1]) * 16 + 'abcdefgh'.indexOf(n[0]);
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  function load(fen = START) {
    const [pl, turn, cs, ep, hm, fm] = fen.trim().split(/\s+/);
    const b = new Array(128).fill('');
    const kings = { w: -1, b: -1 };
    let r = 0, f = 0;
    for (const ch of pl) {
      if (ch === '/') { r++; f = 0; continue; }
      if (ch >= '1' && ch <= '8') { f += +ch; continue; }
      const s = r * 16 + f; b[s] = ch; if (ch === 'K') kings.w = s; if (ch === 'k') kings.b = s; f++;
    }
    let c = 0; if (cs && cs !== '-') { if (cs.includes('K')) c |= 1; if (cs.includes('Q')) c |= 2; if (cs.includes('k')) c |= 4; if (cs.includes('q')) c |= 8; }
    return { b, turn: turn || 'w', castle: c, ep: ep && ep !== '-' ? sqOf(ep) : -1, half: +hm || 0, full: +fm || 1, kings, hist: [] };
  }
  function fen(S) {
    let out = '';
    for (let r = 0; r < 8; r++) {
      let e = 0;
      for (let f = 0; f < 8; f++) { const x = S.b[r * 16 + f]; if (!x) e++; else { if (e) { out += e; e = 0; } out += x; } }
      if (e) out += e; if (r < 7) out += '/';
    }
    const c = (S.castle & 1 ? 'K' : '') + (S.castle & 2 ? 'Q' : '') + (S.castle & 4 ? 'k' : '') + (S.castle & 8 ? 'q' : '');
    return `${out} ${S.turn} ${c || '-'} ${S.ep >= 0 ? sqName(S.ep) : '-'} ${S.half} ${S.full}`;
  }
  const key = (S) => fen(S).split(' ').slice(0, 4).join(' ');

  function attacked(S, s, byW) {
    const b = S.b;
    // pawns
    if (byW) { for (const d of [15, 17]) { const x = s + d; if (!(x & 0x88) && b[x] === 'P') return true; } }
    else { for (const d of [-15, -17]) { const x = s + d; if (!(x & 0x88) && b[x] === 'p') return true; } }
    for (const d of KN) { const x = s + d; if (!(x & 0x88) && b[x] === (byW ? 'N' : 'n')) return true; }
    for (const d of KG) { const x = s + d; if (!(x & 0x88) && b[x] === (byW ? 'K' : 'k')) return true; }
    for (const d of DI) { for (let x = s + d; !(x & 0x88); x += d) { const y = b[x]; if (y) { if (isW(y) === byW && (lo(y) === 'b' || lo(y) === 'q')) return true; break; } } }
    for (const d of OR) { for (let x = s + d; !(x & 0x88); x += d) { const y = b[x]; if (y) { if (isW(y) === byW && (lo(y) === 'r' || lo(y) === 'q')) return true; break; } } }
    return false;
  }
  const inCheck = (S, side = S.turn) => attacked(S, S.kings[side], side === 'b');

  function pseudo(S, caps) {
    const out = [], b = S.b, w = S.turn === 'w';
    const add = (f, t, p, k, c) => {
      if (lo(p) === 'p' && ((t >> 4) === 0 || (t >> 4) === 7)) { for (const q of 'qrbn') out.push({ f, t, p, c: c || '', pr: w ? q.toUpperCase() : q, k: '' }); }
      else out.push({ f, t, p, c: c || '', pr: '', k: k || '' });
    };
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s]; if (!p || isW(p) !== w) continue;
      const t = lo(p);
      if (t === 'p') {
        const d = w ? -16 : 16, r = s >> 4;
        const one = s + d;
        if (!caps && !(one & 0x88) && !b[one]) {
          add(s, one, p);
          const two = one + d;
          if ((w ? r === 6 : r === 1) && !b[two]) add(s, two, p, '2');
        } else if (caps && !(one & 0x88) && !b[one] && ((one >> 4) === 0 || (one >> 4) === 7)) add(s, one, p);
        for (const e of [d - 1, d + 1]) {
          const x = s + e; if (x & 0x88) continue;
          if (b[x] && isW(b[x]) !== w) add(s, x, p, '', b[x]);
          else if (x === S.ep) add(s, x, p, 'e', w ? 'p' : 'P');
        }
      } else if (t === 'n' || t === 'k') {
        for (const d of t === 'n' ? KN : KG) {
          const x = s + d; if (x & 0x88) continue;
          if (!b[x]) { if (!caps) add(s, x, p); } else if (isW(b[x]) !== w) add(s, x, p, '', b[x]);
        }
        if (t === 'k' && !caps) {
          const r0 = w ? 112 : 0, ks = w ? 1 : 4, qs = w ? 2 : 8;
          if (s === r0 + 4 && (S.castle & ks) && !b[r0 + 5] && !b[r0 + 6] && b[r0 + 7] === (w ? 'R' : 'r') && !attacked(S, r0 + 4, !w) && !attacked(S, r0 + 5, !w) && !attacked(S, r0 + 6, !w)) add(s, r0 + 6, p, 'K');
          if (s === r0 + 4 && (S.castle & qs) && !b[r0 + 3] && !b[r0 + 2] && !b[r0 + 1] && b[r0] === (w ? 'R' : 'r') && !attacked(S, r0 + 4, !w) && !attacked(S, r0 + 3, !w) && !attacked(S, r0 + 2, !w)) add(s, r0 + 2, p, 'Q');
        }
      } else {
        const dirs = t === 'b' ? DI : t === 'r' ? OR : KG;
        for (const d of dirs) {
          for (let x = s + d; !(x & 0x88); x += d) {
            if (!b[x]) { if (!caps) add(s, x, p); continue; }
            if (isW(b[x]) !== w) add(s, x, p, '', b[x]);
            break;
          }
        }
      }
    }
    return out;
  }
  const RIGHTS = { 0: ~8, 7: ~4, 4: ~12, 112: ~2, 119: ~1, 116: ~3 };
  function make(S, m) {
    const b = S.b;
    S.hist.push({ m, castle: S.castle, ep: S.ep, half: S.half, full: S.full });
    const w = S.turn === 'w';
    b[m.t] = m.pr || m.p; b[m.f] = '';
    if (m.k === 'e') b[m.t + (w ? 16 : -16)] = '';
    if (m.k === 'K') { b[m.t - 1] = b[m.t + 1]; b[m.t + 1] = ''; }
    if (m.k === 'Q') { b[m.t + 1] = b[m.t - 2]; b[m.t - 2] = ''; }
    if (lo(m.p) === 'k') S.kings[S.turn] = m.t;
    if (RIGHTS[m.f] !== undefined) S.castle &= RIGHTS[m.f];
    if (RIGHTS[m.t] !== undefined) S.castle &= RIGHTS[m.t];
    S.ep = m.k === '2' ? (m.f + m.t) >> 1 : -1;
    S.half = lo(m.p) === 'p' || m.c ? 0 : S.half + 1;
    if (!w) S.full++;
    S.turn = w ? 'b' : 'w';
  }
  function unmake(S) {
    const h = S.hist.pop(), m = h.m, b = S.b;
    S.turn = S.turn === 'w' ? 'b' : 'w';
    const w = S.turn === 'w';
    b[m.f] = m.p; b[m.t] = m.k === 'e' ? '' : m.c;
    if (m.k === 'e') b[m.t + (w ? 16 : -16)] = m.c;
    if (m.k === 'K') { b[m.t + 1] = b[m.t - 1]; b[m.t - 1] = ''; }
    if (m.k === 'Q') { b[m.t - 2] = b[m.t + 1]; b[m.t + 1] = ''; }
    if (lo(m.p) === 'k') S.kings[S.turn] = m.f;
    S.castle = h.castle; S.ep = h.ep; S.half = h.half; S.full = h.full;
  }
  function legal(S, caps) {
    const side = S.turn, out = [];
    for (const m of pseudo(S, caps)) { make(S, m); if (!inCheck(S, side)) out.push(m); unmake(S); }
    return out;
  }
  const uci = (m) => sqName(m.f) + sqName(m.t) + (m.pr ? lo(m.pr) : '');
  const findUci = (S, u) => legal(S).find((m) => uci(m) === u) || null;

  // the move in figurine notation (♘f3, exd5, O-O, e8=♕+)
  const FIG = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };
  function san(S, m) {
    let s;
    if (m.k === 'K') s = 'O-O'; else if (m.k === 'Q') s = 'O-O-O';
    else {
      const t = m.p.toUpperCase();
      if (t === 'P') s = (m.c ? sqName(m.f)[0] + 'x' : '') + sqName(m.t) + (m.pr ? `=${FIG[m.pr.toUpperCase()]}` : '');
      else {
        const amb = legal(S).filter((x) => x.p === m.p && x.t === m.t && x.f !== m.f);
        let d = '';
        if (amb.length) { const sf = amb.some((x) => (x.f & 7) === (m.f & 7)), sr = amb.some((x) => (x.f >> 4) === (m.f >> 4)); d = !sf ? sqName(m.f)[0] : !sr ? sqName(m.f)[1] : sqName(m.f); }
        s = FIG[t] + d + (m.c ? 'x' : '') + sqName(m.t);
      }
    }
    make(S, m);
    const chk = inCheck(S), mate = chk && !legal(S).length;
    unmake(S);
    return s + (mate ? '#' : chk ? '+' : '');
  }
  // too few pieces for anyone to mate
  function noMaterial(S) {
    const n = { w: [], b: [] };
    for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = S.b[s]; if (p && lo(p) !== 'k') n[isW(p) ? 'w' : 'b'].push({ t: lo(p), c: ((s >> 4) + (s & 7)) & 1 }); }
    const all = [...n.w, ...n.b];
    if (all.some((x) => x.t === 'p' || x.t === 'r' || x.t === 'q')) return false;
    if (all.length <= 1) return true;
    if (all.every((x) => x.t === 'b') && all.every((x) => x.c === all[0].c)) return true;
    return false;
  }
  const sideHasMate = (S, side) => { for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = S.b[s]; if (p && isW(p) === (side === 'w') && lo(p) !== 'k') return true; } return false; };

  /* ---------- l'adversaire : alpha-bêta, recherche des prises, tables de positions ---------- */
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    e: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
  };
  // score for the side to move (centipawns)
  function evaluate(S) {
    let sc = 0, mat = 0;
    const b = S.b;
    for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = b[s]; if (p && lo(p) !== 'p' && lo(p) !== 'k') mat += VAL[lo(p)]; }
    const end = mat <= 2600;
    let bw = 0, bb = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s]; if (!p) continue;
      const t = lo(p), w = isW(p), i = w ? (s >> 4) * 8 + (s & 7) : (7 - (s >> 4)) * 8 + (s & 7);
      const v = VAL[t] + (t === 'k' ? (end ? PST.e : PST.k)[i] : PST[t][i]);
      if (t === 'b') { if (w) bw++; else bb++; }
      sc += w ? v : -v;
    }
    if (bw >= 2) sc += 30; if (bb >= 2) sc -= 30;
    return S.turn === 'w' ? sc : -sc;
  }
  const MATE = 100000;
  function order(ms, best, killers) {
    for (const m of ms) {
      m.o = m.c ? 10 * VAL[lo(m.c)] - VAL[lo(m.p)] / 10 + 10000 : 0;
      if (m.pr) m.o += 9000;
      if (best && m.f === best.f && m.t === best.t && m.pr === best.pr) m.o = 1e9;
      else if (killers && !m.c && killers.some((k) => k && k.f === m.f && k.t === m.t)) m.o = 5000;
    }
    return ms.sort((a, b) => b.o - a.o);
  }
  function search(fenStr, opt = {}) {
    const S = load(fenStr);
    const maxD = opt.depth || 3, until = Date.now() + (opt.time || 1e9), noise = opt.noise || 0, qs = opt.qs !== false;
    const killers = [];
    let nodes = 0, stop = false;
    const quiesce = (alpha, beta, d) => {
      if ((++nodes & 2047) === 0 && Date.now() > until) stop = true;
      const stand = evaluate(S);
      if (!qs || d > 6) return stand;
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      const side = S.turn;
      for (const m of order(pseudo(S, true))) {
        make(S, m);
        if (inCheck(S, side)) { unmake(S); continue; }
        const v = -quiesce(-beta, -alpha, d + 1);
        unmake(S);
        if (stop) return alpha;
        if (v >= beta) return beta;
        if (v > alpha) alpha = v;
      }
      return alpha;
    };
    const ab = (depth, alpha, beta, ply) => {
      if ((++nodes & 2047) === 0 && Date.now() > until) stop = true;
      if (stop) return 0;
      if (S.half >= 100) return 0;
      const chk = inCheck(S);
      if (depth <= 0 && !chk) return quiesce(alpha, beta, 0);
      const side = S.turn, ms = order(pseudo(S, false), null, killers[ply]);
      let any = false;
      for (const m of ms) {
        make(S, m);
        if (inCheck(S, side)) { unmake(S); continue; }
        any = true;
        const v = -ab(depth - 1, -beta, -alpha, ply + 1);
        unmake(S);
        if (stop) return 0;
        if (v >= beta) { if (!m.c) { killers[ply] = [m, (killers[ply] || [])[0]]; } return beta; }
        if (v > alpha) alpha = v;
      }
      if (!any) return chk ? -MATE + ply : 0;
      return alpha;
    };
    const root = legal(S);
    if (!root.length) return { move: null, score: inCheck(S) ? -MATE : 0, depth: 0 };
    let best = null, bestScore = -Infinity, scored = [], done = 0;
    for (let d = 1; d <= maxD; d++) {
      const cur = [];
      const list = order(root.slice(), best);
      let alpha = -Infinity;
      for (const m of list) {
        make(S, m);
        const v = -ab(d - 1, -MATE - 1, -(noise ? -MATE - 1 : alpha), 1);
        unmake(S);
        if (stop) break;
        cur.push({ m, v });
        if (v > alpha) alpha = v;
      }
      if (stop && d > 1) break;
      scored = cur; done = d;
      scored.sort((a, b) => b.v - a.v);
      best = scored[0].m; bestScore = scored[0].v;
      if (Math.abs(bestScore) > MATE - 100) break;
      if (Date.now() > until) break;
    }
    // weaker players: a little noise on the scores, sometimes a random move
    let pick = scored[0];
    if (noise) {
      const r = scored.map((x) => ({ ...x, n: x.v + (Math.random() * 2 - 1) * noise }));
      r.sort((a, b) => b.n - a.n);
      pick = Math.abs(scored[0].v) > MATE - 100 && scored[0].v > 0 && Math.random() < 0.7 ? scored[0] : r[0];
    }
    if (opt.blunder && Math.random() < opt.blunder) pick = scored[Math.floor(Math.random() * scored.length)];
    return { move: uci(pick.m), score: pick.v, best: uci(scored[0].m), bestScore, depth: done, nodes };
  }
  return { START, load, fen, key, legal, make, unmake, inCheck, san, uci, findUci, sqName, sqOf, isW, lo, noMaterial, sideHasMate, evaluate, search, attacked };
}
/* ===END ENGINE */

/* ---------- le jeu dans la page ---------- */
const { Music, EXTRA_THEMES, musicOn } = __mods['core/music.js'];
const { setFull, toggleFull, isFull, gameMenu } = __mods['core/chrome.js'];
const { toast, modal } = __mods['ui.js'];
const { wallet, fmt } = __mods['wallet.js'];
const { sfx, isMuted, setMuted, audioContext } = __mods['audio.js'];
const { fx } = __mods['fx.js'];

const E = CHESS();
const ASSET = 'assets/games/echecs/';
const PIC = (p) => `${ASSET}${E.isW(p) ? 'w' : 'b'}${p.toUpperCase()}.webp`;
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, String(v)); } catch { /* ignore */ } } };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// the 4 computer players (ELO shown to the player: what they really play like, roughly)
const LEVELS = [
  { n: 'Facile', bot: 'Léo', av: '🧒', elo: 800, txt: 'Débutant : il laisse souvent des pièces en prise', o: { depth: 1, noise: 160, blunder: 0.2, qs: false } },
  { n: 'Moyen', bot: 'Margaux', av: '👩‍🎓', elo: 1200, txt: 'Joueuse de club : elle voit les prises simples', o: { depth: 2, noise: 45, blunder: 0.05 } },
  { n: 'Difficile', bot: 'Le Baron', av: '🎩', elo: 1600, txt: 'Fort : il calcule 3 coups et ne pardonne pas', o: { depth: 3, noise: 12 } },
  { n: 'Expert', bot: 'La Duchesse', av: '👑', elo: 2000, txt: 'Redoutable : elle calcule le plus loin possible', o: { depth: 8, time: 1700 } },
];
// cadences: d = the duration code of the challenges (foot-defis.js: 4, 6, 8)
const TCS = [{ d: 0, n: 'Sans limite', base: 0, inc: 0 }, { d: 4, n: 'Blitz', base: 5, inc: 3 }, { d: 6, n: 'Rapide', base: 10, inc: 5 }, { d: 8, n: 'Classique', base: 15, inc: 10 }];
const tcOf = (d) => TCS.find((t) => t.d === d) || TCS[2];
const tcTxt = (t) => (t.base ? `${t.base} min + ${t.inc} s` : 'sans pendule');
const STAKE_MAX = 50000, STAKE_CHIPS = [0, 1000, 5000, 10000, 25000, 50000];
const AIDS = 3; // help per solo game: undo, best move, opening move, tactical move
const BOOK = { // a few openings, to vary the first moves and for « Coup d'ouverture »
  '': ['e2e4', 'd2d4', 'c2c4', 'g1f3'], 'e2e4': ['e7e5', 'c7c5', 'e7e6', 'c7c6'], 'd2d4': ['d7d5', 'g8f6'], 'c2c4': ['e7e5', 'g8f6'], 'g1f3': ['d7d5', 'g8f6'],
  'e2e4 e7e5': ['g1f3'], 'e2e4 e7e5 g1f3': ['b8c6'], 'e2e4 e7e5 g1f3 b8c6': ['f1b5', 'f1c4', 'd2d4'], 'e2e4 e7e5 g1f3 b8c6 f1b5': ['a7a6', 'g8f6'], 'e2e4 e7e5 g1f3 b8c6 f1c4': ['f8c5', 'g8f6'],
  'e2e4 c7c5': ['g1f3', 'b1c3'], 'e2e4 c7c5 g1f3': ['d7d6', 'b8c6', 'e7e6'], 'e2e4 e7e6': ['d2d4'], 'e2e4 e7e6 d2d4': ['d7d5'], 'e2e4 c7c6': ['d2d4'], 'e2e4 c7c6 d2d4': ['d7d5'],
  'd2d4 d7d5': ['c2c4', 'g1f3'], 'd2d4 d7d5 c2c4': ['e7e6', 'c7c6', 'd5c4'], 'd2d4 g8f6': ['c2c4', 'g1f3'], 'd2d4 g8f6 c2c4': ['e7e6', 'g7g6'], 'c2c4 e7e5': ['b1c3'], 'g1f3 d7d5': ['d2d4', 'g2g3'],
};
const RES = { mate: 'échec et mat', resign: 'abandon', time: 'temps écoulé', stale: 'pat', rep: 'répétition de la position', fifty: 'règle des 50 coups', mat: 'matériel insuffisant', agree: 'nulle acceptée', left: 'adversaire parti' };
const ICON = {
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  draw: '<svg viewBox="0 0 24 24"><path d="M2 12l4-4 4 3 3-3 4 2 5 4-3 3-3-2-3 3-3-2-3 2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5z" fill="currentColor"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z M12 6v14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="currentColor" stroke-width="2"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="4.5" cy="6" r="1.5" fill="currentColor"/><circle cx="4.5" cy="12" r="1.5" fill="currentColor"/><circle cx="4.5" cy="18" r="1.5" fill="currentColor"/></svg>',
  knight: '<svg viewBox="0 0 24 24"><path d="M7 21h11c0-4-2-6-2-9 2 1 3 0 3-1l-4-7c-3 0-7 2-8 6-1 3 1 4 3 4-1 2-3 4-3 7z" fill="currentColor"/></svg>',
};
const fmtClock = (ms) => {
  if (ms === null || ms === undefined) return '∞';
  ms = Math.max(0, ms);
  if (ms < 20000) return `0:${String(Math.floor(ms / 1000)).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
// the wooden « tock » of a piece put down (and a deeper one for a capture)
function tock(cap) {
  if (isMuted()) return;
  try {
    const ac = audioContext(); if (!ac) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(cap ? 210 : 330, t); o.frequency.exponentialRampToValueAtTime(cap ? 90 : 160, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(cap ? 0.5 : 0.32, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.16);
    const n = ac.createBufferSource(), buf = ac.createBuffer(1, ac.sampleRate * 0.04, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = cap ? 1400 : 2200; f.Q.value = 1.2;
    const g2 = ac.createGain(); g2.gain.value = cap ? 0.35 : 0.22;
    n.buffer = buf; n.connect(f); f.connect(g2); g2.connect(ac.destination); n.start(t);
  } catch { /* no sound */ }
}

// the computer thinks in a Web Worker (the screen stays smooth); without one, on the page
let worker = null, wid = 0;
const waiting = new Map();
function think(fen, opt) {
  if (!worker && worker !== false) {
    try {
      const src = `${CHESS.toString()}\nconst E = CHESS();\nonmessage = (e) => { const { id, fen, opt } = e.data; let r; try { r = E.search(fen, opt); } catch (err) { r = { error: String(err) }; } postMessage({ id, r }); };`;
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = (e) => { const w = waiting.get(e.data.id); if (w) { waiting.delete(e.data.id); w(e.data.r); } };
      worker.onerror = () => { worker = false; waiting.forEach((w) => w(null)); waiting.clear(); };
    } catch { worker = false; }
  }
  if (worker) return new Promise((res) => { const id = ++wid; waiting.set(id, res); worker.postMessage({ id, fen, opt }); });
  return new Promise((res) => setTimeout(() => res(E.search(fen, opt)), 30));
}

class EchecsGame {
  constructor(root, game) {
    this.root = root; this.game = game;
    this.FD = __mods['foot-defis.js'];
    this.music = new Music(EXTRA_THEMES.echecs || EXTRA_THEMES.blackjack);
    this.lvl = Math.max(0, Math.min(3, +LS.get('spinbet_echecs_lvl', 1) || 0));
    this.col = LS.get('spinbet_echecs_col', 'w');
    this.tc = +LS.get('spinbet_echecs_tc', 0) || 0;
    this.otc = [4, 6, 8].includes(+LS.get('spinbet_echecs_otc', 6)) ? +LS.get('spinbet_echecs_otc', 6) : 6;
    this.opts = { hints: LS.get('spinbet_echecs_dots', '1') === '1', coords: LS.get('spinbet_echecs_coords', '1') === '1' };
    root.innerHTML = '<div class="chess"><div class="cxl"></div></div>';
    this.box = root.querySelector('.chess'); this.lob = root.querySelector('.cxl');
    this.lobby();
    this.off = this.FD?.on?.(() => { if (this.dead) return; if (this.online) this.onDoc(); else if (this.room) this.roomPaint(); else if (!this.play) this.refresh(); });
    const j = this.FD?.takeJoin?.();
    if (j) setTimeout(() => this.enterRoom(j), 50);
    const FB = __mods['friends.js']?.bus, idle = () => { if (!this.dead && !this.play && !this.room) this.refresh(); };
    FB?.addEventListener('change', idle); this.offFr = () => FB?.removeEventListener('change', idle);
    this.frT = setInterval(idle, 10000);
    this.onKey = (e) => this.keys(e); addEventListener('keydown', this.onKey);
  }
  destroy() {
    this.dead = true;
    this.stopClock(); this.ro?.disconnect();
    this.off?.(); this.offFr?.(); clearInterval(this.frT); clearInterval(this.joinT); this.unwatch?.();
    removeEventListener('keydown', this.onKey);
    this.music.stop();
    if (isFull(this.root)) setFull(this.root, false);
  }
  me() { return this.FD?.me?.() || null; }
  get match() { return this.play && !this.over ? this.play : null; } // foot-defis.js: in a game, challenges only toast

  /* ================= l'accueil : solo, en ligne, mes parties ================= */
  lobby(soft) {
    if (this.dead) return;
    const keep = soft && this.lob.querySelector('.fo-defy');
    const me = this.me(), fr = this.FD?.friends?.() || [], list = this.list();
    const stakeVal = keep ? this.lob.querySelector('[name=stake]')?.value : LS.get('spinbet_echecs_stake', '1000');
    const pick = keep ? this.lob.querySelector('[name=fr]:checked')?.value : null;
    this.meKey = me?.uid || '';
    this.frSig = fr.map((f) => f.uid + (f.on ? 1 : 0)).join();
    const st = this.stats(), elo = this.elo();
    this.lob.innerHTML = `
      <section class="fo-hero cx-hero">
        <div class="fo-hero-art cx-hero-art" aria-hidden="true"><img src="${ASSET}wK.webp" alt=""></div>
        <div><small>♛ LES ÉCHECS · SALON PRIVÉ</small><h2>Les Échecs</h2>
        <p>Affronte <b>4 adversaires</b> de Facile à Expert, ou <b>défie tes amis</b> en direct avec une mise jusqu’à <b>${fmt(STAKE_MAX)}</b> : le gagnant rafle tout, nulle = chacun récupère sa mise.</p>
        <div class="cx-chips"><span>${ICON.crown} Ton classement <b>${elo}</b></span><span>Parties <b>${st.games}</b></span><span>Victoires <b>${st.games ? Math.round((st.wins / st.games) * 100) : 0} %</b></span><span>Série <b>${st.streak}</b></span></div></div>
      </section>
      <div class="fo-grid cx-grid">
        <section class="fo-panel cx-solo"><h3>🤖 Partie contre l’ordinateur</h3>
          <div class="cx-lvls">${LEVELS.map((l, n) => `<button type="button" class="cx-lvl${n === this.lvl ? ' on' : ''}" data-lvl="${n}"><span class="cx-av">${l.av}</span><b>${l.bot}</b><small>${l.n}</small><em>ELO ${l.elo}</em></button>`).join('')}</div>
          <p class="cx-lvltxt muted small">${LEVELS[this.lvl].txt}</p>
          <label class="fo-lab">Tes pièces</label>
          <div class="fo-seg" data-seg="col">${[['w', '♔ Blancs'], ['r', '🎲 Au hasard'], ['b', '♚ Noirs']].map(([v, t]) => `<button type="button" data-v="${v}" class="${v === this.col ? 'on' : ''}">${t}</button>`).join('')}</div>
          <label class="fo-lab">Cadence</label>
          <div class="fo-seg" data-seg="tc">${TCS.map((t) => `<button type="button" data-v="${t.d}" class="${t.d === this.tc ? 'on' : ''}">${t.n}<small>${t.base ? `${t.base}+${t.inc}` : '∞'}</small></button>`).join('')}</div>
          <button type="button" class="btn primary lg fo-go cx-go" data-solo>♟ Commencer la partie</button>
        </section>
        <section class="fo-panel fo-defy"><h3>⚔️ Défier un ami</h3>${this.defyHTML(me, fr, stakeVal, pick)}</section>
        <section class="fo-panel fo-mine"><h3>📨 Mes parties en ligne</h3>${this.listHTML(me, list)}</section>
        <section class="fo-panel cx-rules"><h3>📖 Comment jouer</h3>${this.rulesHTML()}</section>
      </div>`;
    this.bindLobby();
  }
  rulesHTML() {
    return `<div class="fo-help-grid"><p><b>Jouer un coup</b> : touche une de tes pièces (ses cases possibles s’allument), puis la case d’arrivée. Tu peux aussi la faire glisser.</p>
      <p><b>Règles complètes</b> : roque, prise en passant, promotion (tu choisis la pièce), échec et mat, pat, nulle par répétition, par la règle des 50 coups ou par manque de matériel.</p>
      <p><b>Contre l’ordinateur</b> : ${AIDS} aides par partie : annuler ton coup, montrer le meilleur coup, un coup d’ouverture ou un coup tactique. Ton classement ELO monte ou descend après chaque partie.</p>
      <p><b>Entre amis</b> : choisis la mise (jusqu’à ${fmt(STAKE_MAX)}) et la cadence ; ton ami mise la même somme. Le gagnant prend les deux mises, nulle = mises rendues. Temps écoulé ou abandon = défaite. Tu peux quitter la page : la partie continue et ta pendule tourne, reviens par « Mes parties ».</p></div>`;
  }
  list() { return this.FD?.list?.('echecs') || []; }
  refresh() {
    if (this.dead || this.play || this.room) return;
    const me = this.me(), key = me?.uid || '';
    if (key !== this.meKey) { this.meKey = key; this.lobby(true); return; }
    const list = this.list(), mine = this.lob.querySelector('.fo-mine');
    if (mine) mine.innerHTML = `<h3>📨 Mes parties en ligne</h3>${this.listHTML(me, list)}`;
    const fr = this.FD?.friends?.() || [], sig = fr.map((f) => f.uid + (f.on ? 1 : 0)).join();
    if (sig !== this.frSig) { const first = this.frSig === undefined; this.frSig = sig; if (!first) this.lobby(true); }
    this.autoIn = this.autoIn || new Set();
    for (const d of list) {
      if (d.view === 'ready' && me && d.a === me.uid && d.accMs && Date.now() - d.accMs < 90000 && !this.autoIn.has(d.id)) {
        this.autoIn.add(d.id); toast(`♟ ${esc(d.other)} a accepté ton défi : à toi de jouer !`, 'ok'); this.enterRoom(d.id); break;
      }
    }
  }
  defyHTML(me, fr, stakeVal, pick) {
    if (!this.FD) return '<p class="muted">Les parties entre amis arrivent bientôt.</p>';
    if (!me) return '<p class="ref-need">Les parties entre amis demandent un <b>compte</b> (gratuit) : ta mise et tes gains y sont gardés.</p><button type="button" class="btn primary" data-signup>Créer mon compte</button>';
    const bal = Math.floor(wallet.balance), top = Math.min(STAKE_MAX, bal);
    const friends = fr.length ? `<div class="fo-frs">${fr.map((f, n) => `<label class="fo-fr${f.on ? ' on' : ''}"><input type="radio" name="fr" value="${esc(f.uid)}" ${pick ? (pick === f.uid ? 'checked' : '') : n === 0 ? 'checked' : ''}><span class="dot"></span><b>${esc(f.name)}</b><small>${f.on ? 'en ligne' : 'hors ligne'}</small></label>`).join('')}</div>`
      : '<p class="ref-need">Ajoute d’abord tes amis avec leur pseudo :</p>';
    return `${friends}<div class="fo-addfr" data-friends></div>
      ${fr.length ? `<label class="fo-lab">Ta mise (ton ami mise la même somme, ${fmt(STAKE_MAX)} au plus)</label>
      <div class="fo-stake"><input name="stake" type="number" inputmode="numeric" min="0" max="${top}" step="1" value="${esc(Math.min(+stakeVal || 0, top))}"><span> </span></div>
      <div class="fo-chips">${STAKE_CHIPS.map((v) => `<button type="button" data-st="${v}" ${v > bal ? 'disabled' : ''}>${v ? fmt(v) : 'Pour l’honneur'}</button>`).join('')}</div>
      <label class="fo-lab">Cadence</label>
      <div class="fo-seg" data-seg="otc">${TCS.filter((t) => t.d).map((t) => `<button type="button" data-v="${t.d}" class="${t.d === this.otc ? 'on' : ''}">${t.n}<small>${t.base}+${t.inc}</small></button>`).join('')}</div>
      <p class="fo-pot muted small"></p>
      <button type="button" class="btn primary lg fo-go cx-go" data-defy>♟ Envoyer le défi</button>` : ''}`;
  }
  listHTML(me, list) {
    if (!me) return '<p class="muted small">Connecte-toi pour voir tes parties.</p>';
    const rows = list.map((d) => {
      const vs = esc(d.other), stake = (d.s ? `${fmt(d.s)} chacun` : 'pour l’honneur') + (d.d ? ` · ${tcTxt(tcOf(d.d))}` : '');
      let act = '';
      if (d.view === 'in') act = `<button type="button" class="btn primary sm" data-acc="${d.id}">♟ Accepter et jouer</button><button type="button" class="btn ghost sm" data-ref="${d.id}">Refuser</button>`;
      else if (d.view === 'out') act = `<span class="muted small">En attente de sa réponse · ${esc(d.left)}</span><button type="button" class="btn ghost sm" data-cancel="${d.id}">Annuler</button>`;
      else if (d.view === 'ready') act = `<button type="button" class="btn primary sm" data-play="${d.id}">♟ Jouer maintenant</button>`;
      else if (d.view === 'live') act = `<button type="button" class="btn primary sm" data-play="${d.id}">♟ Reprendre la partie</button>`;
      else if (d.view === 'done') act = `<span class="fo-res ${d.res}">${d.resTxt}</span>`;
      return `<div class="fo-row ${d.view}"><div><b>${d.view === 'in' ? `${vs} te défie !` : `Toi contre ${vs}`}</b><small>${stake}</small></div><div class="fo-row-act">${act}</div></div>`;
    }).join('');
    return rows || '<p class="muted small">Aucune partie pour l’instant. Choisis un ami et lance-lui un défi !</p>';
  }
  bindLobby() {
    const L = this.lob;
    try { __mods['friends.js']?.paint?.(); } catch { /* ignore */ }
    const pot = () => {
      const p = L.querySelector('.fo-pot'), v = Math.max(0, Math.floor(+L.querySelector('[name=stake]')?.value || 0)), f = L.querySelector('[name=fr]:checked');
      if (!p) return;
      const nm = f ? f.closest('label').querySelector('b').textContent : 'ton ami';
      p.innerHTML = v ? `Si ${esc(nm)} accepte, la cagnotte sera de <b>${fmt(Math.min(v, STAKE_MAX) * 2)}</b> : le gagnant la prend, nulle = chacun récupère ${fmt(Math.min(v, STAKE_MAX))}.` : 'Partie pour l’honneur : aucune mise.';
    };
    pot();
    L.oninput = (e) => { if (e.target.name === 'stake') { if (+e.target.value > STAKE_MAX) e.target.value = STAKE_MAX; LS.set('spinbet_echecs_stake', e.target.value); pot(); } };
    L.onchange = pot;
    L.onclick = (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      sfx.unlock?.(); sfx.click?.();
      if (b.dataset.lvl !== undefined) { this.lvl = +b.dataset.lvl; LS.set('spinbet_echecs_lvl', this.lvl); L.querySelectorAll('.cx-lvl').forEach((x) => x.classList.toggle('on', +x.dataset.lvl === this.lvl)); L.querySelector('.cx-lvltxt').textContent = LEVELS[this.lvl].txt; return; }
      const seg = b.closest('[data-seg]');
      if (seg) {
        const kind = seg.dataset.seg, v = kind === 'col' ? b.dataset.v : +b.dataset.v;
        if (kind === 'col') { this.col = v; LS.set('spinbet_echecs_col', v); }
        if (kind === 'tc') { this.tc = v; LS.set('spinbet_echecs_tc', v); }
        if (kind === 'otc') { this.otc = v; LS.set('spinbet_echecs_otc', v); }
        L.querySelectorAll(`[data-seg=${kind}] button`).forEach((x) => x.classList.toggle('on', x.dataset.v === String(v)));
        return;
      }
      if (b.dataset.st !== undefined) { const i = L.querySelector('[name=stake]'); if (i) { i.value = b.dataset.st; LS.set('spinbet_echecs_stake', i.value); pot(); } return; }
      if (b.hasAttribute('data-solo')) return this.startSolo();
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
    const stake = Math.max(0, Math.min(STAKE_MAX, Math.floor(+L.querySelector('[name=stake]').value || 0)));
    if (stake > wallet.balance) return toast(`Solde insuffisant pour miser ${fmt(stake)}`, 'warn');
    b.disabled = true;
    try {
      await this.FD.create({ to: f.value, toName: f.closest('label').querySelector('b').textContent, stake, dur: this.otc, game: 'echecs' });
      toast('♟ Défi envoyé ! Dès que ton ami accepte, la partie commence.', 'ok');
    } catch (e) { toast(e?.message || 'Défi impossible pour le moment', 'warn'); }
    b.disabled = false;
  }
  async accept(id, b) {
    if (b) b.disabled = true;
    try { await this.FD.accept(id, 20); this.enterRoom(id); } catch (e) { if (b) b.disabled = false; toast(e?.message || 'Impossible d’accepter ce défi', 'warn'); }
  }

  /* ----- statistiques et classement (solo, sur cet appareil) ----- */
  stats() {
    let s; try { s = JSON.parse(LS.get('spinbet_echecs_st', 'null')); } catch { s = null; }
    s = s || { games: 0, wins: 0, streak: 0, day: '', today: 0, todayW: 0 };
    const day = new Date().toDateString();
    if (s.day !== day) { s.day = day; s.today = 0; s.todayW = 0; }
    return s;
  }
  elo() { return Math.round(+LS.get('spinbet_echecs_elo', 1000) || 1000); }
  record(res, oppElo) {
    const s = this.stats(); s.games++; s.today++;
    if (res === 'win') { s.wins++; s.todayW++; s.streak++; } else if (res === 'lose') s.streak = 0;
    LS.set('spinbet_echecs_st', JSON.stringify(s));
    if (!oppElo) return 0;
    const me = this.elo(), exp = 1 / (1 + 10 ** ((oppElo - me) / 400)), sc = res === 'win' ? 1 : res === 'tie' ? 0.5 : 0;
    const d = Math.round(28 * (sc - exp));
    LS.set('spinbet_echecs_elo', Math.max(100, me + d));
    return d;
  }

  /* ================= la partie ================= */
  startSolo() {
    const L = LEVELS[this.lvl], col = this.col === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : this.col, tc = tcOf(this.tc);
    const prof = __mods['profile.js']?.profiles?.current, name = this.me()?.name || prof?.name || 'Toi';
    this.begin({ mode: 'solo', my: col, tc: this.tc ? tc : null, lvl: this.lvl, names: { [col]: name, [col === 'w' ? 'b' : 'w']: L.bot }, opp: { name: L.bot, av: L.av, sub: `${L.n} · ELO ${L.elo}`, elo: L.elo } });
  }
  begin(o) {
    this.music.stop();
    this.stopClock();
    this.S = E.load(); this.ucis = []; this.sans = []; this.poss = [E.key(this.S)]; this.evals = [0]; this.shownOnline = false; this.startAt = 0;
    this.my = o.my; this.mode = o.mode; this.cfg = o; this.over = null; this.sel = -1; this.aids = AIDS; this.hint = null; this.drawAsked = false;
    this.clock = o.tc ? { w: o.tc.base * 60000, b: o.tc.base * 60000, base: o.tc.base * 60000, inc: o.tc.inc * 1000, t0: 0 } : null;
    this.play = o;
    this.lob.hidden = true;
    this.box.querySelector('.cx')?.remove();
    this.box.insertAdjacentHTML('beforeend', this.viewHTML(o));
    this.view = this.box.querySelector('.cx');
    this.boardEl = this.view.querySelector('.cx-board');
    this.view.classList.toggle('no-dots', !this.opts.hints);
    this.view.classList.toggle('no-coords', !this.opts.coords);
    this.bindView();
    this.renderBoard();
    this.paint();
    this.ro?.disconnect();
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.view);
    requestAnimationFrame(() => { this.layout(); if (!isFull(this.root)) this.view?.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    sfx.unlock?.();
    if (musicOn?.()) this.music.start?.();
    if (o.mode === 'solo') {
      this.say(this.my === 'w' ? 'Les blancs commencent : à toi de jouer !' : `${o.opp.name} a les blancs et commence.`);
      if (this.clock) this.startClock();
      this.maybeBot();
    }
  }
  viewHTML(o) {
    const opp = o.opp, meName = o.names[this.my], sq = Array.from({ length: 64 }, (_, i) => `<i class="cx-sq ${((i >> 3) + (i & 7)) & 1 ? 'd' : 'l'}" data-i="${i}"></i>`).join('');
    const files = 'abcdefgh', fl = this.my === 'b' ? [...files].reverse() : [...files], rk = this.my === 'b' ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
    const solo = o.mode === 'solo';
    const tc = o.tc ? `${o.tc.n} · ${tcTxt(o.tc)}` : 'Sans pendule';
    const myAv = this.myAv();
    const clk = (side, who) => `<div class="cx-clock" data-c="${side}"><small>${who} · ${side === 'w' ? 'BLANCS' : 'NOIRS'}</small><div>${ICON.clock}<b>${o.tc ? fmtClock(o.tc.base * 60000) : '∞'}</b></div><em>${o.tc ? `+${o.tc.inc} s par coup` : 'sans limite de temps'}</em></div>`;
    const oc = this.my === 'w' ? 'b' : 'w';
    return `<div class="cx" data-m="pc">
      <header class="cx-top">
        <button type="button" class="cx-sq2 cx-burger" data-a="menu" aria-label="Menu">${ICON.menu}</button>
        <div class="cx-logo"><img src="${ASSET}wK.webp" alt=""><span><b>LES ÉCHECS</b><small>SALON PRIVÉ SPINBET</small></span></div>
        <div class="cx-tp-opp"><span class="cx-av sm">${opp.av}</span><span><b>${esc(opp.name)}</b><small>${esc(opp.sub)}</small></span></div>
        <div class="cx-tp-clocks"><div class="cx-tclk opp" data-c="${oc}"><b>${o.tc ? fmtClock(o.tc.base * 60000) : '∞'}</b><small>${oc === 'w' ? 'BLANCS' : 'NOIRS'}</small></div><div class="cx-tclk me" data-c="${this.my}"><b>${o.tc ? fmtClock(o.tc.base * 60000) : '∞'}</b><small>${this.my === 'w' ? 'BLANCS' : 'NOIRS'}</small></div></div>
        <div class="cx-tp-mode">${ICON.crown}<span><b>${solo ? LEVELS[o.lvl].n : 'Entre amis'}</b><small>${esc(tc)}</small></span></div>
        <div class="cx-tp-bal"><i></i><b class="cx-balv"></b></div>
        <button type="button" class="cx-sq2" data-act="full" aria-label="Plein écran">⛶<span>Plein écran</span></button>
      </header>
      <aside class="cx-left">
        <div class="cx-card cx-pl"><span class="cx-av lg">${myAv}</span><div><b>${esc(meName)}</b><small>${solo ? 'Joueur SpinBet' : 'Toi'}</small><em>${ICON.crown} ${solo ? this.elo() : this.my === 'w' ? 'Blancs' : 'Noirs'}</em></div></div>
        <div class="cx-card cx-balc"><small>SOLDE</small><div><b class="cx-balv"></b><a href="#recharger" aria-label="Recharger">+</a></div></div>
        <div class="cx-card cx-modec"><small>MODE DE JEU</small><div>${ICON.crown}<span><b>${solo ? `${LEVELS[o.lvl].n} · ${opp.name}` : o.stake ? `Mise ${fmt(o.stake)}` : 'Pour l’honneur'}</b><small>${esc(tc)}</small></span></div></div>
        <div class="cx-card cx-stc"><small>STATISTIQUES</small>${this.statsRows()}</div>
        <div class="cx-card cx-links"><button type="button" data-a="settings">${ICON.gear}Réglages</button><button type="button" data-a="rules">${ICON.book}Règles</button><button type="button" data-a="quit">${ICON.flag}Quitter la partie</button></div>
      </aside>
      <main class="cx-mid">
        <div class="cx-strip opp"><span class="cx-av sm">${opp.av}</span><b>${esc(opp.name)}</b><small>${esc(opp.sub)}</small><span class="cx-capt" data-cap="${this.my}"></span></div>
        <div class="cx-bw">
          <div class="cx-frame"><div class="cx-board">${sq}<div class="cx-pcs"></div><svg class="cx-arrow" viewBox="0 0 8 8" preserveAspectRatio="none"></svg><div class="cx-promo" hidden></div></div>
            <div class="cx-files">${fl.map((f) => `<span>${f}</span>`).join('')}</div><div class="cx-files t">${fl.map((f) => `<span>${f}</span>`).join('')}</div>
            <div class="cx-ranks">${rk.map((r) => `<span>${r}</span>`).join('')}</div><div class="cx-ranks r">${rk.map((r) => `<span>${r}</span>`).join('')}</div></div>
          <div class="cx-moves"><h4>COUPS</h4><ol class="cx-ml"></ol><button type="button" class="cx-pgn" data-a="copy">⤓ Copier la partie</button></div>
        </div>
        <div class="cx-strip me"><span class="cx-av sm">${myAv}</span><b>${esc(meName)}</b><small>${solo ? `ELO ${this.elo()}` : 'Toi'}</small><span class="cx-capt" data-cap="${oc}"></span></div>
        <div class="cx-acts">
          <button type="button" class="cx-b" data-a="undo">${ICON.undo}<span><b>ANNULER</b><small>${solo ? '1 aide' : 'en solo'}</small></span></button>
          <button type="button" class="cx-b gold" data-a="best">${ICON.knight}<span><b>MEILLEUR COUP</b><small>${solo ? '1 aide' : 'en solo'}</small></span></button>
          <button type="button" class="cx-b" data-a="draw">${ICON.draw}<span><b>PROPOSER NULLE</b></span></button>
          <button type="button" class="cx-b red" data-a="resign">${ICON.flag}<span><b>ABANDONNER</b></span></button>
        </div>
        <div class="cx-status"><span class="cx-say"></span><span class="cx-el">${ICON.clock}<b>00:00</b></span></div>
        <nav class="cx-pbar">
          <button type="button" class="cx-pb gold" data-a="sheet">${ICON.knight}<b>COUPS</b></button>
          <button type="button" class="cx-pb" data-a="undo">${ICON.undo}<b>ANNULER</b></button>
          <button type="button" class="cx-pb red" data-a="resign">${ICON.flag}<b>ABANDON</b></button>
          <button type="button" class="cx-pb" data-a="settings">${ICON.gear}<b>RÉGLAGES</b></button>
        </nav>
      </main>
      <aside class="cx-right">
        <div class="cx-card cx-pl"><span class="cx-av lg">${opp.av}</span><div><b>${esc(opp.name)}</b><small>${esc(solo ? `Ordinateur · ${LEVELS[o.lvl].n}` : 'Ton ami')}</small><em>${ICON.crown} ${solo ? opp.elo : oc === 'w' ? 'Blancs' : 'Noirs'}</em></div></div>
        ${clk(oc, solo ? 'ADVERSAIRE' : 'TON AMI')}${clk(this.my, 'TOI')}
        <div class="cx-card cx-ana"><small>ANALYSE</small><div class="cx-anav"><span>Avantage</span><b>0,0</b></div><svg class="cx-graph" viewBox="0 0 100 40" preserveAspectRatio="none"></svg></div>
        <div class="cx-card cx-aids"><small>AIDES <b class="cx-aidn"></b></small>
          <button type="button" class="cx-qb" data-a="best">${ICON.crown}MEILLEUR COUP</button>
          <button type="button" class="cx-qb" data-a="book">${ICON.book}COUP D’OUVERTURE</button>
          <button type="button" class="cx-qb" data-a="tactic">${ICON.target}COUP TACTIQUE</button>
        </div>
      </aside>
      <div class="cx-sheet" hidden><div class="cx-sheet-in"><header><b>Coups de la partie</b><button type="button" data-a="sheet" aria-label="Fermer">✕</button></header><ol class="cx-ml"></ol>
        <div class="cx-sheet-acts"><button type="button" class="cx-qb" data-a="best">${ICON.crown}MEILLEUR COUP</button><button type="button" class="cx-qb" data-a="book">${ICON.book}OUVERTURE</button><button type="button" class="cx-qb" data-a="tactic">${ICON.target}TACTIQUE</button><button type="button" class="cx-qb" data-a="draw">${ICON.draw}NULLE</button><button type="button" class="cx-qb" data-a="copy">⤓ COPIER</button></div>
        <small class="cx-sheet-aid muted"></small></div></div>
      <div class="cx-over" hidden></div>
    </div>`;
  }
  myAv() {
    const prof = __mods['profile.js']?.profiles?.current, look = __mods['shop.js']?.publicLook?.(prof);
    const html = look ? __mods['shop.js']?.lookHTML?.(look, 'md') : '';
    const name = this.me()?.name || prof?.name || 'Toi';
    return html || `<span class="cx-ini">${esc(String(name).charAt(0).toUpperCase())}</span>`;
  }
  statsRows() {
    const s = this.stats();
    return `<div class="cx-row"><span>Aujourd’hui</span><b>${s.todayW} / ${s.today}</b></div><div class="cx-row"><span>Victoires</span><b class="g">${s.games ? ((s.wins / s.games) * 100).toFixed(1).replace('.', ',') : '0,0'} %</b></div><div class="cx-row"><span>Série en cours</span><b class="y">${s.streak}</b></div>`;
  }
  bindView() {
    const V = this.view;
    V.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
      sfx.unlock?.();
      this.action(b.dataset.a);
    });
    V.querySelector('[data-act="full"]').addEventListener('click', () => { sfx.click?.(); toggleFull(this.root); });
    const B = this.boardEl;
    B.addEventListener('pointerdown', (e) => this.down(e));
    B.addEventListener('pointermove', (e) => this.move(e));
    B.addEventListener('pointerup', (e) => this.up(e));
    B.addEventListener('pointercancel', () => this.cancelDrag());
    B.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ----- mise en page : ordinateur, téléphone, téléphone couché ----- */
  layout() {
    const V = this.view; if (!V || this.dead) return;
    const W = V.clientWidth, full = !!this.root.closest('.is-full');
    const H = full ? V.clientHeight : innerHeight;
    const land = W > H * 1.2 && H < 620, mode = W >= 760 && !land ? 'pc' : land ? 'land' : 'phone';
    if (V.dataset.m !== mode) V.dataset.m = mode;
    V.classList.toggle('tab', mode === 'pc' && W < 1100); // medium screens: no left column
    const top = V.querySelector('.cx-top').offsetHeight || 56, fr = parseFloat(getComputedStyle(V).getPropertyValue('--fr')) || 20;
    let bs;
    if (mode === 'pc') {
      const mid = V.querySelector('.cx-mid'), mw = mid.clientWidth;
      const hAvail = (full ? H : Math.max(620, Math.min(innerHeight - 90, 980))) - top - 2 * fr - 150;
      bs = Math.min(mw - 160, hAvail);
      V.style.height = full ? '' : `${Math.round(Math.min(Math.max(620, innerHeight - 90), 980))}px`;
    } else if (mode === 'land') {
      bs = H - top - 2 * fr - 26;
      V.style.height = full ? '' : `${Math.round(H)}px`;
    } else {
      const strips = 2 * 40, bar = 74;
      bs = Math.min(W - 2 * fr - 22, (full ? H : innerHeight - 70) - top - strips - bar - 2 * fr - 60);
      V.style.height = '';
    }
    bs = Math.max(240, Math.floor(bs / 8) * 8);
    V.style.setProperty('--bs', `${bs}px`);
  }

  /* ----- l'échiquier ----- */
  disp(s) { const f = s & 7, r = s >> 4; return this.my === 'b' ? [7 - f, 7 - r] : [f, r]; }
  sqAt(x, y) { const f = this.my === 'b' ? 7 - x : x, r = this.my === 'b' ? 7 - y : y; return r * 16 + f; }
  renderBoard() {
    const L = this.view.querySelector('.cx-pcs');
    L.innerHTML = '';
    this.pcs = new Map();
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = this.S.b[s]; if (p) this.addPiece(s, p);
    }
    this.marks();
  }
  addPiece(s, p) {
    const d = document.createElement('div');
    d.className = `cx-pc ${E.isW(p) ? 'w' : 'b'}`;
    d.innerHTML = `<img src="${PIC(p)}" alt="" draggable="false">`;
    d.dataset.p = p;
    this.place(d, s);
    this.view.querySelector('.cx-pcs').appendChild(d);
    this.pcs.set(s, d);
    return d;
  }
  place(d, s) { const [x, y] = this.disp(s); d.style.setProperty('--x', x); d.style.setProperty('--y', y); d.style.zIndex = 10 + y; }
  // highlights: last move, selection, possible moves, king in check, hint arrow
  marks() {
    const sqs = this.boardEl.querySelectorAll('.cx-sq');
    sqs.forEach((q) => { q.className = q.className.replace(/ (last|sel|dot|cap|chk)\b/g, ''); });
    const at = (s) => { const [x, y] = this.disp(s); return sqs[y * 8 + x]; };
    const last = this.S.hist[this.S.hist.length - 1]?.m;
    if (last) { at(last.f).classList.add('last'); at(last.t).classList.add('last'); }
    if (this.sel >= 0) {
      at(this.sel).classList.add('sel');
      for (const m of this.targets) at(m.t).classList.add(m.c ? 'cap' : 'dot');
    }
    if (E.inCheck(this.S)) at(this.S.kings[this.S.turn]).classList.add('chk');
    const A = this.view.querySelector('.cx-arrow');
    if (this.hint) {
      const [x1, y1] = this.disp(this.hint.f), [x2, y2] = this.disp(this.hint.t);
      A.innerHTML = `<defs><marker id="cxah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.2" markerHeight="2.2" orient="auto"><path d="M0 0L10 5L0 10z" fill="#f5c542"/></marker></defs><line x1="${x1 + 0.5}" y1="${y1 + 0.5}" x2="${x2 + 0.5 - (x2 - x1) * 0.12}" y2="${y2 + 0.5 - (y2 - y1) * 0.12}" stroke="#f5c542" stroke-width=".16" stroke-linecap="round" marker-end="url(#cxah)" opacity=".92"/>`;
    } else A.innerHTML = '';
  }
  myTurn() { return !this.over && this.S.turn === this.my && !this.busy && !(this.mode === 'online' && !this.liveOk); }
  sqFromEvent(e) {
    const r = this.boardEl.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width) * 8), y = Math.floor(((e.clientY - r.top) / r.height) * 8);
    if (x < 0 || y < 0 || x > 7 || y > 7) return -1;
    return this.sqAt(x, y);
  }
  select(s) {
    this.sel = s;
    this.targets = s >= 0 ? E.legal(this.S).filter((m) => m.f === s) : [];
    this.pcs.forEach((d, k) => d.classList.toggle('up', k === s));
    this.marks();
  }
  down(e) {
    if (e.button > 0) return;
    const s = this.sqFromEvent(e); if (s < 0) return;
    sfx.unlock?.();
    const p = this.S.b[s];
    if (this.sel >= 0 && this.targets.some((m) => m.t === s)) { this.tryMove(this.sel, s); return; }
    if (p && E.isW(p) === (this.my === 'w') && this.myTurn()) {
      this.select(s);
      const d = this.pcs.get(s); if (!d) return;
      const r = this.boardEl.getBoundingClientRect();
      this.drag = { s, d, x0: e.clientX, y0: e.clientY, sz: r.width / 8, on: false, id: e.pointerId };
      try { this.boardEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    this.select(-1);
  }
  move(e) {
    const D = this.drag; if (!D || e.pointerId !== D.id) return;
    const dx = e.clientX - D.x0, dy = e.clientY - D.y0;
    if (!D.on && Math.hypot(dx, dy) < 6) return;
    D.on = true;
    D.d.classList.add('drag');
    D.d.style.translate = `${dx}px ${dy}px`;
    e.preventDefault();
  }
  up(e) {
    const D = this.drag; if (!D || e.pointerId !== D.id) return;
    this.drag = null;
    if (!D.on) return;
    const s = this.sqFromEvent(e);
    D.d.classList.remove('drag');
    if (s >= 0 && s !== D.s && this.targets.some((m) => m.t === s)) { D.d.classList.add('fast'); D.d.style.translate = ''; this.tryMove(D.s, s, true); }
    else { D.d.style.translate = ''; }
  }
  cancelDrag() { const D = this.drag; if (D) { D.d.classList.remove('drag'); D.d.style.translate = ''; } this.drag = null; }
  async tryMove(f, t, dragged) {
    const ms = this.targets.filter((m) => m.f === f && m.t === t);
    if (!ms.length) return;
    let m = ms[0];
    if (ms.length > 1) { // promotion: the player picks the piece
      const pr = await this.pickPromo(t);
      if (!pr) { this.select(-1); return; }
      m = ms.find((x) => x.pr.toLowerCase() === pr) || ms[0];
    }
    this.select(-1);
    this.hint = null;
    this.doMove(m, { dragged, mine: true });
  }
  pickPromo(t) {
    return new Promise((res) => {
      const P = this.view.querySelector('.cx-promo'), [x, y] = this.disp(t), w = this.my === 'w';
      P.hidden = false;
      P.style.setProperty('--x', x); P.style.setProperty('--y', y > 3 ? y - 3 : y);
      P.innerHTML = 'qrbn'.split('').map((k) => `<button type="button" data-pr="${k}"><img src="${PIC(w ? k.toUpperCase() : k)}" alt=""></button>`).join('');
      P.onpointerdown = (e) => { e.stopPropagation(); const b = e.target.closest('[data-pr]'); P.hidden = true; res(b ? b.dataset.pr : null); };
    });
  }
  // plays m on the board: the piece slides (or lands where it was dropped), captures fly out, the clocks turn
  doMove(m, { dragged, mine, quiet } = {}) {
    const S = this.S, san = E.san(S, m), u = E.uci(m), mover = S.turn;
    if (this.clock && !this.clock.offline) this.stampClock(mover);
    E.make(S, m);
    this.ucis.push(u); this.sans.push(san); this.poss.push(E.key(S));
    // pieces on the screen
    const cap = m.k === 'e' ? m.t + (mover === 'w' ? 16 : -16) : m.c ? m.t : -1;
    if (cap >= 0) { const c = this.pcs.get(cap); if (c) { this.pcs.delete(cap); c.classList.add('gone'); setTimeout(() => c.remove(), 420); } }
    const d = this.pcs.get(m.f);
    if (d) {
      this.pcs.delete(m.f); this.pcs.set(m.t, d);
      d.classList.toggle('fast', !!dragged);
      this.place(d, m.t);
      if (m.pr) setTimeout(() => { d.querySelector('img').src = PIC(m.pr); d.dataset.p = m.pr; d.classList.add('promo'); }, dragged ? 0 : 230);
      if (!quiet) { d.classList.remove('land'); void d.offsetWidth; d.classList.add('land'); }
    }
    if (m.k === 'K' || m.k === 'Q') { const rf = m.k === 'K' ? m.t + 1 : m.t - 2, rt = m.k === 'K' ? m.t - 1 : m.t + 1, r = this.pcs.get(rf); if (r) { this.pcs.delete(rf); this.pcs.set(rt, r); this.place(r, rt); } }
    if (!quiet) setTimeout(() => { if (!this.dead) tock(cap >= 0); }, dragged ? 0 : 200);
    this.marks();
    this.paint();
    if (E.inCheck(S) && !quiet) setTimeout(() => { if (!this.dead) sfx.tick?.(); }, 260);
    const end = this.ended();
    if (end) { this.finish(end); return; }
    if (mine && this.mode === 'online') this.sendMove();
    if (this.mode === 'solo') this.maybeBot();
    else this.say(S.turn === this.my ? 'À toi de jouer' : 'Au tour de ton ami…');
  }
  // checkmate, stalemate and the draws
  ended() {
    const S = this.S, ms = E.legal(S);
    if (!ms.length) return E.inCheck(S) ? { win: S.turn === 'w' ? 'b' : 'w', why: 'mate' } : { win: '', why: 'stale' };
    if (E.noMaterial(S)) return { win: '', why: 'mat' };
    if (S.half >= 100) return { win: '', why: 'fifty' };
    const k = this.poss[this.poss.length - 1];
    if (this.poss.filter((x) => x === k).length >= 3) return { win: '', why: 'rep' };
    return null;
  }

  /* ----- l'ordinateur ----- */
  async maybeBot() {
    if (this.over || this.S.turn === this.my || this.mode !== 'solo' || this.busy) return;
    const L = LEVELS[this.cfg.lvl], tok = (this.tok = (this.tok || 0) + 1), t0 = performance.now();
    this.busy = true;
    this.view.classList.add('thinking');
    this.say(`${L.bot} réfléchit…`);
    let u = null, sc = null;
    const book = this.ucis.length < 8 && L.elo >= 1200 ? BOOK[this.ucis.join(' ')] : null;
    if (book && Math.random() < 0.85) u = book[Math.floor(Math.random() * book.length)];
    if (!u) {
      const r = await think(E.fen(this.S), L.o);
      if (this.dead || tok !== this.tok) return;
      u = r?.move; sc = r?.score;
      if (!u) { const ms = E.legal(this.S); u = ms.length ? E.uci(ms[Math.floor(Math.random() * ms.length)]) : null; }
    }
    // a human-like pause: never instant, longer in a hard position
    const min = 450 + Math.random() * 700 * (1 + this.cfg.lvl * 0.3), wait = min - (performance.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (this.dead || tok !== this.tok || this.over) return;
    this.busy = false;
    this.view.classList.remove('thinking');
    const m = u && E.findUci(this.S, u);
    if (!m) return;
    this.pushEval(sc);
    this.doMove(m, {});
    if (!this.over) this.say(`${this.S.hist.length > 0 ? `${L.bot} a joué ${this.sans[this.sans.length - 1]}. ` : ''}À toi !`);
  }
  // the advantage of the player (white's view converted): the bot's score is for the side it played
  pushEval(sc) {
    if (sc === null || sc === undefined) return;
    this.evals.push(Math.max(-99999, Math.min(99999, -sc)));
    this.paintEval();
  }
  paintEval() {
    const A = this.view.querySelector('.cx-ana'); if (!A) return;
    const ev = this.evals, last = ev[ev.length - 1] || 0;
    const big = Math.abs(last) > 90000 ? (last > 0 ? 'Mat pour toi' : 'Mat contre toi') : `${last >= 0 ? '+' : '−'}${(Math.abs(last) / 100).toFixed(2).replace('.', ',')}`;
    A.querySelector('.cx-anav b').textContent = big;
    A.querySelector('.cx-anav b').className = last > 30 ? 'g' : last < -30 ? 'r' : '';
    const n = Math.max(2, ev.length), pts = ev.map((v, i) => `${(i / (n - 1)) * 100},${20 - Math.max(-18, Math.min(18, v / 40))}`).join(' ');
    A.querySelector('.cx-graph').innerHTML = `<line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,.15)" stroke-width=".5"/><polyline points="0,40 ${pts} 100,40" fill="url(#cxg)" stroke="none"/><polyline points="${pts}" fill="none" stroke="#f5c542" stroke-width="1" vector-effect="non-scaling-stroke"/><defs><linearGradient id="cxg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5c542" stop-opacity=".35"/><stop offset="1" stop-color="#f5c542" stop-opacity="0"/></linearGradient></defs>`;
  }

  /* ----- les actions ----- */
  async action(a) {
    sfx.click?.();
    const solo = this.mode === 'solo';
    if (a === 'menu') return this.menu();
    if (a === 'settings') return this.settings();
    if (a === 'rules') return modal(`<h3>Les Échecs — règles</h3>${this.rulesHTML()}`, { cls: 'wide' });
    if (a === 'sheet') { const sh = this.view.querySelector('.cx-sheet'); sh.hidden = !sh.hidden; return; }
    if (a === 'copy') return this.copy();
    if (a === 'quit') return this.quit();
    if (this.over) return;
    if (a === 'resign') {
      const v = await modal(`<div class="cx-ask"><h3>Abandonner la partie ?</h3><p>${this.mode === 'online' && this.cfg.stake ? `Ton ami gagne la cagnotte de <b>${fmt(this.cfg.stake * 2)}</b>.` : 'La partie est perdue.'}</p><div class="fo-acts"><button class="btn primary" data-value="ok">Abandonner</button><button class="btn ghost" data-value="no">Continuer</button></div></div>`);
      if (v === 'ok' && !this.over) this.resign();
      return;
    }
    if (a === 'draw') return this.offerDraw();
    if (!solo) return toast('Les aides et l’annulation sont réservées aux parties contre l’ordinateur', 'info');
    if (a === 'undo') return this.undo();
    if (a === 'best' || a === 'book' || a === 'tactic') return this.help(a);
  }
  useAid() {
    if (this.aids <= 0) { toast('Plus d’aide pour cette partie', 'warn'); return false; }
    this.aids--; this.paint(); return true;
  }
  undo() {
    if (this.busy) return toast('Attends que l’ordinateur ait joué', 'info');
    const n = this.S.turn === this.my ? 2 : 1;
    if (this.S.hist.length < n || (n === 2 && this.S.hist.length < 2)) return toast('Aucun coup à annuler', 'info');
    if (!this.useAid()) return;
    for (let i = 0; i < n; i++) { E.unmake(this.S); this.ucis.pop(); this.sans.pop(); this.poss.pop(); }
    if (n === 2 && this.evals.length > 1) this.evals.pop();
    this.hint = null; this.select(-1);
    this.renderBoard(); this.paint(); this.paintEval();
    this.say('Coup annulé : à toi de jouer.');
  }
  async help(kind) {
    if (this.S.turn !== this.my || this.busy) return toast('Attends ton tour', 'info');
    if (kind === 'book') {
      const b = BOOK[this.ucis.join(' ')];
      if (!b) return toast('Plus de coup d’ouverture connu dans cette position', 'info');
      if (!this.useAid()) return;
      const m = E.findUci(this.S, b[0]); this.hint = m; this.marks(); this.say(`Coup d’ouverture : ${E.san(this.S, m)}`); return;
    }
    if (!this.useAid()) return;
    this.say('Recherche du coup…');
    const r = await think(E.fen(this.S), { depth: 5, time: 1200 });
    if (this.dead || !r?.best) return;
    let m = E.findUci(this.S, r.best);
    if (kind === 'tactic') { // the best capture, check or promotion, else the best move
      const ms = E.legal(this.S).filter((x) => x.c || x.pr || (E.make(this.S, x), (() => { const c = E.inCheck(this.S); E.unmake(this.S); return c; })()));
      if (ms.some((x) => E.uci(x) === r.best)) m = E.findUci(this.S, r.best);
      else if (ms.length) { ms.sort((a, b) => (b.c ? 10 * ({ p: 1, n: 3, b: 3, r: 5, q: 9 })[b.c.toLowerCase()] : 0) - (a.c ? 10 * ({ p: 1, n: 3, b: 3, r: 5, q: 9 })[a.c.toLowerCase()] : 0)); m = ms[0]; }
    }
    this.hint = m; this.marks();
    this.say(`${kind === 'tactic' ? 'Coup tactique' : 'Meilleur coup'} : ${E.san(this.S, m)}`);
  }
  async offerDraw() {
    if (this.mode === 'solo') {
      const ev = this.evals[this.evals.length - 1] || 0, L = LEVELS[this.cfg.lvl];
      if (this.S.hist.length < 20) return this.say(`${L.bot} refuse la nulle : la partie vient de commencer.`);
      if (ev < -60 || (ev < 40 && Math.random() < 0.5)) return this.say(`${L.bot} refuse la nulle.`);
      return this.finish({ win: '', why: 'agree' });
    }
    if (this.drawAsked) return toast('Nulle déjà proposée', 'info');
    this.drawAsked = true;
    this.FD.update(this.room.id, { dr: this.me()?.uid || '' }).catch(() => toast('Proposition impossible pour le moment', 'warn'));
    this.say('Nulle proposée : en attente de la réponse de ton ami…');
  }
  resign() { this.finish({ win: this.my === 'w' ? 'b' : 'w', why: 'resign', me: true }); }
  async quit() {
    if (!this.over && this.mode === 'solo' && this.S.hist.length > 1) {
      const v = await modal('<div class="cx-ask"><h3>Quitter la partie ?</h3><p>Elle compte comme une défaite.</p><div class="fo-acts"><button class="btn primary" data-value="ok">Quitter</button><button class="btn ghost" data-value="no">Rester</button></div></div>');
      if (v !== 'ok') return;
      this.record('lose', LEVELS[this.cfg.lvl].elo);
    }
    this.close();
  }
  close() {
    this.tok = (this.tok || 0) + 1;
    this.stopClock();
    this.unwatch?.(); this.unwatch = null; clearInterval(this.joinT);
    this.ro?.disconnect();
    this.view?.remove(); this.view = null; this.play = null; this.online = false; this.room = null; this.busy = false;
    if (isFull(this.root)) setFull(this.root, false);
    removeEventListener('beforeunload', this.onUnload);
    this.lob.hidden = false;
    this.lobby();
  }
  async copy() {
    let out = '';
    this.sans.forEach((s, i) => { out += `${i % 2 ? '' : `${(i >> 1) + 1}. `}${s} `; });
    out = out.replace(/[♔♕♖♗♘]/g, (c) => ({ '♔': 'K', '♕': 'Q', '♖': 'R', '♗': 'B', '♘': 'N' })[c]).trim() || '(aucun coup)';
    try { await navigator.clipboard.writeText(out); toast('Partie copiée (notation PGN)', 'ok'); } catch { toast(out, 'info'); }
  }
  menu() {
    const sh = this.view.querySelector('.cx-sheet');
    modal(`<div class="cx-menu"><h3>Les Échecs</h3>
      <button class="btn" data-value="settings">⚙️ Réglages</button><button class="btn" data-value="rules">📖 Règles</button>
      ${this.mode === 'solo' ? '<button class="btn" data-value="undo">↩️ Annuler mon coup (1 aide)</button>' : ''}
      <button class="btn" data-value="draw">🤝 Proposer nulle</button><button class="btn" data-value="copy">⤓ Copier la partie</button>
      <button class="btn ghost" data-value="quit">🚪 ${this.over ? 'Retour à l’accueil des échecs' : this.mode === 'online' ? 'Revenir plus tard (la partie continue)' : 'Quitter la partie'}</button></div>`, { cls: 'cx-menu-m' }).then((v) => { if (v) { if (sh) sh.hidden = true; this.action(v); } });
  }
  async settings() {
    const toggles = [
      { icon: '🎵', label: 'Musique', on: musicOn(), toggle: () => { this.music.setEnabled(!musicOn()); return musicOn(); } },
      { icon: '🔊', label: 'Effets sonores', on: !isMuted(), toggle: () => { setMuted(!isMuted()); return !isMuted(); } },
      { icon: '🟡', label: 'Montrer les coups possibles', on: this.opts.hints, toggle: () => { this.opts.hints = !this.opts.hints; LS.set('spinbet_echecs_dots', this.opts.hints ? 1 : 0); this.view?.classList.toggle('no-dots', !this.opts.hints); return this.opts.hints; } },
      { icon: '🔤', label: 'Lettres et chiffres autour', on: this.opts.coords, toggle: () => { this.opts.coords = !this.opts.coords; LS.set('spinbet_echecs_coords', this.opts.coords ? 1 : 0); this.view?.classList.toggle('no-coords', !this.opts.coords); return this.opts.coords; } },
    ];
    const r = await gameMenu({ title: 'Les Échecs', buys: [], toggles });
    if (r?.type === 'info') this.action('rules');
  }
  keys(e) {
    if (!this.view || e.target.closest?.('input, textarea') || document.querySelector('.modal-back')) return;
    if (e.key === 'Escape' && this.sel >= 0) this.select(-1);
  }

  /* ----- l'affichage : coups, pendules, tours, aides ----- */
  say(t) { const s = this.view?.querySelector('.cx-say'); if (s) s.textContent = t; }
  paint() {
    const V = this.view; if (!V) return;
    const S = this.S, n = S.hist.length;
    const rows = []; for (let i = 0; i < this.sans.length; i += 2) rows.push(`<li${i >= this.sans.length - 2 ? ' class="cur"' : ''}><em>${(i >> 1) + 1}.</em><span>${this.sans[i]}</span><span>${this.sans[i + 1] || ''}</span></li>`);
    const empty = Array.from({ length: Math.max(0, 8 - rows.length) }, () => '<li class="e"><em></em><span>—</span><span>—</span></li>').join('');
    V.querySelectorAll('.cx-ml').forEach((ol) => { ol.innerHTML = rows.join('') + empty; ol.scrollTop = ol.scrollHeight; });
    V.querySelectorAll('.cx-balv').forEach((b) => { b.textContent = fmt(wallet.balance); });
    const turnTxt = this.over ? 'Partie terminée' : S.turn === this.my ? 'À toi de jouer' : this.mode === 'solo' ? `Au tour de ${this.cfg.opp.name}` : 'Au tour de ton ami';
    V.dataset.turn = S.turn === this.my ? 'me' : 'opp';
    V.querySelectorAll('.cx-clock, .cx-tclk').forEach((c) => c.classList.toggle('on', !this.over && c.dataset.c === S.turn));
    // captured pieces: what each side took, and the material lead
    const all = { w: 'PPPPPPPPNNBBRRQ', b: 'ppppppppnnbbrrq' }, have = { w: '', b: '' };
    for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = S.b[s]; if (p && E.lo(p) !== 'k') have[E.isW(p) ? 'w' : 'b'] += p; }
    const lost = (c) => { let r = all[c]; for (const p of have[c]) r = r.replace(p, ''); return r; };
    const val = { p: 1, n: 3, b: 3, r: 5, q: 9 }, sum = (str) => [...str].reduce((a, p) => a + val[E.lo(p)], 0);
    const lw = lost('w'), lb = lost('b'), diff = sum(lb) - sum(lw);
    V.querySelectorAll('.cx-capt').forEach((c) => {
      const taken = c.dataset.cap === 'w' ? lb : lw, lead = c.dataset.cap === 'w' ? diff : -diff;
      c.innerHTML = [...taken].map((p) => `<img src="${PIC(p)}" alt="">`).join('') + (lead > 0 ? `<b>+${lead}</b>` : '');
    });
    const solo = this.mode === 'solo';
    V.querySelectorAll('.cx-aidn').forEach((x) => { x.textContent = solo ? `${this.aids} / ${AIDS}` : 'en solo'; });
    V.querySelector('.cx-sheet-aid').textContent = solo ? `Aides restantes : ${this.aids} / ${AIDS}` : 'Les aides sont réservées aux parties contre l’ordinateur.';
    V.querySelectorAll('[data-a="undo"], [data-a="best"], [data-a="book"], [data-a="tactic"]').forEach((b) => { b.disabled = !solo || this.over || this.aids <= 0; });
    V.querySelectorAll('[data-a="draw"], [data-a="resign"]').forEach((b) => { b.disabled = !!this.over || n < 2; });
    V.querySelectorAll('.cx-acts small').forEach((s) => { if (/aide|solo/.test(s.textContent)) s.textContent = solo ? `${this.aids} aide${this.aids > 1 ? 's' : ''}` : 'en solo'; });
    this.view.classList.toggle('online', this.mode === 'online');
    this.paintClocks();
    if (!this.over && !this.view.querySelector('.cx-say').textContent) this.say(turnTxt);
  }

  /* ----- pendules ----- */
  startClock() { this.stopClock(); this.clkT = setInterval(() => this.tickClock(), 100); this.paintClocks(); }
  stopClock() { clearInterval(this.clkT); this.clkT = null; }
  // solo: the time of the side that just moved stops, the increment is added
  stampClock(side) {
    const C = this.clock; if (!C || this.mode !== 'solo') return;
    const now = performance.now();
    if (C.t0) C[side] = Math.max(0, C[side] - (now - C.t0)) + C.inc;
    C.t0 = now;
  }
  left(side) {
    const C = this.clock; if (!C) return null;
    if (this.mode === 'online') {
      const D = this.doc, ck = D?.ck || [C.base, C.base], mtMs = D?.mtMs || 0, v = side === 'w' ? ck[0] : ck[1];
      return side === this.S.turn && mtMs && !this.over ? v - (this.FD.now() - mtMs) : v;
    }
    return side === this.S.turn && C.t0 && !this.over ? C[side] - (performance.now() - C.t0) : C[side];
  }
  paintClocks() {
    const V = this.view; if (!V) return;
    const el = this.S.hist.length ? Math.floor((Date.now() - (this.startAt || (this.startAt = Date.now()))) / 1000) : 0;
    V.querySelector('.cx-el b').textContent = `${String(Math.floor(el / 60)).padStart(2, '0')}:${String(el % 60).padStart(2, '0')}`;
    if (!this.clock) return;
    for (const c of ['w', 'b']) {
      const ms = this.left(c);
      V.querySelectorAll(`[data-c="${c}"] b`).forEach((b) => { b.textContent = fmtClock(ms); });
      V.querySelectorAll(`[data-c="${c}"]`).forEach((x) => x.classList.toggle('low', ms !== null && ms < 20000));
    }
  }
  tickClock() {
    if (this.dead || !this.view) return this.stopClock();
    this.paintClocks();
    if (this.over || !this.clock) return;
    const side = this.S.turn, ms = this.left(side);
    if (ms !== null && ms <= 0) {
      const other = side === 'w' ? 'b' : 'w';
      this.finish({ win: E.sideHasMate(this.S, other) ? other : '', why: 'time' });
    }
  }

  /* ----- fin de partie ----- */
  finish(r) {
    if (this.over) return;
    this.over = r;
    this.tok = (this.tok || 0) + 1; this.busy = false; this.view?.classList.remove('thinking');
    this.stopClock(); this.paintClocks();
    this.select(-1); this.hint = null; this.marks();
    this.paint();
    if (this.mode === 'online') { this.sendResult(r); return; }
    const res = !r.win ? 'tie' : r.win === this.my ? 'win' : 'lose', L = LEVELS[this.cfg.lvl];
    const d = this.record(res, L.elo);
    this.showOver(res, r, `<div class="cx-elo">${ICON.crown} Classement <b>${this.elo()}</b> <em class="${d >= 0 ? 'g' : 'r'}">${d >= 0 ? '+' : '−'}${Math.abs(d)}</em></div>`,
      `<button type="button" class="btn primary" data-o="again">♟ Rejouer contre ${esc(L.bot)}</button><button type="button" class="btn ghost" data-o="out">Changer d’adversaire</button>`);
  }
  showOver(res, r, extra, btns) {
    const O = this.view.querySelector('.cx-over');
    const title = res === 'win' ? 'Victoire !' : res === 'lose' ? 'Défaite' : res === 'void' ? 'Partie annulée' : 'Partie nulle';
    O.innerHTML = `<div class="cx-ov ${res}"><div class="cx-ov-k"><img src="${ASSET}${res === 'lose' ? (this.my === 'w' ? 'bK' : 'wK') : this.my === 'w' ? 'wK' : 'bK'}.webp" alt=""></div>
      <small>${esc(RES[r.why] || '')}${this.sans.length ? ` · ${Math.ceil(this.sans.length / 2)} coup${Math.ceil(this.sans.length / 2) > 1 ? 's' : ''}` : ''}</small><h2>${title}</h2>${extra || ''}<div class="fo-acts">${btns}</div></div>`;
    O.hidden = false;
    O.onclick = (e) => {
      const k = e.target.closest('[data-o]')?.dataset.o; if (!k) return;
      if (k === 'again') { if (this.mode === 'solo') this.startSolo(); }
      if (k === 'out') this.close();
      if (k === 'rev') this.revenge();
      if (k === 'see') O.hidden = true;
    };
    if (res === 'win') { try { fx.confetti(110); sfx.bigWin(); } catch { /* ignore */ } } else if (res === 'lose') sfx.reelStop?.(0); else sfx.win?.();
  }

  /* ================= en ligne (foot-defis.js, documents foot/{id}, ka = 20) ================= */
  whiteOf(d) { let h = 7; for (const c of d.id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h & 1 ? d.a : d.b; }
  enterRoom(id) {
    const d = this.FD?.get?.(id), me = this.me();
    if (!d || !me) return toast('Cette partie n’est plus disponible', 'warn');
    if (d.st !== 'go' && d.st !== 'live') return toast(d.st === 'wait' ? 'Ton ami n’a pas encore accepté' : 'Cette partie est terminée', 'info');
    if (this.view) this.close();
    this.room = { id, host: d.a === me.uid };
    this.lob.hidden = true;
    this.box.insertAdjacentHTML('beforeend', '<div class="fo-room cx-room"></div>');
    this.roomEl = this.box.lastElementChild;
    this.roomEl.onclick = (e) => { const b = e.target.closest('[data-r]'); if (!b) return; if (b.dataset.r === 'cancel') this.voidMatch(); if (b.dataset.r === 'back') { this.leaveRoom(); this.lobby(); } };
    this.FD.join(id).catch(() => {});
    clearInterval(this.joinT);
    this.joinT = setInterval(() => this.FD.join(id).catch(() => {}), 40000);
    this.roomPaint();
  }
  leaveRoom() { clearInterval(this.joinT); this.roomEl?.remove(); this.roomEl = null; if (!this.view) this.room = null; }
  async voidMatch() {
    const R = this.room; if (!R) return;
    try { await this.FD.result(R.id, { v: true }); } catch { /* the other side wrote first */ }
    this.leaveRoom(); this.lobby(); toast('Partie annulée : les mises sont rendues', 'info');
  }
  roomPaint() {
    const R = this.room; if (!R || !this.roomEl) return;
    const d = this.FD.get(R.id);
    if (!d) { this.roomEl.innerHTML = '<div class="fo-card"><p>Cette partie n’existe plus.</p><button type="button" class="btn primary" data-r="back">Retour</button></div>'; return; }
    if (d.r) { this.leaveRoom(); this.lobby(); toast(d.r.v ? 'Partie annulée : les mises sont rendues' : 'Cette partie est terminée', 'info'); return; }
    const here = R.host ? !!d.jb : !!d.ja, oname = R.host ? d.bn : d.an, wUid = this.whiteOf(d), tc = tcOf(d.d);
    // both players there: the host starts the game, then both boards open
    if (d.st === 'live' || (here && (d.ja && d.jb))) {
      if (R.host && d.st === 'go') this.FD.update(R.id, { st: 'live' }).catch(() => {});
      if (d.st === 'live' || R.host) { this.startOnline(d); return; }
    }
    this.roomEl.innerHTML = `<div class="fo-card fo-wait cx-wait">
      <small>♛ LES ÉCHECS · ${esc(tc.n.toUpperCase())} ${esc(tcTxt(tc))}</small>
      <div class="fo-vs"><span><img src="${ASSET}${wUid === d.a ? 'wK' : 'bK'}.webp" alt=""><b>${esc(d.an)}</b></span><em>VS</em><span><img src="${ASSET}${wUid === d.b ? 'wK' : 'bK'}.webp" alt=""><b>${esc(d.bn)}</b></span></div>
      <div class="fo-potbig"><small>Cagnotte</small><b>${d.s ? fmt(d.s * 2) : 'Pour l’honneur'}</b>${d.s ? `<small>le gagnant prend tout · nulle : ${fmt(d.s)} rendus à chacun</small>` : ''}</div>
      <p class="fo-status"><span class="fo-spin"></span>${here ? `${esc(oname)} est là, la partie commence…` : `En attente de ${esc(oname)}… (dis-lui d’ouvrir Les Échecs)`}</p>
      <div class="fo-acts"><button type="button" class="btn ghost" data-r="cancel">Annuler la partie (mises rendues)</button><button type="button" class="btn ghost" data-r="back">Retour</button></div>
    </div>`;
  }
  startOnline(d) {
    const me = this.me(), R = this.room;
    this.leaveRoom(); this.room = R;
    const my = this.whiteOf(d) === me.uid ? 'w' : 'b', tc = tcOf(d.d), oname = d.a === me.uid ? d.bn : d.an;
    this.online = true;
    this.begin({ mode: 'online', my, tc, stake: d.s || 0, names: { [my]: me.name, [my === 'w' ? 'b' : 'w']: oname }, opp: { name: oname, av: '♞', sub: `Ton ami · ${my === 'w' ? 'Noirs' : 'Blancs'}` } });
    this.liveOk = true;
    this.doc = d; this.applied = 0;
    this.onDoc(true);
    this.startClock();
    this.say(my === 'w' ? 'Tu as les blancs : à toi de commencer !' : `${oname} a les blancs et commence.`);
    addEventListener('beforeunload', this.onUnload = (e) => { if (this.online && !this.over) { e.preventDefault(); e.returnValue = ''; } });
  }
  // every change of the game's document: the friend's moves, a draw offer, the result
  onDoc(first) {
    if (!this.online || !this.room) return;
    const d = this.FD.get(this.room.id);
    if (!d) return;
    this.doc = d;
    const mv = (d.mv || '').split(' ').filter(Boolean);
    if (mv.length > this.ucis.length) {
      for (let i = this.ucis.length; i < mv.length; i++) {
        const m = E.findUci(this.S, mv[i]);
        if (!m) { console.warn('Échecs : coup refusé', mv[i]); break; }
        this.doMove(m, { quiet: !!first && i < mv.length - 1 });
        if (this.over) break;
      }
      if (first) this.renderBoard();
    }
    if (d.dr && d.dr !== this.me()?.uid && !this.over && !this.drawPop) {
      this.drawPop = true;
      modal(`<div class="cx-ask"><h3>Ton ami propose la nulle</h3><p>${d.s ? `Nulle = chacun récupère sa mise de ${fmt(d.s)}.` : 'La partie s’arrête sur un match nul.'}</p><div class="fo-acts"><button class="btn primary" data-value="ok">🤝 Accepter</button><button class="btn ghost" data-value="no">Refuser</button></div></div>`).then((v) => {
        this.drawPop = false;
        if (this.over) return;
        if (v === 'ok') this.finish({ win: '', why: 'agree' });
        else this.FD.update(this.room.id, { dr: '' }).catch(() => {});
      });
    }
    if (!d.dr && this.drawAsked && !this.over) { this.drawAsked = false; this.say('Ton ami a refusé la nulle.'); }
    if (d.r && !this.over) {
      const r = d.r, my = this.me()?.uid;
      const win = r.v ? '' : r.f ? (r.f === my ? (this.my === 'w' ? 'b' : 'w') : this.my) : r.a > r.b ? (this.whiteOf(d) === d.a ? 'w' : 'b') : r.b > r.a ? (this.whiteOf(d) === d.b ? 'w' : 'b') : '';
      const end = this.ended();
      this.over = { win, why: r.f ? 'resign' : end ? end.why : !win ? 'agree' : (this.left(this.S.turn) ?? 1) <= 500 ? 'time' : 'left', remote: true };
      this.stopClock(); this.paint();
      this.showOnlineOver(d);
    } else if (d.r && this.over && !this.shownOnline) this.showOnlineOver(d);
    this.paintClocks();
  }
  sendMove() {
    const R = this.room, d = this.doc, C = this.clock; if (!R) return;
    const ck = (d?.ck || [C.base, C.base]).slice(), side = this.S.turn === 'w' ? 'b' : 'w', i = side === 'w' ? 0 : 1;
    ck[i] = (d?.mtMs ? Math.max(0, ck[i] - (this.FD.now() - d.mtMs)) : ck[i]) + C.inc;
    this.doc = { ...(d || {}), ck, mtMs: this.FD.now(), mv: this.ucis.join(' ') };
    this.FD.update(R.id, { mv: this.ucis.join(' '), ck, mt: 'now' }).catch((e) => { console.error(e); toast('Coup non envoyé : vérifie ta connexion', 'warn'); });
  }
  sendResult(r) {
    const d = this.doc, my = this.me()?.uid;
    if (!d || this.over.remote) return this.showOnlineOver(d);
    const wUid = this.whiteOf(d), winUid = r.win ? (r.win === 'w' ? wUid : wUid === d.a ? d.b : d.a) : '';
    const res = r.why === 'resign' && r.me ? { a: 0, b: 0, f: my } : { a: winUid === d.a ? 1 : 0, b: winUid === d.b ? 1 : 0 };
    this.FD.result(this.room.id, res).catch(() => { /* the other phone wrote it first */ }).finally(() => setTimeout(() => this.showOnlineOver(this.FD.get(this.room?.id) || d), 400));
  }
  showOnlineOver(d) {
    if (this.shownOnline || !this.view) return;
    this.shownOnline = true;
    removeEventListener('beforeunload', this.onUnload);
    const r = this.over, res = d?.r?.v && !r.win ? 'void' : !r.win ? 'tie' : r.win === this.my ? 'win' : 'lose', s = d?.s || 0;
    const money = s ? `<div class="fo-money ${res}">${res === 'win' ? `+${fmt(s * 2)}` : res === 'lose' ? `−${fmt(s)}` : `${fmt(s)} rendus`}</div>` : '';
    this.showOver(res, r, `${money}<p class="muted small">Les gains arrivent sur ton solde dans un instant.</p>`,
      `<button type="button" class="btn primary" data-o="rev">⚔️ Revanche</button><button type="button" class="btn ghost" data-o="see">Voir l’échiquier</button><button type="button" class="btn ghost" data-o="out">Retour</button>`);
  }
  async revenge() {
    const d = this.doc, me = this.me(); if (!d || !me) return this.close();
    const other = d.a === me.uid ? { uid: d.b, name: d.bn } : { uid: d.a, name: d.an };
    try { await this.FD.create({ to: other.uid, toName: other.name, stake: d.s || 0, dur: d.d || 6, game: 'echecs' }); toast(`⚔️ Revanche proposée à ${esc(other.name)} !`, 'ok'); } catch (err) { toast(err?.message || 'Revanche impossible pour le moment', 'warn'); }
    this.close();
  }
}

return { EchecsGame, CHESS };
})();
