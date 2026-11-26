// Cockpit state: one value per control, addressed by its fixed id. The systems read and write values here and
// set light outputs; the 3D objects only ever *show* the state (visual() below), so geometry can change freely.
import * as THREE from 'three';
import { CONTROLS, setFaceLights } from '../parts/panel.js';
import { defFor } from './controls.js';

const D2R = Math.PI / 180;

export class Control {
  constructor(id, def, obj, ctl = null) {
    this.id = id; this.def = def; this.obj = obj; this.ctl = ctl; this.kind = def.kind;
    this.guardOpen = false; this.down = false;
    this.value = initialValue(def);
    this.lights = { top: 0, bot: 0 };   // set by the systems (0..1)
    obj.userData.control = this;
  }
  get name() { return this.def.name; }
  // text shown on hover: name and current setting
  get status() {
    const d = this.def, v = this.value; if (d.status) return d.status(v);
    switch (this.kind) {
      case 'sel': case 'tog': return d.pos[v];
      case 'rot': return Math.round(v * 100) + '%';
      case 'rx': return v.on ? 'ON  vol ' + Math.round(v.vol * 100) + '%' : 'OFF';
      case 'alt': return v ? 'pushed in' : 'released';
      case 'latch': case 'radio': return v ? 'ON' : 'OFF';
      default: return '';
    }
  }
}
function initialValue(d) {
  switch (d.kind) {
    case 'alt': case 'latch': return !!d.init;
    case 'radio': return !!d.init;
    case 'sel': case 'tog': return d.init || 0;
    case 'rot': return d.init ?? 0.5;
    case 'rx': return { on: !!d.on, vol: d.init ?? 0.6 };
    case 'spring': return 0;
    case 'fcu': return 0;
    default: return false;
  }
}

export class Sim {
  constructor() {
    this.controls = new Map(); this.listeners = []; this.anims = new Map();
    this.annLt = 1; this.night = 0; this.dirty = true; this.onInvalidate = () => {};
  }
  // collect every control built on a panel, plus any registered by hand (levers etc.)
  attachPanels() {
    for (const ctl of CONTROLS) {
      const id = ctl.panel + '.' + ctl.item.id; if (this.controls.has(id)) continue;
      this.controls.set(id, new Control(id, defFor(id, ctl), ctl.obj, ctl));
    }
    for (const c of this.controls.values()) this.visual(c, true);
  }
  register(id, obj, def) { const c = new Control(id, def, obj); this.controls.set(id, c); this.visual(c, true); return c; }
  get(id) { return this.controls.get(id); }
  val(id) { const c = this.controls.get(id); return c ? c.value : undefined; }
  on(fn) { this.listeners.push(fn); }
  emit(c, ev, data) { for (const fn of this.listeners) fn(c, ev, data); this.dirty = true; }

  set(id, v) {
    const c = typeof id === 'string' ? this.controls.get(id) : id; if (!c) return;
    if (c.kind === 'radio' && v) for (const o of this.controls.values()) if (o !== c && o.kind === 'radio' && o.def.group === c.def.group && o.obj.parent === c.obj.parent) { o.value = false; this.visual(o); }
    c.value = v; this.visual(c); this.emit(c, 'change', v);
  }
  // ------------------------------------------------------------------ user actions (called by the interaction layer)
  press(c) {
    switch (c.kind) {
      case 'alt': this.set(c, !c.value); break;
      case 'latch': this.set(c, !c.value); break;
      case 'radio': this.set(c, c.def.toggle ? !c.value : true); break;
      case 'mom': c.down = true; this.emit(c, 'down'); break;
      case 'rx': this.set(c, { ...c.value, on: !c.value.on }); break;
      case 'fcu': this.emit(c, 'push'); break;
    }
    if (c.obj.userData.cap) this.pushAnim(c);
  }
  release(c) {
    if (c.kind === 'mom' && c.down) { c.down = false; this.emit(c, 'up'); }
    if (c.kind === 'tog' && c.def.spring !== undefined && (!c.def.springFrom || c.def.springFrom.includes(c.value))) this.set(c, c.def.spring);
    if (c.kind === 'spring' && c.value) this.set(c, 0);
  }
  step(c, dir) {   // knob / toggle one position (dir +1 = clockwise / down / right)
    if (c.kind === 'sel' || c.kind === 'tog') { const n = c.def.pos.length; const v = Math.max(0, Math.min(n - 1, c.value + dir)); if (v !== c.value) this.set(c, v); }
    else if (c.kind === 'rot') this.set(c, Math.max(0, Math.min(1, c.value + dir * 0.05)));
    else if (c.kind === 'rx') this.set(c, { ...c.value, vol: Math.max(0, Math.min(1, c.value.vol + dir * 0.05)) });
    else if (c.kind === 'fcu') { c.value += dir; this.visual(c); this.emit(c, 'turn', dir); }
    else if (c.kind === 'spring') this.set(c, Math.sign(dir));
    else if (c.def.step) c.def.step(this, c, dir);
  }
  pull(c) { if (c.kind === 'fcu') { this.emit(c, 'pull'); this.pushAnim(c, -1); } }
  toggleGuard(c) { c.guardOpen = !c.guardOpen; this.visual(c); this.emit(c, 'guard', c.guardOpen); }

