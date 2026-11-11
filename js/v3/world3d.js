/* ALIVE V3 - world3d.js : real-time 3D view of the same game (world I, the ice ; world II, the jungle, marshes and desert ; world III, New York in ruins).
 * The game itself is unchanged (engine.js, rules.js, world1.js) : maps, texts, menus, puzzles and fights.
 * This module only replaces the picture area of the V2 screen with a first-person 3D scene built from
 * the 1991 map (CARTE.BIN) : one cell of the 9x11 grid = one 12 m square, a cell with value 0 is the void.
 * The camera glides from cell to cell and turns by quarter turns, like James in 1991.
 * Characters and the F49 come from Meshy (assets/v3/models.json) ; a simple stand-in is shown until they load.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const S = 12;          // cell size (m)
const R = 4.2;         // the camera stands at the back of the cell, looking at its middle
const EYE = 1.7;
const W = 928, H = 572; // 2x the 464x286 picture area of the V2 screen
const YAW = [0, Math.PI / 2, Math.PI, -Math.PI / 2]; // N, W, S, E
const FWD = [[0, -1], [-1, 0], [0, 1], [1, 0]];

/* per view code : where James looks (the 1991 pictures of the precipice and the cliff look down) */
const HINTS = { 1: { 12: { pitch: -0.26, fwd: 7.4 }, 10: { pitch: -0.14, fwd: 1.2 }, 15: { pitch: 0.22, fwd: -0.8 }, 14: { pitch: 0.04, fwd: 0 } },
  2: { 32: { pitch: -0.2, fwd: 6.2 }, 30: { pitch: -0.1, fwd: 0 }, 22: { pitch: -0.08, fwd: 0 }, 28: { pitch: 0.06, fwd: 0 }, 26: { pitch: 0.03, fwd: 0 } },
  3: { 50: { pitch: 0.06, fwd: 3 }, 49: { pitch: -0.03, fwd: 1.5 }, 55: { pitch: 0.08, fwd: 0 }, 43: { pitch: 0.05, fwd: 0 } } };
const V3 = { on: false, ready: false, world: 0, viewScene: null, fullMask: false, supported: { 1: true, 2: true, 3: true } };
window.AliveV3 = V3;

/* ---------------- small helpers ---------------- */
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, z * f); a *= 0.5; f *= 2.03; } return s; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const cellX = c => ((c % 9) - 4) * S;
const cellZ = c => -(Math.floor(c / 9) - 6) * S;
const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ---------------- world I : what each view code is made of ---------------- */
const BIOME1 = { 1: 'wreck', 18: 'wreck', 3: 'snow', 4: 'forest', 17: 'forest', 5: 'lake', 7: 'mount', 8: 'dead', 9: 'ice', 16: 'ice', 13: 'village', 70: 'village', 14: 'cilla', 15: 'dragon' };
const PRIORITY = ['wreck', 'village', 'cilla', 'dragon', 'lake'];

function biomes1(map) {
  const out = new Array(99).fill(null);
  for (let c = 0; c < 99; c++) {
    const codes = [0, 1, 2, 3].map(l => map[l][c]);
    if (codes.every(v => !v)) continue;
    const bs = codes.map(v => BIOME1[v]).filter(Boolean);
    let b = PRIORITY.find(p => bs.includes(p));
    if (!b && codes.includes(12)) b = 'snow'; // the edge of the precipice : flat, nothing in the way of the view
    if (!b) {
      const n = {}; bs.forEach(x => { n[x] = (n[x] || 0) + 1; });
      b = Object.keys(n).sort((a, z) => n[z] - n[a])[0] || 'snow';
    }
    out[c] = b;
  }
  return out;
}

/* ---------------- renderer, scene, camera ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
V3.canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(new THREE.Color(0xc4d4e6), 0.0042);
scene.background = new THREE.Color(0xc4d4e6);
const camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 1500);
camera.rotation.order = 'YXZ';

const hemi = new THREE.HemisphereLight(0xe2ecff, 0x56657c, 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 2.1);
sun.position.set(-70, 90, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 300 });
sun.shadow.bias = -0.0004;
scene.add(sun);

/* sky : vertical gradient with a low winter sun */
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { sunDir: { value: sun.position.clone().normalize() }, zen: { value: new THREE.Vector3(0.16, 0.33, 0.62) }, hor: { value: new THREE.Vector3(0.80, 0.87, 0.94) }, sunGlow: { value: 1 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `varying vec3 vP; uniform vec3 sunDir, zen, hor; uniform float sunGlow;
    void main(){ float h = clamp(vP.y, -0.2, 1.0);
      vec3 low = hor * 0.9;
      vec3 c = h > 0.0 ? mix(hor, zen, pow(h, 0.55)) : low;
      float s = max(dot(normalize(vP), sunDir), 0.0);
      c += vec3(1.0,0.86,0.62) * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.18) * sunGlow;
      gl_FragColor = vec4(c, 1.0); }`
}));
scene.add(sky);

/* ---------------- the land ---------------- */
let world = null; // { biome[], groups }
const OBST = []; // circles James cannot walk through (trunks, houses, wrecks) : {x, z, r}
const SIZE = 300, RES = 1.25;

function cellAt(x, z) {
  const col = Math.round(x / S + 4), row = Math.round(-z / S + 6);
  if (col < 0 || col > 8 || row < 0 || row > 10) return -1;
  return row * 9 + col;
}
/* ground height : solid cells near 0, the void as a deep chasm, the jungle far below in the north */
function height1(x, z, bio) {
  const jx = x + (fbm(x * 0.15, z * 0.15) - 0.5) * 3.2, jz = z + (fbm(z * 0.15 + 9, x * 0.15) - 0.5) * 3.2; // ragged edges
  const c = cellAt(jx, jz);
  const outside = c < 0;
  const north = jz < -3.5 * S - 1;
  if (outside && north && jx > -S * 1.5) return -78 + fbm(x * 0.05, z * 0.05) * 10;          // the tropical lowlands
  if (outside) {
    const d = Math.max(Math.abs(jx) - 5.3 * S, jz - 5.5 * S + 0 * 1, -jz - 5 * S);           // outer ice plateau
    if (d > 14) return -3 + fbm(x * 0.03, z * 0.03) * 5 + Math.max(0, d - 50) * 0.2;
    return -42 + fbm(x * 0.2, z * 0.2) * 6;
  }
  const b = bio[c];
  if (!b) return (jz < -3.5 * S - 1 && jx > -S * 1.5 ? -78 : -42) + fbm(x * 0.2, z * 0.2) * 6;
  const cx = cellX(c), cz = cellZ(c), dx = Math.abs(x - cx), dz = Math.abs(z - cz);
  let h = (fbm(x * 0.18, z * 0.18) - 0.5) * 0.7;
  if (b === 'mount') { const off = smooth(2.5, 6, Math.min(dx, dz)); h += off * (1.5 + fbm(x * 0.09, z * 0.09) * 5); }
  if (b === 'ice' || b === 'dragon' || b === 'lake') h *= 0.25;
  if (b === 'lake' || b === 'dragon') { const r = Math.hypot(x - cx, z - cz); h -= 0.35 * (1 - smooth(4.5, 5.6, r)); }
  return h;
}
function color1(x, z, y, slope, bio) {
  const c = cellAt(x, z), b = c >= 0 ? bio[c] : null, n = fbm(x * 0.35, z * 0.35);
  if (y < -60) { // jungle canopy colours far below
    const g = fbm(x * 0.08, z * 0.08);
    return new THREE.Color().setRGB(0.12 + g * 0.18, 0.28 + g * 0.22, 0.08 + g * 0.05);
  }
  if ((slope > 0.9 || y < -6) && z < -40) { const k = 0.25 + n * 0.15; return new THREE.Color().setRGB(k * 1.05, k * 0.95, k * 0.8); } // the precipice : bare rock
  if (slope > 0.9 || y < -6) { const k = 0.5 + n * 0.2 + Math.max(-0.25, y / 160); return new THREE.Color().setRGB(k * 0.78, k * 0.9, k * 1.12); } // ice walls
  if (b === 'ice' || b === 'dragon') return new THREE.Color().setRGB(0.62 + n * 0.1, 0.70 + n * 0.1, 0.92);
  if (b === 'mount' && y > 0.8 && (n < 0.45 || slope > 0.45)) return new THREE.Color().setRGB(0.36 + n * 0.12, 0.35 + n * 0.1, 0.33);
  if (b === 'dead') return new THREE.Color().setRGB(0.80 + n * 0.1, 0.83 + n * 0.1, 0.9);
  const f = fbm(x * 1.7, z * 1.7, 2) * 0.06 - y * 0.03;
  return new THREE.Color().setRGB(0.84 + n * 0.1 - f, 0.89 + n * 0.07 - f * 0.6, 0.98);
}

/* ---------------- world dispatch ---------------- */
function biomes(map, w) { const b = w === 3 ? biomes3(map) : w === 2 ? biomes2(map) : biomes1(map); b.w = w; return b; }
function heightAt(x, z, bio) { return bio && bio.w === 3 ? height3(x, z, bio) : bio && bio.w === 2 ? height2(x, z, bio) : height1(x, z, bio); }
function groundColor(x, z, y, slope, bio) { return bio && bio.w === 3 ? color3(x, z, y, slope, bio) : bio && bio.w === 2 ? color2(x, z, y, slope, bio) : color1(x, z, y, slope, bio); }

