// Sidestick, thrust quadrant and pitch trim wheels, modelled to the A320's shapes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

const rbox = (w, h, d, r, mat) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.98), mat); m.castShadow = true; m.receiveShadow = true; return m; };
const shade = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
// A curved strip: points at angle a (forward of vertical) on radius r about a pivot on the x axis.
function curvedStrip(x0, x1, r, a0, a1, pivotZ, seg = 48) {
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (a1 - a0) * (i / seg);
    for (const [j, x] of [[0, x0], [1, x1]]) { pos.push(x, Math.sin(a) * r, pivotZ + Math.cos(a) * r); uv.push(j, i / seg); }
    if (i < seg) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// ------------------------------------------------------------------ sidestick
// Ergonomic grip leaning forward, flattened at the sides, flared under the palm, domed top
// with the red takeover pushbutton under the thumb and the radio trigger at the front.
// Built for the captain (left console); side = +1 mirrors it for the first officer.
// Sculpted grip: an oval cross-section swept along a curved spine.
// Narrow round-ish shaft at the bottom, widening into a broad paddle-shaped head that bends
// forward like a beak; flattened palm side at the back; light finger grooves at the front.
function gripGeometry() {
  const spine = [[0, 0, 0], [0.25, 0.031, 0.003], [0.5, 0.061, 0.004], [0.7, 0.083, 0.0], [0.85, 0.096, -0.009], [1, 0.104, -0.021]];
  const lerpSpine = (t) => { for (let i = 1; i < spine.length; i++) if (t <= spine[i][0]) { const [t0, y0, z0] = spine[i - 1], [t1, y1, z1] = spine[i]; const k = (t - t0) / (t1 - t0); const e = k * k * (3 - 2 * k); return [y0 + (y1 - y0) * e, z0 + (z1 - z0) * e]; } return spine[spine.length - 1].slice(1); };
  const key = (t, arr) => { for (let i = 1; i < arr.length; i++) if (t <= arr[i][0]) { const k = (t - arr[i - 1][0]) / (arr[i][0] - arr[i - 1][0]); const e = k * k * (3 - 2 * k); return arr[i - 1][1] + (arr[i][1] - arr[i - 1][1]) * e; } return arr[arr.length - 1][1]; };
  const W = [[0, 0.0172], [0.45, 0.0178], [0.65, 0.0195], [0.85, 0.0238], [1, 0.0222]];  // half-width (side to side): chunky, no waist
  const Dp = [[0, 0.0182], [0.45, 0.019], [0.65, 0.0195], [0.85, 0.0208], [1, 0.0198]]; // half-depth (front to back)
  const rings = 56, seg = 48; const pos = []; const idx = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings; const [y, z] = lerpSpine(t);
    const [y2, z2] = lerpSpine(Math.min(1, t + 0.01)); const [y1, z1] = lerpSpine(Math.max(0, t - 0.01));
    const ty = y2 - y1, tz = z2 - z1, tl = Math.hypot(ty, tz);   // spine direction: each section tilts with it
    const w = key(t, W), d = key(t, Dp);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2; const cx = Math.cos(a), cz = Math.sin(a);   // cz>0: back (palm), cz<0: front (fingers)
      const sx = Math.sign(cx) * Math.pow(Math.abs(cx), 0.8), sz = Math.sign(cz) * Math.pow(Math.abs(cz), 0.8);   // squarer oval
      let rz = sz * d;
      // palm side flattened smoothly (no bands): strongest around the hand, fading out at both ends
      if (cz > 0) { const b = Math.max(0, Math.sin(Math.min(1, Math.max(0, (t - 0.3) / 0.65)) * Math.PI)); rz *= 1 - 0.14 * b * b * cz; }
      // place the point off the spine, perpendicular to it, so each section follows the bend
      pos.push(sx * w, y - rz * (tz / tl), z + rz * (ty / tl));
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + (j + 1) % seg, c = (i + 1) * seg + (j + 1) % seg, d = (i + 1) * seg + j;
    idx.push(a, d, b, b, d, c);
  }
  // domed top cap, sloping up towards the front (the "beak")
  const top = rings * seg; const [yt, zt] = lerpSpine(1); const capRings = 7;
  let prevStart = top;
  for (let r = 1; r <= capRings; r++) {
    const k = r / capRings; const s = Math.cos(k * Math.PI / 2); const lift = Math.sin(k * Math.PI / 2) * 0.0075;   // flatter top
    const start = pos.length / 3;
    for (let j = 0; j < seg; j++) {
      const base = top + j; const bx = pos[base * 3], by = pos[base * 3 + 1], bz = pos[base * 3 + 2];
      const fwd = -(bz - zt);                                  // >0 at the front
      pos.push(bx * s, yt + (by - yt) * s + lift + fwd * 0.26 * k, zt + (bz - zt) * s);
    }
    for (let j = 0; j < seg; j++) { const a = prevStart + j, b = prevStart + (j + 1) % seg, c = start + (j + 1) % seg, d = start + j; idx.push(a, d, b, b, d, c); }
    prevStart = start;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function makeSidestick(M, side = -1) {
  const g = new THREE.Group();
  // grey stepped base with a flat black square plate on top, as on the A320
  const gaiterMat = new THREE.MeshStandardMaterial({ color: 0x8e979c, roughness: 0.85 });
  const steps = [[0.13, 0.010, M.panelDark], [0.112, 0.011, gaiterMat], [0.096, 0.011, gaiterMat], [0.082, 0.010, gaiterMat]];
  let yy = 0; for (const [w, h, m] of steps) { const s = rbox(w, h, w, Math.min(0.012, w * 0.15), m); s.position.y = yy + h / 2; g.add(s); yy += h - 0.001; }
  const plate = rbox(0.064, 0.009, 0.064, 0.004, M.rubber); plate.position.y = yy + 0.0045; g.add(plate); yy += 0.008;
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.55 });
  const grip = shade(new THREE.Mesh(gripGeometry(), gripMat)); grip.position.y = yy; g.add(grip);
  // red takeover / AP disconnect button on the top-front edge of the head (thumb side, inboard)
  const btnMat = new THREE.MeshStandardMaterial({ color: 0xc0281e, roughness: 0.4 });
  // small, nearly flush disc: only ~2 mm proud of the grip surface
  const btn = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.004, 28), btnMat));
  btn.position.set(-side * 0.0105, yy + 0.1095, -0.031); btn.rotation.set(-0.6, 0, side * 0.35); g.add(btn);
  // radio transmit trigger at the front, under the index finger
  const trig = rbox(0.013, 0.016, 0.008, 0.003, gripMat); trig.position.set(0, yy + 0.065, -0.025); trig.rotation.x = 0.3; g.add(trig);
  g.userData.button = btn;
  return g;
}

