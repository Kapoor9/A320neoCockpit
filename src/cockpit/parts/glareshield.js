// Glareshield panels: FCU (centre), EFIS control panels (each side) and the
// warning block (MASTER WARN / MASTER CAUT, CHRONO, SIDE STICK PRIORITY) outboard.
import * as THREE from 'three';
import { buildPanel } from './panel.js';

const FCU_BG = '#4a555d';
// remap a layout drawn on a larger panel onto the measured strip (positions only; control sizes kept)
const fit = (items, sx, sy) => items.map((i) => ({ ...i, x: (i.x || 0) * sx, y: (i.y || 0) * sy, ...(i.pts ? { pts: i.pts.map(([x, y]) => [x * sx, y * sy]) } : {}) }));

export function fcuPanel(M, A) {
  const W = 0.24, H = 0.076, SX = 0.96, SY = 0.76;
  const win = [['SPD', -0.094, 'MACH'], ['HDG', -0.04, 'TRK'], ['ALT', 0.037, ''], ['V/S', 0.096, 'FPA']];
  const items = [];
  for (const [t, x, alt] of win) {
    items.push({ t: 'text', x: x - 0.011, y: 0.042, s: t, size: 0.0042 });
    if (alt) items.push({ t: 'text', x: x + 0.011, y: 0.042, s: alt, size: 0.0042 });
    items.push({ t: 'knob', x, y: 0.0, r: 0.0115, pointer: false, ring: false, id: 'k' + t });
  }
  items.push({ t: 'text', x: -0.004, y: 0.042, s: 'LAT', size: 0.0042 }, { t: 'text', x: 0.066, y: 0.042, s: 'LVL/CH', size: 0.0042 },
    { t: 'line', pts: [[0.022, 0.042], [0.048, 0.042]] },
    { t: 'key', x: -0.067, y: 0.0, w: 0.018, h: 0.011, s: 'SPD\nMACH', id: 'spdMach' },
    { t: 'key', x: -0.067, y: -0.03, w: 0.018, h: 0.011, s: 'LOC', id: 'LOC' },
    { t: 'key', x: -0.013, y: 0.0, w: 0.02, h: 0.011, s: 'HDG V/S\nTRK FPA', id: 'hdgvs' },
    { t: 'key', x: 0.066, y: 0.0, w: 0.018, h: 0.011, s: 'METRIC\nALT', id: 'metric' },
    { t: 'key', x: -0.024, y: -0.03, w: 0.018, h: 0.011, s: 'AP1', id: 'AP1' },
    { t: 'key', x: 0.0, y: -0.03, w: 0.018, h: 0.011, s: 'AP2', id: 'AP2' },
    { t: 'key', x: -0.012, y: -0.044, w: 0.018, h: 0.011, s: 'A/THR', id: 'ATHR' },
    { t: 'key', x: 0.037, y: -0.03, w: 0.018, h: 0.011, s: 'EXPED', id: 'EXPED' },
    { t: 'key', x: 0.096, y: -0.03, w: 0.018, h: 0.011, s: 'APPR', id: 'APPR' },
    { t: 'text', x: 0.037, y: -0.044, s: '100     1000', size: 0.0034 });
  const p = buildPanel({ w: W, h: H, items: fit(items, SX, SY), bg: FCU_BG, name: 'FCU' }, M, A);
  // dark LCD windows above each knob
  p.userData.windows = {};
  for (const [t, x] of win) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(t === 'ALT' ? 0.04 : 0.034, 0.016), M.screen);
    w.position.set(x * SX, 0.026 * SY, 0.0008); w.name = 'fcu' + t; p.add(w); p.userData.windows[t] = w;
  }
  return p;
}

