// Glareshield panels: FCU (centre), EFIS control panels (each side) and the
// warning block (MASTER WARN / MASTER CAUT, CHRONO, SIDE STICK PRIORITY) outboard.
import * as THREE from 'three';
import { buildPanel } from './panel.js';

const FCU_BG = '#7d919b';
const FCU_DARK = '#30373c';   // FCU and EFIS control panels are dark charcoal
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

export function fcuPanel(M, A) {
  const W = 0.24, H = 0.076, SX = 0.96, SY = 0.76;
  // positions measured from the photographed FCU (fractions of the panel), design units before fit()
  const items = [
    { t: 'rbtn', x: -0.113, y: 0.011, id: 'spdMach' }, { t: 'text', x: -0.113, y: -0.003, s: 'SPD', size: 0.0028 }, { t: 'text', x: -0.113, y: -0.008, s: 'MACH', size: 0.0028 },
    { t: 'knob', x: -0.088, y: -0.006, r: 0.0115, style: 'fcu', id: 'kSPD' },
    { t: 'knob', x: -0.048, y: -0.006, r: 0.0115, style: 'fcu', id: 'kHDG' },
    { t: 'key', x: -0.048, y: -0.039, w: 0.018, h: 0.011, s: 'LOC', id: 'LOC', bar: true },
    { t: 'line', pts: [[-0.023, 0.016], [-0.023, -0.044]], w: 0.0007, col: '#d9963f' },
    { t: 'rbtn', x: 0.0, y: 0.011, id: 'hdgvs' }, { t: 'text', x: -0.013, y: 0.015, s: 'HDG', size: 0.0027 }, { t: 'text', x: -0.013, y: 0.009, s: 'TRK', size: 0.0027 }, { t: 'text', x: 0.013, y: 0.015, s: 'V/S', size: 0.0027 }, { t: 'text', x: 0.013, y: 0.009, s: 'FPA', size: 0.0027 },
    { t: 'key', x: -0.011, y: -0.0136, w: 0.018, h: 0.012, s: 'AP1', id: 'AP1', bar: true },
    { t: 'key', x: 0.011, y: -0.0136, w: 0.018, h: 0.012, s: 'AP2', id: 'AP2', bar: true },
    { t: 'key', x: 0.0, y: -0.039, w: 0.018, h: 0.012, s: 'A/THR', id: 'ATHR', bar: true },
    { t: 'line', pts: [[0.025, 0.016], [0.025, -0.044]], w: 0.0007, col: '#d9963f' },
    { t: 'text', x: 0.044, y: 0.013, s: '100   1000', size: 0.003 },
    { t: 'knob', x: 0.044, y: -0.006, r: 0.0115, style: 'fcu', id: 'kALT' },
    { t: 'key', x: 0.044, y: -0.039, w: 0.018, h: 0.011, s: 'EXPED', id: 'EXPED', bar: true },
    { t: 'rbtn', x: 0.069, y: 0.011, id: 'metric' }, { t: 'text', x: 0.069, y: -0.003, s: 'METRIC', size: 0.0026 }, { t: 'text', x: 0.069, y: -0.008, s: 'ALT', size: 0.0026 },
    { t: 'text', x: 0.095, y: 0.013, s: 'UP', size: 0.003 }, { t: 'text', x: 0.095, y: -0.024, s: 'DN', size: 0.003 },
    { t: 'knob', x: 0.095, y: -0.006, r: 0.0115, style: 'fcu', id: 'kVS' },
    { t: 'text', x: 0.116, y: 0.002, s: 'PUSH', size: 0.0024 }, { t: 'text', x: 0.116, y: -0.004, s: 'TO LEVEL', size: 0.0024 }, { t: 'text', x: 0.116, y: -0.01, s: 'OFF', size: 0.0024 },
    { t: 'key', x: 0.095, y: -0.039, w: 0.018, h: 0.011, s: 'APPR', id: 'APPR', bar: true },
  ];
  const p = buildPanel({ w: W, h: H, items: fit(items, SX, SY), bg: FCU_DARK, name: 'FCU' }, M, A);
  // one continuous display window across the top: SPD | HDG LAT | V/S ALT LVL/CH V/S
  const dw = 0.207 * SX, dh = 0.016;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), lcd('SPD 250   HDG ---  LAT  |  V/S  ALT 05000 -----', dw, dh));
  disp.position.set(0, 0.033 * SY, 0.0008); disp.name = 'fcuDisplay'; p.add(disp); p.userData.windows = { all: disp };
  return p;
}

