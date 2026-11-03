// Studio kit for the code-drawn covers: renderer, lighting, materials and small helpers shared by every scene.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export { THREE, RoundedBoxGeometry };

export const W = 600, H = 800;

// seeded random so that every render of a cover is the same
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function canvasTex(w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  return t;
}

// lit studio backdrop: a radial gradient of the card colours, light rays and bokeh
function backdrop([c0, c1], light, seed) {
  const r = rng(seed);
  return canvasTex(W, H, (g) => {
    const rad = g.createRadialGradient(W / 2, H * 0.34, 10, W / 2, H * 0.4, H * 0.75);
    rad.addColorStop(0, c0); rad.addColorStop(0.55, c1); rad.addColorStop(1, '#020205');
    g.fillStyle = rad; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + r() * 0.1;
      g.fillStyle = `rgba(255,255,255,${0.018 + r() * 0.02})`;
      g.beginPath(); g.moveTo(W / 2, H * 0.32);
      g.lineTo(W / 2 + Math.cos(a) * 1200, H * 0.32 + Math.sin(a) * 1200);
      g.lineTo(W / 2 + Math.cos(a + 0.09) * 1200, H * 0.32 + Math.sin(a + 0.09) * 1200); g.fill();
    }
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = r() * H * 0.8, rr = 4 + r() * 26;
      const b = g.createRadialGradient(x, y, 0, x, y, rr);
      b.addColorStop(0, light + '55'); b.addColorStop(1, light + '00');
      g.fillStyle = b; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
    }
  });
}

// scene + camera + lights; the subject should sit around the origin, it is drawn in the upper part of the picture
export function studio({ colors, light = '#ffffff', key = '#fff4e0', rim = '#88ccff', seed = 1, fov = 40, dist = 14, camY = 1.2, lift = 0.17, exposure = 0.95 }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = backdrop(colors, light, seed);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(fov, W / H, 0.1, 200);
  camera.position.set(0, camY, dist);
  camera.lookAt(0, 0, 0);
  camera.setViewOffset(W, H, 0, H * lift, W, H); // subject higher in the picture (the title plate covers the bottom)

  const keyL = new THREE.DirectionalLight(key, 2.6);
  keyL.position.set(4, 7, 6); keyL.castShadow = true;
  keyL.shadow.mapSize.set(2048, 2048); keyL.shadow.radius = 6; keyL.shadow.bias = -0.0004;
  Object.assign(keyL.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 40 });
  scene.add(keyL);
  const rimL = new THREE.DirectionalLight(rim, 3.2); rimL.position.set(-6, 3, -6); scene.add(rimL);
  const rimR = new THREE.DirectionalLight(light, 1.6); rimR.position.set(6, 2, -5); scene.add(rimR);
  scene.add(new THREE.HemisphereLight('#ffffff', colors[1], 0.5));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.38, 0.5, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return { renderer, scene, camera, composer, bloom, render: () => composer.render() };
}

/* ---------- materials ---------- */
export const M = {
  gold: (c = '#ffc53d', rough = 0.22) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 1, roughness: rough, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 0.85 }),
  silver: (c = '#dfe6ee', rough = 0.2) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 1, roughness: rough, envMapIntensity: 0.6 }),
  steel: (c = '#8794a3', rough = 0.35) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.9, roughness: rough, envMapIntensity: 0.55 }),
  plastic: (c, rough = 0.28) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.6 }),
  matte: (c, rough = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, envMapIntensity: 0.5 }),
  gem: (c, emissive = 0.35) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.1, roughness: 0.04, transmission: 0.55, thickness: 1.5, ior: 2.2, clearcoat: 1, emissive: c, emissiveIntensity: emissive, flatShading: true, attenuationColor: c, attenuationDistance: 0.35, envMapIntensity: 1.2 }),
  glass: (c = '#ffffff', tint = 0.9) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0, roughness: 0.03, transmission: tint, thickness: 0.8, ior: 1.5, clearcoat: 1 }),
  glow: (c, k = 3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false }),
};

/* ---------- shapes ---------- */
export const box = (w, h, d, r, mat, seg = 4) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, r), mat);
export function mesh(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s);
  m.castShadow = shadow; m.receiveShadow = shadow;
  return m;
}
export const group = (...kids) => { const g = new THREE.Group(); kids.forEach((k) => k && g.add(k)); return g; };

