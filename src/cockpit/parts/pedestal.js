// Centre pedestal system panels (A320 layout). Each returns a panel group (see panel.js).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { buildPanel, korryFace } from './panel.js';

const rbox = (w, h, d, r, mat) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.98), mat); m.castShadow = true; m.receiveShadow = true; return m; };

export function switchingPanel(M, A) {
  const items = [];
  const sel = [['ATT HDG', 'CAPT 3', 'F/O 3'], ['AIR DATA', 'CAPT 3', 'F/O 3'], ['EIS DMC', 'CAPT 3', 'F/O 3'], ['ECAM/ND XFR', 'CAPT', 'F/O']];
  sel.forEach(([t, l, r], i) => {
    const x = -0.066 + i * 0.044;
    items.push({ t: 'text', x, y: 0.016, s: t, size: 0.0045 }, { t: 'text', x, y: 0.0085, s: 'NORM', size: 0.0036 },
      { t: 'text', x: x - 0.014, y: -0.004, s: l, size: 0.0034 }, { t: 'text', x: x + 0.014, y: -0.004, s: r, size: 0.0034 },
      { t: 'knob', x, y: -0.011, r: 0.0095, id: 'sw' + i, style: 'bar', ticks: [-50, 0, 50], arc: 55 });
  });
  return buildPanel({ w: 0.19, h: 0.052, title: 'SWITCHING', items }, M, A);
}

export function ecamControlPanel(M, A) {
  const items = [
    { t: 'text', x: -0.07, y: 0.045, s: 'ECAM', size: 0.0052 },
    { t: 'text', x: -0.07, y: 0.034, s: 'UPPER DISPLAY', size: 0.0034 }, { t: 'knob', x: -0.07, y: 0.022, r: 0.0085, light: true, id: 'upperBrt' },
    { t: 'text', x: -0.083, y: 0.011, s: 'OFF', size: 0.0032 }, { t: 'text', x: -0.057, y: 0.011, s: 'BRT', size: 0.0032 },
    { t: 'text', x: -0.07, y: 0.003, s: 'LOWER DISPLAY', size: 0.0034 }, { t: 'knob', x: -0.07, y: -0.009, r: 0.0085, light: true, id: 'lowerBrt' },
    { t: 'text', x: -0.083, y: -0.02, s: 'OFF', size: 0.0032 }, { t: 'text', x: -0.057, y: -0.02, s: 'BRT', size: 0.0032 },
    { t: 'key', x: 0.005, y: 0.04, w: 0.022, h: 0.012, s: 'T.O\nCONFIG', id: 'TOCONFIG' },
    { t: 'pb', x: 0.07, y: 0.04, w: 0.022, h: 0.012, legends: ['EMER', 'CANC'], cols: ['#c9ccc8', '#c9ccc8'], guard: 'clear', id: 'EMERCANC' },
  ];
  const pages = [['ENG', 'BLEED', 'PRESS', 'ELEC', 'HYD', 'FUEL'], ['APU', 'COND', 'DOOR', 'WHEEL', 'F/CTL', 'ALL']];
  pages.forEach((row, r) => row.forEach((s, i) => items.push({ t: 'key', x: -0.032 + i * 0.024, y: 0.018 - r * 0.02, w: 0.02, h: 0.013, s, id: 'ecp_' + s })));
  [['CLR', -0.032], ['STS', 0.022], ['RCL', 0.046], ['CLR', 0.088]].forEach(([s, x], i) => items.push({ t: 'key', x, y: -0.036, w: 0.02, h: 0.013, s, id: 'ecp_' + s + i }));
  return buildPanel({ w: 0.19, h: 0.115, items }, M, A);
}

