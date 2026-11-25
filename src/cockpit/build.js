// Builds the A320neo flight deck geometry. All shapes are original, made from the
// dimensions in dims.js. Rounded edges everywhere: real cockpit parts have no sharp boxes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import * as D from './dims.js';
import { addGrain } from './surface.js';
import { LabelAtlas } from './labels.js';
import { makeMCDU } from './parts/mcdu.js';
import { makeSidestick, makeTiller, makeThrustQuadrant, makeTrimWheel } from './parts/levers.js';
import { fcuPanel, efisPanel, warningPanel, stripEndPanel } from './parts/glareshield.js';
import * as PED from './parts/pedestal.js';
import * as MP from './parts/mainpanel.js';
import { makeOverheadPanels, makeAftPanels } from './parts/overhead.js';
import { buildPanel } from './parts/panel.js';

// ---------------------------------------------------------------- materials
// Colours: Airbus flight-deck blue-grey panels, near-black anti-glare glareshield,
// light warm-grey linings, dark blue carpet. Muted, as seen by day.
export function makeMaterials() {
  const std = (color, roughness, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    panel: std(0x72868f, 0.6),          // instrument panel blue-grey
    panelDark: std(0x2b3341, 0.6),     // dark navy console tops, pedestal body      // panel frames and seams
    module: std(0x6b7f89, 0.58),         // individual 146 mm system panels
    seam: std(0x2b3236, 0.8),
    glare: std(0x1d2023, 0.78),           // anti-glare finish
    fcu: std(0x6e828c, 0.6),
    consoleTop: std(0x343d4c, 0.55),   // dark navy console tops (as photographed)
    lining: std(0x8a9faa, 0.85),         // upper sidewall lining
    lowerWall: std(0x667078, 0.8),       // lower sidewall, blue-grey
    ceiling: std(0x939ca1, 0.88),
    trim: std(0x7d8286, 0.7),
    frame: std(0x8798a2, 0.6),     // window frames
    carpet: std(0x283142, 0.98),
    seatFabric: std(0x6f8aa0, 0.95),   // light blue headrest fabric
    seatBlue: std(0x1e2a48, 0.95),     // navy pinstripe cushions
    seatShell: std(0x222936, 0.5),     // dark navy shells
    metal: std(0x9aa0a3, 0.35, 0.8),
    rubber: std(0x1c1e20, 0.9),
    bezel: std(0x2a2f33, 0.45, 0.1),
    // display glass with an anti-glare coating: soft reflections, no hard sun hotspot
    screen: new THREE.MeshPhysicalMaterial({ color: 0x0a0c0d, roughness: 0.45, metalness: 0.0, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 0.35 }),
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
export function hullHW(z, y) { const [a, b, e] = hullSpan(z); const p = hullStation(a, y), q = hullStation(b, y); const k = 0.92 + 0.08 * Math.min(1, Math.max(0, (y - 0.9) / 0.35)); return (p + (q - p) * e) * k; }   // lower cockpit pulled in 8%
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
// windshield opening outline as seen along the fuselage axis: centreline to the outer pane edge (x, y)
const WS_XY = [[0.0, D.WINDSHIELD.innerBottom[1] - 0.01], [D.WINDSHIELD.outerBottom[0] + 0.005, D.WINDSHIELD.outerBottom[1] - 0.01], [D.WINDSHIELD.outerTop[0] + 0.005, D.WINDSHIELD.outerTop[1] + 0.005], [0.0, D.WINDSHIELD.innerTop[1] + 0.005]];
function shellCell(x, y, z) {   // 'open' (windshield region), 'glass' (side window) or null (lining)
  const ax = Math.abs(x);
  if (z < 0.72 && inPoly([ax, y], WS_XY)) return 'open';   // exactly the windshield panes' outline
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
${glslPoly('inWSq', WS_XY)}
${glslPoly('inW2', S.w2)}
${glslPoly('inW3', S.w3)}
float wsTopZ(float ax){ return ax < ${f(W.outerTop[0])} ? ${f(W.innerTop[2])} + (ax-${f(W.innerTop[0])})/${f(W.outerTop[0] - W.innerTop[0])}*${f(W.outerTop[2] - W.innerTop[2])} : 0.66; }
float sillY(float z){ if(z<=${f(S.w2[0][0])}) return 0.92; return ${f(S.w2[0][1])} + ${f(S.w2[1][1] - S.w2[0][1])}*min(1.0,(z-${f(S.w2[0][0])})/${f(S.w2[1][0] - S.w2[0][0])}); }
bool inWS(vec3 p){ return p.z<0.72 && inWSq(vec2(abs(p.x), p.y)); }
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
    if (cells.every((q) => q === 'open')) continue;   // keep edge cells: the shader trims them exactly to the opening
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
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.2), addGrain(new THREE.MeshStandardMaterial({ color: 0x353c41, roughness: 0.85, side: THREE.DoubleSide }), 'lining')); rw.position.set(0, 1.05, z1 - 0.005); rw.rotation.y = Math.PI;
  grp.add(rw);
  const door = rbox(0.72, 1.85, 0.04, 0.01, M.panelDark); door.position.set(0.0, 0.93, z1 - 0.03); grp.add(door);

  grp.add(buildWindowFrames(M));
  grp.add(buildShellFittings(M));
  return grp;
}

