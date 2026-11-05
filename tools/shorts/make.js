// Vidéos « Shorts » de chaque jour (page #shorts du site, branche « shorts » du dépôt) : un robot ouvre une machine
// à sous au format téléphone, lance son bonus (offert, comme pour la machine mystère) et filme la partie ; on garde
// le meilleur de TRIES essais. Musique : le thème du jeu, rendu dans la page (OfflineAudioContext). Montage ffmpeg :
// 1080 × 1920, H.264 + AAC, MAX_S secondes au plus (Snapchat Spotlight, YouTube Shorts, TikTok, Reels).
//   python3 -m http.server 8123      (à la racine du dépôt, dans un autre terminal)
//   node tools/shorts/make.js [AAAA-MM-JJ] [jeu …]   → tools/shorts/out/<date>-<jeu>.mp4 + .json
// Lancé chaque matin par GitHub Actions (.github/workflows/shorts.yml).
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(__dirname, 'out');
const BASE = process.env.SHORTS_URL || 'http://localhost:8123/';
const SITE = 'www.spinbetcaz.com';
const PER_DAY = 2, TRIES = +process.env.SHORTS_TRIES || 3, MAX_S = 58, BET_KE = 100, GOOD_X = 40;
fs.mkdirSync(OUT, { recursive: true });

// the slots of the catalogue (not « en travaux »), as in tools/seo.py
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const block = src.slice(src.indexOf('const ORIGINALS = ['), src.indexOf('].map((g) => ({ ...g, original: true }))'));
const CAT = block.split('\n').filter((l) => l.trim().startsWith('{"id"')).map((l) => JSON.parse(l.trim().replace(/,$/, '')));
const SLOTS = CAT.filter((g) => g.cat === 'slot' && !g.wip);
const byId = Object.fromEntries(CAT.map((g) => [g.id, g]));

const today = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : new Date().toISOString().slice(0, 10);
const asked = process.argv.slice(2).filter((a) => byId[a]);
const day = Math.round(Date.parse(today) / 864e5);
const games = asked.length ? asked : Array.from({ length: PER_DAY }, (_, k) => SLOTS[(day * PER_DAY + k * 7) % SLOTS.length].id)
  .filter((v, i, a) => a.indexOf(v) === i);

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const xTxt = (x) => `×${(x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toLocaleString('fr-FR')}`;
const keTxt = (n) => `${Math.round(n).toLocaleString('fr-FR').replace(/\s/g, ' ')} KE`;