  // ------------------------------------------------------------------ showing the state on the 3D object
  visual(c, now = false) {
    const o = c.obj, it = c.ctl ? c.ctl.item : {};
    if (c.def.apply) { c.def.apply(c, this, now); return; }
    if (o.userData.guard) this.animate(o.userData.guard.rotation, 'x', c.guardOpen ? -1.95 : 0, now, 6);
    const ticks = it.ticks;
    switch (c.kind) {
      case 'sel': {
        const n = c.def.pos.length; const arc = it.arc ?? 45;
        const angs = ticks && ticks.length === n ? ticks : Array.from({ length: n }, (_, i) => (n === 1 ? 0 : -arc + (2 * arc * i) / (n - 1)));
        this.animate(o.rotation, 'z', -angs[c.value] * D2R, now, 14); break;
      }
      case 'rot': {
        const a = it.ticks && it.ticks.length === 2 ? it.ticks : [-(it.arc ?? 130), it.arc ?? 130];
        this.animate(o.rotation, 'z', -(a[0] + (a[1] - a[0]) * c.value) * D2R, now, 14); break;
      }
      case 'spring': this.animate(o.rotation, 'z', -(c.value * 30) * D2R, now, 14); break;
      case 'tog': {
        const bat = o.userData.bat; if (!bat) break; const n = c.def.pos.length;
        const a = n === 1 ? 0 : -0.45 + (0.9 * c.value) / (n - 1);
        if (c.def.horizontal) { this.animate(bat.rotation, 'x', 0, now, 18); this.animate(bat.rotation, 'y', a, now, 18); } else this.animate(bat.rotation, 'x', a, now, 18);
        break;
      }
      case 'rx': this.animate(o.position, 'z', c.value.on ? 0.0022 : 0, now, 20); this.animate(o.rotation, 'z', -(-120 + 240 * c.value.vol) * D2R, now, 14); break;
      case 'fcu': this.animate(o.rotation, 'z', -c.value * 12 * D2R, now, 20); break;
    }
    this.dirty = true;
  }
  pushAnim(c, sgn = 1) {   // brief press-in of a cap / knob
    const t = c.obj.userData.cap || c.obj; const z0 = t.userData.z0 ?? (t.userData.z0 = t.position.z);
    t.position.z = z0 - 0.0009 * sgn; t.scale.setScalar(sgn > 0 ? 0.97 : 1); this.animate(t.position, 'z', z0, false, 10); this.animate(t.scale, 'x', 1, false, 10); this.animate(t.scale, 'y', 1, false, 10);
  }
  // exponential approach of a property to its target; now = jump
  animate(obj, prop, target, now = false, rate = 12) {
    if (now) { obj[prop] = target; const m0 = this.anims.get(obj); if (m0) m0.delete(prop); return; }
    let m = this.anims.get(obj); if (!m) { m = new Map(); this.anims.set(obj, m); } m.set(prop, { target, rate });
  }
  // per frame: run animations, refresh lights; returns true while something moves
  update(dt) {
    let active = false;
    for (const [obj, m] of this.anims) {
      for (const [prop, a] of m) {
        const d = a.target - obj[prop]; if (Math.abs(d) < 1e-5) { obj[prop] = a.target; m.delete(prop); continue; }
        obj[prop] += d * Math.min(1, dt * a.rate); active = true;
      }
      if (!m.size) this.anims.delete(obj);
    }
    if (this.dirty) { if (this.refreshLights()) active = true; this.dirty = false; }
    return active;
  }
  refreshLights() {   // returns true only if something visible changed (so the frame is redrawn only then)
    let changed = false;
    for (const c of this.controls.values()) {
      const key = c.lights.top + '|' + c.lights.bot + '|' + this.annLt + '|' + this.night + '|' + (c.text || ''); if (c._lk === key) continue; c._lk = key; changed = true;
      const f = c.obj.userData.face; if (f && f.material) setFaceLights(f.material, c.lights.top * this.annLt, c.lights.bot * this.annLt, this.night);
      if (c.obj.userData.bar) for (const s of c.obj.userData.bar) { const k = c.lights.top * this.annLt; s.material.emissive.setRGB(0.25 * k, 1.5 * k, 0.4 * k); }
      if (c.obj.userData.setText) c.obj.userData.setText(c.text || '');
    }
    return changed;
  }
}