// brilliant-cut gem (lathe profile, flat shaded facets)
export function gemGeo(r = 1, facets = 10) {
  const pts = [new THREE.Vector2(0, -1.05), new THREE.Vector2(r, 0.05), new THREE.Vector2(r * 0.94, 0.2), new THREE.Vector2(r * 0.6, 0.48), new THREE.Vector2(0, 0.48)];
  return new THREE.LatheGeometry(pts, facets);
}
// coin: a cylinder with a raised rim and a picture (canvas texture) on both faces
export function coin(r, h, mat, face) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 96, 1, false), mat); body.castShadow = true; g.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.93, h * 0.28, 16, 96), mat); rim.rotation.x = Math.PI / 2; rim.position.y = h / 2; g.add(rim);
  const rim2 = rim.clone(); rim2.position.y = -h / 2; g.add(rim2);
  if (face) {
    const fm = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: face, metalness: 1, roughness: 0.28, bumpMap: face, bumpScale: 4 });
    fm.color = mat.color.clone();
    const top = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 96), fm); top.rotation.x = -Math.PI / 2; top.position.y = h / 2 + 0.002; g.add(top);
    const bot = top.clone(); bot.rotation.x = Math.PI / 2; bot.position.y = -h / 2 - 0.002; g.add(bot);
  }
  return g;
}
// soft round shadow on the floor
export function floorShadow(r = 3, opacity = 0.5, y = -1.5) {
  const t = canvasTex(256, 256, (g) => { const rad = g.createRadialGradient(128, 128, 0, 128, 128, 128); rad.addColorStop(0, `rgba(0,0,0,${opacity})`); rad.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rad; g.fillRect(0, 0, 256, 256); }, { srgb: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = y;
  return m;
}
export function shadowFloor(y = -1.5, opacity = 0.45) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true;
  return m;
}
// glowing sparkles (additive sprites)
export function sparkles(n, seed, { spread = [6, 5, 3], center = [0, 0.5, 0], colors = ['#ffffff', '#ffe9a8'], size = [0.08, 0.35] } = {}) {
  const r = rng(seed), g = new THREE.Group();
  const tex = canvasTex(64, 64, (c) => {
    const rad = c.createRadialGradient(32, 32, 0, 32, 32, 32); rad.addColorStop(0, '#fff'); rad.addColorStop(0.2, 'rgba(255,255,255,.7)'); rad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = rad; c.fillRect(0, 0, 64, 64);
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(31, 2, 2, 60); c.fillRect(2, 31, 60, 2);
  });
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(colors[i % colors.length]).multiplyScalar(2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
    const s = new THREE.Sprite(m);
    s.position.set(center[0] + (r() - 0.5) * spread[0], center[1] + (r() - 0.5) * spread[1], center[2] + (r() - 0.5) * spread[2]);
    s.scale.setScalar(size[0] + r() * (size[1] - size[0]));
    g.add(s);
  }
  return g;
}
// text drawn on a canvas, as a texture (numbers on balls, slots, coins…)
export function label(text, { w = 256, h = 256, font = '900 150px Arial', color = '#fff', bg = null, stroke = null } = {}) {
  return canvasTex(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (stroke) { g.lineWidth = 14; g.strokeStyle = stroke; g.strokeText(text, w / 2, h / 2 + 6); }
    g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 6);
  });
}

// a game piece on a transparent background (square), lit like the covers
export function piece({ size = 512, fov = 30, dist = 8, camY = 1.5, camX = 0, look = [0, 0, 0], key = '#fff4e0', rim = '#bcdcff', top = false, exposure = 1.0 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
  renderer.setPixelRatio(1); renderer.setSize(size, size); renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  if (top) camera.position.set(0, dist, 0.001); else camera.position.set(camX, camY, dist);
  camera.lookAt(...look);
  const k = new THREE.DirectionalLight(key, 2.4); k.position.set(3, 6, 5); scene.add(k);
  const r = new THREE.DirectionalLight(rim, 2.4); r.position.set(-5, 3, -4); scene.add(r);
  scene.add(new THREE.HemisphereLight('#ffffff', '#334155', 0.6));
  return { renderer, scene, camera, render: () => renderer.render(scene, camera) };
}
