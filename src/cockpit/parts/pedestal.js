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
      { t: 'knob', x, y: -0.009, r: 0.0085, id: 'sw' + i, light: true });
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
    { t: 'key', x: 0.07, y: 0.04, w: 0.022, h: 0.012, s: 'EMER\nCANC', id: 'EMERCANC' },
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
  ['VOR', 'ILS', 'GLS', 'MLS', 'ADF'].forEach((s, i) => items.push({ t: 'key', x: -0.034 + i * 0.0175, y: -0.03, w: 0.015, h: 0.009, s }));
  items.push({ t: 'knob', x: 0.045, y: 0.002, r: 0.0105, style: 'fcu', id: 'freq' }, { t: 'knob', x: 0.045, y: 0.002, r: 0.0065, style: 'fcu' },
    { t: 'toggle', x: 0.058, y: -0.028, id: 'pwr' }, { t: 'text', x: 0.058, y: -0.04, s: 'OFF', size: 0.0026 });
  const p = buildPanel({ w: 0.138, h: 0.098, title: '', items }, M, A);
  for (const x of [-0.036, 0.036]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.013), M.screen); win.position.set(x, 0.028, 0.0006); win.name = 'rmpWin'; p.add(win);
  }
  return p;
}

export function acpPanel(M, A) {
  // as photographed: 7 transmission keys over 7 reception knobs; INT/RAD switch, VOICE, RESET, PA knob and key;
  // then the navigation reception knobs
  const items = [];
  ['VHF1', 'VHF2', 'VHF3', 'HF1', 'HF2', 'INT', 'CAB'].forEach((s, i) => {
    const x = -0.054 + i * 0.018;
    items.push({ t: 'key', x, y: 0.038, w: 0.015, h: 0.009, s, id: 'tx' + s }, { t: 'text', x, y: 0.028, s, size: 0.0024 },
      { t: 'knob', x, y: 0.017, r: 0.0058, pointer: false, ring: false, dark: true });
  });
  items.push({ t: 'toggle', x: -0.05, y: -0.006, id: 'intRad' }, { t: 'text', x: -0.04, y: 0.0, s: 'INT', size: 0.0024 }, { t: 'text', x: -0.04, y: -0.012, s: 'RAD', size: 0.0024 },
    { t: 'key', x: -0.02, y: -0.004, w: 0.018, h: 0.009, s: 'VOICE' }, { t: 'key', x: 0.0, y: -0.004, w: 0.018, h: 0.009, s: 'RESET' },
    { t: 'knob', x: 0.03, y: -0.004, r: 0.0058, pointer: false, ring: false, dark: true }, { t: 'text', x: 0.042, y: 0.002, s: 'PA', size: 0.0024 },
    { t: 'key', x: 0.054, y: -0.004, w: 0.016, h: 0.011, s: '' });
  ['VOR1', 'VOR2', 'MKR', 'ILS', 'ADF1', 'ADF2', ''].forEach((s, i) => items.push({ t: 'text', x: -0.054 + i * 0.018, y: -0.021, s, size: 0.0022 }, { t: 'knob', x: -0.054 + i * 0.018, y: -0.033, r: 0.0058, pointer: false, ring: false, dark: true }));
  return buildPanel({ w: 0.138, h: 0.098, items }, M, A);
}

