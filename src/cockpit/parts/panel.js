// Generic Airbus system panel: a painted face (legends, outlines and guide lines drawn
// in white, like real engraved/backlit panel art) with 3D controls mounted on it.
// Units: metres. Panel built facing +Z with its centre at the origin, +Y = top as read.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { FONT_PANEL } from '../labels.js';
import { addGrain } from '../surface.js';

const PX_PER_M = 2600;
const rbox = (w, h, d, r, mat) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.98), mat); m.castShadow = true; m.receiveShadow = true; return m; };


// ---- Airbus (Korry) pushbutton faces: black lens, upper legend (FAULT, amber / SMOKE, FIRE red /
// AVAIL, OPEN green) and lower legend (OFF, ALTN, MAN, OVRD white in a thin frame; ON blue).
// Unlit, the legends are dim but legible, as in daylight on the real panel.
const LEGEND_COLOURS = {
  FAULT: '#b88a2c', DISCH: '#b88a2c', SQUIB: '#c9ccc8', LO: '#b88a2c', SMOKE: '#b8402e', FIRE: '#b8402e',
  AVAIL: '#4f9c5a', OPEN: '#4f9c5a', 'SYS ON': '#4f9c5a', ON: '#5a86c4', ALIGN: '#c9ccc8',
};
const legendColour = (s, lower) => LEGEND_COLOURS[s] || (lower ? '#c9ccc8' : '#b88a2c');
const faceCache = new Map();
export function korryFace(top, bottom, aspect = 1) {
  const key = `${top}|${bottom}|${aspect.toFixed(2)}`; if (faceCache.has(key)) return faceCache.get(key);
  const H = 128, W = Math.round(H * aspect); const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  c.fillStyle = '#0b0c0d'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#16181a'; c.fillRect(0, H / 2 - 1, W, 2);                       // seam between the two legend windows
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const fit = (s, maxW, size) => { let z = size; c.font = `600 ${z}px ${FONT_PANEL}`; while (c.measureText(s).width > maxW && z > 10) { z -= 1; c.font = `600 ${z}px ${FONT_PANEL}`; } };
  if (top) { fit(top, W * 0.84, H * 0.25); c.fillStyle = legendColour(top, false); c.fillText(top, W / 2, H * 0.27); }
  if (bottom) {
    fit(bottom, W * 0.66, H * 0.23); const col = legendColour(bottom, true); c.fillStyle = col; c.fillText(bottom, W / 2, H * 0.73);
    if (col === '#c9ccc8') { const tw = Math.min(W * 0.8, c.measureText(bottom).width + H * 0.16); c.strokeStyle = 'rgba(201,204,200,0.75)'; c.lineWidth = H * 0.022; c.strokeRect(W / 2 - tw / 2, H * 0.6, tw, H * 0.26); }
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.22, metalness: 0.0, emissiveMap: tex, emissive: 0x000000 });
  faceCache.set(key, mat); return mat;
}
// shared hardware materials
const HW = {};
function hw() {
  if (HW.bezel) return HW;
  HW.bezel = new THREE.MeshStandardMaterial({ color: 0xaeb2b2, roughness: 0.38, metalness: 0.55 });      // satin silver Korry bezel
  HW.knob = new THREE.MeshStandardMaterial({ color: 0x5f6467, roughness: 0.58, metalness: 0.1 });         // light grey selector knobs
  HW.knobDark = new THREE.MeshStandardMaterial({ color: 0x232628, roughness: 0.55 });
  HW.chrome = new THREE.MeshStandardMaterial({ color: 0xc4c7c8, roughness: 0.25, metalness: 0.85 });
  HW.red = new THREE.MeshStandardMaterial({ color: 0xa3261d, roughness: 0.45 });
  HW.cage = new THREE.MeshStandardMaterial({ color: 0x151719, roughness: 0.5 });
  HW.clear = new THREE.MeshPhysicalMaterial({ color: 0xc9cfd2, roughness: 0.15, transparent: true, opacity: 0.35, depthWrite: false });
  HW.pointer = new THREE.MeshBasicMaterial({ color: 0xe6e8e4 });
  return HW;
}

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
  c.fillStyle = spec.bg || '#434d54'; c.fillRect(0, 0, cw, ch);
  const P = (x, y) => [(x + w / 2) * PX_PER_M, (h / 2 - y) * PX_PER_M];
  c.strokeStyle = c.fillStyle = '#e8ebe6'; c.lineCap = 'round'; c.lineJoin = 'round';
  const text = (s, x, y, size = 0.006, align = 'center', weight = 600) => {
    c.font = `${weight} ${size * PX_PER_M}px ${FONT_PANEL}`; c.textAlign = align; c.textBaseline = 'middle';
    String(s).split('\n').forEach((line, i, arr) => { const [px, py] = P(x, y + (arr.length - 1) * size * 0.55 - i * size * 1.1); c.fillText(line, px, py); });
  };
  if (spec.title) text(spec.title, 0, h / 2 - 0.007, 0.0065);
  for (const it of spec.items || []) {
    if (it.t === 'text') { text(it.s, it.x, it.y, it.size, it.align, it.weight); if (it.boxed) { c.font = `600 ${(it.size || 0.006) * PX_PER_M}px ${FONT_PANEL}`; const tw = c.measureText(String(it.s)).width + (it.size || 0.006) * PX_PER_M * 0.8, th = (it.size || 0.006) * PX_PER_M * 1.5; const [px, py] = P(it.x, it.y); c.lineWidth = 0.0005 * PX_PER_M; c.strokeRect(px - tw / 2, py - th / 2, tw, th); } }
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
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x7d868b, roughness: 0.45, metalness: 0.35 });   // satin anodised Korry bezel
  for (const it of spec.items || []) {
    const H = hw();
    if (it.t === 'knob') {
      // Airbus rotary selector: tapered light-grey body on a thin skirt, a raised pointer fin across the top
      const r = it.r || 0.011; const k = new THREE.Group(); const km = it.dark ? H.knobDark : H.knob;
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.22, 0.0018, 36).rotateX(Math.PI / 2), km); skirt.position.z = 0.0009; k.add(skirt);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.95, 0.008, 36).rotateX(Math.PI / 2), km); body.position.z = 0.0058; body.castShadow = true; k.add(body);
      if (it.pointer !== false) {
        // bar knob: a tall fin, tapered toward its top edge, spanning the knob
        const fin = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.3, 0.012, 4, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).scale(1, 3.4, 1), km);
        fin.position.set(0, 0, 0.0158); fin.castShadow = true; k.add(fin);
        const line = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.09, r * 0.75), H.pointer); line.position.set(0, r * 0.62, 0.0219); k.add(line);
      }
      k.position.set(it.x, it.y, 0); k.rotation.z = THREE.MathUtils.degToRad(-(it.angle || 0)); g.add(k); if (it.id) controls[it.id] = k;
    } else if (it.t === 'pb') {
      // Korry pushbutton, Airbus style: almost flush - a thin satin bezel and a black lens 4 mm proud
      const pw = it.w || 0.017, ph = it.h || 0.017; const b = new THREE.Group();
      const well = new THREE.Mesh(new THREE.PlaneGeometry(pw + 0.0036, ph + 0.0036), new THREE.MeshBasicMaterial({ color: 0x050606 })); well.position.z = 0.0002; b.add(well);
      const bez = rbox(pw + 0.0024, ph + 0.0024, 0.0042, 0.0007, H.bezel); bez.position.z = 0.0021; b.add(bez);
      const lens = rbox(pw - 0.0004, ph - 0.0004, 0.0044, 0.0004, capMat); lens.position.z = 0.0024; b.add(lens);
      const [top, bot] = it.legends || [];
      const face = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.0012, ph - 0.0012), korryFace(top, bot, pw / ph)); face.position.z = 0.00465; b.add(face);
      b.userData.face = face;
      if (it.guard === 'red' || it.guard === 'grey') {
        // hinged guard, closed: red solid cover, or a black open cage
        const gw = pw + 0.009, gh = ph + 0.009;
        if (it.guard === 'red') { const lid = rbox(gw, gh, 0.0016, 0.0006, H.red); lid.position.z = 0.0105; b.add(lid); }
        else { for (const [w, h, x, y] of [[gw, 0.0016, 0, gh / 2 - 0.0008], [gw, 0.0016, 0, -gh / 2 + 0.0008], [0.0016, gh, gw / 2 - 0.0008, 0], [0.0016, gh, -gw / 2 + 0.0008, 0], [gw, 0.0012, 0, 0], [0.0012, gh, 0, 0]]) { const bar = rbox(w, h, 0.0016, 0.0005, H.cage); bar.position.set(x, y, 0.0105); b.add(bar); } }
        for (const sx of [-1, 1]) { const cheek = rbox(0.0016, gh, 0.0105, 0.0005, it.guard === 'red' ? H.red : H.cage); cheek.position.set(sx * (gw / 2 - 0.0008), 0, 0.0052); b.add(cheek); }
      } else if (it.guard) {   // clear hood (fire pushbuttons)
        const hood = rbox(pw + 0.008, ph + 0.008, 0.012, 0.003, H.clear); hood.position.z = 0.007; hood.renderOrder = 5; b.add(hood);
      }
      b.position.set(it.x, it.y, 0); g.add(b); if (it.id) controls[it.id] = b;
    } else if (it.t === 'key') {
      // momentary key: same Korry construction, single white legend
      const k = new THREE.Group();
      const bez = rbox(it.w + 0.002, it.h + 0.002, 0.0036, 0.0006, H.bezel); bez.position.z = 0.0018; k.add(bez);
      const lens = rbox(it.w - 0.0004, it.h - 0.0004, 0.0038, 0.0004, capMat); lens.position.z = 0.0021; k.add(lens);
      if (it.s) { const lab = atlas.mesh(it.s, it.h * 0.4, { px: 32, weight: 600, color: '#c9ccc8' }, it.w * 0.84); lab.position.set(0, 0, 0.0041); k.add(lab); }
      k.position.set(it.x, it.y, 0); g.add(k); if (it.id) controls[it.id] = k;
    } else if (it.t === 'toggle') {
      // Airbus lever-lock toggle: knurled chrome bushing and a stubby bat with a flattened tip
      const tg = new THREE.Group();
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.0022, 6).rotateX(Math.PI / 2), H.chrome); nut.position.z = 0.0011; tg.add(nut);
      const bush = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.004, 20).rotateX(Math.PI / 2), H.chrome); bush.position.z = 0.0042; tg.add(bush);
      const bat = new THREE.Group(); bat.position.z = 0.006; bat.rotation.x = -0.35;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0021, 0.0026, 0.012, 16).rotateX(Math.PI / 2), H.chrome); stem.position.z = 0.006; bat.add(stem);
      const tip = rbox(0.0062, 0.0044, 0.0068, 0.0018, H.chrome); tip.position.z = 0.0135; bat.add(tip);
      tg.add(bat); tg.userData.bat = bat;
      tg.position.set(it.x, it.y, 0); g.add(tg); if (it.id) controls[it.id] = tg;
    } else if (it.t === 'cb') {   // rows of push/pull circuit breakers
      const n = it.cols * it.rows;
      const collar = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.002, 16).rotateX(Math.PI / 2), M.trim, n);
      const capG = new THREE.CylinderGeometry(0.0032, 0.0034, 0.009, 16).rotateX(Math.PI / 2);
      const caps = new THREE.InstancedMesh(capG, capMat, n); const m4 = new THREE.Matrix4(); let k = 0;
      for (let r = 0; r < it.rows; r++) for (let q = 0; q < it.cols; q++) {
        const x = it.x + (q - (it.cols - 1) / 2) * it.dx, y = it.y - r * it.dy;
        m4.makeTranslation(x, y, 0.001); collar.setMatrixAt(k, m4); m4.makeTranslation(x, y, 0.0055); caps.setMatrixAt(k, m4); k++;
      }
      g.add(collar, caps);
    } else if (it.t === 'round') {   // gasper / speaker grille: recessed ring with a dark centre
      const r = it.r || 0.02;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.16, 12, 40), M.panelDark); ring.position.set(it.x, it.y, 0.002); g.add(ring);
      const cen = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 40), lensOff); cen.position.set(it.x, it.y, -0.001); g.add(cen);
      if (it.eyeball) { const e = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 24, 16), M.panelDark); e.position.set(it.x, it.y, 0.0); e.scale.z = 0.6; g.add(e);
        const hole = new THREE.Mesh(new THREE.CircleGeometry(r * 0.28, 24), capMat); hole.position.set(it.x, it.y, r * 0.38); g.add(hole); }
    } else if (it.t === 'annun') {   // fixed annunciator: flush black lens with its legend, dark until lit
      const aw = it.w || 0.016, ah = it.h || 0.009;
      const bez = rbox(aw + 0.0018, ah + 0.0018, 0.0022, 0.0005, H.bezel); bez.position.set(it.x, it.y, 0.0011); g.add(bez);
      const a = new THREE.Mesh(new THREE.PlaneGeometry(aw, ah), korryFace(it.s, '', aw / ah)); a.position.set(it.x, it.y, 0.0023); g.add(a);
      if (it.id) controls[it.id] = a;
    }
  }
  // Dzus fasteners in the corners
  const sg = new THREE.CylinderGeometry(0.0028, 0.0028, 0.0012, 12).rotateX(Math.PI / 2);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const s = new THREE.Mesh(sg, M.screw); s.position.set(sx * (w / 2 - 0.006), sy * (h / 2 - 0.006), 0.0006); g.add(s); }
  g.userData.controls = controls; g.userData.size = [w, h];
  return g;
}
