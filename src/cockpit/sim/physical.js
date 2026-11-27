// Controls that are not on a flat panel (levers, wheels, sticks, the baro knobs, MCDU keys), registered with
// the Sim under fixed ids. Each one says how its value is shown (apply) and how a drag moves it; nothing else
// in the code depends on how these parts are modelled.
import * as THREE from 'three';
import { DETENT_DEG } from '../parts/levers.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// a lever with named positions moved by dragging along its travel (px per position), or a click / the wheel
function steps(name, pos, init, apply, { px = 22, axis = 'up', click = null, sign = -1 } = {}) {
  return {
    kind: 'lever', name, pos, init,
    status: (v) => pos[v],
    apply: (c, sim, now) => apply(c, sim, now),
    drag: {
      start: (sim, c) => { c.d0 = c.value; c.moved = false; },
      move: (sim, c, dR, dU) => { const d = axis === 'up' ? dU : dR; c.moved = c.moved || Math.abs(d) > 6; const v = clamp(Math.round(c.d0 + (sign * d) / px), 0, pos.length - 1); if (v !== c.value) sim.set(c, v); },
      end: (sim, c) => { if (!c.moved && click) click(sim, c); },
    },
    wheel: (sim, c, dir) => { const v = clamp(c.value + (dir > 0 ? -1 : 1), 0, pos.length - 1); if (v !== c.value) sim.set(c, v); },
  };
}

