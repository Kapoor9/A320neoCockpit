// Glareshield panels: FCU (centre), EFIS control panels (each side) and the
// warning block (MASTER WARN / MASTER CAUT, CHRONO, SIDE STICK PRIORITY) outboard.
import * as THREE from 'three';
import { buildPanel } from './panel.js';

const FCU_BG = '#7d919b';
const FCU_DARK = '#3a4247';   // FCU and EFIS control panels are dark charcoal
// amber LCD window (powered, idle values)
function lcd(text, w, h) {
  const cv = document.createElement('canvas'); cv.width = Math.round(w * 6000); cv.height = Math.round(h * 6000); const c = cv.getContext('2d');
  c.fillStyle = '#0d1610'; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#ffb02e'; let fs = cv.height * 0.7; c.font = `600 ${fs}px "B612 Mono", monospace`; while (c.measureText(text).width > cv.width * 0.95 && fs > 6) { fs -= 1; c.font = `600 ${fs}px "B612 Mono", monospace`; } c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, cv.width / 2, cv.height * 0.54);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.3 });
}
// remap a layout drawn on a larger panel onto the measured strip (positions only; control sizes kept)
const fit = (items, sx, sy) => items.map((i) => ({ ...i, x: (i.x || 0) * sx, y: (i.y || 0) * sy, ...(i.pts ? { pts: i.pts.map(([x, y]) => [x * sx, y * sy]) } : {}) }));

