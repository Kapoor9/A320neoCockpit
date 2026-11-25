import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { buildCockpit } from './build.js';
import { CockpitCamera, VIEWS } from './camera.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

// Daylight: sun high and ahead-left, coming in through the windshield; sky fill; faint dome light
const sun = new THREE.DirectionalLight(0xfff3e2, 2.6);
sun.position.set(-4, 9, -9); sun.target.position.set(0, 0.8, 0.5);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 1, far: 30 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xcfdcea, 0x4a4640, 0.75));
const dome = new THREE.PointLight(0xfff1dc, 0.6, 3.5, 2); dome.position.set(0, 1.85, 1.25); scene.add(dome);

const camera = new THREE.PerspectiveCamera(68, 1, 0.01, 1000);
const { refs } = buildCockpit(scene);
const controls = new CockpitCamera(camera, canvas, scene);

// view buttons
const bar = document.getElementById('views');
for (const [key, v] of Object.entries(VIEWS)) {
  const b = document.createElement('button'); b.textContent = v.label; b.dataset.view = key;
  b.onclick = () => { controls.goTo(key); mark(key); };
  bar.appendChild(b);
}
const mark = (key) => bar.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.view === key));
mark('cpt');

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
document.getElementById('loading')?.remove();

// handy for testing
window.cockpit = { THREE, scene, camera, controls, renderer, refs };