export function efisPanel(M, A, side) {
  const items = [
    { t: 'text', x: -0.07, y: 0.042, s: 'QNH', size: 0.0042 }, { t: 'text', x: -0.085, y: 0.028, s: 'inHg', size: 0.0034 }, { t: 'text', x: -0.055, y: 0.028, s: 'hPa', size: 0.0034 },
    { t: 'knob', x: -0.07, y: 0.012, r: 0.011, pointer: false, ring: false, id: 'baro' },
    { t: 'text', x: -0.07, y: -0.004, s: 'PULL STD', size: 0.0032 },
    { t: 'key', x: -0.081, y: -0.028, w: 0.018, h: 0.012, s: 'FD', id: 'FD' }, { t: 'key', x: -0.058, y: -0.028, w: 0.018, h: 0.012, s: 'LS', id: 'LS' },
    { t: 'text', x: 0.002, y: 0.042, s: 'CSTR  WPT  VOR.D  NDB  ARPT', size: 0.0034 },
  ];
  ['CSTR', 'WPT', 'VORD', 'NDB', 'ARPT'].forEach((s, i) => items.push({ t: 'key', x: -0.024 + i * 0.0135, y: 0.032, w: 0.011, h: 0.009, s: '', id: s }));
  items.push(
    { t: 'text', x: 0.012, y: 0.016, s: 'LS VOR NAV ARC PLAN', size: 0.003 }, { t: 'knob', x: 0.012, y: 0.0, r: 0.0105, id: 'ndMode', ticks: [-60, -30, 0, 30, 60] },
    { t: 'text', x: 0.06, y: 0.016, s: 'RANGE NM', size: 0.0032 }, { t: 'knob', x: 0.06, y: 0.0, r: 0.0105, id: 'ndRange', ticks: [-75, -45, -15, 15, 45, 75] },
    { t: 'text', x: 0.012, y: -0.02, s: 'ADF   VOR', size: 0.0032 }, { t: 'text', x: 0.06, y: -0.02, s: 'ADF   VOR', size: 0.0032 },
    { t: 'toggle', x: 0.012, y: -0.034, id: 'nav1' }, { t: 'toggle', x: 0.06, y: -0.034, id: 'nav2' },
    { t: 'text', x: 0.012, y: -0.046, s: '1', size: 0.0036 }, { t: 'text', x: 0.06, y: -0.046, s: '2', size: 0.0036 });
  const p = buildPanel({ w: 0.16, h: 0.076, items: fit(items, 0.84, 0.76), bg: FCU_BG, name: 'EFIS' + side }, M, A);
  const w = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.012), M.screen); w.position.set(-0.07, 0.034, 0.0008); w.name = 'baroWin'; p.add(w);
  return p;
}

export function warningPanel(M, A) {
  const items = [
    { t: 'text', x: 0, y: 0.044, s: 'CHRONO', size: 0.0034 }, { t: 'key', x: 0, y: 0.033, w: 0.016, h: 0.01, s: '', id: 'chrono' },
    { t: 'text', x: 0, y: -0.036, s: 'SIDE STICK\nPRIORITY', size: 0.0028 },
    { t: 'text', x: 0, y: -0.048, s: 'AUTO LAND', size: 0.0026 },
  ];
  const p = buildPanel({ w: 0.1, h: 0.076, items: fit(items, 1.5, 0.76), bg: FCU_BG, name: 'warnBlock' }, M, A);
  // MASTER WARN (red) and MASTER CAUT (amber) push-to-reset lights: dark lenses until lit
  const mk = (txt, y, id) => {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.026, 0.004), M.panelDark); frame.position.z = 0.002; g.add(frame);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.022, 0.006), new THREE.MeshStandardMaterial({ color: 0x1a1d1f, roughness: 0.25 })); lens.position.z = 0.006; g.add(lens);
    const lab = A.mesh(txt.split('\n'), 0.015, { px: 30, color: '#4f5458' }, 0.036); lab.position.z = 0.0092; g.add(lab);
    g.position.set(0, y, 0); g.name = id; p.add(g); return lens;
  };
  p.userData.masterWarn = mk('MASTER\nWARN', 0.01, 'masterWarn');
  p.userData.masterCaut = mk('MASTER\nCAUT', -0.017, 'masterCaut');
  return p;
}
