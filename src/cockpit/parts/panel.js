// Generic Airbus system panel: a painted face (legends, outlines and guide lines drawn
// in white, like real engraved/backlit panel art) with 3D controls mounted on it.
// Units: metres. Panel built facing +Z with its centre at the origin, +Y = top as read.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { FONT_PANEL } from '../labels.js';
import { addGrain } from '../surface.js';

const PX_PER_M = 2600;
export const INTEGRAL = new Set();
export const KORRY = new Set();      // pushbutton legend faces (legends readable at night)   // panel faces with integral lighting (dark by day)
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
export function korryFace(top, bottom, aspect = 1, cols = null) {
  const key = `${top}|${bottom}|${aspect.toFixed(2)}|${cols}`; if (faceCache.has(key)) return faceCache.get(key);
  const H = 128, W = Math.round(H * aspect); const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  c.fillStyle = '#0b0c0d'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#16181a'; c.fillRect(0, H / 2 - 1, W, 2);                       // seam between the two legend windows
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const fit = (s, maxW, size) => { let z = size; c.font = `600 ${z}px ${FONT_PANEL}`; while (c.measureText(s).width > maxW && z > 10) { z -= 1; c.font = `600 ${z}px ${FONT_PANEL}`; } };
  if (top) { fit(top, W * 0.84, H * 0.25); c.fillStyle = cols ? cols[0] : legendColour(top, false); c.fillText(top, W / 2, bottom ? H * 0.27 : H * 0.5); }
  if (bottom) {
    fit(bottom, W * 0.66, H * 0.23); const col = cols ? cols[1] : legendColour(bottom, true); c.fillStyle = col; c.fillText(bottom, W / 2, H * 0.73);
    if (col === '#c9ccc8' && !cols) { const tw = Math.min(W * 0.8, c.measureText(bottom).width + H * 0.16); c.strokeStyle = 'rgba(201,204,200,0.75)'; c.lineWidth = H * 0.022; c.strokeRect(W / 2 - tw / 2, H * 0.6, tw, H * 0.26); }
  }
  // unlit (the normal 'lights out' state): the legend shows only faintly through the dark glass. The full-colour
  // legend is kept as the emissive map and lights up when the button is lit (or at night for readability)
  const litTex = new THREE.CanvasTexture(cv); litTex.colorSpace = THREE.SRGBColorSpace; litTex.anisotropy = 8;
  const dim = document.createElement('canvas'); dim.width = W; dim.height = H; { const dc = dim.getContext('2d'); dc.drawImage(cv, 0, 0); dc.globalCompositeOperation = 'multiply'; dc.fillStyle = '#4a4a4a'; dc.fillRect(0, 0, W, H); }
  const tex = new THREE.CanvasTexture(dim); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.22, metalness: 0.0, emissiveMap: litTex, emissive: 0x000000 });
  KORRY.add(mat); faceCache.set(key, mat); return mat;
}
// shared hardware materials
const HW = {};
function hw() {
  if (HW.bezel) return HW;
  HW.bezel = new THREE.MeshStandardMaterial({ color: 0xaeb2b2, roughness: 0.38, metalness: 0.55 });      // satin silver Korry bezel
  HW.knob = new THREE.MeshStandardMaterial({ color: 0xd2d6d8, roughness: 0.42, metalness: 0.15 });   // white-grey Airbus selector knobs
  HW.fcuKnob = new THREE.MeshStandardMaterial({ color: 0xbcc0c3, roughness: 0.4, metalness: 0.3 });   // silver-white FCU knobs
  HW.amber = new THREE.MeshStandardMaterial({ color: 0xe8963a, roughness: 0.4, emissive: 0xd0701c, emissiveIntensity: 0.9 });   // amber ring around each FCU knob         // light grey selector knobs
  HW.knobDark = new THREE.MeshStandardMaterial({ color: 0x232628, roughness: 0.55 });
  HW.ringDark = new THREE.MeshStandardMaterial({ color: 0x3e4347, roughness: 0.35, metalness: 0.5 });
  HW.chrome = new THREE.MeshStandardMaterial({ color: 0xc4c7c8, roughness: 0.25, metalness: 0.85 });
  HW.amberDim = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.5, emissive: 0xb0601c, emissiveIntensity: 0.35 });   // integral light at a bezel rim, daylight
  HW.lever = new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.45, metalness: 0.45 });   // satin grey light levers
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
  c.fillStyle = spec.bg || '#7d919b'; c.fillRect(0, 0, cw, ch);
  const P = (x, y) => [(x + w / 2) * PX_PER_M, (h / 2 - y) * PX_PER_M];
  {
    let seed = 0; for (const ch of String(spec.name || 'p')) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let k = 0; k < 14; k++) {   // uneven paint and grime
      const gx = rnd() * cw, gy = rnd() * ch, gr = (0.15 + rnd() * 0.5) * Math.max(cw, ch);
      const g = c.createRadialGradient(gx, gy, 0, gx, gy, gr); const dark = rnd() < 0.6;
      g.addColorStop(0, dark ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.035)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, cw, ch);
    }
    const e = Math.min(cw, ch) * 0.12;   // edges collect grime
    for (const [x0, y0, x1, y1] of [[0, 0, e, 0], [cw, 0, cw - e, 0], [0, 0, 0, e], [0, ch, 0, ch - e]]) {
      const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(0,0,0,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, cw, ch);
    }
    for (const it of spec.items || []) {   // paint polished by fingers around knobs and switches
      if (it.t !== 'knob' && it.t !== 'toggle' && it.t !== 'pb') continue;
      const [kx, ky] = P(it.x, it.y); const r = ((it.r || 0.011) * 2.4) * PX_PER_M;
      const g = c.createRadialGradient(kx, ky, r * 0.3, kx, ky, r); g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(kx - r, ky - r, r * 2, r * 2);
    }
  }
  c.strokeStyle = c.fillStyle = '#e8ebe6'; c.lineCap = 'round'; c.lineJoin = 'round';
  const text = (s, x, y, size = 0.006, align = 'center', weight = 600) => {
    c.font = `${weight} ${size * PX_PER_M}px ${FONT_PANEL}`; c.textAlign = align; c.textBaseline = 'middle';
    String(s).split('\n').forEach((line, i, arr) => { const [px, py] = P(x, y + (arr.length - 1) * size * 0.55 - i * size * 1.1); const f = c.fillStyle; c.fillStyle = 'rgba(8,10,12,0.55)'; c.fillText(line, px + 1.2, py + 1.4); c.fillStyle = f; c.fillText(line, px, py); });
  };
  if (spec.title) text(spec.title, 0, h / 2 - (spec.titleSize ? spec.titleSize * 1.25 : 0.007), spec.titleSize || 0.0065);
  for (const it of spec.items || []) {
    if (it.t === 'text') { text(it.s, it.x, it.y, it.size, it.align, it.weight); if (it.boxed) { c.font = `600 ${(it.size || 0.006) * PX_PER_M}px ${FONT_PANEL}`; const tw = c.measureText(String(it.s)).width + (it.size || 0.006) * PX_PER_M * 0.8, th = (it.size || 0.006) * PX_PER_M * 1.5; const [px, py] = P(it.x, it.y); c.lineWidth = 0.0005 * PX_PER_M; c.strokeRect(px - tw / 2, py - th / 2, tw, th); } }
    else if (it.t === 'line') { c.save(); if (it.col) c.strokeStyle = it.col; c.lineWidth = (it.w || 0.0006) * PX_PER_M; c.beginPath(); it.pts.forEach(([x, y], i) => (i ? c.lineTo(...P(x, y)) : c.moveTo(...P(x, y)))); c.stroke(); c.restore(); }
    else if (it.t === 'arrow') { c.save(); c.fillStyle = it.col || '#e8ebe6'; const [px, py] = P(it.x, it.y); const a = (it.s || 0.003) * PX_PER_M;
      c.translate(px, py); c.rotate({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[it.dir || 'up']);
      c.beginPath(); c.moveTo(0, -a * 0.6); c.lineTo(-a * 0.6, a * 0.5); c.lineTo(a * 0.6, a * 0.5); c.closePath(); c.fill(); c.restore(); }
    else if (it.t === 'circ') { c.save(); if (it.col) c.strokeStyle = it.col; c.lineWidth = (it.w || 0.0006) * PX_PER_M; const [px, py] = P(it.x, it.y); c.beginPath(); c.arc(px, py, it.r * PX_PER_M, (it.a0 || 0) * Math.PI / 180, (it.a1 ?? 360) * Math.PI / 180); c.stroke(); c.restore(); }
    else if (it.t === 'box') { c.lineWidth = 0.0006 * PX_PER_M; const [x0, y0] = P(it.x - it.w / 2, it.y + it.h / 2); c.strokeRect(x0, y0, it.w * PX_PER_M, it.h * PX_PER_M); }
    else if (it.t === 'knob' && it.ring !== false) { // white tick ring around selectors
      c.lineWidth = 0.0005 * PX_PER_M; const [px, py] = P(it.x, it.y); const R = ((it.r || 0.011) * 1.45) * PX_PER_M;
      if (it.arc) { c.beginPath(); c.arc(px, py, R * 1.02, THREE.MathUtils.degToRad(-90 - it.arc), THREE.MathUtils.degToRad(-90 + it.arc)); c.stroke(); }
      for (const a of it.ticks || [-45, 0, 45]) { const ra = THREE.MathUtils.degToRad(90 - a); c.beginPath(); c.moveTo(px + Math.cos(ra) * R * 0.92, py - Math.sin(ra) * R * 0.92); c.lineTo(px + Math.cos(ra) * R * 1.12, py - Math.sin(ra) * R * 1.12); c.stroke(); }
    }
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  c.save(); c.strokeStyle = 'rgba(232,164,86,0.85)'; c.lineWidth = 0.0007 * PX_PER_M;
  for (const it of spec.items || []) {
    if (it.t !== 'pb' && it.t !== 'annun') continue;
    const pw = (it.w || 0.017) + 0.0062, ph = (it.h || (it.t === 'pb' ? 0.017 : 0.009)) + 0.0062; const [x0, y0] = P(it.x - pw / 2, it.y + ph / 2);
    c.strokeRect(x0, y0, pw * PX_PER_M, ph * PX_PER_M);
  }
  c.restore();
  // integral (back) lighting: the engraved legends, lines and pushbutton surrounds are the translucent parts that
  // glow at night; build that mask from the painted face (anything much brighter than the paint)
  const em = document.createElement('canvas'); em.width = cw; em.height = ch; { const ex = em.getContext('2d'); const src = c.getImageData(0, 0, cw, ch); const d = src.data;
    for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]); if (mx < 160) { d[i] = d[i + 1] = d[i + 2] = 0; } else { const k = Math.min(1, (mx - 160) / 50); d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; } }
    ex.putImageData(src, 0, 0);
    // thicken the lit strokes by a pixel so small legends stay legible at night (backlit engraving blooms slightly)
    ex.globalCompositeOperation = 'lighten'; ex.globalAlpha = 0.45; ex.drawImage(em, 1, 0); ex.drawImage(em, 0, 1); }
  const emTex = new THREE.CanvasTexture(em); emTex.colorSpace = THREE.SRGBColorSpace;
  const faceMat = addGrain(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissiveMap: emTex, emissive: 0x000000 }), 'paint');
  INTEGRAL.add(faceMat);
  const gap = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.004, h + 0.004), new THREE.MeshBasicMaterial({ color: 0x07080a })); gap.position.z = -0.0085; g.add(gap);
  const plate = rbox(w - 0.001, h - 0.001, 0.009, 0.0035, spec.plate || M.module); plate.position.z = -0.0045; g.add(plate);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.006, h - 0.006), faceMat); face.position.z = 0.0001; face.receiveShadow = true; g.add(face);

  // 3D controls
  const controls = {};
  const capMat = new THREE.MeshStandardMaterial({ color: 0x23272a, roughness: 0.5 });
  const lensOff = new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.25, metalness: 0.1 });
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x7d868b, roughness: 0.45, metalness: 0.35 });   // satin anodised Korry bezel
  for (const it of spec.items || []) {
    const H = hw();
    if (it.t === 'knob' && it.style === 'fcu') {
      // A320 FCU knob: satin collar on the panel, grey knurled body, slightly domed cap with a fine ring
      const r = it.r || 0.012; const k = new THREE.Group();
      const collar = new THREE.Mesh(new THREE.TorusGeometry(r * 1.4, r * 0.11, 10, 48), H.amber); collar.position.z = 0.0012; k.add(collar);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.22, r * 1.28, 0.005, 48).rotateX(Math.PI / 2), H.knobDark); base.position.z = 0.0025; k.add(base);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.06, 0.016, 48).rotateX(Math.PI / 2), H.fcuKnob); body.position.z = 0.0102; body.castShadow = true; k.add(body);
      for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; const fl = new THREE.Mesh(new THREE.BoxGeometry(0.0009, 0.0014, 0.0145), H.fcuKnob); fl.position.set(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05, 0.0102); fl.rotation.z = a; k.add(fl); }
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.0, 40, 12, 0, Math.PI * 2, 0, 0.42).rotateX(Math.PI / 2), H.fcuKnob); cap.scale.z = 0.35; cap.position.z = 0.0168; k.add(cap);
      if (it.hdg) {   // HDG knob: scalloped skirt and the blue heading index on the cap
        const sk = new THREE.Shape(); for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; const rr = r * (1.2 + 0.08 * Math.cos(a * 8)); i ? sk.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sk.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        const skirt = new THREE.Mesh(new THREE.ExtrudeGeometry(sk, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 1 }), H.fcuKnob); skirt.position.z = 0.002; k.add(skirt);
        const tri = new THREE.Shape(); const tr = r * 0.62; tri.moveTo(-tr * 0.87, tr * 0.5); tri.lineTo(tr * 0.87, tr * 0.5); tri.lineTo(0, -tr); tri.closePath(); const hole = new THREE.Path(); const ti = tr * 0.72; hole.moveTo(-ti * 0.87, ti * 0.5); hole.lineTo(0, -ti); hole.lineTo(ti * 0.87, ti * 0.5); hole.closePath(); tri.holes.push(hole);
        const tm = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: 0x2f62c8 })); tm.position.z = 0.0207; k.add(tm);
      } else { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.62, 0.00045, 6, 48), H.pointer); ring.position.z = 0.0205; k.add(ring); }
      k.position.set(it.x, it.y, 0); g.add(k); if (it.id) controls[it.id] = k;
    } else if (it.t === 'knob' && it.style === 'knurl') {
      // lighting rheostat: light-grey knurled cylinder, domed top with a dark index line
      const r = it.r || 0.008; const k = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, 0.01, 40).rotateX(Math.PI / 2), H.knob); body.position.z = 0.005; body.castShadow = true; k.add(body);
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const rib = rbox(r * 0.28, r * 0.28, 0.0095, r * 0.1, H.knob); rib.position.set(Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93, 0.005); rib.rotation.z = a; k.add(rib); }
      const top = new THREE.Mesh(new THREE.SphereGeometry(r * 0.9, 24, 8, 0, Math.PI * 2, 0, 0.55).rotateX(Math.PI / 2), H.knob); top.scale.z = 0.3; top.position.z = 0.0098; k.add(top);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.12, r * 0.8), new THREE.MeshBasicMaterial({ color: 0x1a1c1e })); line.position.set(0, r * 0.42, 0.0128); k.add(line);
      k.position.set(it.x, it.y, 0); k.rotation.z = THREE.MathUtils.degToRad(-(it.angle ?? -100)); g.add(k); if (it.id) controls[it.id] = k;
    } else if (it.t === 'knob' && it.style === 'round') {
      // audio volume / reception knob: dark knurled cylinder with a domed top and a white index line
      const r = it.r || 0.006; const k = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.009, 32).rotateX(Math.PI / 2), H.knobDark); body.position.z = 0.0045; body.castShadow = true; k.add(body);
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; const rib = new THREE.Mesh(new THREE.BoxGeometry(r * 0.12, r * 0.12, 0.007), H.knobDark); rib.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.0045); k.add(rib); }
      const top = new THREE.Mesh(new THREE.SphereGeometry(r * 0.98, 24, 8, 0, Math.PI * 2, 0, 0.6).rotateX(Math.PI / 2), H.knobDark); top.scale.z = 0.35; top.position.z = 0.009; k.add(top);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.16, r * 0.85), new THREE.MeshBasicMaterial({ color: 0xeeeeea })); line.position.set(0, r * 0.45, 0.0118); k.add(line);
      k.position.set(it.x, it.y, 0); k.rotation.z = THREE.MathUtils.degToRad(-(it.angle || 0)); g.add(k); if (it.id) controls[it.id] = k;
    } else if (it.t === 'knob' && it.style === 'bar') {
      // overhead bar selector: low round base, a long light-grey grip tapering toward the pointer end, black index stripe
      const r = it.r || 0.011; const k = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.98, r * 1.04, 0.005, 40).rotateX(Math.PI / 2), H.knob); base.position.z = 0.0025; base.castShadow = true; k.add(base);
      const sh = new THREE.Shape(); const L = r * 1.05, W0 = r * 0.5, W1 = r * 0.3;
      sh.moveTo(-W1, L); sh.quadraticCurveTo(0, L * 1.12, W1, L); sh.lineTo(W0, -L * 0.75); sh.quadraticCurveTo(0, -L * 1.05, -W0, -L * 0.75); sh.closePath();
      const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.011, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0012, bevelSegments: 4, curveSegments: 12 }), H.knob);
      fin.position.z = 0.004; fin.castShadow = true; k.add(fin);
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.1, L * 1.55), new THREE.MeshBasicMaterial({ color: 0x141618 })); stripe.position.set(0, L * 0.12, 0.0166); k.add(stripe);
      k.position.set(it.x, it.y, 0); k.rotation.z = THREE.MathUtils.degToRad(-(it.angle || 0)); g.add(k); if (it.id) controls[it.id] = k;
    } else if (it.t === 'knob') {
      // Airbus rotary selector: tapered light-grey body on a thin skirt, a raised pointer fin across the top
      const r = it.r || 0.011; const k = new THREE.Group(); const km = it.dark ? H.knobDark : H.knob;
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.22, 0.0018, 36).rotateX(Math.PI / 2), km); skirt.position.z = 0.0009; k.add(skirt);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.95, 0.008, 36).rotateX(Math.PI / 2), km); body.position.z = 0.0058; body.castShadow = true; k.add(body);
      if (it.pointer !== false) {
        // bar knob: a tall fin, tapered toward its top edge, spanning the knob
        const fin = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.38, 0.013, 4, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).scale(1, 2.9, 1), km);
        fin.position.set(0, 0, 0.0158); fin.castShadow = true; k.add(fin);
        const line = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.09, r * 0.75), H.pointer); line.position.set(0, r * 0.62, 0.0219); k.add(line);
      }
      if (it.lit) { const lr = new THREE.Mesh(new THREE.TorusGeometry(r * 1.42, r * 0.11, 10, 48), H.amber); lr.position.z = 0.0012; k.add(lr); const db = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.3, r * 1.3, 0.0016, 40).rotateX(Math.PI / 2), H.knobDark); db.position.z = 0.0006; k.add(db); }
      k.position.set(it.x, it.y, 0); k.rotation.z = THREE.MathUtils.degToRad(-(it.angle || 0)); g.add(k); if (it.id) controls[it.id] = k;
    } else if (it.t === 'pb') {
      // Korry pushbutton, Airbus style: almost flush - a thin satin bezel and a black lens 4 mm proud
      const pw = it.w || 0.017, ph = it.h || 0.017; const b = new THREE.Group();
      const well = new THREE.Mesh(new THREE.PlaneGeometry(pw + 0.0036, ph + 0.0036), new THREE.MeshBasicMaterial({ color: 0x050606 })); well.position.z = 0.0002; b.add(well);
      const bez = rbox(pw + 0.0024, ph + 0.0024, 0.0042, 0.0007, H.bezel); bez.position.z = 0.0021; b.add(bez);
      const lens = rbox(pw - 0.0004, ph - 0.0004, 0.0044, 0.0004, capMat); lens.position.z = 0.0024; b.add(lens);
      const [top, bot] = it.legends || [];
      const face = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.0012, ph - 0.0012), korryFace(top, bot, pw / ph, it.cols || null)); face.position.z = 0.00465; b.add(face);
      b.userData.face = face;
      if (it.guard === 'red' || it.guard === 'grey') {
        // hinged guard, closed: red solid cover, or a black open cage
        const gw = pw + 0.009, gh = ph + 0.009;
        if (it.guard === 'red') { const lid = rbox(gw, gh, 0.0016, 0.0006, H.red); lid.position.z = 0.0105; b.add(lid);
          // hinge barrel along the top edge and a lifting tab at the bottom, as on the real guards
          const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, gw * 0.9, 12).rotateZ(Math.PI / 2), H.cage); hinge.position.set(0, gh / 2, 0.0098); b.add(hinge);
          const tab = rbox(gw * 0.45, 0.0045, 0.0014, 0.0005, H.red); tab.position.set(0, -gh / 2 - 0.0018, 0.0105); tab.rotation.x = -0.35; b.add(tab);
          const ridge = rbox(gw * 0.8, 0.0012, 0.001, 0.0003, H.red); ridge.position.set(0, gh / 2 - 0.0035, 0.0117); b.add(ridge); }
        else { for (const [w, h, x, y] of [[gw, 0.0016, 0, gh / 2 - 0.0008], [gw, 0.0016, 0, -gh / 2 + 0.0008], [0.0016, gh, gw / 2 - 0.0008, 0], [0.0016, gh, -gw / 2 + 0.0008, 0], [gw, 0.0012, 0, 0], [0.0012, gh, 0, 0]]) { const bar = rbox(w, h, 0.0016, 0.0005, H.cage); bar.position.set(x, y, 0.0105); b.add(bar); } }
        for (const sx of [-1, 1]) { const cheek = rbox(0.0016, gh, 0.0105, 0.0005, it.guard === 'red' ? H.red : H.cage); cheek.position.set(sx * (gw / 2 - 0.0008), 0, 0.0052); b.add(cheek); }
      } else if (it.guard === 'fire') {   // fire pushbutton: red-framed translucent cover, the FIRE / PUSH legend visible through it
        const fr = new THREE.MeshStandardMaterial({ color: 0xa3261d, roughness: 0.45 });
        const lid = rbox(pw + 0.006, ph + 0.006, 0.0018, 0.001, new THREE.MeshPhysicalMaterial({ color: 0xb0302a, roughness: 0.2, transparent: true, opacity: 0.38, depthWrite: false })); lid.position.z = 0.0105; lid.renderOrder = 5; b.add(lid);
        for (const [w2, h2, x2, y2] of [[pw + 0.008, 0.003, 0, (ph + 0.005) / 2], [pw + 0.008, 0.003, 0, -(ph + 0.005) / 2], [0.003, ph + 0.008, (pw + 0.005) / 2, 0], [0.003, ph + 0.008, -(pw + 0.005) / 2, 0]]) { const bar = rbox(w2, h2, 0.011, 0.001, fr); bar.position.set(x2, y2, 0.0055); b.add(bar); }
        // pull loop below the handle (red ring on a short neck)
        const neck = rbox(0.007, 0.006, 0.004, 0.0015, fr); neck.position.set(0, -(ph / 2 + 0.006), 0.009); b.add(neck);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0014, 10, 28), fr); ring.position.set(0, -(ph / 2 + 0.0135), 0.009); b.add(ring);
      } else if (it.guard) {   // clear hood
        const hood = rbox(pw + 0.008, ph + 0.008, 0.012, 0.003, H.clear); hood.position.z = 0.007; hood.renderOrder = 5; b.add(hood);
      }
      b.position.set(it.x, it.y, 0); g.add(b); if (it.id) controls[it.id] = b;
    } else if (it.t === 'key') {
      // momentary key: same Korry construction, single white legend
      const k = new THREE.Group();
      const bez = rbox(it.w + 0.002, it.h + 0.002, 0.0036, 0.0006, H.bezel); bez.position.z = 0.0018; k.add(bez);
      const lens = rbox(it.w - 0.0004, it.h - 0.0004, 0.0038, 0.0004, capMat); lens.position.z = 0.0021; k.add(lens);
      if (it.s) { const lab = atlas.mesh(it.s, it.h * (it.bar ? 0.32 : 0.4), { px: 32, weight: 600, color: '#c9ccc8' }, it.w * 0.84); lab.position.set(0, it.bar ? -it.h * 0.16 : 0, 0.0041); k.add(lab); }
      if (it.bar) {   // green 'engaged' bar: three segments, unlit
        const bm = new THREE.MeshStandardMaterial({ color: 0x0f2414, roughness: 0.3, emissive: 0x000000 }); k.userData.bar = [];
        for (const sx of [-1, 0, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(it.w * 0.22, it.h * 0.13), bm); s.position.set(sx * it.w * 0.26, it.h * 0.24, 0.0042); k.add(s); k.userData.bar.push(s); }
      }
      k.position.set(it.x, it.y, 0); g.add(k); if (it.id) controls[it.id] = k;
    } else if (it.t === 'rbtn') {   // small round pushbutton (SPD/MACH, CHRONO, METRIC ALT): black cap in a satin ring
      const r = it.r || 0.0055; const k = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.22, r * 1.26, 0.002, 32).rotateX(Math.PI / 2), H.ringDark); ring.position.z = 0.001; k.add(ring);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r, 0.005, 32).rotateX(Math.PI / 2), capMat); cap.position.z = 0.0035; cap.castShadow = true; k.add(cap);
      k.position.set(it.x, it.y, 0); g.add(k); if (it.id) controls[it.id] = k;
    } else if (it.t === 'toggle') {
      // Airbus lever-lock toggle: knurled chrome bushing and a stubby bat with a flattened tip
      const tg = new THREE.Group();
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.0022, 6).rotateX(Math.PI / 2), H.chrome); nut.position.z = 0.0011; tg.add(nut);
      const bush = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.004, 20).rotateX(Math.PI / 2), H.chrome); bush.position.z = 0.0042; tg.add(bush);
      const bat = new THREE.Group(); bat.position.z = 0.006; bat.rotation.x = -0.35;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0021, 0.0026, 0.012, 16).rotateX(Math.PI / 2), H.chrome); stem.position.z = 0.006; bat.add(stem);
      if (it.style === 'ribbed') {   // light levers (strobe, beacon, nav): wide grey lever with ribbed grip, hanging down
        stem.visible = false; const lv = new THREE.Group(); lv.rotation.x = 0.9; bat.add(lv);
        const blade = rbox(0.0088, 0.0026, 0.018, 0.0010, H.lever); blade.position.z = 0.009; lv.add(blade);
        for (let i = 0; i < 6; i++) { const rib = rbox(0.0094, 0.0006, 0.0011, 0.0002, H.lever); rib.position.set(0, -0.0015, 0.007 + i * 0.0018); lv.add(rib); }
      } else if (it.style === 'tbar') {   // landing light levers: stem with a wide flat T handle
        const tb = rbox(0.0125, 0.0042, 0.0045, 0.0016, H.lever); tb.position.z = 0.0145; bat.add(tb);
      } else {
        const tip = it.style === 'paddle' ? rbox(0.0105, 0.0032, 0.013, 0.0014, H.chrome) : new THREE.Mesh(new THREE.SphereGeometry(0.0028, 16, 10), H.chrome);
        tip.position.z = it.style === 'paddle' ? 0.0165 : 0.0128; bat.add(tip);
      }
      if (it.lit) {   // integrally lit bezel: black ring with an amber glow at its rim
        const db = new THREE.Mesh(new THREE.CylinderGeometry(0.0078, 0.0082, 0.0022, 36).rotateX(Math.PI / 2), H.knobDark); db.position.z = 0.0011; tg.add(db);
        const ar = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.00028, 6, 48), H.amberDim); ar.position.z = 0.0018; tg.add(ar);
        nut.visible = false;
      }
      tg.add(bat); tg.userData.bat = bat;
      tg.position.set(it.x, it.y, 0); g.add(tg); if (it.id) controls[it.id] = tg;
    } else if (it.t === 'cb') {   // rows of push/pull circuit breakers
      const n = it.cols * it.rows;
      const collar = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.002, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2f7a4c, roughness: 0.5 }), n);
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
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const s = new THREE.Mesh(sg, spec.screw || M.screw); s.position.set(sx * (w / 2 - 0.006), sy * (h / 2 - 0.006), 0.0006); g.add(s); }
  g.userData.controls = controls; g.userData.size = [w, h];
  return g;
}
