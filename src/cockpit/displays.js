// Static display content (aircraft parked, systems powered): PFD, ND, E/WD, SD (DOOR/OXY), ISIS, MCDU.
// Drawn on canvases and applied as emissive screen textures. Phase 2 will animate these.
import * as THREE from 'three';

const C = { bg: '#04060a', w: '#f2f2f2', g: '#2ee86a', a: '#ff9a1e', c: '#22d3f2', m: '#ff4fd8', y: '#ffe23a', sky: '#2c8ad8', gnd: '#8a4a1c', r: '#ff2a2a' };
const FONT = '"B612", "B612 Mono", sans-serif';

// drawn at 2x (1024 px for a main display) so symbology stays sharp up close; drawing code works in 512 units
function canvas(n = 512) { const cv = document.createElement('canvas'); cv.width = cv.height = n * 2; const c = cv.getContext('2d'); c.scale(2, 2); c.fillStyle = C.bg; c.fillRect(0, 0, n, n); c.lineCap = 'round'; return [cv, c]; }
function txt(c, s, x, y, col, px, align = 'center') { c.fillStyle = col; c.font = `600 ${px}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y); }

function pfd(side) {
  const [cv, c] = canvas();
  const G = '#4d5258', thin = 1.4;
  // FMA: five columns
  c.strokeStyle = '#7a7e82'; c.lineWidth = 1.5; for (const x of [100, 200, 300, 400]) { c.beginPath(); c.moveTo(x, 6); c.lineTo(x, 66); c.stroke(); }
  txt(c, '1 FD 2', 452, 36, C.w, 17); txt(c, 'A/THR', 452, 56, C.w, 15);
  // attitude: sky over ground inside the familiar clipped shape
  const cx = 256, cy = 250, pp = 5.2;   // px per degree of pitch
  c.save(); c.beginPath(); c.moveTo(152, 132); c.quadraticCurveTo(cx, 96, 360, 132); c.lineTo(360, 368); c.quadraticCurveTo(cx, 404, 152, 368); c.closePath(); c.clip();
  c.fillStyle = '#2f86e0'; c.fillRect(140, 80, 232, cy - 80); c.fillStyle = '#8a4b1d'; c.fillRect(140, cy, 232, 180);
  c.strokeStyle = C.w; c.lineWidth = 2.5; c.beginPath(); c.moveTo(140, cy); c.lineTo(372, cy); c.stroke();
  c.lineWidth = thin;
  for (let d = -30; d <= 30; d += 2.5) { if (!d) continue; const y = cy - d * pp; const w = d % 10 === 0 ? 64 : d % 5 === 0 ? 36 : 16; c.beginPath(); c.moveTo(cx - w / 2, y); c.lineTo(cx + w / 2, y); c.stroke();
    if (d % 10 === 0) { txt(c, String(Math.abs(d)), cx - w / 2 - 14, y, C.w, 14); txt(c, String(Math.abs(d)), cx + w / 2 + 14, y, C.w, 14); } }
  // heading ticks along the horizon
  for (let k = -4; k <= 4; k++) { c.beginPath(); c.moveTo(cx + k * 26, cy); c.lineTo(cx + k * 26, cy + 7); c.stroke(); }
  c.restore();
  // bank scale: ticks at 0, 10, 20, 30, 45 and the fixed yellow index; roll pointer and slip index
  c.strokeStyle = C.w; c.lineWidth = 2;
  for (const a of [-45, -30, -20, -10, 10, 20, 30, 45]) { const r = THREE.MathUtils.degToRad(a - 90), R0 = 140, R1 = Math.abs(a) % 30 === 0 || Math.abs(a) === 45 ? 156 : 150;
    c.beginPath(); c.moveTo(cx + Math.cos(r) * R0, cy + Math.sin(r) * R0); c.lineTo(cx + Math.cos(r) * R1, cy + Math.sin(r) * R1); c.stroke(); }
  c.fillStyle = C.y; c.beginPath(); c.moveTo(cx, cy - 140); c.lineTo(cx - 9, cy - 156); c.lineTo(cx + 9, cy - 156); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(cx, cy - 138); c.lineTo(cx - 9, cy - 124); c.lineTo(cx + 9, cy - 124); c.closePath(); c.fill(); c.fillRect(cx - 10, cy - 121, 20, 5);
  // aircraft symbol: yellow with black outline
  c.lineWidth = 1.5; c.strokeStyle = '#000';
  for (const s2 of [-1, 1]) { const x0 = cx + s2 * 52; c.fillStyle = C.y; c.beginPath(); c.rect(s2 < 0 ? x0 - 46 : x0, cy - 4, 46, 8); c.fill(); c.stroke(); c.beginPath(); c.rect(s2 < 0 ? x0 - 8 : x0, cy - 4, 8, 20); c.fill(); c.stroke(); }
  c.fillStyle = C.y; c.beginPath(); c.rect(cx - 5, cy - 5, 10, 10); c.fill(); c.stroke();
  // speed tape: grey band, ticks every 10 kt, labels every 20, yellow speed reference, 30 kt floor
  c.fillStyle = G; c.fillRect(24, 100, 78, 300); c.strokeStyle = C.w; c.lineWidth = thin; c.beginPath(); c.moveTo(24, 100); c.lineTo(102, 100); c.moveTo(102, 100); c.lineTo(102, 400); c.moveTo(24, 400); c.lineTo(102, 400); c.stroke();
  for (let v = 40; v <= 100; v += 10) { const y = cy - (v - 40) * 2.6 - 0; if (y < 104 || Math.abs(y - cy) < 12) continue; c.beginPath(); c.moveTo(90, y); c.lineTo(102, y); c.stroke(); if (v % 20 === 0) txt(c, String(v).padStart(3, '0'), 58, y, C.w, 18); }
  c.fillStyle = C.y; c.fillRect(18, cy - 2, 96, 4); c.beginPath(); c.moveTo(102, cy); c.lineTo(114, cy - 7); c.lineTo(114, cy + 7); c.closePath(); c.fill();
  // altitude tape with the yellow-framed readout window and the drum
  c.fillStyle = G; c.fillRect(398, 100, 62, 300); c.strokeStyle = C.w; c.beginPath(); c.moveTo(398, 100); c.lineTo(460, 100); c.moveTo(398, 400); c.lineTo(460, 400); c.moveTo(398, 100); c.lineTo(398, 400); c.stroke();
  for (let k = -5; k <= 5; k++) { const y = cy + k * 30; c.beginPath(); c.moveTo(398, y); c.lineTo(408, y); c.stroke(); if (k % 2 === 0 && k) txt(c, String(-k * 5 * 10 / 10 * 10 < 0 ? '' : '').padStart(0), 0, 0, C.w, 1); }
  txt(c, '005', 426, cy - 60, C.w, 17); txt(c, '995', 426, cy + 60, C.w, 17);
  c.fillStyle = '#000'; c.fillRect(402, cy - 20, 48, 40); c.strokeStyle = C.y; c.lineWidth = 2; c.strokeRect(402, cy - 20, 48, 40); txt(c, '00', 424, cy, C.g, 21);
  c.fillStyle = '#000'; c.fillRect(450, cy - 30, 22, 60); c.strokeRect(450, cy - 30, 22, 60); txt(c, '20', 461, cy - 18, C.g, 14); txt(c, '00', 461, cy, C.g, 16); txt(c, '80', 461, cy + 18, C.g, 14);
  // V/S scale
  c.fillStyle = G; c.beginPath(); c.moveTo(476, 120); c.lineTo(500, 140); c.lineTo(500, 360); c.lineTo(476, 380); c.closePath(); c.fill();
  c.strokeStyle = C.w; c.lineWidth = thin; for (const k of [-3, -2, -1, 0, 1, 2, 3]) { const y = cy - k * 34; c.beginPath(); c.moveTo(478, y); c.lineTo(k ? 486 : 492, y); c.stroke(); if (k && Math.abs(k) !== 3) txt(c, String(Math.abs(k)), 471, y, C.w, 12); }
  c.strokeStyle = C.g; c.lineWidth = 3; c.beginPath(); c.moveTo(482, cy); c.lineTo(510, cy); c.stroke();
  // heading tape
  c.fillStyle = G; c.fillRect(150, 432, 212, 40); c.strokeStyle = C.w; c.lineWidth = thin; c.strokeRect(150, 432, 212, 40);
  for (let hdg = 30; hdg <= 80; hdg += 5) { const x = cx + (hdg - 54) * 4.2; if (x < 152 || x > 360) continue; c.beginPath(); c.moveTo(x, 432); c.lineTo(x, hdg % 10 ? 440 : 446); c.stroke(); if (hdg % 10 === 0) txt(c, String(hdg / 10), x, 458, C.w, 17); }
  c.fillStyle = C.y; c.fillRect(cx - 2, 420, 4, 30);
  txt(c, 'QNH', 410, 498, C.c, 15, 'right'); txt(c, '1013', 452, 498, C.c, 16, 'right');
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
  // engines shut down: amber XX in every gauge, memo in green
  const [cv, c] = canvas();
  const xx = (x, y, px = 22) => txt(c, 'XX', x, y, C.a, px);
  const gauge = (x, y, r) => { c.strokeStyle = C.a; c.lineWidth = 3.5; c.beginPath(); c.arc(x, y, r, Math.PI * 0.92, Math.PI * 2.02); c.stroke(); };
  for (const x of [190, 340]) { gauge(x, 70, 40); xx(x, 64); xx(x + 16, 92, 18); gauge(x, 172, 34); xx(x, 186, 19); gauge(x, 254, 40); xx(x + 16, 272, 19); }
  txt(c, 'EPR', 266, 66, C.w, 20); txt(c, 'EGT', 266, 158, C.w, 20); txt(c, '°C', 266, 176, C.c, 15); txt(c, 'N1', 266, 254, C.w, 20); txt(c, '%', 266, 272, C.c, 15);
  xx(466, 40, 19);
  txt(c, 'FF', 36, 158, C.w, 18, 'left'); txt(c, 'KG/H', 66, 158, C.c, 14, 'left'); xx(56, 180, 18);
  txt(c, 'FF', 420, 158, C.w, 18, 'left'); txt(c, 'KG/H', 450, 158, C.c, 14, 'left'); xx(440, 180, 18);
  txt(c, 'N2', 40, 236, C.w, 18, 'left'); txt(c, '%', 74, 236, C.c, 15, 'left'); xx(56, 256, 18);
  txt(c, 'N2', 428, 236, C.w, 18, 'left'); txt(c, '%', 462, 236, C.c, 15, 'left'); xx(444, 256, 18);
  c.strokeStyle = C.g; c.lineWidth = 3; c.beginPath(); c.moveTo(332, 312); c.lineTo(350, 302); c.lineTo(374, 306); c.lineTo(370, 316); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(352, 304); c.lineTo(352, 314); c.stroke();
  txt(c, 'FOB :', 16, 346, C.w, 22, 'left'); txt(c, '19080', 104, 346, C.g, 24, 'left'); txt(c, 'KG', 192, 348, C.c, 17, 'left');
  c.strokeStyle = C.w; c.lineWidth = 3; c.beginPath(); c.moveTo(8, 372); c.lineTo(296, 372); c.moveTo(330, 372); c.lineTo(504, 372); c.moveTo(316, 384); c.lineTo(316, 496); c.stroke();
  txt(c, 'COMPANY DATALINK STBY', 14, 394, C.g, 19, 'left');
  ['PARK BRK', 'TCAS STBY', 'VHF3 VOICE'].forEach((s, i) => txt(c, s, 336, 394 + i * 22, C.g, 19, 'left'));
  c.lineWidth = 2; c.strokeRect(296, 484, 40, 22); txt(c, 'STS', 316, 495, C.w, 15);
  return cv;
}

function sd() {
  const [cv, c] = canvas();
  txt(c, 'DOOR/OXY', 256, 26, C.w, 26); c.strokeStyle = C.w; c.lineWidth = 2; c.beginPath(); c.moveTo(188, 44); c.lineTo(324, 44); c.stroke();
  txt(c, 'CKPT OXY', 430, 22, C.w, 18); txt(c, '1740', 410, 46, C.g, 20); txt(c, 'PSI', 462, 48, C.c, 15);
  c.strokeStyle = C.w; c.lineWidth = 2.5;   // slim fuselage outline
  c.beginPath(); c.moveTo(256, 64); c.quadraticCurveTo(290, 74, 292, 120); c.lineTo(292, 448); c.quadraticCurveTo(292, 462, 280, 462); c.lineTo(232, 462); c.quadraticCurveTo(220, 462, 220, 448); c.lineTo(220, 120); c.quadraticCurveTo(222, 74, 256, 64); c.stroke();
  c.beginPath(); c.moveTo(220, 280); c.lineTo(110, 322); c.moveTo(292, 280); c.lineTo(402, 322); c.stroke();
  c.strokeStyle = C.g; c.lineWidth = 3;
  c.strokeRect(246, 86, 20, 12);
  for (const [x, y] of [[236, 112], [266, 112], [272, 160], [246, 196], [270, 220], [230, 302], [270, 302], [230, 330], [270, 330], [270, 374], [270, 398], [230, 436], [270, 436]]) c.strokeRect(x, y, 12, 20);
  c.fillStyle = C.a; c.fillRect(224, 160, 12, 22); txt(c, 'CABIN', 96, 170, C.a, 18, 'left');
  c.strokeStyle = C.a; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(160, 170); c.lineTo(222, 170); c.stroke(); c.setLineDash([]);
  txt(c, 'SLIDE', 168, 316, C.w, 16); txt(c, 'SLIDE', 344, 316, C.w, 16);
  c.strokeStyle = C.w; c.lineWidth = 2.5; c.beginPath(); c.moveTo(10, 470); c.lineTo(502, 470); c.moveTo(172, 470); c.lineTo(172, 510); c.moveTo(340, 470); c.lineTo(340, 510); c.stroke();
  txt(c, 'TAT', 18, 482, C.w, 15, 'left'); txt(c, '+11', 72, 482, C.g, 16, 'left'); txt(c, '°C', 136, 482, C.c, 14, 'left');
  txt(c, 'SAT', 18, 500, C.w, 15, 'left'); txt(c, '+11', 72, 500, C.g, 16, 'left'); txt(c, '°C', 136, 500, C.c, 14, 'left');
  txt(c, '09', 228, 492, C.g, 20); txt(c, 'H', 256, 494, C.c, 14); txt(c, '27', 284, 492, C.g, 20);
  txt(c, 'GW', 352, 482, C.w, 15, 'left'); txt(c, '--', 412, 482, C.g, 16, 'left'); txt(c, 'KG', 492, 482, C.c, 14, 'right');
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
  c.save(); c.beginPath(); c.rect(40, 18, 176, 200); c.clip(); c.fillStyle = C.sky; c.fillRect(40, 18, 176, 104); c.fillStyle = C.gnd; c.fillRect(40, 122, 176, 100);
  c.strokeStyle = C.w; c.lineWidth = 2; c.beginPath(); c.moveTo(40, 122); c.lineTo(216, 122); c.stroke();
  for (const [d, w] of [[-44, 60], [-22, 28], [22, 28], [44, 60]]) { c.beginPath(); c.moveTo(128 - w / 2, 122 + d); c.lineTo(128 + w / 2, 122 + d); c.stroke(); if (w > 40) { txt(c, '10', 128 - w / 2 - 12, 122 + d, C.w, 12); txt(c, '10', 128 + w / 2 + 12, 122 + d, C.w, 12); } }
  c.beginPath(); c.arc(128, 122, 92, Math.PI * 1.3, Math.PI * 1.7); c.stroke(); c.fillStyle = C.y; c.beginPath(); c.moveTo(128, 34); c.lineTo(122, 44); c.lineTo(134, 44); c.closePath(); c.fill();
  c.restore();
  c.fillStyle = '#3d4248'; c.fillRect(6, 18, 34, 200); c.fillRect(216, 18, 40, 200);
  c.strokeStyle = C.w; c.lineWidth = 2; for (let i = 0; i < 9; i++) { const y = 26 + i * 24; c.beginPath(); c.moveTo(32, y); c.lineTo(40, y); c.stroke(); c.beginPath(); c.moveTo(216, y); c.lineTo(224, y); c.stroke(); }
  txt(c, '60', 20, 50, C.w, 15); txt(c, '40', 20, 98, C.w, 15);
  txt(c, '010', 238, 30, C.w, 13); txt(c, '000', 238, 214, C.w, 13);
  c.fillStyle = '#000'; c.fillRect(212, 110, 44, 24); c.strokeStyle = C.y; c.lineWidth = 2; c.strokeRect(212, 110, 44, 24); txt(c, '500', 234, 122, C.g, 16);
  c.fillStyle = C.y; c.fillRect(76, 118, 34, 7); c.fillRect(146, 118, 34, 7); c.fillRect(124, 118, 8, 8);
  c.fillRect(4, 120, 38, 4);
  txt(c, '1003', 82, 238, C.c, 16);
  return cv;
}

function seg(text, w, h, col = '#ffb02e', bg = '#0a0f0c') {   // segmented-display window texture
  const cv = document.createElement('canvas'); cv.width = Math.round(w * 6000); cv.height = Math.round(h * 6000); const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height); let fs = cv.height * 0.72; c.font = `600 ${fs}px "B612 Mono", monospace`;
  while (c.measureText(text).width > cv.width * 0.92 && fs > 6) { fs -= 1; c.font = `600 ${fs}px "B612 Mono", monospace`; }
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, cv.width / 2, cv.height * 0.54); return cv;
}
function dcdu() {
  const [cv, c] = canvas(256); c.fillStyle = '#05070a'; c.fillRect(0, 0, 256, 256);
  c.strokeStyle = C.w; c.lineWidth = 2; c.beginPath(); c.moveTo(12, 168); c.lineTo(244, 168); c.moveTo(80, 176); c.lineTo(80, 246); c.moveTo(176, 176); c.lineTo(176, 246); c.stroke();
  txt(c, 'COM NOT AVAIL', 128, 196, C.a, 15); return cv;
}
export function paintDisplays(scene, refs) {
  const apply = (mesh, cv, bright = 1.0) => {
    if (!mesh) return; const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
    const m = new THREE.MeshPhysicalMaterial({ color: 0x050607, map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: bright * 1.35, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 0.35 });
    // LCD: faint RGB sub-pixel stripes and pixel grid visible up close, slightly lifted blacks, a touch of edge falloff
    const px = cv.width;
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec2 q = vEmissiveMapUv * ${px.toFixed(1)}; float sp = fract(q.x) * 3.0; vec3 sub = vec3(step(sp, 1.0), step(1.0, sp) * step(sp, 2.0), step(2.0, sp));
          float grid = smoothstep(0.0, 0.12, fract(q.y)) * smoothstep(0.0, 0.08, fract(q.x));
          float near = 1.0 - smoothstep(0.25, 0.6, max(fwidth(q.x), fwidth(q.y)));   // pixel structure only when it is larger than a screen pixel (no moire)
          totalEmissiveRadiance *= mix(vec3(1.0), sub * 2.2, 0.18 * near) * mix(1.0, mix(0.82, 1.0, grid), near);
          vec2 e = abs(vEmissiveMapUv - 0.5) * 2.0; totalEmissiveRadiance *= 1.0 - 0.12 * pow(max(e.x, e.y), 4.0);
          totalEmissiveRadiance += vec3(0.004, 0.005, 0.007); }`);
    };
    m.customProgramCacheKey = () => 'lcd' + px;
    mesh.material = m;
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
  if (refs.clock) refs.clock.traverse((m) => { if (m.name === 'clkWin1') apply(m, seg('09:27 28', 0.045, 0.013, '#e8f0f4', '#081224'), 0.75); else if (m.name === 'clkWin0' || m.name === 'clkWin2') apply(m, seg('', 0.034, 0.0104, '#e8f0f4', '#0a1a3a'), 0.5); });
  (refs.dcdu || []).forEach((u) => u.traverse((m) => { if (m.name === 'dcduScreen') apply(m, dcdu(), 0.7); }));
}
