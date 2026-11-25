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
  // Proportions (from the measured reference): ~18 cm tall overall; ribbed boot ~10 cm wide at the
  // base and 6 cm tall; 3 cm shaft; rounded head ~5 cm wide; red takeover button on the inboard side.
  const g = new THREE.Group();
  // square, stepped rubber gaiter (light grey), as on the A320
  const gaiterMat = new THREE.MeshStandardMaterial({ color: 0x8e979c, roughness: 0.85 });
  const steps = [[0.13, 0.010], [0.112, 0.012], [0.094, 0.012], [0.076, 0.012], [0.058, 0.012], [0.04, 0.014]];
  let yy = 0; steps.forEach(([w, h], i) => { const s = rbox(w, h, w, Math.min(0.012, w * 0.18), i === 0 ? M.panelDark : gaiterMat); s.position.y = yy + h / 2; g.add(s); yy += h - 0.001; });
  // grip: shaft into a rounded head, leaning forward
  const H = 0.115, y0 = 0.062;
  const R = (h) => {
    if (h < 0.06) return 0.0125 + h * 0.03;
    if (h < 0.48) return 0.0145 + (h - 0.06) * 0.006;            // shaft
    if (h < 0.62) { const k = (h - 0.48) / 0.14; return 0.017 + k * k * 0.008; }   // flares into the head
    const k = (h - 0.62) / 0.38; return 0.0255 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, k - 0.25) / 0.75, 2))) + 0.0003; // rounded head
  };
  const prof = []; for (let i = 0; i <= 60; i++) { const h = i / 60; prof.push(new THREE.Vector2(R(h), h * H)); }
  const geo = new THREE.LatheGeometry(prof, 56); const p = geo.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const h = v.y / H;
    v.x *= h > 0.55 ? 0.94 : 0.9;                                   // slightly flattened sides
    v.z *= h > 0.55 ? 1.12 : 1.0;                                   // head longer front-to-back
    v.z -= 0.022 * Math.sin(Math.min(1, h / 0.7) * Math.PI / 2);   // neck bends forward...
    if (h > 0.62) v.z += (h - 0.62) * 0.03;                         // ...and the head tilts back (S-curve)
    v.y += y0; p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  g.add(shade(new THREE.Mesh(geo, M.rubber)));
  // red takeover / AP disconnect button on the inboard upper side of the head
  const btnMat = new THREE.MeshStandardMaterial({ color: 0xb0281f, roughness: 0.4 });
  const btn = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.0058, 0.0058, 0.006, 24), btnMat));
  btn.rotation.z = side * Math.PI / 2 * 0.85; btn.position.set(-side * 0.0228, y0 + H * 0.8, -0.011); g.add(btn);
  // radio transmit trigger on the front of the shaft
  const trig = rbox(0.012, 0.022, 0.008, 0.003, M.panelDark); trig.position.set(0, y0 + H * 0.5, -0.019); trig.rotation.x = 0.25; g.add(trig);
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