export function registerPhysical(sim, refs) {
  const R = (id, obj, def) => { if (obj) { const c = sim.register(id, obj, def); if (def.value !== undefined) c.value = def.value; } };

  // ---- thrust levers: continuous travel with detents (REV - IDLE - CL - FLX/MCT - TOGA); release near a detent snaps into it
  const T = refs.thrust;
  const both = (s, v) => { for (const k of [1, 2]) { const o = s.get('thrust.lever' + k); if (o && o.value !== v) s.set(o, v); } };
  if (T) T.levers.forEach((lv, i) => {
    const det = Object.entries(DETENT_DEG).filter(([k]) => k !== 'N45');
    R(`thrust.lever${i + 1}`, lv, {
      kind: 'lever', name: `THRUST LEVER ${i + 1}`, value: DETENT_DEG.IDLE,
      status: (v) => { const d = det.find(([, a]) => Math.abs(a - v) < 0.6); return d ? (d[0] === 'FLX' ? 'FLX / MCT' : d[0] === 'TOGA' ? 'TO GA' : d[0]) : v.toFixed(0) + '°'; },
      apply: (c, s, now) => s.animate(lv.rotation, 'x', -c.value * D2R, now, 16),
      // the two levers are moved together, as one handle
      drag: { start: (s, c) => (c.d0 = c.value), move: (s, c, dR, dU) => { const v = clamp(c.d0 + dU * 0.22, DETENT_DEG.REV, DETENT_DEG.TOGA); if (v !== c.value) both(s, v); },
        end: (s, c) => { const d = det.reduce((b, [, a]) => (Math.abs(a - c.value) < Math.abs(b - c.value) ? a : b), 99); if (Math.abs(d - c.value) < 3.5) both(s, d); } },
      wheel: (s, c, dir) => { const list = det.map(([, a]) => a).sort((a, b) => a - b); const nx = dir > 0 ? list.find((a) => a > c.value + 0.1) : [...list].reverse().find((a) => a < c.value - 0.1); if (nx !== undefined) both(s, nx); },
    });
  });

  if (T) T.levers.forEach((lv, i) => { if (lv.userData.athrBtn) sim.register(`thrust.athrDisc${i + 1}`, lv.userData.athrBtn, { kind: 'mom', name: 'A/THR INSTINCTIVE DISCONNECT' }); });
  // ---- flaps: 0 1 2 3 FULL (lift the trigger and move: drag the handle)
  const fl = refs.flaps?.userData.lever; const flY = [0.045, 0.022, 0, -0.022, -0.045];
  R('flaps.lever', fl, steps('FLAPS', ['0', '1', '2', '3', 'FULL'], 0, (c, s, now) => s.animate(fl.position, 'y', flY[c.value], now, 14)));
  // ---- speed brake: RET / 1/2 / FULL; pull up at RET to arm the ground spoilers
  const sb = refs.speedBrake?.userData.lever; const sbY = [0.04, 0.0, -0.045];
  R('speedbrake.lever', sb, steps('SPEED BRAKE', ['RET', '1/2', 'FULL'], 0, (c, s, now) => { s.animate(sb.position, 'y', sbY[c.value], now, 14); s.animate(sb.position, 'z', c.armed ? 0.012 : 0, now, 14); if (c.value) c.armed = false; },
    { px: 30, click: (s, c) => { if (c.value === 0) { c.armed = !c.armed; s.visual(c); s.emit(c, 'change', c.value); } } }));
  { const c = sim.get('speedbrake.lever'); if (c) { const st = c.def.status; c.def.status = (v) => st(v) + (c.armed ? ' · ARMED' : ''); } }
  // ---- parking brake: pull and turn
  const pb = refs.parkBrake?.userData.handle;
  R('parkBrake.handle', pb, { kind: 'lever', name: 'PARKING BRK', value: 0, status: (v) => (v ? 'ON' : 'OFF'),
    apply: (c, s, now) => { s.animate(pb.rotation, 'z', c.value ? -Math.PI / 2 : 0, now, 8); s.animate(pb.position, 'z', c.value ? 0.004 : 0, now, 10); },
    drag: { end: (s, c) => s.set(c, c.value ? 0 : 1) }, wheel: (s, c, dir) => s.set(c, dir < 0 ? 1 : 0) });
  // ---- landing gear lever (on the ground the gear stays down whatever the lever says: the LGCIUs inhibit retraction)
  const gl = refs.gearLever;
  R('gear.lever', gl, steps('LANDING GEAR', ['UP', 'DOWN'], 1, (c, s, now) => s.animate(gl.position, 'y', (gl.userData.y0 ?? (gl.userData.y0 = gl.position.y)) + (c.value ? 0 : 0.045), now, 10), { px: 18, sign: -1, click: (s, c) => s.set(c, c.value ? 0 : 1) }));
  // ---- engine master switches: lift and move OFF / ON
  (refs.engPanel?.userData.masters || []).forEach((lv, i) => R(`engPanel.master${i + 1}`, lv, { kind: 'lever', name: `ENG MASTER ${i + 1}`, value: 0, status: (v) => (v ? 'ON' : 'OFF'),
    apply: (c, s, now) => s.animate(lv.rotation, 'x', c.value ? -0.3 : 0.3, now, 14), drag: { start: (s, c) => (c.d0 = c.value), move: (s, c, dR, dU) => { const v = dU > 10 ? 1 : dU < -10 ? 0 : c.d0; if (v !== c.value) s.set(c, v); }, end: (s, c) => { if (c.value === c.d0) s.set(c, c.value ? 0 : 1); } },
    wheel: (s, c, dir) => s.set(c, dir > 0 ? 1 : 0) }));
  // ---- gravity gear extension crank: three turns
  const gg = refs.gravityGear;
  if (gg) { const piv = new THREE.Group(); piv.position.copy(gg.position); piv.position.y += 0.01; gg.parent.add(piv); gg.position.set(0, -0.01, gg.position.z - piv.position.z); piv.position.z = 0; piv.add(gg);
    R('gear.gravity', piv, { kind: 'lever', name: 'GRAVITY GEAR EXTN (3 turns)', value: 0, status: (v) => (v / 360).toFixed(1) + ' turns',
      apply: (c, s, now) => s.animate(piv.rotation, 'z', -c.value * D2R, now, 12),
      drag: { start: (s, c) => (c.d0 = c.value), move: (s, c, dR, dU, dx, dy) => s.set(c, clamp(c.d0 + (dx - dy) * 1.5, 0, 1080)) }, wheel: (s, c, dir) => s.set(c, clamp(c.value + dir * 30, 0, 1080)) }); }
  // ---- pitch trim wheels (both turn together); the THS needs green or yellow hydraulic pressure to move
  (refs.trimWheels || []).forEach((w, i) => R(`trim.wheel${i + 1}`, w, { kind: 'lever', name: 'PITCH TRIM WHEEL', value: 0,
    status: (v) => { const sys = sim.systems?.s; const ok = !sys || sys.hyd.G > 1450 || sys.hyd.Y > 1450; return (v >= 0 ? v.toFixed(1) + ' UP' : (-v).toFixed(1) + ' DN') + (ok ? '' : ' · no hydraulic pressure'); },
    apply: (c, s, now) => { for (const ww of refs.trimWheels) s.animate(ww.rotation, 'x', -c.value * 1.4, now, 12); },
    drag: { start: (s, c) => (c.d0 = c.value), move: (s, c, dR, dU, dx, dy) => { const sys = sim.systems?.s; if (sys && sys.hyd.G < 1450 && sys.hyd.Y < 1450) return; const v = clamp(c.d0 - dy * 0.02, -4, 13.5); for (const k of [1, 2]) { const o = s.get('trim.wheel' + k); if (o) o.value = v; } s.set(c, v); } },
    wheel: (s, c, dir) => { const sys = sim.systems?.s; if (sys && sys.hyd.G < 1450 && sys.hyd.Y < 1450) return; const v = clamp(c.value + dir * 0.2, -4, 13.5); for (const k of [1, 2]) { const o = s.get('trim.wheel' + k); if (o) o.value = v; } s.set(c, v); } }));
  // ---- sidesticks: deflect while held, spring back to neutral
  for (const [id, st] of [['sidestick.capt', refs.sidestickCpt], ['sidestick.fo', refs.sidestickFo]]) { const sk = st?.userData.stick; if (!sk) continue;
    R(id, sk, { kind: 'lever', name: 'SIDESTICK', value: [0, 0], status: (v) => (v[0] || v[1] ? `pitch ${(-v[1] * 57).toFixed(0)}° roll ${(v[0] * 57).toFixed(0)}°` : 'neutral'),
      apply: (c, s, now) => { s.animate(sk.rotation, 'x', c.value[1], now, 18); s.animate(sk.rotation, 'z', -c.value[0], now, 18); },
      drag: { move: (s, c, dR, dU, dx, dy) => s.set(c, [clamp(dx * 0.004, -0.3, 0.3), clamp(dy * 0.004, -0.28, 0.28)]), end: (s, c) => s.set(c, [0, 0]) } }); }
  for (const [id, st] of [['sidestick.capt.apDisc', refs.sidestickCpt], ['sidestick.fo.apDisc', refs.sidestickFo]]) if (st?.userData.apBtn) sim.register(id, st.userData.apBtn, { kind: 'mom', name: 'AUTOPILOT DISCONNECT (sidestick)' });
  // ---- nose wheel steering tillers: turn while held, self-centring
  for (const [id, t] of [['tiller.capt', refs.tillerCpt], ['tiller.fo', refs.tillerFo]]) { const arm = t?.userData.arm; if (!arm) continue;
    R(id, arm, { kind: 'lever', name: 'STEERING HANDWHEEL', value: 0, status: (v) => (v ? `${Math.round(v * 57.3)}°` : 'centred'),
      apply: (c, s, now) => s.animate(arm.rotation, 'y', -c.value, now, 14), drag: { move: (s, c, dR, dU, dx) => s.set(c, clamp(dx * 0.012, -1.31, 1.31)), end: (s, c) => s.set(c, 0) } }); }
  // ---- cockpit door switch: UNLOCK / NORM / LOCK, spring-loaded to NORM
  const door = refs.doorSwitch; if (door) { door.userData.bat = door; const c = sim.register('cockpitDoor.doorSw', door, { kind: 'tog', name: 'COCKPIT DOOR', pos: ['UNLOCK', 'NORM', 'LOCK'], init: 1, spring: 1 }); c.value = 1; sim.visual(c, true); }
  // ---- EFIS baro knobs (turn = QNH, pull = STD, push = QNH) and the in Hg / hPa ring
  (refs.efis || []).forEach((p, i) => { const b = p.userData.baro; if (!b) return;
    sim.register(`EFIS${i + 1}.baro`, b.knob, { kind: 'fcu', name: 'BARO (turn · push QNH · pull STD)' });
    const ring = sim.register(`EFIS${i + 1}.baroUnit`, b.ring, { kind: 'sel', name: 'BARO REF in Hg / hPa', pos: ['in Hg', 'hPa'], init: 1 }); ring.value = 1; sim.visual(ring, true); });
  // ---- MCDU keys (momentary); what they do is the MCDU's business (scratchpad now, pages in phase 5)
  (refs.mcdus || []).forEach((m, i) => { for (const [k, mesh] of Object.entries(m.keys || {})) sim.register(`mcdu${i + 1}.${k}`, mesh, { kind: 'mom', name: `MCDU ${i + 1} ${k}` }); });
}
