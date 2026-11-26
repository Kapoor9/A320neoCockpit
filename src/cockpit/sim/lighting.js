// Cockpit and exterior lighting driven by the systems: integral panel lighting (overhead / main panel & pedestal),
// dome, flood, console / floor lights, standby compass light, and the aircraft's exterior lights as seen on the
// ground ahead at night (light pools on the apron, flashing beacon / strobes). Light counts never change at
// runtime (no shader recompiles); only intensities do.
import * as THREE from 'three';
import { INTEGRAL } from '../parts/panel.js';
import { GROUND_Y } from '../dims.js';

export function makeLighting(scene, { dome, flood, invalidate }) {
  const env = { night: false };
  // integral lighting zones: overhead panels vs main panel / glareshield / pedestal (by height in the cockpit)
  const ovhd = [], main = []; const seen = new Set(); const v = new THREE.Vector3();
  scene.traverse((o) => { const m = o.material; if (!m || !INTEGRAL.has(m) || seen.has(m)) return; seen.add(m); o.getWorldPosition(v); (v.y > 1.3 ? ovhd : main).push(m); });
  let atlasMats = []; scene.traverse((o) => { const m = o.material; if (m && m.emissiveMap && m.emissiveMap === m.map && m.transparent && m.alphaTest > 0 && !atlasMats.includes(m)) atlasMats.push(m); });
  let lv = { ovhd: 0, main: 0 };
  const applyIntegral = () => { const k = env.night ? 1 : 0.1;   // backlit legends are hardly visible in daylight
    for (const m of ovhd) m.emissive.setRGB(1.05 * lv.ovhd * k, 0.96 * lv.ovhd * k, 0.8 * lv.ovhd * k);
    for (const m of main) m.emissive.setRGB(1.05 * lv.main * k, 0.96 * lv.main * k, 0.8 * lv.main * k);
    for (const m of atlasMats) m.emissive.setRGB(0.85 * lv.main * k, 0.78 * lv.main * k, 0.64 * lv.main * k); };
  env.setIntegral = (o, m) => { if (o === lv.ovhd && m === lv.main) return; lv = { ovhd: o, main: m }; applyIntegral(); invalidate(); };
  // dome light (the day fill light is separate and only on in daylight)
  let domeLv = 0; const domeApply = () => { dome.intensity = (env.night ? 0 : 0.45) + domeLv * 0.55; };
  env.setDome = (k) => { if (k === domeLv) return; domeLv = k; domeApply(); invalidate(); };
  // flood lights: main panel (under the glareshield) and pedestal
  const ped = new THREE.SpotLight(0xffe2b8, 0, 1.4, 0.75, 0.7, 2); ped.position.set(0, 0.86, 0.32); ped.target.position.set(0, 0.42, 0.75); scene.add(ped, ped.target);
  let fl = [-1, -1]; env.setFlood = (a, b) => { if (a === fl[0] && b === fl[1]) return; fl = [a, b]; flood.forEach((l) => (l.intensity = a * 0.32)); ped.intensity = b * 0.3; invalidate(); };
  // console / floor lights each side
  const cons = [-1, 1].map((s) => { const l = new THREE.PointLight(0xffe6c4, 0, 0.9, 2); l.position.set(s * 0.72, 0.42, 0.75); scene.add(l); return l; });
  let cl = [-1, -1]; env.setConsole = (k) => { if (k[0] === cl[0] && k[1] === cl[1]) return; cl = k; cons.forEach((l, i) => (l.intensity = k[i] * 0.18)); invalidate(); };
  env.setCompass = () => {};
  // exterior: light pools on the apron ahead (additive discs), beacon / strobe flashes
  const pool = (w, d, x, z, col) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, GROUND_Y + 0.03, z); m.visible = false; m.renderOrder = 2; scene.add(m); return m;
  };
  const P = { taxi: pool(14, 34, 0, -26, 0xfff2dc), to: pool(18, 60, 0, -40, 0xfff6e8), landL: pool(16, 70, -4, -55, 0xfff6ea), landR: pool(16, 70, 4, -55, 0xfff6ea),
    turnL: pool(18, 18, -14, -18, 0xfff2dc), turnR: pool(18, 18, 14, -18, 0xfff2dc), beacon: pool(30, 30, 0, 6, 0xff2a10), strobeL: pool(26, 26, -17, 2, 0xffffff), strobeR: pool(26, 26, 17, 2, 0xffffff) };
  let ext = {}; const set = (m, on, k) => { m.visible = on && env.night; m.material.opacity = k; };
  env.setExterior = (e) => { ext = e; };
  env.frame = (t) => {   // called every frame: returns true when an exterior flash changed (needs a redraw)
    if (!env.night) { for (const m of Object.values(P)) m.visible = false; return false; }
    const e = ext, before = JSON.stringify(Object.values(P).map((m) => m.visible));
    set(P.taxi, e.nose === 'taxi' || e.nose === 'to', 0.35); set(P.to, e.nose === 'to', 0.32); set(P.landL, !!e.land?.[0], 0.45); set(P.landR, !!e.land?.[1], 0.45);
    set(P.turnL, !!e.turnoff, 0.3); set(P.turnR, !!e.turnoff, 0.3);
    set(P.beacon, e.beacon && (t % 1.2) < 0.12, 0.22);                       // red beacon flashes about once a second
    const s = t % 1.1; set(P.strobeL, e.strobe && (s < 0.05 || (s > 0.12 && s < 0.17)), 0.5); set(P.strobeR, e.strobe && (s < 0.05 || (s > 0.12 && s < 0.17)), 0.5);   // double flash
    return JSON.stringify(Object.values(P).map((m) => m.visible)) !== before;
  };
  env.setNight = (on) => { env.night = on; applyIntegral(); domeApply(); invalidate(); };
  return env;
}
