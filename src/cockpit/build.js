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
import { makeOverheadPanels, makeAftPanels } from './parts/overhead.js';

// ---------------------------------------------------------------- materials
// Colours: Airbus flight-deck blue-grey panels, near-black anti-glare glareshield,
// light warm-grey linings, dark blue carpet. Muted, as seen by day.
export function makeMaterials() {
  const std = (color, roughness, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    panel: std(0x465159, 0.62),          // instrument panel blue-grey
    panelDark: std(0x47525a, 0.66),      // panel frames and seams
    module: std(0x3c454c, 0.58),         // individual 146 mm system panels
    seam: std(0x2b3236, 0.8),
    glare: std(0x26292c, 0.9),           // anti-glare finish
    fcu: std(0x4f5a62, 0.6),
    lining: std(0x8a949a, 0.85),         // upper sidewall lining
    lowerWall: std(0x667078, 0.8),       // lower sidewall, blue-grey
    ceiling: std(0x939ca1, 0.88),
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
// ---------------------------------------------------------------- nose shell
const sstep = (t) => t * t * (3 - 2 * t);
function hullStation(k, y) {   // wall half-width of station k at height y
  const [, crown, v] = D.HULL[k]; const Y = D.HULL_Y; const n = v.length;
  if (y <= 0) return v[0];
  if (y <= Y[n - 1]) { let i = 1; while (Y[i] < y) i++; const t = (y - Y[i - 1]) / (Y[i] - Y[i - 1]); return v[i - 1] + (v[i] - v[i - 1]) * t; }
  if (y >= crown) return 0;
  return v[n - 1] * Math.sqrt((crown - y) / (crown - Y[n - 1]));
}
function hullSpan(z) {
  const H = D.HULL; if (z <= H[0][0]) return [0, 0, 0];
  for (let i = 1; i < H.length; i++) if (z <= H[i][0]) return [i - 1, i, sstep((z - H[i - 1][0]) / (H[i][0] - H[i - 1][0]))];
  return [H.length - 1, H.length - 1, 0];
}
export function crownAt(z) { const [a, b, e] = hullSpan(z); return D.HULL[a][1] + (D.HULL[b][1] - D.HULL[a][1]) * e; }
export function hullHW(z, y) { const [a, b, e] = hullSpan(z); const p = hullStation(a, y), q = hullStation(b, y); return p + (q - p) * e; }
// legacy helper: [floor half-width, half-width at 1.1 m, crown]
function shellAt(z) { return [hullHW(z, 0.05), hullHW(z, 1.1), crownAt(z)]; }
// point on the cross-section: s in [0,1] from left floor, over the crown, to right floor
function ringPoint(z, s) {
  const side = s < 0.5 ? -1 : 1; const u = s < 0.5 ? s * 2 : (1 - s) * 2;
  const y = crownAt(z) * Math.sin(u * Math.PI / 2);
  return [side * hullHW(z, y), y];
}
function inPoly([px, py], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// windshield top edge in plan (z at a given |x|) and the sill below the forward glazing
const WS = D.WINDSHIELD;
const wsTopZ = (ax) => (ax < WS.outerTop[0] ? WS.innerTop[2] + ((ax - WS.innerTop[0]) / (WS.outerTop[0] - WS.innerTop[0])) * (WS.outerTop[2] - WS.innerTop[2]) : 0.66);
function sillY(z) {
  const [p, q] = [D.SIDE_WINDOWS.w2[0], D.SIDE_WINDOWS.w2[1]];
  if (z <= p[0]) return 0.92;
  return p[1] + (q[1] - p[1]) * Math.min(1, (z - p[0]) / (q[0] - p[0]));
}
function shellCell(x, y, z) {   // 'open' (windshield region), 'glass' (side window) or null (lining)
  const ax = Math.abs(x);
  if (z < 0.66 && y > sillY(z) && z < wsTopZ(ax)) return 'open';
  if (ax > 0.5 && (inPoly([z, y], D.SIDE_WINDOWS.w2) || inPoly([z, y], D.SIDE_WINDOWS.w3))) return 'glass';
  return null;
}


// Cut the window openings per pixel (smooth, exact edges): 'wall' discards inside the openings,
// 'glass' discards everything except the side-window openings.
function glslPoly(name, poly) {
  const n = poly.length;
  return `bool ${name}(vec2 p){ vec2 v[${n}]; ${poly.map((q, i) => `v[${i}]=vec2(${q[0].toFixed(4)},${q[1].toFixed(4)});`).join('')}
    bool c=false; for(int i=0;i<${n};i++){ int j=(i==0)?${n - 1}:i-1;
      if(((v[i].y>p.y)!=(v[j].y>p.y)) && (p.x < (v[j].x-v[i].x)*(p.y-v[i].y)/(v[j].y-v[i].y)+v[i].x)) c=!c; } return c; }`;
}
function openingGLSL() {
  const W = D.WINDSHIELD, S = D.SIDE_WINDOWS; const f = (v) => v.toFixed(4);
  return `
${glslPoly('inW2', S.w2)}
${glslPoly('inW3', S.w3)}
float wsTopZ(float ax){ return ax < ${f(W.outerTop[0])} ? ${f(W.innerTop[2])} + (ax-${f(W.innerTop[0])})/${f(W.outerTop[0] - W.innerTop[0])}*${f(W.outerTop[2] - W.innerTop[2])} : 0.66; }
float sillY(float z){ if(z<=${f(S.w2[0][0])}) return 0.92; return ${f(S.w2[0][1])} + ${f(S.w2[1][1] - S.w2[0][1])}*min(1.0,(z-${f(S.w2[0][0])})/${f(S.w2[1][0] - S.w2[0][0])}); }
bool inWS(vec3 p){ return p.z<0.66 && p.y>sillY(p.z) && p.z<wsTopZ(abs(p.x)); }
bool inSideWin(vec3 p){ if(abs(p.x)<0.5) return false; vec2 q=vec2(p.z,p.y); return inW2(q)||inW3(q); }`;
}
function addOpeningClip(material, mode) {
  const prev = material.onBeforeCompile; const prevKey = material.customProgramCacheKey ? material.customProgramCacheKey.bind(material) : () => '';
  material.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(material, sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vClipPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvClipPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vClipPos;\n' + openingGLSL())
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (mode === 'glass' ? '' : 'diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.70, 0.80, vClipPos.y));'))
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' +
        (mode === 'glass' ? 'if(!inSideWin(vClipPos)) discard;' : 'if(inWS(vClipPos)||inSideWin(vClipPos)) discard;'));
  };
  material.customProgramCacheKey = () => prevKey() + '|open-' + mode;
  material.needsUpdate = true; return material;
}

function buildShell(M) {
  const z0 = -0.45, z1 = D.REAR_WALL_Z, nz = 150, ns = 120;
  const pos = []; const idx = { lining: [], ceil: [], lower: [], glass: [] };
  for (let i = 0; i <= nz; i++) {
    const z = z0 + (z1 - z0) * i / nz;
    for (let j = 0; j <= ns; j++) { const [x, y] = ringPoint(z, j / ns); pos.push(x, y, z); }
  }
  const V = (i, j) => i * (ns + 1) + j;
  for (let i = 0; i < nz; i++) for (let j = 0; j < ns; j++) {
    const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1);
    const cx = (pos[a * 3] + pos[c * 3]) / 2, cy = (pos[a * 3 + 1] + pos[c * 3 + 1]) / 2, cz = (pos[a * 3 + 2] + pos[c * 3 + 2]) / 2;
    const cells = [a, b, c, d].map((k) => shellCell(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]));
    // a cell touching an opening is left out of the wall (the frames cover the edge), so that
    // nothing jagged reaches the shadow and ambient-occlusion passes
    if (cells.some((q) => q === 'glass')) idx.glass.push(a, b, c, a, c, d);
    if (cells.some((q) => q)) continue;
    idx.lining.push(a, b, c, a, c, d);
  }
  const mk = (ix, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(ix); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
  };
  const grp = new THREE.Group();
  const wallMat = (m, kind) => addOpeningClip(addGrain(m.clone(), kind), 'wall');
  grp.add(mk(idx.lining, wallMat(M.lining, 'lining')));   // one lining; darker below the sills (blended in the shader)
  const sideGlass = mk(idx.glass, addOpeningClip(M.glass.clone(), 'glass')); sideGlass.renderOrder = 10; grp.add(sideGlass);

  // floor
  const fw = hullHW(1.0, 0.0) * 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, z1 - z0 + 0.1), M.carpet);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.001, (z0 + z1) / 2); floor.receiveShadow = true;
  grp.add(floor);

  // rear bulkhead with the cockpit door
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.2), M.lining); rw.position.set(0, 1.05, z1 - 0.005); rw.rotation.y = Math.PI;
  grp.add(rw);
  const door = rbox(0.72, 1.85, 0.04, 0.01, M.trim); door.position.set(0.0, 0.93, z1 - 0.03); grp.add(door);

  grp.add(buildWindowFrames(M));
  return grp;
}

