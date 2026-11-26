// Main instrument panel sub-panels (A320): outboard lighting panels, the centre-left
// standby column, landing gear / autobrake / brake column. Positions are panel-local metres.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { buildPanel } from './panel.js';

// outboard lighting / loudspeaker panel (captain: side -1, F/O: side +1)
export function lightingPanel(M, A, side) {
  // instrument lighting control panel (as in reference photographs): PFD and ND rheostats with the PFD/ND XFR
  // button between them, LOUD SPKR rheostat and CONSOLE/FLOOR switch below, GPWS warning button in the corner
  const m = side < 0 ? 1 : -1;   // the F/O panel is the mirror image
  const T = (x, y, s, size = 0.0032) => ({ t: 'text', x: m * x, y, s, size });
  const rh = (x, y, id) => ({ t: 'knob', style: 'knurl', x: m * x, y, r: 0.0078, id, arc: 130 });
  const L = (pts) => ({ t: 'line', pts: pts.map(([x, y]) => [m * x, y]), w: 0.0006 });
  const items = [
    { t: 'pb', x: m * 0.052, y: 0.036, w: 0.016, h: 0.016, legends: ['PULL UP', ''], cols: ['#c93a2a', '#c93a2a'], id: 'pullUp' + side },
    T(-0.045, 0.02, 'PFD'), rh(-0.045, 0.004, 'pfdBrt'), T(-0.057, -0.009, 'OFF', 0.0028), T(-0.033, -0.009, 'BRT', 0.0028),
    L([[-0.023, 0.024], [-0.023, -0.012]]), T(0, 0.024, 'PFD/ND'), T(0, 0.018, 'XFR'), { t: 'rbtn', x: 0, y: 0.004, r: 0.0058, id: 'pfdNdXfr' + side },
    L([[0.023, 0.024], [0.023, -0.012]]), T(0.045, 0.02, 'ND'), rh(0.045, 0.004, 'ndBrt'), T(0.033, -0.009, 'OFF', 0.0028), T(0.057, -0.009, 'BRT', 0.0028),
    L([[-0.062, -0.016], [0.062, -0.016]]),
    T(-0.045, -0.022, 'LOUD SPKR'), rh(-0.045, -0.035, 'loud'), T(-0.057, -0.046, 'OFF', 0.0028), T(-0.033, -0.046, 'MAX', 0.0028),
    T(0.006, -0.022, 'CONSOLE/FLOOR', 0.003), { t: 'toggle', x: m * 0.0, y: -0.036, id: 'console' + side },
    T(0.02, -0.029, 'BRT', 0.0028), T(0.02, -0.037, 'DIM', 0.0028), T(0.02, -0.045, 'OFF', 0.0028), L([[0.028, -0.026], [0.028, -0.048]]),
  ];
  return buildPanel({ w: 0.14, h: 0.1, items, name: 'lighting' + side }, M, A);
}

export function terrPanel(M, A, side, w = 0.05, h = 0.068) {
  // captain: tall plate below the label; F/O: compact plate beside the clock
  const top = h / 2 - 0.009;
  return buildPanel({ w, h, name: 'terr' + side, items: [{ t: 'text', x: 0, y: top, s: 'TERR ON ND', size: 0.0044 }, { t: 'pb', x: 0, y: top - 0.017, w: 0.019, h: 0.019, legends: ['', 'ON'], id: 'terrOnNd' + side }] }, M, A);
}

const RB = (w, h, d, r, mat) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.98), mat); m.castShadow = true; m.receiveShadow = true; return m; };
function chamferShape(w, h, c, r = 0.003) {   // rectangle with 45-degree corners, slightly rounded
  const s = new THREE.Shape(); const x = w / 2, y = h / 2;
  s.moveTo(-x + c, y); s.lineTo(x - c, y); s.lineTo(x, y - c); s.lineTo(x, -y + c); s.lineTo(x - c, -y); s.lineTo(-x + c, -y); s.lineTo(-x, -y + c); s.lineTo(-x, y - c); s.closePath(); return s;
}
function plate(w, h, c, d, mat) {
  const g = new THREE.ExtrudeGeometry(chamferShape(w, h, c), { depth: d, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 2 });
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function canvasMat(w, h, draw, { emissive = 0, rough = 0.55 } = {}) {
  const PX = 6000; const cv = document.createElement('canvas'); cv.width = Math.round(w * PX); cv.height = Math.round(h * PX);
  const c = cv.getContext('2d'); draw(c, cv.width, cv.height); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({ map: tx, roughness: rough }); if (emissive) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = tx; m.emissiveIntensity = emissive; } return m;
}