/* ================= world II : the jungle, the marshes, the desert (CARTE2.BIN) ================= */
const BIOME2 = { 20: 'mud', 21: 'swamp', 22: 'hands', 23: 'varlox', 24: 'mutant', 25: 'auri', 26: 'oktar', 27: 'jungle', 28: 'monster', 29: 'jeep', 30: 'river', 31: 'sand', 34: 'desert' };
const PRIO2 = ['varlox', 'mutant', 'auri', 'oktar', 'jeep', 'monster', 'hands'];
const ZONE2 = { mud: 'jungle', swamp: 'swamp', hands: 'swamp', varlox: 'swamp', quick: 'swamp', mutant: 'jungle', jungle: 'jungle', monster: 'jungle', jeep: 'jungle', river: 'jungle', rapids: 'jungle', auri: 'desert', sand: 'desert', desert: 'desert', oktar: 'desert', dunes: 'desert' };
function biomes2(map) {
  const out = new Array(99).fill(null);
  for (let c = 0; c < 99; c++) {
    const codes = [0, 1, 2, 3].map(l => map[l][c]);
    if (codes.every(v => !v)) continue;
    const bs = codes.map(v => BIOME2[v]).filter(Boolean);
    let b = PRIO2.find(p => bs.includes(p));
    if (!b && codes.includes(35)) b = 'dunes';                                   // the scorching desert : death by heat
    if (!b && codes.filter(v => v === 36).length >= 2) b = 'quick';              // quicksand
    if (!b && codes.includes(37) && !bs.length) b = 'rapids';                     // the river carries you away
    if (!b) { const n = {}; bs.forEach(x => { n[x] = (n[x] || 0) + 1; }); b = Object.keys(n).sort((a, z) => n[z] - n[a])[0] || null; }
    out[c] = b;
  }
  return out;
}
/* the river : from the rapids in the west, through the river cells, eastwards */
const RIVER_CELLS = [63, 64, 56, 66, 67, 59, 60];
let riverPts = null;
function riverPoints() {
  if (riverPts) return riverPts;
  const ctrl = [new THREE.Vector3(cellX(63) - 14, 0, cellZ(63) + 1)].concat(RIVER_CELLS.map((c, i) => new THREE.Vector3(cellX(c), 0, cellZ(c) - 1.5 + (i % 2) * 1.2)));
  ctrl.push(new THREE.Vector3(cellX(60) + 10, 0, cellZ(60) - 6));
  const curve = new THREE.CatmullRomCurve3(ctrl);
  riverPts = curve.getSpacedPoints(160);
  return riverPts;
}
function riverDist(x, z) { let d = 1e9; for (const p of riverPoints()) { const e = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z); if (e < d) d = e; } return Math.sqrt(d); }
function dunes(x, z) { return Math.sin(x * 0.11 + Math.sin(z * 0.05) * 2) * 0.9 + Math.sin(z * 0.07 + x * 0.03) * 1.3 + fbm(x * 0.05, z * 0.05) * 1.5; }
function height2(x, z, bio) {
  const jx = x + (fbm(x * 0.15, z * 0.15) - 0.5) * 3.2, jz = z + (fbm(z * 0.15 + 9, x * 0.15) - 0.5) * 3.2;
  const c = cellAt(jx, jz);
  const n = fbm(x * 0.18, z * 0.18) - 0.5;
  if (c < 0) {
    if (jz < -4.5 * S) { // the endless desert to the north ; far below at the corners of the precipices
      if (Math.abs(jx) > 2.6 * S) return -55 + fbm(x * 0.04, z * 0.04) * 4;
      return dunes(x, z) + 1;
    }
    return n * 0.8 + Math.max(0, Math.hypot(x, z) - 110) * 0.15; // jungle around, rising into hills
  }
  const b = bio[c];
  if (!b) return -55 + fbm(x * 0.04, z * 0.04) * 4;                     // precipice : the desert far below
  const cx = cellX(c), cz = cellZ(c), dx = Math.abs(x - cx), dz = Math.abs(z - cz);
  let h = n * 0.6;
  if (b === 'swamp' || b === 'hands' || b === 'varlox' || b === 'quick') h = -0.32 + n * 0.55;
  if (b === 'desert' || b === 'oktar' || b === 'dunes') h = dunes(x, z) * (b === 'dunes' ? 1 : 0.5) * smooth(1.5, 5, Math.min(dx, dz)) + n * 0.3;
  if (b === 'sand' || b === 'auri') h = n * 0.9;
  if (b === 'quick') h = -0.18 + n * 0.08;
  const rd = riverDist(x, z);
  if (rd < 4.5 && z < cellZ(46) + 8 && z > cellZ(73) - 4) h = Math.min(h, -1.3 + smooth(1.6, 4.3, rd) * (h + 1.3)); // the river bed
  return h;
}
function color2(x, z, y, slope, bio) {
  const c = cellAt(x, z), b = c >= 0 ? bio[c] : null, n = fbm(x * 0.35, z * 0.35), f = fbm(x * 1.6, z * 1.6, 2);
  const C = (r, g, bl) => new THREE.Color().setRGB(r, g, bl);
  if (y < -40) return C(0.80 + n * 0.1, 0.60 + n * 0.08, 0.34);                         // the desert far below
  if (slope > 0.8 || y < -4) { const k = 0.45 + n * 0.2; return C(k * 1.15, k * 0.82, k * 0.55); } // ochre cliffs
  if (c < 0 && z < -4.5 * S) return C(0.88 + n * 0.08, 0.68 + n * 0.08, 0.40);         // dunes beyond
  if (c < 0) return C(0.20 + f * 0.1, 0.27 + f * 0.12, 0.10);                            // jungle floor beyond
  if (y < -0.9) return C(0.32, 0.28, 0.18);                                              // river bed
  switch (b) {
    case 'swamp': case 'hands': case 'varlox': return C(0.16 + f * 0.08, 0.20 + f * 0.08, 0.12);
    case 'quick': return C(0.44 + n * 0.06, 0.34 + n * 0.05, 0.20);
    case 'mud': return C(0.34 + f * 0.12, 0.25 + f * 0.08, 0.13);
    case 'sand': case 'auri': return C(0.74 + n * 0.1, 0.58 + n * 0.08, 0.36);
    case 'desert': case 'oktar': case 'dunes': return C(0.90 + n * 0.06, 0.70 + n * 0.06, 0.40);
    default: return C(0.20 + f * 0.12, 0.28 + f * 0.14, 0.10 + n * 0.04);                 // jungle floor, leaves
  }
}
/* vegetation of the jungle and the marshes */
function colored(geo, col, vary = 0.15, rand = Math.random) {
  geo = geo.toNonIndexed(); const cc = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < cc.length; i += 3) { const k = 1 - vary / 2 + rand() * vary; cc[i] = col.r * k; cc[i + 1] = col.g * k; cc[i + 2] = col.b * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(cc, 3)); return geo;
}
function broadleaf(rand) {
  const g = [], h = 6 + rand() * 4;
  const t = new THREE.CylinderGeometry(0.22, 0.45, h, 7); t.translate(0, h / 2, 0); g.push(colored(t, new THREE.Color(0x4a3524)));
  for (let i = 0; i < 6; i++) {
    const r = 1.5 + rand() * 1.4, s = new THREE.IcosahedronGeometry(r, 1); s.scale(1, 0.7, 1);
    s.translate((rand() - 0.5) * 3.2, h + (rand() - 0.3) * 1.6, (rand() - 0.5) * 3.2);
    g.push(colored(s, new THREE.Color().setHSL(0.26 + rand() * 0.06, 0.55, 0.20 + rand() * 0.1), 0.3, rand));
  }
  return mergeGeos(g);
}
function palm(rand) {
  const g = [], segs = 7, bend = (rand() - 0.5) * 0.5; let x = 0, y = 0;
  for (let i = 0; i < segs; i++) {
    const c = new THREE.CylinderGeometry(0.16, 0.2, 1.1, 6); c.rotateZ(bend * i / segs); c.translate(x, y + 0.55, 0);
    g.push(colored(c, new THREE.Color(0x6b5236))); x += Math.sin(bend * i / segs) * -1.1; y += 1.05;
  }
  for (let i = 0; i < 8; i++) {
    const fr = new THREE.ConeGeometry(0.45, 3.4, 4); fr.scale(1, 1, 0.2); fr.translate(0, 1.7, 0);
    fr.rotateZ(1.25 + rand() * 0.35); fr.rotateY(i / 8 * Math.PI * 2 + rand() * 0.3); fr.translate(x, y, 0);
    g.push(colored(fr, new THREE.Color().setHSL(0.27, 0.6, 0.24), 0.25, rand));
  }
  return mergeGeos(g);
}
function bush(rand) { const s = new THREE.IcosahedronGeometry(1, 1); s.scale(1.2, 0.7, 1.1); s.translate(0, 0.4, 0); return mergeGeos([colored(s, new THREE.Color().setHSL(0.28, 0.5, 0.2), 0.35, rand)]); }
function reeds(rand) {
  const g = [];
  for (let i = 0; i < 9; i++) { const h = 1 + rand() * 1.4, r = new THREE.ConeGeometry(0.04, h, 3); r.translate((rand() - 0.5) * 0.9, h / 2, (rand() - 0.5) * 0.9); g.push(colored(r, new THREE.Color(0x5d6a33), 0.3, rand)); }
  return mergeGeos(g);
}
function swampTree(rand) {
  const g = [], col = new THREE.Color(0x4e5a4c), h = 5 + rand() * 3;
  const t = new THREE.CylinderGeometry(0.14, 0.42, h, 6); t.translate(0, h / 2, 0); g.push(colored(t, col));
  for (let i = 0; i < 7; i++) {
    const l = 1 + rand() * 2.4, b = new THREE.CylinderGeometry(0.03, 0.1, l, 4); b.translate(0, l / 2, 0);
    b.rotateZ(0.6 + rand() * 0.8); b.rotateY(rand() * 6.28); b.translate(0, h * (0.4 + rand() * 0.55), 0); g.push(colored(b, col));
  }
  return mergeGeos(g);
}
function props2(bio) {
  const grp = new THREE.Group(), rand = rng(1994);
  const vmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const L = { leaf: [], palm: [], bush: [], reed: [], dead: [], rock: [] };
  const put = (list, c, n, margin, sMin, sMax) => spots(c, n, rand, margin).forEach(([x, z]) => { list.push([x, heightAt(x, z, bio) - 0.2, z, rand() * 6.28, sMin + rand() * (sMax - sMin)]); if (list === L.leaf || list === L.palm || list === L.dead) OBST.push({ x, z, r: 0.6 }); });
  for (let c = 0; c < 99; c++) {
    const b = bio[c]; if (!b) continue;
    if (['jungle', 'monster', 'mutant', 'jeep'].includes(b)) { put(L.leaf, c, 3, 2.6, 0.8, 1.2); put(L.palm, c, 2, 2.6, 0.8, 1.2); put(L.bush, c, 7, 1.8, 0.6, 1.3); }
    if (b === 'mud') { put(L.leaf, c, 2, 3, 0.9, 1.2); put(L.bush, c, 4, 2.2, 0.5, 1); }
    if (b === 'river') { put(L.palm, c, 2, 3, 0.8, 1.1); put(L.reed, c, 4, 2.4, 0.8, 1.2); }
    if (['swamp', 'hands', 'varlox'].includes(b)) { put(L.dead, c, 4, 2.4, 0.8, 1.2); put(L.reed, c, 8, 1.8, 0.8, 1.3); }
    if (b === 'sand' || b === 'auri') put(L.rock, c, 4, 2.4, 0.6, 1.8);
    if (b === 'desert' || b === 'oktar') put(L.rock, c, 1, 3, 0.5, 1.2);
  }
  // the jungle all around, and its hills
  for (let k = 0; k < 2600; k++) {
    const a = rand() * Math.PI * 2, r = 66 + rand() * 120, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z < -50) continue;
    const y = heightAt(x, z, bio); if (y < -3) continue;
    (rand() < 0.65 ? L.leaf : L.palm).push([x, y - 0.3, z, rand() * 6.28, 0.9 + rand() * 0.8]);
  }
  for (let k = 0; k < 60; k++) { const x = (rand() - 0.5) * 260, z = -70 - rand() * 80; const y = heightAt(x, z, bio); if (y > -10) L.rock.push([x, y - 0.3, z, rand() * 6.28, 0.8 + rand() * 2.5]); }
  grp.add(instanced(broadleaf(rng(3)), vmat, L.leaf), instanced(palm(rng(4)), vmat, L.palm), instanced(bush(rng(5)), vmat, L.bush), instanced(reeds(rng(6)), vmat, L.reed), instanced(swampTree(rng(8)), vmat, L.dead));
  const rockGeo = new THREE.DodecahedronGeometry(1, 0); rockGeo.scale(1.2, 0.7, 1);
  grp.add(instanced(rockGeo, new THREE.MeshStandardMaterial({ color: 0x9a7650, roughness: 0.95, flatShading: true }), L.rock));
  // the low desert at the foot of the precipices, to the horizon
  const low = new THREE.Mesh(new THREE.PlaneGeometry(1800, 900), new THREE.MeshStandardMaterial({ color: 0xc89a5c, roughness: 1 }));
  low.rotation.x = -Math.PI / 2; low.position.set(0, -56, -520); grp.add(low);
  return grp;
}
/* moving water : the river and the stagnant water of the marshes */
const waterTex = [];
function waterMat(color, opacity, rough) {
  const t = noiseTexture(); t.repeat.set(6, 6); waterTex.push(t);
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.15, transparent: true, opacity, map: t, depthWrite: false });
}
function buildWaters2() {
  const g = new THREE.Group(), pts = riverPoints(), w = 4.4, pos = [], idx = [], uv = [];
  pts.forEach((p, i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)], r = pts[Math.max(0, i - 1)], dx = q.x - r.x, dz = q.z - r.z, l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l * w / 2, nz = dx / l * w / 2;
    pos.push(p.x + nx, -0.42, p.z + nz, p.x - nx, -0.42, p.z - nz); uv.push(0, i / 6, 1, i / 6);
    if (i < pts.length - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const river = new THREE.Mesh(geo, waterMat(0x4d8f96, 0.88, 0.12)); river.userData.flow = true; g.add(river);
  const marsh = new THREE.Mesh(new THREE.PlaneGeometry(9 * S + 40, 4.4 * S), waterMat(0x24382a, 0.92, 0.25));
  marsh.rotation.x = -Math.PI / 2; marsh.position.set(0, -0.14, cellZ(18) + 4); g.add(marsh);
  return g;
}
function mountains2() {
  const seg = 160, rings = 12, geo = new THREE.BufferGeometry(), p = [], col = [], idx = [];
  for (let j = 0; j <= rings; j++) {
    const r = 330 + j * 32;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const ridge = fbm(Math.cos(a) * 3 + 20, Math.sin(a) * 3 + 20, 5), prof = Math.sin((j / rings) * Math.PI);
      const north = z < -60;
      const y = north ? (ridge > 0.62 ? prof * 70 - 56 : -60) : prof * (25 + ridge * 70) - 10; // mesas in the desert, green hills elsewhere
      p.push(x, y, z);
      const k = fbm(a * 20, j * 0.5);
      if (north) col.push(0.66 + k * 0.1, 0.44 + k * 0.08, 0.26); else col.push(0.10 + k * 0.08, 0.20 + k * 0.1, 0.09);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  geo.setIndex(idx); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
}


/* ================= world III : New York in ruins (CARTE3.BIN) ================= */
const BIOME3 = { 38: 'street', 39: 'street', 34: 'street', 41: 'voyou', 43: 'hollow', 44: 'police', 45: 'guardpost', 46: 'lairguard', 47: 'bar', 48: 'oldman', 49: 'port', 50: 'port', 53: 'sect', 54: 'generator', 55: 'necarex' };
const PRIO3 = ['necarex', 'generator', 'bar', 'oldman', 'sect', 'lairguard', 'police', 'voyou', 'guardpost', 'port', 'hollow'];
const ROOMS3 = { bar: 1, oldman: 1, generator: 1, necarex: 1, radroom: 1, hollow: 1 };
const WALK3 = b => b && b !== 'ruin' && b !== 'water';
function biomes3(map) {
  const out = new Array(99).fill(null);
  for (let c = 0; c < 99; c++) {
    const codes = [0, 1, 2, 3].map(l => map[l][c]);
    const bs = codes.map(v => BIOME3[v]).filter(Boolean);
    let b = PRIO3.find(p => bs.includes(p));
    if (!b && codes.includes(52)) b = 'radroom';                              // a radioactive room : death
    if (!b && codes.every(v => v === 51)) b = 'water';                         // radioactive bath : death
    if (!b && codes.every(v => v === 42)) b = 'ruin';                          // the floor gives way : a ruined building
    if (!b && codes.includes(35) && !bs.length) b = 'sand';
    if (!b && codes.includes(51)) b = 'water';
    if (!b) b = bs.length ? 'street' : 'ruin';
    out[c] = b;
  }
  return out;
}
const SEA_X = cellX(7) + 5.6;
function height3(x, z, bio) {
  const c = cellAt(x, z);
  if (x > SEA_X && z < cellZ(9) + 70) return -4 + fbm(x * 0.05, z * 0.05) * 1.5 + (Math.hypot(x - 96, z + 48) < 14 ? 5.5 : 0); // the bay ; the statue's island
  if (c < 0) return z > 5.5 * S ? dunes(x, z) * 0.6 + 0.4 : 0;                // desert to the south, the city elsewhere
  const b = bio[c];
  if (b === 'sand') return dunes(x, z) * 0.35 * smooth(0, 8, z - cellZ(c));
  if (b === 'water') return -4;
  return 0;
}
function color3(x, z, y, slope, bio) {
  const c = cellAt(x, z), b = c >= 0 ? bio[c] : null, n = fbm(x * 0.35, z * 0.35), f = fbm(x * 2.1, z * 2.1, 2);
  const C = (r, g, bl) => new THREE.Color().setRGB(r, g, bl);
  if (y < -1) return C(0.12, 0.16, 0.15);
  if (b === 'sand' || (c < 0 && z > 5.5 * S)) return C(0.86 + n * 0.06, 0.68 + n * 0.06, 0.42);
  if (b === 'port') return C(0.42 + n * 0.1, 0.44 + n * 0.1, 0.42);
  if (b && ROOMS3[b]) return b === 'generator' ? C(0.12, 0.30, 0.30) : C(0.22 + f * 0.1, 0.18 + f * 0.08, 0.15);
  const crack = Math.abs(Math.sin(x * 0.9 + fbm(x * 0.2, z * 0.2) * 6) * Math.sin(z * 0.7)) < 0.04 ? -0.06 : 0;
  return C(0.20 + n * 0.08 + f * 0.04 + crack, 0.19 + n * 0.07 + crack, 0.21 + n * 0.07 + crack); // cracked asphalt
}
/* a box whose texture tiles every 4 m (façades, walls) */
function boxTiled(w, h, d, tile = 4, color) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, nr = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nr.getX(i)), ny = Math.abs(nr.getY(i));
    const su = nx > 0.5 ? d : w, sv = ny > 0.5 ? d : h;
    uv.setXY(i, uv.getX(i) * su / tile, uv.getY(i) * sv / tile);
  }
  if (color) { const cc = new Float32Array(uv.count * 3); for (let i = 0; i < uv.count; i++) { cc[i * 3] = color.r; cc[i * 3 + 1] = color.g; cc[i * 3 + 2] = color.b; } g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); }
  return g;
}
function mergeAll(list) { // merge geometries with position, normal, uv (and color)
  let n = 0; const ix = list.map(g => g.index ? g.toNonIndexed() : g); ix.forEach(g => { n += g.attributes.position.count; });
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), Cc = new Float32Array(n * 3); let o = 0;
  ix.forEach(g => { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); if (g.attributes.color) Cc.set(g.attributes.color.array, o * 3); else Cc.fill(1, o * 3, (o + g.attributes.position.count) * 3); o += g.attributes.position.count; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
  return geo;
}
function facadeTexture(seed) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#8a8478'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) { const g = 100 + r() * 60; x.fillStyle = `rgba(${g},${g * 0.95},${g * 0.88},0.25)`; x.fillRect(r() * 256, r() * 256, 3, 3); }
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) { // two windows per 4 m, two floors
    const wx = 30 + col * 128, wy = 30 + row * 128, k = r();
    x.fillStyle = '#1a1a22'; x.fillRect(wx, wy, 68, 84);
    if (k < 0.25) { x.strokeStyle = '#7a2a1c'; x.lineWidth = 12; x.beginPath(); x.moveTo(wx - 4, wy); x.lineTo(wx + 72, wy + 84); x.moveTo(wx + 72, wy); x.lineTo(wx - 4, wy + 84); x.stroke(); }
    else if (k < 0.5) { x.fillStyle = '#2a3a44'; x.fillRect(wx + 4, wy + 4, 28, 36); }
    x.fillStyle = '#5d5850'; x.fillRect(wx - 6, wy + 84, 80, 8);
  }
  x.strokeStyle = 'rgba(30,25,25,0.6)'; x.lineWidth = 2; for (let i = 0; i < 6; i++) { x.beginPath(); let px = r() * 256, py = r() * 256; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 40; py += r() * 30; x.lineTo(px, py); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const TINTS = [0xffffff, 0xd9c9b8, 0xb8c4c8, 0xc9b0a8, 0xa8a8b8].map(h => new THREE.Color(h));
function cityBlocks(bio) { // ruined buildings : in the cells where the floor gives way, and all around the city
  const list = [], rand = rng(1998);
  const tower = (x, z, w, d, h, tint) => {
    const t = boxTiled(w, h, d, 4, tint); t.translate(x, h / 2, z); list.push(t);
    for (let k = 0; k < 3; k++) { // a broken, jagged top
      const bw = w * (0.25 + rand() * 0.4), bd = d * (0.25 + rand() * 0.4), bh = 1 + rand() * 5;
      const b = boxTiled(bw, bh, bd, 4, tint); b.translate(x + (rand() - 0.5) * (w - bw), h + bh / 2, z + (rand() - 0.5) * (d - bd)); list.push(b);
    }
  };
  for (let c = 0; c < 99; c++) if (bio[c] === 'ruin') tower(cellX(c), cellZ(c), 11, 11, 12 + rand() * 26, TINTS[Math.floor(rand() * TINTS.length)]);
  for (let gx = -14; gx <= 14; gx++) for (let gz = -14; gz <= 14; gz++) {
    const x = gx * S, z = gz * S;
    if (cellAt(x, z) >= 0 || x > SEA_X - 2 || z > 5.5 * S || Math.hypot(x, z) > 170) continue;
    if (rand() < 0.12) continue;
    tower(x, z, 9 + rand() * 3, 9 + rand() * 3, 14 + rand() * 40, TINTS[Math.floor(rand() * TINTS.length)]);
  }
  const m = new THREE.Mesh(mergeAll(list), new THREE.MeshStandardMaterial({ map: facadeTexture(5), vertexColors: true, roughness: 0.95 }));
  m.castShadow = true; m.receiveShadow = true; return m;
}
/* rooms : walls on the four sides, a doorway towards every cell one can walk into, a ceiling */
function rooms3(bio) {
  const g = new THREE.Group(), wallT = facadeTexture(9), lists = {}, rand = rng(77);
  const add = (kind, geo) => { (lists[kind] = lists[kind] || []).push(geo); };
  const H = 9, CEIL = 4.6, T = 0.4, half = S / 2, door = 3.2, doorH = 3.7;
  for (let c = 0; c < 99; c++) {
    const b = bio[c]; if (!ROOMS3[b]) continue;
    const cx = cellX(c), cz = cellZ(c), kind = b === 'generator' ? 'metal' : 'wall';
    const tint = b === 'hollow' ? TINTS[c % TINTS.length] : new THREE.Color(b === 'bar' ? 0x9a8cb0 : b === 'necarex' ? 0x66605a : 0xb0a898);
    [[0, -1], [-1, 0], [0, 1], [1, 0]].forEach(([dx, dz]) => {
      const nb = cellAt(cx + dx * S, cz + dz * S), open = nb >= 0 ? WALK3(bio[nb]) : false;
      const along = dz !== 0, ex = cx + dx * (half - T / 2), ez = cz + dz * (half - T / 2), len = S;
      const piece = (offset, w, y0, h) => { const geo = boxTiled(along ? w : T, h, along ? T : w, 4, tint); geo.translate(ex + (along ? offset : 0), y0 + h / 2, ez + (along ? 0 : offset)); add(kind, geo); };
      if (!open) piece(0, len, 0, H);
      else { const side = (len - door) / 2; piece(-(door + side) / 2, side, 0, H); piece((door + side) / 2, side, 0, H); piece(0, door, doorH, H - doorH); }
    });
    // the ceiling (with holes where it fell in, in the ruins)
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (b === 'hollow' && rand() < 0.4) continue;
      const geo = boxTiled(S / 4, 0.35, S / 4, 4, tint); geo.translate(cx - half + S / 8 + i * S / 4, CEIL, cz - half + S / 8 + j * S / 4); add(kind, geo);
    }
    if (b === 'hollow') for (let k = 0; k < 3; k++) { // fallen beams
      const geo = boxTiled(0.35, 0.35, 5 + rand() * 3, 4, new THREE.Color(0x6a4a7a)); geo.rotateX(-0.5 - rand() * 0.6); geo.rotateY(rand() * 6.28); geo.translate(cx + (rand() - 0.5) * 7, 1.4, cz + (rand() - 0.5) * 7); add('wood', geo);
    }
  }
  const mats = { wall: new THREE.MeshStandardMaterial({ map: wallT, vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }), metal: new THREE.MeshStandardMaterial({ color: 0x3f8f90, roughness: 0.45, metalness: 0.5, side: THREE.DoubleSide }), wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }) };
  Object.entries(lists).forEach(([k, l]) => { const m = new THREE.Mesh(mergeAll(l), mats[k]); m.castShadow = true; m.receiveShadow = true; g.add(m); });
  return g;
}
/* furniture of the special rooms, with their own light */
function furnish3(bio) {
  const g = new THREE.Group(), M = (c, e, ei) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: e || 0, emissiveIntensity: ei || 0 });
  const at = id => bio.indexOf(id);
  const lamp = (c, color, intensity, y = 3.6, dist = 16) => { const l = new THREE.PointLight(color, intensity, dist, 1.6); l.position.set(cellX(c), y, cellZ(c)); g.add(l); };
  const bar = at('bar');
  if (bar >= 0) { // an island bar : Porkus in the middle, bottles all around him
    const cx = cellX(bar), cz = cellZ(bar);
    const counter = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1.1, 32, 1, true, 0, Math.PI * 2), M(0x4a2c22)); counter.position.set(cx, 0.55, cz); counter.material.side = THREE.DoubleSide; g.add(counter); OBST.push({ x: cx, z: cz, r: 2.5 });
    const top = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.45, 40), M(0x6b3d2c)); top.rotation.x = -Math.PI / 2; top.position.set(cx, 1.12, cz); g.add(top);
    const bottleCols = [0xff8a2a, 0x46d16a, 0xb04ad8, 0xd8c040];
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.32, 8), M(bottleCols[i % 4], bottleCols[i % 4], 0.6)); b.position.set(cx + Math.cos(a) * 2.05, 1.3, cz + Math.sin(a) * 2.05); g.add(b); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3, st = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.8, 10), M(0x2a2a30)); st.position.set(cx + Math.cos(a) * 3.0, 0.4, cz + Math.sin(a) * 3.0); g.add(st); }
    lamp(bar, 0x7dff9a, 2.2); lamp(bar, 0xc070ff, 1.6, 4.2, 12);
  }
  const old = at('oldman'); if (old >= 0) lamp(old, 0xffa040, 1.2, 1.6, 10);
  const gen = at('generator');
  if (gen >= 0) { // machines, pipes and red beams
    const cx = cellX(gen), cz = cellZ(gen);
    [[-4.6, -4.6, 0xb02a2a], [4.6, -4.6, 0x2a3ab0], [-4.6, 4.2, 0x2a3ab0], [4.6, 4.2, 0xb02a2a], [0, -5.1, 0x30a0a0]].forEach(([dx, dz, col]) => { OBST.push({ x: cx + dx, z: cz + dz, r: 1.3 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(2, 3.6, 1.6), M(col, col, 0.15)); m.position.set(cx + dx, 1.8, cz + dz); g.add(m);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4.6, 8), M(0x8a9aa0)); p.position.set(cx + dx * 0.8, 2.3, cz + dz * 1.05); g.add(p);
    });
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(9, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: 0xff3030 })); b.position.set(cx, 1.2 + i * 0.5, cz - 2 + i * 0.9); b.rotation.y = 0.2 * (i - 1); b.userData.beam = true; g.add(b); }
    lamp(gen, 0xff4a4a, 1.6); lamp(gen, 0x40e0e0, 1.0, 4.2, 12);
  }
  const nec = at('necarex'); if (nec >= 0) lamp(nec, 0xffd040, 2.4, 2.6, 18);
  bio.forEach((b, c) => { if (b === 'radroom') lamp(c, 0x60ff60, 2.0, 2.5, 12); });
  return g;
}
/* the streets : rubble, lamp posts, boarded doors, bins */
function street3(bio) {
  const g = new THREE.Group(), rand = rng(42), rub = [], posts = [], bins = [];
  for (let c = 0; c < 99; c++) {
    const b = bio[c]; if (!b || ROOMS3[b] || b === 'ruin' || b === 'water' || b === 'sand') continue;
    spots(c, 6, rand, 1.6).forEach(([x, z]) => rub.push([x, 0, z, rand() * 6.28, 0.15 + rand() * 0.5]));
    if (rand() < 0.5) { const [x, z] = spots(c, 1, rand, 4.2)[0] || [cellX(c) + 5, cellZ(c) + 5]; posts.push([x, 0, z, rand() * 6.28, 1, (rand() - 0.5) * 0.25]); }
    if (rand() < 0.35) { const [x, z] = spots(c, 1, rand, 3)[0] || [cellX(c) + 4, cellZ(c) - 4]; bins.push([x, 0.45, z, 0, 1, rand() < 0.3 ? 1.5 : 0]); }
  }
  const rg = new THREE.DodecahedronGeometry(1, 0); rg.scale(1.3, 0.6, 1);
  g.add(instanced(rg, new THREE.MeshStandardMaterial({ color: 0x5c5650, roughness: 1, flatShading: true }), rub));
  const pg = new THREE.CylinderGeometry(0.08, 0.12, 6, 6); pg.translate(0, 3, 0);
  const arm = new THREE.BoxGeometry(1.4, 0.1, 0.1); arm.translate(0.6, 6, 0);
  g.add(instanced(mergeAll([pg, arm]), new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.6, metalness: 0.5 }), posts));
  g.add(instanced(new THREE.CylinderGeometry(0.4, 0.35, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0x3d6f9a, roughness: 0.7, metalness: 0.3 }), bins));
  // the port : a quay, a wooden shack, crates, planks
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), waterMat(0x2f6a62, 0.95, 0.15)); sea.rotation.x = -Math.PI / 2; sea.position.set(SEA_X + 350, -1.3, -40); g.add(sea);
  const ports = bio.map((b, c) => (b === 'port' ? c : -1)).filter(c => c >= 0);
  if (ports.length) {
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.9 });
    const c0 = ports[Math.floor(ports.length / 2)], sx = cellX(c0) - 3.8, sz = cellZ(c0) - 4; OBST.push({ x: sx, z: sz, r: 2.1 });
    const shack = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 3), wood); shack.position.set(sx, 1.5, sz); g.add(shack);
    const roofS = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.2, 3.4), wood); roofS.position.set(sx, 3.1, sz); roofS.rotation.z = 0.12; g.add(roofS);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.2), wood); crate.position.set(sx + 2.2, 0.55, sz + 2.4); g.add(crate);
    for (let i = 0; i < 3; i++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.3), wood); pl.position.set(cellX(c0) + 2 + i * 0.6, 0.05, cellZ(c0) + 3.5 - i); pl.rotation.y = rand() * 3; g.add(pl); }
    ports.forEach(c => { const q = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, S), new THREE.MeshStandardMaterial({ color: 0x5a5c5a })); q.position.set(SEA_X - 0.3, 0.1, cellZ(c)); g.add(q); });
  }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