export function efisPanel(M, A, side) {
  // captain layout measured from the photo; the F/O panel is its mirror image
  const m = side === 1 || side < 0 ? 1 : -1;   // 1 = captain, 2 = F/O (mirrored)
  const items = [
    { t: 'text', x: -0.07, y: 0.004, s: 'inHg', size: 0.003 }, { t: 'text', x: -0.042, y: 0.004, s: 'hPa', size: 0.003 },
    { t: 'knob', x: -0.056, y: -0.0076, r: 0.0105, style: 'fcu', id: 'baro' },
    { t: 'key', x: -0.069, y: -0.036, w: 0.018, h: 0.012, s: 'FD', id: 'FD', bar: true }, { t: 'key', x: -0.045, y: -0.036, w: 0.018, h: 0.012, s: 'LS', id: 'LS', bar: true },
    { t: 'line', pts: [[-0.031, 0.012], [-0.031, -0.044]], w: 0.0007, col: '#d9963f' },
    { t: 'text', x: -0.012, y: 0.008, s: 'ROSE', size: 0.0026 }, { t: 'text', x: 0.005, y: 0.013, s: 'NAV', size: 0.0026 }, { t: 'text', x: 0.022, y: 0.008, s: 'ARC', size: 0.0026 },
    { t: 'text', x: -0.018, y: -0.005, s: 'LS', size: 0.0026 }, { t: 'text', x: 0.026, y: -0.005, s: 'PLAN', size: 0.0026 },
    { t: 'knob', x: 0.005, y: -0.0045, r: 0.0105, id: 'ndMode' },
    { t: 'text', x: 0.05, y: 0.0, s: '10', size: 0.0026 }, { t: 'text', x: 0.058, y: 0.01, s: '20', size: 0.0026 }, { t: 'text', x: 0.066, y: 0.013, s: '40', size: 0.0026 }, { t: 'text', x: 0.075, y: 0.01, s: '80', size: 0.0026 }, { t: 'text', x: 0.083, y: 0.0, s: '160', size: 0.0026 }, { t: 'text', x: 0.079, y: -0.013, s: '320', size: 0.0026 },
    { t: 'knob', x: 0.066, y: -0.0045, r: 0.0105, id: 'ndRange' },
    { t: 'text', x: -0.012, y: -0.032, s: 'INOP', size: 0.0026 }, { t: 'toggle', x: 0.002, y: -0.032, id: 'nav1' }, { t: 'text', x: 0.014, y: -0.032, s: 'VOR', size: 0.0026 }, { t: 'text', x: 0.002, y: -0.045, s: 'OFF', size: 0.0026 },
    { t: 'text', x: 0.05, y: -0.032, s: 'INOP', size: 0.0026 }, { t: 'toggle', x: 0.064, y: -0.032, id: 'nav2' }, { t: 'text', x: 0.076, y: -0.032, s: 'VOR', size: 0.0026 }, { t: 'text', x: 0.064, y: -0.045, s: 'OFF', size: 0.0026 },
  ];
  ['CSTR', 'WPT', 'VOR.D', 'NDB', 'ARPT'].forEach((s, i) => items.push({ t: 'key', x: -0.013 + i * 0.024, y: 0.029, w: 0.019, h: 0.011, s, id: s, bar: true }));
  const mir = items.map((i) => ({ ...i, x: (i.x || 0) * m, ...(i.pts ? { pts: i.pts.map(([x, y]) => [x * m, y]) } : {}) }));
  const p = buildPanel({ w: 0.16, h: 0.076, items: fit(mir, 0.84, 0.76), bg: FCU_DARK, name: 'EFIS' + side }, M, A);
  const w = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.013), lcd('1013', 0.03, 0.013)); w.position.set(-0.055 * m * 0.84, 0.021 * 0.76, 0.0008); w.name = 'baroWin'; p.add(w);
  const q = A.mesh('QNH', 0.004, { px: 32, weight: 600, color: '#ffb02e' }, 0.02); q.position.set(-0.05 * m * 0.84, 0.024 * 0.76 + 0.004, 0.001); p.add(q);
  return p;
}

export function warningPanel(M, A, side = -1) {
  const o = side, i = -side;   // outboard / inboard x direction
  const items = [
    { t: 'pb', x: o * 0.026, y: 0.013, w: 0.025, h: 0.021, legends: ['MASTER', 'WARN'], cols: ['#b8402e', '#b8402e'], id: 'masterWarn' },
    { t: 'pb', x: o * 0.026, y: -0.013, w: 0.025, h: 0.021, legends: ['MASTER', 'CAUT'], cols: ['#b88a2c', '#b88a2c'], id: 'masterCaut' },
    { t: 'text', x: i * 0.03, y: 0.031, s: 'CHRONO', size: 0.0032 },
    { t: 'rbtn', x: i * 0.03, y: 0.017, r: 0.0075, id: 'chrono' },
    { t: 'text', x: i * 0.03, y: 0.002, s: 'SIDE STICK PRIORITY', size: 0.0024 },
    { t: 'pb', x: i * 0.03, y: -0.014, w: 0.022, h: 0.02, legends: [side < 0 ? '►' : '◄', side < 0 ? 'CAPT' : 'F/O'], cols: ['#b8402e', '#4f9c5a'], id: 'ssp' },
  ];
  const p = buildPanel({ w: 0.1, h: 0.076, items, bg: FCU_BG, name: 'warnBlock' }, M, A);
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
