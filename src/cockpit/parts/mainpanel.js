// Main instrument panel sub-panels (A320): outboard lighting panels, the centre-left
// standby column, landing gear / autobrake / brake column. Positions are panel-local metres.
import * as THREE from 'three';
import { buildPanel } from './panel.js';

// outboard lighting / loudspeaker panel (captain: side -1, F/O: side +1)
export function lightingPanel(M, A, side) {
  const items = [
    { t: 'annun', x: side < 0 ? 0.045 : -0.045, y: 0.036, w: 0.024, h: 0.016, s: 'PULL UP' },
    { t: 'text', x: -0.045, y: 0.018, s: 'PFD', size: 0.0034 }, { t: 'knob', x: -0.045, y: 0.0, r: 0.008, id: 'pfdBrt' },
    { t: 'text', x: 0.0, y: 0.018, s: 'PFD/ND', size: 0.0034 }, { t: 'knob', x: 0.0, y: 0.0, r: 0.008, id: 'ndBrt' },
    { t: 'text', x: 0.045, y: 0.018, s: 'ND', size: 0.0034 }, { t: 'knob', x: 0.045, y: 0.0, r: 0.008, id: 'wxBrt' },
    { t: 'text', x: -0.045, y: -0.022, s: 'LOUDSPEAKER', size: 0.003 }, { t: 'knob', x: -0.045, y: -0.038, r: 0.008, id: 'loud' },
    { t: 'text', x: 0.0, y: -0.022, s: 'CONSOLE/FLOOR', size: 0.003 }, { t: 'toggle', x: 0.0, y: -0.04, id: 'console' },
    { t: 'text', x: 0.045, y: -0.022, s: 'PILOT WINDOW', size: 0.003 }, { t: 'toggle', x: 0.045, y: -0.04, id: 'winHeat' },
  ];
  return buildPanel({ w: 0.15, h: 0.1, items, name: 'lighting' + side }, M, A);
}

export function terrPanel(M, A, side) {
  return buildPanel({ w: 0.036, h: 0.04, name: 'terr' + side, items: [{ t: 'text', x: 0, y: 0.014, s: 'TERR ON ND', size: 0.0028 }, { t: 'pb', x: 0, y: -0.004, w: 0.016, h: 0.016, legends: ['', 'ON'], id: 'terrOnNd' + side }] }, M, A);
}

// LDG GEAR indicator (three pairs of green/red lights) + A/BRK
export function gearIndicator(M, A) {
  const items = [{ t: 'text', x: 0, y: 0.02, s: 'LDG GEAR', size: 0.0036 }];
  [-0.034, 0, 0.034].forEach((x) => { items.push({ t: 'annun', x, y: 0.006, w: 0.024, h: 0.01, s: '▼' }, { t: 'annun', x, y: -0.008, w: 0.024, h: 0.01, s: 'UNLK' }); });
  return buildPanel({ w: 0.12, h: 0.05, name: 'gearInd', items }, M, A);
}
export function autobrakePanel(M, A) {
  // AUTO BRK LO/MED/MAX with the A/SKID & N/W STRG switch to its right (as on the neo)
  const items = [{ t: 'text', x: -0.022, y: 0.014, s: 'AUTO BRK', size: 0.0034 }, { t: 'line', pts: [[-0.062, 0.02], [0.062, 0.02]], w: 0.0006 }];
  [['LO', -0.046], ['MED', -0.022], ['MAX', 0.006]].forEach(([s, x]) => items.push({ t: 'text', x, y: 0.007, s, size: 0.0026 }, { t: 'pb', x, y: -0.006, w: 0.02, h: 0.015, legends: ['DECEL', ''], id: 'abrk' + s }));
  items.push({ t: 'text', x: 0.042, y: 0.014, s: 'A/SKID &', size: 0.0026 }, { t: 'text', x: 0.042, y: 0.008, s: 'N/W STRG', size: 0.0026 }, { t: 'toggle', x: 0.04, y: -0.007, id: 'askid' }, { t: 'text', x: 0.054, y: -0.001, s: 'ON', size: 0.0024 }, { t: 'text', x: 0.054, y: -0.014, s: 'OFF', size: 0.0024 });
  return buildPanel({ w: 0.13, h: 0.036, name: 'autobrake', items }, M, A);
}
export function brakeSwitchPanel(M, A) {
  const items = [
    { t: 'text', x: -0.03, y: 0.022, s: 'A/SKID &', size: 0.0032 }, { t: 'text', x: -0.03, y: 0.016, s: 'N/W STRG', size: 0.0032 },
    { t: 'toggle', x: -0.03, y: -0.002, id: 'askid' }, { t: 'text', x: -0.015, y: 0.004, s: 'ON', size: 0.0028, align: 'left' }, { t: 'text', x: -0.015, y: -0.008, s: 'OFF', size: 0.0028, align: 'left' },
    { t: 'text', x: 0.03, y: 0.019, s: 'BRK FAN', size: 0.0032 }, { t: 'pb', x: 0.03, y: 0.0, w: 0.018, h: 0.016, legends: ['HOT', 'ON'], id: 'brkFan' },
  ];
  return buildPanel({ w: 0.12, h: 0.058, name: 'brakeSw', items }, M, A);
}
export function gearLeverPanel(M, A) {
  const items = [{ t: 'text', x: 0, y: 0.052, s: 'UP', size: 0.004 }, { t: 'text', x: 0, y: -0.052, s: 'DOWN', size: 0.004 },
    { t: 'line', pts: [[0, 0.044], [0, -0.044]], w: 0.001 }, { t: 'box', x: 0, y: 0, w: 0.018, h: 0.09 }];
  return buildPanel({ w: 0.05, h: 0.12, name: 'gearPanel', items }, M, A);
}

// standby instrument (ISIS): square bezel with four corner buttons and a knob
export function isis(M, size = 0.08) {
  const g = new THREE.Group();
  const bez = new THREE.Mesh(new THREE.BoxGeometry(size, size, 0.018), M.bezel); bez.position.z = 0.009; g.add(bez);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.7, size * 0.7), M.screen); scr.position.set(-size * 0.04, 0, 0.0185); g.add(scr);
  const bm = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.5 });
  for (const [x, y] of [[-0.4, 0.43], [0.32, 0.43], [-0.4, -0.43], [0.32, -0.43]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(size * 0.16, size * 0.07, 0.004), bm); b.position.set(x * size, y * size, 0.02); g.add(b); }
  const k = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.07, size * 0.07, 0.01, 20).rotateX(Math.PI / 2), bm); k.position.set(size * 0.39, -size * 0.3, 0.022); g.add(k);
  g.userData.screen = scr; return g;
}
// round instrument (DDRMI / triple brake indicator) in a square case
export function roundInstrument(M, size = 0.06) {
  const g = new THREE.Group();
  const bez = new THREE.Mesh(new THREE.BoxGeometry(size, size, 0.016), M.bezel); bez.position.z = 0.008; g.add(bez);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(size * 0.4, 40), new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.35 })); dial.position.z = 0.0162; g.add(dial);
  const glass = new THREE.Mesh(new THREE.TorusGeometry(size * 0.41, size * 0.025, 8, 40), M.bezel); glass.position.z = 0.0165; g.add(glass);
  return g;
}