function skyline3() { // far towers on the horizon, but not over the sea
  const list = [], rand = rng(5);
  for (let i = 0; i < 160; i++) {
    const a = rand() * Math.PI * 2, r = 230 + rand() * 160, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (x > 60 || z > 120) continue;
    const w = 12 + rand() * 20, h = 30 + rand() * 120, t = boxTiled(w, h, w, 8, TINTS[i % TINTS.length].clone().multiplyScalar(0.5)); t.translate(x, h / 2 - 2, z); list.push(t);
  }
  return new THREE.Mesh(mergeAll(list), new THREE.MeshStandardMaterial({ map: facadeTexture(11), vertexColors: true, roughness: 1 }));
}

/* ---------------- atmosphere : per world, and per area in world II ---------------- */
const ATMO = {
  ice: { fog: 0xc4d4e6, dens: 0.0042, hs: 0xe2ecff, hg: 0x56657c, hi: 1.05, sc: 0xfff0dc, si: 2.1, zen: [0.16, 0.33, 0.62], hor: [0.80, 0.87, 0.94], glow: 1 },
  jungle: { fog: 0x7a9264, dens: 0.0105, hs: 0xd8ecc0, hg: 0x3a4a22, hi: 1.0, sc: 0xffeec0, si: 1.8, zen: [0.30, 0.50, 0.70], hor: [0.70, 0.80, 0.64], glow: 0.6 },
  swamp: { fog: 0x3a4d40, dens: 0.015, hs: 0x8fb0bc, hg: 0x26341f, hi: 1.25, sc: 0xb8cce0, si: 0.95, zen: [0.04, 0.06, 0.11], hor: [0.20, 0.27, 0.23], glow: 0.15 },
  city: { fog: 0x8a7078, dens: 0.0105, hs: 0xf0d0dc, hg: 0x3a3440, hi: 1.0, sc: 0xffc8a0, si: 1.5, zen: [0.30, 0.22, 0.40], hor: [0.88, 0.64, 0.60], glow: 0.8 },
  indoor: { fog: 0x241f26, dens: 0.02, hs: 0xa8a4b8, hg: 0x3a3640, hi: 1.25, sc: 0xffc8a0, si: 0.8, zen: [0.30, 0.22, 0.40], hor: [0.88, 0.64, 0.60], glow: 0.3 },
  desert: { fog: 0xe6cfa2, dens: 0.0034, hs: 0xfff1d6, hg: 0x8a6a3a, hi: 1.1, sc: 0xfff2d8, si: 2.7, zen: [0.10, 0.34, 0.76], hor: [0.96, 0.86, 0.66], glow: 1.2 }
};
const atmo = { fog: new THREE.Color(0xc4d4e6), dens: 0.0042, hs: new THREE.Color(0xe2ecff), hg: new THREE.Color(0x56657c), hi: 1.05, sc: new THREE.Color(0xfff0dc), si: 2.1, zen: new THREE.Vector3(0.16, 0.33, 0.62), hor: new THREE.Vector3(0.80, 0.87, 0.94), glow: 1 };
const _c = new THREE.Color();
function zoneAt(x, z) {
  if (!world || world.bio.w === 1) return 'ice';
  if (world.bio.w === 3) { const c3 = cellAt(x, z), b3 = c3 >= 0 ? world.bio[c3] : null; return b3 && ROOMS3[b3] ? 'indoor' : (b3 === 'sand' || (c3 < 0 && z > 5.5 * S)) ? 'desert' : 'city'; }
  const c = cellAt(x, z); if (c < 0) return z < -4.5 * S ? 'desert' : 'jungle';
  return ZONE2[world.bio[c]] || (z < -3 * S ? 'desert' : 'jungle');
}
function updateAtmo(dt, snap) {
  const T = ATMO[zoneAt(camera.position.x, camera.position.z)], k = snap ? 1 : Math.min(1, dt * 0.9);
  atmo.fog.lerp(_c.set(T.fog), k); atmo.hs.lerp(_c.set(T.hs), k); atmo.hg.lerp(_c.set(T.hg), k); atmo.sc.lerp(_c.set(T.sc), k);
  atmo.dens += (T.dens - atmo.dens) * k; atmo.hi += (T.hi - atmo.hi) * k; atmo.si += (T.si - atmo.si) * k; atmo.glow += (T.glow - atmo.glow) * k;
  atmo.zen.lerp(new THREE.Vector3(...T.zen), k); atmo.hor.lerp(new THREE.Vector3(...T.hor), k);
  scene.fog.color.copy(atmo.fog); scene.fog.density = atmo.dens; scene.background.copy(atmo.fog);
  hemi.color.copy(atmo.hs); hemi.groundColor.copy(atmo.hg); hemi.intensity = atmo.hi; sun.color.copy(atmo.sc); sun.intensity = atmo.si;
  sky.material.uniforms.zen.value.copy(atmo.zen); sky.material.uniforms.hor.value.copy(atmo.hor); sky.material.uniforms.sunGlow.value = atmo.glow;
  return T;
}

