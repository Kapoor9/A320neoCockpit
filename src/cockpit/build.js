// Builds the A320neo flight deck geometry. All shapes are original, made from the
// dimensions in dims.js. Rounded edges everywhere: real cockpit parts have no sharp boxes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import * as D from './dims.js';

// ---------------------------------------------------------------- materials
// Colours: Airbus flight-deck blue-grey panels, near-black anti-glare glareshield,
// light warm-grey linings, dark blue carpet. Muted, as seen by day.
export function makeMaterials() {
  const std = (color, roughness, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    panel: std(0x5a666e, 0.62),          // instrument panel blue-grey
    panelDark: std(0x47525a, 0.66),      // panel frames and seams
    module: std(0x56626a, 0.58),         // individual 146 mm system panels
    seam: std(0x2b3236, 0.8),
    glare: std(0x26292c, 0.9),           // anti-glare finish
    fcu: std(0x4f5a62, 0.6),
    lining: std(0xa9aba7, 0.85),         // sidewall lining
    ceiling: std(0xb3b4b0, 0.88),
    trim: std(0x7d8286, 0.7),
    frame: std(0x3a3f43, 0.55, 0.2),     // window frames
    carpet: std(0x283142, 0.98),
    seatFabric: std(0x4b535b, 0.95),
    seatBlue: std(0x2f4466, 0.95),
    seatShell: std(0x2e3337, 0.55),
    metal: std(0x9aa0a3, 0.35, 0.8),
    rubber: std(0x1c1e20, 0.9),
    bezel: std(0x2a2f33, 0.45, 0.1),
    screen: new THREE.MeshPhysicalMaterial({ color: 0x07090b, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe0ea, roughness: 0.02, transmission: 0, transparent: true, opacity: 0.08, depthWrite: false }),
  };
}

const rbox = (w, h, d, r, mat, seg = 3) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)), mat);
  m.castShadow = true; m.receiveShadow = true; return m;
};

// A side profile ([z, y] points) extruded across x, with rounded (bevelled) edges.
function extrudeProfile(points, x0, x1, mat, bevel = 0.008) {
  const s = new THREE.Shape();
  points.forEach(([z, y], i) => (i ? s.lineTo(-z, y) : s.moveTo(-z, y)));
  s.closePath();
  const width = x1 - x0 - 2 * bevel;
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 4 });
  g.rotateY(Math.PI / 2);
  g.translate(x0 + bevel, 0, 0);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}

// A group whose local XY plane is a panel face: X = across (right), Y = "up" as read, Z = towards the viewer.
function panelFrame(origin, yDir) {
  const X = new THREE.Vector3(1, 0, 0);
  const Y = yDir.clone().normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
  const g = new THREE.Group();
  g.matrixAutoUpdate = false;
  g.matrix.makeBasis(X, Y, Z).setPosition(origin);
  return g;
}