// a flat part lying on the shell at (side, z, y), its long side along `along` (z,y direction)
function onShell(mesh, s, z, y, along = [1, 0], inset = 0.006) {
  const p = onHull(s, z, y, inset);
  const n = new THREE.Vector3(-p.x, 1.1 - p.y, 0).normalize();                  // into the cockpit
  const a = new THREE.Vector3(0, along[1], along[0]).normalize(); const t = a.clone().sub(n.clone().multiplyScalar(a.dot(n))).normalize();
  const xA = t.clone().cross(n);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, t, n)); mesh.position.copy(p); return mesh;
}
function buildShellFittings(M) {
  const grp = new THREE.Group();
  const lens = new THREE.MeshStandardMaterial({ color: 0xd9d4c4, roughness: 0.6, emissive: 0x000000 });
  const visorMat = new THREE.MeshPhysicalMaterial({ color: 0x3c4a3f, roughness: 0.2, transparent: true, opacity: 0.55, depthWrite: false });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x2a2e31, roughness: 0.5 });
  for (const s of [-1, 1]) {
    // dome / ceiling lights beside the overhead (measured: x 0.40-0.52, along the slope)
    const zc = 1.29; let y = 1.4; while (y < crownAt(zc) && hullHW(zc, y) > 0.46) y += 0.005;
    const dl = rbox(0.11, 0.43, 0.012, 0.02, lens); grp.add(onShell(dl, s, zc, y, [0.94, 0.33], 0.004));
    const dlf = rbox(0.124, 0.444, 0.008, 0.024, M.frame); grp.add(onShell(dlf, s, zc, y, [0.94, 0.33], 0.0));
    // sliding-window unlock handle on the aft frame of window 2
    const h = new THREE.Group(); const hb = rbox(0.022, 0.09, 0.018, 0.006, handleMat); hb.position.z = 0.012; h.add(hb);
    const grip = rbox(0.03, 0.03, 0.03, 0.01, handleMat); grip.position.set(0, -0.04, 0.03); h.add(grip);
    grp.add(onShell(h, s, 0.94, 1.08, [0, 1], 0.03));
    // oxygen mask stowage box in the side console, outboard of the seat
    const box = new THREE.Group(); const bx = rbox(0.13, 0.16, 0.09, 0.008, M.panelDark); bx.position.z = 0.045; box.add(bx);
    const flap = rbox(0.12, 0.07, 0.006, 0.003, M.module); flap.position.set(0, 0.04, 0.092); box.add(flap);
    const pt = rbox(0.05, 0.016, 0.006, 0.002, new THREE.MeshStandardMaterial({ color: 0xc9cccc, roughness: 0.5 })); pt.position.set(0, -0.03, 0.093); box.add(pt);
    box.position.set(s * (hullHW(0.72, 0.6) - 0.12), 0.56, 0.72); box.rotation.x = -Math.PI / 2; grp.add(box);
  }
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
    grp.add(bar(lift(B, 0.02), lift(C, 0.02), 0.06, 0.035, f, nIn));
    {
      const xA = C.clone().sub(B).normalize(), yA = B.clone().sub(A).normalize(); const zA = xA.clone().cross(yA).normalize(); if (zA.dot(nIn) < 0) zA.negate();
      const vis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.004), new THREE.MeshPhysicalMaterial({ color: 0xe8dcee, roughness: 0.1, transparent: true, opacity: 0.42, depthWrite: false }));
      vis.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, zA)); vis.position.copy(B.clone().lerp(C, 0.6)).add(yA.clone().multiplyScalar(-0.08)).add(nIn.clone().multiplyScalar(0.05)); vis.renderOrder = 11; grp.add(vis);
      const armM = new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.45 });
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.16, 12), armM); arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), xA); arm.position.copy(vis.position).add(yA.clone().multiplyScalar(0.075)).add(zA.clone().multiplyScalar(0.012)); grp.add(arm);
      const clamp = rbox(0.04, 0.03, 0.03, 0.008, armM); clamp.position.copy(arm.position).add(xA.clone().multiplyScalar(0.09)); grp.add(clamp);
    }
    const C2 = onHull(s, D.SIDE_WINDOWS.w2[4][0], D.SIDE_WINDOWS.w2[4][1], 0.0), D2 = onHull(s, D.SIDE_WINDOWS.w2[0][0], D.SIDE_WINDOWS.w2[0][1], 0.0);
    // solid corner post: outer face spans from the pane's edge to the sliding window's front edge,
    // 6 cm deep into the cockpit
    const n = 10; const L = [], R = [], Li = [], Ri = [];
    for (let i = 0; i <= n; i++) {
      const tt = i / n; const l = lift(Dp.clone().lerp(C, tt), 0.004), r = D2.clone().lerp(C2, tt);
      const din = new THREE.Vector3(-l.x, 1.1 - l.y, 0.25).normalize().multiplyScalar(0.035);
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
  grp.add(bar(new THREE.Vector3(0, WS.innerBottom[1] - 0.01, WS.innerBottom[2] + 0.012), new THREE.Vector3(0, WS.innerTop[1] + 0.02, WS.innerTop[2] + 0.02), 0.04, 0.035, f, up));

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
    const lip = inner.map((p) => p.clone().add(new THREE.Vector3(-p.x, 1.1 - p.y, 0).normalize().multiplyScalar(0.035)));   // reveal, square to the wall
    grp.add(stripMesh(inner, outer, f), stripMesh(lip, inner, f));
  };
  for (const s of [-1, 1]) { ring(D.SIDE_WINDOWS.w2, s, 0.04); ring(D.SIDE_WINDOWS.w3, s, 0.035); }
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
  const frame = panelFrame(new THREE.Vector3(0, P.baseY, P.faceZ), yDir);
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
  // measured layout of the centre columns and outboard panels (panel-local, y along the face)
  const Y = D.PANEL_Y; const on = (o, x, y, z = 0.001) => { o.position.set(x, Y(y), z); frame.add(o); return o; };
  // centre-left: type placard, ISIS, DDRMI, clock; TERR ON ND
  const plate = rbox(0.09, 0.02, 0.003, 0.002, M.trim); on(plate, -0.152, 0.806, 0.0015);
  const pl = refs.atlas.mesh('A320neo', 0.011, { px: 40, weight: 600, color: '#1f2427' }, 0.08); on(pl, -0.152, 0.806, 0.0032);
  const st = MP.isis(M, 0.078); on(st, -0.142, 0.70); refs.screens.ISIS = st.userData.screen;
  { const rec = rbox(0.06, 0.07, 0.006, 0.012, M.panelDark); on(rec, -0.142, 0.615, -0.001); }   // recessed blank below the ISIS
  // digital clock in the right column (CHR / UTC / ET)
  { const clk = new THREE.Group(); const b = rbox(0.064, 0.078, 0.014, 0.006, M.bezel); b.position.z = 0.007; clk.add(b);
    for (const [y, h] of [[0.022, 0.014], [0.0, 0.02], [-0.024, 0.014]]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.04, h), M.screen); s.position.set(0, y, 0.0145); clk.add(s); }
    for (const [x, y] of [[-0.026, 0.026], [0.026, 0.026], [-0.026, -0.006], [0.026, -0.006], [0.026, -0.026]]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.004, 12).rotateX(Math.PI / 2), M.trim); k.position.set(x, y, 0.016); clk.add(k); }
    on(clk, 0.152, 0.645); refs.clock = clk; }
  // datalink control and display units (DCDU) at the foot of both centre columns
  refs.dcdu = [];
  for (const s of [-1, 1]) { const u = new THREE.Group(); const b = rbox(0.12, 0.085, 0.014, 0.006, M.bezel); b.position.z = 0.007; u.add(b);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.055), M.screen); sc.position.z = 0.0145; u.add(sc);
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { const key = rbox(0.012, 0.008, 0.004, 0.0015, M.trim); key.position.set(sx * 0.05, 0.024 - k * 0.016, 0.0155); u.add(key); }
    on(u, s * 0.155, 0.5); refs.dcdu.push(u); }
  on(MP.terrPanel(M, refs.atlas, -1), -0.2, 0.648, 0.0); on(MP.terrPanel(M, refs.atlas, 1), 0.245, 0.648, 0.0);
  // centre-right: LDG GEAR indicator, AUTO/BRK, A/SKID & BRK FAN, gear lever, triple brake indicator
  on(MP.gearIndicator(M, refs.atlas), 0.168, 0.8, 0.0); on(MP.autobrakePanel(M, refs.atlas), 0.168, 0.755, 0.0);
  on(MP.gearLeverPanel(M, refs.atlas), 0.135, 0.572, 0.0);
  const lever = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.06, 12), M.metal); shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.03; lever.add(shaft);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.018, 28), M.trim); wheel.rotation.z = Math.PI / 2; wheel.position.z = 0.062; lever.add(wheel);
  on(lever, 0.135, 0.548, 0.004); refs.gearLever = lever;
  on(MP.roundInstrument(M, 0.052), 0.205, 0.575);   // triple brake pressure indicator
  // outboard lighting / loudspeaker panels
  on(MP.lightingPanel(M, refs.atlas, -1), -0.69, 0.75, 0.0); on(MP.lightingPanel(M, refs.atlas, 1), 0.69, 0.75, 0.0);
  // the lip under the PFD/ND pairs
  for (const s of [-1, 1]) { const lip = rbox(0.53, 0.035, 0.03, 0.006, M.panel); on(lip, s * 0.48, 0.62, 0.012); }
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.44, 16).rotateZ(Math.PI / 2), M.metal); on(rail, s * 0.42, 0.598, 0.03);
    const slot = rbox(0.46, 0.016, 0.01, 0.004, M.panelDark); on(slot, s * 0.42, 0.598, 0.018);
    for (const [dx, w] of [[-0.17, 0.12], [0, 0.17], [0.17, 0.12]]) { const b = rbox(w, 0.032, 0.07, 0.008, dx ? M.panel : M.panelDark); on(b, s * 0.42 + dx, 0.552, 0.04); }
  }
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
  {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2 * G.strip.half + 0.1, 32).rotateZ(Math.PI / 2), addGrain(new THREE.MeshStandardMaterial({ color: 0x1d2023, roughness: 0.6 }), 'matte'));
    roll.scale.set(1, 1.35, 1); roll.position.set(0, G.topY - 0.006, G.strip.faceZ - 0.012); roll.castShadow = true; grp.add(roll);
  }
  // the control strip: a housing that stands proud of the rear face, panels on its face
  const S = G.strip; const half = S.half;
  const housing = rbox(half * 2, S.h + 0.006, 0.05, 0.008, M.fcu);
  housing.position.set(0, S.y, S.faceZ - 0.025 + 0.002); grp.add(housing);
  const place = (p, x) => { p.position.set(x, S.y, S.faceZ + 0.004); grp.add(p); return p; };
  refs.fcu = place(fcuPanel(M, A), G.fcu.x);
  refs.efis = [place(efisPanel(M, A, 1), -G.efis.x), place(efisPanel(M, A, 2), G.efis.x)];
  refs.warn = [place(warningPanel(M, A, -1), -G.warn.x), place(warningPanel(M, A, 1), G.warn.x)];
  // outboard ends of the strip
  const ew = half - G.warn.x - G.warn.w / 2 - 0.004;
  for (const s of [-1, 1]) place(stripEndPanel(M, A, s, ew), s * (G.warn.x + G.warn.w / 2 + 0.002 + ew / 2));
  for (const s of [-1, 1]) {   // the strip turns aft at x 0.67 and runs on to the corner post
    const wing = new THREE.Group(); const ww = 0.15;
    const face = rbox(ww, S.h, 0.03, 0.006, M.fcu); face.position.set(s * ww / 2, 0, -0.015); wing.add(face);
    const lt = rbox(0.012, 0.008, 0.004, 0.0015, new THREE.MeshStandardMaterial({ color: 0x1b2a44, roughness: 0.3 })); lt.position.set(s * 0.05, 0.004, 0.002); wing.add(lt);
    wing.position.set(s * half, S.y, S.faceZ); wing.rotation.y = -s * 0.62; grp.add(wing);
  }
  return grp;
}

