// Procedural surface finishes, computed from each point's position in the world, so the
// grain is the same size on a tiny button and a large panel (no stretched textures).
//   paint   – fine orange-peel texture of painted aluminium panels
//   matte   – anti-glare glareshield finish
//   fabric  – woven seat cloth
//   carpet  – dense cut-pile carpet
//   rubber  – knobs, sidestick grips
//   brushed – metal levers and rails (grain along one direction)
import * as THREE from 'three';

const NOISE = /* glsl */`
varying vec3 vGrainPos;
float gHash(vec3 p){ p = fract(p*0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float gNoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(gHash(i+vec3(0,0,0)),gHash(i+vec3(1,0,0)),f.x), mix(gHash(i+vec3(0,1,0)),gHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(gHash(i+vec3(0,0,1)),gHash(i+vec3(1,0,1)),f.x), mix(gHash(i+vec3(0,1,1)),gHash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float gFbm(vec3 p){ float a=0.5, s=0.0; for(int k=0;k<4;k++){ s+=a*gNoise(p); p*=2.03; a*=0.5; } return s; }
vec3 gPerturb(vec3 pos, vec3 n, vec2 dH, float fd){
  vec3 vSigmaX = normalize(dFdx(pos)); vec3 vSigmaY = normalize(dFdy(pos));
  vec3 R1 = cross(vSigmaY, n); vec3 R2 = cross(n, vSigmaX);
  float det = dot(vSigmaX, R1) * fd;
  vec3 g = sign(det) * (dH.x * R1 + dH.y * R2);
  return normalize(abs(det) * n - g);
}
`;

const PRESETS = {
  paint:   { scale: 900,  rough: 0.10, bump: 0.0035, tint: 0.035, broad: 0.04, wear: 0.06, dust: 0.10 },
  matte:   { scale: 1400, rough: 0.06, bump: 0.0025, tint: 0.02,  broad: 0.03, wear: 0.03, dust: 0.22 },
  fabric:  { scale: 420,  rough: 0.08, bump: 0.012,  tint: 0.10,  broad: 0.05, weave: 1.0 },
  carpet:  { scale: 650,  rough: 0.04, bump: 0.02,   tint: 0.16,  broad: 0.08 },
  rubber:  { scale: 1600, rough: 0.08, bump: 0.002,  tint: 0.03,  broad: 0.0 },
  brushed: { scale: 1200, rough: 0.12, bump: 0.002,  tint: 0.05,  broad: 0.0, stretch: 1.0 },
  lining:  { scale: 300,  rough: 0.05, bump: 0.006,  tint: 0.04,  broad: 0.05, wear: 0.02, dust: 0.05 },
};

export function addGrain(material, kind) {
  const P = PRESETS[kind]; if (!P) return material;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrainPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    const pos = P.stretch ? `vec3(vGrainPos.x*${P.scale.toFixed(1)}*0.08, vGrainPos.y*${P.scale.toFixed(1)}, vGrainPos.z*${P.scale.toFixed(1)})`
      : `vGrainPos*${P.scale.toFixed(1)}`;
    const height = P.weave
      ? `float gh = 0.5 + 0.5*sin(vGrainPos.x*${(P.scale * 0.6).toFixed(1)})*sin(vGrainPos.z*${(P.scale * 0.6).toFixed(1)} + vGrainPos.y*${(P.scale * 0.6).toFixed(1)}) * 0.6 + 0.4*gNoise(${pos});`
      : `float gh = gFbm(${pos});`;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${height}
        float gBroad = gNoise(vGrainPos*7.0);
        diffuseColor.rgb *= 1.0 + (gh-0.5)*${P.tint.toFixed(3)} + (gBroad-0.5)*${P.broad.toFixed(3)};`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (gh-0.5)*${P.rough.toFixed(3)} + (gBroad-0.5)*0.05, 0.04, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec2 dH = vec2(dFdx(gh), dFdy(gh)) * ${P.bump.toFixed(4)} * 60.0;
          normal = gPerturb(-vViewPosition, normal, dH, faceDirection); }
        ${P.wear ? `{ // use and age: rubbed, slightly polished edges; a film of dust on upward-facing surfaces; grime in low corners
          vec3 wn = inverseTransformDirection(normal, viewMatrix);
          float edge = clamp(length(fwidth(normal)) * 2.2, 0.0, 1.0) * smoothstep(0.35, 0.75, gNoise(vGrainPos * 160.0));
          diffuseColor.rgb *= 1.0 + edge * ${P.wear.toFixed(3)}; roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.7, edge);
          float dust = smoothstep(0.7, 0.97, wn.y) * (0.55 + 0.45 * gFbm(vGrainPos * 35.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.56, 0.55, 0.52), dust * ${(P.dust || 0).toFixed(3)}); roughnessFactor = min(1.0, roughnessFactor + dust * 0.12);
          float low = 1.0 - smoothstep(0.05, 0.5, vGrainPos.y); diffuseColor.rgb *= 1.0 - low * 0.06 * gFbm(vGrainPos * 12.0); }` : ''}`);
  };
  material.customProgramCacheKey = () => 'grain-' + kind;
  return material;
}