// white engraved-style placard (registration, SELCAL)
export function placard(lines, w, h) {
  const g = new THREE.Group();
  const back = RB(w, h, 0.0016, 0.002, new THREE.MeshStandardMaterial({ color: 0xe9e8e2, roughness: 0.5 })); back.position.z = 0.0008; g.add(back);
  const mat = canvasMat(w, h, (c, W, H) => {
    c.fillStyle = '#ecebe5'; c.fillRect(0, 0, W, H); c.fillStyle = '#121212'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const fs = H / (lines.length * 1.35); c.font = `700 ${fs}px "Times New Roman", Times, serif`;
    lines.forEach((l, i) => { let f = fs; while (c.measureText(l).width > W * 0.9 && f > 6) { f -= 1; c.font = `700 ${f}px "Times New Roman", Times, serif`; } c.fillText(l, W / 2, H * (i + 0.5) / lines.length + (i ? -H * 0.03 : H * 0.05)); c.font = `700 ${fs}px "Times New Roman", Times, serif`; });
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.002, h - 0.002), mat); face.position.z = 0.0017; g.add(face); return g;
}
// flap / gear speed limit placard, printed white on the panel colour
export function limitPlacard(w = 0.047, h = 0.053) {
  const rows = [['VLE', '', '280KT/M.67'], ['VLO', 'EXT', '250KT'], ['', 'RET', '220KT'], ['VFE', '1', '230KT'], ['', '1+F', '215KT'], ['', '2', '200KT'], ['', '3', '185KT'], ['', 'FULL', '177KT']];
  const mat = canvasMat(w, h, (c, W, H) => {
    c.fillStyle = '#7d919b'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f1f1ec'; c.textBaseline = 'middle'; const rh = H / 9.6; const fs = rh * 0.8;
    c.font = `700 ${fs}px "Panel", "Arial Narrow", Arial, sans-serif`; c.textAlign = 'left'; c.fillText('LIMIT', W * 0.06, rh * 0.75); c.fillText('SPD', W * 0.48, rh * 0.75);
    c.font = `600 ${fs * 0.6}px "Panel", "Arial Narrow", Arial, sans-serif`; c.fillText('(IAS)', W * 0.74, rh * 0.8);
    c.strokeStyle = '#f1f1ec'; c.lineWidth = Math.max(1, H * 0.006); c.beginPath(); c.moveTo(W * 0.04, rh * 1.4); c.lineTo(W * 0.96, rh * 1.4); c.stroke();
    rows.forEach(([a, b, v], i) => { const y = rh * (2.1 + i); c.font = `700 ${fs}px "Panel", "Arial Narrow", Arial, sans-serif`; c.textAlign = 'left'; c.fillText(a, W * 0.06, y); c.textAlign = 'right'; c.fillText(b, W * 0.5, y); c.textAlign = 'right';
      let f = fs; c.font = `700 ${f}px "Panel", "Arial Narrow", Arial, sans-serif`; while (c.measureText(v).width > W * 0.44 && f > 5) { f -= 1; c.font = `700 ${f}px "Panel", "Arial Narrow", Arial, sans-serif`; } c.fillText(v, W * 0.96, y); });
  }, { rough: 0.6 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.z = 0.0006; m.receiveShadow = true; return m;
}
// recessed blank below the ISIS: a shallow rounded pocket
export function blankPocket(M, w = 0.083, h = 0.104) {
  const g = new THREE.Group(); const r = 0.012;
  const rr = (W, H, R) => { const s = new THREE.Shape(); const x = W / 2, y = H / 2; s.moveTo(-x + R, y); s.lineTo(x - R, y); s.quadraticCurveTo(x, y, x, y - R); s.lineTo(x, -y + R); s.quadraticCurveTo(x, -y, x - R, -y); s.lineTo(-x + R, -y); s.quadraticCurveTo(-x, -y, -x, -y + R); s.lineTo(-x, y - R); s.quadraticCurveTo(-x, y, -x + R, y); return s; };
  const ring = rr(w + 0.004, h + 0.004, r + 0.002); ring.holes.push(rr(w, h, r));
  const lip = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.0018, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 2 }), M.module); lip.castShadow = true; g.add(lip);
  const shade = new THREE.Mesh(new THREE.ShapeGeometry(rr(w, h, r)), new THREE.MeshStandardMaterial({ color: 0x627681, roughness: 0.7 })); shade.position.z = 0.0004; shade.receiveShadow = true; g.add(shade);
  return g;
}
// LDG GEAR indicator, AUTO BRK and A/SKID & N/W STRG on one plate (right centre column, top)
export function gearBrakePlate(M, A) {
  const L = (px, py) => [(px - 1757) * 0.00026, -(py - 235) * 0.00026];
  const it = (o) => { const [x, y] = L(o.px, o.py); return { ...o, x, y }; };
  const items = [
    it({ t: 'text', px: 1690, py: 112, s: 'LDG GEAR', size: 0.0068 }),
    it({ t: 'line', px: 0, py: 0, pts: [L(1835, 100), L(1835, 212)], w: 0.0007 }),
    it({ t: 'line', px: 0, py: 0, pts: [L(1535, 228), L(1952, 228)], w: 0.0007 }),
    it({ t: 'text', px: 1690, py: 250, s: 'AUTO BRK', size: 0.0062 }),
    it({ t: 'text', px: 1602, py: 276, s: 'LO', size: 0.0042 }), it({ t: 'text', px: 1682, py: 276, s: 'MED', size: 0.0042 }), it({ t: 'text', px: 1785, py: 276, s: 'MAX', size: 0.0042 }),
    it({ t: 'pb', px: 1603, py: 330, w: 0.018, h: 0.018, legends: ['', ''], id: 'abrkLO' }), it({ t: 'pb', px: 1683, py: 330, w: 0.018, h: 0.018, legends: ['', ''], id: 'abrkMED' }), it({ t: 'pb', px: 1785, py: 330, w: 0.018, h: 0.018, legends: ['', ''], id: 'abrkMAX' }),
    it({ t: 'text', px: 1900, py: 248, s: 'A/SKID &', size: 0.0046 }), it({ t: 'text', px: 1900, py: 270, s: 'N/W STRG', size: 0.0046 }),
    it({ t: 'toggle', px: 1905, py: 322, id: 'askid' }), it({ t: 'text', px: 1956, py: 293, s: 'ON', size: 0.0038 }), it({ t: 'text', px: 1960, py: 357, s: 'OFF', size: 0.0038 }),
    it({ t: 'line', px: 0, py: 0, pts: [L(1542, 386), L(1972, 386)], w: 0.0007 }),
  ];
  for (const o of items) if (o.t === 'line') { o.pts = o.pts; delete o.px; delete o.py; }
  const p = buildPanel({ w: 0.121, h: 0.086, name: 'gearBrake', items }, M, A);
  // indicator housing: three lit green down-lock triangles in a black strip
  const [hx, hy] = L(1690, 170);
  const hs = RB(0.062, 0.02, 0.004, 0.0015, M.bezel); hs.position.set(hx, hy, 0.002); p.add(hs);
  const tri = canvasMat(0.018, 0.013, (c, W, H) => { c.fillStyle = '#041008'; c.fillRect(0, 0, W, H); c.strokeStyle = '#5dff7a'; c.lineWidth = H * 0.12; c.lineJoin = 'round'; c.beginPath(); c.moveTo(W * 0.22, H * 0.22); c.lineTo(W * 0.78, H * 0.22); c.lineTo(W * 0.5, H * 0.8); c.closePath(); c.stroke(); }, { emissive: 1.3, rough: 0.25 });
  p.userData.gearLights = [];
  for (const px of [1612, 1690, 1770]) { const [x] = L(px, 0); const l = new THREE.Mesh(new THREE.PlaneGeometry(0.017, 0.0125), tri); l.position.set(x, hy, 0.0042); p.add(l); p.userData.gearLights.push(l); }
  return p;
}
// digital clock (CHR / UTC / ET) on its chamfered plate
export function clock(M, A) {
  const g = new THREE.Group(); const L = (px, py) => [(px - 1665) * 0.00026, -(py - 582) * 0.00026];
  const pl = plate(0.086, 0.084, 0.014, 0.004, M.module); g.add(pl);
  const blk = RB(0.05, 0.068, 0.004, 0.004, M.bezel); blk.position.set(0.0005, 0, 0.0055); g.add(blk);
  const lab = (s, px, py, size = 0.0034, col = '#e9ece8', z = 0.0057) => { const [x, y] = L(px, py); const m = A.mesh(s, size, { px: 40, weight: 600, color: col }); m.position.set(x, y, z); g.add(m); return m; };
  const wins = [[1670, 500, 0.034, 0.0104], [1667, 585, 0.045, 0.013], [1670, 670, 0.034, 0.0104]];
  wins.forEach(([px, py, w, h], i) => { const [x, y] = L(px, py); const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.screen); s.position.set(x, y, 0.0078); s.name = 'clkWin' + i; g.add(s); });
  lab('CHR', 1667, 466, 0.003, '#e9ece8', 0.0078); lab('UTC', 1667, 549, 0.003, '#e9ece8', 0.0078); lab('ET', 1667, 703, 0.003, '#e9ece8', 0.0078);
  lab('RST', 1548, 469, 0.0034); lab('CHR', 1790, 466, 0.0034); lab('DATE', 1540, 614, 0.0034); lab('GPS', 1770, 549, 0.0026); lab('INT', 1806, 565, 0.0026); lab('SET', 1808, 598, 0.0026);
  lab('RUN', 1772, 633, 0.0026); lab('STP', 1808, 649, 0.0026); lab('RST', 1808, 683, 0.0026);
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc9cdcf, roughness: 0.25, metalness: 0.85 }); const cap = new THREE.MeshStandardMaterial({ color: 0xb9bec0, roughness: 0.35, metalness: 0.4 });
  const btn = (px, py, r) => { const [x, y] = L(px, py); const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.4, 0.0012, 24).rotateX(Math.PI / 2), M.bezel); ring.position.set(x, y, 0.0055); g.add(ring); const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.003, 24).rotateX(Math.PI / 2), cap); b.position.set(x, y, 0.0068); b.castShadow = true; g.add(b); };
  btn(1550, 496, 0.0038); btn(1790, 496, 0.0038); btn(1550, 585, 0.0042);
  { const [x, y] = L(1537, 540); const led = new THREE.Mesh(new THREE.CircleGeometry(0.0016, 16), new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.3 })); led.position.set(x, y, 0.0054); g.add(led); }
  const lever = (px, py, ang) => { const [x, y] = L(px, py); const lv = new THREE.Group(); lv.position.set(x, y, 0.0054);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 20).rotateX(Math.PI / 2), chrome); lv.add(base);
    const bat = new THREE.Mesh(new THREE.ConeGeometry(0.0028, 0.011, 16), chrome); bat.scale.z = 0.55; bat.position.set(0, 0.004, 0.004); bat.rotation.x = 0.6; lv.add(bat); lv.rotation.z = ang; g.add(lv); };
  lever(1786, 582, -0.35); lever(1786, 668, -0.35);
  return g;
}
// landing gear lever: chamfered plate, slot, outlined UP / DOWN arrows, black lever with its wheel handle
export function gearLeverPanel(M, A) {
  const W = '#f2f2ee';
  const up = [[0.0105, 0.0083], [0.0105, 0.023], [0.0068, 0.023], [0.0125, 0.031], [0.0182, 0.023], [0.0145, 0.023], [0.0145, 0.0083], [0.0105, 0.0083]];
  const dn = [[0.0105, -0.0008], [0.0105, -0.0325], [0.0068, -0.0325], [0.0125, -0.0405], [0.0182, -0.0325], [0.0145, -0.0325], [0.0145, -0.0008], [0.0105, -0.0008]];
  const items = [{ t: 'text', x: 0.0125, y: 0.0395, s: 'UP', size: 0.0048 }, { t: 'text', x: 0.0125, y: -0.0465, s: 'DOWN', size: 0.0046 },
    { t: 'line', pts: up, w: 0.0008, col: W }, { t: 'line', pts: dn, w: 0.0008, col: W }];
  const p = buildPanel({ w: 0.058, h: 0.103, name: 'gearPanel', items }, M, A);
  const slot = RB(0.009, 0.072, 0.003, 0.0035, new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.8 })); slot.position.set(-0.0096, -0.0115, 0.0008); p.add(slot);
  return p;
}
export function gearLever(M) {
  // pivot at the top of the slot; DOWN: the arm hangs to the bottom of the slot and the wheel stands proud of the panel
  const blk = new THREE.MeshStandardMaterial({ color: 0x0e1012, roughness: 0.35 });
  const lever = new THREE.Group();
  const arm = RB(0.0075, 0.058, 0.007, 0.0025, blk); arm.position.set(0, -0.029, 0.009); arm.rotation.x = -0.32; lever.add(arm);
  const hub = new THREE.Group(); hub.position.set(0, -0.056, 0.024); lever.add(hub);
  for (const dx of [-0.0042, 0.0042]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.0068, 36).rotateZ(Math.PI / 2), blk); w.position.x = dx; w.castShadow = true; hub.add(w);
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.0152, 0.0026, 10, 36).rotateY(Math.PI / 2), blk); tyre.position.x = dx; hub.add(tyre); }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.018, 16).rotateZ(Math.PI / 2), blk); hub.add(axle);
  return lever;
}
// triple brake and accumulator pressure indicator (ACCU PRESS / BRAKES)
export function brakeIndicator(M, A, size = 0.056) {
  const g = new THREE.Group();
  g.add(plate(size, size, size * 0.24, 0.006, M.bezel));
  const dial = canvasMat(0.046, 0.046, (c, W, H) => {
    const cx = W / 2, cy = H / 2, R = W * 0.48; c.fillStyle = '#0a0a0a'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    const amb = '#f0a447'; c.strokeStyle = amb; c.fillStyle = amb; c.lineWidth = W * 0.012; c.textAlign = 'center'; c.textBaseline = 'middle';
    const arc = (x, y, r, a0, a1, n) => { c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; c.beginPath(); c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.lineTo(x + Math.cos(a) * r * 0.84, y + Math.sin(a) * r * 0.84); c.stroke(); } };
    arc(cx, cy - H * 0.06, R * 0.62, Math.PI * 1.2, Math.PI * 1.8, 3);
    arc(cx - W * 0.17, cy + H * 0.18, R * 0.4, Math.PI * 0.95, Math.PI * 1.55, 3); arc(cx + W * 0.17, cy + H * 0.18, R * 0.4, Math.PI * 1.45, Math.PI * 2.05, 3);
    c.font = `700 ${W * 0.085}px "Panel", Arial, sans-serif`; c.fillText('ACCU', cx - W * 0.2, cy - H * 0.31); c.fillText('PRESS', cx + W * 0.2, cy - H * 0.31); c.fillText('BRAKES', cx, cy + H * 0.36);
    c.font = `700 ${W * 0.07}px "Panel", Arial, sans-serif`; c.fillText('1', cx - W * 0.34, cy + H * 0.05); c.fillText('3', cx + W * 0.34, cy + H * 0.05); c.fillText('0', cx - W * 0.33, cy + H * 0.24); c.fillText('0', cx + W * 0.33, cy + H * 0.24);
    c.strokeStyle = '#ffe2a0'; c.lineWidth = W * 0.022; c.lineCap = 'round';
    const needle = (x, y, a, l) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); };
    needle(cx, cy - H * 0.06, Math.PI * 1.72, R * 0.6); needle(cx - W * 0.17, cy + H * 0.18, Math.PI * 1.4, R * 0.38); needle(cx + W * 0.17, cy + H * 0.18, Math.PI * 1.6, R * 0.38);
    c.fillStyle = '#2a2a2a'; for (const [x, y] of [[cx, cy - H * 0.06], [cx - W * 0.17, cy + H * 0.18], [cx + W * 0.17, cy + H * 0.18]]) { c.beginPath(); c.arc(x, y, W * 0.03, 0, Math.PI * 2); c.fill(); }
  }, { emissive: 0.55, rough: 0.2 });
  const d = new THREE.Mesh(new THREE.CircleGeometry(0.022, 48), dial); d.position.z = 0.0076; g.add(d);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0228, 0.0016, 10, 48), M.bezel); rim.position.z = 0.0078; g.add(rim);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.0222, 48), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.08, clearcoat: 1, depthWrite: false })); glass.position.z = 0.0086; glass.renderOrder = 6; g.add(glass);
  return g;
}
// DCDU: grey housing, screen in the middle, BRT/DIM, MSG-/+ and two blank keys left; PRINT, PGE-/+ and two blank keys right
export function dcduUnit(M, A) {
  const g = new THREE.Group(); const L = (px, py) => [(px - 372) * 0.00026, -(py - 1340) * 0.00026];
  const house = plate(0.142, 0.088, 0.008, 0.005, new THREE.MeshStandardMaterial({ color: 0x5b6d77, roughness: 0.55 })); g.add(house);
  const surround = RB(0.094, 0.072, 0.002, 0.002, M.bezel); surround.position.z = 0.0058; g.add(surround);
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.064), M.screen); sc.position.z = 0.0071; sc.name = 'dcduScreen'; g.add(sc);
  const keyM = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.45 });
  const key = (px, py, s, w = 0.012, h = 0.0085) => { const [x, y] = L(px, py); const k = RB(w, h, 0.004, 0.0025, keyM); k.position.set(x, y, 0.0068); g.add(k);
    if (s) { const l = A.mesh(s, h * 0.42, { px: 40, weight: 700, color: '#e9ece8' }, w * 0.8); l.position.set(x, y, 0.0089); g.add(l); } return k; };
  key(150, 1240, 'BRT', 0.012, 0.0085); key(150, 1270, 'DIM', 0.012, 0.0085);
  key(150, 1322, 'MSG-'); key(150, 1357, 'MSG+'); key(150, 1402, '—'); key(150, 1449, '—');
  key(592, 1273, 'PRINT'); key(592, 1323, 'PGE-'); key(592, 1358, 'PGE+'); key(592, 1405, '—'); key(592, 1452, '—');
  { const [x, y] = L(592, 1222); const s = new THREE.Mesh(new THREE.CircleGeometry(0.0018, 16), new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.3 })); s.position.set(x, y, 0.0066); g.add(s); }
  const sg = new THREE.CylinderGeometry(0.0034, 0.0034, 0.0016, 16).rotateX(Math.PI / 2);
  for (const [px, py] of [[138, 1188], [608, 1188], [138, 1492], [608, 1492]]) { const [x, y] = L(px, py); const s = new THREE.Mesh(sg, M.bezel); s.position.set(x, y, 0.0063); g.add(s); }
  return g;
}