// seven-segment glyphs for the FCU windows
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', o: 'cdeg' };
function seg7(c, ch, x, y, w, h, col) {
  c.fillStyle = col; const t = w * 0.2, g = t * 0.25;
  if (ch === '+') { c.fillRect(x + w * 0.15, y + h * 0.5 - t / 2, w * 0.7, t); c.fillRect(x + w / 2 - t / 2, y + h * 0.22, t, h * 0.56); return; }
  const s = SEG[ch] || ''; const hh = h / 2;
  const H = (yy) => { c.beginPath(); c.moveTo(x + g + t * 0.5, yy); c.lineTo(x + t, yy - t / 2); c.lineTo(x + w - t, yy - t / 2); c.lineTo(x + w - g - t * 0.5, yy); c.lineTo(x + w - t, yy + t / 2); c.lineTo(x + t, yy + t / 2); c.closePath(); c.fill(); };
  const V = (xx, y0) => { c.beginPath(); c.moveTo(xx, y0 + g + t * 0.5); c.lineTo(xx + t / 2, y0 + t); c.lineTo(xx + t / 2, y0 + hh - t); c.lineTo(xx, y0 + hh - g - t * 0.5); c.lineTo(xx - t / 2, y0 + hh - t); c.lineTo(xx - t / 2, y0 + t); c.closePath(); c.fill(); };
  if (s.includes('a')) H(y + t / 2); if (s.includes('g')) H(y + hh); if (s.includes('d')) H(y + h - t / 2);
  if (s.includes('f')) V(x + t / 2, y); if (s.includes('b')) V(x + w - t / 2, y); if (s.includes('e')) V(x + t / 2, y + hh); if (s.includes('c')) V(x + w - t / 2, y + hh);
}
// FCU window as photographed: SPD 100 | HDG 054 LAT | HDG || V/S | ALT 00100 LVL/CH V/S +00oo
function fcuWindow(w, h) {
  const K = 4, X0 = 825, Y0 = 138; const cv = document.createElement('canvas'); cv.width = 930 * K; cv.height = 62 * K; const c = cv.getContext('2d');
  const P = (px) => (px - X0) * K, Q = (py) => (py - Y0) * K; const AMB = '#ffb43a';
  c.fillStyle = '#151a12'; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#0b0d0b'; c.fillRect(P(1283), 0, P(1298) - P(1283), cv.height);
  const lab = (s, px, py, sz) => { c.fillStyle = AMB; c.font = `700 ${sz * K}px "B612", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, P(px), Q(py)); };
  lab('SPD', 866, 150, 17); lab('HDG', 1046, 150, 17); lab('LAT', 1135, 150, 17); lab('HDG', 1245, 172, 19); lab('V/S', 1330, 172, 19);
  lab('ALT', 1488, 152, 17); lab('LVL/CH', 1585, 152, 15); lab('V/S', 1680, 152, 17);
  c.strokeStyle = AMB; c.lineWidth = 2.2 * K; c.beginPath(); c.moveTo(P(1515), Q(160)); c.lineTo(P(1515), Q(150)); c.lineTo(P(1548), Q(150)); c.moveTo(P(1622), Q(150)); c.lineTo(P(1655), Q(150)); c.lineTo(P(1655), Q(160)); c.stroke();
  const digits = (str, px0, pitch, py0, dh, dw) => [...str].forEach((ch, i) => seg7(c, ch, P(px0 + i * pitch), Q(py0), dw * K, dh * K, AMB));
  digits('100', 863, 28, 161, 36, 22); digits('054', 1030, 30, 161, 36, 23); digits('00100', 1413, 29, 163, 36, 22);
  seg7(c, '+', P(1594), Q(165), 24 * K, 32 * K, AMB); digits('00', 1622, 28, 163, 36, 22); digits('oo', 1680, 26, 163, 36, 20);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.25 });
}
const PANEL_BG = '#3a4247', PLATE = new THREE.MeshStandardMaterial({ color: 0x2c3236, roughness: 0.55 }), SCREW = new THREE.MeshStandardMaterial({ color: 0x4a5055, roughness: 0.4, metalness: 0.5 });
const S = 0.000214;   // metres per photo pixel

export function fcuPanel(M, A) {
  const F = (px, py) => [(px - 1290) * S, -(py - 290) * S];
  const at = (px, py, o) => { const [x, y] = F(px, py); return { ...o, x, y }; };
  const L = (s, px, py, size = 0.0036) => at(px, py, { t: 'text', s, size });
  const items = [
    at(780, 258, { t: 'rbtn', r: 0.0068, id: 'spdMach' }), L('SPD', 778, 302), L('MACH', 778, 320),
    at(890, 312, { t: 'knob', r: 0.0084, style: 'fcu', id: 'kSPD' }),
    at(1070, 315, { t: 'knob', r: 0.0086, style: 'fcu', hdg: true, id: 'kHDG' }),
    at(1068, 445, { t: 'key', w: 0.0142, h: 0.0098, s: 'LOC', id: 'LOC', bar: true }),
    { t: 'line', pts: [F(1182, 245), F(1182, 458)], w: 0.0008, col: '#f0a040' },
    at(1288, 258, { t: 'rbtn', r: 0.0064, id: 'hdgvs' }), L('HDG', 1228, 250, 0.0034), L('TRK', 1228, 269, 0.0034), L('V/S', 1347, 250, 0.0034), L('FPA', 1347, 269, 0.0034),
    at(1240, 335, { t: 'key', w: 0.0145, h: 0.0128, s: 'AP1', id: 'AP1', bar: true }), at(1335, 335, { t: 'key', w: 0.0145, h: 0.0128, s: 'AP2', id: 'AP2', bar: true }),
    at(1288, 428, { t: 'key', w: 0.0145, h: 0.0132, s: 'A/THR', id: 'ATHR', bar: true }),
    { t: 'line', pts: [F(1395, 245), F(1395, 458)], w: 0.0008, col: '#f0a040' },
    L('100', 1447, 254, 0.0034), L('1000', 1516, 254, 0.0034), { t: 'line', pts: [F(1456, 266), F(1465, 278)], w: 0.0006 }, { t: 'line', pts: [F(1506, 266), F(1497, 278)], w: 0.0006 },
    at(1482, 316, { t: 'knob', r: 0.0084, style: 'fcu', id: 'kALT' }),
    at(1482, 446, { t: 'key', w: 0.0142, h: 0.0098, s: 'EXPED', id: 'EXPED', bar: true }),
    at(1598, 260, { t: 'rbtn', r: 0.0068, id: 'metric' }), L('METRIC', 1597, 302, 0.0034), L('ALT', 1597, 321, 0.0034),
    L('UP', 1712, 252), L('DN', 1712, 386),
    at(1712, 318, { t: 'knob', r: 0.0086, style: 'fcu', id: 'kVS' }),
    L('PUSH', 1800, 294, 0.0033), L('TO', 1800, 310, 0.0033), L('LEVEL', 1800, 327, 0.0033), L('OFF', 1800, 344, 0.0033),
    at(1712, 446, { t: 'key', w: 0.0142, h: 0.0098, s: 'APPR', id: 'APPR', bar: true }),
  ];
  // curved UP / DN arrow round the left of the V/S knob
  { const pts = []; for (let i = 0; i <= 16; i++) { const a = Math.PI * (0.62 + 0.76 * i / 16); pts.push(F(1712 + Math.cos(a) * 68, 318 - Math.sin(a) * 68)); } items.push({ t: 'line', pts, w: 0.0007 });
    items.push({ t: 'line', pts: [F(1678, 262), F(1688, 258), F(1684, 268)], w: 0.0007 }, { t: 'line', pts: [F(1678, 374), F(1688, 378), F(1684, 368)], w: 0.0007 }); }
  const p = buildPanel({ w: 0.24, h: 0.078, items, bg: PANEL_BG, plate: PLATE, screw: SCREW, name: 'FCU' }, M, A);
  const [dx, dy] = F(1290, 169); const dw = 930 * S, dh = 62 * S;
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(dw + 0.003, dh + 0.003), new THREE.MeshBasicMaterial({ color: 0x0a0b0c })); frame.position.set(dx, dy, 0.0004); p.add(frame);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), fcuWindow(dw, dh)); disp.position.set(dx, dy, 0.0008); disp.name = 'fcuDisplay'; p.add(disp); p.userData.windows = { all: disp };
  return p;
}

// small QNH window: amber QNH caption over the big pressure figure
function qnhWindow(w, h, value = '1003') {
  const K = 4; const cv = document.createElement('canvas'); cv.width = 132 * K; cv.height = 65 * K; const c = cv.getContext('2d'); const AMB = '#ffb43a';
  c.fillStyle = '#151a12'; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = AMB; c.font = `700 ${17 * K}px "B612", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('QNH', 95 * K, 13 * K);
  [...value].forEach((ch, i) => seg7(c, ch, (16 + i * 27) * K, 26 * K, 21 * K, 32 * K, AMB));
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.25 });
}