// a point on the inside of the shell at (side, z, y), pulled in by `inset`
const onHull = (s, z, y, inset = 0) => new THREE.Vector3(s * (hullHW(z, y) - inset), y, z);
// strip mesh between two point lists (same length)
function stripMesh(A, B, mat) {
  const p = []; const ix = [];
  A.forEach((a, i) => { p.push(a.x, a.y, a.z, B[i].x, B[i].y, B[i].z); });
  for (let i = 0; i < A.length - 1; i++) { const k = i * 2; ix.push(k, k + 1, k + 3, k, k + 3, k + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
// solid bar between two points, its cross-section `w` wide and `t` deep, `up` giving the depth direction
function bar(A, B, w, t, mat, up) {
  const len = A.distanceTo(B); const m = rbox(w, len, t, Math.min(w, t) * 0.3, mat);
  const yA = B.clone().sub(A).normalize(); const zA = up.clone().sub(yA.clone().multiplyScalar(up.dot(yA))).normalize(); const xA = yA.clone().cross(zA);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, zA)); m.position.copy(A).add(B).multiplyScalar(0.5);
  m.castShadow = true; return m;
}

function buildWindowFrames(M) {
  const grp = new THREE.Group(); const f = M.frame.clone(); f.side = THREE.DoubleSide;
  const V3 = (p, s = 1) => new THREE.Vector3(s * p[0], p[1], p[2]);
  for (const s of [-1, 1]) {
    const A = V3(WS.innerBottom, s), B = V3(WS.innerTop, s), C = V3(WS.outerTop, s), Dp = V3(WS.outerBottom, s);
    // pane
    const g = new THREE.BufferGeometry().setFromPoints([A, Dp, C, A, C, B]); g.computeVertexNormals();
    const pane = new THREE.Mesh(g, M.glass); pane.renderOrder = 10; grp.add(pane);
    const nIn = Dp.clone().sub(A).cross(B.clone().sub(A)).normalize(); if (nIn.z < 0) nIn.negate();   // normal pointing into the cockpit
    const lift = (v, d) => v.clone().add(nIn.clone().multiplyScalar(d));
    // header bar along the top edge, and the corner post between the pane and the sliding window
    grp.add(bar(lift(B, 0.03), lift(C, 0.03), 0.09, 0.06, f, nIn));
    const C2 = onHull(s, D.SIDE_WINDOWS.w2[4][0], D.SIDE_WINDOWS.w2[4][1], 0.0), D2 = onHull(s, D.SIDE_WINDOWS.w2[0][0], D.SIDE_WINDOWS.w2[0][1], 0.0);
    // solid corner post: outer face spans from the pane's edge to the sliding window's front edge,
    // 6 cm deep into the cockpit
    const n = 10; const L = [], R = [], Li = [], Ri = [];
    for (let i = 0; i <= n; i++) {
      const tt = i / n; const l = lift(Dp.clone().lerp(C, tt), 0.004), r = D2.clone().lerp(C2, tt);
      const din = new THREE.Vector3(-l.x, 1.1 - l.y, 0.25).normalize().multiplyScalar(0.06);
      L.push(l); R.push(r); Li.push(l.clone().add(din)); Ri.push(r.clone().add(din));
    }
    grp.add(stripMesh(L, R, f), stripMesh(Li, Ri, f), stripMesh(L, Li, f), stripMesh(R, Ri, f));
    // sill skirt under the pane's lower edge, down to the shell
    const P = [], Q = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; const e = A.clone().lerp(Dp, t); P.push(lift(e, 0.005)); Q.push(onHull(s, e.z, 0.86, 0.005)); }
    grp.add(stripMesh(P, Q, M.glare));
  }
  // centre post
  const up = new THREE.Vector3(0, -0.7, 0.7).normalize();
  grp.add(bar(new THREE.Vector3(0, WS.innerBottom[1] - 0.01, WS.innerBottom[2] + 0.012), new THREE.Vector3(0, WS.innerTop[1] + 0.02, WS.innerTop[2] + 0.02), 0.055, 0.06, f, up));

  // side window frames: a band around each opening, lying on the shell, plus an inner lip
  const ring = (poly, s, w) => {
    const pts = []; const step = 0.02; const skip = poly === D.SIDE_WINDOWS.w2 ? poly.length - 1 : -1;   // w2's front edge is the corner post
    for (let i = 0; i < poly.length; i++) {
      if (i === skip) continue;
      const [z0, y0] = poly[i], [z1, y1] = poly[(i + 1) % poly.length]; const n = Math.max(1, Math.ceil(Math.hypot(z1 - z0, y1 - y0) / step));
      for (let k = 0; k < n; k++) pts.push([z0 + (z1 - z0) * k / n, y0 + (y1 - y0) * k / n]);
    }
    pts.push(skip >= 0 ? poly[skip] : pts[0]);
    // outward offset in (z, y) using the polygon's centroid
    const cz = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    const inner = [], outer = [];
    for (const [z, y] of pts) {
      const dz = z - cz, dy = y - cy, l = Math.hypot(dz, dy);
      let ww = w; while (ww > 0.006 && shellCell(s * hullHW(z + dz / l * ww, y + dy / l * ww), y + dy / l * ww, z + dz / l * ww) === 'open') ww *= 0.6;   // don't run into the windshield gap
      inner.push(onHull(s, z - dz / l * 0.004, y - dy / l * 0.004, 0.012)); outer.push(onHull(s, z + dz / l * ww, y + dy / l * ww, 0.004));
    }
    const lip = inner.map((p) => p.clone().add(new THREE.Vector3(-p.x, 1.1 - p.y, 0).normalize().multiplyScalar(0.06)));   // reveal, square to the wall
    grp.add(stripMesh(inner, outer, f), stripMesh(lip, inner, f));
  };
  for (const s of [-1, 1]) { ring(D.SIDE_WINDOWS.w2, s, 0.07); ring(D.SIDE_WINDOWS.w3, s, 0.06); }
  // fairing from the windshield header back to the front of the overhead panel
  const O = D.OVERHEAD; const hw = O.halfWidth + 0.04;
  const hz = (ax) => wsTopZ(ax) + 0.03; const hy = (ax) => WS.innerTop[1] + (ax / WS.outerTop[0]) * (WS.outerTop[1] - WS.innerTop[1]) + 0.035;
  const Fa = [], Fb = [];
  for (let i = 0; i <= 12; i++) { const x = -hw + (2 * hw * i) / 12; Fa.push(new THREE.Vector3(x, hy(Math.abs(x)), hz(Math.abs(x)))); Fb.push(new THREE.Vector3(x, O.front[1] + 0.04, O.front[0] - 0.02)); }
  const fm = M.frame.clone(); fm.side = THREE.DoubleSide; grp.add(stripMesh(Fa, Fb, fm));
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
  // the coaming follows the windshield's V in plan: front edge just behind the glass, rear face
  // (carrying the FCU strip) straight across the centre and swept forward into the corner posts
  const W = D.WINDSHIELD; const xEnd = W.outerBottom[0] - 0.01;
  const zf = (ax) => W.innerBottom[2] + 0.012 + (ax / W.outerBottom[0]) * (W.outerBottom[2] - W.innerBottom[2]);
  const zr = (ax) => (ax <= 0.62 ? G.strip.faceZ - 0.006 : G.strip.faceZ - 0.006 + ((ax - 0.62) / (xEnd - 0.62)) * 0.06);
  const yF = (ax) => 0.905 + (ax / W.outerBottom[0]) * 0.03;                 // top at the glass, following the pane's lower edge
  const yT = (t, ax) => {                                                      // rises to the crest, rolls over to the rear face
    const crest = G.topY - Math.max(0, ax - 0.55) * 0.12;
    const r = yF(ax) + (crest - yF(ax)) * Math.sin(Math.min(t / 0.8, 1) * Math.PI / 2);
    return t > 0.8 ? r - 0.032 * ((t - 0.8) / 0.2) ** 2 : r;
  };
  const nx = 70, nt = 16; const top = [], rear = [], under = [];
  for (let i = 0; i <= nx; i++) {
    const x = -xEnd + (2 * xEnd * i) / nx, ax = Math.abs(x); const f0 = zf(ax), r0 = Math.max(zr(ax), f0 + 0.015);
    const row = []; for (let k = 0; k <= nt; k++) { const tt = k / nt; row.push(new THREE.Vector3(x, yT(tt, ax), f0 + (r0 - f0) * tt)); }
    top.push(row);
    rear.push([row[nt], new THREE.Vector3(x, G.underY, r0)]);
    under.push([new THREE.Vector3(x, G.underY, r0), new THREE.Vector3(x, G.underY, f0)]);
  }
  const grid = (rows, mat) => {
    const p = [], ix = []; const m = rows[0].length;
    rows.forEach((r) => r.forEach((v) => p.push(v.x, v.y, v.z)));
    for (let i = 0; i < rows.length - 1; i++) for (let k = 0; k < m - 1; k++) { const a = i * m + k, b = (i + 1) * m + k; ix.push(a, b, b + 1, a, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
  };
  const gm = M.glare.clone(); gm.side = THREE.DoubleSide;
  grp.add(grid(top, gm), grid(rear, gm), grid(under, gm));
  // the control strip: a housing that stands proud of the rear face, panels on its face
  const S = G.strip; const half = G.warn.x + G.warn.w / 2 + 0.004;
  const housing = rbox(half * 2, 0.108, 0.05, 0.008, M.panelDark);
  housing.position.set(0, S.y, S.faceZ - 0.025 + 0.002); grp.add(housing);
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
  // real A320 system panels: three columns, aft at the top as read; they fill the forward
  // O.systemLen of the overhead, the aft remainder carries circuit breakers and maintenance items
  refs.overheadPanels = {};
  const sysTop = -len / 2 + O.systemLen;
  for (const { panel, x, yFromTop, key } of makeOverheadPanels(M, refs.atlas, O.systemLen)) {
    panel.position.set(x, sysTop - yFromTop, 0.0); frame.add(panel); refs.overheadPanels[key] = panel;
  }
  const aftLen = len / 2 - sysTop - 0.006 - 0.004;
  for (const { panel, x, key } of makeAftPanels(M, refs.atlas, aftLen)) {
    panel.position.set(x, sysTop + 0.006 + aftLen / 2, 0.0); frame.add(panel); refs.overheadPanels[key] = panel;
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
