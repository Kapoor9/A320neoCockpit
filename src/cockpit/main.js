import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildCockpit, makeSky, SUN_DIR } from './build.js';
import { CockpitCamera, VIEWS } from './camera.js';

// Phones and small screens get a lighter setup; laptops get soft contact shadows (GTAO).
const LITE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, LITE ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

// Reflections come from the same sky the crew sees through the windows
const envScene = new THREE.Scene(); envScene.add(makeSky(10));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x6d706e }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -1.2; envScene.add(ground);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(envScene, 0.02).texture;
scene.environmentIntensity = 0.55;

// Sunlight through the windshield, sky fill, and a faint warm dome light
const sun = new THREE.DirectionalLight(0xfff1dd, 3.0);
sun.position.copy(SUN_DIR).multiplyScalar(12).add(new THREE.Vector3(0, 0.8, 0.5));
sun.target.position.set(0, 0.8, 0.5);
sun.castShadow = true; sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -2.0, right: 2.0, top: 2.0, bottom: -2.0, near: 2, far: 30 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.015; sun.shadow.radius = 3;
scene.add(sun, sun.target);
// ground colour = light bouncing back up off the panels, floor and seats onto the overhead
scene.add(new THREE.HemisphereLight(0xcad8e6, 0x8c877f, 0.7));
const dome = new THREE.PointLight(0xfff0da, 0.45, 3.2, 2); dome.position.set(0, 1.85, 1.3); scene.add(dome);
// soft upward bounce from the sunlit pedestal and panels, so the overhead is never pitch black
const bounce = new THREE.PointLight(0xe9e3d8, 0.55, 2.6, 2); bounce.position.set(0, 0.75, 0.75); scene.add(bounce);

const camera = new THREE.PerspectiveCamera(68, 1, 0.01, 1500);
const { refs } = buildCockpit(scene);
const controls = new CockpitCamera(camera, canvas, scene);

// Post-processing: multisampled render + ambient occlusion + tone mapping
let composer = null, gtao = null;
if (!LITE) {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.updateGtaoMaterial({ radius: 0.09, distanceExponent: 1.6, thickness: 0.6, scale: 1.0, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  gtao.blendIntensity = 0.85;
  composer.addPass(gtao);
  composer.addPass(new OutputPass());
}

// view buttons
const bar = document.getElementById('views');
for (const [key, v] of Object.entries(VIEWS)) {
  const b = document.createElement('button'); b.textContent = v.label; b.dataset.view = key;
  b.onclick = () => { controls.goTo(key); mark(key); };
  bar.appendChild(b);
}
const mark = (key) => bar.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.view === key));
mark('cpt');

let dirty = 3;
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  dirty = 3;
}
window.addEventListener('resize', resize); resize();

// Render only when something changes: saves battery on laptops and phones
let lastKey = '';
renderer.setAnimationLoop(() => {
  controls.update();
  const key = camera.position.toArray().concat(camera.quaternion.toArray(), [camera.fov]).map((v) => v.toFixed(5)).join();
  if (key !== lastKey) { dirty = 2; lastKey = key; }
  if (dirty > 0) { composer ? composer.render() : renderer.render(scene, camera); dirty--; }
});
document.getElementById('loading')?.remove();

window.cockpit = { THREE, scene, camera, controls, renderer, refs, lite: LITE, invalidate: () => (dirty = 3) };
