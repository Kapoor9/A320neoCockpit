// Builds the A320neo flight deck geometry. All shapes are original, made from the
// dimensions in dims.js. Rounded edges everywhere: real cockpit parts have no sharp boxes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import * as D from './dims.js';
import { addGrain } from './surface.js';
import { LabelAtlas } from './labels.js';
import { makeMCDU } from './parts/mcdu.js';
import { makeSidestick, makeTiller, makeThrustQuadrant, makeTrimWheel } from './parts/levers.js';
import { fcuPanel, efisPanel, warningPanel } from './parts/glareshield.js';
import * as PED from './parts/pedestal.js';

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
    lining: std(0xa9aba7, 0.85),         // upper sidewall lining
    lowerWall: std(0x667078, 0.8),       // lower sidewall, blue-grey
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
    // display glass with an anti-glare coating: soft reflections, no hard sun hotspot
    screen: new THREE.MeshPhysicalMaterial({ color: 0x07090b, roughness: 0.32, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.35 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe0ea, roughness: 0.02, transmission: 0, transparent: true, opacity: 0.08, depthWrite: false }),
    screw: std(0x6f767a, 0.4, 0.7),
    pointer: std(0xd8dbd6, 0.5),
  };
}
const FINISH = { panel: 'paint', panelDark: 'paint', module: 'paint', fcu: 'paint', trim: 'paint', frame: 'paint', seatShell: 'paint',
  bezel: 'paint', glare: 'matte', lining: 'lining', lowerWall: 'lining', ceiling: 'lining', carpet: 'carpet', seatFabric: 'fabric', seatBlue: 'fabric',
  rubber: 'rubber', metal: 'brushed', screw: 'brushed' };
function finish(M) { for (const [k, kind] of Object.entries(FINISH)) addGrain(M[k], kind); M.lining.side = THREE.DoubleSide; M.ceiling.side = THREE.DoubleSide; M.lowerWall.side = THREE.DoubleSide; return M; }

// Dzus-type panel fasteners: one instanced mesh per panel group (cheap to draw)
const SCREW_GEO = new THREE.CylinderGeometry(0.0034, 0.0034, 0.0018, 12).rotateX(Math.PI / 2);
function addScrews(parent, pts, M) {
  const im = new THREE.InstancedMesh(SCREW_GEO, M.screw, pts.length); const m = new THREE.Matrix4();
  pts.forEach(([x, y, z], i) => { m.makeRotationZ(Math.random() * Math.PI).setPosition(x, y, z); im.setMatrixAt(i, m); });
  im.receiveShadow = true; parent.add(im); return im;
}
const corners = (cx, cy, w, h, z, inset = 0.007) => [[cx - w / 2 + inset, cy - h / 2 + inset, z], [cx + w / 2 - inset, cy - h / 2 + inset, z], [cx - w / 2 + inset, cy + h / 2 - inset, z], [cx + w / 2 - inset, cy + h / 2 - inset, z]];

// Knurled knob: a fine-toothed profile extruded, on a thin skirt, facing +Z
function knob(r, h, M, { pointer = false, teeth = 36 } = {}) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  for (let i = 0; i <= teeth * 2; i++) { const a = (i / (teeth * 2)) * Math.PI * 2; const rr = i % 2 ? r * 0.955 : r; (i ? s.lineTo : s.moveTo).call(s, Math.cos(a) * rr, Math.sin(a) * rr); }
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelSize: r * 0.06, bevelThickness: r * 0.08, bevelSegments: 2, curveSegments: 1 }), M.rubber);
  body.castShadow = true; g.add(body);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.3, h * 0.18, 40).rotateX(Math.PI / 2), M.panelDark); skirt.position.z = h * 0.09; g.add(skirt);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 0.8, 32), M.rubber); cap.position.z = h + r * 0.081; g.add(cap);
  if (pointer) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.12, r * 0.85), M.pointer); pl.position.set(0, r * 0.42, h + r * 0.083); g.add(pl); }
  return g;
}

const rbox = (w, h, d, r, mat, seg = 3) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.98), mat);
  m.castShadow = true; m.receiveShadow = true; return m;
};

