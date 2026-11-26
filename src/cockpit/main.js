import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { INTEGRAL, KORRY } from './parts/panel.js';
import { buildCockpit, makeSky, SUN_DIR } from './build.js';
import { CockpitCamera, VIEWS } from './camera.js';
import { paintDisplays } from './displays.js';
import { loadFonts } from './labels.js';
import { applySkyOcclusion } from './skyocc.js';

await loadFonts();

// Phones and small screens get a lighter setup; laptops get soft contact shadows (GTAO).
const LITE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// quality presets (remembered on this device): High = everything, Medium = lower resolution, Low = no AO/bloom
const QUALITY = { high: { dpr: 1.5, move: 1.0, fx: true }, medium: { dpr: 1.0, move: 0.75, fx: true }, low: { dpr: 0.85, move: 0.6, fx: false } };
let qName = 'high'; try { qName = localStorage.getItem('a320q') || (LITE ? 'medium' : 'high'); } catch (e) { qName = LITE ? 'medium' : 'high'; }
if (!QUALITY[qName]) qName = 'high';
let DPR_FULL = Math.min(window.devicePixelRatio, QUALITY[qName].dpr), DPR_MOVE = QUALITY[qName].move;
renderer.setPixelRatio(DPR_FULL);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;   // neutral, sim-like colour response
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LITE ? THREE.PCFSoftShadowMap : THREE.VSMShadowMap;   // VSM: wide soft sun penumbras on laptops

const scene = new THREE.Scene();

// Reflections come from the same sky the crew sees through the windows
const envScene = new THREE.Scene(); envScene.add(makeSky(10));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x6d706e }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -1.2; envScene.add(ground);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(envScene, 0.02).texture;
scene.environmentIntensity = 0.8;

// Sunlight through the windshield, sky fill, and a faint warm dome light
const sun = new THREE.DirectionalLight(0xfff1dd, 3.0);
sun.position.copy(SUN_DIR).multiplyScalar(12).add(new THREE.Vector3(0, 0.8, 0.5));
sun.target.position.set(0, 0.8, 0.5);
sun.castShadow = true; sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -2.0, right: 2.0, top: 2.0, bottom: -2.0, near: 2, far: 30 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.015; sun.shadow.radius = 6; sun.shadow.blurSamples = 12;
// the cockpit and the sun do not move: draw the shadow map once, not every frame
renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
scene.add(sun, sun.target);
// ground colour = light bouncing back up off the panels, floor and seats onto the overhead
scene.add(new THREE.HemisphereLight(0xdde3e8, 0x8c877f, 1.0));
const hemi = scene.children[scene.children.length - 1];
const dome = new THREE.PointLight(0xfff0da, 0.45, 3.2, 2); dome.position.set(0, 1.85, 1.3); scene.add(dome);
// soft upward bounce from the sunlit pedestal and panels, so the overhead is never pitch black
const bounce = new THREE.PointLight(0xe9e3d8, 0.8, 2.6, 2); bounce.position.set(0, 0.75, 0.75); scene.add(bounce);

const camera = new THREE.PerspectiveCamera(68, 1, 0.01, 1500);
const { refs } = buildCockpit(scene);
const controls = new CockpitCamera(camera, canvas, scene);