function buildTerrain(bio) {
  const n = Math.round(SIZE / RES);
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, n, n);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, heightAt(x, z, bio)); }
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const c = groundColor(pos.getX(i), pos.getZ(i), pos.getY(i), 1 - nor.getY(i), bio);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const tex = noiseTexture(), rep = SIZE / 5;
  tex.repeat.set(rep, rep);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, map: tex, bumpMap: tex, bumpScale: 1.4 }));
  m.receiveShadow = true;
  return m;
}
/* fine grain for snow and ice (wind ripples and sparkle) */
function noiseTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), im = x.createImageData(256, 256);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
    const n = fbm(i / 18, j / 18, 3) * 0.6 + Math.sin((i + fbm(i / 30, j / 30) * 60) / 7) * 0.08 + (hash(i, j) > 0.995 ? 0.35 : 0);
    const v = Math.max(0, Math.min(255, 196 + n * 70)), o = (j * 256 + i) * 4;
    im.data[o] = v; im.data[o + 1] = v; im.data[o + 2] = Math.min(255, v + 6); im.data[o + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
/* stone wall and roof tiles for the village */
function stoneTexture(roof) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = roof ? '#2c3138' : '#6d7068'; x.fillRect(0, 0, 256, 256);
  const r = rng(roof ? 5 : 3);
  for (let row = 0; row < (roof ? 16 : 10); row++) {
    const h = 256 / (roof ? 16 : 10), off = row % 2 ? 0.5 : 0;
    for (let k = -1; k < (roof ? 8 : 5); k++) {
      const w = 256 / (roof ? 8 : 5), g = Math.floor((roof ? 40 : 95) + r() * 40);
      x.fillStyle = roof ? `rgb(${g * 0.8},${g * 0.85},${g})` : `rgb(${g},${g * 0.98},${g * 0.9})`;
      x.fillRect((k + off) * w + 2, row * h + 2, w - 4, h - 4);
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
/* far mountains all around (like the painted backdrops of 1991) */
function buildMountains() {
  const seg = 160, rings = 14, geo = new THREE.BufferGeometry(), p = [], col = [], idx = [];
  for (let j = 0; j <= rings; j++) {
    const r = 320 + j * 30;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const ridge = 1 - Math.abs(fbm(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10, 5) * 2 - 1);
      const prof = Math.sin((j / rings) * Math.PI);
      const north = z < 0 && x > -120; // the jungle lies beyond the precipice : low green hills there
      const y = north ? prof * (20 + ridge * 50) - 85 : (prof * (50 + ridge * ridge * 170)) - 25;
      p.push(x, y, z);
      const snow = !north && y > 70 + fbm(a * 9, j) * 40;
      if (north) { const gk = 0.2 + fbm(a * 20, j) * 0.15; col.push(gk * 0.6, gk * 1.1, gk * 0.5); continue; }
      const k = snow ? 0.9 : 0.22 + fbm(a * 20, j * 0.5) * 0.16;
      col.push(snow ? k * 0.93 : k * 0.75, snow ? k * 0.96 : k * 0.85, snow ? k : k * 1.15);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  geo.setIndex(idx); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
}

/* ---------------- props (instanced) ---------------- */
function conifer() {
  const g = [], dark = new THREE.Color(0x1f3b33), snow = new THREE.Color(0xe8f0ff);
  const add = (geo, c) => { const cc = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < cc.length; i += 3) { cc[i] = c.r; cc[i + 1] = c.g; cc[i + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(cc, 3)); g.push(geo); };
  const trunk = new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6); trunk.translate(0, 0.6, 0); add(trunk.toNonIndexed(), new THREE.Color(0x3a2a20));
  [[1.6, 2.2, 1.0], [1.25, 1.9, 2.1], [0.9, 1.6, 3.1], [0.55, 1.2, 4.0]].forEach(([r, h, y], i) => {
    const c = new THREE.ConeGeometry(r, h, 7); c.translate(0, y + h / 2 - 0.3, 0); add(c.toNonIndexed(), i === 3 ? snow : dark.clone().lerp(snow, 0.08 * i));
  });
  return mergeGeos(g);
}
function deadTree(rand) {
  const g = [], col = new THREE.Color(0x6f7f97);
  const add = geo => { const cc = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < cc.length; i += 3) { const k = 0.85 + Math.random() * 0.2; cc[i] = col.r * k; cc[i + 1] = col.g * k; cc[i + 2] = col.b * k; } geo.setAttribute('color', new THREE.BufferAttribute(cc, 3)); g.push(geo); };
  const h = 5 + rand() * 3;
  const t = new THREE.CylinderGeometry(0.12, 0.35, h, 6); t.translate(0, h / 2, 0); add(t.toNonIndexed());
  for (let i = 0; i < 6; i++) {
    const l = 1 + rand() * 2.2, b = new THREE.CylinderGeometry(0.03, 0.09, l, 4); b.translate(0, l / 2, 0);
    b.rotateZ(0.5 + rand() * 0.7); b.rotateY(rand() * 6.28); b.translate(0, h * (0.45 + rand() * 0.5), 0); add(b.toNonIndexed());
  }
  return mergeGeos(g);
}
function mergeGeos(list) {
  let n = 0; list.forEach(g => { n += g.attributes.position.count; });
  const p = new Float32Array(n * 3), c = new Float32Array(n * 3); let o = 0;
  list.forEach(g => { p.set(g.attributes.position.array, o * 3); c.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  geo.computeVertexNormals(); return geo;
}
function instanced(geo, mat, list) {
  const m = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
  list.forEach((t, i) => { o.position.set(t[0], t[1], t[2]); o.rotation.set(0, t[3] || 0, t[5] || 0); o.scale.setScalar(t[4] || 1); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.castShadow = true; m.receiveShadow = true; return m;
}
/* free spots inside a cell : not on the paths the camera uses (the cross through the middle) */
function spots(c, n, rand, margin = 2.4) {
  const out = [], cx = cellX(c), cz = cellZ(c);
  for (let k = 0; k < n * 6 && out.length < n; k++) {
    const x = (rand() - 0.5) * S * 0.95, z = (rand() - 0.5) * S * 0.95;
    if (Math.abs(x) < margin || Math.abs(z) < margin) continue;
    out.push([cx + x, cz + z]);
  }
  return out;
}

function props1(bio) {
  const grp = new THREE.Group(), rand = rng(1991);
  const vmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const firs = [], dead = [], rocks = [];
  const deadGeo = deadTree(rng(7));
  for (let c = 0; c < 99; c++) {
    const b = bio[c]; if (!b) continue;
    if (b === 'forest') spots(c, 7, rand).forEach(([x, z]) => { firs.push([x, heightAt(x, z, bio) - 0.2, z, rand() * 6.28, 0.8 + rand() * 0.6]); OBST.push({ x, z, r: 0.5 }); });
    if (b === 'dead' || b === 'cilla') spots(c, 11, rand, 1.8).forEach(([x, z]) => { dead.push([x, heightAt(x, z, bio) - 0.2, z, rand() * 6.28, 0.8 + rand() * 0.5]); OBST.push({ x, z, r: 0.45 }); });
    if (b === 'snow' || b === 'mount' || b === 'wreck') spots(c, b === 'mount' ? 5 : 2, rand).forEach(([x, z]) => rocks.push([x, heightAt(x, z, bio) - 0.2, z, rand() * 6.28, b === 'mount' ? 0.8 + rand() * 1.6 : 0.3 + rand() * 0.5]));
  }
  // "la foret se dessine au loin" : fir belts on the outer plateau, beyond the crevasses
  for (let k = 0; k < 900; k++) {
    const a = rand() * Math.PI * 2, r = 85 + rand() * 60, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z < -50 && x > -30) continue; // keep the north open over the jungle
    if (fbm(x * 0.03 + 4, z * 0.03) < 0.5) continue;
    const y = heightAt(x, z, bio); if (y < 0) continue;
    firs.push([x, y - 0.3, z, rand() * 6.28, 0.9 + rand() * 0.9]);
  }
  // jungle far below : round canopies
  const jungle = [];
  for (let k = 0; k < 5200; k++) {
    const far = rand(), x = -260 + rand() * 560, z = -50 - far * far * 620;
    const y = z < -148 || Math.abs(x) > 148 ? -77 : heightAt(x, z, bio);
    if (y > -60) continue; jungle.push([x, y, z, rand() * 6.28, 2.2 + rand() * 3 + far * 4]);
  }
  // the lowlands go on to the horizon, beyond the edge of the terrain grid
  const low = new THREE.Mesh(new THREE.PlaneGeometry(1600, 800), new THREE.MeshStandardMaterial({ color: 0x35582a, roughness: 1 }));
  low.rotation.x = -Math.PI / 2; low.position.set(0, -78, -460); grp.add(low);
  grp.add(instanced(conifer(), vmat, firs));
  grp.add(instanced(deadGeo, vmat, dead));
  const rockGeo = new THREE.DodecahedronGeometry(1, 0); rockGeo.scale(1, 0.6, 1.2);
  grp.add(instanced(rockGeo, new THREE.MeshStandardMaterial({ color: 0x5c6878, roughness: 0.95, flatShading: true }), rocks));
  const crown = new THREE.IcosahedronGeometry(1, 0); crown.scale(1.3, 0.8, 1.3);
  const jm = instanced(crown, new THREE.MeshStandardMaterial({ color: 0x3f6a2a, roughness: 1, flatShading: true }), jungle); jm.castShadow = false; grp.add(jm);
  // the river of the jungle
  const river = new THREE.Mesh(new THREE.PlaneGeometry(9, 260), new THREE.MeshStandardMaterial({ color: 0x5d8fb0, roughness: 0.25, metalness: 0.2 }));
  river.rotation.x = -Math.PI / 2; river.rotation.z = 0.5; river.position.set(55, -76.5, -150); grp.add(river);
  const river2 = river.clone(); river2.scale.set(1.6, 2.2, 1); river2.rotation.z = -0.35; river2.position.set(30, -77.4, -420); grp.add(river2);
  return grp;
}

/* frozen lakes : the lake of the gourde (60) and the dragon's lake (65) */
function iceDisc(c, r) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ color: 0xa9cbe4, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.94 }));
  m.rotation.x = -Math.PI / 2; m.position.set(cellX(c), -0.12, cellZ(c)); m.receiveShadow = true; return m;
}

/* the Gouark village (78) : stone houses, a tower, a well */
function buildVillage(c) {
  const g = new THREE.Group(), cx = cellX(c), cz = cellZ(c);
  const wallT = stoneTexture(false), roofT = stoneTexture(true);
  const house = (x, z, w, d, h, ry, tall) => {
    const wt = wallT.clone(); wt.needsUpdate = true; wt.repeat.set(Math.max(w, d) / 2.5, h / 2.5);
    const rt = roofT.clone(); rt.needsUpdate = true; rt.repeat.set(2, 2);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95 })); b.position.y = h / 2;
    const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.8, tall ? h * 0.45 : h * 0.75, 4), new THREE.MeshStandardMaterial({ map: rt, roughness: 0.8, flatShading: true }));
    r.position.y = h + (tall ? h * 0.225 : h * 0.375); r.rotation.y = Math.PI / 4;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.7), new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 1 })); door.position.set(0, 0.85, d / 2 + 0.01);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.7), new THREE.MeshStandardMaterial({ color: 0xffc56a, emissive: 0xc07a20, emissiveIntensity: 0.9 })); win.position.set(w * 0.25, h * 0.7, d / 2 + 0.01);
    const hg = new THREE.Group(); hg.add(b, r, door, win); hg.position.set(x, -0.1, z); hg.rotation.y = ry || 0; OBST.push({ x, z, r: Math.max(w, d) * 0.62 });
    hg.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } }); return hg;
  };
  // the houses face the paths ; the tower house stands at the back, as in the 1991 picture
  g.add(house(cx - 5.4, cz - 5.6, 3.2, 3.2, 8.5, 0, true));
  g.add(house(cx + 5.6, cz - 5.2, 3.4, 2.8, 3.0, -Math.PI / 2), house(cx + 5.4, cz + 7.2, 3, 3, 2.8, Math.PI), house(cx - 5.8, cz + 6.8, 3, 2.8, 3.1, Math.PI / 2));
  g.add(house(cx - 2, cz - 12.5, 4, 3, 3.4, 0), house(cx + 3.5, cz - 13, 3, 3, 3, 0), house(cx - 8.5, cz - 11, 3, 3, 3.8, 0.3));
  const wt = wallT.clone(); wt.needsUpdate = true; wt.repeat.set(3, 0.6);
  const well = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.9, 16, 1, true), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95, side: THREE.DoubleSide }));
  well.position.set(cx + 2.7, 0.4, cz - 3); well.castShadow = true; g.add(well);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), new THREE.MeshStandardMaterial({ color: 0x4a3322 }));
  [-0.8, 0.8].forEach(dx => { const p = post.clone(); p.position.set(cx + 2.7 + dx, 1.2, cz - 3); g.add(p); });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), post.material); beam.position.set(cx + 2.7, 2, cz - 3); g.add(beam);
  return g;
}

