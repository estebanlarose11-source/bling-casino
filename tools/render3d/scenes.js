// The code-drawn covers: one Three.js scene per game, rendered by render.js into assets/games/<id>/cover.webp.
// Colours follow CARD of covers.js (top, bottom of the poster). No title in the picture: the poster adds it.
import { THREE, studio, piece, M, box, mesh, group, gemGeo, coin, shadowFloor, floorShadow, sparkles, canvasTex, label, rng } from './kit.js';

const rad = (d) => (d * Math.PI) / 180;

// a gold coin face: crown and smiley (La Pièce), or a K (KE)
function coinFace(kind = 'face') {
  return canvasTex(512, 512, (g) => {
    const rg = g.createRadialGradient(256, 220, 20, 256, 256, 256);
    rg.addColorStop(0, '#fff6c8'); rg.addColorStop(1, '#c98a12');
    g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = '#8a5a06'; g.lineWidth = 10;
    g.beginPath(); g.arc(256, 256, 214, 0, 7); g.stroke();
    for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; g.fillStyle = '#9a6a0a'; g.beginPath(); g.arc(256 + Math.cos(a) * 232, 256 + Math.sin(a) * 232, 5, 0, 7); g.fill(); }
    g.fillStyle = '#8a5a06'; g.strokeStyle = '#8a5a06'; g.lineCap = 'round';
    if (kind === 'face') {
      g.beginPath(); g.moveTo(150, 200); g.lineTo(180, 110); g.lineTo(220, 170); g.lineTo(256, 90); g.lineTo(292, 170); g.lineTo(332, 110); g.lineTo(362, 200); g.closePath(); g.fill();
      g.lineWidth = 16; g.beginPath(); g.arc(256, 300, 86, 0, 7); g.stroke();
      g.beginPath(); g.arc(222, 284, 12, 0, 7); g.fill(); g.beginPath(); g.arc(290, 284, 12, 0, 7); g.fill();
      g.beginPath(); g.arc(256, 306, 44, rad(20), rad(160)); g.stroke();
    } else if (kind === 'x2') {
      g.font = '900 210px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('×2', 256, 270);
    } else {
      g.font = '900 250px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('K', 256, 270);
      g.fillRect(150, 250, 212, 22);
    }
  });
}