// ---------------------------------------------------------------- centre pedestal
function buildPedestal(M, refs) {
  const P = D.PEDESTAL; const grp = new THREE.Group(); const A = refs.atlas;
  const top = P.profile; const last = top[top.length - 1];
  // two sections: the wide forward body and the narrower aft body (measured)
  const fwd = [[top[0][0], 0.0], top[0], top[1], [P.aftZ, top[1][1]], [P.aftZ, 0.0]];
  const aft = [[P.aftZ, 0.0], [P.aftZ, top[1][1]], last, [P.rearZ, last[1] - 0.02], [P.rearZ, 0.0]];
  grp.add(extrudeProfile(fwd, -P.halfWidth, P.halfWidth, M.panelDark, 0.012));
  grp.add(extrudeProfile(aft, -P.aftHalfWidth, P.aftHalfWidth, M.panelDark, 0.012));

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
    at(s < 0 ? PED.genericPanel(M, A, 0.138, 0.05, 'FLOOD LT   INTEG LT', [['MAIN PNL & PED', 'MAIN PNL & PED']]) : PED.genericPanel(M, A, 0.138, 0.05, 'FLOOD LT   AIDS   DFDR', [['PED', 'PRINT', 'EVENT']]), s * 0.181, 0.632);
    at(s < 0 ? PED.genericPanel(M, A, 0.138, 0.08, 'MULTISCAN   GCS   TILT', [['GAIN', 'MODE', 'TILT'], ['SYS 1', 'PWS', 'AUTO']]) : PED.genericPanel(M, A, 0.138, 0.08, 'ATC / TCAS', [['1', '2', '3', 'STBY'], ['4', '5', '6', 'AUTO'], ['7', '0', 'CLR', 'TA/RA']]), s * 0.181, 0.705);
  }
  // thrust quadrant flanked by the pitch trim wheels
  const tq = makeThrustQuadrant(M, A); at(tq.group, 0, 0.525); refs.thrust = tq;
  refs.trimWheels = [];
  for (const s of [-1, 1]) { const w = makeTrimWheel(M, s); w.position.set(s * 0.097, 0.33, 0.565); grp.add(w); refs.trimWheels.push(w); }
  // engine panel behind the levers
  refs.engPanel = at(PED.engPanel(M, A), 0, 0.705);
  // rear: speed brake | rudder trim | flaps ; door | park brake | transponder
  refs.speedBrake = at(PED.speedBrakePanel(M, A), -0.125, 0.82);
  refs.rudTrim = at(PED.rudderTrimPanel(M, A), 0, 0.81);
  refs.flaps = at(PED.flapsPanel(M, A), 0.125, 0.82);
  refs.parkBrake = at(PED.parkBrakePanel(M, A), 0, 0.94);
  at(PED.genericPanel(M, A, 0.125, 0.075, 'COCKPIT DOOR', [['UNLOCK', 'NORM', 'LOCK'], ['VIDEO']]), -0.13, 0.935);
  // printer on the right, blank panels on the left, gravity gear extension handle in the middle, stowage handle and SLEW key aft right
  { const pr = PED.genericPanel(M, A, 0.125, 0.075, '', []); at(pr, 0.13, 0.935); const slot = rbox(0.1, 0.022, 0.012, 0.003, new THREE.MeshStandardMaterial({ color: 0x121416, roughness: 0.5 })); slot.position.z = 0.006; pr.add(slot); }
  for (const z of [0.99, 1.06]) at(PED.genericPanel(M, A, 0.125, 0.065, '', []), -0.13, z);
  { const p = PED.genericPanel(M, A, 0.125, 0.13, '', []); at(p, 0.13, 1.025);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.005, 10, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.45 })); h.position.set(0, 0.0, 0.004); h.rotation.x = Math.PI / 2; p.add(h);
    const k = rbox(0.016, 0.01, 0.004, 0.002, M.trim); k.position.set(-0.03, -0.045, 0.004); p.add(k); }
  { const g = PED.genericPanel(M, A, 0.1, 0.13, 'GEAR', []); at(g, 0, 1.03);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.008, 40).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5 })); disc.position.z = 0.004; g.add(disc);
    const hnd = rbox(0.024, 0.06, 0.022, 0.004, new THREE.MeshStandardMaterial({ color: 0xa8302a, roughness: 0.45 })); hnd.position.set(0, -0.01, 0.017); g.add(hnd); refs.gravityGear = hnd; }
  // padded side rails along the pedestal edges and the ribbed rubber bumper across its rear (as photographed)
  const pad = new THREE.MeshStandardMaterial({ color: 0x252c38, roughness: 0.55 });
  for (const s of [-1, 1]) for (const [z0, z1, hw, y] of [[P.profile[0][0] + 0.05, P.aftZ, P.halfWidth, P.profile[1][1]], [P.aftZ, P.rearZ - 0.03, P.aftHalfWidth, P.profile[2][1]]]) {
    const rail = rbox(0.03, 0.045, z1 - z0, 0.013, pad); rail.position.set(s * (hw + 0.008), y + 0.005, (z0 + z1) / 2); grp.add(rail);
  }
  const ribM = new THREE.MeshStandardMaterial({ color: 0x5f7380, roughness: 0.7 });
  for (const s of [-1, 1]) {
    const bump = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, P.aftHalfWidth - 0.04, 28).rotateZ(Math.PI / 2), ribM);
    bump.position.set(s * (P.aftHalfWidth / 2 + 0.02), P.profile[2][1] - 0.01, P.rearZ - 0.005); grp.add(bump);
    for (let k = 0; k < 9; k++) { const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.0226, 0.0226, P.aftHalfWidth - 0.05, 20, 1, false, k * 0.7, 0.18).rotateZ(Math.PI / 2), pad); rib.position.copy(bump.position); grp.add(rib); }
  }
  return grp;
}