/* ---------------- characters and the F49 : Meshy models, simple stand-ins meanwhile ---------------- */
const ACTORS = {};
function standIn(id) {
  const g = new THREE.Group();
  const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: id === 'f49' ? 0.5 : 0 });
  if (id === 'f49') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 6, 6, 12), M(0x8c97a6)); body.rotation.z = Math.PI / 2; body.position.y = 0.7; g.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 7), M(0x7d8896)); wing.position.set(-0.6, 0.6, 0); g.add(wing);
  } else if (id === 'dragon') {
    const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector3(Math.sin(t * 5) * 1.2, t * 9, Math.cos(t * 4) * 0.6)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.55, 10), M(0x3f7f86)));
  } else if (id === 'guard') {
    const cloth = new THREE.MeshStandardMaterial({ color: 0x2f5f56, roughness: 0.9 }), skin = new THREE.MeshStandardMaterial({ color: 0xc89a78 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.0, 4, 10), cloth); body.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin); head.position.y = 1.95;
    g.add(body, head);
  } else {
    const horse = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.6, 6, 10), M(0xe6e6ea)); horse.rotation.z = Math.PI / 2; horse.position.y = 1.4; g.add(horse);
    const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 6, 10), M(0xb8c0cc)); rider.position.y = 2.6; g.add(rider);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
const DEFAULT_MODELS = [
  { id: 'f49', cell: 39, size: 9, yaw: -0.5, sink: 0.35 },
  { id: 'dragon', cell: 65, size: 10, yaw: 0, sink: 0.6, deform: 'serpent' },
  { id: 'cilla', cell: 58, size: 3.2, yaw: 0, sink: 0, deform: 'rider' },
  { id: 'guard', cell: 78, size: 1.85, yaw: 0, sink: 0, dx: -2.6, dz: -2.8 },
  // world II : people stand in their cell and face James ; the monster and the hands rise wherever they lurk
  { id: 'varlox', world: 2, cell: 21, code: 23, size: 2.2, sink: 0, deform: 'idle', face: true },
  { id: 'mutant', world: 2, cell: 55, code: 24, size: 2.1, sink: 0, deform: 'idle', face: true },
  { id: 'auri', world: 2, cell: 70, code: 25, size: 2.2, sink: 0, deform: 'idle', face: true },
  { id: 'oktar', world: 2, cell: 85, code: 26, size: 3.2, sink: 0, deform: 'idle', face: true, yaw: 0.5 },
  { id: 'monster', world: 2, cell: 37, code: 28, roam: true, size: 3.4, sink: 0.2, deform: 'idle', face: true, rise: 4.5, ahead: 2.2 },
  { id: 'hands', world: 2, cell: 20, code: 22, roam: true, size: 1.5, sink: 0.1, deform: 'idle', copies: [[-2.2, 0.6, 0.3], [0.4, -1.2, -0.4], [2.4, 0.2, 1.1], [-0.6, 1.9, 2.4], [1.6, 2.6, -1.2]], rise: 1.8, ahead: 3.2 },
  { id: 'jeep', world: 2, cell: 50, size: 5.2, sink: 0.35, yaw: 0.7, always: true, dx: 1.2, dz: -2.2 },
  // world III : the same guard model stands at every post of the forbidden city
  { id: 'voyou', world: 3, cell: 34, code: 41, size: 1.85, deform: 'idle', face: true },
  { id: 'police', world: 3, cell: 48, code: 44, size: 1.95, deform: 'idle', face: true, model: 'garde' },
  { id: 'garde27', world: 3, cell: 27, code: 45, size: 1.95, deform: 'idle', face: true, model: 'garde' },
  { id: 'garde45', world: 3, cell: 45, code: 45, size: 1.95, deform: 'idle', face: true, model: 'garde' },
  { id: 'garde63', world: 3, cell: 63, code: 45, size: 1.95, deform: 'idle', face: true, model: 'garde' },
  { id: 'garde81', world: 3, cell: 81, code: 45, size: 1.95, deform: 'idle', face: true, model: 'garde' },
  { id: 'garde92', world: 3, cell: 92, code: 45, size: 1.95, deform: 'idle', face: true, model: 'garde' },
  { id: 'gardien', world: 3, cell: 77, code: 46, size: 1.95, deform: 'idle', face: true, model: 'garde' },
  { id: 'porkus', world: 3, cell: 50, code: 47, size: 1.9, deform: 'idle', face: true },
  { id: 'vieil', world: 3, cell: 69, code: 48, size: 1.5, deform: 'idle', face: true, table: true },
  { id: 'secte', world: 3, cell: 74, code: 53, roam: false, size: 1.9, deform: 'idle', copies: [[-1.2, -0.8, 0], [1.1, -0.6, 0], [-1.0, 1.4, 0], [1.2, 1.6, 0], [0, 3.6, 0]], march: true },
  { id: 'necarex', world: 3, cell: 95, code: 55, size: 3.4, deform: 'idle', face: true, ahead: 1.5 },
  { id: 'statue', world: 3, cell: 0, size: 34, always: true, x: 96, z: -48, y: 5.3, yaw: -1.9 },
  { id: 'car1', world: 3, cell: 12, size: 4.4, always: true, dx: 3.9, dz: 3.6, yaw: 0.3, sink: 0.15, model: 'voiture' },
  { id: 'car2', world: 3, cell: 28, size: 4.4, always: true, dx: -3.8, dz: -3.6, yaw: 2.0, sink: 0.15, model: 'voiture' },
  { id: 'car3', world: 3, cell: 40, size: 4.4, always: true, dx: 3.7, dz: -3.9, yaw: -1.2, sink: 0.15, model: 'voiture' },
  { id: 'car4', world: 3, cell: 66, size: 4.4, always: true, dx: -3.9, dz: 3.7, yaw: 1.4, sink: 0.15, model: 'voiture' },
  { id: 'car5', world: 3, cell: 33, size: 4.4, always: true, dx: 3.8, dz: 3.8, yaw: 2.8, sink: 0.15, model: 'voiture' }
];
function placeActor(def, obj, gl) {
  const holder = ACTORS[def.id] || new THREE.Group();
  holder.clear();
  let skinned = false; obj.traverse(m => { if (m.isSkinnedMesh) skinned = true; });
  const measure = () => { obj.updateMatrixWorld(true); return new THREE.Box3().setFromObject(obj, skinned); }; // skinned : measure the posed vertices
  const box = measure(), size = new THREE.Vector3(); box.getSize(size);
  const k = def.size ? def.size / Math.max(size.x, size.y, size.z) : 1;
  obj.scale.multiplyScalar(k);
  const b2 = measure(), ctr = new THREE.Vector3(); b2.getCenter(ctr);
  obj.position.x -= ctr.x; obj.position.z -= ctr.z; obj.position.y -= b2.min.y + (def.sink || 0);
  holder.add(obj);
  const x = def.x != null ? def.x : cellX(def.cell) + (def.dx || 0), z = def.z != null ? def.z : cellZ(def.cell) + (def.dz || 0);
  holder.position.set(x, def.y != null ? def.y : world ? heightAt(x, z, world.bio) : 0, z);
  holder.rotation.y = def.yaw || 0;
  holder.userData.def = def;
  holder.userData.mixer = null;
  if (!ACTORS[def.id]) { // a new actor : shown only once the game says it is there (onView), except scenery
    ACTORS[def.id] = holder; scene.add(holder);
    holder.visible = (def.world || 1) === (V3.world || 1) && (def.always || !(def.code || def.id === 'dragon' || def.id === 'cilla'));
  }
  if (def.deform && gl) bake(holder, obj, def.deform);
  if (def.table && gl) { // the old man's table and its candle, in front of him
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.9), new THREE.MeshStandardMaterial({ color: 0x5a3622, roughness: 0.8 })); t.position.set(0, 0.78, 0.95);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.74, 0.7), new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.9 })); legs.position.set(0, 0.37, 0.95);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.28, 8), new THREE.MeshStandardMaterial({ color: 0xf0e0c0 })); candle.position.set(0.5, 0.96, 1.05);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc860 })); flame.scale.y = 1.8; flame.position.set(0.5, 1.15, 1.05); flame.userData.flame = true;
    const light = new THREE.PointLight(0xffa040, 1.4, 7, 1.6); light.position.set(0.5, 1.3, 1.05);
    holder.add(t, legs, candle, flame, light); holder.userData.flame = { flame, light };
  }
  if (gl && gl.animations && gl.animations.length) setupRig(holder, obj, gl); // a rigged Meshy character
  else if (gl && def.rig === 'serpent') setupSerpent(holder, obj);
  return holder;
}
/* model vertices moved into the holder's space (metres, y up, base at 0) so a vertex shader can bend them */
function toFloat(g, name) {
  const a = g.getAttribute(name); if (!a) return;
  if (a.isBufferAttribute && a.array instanceof Float32Array && !a.normalized) return;
  const n = a.itemSize, f = new Float32Array(a.count * n);
  for (let i = 0; i < a.count; i++) { f[i * n] = a.getX(i); if (n > 1) f[i * n + 1] = a.getY(i); if (n > 2) f[i * n + 2] = a.getZ(i); if (n > 3) f[i * n + 3] = a.getW(i); }
  g.setAttribute(name, new THREE.BufferAttribute(f, n));
}
function bake(holder, obj, kind) {
  holder.updateMatrixWorld(true);
  const inv = holder.matrixWorld.clone().invert(), meshes = [];
  obj.traverse(m => { if (m.isMesh && !m.isSkinnedMesh) meshes.push(m); });
  holder.remove(obj);
  const U = holder.userData.u = { uTime: { value: 0 }, uAmp: { value: 0 }, uLunge: { value: 0 }, uNod: { value: 0 }, uH: { value: 1 }, uL: { value: 1 }, uFwd: { value: new THREE.Vector2(0, 1) } };
  const all = new THREE.Box3();
  meshes.forEach(m => {
    const g = m.geometry.clone(); toFloat(g, 'position'); toFloat(g, 'normal');
    g.applyMatrix4(inv.clone().multiply(m.matrixWorld)); g.computeBoundingBox(); all.union(g.boundingBox);
    m.geometry = g; m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); m.updateMatrix();
    holder.add(m); m.frustumCulled = false;
  });
  const sz = new THREE.Vector3(); all.getSize(sz);
  U.uH.value = Math.max(0.1, all.max.y);
  if (kind === 'rider') { // which way does the horse face ? its head is the high end of its long axis
    const alongZ = sz.z >= sz.x, L = (alongZ ? sz.z : sz.x) / 2;
    let hiPos = -1e9, hiNeg = -1e9;
    meshes.forEach(m => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i += 7) { const a = alongZ ? p.getZ(i) : p.getX(i), y = p.getY(i); if (a > L * 0.55) hiPos = Math.max(hiPos, y); if (a < -L * 0.55) hiNeg = Math.max(hiNeg, y); } });
    const sgn = hiPos >= hiNeg ? 1 : -1;
    U.uFwd.value.set(alongZ ? 0 : sgn, alongZ ? sgn : 0); U.uL.value = L;
  }
  meshes.forEach(m => {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const out = mats.map(mt => { const c = mt.clone(); deformMaterial(c, kind, U); return c; });
    m.material = out.length === 1 ? out[0] : out;
  });
}
const DEFORM = {
  /* the dragon : a wave runs up the serpent body, the head sways ; it lunges at James when he is hit */
  serpent: `
    float h = clamp(transformed.y / uH, 0.0, 1.0), k = h * h;
    transformed.x += sin(uTime * 1.7 - h * 5.5) * k * uAmp;
    transformed.z += cos(uTime * 1.2 - h * 4.0) * k * uAmp * 0.5 + uLunge * k * k * uH * 0.38;
    transformed.y -= uLunge * k * k * uH * 0.3;`,
  /* world II people and creatures : breathing, a slow sway, the head looking around ; a lunge in a fight */
  idle: `
    float y = clamp(transformed.y / uH, 0.0, 1.2), ph = transformed.x * 1.3 + transformed.z * 0.7;
    float br = sin(uTime * 1.7 + ph * 0.3) * 0.016 * smoothstep(0.35, 0.65, y);
    transformed.xz *= 1.0 + br;
    transformed.x += sin(uTime * 0.75 + ph) * 0.035 * y * y * uH * (1.0 + uAmp * 3.0);
    transformed.z += cos(uTime * 0.6 + ph) * 0.02 * y * y * uH * (1.0 + uAmp * 3.0) + uLunge * y * y * uH * 0.32;
    float hd = smoothstep(0.8, 0.9, y), an = sin(uTime * 0.45) * 0.22 * hd;
    float cx = transformed.x, cz = transformed.z;
    transformed.x = cx * cos(an) - cz * sin(an); transformed.z = cx * sin(an) + cz * cos(an);`,
  /* the horse breathes, nods and swishes its tail ; Cilla sways in the saddle */
  rider: `
    vec2 side = vec2(-uFwd.y, uFwd.x);
    float f = dot(transformed.xz, uFwd) / uL, y = transformed.y / uH;
    float br = sin(uTime * 1.9) * 0.014 * smoothstep(0.22, 0.38, y) * (1.0 - smoothstep(0.52, 0.62, y)) * (1.0 - abs(f));
    transformed.xz += side * dot(transformed.xz, side) * br * 2.0; transformed.y += br * uH * 0.25;
    float hw = smoothstep(0.3, 0.55, f) * smoothstep(0.38, 0.52, y);
    float ang = (sin(uTime * 0.9) * 0.06 + uNod * 0.28) * hw;
    float pf = f * uL - 0.42 * uL, py = transformed.y - 0.6 * uH;
    float nf = pf * cos(ang) - py * sin(ang), ny = pf * sin(ang) + py * cos(ang);
    transformed.xz += uFwd * (nf - pf); transformed.y += ny - py;
    float tw = 1.0 - smoothstep(-0.97, -0.78, f);
    transformed.xz += side * sin(uTime * 2.6 + y * 4.0) * 0.16 * tw * (uH / 3.0);
    float rw = smoothstep(0.6, 0.68, y) * (1.0 - smoothstep(0.22, 0.38, abs(f)));
    transformed.xz += side * sin(uTime * 0.8) * 0.06 * (y - 0.6) * uH * rw;
    transformed.xz += uFwd * sin(uTime * 1.9) * 0.012 * rw * uH;`
};
function deformMaterial(mat, kind, U) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'uniform float uTime, uAmp, uLunge, uNod, uH, uL; uniform vec2 uFwd;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + DEFORM[kind]);
  };
  mat.customProgramCacheKey = () => 'alive-' + kind;
}
/* A rigged Meshy character (Mixamo skeleton) : its walk cycle, and a standing pose written here
   (Meshy's own idle could not be added) : arms down, breathing, head turned towards James. */
