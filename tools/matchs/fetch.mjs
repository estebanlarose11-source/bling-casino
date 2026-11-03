// Les vrais matchs pour les paris pour rire (paris.js) : Ligue 1, Ligue des champions, Ligue Europa, Premier
// League, Liga, Serie A et NBA, lus sur le tableau des scores public d'ESPN (sans clé), d'hier à dans 6 jours.
// Écrit paris/matchs.json : { updated, matches: [{ id, sport, league, start, state, clock, home, away, score, odds }] }.
// Lancé par GitHub Actions (.github/workflows/matchs.yml), qui le range sur la branche « data » (le site le lit sur
// raw.githubusercontent.com, sans redéployer le site).
// Les cotes sont calculées ici, une fois pour toutes avant le match (gardées d'un passage à l'autre) : modèle de Poisson
// à partir du bilan des équipes, retour ≈ 95 % (0,95 ÷ probabilité).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = process.argv[2] || 'paris/matchs.json';
const LEAGUES = [
  ['soccer', 'fra.1', 'Ligue 1'], ['soccer', 'uefa.champions', 'Ligue des champions'], ['soccer', 'uefa.europa', 'Ligue Europa'],
  ['soccer', 'eng.1', 'Premier League'], ['soccer', 'esp.1', 'Liga'], ['soccer', 'ita.1', 'Serie A'], ['basketball', 'nba', 'NBA'],
];
const RTP = 0.95;
const day = (t) => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');

// strength from the season record ("W-D-L" for football, "W-L" for basketball)
function strength(rec, sport) {
  const n = String(rec || '').split('-').map(Number);
  if (sport === 'soccer' && n.length === 3 && n.every(Number.isFinite) && n[0] + n[1] + n[2] >= 3) {
    const ppg = (3 * n[0] + n[1]) / (n[0] + n[1] + n[2]);
    return Math.max(0.55, Math.min(1.7, ppg / 1.4));
  }
  if (sport === 'basketball' && n.length >= 2 && n[0] + n[1] >= 3) return Math.max(0.15, Math.min(0.85, (n[0] + 1) / (n[0] + n[1] + 2)));
  return sport === 'soccer' ? 1 : 0.5;
}
const pois = (l, k) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
const odd = (p) => Math.max(1.05, Math.min(60, Math.floor((RTP / Math.max(p, 0.005)) * 100) / 100));

function soccerOdds(sh, sa) {
  const lh = 1.45 * sh / Math.sqrt(sa), la = 1.15 * sa / Math.sqrt(sh);
  let p1 = 0, pn = 0, p2 = 0;
  const scores = {};
  for (let h = 0; h <= 10; h++) for (let a = 0; a <= 10; a++) {
    const p = pois(lh, h) * pois(la, a);
    if (h > a) p1 += p; else if (h === a) pn += p; else p2 += p;
    if (h <= 4 && a <= 4) scores[`${h}-${a}`] = odd(p);
  }
  return { '1': odd(p1), N: odd(pn), '2': odd(p2), scores };
}
function nbaOdds(sh, sa) {
  sh = 0.5 + (sh - 0.5) * 0.6; sa = 0.5 + (sa - 0.5) * 0.6; // early-season records say less than they seem
  const ph = Math.max(0.1, Math.min(0.9, (sh * (1 - sa)) / (sh * (1 - sa) + sa * (1 - sh)) + 0.03));
  return { '1': odd(ph), '2': odd(1 - ph) };
}

// one request per day (ESPN refuses long date ranges)
async function league([sport, code, name], days) {
  const out = [];
  for (const d of days) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${code}/scoreboard?dates=${d}`;
    const r = await fetch(url, { headers: { 'user-agent': 'SpinBet-matchs/1' } });
    if (!r.ok) { console.warn(`${name} ${d} : ${r.status} ${(await r.text()).slice(0, 120)}`); continue; }
    out.push(...parse(await r.json(), sport, code, name));
  }
  return out;
}

function parse(j, sport, code, name) {
  return (j.events || []).map((e) => {
    const c = e.competitions?.[0] || {}, teams = c.competitors || [];
    const H = teams.find((t) => t.homeAway === 'home') || teams[0], A = teams.find((t) => t.homeAway === 'away') || teams[1];
    if (!H || !A) return null;
    const st = e.status?.type || c.status?.type || {};
    const team = (t) => ({ name: t.team?.shortDisplayName || t.team?.displayName || '?', logo: t.team?.logo || '', rec: t.records?.[0]?.summary || '' });
    const m = {
      id: `${code}-${e.id}`, sport, league: name, start: Date.parse(e.date || c.date),
      state: st.state || 'pre', done: !!st.completed, clock: st.shortDetail || '',
      home: team(H), away: team(A),
      score: st.state === 'pre' ? null : [Number(H.score) || 0, Number(A.score) || 0],
    };
    return m;
  }).filter((m) => m && Number.isFinite(m.start));
}

async function main() {
  const now = Date.now(), days = Array.from({ length: 8 }, (_, k) => day(now + (k - 1) * 864e5));
  let old = {};
  try { old = Object.fromEntries(JSON.parse(readFileSync(OUT, 'utf8')).matches.map((m) => [m.id, m])); } catch { /* first run */ }
  const all = [];
  for (const L of LEAGUES) {
    try { all.push(...await league(L, days)); } catch (e) { console.warn(L[2], e.message); }
  }
  for (const m of all) {
    // odds: fixed once, before the match (never changed after, so the bets stay fair)
    m.odds = old[m.id]?.odds || (m.sport === 'soccer'
      ? soccerOdds(strength(m.home.rec, 'soccer'), strength(m.away.rec, 'soccer'))
      : nbaOdds(strength(m.home.rec, 'basketball'), strength(m.away.rec, 'basketball')));
    delete m.home.rec; delete m.away.rec;
  }
  // keep finished matches 3 days (for the bets to be paid), then drop them
  const seen = new Set();
  const uniq = all.filter((m) => !seen.has(m.id) && seen.add(m.id));
  const keep = uniq.filter((m) => m.start > now - 3 * 864e5).sort((a, b) => a.start - b.start);
  for (const o of Object.values(old)) if (!keep.some((m) => m.id === o.id) && o.start > now - 3 * 864e5) keep.push(o);
  keep.sort((a, b) => a.start - b.start);
  mkdirSync(OUT.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  writeFileSync(OUT, JSON.stringify({ updated: now, matches: keep }));
  console.log(`${keep.length} matchs (${keep.filter((m) => m.state === 'pre').length} à venir, ${keep.filter((m) => m.state === 'in').length} en cours).`);
}

export { parse, soccerOdds, nbaOdds, strength };
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
