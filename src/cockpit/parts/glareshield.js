// Glareshield panels: FCU (centre), EFIS control panels (each side) and the
// warning block (MASTER WARN / MASTER CAUT, CHRONO, SIDE STICK PRIORITY) outboard.
import * as THREE from 'three';
import { buildPanel } from './panel.js';

const FCU_BG = '#6e828c';
// amber LCD window (powered, idle values)
function lcd(text, w, h) {
  const cv = document.createElement('canvas'); cv.width = Math.round(w * 6000); cv.height = Math.round(h * 6000); const c = cv.getContext('2d');
  c.fillStyle = '#0d1610'; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#ffb02e'; c.font = `600 ${cv.height * 0.7}px "B612 Mono", monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, cv.width / 2, cv.height * 0.54);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.3 });
}
// remap a layout drawn on a larger panel onto the measured strip (positions only; control sizes kept)
const fit = (items, sx, sy) => items.map((i) => ({ ...i, x: (i.x || 0) * sx, y: (i.y || 0) * sy, ...(i.pts ? { pts: i.pts.map(([x, y]) => [x * sx, y * sy]) } : {}) }));

export function fcuPanel(M, A) {
  const W = 0.24, H = 0.076, SX = 0.96, SY = 0.76;
  const win = [['SPD', -0.094, 'MACH'], ['HDG', -0.04, 'TRK'], ['ALT', 0.037, ''], ['V/S', 0.096, 'FPA']];
  const items = [];
  for (const [t, x, alt] of win) {
    items.push({ t: 'text', x: x - 0.011, y: 0.042, s: t, size: 0.0042 });
    if (alt) items.push({ t: 'text', x: x + 0.011, y: 0.042, s: alt, size: 0.0042 });
    items.push({ t: 'knob', x, y: 0.0, r: 0.0112, style: 'fcu', ring: false, id: 'k' + t });
  }
  items.push({ t: 'text', x: -0.004, y: 0.042, s: 'LAT', size: 0.0042 }, { t: 'text', x: 0.066, y: 0.042, s: 'LVL/CH', size: 0.0042 },
    { t: 'line', pts: [[0.022, 0.042], [0.048, 0.042]] },
    { t: 'rbtn', x: -0.067, y: 0.003, id: 'spdMach' },
    { t: 'key', x: -0.067, y: -0.03, w: 0.018, h: 0.011, s: 'LOC', id: 'LOC', bar: true },
    { t: 'rbtn', x: -0.012, y: 0.012, id: 'hdgvs' }, { t: 'text', x: -0.024, y: 0.016, s: 'HDG', size: 0.0028 }, { t: 'text', x: -0.024, y: 0.009, s: 'TRK', size: 0.0028 }, { t: 'text', x: 0.0, y: 0.016, s: 'V/S', size: 0.0028 }, { t: 'text', x: 0.0, y: 0.009, s: 'FPA', size: 0.0028 },
    { t: 'rbtn', x: 0.066, y: 0.008, id: 'metric' }, { t: 'text', x: 0.066, y: -0.004, s: 'METRIC ALT', size: 0.0026 },
    { t: 'key', x: -0.024, y: -0.03, w: 0.018, h: 0.011, s: 'AP1', id: 'AP1', bar: true },
    { t: 'key', x: 0.0, y: -0.03, w: 0.018, h: 0.011, s: 'AP2', id: 'AP2', bar: true },
    { t: 'key', x: -0.012, y: -0.044, w: 0.018, h: 0.011, s: 'A/THR', id: 'ATHR', bar: true },
    { t: 'key', x: 0.037, y: -0.03, w: 0.018, h: 0.011, s: 'EXPED', id: 'EXPED', bar: true },
    { t: 'key', x: 0.096, y: -0.03, w: 0.018, h: 0.011, s: 'APPR', id: 'APPR', bar: true },
    { t: 'text', x: 0.037, y: -0.044, s: '100     1000', size: 0.0034 });
  const p = buildPanel({ w: W, h: H, items: fit(items, SX, SY), bg: FCU_BG, name: 'FCU' }, M, A);
  // dark LCD windows above each knob
  p.userData.windows = {};
  for (const [t, x] of win) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(t === 'ALT' ? 0.04 : 0.034, 0.016), lcd({ SPD: '250', HDG: '---  ●', ALT: '05000', 'V/S': '-----' }[t], t === 'ALT' ? 0.04 : 0.034, 0.016));
    w.position.set(x * SX, 0.026 * SY, 0.0008); w.name = 'fcu' + t; p.add(w); p.userData.windows[t] = w;
  }
  return p;
}

export function efisPanel(M, A, side) {
  const items = [
    { t: 'text', x: -0.07, y: 0.042, s: 'QNH', size: 0.0042 }, { t: 'text', x: -0.085, y: 0.028, s: 'inHg', size: 0.0034 }, { t: 'text', x: -0.055, y: 0.028, s: 'hPa', size: 0.0034 },
    { t: 'knob', x: -0.07, y: 0.012, r: 0.0105, style: 'fcu', ring: false, id: 'baro' },
    { t: 'text', x: -0.07, y: -0.004, s: 'PULL STD', size: 0.0032 },
    { t: 'key', x: -0.081, y: -0.028, w: 0.018, h: 0.013, s: 'FD', id: 'FD', bar: true }, { t: 'key', x: -0.058, y: -0.028, w: 0.018, h: 0.013, s: 'LS', id: 'LS', bar: true },
    { t: 'text', x: 0.002, y: 0.042, s: 'CSTR  WPT  VOR.D  NDB  ARPT', size: 0.0034 },
  ];
  ['CSTR', 'WPT', 'VORD', 'NDB', 'ARPT'].forEach((s, i) => items.push({ t: 'key', x: -0.024 + i * 0.0135, y: 0.032, w: 0.011, h: 0.009, s: '', id: s, bar: true }));
  items.push(
    { t: 'text', x: 0.012, y: 0.016, s: 'LS VOR NAV ARC PLAN', size: 0.003 }, { t: 'knob', x: 0.012, y: 0.0, r: 0.0105, id: 'ndMode', ticks: [-60, -30, 0, 30, 60] },
    { t: 'text', x: 0.06, y: 0.016, s: 'RANGE NM', size: 0.0032 }, { t: 'knob', x: 0.06, y: 0.0, r: 0.0105, id: 'ndRange', ticks: [-75, -45, -15, 15, 45, 75] },
    { t: 'text', x: 0.012, y: -0.02, s: 'ADF   VOR', size: 0.0032 }, { t: 'text', x: 0.06, y: -0.02, s: 'ADF   VOR', size: 0.0032 },
    { t: 'toggle', x: 0.012, y: -0.034, id: 'nav1' }, { t: 'toggle', x: 0.06, y: -0.034, id: 'nav2' },
    { t: 'text', x: 0.012, y: -0.046, s: '1', size: 0.0036 }, { t: 'text', x: 0.06, y: -0.046, s: '2', size: 0.0036 });
  const p = buildPanel({ w: 0.16, h: 0.076, items: fit(items, 0.84, 0.76), bg: FCU_BG, name: 'EFIS' + side }, M, A);
  const w = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.012), lcd('1013', 0.034, 0.012)); w.position.set(-0.07 * 0.84, 0.034 * 0.76, 0.0008); w.name = 'baroWin'; p.add(w);
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