// A side profile ([z, y] points) extruded across x, with rounded (bevelled) edges.
function extrudeProfile(points, x0, x1, mat, bevel = 0.008) {
  const s = new THREE.Shape();
  points.forEach(([z, y], i) => (i ? s.lineTo(-z, y) : s.moveTo(-z, y)));
  s.closePath();
  const width = x1 - x0 - 2 * bevel;
  // bevelOffset pulls the outline in so the rounded edge stays inside the measured profile
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelOffset: -bevel, bevelSegments: 3, curveSegments: 4 });
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
  const pos = []; const idxLining = []; const idxCeil = []; const idxLower = [];
  for (let i = 0; i <= nz; i++) {
    const z = z0 + (z1 - z0) * i / nz;
    for (let j = 0; j <= ns; j++) { const [x, y] = ringPoint(z, j / ns); pos.push(x, y, z); }
  }
  const V = (i, j) => i * (ns + 1) + j;
  for (let i = 0; i < nz; i++) for (let j = 0; j < ns; j++) {
    const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1);
    const cx = (pos[a * 3] + pos[c * 3]) / 2, cy = (pos[a * 3 + 1] + pos[c * 3 + 1]) / 2, cz = (pos[a * 3 + 2] + pos[c * 3 + 2]) / 2;
    if (isOpening(cx, cy, cz)) continue;
    (cy > 1.5 ? idxCeil : cy < 1.05 ? idxLower : idxLining).push(a, b, c, a, c, d);
  }
  const mk = (idx, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
  };
  const grp = new THREE.Group();
  grp.add(mk(idxLining, M.lining), mk(idxCeil, M.ceiling), mk(idxLower, M.lowerWall));

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
  // side window glass (faint reflections)
  for (const s of [-1, 1]) for (const w of [W.side2, W.side3]) {
    const zc = (w.z0 + w.z1) / 2, yc = (w.y0 + w.y1) / 2, x = shellAt(zc)[1] * s * 0.985;
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w.z1 - w.z0, w.y1 - w.y0), M.glass);
    gl.position.set(x, yc, zc); gl.rotation.y = Math.PI / 2; gl.renderOrder = 10; grp.add(gl);
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
    addScrews(frame, corners(x, y, D.DU.bezel, D.DU.bezel, D.DU.depth - 0.003, 0.009), M);
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
  const G = D.GLARE; const grp = new THREE.Group(); const A = refs.atlas;
  // anti-glare hood across the panel
  const prof = [[G.frontZ, G.topY - 0.04], [G.frontZ + 0.02, G.topY], [G.rearZ - 0.02, G.topY - 0.004], [G.rearZ, G.topY - 0.025], [G.rearZ, G.underY], [-0.07, G.underY - 0.004], [G.frontZ, G.underY + 0.02]];
  grp.add(extrudeProfile(prof, -1.02, 1.02, M.glare, 0.01));
  // the control strip: a housing that stands proud of the hood, panels on its face
  const S = G.strip; const half = G.warn.x + G.warn.w / 2 + 0.004;
  const housing = rbox(half * 2, 0.108, S.faceZ - G.rearZ + 0.02, 0.008, M.panelDark);
  housing.position.set(0, S.y, (S.faceZ + G.rearZ) / 2 - 0.01); grp.add(housing);
  const place = (p, x) => { p.position.set(x, S.y, S.faceZ + 0.004); grp.add(p); return p; };
  refs.fcu = place(fcuPanel(M, A), G.fcu.x);
  refs.efis = [place(efisPanel(M, A, 1), -G.efis.x), place(efisPanel(M, A, 2), G.efis.x)];
  refs.warn = [place(warningPanel(M, A), -G.warn.x), place(warningPanel(M, A), G.warn.x)];
  return grp;
}