// lighting panels, weather radar and ATC/TCAS (as photographed)
export function floodLtPanel(M, A, side) {
  const items = side < 0 ? [
    { t: 'text', x: -0.03, y: 0.018, s: 'FLOOD LT', size: 0.0036 }, { t: 'text', x: -0.03, y: 0.011, s: 'MAIN PNL & PED', size: 0.0024 }, { t: 'knob', x: -0.03, y: -0.006, r: 0.0095, id: 'floodMain' },
    { t: 'text', x: -0.048, y: -0.018, s: 'OFF', size: 0.0024 }, { t: 'text', x: -0.012, y: -0.018, s: 'BRT', size: 0.0024 },
    { t: 'text', x: 0.03, y: 0.018, s: 'INTEG LT', size: 0.0036 }, { t: 'text', x: 0.03, y: 0.011, s: 'MAIN PNL & PED', size: 0.0024 }, { t: 'knob', x: 0.03, y: -0.006, r: 0.0095, id: 'integMain' },
    { t: 'text', x: 0.012, y: -0.018, s: 'OFF', size: 0.0024 }, { t: 'text', x: 0.048, y: -0.018, s: 'BRT', size: 0.0024 },
  ] : [
    { t: 'text', x: -0.042, y: 0.018, s: 'FLOOD LT', size: 0.0036 }, { t: 'text', x: -0.042, y: 0.011, s: 'PED', size: 0.0024 }, { t: 'knob', x: -0.042, y: -0.006, r: 0.0095, id: 'floodPed' },
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
  const items = [
    ...[0.022, 0.004, -0.014].flatMap((y, i) => [{ t: 'toggle', x: -0.056, y, id: 'atcSw' + i }]),
    { t: 'text', x: -0.044, y: 0.03, s: 'XPDR', size: 0.0024 }, { t: 'text', x: -0.044, y: 0.012, s: 'ALT RPTG', size: 0.0022 }, { t: 'text', x: -0.044, y: -0.006, s: 'SYS', size: 0.0022 },
  ];
  [['1', '2', '3'], ['4', '5', '6'], ['7', '0', 'CLR']].forEach((r, ri) => r.forEach((s, ci) => items.push({ t: 'key', x: -0.024 + ci * 0.016, y: 0.02 - ri * 0.016, w: 0.012, h: 0.012, s, id: 'atc' + s })));
  items.push({ t: 'text', x: 0.044, y: 0.034, s: 'ATC', size: 0.0026 },
    { t: 'annun', x: 0.06, y: -0.014, w: 0.004, h: 0.004, s: '' }, { t: 'text', x: 0.06, y: -0.006, s: 'FAIL', size: 0.0022 },
    { t: 'knob', x: 0.046, y: -0.026, r: 0.0075, id: 'tcasMode' }, { t: 'text', x: 0.06, y: -0.02, s: 'STBY', size: 0.0021 }, { t: 'text', x: 0.062, y: -0.028, s: 'TA', size: 0.0021 }, { t: 'text', x: 0.062, y: -0.036, s: 'TA/RA', size: 0.0021 },
    { t: 'key', x: 0.024, y: -0.03, w: 0.016, h: 0.01, s: 'IDENT', id: 'ident' });
  const p = buildPanel({ w: 0.138, h: 0.08, items, name: 'atc' }, M, A);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.022), M.screen); win.position.set(0.04, 0.016, 0.0006); win.name = 'atcWin'; p.add(win);
  return p;
}