// ---------------------------------------------------------------- fuselage shell
function shellAt(z) {
  const S = D.SHELL;
  if (z <= S[0][0]) return S[0].slice(1);
  for (let i = 1; i < S.length; i++) {
    if (z <= S[i][0]) {
      const t = (z - S[i - 1][0]) / (S[i][0] - S[i - 1][0]);
      const e = t * t * (3 - 2 * t);
      return [1, 2, 3].map((k) => S[i - 1][k] + (S[i][k] - S[i - 1][k]) * e);
    }
  }
  return S[S.length - 1].slice(1);
}
// point on the cross-section: s in [0,1] from left floor, over the crown, to right floor
function ringPoint(z, s) {
  const [hw0, hws, crown] = shellAt(z);
  const side = s < 0.5 ? -1 : 1; const u = s < 0.5 ? s * 2 : (1 - s) * 2; // 0 at floor, 1 at crown
  const split = 0.38;
  if (u < split) {               // lower wall: floor -> shoulder, slight outward bulge
    const t = u / split;
    const x = hw0 + (hws - hw0) * Math.sin(t * Math.PI / 2);
    return [side * x, D.SHOULDER_Y * t];
  }
  const t = (u - split) / (1 - split);           // upper arc: shoulder -> crown
  const a = t * Math.PI / 2;
  return [side * hws * Math.cos(a), D.SHOULDER_Y + (crown - D.SHOULDER_Y) * Math.sin(a)];
}
function isOpening(x, y, z) {
  const W = D.WINDOWS;
  if (z >= W.windshield.z0 && z <= W.windshield.z1 && y > W.windshield.y0) return true;
  for (const w of [W.side2, W.side3]) if (z >= w.z0 && z <= w.z1 && y >= w.y0 && y <= w.y1) return true;
  return false;
}
function buildShell(M) {
  const z0 = -0.45, z1 = D.REAR_WALL_Z, nz = 64, ns = 72;
  const pos = []; const idxLining = []; const idxCeil = [];
  for (let i = 0; i <= nz; i++) {
    const z = z0 + (z1 - z0) * i / nz;
    for (let j = 0; j <= ns; j++) { const [x, y] = ringPoint(z, j / ns); pos.push(x, y, z); }
  }
  const V = (i, j) => i * (ns + 1) + j;
  for (let i = 0; i < nz; i++) for (let j = 0; j < ns; j++) {
    const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1);
    const cx = (pos[a * 3] + pos[c * 3]) / 2, cy = (pos[a * 3 + 1] + pos[c * 3 + 1]) / 2, cz = (pos[a * 3 + 2] + pos[c * 3 + 2]) / 2;
    if (isOpening(cx, cy, cz)) continue;
    (cy > 1.5 ? idxCeil : idxLining).push(a, b, c, a, c, d);
  }
  const mk = (idx, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat.clone()); m.material.side = THREE.DoubleSide; m.receiveShadow = true; return m;
  };
  const grp = new THREE.Group();
  grp.add(mk(idxLining, M.lining), mk(idxCeil, M.ceiling));

  // floor
  const fw = shellAt(1)[0] * 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, z1 - z0 + 0.1), M.carpet);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.001, (z0 + z1) / 2); floor.receiveShadow = true;
  grp.add(floor);

  // rear bulkhead with the cockpit door
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.1), M.lining); rw.position.set(0, 1.0, z1 - 0.005); rw.rotation.y = Math.PI;
  grp.add(rw);
  const door = rbox(0.72, 1.85, 0.04, 0.01, M.trim); door.position.set(0.0, 0.93, z1 - 0.03); grp.add(door);

  // window frames and posts
  const W = D.WINDOWS; const f = M.frame;
  const post = (a, b, t = 0.05) => {           // a frame bar between two points
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const m = rbox(t, len, t, t * 0.3, f); m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    grp.add(m); return m;
  };
  for (const s of [-1, 1]) {
    const onWall = (z, y) => { // x on the shell at this station/height (approx, for frames)
      let best = null; for (let k = 0; k <= 200; k++) { const p = ringPoint(z, s < 0 ? k / 400 : 1 - k / 400); if (!best || Math.abs(p[1] - y) < Math.abs(best[1] - y)) best = p; }
      return best[0] - s * 0.01;
    };
    for (const w of [W.side2, W.side3]) {
      post([onWall(w.z0, w.y0), w.y0, w.z0], [onWall(w.z0, w.y1), w.y1, w.z0]);
      post([onWall(w.z1, w.y0), w.y0, w.z1], [onWall(w.z1, w.y1), w.y1, w.z1]);
      post([onWall(w.z0, w.y0), w.y0, w.z0], [onWall(w.z1, w.y0), w.y0, w.z1], 0.045);
      post([onWall(w.z0, w.y1), w.y1, w.z0], [onWall(w.z1, w.y1), w.y1, w.z1], 0.045);
    }
    // corner post between windshield and the side window
    post([s * 0.86, D.GLARE.topY, -0.18], [onWall(W.windshield.z1, 1.55), shellAt(W.windshield.z1)[2] - 0.08, W.windshield.z1], 0.05);
  }
  // windshield centre post and top bar
  const topY = shellAt(W.windshield.z1)[2] - 0.06;
  post([0, D.GLARE.topY, D.GLARE.frontZ + 0.02], [0, topY, W.windshield.z1], 0.045);
  const tb = rbox(1.6, 0.06, 0.08, 0.02, f); tb.position.set(0, topY, W.windshield.z1); grp.add(tb);
  // windshield glass (faint, for reflections)
  for (const s of [-1, 1]) {
    const A = new THREE.Vector3(s * 0.03, D.GLARE.topY + 0.005, D.GLARE.frontZ + 0.03);
    const B = new THREE.Vector3(s * 0.84, D.GLARE.topY + 0.005, -0.16);
    const C = new THREE.Vector3(s * 0.66, topY - 0.03, W.windshield.z1 - 0.01);
    const E = new THREE.Vector3(s * 0.03, topY - 0.03, W.windshield.z1 - 0.01);
    const g = new THREE.BufferGeometry().setFromPoints([A, B, C, A, C, E]); g.computeVertexNormals();
    const gl = new THREE.Mesh(g, M.glass); gl.material.side = THREE.DoubleSide; gl.renderOrder = 10; grp.add(gl);
  }
  return grp;
}