async function attempt(browser, id, k) {
  const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('spinbet_tuto_v1', '1'); localStorage.setItem('spinbet_lounge', '0'); localStorage.setItem('casino_music', '1');
      sessionStorage.setItem('spinbet_arrival_ad', '1');
    } catch { /* ignore */ }
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?nopub&nointro&nostats#game-${id}`);
  // (__mods is a top-level const of the page, not a property of window)
  await page.waitForFunction(() => typeof __mods !== 'undefined' && !!__mods['pages/game.js']?.currentGame?.()?.freeBonus, null, { timeout: 30000 });
  await page.waitForTimeout(2500); // pictures of the game
  const g = byId[id];
  // the robot's table: a comfortable balance, BET_KE a spin, full screen, the site's little things hidden, and the
  // two bands of the video (title at the top, address at the bottom)
  await page.evaluate(({ bet, name, site }) => {
    const { wallet } = __mods['wallet.js'], cur = __mods['pages/game.js'].currentGame();
    wallet.cents = 25000 * 100; wallet.save?.(); // a player's balance, not a millionaire's
    const bets = cur.cfg?.bets || [];
    if (bets.length) { let bi = 0; bets.forEach((b, i) => { if (b <= bet * 100) bi = i; }); cur.bi = bi; }
    else if (typeof cur.betIdx === 'number') { /* classic machine */ }
    cur.updateMeters?.();
    if (cur.root) __mods['core/chrome.js'].setFull(cur.root, true);
    const css = document.createElement('style');
    css.textContent = `.ct-fab,.toasts,.live-tick,.ad-offer,.rw-dot,.snowfall,.gi-back,.aads-modal,.ev-pill,.bw-offer{display:none!important}
      .sb-band{position:fixed;left:0;right:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;gap:10px;pointer-events:none;
        font:900 26px/1.05 'Bebas Neue',Impact,sans-serif;letter-spacing:1px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.6)}
      .sb-top{top:0;padding:14px 12px 22px;background:linear-gradient(180deg,rgba(0,0,0,.85),transparent)}
      .sb-top b{color:#fde047} .sb-bot{bottom:0;padding:22px 12px 14px;font:800 17px Inter,system-ui,sans-serif;letter-spacing:0;
        background:linear-gradient(0deg,rgba(0,0,0,.88),transparent)} .sb-bot b{color:#7cc8ff}
      .sb-top{font-size:34px}
      .sb-end{position:fixed;inset:0;z-index:2147483600;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;
        background:radial-gradient(circle at 50% 40%,rgba(30,58,138,.92),rgba(3,5,10,.97) 70%);color:#fff;font-family:Inter,system-ui,sans-serif;animation:sbIn .5s ease-out}
      @keyframes sbIn{from{opacity:0;transform:scale(1.08)}}
      .sb-logo{display:flex;align-items:center;gap:10px;font:900 38px Archivo,Inter,sans-serif;letter-spacing:.5px}
      .sb-logo span{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#bae6fd,#3b82f6 60%,#1e3a8a);font-size:32px}
      .sb-logo em{font-style:normal;color:#93c5fd}
      .sb-x{font:900 110px/1 'Bebas Neue',Impact,sans-serif;color:#fde047;text-shadow:0 0 40px rgba(253,224,71,.6)} .sb-x small{display:block;font:800 22px Inter,sans-serif;color:#fde68a}
      .sb-cta{font:900 40px 'Bebas Neue',Impact,sans-serif;letter-spacing:1px} .sb-site{font:900 30px Inter,sans-serif;color:#7cc8ff}
      .sb-note{font:600 16px Inter,sans-serif;color:#cbd5e1}`;
    document.head.appendChild(css);
    const top = document.createElement('div'); top.className = 'sb-band sb-top'; top.innerHTML = `🔥 <b>BONUS</b> · ${name.toUpperCase()}`;
    const bot = document.createElement('div'); bot.className = 'sb-band sb-bot'; bot.innerHTML = `<b>${site}</b>&nbsp;· jeu gratuit · argent fictif · 18+`;
    document.body.append(top, bot);
    window.__done = null;
    addEventListener('sb:roundend', (e) => { window.__done = e.detail; });
  }, { bet: BET_KE, name: g.name, site: SITE });
  await page.waitForTimeout(800);

  // filming: the browser's own screencast (better pictures than the built-in video recorder)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `short-${id}-`));
  const cdp = await ctx.newCDPSession(page), frames = [];
  let n = 0;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const f = path.join(dir, `f${String(n++).padStart(5, '0')}.jpg`);
    fs.writeFileSync(f, Buffer.from(data, 'base64'));
    frames.push({ f, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
  await page.waitForTimeout(1300);
  await page.evaluate(() => __mods['pages/game.js'].currentGame().freeBonus());
  const t0 = Date.now();
  await page.waitForFunction(() => window.__done, null, { timeout: 150000, polling: 250 }).catch(() => {});
  const done = await page.evaluate(() => window.__done);
  await page.waitForTimeout(1400);
  // end card: the win, the site's address, « jeu gratuit, argent fictif »
  await page.evaluate(({ x, site }) => {
    const end = document.createElement('div');
    end.className = 'sb-end';
    end.innerHTML = `<div class="sb-logo"><span>S</span>SPINBET<em>CASINO</em></div>${x >= 1 ? `<div class="sb-x">×${(x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toLocaleString('fr-FR')}<small>la mise</small></div>` : ''}
      <div class="sb-cta">Joue gratuitement</div><div class="sb-site">${site}</div><div class="sb-note">Jeu gratuit · argent fictif · aucun vrai pari · 18+</div>`;
    document.body.appendChild(end);
  }, { x: done?.x || 0, site: SITE });
  await page.waitForTimeout(2600);
  await cdp.send('Page.stopScreencast');
  const secs = (Date.now() - t0) / 1000 + 1.5;
  // the game's music for the length of the video, rendered offline in the page (WAV, base64)
  const wav = await page.evaluate(async (dur) => {
    const cur = __mods['pages/game.js'].currentGame(), T = cur?.music?.T;
    if (!T) return null;
    const rate = 32000, ac = new OfflineAudioContext(2, Math.ceil(rate * dur), rate);
    const { Music } = __mods['core/music.js'], m = new Music(T);
    m.ac = ac; m.master = ac.createGain(); m.master.gain.value = 0.5; m.master.connect(ac.destination); m.up = 2;
    for (let t = 0.05, i = 0; t < dur; t += T.sd * 0.86, i++) m.play(i, t);
    const buf = await ac.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), len = L.length;
    const out = new DataView(new ArrayBuffer(44 + len * 4));
    const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + len * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
    out.setUint32(24, rate, true); out.setUint32(28, rate * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, len * 4, true);
    for (let i = 0; i < len; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    const bytes = new Uint8Array(out.buffer); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, Math.min(MAX_S, secs) + 1).catch((e) => { console.warn('musique :', e.message); return null; });
  await ctx.close();
  if (wav) fs.writeFileSync(path.join(dir, 'music.wav'), Buffer.from(wav, 'base64'));
  const x = done?.x || 0, win = done?.win || 0;
  console.log(`  essai ${k + 1} : ${id} ${done ? `${xTxt(x)} (${keTxt(win)})` : 'pas fini'} · ${frames.length} images en ${secs.toFixed(1)} s`);
  return { id, x, win, dir, frames, music: !!wav };
}

function edit(r, file) {
  // the frames with their real durations, then 30 images/s; sped up when the bonus is longer than MAX_S
  const list = path.join(r.dir, 'list.txt');
  const L = r.frames.map((fr, i) => `file '${fr.f}'\nduration ${Math.max(0.001, ((r.frames[i + 1]?.t ?? fr.t + 0.04) - fr.t)).toFixed(4)}`);
  fs.writeFileSync(list, `${L.join('\n')}\nfile '${r.frames[r.frames.length - 1].f}'\n`);
  const real = r.frames[r.frames.length - 1].t - r.frames[0].t + 0.04, speed = Math.max(1, real / MAX_S), dur = real / speed;
  const vf = `${speed > 1 ? `setpts=PTS/${speed.toFixed(3)},` : ''}fps=30,scale=1080:1920:flags=lanczos,format=yuv420p`;
  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', list];
  if (r.music) args.push('-i', path.join(r.dir, 'music.wav'));
  args.push('-vf', vf);
  // loudness of a social video (≈ -16 LUFS), then fades
  if (r.music) args.push('-af', `loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.6,afade=t=out:st=${Math.max(0, dur - 1.6).toFixed(2)}:d=1.5`, '-ar', '44100', '-c:a', 'aac', '-b:a', '128k', '-shortest');
  args.push('-t', dur.toFixed(2), '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-maxrate', '2800k', '-bufsize', '5600k', '-profile:v', 'high', '-movflags', '+faststart', file);
  sh('ffmpeg', args);
  const poster = file.replace(/\.mp4$/, '.jpg');
  sh('ffmpeg', ['-y', '-ss', Math.max(0, dur - 2.5).toFixed(2), '-i', file, '-frames:v', '1', '-vf', 'scale=270:480', '-q:v', '5', poster]);
  return { dur, poster };
}

(async () => {
  // the screencast films the browser's window: a 1080 × 1920 window at scale 2 = a 540 × 960 phone screen in HD
  const browser = await chromium.launch({ args: ['--window-size=1080,1920', '--force-device-scale-factor=2', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'] });
  for (const id of games) {
    const g = byId[id];
    console.log(`${today} · ${g.name}`);
    const tries = [];
    for (let k = 0; k < TRIES; k++) {
      try { tries.push(await attempt(browser, id, k)); } catch (e) { console.warn(`  essai ${k + 1} raté :`, e.message.split('\n')[0]); }
      if (tries.some((t) => t.x >= GOOD_X && t.frames.length > 30)) break; // a fine bonus: enough
    }
    const best = tries.filter((t) => t.frames.length > 30).sort((a, b) => b.x - a.x)[0];
    if (best) {
      const file = path.join(OUT, `${today}-${id}.mp4`), { dur, poster } = edit(best, file);
      const title = best.x >= 1 ? `BONUS ${xTxt(best.x)} sur ${g.name} 🔥` : `Le bonus de ${g.name} 🎰`;
      const caption = `${best.x >= 1 ? `🔥 ${xTxt(best.x)} la mise dans le bonus de ${g.name} !` : `🎰 Le bonus de ${g.name}`} Joue gratuitement sur ${SITE} (argent fictif, aucun vrai pari, 18+). #casino #machineasous #bonus #slots #spinbet`;
      fs.writeFileSync(file.replace(/\.mp4$/, '.json'), JSON.stringify({ date: today, game: id, name: g.name, x: Math.round(best.x * 10) / 10, win: Math.round(best.win), dur: Math.round(dur * 10) / 10, title, caption, file: path.basename(file), poster: path.basename(poster) }, null, 1));
      console.log(`  → ${path.relative(ROOT, file)} (${dur.toFixed(1)} s, ${(fs.statSync(file).size / 1e6).toFixed(1)} Mo)`);
    } else console.warn(`  pas de vidéo pour ${g.name}`);
    tries.forEach((t) => fs.rmSync(t.dir, { recursive: true, force: true }));
  }
  await browser.close();
})();