// ---------------------------------------------------------------- centre pedestal
function buildPedestal(M, refs) {
  const P = D.PEDESTAL; const grp = new THREE.Group(); const A = refs.atlas;
  const top = P.profile; const last = top[top.length - 1];
  const prof = [[0.02, 0.0], ...top, [P.rearZ, last[1] - 0.02], [P.rearZ, 0.0]];
  grp.add(extrudeProfile(prof, -P.halfWidth, P.halfWidth, M.panelDark, 0.012));

  // forward slope: MCDU 1 | SWITCHING + ECAM control panel | MCDU 2
  const [a, b] = [top[0], top[1]];
  const yDir = new THREE.Vector3(0, a[1] - b[1], a[0] - b[0]);
  const slope = panelFrame(new THREE.Vector3(0, (a[1] + b[1]) / 2 + 0.001, (a[0] + b[0]) / 2), yDir); grp.add(slope); refs.mcduFrame = slope;
  refs.mcdus = [];
  for (const s of [-1, 1]) {
    const u = makeMCDU(M, A, { side: s }); u.group.position.set(s * 0.17, -0.02, 0.004); slope.add(u.group); refs.mcdus.push(u);
  }
  const sw = PED.switchingPanel(M, A); sw.position.set(0, 0.066, 0.004); slope.add(sw);
  const ecp = PED.ecamControlPanel(M, A); ecp.position.set(0, -0.026, 0.004); slope.add(ecp); refs.ecamCP = ecp;

  // flat section. Frame: x right, y forward, z up; world z -> local y = zc - z
  const zc = (b[0] + last[0]) / 2;
  const flat = panelFrame(new THREE.Vector3(0, b[1] + 0.001, zc), new THREE.Vector3(0, 0, -1)); grp.add(flat);
  const at = (p, x, z) => { p.position.set(x, zc - z, 0.004); flat.add(p); return p; };
  for (const s of [-1, 1]) {
    at(PED.rmpPanel(M, A, s < 0 ? 1 : 2), s * 0.185, 0.455);
    at(PED.acpPanel(M, A), s * 0.185, 0.556);
    at(PED.genericPanel(M, A, 0.138, 0.075, s < 0 ? 'LIGHTING' : 'WX RADAR', [['FLOOD', 'INTEG', 'CONSOLE'], ['SYS 1', 'SYS 2', 'GAIN']]), s * 0.181, 0.646);
  }
  // thrust quadrant flanked by the pitch trim wheels
  const tq = makeThrustQuadrant(M, A); at(tq.group, 0, 0.55); refs.thrust = tq;
  refs.trimWheels = [];
  for (const s of [-1, 1]) { const w = makeTrimWheel(M, s); w.position.set(s * 0.097, 0.33, 0.565); grp.add(w); refs.trimWheels.push(w); }
  // engine panel behind the levers
  refs.engPanel = at(PED.engPanel(M, A), 0, 0.705);
  // rear: speed brake | rudder trim | flaps ; door | park brake | transponder
  refs.speedBrake = at(PED.speedBrakePanel(M, A), -0.125, 0.82);
  refs.rudTrim = at(PED.rudderTrimPanel(M, A), 0, 0.81);
  refs.flaps = at(PED.flapsPanel(M, A), 0.125, 0.82);
  refs.parkBrake = at(PED.parkBrakePanel(M, A), 0, 0.955);
  at(PED.genericPanel(M, A, 0.12, 0.085, 'COCKPIT DOOR', [['LOCK', 'UNLOCK'], ['VIDEO']]), -0.175, 0.955);
  at(PED.genericPanel(M, A, 0.12, 0.085, 'ATC / TCAS', [['STBY', 'AUTO', 'ON'], ['IDENT', 'TA', 'TA/RA']]), 0.175, 0.955);
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
  let y = len / 2 - 0.015; const screws = [];
  for (const h of rows) {
    for (let c = 0; c < cols; c++) {
      const m = rbox(colW - 0.006, h - 0.006, 0.012, 0.004, M.module);
      m.position.set(-O.halfWidth + colW * (c + 0.5), y - h / 2, 0.0); frame.add(m);
      screws.push(...corners(-O.halfWidth + colW * (c + 0.5), y - h / 2, colW - 0.006, h - 0.006, 0.0065));
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
  addScrews(frame, screws, M);
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
    const st = makeSidestick(M, s);
    st.position.set(s * D.SIDESTICK.x, C.topY + 0.002, D.SIDESTICK.z); grp.add(st);
    refs[s < 0 ? 'sidestickCpt' : 'sidestickFo'] = st;
    // nosewheel steering tiller, outboard and slightly forward of the sidestick
    const til = makeTiller(M); til.position.set(s * D.TILLER.x, C.topY + 0.004, D.TILLER.z); grp.add(til); refs[s < 0 ? 'tillerCpt' : 'tillerFo'] = til;
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
export const SUN_DIR = new THREE.Vector3(-0.32, 0.62, -0.72).normalize();   // high, ahead and to the left
export function makeSky(radius = 400) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x5f8bbd) }, horizon: { value: new THREE.Color(0xd6e1e7) }, ground: { value: new THREE.Color(0x8d908c) }, sun: { value: SUN_DIR } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sun; varying vec3 vP;
      void main(){ float h=vP.y;
        vec3 c = h>0.0 ? mix(horizon, top, pow(h,0.5)) : mix(horizon, ground, pow(-h,0.3));
        float sd = max(dot(normalize(vP), sun), 0.0);
        c += vec3(1.0,0.95,0.85) * (pow(sd, 900.0)*6.0 + pow(sd, 40.0)*0.25 + pow(sd,6.0)*0.08);
        gl_FragColor=vec4(c,1.0);}`,
  }));
}
function buildOutside(scene) {
  scene.add(makeSky());
  const apronMat = addGrain(new THREE.MeshStandardMaterial({ color: 0x7a7c7c, roughness: 0.95 }), 'lining');
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), apronMat);
  apron.rotation.x = -Math.PI / 2; apron.position.y = D.GROUND_Y; apron.receiveShadow = true; scene.add(apron);
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xc9a43a, roughness: 0.8 });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 400), lineMat);
  line.rotation.x = -Math.PI / 2; line.position.set(0, D.GROUND_Y + 0.01, -200); scene.add(line);
  // edge line of a taxiway crossing ahead, for depth
  for (const z of [-60, -63]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.2), lineMat); e.rotation.x = -Math.PI / 2; e.position.set(0, D.GROUND_Y + 0.01, z); scene.add(e); }
  scene.fog = new THREE.Fog(0xd6e1e7, 40, 700);
}

export function buildCockpit(scene) {
  const M = finish(makeMaterials()); const refs = { atlas: new LabelAtlas(2048) };
  const root = new THREE.Group(); root.name = 'cockpit';
  root.add(buildShell(M), buildMainPanel(M, refs), buildGlareshield(M, refs), buildPedestal(M, refs),
    buildOverhead(M, refs), buildConsolesAndSeats(M, refs));
  root.traverse((o) => { if (o.isMesh && o.material !== M.glass) { o.castShadow ??= true; o.receiveShadow = true; } });
  scene.add(root);
  buildOutside(scene);
  return { root, refs, materials: M };
}