export const SCENES = {
  // Le Champ de Mines: a tilted board of tiles, two emeralds out of their tile, a bomb with a lit fuse
  mines: async () => {
    const s = studio({ colors: ['#ff8f24', '#9a3b06'], light: '#ffd08a', rim: '#ffb35c', seed: 3, camY: 4.2, dist: 12.6, lift: 0.13 });
    const { scene } = s;
    const board = new THREE.Group();
    const tileM = M.plastic('#1d2a44', 0.3), openM = M.plastic('#0d1424', 0.5);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const open = (i === 1 && j === 2) || (i === 2 && j === 1) || (i === 2 && j === 2);
      const t = box(1.25, open ? 0.18 : 0.42, 1.25, 0.12, open ? openM : tileM);
      t.position.set((i - 1.5) * 1.42, open ? -0.12 : 0, (j - 1.5) * 1.42); t.castShadow = t.receiveShadow = true;
      board.add(t);
    }
    const tray = box(6.3, 0.3, 6.3, 0.2, M.steel('#3b2414', 0.4)); tray.position.y = -0.35; tray.receiveShadow = true; board.add(tray);
    board.rotation.set(rad(8), rad(-28), 0); board.position.set(0, -1.2, -0.6);
    scene.add(board);
    const em = M.gem('#0dbf5c', 0.45); em.transmission = 0.35;
    const g1 = mesh(gemGeo(1, 10), em, { x: -0.9, y: 1.05, z: 1.3, rx: rad(-12), rz: rad(14), s: 1.25 });
    const g2 = mesh(gemGeo(1, 10), em, { x: 1.85, y: 0.2, z: 0.6, rx: rad(10), rz: rad(-22), s: 0.8 });
    scene.add(g1, g2);
    // bomb
    const bomb = new THREE.Group();
    bomb.add(mesh(new THREE.SphereGeometry(0.95, 64, 48), M.plastic('#15151c', 0.25)));
    bomb.add(mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.35, 32), M.steel('#6b7280', 0.3), { y: 0.95 }));
    const fuse = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.1, 0), new THREE.Vector3(0.25, 1.5, 0.05), new THREE.Vector3(0.6, 1.62, 0.1), new THREE.Vector3(0.85, 1.5, 0.1)]);
    bomb.add(mesh(new THREE.TubeGeometry(fuse, 32, 0.06, 12), M.matte('#c8a36a', 0.8)));
    const spark = mesh(new THREE.SphereGeometry(0.16, 24, 16), M.glow('#ffcc55', 6), { x: 0.86, y: 1.5, z: 0.1, shadow: false });
    bomb.add(spark);
    bomb.add(sparkles(14, 11, { center: [0.86, 1.5, 0.1], spread: [0.9, 0.9, 0.5], colors: ['#ffd27a', '#fff'], size: [0.12, 0.45] }));
    bomb.position.set(1.4, 1.55, -0.6); bomb.rotation.z = rad(-12);
    scene.add(bomb);
    scene.add(shadowFloor(-1.75, 0.5));
    scene.add(sparkles(28, 5, { spread: [7, 5, 3], center: [0, 1, 0], colors: ['#ffffff', '#b8ffd9', '#ffe2a8'] }));
    return s;
  },

  // La Pièce: a big gold coin flipping over a silver ×2 coin
  pileface: async () => {
    const s = studio({ colors: ['#f5b11c', '#8a4a06'], light: '#ffe08a', rim: '#fff0b0', seed: 7, camY: 1.6, dist: 12, lift: 0.13 });
    const { scene } = s;
    const big = coin(2, 0.34, M.gold('#ffc53d', 0.2), coinFace('face'));
    big.rotation.set(rad(72), rad(0), rad(-18)); big.position.set(-0.25, 0.95, 0);
    scene.add(big);
    const small = coin(1.05, 0.22, M.silver('#e6ebf2', 0.18), coinFace('x2'));
    small.children.forEach((c) => { if (c.material?.map) c.material.color.set('#e9eef5'); });
    small.rotation.set(rad(58), rad(10), rad(24)); small.position.set(2.05, -0.55, 0.8);
    scene.add(small);
    const tiny = coin(0.6, 0.14, M.gold('#ffcf55', 0.25), coinFace('k'));
    tiny.rotation.set(rad(40), 0, rad(-40)); tiny.position.set(-2.3, -0.7, 0.9);
    scene.add(tiny);
    scene.add(floorShadow(3.2, 0.55, -1.9));
    scene.add(sparkles(36, 9, { spread: [7, 6, 3], center: [0, 0.8, 0], colors: ['#fff', '#ffe9a8', '#ffd060'] }));
    return s;
  },

  // Le Casse: a round vault door, gold bars and bundles of notes
  casse: async () => {
    const s = studio({ colors: ['#64748b', '#0f172a'], light: '#cfe3ff', rim: '#7cc8ff', key: '#ffffff', seed: 13, camY: 1.5, dist: 13.2, lift: 0.12 });
    const { scene } = s;
    const door = new THREE.Group();
    const steel = M.steel('#9aa7b6', 0.28), dark = M.steel('#4b5563', 0.4);
    door.add(mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.5, 96), dark, { rx: Math.PI / 2 }));
    door.add(mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.62, 96), steel, { rx: Math.PI / 2, z: 0.06 }));
    door.add(mesh(new THREE.TorusGeometry(2.45, 0.09, 16, 96), M.silver('#e5e7eb', 0.15), { z: 0.3 }));
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; door.add(mesh(new THREE.SphereGeometry(0.11, 16, 12), M.silver('#f3f4f6', 0.2), { x: Math.cos(a) * 2.05, y: Math.sin(a) * 2.05, z: 0.38 })); }
    // handle wheel
    const wheel = new THREE.Group();
    wheel.add(mesh(new THREE.TorusGeometry(1.15, 0.12, 20, 72), M.silver('#f1f5f9', 0.12)));
    wheel.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.4, 48), M.silver('#e2e8f0', 0.15), { rx: Math.PI / 2 }));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; wheel.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.15, 16), M.silver('#e2e8f0', 0.15), { x: Math.cos(a) * 0.6, y: Math.sin(a) * 0.6, rz: a + Math.PI / 2 })); }
    wheel.position.z = 0.6; wheel.rotation.z = rad(15);
    door.add(wheel);
    door.position.set(0, 0.95, -0.8); door.rotation.y = rad(-16);
    scene.add(door);
    // gold bars
    const bar = () => {
      const g = new THREE.Shape(); g.moveTo(-0.7, 0); g.lineTo(0.7, 0); g.lineTo(0.55, 0.42); g.lineTo(-0.55, 0.42); g.closePath();
      const geo = new THREE.ExtrudeGeometry(g, { depth: 0.6, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3 });
      geo.translate(0, 0, -0.3);
      return mesh(geo, M.gold('#ffc94a', 0.18));
    };
    const bars = new THREE.Group();
    [[-0.75, 0, 0], [0.75, 0, 0], [0, 0.46, 0]].forEach(([x, y, z]) => { const b = bar(); b.position.set(x, y, z); bars.add(b); });
    bars.position.set(-1.9, -1.55, 1.4); bars.rotation.y = rad(24);
    scene.add(bars);
    // notes
    const noteT = canvasTex(256, 128, (g) => {
      g.fillStyle = '#1f9d55'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#d1fae5'; g.lineWidth = 6; g.strokeRect(8, 8, 240, 112);
      g.fillStyle = '#bbf7d0'; g.beginPath(); g.arc(128, 64, 34, 0, 7); g.fill(); g.fillStyle = '#166534'; g.font = '900 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('K', 128, 66);
    });
    const notes = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const stack = new THREE.Group();
      stack.add(mesh(new THREE.BoxGeometry(1.5, 0.5, 0.72), [M.matte('#16a34a'), M.matte('#16a34a'), new THREE.MeshStandardMaterial({ map: noteT, roughness: 0.6 }), M.matte('#16a34a'), M.matte('#15803d'), M.matte('#15803d')]));
      stack.add(mesh(new THREE.BoxGeometry(0.3, 0.52, 0.74), M.matte('#fde68a', 0.5)));
      stack.position.set(k * 0.2, k * 0.5, k * 0.05); stack.rotation.y = rad(k * 8);
      notes.add(stack);
    }
    notes.position.set(1.9, -1.55, 1.3); notes.rotation.y = rad(-28);
    scene.add(notes);
    scene.add(shadowFloor(-1.55, 0.5));
    scene.add(sparkles(20, 17, { spread: [7, 5, 3], center: [0, 0.5, 1], colors: ['#ffffff', '#ffe9a8', '#bfe0ff'] }));
    return s;
  },
  // L'Avion: a glossy red jet climbing on a glowing trail
  avion: async () => {
    const s = studio({ colors: ['#ff4672', '#7c0f30'], light: '#ffb3c7', rim: '#ff9ab8', seed: 21, camY: 1.2, dist: 12, lift: 0.12 });
    const { scene } = s;
    const red = M.plastic('#e11d48', 0.22), white = M.plastic('#f8fafc', 0.25), glass = M.plastic('#1e293b', 0.05);
    const jet = new THREE.Group();
    const body = mesh(new THREE.CapsuleGeometry(0.42, 2.6, 16, 32), red, { rz: Math.PI / 2 }); jet.add(body);
    jet.add(mesh(new THREE.SphereGeometry(0.33, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass, { x: 0.95, y: 0.22, rz: rad(-20), s: [1.4, 0.8, 0.9] }));
    const wing = new THREE.Shape(); wing.moveTo(0.5, 0); wing.lineTo(-0.5, 0); wing.lineTo(-1.1, 1.9); wing.lineTo(-0.6, 1.9); wing.closePath();
    const wGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    const w1 = mesh(wGeo, white, { rx: Math.PI / 2, y: 0.02 }); const w2 = mesh(wGeo, white, { rx: -Math.PI / 2, y: -0.02 });
    jet.add(w1, w2);
    const fin = new THREE.Shape(); fin.moveTo(-1.0, 0); fin.lineTo(-1.75, 0); fin.lineTo(-1.95, 1.05); fin.lineTo(-1.6, 1.05); fin.closePath();
    jet.add(mesh(new THREE.ExtrudeGeometry(fin, { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 }), red, { y: 0.15, z: -0.035 }));
    jet.add(mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.25, 32), M.steel('#334155', 0.3), { x: -1.75, rz: Math.PI / 2 }));
    jet.add(mesh(new THREE.CircleGeometry(0.26, 32), M.glow('#ffb15c', 5), { x: -1.89, ry: -Math.PI / 2, shadow: false }));
    [0.25, -0.25].forEach((z) => jet.add(mesh(new THREE.BoxGeometry(1.3, 0.06, 0.02), M.glow('#fff', 1.2), { x: 0.1, y: 0.0, z: z * 1.7 + (z > 0 ? 0.2 : -0.2), shadow: false })));
    jet.rotation.set(rad(-18), rad(-28), rad(28)); jet.position.set(0.5, 1.2, 0); jet.scale.setScalar(1.15);
    scene.add(jet);
    // glowing trail behind the jet
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-4.5, -3.4, -1), new THREE.Vector3(-2.6, -2.2, -0.6), new THREE.Vector3(-1.2, -0.4, -0.3), new THREE.Vector3(-0.9, 0.35, -0.1)]);
    scene.add(mesh(new THREE.TubeGeometry(curve, 64, 0.12, 16), M.glow('#ff7aa2', 3), { shadow: false }));
    scene.add(mesh(new THREE.TubeGeometry(curve, 64, 0.3, 16), new THREE.MeshBasicMaterial({ color: '#ff3d7a', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }), { shadow: false }));
    // clouds
    const cloudM = M.matte('#fff1f4', 0.9);
    [[-2.4, -1.4, -2, 0.9], [2.6, -1.9, -1.5, 1.1], [-0.2, -2.6, 0.5, 0.8]].forEach(([x, y, z, k]) => {
      const c = new THREE.Group();
      [[0, 0, 0, 0.7], [0.6, 0.12, 0, 0.55], [-0.6, 0.05, 0, 0.5], [0.25, 0.4, 0, 0.5]].forEach(([a, b, d, r]) => c.add(mesh(new THREE.SphereGeometry(r, 32, 24), cloudM, { x: a, y: b, z: d })));
      c.position.set(x, y, z); c.scale.setScalar(k); scene.add(c);
    });
    scene.add(sparkles(30, 23, { spread: [8, 7, 3], center: [0, 0.5, -1], colors: ['#ffffff', '#ffd1dc'] }));
    return s;
  },

  // La Cascade: a triangle of chrome pegs, glossy balls falling, coloured slots at the bottom
  plinko: async () => {
    const s = studio({ colors: ['#38bdf8', '#4c1d95'], light: '#bae6fd', rim: '#f0abfc', seed: 31, camY: 1.0, dist: 13, lift: 0.1 });
    const { scene } = s;
    const board = new THREE.Group();
    board.add(mesh(new THREE.BoxGeometry(7.4, 6.6, 0.25), M.plastic('#1e1b4b', 0.4), { z: -0.35 }));
    const peg = new THREE.SphereGeometry(0.11, 24, 16), pegM = M.silver('#f1f5f9', 0.12);
    for (let row = 0; row < 9; row++) for (let k = 0; k <= row + 2; k++) board.add(mesh(peg, pegM, { x: (k - (row + 2) / 2) * 0.62, y: 2.7 - row * 0.62, z: 0 }));
    const cols = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444'];
    cols.forEach((c, k) => {
      const b = box(0.62, 0.42, 0.35, 0.06, M.plastic(c, 0.25)); b.position.set((k - 4) * 0.7, -3.0, 0); board.add(b);
      board.add(mesh(new THREE.BoxGeometry(0.5, 0.05, 0.02), M.glow(c, 2), { x: (k - 4) * 0.7, y: -2.74, z: 0.18, shadow: false }));
    });
    const ballM = M.plastic('#ff2d6f', 0.12);
    [[0.3, 2.2, 0.38], [-0.62, 0.9, 0.34], [0.95, -0.3, 0.36], [-0.2, -1.4, 0.32]].forEach(([x, y, r]) => board.add(mesh(new THREE.SphereGeometry(r, 48, 32), ballM, { x, y, z: 0.25 })));
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0.3, 3.1, 0.2), new THREE.Vector3(0.3, 2.2, 0.2), new THREE.Vector3(-0.62, 0.9, 0.2), new THREE.Vector3(0.95, -0.3, 0.2), new THREE.Vector3(-0.2, -1.4, 0.2)]);
    board.add(mesh(new THREE.TubeGeometry(path, 80, 0.035, 8), M.glow('#ff9ec4', 2.2), { shadow: false }));
    board.rotation.set(rad(-8), rad(-14), 0); board.position.y = 0.55;
    scene.add(board);
    scene.add(sparkles(26, 37, { spread: [8, 7, 3], center: [0, 0.5, 0.5], colors: ['#ffffff', '#c4b5fd', '#bae6fd'] }));
    return s;
  },

  // Le Vortex: a deep wheel of red and black rings around a golden core, with a ball on the edge
  vortex: async () => {
    const s = studio({ colors: ['#ef4444', '#2a0a0e'], light: '#fecaca', rim: '#fca5a5', seed: 41, camY: 6.2, dist: 14, lift: 0.12 });
    const { scene } = s;
    const wheel = new THREE.Group();
    const red = M.plastic('#dc2626', 0.25), blk = M.plastic('#111114', 0.3), goldM = M.gold('#ffc53d', 0.2);
    for (let ring = 0; ring < 6; ring++) {
      const r0 = 0.75 + ring * 0.48, n = 12 + ring * 6, depth = -ring * 0.06;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 0.86) / n) * Math.PI * 2;
        const sh = new THREE.Shape();
        sh.absarc(0, 0, r0 + 0.42, a0, a1, false); sh.absarc(0, 0, r0, a1, a0, true);
        const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 6 });
        const gold = (k * 7 + ring * 3) % 17 === 0;
        wheel.add(mesh(geo, gold ? goldM : (k + ring) % 2 ? red : blk, { z: depth }));
      }
    }
    wheel.add(mesh(new THREE.TorusGeometry(3.75, 0.16, 24, 120), goldM));
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; wheel.add(mesh(new THREE.SphereGeometry(0.09, 16, 12), M.glow('#ffe08a', 2.5), { x: Math.cos(a) * 3.75, y: Math.sin(a) * 3.75, z: 0.18, shadow: false })); }
    wheel.add(mesh(new THREE.SphereGeometry(0.62, 64, 48), goldM, { z: 0.2, s: [1, 1, 0.55] }));
    wheel.add(mesh(new THREE.SphereGeometry(0.2, 48, 32), M.silver('#fff', 0.05), { x: 2.6, y: 1.25, z: 0.45 }));
    wheel.rotation.set(rad(-62), 0, rad(12)); wheel.position.set(0, -0.2, 0);
    scene.add(wheel);
    scene.add(shadowFloor(-0.9, 0.5));
    scene.add(sparkles(24, 43, { spread: [8, 5, 4], center: [0, 0.8, 0], colors: ['#ffffff', '#fecaca', '#ffe08a'] }));
    return s;
  },

  // La Course: three cute robots racing towards a chequered flag
  robots: async () => {
    const s = studio({ colors: ['#1aa6d6', '#0b2a5c'], light: '#a5f3fc', rim: '#67e8f9', seed: 51, camY: 2.6, dist: 12.5, lift: 0.12 });
    const { scene } = s;
    const robot = (c, eye) => {
      const g = new THREE.Group(), shell = M.plastic(c, 0.2), metal = M.silver('#e2e8f0', 0.2);
      g.add(mesh(new THREE.CapsuleGeometry(0.55, 0.5, 12, 32), shell, { y: 0.15 }));
      const head = box(1.25, 0.95, 1.0, 0.3, shell); head.position.y = 1.35; head.castShadow = true; g.add(head);
      const visor = box(1.0, 0.55, 0.1, 0.18, M.plastic('#0b1020', 0.05)); visor.position.set(0, 1.38, 0.5); g.add(visor);
      [-0.24, 0.24].forEach((x) => g.add(mesh(new THREE.SphereGeometry(0.11, 24, 16), M.glow(eye, 4), { x, y: 1.4, z: 0.56, s: [1, 1.3, 0.5], shadow: false })));
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), metal, { y: 2.0 }));
      g.add(mesh(new THREE.SphereGeometry(0.1, 16, 12), M.glow(eye, 3), { y: 2.22, shadow: false }));
      [-0.75, 0.75].forEach((x) => g.add(mesh(new THREE.CapsuleGeometry(0.14, 0.45, 8, 16), metal, { x, y: 0.25, rz: x > 0 ? rad(-35) : rad(35) })));
      g.add(mesh(new THREE.TorusGeometry(0.32, 0.14, 16, 32), M.plastic('#1f2937', 0.5), { y: -0.55, ry: Math.PI / 2 }));
      return g;
    };
    const a = robot('#22d3ee', '#a5f3fc'); a.position.set(0, 0, 0.8); a.rotation.y = rad(-20);
    const b = robot('#f472b6', '#fde68a'); b.position.set(-2.1, -0.15, -0.6); b.rotation.y = rad(-10); b.scale.setScalar(0.85);
    const c = robot('#a3e635', '#fef9c3'); c.position.set(2.1, -0.25, -0.9); c.rotation.y = rad(-30); c.scale.setScalar(0.8);
    scene.add(a, b, c);
    // track and finish line
    const lane = canvasTex(512, 512, (g) => { g.fillStyle = '#1e293b'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#e2e8f0'; for (let i = 0; i < 8; i++) g.fillRect(i * 64 + 28, 0, 6, 512); }, { repeat: true });
    lane.repeat.set(1.5, 1);
    scene.add(mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshStandardMaterial({ map: lane, roughness: 0.6, envMapIntensity: 0.4 }), { rx: -Math.PI / 2, y: -1.0 }));
    const check = canvasTex(256, 256, (g) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 32, j * 32, 32, 32); } });
    const flag = new THREE.PlaneGeometry(1.4, 0.95, 20, 6);
    const pos = flag.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 3) * 0.12);
    flag.computeVertexNormals();
    scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 12), M.silver('#e5e7eb'), { x: 3.4, y: 0.7, z: -1.6 }));
    scene.add(mesh(flag, new THREE.MeshStandardMaterial({ map: check, side: THREE.DoubleSide, roughness: 0.7 }), { x: 4.1, y: 2.0, z: -1.6 }));
    scene.add(sparkles(22, 53, { spread: [8, 5, 3], center: [0, 1.2, 0], colors: ['#ffffff', '#a5f3fc'] }));
    return s;
  },

  // Le Poulet: a round cartoon chicken crossing a road between cars
  poulet: async () => {
    const s = studio({ colors: ['#f2c11d', '#7a5a06'], light: '#fef08a', rim: '#fde68a', seed: 61, camY: 3.0, dist: 12, lift: 0.12 });
    const { scene } = s;
    const ch = new THREE.Group(), white = M.plastic('#fffdf5', 0.45), red = M.plastic('#ef4444', 0.3), orange = M.plastic('#f59e0b', 0.3), eye = M.plastic('#0f172a', 0.1);
    ch.add(mesh(new THREE.SphereGeometry(1, 64, 48), white, { s: [1, 0.95, 1.05] }));
    ch.add(mesh(new THREE.SphereGeometry(0.62, 48, 32), white, { y: 1.05, z: 0.35 }));
    [[-0.05, 1.72, 0.32, 0.2], [0.12, 1.78, 0.18, 0.22], [0.28, 1.7, 0.05, 0.18]].forEach(([x, y, z, r]) => ch.add(mesh(new THREE.SphereGeometry(r, 24, 16), red, { x: x - 0.1, y, z })));
    ch.add(mesh(new THREE.ConeGeometry(0.17, 0.42, 24), orange, { y: 1.0, z: 0.98, rx: Math.PI / 2 }));
    ch.add(mesh(new THREE.SphereGeometry(0.12, 16, 12), red, { y: 0.8, z: 0.9, s: [0.8, 1.3, 0.8] }));
    [-0.22, 0.22].forEach((x) => { ch.add(mesh(new THREE.SphereGeometry(0.1, 24, 16), eye, { x, y: 1.2, z: 0.9 })); ch.add(mesh(new THREE.SphereGeometry(0.03, 12, 8), M.glow('#fff', 2), { x: x + 0.03, y: 1.24, z: 0.99, shadow: false })); });
    [-1, 1].forEach((k) => ch.add(mesh(new THREE.SphereGeometry(0.42, 32, 24), white, { x: k * 0.95, y: 0.1, s: [0.35, 0.8, 0.9], rz: k * rad(-20) })));
    [-0.35, 0.35].forEach((x) => { ch.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 12), orange, { x, y: -1.1 })); ch.add(mesh(new THREE.BoxGeometry(0.34, 0.06, 0.4), orange, { x, y: -1.4, z: 0.1 })); });
    ch.position.set(0, 0.55, 0.5); ch.rotation.y = rad(-18);
    scene.add(ch);
    const road = canvasTex(512, 512, (g) => { g.fillStyle = '#374151'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#f8fafc'; for (let i = 0; i < 5; i++) for (let j = 0; j < 8; j++) g.fillRect(i * 128 + 60, j * 64 + 10, 8, 34); }, { repeat: true });
    scene.add(mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshStandardMaterial({ map: road, roughness: 0.75, envMapIntensity: 0.3 }), { rx: -Math.PI / 2, y: -0.95 }));
    const car = (c) => {
      const g = new THREE.Group(), p = M.plastic(c, 0.15);
      const b = box(1.0, 0.5, 2.0, 0.22, p); b.castShadow = true; g.add(b);
      const top = box(0.82, 0.42, 1.0, 0.2, M.plastic('#0f172a', 0.05)); top.position.set(0, 0.4, -0.1); g.add(top);
      [[-0.5, 0.65], [0.5, 0.65], [-0.5, -0.65], [0.5, -0.65]].forEach(([x, z]) => g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 24), M.plastic('#111', 0.5), { x, y: -0.25, z, rz: Math.PI / 2 })));
      [-0.3, 0.3].forEach((x) => g.add(mesh(new THREE.SphereGeometry(0.08, 12, 8), M.glow('#fff7c2', 4), { x, y: 0.02, z: 1.0, shadow: false })));
      return g;
    };
    const c1 = car('#ef4444'); c1.position.set(-2.6, -0.45, -0.8); c1.rotation.y = rad(8);
    const c2 = car('#8b5cf6'); c2.position.set(2.7, -0.45, -1.4); c2.rotation.y = rad(-170);
    scene.add(c1, c2);
    scene.add(sparkles(20, 63, { spread: [8, 5, 3], center: [0, 1.3, 0], colors: ['#ffffff', '#fef08a'] }));
    return s;
  },

  // Le Gratte-Ciel: a tower of glass blocks stacked crooked, a city at sunset behind
  gratteciel: async () => {
    const s = studio({ colors: ['#38a6f5', '#3b1c8c'], light: '#fbcfe8', rim: '#f9a8d4', seed: 71, camY: 0.6, dist: 15, lift: 0.08 });
    const { scene } = s;
    const r = rng(7);
    for (let i = 0; i < 12; i++) {
      const h = 1.5 + r() * 3.5, w = 0.6 + r() * 0.8;
      scene.add(mesh(new THREE.BoxGeometry(w, h, 0.6), M.matte('#2e1065', 0.9), { x: -5 + i * 0.9, y: -2.6 + h / 2, z: -4.5, shadow: false }));
    }
    scene.add(mesh(new THREE.SphereGeometry(0.9, 48, 32), M.glow('#ffd27a', 1.6), { x: 2.6, y: 2.6, z: -6, shadow: false }));
    const cols = ['#22d3ee', '#a78bfa', '#f472b6', '#facc15', '#34d399', '#60a5fa'];
    let y = -2.4, x = 0;
    for (let k = 0; k < 6; k++) {
      const w = 2.2 - k * 0.15, c = cols[k % cols.length];
      const m = new THREE.MeshPhysicalMaterial({ color: c, metalness: 0, roughness: 0.05, transmission: 0.55, thickness: 1, ior: 1.45, clearcoat: 1, emissive: c, emissiveIntensity: 0.35, envMapIntensity: 1 });
      const b = box(w, 0.78, 1.6, 0.08, m); b.castShadow = b.receiveShadow = true;
      x += (k % 2 ? 1 : -1) * 0.12 * k;
      b.position.set(x, y + 0.39, 0); b.rotation.y = rad((k % 3 - 1) * 6);
      scene.add(b);
      scene.add(mesh(new THREE.BoxGeometry(w * 0.98, 0.03, 1.62), M.glow(c, 2.2), { x, y: y + 0.79, z: 0, ry: b.rotation.y, shadow: false }));
      y += 0.8;
    }
    // the next block hanging from the crane
    const top = box(1.5, 0.78, 1.6, 0.08, M.plastic('#f8fafc', 0.15)); top.position.set(1.4, y + 1.3, 0); scene.add(top);
    scene.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 8), M.steel('#cbd5e1'), { x: 1.4, y: y + 2.9 }));
    scene.add(mesh(new THREE.BoxGeometry(14, 0.3, 4), M.matte('#1e1b4b', 0.8), { y: -2.55 }));
    scene.add(sparkles(26, 73, { spread: [8, 7, 3], center: [0, 0.6, 0.5], colors: ['#ffffff', '#fbcfe8', '#a5f3fc'] }));
    return s;
  },

  // Le Penalty: a ball flying into the top corner of the net
  penalty: async () => {
    const s = studio({ colors: ['#22b45e', '#0b4a26'], light: '#bbf7d0', rim: '#86efac', seed: 81, camY: 1.0, dist: 12.5, lift: 0.1 });
    const { scene } = s;
    // goal: posts and a net
    const post = M.plastic('#f8fafc', 0.25);
    scene.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.2, 24), post, { x: -3.4, y: 0.6, z: -2 }));
    scene.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.2, 24), post, { x: 3.4, y: 0.6, z: -2 }));
    scene.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 6.9, 24), post, { y: 2.2, z: -2, rz: Math.PI / 2 }));
    const netT = canvasTex(512, 512, (g) => { g.clearRect(0, 0, 512, 512); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; for (let i = 0; i <= 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); } }, { repeat: true });
    netT.repeat.set(3, 1.6);
    scene.add(mesh(new THREE.PlaneGeometry(6.8, 3.2), new THREE.MeshStandardMaterial({ map: netT, transparent: true, side: THREE.DoubleSide, roughness: 0.9 }), { y: 0.6, z: -3.0, shadow: false }));
    // pitch
    const grass = canvasTex(512, 512, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#15803d' : '#16a34a'; g.fillRect(0, i * 64, 512, 64); } g.strokeStyle = '#ecfdf5'; g.lineWidth = 6; g.strokeRect(80, -10, 352, 200); }, {});
    scene.add(mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.9, envMapIntensity: 0.2 }), { rx: -Math.PI / 2, y: -1.0 }));
    // ball: an icosahedron pattern painted on a sphere
    const ballT = canvasTex(1024, 512, (g) => {
      g.fillStyle = '#fafafa'; g.fillRect(0, 0, 1024, 512);
      g.fillStyle = '#111827';
      const pent = (x, y, r) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); };
      for (let i = 0; i < 5; i++) { pent(i * 205 + 100, 150, 52); pent(i * 205 + 200, 360, 52); }
      pent(512, 18, 70); pent(512, 500, 70);
      g.strokeStyle = '#9ca3af'; g.lineWidth = 2; for (let i = 0; i < 1024; i += 102) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 50, 512); g.stroke(); }
    });
    const ball = mesh(new THREE.SphereGeometry(0.85, 64, 48), new THREE.MeshPhysicalMaterial({ map: ballT, roughness: 0.35, clearcoat: 0.6, envMapIntensity: 0.6 }), { x: 1.5, y: 1.3, z: 1.4, rx: 0.5, ry: 0.8 });
    scene.add(ball);
    const trail = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.5, -0.9, 4), new THREE.Vector3(0, 0.1, 3), new THREE.Vector3(1.2, 1.0, 1.8)]);
    scene.add(mesh(new THREE.TubeGeometry(trail, 40, 0.07, 12), new THREE.MeshBasicMaterial({ color: '#ecfccb', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }), { shadow: false }));
    scene.add(sparkles(22, 83, { spread: [7, 5, 3], center: [1, 1.2, 1], colors: ['#ffffff', '#d9f99d'] }));
    return s;
  },

  // Le Derby: a blue striker has just shot, the ball flies into the top corner past the diving keeper, gold coins (the pot)
  foot: async () => {
    const s = studio({ colors: ['#22b45e', '#062a14'], light: '#bbf7d0', rim: '#86efac', seed: 117, camY: 2.2, dist: 13, lift: 0.12 });
    const { scene } = s;
    const grass = canvasTex(1024, 1024, (g) => { for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#15803d' : '#16a34a'; g.fillRect(i * 86, 0, 86, 1024); } g.strokeStyle = '#ecfdf5'; g.lineWidth = 10; g.beginPath(); g.moveTo(0, 360); g.lineTo(1024, 360); g.stroke(); g.beginPath(); g.arc(512, 360, 170, 0, Math.PI); g.stroke(); });
    scene.add(mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.92, envMapIntensity: 0.25 }), { rx: -Math.PI / 2, y: -1.6, z: -4 }));
    // the goal, a little to the right and behind
    const post = M.plastic('#f8fafc', 0.25), gx = 1.2, gz = -4.2;
    scene.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.0, 20), post, { x: gx - 2.6, y: -0.1, z: gz }));
    scene.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.0, 20), post, { x: gx + 2.6, y: -0.1, z: gz }));
    scene.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.3, 20), post, { x: gx, y: 1.4, z: gz, rz: Math.PI / 2 }));
    const netT = canvasTex(512, 512, (g) => { g.clearRect(0, 0, 512, 512); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; for (let i = 0; i <= 512; i += 28) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); } }, { repeat: true });
    netT.repeat.set(3, 1.8);
    scene.add(mesh(new THREE.PlaneGeometry(5.2, 3.0), new THREE.MeshStandardMaterial({ map: netT, transparent: true, side: THREE.DoubleSide, roughness: 0.9 }), { x: gx, y: -0.1, z: gz - 1.2, shadow: false }));
    // a footballer made of rounded pieces, posed with the joints
    const player = ({ shirt, shorts, socks, skin, hair, num, gloves }) => {
      const g = new THREE.Group(), mat = (c) => M.matte(c, 0.55);
      const joint = (x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); g.add(j); return j; };
      const seg = (parent, r, len, m, y0 = 0) => { const c = mesh(new THREE.CapsuleGeometry(r, len, 8, 16), m, { y: y0 - len / 2 - r * 0.6 }); parent.add(c); return c; };
      g.add(mesh(new THREE.CapsuleGeometry(0.34, 0.55, 8, 20), mat(shirt), { y: 1.2, s: [1, 1, 0.78] }));
      g.add(mesh(new THREE.CylinderGeometry(0.33, 0.36, 0.34, 20), mat(shorts), { y: 0.68, s: [1, 1, 0.8] }));
      if (num) { const t = label(num, { w: 256, h: 256, font: '900 170px Arial', color: '#ffffff' }); g.add(mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6 }), { y: 1.25, z: -0.29, ry: Math.PI, shadow: false })); }
      g.add(mesh(new THREE.SphereGeometry(0.23, 32, 24), mat(skin), { y: 1.92 }));
      g.add(mesh(new THREE.SphereGeometry(0.245, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(hair), { y: 1.95, rx: -0.25 }));
      const legs = [-1, 1].map((k) => { const hip = joint(k * 0.17, 0.62, 0); seg(hip, 0.12, 0.42, mat(skin)); const knee = new THREE.Group(); knee.position.y = -0.7; hip.add(knee); seg(knee, 0.105, 0.42, mat(socks)); knee.add(mesh(new THREE.BoxGeometry(0.2, 0.12, 0.36), M.matte('#111111', 0.5), { y: -0.72, z: 0.08 })); return { hip, knee }; });
      const arms = [-1, 1].map((k) => { const sh = joint(k * 0.44, 1.52, 0); seg(sh, 0.09, 0.32, mat(shirt)); const el = new THREE.Group(); el.position.y = -0.5; sh.add(el); seg(el, 0.08, 0.3, mat(gloves ? shirt : skin)); if (gloves) el.add(mesh(new THREE.SphereGeometry(0.11, 16, 12), mat(gloves), { y: -0.5 })); return { sh, el }; });
      return { g, legs, arms };
    };
    // the striker: right leg through the ball, arms open
    const st = player({ shirt: '#1d4ed8', shorts: '#f8fafc', socks: '#1d4ed8', skin: '#d9a066', hair: '#1f1a17', num: '10' });
    st.legs[1].hip.rotation.x = -1.15; st.legs[1].knee.rotation.x = 0.25; st.legs[0].hip.rotation.x = 0.35; st.legs[0].knee.rotation.x = 0.6;
    st.arms[0].sh.rotation.z = -1.1; st.arms[1].sh.rotation.z = 1.0; st.arms[1].sh.rotation.x = 0.5;
    st.g.position.set(-2.6, -1.55, 0.6); st.g.rotation.set(0, Math.PI + 0.65, -0.08); st.g.scale.setScalar(1.05);
    scene.add(st.g);
    // the keeper: flying to his left, arms stretched to the ball
    const gk = player({ shirt: '#f59e0b', shorts: '#1c1917', socks: '#f59e0b', skin: '#a8714a', hair: '#0b0b0b', gloves: '#f8fafc' });
    gk.arms[0].sh.rotation.z = 2.8; gk.arms[1].sh.rotation.z = 2.5; gk.legs[0].hip.rotation.z = 0.25; gk.legs[1].hip.rotation.z = -0.1; gk.legs[1].knee.rotation.x = 0.5;
    gk.g.position.set(1.75, 0.25, gz + 0.5); gk.g.rotation.set(0.1, -0.2, -1.25); gk.g.scale.setScalar(0.95);
    scene.add(gk.g);
    // the ball, just out of his reach, and its trail
    const ballT = canvasTex(1024, 512, (g) => {
      g.fillStyle = '#fafafa'; g.fillRect(0, 0, 1024, 512); g.fillStyle = '#111827';
      const pent = (x, y, r) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); };
      for (let i = 0; i < 5; i++) { pent(i * 205 + 100, 150, 52); pent(i * 205 + 200, 360, 52); }
      pent(512, 18, 70); pent(512, 500, 70);
    });
    scene.add(mesh(new THREE.SphereGeometry(0.42, 64, 48), new THREE.MeshPhysicalMaterial({ map: ballT, roughness: 0.35, clearcoat: 0.6, envMapIntensity: 0.6 }), { x: 3.3, y: 1.0, z: gz + 0.3, rx: 0.4, ry: 0.9 }));
    const trail = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.6, -1.2, 1.0), new THREE.Vector3(0.8, 0.6, -0.8), new THREE.Vector3(3.0, 0.98, gz + 0.4)]);
    scene.add(mesh(new THREE.TubeGeometry(trail, 60, 0.06, 12), new THREE.MeshBasicMaterial({ color: '#fef08a', transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }), { shadow: false }));
    // the pot
    [[-0.6, -1.35, 2.6, 0.9, 0.4], [0.3, -1.4, 3.1, 1.3, -0.5], [-1.4, -1.2, 3.3, 0.5, 0.9]].forEach(([x, y, z, rx, rz]) => { const c = coin(0.42, 0.1, M.gold('#ffc53d', 0.2), coinFace('k')); c.position.set(x, y, z); c.rotation.set(rx, 0, rz); scene.add(c); });
    scene.add(shadowFloor(-1.59, 0.4));
    scene.add(sparkles(30, 119, { spread: [10, 5, 4], center: [0.5, 2.2, -2], colors: ['#ffffff', '#fef9c3', '#bbf7d0'] }));
    return s;
  },

  // Le Ticket: a scratch card half scratched, a gold coin on it
  ticket: async () => {
    const s = studio({ colors: ['#f6c21f', '#a3176b'], light: '#fde68a', rim: '#f9a8d4', seed: 91, camY: 3.0, dist: 11.5, lift: 0.12 });
    const { scene } = s;
    const face = canvasTex(768, 1024, (g) => {
      const bg = g.createLinearGradient(0, 0, 0, 1024); bg.addColorStop(0, '#fde047'); bg.addColorStop(1, '#f97316');
      g.fillStyle = bg; g.fillRect(0, 0, 768, 1024);
      g.fillStyle = '#9d174d'; g.fillRect(0, 0, 768, 150);
      g.fillStyle = '#fff'; g.font = '900 96px Arial'; g.textAlign = 'center'; g.fillText('×1000', 384, 108);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const x = 90 + i * 210, y = 220 + j * 250;
        const scratched = (i + j) % 3 === 0;
        if (scratched) {
          g.fillStyle = '#fff7ed'; g.fillRect(x, y, 170, 200);
          g.fillStyle = '#b45309'; g.font = '900 80px Arial'; g.fillText('★', x + 85, y + 125);
        } else {
          const sg = g.createLinearGradient(x, y, x + 170, y + 200); sg.addColorStop(0, '#e5e7eb'); sg.addColorStop(0.5, '#9ca3af'); sg.addColorStop(1, '#d1d5db');
          g.fillStyle = sg; g.fillRect(x, y, 170, 200);
          g.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 40; k++) g.fillRect(x + Math.random() * 170, y + Math.random() * 200, 3, 3);
        }
      }
    });
    const card = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.05, 4.5), [M.matte('#9d174d'), M.matte('#9d174d'), new THREE.MeshPhysicalMaterial({ map: face, roughness: 0.35, clearcoat: 0.5, envMapIntensity: 0.6 }), M.matte('#7c2d12'), M.matte('#9d174d'), M.matte('#9d174d')]);
    card.castShadow = card.receiveShadow = true;
    card.rotation.set(rad(22), rad(-18), rad(4)); card.position.set(-0.2, 0.2, 0);
    scene.add(card);
    const back = card.clone(); back.position.set(0.9, -0.15, -1.0); back.rotation.set(rad(18), rad(10), rad(-10)); scene.add(back);
    const c = coin(0.75, 0.16, M.gold('#ffc53d', 0.2), coinFace('k'));
    c.rotation.set(rad(60), 0, rad(-30)); c.position.set(1.4, 1.2, 1.4); scene.add(c);
    scene.add(shadowFloor(-1.6, 0.45));
    scene.add(sparkles(34, 93, { spread: [7, 6, 3], center: [0, 0.6, 0.8], colors: ['#ffffff', '#fde68a', '#f9a8d4'] }));
    return s;
  },

  // La Descente: glass marbles racing down glowing rails
  billes: async () => {
    const s = studio({ colors: ['#2aa8e8', '#3b1c8c'], light: '#bae6fd', rim: '#a78bfa', seed: 101, camY: 1.8, dist: 12.5, lift: 0.1 });
    const { scene } = s;
    const rail = (pts, c) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
      scene.add(mesh(new THREE.TubeGeometry(curve, 120, 0.07, 12), M.glow(c, 2.4), { shadow: false }));
      scene.add(mesh(new THREE.TubeGeometry(curve, 120, 0.2, 12), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }), { shadow: false }));
    };
    rail([[-3.6, 3.2, -1], [-1.4, 1.6, -0.5], [0.6, 0.8, 0], [2.6, -0.4, 0.4], [3.6, -1.6, 0.6]], '#38bdf8');
    rail([[3.6, 2.4, -1.4], [1.2, 1.0, -0.8], [-1.0, -0.2, -0.2], [-3.2, -1.6, 0.4]], '#c084fc');
    const marble = (c, r) => {
      const g = new THREE.Group();
      g.add(mesh(new THREE.SphereGeometry(r, 64, 48), new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.02, transmission: 0.7, thickness: r * 2, ior: 1.5, clearcoat: 1, envMapIntensity: 1.2, attenuationColor: c, attenuationDistance: r * 1.5 })));
      const swirl = new THREE.TorusKnotGeometry(r * 0.45, r * 0.12, 100, 12, 2, 3);
      g.add(mesh(swirl, M.glow(c, 1.4), { shadow: false }));
      return g;
    };
    [['#ef4444', 0.55, -1.2, 1.75, -0.4], ['#facc15', 0.5, 0.8, 0.95, 0.1], ['#22c55e', 0.6, -0.6, -0.05, 0.3], ['#3b82f6', 0.45, 2.3, -0.05, 0.5], ['#e879f9', 0.42, 1.8, 1.55, -0.9]].forEach(([c, r, x, y, z]) => { const m = marble(c, r); m.position.set(x, y + r * 0.4, z); scene.add(m); });
    // pegs
    for (let i = 0; i < 10; i++) scene.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 16), M.silver('#e2e8f0', 0.15), { x: -3 + (i % 5) * 1.5, y: -1.9 + Math.floor(i / 5) * 0.6, z: -1.5, rx: Math.PI / 2 }));
    scene.add(sparkles(30, 103, { spread: [8, 7, 3], center: [0, 0.6, 0], colors: ['#ffffff', '#bae6fd', '#e9d5ff'] }));
    return s;
  },

  // La Roue d'Or: a golden wheel of dark wedges with one shining BONUS wedge and its pointer
  // Le Pilote: a white jet climbing away from a carrier deck, a gold coin and a purple star ahead, a spiky bomb below
  pilote: async () => {
    const s = studio({ colors: ['#38a6f5', '#0b2a6f'], light: '#fde68a', rim: '#bae6fd', seed: 121, camY: 1.6, dist: 13, lift: 0.12 });
    const { scene } = s;
    // sea and the carrier (grey hull, dark deck with white dashes, island tower)
    const waves = canvasTex(512, 512, (g) => { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#0b4f8a'); gr.addColorStop(1, '#06305a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); g.strokeStyle = 'rgba(186,230,253,.45)'; g.lineWidth = 5; for (let j = 0; j < 10; j++) { g.beginPath(); for (let x = 0; x <= 512; x += 16) g.lineTo(x, j * 52 + 20 + Math.sin(x * 0.05 + j) * 6); g.stroke(); } }, { repeat: true });
    waves.repeat.set(4, 3);
    scene.add(mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshPhysicalMaterial({ map: waves, roughness: 0.25, clearcoat: 1, envMapIntensity: 0.4 }), { rx: -Math.PI / 2, y: -2.9, shadow: false }));
    const ship = new THREE.Group(), grey = M.steel('#64748b', 0.45), deck = M.matte('#334155', 0.8);
    ship.add(box(7.4, 0.9, 2.3, 0.12, grey));
    ship.add(mesh(new THREE.BoxGeometry(7.6, 0.12, 2.5), deck, { y: 0.5 }));
    for (let i = 0; i < 7; i++) ship.add(mesh(new THREE.BoxGeometry(0.5, 0.02, 0.07), M.glow('#ffffff', 1.1), { x: -3.2 + i * 1.0, y: 0.57, shadow: false }));
    for (let i = 0; i < 8; i++) ship.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), M.glow('#4ade80', 3), { x: -3.5 + i * 0.95, y: 0.6, z: 1.15, shadow: false }));
    const IX = -2.3, isl = box(0.9, 1.3, 0.8, 0.06, grey); isl.position.set(IX, 1.2, -0.75); ship.add(isl);
    const top = box(0.5, 0.45, 0.5, 0.05, grey); top.position.set(IX, 2.05, -0.75); ship.add(top);
    [0, 1, 2].forEach((k) => ship.add(mesh(new THREE.BoxGeometry(0.16, 0.14, 0.02), M.glow('#93c5fd', 1.6), { x: IX - 0.25 + k * 0.25, y: 1.45, z: -0.34, shadow: false })));
    ship.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8), M.steel('#cbd5e1'), { x: IX, y: 2.7, z: -0.75 }));
    ship.position.set(-0.6, -2.6, -0.6); ship.rotation.y = rad(22);
    scene.add(ship);
    // the jet (white with a blue stripe and a red tail)
    const jet = new THREE.Group(), white = M.plastic('#f8fafc', 0.22), red = M.plastic('#dc2626', 0.22), blue = M.plastic('#2563eb', 0.2), glass = M.plastic('#0ea5e9', 0.05);
    jet.add(mesh(new THREE.CapsuleGeometry(0.4, 2.5, 16, 32), white, { rz: Math.PI / 2 }));
    [-1, 1].forEach((k) => jet.add(mesh(new THREE.BoxGeometry(2.3, 0.1, 0.04), blue, { x: -0.1, y: -0.02, z: k * 0.39 })));
    jet.add(mesh(new THREE.SphereGeometry(0.32, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass, { x: 0.9, y: 0.22, rz: rad(-20), s: [1.4, 0.8, 0.9] }));
    const wing = new THREE.Shape(); wing.moveTo(0.5, 0); wing.lineTo(-0.5, 0); wing.lineTo(-1.1, 1.9); wing.lineTo(-0.6, 1.9); wing.closePath();
    const wGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    jet.add(mesh(wGeo, white, { rx: Math.PI / 2, y: 0.02 }), mesh(wGeo, white, { rx: -Math.PI / 2, y: -0.02 }));
    const fin = new THREE.Shape(); fin.moveTo(-0.95, 0); fin.lineTo(-1.7, 0); fin.lineTo(-1.95, 1.05); fin.lineTo(-1.6, 1.05); fin.closePath();
    jet.add(mesh(new THREE.ExtrudeGeometry(fin, { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 }), red, { y: 0.15, z: -0.035 }));
    jet.add(mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.25, 32), M.steel('#334155', 0.3), { x: -1.7, rz: Math.PI / 2 }));
    jet.add(mesh(new THREE.ConeGeometry(0.22, 0.9, 24), M.glow('#ffb15c', 4), { x: -2.2, rz: Math.PI / 2, shadow: false }));
    jet.rotation.set(rad(-14), rad(-30), rad(24)); jet.position.set(0.5, 1.3, 0.6); jet.scale.setScalar(0.95);
    scene.add(jet);
    // its trail from the deck
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-4.4, -1.95, -0.4), new THREE.Vector3(-2.6, -1.5, 0), new THREE.Vector3(-1.3, -0.1, 0.3), new THREE.Vector3(-0.9, 0.55, 0.45)]);
    scene.add(mesh(new THREE.TubeGeometry(curve, 64, 0.09, 16), M.glow('#e0f2fe', 2.2), { shadow: false }));
    scene.add(mesh(new THREE.TubeGeometry(curve, 64, 0.26, 16), new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }), { shadow: false }));
    // a gold coin and a purple star ahead
    const c = coin(0.62, 0.16, M.gold('#ffc53d', 0.2), coinFace('k')); c.rotation.set(rad(80), 0, rad(-12)); c.position.set(2.6, 2.6, 0); scene.add(c);
    const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.32 : 0.75; if (i) st.lineTo(Math.cos(a) * r, Math.sin(a) * r); else st.moveTo(Math.cos(a) * r, Math.sin(a) * r); } st.closePath();
    scene.add(mesh(new THREE.ExtrudeGeometry(st, { depth: 0.22, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 }), new THREE.MeshPhysicalMaterial({ color: '#d946ef', metalness: 0.2, roughness: 0.15, clearcoat: 1, emissive: '#a21caf', emissiveIntensity: 0.6 }), { x: -2.3, y: 2.4, z: -0.4, rz: rad(12), ry: rad(18) }));
    // the spiky bomb with its red light
    const bomb = new THREE.Group(), blk = M.plastic('#111827', 0.3);
    bomb.add(mesh(new THREE.SphereGeometry(0.62, 48, 32), blk));
    for (let i = 0; i < 14; i++) { const v = new THREE.Vector3().setFromSphericalCoords(1, Math.acos(1 - 2 * (i + 0.5) / 14), i * 2.4); const sp = mesh(new THREE.ConeGeometry(0.1, 0.42, 12), M.steel('#475569', 0.3)); sp.position.copy(v.clone().multiplyScalar(0.7)); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); bomb.add(sp); }
    bomb.add(mesh(new THREE.SphereGeometry(0.11, 16, 12), M.glow('#ef4444', 4), { y: 0.25, z: 0.55, shadow: false }));
    bomb.position.set(2.5, -0.9, 0.4); scene.add(bomb);
    scene.add(sparkles(28, 123, { spread: [8, 7, 3], center: [0, 0.8, -0.5], colors: ['#ffffff', '#fde68a', '#bae6fd'] }));
    return s;
  },

  roueor: async () => {
    const s = studio({ colors: ['#e0a526', '#2a1f06'], light: '#fde68a', rim: '#fff0b0', seed: 111, camY: 1.2, dist: 15.5, lift: 0.11 });
    const { scene } = s;
    const wheel = new THREE.Group(), goldM = M.gold('#ffc53d', 0.18), dark = M.plastic('#1f2937', 0.3), dark2 = M.plastic('#111827', 0.3);
    const n = 16;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 0.95) / n) * Math.PI * 2;
      const sh = new THREE.Shape(); sh.moveTo(Math.cos(a0) * 0.9, Math.sin(a0) * 0.9); sh.absarc(0, 0, 3.2, a0, a1, false); sh.lineTo(Math.cos(a1) * 0.9, Math.sin(a1) * 0.9); sh.absarc(0, 0, 0.9, a1, a0, true);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 8 });
      const bonus = k < 3;
      wheel.add(mesh(geo, bonus ? M.gold('#ffd86b', 0.12) : k % 2 ? dark : dark2));
    }
    wheel.add(mesh(new THREE.TorusGeometry(3.35, 0.22, 24, 128), goldM, { z: 0.12 }));
    for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2; wheel.add(mesh(new THREE.SphereGeometry(0.08, 16, 12), M.glow('#fff1b8', 2.6), { x: Math.cos(a) * 3.35, y: Math.sin(a) * 3.35, z: 0.36, shadow: false })); }
    wheel.add(mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.4, 64), goldM, { rx: Math.PI / 2, z: 0.2 }));
    wheel.add(mesh(new THREE.SphereGeometry(0.55, 48, 32), M.gold('#fff1b8', 0.1), { z: 0.42, s: [1, 1, 0.5] }));
    wheel.add(sparkles(16, 113, { center: [Math.cos(0.6) * 2.2, Math.sin(0.6) * 2.2, 0.5], spread: [1.6, 1.6, 0.4], colors: ['#fff', '#fde68a'], size: [0.12, 0.4] }));
    wheel.rotation.set(rad(-14), rad(-16), rad(56));
    wheel.position.y = 0.2;
    scene.add(wheel);
    const ptr = new THREE.Shape(); ptr.moveTo(0, -0.55); ptr.lineTo(0.42, 0.25); ptr.lineTo(-0.42, 0.25); ptr.closePath();
    scene.add(mesh(new THREE.ExtrudeGeometry(ptr, { depth: 0.25, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 }), M.gold('#fff1b8', 0.12), { y: 3.75, z: 0.6 }));
    scene.add(floorShadow(3.4, 0.5, -3.4));
    scene.add(sparkles(30, 117, { spread: [8, 7, 3], center: [0, 0.4, 0.5], colors: ['#ffffff', '#fde68a'] }));
    return s;
  },
};