// ---------------------------------------------------------------- overhead surround and ceiling (as photographed)
function buildOverheadSurround(M) {
  const grp = new THREE.Group(); const O = D.OVERHEAD;
  const F = new THREE.Vector3(0, O.front[1], O.front[0]), R = new THREE.Vector3(0, O.rear[1], O.rear[0]);
  const P = (t) => F.clone().lerp(R, t);
  const ceil = addGrain(new THREE.MeshStandardMaterial({ color: 0x8a9faa, roughness: 0.8, side: THREE.DoubleSide }), 'lining');
  const dark = new THREE.MeshStandardMaterial({ color: 0x1f2329, roughness: 0.55 });
  const edgeX = O.halfWidth + 0.035;
  // up-dip from overhead plane to its housing top (overhead plane normal)
  const n = R.clone().sub(F).normalize().cross(new THREE.Vector3(1, 0, 0)).normalize(); if (n.y < 0) n.negate();
  for (const s of [-1, 1]) {
    // side fairing: from the overhead edge, angled up and outboard into the ceiling, full length of the overhead
    const A = [], B = [];
    for (let i = 0; i <= 24; i++) {
      const p = P(i / 24); const a = new THREE.Vector3(s * edgeX, p.y, p.z).add(n.clone().multiplyScalar(0.03));
      let y = a.y + 0.1; const lim = crownAt(p.z) - 0.02; if (y > lim) y = lim;
      let x = hullHW(p.z, y) - 0.01; if (x < edgeX + 0.05) x = edgeX + 0.05;
      A.push(a); B.push(new THREE.Vector3(s * x, y, p.z));
    }
    grp.add(stripMesh(A, B, ceil));
    // dark padded rail along each long edge of the overhead
    const r0 = P(0).add(new THREE.Vector3(s * (edgeX - 0.008), 0, 0)), r1 = P(1).add(new THREE.Vector3(s * (edgeX - 0.008), 0, 0));
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, r0.distanceTo(r1), 16), dark);
    rail.position.copy(r0).add(r1).multiplyScalar(0.5); rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), r1.clone().sub(r0).normalize()); rail.scale.set(1, 1, 1.4); grp.add(rail);
    // items on the fairing: two eyeball air outlets and a reading light toward the front
    for (const [tt, k] of [[0.12, 'g'], [0.3, 'g']]) {
      const a = A[Math.round(tt * 24)], b = B[Math.round(tt * 24)]; const c = a.clone().lerp(b, 0.5);
      const nrm = b.clone().sub(a).cross(A[Math.round(tt * 24) + 1].clone().sub(a)).normalize(); if (nrm.y > 0) nrm.negate();
      const o = k === 'g' ? gasper(M) : readingLight(); o.position.copy(c).add(nrm.clone().multiplyScalar(0.004)); o.lookAt(c.clone().add(nrm)); grp.add(o);
    }
    // ceiling: headset stowage recess (dark box with a headset in it), aft and outboard of the overhead
    { const z = 1.45, y = 1.82; const rec = new THREE.Group(); const box = rbox(0.3, 0.15, 0.06, 0.01, dark); box.position.z = -0.025; rec.add(box);
      const rim = rbox(0.32, 0.17, 0.008, 0.012, ceil); rim.position.z = 0.004; rec.add(rim); const hs = headset(M); hs.scale.setScalar(0.8); hs.rotation.x = Math.PI / 2; hs.position.z = -0.02; rec.add(hs);
      grp.add(onShell(rec, s, z, Math.min(y, crownAt(z) - 0.06), [1, 0], 0.02)); }
    // loudspeaker box hanging from the ceiling ahead of the overhead side (angled grille face)
    { const z = 0.75; const y = 1.62; const sp = new THREE.Group(); const body = rbox(0.24, 0.16, 0.1, 0.02, ceil); body.position.z = 0.05; sp.add(body);
      const gr = rbox(0.19, 0.11, 0.006, 0.01, new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.8 })); gr.position.z = 0.101; sp.add(gr);
      for (let k = 0; k < 9; k++) { const sl = rbox(0.17, 0.004, 0.003, 0.0015, dark); sl.position.set(0, -0.045 + k * 0.011, 0.105); sp.add(sl); }
      grp.add(onShell(sp, s, z, y, [1, 0], 0.0)); }
    // triangular air outlet and a seam line on the ceiling panel
    { const tri = new THREE.Mesh(new THREE.CircleGeometry(0.035, 3), dark); grp.add(onShell(tri, s, 1.1, 1.78, [1, 0], 0.012)); }
  }
  // SMOKE HOOD placard on the left aft ceiling panel
  { const pl = new THREE.Group(); const p = rbox(0.17, 0.035, 0.003, 0.003, new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.5 })); pl.add(p); grp.add(onShell(pl, -1, 1.75, 1.7, [1, 0], 0.012)); refs_smoke = pl; }
  // aft face of the overhead housing closing up to the roof, with a dome light
  { const z = O.rear[0] + 0.015; const y0 = O.rear[1] - 0.05, y1 = crownAt(z) - 0.005; const hw = hullHW(z, y0 + 0.02) - 0.02;
    const back = rbox(Math.min(2 * hw, 1.0), y1 - y0, 0.012, 0.01, ceil); back.position.set(0, (y0 + y1) / 2, z); grp.add(back);
    const dl = rbox(0.16, 0.06, 0.012, 0.012, new THREE.MeshStandardMaterial({ color: 0xd9d4c4, roughness: 0.5 })); dl.position.set(0, (y0 + y1) / 2, z - 0.008); grp.add(dl); }
  // forward end of the overhead: dark lower lip running across to the windshield header
  { const lip = rbox(2 * edgeX + 0.02, 0.03, 0.06, 0.012, dark); lip.position.set(0, O.front[1] - 0.012, O.front[0] - 0.01); grp.add(lip); }
  return grp;
}
let refs_smoke = null;

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