export function rmpPanel(M, A, n) {
  // as photographed: ACTIVE and STBY/CRS windows with the green transfer key between; VHF1-3 / HF1, SEL, HF2, AM;
  // concentric frequency knob and ON/OFF switch on the right; STBY NAV row (guarded NAV, VOR, ILS, GLS, MLS, ADF) at the bottom
  const items = [
    { t: 'text', x: -0.036, y: 0.042, s: 'ACTIVE', size: 0.0032 }, { t: 'text', x: 0.036, y: 0.042, s: 'STBY/CRS', size: 0.0032 },
    { t: 'key', x: 0, y: 0.028, w: 0.016, h: 0.01, s: '⇄', id: 'xfer' },
  ];
  ['VHF1', 'VHF2', 'VHF3'].forEach((s, i) => items.push({ t: 'annun', x: -0.05 + i * 0.019, y: 0.016, w: 0.004, h: 0.002, s: '' }, { t: 'key', x: -0.05 + i * 0.019, y: 0.008, w: 0.016, h: 0.009, s, id: 'rmp' + s }));
  [['HF1', -0.05], ['HF2', -0.012], ['AM', 0.007]].forEach(([s, x]) => items.push({ t: 'key', x, y: -0.007, w: 0.016, h: 0.009, s, id: 'rmp' + s }));
  items.push({ t: 'rbtn', x: -0.031, y: -0.007, r: 0.004 }, { t: 'text', x: -0.031, y: 0.0, s: 'SEL', size: 0.0024 });
  items.push({ t: 'text', x: -0.01, y: -0.018, s: 'STBY NAV', size: 0.0026 }, { t: 'line', pts: [[-0.06, -0.018], [-0.026, -0.018]], w: 0.0005 }, { t: 'line', pts: [[0.006, -0.018], [0.045, -0.018]], w: 0.0005 });
  items.push({ t: 'pb', x: -0.055, y: -0.03, w: 0.014, h: 0.011, legends: ['', 'NAV'], guard: 'grey' });
  ['VOR', 'ILS', 'MLS', 'ADF', 'BFO'].forEach((s, i) => items.push({ t: 'key', x: -0.034 + i * 0.0175, y: -0.03, w: 0.015, h: 0.009, s }));
  items.push({ t: 'knob', x: 0.045, y: 0.002, r: 0.0105, style: 'fcu', id: 'freq' }, { t: 'knob', x: 0.045, y: 0.002, r: 0.0065, style: 'fcu' },
    { t: 'toggle', x: 0.058, y: -0.028, id: 'pwr' }, { t: 'text', x: 0.058, y: -0.016, s: 'ON', size: 0.0026 }, { t: 'text', x: 0.058, y: -0.041, s: 'OFF', size: 0.0026 });
  const p = buildPanel({ w: 0.138, h: 0.098, title: '', items }, M, A);
  for (const x of [-0.036, 0.036]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.013), M.screen); win.position.set(x, 0.028, 0.0006); win.name = 'rmpWin'; p.add(win);
  }
  return p;
}

export function acpPanel(M, A) {
  // audio control panel: 7 transmission keys (CALL / MECH / ATT legends), reception knobs under them,
  // INT/RAD switch, VOICE and RESET keys, PA knob and boxed PA key, navigation reception knobs (reference photographs)
  const W = 0.138, X = (px) => (px - 338) * (W / 676), Y = (py) => (617 - py) * (0.098 / 433);
  const items = []; const vk = (px, py, id) => ({ t: 'knob', style: 'round', x: X(px), y: Y(py), r: 0.0052, id });
  [['CALL', 'VHF 1', 105], ['CALL', 'VHF 2', 182], ['CALL', 'VHF 3', 259], ['CALL', 'HF 1', 337], ['CALL', 'HF 2', 415], ['MECH', 'INT', 492], ['ATT', 'CAB', 570]].forEach(([k, n, x]) =>
    items.push({ t: 'key', x: X(x), y: Y(460), w: 0.0135, h: 0.0085, s: k, id: 'tx' + n }, { t: 'text', x: X(x), y: Y(512), s: n, size: 0.0026 }, vk(x, 555, 'rx' + n)));
  items.push({ t: 'text', x: X(134), y: Y(610), s: 'INT', size: 0.0026 }, { t: 'toggle', x: X(134), y: Y(652), id: 'intRad', lit: true }, { t: 'text', x: X(134), y: Y(690), s: 'RAD', size: 0.0026 },
    { t: 'key', x: X(259), y: Y(652), w: 0.015, h: 0.0085, s: 'VOICE' }, { t: 'key', x: X(337), y: Y(650), w: 0.015, h: 0.0085, s: 'RESET' },
    vk(445, 650, 'rxPA'), { t: 'text', x: X(498), y: Y(648), s: 'PA', size: 0.0028 },
    { t: 'line', pts: [[X(530), Y(618)], [X(612), Y(618)], [X(612), Y(678)], [X(530), Y(678)], [X(530), Y(618)]], w: 0.0006 }, { t: 'key', x: X(571), y: Y(648), w: 0.0135, h: 0.0085, s: '' });
  [['VOR 1', 95], ['VOR 2', 175], ['MKR', 252], ['ILS', 331], ['MLS', 410], ['ADF 1', 489], ['ADF 2', 568]].forEach(([n, x]) => items.push({ t: 'text', x: X(x), y: Y(732), s: n, size: 0.0026 }, vk(x, 772, 'rx' + n)));
  return buildPanel({ w: W, h: 0.098, items }, M, A);
}