// ---------------------------------------------------------------- main instrument panel
function buildMainPanel(M, refs) {
  const P = D.PANEL; const t = THREE.MathUtils.degToRad(P.tiltDeg);
  const yDir = new THREE.Vector3(0, Math.cos(t), -Math.sin(t));
  const frame = panelFrame(new THREE.Vector3(0, P.baseY, 0), yDir);
  refs.mainPanel = frame;
  const thick = 0.05;
  const slab = (x0, x1, y0, y1, mat = M.panel) => {
    const m = rbox(x1 - x0, y1 - y0, thick, 0.012, mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, -thick / 2); frame.add(m); return m;
  };
  const sideY0 = P.bottomSideY - P.baseY;
  slab(-P.halfWidth, -P.centreHalf - 0.004, sideY0, P.height);
  slab(P.centreHalf + 0.004, P.halfWidth, sideY0, P.height);
  slab(-P.centreHalf, P.centreHalf, 0, P.height);
  // knee panels below the side panels
  slab(-P.halfWidth, -P.centreHalf - 0.004, -0.12, sideY0 - 0.004, M.panelDark);
  slab(P.centreHalf + 0.004, P.halfWidth, -0.12, sideY0 - 0.004, M.panelDark);

  // display units
  refs.screens = {};
  for (const [name, [x, y]] of Object.entries(D.DU_POS)) {
    const b = rbox(D.DU.bezel, D.DU.bezel, D.DU.depth, 0.008, M.bezel);
    b.position.set(x, y, D.DU.depth / 2 - 0.004); frame.add(b);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(D.DU.screen, D.DU.screen), M.screen.clone());
    scr.position.set(x, y, D.DU.depth - 0.002); scr.name = name; frame.add(scr);
    refs.screens[name] = scr;
    // the brightness knob in the bezel corner
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 20), M.rubber);
    k.rotation.x = Math.PI / 2; k.position.set(x + D.DU.bezel / 2 - 0.016, y - D.DU.bezel / 2 + 0.016, D.DU.depth + 0.004); frame.add(k);
  }
  // standby instrument (ISIS) and clock, left of the E/WD
  const isis = rbox(0.095, 0.095, 0.03, 0.006, M.bezel); isis.position.set(-0.25, 0.30, 0.012); frame.add(isis);
  const isisScr = new THREE.Mesh(new THREE.PlaneGeometry(0.078, 0.078), M.screen); isisScr.position.set(-0.25, 0.30, 0.028); frame.add(isisScr);
  refs.screens.ISIS = isisScr;
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 40), M.bezel);
  clock.rotation.x = Math.PI / 2; clock.position.set(-0.25, 0.15, 0.01); frame.add(clock);
  // landing gear panel + lever, right of the lower ECAM
  const gp = rbox(0.11, 0.17, 0.02, 0.006, M.module); gp.position.set(0.20, 0.10, 0.008); frame.add(gp);
  const lever = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 12), M.metal); shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.035; lever.add(shaft);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.016, 24), M.trim); wheel.rotation.z = Math.PI / 2; wheel.position.z = 0.07; lever.add(wheel);
  lever.position.set(0.20, 0.09, 0.02); frame.add(lever); refs.gearLever = lever;
  // autobrake panel, right of the E/WD
  const ab = rbox(0.11, 0.08, 0.02, 0.006, M.module); ab.position.set(0.25, 0.31, 0.008); frame.add(ab);
  return frame;
}

