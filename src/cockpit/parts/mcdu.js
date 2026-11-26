// A320 MCDU front panel: 146 x 228 mm. Built facing +Z, centred on its own origin, +Y = top.
// Layout follows the real unit: screen with 6 line select keys each side, annunciators,
// page keys, slew keys, numeric keypad on the left and the A–Z block on the right.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

const mm = (v) => v / 1000;
const W = 146, H = 228;
const box = (w, h, d, r, mat) => { const rr = Math.min(r, w / 2, h / 2, d / 2) * 0.98; const m = new THREE.Mesh(new RoundedBoxGeometry(mm(w), mm(h), mm(d), 3, mm(rr)), mat); m.castShadow = true; m.receiveShadow = true; return m; };

export function makeMCDU(M, atlas, { side = -1 } = {}) {
  const g = new THREE.Group(); g.name = 'MCDU' + (side < 0 ? '1' : '2');
  const body = new THREE.MeshStandardMaterial({ color: 0x6a798a, roughness: 0.6 });   // same paint as the pedestal panels
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.45 });
  const keyLight = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.45 });
  const toY = (top) => mm(H / 2 - top);       // measure from the top edge, in mm
  const toX = (left) => mm(left - W / 2);

  // front plate and the case behind it
  const plate = box(W, H, 6, 4, body); plate.position.z = -mm(3); g.add(plate);
  // screen bezel recess + glass
  const bez = box(100, 80, 3, 2, new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.4 })); bez.position.set(0, toY(48), mm(0.2)); g.add(bez);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(mm(92), mm(72)), M.screen.clone());
  screen.position.set(0, toY(48), mm(1.8)); screen.name = 'mcduScreen'; g.add(screen);

  const keys = {};
  const key = (id, label, x, y, w, h, { mat = keyMat, px = 30, lines = null, round = false } = {}) => {
    const k = box(w, h, 5, round ? Math.min(w, h) / 2.2 : 1.6, mat);
    k.position.set(toX(x), toY(y), mm(2.5)); k.name = 'key:' + id; g.add(k);
    if (label) {
      const t = lines ?? label;
      const lh = Array.isArray(t) ? mm(h) * 0.78 : mm(Math.min(h * 0.55, 5.2));
      const lab = atlas.mesh(t, lh, { px, weight: 600, aspect: (mm(w) * 0.92) / lh }, mm(w) * 0.92);
      lab.position.set(toX(x), toY(y), mm(5.1)); g.add(lab);
    }
    keys[id] = k; return k;
  };

  // line select keys: 6 each side, aligned to screen lines 2,4,..,12 of 14
  for (let i = 0; i < 6; i++) {
    const y = 18 + i * 11.3;
    key('LSK' + (i + 1) + 'L', '—', 11, y, 13, 7, { px: 40 });
    key('LSK' + (i + 1) + 'R', '—', W - 11, y, 13, 7, { px: 40 });
  }
  // annunciators (dark until lit)
  const ann = (txt, x, y) => { const l = atlas.mesh(txt, mm(3.2), { px: 26, weight: 600, color: '#6d7377' }); l.position.set(toX(x), toY(y), mm(0.6)); g.add(l); };
  ann('FAIL', 12, 92); ann('FM1', 26, 92); ann('IND', 40, 92); ann('RDY', 54, 92);
  ann('FM2', W - 40, 92); ann('FM', W - 26, 92);
  // brightness knob with BRT/DIM legend
  const knobG = new THREE.Mesh(new THREE.CylinderGeometry(mm(6.5), mm(7), mm(7), 32).rotateX(Math.PI / 2), M.rubber);
  knobG.position.set(toX(W - 14), toY(108), mm(3.5)); g.add(knobG);
  const brt = atlas.mesh('BRT', mm(3), { px: 26 }); brt.position.set(toX(W - 14), toY(99.5), mm(0.6)); g.add(brt);
  const dim = atlas.mesh('DIM', mm(3), { px: 26 }); dim.position.set(toX(W - 14), toY(116.5), mm(0.6)); g.add(dim);

  // page keys (two rows) + AIRPORT
  const fw = 18.5, fh = 9, fx0 = 14;
  ['DIR', 'PROG', 'PERF', 'INIT', 'DATA'].forEach((t, i) => key(t, t, fx0 + i * (fw + 2.2), 103, fw, fh, { mat: keyLight, px: 30 }));
  [['F-PLN', 'F-PLN'], ['RAD NAV', ['RAD', 'NAV']], ['FUEL PRED', ['FUEL', 'PRED']], ['SEC F-PLN', ['SEC', 'F-PLN']], ['ATC COMM', ['ATC', 'COMM']], ['MCDU MENU', ['MCDU', 'MENU']]]
    .forEach(([id, t], i) => key(id, id, fx0 + i * (fw + 2.2), 115, fw, fh + 1.5, { mat: keyLight, px: 26, lines: t }));
  key('AIRPORT', 'AIRPORT', fx0, 127.5, fw, fh, { mat: keyLight, px: 24 });
  // slew keys
  key('LEFT', '←', fx0, 139.5, fw, fh, { mat: keyLight, px: 40 });
  key('UP', '↑', fx0 + fw + 2.2, 139.5, fw, fh, { mat: keyLight, px: 40 });
  key('RIGHT', '→', fx0, 151.5, fw, fh, { mat: keyLight, px: 40 });
  key('DOWN', '↓', fx0 + fw + 2.2, 151.5, fw, fh, { mat: keyLight, px: 40 });
  // numeric keypad (left)
  const nk = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['.', '0', '+/-']];
  nk.forEach((row, r) => row.forEach((t, c) => key(t === '+/-' ? 'PLUSMINUS' : t, t, 12 + c * 13, 167 + r * 13, 11, 10.5, { round: true, px: 40 })));
  // A–Z block (right), 5 columns, then SP / OVFY / CLR
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const ax0 = 64, ay0 = 128.5, ap = 13.6;
  letters.forEach((t, i) => key(t, t, ax0 + (i % 5) * ap, ay0 + Math.floor(i / 5) * 13, 11, 10.5, { px: 40 }));
  key('/', '/', ax0 + 1 * ap, ay0 + 5 * 13, 11, 10.5, { px: 40 });
  key('SP', 'SP', ax0 + 2 * ap, ay0 + 5 * 13, 11, 10.5, { px: 32 });
  key('OVFY', 'Δ', ax0 + 3 * ap, ay0 + 5 * 13, 11, 10.5, { px: 40 });
  key('CLR', 'CLR', ax0 + 4 * ap, ay0 + 5 * 13, 11, 10.5, { px: 30 });

  // corner fasteners
  const sg = new THREE.CylinderGeometry(mm(2.6), mm(2.6), mm(1.2), 12).rotateX(Math.PI / 2);
  for (const [x, y] of [[5, 5], [W - 5, 5], [5, H - 5], [W - 5, H - 5]]) { const s = new THREE.Mesh(sg, M.screw); s.position.set(toX(x), toY(y), mm(0.6)); g.add(s); }

  return { group: g, screen, keys, width: mm(W), height: mm(H) };
}