// ---------------------------------------------------------------- flight-deck equipment (A320 layout)
function cyl(r0, r1, h, mat, seg = 24) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.castShadow = true; m.receiveShadow = true; return m; }
function headset(M) {
  const g = new THREE.Group(); const blk = new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.55 }); const pad = new THREE.MeshStandardMaterial({ color: 0x222426, roughness: 0.9 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.007, 10, 32, Math.PI), blk); band.castShadow = true; g.add(band);
  for (const s of [-1, 1]) {
    const cup = cyl(0.036, 0.038, 0.032, blk, 28); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.08, -0.012, 0); g.add(cup);
    const cush = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 10, 24), pad); cush.rotation.y = Math.PI / 2; cush.position.set(s * 0.062, -0.012, 0); g.add(cush);
  }
  const boom = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.095, -0.02, 0), new THREE.Vector3(-0.1, -0.07, 0.04), new THREE.Vector3(-0.07, -0.11, 0.08)]), 16, 0.003, 8), blk); g.add(boom);
  const mic = cyl(0.007, 0.007, 0.02, pad, 12); mic.rotation.x = Math.PI / 2; mic.position.set(-0.07, -0.11, 0.085); g.add(mic);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.09, -0.03, 0), new THREE.Vector3(-0.07, -0.2, 0.01), new THREE.Vector3(-0.03, -0.33, -0.01), new THREE.Vector3(0.02, -0.42, 0.0)]), 24, 0.0022, 6), blk); g.add(cable);
  return g;
}
function extinguisher() {
  const g = new THREE.Group(); const red = new THREE.MeshStandardMaterial({ color: 0xa3221b, roughness: 0.35, metalness: 0.2 }); const blk = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.5 });
  const body = cyl(0.042, 0.042, 0.28, red, 32); body.position.y = 0.14; g.add(body);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.042, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), red); top.position.y = 0.28; g.add(top);
  const valve = cyl(0.012, 0.014, 0.04, blk); valve.position.y = 0.33; g.add(valve);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.016), blk); lever.position.set(0.02, 0.35, 0); lever.rotation.z = -0.25; g.add(lever);
  for (const y of [0.06, 0.22]) { const band = cyl(0.046, 0.046, 0.02, blk, 32); band.position.y = y; g.add(band); }
  return g;
}
function crashAxe() {
  const g = new THREE.Group(); const yel = new THREE.MeshStandardMaterial({ color: 0xc99a1d, roughness: 0.5 }); const steel = new THREE.MeshStandardMaterial({ color: 0x9da2a4, roughness: 0.3, metalness: 0.8 });
  const handle = cyl(0.014, 0.016, 0.34, yel, 16); handle.position.y = 0.17; g.add(handle);
  const grip = cyl(0.017, 0.017, 0.1, new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.8 }), 16); grip.position.y = 0.06; g.add(grip);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.012), steel); head.position.set(0.025, 0.34, 0); g.add(head);
  return g;
}
function oxyBottle() {
  const g = new THREE.Group(); const grn = new THREE.MeshStandardMaterial({ color: 0x2f6a3c, roughness: 0.4, metalness: 0.2 });
  const b = cyl(0.05, 0.05, 0.3, grn, 32); b.position.y = 0.15; g.add(b);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), grn); cap.position.y = 0.3; g.add(cap);
  const reg = cyl(0.02, 0.02, 0.05, new THREE.MeshStandardMaterial({ color: 0xb8bcbd, metalness: 0.8, roughness: 0.3 })); reg.position.y = 0.36; g.add(reg);
  return g;
}
function gasper(M) {   // ventilation outlet: ring with a swivelling eyeball
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x8f969a, roughness: 0.4, metalness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 10, 28), m); g.add(ring);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 20, 14), m); ball.scale.z = 0.6; ball.position.z = 0.004; g.add(ball);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.009, 20), new THREE.MeshBasicMaterial({ color: 0x0a0a0a })); hole.position.z = 0.0165; g.add(hole);
  return g;
}
function speakerGrille(r = 0.04) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x2b3034, roughness: 0.6 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.14, 6, 8), m); rim.rotation.z = Math.PI / 8; g.add(rim);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#25292c'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#0b0c0d';
  for (let y = 6; y < 128; y += 9) for (let x = 6 + ((y / 9) % 2) * 4; x < 128; x += 9) { c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill(); }
  const tx = new THREE.CanvasTexture(cv); const face = new THREE.Mesh(new THREE.CircleGeometry(r, 8).rotateZ(Math.PI / 8), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.7 })); face.position.z = -0.002; g.add(face);
  return g;
}
function readingLight() {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x2a2e31, roughness: 0.5 });
  const base = cyl(0.022, 0.022, 0.012, m); base.rotation.x = Math.PI / 2; g.add(base);
  const neck = cyl(0.006, 0.006, 0.07, m, 12); neck.rotation.x = Math.PI / 2; neck.position.z = 0.04; g.add(neck);
  const head = cyl(0.018, 0.024, 0.045, m); head.rotation.x = 0.9; head.position.set(0, -0.012, 0.08); g.add(head);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 20), new THREE.MeshStandardMaterial({ color: 0xd8d3c2, roughness: 0.3 })); lens.position.set(0, -0.03, 0.094); lens.rotation.x = 0.9 - Math.PI / 2; g.add(lens);
  return g;
}
function flashlight() {
  const g = new THREE.Group(); const blk = new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.5 }); const yel = new THREE.MeshStandardMaterial({ color: 0xc39b22, roughness: 0.5 });
  const body = cyl(0.018, 0.018, 0.2, blk); g.add(body); const headp = cyl(0.026, 0.02, 0.05, yel); headp.position.y = 0.12; g.add(headp);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.012), new THREE.MeshStandardMaterial({ color: 0x55595c, roughness: 0.5 })); clip.position.z = -0.02; g.add(clip);
  return g;
}
function placard(A, text, w, h, bg = '#b3261e', fg = '#f3f0e8') {
  const g = new THREE.Group();
  const p = rbox(w, h, 0.003, 0.002, new THREE.MeshStandardMaterial({ color: new THREE.Color(bg), roughness: 0.5 })); g.add(p);
  const l = A.mesh(text, h * 0.55, { px: 36, weight: 600, color: fg }, w * 0.9); l.position.z = 0.0018; g.add(l); return g;
}

