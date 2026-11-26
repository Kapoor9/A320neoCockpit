// Builds the A320neo flight deck geometry. All shapes are original, made from the
// dimensions in dims.js. Rounded edges everywhere: real cockpit parts have no sharp boxes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import * as D from './dims.js';
import { addGrain } from './surface.js';
import { LabelAtlas } from './labels.js';
import { makeMCDU } from './parts/mcdu.js';
import { makeSidestick, makeTiller, makeThrustQuadrant, makeTrimWheel } from './parts/levers.js';
import { fcuPanel, efisPanel, glareSidePanel } from './parts/glareshield.js';
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
    panel: std(0x7a8e98, 0.6),          // instrument panel blue-grey
    panelDark: std(0x2b3341, 0.6),     // dark navy console tops, pedestal body      // panel frames and seams
    module: std(0x7a8e98, 0.58),         // individual 146 mm system panels
    seam: std(0x2b3236, 0.8),
    glare: std(0x202326, 0.8),          // thin dark glareshield cap           // anti-glare finish
    fcu: std(0x7a8e98, 0.6),
    consoleTop: std(0x343d4c, 0.55),   // dark navy console tops (as photographed)
    lining: std(0x7a8e98, 0.8),         // upper sidewall lining
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

function A_LBL(s, h) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#e9ece8'; c.font = '700 44px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 64, 34);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return new THREE.Mesh(new THREE.PlaneGeometry(h * 2, h), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
}
export const LP_ZF = (y) => { const t = Math.min(1, Math.max(0, (y - 0.795) / 0.075)); return 0.24 + 0.095 * t * t * (3 - 2 * t); };   // front edge of the lower pillar, side view
const LP_VE = 0.45;   // the post's flared foot merges into the lower pillar at this height (v)
const lpAt = (s, v, u) => { const y = 0.95 - 0.148 * v; const zf = LP_ZF(y), zb = 0.47 + 0.25 * (1 - Math.cos(v * Math.PI / 2));
  const dep = (0.072 + 0.1 * (v * v * (3 - 2 * v)));
  const e = Math.min(Math.sin(Math.PI / 2 * Math.min(1, u / 0.1)), 1 - 0.65 * THREE.MathUtils.smoothstep(u, 0.55, 1));
  return onHull(s, zf + (zb - zf) * u, y, Math.max(0.002, 0.004 + dep * e)); };
