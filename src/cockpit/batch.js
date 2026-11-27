// Static batching: every mesh that never moves, never changes material and is not looked up by name is merged
// with the others that share its material into one mesh (world transforms baked in). Same pixels, far fewer
// draw calls - the cockpit is built from thousands of small parts. Run once, after everything is built and
// every operable control is registered, and before anything toggles visibility (light pools).
import * as THREE from 'three';

export function batchStatic(scene, { keep = [] } = {}) {
  scene.updateMatrixWorld(true);
  // never merge: anything under an operable control (it animates), named meshes (looked up later), meshes with
  // userData (flags such as isSky / nightOnly), screens, and per-object transparent parts that need sorting
  const keepSet = new Set();
  for (const o of keep) if (o) o.traverse((d) => keepSet.add(d));
  const groups = new Map(); let before = 0;
  scene.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || !m.visible) return; before++;
    if (keepSet.has(m) || m.name || Object.keys(m.userData).length || Array.isArray(m.material)) return;
    for (let p = m.parent; p; p = p.parent) if (!p.visible || p.userData.control || p.userData.isSky) return;
    const mat = m.material; if (mat.transparent && !(mat.alphaTest > 0)) return;
    const g = m.geometry; if (!g.attributes.position || g.morphAttributes.position || badGeo(g)) return;   // sub-ranges (box / cylinder sides) do not matter with one material
    const sig = Object.keys(g.attributes).sort().map((k) => k + g.attributes[k].itemSize).join(',') + '|' + (g.index ? 'i' : 'n') + '|' + m.castShadow + m.receiveShadow + '|' + m.renderOrder;
    const key = mat.uuid + '|' + sig; let L = groups.get(key); if (!L) groups.set(key, (L = { mat, list: [], cast: m.castShadow, recv: m.receiveShadow, order: m.renderOrder }));
    L.list.push(m);
  });
  let merged = 0, made = 0;
  for (const L of groups.values()) {
    if (L.list.length < 2) continue;
    const geos = L.list.map((m) => { const g = m.geometry.clone(); g.clearGroups(); g.applyMatrix4(m.matrixWorld); return g; });
    const out = mergeGeos(geos); if (!out) continue;
    const mesh = new THREE.Mesh(out, L.mat); mesh.castShadow = L.cast; mesh.receiveShadow = L.recv; mesh.renderOrder = L.order; mesh.matrixAutoUpdate = false;
    scene.add(mesh); made++;
    for (const m of L.list) { m.parent.remove(m); merged++; }
    geos.forEach((g) => g.dispose());
  }
  return { before, merged, made };
}

// concatenate geometries with identical attribute layouts (all indexed or all not)
function mergeGeos(geos) {
  const names = Object.keys(geos[0].attributes); const indexed = !!geos[0].index;
  let vCount = 0, iCount = 0; for (const g of geos) { vCount += g.attributes.position.count; if (indexed) iCount += g.index.count; }
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const sz = geos[0].attributes[n].itemSize; const arr = new Float32Array(vCount * sz); let off = 0;
    for (const g of geos) { const a = g.attributes[n]; if (!a || a.itemSize !== sz) return null; for (let i = 0; i < a.count; i++) for (let k = 0; k < sz; k++) arr[(off + i) * sz + k] = a.getComponent(i, k); off += a.count; }
    out.setAttribute(n, new THREE.BufferAttribute(arr, sz, geos[0].attributes[n].normalized));
  }
  if (indexed) {
    const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount); let io = 0, vo = 0;
    for (const g of geos) { const ia = g.index; for (let i = 0; i < ia.count; i++) idx[io++] = ia.getX(i) + vo; vo += g.attributes.position.count; }
    out.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

// Batching inside the operable controls: the pieces of each rigid moving part (a knob, a guard lid, a toggle
// bat, a lever) that share a material are merged into one mesh in that part's own space, so it still moves as
// one. A rigid part is a control's object or any part a control animates (found through its userData).
export function batchControls(controlObjs) {
  const anchors = new Set(), keepMesh = new Set();
  for (const root of controlObjs) {
    if (!root) continue; anchors.add(root);
    root.traverse((d) => { for (const v of Object.values(d.userData)) { if (v && v.isObject3D) { anchors.add(v); if (v.isMesh) keepMesh.add(v); } else if (Array.isArray(v)) for (const e of v) if (e && e.isObject3D) { anchors.add(e); if (e.isMesh) keepMesh.add(e); } } });
  }
  const groups = new Map(); let merged = 0, made = 0;
  for (const root of controlObjs) {
    if (!root) continue;
    root.traverse((m) => {
      if (!m.isMesh || anchors.has(m) || keepMesh.has(m) || m.name || Object.keys(m.userData).length || Array.isArray(m.material) || !m.visible) return;
      const mat = m.material; if (mat.transparent && !(mat.alphaTest > 0)) return;
      let a = m.parent; while (a && !anchors.has(a)) a = a.parent; if (!a) return;
      const g = m.geometry; if (!g.attributes.position || g.morphAttributes.position || badGeo(g)) return;   // sub-ranges (box / cylinder sides) do not matter with one material
      const sig = Object.keys(g.attributes).sort().map((k) => k + g.attributes[k].itemSize).join(',') + '|' + (g.index ? 'i' : 'n') + '|' + m.castShadow + m.receiveShadow + '|' + m.renderOrder;
      const key = a.uuid + '|' + mat.uuid + '|' + sig; let L = groups.get(key); if (!L) groups.set(key, (L = { a, mat, list: [], cast: m.castShadow, recv: m.receiveShadow, order: m.renderOrder }));
      L.list.push(m);
    });
  }
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  for (const L of groups.values()) {
    if (L.list.length < 2) continue;
    L.a.updateMatrixWorld(true); inv.copy(L.a.matrixWorld).invert();
    const geos = L.list.map((m) => { const g = m.geometry.clone(); g.clearGroups(); rel.multiplyMatrices(inv, m.matrixWorld); g.applyMatrix4(rel); return g; });
    const out = mergeGeos(geos); if (!out) continue;
    const mesh = new THREE.Mesh(out, L.mat); mesh.castShadow = L.cast; mesh.receiveShadow = L.recv; mesh.renderOrder = L.order;
    L.a.add(mesh); made++;
    for (const m of L.list) { m.parent.remove(m); merged++; }
    geos.forEach((g) => g.dispose());
  }
  return { merged, made };
}

// a part whose vertices hold invalid numbers stays on its own (merging it would spoil the whole batch)
const BAD = new WeakMap();
function badGeo(g) {
  if (BAD.has(g)) return BAD.get(g); let bad = false;
  for (const n of ['position', 'normal', 'uv']) { const a = g.attributes[n]; if (!a) continue; for (let i = 0; i < a.count && !bad; i++) for (let k = 0; k < a.itemSize; k++) if (!Number.isFinite(a.getComponent(i, k))) { bad = true; break; } }
  BAD.set(g, bad); return bad;
}
