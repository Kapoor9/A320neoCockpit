// Swaps in the Blender-modelled parts (tools/blender/build_parts.py) and adds the footwell
// structure: sidesticks, thrust lever handles, rudder pedals, console armrests, knee lips, footrests.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PARTS_B64 } from '../../public/models/a320_parts.glb.js';
import * as D from './dims.js';

export async function addDetail(scene, refs) {
  const bin = Uint8Array.from(atob(PARTS_B64), (c) => c.charCodeAt(0)).buffer;
  const gltf = await new GLTFLoader().parseAsync(bin, '');
  gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const part = (name, mirror = false) => { const p = gltf.scene.getObjectByName(name).clone(true); p.position.set(0, 0, 0); if (mirror) p.scale.x = -1; return p; };
  const root = refs.root || scene;

  // sidesticks (the F/O's is the mirror image: takeover button inboard on both)
  for (const [key, s] of [['sidestickCpt', -1], ['sidestickFo', 1]]) {
    const g = refs[key]; if (!g) continue;
    g.clear(); g.add(part('Sidestick', s > 0));
  }
  // thrust lever handles: keep the arms, replace the grips (A/THR disconnect outboard)
  if (refs.thrust) refs.thrust.levers.forEach((pivot, i) => {
    const arm = pivot.children[0]; pivot.clear(); pivot.add(arm);
    const s = i === 0 ? -1 : 1; const h = part('ThrustHandle', s > 0);
    h.rotation.x = Math.PI / 2; h.position.set(s * 0.017, 0, 0.125); pivot.add(h);
  });

  const grp = new THREE.Group(); grp.name = 'footwells';
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c3237, roughness: 0.7 });
  const mat = new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.95 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8c9194, roughness: 0.35, metalness: 0.8 });
  for (const s of [-1, 1]) {
    // rudder pedals in the footwell
    for (const p of [-1, 1]) { const ped = part('RudderPedal'); ped.position.set(s * D.SEAT_X + p * 0.1, 0.3, 0.02); grp.add(ped); }
    // knee lip under the main panel and the footwell side walls
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.09, 0.05), dark); lip.position.set(s * 0.53, 0.405, 0.13); grp.add(lip);
    for (const x of [0.27, 0.8]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.4), dark); wall.position.set(s * x, 0.2, -0.05); grp.add(wall); }
    const pedBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), dark); pedBox.position.set(s * 0.53, 0.37, -0.13); grp.add(pedBox);
    // footrest bar and the rubber floor mat
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 16).rotateZ(Math.PI / 2), metal); bar.position.set(s * 0.53, 0.06, 0.2); grp.add(bar);
    const fm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.006, 0.55), mat); fm.position.set(s * 0.53, 0.004, 0.2); grp.add(fm);
    // padded armrest on the side console, outboard of the sidestick
    const ar = part('Armrest'); ar.position.set(s * 0.97, D.CONSOLE.topY, 0.62); grp.add(ar);
  }
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.add(grp);
}