// lighting panels, weather radar and ATC/TCAS (as photographed)
export function floodLtPanel(M, A, side) {
  const items = side < 0 ? [
    { t: 'text', x: -0.03, y: 0.018, s: 'FLOOD LT', size: 0.0036 }, { t: 'text', x: -0.03, y: 0.011, s: 'MAIN PNL & PED', size: 0.0024 }, { t: 'knob', style: 'knurl', x: -0.03, y: -0.006, r: 0.0085, id: 'floodMain', arc: 130 },
    { t: 'text', x: -0.048, y: -0.018, s: 'OFF', size: 0.0024 }, { t: 'text', x: -0.012, y: -0.018, s: 'BRT', size: 0.0024 },
    { t: 'text', x: 0.03, y: 0.018, s: 'INTEG LT', size: 0.0036 }, { t: 'text', x: 0.03, y: 0.011, s: 'MAIN PNL & PED', size: 0.0024 }, { t: 'knob', style: 'knurl', x: 0.03, y: -0.006, r: 0.0085, id: 'integMain', arc: 130 },
    { t: 'text', x: 0.012, y: -0.018, s: 'OFF', size: 0.0024 }, { t: 'text', x: 0.048, y: -0.018, s: 'BRT', size: 0.0024 },
  ] : [
    { t: 'text', x: -0.042, y: 0.018, s: 'FLOOD LT', size: 0.0036 }, { t: 'text', x: -0.042, y: 0.011, s: 'PED', size: 0.0024 }, { t: 'knob', style: 'knurl', x: -0.042, y: -0.006, r: 0.0085, id: 'floodPed', arc: 130 },
    { t: 'text', x: -0.058, y: -0.018, s: 'OFF', size: 0.0024 }, { t: 'text', x: -0.026, y: -0.018, s: 'BRT', size: 0.0024 },
    { t: 'line', pts: [[-0.016, 0.02], [-0.016, -0.02]], w: 0.0005 }, { t: 'line', pts: [[0.026, 0.02], [0.026, -0.02]], w: 0.0005 },
    { t: 'text', x: 0.005, y: 0.018, s: 'AIDS', size: 0.0036 }, { t: 'text', x: 0.005, y: 0.011, s: 'PRINT', size: 0.0024 }, { t: 'rbtn', x: 0.005, y: -0.004, r: 0.0055 },
    { t: 'text', x: 0.047, y: 0.018, s: 'DFDR', size: 0.0036 }, { t: 'text', x: 0.047, y: 0.011, s: 'EVENT', size: 0.0024 }, { t: 'rbtn', x: 0.047, y: -0.004, r: 0.0055 },
  ];
  return buildPanel({ w: 0.138, h: 0.05, items, name: 'floodLt' + side }, M, A);
}
export function wxPanel(M, A) {
  const items = [
    { t: 'text', x: -0.048, y: 0.032, s: 'GAIN', size: 0.003 }, { t: 'knob', x: -0.048, y: 0.016, r: 0.0085, dark: true, id: 'wxGain' },
    { t: 'text', x: -0.064, y: 0.006, s: 'CAL', size: 0.0022 }, { t: 'text', x: -0.032, y: 0.006, s: '+8', size: 0.0022 },
    { t: 'text', x: -0.008, y: 0.032, s: 'MULTISCAN', size: 0.003 }, { t: 'toggle', x: -0.014, y: 0.018, id: 'wxMulti' }, { t: 'text', x: -0.026, y: 0.018, s: 'MAN', size: 0.0022 }, { t: 'text', x: -0.001, y: 0.018, s: 'AUTO', size: 0.0022 },
    { t: 'text', x: 0.022, y: 0.032, s: 'GCS', size: 0.003 }, { t: 'toggle', x: 0.022, y: 0.018, id: 'wxGcs' }, { t: 'text', x: 0.012, y: 0.018, s: 'OFF', size: 0.0022 }, { t: 'text', x: 0.034, y: 0.018, s: 'AUTO', size: 0.0022 },
    { t: 'text', x: 0.052, y: 0.032, s: 'TILT', size: 0.003 }, { t: 'knob', x: 0.052, y: 0.016, r: 0.0085, dark: true, id: 'wxTilt' },
    { t: 'text', x: 0.066, y: 0.026, s: '15 UP', size: 0.0022 }, { t: 'text', x: 0.066, y: 0.004, s: '15 DN', size: 0.0022 },
    { t: 'text', x: -0.004, y: 0.004, s: 'MODE', size: 0.003 }, { t: 'knob', x: -0.004, y: -0.014, r: 0.0085, dark: true, id: 'wxMode' },
    { t: 'text', x: -0.024, y: -0.008, s: 'WX+T', size: 0.0022 }, { t: 'text', x: -0.024, y: -0.02, s: 'WX', size: 0.0022 }, { t: 'text', x: 0.016, y: -0.008, s: 'MAP', size: 0.0022 },
    { t: 'text', x: -0.052, y: -0.022, s: 'SYS', size: 0.003 }, { t: 'toggle', x: -0.052, y: -0.034, id: 'wxSys' }, { t: 'text', x: -0.064, y: -0.034, s: '1', size: 0.0024 }, { t: 'text', x: -0.04, y: -0.034, s: '2', size: 0.0024 },
    { t: 'text', x: 0.034, y: -0.022, s: 'PWS', size: 0.003 }, { t: 'toggle', x: 0.034, y: -0.034, id: 'wxPws' }, { t: 'text', x: 0.022, y: -0.034, s: 'OFF', size: 0.0022 }, { t: 'text', x: 0.047, y: -0.034, s: 'AUTO', size: 0.0022 },
  ];
  return buildPanel({ w: 0.138, h: 0.08, items, name: 'wxRadar' }, M, A);
}
export function atcPanel(M, A) {
  const W = 0.138, X = (px) => (px - 338) * (W / 676), Y = (py) => (134 - py) * (0.08 / 269);
  const sel = (px, py, id, ticks = [-50, 50], arc = 55) => ({ t: 'knob', style: 'bar', x: X(px), y: Y(py), r: 0.0068, id, ticks, arc });
  const T = (px, py, s, size = 0.0026) => ({ t: 'text', x: X(px), y: Y(py), s, size });
  const items = [
    T(785 - 676, 18, 'AUTO'), T(742 - 676, 36, 'STBY'), T(830 - 676, 36, 'ON'), sel(785 - 676, 66, 'xpdrMode', [-55, 0, 55]),
    T(745 - 676, 112, '1'), T(828 - 676, 112, '2'), sel(785 - 676, 140, 'atcSys'),
    T(738 - 676, 194, 'OFF'), T(832 - 676, 194, 'ON'), sel(785 - 676, 218, 'altRptg'), T(785 - 676, 254, 'ALT RPTG', 0.0024),
    ...['A', 'T', 'C'].map((c, i) => T(724 - 676, 114 + 28 * i, c, 0.003)), ...['T', 'C', 'A', 'S'].map((c, i) => T(1308 - 676, 96 + 26 * i, c, 0.003)),
    T(916 - 676, 18, 'ATC'), T(970 - 676, 18, 'FAIL'), { t: 'annun', x: X(943 - 676), y: Y(18), w: 0.0035, h: 0.0035, s: '' },
    { t: 'rbtn', x: X(1128 - 676), y: Y(140), r: 0.0042 }, T(1185 - 676, 140, 'IDENT', 0.0032),
    T(1082 - 676, 186, 'ALL'), T(1120 - 676, 186, 'ABV'), T(1052 - 676, 208, 'THRT'), T(1146 - 676, 208, 'BLW'), sel(1097 - 676, 240, 'tcasTraffic', [-60, -20, 20, 60], 65),
    T(1248 - 676, 186, 'TA'), T(1218 - 676, 208, 'STBY'), T(1283 - 676, 208, 'TA/RA'), sel(1250 - 676, 240, 'tcasMode', [-45, 0, 45], 50),
  ];
  [['1', '2', '3'], ['4', '5', '6'], ['7', '0', 'CLR']].forEach((r, ri) => r.forEach((s, ci) => items.push({ t: 'key', x: X(866 - 676 + ci * 72), y: Y(81 + ri * 72), w: 0.0115, h: 0.0115, s, id: 'atc' + s })));
  const p = buildPanel({ w: W, h: 0.08, items, name: 'atc' }, M, A);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.016), M.screen); win.position.set(X(1162 - 676), Y(76), 0.0006); win.name = 'atcWin'; p.add(win);
  return p;
}

