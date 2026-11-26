// Mouse / touch handling for every control. Works only through the Sim (sim.press, sim.step, ...), so it knows
// nothing about what a control looks like - it finds the control under the pointer and asks it to act.
//   click            pushbuttons, keys, guards (opens / closes), reception knobs (on / off), FCU knob push
//   right click      FCU knob pull
//   click either side / above-below   rotary selectors and toggles step that way
//   drag             knobs turn, toggles flip, levers move
//   wheel            knobs turn, levers move (anywhere else the wheel still zooms)
import * as THREE from 'three';

const v = new THREE.Vector3();
export class Interaction {
  constructor(sim, camera, dom, scene) {
    this.sim = sim; this.cam = camera; this.dom = dom; this.scene = scene;
    this.ray = new THREE.Raycaster(); this.ray.params.Line = { threshold: 0 };
    this.drag = null; this.hover = null;
    this.tip = document.createElement('div'); this.tip.className = 'ctl-tip'; document.body.appendChild(this.tip);
    this.targets = [];
    this.refreshTargets();
    this._bind();
  }
  refreshTargets() { this.targets = [...this.sim.controls.values()].filter((c) => c.kind !== 'ind').map((c) => c.obj); }

  // control under a screen point (and the mesh that was hit)
  pick(x, y) {
    const r = this.dom.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.cam);
    const hits = this.ray.intersectObjects(this.targets, true);
    for (const h of hits) {
      if (!h.object.visible) continue;
      let o = h.object; while (o && !o.userData.control) o = o.parent;
      if (!o) continue;
      const c = o.userData.control; const guardHit = isInside(h.object, o.userData.guard);
      return { c, guardHit, point: h.point };
    }
    return null;
  }
  // where the pointer is relative to the control, along the panel's own up and right directions (pixels)
  local(c, x, y) {
    const r = this.dom.getBoundingClientRect(); const o = c.obj;
    const sc = (p) => { p.project(this.cam); return [(p.x + 1) / 2 * r.width + r.left, (1 - p.y) / 2 * r.height + r.top]; };
    const [cx, cy] = sc(o.getWorldPosition(new THREE.Vector3()));
    const up = sc(o.parent.localToWorld(o.position.clone().add(new THREE.Vector3(0, 0.01, 0))));
    const rt = sc(o.parent.localToWorld(o.position.clone().add(new THREE.Vector3(0.01, 0, 0))));
    const U = norm([up[0] - cx, up[1] - cy]), Rr = norm([rt[0] - cx, rt[1] - cy]);
    const d = [x - cx, y - cy];
    return { up: d[0] * U[0] + d[1] * U[1], right: d[0] * Rr[0] + d[1] * Rr[1], U, R: Rr };
  }

  _bind() {
    const el = this.dom;
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 2) return;
      const p = this.pick(e.clientX, e.clientY); if (!p) return;
      e.stopImmediatePropagation(); e.preventDefault(); el.setPointerCapture(e.pointerId);
      const { c } = p; const loc = this.local(c, e.clientX, e.clientY);
      this.drag = { c, id: e.pointerId, x0: e.clientX, y0: e.clientY, acc: 0, moved: false, loc, button: e.button, acted: false };
      // guards first: a closed guard opens; clicking the lifted guard closes it again
      if (c.obj.userData.guard && (p.guardHit || !c.guardOpen)) { this.sim.toggleGuard(c); this.drag.acted = true; this.drag.done = true; return; }
      if (e.button === 2) { this.sim.pull(c); this.drag.acted = true; return; }
      if (c.def.drag) { c.def.drag.start?.(this.sim, c, loc); this.drag.acted = true; return; }
      switch (c.kind) {
        case 'alt': case 'latch': case 'radio': case 'mom': case 'rx': case 'fcu': this.sim.press(c); this.drag.acted = true; break;
        case 'spring': this.sim.step(c, loc.right >= 0 ? 1 : -1); this.drag.acted = true; break;
      }
    }, { capture: true });
    el.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) { if (!e.buttons) this._hover(e.clientX, e.clientY); return; }
      e.stopImmediatePropagation();
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0; if (Math.hypot(dx, dy) > 6) d.moved = true;
      const c = d.c; if (d.done) return;
      if (c.def.drag) { c.def.drag.move?.(this.sim, c, dx * d.loc.R[0] + dy * d.loc.R[1], -(dx * d.loc.U[0] + dy * d.loc.U[1]), dx, dy); this._tip(c, e.clientX, e.clientY); return; }
      // knobs: drag right / up = clockwise; toggles: drag along the panel's up axis
      const along = c.kind === 'tog' ? (c.def.horizontal ? dx * d.loc.R[0] + dy * d.loc.R[1] : -(dx * d.loc.U[0] + dy * d.loc.U[1])) : dx - dy;
      const stepPx = c.kind === 'rot' || c.kind === 'rx' ? 8 : c.kind === 'fcu' ? 12 : 26;
      const n = Math.trunc((along - d.acc) / stepPx);
      if (n && d.moved && c.kind !== 'alt' && c.kind !== 'mom' && c.kind !== 'latch' && c.kind !== 'radio') { for (let i = 0; i < Math.abs(n); i++) this.sim.step(c, Math.sign(n)); d.acc += n * stepPx; d.acted = true; }
      this._tip(c, e.clientX, e.clientY);
    }, { capture: true });
    const end = (e) => {
      const d = this.drag; if (!d || d.id !== e.pointerId) return;
      e.stopImmediatePropagation(); this.drag = null; const c = d.c;
      if (c.def.drag) { c.def.drag.end?.(this.sim, c); }
      else if (!d.acted && !d.moved && !d.done) {   // plain click on a selector / toggle: step toward the clicked side
        const n = c.def.pos ? c.def.pos.length : 0, atEnd = c.value >= n - 1;
        if (c.kind === 'sel' || c.kind === 'rot') this.sim.step(c, Math.abs(d.loc.right) < 4 ? (atEnd ? -1 : 1) : d.loc.right > 0 ? 1 : -1);
        else if (c.kind === 'tog') { const off = c.def.horizontal ? d.loc.right : -d.loc.up; this.sim.step(c, Math.abs(off) < 4 ? (atEnd ? -1 : 1) : off > 0 ? 1 : -1); }
      }
      this.sim.release(c); this._tip(c, e.clientX, e.clientY);
    };
    el.addEventListener('pointerup', end, { capture: true }); el.addEventListener('pointercancel', end, { capture: true });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('dblclick', (e) => { if (this.pick(e.clientX, e.clientY)) e.stopImmediatePropagation(); }, { capture: true });
    el.addEventListener('wheel', (e) => {
      const p = this.pick(e.clientX, e.clientY); if (!p) return;
      const c = p.c; e.stopImmediatePropagation(); e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      if (c.def.wheel) c.def.wheel(this.sim, c, dir);
      else if (['sel', 'rot', 'rx', 'fcu', 'tog'].includes(c.kind)) this.sim.step(c, c.kind === 'tog' ? -dir : dir);
      this._tip(c, e.clientX, e.clientY);
    }, { capture: true, passive: false });
    el.addEventListener('pointerleave', () => this._hide());
  }
  _hover(x, y) {
    if (this._hq) { this._hq = [x, y]; return; }
    this._hq = [x, y];
    requestAnimationFrame(() => { const [hx, hy] = this._hq; this._hq = null; const p = this.pick(hx, hy); if (p) this._tip(p.c, hx, hy, p.guardHit); else this._hide(); });
  }
  _tip(c, x, y, guardHit) {
    const s = c.status; const g = c.obj.userData.guard ? (c.guardOpen ? ' · guard open' : ' · guarded') : '';
    const hint = c.obj.userData.guard && (!c.guardOpen || guardHit) ? (c.guardOpen ? 'click guard to close' : 'click to lift guard') : HINT[c.kind] || '';
    this.tip.innerHTML = `<b>${esc(c.name)}</b>${s ? ' — ' + esc(s) : ''}${esc(g)}${hint ? '<br><span>' + hint + '</span>' : ''}`;
    this.tip.style.transform = `translate(${x + 14}px, ${y + 16}px)`; this.tip.style.display = 'block';
    this.dom.style.cursor = c.kind === 'ind' ? 'default' : 'pointer';
  }
  _hide() { this.tip.style.display = 'none'; this.dom.style.cursor = ''; }
}
const HINT = {
  alt: 'click to push', mom: 'click (hold) to press', latch: 'click to press', radio: 'click to select',
  sel: 'click left / right side, drag or scroll to turn', rot: 'drag or scroll to turn', tog: 'click above / below, or drag',
  fcu: 'scroll / drag to turn · click = push · right click = pull', rx: 'click = on / off · scroll = volume', spring: 'click left / right side and hold',
  lever: 'drag to move · scroll for one detent',
};
const norm = ([a, b]) => { const l = Math.hypot(a, b) || 1; return [a / l, b / l]; };
const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
function isInside(mesh, group) { if (!group) return false; for (let o = mesh; o; o = o.parent) if (o === group) return true; return false; }