function buildWindowFrames(M) {
  const grp = new THREE.Group(); const f = M.frame.clone(); f.side = THREE.DoubleSide;
  // stepped mouldings: retainer (metal), then three tiers; risers a shade darker than the ledges
  const metal = new THREE.MeshStandardMaterial({ color: 0x8f979c, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide });
  const riser = addGrain(new THREE.MeshStandardMaterial({ color: 0x697c86, roughness: 0.62, side: THREE.DoubleSide }), 'paint');
  const screwG = new THREE.SphereGeometry(0.0024, 10, 6), screwM = new THREE.MeshStandardMaterial({ color: 0x4a5055, roughness: 0.35, metalness: 0.7 });
  const screw = (p) => { const m = new THREE.Mesh(screwG, screwM); m.position.copy(p); m.scale.set(1, 1, 1); grp.add(m); };
  const loft = (path, outs, ins, prof, matFor) => { const rings = prof.map(() => []);
    path.forEach((p, i) => prof.forEach(([o, d], j) => rings[j].push(p.clone().addScaledVector(outs[i], o).addScaledVector(ins[i], d))));
    for (let j = 0; j < prof.length - 1; j++) { const m = stripMesh(rings[j], rings[j + 1], matFor(j)); m.castShadow = m.receiveShadow = true; grp.add(m); } return rings; };
  const stepMat = (j) => (j % 2 === 0 ? riser : f);
  const V3 = (p, s = 1) => new THREE.Vector3(s * p[0], p[1], p[2]);
  for (const s of [-1, 1]) {
    const A = V3(WS.innerBottom, s), B = V3(WS.innerTop, s), C = V3(WS.outerTop, s), Dp = V3(WS.outerBottom, s);
    // pane
    const g = new THREE.BufferGeometry().setFromPoints([A, Dp, C, A, C, B]); g.computeVertexNormals();
    const pane = new THREE.Mesh(g, M.glass); pane.renderOrder = 10; grp.add(pane);
    const nIn = Dp.clone().sub(A).cross(B.clone().sub(A)).normalize(); if (nIn.z < 0) nIn.negate();   // normal pointing into the cockpit
    const lift = (v, d) => v.clone().add(nIn.clone().multiplyScalar(d));
    // header bar along the top edge, and the corner post between the pane and the sliding window
    {
      const cen = A.clone().add(B).add(C).add(Dp).multiplyScalar(0.25);
      const edgeN = (a, b) => { const tt = b.clone().sub(a).normalize(); const n = tt.cross(nIn).normalize(); if (n.dot(a.clone().lerp(b, 0.5).sub(cen)) < 0) n.negate(); return n; };
      const sample = (a, b, n) => { const P = [], O = [], N = edgeN(a, b); for (let i = 0; i <= n; i++) { P.push(a.clone().lerp(b, i / n)); O.push(N); } return [P, O]; };
      // retainer strip over the glass edge, all round the three visible edges, with screws
      const RET = [[-0.014, 0.0015], [-0.014, 0.0055], [-0.002, 0.0068], [0.002, 0.004]];
      for (const [a, b, n] of [[Dp, C, 14], [C, B, 16], [B, A, 14]]) { const [P, O] = sample(a, b, n); loft(P, O, P.map(() => nIn), RET, () => metal);
        const len = a.distanceTo(b); const ns = Math.floor(len / 0.06); for (let i = 1; i < ns; i++) screw(a.clone().lerp(b, i / ns).addScaledVector(O[0], -0.008).addScaledVector(nIn, 0.0072)); }
      // header: three tiers stepping up and back from the top edge of the pane
      const [P, O] = sample(C, B, 18);
      loft(P, O, P.map(() => nIn), [[0.0, 0.004], [0.002, 0.02], [0.022, 0.022], [0.024, 0.038], [0.05, 0.04], [0.052, 0.058], [0.094, 0.06], [0.104, 0.05], [0.11, 0.02]], stepMat);
    }
    {
      const xA = C.clone().sub(B).normalize(), yA = B.clone().sub(A).normalize(); const zA = xA.clone().cross(yA).normalize(); if (zA.dot(nIn) < 0) zA.negate();
    }
    const C2 = onHull(s, D.SIDE_WINDOWS.w2[4][0], D.SIDE_WINDOWS.w2[4][1], 0.0), D2 = onHull(s, D.SIDE_WINDOWS.w2[0][0], D.SIDE_WINDOWS.w2[0][1], 0.0);
    // solid corner post: outer face spans from the pane's edge to the sliding window's front edge,
    // 6 cm deep into the cockpit
    const n = 10; const L = [], R = [], Li = [], Ri = [], DIN = [];
    const postSide = addGrain(new THREE.MeshStandardMaterial({ color: 0x74878f, roughness: 0.62, side: THREE.DoubleSide }), 'paint');   // side faces, a shade under the face
    for (let i = 0; i <= n; i++) {
      const tt = i / n; const l = lift(Dp.clone().lerp(C, tt), 0.004), r = D2.clone().lerp(C2, tt);
      const din = new THREE.Vector3(-l.x, 1.1 - l.y, 0.25).normalize().multiplyScalar(0.095 * (1 - 0.8 * THREE.MathUtils.smoothstep(tt, 0.8, 1.0)) * (0.75 + 0.25 * THREE.MathUtils.smoothstep(tt, 0.0, 0.3)));
      L.push(l); R.push(r); DIN.push(din);
    }
    // each long side of the post climbs in three steps toward its inner face
    const SH = []; { const tier = (d0, dd, l0, dl) => { for (let q = 1; q <= 4; q++) { const an = (q / 4) * Math.PI / 2; SH.push([d0 + dd * Math.sin(an), l0 + dl * (1 - Math.cos(an))]); } };
      SH.push([0, 0]); tier(0, 0.34, 0, 1); tier(0.34, 0.34, 1, 1); SH.push([1, 2]); }
    const stairs = (base, other, k) => { const out = SH.map(() => []);
      base.forEach((b, i) => { const w = b.distanceTo(other[i]); const tR = other[i].clone().sub(b).normalize(); const sw = Math.min(0.012, w * 0.14); const dn = DIN[i].clone().multiplyScalar(k);
        SH.forEach(([dd, ll], j) => out[j].push(b.clone().addScaledVector(dn, dd).addScaledVector(tR, sw * ll))); });
      for (let j = 0; j < SH.length - 1; j++) { const m = stripMesh(out[j], out[j + 1], (j < 4 || (j >= 8 && j < 12)) ? postSide : f); m.castShadow = m.receiveShadow = true; grp.add(m); } return out[SH.length - 1]; };
    { const keep = postSide; Li.push(...(() => { const r = stairs(L, R, 1); return r; })()); }
    Ri.push(...stairs(R, L, 0.85));
    grp.add(stripMesh(L, R, f), stripMesh(Li, Ri, f));
    // dark seam between the post and the windshield frame, out to the shell, as on the aircraft
    // third piece: fills from the side-window glass up onto the post's inner face along its whole length,
    // and carries on below the post down onto the lower pillar, so post, window frame and pillar read as one moulding
    { const W2 = D.SIDE_WINDOWS.w2; const ez = W2[4][0] - W2[0][0], ey = W2[4][1] - W2[0][1], el = Math.hypot(ez, ey);
      let nz = ey / el, ny = -ez / el; const cz = W2.reduce((a2, q) => a2 + q[0], 0) / W2.length, cy = W2.reduce((a2, q) => a2 + q[1], 0) / W2.length;
      if (nz * (cz - W2[0][0]) + ny * (cy - W2[0][1]) < 0) { nz = -nz; ny = -ny; }   // into the window
      const rows = [[], [], [], [], [], []];
      const add = (z, y, top) => { const at = (o, d) => onHull(s, z + nz * o, y + ny * o, d);
        const a = at(0.004, 0.009), b = top; const mid = a.clone().lerp(b, 0.5); const inw = new THREE.Vector3(-s, 0, 0);
        rows[0].push(at(0.016, 0.002)); rows[1].push(at(0.016, 0.0075)); rows[2].push(a); rows[3].push(a.clone().lerp(b, 0.25).addScaledVector(inw, 0.008));
        rows[4].push(mid.addScaledVector(inw, 0.01)); rows[5].push(b); };
      // toward the bottom the aft edge flares out in one smooth curve, so the post widens down onto the lower pillar's top
      const FL = 0.11, N2 = 3 * n;
      for (let i = 0; i <= N2; i++) { const t = i / N2; const u = Math.min(1, t / 0.55); const fl = FL * (1 - u) * (1 - u);
        const fi = t * n, i0 = Math.min(n - 1, Math.floor(fi)), fr = fi - i0; const top = Ri[i0].clone().lerp(Ri[i0 + 1], fr);
        add(W2[0][0] + ez * t + fl, W2[0][1] + ey * t, top); }
      // the flared foot lands exactly on the lower pillar's top edge: no gap, no ledge
      { const UJ = [1, 0.97, 0.9, 0.6, 0.35, 0.14], NB = Math.round(N2 * 0.3); rows.forEach((r, j) => { const tgt = lpAt(s, 0, UJ[j]);
          for (let i = 0; i <= NB; i++) { const w = (1 - i / NB) ** 2; r[i].lerp(tgt, w); } }); }
      for (let j = 0; j < 5; j++) { const m = stripMesh(rows[j], rows[j + 1], j === 0 ? metal : f); m.castShadow = m.receiveShadow = true; grp.add(m); } }
    // lower pillar: the post carries on below the sill as one moulding, widening aft as it runs down
    // into the side wall; edges roll down onto the lining, the front edge meets the dark connector
    { const nu = 28, nv = 40, rows = [];
      const GL = D.GLARE, rEnd = GL.strip.faceZ + 0.03, yEnd = 0.86;   // the glareshield end occupies x < 0.87 here
      for (let iv = 0; iv <= nv; iv++) { const v = iv / nv; const row = []; for (let iu = 0; iu <= nu; iu++) row.push(lpAt(s, v, iu / nu)); rows.push(row); }
      { const pp = [], ix = []; const m = nu + 1; rows.forEach((r) => r.forEach((q) => pp.push(q.x, q.y, q.z)));
        for (let i = 0; i < nv; i++) for (let k = 0; k < nu; k++) { const a = i * m + k, b = (i + 1) * m + k; ix.push(a, b, b + 1, a, b + 1, a + 1); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); g.setIndex(ix); g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, f); mesh.castShadow = mesh.receiveShadow = true; grp.add(mesh); }   // one smooth surface
      // grab handle in a shallow recess on the lower pillar, set on its surface
      const P0 = rows[24][16], Pu = rows[24][19], Pv = rows[28][16]; const tu = Pu.clone().sub(P0).normalize(), tv = Pv.clone().sub(P0).normalize();
      const nn = tu.clone().cross(tv).normalize(); if (nn.x * s > 0) nn.negate();
      const ax2 = tu.clone().add(tv).normalize(); const by = nn.clone().cross(ax2).normalize();
      const hg = new THREE.Group(); hg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ax2, by, nn)); hg.position.copy(P0);
      const hm = new THREE.MeshStandardMaterial({ color: 0x16191c, roughness: 0.5 });
      const hdl = rbox(0.11, 0.022, 0.018, 0.008, hm); hdl.position.z = 0.02; hg.add(hdl);
      for (const e of [-0.045, 0.045]) { const st = rbox(0.016, 0.018, 0.03, 0.004, hm); st.position.set(e, 0, 0.004); hg.add(st); }
      grp.add(hg); }
    // ridge along the inner face, an eyeball outlet and the window latch fitting
    { const fn = Ri[6].clone().sub(Li[6]).cross(Li[7].clone().sub(Li[6])).normalize(); if (fn.x * s > 0) fn.negate();
      // reading-light control set into the post: recessed rounded panel, knurled knob, sensor, ON/OFF switch
      { const up = Li[8].clone().lerp(Ri[8], 0.5).sub(Li[4].clone().lerp(Ri[4], 0.5)).normalize(); const xa = up.clone().cross(fn).normalize();
        const lp = new THREE.Group(); lp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, up, fn)); lp.position.copy(Li[6].clone().lerp(Ri[6], 0.5)).add(fn.clone().multiplyScalar(0.001)); grp.add(lp);
        const dk = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.5 });
        const rim = rbox(0.05, 0.15, 0.004, 0.012, new THREE.MeshStandardMaterial({ color: 0x4f5f69, roughness: 0.55 })); rim.position.z = 0.001; lp.add(rim);
        const pnl = rbox(0.04, 0.14, 0.003, 0.009, postSide); pnl.position.z = 0.0028; lp.add(pnl);
        const kb = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.0095, 0.012, 24).rotateX(Math.PI / 2), dk); kb.position.set(0, 0.04, 0.009); kb.castShadow = true; lp.add(kb);
        for (let i = 0; i < 16; i++) { const an = (i / 16) * Math.PI * 2; const r = rbox(0.0016, 0.0024, 0.012, 0.0005, dk); r.position.set(Math.cos(an) * 0.0095, 0.04 + Math.sin(an) * 0.0095, 0.009); r.rotation.z = an; lp.add(r); }
        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0006, 6, 24, 0.9), new THREE.MeshBasicMaterial({ color: 0xe8ecef })); arc.position.set(0, 0.04, 0.0044); arc.rotation.z = 1.1; lp.add(arc);
        const sens = new THREE.Mesh(new THREE.CircleGeometry(0.003, 16), dk); sens.position.set(0, 0.012, 0.0045); lp.add(sens);
        const sw = rbox(0.009, 0.018, 0.005, 0.0015, dk); sw.position.set(0, -0.022, 0.0055); lp.add(sw);
        const on = A_LBL('ON', 0.004); on.position.set(0, -0.009, 0.0047); lp.add(on); const off = A_LBL('OFF', 0.004); off.position.set(0, -0.035, 0.0047); lp.add(off); }
      const go = gasper(M); go.position.copy(Li[9].clone().lerp(Ri[9], 0.5)).add(fn.clone().multiplyScalar(0.004)); go.lookAt(go.position.clone().add(fn)); grp.add(go);
      const lk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 20), new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.5 })); lk.position.copy(Li[4].clone().lerp(Ri[4], 0.5)).add(fn.clone().multiplyScalar(0.005)); lk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fn); grp.add(lk); }
    // sill skirt under the pane's lower edge, down to the shell
    const P = [], Q = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; const e = A.clone().lerp(Dp, t); P.push(lift(e, 0.005)); Q.push(onHull(s, e.z, 0.86, 0.005)); }
    grp.add(stripMesh(P, Q, M.glare));
  }
  // centre post
  { const up = new THREE.Vector3(0, -0.7, 0.7).normalize(); const p0 = new THREE.Vector3(0, WS.innerBottom[1] - 0.01, WS.innerBottom[2] + 0.004), p1 = new THREE.Vector3(0, WS.innerTop[1] + 0.02, WS.innerTop[2] + 0.012);
    const P = []; for (let i = 0; i <= 14; i++) P.push(p0.clone().lerp(p1, i / 14)); const X = new THREE.Vector3(1, 0, 0);
    loft(P, P.map(() => X), P.map(() => up), [[-0.036, -0.004], [-0.036, 0.01], [-0.027, 0.012], [-0.025, 0.026], [-0.018, 0.028], [-0.016, 0.044], [0.016, 0.044], [0.018, 0.028], [0.025, 0.026], [0.027, 0.012], [0.036, 0.01], [0.036, -0.004]], (j) => (j === 5 ? f : j % 2 === 0 ? riser : f)); }

  // side window frames: one moulded frame round each opening, the same piece all the way round
  // (header, both posts, and the bottom running down onto the sill). Profile, out from the glass: a reveal
  // into the window, a rolled inner lip, a flat face, a raised outer bead, then down onto the lining.
  const wf = addGrain(new THREE.MeshStandardMaterial({ color: 0x7d919b, roughness: 0.62, side: THREE.DoubleSide }), 'paint');
  const frameRing = (poly, s, W, zClamp) => {
    const pts = []; const step = 0.015; const skip = poly === D.SIDE_WINDOWS.w2 ? poly.length - 1 : -1;
    for (let i = 0; i < poly.length; i++) {
      if (i === skip) continue;
      const [z0, y0] = poly[i], [z1, y1] = poly[(i + 1) % poly.length]; const n = Math.max(1, Math.ceil(Math.hypot(z1 - z0, y1 - y0) / step));
      for (let k = 0; k < n; k++) pts.push([z0 + (z1 - z0) * k / n, y0 + (y1 - y0) * k / n]);
    }
    pts.push(skip >= 0 ? poly[skip] : pts[0]);
    const cz = poly.reduce((a2, p) => a2 + p[0], 0) / poly.length, cy = poly.reduce((a2, p) => a2 + p[1], 0) / poly.length;
    const PROF = [[-0.01, 0.002], [-0.01, 0.0065], [0.003, 0.008], [0.005, 0.03], [0.02, 0.033], [0.023, 0.047], [W * 0.45, 0.049], [W * 0.45 + 0.004, 0.064], [W - 0.014, 0.066], [W - 0.005, 0.058], [W, 0.04], [W + 0.01, 0.004]];
    const rings = PROF.map(() => []);
    let pi = 0;
    for (const [z, y] of pts) {
      const dz = z - cz, dy = y - cy, l = Math.hypot(dz, dy), uz = dz / l, uy = dy / l;
      const gT = skip >= 0 ? 0.1 + 0.9 * THREE.MathUtils.smoothstep(pi++, 0, 16) : 1;   // the front end eases out of the pillar
      let lim = W + 0.006; while (lim > 0.012 && shellCell(s * hullHW(z + uz * lim, y + uy * lim), y + uy * lim, z + uz * lim) === 'open') lim *= 0.8;
      PROF.forEach(([o, d], k) => {
        let oo = Math.min(o, lim), zz = z + uz * oo, yy = y + uy * oo, dd = d * gT;
        let clamped = false;
        if (zClamp && (zClamp[1] > 0 ? zz > zClamp[0] : zz < zClamp[0])) { zz = zClamp[0]; clamped = true; }
        if (yy < 0.802) { yy = 0.802; clamped = true; }   // the bottom runs down onto the sill
        if (clamped && k >= PROF.length - 3) dd = 0.064;  // a merged edge stays at face level
        rings[k].push(onHull(s, zz, yy, dd));
      });
    }
    const wfr = addGrain(new THREE.MeshStandardMaterial({ color: 0x6b7e88, roughness: 0.62, side: THREE.DoubleSide }), 'paint');
    for (let k = 0; k < rings.length - 1; k++) { const m = stripMesh(rings[k], rings[k + 1], k <= 1 ? metal : (k === 2 || k === 4 || k === 6) ? wfr : wf); m.castShadow = m.receiveShadow = true; grp.add(m); }
    for (let i = 2; i < pts.length - 2; i += 4) { const [z, y] = pts[i]; const dz = z - cz, dy = y - cy, l = Math.hypot(dz, dy); screw(onHull(s, z - (dz / l) * 0.004, y - (dy / l) * 0.004, 0.0078)); }
  };
  for (const s of [-1, 1]) {
    frameRing(D.SIDE_WINDOWS.w2, s, 0.12, [1.02, 1]); frameRing(D.SIDE_WINDOWS.w3, s, 0.11, [1.02, -1]);
    // air outlet slot in the header above the sliding window, and the oval fitting on the aft post
    const blk = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.5 });
    grp.add(onShell(rbox(0.13, 0.011, 0.006, 0.005, blk), s, 0.8, 1.462, [1, 0], 0.066));
    const ov = rbox(0.05, 0.1, 0.01, 0.024, blk); grp.add(onShell(ov, s, 1.02, 1.12, [0, 1], 0.065));
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.004, 16), new THREE.MeshStandardMaterial({ color: 0x050505 })); dot.position.z = 0.0052; ov.add(dot);
  }
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
    // integrated in the panel: a flush dark surround with a shallow recess; only the glass shows
    const b = rbox(D.DU.bezel, D.DU.bezel, 0.005, 0.004, M.frame); b.position.set(x, y, 0.0); frame.add(b);
    const sur = rbox(D.DU.screen + 0.014, D.DU.screen + 0.014, 0.003, 0.003, M.bezel); sur.position.set(x, y, 0.0012); frame.add(sur);
    if (name === 'EWD' || name === 'SD') {   // the shade ledge across the top of each ECAM unit
      const hood = rbox(D.DU.bezel + 0.014, 0.017, 0.024, 0.004, M.frame); hood.position.set(x, y + D.DU.bezel / 2 - 0.004, 0.012); frame.add(hood);
      const lip = rbox(D.DU.bezel + 0.014, 0.004, 0.026, 0.0015, M.frame); lip.position.set(x, y + D.DU.bezel / 2 - 0.013, 0.012); frame.add(lip); }
    const well = new THREE.Mesh(new THREE.PlaneGeometry(D.DU.screen + 0.008, D.DU.screen + 0.008), new THREE.MeshBasicMaterial({ color: 0x050607 })); well.position.set(x, y, 0.0028); frame.add(well);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(D.DU.screen, D.DU.screen), M.screen.clone());
    scr.position.set(x, y, 0.0031); scr.name = name; frame.add(scr);
    refs.screens[name] = scr;
    addScrews(frame, corners(x, y, D.DU.bezel, D.DU.bezel, 0.0022, 0.009), M);
    // the brightness knob in the bezel corner
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 20), M.rubber);
    k.rotation.x = Math.PI / 2; k.scale.set(0.7, 0.4, 0.7); k.position.set(x + D.DU.bezel / 2 - 0.012, y - D.DU.bezel / 2 + 0.012, 0.004); frame.add(k);
  }
  // measured layout of the centre columns and outboard panels (panel-local, y along the face)
  const Y = D.PANEL_Y; const on = (o, x, y, z = 0.001) => { o.position.set(x, Y(y), z); frame.add(o); return o; };
  // centre columns, laid out from the photo of F-WWIY's centre panel
  const A = refs.atlas;
  on(MP.placard(['A/C 5962 F-WWIY', 'FAN A'], 0.094, 0.029), -0.181, 0.81, 0.0);
  on(MP.placard(['SELCAL PROV.', 'AJ-DM'], 0.069, 0.029), -0.216, 0.77, 0.0);
  on(MP.limitPlacard(), -0.149, 0.767, 0.0);
  const st = MP.isis(M, A); on(st, -0.147, 0.694, 0.0); refs.screens.ISIS = st.userData.screen;
  on(MP.blankPocket(M), -0.15, 0.598, 0.0);
  on(MP.terrPanel(M, A, -1), -0.223, 0.641, 0.0); on(MP.terrPanel(M, A, 1, 0.036, 0.046), 0.219, 0.698, 0.0);
  refs.dcdu = []; for (const x of [-0.183, 0.178]) { const u = MP.dcduUnit(M, A); on(u, x, 0.499, 0.0); refs.dcdu.push(u); }
  on(MP.gearBrakePlate(M, A), 0.177, 0.779, 0.0);
  { const clk = MP.clock(M, A); on(clk, 0.153, 0.691, 0.0); refs.clock = clk; }
  on(MP.gearLeverPanel(M, A), 0.145, 0.596, 0.0);
  { const lever = MP.gearLever(M); on(lever, 0.1354, 0.618, 0.002); refs.gearLever = lever; }
  on(MP.brakeIndicator(M, A), 0.208, 0.572, 0.0);
  // outboard lighting / loudspeaker panels
  on(MP.lightingPanel(M, refs.atlas, -1), -0.737, 0.75, 0.0); on(MP.lightingPanel(M, refs.atlas, 1), 0.737, 0.75, 0.0);
  // the lip under the PFD/ND pairs
  for (const s of [-1, 1]) { const lip = rbox(0.53, 0.035, 0.03, 0.006, M.panel); on(lip, s * 0.525, 0.62, 0.012); }
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 16).rotateZ(Math.PI / 2), M.metal); on(rail, s * 0.475, 0.598, 0.03);
    const slot = rbox(0.44, 0.016, 0.01, 0.004, M.panelDark); on(slot, s * 0.475, 0.598, 0.018);
    for (const [dx, w] of [[-0.16, 0.11], [0, 0.17], [0.16, 0.11]]) { const b = rbox(w, 0.032, 0.07, 0.008, dx ? M.panel : M.panelDark); on(b, s * 0.475 + dx, 0.552, 0.04); }
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
  const ssO = (ax) => THREE.MathUtils.smoothstep(ax, 0.258, 0.29);
  const zr = (ax = 0) => G.strip.faceZ + 0.008 + 0.007 * ssO(ax);   // the cap overhangs the panel strip by a few millimetres all the way across
  const drop = (ax) => (ax < 0.268 ? 0 : ax < 0.284 ? 0.1 * (ax - 0.268) ** 2 / 0.032 : 0.1 * (ax - 0.276));   // outer sections bend down at the EFIS joint toward the posts
  const yF = (ax) => 0.905 + (ax / W.outerBottom[0]) * 0.03 - drop(ax);                 // top at the glass, following the pane's lower edge
  const yT = (t, ax) => {                                                      // rises to the crest, rolls over to the rear face
    const crest = G.strip.y + G.strip.h / 2 + 0.03 - drop(ax);   // thin cap, its lip just clears the top of the strip
    const r = yF(ax) + (crest - yF(ax)) * Math.sin(Math.min(t / 0.8, 1) * Math.PI / 2);
    return t > 0.8 ? r - (0.022 + 0.01 * ssO(ax)) * ((t - 0.8) / 0.2) ** 2 : r;
  };
  const nx = 70, nt = 16; const top = [], rear = [], under = [];
  for (let i = 0; i <= nx; i++) {
    const x = -xEnd + (2 * xEnd * i) / nx, ax = Math.abs(x); const f0 = zf(ax), r0 = Math.max(zr(ax), f0 + 0.015);
    const row = []; for (let k = 0; k <= nt; k++) { const tt = k / nt; row.push(new THREE.Vector3(x, yT(tt, ax), f0 + (r0 - f0) * tt)); }
    top.push(row);
    const yb = Math.min(G.underY, G.strip.y - drop(ax) - G.strip.h / 2 - 0.004);
    const zb = G.strip.faceZ - 0.05;   // behind the panel housing
    rear.push([row[nt], new THREE.Vector3(x, row[nt].y, zb), new THREE.Vector3(x, yb, zb)]);
    under.push([new THREE.Vector3(x, yb, zb), new THREE.Vector3(x, yb, f0)]);
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
  const S = G.strip; const half = S.half;
  const th = Math.atan(0.1); const cw = 0.27;
  const hc = rbox(cw * 2, S.h + 0.006, 0.05, 0.008, new THREE.MeshStandardMaterial({ color: 0x44535c, roughness: 0.6 }));   // FCU/EFIS housing: a shade darker, so the panels still read as separate
  hc.position.set(0, S.y, S.faceZ - 0.023); grp.add(hc);
  // outboard housings: one moulded piece each side, flush with the black block, its face easing down
  // the bend and narrowing smoothly toward the window post; rounded top and bottom edges roll back
  const zF = S.faceZ + 0.002, RAD = 0.009;
  const hgt = (ax) => S.h + 0.004 - THREE.MathUtils.smoothstep(ax, 0.262, 0.282) * 0.012;
  const BX = 0.6;   // the outboard end block starts here
  const yTop = (ax) => S.y + S.h / 2 + 0.002 - drop(ax), yBot = (ax) => yTop(ax) - hgt(ax), yMid = (ax) => yTop(ax) - hgt(ax) / 2;
  const prof = (ax) => { const yt = yTop(ax), yb = yBot(ax); const p = [[zF - 0.04, yt]];
    for (let k = 0; k <= 5; k++) { const a = (Math.PI / 2) * (1 - k / 5); p.push([zF - RAD + Math.cos(a) * RAD, yt - RAD + Math.sin(a) * RAD]); }
    for (let k = 0; k <= 5; k++) { const a = -(Math.PI / 2) * (k / 5); p.push([zF - RAD + Math.cos(a) * RAD, yb + RAD + Math.sin(a) * RAD]); }
    p.push([zF - 0.05, yb]); return p; };
  for (const s of [-1, 1]) {
    const rows = []; const n = 70;
    for (let i = 0; i <= n; i++) { const ax = cw + ((xEnd - cw) * i) / n; rows.push(prof(ax).map(([z, y]) => new THREE.Vector3(s * ax, y, z - (ax > BX ? 0.012 : 0)))); }
    const mesh = grid(rows, M.fcu); const g = mesh.geometry; const nz = g.attributes.normal.getZ(7 + 14 * 35);   // a face vertex mid-way along
    if (nz < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const tmp = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = tmp; } g.index.needsUpdate = true; g.computeVertexNormals(); }
    grp.add(mesh);
    // closing cap at the outboard end
    const pe = prof(xEnd); const cs = new THREE.Shape(pe.map(([z, y]) => new THREE.Vector2(z, y)));
    const cg = new THREE.ShapeGeometry(cs); cg.rotateY(-Math.PI / 2); const cm = new THREE.Mesh(cg, M.fcu); cm.material = M.fcu; cm.position.x = s * xEnd; cm.scale.x = s; grp.add(cm);
  }
  const seamMat = new THREE.MeshBasicMaterial({ color: 0x0b0d0f });
  const flush = (p, x, w, h) => {   // panel set into the housing face, with a fine dark seam round it
    const ax = Math.abs(x); p.position.set(x, yMid(ax), zF + 0.0006); if (ax > cw) p.rotation.z = -Math.sign(x) * Math.atan(drop(ax + 0.001) * 1000 - drop(ax) * 1000);
    const o = new THREE.Shape(); o.moveTo(-w / 2 - 0.0014, -h / 2 - 0.0014); o.lineTo(w / 2 + 0.0014, -h / 2 - 0.0014); o.lineTo(w / 2 + 0.0014, h / 2 + 0.0014); o.lineTo(-w / 2 - 0.0014, h / 2 + 0.0014); o.closePath();
    const hl = new THREE.Path(); hl.moveTo(-w / 2, -h / 2); hl.lineTo(-w / 2, h / 2); hl.lineTo(w / 2, h / 2); hl.lineTo(w / 2, -h / 2); hl.closePath(); o.holes.push(hl);
    const seam = new THREE.Mesh(new THREE.ShapeGeometry(o), seamMat); seam.position.z = -0.0004; p.add(seam); grp.add(p); return p; };
  const place = (p, x) => { const ax = Math.abs(x); p.position.set(x, S.y - drop(ax), S.faceZ + 0.004); if (ax > cw) p.rotation.z = -Math.sign(x) * th; grp.add(p); return p; };
  refs.fcu = place(fcuPanel(M, A), G.fcu.x);
  refs.efis = [place(efisPanel(M, A, 1), -G.efis.x), place(efisPanel(M, A, 2), G.efis.x)];
  // one long panel each side from the EFIS joint to the outboard face: CHRONO / SIDE STICK PRIORITY,
  // MASTER WARN / CAUT | HUD | priority light; then the AUTO LAND light on the tapering face
  const PX0 = 0.279, PX1 = 0.595, PH = 0.066;
  refs.warn = [-1, 1].map((s) => { const p = glareSidePanel(M, A, s, PX0, PX1, th, PH); return flush(p, s * (PX0 + PX1) / 2, p.userData.size[0], PH); });
  const bez = new THREE.MeshStandardMaterial({ color: 0x3f4448, roughness: 0.4, metalness: 0.4 });
  const lensAt = (x, top) => { const ax = Math.abs(x); const L = new THREE.Group();
    const well = new THREE.Mesh(new THREE.PlaneGeometry(0.0235, 0.0235), seamMat); well.position.z = -0.0002; L.add(well);
    const b = rbox(0.0215, 0.0215, 0.003, 0.0008, bez); b.position.z = 0.0012; L.add(b);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.018), PED.korryLens(top, '#2a1512')); lens.position.z = 0.0029; L.add(lens);
    L.position.set(x, yMid(ax) + 0.002, zF + 0.0084); L.rotation.z = -Math.sign(x) * th; grp.add(L); return L; };
  // outboard end block: a separate moulding standing proud of the long panel, with a clear dark step
  // where they meet and a pointed outer end
  for (const s of [-1, 1]) {
    const L = (xEnd - 0.004 - BX) / Math.cos(th), H = hgt(BX) - 0.002, D = 0.05, bv = 0.004;
    const pts = [[0.003, -H / 2], [L - 0.034, -H / 2], [L, 0.006], [L - 0.014, H / 2], [0.003, H / 2]].map(([u, v]) => new THREE.Vector2(s * u, v));
    const bg = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: D, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 4, curveSegments: 4 });
    const blk = new THREE.Mesh(bg, M.fcu); blk.castShadow = blk.receiveShadow = true;
    const holder = new THREE.Group(); holder.position.set(s * BX, yMid(BX), zF + 0.0075 - D - bv); holder.rotation.z = -s * th; holder.add(blk); grp.add(holder);
    const step = new THREE.Mesh(new THREE.PlaneGeometry(0.005, H + 0.006), seamMat); step.position.set(s * (BX - 0.001), yMid(BX), zF + 0.0003); step.rotation.z = -s * th; grp.add(step);
  }
  refs.autoland = [lensAt(-0.735, 'AUTO LAND'), lensAt(0.735, 'AUTO LAND')];
  for (const s of [-1, 1]) {
    // end face of the glareshield: a smooth dark moulded connector. Its top is tucked under the end of the cap,
    // and its aft face sweeps down and back in one S-curve to the side console, edges rolled
    const ax = xEnd, zA = zf(ax) - 0.02, yb = 0.95, yLo = 0.735, xIn = 0.813, r = 0.014;
    const joint = new THREE.MeshStandardMaterial({ color: 0x1b1f23, roughness: 0.6, side: THREE.DoubleSide });
    const rows = []; const nv = 24;
    for (let iv = 0; iv <= nv; iv++) { const y = yb + (yLo - yb) * iv / nv; const zfp = LP_ZF(y) - 0.0015; const xo = Math.max(xIn + r + 0.004, hullHW(zfp, y) - 0.004);
      const row = [new THREE.Vector3(s * xo, y, zfp)];
      for (let k = 0; k <= 6; k++) { const t = (k / 6) * Math.PI / 2; row.push(new THREE.Vector3(s * (xIn + r - r * Math.sin(t)), y, zfp - r + r * Math.cos(t))); }
      row.push(new THREE.Vector3(s * xIn, y, zA)); rows.push(row); }
    for (let iv = 0; iv < nv; iv++) { const m = stripMesh(rows[iv], rows[iv + 1], joint); m.castShadow = m.receiveShadow = true; grp.add(m); }
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
    at(PED.floodLtPanel(M, A, s), s * 0.181, 0.632);
    at(s < 0 ? PED.wxPanel(M, A) : PED.atcPanel(M, A), s * 0.181, 0.705);
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
  const ceil = addGrain(new THREE.MeshStandardMaterial({ color: 0x7a8e98, roughness: 0.7, side: THREE.DoubleSide }), 'lining');   // one blue-grey with the panels
  const dark = new THREE.MeshStandardMaterial({ color: 0x1f2329, roughness: 0.55 });
  const edgeX = O.halfWidth + 0.035;
  // up-dip from overhead plane to its housing top (overhead plane normal)
  const n = R.clone().sub(F).normalize().cross(new THREE.Vector3(1, 0, 0)).normalize(); if (n.y < 0) n.negate();
  for (const s of [-1, 1]) {
    // side fairing: from the overhead edge, angled up and outboard into the ceiling, full length of the overhead
    // side ceiling as on the aircraft: from the overhead edge it arches up and outboard, then rounds down onto
    // the leather band above the side windows (a smooth barrel curve, 12 rows)
    const NR = 12; const rows = Array.from({ length: NR + 1 }, () => []);
    for (let i = 0; i <= 24; i++) {
      const p = P(i / 24); const a = new THREE.Vector3(s * (O.halfWidth + 0.03), p.y, p.z).add(n.clone().multiplyScalar(0.012));
      const yB = Math.min(crownAt(p.z) - 0.03, Math.max(1.5, a.y + 0.04)); const xB = Math.max(hullHW(p.z, yB) - 0.006, O.halfWidth + 0.12);
      const b = new THREE.Vector3(s * xB, yB, p.z);
      const c = new THREE.Vector3(s * (Math.abs(a.x) + (xB - Math.abs(a.x)) * 0.7), Math.min(crownAt(p.z) - 0.012, Math.max(a.y, yB) + 0.07), p.z);
      for (let k = 0; k <= NR; k++) { const u = k / NR; rows[k].push(a.clone().multiplyScalar((1 - u) ** 2).add(c.clone().multiplyScalar(2 * u * (1 - u))).add(b.clone().multiplyScalar(u * u))); }
    }
    for (let k = 0; k < NR; k++) grp.add(stripMesh(rows[k], rows[k + 1], ceil));
    { const WSd = D.WINDSHIELD; const rub = new THREE.MeshStandardMaterial({ color: 0x1b222c, roughness: 0.85, side: THREE.DoubleSide });
      const front = rows.map((r) => r[0]); const hdr = front.map((p) => { const ax = Math.min(Math.abs(p.x), WSd.outerTop[0] - 0.01);
        return new THREE.Vector3(Math.sign(p.x) * ax, WSd.innerTop[1] + (ax / WSd.outerTop[0]) * (WSd.outerTop[1] - WSd.innerTop[1]) + 0.035, wsTopZ(ax) + 0.03); });
      grp.add(stripMesh(hdr, front, rub)); }
    const A = rows[0], Mid = rows[NR / 2], B = rows[NR];
    // thin dark guard rail along the overhead edge, running its full length from the windshield header to the aft end
    { const dir = R.clone().sub(F).normalize(); const r0 = F.clone().add(dir.clone().multiplyScalar(0.01)), r1 = R.clone().sub(dir.clone().multiplyScalar(0.01));
      for (const r of [r0, r1]) { r.x = s * (O.halfWidth + 0.03); r.add(n.clone().multiplyScalar(-0.004)); }
      const rail = rbox(0.012, r0.distanceTo(r1), 0.014, 0.004, dark); rail.position.copy(r0).add(r1).multiplyScalar(0.5);
      rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), r1.clone().sub(r0).normalize()); rail.castShadow = true; grp.add(rail); }
    const seamM = new THREE.MeshStandardMaterial({ color: 0x3c4a53, roughness: 0.7 });
    for (const k of [8, 16]) { const sA = A[k].clone().lerp(Mid[k], 0.02), sB = B[k]; const pts = [A[k], Mid[k], B[k]];
      for (let j = 0; j < 2; j++) { const u = pts[j], v = pts[j + 1]; const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, u.distanceTo(v), 6), seamM); sm.position.copy(u).add(v).multiplyScalar(0.5); sm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().sub(u).normalize()); grp.add(sm); } }
    if (s > 0) { const dl = rbox(0.11, 0.3, 0.01, 0.012, new THREE.MeshStandardMaterial({ color: 0xe4e6e3, roughness: 0.4, emissive: 0x222222 })); const c = Mid[18].clone().lerp(B[18], 0.3); dl.position.copy(c); dl.lookAt(c.clone().add(new THREE.Vector3(-1, -1.2, 0))); grp.add(dl); }
    { const pl = rbox(0.09, 0.022, 0.003, 0.002, new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.5 })); const c = Mid[12].clone().lerp(B[12], 0.45); pl.position.copy(c); pl.lookAt(c.clone().add(new THREE.Vector3(-s, -1.2, 0))); grp.add(pl); }
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
  const housing = rbox(O.halfWidth * 2 + 0.06, len + 0.04, 0.09, 0.015, M.panel);
  housing.position.set(0, 0, -0.045 - 0.006); frame.add(housing);
  refs.overhead = frame;
  // real A320 system panels: three columns, aft at the top as read; they fill the forward
  // O.systemLen of the overhead, the aft remainder carries circuit breakers and maintenance items
  refs.overheadPanels = {};
  const sysTop = -len / 2 + O.systemLen;
  for (const { panel, x, yFromTop, key } of makeOverheadPanels(M, refs.atlas, O.systemLen)) {
    panel.position.set(x, sysTop - yFromTop, 0.0); frame.add(panel); refs.overheadPanels[key] = panel;
  }
  // forward of the system panels: blank fillers step the panel field forward in a V (centre deepest),
  // backed by the housing, and a dark rubber band closes the V from that edge to the windshield header
  { const rub = new THREE.MeshStandardMaterial({ color: 0x1b222c, roughness: 0.85, side: THREE.DoubleSide });
    const dOf = (ax) => (ax < 0.1475 ? 0.062 : 0.034);
    for (const [x, w, d] of [[0, 0.29, 0.062], [-0.235, 0.17, 0.034], [0.235, 0.17, 0.034]]) {
      const fp = buildPanel({ w, h: d, items: [], name: 'ovFill', bg: '#7d919b' }, M, refs.atlas); fp.position.set(x, -len / 2 - 0.003 - d / 2, 0); frame.add(fp);
      const hx = rbox(w + 0.006, d + 0.008, 0.09, 0.006, rub); hx.position.set(x, -len / 2 - d / 2 - 0.002, -0.051); frame.add(hx);
    }
    frame.updateMatrixWorld(true);
    const WS = D.WINDSHIELD; const hwB = O.halfWidth + 0.04;
    const xs = []; for (let i = 0; i <= 48; i++) xs.push(-hwB + (2 * hwB * i) / 48);
    for (const e of [-0.1475, 0.1475]) { xs.push(e - 0.0001, e + 0.0001); } xs.sort((p, q) => p - q);
    const Fa = [], Fb = [];
    for (const x of xs) { const ax = Math.abs(x);
      const hz = wsTopZ(ax) + 0.03, hy = WS.innerTop[1] + (ax / WS.outerTop[0]) * (WS.outerTop[1] - WS.innerTop[1]) + 0.035;
      Fa.push(frame.worldToLocal(new THREE.Vector3(x, hy, hz)));
      Fb.push(new THREE.Vector3(Math.max(-0.352, Math.min(0.352, x)), -len / 2 - dOf(ax) - 0.006, -0.004)); }
    const band = stripMesh(Fa, Fb, rub); band.receiveShadow = true; frame.add(band);
    // a rolled rubber edge along the stepped front of the panel field
    for (const [x, w, d] of [[0, 0.296, 0.062], [-0.235, 0.176, 0.034], [0.235, 0.176, 0.034]]) { const ed = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, w, 16).rotateZ(Math.PI / 2), rub); ed.position.set(x, -len / 2 - d - 0.006, -0.002); frame.add(ed); } }
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
  // panel floodlights under the glareshield
  const G = D.GLARE;
  for (const s of [-1, 1]) {
    const fl = rbox(0.17, 0.014, 0.03, 0.005, M.panelDark); fl.position.set(s * 0.52, G.underY - 0.008, G.strip.faceZ - 0.06); grp.add(fl);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.018), new THREE.MeshStandardMaterial({ color: 0x7c7466, roughness: 0.3, emissive: 0x000000 }));
    lens.rotation.x = Math.PI / 2; lens.position.set(s * 0.52, G.underY - 0.0155, G.strip.faceZ - 0.06); grp.add(lens);
  }
  // loudspeaker grilles on the outboard main panel
  const P = D.PANEL; const t = THREE.MathUtils.degToRad(P.tiltDeg);
  // outboard wings of the main panel: angled back from the panel edge to the side console, carrying the octagonal
  // loudspeaker and an air outlet, framed like the rest of the panel
  for (const s of [-1, 1]) {
    const yt = (y) => P.faceZ - (y - P.baseY) * Math.tan(t);
    const iT = new THREE.Vector3(s * P.halfWidth, 0.86, yt(0.86)), iB = new THREE.Vector3(s * P.halfWidth, D.CONSOLE.topY, yt(D.CONSOLE.topY));
    const oT = new THREE.Vector3(s * 0.96, 0.86, 0.27), oB = new THREE.Vector3(s * 0.96, D.CONSOLE.topY, 0.34);
    const xA = oT.clone().add(oB).sub(iT).sub(iB).normalize(), yA = iT.clone().add(oT).sub(iB).sub(oB).normalize();
    const zA = xA.clone().cross(yA).normalize(); if (zA.z < 0) zA.negate(); const yB = zA.clone().cross(xA).normalize();
    const wg = new THREE.Group(); wg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yB, zA)); wg.position.copy(iT).add(iB).add(oT).add(oB).multiplyScalar(0.25); grp.add(wg);
    const w = iT.clone().add(iB).distanceTo(oT.clone().add(oB)) / 2, h = 0.86 - D.CONSOLE.topY;
    const body = rbox(w + 0.02, h, 0.03, 0.012, M.panel); body.position.z = -0.016; wg.add(body);
    const fr = rbox(w - 0.03, h - 0.06, 0.004, 0.006, M.panelDark); fr.position.z = 0.0; wg.add(fr);
    const inner = rbox(w - 0.036, h - 0.066, 0.006, 0.006, M.panel); inner.position.z = 0.001; wg.add(inner);
    const sp = speakerGrille(0.036); sp.position.set(0, -0.06, 0.006); wg.add(sp);
    const go = gasper(M); go.position.set(0, 0.11, 0.006); wg.add(go);
  }
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
    // side moulding under the side windows (as on the aircraft): a wide sill shelf carrying the sliding-window rail,
    // a large face sloping down and outboard onto the side console with a recessed pocket and a long slot, closed at the front
    {
      const mould = addGrain(new THREE.MeshStandardMaterial({ color: 0x8b9ca6, roughness: 0.62, side: THREE.DoubleSide }), 'paint');
      const darkM = new THREE.MeshStandardMaterial({ color: 0x20252b, roughness: 0.7, side: THREE.DoubleSide });
      const z0 = 0.24, z1 = 1.56, N = 44, yB = D.CONSOLE.topY + 0.004;
      const W = [], Bt = [], Si = [], So = [];
      for (let i = 0; i <= N; i++) {
        const z = z0 + (z1 - z0) * i / N; const yS = 0.8;   // one level shelf, as on the aircraft
        const xW = hullHW(z, yB) - 0.005, xI = hullHW(z, yS) - 0.19;
        W.push(new THREE.Vector3(s * xW, yB, z));                              // foot of the face, at the wall on the console top
        Bt.push(new THREE.Vector3(s * Math.min(xW - 0.12, hullHW(z, yB) - 0.12), yB, z));   // front edge of the foot
        Si.push(new THREE.Vector3(s * xI, yS - 0.06, z));                     // bottom of the shelf nose (top of the sloping face)
        So.push(new THREE.Vector3(s * (hullHW(z, yS) - 0.004), yS, z));        // shelf meets the wall under the window
      }
      // thick rounded nose: bulges inboard, then the shelf top rises gently to the wall
      const Sm = Si.map((p) => new THREE.Vector3(p.x - s * 0.012, p.y + 0.03, p.z));
      const SiT = Si.map((p) => new THREE.Vector3(p.x + s * 0.004, p.y + 0.054, p.z));
      grp.add(stripMesh(Bt, Si, mould), stripMesh(Si, Sm, mould), stripMesh(Sm, SiT, mould), stripMesh(SiT, So, mould), stripMesh(W, Bt, mould));
      // front end cap
      { const g = new THREE.BufferGeometry().setFromPoints([W[0], Bt[0], Si[0], W[0], Si[0], So[0], Si[0], Sm[0], So[0], Sm[0], SiT[0], So[0]]); g.computeVertexNormals(); grp.add(new THREE.Mesh(g, mould)); }
      // recessed pocket on the sloping face, aft of the sidestick
      const face = (i, u) => Bt[i].clone().lerp(Si[i], u);
      const nI = (i) => { const a = Si[i].clone().sub(Bt[i]), b = Bt[Math.min(i + 1, N)].clone().sub(Bt[i]); const n = a.cross(b).normalize(); return n.x * s > 0 ? n.negate() : n; };
      const i0 = Math.round(N * (0.86 - z0) / (z1 - z0)), i1 = Math.round(N * (1.16 - z0) / (z1 - z0));
      const PT = [], PB = []; for (let i = i0; i <= i1; i++) { const k = (i - i0) / (i1 - i0); const off = nI(i).multiplyScalar(-0.004); PT.push(face(i, 0.82 - 0.12 * k).add(off)); PB.push(face(i, 0.25 + 0.1 * k).add(off)); }
      grp.add(stripMesh(PB, PT, darkM));
      // long slot near the top of the face, over the sidestick
      const j0 = Math.round(N * (0.36 - z0) / (z1 - z0)), j1 = Math.round(N * (0.78 - z0) / (z1 - z0));
      const ST = [], SB = []; for (let i = j0; i <= j1; i++) { const off = nI(i).multiplyScalar(-0.003); ST.push(face(i, 0.8).add(off)); SB.push(face(i, 0.72).add(off)); }
      grp.add(stripMesh(SB, ST, darkM));
      // sliding-window rail on the shelf, and the window handle
      const r0 = So[Math.round(N * (0.3 - z0) / (z1 - z0))].clone(), r1 = So[Math.round(N * (1.0 - z0) / (z1 - z0))].clone();
      for (const r of [r0, r1]) { r.x -= s * 0.05; r.y += 0.012; }
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, r0.distanceTo(r1), 16), new THREE.MeshStandardMaterial({ color: 0xa08a52, roughness: 0.35, metalness: 0.7 }));
      rail.position.copy(r0).add(r1).multiplyScalar(0.5); rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), r1.clone().sub(r0).normalize()); grp.add(rail);
      const hd = rbox(0.03, 0.022, 0.1, 0.008, mould); hd.position.copy(r0.clone().lerp(r1, 0.55)).add(new THREE.Vector3(-s * 0.02, 0.012, 0)); grp.add(hd);
    }
    // map / document pocket and flashlight on the sidewall beside the seat
    const pocket = new THREE.Group(); const pk = rbox(0.3, 0.16, 0.05, 0.01, M.panelDark); pk.position.z = 0.025; pocket.add(pk);
    const lip = rbox(0.3, 0.02, 0.06, 0.006, M.module); lip.position.set(0, 0.075, 0.03); pocket.add(lip); grp.add(onShell(pocket, s, 1.0, 0.68, [1, 0], 0.0));
    const fls = flashlight(); grp.add(onShell(fls, s, 1.38, 0.62, [0, 1], 0.03));
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