// ENG panel: two master switches with FIRE / FAULT lights, MODE selector in the middle
export function engPanel(M, A) {
  const items = [
    { t: 'text', x: 0, y: 0.034, s: 'ENG', size: 0.0062 },
    { t: 'text', x: -0.066, y: 0.03, s: 'MASTER 1', size: 0.0038 }, { t: 'text', x: 0.066, y: 0.03, s: 'MASTER 2', size: 0.0038 },
    { t: 'text', x: -0.074, y: -0.036, s: '1', size: 0.005 }, { t: 'text', x: 0.074, y: -0.036, s: '2', size: 0.005 },
    { t: 'text', x: -0.094, y: 0.022, s: 'ON', size: 0.0036 }, { t: 'text', x: -0.094, y: 0.0, s: 'OFF', size: 0.0036 },
    { t: 'text', x: 0.094, y: 0.022, s: 'ON', size: 0.0036 }, { t: 'text', x: 0.094, y: 0.0, s: 'OFF', size: 0.0036 },
    { t: 'pb', x: -0.072, y: -0.02, w: 0.02, h: 0.018, legends: ['FIRE', 'FAULT'], cols: ['#b8402e', '#e0902a'], id: 'engLt1' },
    { t: 'pb', x: 0.072, y: -0.02, w: 0.02, h: 0.018, legends: ['FIRE', 'FAULT'], cols: ['#b8402e', '#e0902a'], id: 'engLt2' },
    { t: 'text', x: 0, y: 0.022, s: 'MODE', size: 0.0042 }, { t: 'text', x: 0, y: 0.016, s: 'NORM', size: 0.0036 },
    { t: 'text', x: -0.03, y: 0.004, s: 'CRANK', size: 0.0034 }, { t: 'text', x: 0.031, y: 0.006, s: 'IGN/\nSTART', size: 0.0034 },
    { t: 'knob', style: 'bar', x: 0, y: -0.012, r: 0.012, id: 'mode', ticks: [-55, 0, 55], arc: 60 },
  ];
  const p = buildPanel({ w: 0.21, h: 0.08, items }, M, A);
  // master switches: big round-headed toggles that must be lifted to move
  p.userData.masters = [];
  for (const s of [-1, 1]) {
    const sw = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.0016, 10, 32), new THREE.MeshStandardMaterial({ color: 0xd9963f, roughness: 0.4, emissive: 0x6a3a08 })); ring.position.z = 0.001; sw.add(ring);
    const well = new THREE.Mesh(new THREE.CircleGeometry(0.0095, 32), new THREE.MeshBasicMaterial({ color: 0x0a0b0c })); well.position.z = 0.0005; sw.add(well);
    const lever = new THREE.Group(); lever.rotation.x = 0.3; sw.add(lever);   // OFF: leaning aft
    const chrome = new THREE.MeshStandardMaterial({ color: 0xc8cbcc, roughness: 0.22, metalness: 0.9 });
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0072, 0.022, 24).rotateX(Math.PI / 2), chrome); sh.position.z = 0.011; lever.add(sh);
    const cap = rbox(0.024, 0.014, 0.028, 0.004, new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.3 })); cap.position.z = 0.036; cap.castShadow = true; lever.add(cap);
    for (const [txt, dz, sz] of [['ENG', 0.0065, 0.0075], [String(s < 0 ? 1 : 2), -0.0065, 0.0095]]) { const l = A.mesh(txt, sz, { px: 48, weight: 700, color: '#f2f2ee' }, 0.021); l.rotation.x = Math.PI / 2; l.position.set(0, -0.0072, 0.036 + dz); lever.add(l); }
    sw.position.set(s * 0.074, 0.0, 0); p.add(sw); p.userData.masters.push(lever);
  }
  return p;
}