function setupRig(holder, obj, gl) {
  const bones = {}, rest = new Map();
  obj.traverse(m => { if (m.isSkinnedMesh) { m.frustumCulled = false; m.castShadow = true; } });
  obj.traverse(b => { if (b.isBone) { rest.set(b, b.quaternion.clone()); const n = b.name.replace(/^mixamorig:?/, ''); if (!bones[n]) bones[n] = b; } });
  const mixer = new THREE.AnimationMixer(obj);
  const walkClip = gl.animations.find(c => /walk/i.test(c.name)) || gl.animations[0];
  const walk = mixer.clipAction(walkClip);
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.9 }), iron = new THREE.MeshStandardMaterial({ color: 0x9aa0aa, metalness: 0.7, roughness: 0.35 });
  const spear = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.5, 6), wood); shaft.position.y = 0.75;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.3, 6), iron); tip.position.y = 2.15;
  spear.add(shaft, tip); spear.traverse(m => { if (m.isMesh) m.castShadow = true; });
  scene.add(spear);
  holder.userData.rig = { mixer, walk, bones, rest, spear, state: 'patrol', dir: 1, t0: performance.now() };
}
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
/* The dragon, rigged by Meshy (skeleton only, no animation) : its spine is the chain of bones from the
   highest bone (the head) down to the root. The game bends that chain : a wave runs up the body, the
   head sways, and the whole neck rears and strikes towards James. */
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
function setupSerpent(holder, obj) {
  obj.traverse(m => { if (m.isSkinnedMesh) { m.frustumCulled = false; m.castShadow = true; } });
  holder.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(holder.matrixWorld).invert(), bones = [];
  obj.traverse(b => { if (b.isBone) bones.push(b); });
  const pos = new Map(); bones.forEach(b => { b.getWorldPosition(_v); pos.set(b, _v.clone().applyMatrix4(inv)); });
  let head = bones[0]; bones.forEach(b => { if (pos.get(b).y > pos.get(head).y) head = b; });
  const chain = []; for (let b = head; b && b.isBone; b = b.parent) chain.unshift(b); // root ... head
  const H = Math.max(0.1, pos.get(head).y), hq = new THREE.Quaternion(), wq = new THREE.Quaternion();
  holder.getWorldQuaternion(hq);
  const info = chain.map((b, i) => {
    b.getWorldQuaternion(wq);
    // axes of the holder expressed in the bone's own frame
    const q = wq.clone().invert().multiply(hq);
    return { b, rest: b.quaternion.clone(), h: Math.max(0, pos.get(b).y) / H, i, ax: AX.x.clone().applyQuaternion(q), ay: AX.y.clone().applyQuaternion(q), az: AX.z.clone().applyQuaternion(q) };
  });
  // other bones (claws, horns) : a little life
  const limbs = bones.filter(b => !chain.includes(b) && b.parent && chain.includes(b.parent)).map(b => ({ b, rest: b.quaternion.clone() }));
  holder.userData.serpent = { info, limbs, n: chain.length };
}
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion();
function updateSerpent(dr, now, lunge) {
  const S_ = dr.userData.serpent; if (!S_) return;
  const t = now / 1000;
  S_.info.forEach(o => {
    const w = o.h * o.h; // the coils on the ice hardly move, the neck and head do
    const sway = Math.sin(t * 1.7 - o.h * 5.5) * 0.09 * w;
    const bend = Math.cos(t * 1.2 - o.h * 4.0) * 0.06 * w;
    const strike = lunge * 0.16 * w * (o.h > 0.45 ? 1 : 0.3);
    _qa.setFromAxisAngle(o.ay, sway); _qb.setFromAxisAngle(o.az, bend); _qc.setFromAxisAngle(o.ax, strike);
    o.b.quaternion.copy(o.rest).multiply(_qa).multiply(_qb).multiply(_qc);
  });
  S_.limbs.forEach((l, k) => { _qa.setFromAxisAngle(AX.z, Math.sin(t * 2.2 + k) * 0.12); l.b.quaternion.copy(l.rest).multiply(_qa); });
}
function boneTurn(b, rest, x, y, z) { if (!b) return; _q.setFromEuler(_e.set(x, y, z)); b.quaternion.copy(rest.get(b)).multiply(_q); }
function updateGuard(gd, dt, now) {
  const R_ = gd.userData.rig; if (!R_) return;
  const d = gd.userData.def, post = { x: cellX(d.cell) + (d.dx || 0), z: cellZ(d.cell) + (d.dz || 0) };
  const near = curCell === d.cell || Math.hypot(pose.x - post.x, pose.z - post.z) < 15;
  // where to go : back and forth in front of the houses, or to his post when James comes
  let tx, tz;
  if (near) { tx = post.x; tz = post.z; }
  else { tx = post.x + (R_.dir > 0 ? 4.5 : -3.5); tz = post.z + 0.4; if (Math.hypot(tx - gd.position.x, tz - gd.position.z) < 0.3) R_.dir = -R_.dir; }
  const dx = tx - gd.position.x, dz = tz - gd.position.z, dist = Math.hypot(dx, dz);
  const moving = dist > 0.2;
  if (moving) {
    if (!R_.walk.isRunning()) R_.walk.reset().fadeIn(0.25).play();
    const sp = Math.min(dist, 1.15 * Math.min(0.25, dt * 1));
    gd.position.x += dx / dist * sp; gd.position.z += dz / dist * sp;
    const want = Math.atan2(dx, dz); gd.rotation.y += (shortest(gd.rotation.y, want) - gd.rotation.y) * Math.min(1, dt * 5);
    R_.mixer.update(dt);
  } else {
    if (R_.walk.isRunning()) R_.walk.stop();
    const want = Math.atan2(pose.x - gd.position.x, pose.z - gd.position.z);
    gd.rotation.y += (shortest(gd.rotation.y, want) - gd.rotation.y) * Math.min(1, dt * 2.5);
    const B = R_.bones, ts = now / 1000, br = Math.sin(ts * 1.6);
    R_.rest.forEach((q, b) => b.quaternion.copy(q));
    const down = V3.armDown != null ? V3.armDown : -0.95; // the rest pose is an A-pose : bring the arms down
    boneTurn(B.LeftArm, R_.rest, 0, 0, down + br * 0.02);
    boneTurn(B.RightArm, R_.rest, 0, 0, -down - br * 0.02);
    boneTurn(B.Spine2, R_.rest, br * 0.025, 0, 0);
    boneTurn(B.Spine, R_.rest, 0, Math.sin(ts * 0.37) * 0.04, 0);
    boneTurn(B.Head, R_.rest, Math.sin(ts * 0.5) * 0.04, Math.sin(ts * 0.31) * 0.25, 0);
  }
  gd.position.y = heightAt(gd.position.x, gd.position.z, world.bio);
  // the spear stays upright in his right hand
  const hand = R_.bones.RightHand;
  if (hand) { gd.updateMatrixWorld(true); hand.getWorldPosition(_v); R_.spear.position.set(_v.x, _v.y - 0.75, _v.z); R_.spear.rotation.set(0.05, 0, moving ? Math.sin(now / 300) * 0.05 : 0.04); }
  R_.spear.visible = gd.visible;
}

/* glTF JSON with an embedded buffer -> an in-memory GLB (no data: URL to fetch, some pages forbid them) */
const bundles = {}; // several models in one file ("assets/v3/world2.json#varlox.gltf.json") : fewer files to publish
async function fetchModel(url) {
  let js;
  const h = url.indexOf('#');
  if (h > 0) {
    const bu = url.slice(0, h), key = url.slice(h + 1);
    const b = bundles[bu] || (bundles[bu] = fetch(bu).then(r => { if (!r.ok) throw new Error(bu + ' ' + r.status); return r.json(); }));
    js = (await b)[key]; if (!js) throw new Error(url + ' missing');
  } else {
    const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
    if (!/\.json$/i.test(url)) return r.arrayBuffer();
    js = await r.json();
  }
  const uri = js.buffers[0].uri || '', b64 = uri.slice(uri.indexOf(',') + 1);
  const bin = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
  delete js.buffers[0].uri;
  let jb = new TextEncoder().encode(JSON.stringify(js));
  const jpad = (4 - (jb.length % 4)) % 4, bpad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + jb.length + jpad + 8 + bin.length + bpad, out = new ArrayBuffer(total), dv = new DataView(out), u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jb.length + jpad, true); dv.setUint32(16, 0x4E4F534A, true); u8.set(jb, 20); u8.fill(0x20, 20 + jb.length, 20 + jb.length + jpad);
  let o = 20 + jb.length + jpad;
  dv.setUint32(o, bin.length + bpad, true); dv.setUint32(o + 4, 0x004E4942, true); u8.set(bin, o + 8);
  return out;
}
/* models are loaded per world, the first time James gets there (world II's people are not downloaded in world I) */
let modelList = null; const loadedWorlds = {}, fileCache = {};
function loadModels(worldId) {
  if (loadedWorlds[worldId]) return; loadedWorlds[worldId] = true;
  const worldOf = id => { const d = DEFAULT_MODELS.find(x => x.id === id); return d ? (d.world || 1) : 0; }; // 0 : a model file used only through 'model'
  if (worldId === 1) DEFAULT_MODELS.filter(d => !d.world || d.world === 1).forEach(d => placeActor(d, standIn(d.id)));
  const loader = new GLTFLoader();
  const list = modelList || (modelList = fetch('assets/v3/models.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : [])).catch(() => []));
  list.then(all => {
    const want = DEFAULT_MODELS.filter(d => (d.world || 1) === worldId && d.model).map(d => ({ id: d.id, file: ((all || []).find(x => x.id === d.model) || {}).file })).filter(d => d.file);
    (all || []).filter(def => worldOf(def.id) === worldId).concat(want).forEach(def => {
      const done = gl => {
        let o = gl.scene;
        const full = Object.assign({}, DEFAULT_MODELS.find(x => x.id === def.id) || {}, def);
        if (full.copies) { // several copies of one model (the hands in the marsh), each scaled to size
          const b = new THREE.Box3().setFromObject(o), sz = new THREE.Vector3(); b.getSize(sz);
          const k = full.size / Math.max(sz.x, sz.y, sz.z), grp = new THREE.Group();
          full.copies.forEach(([x, z, r], i) => { const c = o.clone(); c.scale.multiplyScalar(k * (0.85 + (i % 3) * 0.12)); c.rotation.y = r; c.position.set(x, -b.min.y * k, z); grp.add(c); });
          o = grp; full.size = 0;
        }
        o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.material && m.material.map) m.material.map.anisotropy = 4; } });
        placeActor(full, o, gl);
        if (V3.lastGame) V3.onView(V3.lastGame, V3.lastView); // show it now if James stands in front of it
      };
      const buf = fileCache[def.file] || (fileCache[def.file] = fetchModel('assets/v3/' + def.file));
      buf.then(b => loader.parse(b.slice(0), '', done, e => console.warn('V3 model', def.id, e))).catch(e => console.warn('V3 model', def.id, e));
    });
  });
}

/* ---------------- snow ---------------- */
const SNOW_N = 2600;
const snowGeo = new THREE.BufferGeometry(), snowPos = new Float32Array(SNOW_N * 3), snowSpd = new Float32Array(SNOW_N);
for (let i = 0; i < SNOW_N; i++) { snowPos[i * 3] = (Math.random() - 0.5) * 60; snowPos[i * 3 + 1] = Math.random() * 25; snowPos[i * 3 + 2] = (Math.random() - 0.5) * 60; snowSpd[i] = 0.6 + Math.random() * 1.1; }
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }));
scene.add(snow);

/* fireflies of the marshes and the jungle */
const FLY_N = 420, flyPos = new Float32Array(FLY_N * 3), flyBase = [];
for (let i = 0; i < FLY_N; i++) flyBase.push([(Math.random() - 0.5) * 50, 0.6 + Math.random() * 3.5, (Math.random() - 0.5) * 50, Math.random() * 6.28]);
const flyGeo = new THREE.BufferGeometry(); flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ color: 0xd8ff8a, size: 0.07, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
flies.visible = false; scene.add(flies);
/* the open water where the dragon broke the ice */
const hole = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), new THREE.MeshStandardMaterial({ color: 0x0d2a40, roughness: 0.05, metalness: 0.3 }));
hole.rotation.x = -Math.PI / 2; hole.visible = false; scene.add(hole);
/* ice shards when the dragon breaks out */
const SH_N = 160, shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.25), new THREE.MeshStandardMaterial({ color: 0xd8ecff, roughness: 0.1, metalness: 0.2 }), SH_N);
const shardV = []; shards.visible = false; scene.add(shards);