// ---------------------------------------------------------------- glareshield, FCU, EFIS panels
function buildGlareshield(M, refs) {
  const G = D.GLARE; const grp = new THREE.Group();
  // anti-glare hood across the panel
  const prof = [[G.frontZ, G.topY - 0.045], [G.frontZ + 0.02, G.topY], [G.rearZ - 0.02, G.topY - 0.005], [G.rearZ, G.topY - 0.03], [G.rearZ, G.underY], [-0.07, G.underY - 0.005], [G.frontZ, G.underY + 0.02]];
  grp.add(extrudeProfile(prof, -1.02, 1.02, M.glare, 0.012));
  // FCU box, standing proud in the centre
  const F = G.fcu;
  const fcu = rbox(F.halfWidth * 2, F.y1 - F.y0, F.rearZ - G.rearZ + 0.02, 0.01, M.fcu);
  fcu.position.set(0, (F.y0 + F.y1) / 2, (F.rearZ + G.rearZ) / 2 - 0.01); grp.add(fcu);
  refs.fcu = fcu;
  // FCU windows (SPD, HDG, ALT, V/S) as dark recessed displays
  const winMat = M.screen;
  for (const [x, w] of [[-0.235, 0.07], [-0.10, 0.07], [0.105, 0.085], [0.235, 0.08]]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.024), winMat); win.position.set(x, F.y1 - 0.025, F.rearZ + 0.0005); grp.add(win);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.028, 32), M.rubber);
    knob.rotation.x = Math.PI / 2; knob.position.set(x, F.y0 + 0.042, F.rearZ + 0.014); grp.add(knob);
  }
  // AP1 / AP2 / A/THR / EXPED / APPR / LOC keys
  const keyMat = M.panelDark;
  [[-0.03, 'LOC'], [0.03, 'AP1'], [0.0, 'A/THR']].forEach(() => {});
  for (const [x, y] of [[-0.168, 0.94], [-0.03, 0.965], [0.03, 0.965], [0.0, 0.93], [0.168, 0.94], [-0.03, 0.93], [0.03, 0.93]]) {
    const k = rbox(0.034, 0.022, 0.012, 0.004, keyMat); k.position.set(x, y, F.rearZ + 0.006); grp.add(k);
  }
  // EFIS control panels and the master warning / caution blocks, each side
  for (const s of [-1, 1]) {
    const E = G.efis;
    const efis = rbox(E.width, F.y1 - F.y0, E.rearZ - G.rearZ + 0.02, 0.008, M.fcu);
    efis.position.set(s * E.x, (F.y0 + F.y1) / 2, (E.rearZ + G.rearZ) / 2 - 0.01); grp.add(efis);
    for (const [dx, dy, r] of [[-0.04, -0.03, 0.017], [0.035, -0.03, 0.017], [0, 0.035, 0.014]]) {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.022, 28), M.rubber);
      k.rotation.x = Math.PI / 2; k.position.set(s * E.x + dx, (F.y0 + F.y1) / 2 + dy, E.rearZ + 0.011); grp.add(k);
    }
    const Mm = G.master;
    const mb = rbox(Mm.width, F.y1 - F.y0, Mm.rearZ - G.rearZ + 0.02, 0.008, M.fcu);
    mb.position.set(s * Mm.x, (F.y0 + F.y1) / 2, (Mm.rearZ + G.rearZ) / 2 - 0.01); grp.add(mb);
    for (const dy of [0.025, -0.025]) {
      const lens = rbox(0.05, 0.036, 0.01, 0.004, M.bezel);
      lens.position.set(s * Mm.x, (F.y0 + F.y1) / 2 + dy, Mm.rearZ + 0.004); grp.add(lens);
    }
  }
  return grp;
}

