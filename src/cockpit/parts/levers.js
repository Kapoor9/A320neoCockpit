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
// Sculpted grip, swept along a curved spine. A320 sidestick form (measured from the reference):
// a slender neck (~3 cm) rising from the base and curving strongly forward (~6 cm) into a large
// rounded head (~5 cm long, ~4.5 cm wide) that points forward; the head ends in a rounded nose.
function gripGeometry() {
  // spine [t, y, z]  (z negative = forward)
  const spine = [[0, 0, 0], [0.3, 0.05, 0.002], [0.55, 0.086, -0.006], [0.72, 0.106, -0.024], [0.86, 0.114, -0.046], [1, 0.110, -0.068]];  // nose dips at the end
  const sm = (k) => k * k * (3 - 2 * k);
  const lerp = (t, arr, cols) => { for (let i = 1; i < arr.length; i++) if (t <= arr[i][0]) { const k = sm((t - arr[i - 1][0]) / (arr[i][0] - arr[i - 1][0])); return cols.map((c) => arr[i - 1][c] + (arr[i][c] - arr[i - 1][c]) * k); } return cols.map((c) => arr[arr.length - 1][c]); };
  // half-width (side to side) and half-thickness (perpendicular to the spine, in the y-z plane)
  const S = [[0, 0.0175, 0.0165], [0.15, 0.016, 0.015], [0.45, 0.0165, 0.0158], [0.62, 0.0195, 0.0185], [0.8, 0.0235, 0.022], [0.92, 0.021, 0.02], [1, 0.0165, 0.0175]];  // neck widens into the head, which tapers to the nose
  const rings = 64, seg = 48; const pos = []; const idx = [];
  const thumb = (t) => Math.max(0, Math.min(1, (t - 0.62) / 0.2));   // thumb shelf grows out on the inboard side of the head
  const frame = (t) => {
    const [y, z] = lerp(t, spine, [1, 2]);
    const [y2, z2] = lerp(Math.min(1, t + 0.008), spine, [1, 2]); const [y1, z1] = lerp(Math.max(0, t - 0.008), spine, [1, 2]);
    const l = Math.hypot(y2 - y1, z2 - z1); return { y, z, ty: (y2 - y1) / l, tz: (z2 - z1) / l };
  };
  const section = (t, scale = 1, adv = 0) => {
    const { y, z, ty, tz } = frame(t); const [w, d] = lerp(t, S, [1, 2]);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2; const cx = Math.cos(a), cn = Math.sin(a);
      const head = Math.max(0, Math.min(1, (t - 0.6) / 0.2));
      const ex = cn > 0 ? 0.85 - 0.4 * head : 0.85;   // the top of the head is flatter (pad seat)
      const sx = Math.sign(cx) * Math.pow(Math.abs(cx), ex), sn = Math.sign(cn) * Math.pow(Math.abs(cn), ex);
      // normal in the y-z plane, perpendicular to the spine: (-tz, ty) points up/back on the curve
      let rn = sn * d; if (cn < 0 && t > 0.62) rn *= 1 - 0.3 * head * Math.pow(-cn, 2);   // hollowed underside of the head
      const inb = cx > 0 ? 1 + 0.45 * thumb(t) * Math.pow(cx, 1.5) : 1;   // +x = inboard for the captain's stick
      const px = (sx * w * inb + 0.004 * thumb(t)) * scale, pn = rn * scale;
      pos.push(px, y + (-tz) * pn + ty * adv, z + ty * pn + tz * adv);
    }
  };
  for (let i = 0; i <= rings; i++) section(i / rings);
  // rounded nose: sections shrink while advancing along the spine direction
  const caps = 9, noseLen = 0.017;
  for (let r = 1; r <= caps; r++) { const k = r / caps; section(1, Math.cos(k * Math.PI / 2) * 0.999 + 0.001, Math.sin(k * Math.PI / 2) * noseLen); }
  const total = rings + caps;
  for (let i = 0; i < total; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + (j + 1) % seg, c = (i + 1) * seg + (j + 1) % seg, d = (i + 1) * seg + j;
    idx.push(a, d, b, b, d, c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function makeSidestick(M, side = -1) {
  const g = new THREE.Group();
  // base: five thin square plates, widely spaced and widening downwards (rubber gaiter), with a collar on top
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x5f676c, roughness: 0.8 });
  const sizes = [0.13, 0.112, 0.094, 0.077, 0.06];
  const core = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.04, 24), M.rubber)); core.position.y = 0.02; g.add(core);
  let yy = 0; sizes.forEach((w) => { const p = rbox(w, 0.004, w, 0.003, plateMat); p.position.y = yy + 0.002; g.add(p); yy += 0.0085; });
  const top = rbox(0.046, 0.004, 0.046, 0.002, M.rubber); top.position.y = yy + 0.002; g.add(top); yy += 0.004;
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.55 });
  const grip = shade(new THREE.Mesh(gripGeometry(), gripMat)); grip.position.y = yy; g.add(grip);
  // find surface points on the head to mount the button and the pad exactly on the grip
  const gp = grip.geometry.attributes.position, gn = grip.geometry.attributes.normal;
  let inb = null, topP = null; const vtx = new THREE.Vector3();
  for (let i = 0; i < gp.count; i++) {
    vtx.fromBufferAttribute(gp, i);
    const score = vtx.y + 0.45 * (-side * vtx.x);   // high up, leaning to the inboard edge
    if (vtx.z < -0.05 && vtx.z > -0.066 && (!inb || score > inb.s)) inb = { s: score, p: vtx.clone(), n: new THREE.Vector3().fromBufferAttribute(gn, i) };
    if (vtx.z < -0.035 && vtx.z > -0.06 && (!topP || vtx.y > topP.p.y)) topP = { p: vtx.clone(), n: new THREE.Vector3().fromBufferAttribute(gn, i) };
  }
  const btnMat = new THREE.MeshStandardMaterial({ color: 0xc0281e, roughness: 0.4 });
  const btn = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 28), btnMat));
  btn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inb.n.clone().normalize());
  btn.position.copy(inb.p).addScaledVector(inb.n, 0.0015); btn.position.y += yy; g.add(btn);
  const pad = rbox(0.026, 0.005, 0.026, 0.005, gripMat);
  const up = topP.n.clone().normalize(); pad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up); pad.rotateY(Math.PI / 4);
  pad.position.copy(topP.p).addScaledVector(up, -0.0012); pad.position.y += yy; g.add(pad);   // seated into the top
  for (const k of [-1, 1]) {
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.001, 10), M.screw);
    sc.quaternion.copy(pad.quaternion); sc.position.copy(pad.position).addScaledVector(up, 0.0027).add(new THREE.Vector3(0, 0, k * 0.008).applyQuaternion(pad.quaternion)); g.add(sc);
  }
  // radio transmit trigger under the head, for the index finger
  const trig = rbox(0.012, 0.012, 0.014, 0.004, gripMat); trig.position.set(0, yy + 0.098, -0.05); trig.rotation.x = -0.5; g.add(trig);
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
  // measured: the lever gates are a tight drum, radius ~7.8 cm about a pivot at deck level, top ~9.5 cm up
  const pivotZ = 0.0, armLen = 0.125, A0 = -1.35, A1 = 1.35;
  // central housing with two curved lever slots
  const base = rbox(0.16, 0.26, 0.012, 0.004, M.panelDark); base.position.set(0, 0.04, 0.0); g.add(base);
  // raised centre divider between the two lever tracks
  const divShape = new THREE.Shape(); divShape.moveTo(0, 0);
  for (let i = 0; i <= 32; i++) { const a = A0 + (A1 - A0) * (i / 32); divShape.lineTo(Math.sin(a) * (armLen - 0.03), Math.cos(a) * (armLen - 0.03) + pivotZ); }
  divShape.lineTo(Math.sin(A1) * (armLen - 0.03), pivotZ); divShape.lineTo(Math.sin(A0) * (armLen - 0.03), pivotZ); divShape.closePath();
  const div = shade(new THREE.Mesh(new THREE.ExtrudeGeometry(divShape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelOffset: -0.002, bevelSegments: 2 }).rotateY(Math.PI / 2), M.module));
  div.position.x = -0.01; g.add(div);
  // curved top over which the levers travel (a cylinder segment)
  const rArc = armLen - 0.047, a0 = A0, a1 = A1;
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
    sh.lineTo(Math.sin(a1) * rArc, pivotZ); sh.lineTo(Math.sin(a0) * rArc, pivotZ); sh.closePath();
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
    const arm = rbox(0.008, 0.012, armLen, 0.003, M.metal); arm.position.set(0, 0, armLen / 2); arm.rotation.x = 0; pivot.add(arm);
    // handle: a broad rounded paddle; the two meet in the middle to form one bar
    const handle = rbox(0.05, 0.03, 0.026, 0.012, M.rubber); handle.position.set(s * 0.017, 0.003, armLen + 0.008); pivot.add(handle);
    const grip = rbox(0.05, 0.012, 0.012, 0.005, M.panelDark); grip.position.set(s * 0.017, 0.017, armLen + 0.004); pivot.add(grip);
    const face = rbox(0.044, 0.005, 0.02, 0.002, M.panelDark); face.position.set(s * 0.017, -0.014, armLen + 0.008); pivot.add(face);
    // A/THR instinctive disconnect pushbutton on the outboard side
    const b = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 20).rotateZ(Math.PI / 2), btnMat));
    b.position.set(s * 0.043, 0.003, armLen + 0.008); pivot.add(b);
    // reverse thrust latch lever in front of the handle
    const latch = rbox(0.028, 0.006, 0.018, 0.0025, M.metal); latch.position.set(s * 0.012, 0.02, armLen - 0.012); latch.rotation.x = 0.5; pivot.add(latch);
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