/* ---------- game pieces (transparent pictures used inside the games) → assets/games/<game>/<name>.webp ---------- */
function coinSide(kind) {
  return canvasTex(512, 512, (g) => {
    const gold = kind === 'face';
    const rg = g.createRadialGradient(256, 220, 20, 256, 256, 256);
    rg.addColorStop(0, gold ? '#fff6c8' : '#ffffff'); rg.addColorStop(1, gold ? '#c98a12' : '#94a3b8');
    g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
    const ink = gold ? '#7a4a06' : '#1e293b';
    g.strokeStyle = ink; g.lineWidth = 8; g.beginPath(); g.arc(256, 256, 214, 0, 7); g.stroke();
    g.setLineDash([10, 14]); g.lineWidth = 5; g.beginPath(); g.arc(256, 256, 190, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (gold) {
      g.beginPath(); g.moveTo(160, 190); g.lineTo(182, 112); g.lineTo(222, 160); g.lineTo(256, 92); g.lineTo(290, 160); g.lineTo(330, 112); g.lineTo(352, 190); g.closePath(); g.fill();
      g.lineWidth = 14; g.strokeStyle = ink; g.beginPath(); g.arc(256, 282, 78, 0, 7); g.stroke();
      g.beginPath(); g.arc(226, 268, 11, 0, 7); g.fill(); g.beginPath(); g.arc(286, 268, 11, 0, 7); g.fill();
      g.beginPath(); g.arc(256, 288, 40, 0.35, 2.8); g.stroke();
      g.font = '900 54px Arial'; g.fillText('FACE', 256, 420);
    } else {
      g.font = '900 190px Arial'; g.fillText('×2', 256, 262);
      g.font = '900 54px Arial'; g.fillText('PILE', 256, 420);
    }
  });
}
export const SPRITES = {
  'mines/gem': async () => {
    const p = piece({ dist: 6.2, camY: 1.6 });
    const g = mesh(gemGeo(1, 10), M.gem('#0dbf5c', 0.5), { rx: rad(-8), rz: rad(10), s: 1.3, y: 0.15 }); g.material.transmission = 0; g.material.metalness = 0.3; g.material.roughness = 0.1; g.material.color.set('#03803c'); g.material.emissive.set('#0a9e4c'); g.material.emissiveIntensity = 0.35; g.material.clearcoat = 0.5; g.material.envMapIntensity = 0.7;
    p.scene.add(g);
    return p;
  },
  'mines/bomb': async () => {
    const p = piece({ dist: 7, camY: 1.2, look: [0.1, 0.3, 0] });
    const b = new THREE.Group();
    b.add(mesh(new THREE.SphereGeometry(1.05, 64, 48), M.plastic('#15151c', 0.25)));
    b.add(mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.38, 32), M.steel('#6b7280', 0.3), { y: 1.02 }));
    const fuse = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.18, 0), new THREE.Vector3(0.25, 1.6, 0.05), new THREE.Vector3(0.6, 1.72, 0.1), new THREE.Vector3(0.88, 1.58, 0.1)]);
    b.add(mesh(new THREE.TubeGeometry(fuse, 32, 0.065, 12), M.matte('#c8a36a', 0.8)));
    b.add(mesh(new THREE.SphereGeometry(0.2, 24, 16), M.glow('#ffcc55', 6), { x: 0.9, y: 1.58, z: 0.1 }));
    b.add(sparkles(10, 4, { center: [0.9, 1.58, 0.1], spread: [0.8, 0.8, 0.4], colors: ['#ffd27a', '#fff'], size: [0.15, 0.45] }));
    b.rotation.z = rad(-10); b.position.y = -0.35;
    p.scene.add(b);
    return p;
  },
  'pileface/face': async () => { const p = piece({ dist: 8.4, camY: 0 }); const c = coin(2, 0.3, M.gold('#ffc53d', 0.22), coinSide('face')); c.rotation.x = Math.PI / 2; p.scene.add(c); return p; },
  'pileface/pile': async () => {
    const p = piece({ dist: 8.4, camY: 0 }); const c = coin(2, 0.3, M.silver('#e8edf3', 0.2), coinSide('pile'));
    c.children.forEach((m) => { if (m.material?.map) m.material.color.set('#eef2f7'); });
    c.rotation.x = Math.PI / 2; p.scene.add(c); return p;
  },
  'casse/door': async () => {
    const p = piece({ dist: 9.2, camY: 0 });
    const d = new THREE.Group(), steel = M.steel('#9aa7b6', 0.28), dark = M.steel('#4b5563', 0.4);
    d.add(mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.4, 96), dark, { rx: Math.PI / 2 }));
    d.add(mesh(new THREE.CylinderGeometry(1.98, 1.98, 0.5, 96), steel, { rx: Math.PI / 2, z: 0.05 }));
    d.add(mesh(new THREE.TorusGeometry(2.1, 0.08, 16, 96), M.silver('#e5e7eb', 0.15), { z: 0.24 }));
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; d.add(mesh(new THREE.SphereGeometry(0.1, 16, 12), M.silver('#f3f4f6', 0.2), { x: Math.cos(a) * 1.75, y: Math.sin(a) * 1.75, z: 0.3 })); }
    p.scene.add(d); return p;
  },
  'casse/wheel': async () => {
    const p = piece({ dist: 4.3, camY: 0 });
    const w = new THREE.Group(), m = M.silver('#f1f5f9', 0.12);
    w.add(mesh(new THREE.TorusGeometry(0.92, 0.1, 20, 72), m));
    w.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.34, 48), M.silver('#cbd5e1', 0.15), { rx: Math.PI / 2 }));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; w.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.92, 16), m, { x: Math.cos(a) * 0.48, y: Math.sin(a) * 0.48, rz: a + Math.PI / 2 })); }
    p.scene.add(w); return p;
  },
  'casse/cash': async () => {
    const p = piece({ dist: 7.5, camY: 2.6 });
    const noteT = canvasTex(256, 128, (g) => { g.fillStyle = '#1f9d55'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#d1fae5'; g.lineWidth = 6; g.strokeRect(8, 8, 240, 112); g.fillStyle = '#bbf7d0'; g.beginPath(); g.arc(128, 64, 34, 0, 7); g.fill(); g.fillStyle = '#166534'; g.font = '900 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('K', 128, 66); });
    for (let k = 0; k < 4; k++) {
      const st = new THREE.Group();
      st.add(mesh(new THREE.BoxGeometry(2.6, 0.42, 1.25), [M.matte('#16a34a'), M.matte('#16a34a'), new THREE.MeshStandardMaterial({ map: noteT, roughness: 0.6 }), M.matte('#16a34a'), M.matte('#15803d'), M.matte('#15803d')]));
      st.add(mesh(new THREE.BoxGeometry(0.5, 0.44, 1.27), M.matte('#fde68a', 0.5)));
      st.position.set((k % 2) * 0.3 - 0.15, -0.8 + k * 0.43, 0); st.rotation.y = rad(k * 9 - 12);
      p.scene.add(st);
    }
    return p;
  },
  'casse/gold': async () => {
    const p = piece({ dist: 7.5, camY: 2.4 });
    const bar = () => { const g = new THREE.Shape(); g.moveTo(-0.9, 0); g.lineTo(0.9, 0); g.lineTo(0.7, 0.55); g.lineTo(-0.7, 0.55); g.closePath(); const geo = new THREE.ExtrudeGeometry(g, { depth: 0.8, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3 }); geo.translate(0, 0, -0.4); return mesh(geo, M.gold('#ffc94a', 0.18)); };
    [[-0.95, -0.6], [0.95, -0.6], [0, 0]].forEach(([x, y]) => { const b = bar(); b.position.set(x, y, 0); b.rotation.y = rad(-12); p.scene.add(b); });
    return p;
  },
  'penalty/ball': async () => {
    const p = piece({ dist: 7.6, camY: 0.8 });
    const ballT = canvasTex(1024, 512, (g) => {
      g.fillStyle = '#fafafa'; g.fillRect(0, 0, 1024, 512); g.fillStyle = '#111827';
      const pent = (x, y, r) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); };
      for (let i = 0; i < 5; i++) { pent(i * 205 + 100, 150, 52); pent(i * 205 + 200, 360, 52); }
      pent(512, 18, 70); pent(512, 500, 70);
    });
    p.scene.add(mesh(new THREE.SphereGeometry(1.6, 64, 48), new THREE.MeshPhysicalMaterial({ map: ballT, roughness: 0.35, clearcoat: 0.6, envMapIntensity: 0.6 }), { rx: 0.5, ry: 0.8 }));
    return p;
  },
  'poulet/chick': async () => {
    const p = piece({ dist: 8.2, camY: 1.4, look: [0, 0.3, 0] });
    const ch = new THREE.Group(), white = M.plastic('#fffdf5', 0.45), red = M.plastic('#ef4444', 0.3), orange = M.plastic('#f59e0b', 0.3), eye = M.plastic('#0f172a', 0.1);
    ch.add(mesh(new THREE.SphereGeometry(1, 64, 48), white, { s: [1, 0.95, 1.05] }));
    ch.add(mesh(new THREE.SphereGeometry(0.62, 48, 32), white, { y: 1.05, z: 0.35 }));
    [[-0.05, 1.72, 0.32, 0.2], [0.12, 1.78, 0.18, 0.22], [0.28, 1.7, 0.05, 0.18]].forEach(([x, y, z, r]) => ch.add(mesh(new THREE.SphereGeometry(r, 24, 16), red, { x: x - 0.1, y, z })));
    ch.add(mesh(new THREE.ConeGeometry(0.17, 0.42, 24), orange, { y: 1.0, z: 0.98, rx: Math.PI / 2 }));
    ch.add(mesh(new THREE.SphereGeometry(0.12, 16, 12), red, { y: 0.8, z: 0.9, s: [0.8, 1.3, 0.8] }));
    [-0.22, 0.22].forEach((x) => { ch.add(mesh(new THREE.SphereGeometry(0.1, 24, 16), eye, { x, y: 1.2, z: 0.9 })); ch.add(mesh(new THREE.SphereGeometry(0.03, 12, 8), M.glow('#fff', 2), { x: x + 0.03, y: 1.24, z: 0.99 })); });
    [-1, 1].forEach((k) => ch.add(mesh(new THREE.SphereGeometry(0.42, 32, 24), white, { x: k * 0.95, y: 0.1, s: [0.35, 0.8, 0.9], rz: k * rad(-20) })));
    [-0.35, 0.35].forEach((x) => { ch.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 12), orange, { x, y: -1.1 })); ch.add(mesh(new THREE.BoxGeometry(0.34, 0.06, 0.4), orange, { x, y: -1.4, z: 0.1 })); });
    ch.rotation.y = rad(-12); ch.position.y = -0.1;
    p.scene.add(ch); return p;
  },
};
// one car seen from above per colour of the road (Le Poulet), one robot per runner (La Course)
['#ef4444', '#3b82f6', '#eab308', '#a855f7', '#22c55e', '#f97316', '#ec4899', '#14b8a6'].forEach((c, k) => {
  SPRITES[`poulet/car${k}`] = async () => {
    const p = piece({ top: true, dist: 9, fov: 30, size: 384 });
    const g = new THREE.Group(), body = M.plastic(c, 0.15);
    const b = box(1.5, 0.6, 2.9, 0.32, body); g.add(b);
    const roof = box(1.2, 0.45, 1.4, 0.28, M.matte('#1e293b', 0.55)); roof.position.set(0, 0.45, -0.1); g.add(roof);
    g.add(mesh(new THREE.BoxGeometry(1.0, 0.04, 0.5), M.plastic(c, 0.1), { y: 0.69, z: -0.1 }));
    [-0.38, 0.38].forEach((x) => { g.add(mesh(new THREE.SphereGeometry(0.12, 12, 8), M.glow('#fff7c2', 3), { x, y: 0.1, z: 1.42 })); g.add(mesh(new THREE.BoxGeometry(0.28, 0.08, 0.06), M.glow('#ff3b3b', 2.5), { x, y: 0.15, z: -1.45 })); });
    [[-0.78, 0.95], [0.78, 0.95], [-0.78, -0.95], [0.78, -0.95]].forEach(([x, z]) => g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 24), M.plastic('#111', 0.5), { x, y: -0.2, z, rz: Math.PI / 2 })));
    g.rotation.y = Math.PI; // nose towards the bottom of the picture, like the drawing
    p.scene.add(g); return p;
  };
});
['#22d3ee', '#facc15', '#f97316', '#e879f9', '#4ade80', '#f43f5e'].forEach((c, k) => {
  SPRITES[`robots/bot${k}`] = async () => {
    const p = piece({ dist: 7.6, camY: 1.2, camX: 2.2, look: [0, 0.75, 0], size: 384 });
    const g = new THREE.Group(), shell = M.plastic(c, 0.2), metal = M.silver('#e2e8f0', 0.2);
    g.add(mesh(new THREE.CapsuleGeometry(0.55, 0.5, 12, 32), shell, { y: 0.15 }));
    const head = box(1.25, 0.95, 1.0, 0.3, shell); head.position.y = 1.35; g.add(head);
    const visor = box(0.55, 0.55, 1.0, 0.18, M.plastic('#0b1020', 0.05)); visor.position.set(0.42, 1.38, 0); g.add(visor);
    [-0.2, 0.2].forEach((z) => g.add(mesh(new THREE.SphereGeometry(0.1, 24, 16), M.glow('#ecfeff', 4), { x: 0.72, y: 1.42, z, s: [0.5, 1.3, 1] })));
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), metal, { y: 2.0 }));
    g.add(mesh(new THREE.SphereGeometry(0.1, 16, 12), M.glow(c, 3), { y: 2.22 }));
    g.add(mesh(new THREE.TorusGeometry(0.34, 0.14, 16, 32), M.plastic('#1f2937', 0.5), { y: -0.55 }));
    g.add(mesh(new THREE.CapsuleGeometry(0.13, 0.4, 8, 16), metal, { x: -0.1, y: 0.3, z: 0.62, rz: rad(-60) }));
    g.rotation.y = rad(0);
    p.scene.add(g); return p;
  };
});