// Post-processing: multisampled render + ambient occlusion + tone mapping
let composer = null, gtao = null, bloom = null;
if (!LITE) {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.updateGtaoMaterial({ radius: 0.13, distanceExponent: 1.4, thickness: 0.8, scale: 1.15, samples: 12 });   // contact shadows in every panel gap and around every control
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
  gtao.blendIntensity = 1.0;
  composer.addPass(gtao);
  // glow around lit lights and displays only (threshold above anything the daylight scene reaches, the sun disc aside)
  bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.45, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

// view buttons
const bar = document.getElementById('views');
for (const [key, v] of Object.entries(VIEWS)) {
  const b = document.createElement('button'); b.textContent = v.label; b.dataset.view = key;
  b.onclick = () => { controls.goTo(key); mark(key); };
  bar.appendChild(b);
}
// day / night: at night the sun and sky go, the panel legends and lines glow (integral lighting), the dome and
// the flood lights under the glareshield light the panels softly
const flood = [-0.45, 0.45].map((x) => { const l = new THREE.SpotLight(0xffe2b8, 0, 1.6, 0.9, 0.8, 2); l.position.set(x, 0.86, 0.36); l.target.position.set(x, 0.55, 0.05); scene.add(l, l.target); return l; });
let night = false;
function setNight(on) {
  night = on; sun.intensity = on ? 0 : 3.0; hemi.intensity = on ? 0.04 : 1.0; scene.environmentIntensity = on ? 0.03 : 0.8;
  dome.intensity = on ? 0.35 : 0.45; bounce.intensity = on ? 0.05 : 0.8; flood.forEach((l) => (l.intensity = on ? 0.14 : 0));
  for (const m of INTEGRAL) { m.emissive.setRGB(on ? 1.05 : 0, on ? 0.96 : 0, on ? 0.8 : 0); }   // panel legends: bright warm white
  for (const m of KORRY) { m.emissive.setScalar(on ? 0.9 : 0); }   // pushbutton legends readable
  scene.traverse((o) => { if (o.userData.isSky) o.visible = !on; if (o.userData.nightOnly) o.visible = on; });
  if (scene.fog) scene.fog.color.set(on ? 0x06080c : 0xdbe3e8);
  scene.background = on ? new THREE.Color(0x05070b) : null; renderer.toneMappingExposure = on ? 1.25 : 1.0; renderer.shadowMap.needsUpdate = true; dirty = 3;
}
{ const b = document.createElement('button'); b.textContent = 'Night'; b.onclick = () => { setNight(!night); b.classList.toggle('sel', night); }; bar.appendChild(b); }
const mark = (key) => bar.querySelectorAll('button[data-view]').forEach((b) => b.classList.toggle('sel', b.dataset.view === key));
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
// While the view moves: lower resolution and no ambient-occlusion/bloom passes, so it stays smooth.
// As soon as it stops: one full-quality frame (high resolution, AO, bloom).
let moving = false, still = 0;
const setQuality = (full) => {
  const pr = full ? DPR_FULL : DPR_MOVE; if (renderer.getPixelRatio() !== pr) { renderer.setPixelRatio(pr); resize(); }
  const fx = full && QUALITY[qName].fx; if (gtao) gtao.enabled = fx; if (bloom) bloom.enabled = fx;
};
{ const b = document.createElement('button'); const label = () => (b.textContent = 'Quality: ' + qName[0].toUpperCase() + qName.slice(1));
  label(); b.onclick = () => { qName = { high: 'medium', medium: 'low', low: 'high' }[qName]; try { localStorage.setItem('a320q', qName); } catch (e) { /* storage unavailable */ }
    DPR_FULL = Math.min(window.devicePixelRatio, QUALITY[qName].dpr); DPR_MOVE = QUALITY[qName].move; label(); setQuality(true); dirty = 3; };
  bar.appendChild(b); }
setQuality(true);
renderer.setAnimationLoop(() => {
  controls.update();
  const key = camera.position.toArray().concat(camera.quaternion.toArray(), [camera.fov]).map((v) => v.toFixed(5)).join();
  if (key !== lastKey) { lastKey = key; if (!moving) { moving = true; setQuality(false); } still = 0; dirty = Math.max(dirty, 1); }
  else if (moving && ++still > 8) { moving = false; setQuality(true); dirty = 2; }
  if (dirty > 0) { composer ? composer.render() : renderer.render(scene, camera); dirty--; }
});
document.getElementById('loading')?.remove();

window.cockpit = { THREE, scene, camera, controls, renderer, refs, lite: LITE, setNight, composer, invalidate: () => (dirty = 3) };
try { paintDisplays(scene, refs); dirty = 3; } catch (e) { console.error('displays', e); }
applySkyOcclusion(scene);