// ENG panel: two master switches with FIRE / FAULT lights, MODE selector in the middle
export function engPanel(M, A) {
  const items = [
    { t: 'text', x: -0.074, y: 0.033, s: 'ENG', size: 0.0046 }, { t: 'text', x: -0.074, y: 0.025, s: '1', size: 0.0058 },
    { t: 'text', x: 0.074, y: 0.033, s: 'ENG', size: 0.0046 }, { t: 'text', x: 0.074, y: 0.025, s: '2', size: 0.0058 },
    { t: 'text', x: -0.074, y: 0.016, s: 'ON', size: 0.0036 }, { t: 'text', x: -0.074, y: -0.004, s: 'OFF', size: 0.0036 },
    { t: 'text', x: 0.074, y: 0.016, s: 'ON', size: 0.0036 }, { t: 'text', x: 0.074, y: -0.004, s: 'OFF', size: 0.0036 },
    { t: 'annun', x: -0.074, y: -0.016, w: 0.02, h: 0.008, s: 'FIRE', id: 'fire1' }, { t: 'annun', x: -0.074, y: -0.026, w: 0.02, h: 0.008, s: 'FAULT', id: 'fault1' },
    { t: 'annun', x: 0.074, y: -0.016, w: 0.02, h: 0.008, s: 'FIRE', id: 'fire2' }, { t: 'annun', x: 0.074, y: -0.026, w: 0.02, h: 0.008, s: 'FAULT', id: 'fault2' },
    { t: 'text', x: 0, y: 0.034, s: 'MODE', size: 0.0046 },
    { t: 'text', x: -0.02, y: 0.02, s: 'CRANK', size: 0.0034 }, { t: 'text', x: 0, y: 0.026, s: 'NORM', size: 0.0034 }, { t: 'text', x: 0.022, y: 0.02, s: 'IGN\nSTART', size: 0.0034 },
    { t: 'knob', x: 0, y: 0.004, r: 0.011, id: 'mode', ticks: [-50, 0, 50] },
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
  const grip = new THREE.Mesh(g, blk); grip.castShadow = true; handle.add(grip);
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
  const sx = -0.04, marks = [['0', 0.045], ['1', 0.022], ['2', 0.0], ['3', -0.022], ['FULL', -0.045]];
  const p = leverPanel(M, A, { w: 0.15, h: 0.14, title: 'FLAPS', slotX: sx, titleX: 0.035, id: 'flaps', handle, marks: [['', 0.045]], extra: gateItems(sx, marks, 0.05, -0.05) });
  for (const s2 of [-1, 1]) { const g = rbox(0.008, 0.1, 0.006, 0.002, M.panel); g.position.set(sx + s2 * 0.011, -0.002, 0.003); p.add(g); }
  return p;
}
export function rudderTrimPanel(M, A) {
  const p = buildPanel({ w: 0.085, h: 0.12, items: [
    { t: 'text', x: 0, y: 0.05, s: 'RUD TRIM', size: 0.005 },
    { t: 'text', x: -0.025, y: 0.008, s: 'NOSE\nL', size: 0.0036 }, { t: 'text', x: 0.025, y: 0.008, s: 'NOSE\nR', size: 0.0036 },
    { t: 'knob', x: 0, y: -0.008, r: 0.012, id: 'rudTrim' },
    { t: 'key', x: 0, y: -0.04, w: 0.024, h: 0.012, s: 'RESET', id: 'rudReset' },
  ] }, M, A);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.013), M.screen); win.position.set(0, 0.031, 0.0006); win.name = 'rudTrimWin'; p.add(win);
  return p;
}
export function parkBrakePanel(M, A) {
  const p = buildPanel({ w: 0.11, h: 0.09, items: [
    { t: 'text', x: 0, y: 0.034, s: 'PARK BRK', size: 0.0055 },
    { t: 'text', x: -0.03, y: -0.03, s: 'OFF', size: 0.004 }, { t: 'text', x: 0.03, y: -0.03, s: 'ON', size: 0.004 },
  ] }, M, A);
  // T-handle: turn and pull to set
  const h = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.006, 32).rotateX(Math.PI / 2), M.panelDark); base.position.z = 0.003; h.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.014, 12).rotateX(Math.PI / 2), M.metal); stem.position.z = 0.012; h.add(stem);
  const bar = rbox(0.016, 0.06, 0.016, 0.005, new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.3 })); bar.position.set(0, 0.012, 0.022); h.add(bar);   // black handle lettered PARK BRK
  const pl = A.mesh('PARK BRK', 0.009, { px: 40, weight: 600, color: '#f2f2ee' }, 0.055); pl.rotation.z = -Math.PI / 2; pl.position.set(0, 0.012, 0.0305); h.add(pl);
  h.position.set(0, 0.0, 0); p.add(h); p.userData.handle = h;
  return p;
}
export function genericPanel(M, A, w, h, title, rows) {
  const items = [];
  rows.forEach((r, i) => r.forEach((s, j) => items.push({ t: 'pb', x: -w / 2 + (w / (r.length + 1)) * (j + 1), y: h / 2 - 0.022 - i * 0.022, w: 0.015, h: 0.013, legends: [s, ''] })));
  return buildPanel({ w, h, title, items }, M, A);
}

// a fixed annunciator lens (legend dark until lit), for lights set straight into a housing
export function korryLens(top, col) { return korryFace(top, '', 1, [col, col]); }