/* ---------------- building the world ---------------- */
function build(worldId, map) {
  if (world) { scene.remove(world.root); world.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  OBST.length = 0;
  const bio = biomes(map, worldId), root = new THREE.Group();
  world = { id: worldId, bio, root };
  waterTex.length = 0;
  if (worldId === 3) root.add(buildTerrain(bio), cityBlocks(bio), rooms3(bio), furnish3(bio), street3(bio), skyline3());
  else if (worldId === 2) root.add(buildTerrain(bio), mountains2(), props2(bio), buildWaters2());
  else {
    root.add(buildTerrain(bio), buildMountains(), props1(bio), iceDisc(60, 5.2), iceDisc(65, 5.4), buildVillage(78));
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.0), new THREE.MeshStandardMaterial({ color: 0xcfe6f7, roughness: 0.1, metalness: 0.1 }));
    block.position.set(cellX(60) + 1.2, 0.2, cellZ(60) - 1.5); block.rotation.y = 0.4; root.add(block);
  }
  scene.add(root);
  Object.values(ACTORS).forEach(a => { const d = a.userData.def; if ((d.world || 1) === worldId && d.y == null) a.position.y = heightAt(a.position.x, a.position.z, bio); });
  V3.atmoSnap = true;
}

/* ---------------- camera moves ---------------- */
const pose = { x: 0, z: 0, yaw: 0, y: 0, pitch: 0, fwd: 0 };
let anim = null, curCell = -1, curDir = 0, curDirNext = 0;
function camPose(cell, dir) { const [fx, fz] = FWD[dir]; return { x: cellX(cell) - fx * R, z: cellZ(cell) - fz * R, yaw: YAW[dir] }; }
function shortest(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d; }

V3.onView = function (game, v) {
  if (!game.st) return;
  const st = game.st;
  V3.world = st.world;
  if (!V3.supported[st.world]) { V3.viewScene = null; return; }
  if (!world || world.id !== st.world) { build(st.world, st.map); loadModels(st.world); }
  V3.lastGame = game; V3.lastView = v;
  V3.viewScene = v && v.img ? game.screen.lastScene : null;
  const cell = st.pos, dir = st.dir, now = performance.now();
  curDirNext = dir;
  V3.hint = (HINTS[st.world] || {})[game.code] || { pitch: 0, fwd: 0 };
  // characters present on the map right now
  const has = (c, code) => [0, 1, 2, 3].some(l => st.map[l][c] === code);
  if (ACTORS.dragon) { const was = ACTORS.dragon.visible; ACTORS.dragon.visible = has(65, 15) && cell === 65; if (ACTORS.dragon.visible && !was) { V3.dragonT = now; burst(65); } }
  if (ACTORS.cilla) ACTORS.cilla.visible = st.world === 1 && has(58, 14) && cell === 58;
  if (ACTORS.dragon && st.world !== 1) ACTORS.dragon.visible = false;
  ['f49', 'guard'].forEach(id => { if (ACTORS[id]) ACTORS[id].visible = st.world === 1; });
  if (ACTORS.guard && ACTORS.guard.userData.rig) ACTORS.guard.userData.rig.spear.visible = st.world === 1;
  Object.values(ACTORS).forEach(a => { // world II : who is here now ?
    const d = a.userData.def; if (!d.world) return;
    if (d.world !== st.world) { a.visible = false; return; }
    if (d.always) { a.visible = true; return; }
    const here = has(cell, d.code) && (d.roam || cell === d.cell);
    if (here && (!a.visible || a.userData.at !== cell)) { // it appears : rises from the ground in front of James
      const [fx, fz] = FWD[dir], ah = d.ahead || 0;
      a.position.set(cellX(cell) + fx * ah, 0, cellZ(cell) + fz * ah); a.position.y = heightAt(a.position.x, a.position.z, world.bio);
      a.userData.at = cell; a.userData.riseT = d.rise ? now : 0; a.userData.baseY = a.position.y; a.userData.myaw = YAW[dir];
      a.rotation.y = Math.atan2(-fx, -fz) + (d.yaw || 0);
    }
    a.visible = here;
  });
  const void_ = !(v && v.img) && st.dead === 'fall';
  V3.deathKind = (st.world === 3 ? { 35: 'heat', 42: 'floor', 51: 'sink', 52: 'heat' } : { 35: 'heat', 36: 'sink', 37: 'swept' })[game.code] || 'fall';
  if (V3.isFree()) { // modern controls : the camera belongs to the player ; only falls and teleports are animated here
    FREE.crossing = false;
    const away = curCell < 0 || cellAt(pose.x, pose.z) !== cell;
    if (void_) { const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw); anim = { t0: now, dur: 1700, from: { x: pose.x, z: pose.z, yaw: pose.yaw }, to: { x: pose.x + fx * 1.5, z: pose.z + fz * 1.5, yaw: pose.yaw }, fall: true }; V3.fullMask = true; if (window.AliveV2) window.AliveV2.dirtyAll = true; }
    else if (away) { pose.x = cellX(cell) - FWD[dir][0] * R; pose.z = cellZ(cell) - FWD[dir][1] * R; pose.yaw = YAW[dir]; FREE.pitch = 0; anim = null; }
    curCell = cell; curDir = dir; return;
  }
  if (curCell < 0 || anim === null && Math.hypot(pose.x - camPose(cell, dir).x, pose.z - camPose(cell, dir).z) > S * 1.6) { // first view, load, teleport
    Object.assign(pose, camPose(cell, dir)); curCell = cell; curDir = dir; anim = null;
    if (!void_) return;
  }
  const from = { x: pose.x, z: pose.z, yaw: pose.yaw };
  if (void_) { // one step into the void... and the fall
    const [fx, fz] = FWD[dir];
    anim = { t0: now, dur: 1700, from, to: { x: cellX(cell) - fx * 1, z: cellZ(cell) - fz * 1, yaw: shortest(from.yaw, YAW[dir]) }, fall: true };
    V3.fullMask = true; if (window.AliveV2) window.AliveV2.dirtyAll = true;
  } else if (cell === curCell && dir !== curDir) { // a quarter turn around the middle of the place
    anim = { t0: now, dur: 380, from, to: { yaw: shortest(from.yaw, YAW[dir]) }, turn: true, cell };
  } else {
    const to = camPose(cell, dir); to.yaw = shortest(from.yaw, to.yaw);
    anim = { t0: now, dur: 520, from, to, walk: true };
  }
  curCell = cell; curDir = dir;
};
V3.onSfx = function (name) {
  const now = performance.now();
  if (name === 'hurt') V3.kick = now;
  const dr = ACTORS.dragon; // in a fight the dragon strikes when James is hurt, and recoils when he lands a blow
  const anyone = (dr && dr.visible) || Object.values(ACTORS).some(a => a.visible && a.userData.def.world === 2 && !a.userData.def.always);
  if (anyone) { if (name === 'hurt') V3.lunge = { t: now, a: 1 }; if (name === 'hit') V3.lunge = { t: now, a: -0.45 }; }
};
V3.reset = function () { curCell = -1; anim = null; V3.fullMask = false; FREE.crossing = false; FREE.pitch = 0; if (V3.lastGame && V3.lastGame.st) V3.onView(V3.lastGame, V3.lastView); };

function burst(c) {
  const o = new THREE.Object3D(); shards.visible = true; shardV.length = 0;
  for (let i = 0; i < SH_N; i++) {
    const a = Math.random() * 6.28, r = Math.random() * 3, fx = -Math.sin(YAW[curDirNext]) * 5, fz = -Math.cos(YAW[curDirNext]) * 5;
    shardV.push({ x: cellX(c) + fx + Math.cos(a) * r, y: 0, z: cellZ(c) + fz + Math.sin(a) * r, vx: Math.cos(a) * (2 + Math.random() * 5), vy: 4 + Math.random() * 9, vz: Math.sin(a) * (2 + Math.random() * 5), r: Math.random() * 6 });
    o.position.set(0, -100, 0); o.updateMatrix(); shards.setMatrixAt(i, o.matrix);
  }
  V3.shardT = performance.now();
}


/* ================= modern controls : free movement ================= */
/* James walks freely ; crossing into the next cell is still one step of the 1991 game (texts, encounters,
   deaths, hunger and thirst), and looking towards another direction shows that direction's view. */
const FREE = { enabled: false, keys: {}, drag: null, dragMoved: false, hold: 0, warnT: 0, lookD: -1, lookT: 0, crossing: false, pitch: 0, padPrev: [], contSent: false, since: 0 };
V3.free = FREE;
V3.isFree = () => FREE.enabled && V3.on && !!world && !!V3.supported[V3.world];
V3.setFree = on => { const was = FREE.enabled; FREE.enabled = !!on; if (was !== FREE.enabled) { V3.reset(); FREE.since = performance.now(); } };
V3.key = (k, down) => { FREE.keys[k.length === 1 ? k.toLowerCase() : k] = down; if (!down) FREE.contSent = false; };
const SOLID = { cilla: 2.0, dragon: 2.4, monster: 1.6, f49: 3.2, jeep: 2.6, car1: 2.2, car2: 2.2, car3: 2.2, car4: 2.2, car5: 2.2, vieil: 1.2, necarex: 1.6, oktar: 1.4 };
function blocked(x, z) { // push out of trunks, houses and wrecks ; people stand their ground too
  for (const o of OBST) { const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), r = o.r + 0.35; if (d < r && d > 1e-4) { x = o.x + dx / d * r; z = o.z + dz / d * r; } }
  Object.values(ACTORS).forEach(a => {
    if (!a.visible) return; const d0 = a.userData.def, r0 = SOLID[d0.id] || (d0.world && !d0.always && !d0.copies ? 0.7 : 0); if (!r0) return;
    const dx = x - a.position.x, dz = z - a.position.z, d = Math.hypot(dx, dz), r = r0 + 0.35; if (d < r && d > 1e-4) { x = a.position.x + dx / d * r; z = a.position.z + dz / d * r; }
  });
  return [x, z];
}
function tryMove(nx, nz, now, dt) {
  [nx, nz] = blocked(nx, nz);
  const c0 = curCell, c1 = cellAt(nx, nz);
  if (c1 === c0) { pose.x = nx; pose.z = nz; FREE.hold = 0; return; }
  if (c1 < 0) return;                                                     // the edge of the 1991 map
  const dc = c1 - c0, d = dc === 9 ? 0 : dc === -1 ? 1 : dc === -9 ? 2 : dc === 1 ? 3 : -1;
  if (d < 0) { if (cellAt(nx, pose.z) === c0) pose.x = nx; else if (cellAt(pose.x, nz) === c0) pose.z = nz; return; } // a corner : slide along
  if (world.bio.w === 3 && (ROOMS3[world.bio[c0]] || ROOMS3[world.bio[c1]])) { // walls : only through the doorway
    const lateral = d === 0 || d === 2 ? Math.abs(nx - cellX(c0)) : Math.abs(nz - cellZ(c0));
    if (lateral > 1.4) return;
  }
  const v = V3.viewOf ? V3.viewOf(V3.codeAt(d, c1)) : {};
  if (!v || v.death) { FREE.hold += dt; FREE.warnT = now; if (FREE.hold < 0.9) return; } // deadly : James stops at the edge unless one insists
  if (!V3.canWalk || !V3.canWalk() || FREE.crossing) return;
  pose.x = nx; pose.z = nz; FREE.hold = 0; FREE.crossing = true;
  V3.onWalk(d);
}
let bobPhase = 0;
function freeUpdate(dt, now) {
  const K = FREE.keys, can = V3.canWalk && V3.canWalk();
  let mz = 0, mx = 0, turn = 0, lx = 0, ly = 0;
  if (K.w || K.z || K.ArrowUp) mz += 1; if (K.s || K.ArrowDown) mz -= 1;
  if (K.a || K.q) mx -= 1; if (K.d) mx += 1;
  if (K.ArrowLeft) turn += 1; if (K.ArrowRight) turn -= 1;
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (gp) {
    const dz = v => (Math.abs(v) < 0.18 ? 0 : v);
    mx += dz(gp.axes[0] || 0); mz -= dz(gp.axes[1] || 0); lx = dz(gp.axes[2] || 0); ly = dz(gp.axes[3] || 0);
    [[0, 'D'], [1, 'C'], [2, 'P'], [3, 'EYE'], [9, 'continue']].forEach(([i, act]) => { const pr = !!(gp.buttons[i] && gp.buttons[i].pressed); if (pr && !FREE.padPrev[i] && V3.onAction) V3.onAction(act); FREE.padPrev[i] = pr; });
  }
  pose.yaw += (turn * 1.9 - lx * 2.4) * dt;
  FREE.pitch = Math.max(-0.9, Math.min(0.75, FREE.pitch - ly * 1.6 * dt));
  const moving = Math.hypot(mx, mz) > 0.05;
  if (moving && !can && V3.uiMode && V3.uiMode() === 'continue' && !FREE.contSent) { FREE.contSent = true; if (V3.onAction) V3.onAction('continue'); }
  let speed = 0;
  if (moving && (can || FREE.crossing)) {
    const l = Math.max(1, Math.hypot(mx, mz)), sp = (K.Shift ? 6.2 : 3.4) * dt;
    const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), rx = Math.cos(pose.yaw), rz = -Math.sin(pose.yaw);
    tryMove(pose.x + (fx * mz + rx * mx) / l * sp, pose.z + (fz * mz + rz * mx) / l * sp, now, dt);
    speed = sp / dt;
  } else FREE.hold = 0;
  bobPhase += speed * dt * 1.9;
  // looking towards another direction shows that direction's 1991 view (after a short steady look)
  const d = ((Math.round(pose.yaw / (Math.PI / 2)) % 4) + 4) % 4;
  if (can && d !== curDir && !FREE.crossing) { if (FREE.lookD !== d) { FREE.lookD = d; FREE.lookT = now; } else if (now - FREE.lookT > 380 && V3.onLook) { FREE.lookD = -1; V3.onLook(d); } }
  else FREE.lookD = -1;
  return Math.sin(bobPhase) * 0.05 * Math.min(1, speed / 3);
}
/* mouse or finger : drag on the picture to look around ; a click without dragging still clicks */
(function () {
  const cv = document.getElementById('screen'); if (!cv) return;
  const at = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * 640 / r.width, y: (e.clientY - r.top) * 400 / r.height }; };
  cv.addEventListener('pointerdown', e => { if (!V3.isFree()) return; const p = at(e); if (p.x < 8 || p.x > 472 || p.y < 28 || p.y > 314) return; FREE.drag = { x: e.clientX, y: e.clientY, moved: 0 }; });
  window.addEventListener('pointermove', e => {
    if (!FREE.drag) return; const dx = e.clientX - FREE.drag.x, dy = e.clientY - FREE.drag.y; FREE.drag.x = e.clientX; FREE.drag.y = e.clientY; FREE.drag.moved += Math.abs(dx) + Math.abs(dy);
    pose.yaw -= dx * 0.006; FREE.pitch = Math.max(-0.9, Math.min(0.75, FREE.pitch - dy * 0.004));
  });
  window.addEventListener('pointerup', () => { if (FREE.drag) { FREE.dragMoved = FREE.drag.moved > 6; FREE.drag = null; } });
})();
/* HUD drawn over the 3D picture : compass, sight, what one can do here */
V3.drawHud = function (ctx) {
  if (!V3.isFree()) return;
  const now = performance.now();
  ctx.save(); ctx.beginPath(); ctx.rect(8, 28, 464, 286); ctx.clip();
  ctx.fillStyle = 'rgba(10,14,28,0.45)'; ctx.fillRect(140, 30, 200, 16);
  ctx.font = '14px "VT323", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [['N', 0], ['O', Math.PI / 2], ['S', Math.PI], ['E', -Math.PI / 2], ['NO', Math.PI / 4], ['SO', 3 * Math.PI / 4], ['SE', -3 * Math.PI / 4], ['NE', -Math.PI / 4]].forEach(([t, a]) => {
    const df = shortest(0, a - pose.yaw); if (Math.abs(df) > 0.75) return;
    const x = 240 - df * 130; ctx.fillStyle = t.length === 1 ? (t === 'N' ? '#ffcf5a' : '#e8eefc') : 'rgba(200,210,230,0.6)'; ctx.fillText(t, x, 38);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(239, 170, 2, 2);
  let msg = '', col = '#f2f5ff';
  if (now - FREE.warnT < 250) { msg = 'DANGER : continuez pour avancer quand même'; col = '#ff7a6a'; }
  else if (V3.encounter && V3.encounter()) msg = 'E : parler     F : combattre';
  else if (now - FREE.since < 7000) msg = 'ZQSD / WASD : marcher   souris : regarder   Maj : courir';
  if (msg) { ctx.font = '16px "VT323", monospace'; const w = ctx.measureText(msg).width + 16; ctx.fillStyle = 'rgba(10,14,28,0.6)'; ctx.fillRect(240 - w / 2, 290, w, 18); ctx.fillStyle = col; ctx.fillText(msg, 240, 300); }
  ctx.restore();
};