export function efisPanel(M, A, side) {
  // control positions from the photo; the F/O panel mirrors where each control sits, but every
  // control keeps its own legend layout (ROSE/VOR left, PLAN right, INOP left of VOR, 1 then 2)
  const m = side === 1 || side < 0 ? 1 : -1;
  const C = (px, py) => [(px - 390) * S * m, -(py - 290) * S];        // a control's centre, mirrored
  const R = (cx, cy, dpx, dpy) => [cx + dpx * S, cy - dpy * S];         // legend offset from that centre, never mirrored
  const items = []; const L = (s, [x, y], size = 0.0034) => items.push({ t: 'text', s, x, y, size });
  const ln = (pts) => items.push({ t: 'line', pts, w: 0.0006 });
  // baro: in Hg / hPa
  const [bx, by] = C(185, 325); L('in Hg', R(bx, by, -58, -50), 0.0032); L('hPa', R(bx, by, 58, -50), 0.0032);
  // FD / LS keys (FD outboard)
  { const [x, y] = C(148, 430); items.push({ t: 'key', x, y, w: 0.0135, h: 0.0105, s: 'FD', id: 'FD', bar: true }); }
  { const [x, y] = C(228, 432); items.push({ t: 'key', x, y, w: 0.0135, h: 0.0105, s: 'LS', id: 'LS', bar: true }); }
  { const [x0, y0] = C(283, 290), [, y1] = C(283, 470); items.push({ t: 'line', pts: [[x0, y0], [x0, y1]], w: 0.0008, col: '#f0a040' }); }
  // display filter keys
  const keys = ['CSTR', 'WPT', 'VOR.D', 'NDB', 'ARPT'];
  keys.forEach((s, i) => { const [x, y] = C([342, 424, 506, 589, 672][i], 184); items.push({ t: 'key', x, y, w: 0.0152, h: 0.0092, s, id: s, bar: true }); });
  // ND mode selector
  const [mx, my] = C(398, 312);
  items.push({ t: 'knob', x: mx, y: my, r: 0.0084, angle: 0, lit: true, id: 'ndMode' });
  L('ROSE', R(mx, my, -66, -69)); L('VOR', R(mx, my, -62, -46), 0.003); L('NAV', R(mx, my, 4, -75)); L('ARC', R(mx, my, 67, -44)); L('LS', R(mx, my, -72, -2)); L('PLAN', R(mx, my, 87, -2));
  { const pts = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * (1.0 - 0.32 * i / 10); pts.push(R(mx, my, Math.cos(a) * 64, -Math.sin(a) * 64)); } ln(pts); }
  for (const [a, r0, r1] of [[90, 58, 66], [35, 58, 66], [0, 58, 66], [180, 58, 66], [148, 58, 66]]) { const ra = a * Math.PI / 180; ln([R(mx, my, Math.cos(ra) * r0, -Math.sin(ra) * r0), R(mx, my, Math.cos(ra) * r1, -Math.sin(ra) * r1)]); }
  // ND range selector
  const [rx, ry] = C(612, 312);
  items.push({ t: 'knob', x: rx, y: ry, r: 0.0084, angle: -50, lit: true, id: 'ndRange' });
  L('10', R(rx, ry, -68, 0)); L('20', R(rx, ry, -50, -50)); L('40', R(rx, ry, 4, -72)); L('80', R(rx, ry, 58, -50)); L('160', R(rx, ry, 80, 0)); L('320', R(rx, ry, 60, 50));
  for (const a of [180, 135, 90, 45, 0, -45]) { const ra = a * Math.PI / 180; ln([R(rx, ry, Math.cos(ra) * 56, -Math.sin(ra) * 56), R(rx, ry, Math.cos(ra) * 63, -Math.sin(ra) * 63)]); }
  // VOR / ADF switches, numbered left to right
  const tg = [C(393, 414), C(610, 416)].sort((a, b) => a[0] - b[0]);
  tg.forEach(([x, y], i) => {
    items.push({ t: 'toggle', x, y, id: 'nav' + (i + 1) });
    L(String(i + 1), R(x, y, 2, -41)); L('VOR', R(x, y, 60, 0)); L('OFF', R(x, y, 2, 41));
    const [ix, iy] = R(x, y, -70, 2); items.push({ t: 'box', x: ix, y: iy, w: 0.0128, h: 0.0056 }); L('INOP', [ix, iy], 0.0032);
  });
  const p = buildPanel({ w: 0.139, h: 0.078, items, bg: PANEL_BG, plate: PLATE, screw: SCREW, name: 'EFIS' + side }, M, A);
  // toggles sit in a black round recess
  for (const [x, y] of tg) { const rec = new THREE.Mesh(new THREE.CircleGeometry(0.0056, 32), new THREE.MeshBasicMaterial({ color: 0x0b0c0d })); rec.position.set(x, y, 0.0003); p.add(rec);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0058, 0.0006, 8, 32), new THREE.MeshStandardMaterial({ color: 0x1a1d1f, roughness: 0.4 })); rim.position.set(x, y, 0.0006); p.add(rim); }
  // flight directors on: FD bar lit green
  const fd = p.userData.controls.FD; if (fd && fd.userData.bar) fd.userData.bar.forEach((s) => { s.material = new THREE.MeshStandardMaterial({ color: 0x6dff7a, emissive: 0x3ce04e, emissiveIntensity: 1.2, roughness: 0.3 }); });
  // QNH window and the baro knob: grey PULL STD knob inside its black in Hg / hPa selector ring, lit amber surround
  const [qx, qy] = C(196, 212); const ww = 132 * S, wh = 65 * S;
  const fr = new THREE.Mesh(new THREE.PlaneGeometry(ww + 0.002, wh + 0.002), new THREE.MeshBasicMaterial({ color: 0x0a0b0c })); fr.position.set(qx, qy, 0.0004); p.add(fr);
  const w = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), qnhWindow(ww, wh)); w.position.set(qx, qy, 0.0008); w.name = 'baroWin'; p.add(w);
  const H = { dark: new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.45 }), grey: new THREE.MeshStandardMaterial({ color: 0xc4c8cb, roughness: 0.38, metalness: 0.25 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xe8963a, roughness: 0.4, emissive: 0xd0701c, emissiveIntensity: 0.9 }) };
  const kb = new THREE.Group(); kb.position.set(bx, by, 0); p.add(kb);
  const glow = new THREE.Mesh(new THREE.TorusGeometry(0.0118, 0.0011, 10, 48), H.amber); glow.position.z = 0.0012; kb.add(glow);
  const sel = new THREE.Mesh(new THREE.CylinderGeometry(0.0108, 0.011, 0.007, 48).rotateX(Math.PI / 2), H.dark); sel.position.z = 0.0035; sel.castShadow = true; kb.add(sel);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0075, 0.013, 40).rotateX(Math.PI / 2), H.grey); knob.position.set(-0.0016, 0.0016, 0.0098); knob.castShadow = true; kb.add(knob);
  for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2; const fl = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.0012, 0.012), H.grey); fl.position.set(-0.0016 + Math.cos(a) * 0.0075, 0.0016 + Math.sin(a) * 0.0075, 0.0098); fl.rotation.z = a; kb.add(fl); }
  const face = A.mesh('PULL\nSTD', 0.006, { px: 40, weight: 700, color: '#5d6266' }, 0.009); face.position.set(-0.0016, 0.0016, 0.0166); face.rotation.z = -0.5; kb.add(face);
  return p;
}

