// Static display content (aircraft parked, systems powered): PFD, ND, E/WD, SD (DOOR/OXY), ISIS, MCDU.
// Drawn on canvases and applied as emissive screen textures. Phase 2 will animate these.
import * as THREE from 'three';

const C = { bg: '#04060a', w: '#f2f2f2', g: '#2ee86a', a: '#ff9a1e', c: '#22d3f2', m: '#ff4fd8', y: '#ffe23a', sky: '#2c8ad8', gnd: '#8a4a1c', r: '#ff2a2a' };
const FONT = '"B612", "B612 Mono", sans-serif';

function canvas(n = 512) { const cv = document.createElement('canvas'); cv.width = cv.height = n; const c = cv.getContext('2d'); c.fillStyle = C.bg; c.fillRect(0, 0, n, n); c.lineCap = 'round'; return [cv, c]; }
function txt(c, s, x, y, col, px, align = 'center') { c.fillStyle = col; c.font = `600 ${px}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y); }

function pfd(side) {
  const [cv, c] = canvas();
  // FMA boxes
  c.strokeStyle = '#6b6f73'; c.lineWidth = 2; for (const x of [96, 192, 288, 384]) { c.beginPath(); c.moveTo(x, 8); c.lineTo(x, 62); c.stroke(); }
  txt(c, 'V/S', 145, 22, C.g, 20); txt(c, '0', 186, 22, C.c, 18); txt(c, 'HDG', 238, 22, C.g, 20); txt(c, side < 0 ? '1 FD 2' : '1 FD 2', 448, 22, C.w, 18);
  // attitude sphere: sky over ground, clipped
  c.save(); c.beginPath(); c.moveTo(150, 120); c.quadraticCurveTo(256, 76, 362, 120); c.lineTo(362, 360); c.quadraticCurveTo(256, 420, 150, 360); c.closePath(); c.clip();
  c.fillStyle = C.sky; c.fillRect(140, 70, 230, 186); c.fillStyle = C.gnd; c.fillRect(140, 256, 230, 170);
  c.strokeStyle = C.w; c.lineWidth = 3; c.beginPath(); c.moveTo(140, 256); c.lineTo(370, 256); c.stroke();
  for (const [d, w] of [[-60, 70], [-40, 34], [-20, 70], [20, 70], [40, 34], [60, 70]]) { c.lineWidth = 2; c.beginPath(); c.moveTo(256 - w / 2, 256 + d); c.lineTo(256 + w / 2, 256 + d); c.stroke(); if (w > 50) { txt(c, '10', 256 - w / 2 - 16, 256 + d, C.w, 14); txt(c, '10', 256 + w / 2 + 16, 256 + d, C.w, 14); } }
  c.restore();
  // aircraft symbol and roll pointer
  c.fillStyle = C.y; c.strokeStyle = '#000'; c.lineWidth = 2;
  for (const s of [-1, 1]) { c.fillRect(256 + s * 46 - (s < 0 ? 40 : 0), 252, 40, 8); c.fillRect(256 + s * 46 + (s < 0 ? -8 : 0), 252, 8, 18); }
  c.fillRect(252, 252, 8, 8); c.beginPath(); c.moveTo(256, 92); c.lineTo(246, 110); c.lineTo(266, 110); c.closePath(); c.fill();
  c.strokeStyle = C.w; c.lineWidth = 2; c.beginPath(); c.arc(256, 256, 166, Math.PI * 1.33, Math.PI * 1.67); c.stroke();
  // speed tape
  c.fillStyle = '#3d4248'; c.fillRect(28, 96, 76, 320); c.strokeStyle = C.w; c.strokeRect(28, 96, 76, 320);
  for (let i = 0; i < 7; i++) { const y = 120 + i * 46; c.beginPath(); c.moveTo(90, y); c.lineTo(104, y); c.stroke(); if (i % 2 === 0) txt(c, String(100 - (i - 3) * 20).padStart(3, '0'), 62, y, C.w, 18); }
  c.fillStyle = C.y; c.fillRect(20, 254, 92, 4);
  // altitude tape
  c.fillStyle = '#3d4248'; c.fillRect(392, 96, 72, 320); c.strokeRect(392, 96, 72, 320);
  for (let i = 0; i < 7; i++) { const y = 120 + i * 46; c.beginPath(); c.moveTo(392, y); c.lineTo(404, y); c.stroke(); }
  c.fillStyle = '#000'; c.fillRect(398, 238, 60, 36); c.strokeStyle = C.y; c.strokeRect(398, 238, 60, 36); txt(c, '00', 428, 256, C.g, 20);
  txt(c, '010', 428, 120, C.w, 16); c.fillStyle = C.r; c.fillRect(392, 330, 8, 86);
  // V/S scale and heading tape
  c.strokeStyle = C.w; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(474, 140 + i * 30); c.lineTo(484, 140 + i * 30); c.stroke(); }
  c.fillStyle = '#3d4248'; c.fillRect(160, 452, 192, 36); c.strokeRect(160, 452, 192, 36);
  ['3', '4', '5', '6', '7'].forEach((s, i) => { c.beginPath(); c.moveTo(176 + i * 40, 452); c.lineTo(176 + i * 40, 464); c.stroke(); txt(c, s, 176 + i * 40, 476, C.w, 16); });
  c.fillStyle = C.y; c.fillRect(254, 440, 4, 26);
  txt(c, 'QNH 1013', 430, 470, C.c, 16);
  return cv;
}

function nd() {
  const [cv, c] = canvas();
  txt(c, 'GS', 30, 22, C.w, 16, 'left'); txt(c, '0', 72, 22, C.g, 18); txt(c, 'TAS', 100, 22, C.w, 16, 'left'); txt(c, '---', 140, 22, C.g, 16, 'left');
  txt(c, '2000 323°', 490, 22, C.w, 18, 'right'); txt(c, '1.8 NM', 490, 44, C.g, 16, 'right');
  c.strokeStyle = C.w; c.lineWidth = 2.5; c.beginPath(); c.arc(256, 268, 170, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2; const l = i % 2 ? 8 : 16; c.beginPath(); c.moveTo(256 + Math.sin(a) * 170, 268 - Math.cos(a) * 170); c.lineTo(256 + Math.sin(a) * (170 - l), 268 - Math.cos(a) * (170 - l)); c.stroke(); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; txt(c, String(i * 3), 256 + Math.sin(a) * 146, 268 - Math.cos(a) * 146, C.w, i % 3 ? 16 : 22); }
  c.setLineDash([10, 10]); c.beginPath(); c.arc(256, 268, 85, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  c.strokeStyle = C.g; c.lineWidth = 3; c.beginPath(); c.moveTo(250, 300); c.lineTo(276, 210); c.lineTo(470, 196); c.stroke();
  c.fillStyle = C.y; c.fillRect(252, 254, 8, 36); c.fillRect(234, 266, 44, 6); c.fillRect(246, 284, 20, 4);
  c.beginPath(); c.moveTo(256, 92); c.lineTo(246, 76); c.lineTo(266, 76); c.closePath(); c.fill();
  c.strokeStyle = C.c; c.lineWidth = 2; c.beginPath(); c.moveTo(232, 300); c.lineTo(236, 308); c.stroke(); txt(c, 'LFBO', 296, 300, C.w, 14);
  c.strokeStyle = C.w; c.strokeRect(150, 478, 212, 26); txt(c, 'GPS PRIMARY', 256, 491, C.g, 16);
  return cv;
}

function ewd() {
  const [cv, c] = canvas();
  for (const [x, lab] of [[130, 'N1'], [382, 'N1']]) {
    c.strokeStyle = C.w; c.lineWidth = 3; c.beginPath(); c.arc(x, 96, 58, Math.PI * 0.85, Math.PI * 2.15); c.stroke();
    c.strokeStyle = C.r; c.beginPath(); c.arc(x, 96, 58, Math.PI * 2.05, Math.PI * 2.15); c.stroke();
    c.strokeStyle = C.g; c.lineWidth = 4; c.beginPath(); c.moveTo(x, 96); c.lineTo(x - 50, 120); c.stroke();
    txt(c, '19.5', x + 20, 128, C.g, 22);
    c.strokeStyle = C.w; c.lineWidth = 3; c.beginPath(); c.arc(x, 220, 48, Math.PI * 0.85, Math.PI * 2.0); c.stroke();
    txt(c, '402', x + 12, 246, C.g, 20);
  }
  txt(c, 'N1', 256, 96, C.w, 20); txt(c, '%', 256, 118, C.c, 16); txt(c, 'EGT', 256, 220, C.w, 20); txt(c, '°C', 256, 242, C.c, 16);
  txt(c, '58.8', 130, 300, C.g, 22); txt(c, 'N2', 256, 300, C.w, 20); txt(c, '58.6', 382, 300, C.g, 22);
  txt(c, '280', 130, 334, C.g, 22); txt(c, 'FF', 256, 334, C.w, 20); txt(c, '280', 382, 334, C.g, 22);
  txt(c, 'FOB :', 24, 376, C.w, 20, 'left'); txt(c, '9520 KG', 110, 376, C.g, 22, 'left');
  txt(c, 'S', 380, 372, C.w, 18); txt(c, 'F', 430, 372, C.w, 18); c.strokeStyle = C.w; c.lineWidth = 2; c.strokeRect(400, 360, 20, 24);
  c.beginPath(); c.moveTo(16, 400); c.lineTo(496, 400); c.stroke();
  txt(c, 'SEAT BELTS', 24, 430, C.g, 18, 'left'); txt(c, 'NO SMOKING', 24, 456, C.g, 18, 'left'); txt(c, 'PARK BRK', 300, 430, C.g, 18, 'left');
  return cv;
}

function sd() {
  const [cv, c] = canvas();
  txt(c, 'DOOR/OXY', 256, 30, C.w, 24); c.strokeStyle = C.w; c.lineWidth = 2; c.beginPath(); c.moveTo(196, 46); c.lineTo(316, 46); c.stroke();
  txt(c, 'CKPT OXY', 400, 30, C.w, 16); txt(c, '1740', 400, 54, C.g, 18);
  c.strokeStyle = C.g; c.lineWidth = 3;
  c.beginPath(); c.moveTo(256, 70); c.quadraticCurveTo(300, 90, 300, 150); c.lineTo(300, 400); c.quadraticCurveTo(300, 440, 256, 450); c.quadraticCurveTo(212, 440, 212, 400); c.lineTo(212, 150); c.quadraticCurveTo(212, 90, 256, 70); c.stroke();
  c.beginPath(); c.moveTo(212, 230); c.lineTo(110, 290); c.moveTo(300, 230); c.lineTo(402, 290); c.stroke();
  for (const y of [120, 330, 420]) for (const x of [204, 300]) c.strokeRect(x, y, 8, 22);
  txt(c, 'CABIN', 150, 120, C.c, 16); txt(c, 'SLIDE', 160, 360, C.w, 14); txt(c, 'SLIDE', 352, 360, C.w, 14);
  c.beginPath(); c.moveTo(16, 470); c.lineTo(496, 470); c.stroke();
  txt(c, 'TAT +19 °C', 24, 492, C.w, 16, 'left'); txt(c, '09 H 27', 256, 492, C.g, 18); txt(c, 'GW   KG', 488, 492, C.c, 16, 'right');
  return cv;
}

function mcdu() {
  const [cv, c] = canvas(); c.fillStyle = '#060807'; c.fillRect(0, 0, 512, 512);
  const L = [['A320-200', 'w', 'center'], ['ENG', 'w', 'left'], ['LEAP-1A26', 'g', 'left'], [' ACTIVE NAV DATA BASE', 'w', 'left'], ['27NOV-24DEC   AB12345678', 'c', 'left'], [' SECOND NAV DATA BASE', 'w', 'left'], ['30OCT-26NOV', 'c', 'left'], ['', 'w', 'left'], [' CHG CODE', 'w', 'left'], ['[  ]', 'c', 'left'], [' IDLE/PERF', 'w', 'left'], ['+0.0/+0.0          STATUS/XLOAD>', 'g', 'left'], ['', 'w', 'left']];
  L.forEach(([s, col, al], i) => txt(c, s, al === 'center' ? 256 : 14, 30 + i * 36, C[col], i % 2 ? 22 : 26, al));
  return cv;
}

function isis() {
  const [cv, c] = canvas(256);
  c.save(); c.beginPath(); c.rect(40, 30, 176, 196); c.clip(); c.fillStyle = C.sky; c.fillRect(40, 30, 176, 100); c.fillStyle = C.gnd; c.fillRect(40, 130, 176, 100); c.restore();
  c.fillStyle = '#2a2e33'; c.fillRect(0, 30, 40, 196); c.fillRect(216, 30, 40, 196);
  txt(c, '0', 20, 128, C.w, 16); txt(c, '20', 236, 128, C.w, 14);
  c.fillStyle = C.y; c.fillRect(88, 126, 30, 6); c.fillRect(138, 126, 30, 6); c.fillRect(124, 126, 8, 8);
  txt(c, '1013 HPA', 128, 242, C.c, 14);
  return cv;
}

function seg(text, w, h, col = '#ffb02e', bg = '#0a0f0c') {   // segmented-display window texture
  const cv = document.createElement('canvas'); cv.width = Math.round(w * 6000); cv.height = Math.round(h * 6000); const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height); let fs = cv.height * 0.72; c.font = `600 ${fs}px "B612 Mono", monospace`;
  while (c.measureText(text).width > cv.width * 0.92 && fs > 6) { fs -= 1; c.font = `600 ${fs}px "B612 Mono", monospace`; }
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, cv.width / 2, cv.height * 0.54); return cv;
}
function dcdu() {
  const [cv, c] = canvas(256); c.fillStyle = '#06080a'; c.fillRect(0, 0, 256, 256);
  txt(c, 'NO ACTIVE ATC', 128, 40, C.w, 18); c.strokeStyle = C.w; c.lineWidth = 2; c.strokeRect(70, 26, 116, 28);
  txt(c, 'MSG -/-', 210, 230, C.w, 16); return cv;
}
export function paintDisplays(scene, refs) {
  const apply = (mesh, cv, bright = 1.0) => {
    if (!mesh) return; const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
    mesh.material = new THREE.MeshPhysicalMaterial({ color: 0x000000, map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: bright, roughness: 0.35, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  };
  const S = refs.screens || {};
  apply(S.PFD1, pfd(-1)); apply(S.PFD2, pfd(1)); apply(S.ND1, nd()); apply(S.ND2, nd()); apply(S.EWD, ewd()); apply(S.SD, sd()); apply(S.ISIS, isis(), 0.9);
  scene.traverse((o) => { if (o.name === 'mcduScreen') apply(o, mcdu(), 0.85); });
  // small windows: RMP frequencies, rudder trim, clock, DCDUs
  scene.traverse((o) => {
    if (o.name === 'rmpWin') apply(o, seg(o.position.x < 0 ? '123.125' : '121.825', 0.05, 0.013), 0.7);
    if (o.name === 'rudTrimWin') apply(o, seg('R 0.0', 0.04, 0.013), 0.7);
    if (o.name === 'atcWin') apply(o, seg('7000', 0.045, 0.022), 0.7);
  });
  if (refs.clock) { const scr = refs.clock.children.filter((c) => c.isMesh && c.geometry.type === 'PlaneGeometry'); const T = ['', '09:27 28', '']; scr.forEach((m, i) => apply(m, seg(T[i] || '', 0.04, 0.016, '#e8f0f4', '#0b1220'), 0.6)); }
  (refs.dcdu || []).forEach((u) => u.children.forEach((m) => { if (m.isMesh && m.geometry.type === 'PlaneGeometry') apply(m, dcdu(), 0.7); }));
}