// ---------------------------------------------------------------- centre pedestal
function buildPedestal(M, refs) {
  const P = D.PEDESTAL; const grp = new THREE.Group();
  const top = P.profile; const prof = [[0.02, 0.0], ...top, [P.rearZ, top[top.length - 1][1] - 0.02], [P.rearZ, 0.0]];
  grp.add(extrudeProfile(prof, -P.halfWidth, P.halfWidth, M.panelDark, 0.012));
  // MCDUs on the forward slope
  const [a, b] = [top[0], top[1]];
  const yDir = new THREE.Vector3(0, a[1] - b[1], a[0] - b[0]);
  const mid = new THREE.Vector3(0, (a[1] + b[1]) / 2 + 0.004, (a[0] + b[0]) / 2);
  const slope = panelFrame(mid, yDir); grp.add(slope); refs.mcduFrame = slope;
  refs.mcdus = [];
  for (const s of [-1, 1]) {
    const u = rbox(0.146, 0.215, 0.02, 0.008, M.module); u.position.set(s * 0.083, 0.03, 0.006); slope.add(u);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.105, 0.085), M.screen); scr.position.set(s * 0.083, 0.08, 0.0165); slope.add(scr);
    refs.mcdus.push(scr);
    // keypad rows
    for (let r = 0; r < 7; r++) for (let c = 0; c < 6; c++) {
      const k = rbox(0.016, 0.011, 0.006, 0.002, M.panelDark);
      k.position.set(s * 0.083 - 0.048 + c * 0.0192, 0.017 - r * 0.0145, 0.018); slope.add(k);
    }
  }
  // flat section: ECAM control panel, thrust quadrant, engine panel, radio panels
  const flat = panelFrame(new THREE.Vector3(0, top[1][1] + 0.002, (top[1][0] + top[3][0]) / 2), new THREE.Vector3(0, 0, -1));
  grp.add(flat);
  const L = top[3][0] - top[1][0];
  const modules = [[0.05, 0.08], [0.20, 0.17], [0.34, 0.08], [0.47, 0.12], [0.58, 0.07]]; // [start from front, length]
  for (const [s0, len] of modules) {
    const m = rbox(0.44, len - 0.006, 0.012, 0.004, M.module); m.position.set(0, L / 2 - s0 - len / 2, 0.0); flat.add(m);
  }
  // thrust levers
  refs.thrustLevers = [];
  for (const s of [-1, 1]) {
    const lever = new THREE.Group();
    const arm = rbox(0.018, 0.012, 0.17, 0.005, M.metal); arm.position.set(0, 0, 0.085); lever.add(arm);
    const handle = rbox(0.07, 0.03, 0.035, 0.012, M.rubber); handle.position.set(s * 0.02, 0, 0.17); lever.add(handle);
    lever.position.set(s * 0.045, L / 2 - 0.285, 0.0);
    lever.rotation.x = -0.35; flat.add(lever); refs.thrustLevers.push(lever);
  }
  // engine master switches
  for (const s of [-1, 1]) {
    const sw = rbox(0.022, 0.03, 0.035, 0.008, M.trim); sw.position.set(s * 0.05, L / 2 - 0.395, 0.022); flat.add(sw);
  }
  // speed brake (left) and flap lever (right)
  const sb = rbox(0.02, 0.12, 0.05, 0.006, M.trim); sb.position.set(-0.19, L / 2 - 0.30, 0.03); flat.add(sb);
  const fl = rbox(0.02, 0.12, 0.05, 0.006, M.trim); fl.position.set(0.19, L / 2 - 0.30, 0.03); flat.add(fl);
  // pitch trim wheels on the pedestal sides
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 48), M.panelDark);
    w.rotation.z = Math.PI / 2; w.position.set(s * (P.halfWidth + 0.01), 0.25, 0.62); grp.add(w);
  }
  return grp;
}