function buildFittings(M, refs) {
  const grp = new THREE.Group(); const A = refs.atlas; const W = D.WINDSHIELD;
  // standby compass at the top of the windshield centre post
  const comp = new THREE.Group(); const cb = rbox(0.075, 0.055, 0.06, 0.008, M.panelDark); comp.add(cb);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.026), new THREE.MeshStandardMaterial({ color: 0xd9d6c8, roughness: 0.4 })); win.position.z = 0.031; comp.add(win);
  const card = A.mesh('N  3  6  E', 0.012, { px: 32, weight: 600, color: '#15181a' }, 0.046); card.position.z = 0.032; comp.add(card);
  comp.position.set(0, W.innerTop[1] - 0.06, W.innerTop[2] + 0.07); comp.rotation.x = -0.3; grp.add(comp); refs.compass = comp;
  // windshield wipers parked along the lower edge, outside the glass
  const wm = new THREE.MeshStandardMaterial({ color: 0x141617, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const a = new THREE.Vector3(s * 0.1, W.innerBottom[1] + 0.03, W.innerBottom[2] - 0.03), b = new THREE.Vector3(s * 0.62, W.innerBottom[1] + 0.05, W.innerBottom[2] + 0.31);
    const arm = rbox(0.012, a.distanceTo(b), 0.01, 0.003, wm); arm.position.copy(a).add(b).multiplyScalar(0.5);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); arm.position.y -= 0.0; arm.position.z -= 0.035; grp.add(arm);
    const piv = cyl(0.014, 0.014, 0.02, wm); piv.position.set(s * 0.62, W.innerBottom[1] + 0.04, W.innerBottom[2] + 0.27); grp.add(piv);
  }
  // panel floodlights under the glareshield
  const G = D.GLARE;
  for (const s of [-1, 1]) {
    const fl = rbox(0.17, 0.014, 0.03, 0.005, M.panelDark); fl.position.set(s * 0.52, G.underY - 0.008, G.strip.faceZ - 0.06); grp.add(fl);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.018), new THREE.MeshStandardMaterial({ color: 0x7c7466, roughness: 0.3, emissive: 0x000000 }));
    lens.rotation.x = Math.PI / 2; lens.position.set(s * 0.52, G.underY - 0.0155, G.strip.faceZ - 0.06); grp.add(lens);
  }
  // loudspeaker grilles on the outboard main panel
  const P = D.PANEL; const t = THREE.MathUtils.degToRad(P.tiltDeg);
  for (const s of [-1, 1]) { const sp = speakerGrille(0.034); const yl = D.PANEL_Y(0.63); sp.position.set(s * 0.71, P.baseY + yl * Math.cos(t), P.faceZ - yl * Math.sin(t) + 0.004); sp.rotation.x = -t; grp.add(sp); }
  for (const s of [-1, 1]) {
    // headset hanging on its hook on the post between the side windows
    const hz = 1.02, hy = 1.3; const hook = onHull(s, hz, hy, 0.03);
    const hk = cyl(0.006, 0.006, 0.05, M.metal, 10); hk.rotation.z = Math.PI / 2; hk.position.copy(hook); grp.add(hk);
    const hs = headset(M); hs.position.set(hook.x - s * 0.02, hook.y - 0.01, hook.z); hs.rotation.y = Math.PI / 2; grp.add(hs);
    // escape rope compartment above the sliding window
    const er = new THREE.Group(); const lid = rbox(0.24, 0.07, 0.012, 0.006, M.panelDark); er.add(lid); const pl = placard(A, 'ESCAPE ROPE', 0.11, 0.022); pl.position.z = 0.008; er.add(pl);
    grp.add(onShell(er, s, 0.74, 1.5, [1, 0], 0.012));
    {
      const leather = addGrain(new THREE.MeshStandardMaterial({ color: 0x1e2227, roughness: 0.55, side: THREE.DoubleSide }), 'rubber');
      const T = [], B2 = [];
      for (let i = 0; i <= 40; i++) { const z = 0.66 + 1.0 * i / 40; T.push(onHull(s, z, 1.5, 0.012)); B2.push(onHull(s, z, 1.42, 0.012)); }
      grp.add(stripMesh(T, B2, leather));
    }
    // air outlets near the windows and on the ceiling edge
    grp.add(onShell(gasper(M), s, 0.5, 1.5, [1, 0], 0.012)); grp.add(onShell(gasper(M), s, 1.2, 1.56, [1, 0], 0.012));
    // reading light on the sidewall above the console
    grp.add(onShell(readingLight(), s, 0.42, 0.92, [1, 0], 0.0));
    // stowed sun visor, flat against the lining above the sliding window
    const visor = rbox(0.3, 0.17, 0.006, 0.012, new THREE.MeshPhysicalMaterial({ color: 0x2d3a33, roughness: 0.25, transparent: true, opacity: 0.7 }));
    grp.add(onShell(visor, s, 0.62, 1.47, [1, 0], 0.012));
    // tablet (EFB) in its mount at the forward edge of the sliding window
    const efb = new THREE.Group(); const ef = rbox(0.25, 0.18, 0.014, 0.012, new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.4 })); ef.position.z = 0.03; efb.add(ef);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 184; const c2 = cv.getContext('2d'); c2.fillStyle = '#dfe6ea'; c2.fillRect(0, 0, 256, 184);
    c2.strokeStyle = '#8fb3c9'; c2.lineWidth = 6; for (let k = 0; k < 7; k++) { c2.beginPath(); c2.moveTo(0, 20 + k * 26); c2.lineTo(256, 8 + k * 30); c2.stroke(); }
    c2.fillStyle = '#e3b23c'; for (let k = 0; k < 9; k++) { c2.beginPath(); c2.arc(20 + k * 27, 40 + (k % 3) * 45, 5, 0, 7); c2.fill(); }
    const etx = new THREE.CanvasTexture(cv); etx.colorSpace = THREE.SRGBColorSpace;
    const es = new THREE.Mesh(new THREE.PlaneGeometry(0.225, 0.16), new THREE.MeshStandardMaterial({ map: etx, emissiveMap: etx, emissive: 0x777777, roughness: 0.25 })); es.position.z = 0.0375; efb.add(es);
    const arm = rbox(0.03, 0.03, 0.04, 0.008, M.metal); arm.position.z = 0.012; efb.add(arm);
    grp.add(onShell(efb, s, 0.42, 1.0, [1, 0], 0.06));
    // moulded sidewall panel below the side windows: light lining with a dark recessed grip and armrest ledge (as photographed)
    { const mp = new THREE.Group(); const body = rbox(0.16, 0.62, 0.05, 0.03, M.frame); body.position.z = 0.025; mp.add(body);   // long side runs fore-aft
      const rec = rbox(0.06, 0.28, 0.03, 0.012, new THREE.MeshStandardMaterial({ color: 0x1b1f24, roughness: 0.6 })); rec.position.set(0.01, 0.04, 0.042); mp.add(rec);
      const ledge = rbox(0.025, 0.62, 0.08, 0.01, M.frame); ledge.position.set(-0.085, 0, 0.04); mp.add(ledge);
      grp.add(onShell(mp, s, 0.78, 0.78, [1, 0], 0.0)); }
    // map / document pocket and flashlight on the sidewall beside the seat
    const pocket = new THREE.Group(); const pk = rbox(0.3, 0.16, 0.05, 0.01, M.panelDark); pk.position.z = 0.025; pocket.add(pk);
    const lip = rbox(0.3, 0.02, 0.06, 0.006, M.module); lip.position.set(0, 0.075, 0.03); pocket.add(lip); grp.add(onShell(pocket, s, 1.0, 0.68, [1, 0], 0.0));
    const fls = flashlight(); grp.add(onShell(fls, s, 1.38, 0.62, [0, 1], 0.03));
  }
  for (const s of [-1, 1]) {
    const L = [], R = [], Rf = [];
    for (let i = 0; i <= 40; i++) { const z = 0.3 + 1.32 * i / 40; const y = sillY(z) - 0.02; const p = onHull(s, z, y, 0.0); L.push(p); const q = p.clone(); q.x -= s * 0.04; R.push(q); const r2 = q.clone(); r2.y -= 0.018; Rf.push(r2); }
    const ledge = M.module.clone(); ledge.side = THREE.DoubleSide; grp.add(stripMesh(L, R, ledge), stripMesh(R, Rf, ledge));
  }
  // footwells: ribbed rudder pedals on their arms, the pedal housing with its PULL TO ADJUST handle
  { const ribTex = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const c = cv.getContext('2d'); c.fillStyle = '#4a5560'; c.fillRect(0, 0, 64, 256); c.fillStyle = '#2b333b'; for (let y = 0; y < 256; y += 8) c.fillRect(0, y, 64, 3); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx; })();
    const pedM = new THREE.MeshStandardMaterial({ map: ribTex, roughness: 0.7 }); const blk = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.5 });
    for (const s of [-1, 1]) {
      for (const p of [-1, 1]) { const ped = rbox(0.09, 0.22, 0.016, 0.008, pedM); ped.position.set(s * D.SEAT_X + p * 0.1, 0.2, 0.02); ped.rotation.x = -0.45; grp.add(ped);
        const arm = rbox(0.02, 0.16, 0.02, 0.005, blk); arm.position.set(s * D.SEAT_X + p * 0.1, 0.32, -0.04); arm.rotation.x = 0.6; grp.add(arm); }
      const hous = rbox(0.11, 0.3, 0.12, 0.02, blk); hous.position.set(s * D.SEAT_X, 0.18, -0.06); grp.add(hous);
      const hdl = new THREE.Group(); const t1 = rbox(0.05, 0.016, 0.012, 0.004, blk); t1.position.y = 0.03; hdl.add(t1); const st = rbox(0.012, 0.05, 0.01, 0.003, blk); hdl.add(st);
      const lab = placard(A, 'PULL TO ADJUST', 0.045, 0.012, '#15181b', '#e8ebe6'); lab.position.set(0, 0.03, 0.007); hdl.add(lab);
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 32).rotateX(Math.PI / 2), blk); disk.position.z = -0.006; hdl.add(disk);
      hdl.position.set(s * D.SEAT_X, 0.36, 0.0); hdl.rotation.x = -0.5; grp.add(hdl);
    }
  }
  // rear area behind the seats (as photographed): portable extinguisher compartment, L/G PINS box, gloves, document holder
  { const zr2 = D.REAR_WALL_Z - 0.02;
    const pfe = placard(A, 'PORTABLE FIRE EXTIN', 0.16, 0.014, '#b3261e', '#f3f0e8'); pfe.position.set(0.86, 0.5, 1.45); pfe.rotation.y = -Math.PI / 2; grp.add(pfe);
    const lgp = new THREE.Group(); const bx = rbox(0.3, 0.12, 0.25, 0.01, M.panelDark); lgp.add(bx); const lp = placard(A, 'L/G PINS', 0.09, 0.024); lp.position.set(0, 0, 0.127); lgp.add(lp);
    lgp.position.set(-0.85, 0.07, 1.75); grp.add(lgp);
    const glv = new THREE.Group(); const pouch = rbox(0.16, 0.24, 0.03, 0.02, new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 0.8 })); glv.add(pouch); const gp = placard(A, 'GLOVES', 0.08, 0.02); gp.position.z = 0.017; gp.rotation.z = 0.5; glv.add(gp);
    glv.position.set(1.02, 1.0, zr2 - 0.25); glv.rotation.y = -Math.PI / 2; grp.add(glv);
    const doc = rbox(0.22, 0.3, 0.004, 0.006, new THREE.MeshPhysicalMaterial({ color: 0xf2f2ee, roughness: 0.3, transparent: true, opacity: 0.85 })); doc.position.set(-1.05, 1.15, zr2 - 0.2); doc.rotation.y = Math.PI / 2; grp.add(doc); }
  // rear of the cockpit: CB panel behind the F/O, extinguisher, axe, oxygen bottle, folded jump seat, coat hooks
  const zr = D.REAR_WALL_Z - 0.012;
  const cbItems = [];
  for (let r = 0; r < 10; r++) cbItems.push({ t: 'cb', x: 0, y: 0.32 - r * 0.068, cols: 18, rows: 1, dx: 0.021, dy: 0 }, { t: 'line', pts: [[-0.2, 0.345 - r * 0.068], [0.2, 0.345 - r * 0.068]], w: 0.0005 });
  const cbp = buildPanel({ w: 0.42, h: 0.72, name: 'cb120VU', items: [{ t: 'text', x: 0, y: 0.348, s: '120VU', size: 0.006 }, ...cbItems] }, M, A);
  cbp.position.set(0.78, 1.15, zr); cbp.rotation.y = Math.PI; grp.add(cbp);
  const ext = extinguisher(); ext.position.set(1.05, 0.35, zr - 0.06); grp.add(ext);
  const brk = rbox(0.1, 0.05, 0.03, 0.006, M.metal); brk.position.set(1.05, 0.5, zr - 0.015); grp.add(brk);
  const axe = crashAxe(); axe.position.set(-1.05, 0.95, zr - 0.02); grp.add(axe);
  const ox = oxyBottle(); ox.position.set(-0.85, 0.3, zr - 0.06); grp.add(ox);
  const js = new THREE.Group(); const jsb = rbox(0.44, 0.5, 0.06, 0.03, M.seatShell); jsb.position.y = 0.25; js.add(jsb);
  const jsc = rbox(0.38, 0.42, 0.03, 0.02, M.seatBlue); jsc.position.set(0, 0.25, -0.04); js.add(jsc);
  js.position.set(-0.6, 0.55, zr - 0.04); grp.add(js);
  for (const x of [-0.95, 0.5]) { const hk = cyl(0.008, 0.008, 0.04, M.metal, 10); hk.rotation.x = Math.PI / 2; hk.position.set(x, 1.7, zr - 0.02); grp.add(hk); }
  const lv = placard(A, 'LIFE VEST', 0.09, 0.03); lv.position.set(-0.6, 0.45, zr - 0.075); lv.rotation.y = Math.PI; grp.add(lv);
  // door: handle, viewer, decompression panels, placard
  const dz = zr - 0.05; const dm = new THREE.MeshStandardMaterial({ color: 0x1c1f21, roughness: 0.5 });
  const handle = rbox(0.14, 0.03, 0.03, 0.01, M.metal); handle.position.set(0.26, 1.0, dz); grp.add(handle);
  const viewer = cyl(0.012, 0.012, 0.01, dm); viewer.rotation.x = Math.PI / 2; viewer.position.set(0, 1.5, dz); grp.add(viewer);
  for (const y of [0.35, 1.7]) { const dp = rbox(0.5, 0.18, 0.01, 0.01, dm); dp.position.set(0, y, dz); grp.add(dp); for (let k = 0; k < 6; k++) { const sl = rbox(0.44, 0.008, 0.012, 0.003, M.panelDark); sl.position.set(0, y - 0.07 + k * 0.028, dz - 0.003); grp.add(sl); } }
  const dpl = placard(A, 'COCKPIT DOOR', 0.16, 0.03, '#2b3034', '#e8ebe6'); dpl.position.set(0, 1.25, dz - 0.005); dpl.rotation.y = Math.PI; grp.add(dpl);
  return grp;
}

