// Static display content (aircraft parked, systems powered): PFD, ND, E/WD, SD (DOOR/OXY), ISIS, MCDU.
// Drawn on canvases and applied as emissive screen textures. Phase 2 will animate these.
import * as THREE from 'three';
import { ewd as ewdDraw, sd as sdDraw, selfTest, isisInit } from './ecam.js';

const C = { bg: '#04060a', w: '#f2f2f2', g: '#2ee86a', a: '#ff9a1e', c: '#22d3f2', m: '#ff4fd8', y: '#ffe23a', sky: '#2c8ad8', gnd: '#8a4a1c', r: '#ff2a2a' };
const FONT = '"B612", "B612 Mono", sans-serif';

// drawn at 2x (1024 px for a main display) so symbology stays sharp up close; drawing code works in 512 units
function canvas(n = 512) { const cv = document.createElement('canvas'); cv.width = cv.height = n * 2; const c = cv.getContext('2d'); c.scale(2, 2); c.fillStyle = C.bg; c.fillRect(0, 0, n, n); c.lineCap = 'round'; return [cv, c]; }
function txt(c, s, x, y, col, px, align = 'center') { c.fillStyle = col; c.font = `600 ${px}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y); }

const FIELD_ELEV = 780;   // ft, the airfield the cockpit stands on
function pfd(side, baro = null) {
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
  // altitude tape: ticks every 100 ft, labels every 500 ft (in hundreds), yellow-framed window with the
  // hundreds and the tens drum; indicated altitude follows the baro setting (airfield elevation 780 ft, QNH 1013)
  const alt = baro && baro.std ? FIELD_ELEV : FIELD_ELEV + ((baro ? baro.hpa : 1013) - 1013) * 27.3;
  c.fillStyle = G; c.fillRect(398, 100, 62, 300); c.strokeStyle = C.w; c.lineWidth = thin; c.beginPath(); c.moveTo(398, 100); c.lineTo(460, 100); c.moveTo(398, 400); c.lineTo(460, 400); c.moveTo(398, 100); c.lineTo(398, 400); c.stroke();
  c.save(); c.beginPath(); c.rect(398, 100, 62, 300); c.clip();
  for (let a = Math.floor((alt - 600) / 100) * 100; a <= alt + 600; a += 100) { const y = cy - (a - alt) * 0.3; c.beginPath(); c.moveTo(398, y); c.lineTo(408, y); c.stroke(); if (a % 500 === 0 && Math.abs(y - cy) > 24) txt(c, String(Math.max(0, a / 100)).padStart(3, '0'), 430, y, C.w, 17); }
  c.restore();
  const a10 = Math.round(alt / 20) * 20; const hund = Math.floor(a10 / 100), tens = ((a10 % 100) + 100) % 100;
  c.fillStyle = '#000'; c.fillRect(402, cy - 20, 48, 40); c.strokeStyle = C.y; c.lineWidth = 2; c.strokeRect(402, cy - 20, 48, 40); txt(c, String(hund).padStart(2, '0'), 426, cy, C.g, 21);
  c.fillStyle = '#000'; c.fillRect(450, cy - 30, 22, 60); c.strokeRect(450, cy - 30, 22, 60);
  const dr = (v) => String(((v % 100) + 100) % 100).padStart(2, '0'); txt(c, dr(tens + 20), 461, cy - 18, C.g, 14); txt(c, dr(tens), 461, cy, C.g, 16); txt(c, dr(tens - 20), 461, cy + 18, C.g, 14);
  // V/S scale
  c.fillStyle = G; c.beginPath(); c.moveTo(476, 120); c.lineTo(500, 140); c.lineTo(500, 360); c.lineTo(476, 380); c.closePath(); c.fill();
  c.strokeStyle = C.w; c.lineWidth = thin; for (const k of [-3, -2, -1, 0, 1, 2, 3]) { const y = cy - k * 34; c.beginPath(); c.moveTo(478, y); c.lineTo(k ? 486 : 492, y); c.stroke(); if (k && Math.abs(k) !== 3) txt(c, String(Math.abs(k)), 471, y, C.w, 12); }
  c.strokeStyle = C.g; c.lineWidth = 3; c.beginPath(); c.moveTo(482, cy); c.lineTo(510, cy); c.stroke();
  // heading tape
  c.fillStyle = G; c.fillRect(150, 432, 212, 40); c.strokeStyle = C.w; c.lineWidth = thin; c.strokeRect(150, 432, 212, 40);
  for (let hdg = 30; hdg <= 80; hdg += 5) { const x = cx + (hdg - 54) * 4.2; if (x < 152 || x > 360) continue; c.beginPath(); c.moveTo(x, 432); c.lineTo(x, hdg % 10 ? 440 : 446); c.stroke(); if (hdg % 10 === 0) txt(c, String(hdg / 10), x, 458, C.w, 17); }
  c.fillStyle = C.y; c.fillRect(cx - 2, 420, 4, 30);
  if (baro && baro.std) { c.strokeStyle = C.y; c.lineWidth = 2; c.strokeRect(404, 486, 50, 24); txt(c, 'STD', 429, 498, C.c, 17); }
  else { txt(c, 'QNH', 410, 498, C.c, 15, 'right'); txt(c, baro ? baro.txt : '1013', 458, 498, C.c, 16, 'right'); }
  return cv;
}
function nd() {
  // ARC mode, 40 NM: heading scale across the top, range arcs, flight plan from the gate to the runway
  const [cv, c] = canvas();
  const ox = 256, oy = 426, R = 330, hdg = 54; const ang = (h) => THREE.MathUtils.degToRad(h - hdg - 90);
  const P = (h, r) => [ox + Math.cos(ang(h)) * r, oy + Math.sin(ang(h)) * r];
  txt(c, 'GS', 14, 18, C.w, 15, 'left'); txt(c, '0', 46, 18, C.g, 17, 'left'); txt(c, 'TAS', 66, 18, C.w, 15, 'left'); txt(c, '---', 104, 18, C.g, 15, 'left');
  txt(c, '---/---', 14, 38, C.g, 15, 'left');
  txt(c, 'TOSIT', 498, 18, C.w, 16, 'right'); txt(c, '138°', 498, 38, C.g, 16, 'right'); txt(c, '12.4 NM', 498, 58, C.g, 16, 'right'); txt(c, '06:41', 498, 78, C.g, 16, 'right');
  c.save(); c.beginPath(); c.rect(0, 60, 512, 420); c.clip();
  c.strokeStyle = C.w; c.lineWidth = 2.2; c.beginPath(); c.arc(ox, oy, R, ang(hdg - 50), ang(hdg + 50)); c.stroke();
  for (let h = hdg - 50; h <= hdg + 50; h++) { if (h % 5) continue; const [x0, y0] = P(h, R), [x1, y1] = P(h, R - (h % 10 ? 9 : 17)); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    if (h % 10 === 0) { const [tx, ty] = P(h, R - 34); txt(c, String(((h % 360) + 360) % 360 / 10 | 0), tx, ty, C.w, (h % 30 === 0) ? 22 : 16); } }
  c.setLineDash([9, 9]); c.lineWidth = 1.6; for (const r of [R * 0.5, R * 0.75]) { c.beginPath(); c.arc(ox, oy, r, ang(hdg - 50), ang(hdg + 50)); c.stroke(); } c.setLineDash([]);
  txt(c, '10', P(hdg - 42, R * 0.5)[0], P(hdg - 42, R * 0.5)[1], C.c, 14); txt(c, '20', P(hdg - 44, R * 0.75)[0], P(hdg - 44, R * 0.75)[1], C.c, 14);
  // flight plan: green line from the aircraft through the departure points, waypoint stars and idents
  const fp = [[0, 0], [hdg + 2, 60], [hdg + 18, 160], [hdg + 30, 250], [hdg + 46, 360]]; const pts = fp.map(([h, r]) => (r ? P(h, r) : [ox, oy]));
  c.strokeStyle = C.g; c.lineWidth = 2.6; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  ['', 'D054B', 'TOSIT', 'NARAK', 'GAI'].forEach((n, i) => { if (!i) return; const [x, y] = pts[i]; if (y < 80) return; c.strokeStyle = i === 2 ? C.w : C.g; c.lineWidth = 2; c.beginPath();
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); } c.stroke(); txt(c, n, x + 10, y - 12, i === 2 ? C.w : C.g, 14, 'left'); });
  // airport symbol and runway
  c.strokeStyle = C.w; c.lineWidth = 3; const [rx, ry] = P(hdg - 6, 22); c.beginPath(); c.moveTo(rx - 22 * Math.cos(ang(144)), ry - 22 * Math.sin(ang(144))); c.lineTo(rx + 22 * Math.cos(ang(144)), ry + 22 * Math.sin(ang(144))); c.stroke(); txt(c, 'LFBO', rx - 34, ry + 6, C.w, 13, 'right');
  c.restore();
  // lubber line, aircraft symbol, track diamond
  c.fillStyle = C.y; c.fillRect(ox - 2, oy - R - 18, 4, 22);
  c.strokeStyle = C.y; c.lineWidth = 4; c.beginPath(); c.moveTo(ox, oy - 26); c.lineTo(ox, oy + 18); c.moveTo(ox - 24, oy - 6); c.lineTo(ox + 24, oy - 6); c.moveTo(ox - 10, oy + 14); c.lineTo(ox + 10, oy + 14); c.stroke();
  c.strokeStyle = C.g; c.lineWidth = 2; c.beginPath(); const [dx, dy] = P(hdg, R + 6); c.moveTo(dx, dy - 7); c.lineTo(dx + 6, dy); c.lineTo(dx, dy + 7); c.lineTo(dx - 6, dy); c.closePath(); c.stroke();
  // bottom: navaids and mode box
  txt(c, 'VOR1', 14, 470, C.w, 15, 'left'); txt(c, 'TOU', 14, 490, C.w, 15, 'left'); txt(c, 'ADF2', 498, 470, C.w, 15, 'right'); txt(c, 'BRUNO', 498, 490, C.w, 15, 'right');
  c.strokeStyle = C.w; c.lineWidth = 1.6; c.strokeRect(176, 482, 160, 24); txt(c, 'GPS PRIMARY', 256, 494, C.g, 15);
  return cv;
}
function mcdu(scratch = '') {
  // MCDU: 24 columns x 14 rows, large and small font, the A/C STATUS page shown after power-up
  const [cv, c] = canvas(); c.fillStyle = '#030504'; c.fillRect(0, 0, 512, 512);
  const COLS = 24, cw = 492 / COLS, row = (r) => 30 + r * 34.5;
  const put = (r, col, str, color, big = true, align = 'left') => {
    c.fillStyle = color; c.font = `${big ? 700 : 400} ${big ? 27 : 20}px "B612 Mono", monospace`; c.textBaseline = 'middle'; c.textAlign = 'center';
    const start = align === 'right' ? COLS - col - str.length : align === 'center' ? Math.round((COLS - str.length) / 2) : col;
    [...str].forEach((ch, i) => c.fillText(ch, 10 + (start + i + 0.5) * cw, row(r)));
  };
  put(0, 0, 'A320-251N', C.w, true, 'center');
  put(1, 1, 'ENG', C.w, false); put(2, 0, 'LEAP-1A26', C.g);
  put(3, 1, 'ACTIVE NAV DATA BASE', C.w, false); put(4, 1, '27NOV-24DEC', C.c); put(4, 0, 'AB12345678', C.g, true, 'right');
  put(5, 1, 'SECOND NAV DATA BASE', C.w, false); put(6, 0, '{30OCT-26NOV', C.c);
  put(9, 1, 'CHG CODE', C.w, false); put(10, 0, '[  ]', C.c);
  put(11, 1, 'IDLE/PERF', C.w, false); put(11, 1, 'SOFTWARE', C.w, false, 'right');
  put(12, 0, '+0.0/+0.0', C.g); put(12, 0, 'STATUS/XLOAD>', C.w, true, 'right');
  // scratchpad line
  c.fillStyle = C.w; c.font = '400 22px "B612 Mono", monospace'; c.textAlign = 'left'; [...scratch].forEach((ch, i) => c.fillText(ch, 10 + (i + 0.2) * cw, row(13)));
  return cv;
}

function isis() {
  // ISIS: attitude in the middle with pitch scale and bank arc, speed tape left, altitude tape right, baro at the bottom
  const [cv, c] = canvas(256);
  const cx = 128, cy = 118, pp = 3.2;
  c.save(); c.beginPath(); c.rect(44, 14, 168, 210); c.clip();
  c.fillStyle = C.sky; c.fillRect(44, 0, 168, cy); c.fillStyle = C.gnd; c.fillRect(44, cy, 168, 140);
  c.strokeStyle = C.w; c.lineWidth = 1.6; c.beginPath(); c.moveTo(44, cy); c.lineTo(212, cy); c.stroke();
  c.lineWidth = 1.2; for (let d = -20; d <= 20; d += 2.5) { if (!d) continue; const y = cy - d * 3.2; const w = d % 10 === 0 ? 50 : d % 5 === 0 ? 26 : 12; c.beginPath(); c.moveTo(cx - w / 2, y); c.lineTo(cx + w / 2, y); c.stroke();
    if (d % 10 === 0) { txt(c, String(Math.abs(d)), cx - w / 2 - 10, y, C.w, 11); txt(c, String(Math.abs(d)), cx + w / 2 + 10, y, C.w, 11); } }
  c.restore();
  c.strokeStyle = C.w; c.lineWidth = 1.6; for (const a of [-45, -30, -20, -10, 0, 10, 20, 30, 45]) { const r = THREE.MathUtils.degToRad(a - 90); const R0 = 82, R1 = a % 30 === 0 || Math.abs(a) === 45 ? 92 : 88;
    c.beginPath(); c.moveTo(cx + Math.cos(r) * R0, cy + Math.sin(r) * R0); c.lineTo(cx + Math.cos(r) * R1, cy + Math.sin(r) * R1); c.stroke(); }
  c.fillStyle = C.y; c.beginPath(); c.moveTo(cx, cy - 80); c.lineTo(cx - 6, cy - 70); c.lineTo(cx + 6, cy - 70); c.closePath(); c.fill();
  // aircraft symbol
  c.fillRect(cx - 52, cy - 2.5, 30, 5); c.fillRect(cx + 22, cy - 2.5, 30, 5); c.fillRect(cx - 3, cy - 3, 6, 6);
  // speed tape
  c.fillStyle = '#3d4248'; c.fillRect(4, 14, 40, 210); c.strokeStyle = C.w; c.lineWidth = 1.2;
  for (let v = 0; v <= 8; v++) { const y = 26 + v * 24; c.beginPath(); c.moveTo(36, y); c.lineTo(44, y); c.stroke(); }
  txt(c, '80', 22, 50, C.w, 13); txt(c, '60', 22, 98, C.w, 13); txt(c, '40', 22, 146, C.w, 13);
  c.fillStyle = C.y; c.fillRect(0, cy - 1.5, 50, 3);
  // altitude tape with readout
  c.fillStyle = '#3d4248'; c.fillRect(212, 14, 44, 210); for (let k = 0; k <= 8; k++) { const y = 26 + k * 24; c.beginPath(); c.moveTo(212, y); c.lineTo(220, y); c.stroke(); }
  txt(c, '600', 236, 46, C.w, 12); txt(c, '500', 236, 70, C.w, 12); txt(c, '400', 236, 166, C.w, 12); txt(c, '300', 236, 190, C.w, 12);
  c.fillStyle = '#000'; c.fillRect(208, cy - 11, 48, 22); c.strokeStyle = C.y; c.lineWidth = 1.5; c.strokeRect(208, cy - 11, 48, 22); txt(c, '500', 232, cy, C.g, 14);
  // bottom: baro setting and the two lighted labels
  c.fillStyle = '#000'; c.fillRect(0, 226, 256, 30); txt(c, '1013', 128, 240, C.c, 16); txt(c, 'HPA', 168, 241, C.c, 11);
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
// Every display unit: power, self test, brightness and content are driven by the systems (sim/systems.js)
// through set(name, state); content is redrawn only when what it shows changes.
export function paintDisplays(scene, refs) {
  const offMat = new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.22, envMapIntensity: 0.22 });
  const make = (mesh, cv, bright = 1.0) => {
    if (!mesh) return null; const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
    const m = new THREE.MeshPhysicalMaterial({ color: 0x050607, map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: bright * 1.35, roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.22, envMapIntensity: 0.22 });   // anti-glare coated glass: soft reflections, no hot spot
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
    mesh.material = m; return { mesh, mat: m, tex: tx, bright, last: null };
  };
  const S = refs.screens || {};
  const ir = (sys, i) => sys.adirs[i].aligned || (sys.adirs[i].mode === 2 && sys.adirs[i].aligned);
  const units = {
    PFD1: [make(S.PFD1, pfd(-1)), (sys) => [ir(sys, 0), baroOf(sys, 0)], (sys) => flags(pfd(-1, baroOf(sys, 0)), 'pfd', ir(sys, 0))],
    PFD2: [make(S.PFD2, pfd(1)), (sys) => [ir(sys, 1), baroOf(sys, 1)], (sys) => flags(pfd(1, baroOf(sys, 1)), 'pfd', ir(sys, 1))],
    ND1: [make(S.ND1, nd()), (sys) => [ir(sys, 0)], (sys) => flags(nd(), 'nd', ir(sys, 0))],
    ND2: [make(S.ND2, nd()), (sys) => [ir(sys, 1)], (sys) => flags(nd(), 'nd', ir(sys, 1))],
    EWD: [make(S.EWD, ewdDraw(EMPTY)), (sys) => [sys.warnings.map((w) => w.text), sys.memos.map((m) => m.t + m.c), Math.round(sys.fuel.fob / 20), sys.toMemo, (sys.eng || []).map((e) => [e.fadec, e.n1.toFixed(1), Math.round(e.egt), e.n2.toFixed(1), Math.round(e.ff / 10), e.starting, e.ign, e.rev, e.running && sys.t - (sys.engStartedAt?.[0] ?? -99) < 10])], (sys) => ewdDraw(sys)],
    SD: [make(S.SD, sdDraw(EMPTY, 'DOOR')), (sys) => sdKey(sys), (sys) => sdDraw(sys, sys.sdPage)],
    ISIS: [make(S.ISIS, isis(), 0.9), () => [], () => isis()],
  };
  const mc = []; scene.traverse((o) => { if (o.name === 'mcduScreen') mc.push(o); });
  mc.sort((a, b) => a.getWorldPosition(new THREE.Vector3()).x - b.getWorldPosition(new THREE.Vector3()).x).forEach((o, i) => (units['MCDU' + (i + 1)] = [make(o, mcdu(''), 0.85), (sys) => [sys.mcduScratch[i]], (sys) => mcdu(sys.mcduScratch[i])]));
  (refs.dcdu || []).forEach((u, i) => u.traverse((m) => { if (m.name === 'dcduScreen') units['DCDU' + (i + 1)] = [make(m, dcdu(), 0.7), () => [], () => dcdu()]; }));
  // small windows: RMP frequencies, rudder trim, transponder, clock
  const small = {};
  scene.traverse((o) => {
    if (o.name === 'rmpWin') (small.rmp = small.rmp || []).push(make(o, seg('', 0.05, 0.013), 0.7));
    if (o.name === 'rudTrimWin') small.rud = make(o, seg('R 0.0', 0.04, 0.013), 0.7);
    if (o.name === 'atcWin') small.atc = make(o, seg('7000', 0.045, 0.022), 0.7);
    if (o.name === 'fcuDisplay' || o.name === 'baroWin') (small.fcu = small.fcu || []).push(o);
  });
  if (refs.clock) refs.clock.traverse((m) => { if (m.name === 'clkWin1') make(m, seg('09:27 28', 0.045, 0.013, '#e8f0f4', '#081224'), 0.75); else if (m.name === 'clkWin0' || m.name === 'clkWin2') make(m, seg('', 0.034, 0.0104, '#e8f0f4', '#0a1a3a'), 0.5); });
  const mgr = { onChange: () => {} };
  const show = (u, key, draw) => { if (u.last !== key) { u.last = key; u.tex.image = draw(); u.tex.needsUpdate = true; mgr.onChange(); } };
  const segTxt = (u, str, w, h) => { if (!u) return; show(u, 'seg:' + str, () => seg(str, w, h)); };
  return Object.assign(mgr, {
    set(name, st) {
      const e = units[name]; if (!e || !e[0]) return; const [u, keyFn, draw] = e;
      if (!st.on) { if (u.mesh.material !== offMat) { u.mesh.material = offMat; u.last = null; mgr.onChange(); } return; }
      const ei = u.bright * 1.35 * (0.25 + 0.75 * st.brt); if (u.mesh.material !== u.mat || u.mat.emissiveIntensity !== ei) { u.mesh.material = u.mat; u.mat.emissiveIntensity = ei; mgr.onChange(); }
      if (st.test > 0) show(u, name === 'ISIS' ? 'init' + Math.ceil(st.test) : 'test', () => (name === 'ISIS' ? isisInit(st.test) : selfTest(name.startsWith('DCDU') ? 256 : 512)));
      else { const k = JSON.stringify(keyFn(st.sys)); const now = performance.now(); if (u.last !== k && !(u.drawnAt && now - u.drawnAt < 250 && u.last && !u.last.startsWith('test') && u.last !== 'init')) { u.last = k; u.drawnAt = now; u.tex.image = draw(st.sys); u.tex.needsUpdate = true; mgr.onChange(); } }
    },
    small(st) {
      const S2 = st.sys; const pw = (u, on) => { if (!u) return; const m = on ? u.mat : offMat; if (u.mesh.material !== m) { u.mesh.material = m; mgr.onChange(); } };
      (small.rmp || []).forEach((u, i) => { const n = i < 2 ? 1 : 2; const on = n === 1 ? st.rmp1 : st.rmp2; pw(u, on); if (on) segTxt(u, st.test ? '888.888' : (i % 2 === 0 ? S2.rmpAct?.[n - 1] : S2.rmpStby?.[n - 1]) || '', 0.05, 0.013); });
      pw(small.rud, st.rudTrim); if (st.rudTrim) segTxt(small.rud, st.test ? '8 88.8' : (S2.rudTrim < -0.05 ? 'L ' : S2.rudTrim > 0.05 ? 'R ' : '  ') + Math.abs(S2.rudTrim).toFixed(1), 0.04, 0.013);
      pw(small.atc, st.atc); if (st.atc) segTxt(small.atc, st.test ? '8888' : S2.sqEntry ? S2.sqEntry.padEnd(4, '-') : S2.squawk, 0.045, 0.022);
      for (const o of small.fcu || []) { if (!o.userData.onMat) o.userData.onMat = o.material; const m = st.fcu ? o.userData.onMat : offMat; if (o.material !== m) { o.material = m; mgr.onChange(); } if (st.fcu && o.userData.draw && o.userData.draw(st.test ? 'test' : S2.fcu)) mgr.onChange(); }
    },
  });
}
const baroOf = (sys, i) => { const F = sys.fcuS; if (!F) return null; return { std: F.std[i], hpa: F.baro[i], txt: F.inHg[i] ? (F.baro[i] * 0.02953).toFixed(2) : String(F.baro[i]) }; };
const EMPTY = { eng: [], warnings: [], memos: [], fuel: { fob: 19080, pumps: [] }, apu: { n: 0, egt: 20, avail: false, flap: 0 }, elec: { batAmp: [0, 0] }, batV: [26.6, 26.6], hyd: { G: 0, B: 0, Y: 0 }, packs: [] };
const sdKey = (S) => [S.sdPage, Math.round(S.apu.n), Math.round(S.apu.egt / 5), S.apu.avail, S.apu.bleed, S.apu.flap > 0.98, S.apu.shutting, S.elec, S.batV.map((v) => v.toFixed(0)), S.extAvail,
  Math.round(S.hyd.G / 50), Math.round(S.hyd.B / 50), Math.round(S.hyd.Y / 50), S.hyd.ptu, S.fuel.xfeedOpen >= 1, S.fuel.pumps, S.packs, S.xbleedOpen, new Date().getUTCMinutes(),
  (S.eng || []).map((e) => [e.fadec, Math.round(e.oilP), Math.round(e.oilT), e.ign, e.startValve, e.starting, e.running]), S.bleedPsi];
// no attitude / heading until the IR is aligned: red ATT and HDG flags (as on the aircraft during alignment)
function flags(cv, kind, ok) {
  if (ok) return cv; const c = cv.getContext('2d'); c.save(); c.setTransform(2, 0, 0, 2, 0, 0);
  if (kind === 'pfd') { c.fillStyle = '#04060a'; c.beginPath(); c.moveTo(140, 96); c.lineTo(372, 96); c.lineTo(372, 410); c.lineTo(140, 410); c.fill(); c.fillRect(150, 430, 214, 44);
    txt(c, 'ATT', 256, 250, C.r, 26); txt(c, 'HDG', 256, 452, C.r, 22); }
  else { c.fillStyle = '#04060a'; c.fillRect(0, 0, 512, 512); txt(c, 'HDG', 256, 120, C.r, 24); txt(c, 'MAP NOT AVAIL', 256, 300, C.r, 20); }
  c.restore(); return cv;
}