// Nosewheel steering tiller: round base with a handle pointing forward and a grip knob at its end
export function makeTiller(M) {
  const g = new THREE.Group();
  const base = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.006, 48), M.metal)); base.position.y = 0.003; g.add(base);
  const hub = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.018, 32), M.rubber)); hub.position.y = 0.014; g.add(hub);
  // curved loop handle lying almost flat, open towards the pilot
  const loop = shade(new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0075, 14, 48, Math.PI * 1.15), M.rubber));
  loop.rotation.set(-Math.PI / 2 + 0.12, 0, Math.PI * 0.43); loop.position.set(0, 0.024, -0.018); g.add(loop);
  const knob = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.008, 0.022, 20), M.rubber)); knob.position.set(0.0, 0.034, -0.054); g.add(knob);
  return g;
}

// ------------------------------------------------------------------ thrust quadrant
// Local frame: +x right, +y forward, +z up (the pedestal's flat panel frame).
// Lever angles in degrees forward of vertical. A320 detents: REV, IDLE, CL, FLX/MCT, TOGA.
export const DETENT_DEG = { REV: -14, IDLE: 0, N45: 11, CL: 22, FLX: 33, TOGA: 45 };
export function makeThrustQuadrant(M, atlas) {
  const g = new THREE.Group();
  const pivotZ = -0.14, armLen = 0.255;   // arc top ~9 cm above the pedestal
  // central housing with two curved lever slots
  const base = rbox(0.16, 0.26, 0.012, 0.004, M.panelDark); base.position.set(0, 0.04, 0.0); g.add(base);
  // raised centre divider between the two lever tracks
  const divShape = new THREE.Shape(); divShape.moveTo(0, 0);
  for (let i = 0; i <= 24; i++) { const a = -0.42 + 1.37 * (i / 24); divShape.lineTo(Math.sin(a) * (armLen - 0.035), Math.cos(a) * (armLen - 0.035) + pivotZ); }
  divShape.lineTo(Math.sin(0.95) * (armLen - 0.035), pivotZ + 0.02); divShape.lineTo(Math.sin(-0.42) * (armLen - 0.035), pivotZ + 0.02); divShape.closePath();
  const div = shade(new THREE.Mesh(new THREE.ExtrudeGeometry(divShape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelOffset: -0.002, bevelSegments: 2 }).rotateY(Math.PI / 2), M.module));
  div.position.x = -0.01; g.add(div);
  // curved top over which the levers travel (a cylinder segment)
  const rArc = armLen - 0.045, a0 = -0.42, a1 = 0.95;
  const arcMat = M.module.clone(); arcMat.side = THREE.DoubleSide;
  // the arc surface, interrupted by the two lever slots
  const edges = [-0.074, -0.0335, -0.0225, 0.0225, 0.0335, 0.074];
  // printed scale: graduations, green A/THR arc (IDLE..CL), yellow/black hatched reverse zone
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 1024; const c = cv.getContext('2d');
  c.fillStyle = '#5b676f'; c.fillRect(0, 0, 128, 1024);
  const vOf = (deg) => (THREE.MathUtils.degToRad(deg) - a0) / (a1 - a0);           // 0..1 along the arc
  const yOf = (deg) => (1 - vOf(deg)) * 1024;
  c.fillStyle = '#c9a83a';
  for (let y = yOf(DETENT_DEG.IDLE - 2); y < 1024; y += 22) { c.save(); c.beginPath(); c.rect(70, yOf(DETENT_DEG.IDLE - 2), 52, 1024); c.clip(); c.translate(70, y); c.rotate(-0.6); c.fillRect(-20, 0, 120, 9); c.restore(); }
  c.fillStyle = '#4f9a5c'; c.fillRect(72, yOf(DETENT_DEG.CL), 10, yOf(DETENT_DEG.IDLE) - yOf(DETENT_DEG.CL));
  c.fillStyle = '#e8ebe6';
  for (let d = -12; d <= 46; d += 2) { const y = yOf(d); c.fillRect(d % 10 === 0 ? 30 : 44, y - 1.5, d % 10 === 0 ? 34 : 20, 3); }
  const scaleTex = new THREE.CanvasTexture(cv); scaleTex.colorSpace = THREE.SRGBColorSpace; scaleTex.anisotropy = 8;
  const scaleMat = new THREE.MeshStandardMaterial({ map: scaleTex, roughness: 0.6, side: THREE.DoubleSide });
  for (let k = 0; k < edges.length; k += 2) {
    const outer = k !== 2; const geo = curvedStrip(edges[k], edges[k + 1], rArc, a0, a1, pivotZ);
    if (outer && edges[k] > 0) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    g.add(shade(new THREE.Mesh(geo, outer ? scaleMat : arcMat)));
  }
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 1, side: THREE.DoubleSide });
  for (const x of [-0.028, 0.028]) g.add(new THREE.Mesh(curvedStrip(x - 0.0055, x + 0.0055, rArc - 0.012, a0, a1, pivotZ), slotMat));
  // side cheeks of the quadrant
  for (const x of [-0.074, 0.074]) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0);
    for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * (i / 24); sh.lineTo(Math.sin(a) * rArc, Math.cos(a) * rArc + pivotZ); }
    sh.lineTo(Math.sin(a1) * rArc, pivotZ + 0.02); sh.lineTo(Math.sin(a0) * rArc, pivotZ + 0.02); sh.closePath();
    const cheek = shade(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false }).rotateY(Math.PI / 2), M.panelDark));
    cheek.position.x = x - 0.003; g.add(cheek);
  }
  // detent scale on the arc's outer edges, with white index lines
  const tickMat = new THREE.MeshStandardMaterial({ color: 0xe8ebe6, roughness: 0.6 });
  const names = [['TOGA', 'TO\nGA'], ['FLX', 'FLX\nMCT'], ['CL', 'CL'], ['IDLE', '0'], ['REV', 'REV']];
  for (const s of [-1, 1]) {
    for (const [k, txt] of names) {
      const a = THREE.MathUtils.degToRad(DETENT_DEG[k]);
      const r = armLen - 0.044;
      const y = Math.sin(a) * r, z = pivotZ + Math.cos(a) * r;
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.0016), tickMat);
      tick.position.set(s * 0.064, y, z + 0.0007); tick.rotation.x = -a; g.add(tick);
      if (k === 'REV') continue;
      const lab = atlas.mesh(txt.split('\n'), 0.013, { px: 34, weight: 600 }, 0.022);
      lab.position.set(s * 0.047, y, z + 0.0009); lab.rotation.x = -a; g.add(lab);
    }
  }
  // the two levers
  const levers = [];
  const btnMat = new THREE.MeshStandardMaterial({ color: 0x9a2b22, roughness: 0.45 });
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.028, 0, pivotZ); g.add(pivot);
    const arm = rbox(0.009, 0.014, armLen, 0.003, M.metal); arm.position.set(0, 0, armLen / 2); arm.rotation.x = 0; pivot.add(arm);
    // handle: a broad rounded paddle; the two meet in the middle to form one bar
    const handle = rbox(0.052, 0.034, 0.03, 0.013, M.rubber); handle.position.set(s * 0.018, 0.004, armLen + 0.006); pivot.add(handle);
    const face = rbox(0.046, 0.006, 0.024, 0.003, M.panelDark); face.position.set(s * 0.018, -0.016, armLen + 0.006); pivot.add(face);
    // A/THR instinctive disconnect pushbutton on the outboard side
    const b = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 20).rotateZ(Math.PI / 2), btnMat));
    b.position.set(s * 0.045, 0.004, armLen + 0.006); pivot.add(b);
    // reverse thrust latch lever in front of the handle
    const latch = rbox(0.03, 0.008, 0.02, 0.003, M.metal); latch.position.set(s * 0.012, 0.022, armLen - 0.014); latch.rotation.x = 0.5; pivot.add(latch);
    pivot.rotation.x = 0; levers.push(pivot);
  }
  const set = (deg) => levers.forEach((l) => (l.rotation.x = -THREE.MathUtils.degToRad(deg)));
  set(DETENT_DEG.IDLE);
  return { group: g, levers, set };
}

