// Generic Airbus system panel: a painted face (legends, outlines and guide lines drawn
// in white, like real engraved/backlit panel art) with 3D controls mounted on it.
// Units: metres. Panel built facing +Z with its centre at the origin, +Y = top as read.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { FONT_PANEL } from '../labels.js';
import { addGrain } from '../surface.js';

const PX_PER_M = 2600;
const rbox = (w, h, d, r, mat) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.98), mat); m.castShadow = true; m.receiveShadow = true; return m; };

// spec: { w, h, title?, items: [...] }
// item types:
//   { t:'text', x, y, s:'LABEL', size=0.006, align='center', weight=600 }
//   { t:'line', pts:[[x,y],...], w=0.0006 }           (white guide line)
//   { t:'box', x, y, w, h }                              (white outline)
//   { t:'knob', x, y, r=0.011, pointer=true, id }      (rotary selector)
//   { t:'pb', x, y, w=0.017, h=0.017, legends:[top,bottom], id }  (Korry pushbutton)
//   { t:'key', x, y, w, h, s, id }                      (labelled key, e.g. ECAM CP)
//   { t:'toggle', x, y, id, guard=false }               (toggle switch)
//   { t:'screw' }  corners are automatic
export function buildPanel(spec, M, atlas) {
  const { w, h } = spec;
  const g = new THREE.Group(); g.name = spec.name || 'panel';
  // painted face
  const cw = Math.round(w * PX_PER_M), ch = Math.round(h * PX_PER_M);
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const c = cv.getContext('2d');
  c.fillStyle = spec.bg || '#5b676f'; c.fillRect(0, 0, cw, ch);
  const P = (x, y) => [(x + w / 2) * PX_PER_M, (h / 2 - y) * PX_PER_M];
  c.strokeStyle = c.fillStyle = '#e8ebe6'; c.lineCap = 'round'; c.lineJoin = 'round';
  const text = (s, x, y, size = 0.006, align = 'center', weight = 600) => {
    c.font = `${weight} ${size * PX_PER_M}px ${FONT_PANEL}`; c.textAlign = align; c.textBaseline = 'middle';
    String(s).split('\n').forEach((line, i, arr) => { const [px, py] = P(x, y + (arr.length - 1) * size * 0.55 - i * size * 1.1); c.fillText(line, px, py); });
  };
  if (spec.title) text(spec.title, 0, h / 2 - 0.007, 0.0065);
  for (const it of spec.items || []) {
    if (it.t === 'text') text(it.s, it.x, it.y, it.size, it.align, it.weight);
    else if (it.t === 'line') { c.lineWidth = (it.w || 0.0006) * PX_PER_M; c.beginPath(); it.pts.forEach(([x, y], i) => (i ? c.lineTo(...P(x, y)) : c.moveTo(...P(x, y)))); c.stroke(); }
    else if (it.t === 'box') { c.lineWidth = 0.0006 * PX_PER_M; const [x0, y0] = P(it.x - it.w / 2, it.y + it.h / 2); c.strokeRect(x0, y0, it.w * PX_PER_M, it.h * PX_PER_M); }
    else if (it.t === 'knob' && it.ring !== false) { // white tick ring around selectors
      c.lineWidth = 0.0005 * PX_PER_M; const [px, py] = P(it.x, it.y); const R = ((it.r || 0.011) * 1.45) * PX_PER_M;
      for (const a of it.ticks || [-45, 0, 45]) { const ra = THREE.MathUtils.degToRad(90 - a); c.beginPath(); c.moveTo(px + Math.cos(ra) * R * 0.92, py - Math.sin(ra) * R * 0.92); c.lineTo(px + Math.cos(ra) * R * 1.12, py - Math.sin(ra) * R * 1.12); c.stroke(); }
    }
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const faceMat = addGrain(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), 'paint');
  const plate = rbox(w, h, 0.008, 0.002, M.module); plate.position.z = -0.004; g.add(plate);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.0015, h - 0.0015), faceMat); face.position.z = 0.0001; face.receiveShadow = true; g.add(face);

  // 3D controls
  const controls = {};
  const capMat = new THREE.MeshStandardMaterial({ color: 0x23272a, roughness: 0.5 });
  const lensOff = new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.25, metalness: 0.1 });
  for (const it of spec.items || []) {
    if (it.t === 'knob') {
      const r = it.r || 0.011; const k = new THREE.Group();
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.18, 0.003, 32).rotateX(Math.PI / 2), M.panelDark); skirt.position.z = 0.0015; k.add(skirt);
      // Airbus selector: round knob with a raised pointer bar across it
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.012, 32).rotateX(Math.PI / 2), it.light ? M.trim : M.rubber); body.position.z = 0.009; body.castShadow = true; k.add(body);
      if (it.pointer !== false) {
        const bar = rbox(r * 0.42, r * 2.2, 0.008, 0.002, it.light ? M.trim : M.rubber); bar.position.z = 0.017; k.add(bar);
        const line = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.12, r * 0.95), M.pointer); line.position.set(0, r * 0.55, 0.0212); k.add(line);
      }
      k.position.set(it.x, it.y, 0); k.rotation.z = THREE.MathUtils.degToRad(-(it.angle || 0)); g.add(k); if (it.id) controls[it.id] = k;
    } else if (it.t === 'pb') {
      const pw = it.w || 0.017, ph = it.h || 0.017; const b = new THREE.Group();
      const frame = rbox(pw + 0.003, ph + 0.003, 0.004, 0.001, M.panelDark); frame.position.z = 0.002; b.add(frame);
      const cap = rbox(pw, ph, 0.009, 0.0012, capMat); cap.position.z = 0.0065; b.add(cap);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(pw * 0.86, ph * 0.86), lensOff); lens.position.z = 0.0112; b.add(lens);
      (it.legends || []).forEach((lg, i) => {
        if (!lg) return; const lab = atlas.mesh(lg, ph * 0.26, { px: 30, color: '#4a5055', weight: 600 }, pw * 0.8);
        lab.position.set(0, ph * (i === 0 ? 0.2 : -0.2), 0.0114); b.add(lab);
      });
      b.position.set(it.x, it.y, 0); g.add(b); if (it.id) controls[it.id] = b;
    } else if (it.t === 'key') {
      const k = rbox(it.w, it.h, 0.007, 0.0012, capMat); k.position.set(it.x, it.y, 0.0035); g.add(k);
      if (it.s) { const lab = atlas.mesh(it.s, it.h * 0.42, { px: 32, weight: 600 }, it.w * 0.86); lab.position.set(it.x, it.y, 0.0072); g.add(lab); }
      if (it.id) controls[it.id] = k;
    } else if (it.t === 'toggle') {
      const tg = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 20).rotateX(Math.PI / 2), M.metal); base.position.z = 0.0015; tg.add(base);
      const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0026, 0.016, 12), M.metal); bat.position.set(0, 0.004, 0.009); bat.rotation.x = 0.6; tg.add(bat);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 12, 8), M.metal); tip.position.set(0, 0.0085, 0.0155); tg.add(tip);
      tg.position.set(it.x, it.y, 0); g.add(tg); if (it.id) controls[it.id] = tg;
    } else if (it.t === 'annun') {   // fixed annunciator light (dark until lit)
      const a = rbox(it.w || 0.016, it.h || 0.009, 0.004, 0.001, lensOff); a.position.set(it.x, it.y, 0.002); g.add(a);
      const lab = atlas.mesh(it.s, (it.h || 0.009) * 0.55, { px: 30, color: '#4a5055' }, (it.w || 0.016) * 0.85); lab.position.set(it.x, it.y, 0.0042); g.add(lab);
      if (it.id) controls[it.id] = a;
    }
  }
  // Dzus fasteners in the corners
  const sg = new THREE.CylinderGeometry(0.0028, 0.0028, 0.0012, 12).rotateX(Math.PI / 2);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const s = new THREE.Mesh(sg, M.screw); s.position.set(sx * (w / 2 - 0.006), sy * (h / 2 - 0.006), 0.0006); g.add(s); }
  g.userData.controls = controls; g.userData.size = [w, h];
  return g;
}