function buildConsolesAndSeats(M, refs) {
  const grp = new THREE.Group(); const C = D.CONSOLE;
  for (const s of [-1, 1]) {
    // lateral console: chamfered front corner, inner face angled outboard toward the seat, top rising to the wall
    const outer = hullHW((C.z0 + C.z1) / 2, C.topY) + 0.05, ix = C.innerX;
    const plan = [[ix + 0.07, C.z0], [outer, C.z0], [outer, C.z1], [ix + 0.13, C.z1], [ix + 0.02, C.z0 + 0.3], [ix, C.z0 + 0.22], [ix, C.z0 + 0.07]];
    const sh = new THREE.Shape(plan.map(([x, z]) => new THREE.Vector2(s * x, -z)));
    const conGeo = new THREE.ExtrudeGeometry(sh, { depth: C.topY, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelOffset: -0.006, bevelSegments: 2 }).rotateX(-Math.PI / 2);
    const conMat = M.panelDark.clone(); conMat.side = THREE.DoubleSide;
    const con = new THREE.Mesh(conGeo, conMat); con.castShadow = con.receiveShadow = true; grp.add(con);
    const topSh = new THREE.Shape(plan.map(([x, z]) => new THREE.Vector2(s * x, -z)));
    const top = new THREE.Mesh(new THREE.ExtrudeGeometry(topSh, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelOffset: -0.003, bevelSegments: 2 }).rotateX(-Math.PI / 2), M.consoleTop);
    top.position.y = C.topY; top.receiveShadow = true; grp.add(top);
    // raised sidestick housing with a sloped front, the stick mounted on its top
    const hous = new THREE.Group(); hous.position.set(s * D.SIDESTICK.x, C.topY + 0.01, D.SIDESTICK.z); grp.add(hous);
    const hb = rbox(0.17, 0.05, 0.24, 0.012, M.panelDark); hb.position.set(0, 0.025, 0.01); hous.add(hb);
    const ramp = rbox(0.17, 0.05, 0.08, 0.012, M.panelDark); ramp.position.set(0, 0.012, -0.12); ramp.rotation.x = 0.5; hous.add(ramp);
    const deck = rbox(0.15, 0.006, 0.2, 0.003, M.consoleTop); deck.position.set(0, 0.051, 0.01); hous.add(deck);
    // sidestick
    const st = makeSidestick(M, s);
    st.position.set(s * D.SIDESTICK.x, C.topY + 0.064, D.SIDESTICK.z); grp.add(st);
    refs[s < 0 ? 'sidestickCpt' : 'sidestickFo'] = st;
    // nosewheel steering tiller, outboard and slightly forward of the sidestick
    const til = makeTiller(M); til.position.set(s * (D.TILLER.x + 0.04), C.topY + 0.012, D.SIDESTICK.z + 0.06); grp.add(til); refs[s < 0 ? 'tillerCpt' : 'tillerFo'] = til;
    // folding table stowed in front of the console
    const tbl = rbox(0.3, 0.012, 0.2, 0.004, M.module); tbl.position.set(s * 0.82, C.topY - 0.06, -0.02); tbl.rotation.z = s * 0.06; grp.add(tbl);
    const clip = rbox(0.22, 0.01, 0.02, 0.003, M.metal); clip.position.set(s * 0.82, C.topY - 0.05, -0.1); grp.add(clip);
    // aft lateral console beside the seat: cup holder, ashtray, stowage
    const az0 = C.z1, az1 = 1.32, ain = 0.86, aout = hullHW((az0 + az1) / 2, 0.45) + 0.05, aTop = 0.46;
    const acon = rbox(aout - ain, aTop, az1 - az0, 0.02, M.panelDark); acon.position.set(s * (ain + aout) / 2, aTop / 2, (az0 + az1) / 2); grp.add(acon);
    const atop = rbox(aout - ain - 0.02, 0.01, az1 - az0 - 0.02, 0.004, M.consoleTop); atop.position.set(s * (ain + aout) / 2, aTop + 0.005, (az0 + az1) / 2); grp.add(atop);
    const cup = cyl(0.04, 0.04, 0.012, new THREE.MeshStandardMaterial({ color: 0x0f1011, roughness: 0.8 }), 28); cup.position.set(s * (ain + 0.08), aTop + 0.006, az0 + 0.12); grp.add(cup);
    const cupR = new THREE.Mesh(new THREE.TorusGeometry(0.041, 0.004, 8, 28), M.metal); cupR.rotation.x = Math.PI / 2; cupR.position.set(s * (ain + 0.08), aTop + 0.012, az0 + 0.12); grp.add(cupR);
    const ash = rbox(0.08, 0.012, 0.06, 0.004, M.metal); ash.position.set(s * (ain + 0.2), aTop + 0.012, az0 + 0.12); grp.add(ash);

    // pilot seat (measured): cushion top 0.43 m, z 0.72-1.05; raked back to 0.97 m; separate
    // headrest to 1.23 m; short armrests at 0.6 m; single central column on floor tracks
    const seat = new THREE.Group(); const S = D.SEAT;
    const track = rbox(0.34, 0.025, 0.62, 0.006, M.metal); track.position.set(0, 0.0125, 0.06); seat.add(track);
    const foot = rbox(0.26, 0.05, 0.22, 0.012, M.seatShell); foot.position.set(0, 0.05, 0.165); seat.add(foot);
    const col = rbox(0.17, 0.27, 0.11, 0.02, M.seatShell); col.position.set(0, 0.19, 0.165); seat.add(col);
    const frame = rbox(0.46, 0.06, 0.34, 0.02, M.seatShell); frame.position.set(0, 0.33, 0.0); seat.add(frame);
    const cush = rbox(0.42, 0.07, 0.33, 0.03, M.seatBlue); cush.position.set(0, 0.39, -0.005); cush.rotation.x = -0.06; seat.add(cush);
    const backG = new THREE.Group(); backG.position.set(0, 0.40, 0.17); backG.rotation.x = 0.23; seat.add(backG);
    const shell = rbox(0.40, 0.57, 0.09, 0.03, M.seatShell); shell.position.set(0, 0.285, 0.02); backG.add(shell);
    const pad = rbox(0.34, 0.5, 0.04, 0.02, M.seatBlue); pad.position.set(0, 0.29, -0.035); backG.add(pad);
    const vest = rbox(0.075, 0.026, 0.006, 0.003, new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.5 })); vest.position.set(0, 0.47, 0.067); backG.add(vest);
    const vl = refs.atlas.mesh('LIFE VEST', 0.012, { px: 32, weight: 600, color: '#f2efe8' }, 0.068); vl.position.set(0, 0.47, 0.0705); backG.add(vl);
    const post = rbox(0.03, 0.06, 0.03, 0.008, M.metal); post.position.set(0, 0.6, 0.02); backG.add(post);
    const head = rbox(0.31, 0.22, 0.09, 0.04, M.seatFabric); head.position.set(0, 0.72, 0.01); backG.add(head);
    const headTop = rbox(0.29, 0.02, 0.07, 0.008, M.seatBlue); headTop.position.set(0, 0.825, 0.0); backG.add(headTop);
    for (const a of [-1, 1]) {
      const arm = rbox(0.05, 0.045, 0.24, 0.018, M.seatShell); arm.position.set(a * 0.25, 0.58, 0.08); seat.add(arm);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 16).rotateZ(Math.PI / 2), M.trim); knob.position.set(a * 0.25, 0.585, -0.045); seat.add(knob);
      const stay = rbox(0.03, 0.17, 0.03, 0.008, M.seatShell); stay.position.set(a * 0.25, 0.49, 0.17); seat.add(stay);
    }
    seat.position.set(s * D.SEAT_X, 0, 0.885); grp.add(seat);

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
    buildOverhead(M, refs), buildOverheadSurround(M), buildConsolesAndSeats(M, refs), buildFittings(M, refs));
  root.traverse((o) => { if (o.isMesh && o.material !== M.glass) { o.castShadow ??= true; o.receiveShadow = true; } });
  scene.add(root);
  buildOutside(scene);
  return { root, refs, materials: M };
}
