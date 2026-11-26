// Analytic sky occlusion for the flight deck.
// Sim cockpits look real largely because each point only receives the sky light that can actually reach it
// through the windows (MSFS bakes this as "sky occlusion"). Without it every surface picks up the full blue
// sky as ambient light and reflections, which flattens the cockpit and leaks light into footwells.
// Here every cockpit material gets a small shader hook that estimates, per pixel, how much of the sky is
// visible through the windshield and side windows (a form-factor sum over the window openings, with the
// glareshield and sills as occluders), and scales the ambient/environment light and reflections by it.
import * as THREE from 'three';

const GLSL = /* glsl */`
varying vec3 vSkyP;
float aperture(vec3 p, vec3 n, vec3 c, vec3 m, float A) {
  vec3 d = c - p; float r2 = dot(d, d); d *= inversesqrt(r2);
  return A * max(dot(n, d), 0.0) * max(dot(m, -d), 0.0) / (3.14159 * r2 + A);
}
float glareBlock(vec3 p, vec3 c) {   // the glareshield cap (y ~0.95, rear edge z ~0.33) shades everything below it
  if (p.y > 0.94) return 1.0;
  float t = (0.95 - p.y) / max(c.y - p.y, 1e-3); float zc = p.z + t * (c.z - p.z); float xc = abs(p.x + t * (c.x - p.x));
  return xc > 0.9 ? 1.0 : smoothstep(0.26, 0.4, zc);
}
float skyVis(vec3 p, vec3 n) {
  if (length(p - vec3(0.0, 1.0, 0.6)) > 4.0) return 1.0;   // outside world: unoccluded
  float F = 0.0;
  for (int s = -1; s <= 1; s += 2) {
    float sx = float(s);
    vec3 cw = vec3(sx * 0.42, 1.14, 0.17), mw = normalize(vec3(-sx * 0.35, -0.55, 0.76));
    F += aperture(p, n, cw, mw, 0.5) * glareBlock(p, cw);
    float sill = smoothstep(0.55, 0.82, p.y) * 0.8 + 0.2 * step(abs(p.x), 0.6);
    F += aperture(p, n, vec3(sx * 0.98, 1.1, 0.72), vec3(-sx, 0.0, 0.0), 0.27) * sill;
    F += aperture(p, n, vec3(sx * 0.98, 1.1, 1.33), vec3(-sx, 0.0, 0.0), 0.27) * sill;
  }
  return clamp(F * 4.5, 0.0, 1.0);
}`;

export function applySkyOcclusion(root, { floor = 0.3, spec = 0.12 } = {}) {
  const done = new Set();
  root.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (done.has(m) || !(m.isMeshStandardMaterial) || m.userData.skyocc) continue; done.add(m); m.userData.skyocc = true;
      const prev = m.onBeforeCompile; const prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
      m.onBeforeCompile = (sh, r) => {
        if (prev) prev.call(m, sh, r);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSkyP;')
          .replace('#include <project_vertex>', `#include <project_vertex>
            { vec4 sp = vec4(transformed, 1.0);
              #ifdef USE_INSTANCING
                sp = instanceMatrix * sp;
              #endif
              vSkyP = (modelMatrix * sp).xyz; }`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL)
          .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
            { float sv = skyVis(vSkyP, inverseTransformDirection(normal, viewMatrix));
              irradiance *= mix(${floor.toFixed(3)}, 1.0, sv); iblIrradiance *= mix(${floor.toFixed(3)}, 1.0, sv); radiance *= mix(${spec.toFixed(3)}, 1.0, sv); }`);
      };
      m.customProgramCacheKey = () => prevKey() + '|skyocc';
      m.needsUpdate = true;
    }
  });
}