// ---------------------------------------------------------------- overhead panel
function buildOverhead(M, refs) {
  const O = D.OVERHEAD;
  const front = new THREE.Vector3(0, O.front[1], O.front[0]);
  const rear = new THREE.Vector3(0, O.rear[1], O.rear[0]);
  const along = rear.clone().sub(front);               // reads "up" towards the rear
  const len = along.length();
  const frame = panelFrame(front.clone().add(rear).multiplyScalar(0.5), along);
  // with Y along the slope towards the rear, Z = X × Y already points down and aft, at the crew
  // housing
  const housing = rbox(O.halfWidth * 2 + 0.06, len + 0.04, 0.09, 0.015, M.panelDark);
  housing.position.set(0, 0, -0.045 - 0.006); frame.add(housing);
  refs.overhead = frame;
  // 146 mm system panels in 4 columns, rows of varying height (as on the real overhead)
  const cols = 4, colW = (O.halfWidth * 2) / cols;
  const rows = [0.10, 0.095, 0.09, 0.075, 0.11, 0.085, 0.10, 0.075, 0.08, 0.09];
  let y = len / 2 - 0.015;
  for (const h of rows) {
    for (let c = 0; c < cols; c++) {
      const m = rbox(colW - 0.006, h - 0.006, 0.012, 0.004, M.module);
      m.position.set(-O.halfWidth + colW * (c + 0.5), y - h / 2, 0.0); frame.add(m);
      // placeholder pushbutton rows (to be replaced by real controls in Stage 4)
      const n = 3 + ((c + Math.round(h * 100)) % 3);
      for (let k = 0; k < n; k++) {
        const pb = rbox(0.024, 0.024, 0.01, 0.003, M.bezel);
        pb.position.set(-O.halfWidth + colW * c + (colW / (n + 1)) * (k + 1), y - h / 2 - 0.005, 0.009); frame.add(pb);
      }
    }
    y -= h;
    if (y < -len / 2 + 0.05) break;
  }
  return frame;
}

