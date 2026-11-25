// Centre pedestal system panels (A320 layout). Each returns a panel group (see panel.js).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { buildPanel } from './panel.js';

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
  const items = [
    { t: 'text', x: -0.036, y: 0.038, s: 'ACTIVE', size: 0.0036 }, { t: 'text', x: 0.036, y: 0.038, s: 'STBY/CRS', size: 0.0036 },
    { t: 'key', x: 0, y: 0.028, w: 0.016, h: 0.01, s: '⇄', id: 'xfer' },
    { t: 'text', x: -0.055, y: -0.022, s: 'NAV', size: 0.0034 },
  ];
  ['VHF1', 'VHF2', 'VHF3', 'HF1', 'SEL', 'HF2', 'AM'].forEach((s, i) => items.push({ t: 'pb', x: -0.052 + i * 0.0173, y: 0.0065, w: 0.014, h: 0.012, legends: [s, ''], id: 'rmp' + s }));
  ['NAV', 'VOR', 'ILS', 'MLS', 'ADF', 'BFO'].forEach((s, i) => items.push({ t: 'pb', x: -0.043 + i * 0.0173, y: -0.012, w: 0.014, h: 0.012, legends: [s, ''] }));
  items.push({ t: 'knob', x: 0.05, y: -0.031, r: 0.0095, pointer: false, ring: false, id: 'freq' },
    { t: 'text', x: -0.05, y: -0.034, s: 'ON', size: 0.0034 }, { t: 'toggle', x: -0.04, y: -0.034, id: 'pwr' });
  const p = buildPanel({ w: 0.138, h: 0.098, title: `RMP ${n}`, items }, M, A);
  // two frequency windows (dark until powered)
  for (const x of [-0.036, 0.036]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.013), M.screen); win.position.set(x, 0.028, 0.0006); win.name = 'rmpWin'; p.add(win);
  }
  return p;
}

export function acpPanel(M, A) {
  const items = [];
  ['VHF1', 'VHF2', 'VHF3', 'HF1', 'HF2', 'INT', 'CAB'].forEach((s, i) => {
    const x = -0.054 + i * 0.018;
    items.push({ t: 'pb', x, y: 0.035, w: 0.015, h: 0.012, legends: ['CALL', s], id: 'tx' + s },
      { t: 'knob', x, y: 0.012, r: 0.0058, pointer: false, ring: false, dark: true });
  });
  ['VOR1', 'VOR2', 'MKR', 'ILS', 'ADF1', 'ADF2'].forEach((s, i) => items.push({ t: 'text', x: -0.054 + i * 0.021, y: -0.007, s, size: 0.0032 }, { t: 'knob', x: -0.054 + i * 0.021, y: -0.018, r: 0.0055, pointer: false, ring: false, dark: true }));
  items.push({ t: 'pb', x: -0.05, y: -0.038, w: 0.016, h: 0.011, legends: ['INT', 'RAD'] }, { t: 'pb', x: 0.0, y: -0.038, w: 0.016, h: 0.011, legends: ['VOICE', ''] }, { t: 'pb', x: 0.05, y: -0.038, w: 0.016, h: 0.011, legends: ['RESET', ''] });
  return buildPanel({ w: 0.138, h: 0.098, items }, M, A);
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
    const guardL = rbox(0.004, 0.03, 0.018, 0.0015, M.panelDark); guardL.position.set(-0.016, 0.006, 0.009); sw.add(guardL);
    const guardR = guardL.clone(); guardR.position.x = 0.016; sw.add(guardR);
    const lever = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0028, 0.022, 12), M.metal); stem.position.y = 0.011; lever.add(stem);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.016, 24).rotateZ(Math.PI / 2), M.trim); head.position.y = 0.024; head.castShadow = true; lever.add(head);
    lever.rotation.x = -0.45; lever.position.set(0, 0.006, 0.002); sw.add(lever);   // OFF (aft)
    sw.position.set(s * 0.074, 0.0, 0); p.add(sw); p.userData.masters.push(lever);
  }
  return p;
}

// Lever in a gated slot with detent labels (speed brake, flaps)
function leverPanel(M, A, { w, h, title, marks, handle, slotX = 0, id }) {
  const items = [{ t: 'text', x: slotX + 0.03, y: h / 2 - 0.009, s: title, size: 0.0058, align: 'center' }];
  marks.forEach(([s, y]) => items.push({ t: 'text', x: slotX - 0.018, y, s, size: 0.0042, align: 'right' }, { t: 'line', pts: [[slotX - 0.013, y], [slotX - 0.007, y]] }));
  const p = buildPanel({ w, h, items, name: id }, M, A);
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.006, h - 0.03), new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 1 }));
  slot.position.set(slotX, -0.004, 0.0003); p.add(slot);
  const lever = new THREE.Group();
  const stem = rbox(0.005, 0.005, 0.05, 0.0015, M.metal); stem.position.z = 0.025; lever.add(stem);
  lever.add(handle); handle.position.z = 0.05;
  lever.position.set(slotX, marks[0][1], 0); p.add(lever); p.userData.lever = lever;
  return p;
}
export function speedBrakePanel(M, A) {
  const handle = new THREE.Group();
  const grip = rbox(0.034, 0.012, 0.014, 0.005, M.rubber); handle.add(grip);    // T-handle, pull up to arm
  return leverPanel(M, A, { w: 0.15, h: 0.14, title: 'SPEED\nBRAKE', slotX: -0.01, id: 'speedbrake', handle,
    marks: [['RET', 0.04], ['1/2', 0.0], ['FULL', -0.045]] });
}
export function flapsPanel(M, A) {
  const handle = new THREE.Group();
  // flap lever knob: a wing-section shaped grip
  const sh = new THREE.Shape(); sh.moveTo(-0.02, -0.004); sh.quadraticCurveTo(-0.022, 0.006, -0.008, 0.008); sh.lineTo(0.02, 0.003); sh.quadraticCurveTo(0.024, -0.002, 0.018, -0.005); sh.closePath();
  const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 2 }), M.trim);
  wing.rotation.set(0, Math.PI / 2, Math.PI / 2); wing.position.set(-0.008, 0, 0); wing.castShadow = true; handle.add(wing);
  return leverPanel(M, A, { w: 0.15, h: 0.14, title: 'FLAPS', slotX: 0.012, id: 'flaps', handle,
    marks: [['0', 0.045], ['1', 0.022], ['2', 0.0], ['3', -0.022], ['FULL', -0.045]] });
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
  const bar = rbox(0.05, 0.012, 0.012, 0.004, new THREE.MeshStandardMaterial({ color: 0x9a2b22, roughness: 0.55 })); bar.position.z = 0.022; h.add(bar);
  h.position.set(0, 0.0, 0); p.add(h); p.userData.handle = h;
  return p;
}
export function genericPanel(M, A, w, h, title, rows) {
  const items = [];
  rows.forEach((r, i) => r.forEach((s, j) => items.push({ t: 'pb', x: -w / 2 + (w / (r.length + 1)) * (j + 1), y: h / 2 - 0.022 - i * 0.022, w: 0.015, h: 0.013, legends: [s, ''] })));
  return buildPanel({ w, h, title, items }, M, A);
}