// Lever in a gated slot with detent labels (speed brake, flaps)
function leverPanel(M, A, { w, h, title, marks, handle, slotX = 0, id, extra = [], titleX = null }) {
  const items = [{ t: 'text', x: titleX ?? slotX + 0.03, y: titleX != null ? 0.0 : h / 2 - 0.009, s: title, size: 0.0058, align: 'center' }, ...extra];
  marks.forEach(([s, y]) => items.push({ t: 'text', x: slotX - 0.018, y, s, size: 0.0042, align: 'right' }, { t: 'line', pts: [[slotX - 0.013, y], [slotX - 0.007, y]] }));
  const p = buildPanel({ w, h, items, name: id }, M, A);
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.006, h - 0.03), new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 1 }));
  slot.position.set(slotX, -0.004, 0.0003); p.add(slot);
  const lever = new THREE.Group();
  const blk = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.35 });
  const stem = rbox(0.01, 0.007, 0.05, 0.003, blk); stem.position.z = 0.025; lever.add(stem);
  for (let k = 0; k < 9; k++) { const rib = rbox(0.011, 0.008, 0.0018, 0.0006, blk); rib.position.z = 0.006 + k * 0.0045; lever.add(rib); }   // ribbed lever
  lever.add(handle); handle.position.z = 0.05;
  lever.position.set(slotX, marks[0][1], 0); p.add(lever); p.userData.lever = lever;
  return p;
}
// white gate outline: brackets either side of the slot with notches at each detent, labels on both sides
function gateItems(slotX, marks, top, bot) {
  const it = [];
  for (const sx of [-1, 1]) {
    const x0 = slotX + sx * 0.008, x1 = slotX + sx * 0.016;
    it.push({ t: 'line', pts: [[x0, top], [x1, top], [x1, bot], [x0, bot]], w: 0.0009 });
    marks.forEach(([s, y]) => it.push({ t: 'line', pts: [[x1, y], [x1 + sx * 0.005, y]], w: 0.0009 }, { t: 'text', x: x1 + sx * 0.016, y, s, size: 0.0042 }));
  }
  return it;
}
export function speedBrakePanel(M, A) {
  // black grip flaring toward the top, on the ribbed lever; GND SPLR ARMED legend over the gate
  const handle = new THREE.Group(); const blk = new THREE.MeshStandardMaterial({ color: 0x0f1113, roughness: 0.25 });
  const s = new THREE.Shape(); s.moveTo(-0.009, 0); s.lineTo(0.009, 0); s.quadraticCurveTo(0.017, 0.03, 0.015, 0.042); s.quadraticCurveTo(0, 0.05, -0.015, 0.042); s.quadraticCurveTo(-0.017, 0.03, -0.009, 0); 
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 4 }).translate(0, 0, -0.008).rotateX(Math.PI / 2);
  const grip = new THREE.Mesh(g, blk); grip.castShadow = true; handle.add(grip); handle.scale.setScalar(0.78);   // sized to the photo
  const sx = 0.02, marks = [['RET', 0.04], ['1/2', 0.0], ['FULL', -0.045]];
  const extra = [...gateItems(sx, marks, 0.048, -0.05), { t: 'text', x: sx, y: 0.06, s: 'GND SPLR ARMED', size: 0.0034, boxed: true }];
  return leverPanel(M, A, { w: 0.15, h: 0.14, title: 'SPEED\nBRAKE', slotX: sx, titleX: -0.035, id: 'speedbrake', handle, marks: [['', 0.04]], extra });
}
export function flapsPanel(M, A) {
  // T-handle: wide flat aerofoil-shaped top over a smaller trigger plate, on the ribbed lever; raised gate with detent notches
  const handle = new THREE.Group(); const blk = new THREE.MeshStandardMaterial({ color: 0x0f1113, roughness: 0.25 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 40).rotateX(Math.PI / 2), blk); top.scale.set(1, 0.55, 1); top.position.z = 0.012; top.castShadow = true; handle.add(top);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.03, 32, 12, 0, Math.PI * 2, 0, 0.5).rotateX(Math.PI / 2), blk); dome.scale.set(1, 0.55, 0.35); dome.position.z = 0.018; handle.add(dome);
  const trig = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.006, 32).rotateX(Math.PI / 2), blk); trig.scale.set(1, 0.45, 1); trig.position.z = -0.004; handle.add(trig);
  handle.scale.setScalar(0.78);   // sized to the photo
  const sx = -0.04, marks = [['0', 0.045], ['1', 0.022], ['2', 0.0], ['3', -0.022], ['FULL', -0.045]];
  const p = leverPanel(M, A, { w: 0.15, h: 0.14, title: 'FLAPS', slotX: sx, titleX: 0.035, id: 'flaps', handle, marks: [['', 0.045]], extra: gateItems(sx, marks, 0.05, -0.05) });
  for (const s2 of [-1, 1]) { const g = rbox(0.008, 0.1, 0.006, 0.002, M.panel); g.position.set(sx + s2 * 0.011, -0.002, 0.003); p.add(g); }
  return p;
}
export function rudderTrimPanel(M, A) {
  const p = buildPanel({ w: 0.085, h: 0.12, items: [
    { t: 'text', x: 0, y: 0.05, s: 'RUD TRIM', size: 0.005 },
    { t: 'text', x: -0.025, y: 0.008, s: 'NOSE\nL', size: 0.0036 }, { t: 'text', x: 0.025, y: 0.008, s: 'NOSE\nR', size: 0.0036 },
    { t: 'knob', style: 'bar', x: 0.012, y: -0.012, r: 0.0125, id: 'rudTrim', ticks: [-30, 0, 30], arc: 35 },
    { t: 'text', x: -0.026, y: -0.02, s: 'RESET', size: 0.0036 }, { t: 'rbtn', x: -0.026, y: -0.033, r: 0.0055, id: 'rudReset' }, { t: 'text', x: -0.035, y: 0.031, s: '+-\n20', size: 0.0028 },
  ] }, M, A);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.013), M.screen); win.position.set(0, 0.031, 0.0006); win.name = 'rudTrimWin'; p.add(win);
  return p;
}
export function parkBrakePanel(M, A) {
  const p = buildPanel({ w: 0.11, h: 0.09, items: [
    { t: 'text', x: -0.022, y: 0.03, s: 'PARKING BRK', size: 0.0058 }, { t: 'text', x: -0.022, y: 0.02, s: 'PULL & TURN', size: 0.0036 },
    { t: 'text', x: 0.012, y: 0.03, s: 'OFF', size: 0.004 }, { t: 'text', x: 0.045, y: -0.012, s: 'ON', size: 0.004 },
    { t: 'circ', x: 0.026, y: -0.004, r: 0.024, a0: -90, a1: 0, w: 0.0006, col: '#e8b25a' },
  ] }, M, A);
  // T-handle: turn and pull to set
  const h = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.006, 32).rotateX(Math.PI / 2), M.panelDark); base.position.z = 0.003; h.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.014, 12).rotateX(Math.PI / 2), M.metal); stem.position.z = 0.012; h.add(stem);
  const bar = rbox(0.016, 0.06, 0.016, 0.005, new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.3 })); bar.position.set(0, 0.012, 0.022); h.add(bar);   // black handle lettered PARK BRK
  const pl = A.mesh('PARK BRK', 0.009, { px: 40, weight: 600, color: '#f2f2ee' }, 0.055); pl.rotation.z = -Math.PI / 2; pl.position.set(0, 0.012, 0.0305); h.add(pl);
  { const fin = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.022, 4).rotateZ(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb7bbbe, roughness: 0.35, metalness: 0.4 })); fin.scale.z = 0.4; fin.position.set(0.016, -0.004, 0.024); h.add(fin); }   // grey pointer
  h.position.set(0.026, -0.004, 0); p.add(h); p.userData.handle = h;
  return p;
}
export function genericPanel(M, A, w, h, title, rows) {
  const items = [];
  rows.forEach((r, i) => r.forEach((s, j) => items.push({ t: 'pb', x: -w / 2 + (w / (r.length + 1)) * (j + 1), y: h / 2 - 0.022 - i * 0.022, w: 0.015, h: 0.013, legends: [s, ''] })));
  return buildPanel({ w, h, title, items }, M, A);
}

// a fixed annunciator lens (legend dark until lit), for lights set straight into a housing
export function korryLens(top, col) { return korryFace(top, '', 1, [col, col]); }