// standby instrument (ISIS): chamfered dark bezel; BUGS / LS on top, + / - left, ATT RST and BARO knob below
export function isis(M, A, size = 0.087) {
  const g = new THREE.Group(); const k = size / 0.087; const L = (px, py) => [(px - 512) * 0.00026 * k, -(py - 570) * 0.00026 * k];
  g.add(plate(size, size, size * 0.14, 0.008, M.bezel));
  const face = RB(size * 0.86, size * 0.86, 0.002, 0.004, new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.5 })); face.position.z = 0.0092; g.add(face);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.062 * k, 0.062 * k), M.screen); scr.position.set(0, 0, 0.0104); g.add(scr);
  const keyM = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.45 });
  const key = (px, py, w, h, s, col = '#ff9a3c') => { const [x, y] = L(px, py); const b = RB(w * k, h * k, 0.003, 0.0015, keyM); b.position.set(x, y, 0.0105); g.add(b);
    if (s) { const l = A.mesh(s, h * k * 0.55, { px: 40, weight: 700, color: col }, w * k * 0.8); l.position.set(x, y, 0.0122); g.add(l); } };
  key(455, 428, 0.014, 0.006, 'BUGS'); key(568, 428, 0.012, 0.006, 'LS');
  key(368, 515, 0.006, 0.013, '+', '#e9ece8'); key(368, 628, 0.006, 0.013, '-', '#e9ece8'); key(458, 715, 0.012, 0.006, 'RST');
  for (const [s, px, py] of [['ATT', 410, 715], ['BARO', 570, 715]]) { const [x, y] = L(px, py); const l = A.mesh(s, 0.0032 * k, { px: 40, weight: 600, color: '#e9ece8' }); l.position.set(x, y, 0.0105); g.add(l); }
  { const [x, y] = L(628, 690); const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.0075 * k, 0.008 * k, 0.008, 32).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb8bdbf, roughness: 0.35, metalness: 0.5 })); kn.position.set(x, y, 0.014); kn.castShadow = true; g.add(kn);
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.0066 * k, 32), new THREE.MeshStandardMaterial({ color: 0xd8dcdd, roughness: 0.3, metalness: 0.4 })); top.position.set(x, y, 0.0181); g.add(top); }
  { const [x, y] = L(660, 482); const s = new THREE.Mesh(new THREE.CircleGeometry(0.0016, 12), new THREE.MeshStandardMaterial({ color: 0x8c949a, roughness: 0.3 })); s.position.set(x, y, 0.0104); g.add(s); }
  g.userData.screen = scr; return g;
}
// round instrument (DDRMI / triple brake indicator) in a square case
export function roundInstrument(M, size = 0.06) {
  const g = new THREE.Group();
  const bez = new THREE.Mesh(new THREE.BoxGeometry(size, size, 0.016), M.bezel); bez.position.z = 0.008; g.add(bez);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(size * 0.4, 40), new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.35 })); dial.position.z = 0.0162; g.add(dial);
  const glass = new THREE.Mesh(new THREE.TorusGeometry(size * 0.41, size * 0.025, 8, 40), M.bezel); glass.position.z = 0.0165; g.add(glass);
  return g;
}