// ---------------------------------------------------------------- side consoles, sidesticks, seats, pedals
function buildConsolesAndSeats(M, refs) {
  const grp = new THREE.Group(); const C = D.CONSOLE;
  for (const s of [-1, 1]) {
    const outer = 1.0;
    const con = rbox(outer - C.innerX, C.topY, C.z1 - C.z0, 0.02, M.panelDark);
    con.position.set(s * (C.innerX + outer) / 2, C.topY / 2, (C.z0 + C.z1) / 2); grp.add(con);
    const top = rbox(outer - C.innerX - 0.02, 0.012, C.z1 - C.z0 - 0.02, 0.004, M.module);
    top.position.set(s * (C.innerX + outer) / 2, C.topY + 0.006, (C.z0 + C.z1) / 2); grp.add(top);
    // sidestick
    const st = new THREE.Group();
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.04, 0.035, 24), M.rubber); boot.position.y = 0.017; st.add(boot);
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, 0.1, 6, 16), M.rubber); grip.position.set(0, 0.10, 0.008); grip.rotation.x = -0.12; st.add(grip);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.008, 16), new THREE.MeshStandardMaterial({ color: 0x8a2a24, roughness: 0.5 }));
    btn.position.set(s * -0.006, 0.165, 0.0); st.add(btn);
    st.position.set(s * D.SIDESTICK.x, C.topY + 0.012, D.SIDESTICK.z); grp.add(st);
    refs[s < 0 ? 'sidestickCpt' : 'sidestickFo'] = st;
    // folding table stowed in front of the console
    const tbl = rbox(0.3, 0.012, 0.2, 0.004, M.module); tbl.position.set(s * 0.82, C.topY - 0.06, -0.02); tbl.rotation.z = s * 0.06; grp.add(tbl);

    // seat
    const seat = new THREE.Group(); const S = D.SEAT;
    const col = rbox(0.18, S.panY - 0.12, 0.3, 0.02, M.seatShell); col.position.set(0, (S.panY - 0.12) / 2, 0); seat.add(col);
    const rail = rbox(0.5, 0.04, 0.55, 0.01, M.metal); rail.position.set(0, 0.02, 0.02); seat.add(rail);
    const pan = rbox(0.5, 0.1, 0.48, 0.045, M.seatFabric); pan.position.set(0, S.panY - 0.05, 0); seat.add(pan);
    const panInsert = rbox(0.32, 0.02, 0.42, 0.01, M.seatBlue); panInsert.position.set(0, S.panY + 0.005, 0); seat.add(panInsert);
    const back = rbox(0.48, S.backTop - S.panY, 0.12, 0.05, M.seatFabric);
    back.position.set(0, (S.backTop + S.panY) / 2, S.backZ - S.panZ); back.rotation.x = -0.12; seat.add(back);
    const backInsert = rbox(0.3, S.backTop - S.panY - 0.18, 0.02, 0.01, M.seatBlue);
    backInsert.position.set(0, (S.backTop + S.panY) / 2 - 0.02, S.backZ - S.panZ - 0.07); backInsert.rotation.x = -0.12; seat.add(backInsert);
    const head = rbox(0.3, 0.17, 0.1, 0.045, M.seatFabric); head.position.set(0, S.backTop + 0.1, S.backZ - S.panZ + 0.03); head.rotation.x = -0.12; seat.add(head);
    for (const a of [-1, 1]) {
      const arm = rbox(0.06, 0.05, 0.36, 0.02, M.seatShell); arm.position.set(a * 0.29, S.panY + 0.2, 0.02); seat.add(arm);
    }
    seat.position.set(s * D.SEAT_X, 0, S.panZ); grp.add(seat);

    // rudder pedals under the panel
    for (const p of [-1, 1]) {
      const pedal = rbox(0.07, 0.17, 0.02, 0.008, M.panelDark);
      pedal.position.set(s * D.SEAT_X + p * 0.11, 0.18, -0.05); pedal.rotation.x = -0.45; grp.add(pedal);
    }
  }
  return grp;
}

// ---------------------------------------------------------------- outside world
function buildOutside(scene) {
  // sky dome with a soft horizon gradient
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x6f97c4) }, horizon: { value: new THREE.Color(0xdbe5ea) }, ground: { value: new THREE.Color(0x8b8f8c) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0.0 ? mix(horizon, top, pow(h,0.55)) : mix(horizon, ground, pow(-h,0.35)); gl_FragColor=vec4(c,1.0);}',
  }));
  scene.add(sky);
  // apron and a taxiway line ahead
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: 0x77797a, roughness: 0.95 }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = D.GROUND_Y; apron.receiveShadow = true; scene.add(apron);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 300), new THREE.MeshStandardMaterial({ color: 0xc9a43a, roughness: 0.8 }));
  line.rotation.x = -Math.PI / 2; line.position.set(0, D.GROUND_Y + 0.01, -150); scene.add(line);
}

export function buildCockpit(scene) {
  const M = makeMaterials(); const refs = {};
  const root = new THREE.Group(); root.name = 'cockpit';
  root.add(buildShell(M), buildMainPanel(M, refs), buildGlareshield(M, refs), buildPedestal(M, refs),
    buildOverhead(M, refs), buildConsolesAndSeats(M, refs));
  root.traverse((o) => { if (o.isMesh && o.material !== M.glass) { o.castShadow ??= true; o.receiveShadow = true; } });
  scene.add(root);
  buildOutside(scene);
  return { root, refs, materials: M };
}