export function warningPanel(M, A, side = -1) {
  const o = side, i = -side;   // outboard / inboard x direction
  const items = [
    { t: 'pb', x: o * 0.026, y: 0.0125, w: 0.023, h: 0.02, legends: ['MASTER', 'WARN'], cols: ['#b8402e', '#b8402e'], id: 'masterWarn' },
    { t: 'pb', x: o * 0.026, y: -0.0125, w: 0.023, h: 0.02, legends: ['MASTER', 'CAUT'], cols: ['#b88a2c', '#b88a2c'], id: 'masterCaut' },
    { t: 'text', x: i * 0.03, y: 0.0255, s: 'CHRONO', size: 0.0034 },
    { t: 'rbtn', x: i * 0.03, y: 0.0135, r: 0.0068, id: 'chrono' },
    { t: 'text', x: i * 0.03, y: 0.0005, s: 'SIDE STICK PRIORITY', size: 0.0027 },
    { t: 'pb', x: i * 0.03, y: -0.0145, w: 0.02, h: 0.019, legends: [side < 0 ? '►' : '◄', side < 0 ? 'CAPT' : 'F/O'], cols: ['#b8402e', '#4f9c5a'], id: 'ssp' },
  ];
  const p = buildPanel({ w: 0.1, h: 0.064, items, bg: FCU_BG, plate: M.fcu, name: 'warnBlock' }, M, A);
  p.userData.masterWarn = p.userData.controls.masterWarn; p.userData.masterCaut = p.userData.controls.masterCaut;
  return p;
}

// outboard end of the strip: AUTO LAND light and the side-stick priority arrow
export function stripEndPanel(M, A, side, w) {
  const items = [
    { t: 'text', x: side * (w / 2 - 0.05), y: 0.018, s: 'AUTO LAND', size: 0.003 },
    { t: 'annun', x: side * (w / 2 - 0.05), y: 0.004, w: 0.02, h: 0.012, s: 'AUTO LAND', id: 'autoland' },
    { t: 'annun', x: -side * (w / 2 - 0.105), y: 0.002, w: 0.018, h: 0.016, s: side < 0 ? '◄' : '►', id: 'sspArrow' },
  ];
  return buildPanel({ w, h: 0.076, items, bg: FCU_BG, name: 'stripEnd' + side }, M, A);
}