// ------------------------------------------------------------------ pitch trim wheel
// Large black wheel, half set into the pedestal side, white index marks on the rim.
export function makeTrimWheel(M, side = -1) {
  // A rounded rim (like a thick ring) with wide white bands; the web is set back inside the pedestal.
  const g = new THREE.Group();
  const R = 0.162, tube = 0.0135;
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1e20, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe9ebe6, roughness: 0.55 });
  const rim = shade(new THREE.Mesh(new THREE.TorusGeometry(R, tube, 20, 160).rotateY(Math.PI / 2), black)); g.add(rim);
  for (let k = 0; k < 8; k++) {
    const band = shade(new THREE.Mesh(new THREE.TorusGeometry(R, tube + 0.0004, 20, 24, 0.36).rotateY(Math.PI / 2), white));
    band.rotation.x = (k / 8) * Math.PI * 2; g.add(band);
  }
  const web = shade(new THREE.Mesh(new THREE.CylinderGeometry(R - tube * 0.6, R - tube * 0.6, 0.008, 96).rotateZ(Math.PI / 2), black)); web.position.x = -side * 0.004; g.add(web);
  g.userData.radius = R;
  return g;
}

// Pitch trim scale beside the wheel: UP/DN and a pointer
export function makeTrimScale(M, atlas) {
  const g = new THREE.Group();
  const plate = rbox(0.03, 0.075, 0.006, 0.003, M.panelDark); g.add(plate);
  const lab = atlas.mesh(['UP', '', '0', '', 'DN'], 0.06, { px: 28, weight: 600 }, 0.016); lab.position.set(-0.004, 0, 0.0035); g.add(lab);
  const ptr = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.0025), new THREE.MeshStandardMaterial({ color: 0xe6e8e3 })); ptr.position.set(0.009, 0.006, 0.0036); g.add(ptr);
  return g;
}
