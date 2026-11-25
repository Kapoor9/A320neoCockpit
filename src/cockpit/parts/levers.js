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
export function makeSidestick(M, side = -1) {
  const g = new THREE.Group();
  // base: square trim plate with a ribbed rubber bellows
  const plate = rbox(0.105, 0.008, 0.105, 0.004, M.panelDark); plate.position.y = 0.004; g.add(plate);
  const bellowsPts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; bellowsPts.push(new THREE.Vector2(0.034 - 0.012 * t + 0.0022 * Math.sin(t * Math.PI * 8), 0.008 + t * 0.04)); }
  const bellows = shade(new THREE.Mesh(new THREE.LatheGeometry(bellowsPts, 40), M.rubber)); g.add(bellows);

  // grip: a lathe profile, then bent forward and shaped
  const prof = [];
  const R = (h) => {            // radius along the height (0..1)
    if (h < 0.08) return 0.023 + h * 0.03;
    if (h < 0.55) return 0.0255 + Math.sin((h - 0.08) / 0.47 * Math.PI) * 0.004;   // palm swell
    if (h < 0.82) return 0.0255 + (h - 0.55) * 0.03;
    const t = (h - 0.82) / 0.18; return (0.0336) * Math.sqrt(Math.max(0, 1 - t * t)) + 0.0005;   // fuller domed head
  };
  for (let i = 0; i <= 40; i++) { const h = i / 40; prof.push(new THREE.Vector2(R(h), h * 0.135)); }
  const geo = new THREE.LatheGeometry(prof, 48);
  const p = geo.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const h = v.y / 0.135;
    v.x *= 0.86;                                   // flatter sides
    if (v.z > 0) v.z *= 1.0 + 0.18 * Math.sin(h * Math.PI);   // fuller at the back, under the palm
    v.z -= Math.pow(h, 1.6) * 0.022;               // leans forward
    v.y += 0.046;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const grip = shade(new THREE.Mesh(geo, M.rubber)); g.add(grip);
  // takeover / AP disconnect pushbutton (red), on the inboard top edge under the thumb
  const btnMat = new THREE.MeshStandardMaterial({ color: 0x9a2b22, roughness: 0.45 });
  const btn = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.006, 24), btnMat));
  btn.position.set(-side * 0.014, 0.178, -0.02); btn.rotation.z = side * 0.45; g.add(btn);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0068, 0.0012, 8, 24), M.metal);
  ring.position.copy(btn.position); ring.rotation.set(Math.PI / 2, 0, side * 0.55); ring.translateZ(0); g.add(ring);
  // radio transmit trigger at the front (index finger)
  const trig = rbox(0.016, 0.022, 0.01, 0.004, M.panelDark); trig.position.set(0, 0.14, -0.036); trig.rotation.x = 0.35; g.add(trig);
  g.userData.button = btn;
  return g;
}

// ------------------------------------------------------------------ thrust quadrant
// Local frame: +x right, +y forward, +z up (the pedestal's flat panel frame).
// Lever angles in degrees forward of vertical. A320 detents: REV, IDLE, CL, FLX/MCT, TOGA.
export const DETENT_DEG = { REV: -14, IDLE: 0, N45: 11, CL: 22, FLX: 33, TOGA: 45 };
export function makeThrustQuadrant(M, atlas) {
  const g = new THREE.Group();
  const pivotZ = -0.14, armLen = 0.255;
  // central housing with two curved lever slots
  const base = rbox(0.18, 0.24, 0.012, 0.004, M.panelDark); base.position.set(0, 0.04, 0.0); g.add(base);
  // curved top over which the levers travel (a cylinder segment)
  const rArc = armLen - 0.045, a0 = -0.42, a1 = 0.95;
  const arcMat = M.module.clone(); arcMat.side = THREE.DoubleSide;
  // the arc surface, interrupted by the two lever slots
  const edges = [-0.085, -0.0335, -0.0225, 0.0225, 0.0335, 0.085];
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
  for (const x of [-0.085, 0.085]) {
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
      tick.position.set(s * 0.074, y, z + 0.0007); tick.rotation.x = -a; g.add(tick);
      if (k === 'REV') continue;
      const lab = atlas.mesh(txt.split('\n'), 0.013, { px: 34, weight: 600 }, 0.022);
      lab.position.set(s * 0.053, y, z + 0.0009); lab.rotation.x = -a; g.add(lab);
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
  const g = new THREE.Group();
  const R = 0.15, T = 0.03;
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1d2022, roughness: 0.75 });
  const rim = shade(new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, 96).rotateZ(Math.PI / 2), wheelMat)); g.add(rim);
  // grip ridges around the rim
  const ridge = new THREE.BoxGeometry(T * 1.04, 0.006, 0.010);
  const im = new THREE.InstancedMesh(ridge, wheelMat, 72); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2; e.set(a, 0, 0); q.setFromEuler(e); m.compose(new THREE.Vector3(0, Math.cos(a) * R, Math.sin(a) * R), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m); }
  im.castShadow = true; g.add(im);
  // white painted index marks (three bands), so movement is visible at a glance
  const white = new THREE.MeshStandardMaterial({ color: 0xe6e8e3, roughness: 0.6 });
  for (let k = 0; k < 8; k++) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.0012, R + 0.0012, T * 1.02, 16, 1, true, (k / 8) * Math.PI * 2, 0.36).rotateZ(Math.PI / 2), white);
    g.add(band);
    for (const f of [-1, 1]) {   // the white blocks wrap onto both faces of the rim
      const face = new THREE.Mesh(new THREE.RingGeometry(R - 0.018, R + 0.001, 12, 1, (k / 8) * Math.PI * 2, 0.36), white);
      face.rotation.y = f * Math.PI / 2; face.position.x = f * (T / 2 + 0.0008); if (f < 0) face.scale.x = -1; g.add(face);
    }
  }
  // hub on the outer face
  const hub = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, T + 0.004, 32).rotateZ(Math.PI / 2), M.panelDark)); g.add(hub);
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