/* ---------------- per frame ---------------- */
let lastT = performance.now();
V3.renderFrame = function () {
  if (!world) return false;
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  let bob = 0, drop = 0, pitch = 0, roll = 0;
  const free = V3.isFree();
  if (free && !(anim && anim.fall)) { bob = freeUpdate(dt, now); anim = null; }
  if (anim) {
    const k = Math.min(1, (now - anim.t0) / anim.dur), e = ease(k);
    if (anim.turn) {
      pose.yaw = anim.from.yaw + (anim.to.yaw - anim.from.yaw) * e;
      const c = anim.cell, fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw);
      pose.x = cellX(c) - fx * R; pose.z = cellZ(c) - fz * R;
    } else if (anim.fall) {
      const k1 = Math.min(1, k / 0.35), e1 = ease(k1);
      pose.x = anim.from.x + (anim.to.x - anim.from.x) * e1; pose.z = anim.from.z + (anim.to.z - anim.from.z) * e1; pose.yaw = anim.from.yaw + (anim.to.yaw - anim.from.yaw) * e1;
      const k2 = Math.max(0, (k - 0.3) / 0.7);
      if (V3.deathKind === 'sink') { drop = k2 * 2.3; pitch = k2 * 0.35; }            // swallowed by the quicksand
      else if (V3.deathKind === 'heat') { drop = ease(k2) * 1.45; pitch = -k2 * 0.25; roll = k2 * 0.9; } // collapses in the heat
      else if (V3.deathKind === 'floor') { drop = k2 * k2 * 9; pitch = -k2 * 0.7; roll = k2 * 0.3; } // the floor gives way
      else if (V3.deathKind === 'swept') { drop = k2 * 1.4; roll = Math.sin(k2 * 9) * 0.25; pose.x += dt * 4 * k2; }
      else { drop = k2 * k2 * 34; pitch = -k2 * 1.1; }
    } else {
      pose.x = anim.from.x + (anim.to.x - anim.from.x) * e; pose.z = anim.from.z + (anim.to.z - anim.from.z) * e; pose.yaw = anim.from.yaw + (anim.to.yaw - anim.from.yaw) * e;
      bob = Math.sin(k * Math.PI * 2) * 0.07;
    }
    if (k >= 1 && !anim.fall) anim = null;
    if (k >= 1 && anim && anim.fall && V3.deathKind === 'fall') { anim.hold = true; drop = 34; pitch = -1.1; }
  }
  if (!(anim && anim.fall) && V3.fullMask) { V3.fullMask = false; if (window.AliveV2) window.AliveV2.dirtyAll = true; }
  const hint = free ? { pitch: FREE.pitch, fwd: 0 } : V3.hint || { pitch: 0, fwd: 0 }, hk = Math.min(1, dt * (free ? 12 : 2.5));
  pose.pitch += (hint.pitch - pose.pitch) * hk; pose.fwd += (hint.fwd - pose.fwd) * hk;
  const px = pose.x - Math.sin(pose.yaw) * pose.fwd, pz = pose.z - Math.cos(pose.yaw) * pose.fwd;
  const gy = Math.max(heightAt(px, pz, world.bio), world.bio.w === 2 ? -0.42 : -1); // James wades, he does not dive
  pose.y += ((anim && anim.fall ? 0.4 : gy) - pose.y) * Math.min(1, dt * 10);
  camera.position.set(px, pose.y + EYE + bob - drop, pz);
  pitch += pose.pitch;
  let kick = 0; if (V3.kick && now - V3.kick < 300) kick = Math.sin((now - V3.kick) / 300 * Math.PI) * 0.06;
  camera.rotation.set(pitch - 0.05 + kick + Math.sin(now / 2300) * 0.006, pose.yaw + Math.sin(now / 3100) * 0.004, roll);
  const zone = updateAtmo(dt, V3.atmoSnap); V3.atmoSnap = false;
  waterTex.forEach((t, i) => { t.offset.y -= dt * (i === 0 && world.bio.w === 2 ? 0.35 : 0.02); t.offset.x += dt * 0.01; });

  // the dragon rises from the ice and sways
  const dr = ACTORS.dragon;
  hole.visible = !!(dr && dr.visible);
  if (dr && dr.visible) { // it bursts out of the ice in front of James and keeps facing him
    const k = Math.min(1, (now - (V3.dragonT || 0)) / 1300), d = dr.userData.def;
    if (!dr.userData.placed) dr.userData.fy = pose.yaw;
    const fyaw = V3.isFree() ? dr.userData.fy : pose.yaw; // free controls : it stays where it burst out
    const fx = -Math.sin(fyaw), fz = -Math.cos(fyaw), tx = cellX(d.cell) + fx * 5, tz = cellZ(d.cell) + fz * 5;
    if (!dr.userData.placed) { dr.position.x = tx; dr.position.z = tz; dr.userData.placed = true; }
    dr.position.x += (tx - dr.position.x) * Math.min(1, dt * 2); dr.position.z += (tz - dr.position.z) * Math.min(1, dt * 2);
    dr.position.y = -0.4 - (1 - ease(k)) * 11;
    const face = Math.atan2(pose.x - dr.position.x, pose.z - dr.position.z);
    dr.rotation.y = face + (d.yaw || 0) + Math.sin(now / 1400) * 0.12;
    dr.rotation.z = Math.sin(now / 1100) * 0.04;
    hole.position.set(dr.position.x, -0.08, dr.position.z);
  } else if (dr) dr.userData.placed = false;
  // living characters : vertex animation (dragon, horse and rider) and Meshy skeletal animation (guard)
  const ts = now / 1000;
  Object.values(ACTORS).forEach(a => {
    const u = a.userData.u; if (u) u.uTime.value = ts;
  });
  if (dr && dr.userData.serpent) {
    let l = 0;
    if (V3.lunge) { const e = (now - V3.lunge.t) / 900; l = e < 1 ? V3.lunge.a * Math.sin(Math.min(1, e * 2.2) * Math.PI) * (1 - e * 0.3) : 0; }
    updateSerpent(dr, now, l + Math.max(0, Math.sin(now / 1000 * 0.75)) ** 8 * 0.35);
  }
  if (dr && dr.userData.u) {
    const u = dr.userData.u; u.uAmp.value = 0.55;
    let l = 0;
    if (V3.lunge) { const e = (now - V3.lunge.t) / 900; l = e < 1 ? V3.lunge.a * Math.sin(Math.min(1, e * 2.2) * Math.PI) * (1 - e * 0.3) : 0; }
    const rear = Math.max(0, Math.sin(ts * 0.75)) ** 8 * 0.35; // now and then it rears up and strikes the air
    u.uLunge.value = l + rear;
  }
  if (ACTORS.cilla && ACTORS.cilla.userData.u) ACTORS.cilla.userData.u.uNod.value = Math.max(0, Math.sin(ts * 0.55)) ** 12 * (Math.sin(ts * 9) * 0.6 + 0.4);
  if (ACTORS.guard && world.bio.w === 1) updateGuard(ACTORS.guard, dt, now);
  // world II : rising from the ground, facing James, lunging in a fight
  let lw = 0; if (V3.lunge) { const e = (now - V3.lunge.t) / 900; lw = e < 1 ? V3.lunge.a * Math.sin(Math.min(1, e * 2.2) * Math.PI) * (1 - e * 0.3) : 0; }
  Object.values(ACTORS).forEach(a => {
    const d = a.userData.def; if (!d.world || !a.visible) return;
    if (d.rise && a.userData.riseT) { const k = Math.min(1, (now - a.userData.riseT) / 1100); a.position.y = a.userData.baseY - (1 - ease(k)) * d.rise; }
    if (d.march) { const my = a.userData.myaw != null ? a.userData.myaw : pose.yaw, ph = (now / 9000) % 1, fx = -Math.sin(my), fz = -Math.cos(my), sx = -fz, sz = fx; // the procession crosses the street in front of James
      const along = (ph - 0.5) * 14; a.position.x = cellX(d.cell) + fx * 2.5 + sx * along; a.position.z = cellZ(d.cell) + fz * 2.5 + sz * along; a.rotation.y = Math.atan2(sx, sz); a.position.y = Math.abs(Math.sin(now / 260)) * 0.05; }
    if (a.userData.flame) { const fl = a.userData.flame; fl.light.intensity = 1.2 + Math.sin(now / 90) * 0.15 + Math.sin(now / 37) * 0.1; fl.flame.scale.y = 1.6 + Math.sin(now / 70) * 0.25; }
    if (d.face) { const want = Math.atan2(pose.x - a.position.x, pose.z - a.position.z) + (d.yaw || 0); a.rotation.y += (shortest(a.rotation.y, want) - a.rotation.y) * Math.min(1, dt * 2.5); }
    const u = a.userData.u; if (u) { u.uLunge.value = lw; u.uAmp.value = d.id === 'hands' ? 0.6 : 0; }
  });
  const ci = ACTORS.cilla;
  if (ci && ci.visible) { const want = Math.atan2(pose.x - ci.position.x, pose.z - ci.position.z) + (ci.userData.def.yaw || 0); ci.rotation.y += (shortest(ci.rotation.y, want) - ci.rotation.y) * Math.min(1, dt * 3); }
  // ice shards
  if (shards.visible) {
    const o = new THREE.Object3D(), age = (now - V3.shardT) / 1000;
    shardV.forEach((s, i) => { s.vy -= 18 * dt; s.x += s.vx * dt; s.y = Math.max(-0.1, s.y + s.vy * dt); s.z += s.vz * dt; s.r += dt * 6; o.position.set(s.x, s.y, s.z); o.rotation.set(s.r, s.r * 0.7, 0); o.updateMatrix(); shards.setMatrixAt(i, o.matrix); });
    shards.instanceMatrix.needsUpdate = true; if (age > 4) shards.visible = false;
  }
  // snow (world I) or fireflies (world II marshes and jungle)
  snow.visible = world.bio.w === 1 || (world.bio.w === 3 && zone !== ATMO.indoor);
  snow.material.color.set(world.bio.w === 3 ? 0x8a8080 : 0xffffff); snow.material.opacity = world.bio.w === 3 ? 0.6 : 0.9;
  flies.visible = world.bio.w === 2;
  if (flies.visible) {
    flies.material.opacity += ((zone === ATMO.desert ? 0 : zone === ATMO.swamp ? 1 : 0.55) - flies.material.opacity) * Math.min(1, dt);
    for (let i = 0; i < FLY_N; i++) { const b = flyBase[i]; flyPos[i * 3] = b[0] + Math.sin(now / 1300 + b[3]) * 1.2; flyPos[i * 3 + 1] = b[1] + Math.sin(now / 900 + b[3] * 2) * 0.4; flyPos[i * 3 + 2] = b[2] + Math.cos(now / 1700 + b[3]) * 1.2; }
    flies.position.set(Math.round(camera.position.x / 20) * 20, 0, Math.round(camera.position.z / 20) * 20);
    flies.geometry.attributes.position.needsUpdate = true;
  }
  for (let i = 0; i < SNOW_N; i++) {
    let y = snowPos[i * 3 + 1] - snowSpd[i] * dt * (world.bio.w === 3 ? 0.35 : 1); if (y < camera.position.y - 6) y += 25;
    snowPos[i * 3 + 1] = y; snowPos[i * 3] += Math.sin(now / 1000 + i) * 0.004;
  }
  snow.position.set(Math.round(camera.position.x / 30) * 30, 0, Math.round(camera.position.z / 30) * 30);
  snow.geometry.attributes.position.needsUpdate = true;
  sun.target.position.set(camera.position.x, 0, camera.position.z); sun.position.set(camera.position.x - 70, 90, camera.position.z + 40); sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
  return true;
};
/* the 3D view is shown when V3 is on, the world is supported and the picture area still shows the view */
V3.active = function (screen) {
  return V3.on && !!world && V3.supported[V3.world] && (V3.fullMask || (V3.viewScene && screen.lastScene === V3.viewScene));
};

V3.debug = { heightAt: (x, z) => heightAt(x, z, world.bio), pose, camera, scene, snow, renderer, ACTORS, placeActor, bake, DEFAULT_MODELS, fetchModel };
loadModels(1);
V3.ready = true;
if (window.AliveV3Ready) window.AliveV3Ready();
