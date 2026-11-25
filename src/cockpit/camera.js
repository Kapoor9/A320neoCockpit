// Game-style cockpit camera: sit in a seat, drag to look around, scroll/pinch to zoom,
// double-click/tap anything to glide to it, or jump to a named panel.
import * as THREE from 'three';
import * as D from './dims.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const VIEWS = {
  cpt:   { label: 'Captain',     pos: [-D.SEAT_X, D.EYE.y, D.EYE.z], look: [-D.SEAT_X, 0.86, -0.4], fov: 68 },
  fo:    { label: 'First officer', pos: [D.SEAT_X, D.EYE.y, D.EYE.z], look: [D.SEAT_X, 0.86, -0.4], fov: 68 },
  ovhd:  { label: 'Overhead',    pos: [0, 1.06, 1.38], look: [0, 1.62, 0.92], fov: 62 },
  fcu:   { label: 'FCU',         pos: [0, 1.06, 0.62], look: [0, 0.97, 0.10], fov: 48 },
  main:  { label: 'Main panel',  pos: [-0.42, 1.06, 0.66], look: [-0.58, 0.72, -0.04], fov: 52 },
  ecam:  { label: 'ECAM',        pos: [0, 1.0, 0.62], look: [0, 0.63, -0.03], fov: 46 },
  mcdu:  { label: 'MCDU',        pos: [-0.12, 0.86, 0.66], look: [-0.06, 0.43, 0.2], fov: 50 },
  ped:   { label: 'Pedestal',    pos: [0, 1.18, 1.12], look: [0, 0.38, 0.55], fov: 56 },
};

export class CockpitCamera {
  constructor(camera, dom, scene) {
    this.cam = camera; this.dom = dom; this.scene = scene;
    this.yaw = 0; this.pitch = 0; this.fov = camera.fov;
    this.anim = null; this.seat = 'cpt';
    this.pointers = new Map(); this.lastTap = 0;
    this.ray = new THREE.Raycaster();
    this._bind();
    this.goTo('cpt', 0);
  }

  _lookFromTarget(pos, look) {
    const d = new THREE.Vector3(...look).sub(new THREE.Vector3(...pos)).normalize();
    return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(d.y) };
  }

  goTo(name, dur = 0.9) {
    const v = VIEWS[name]; if (!v) return;
    if (name === 'cpt' || name === 'fo') this.seat = name;
    const { yaw, pitch } = this._lookFromTarget(v.pos, v.look);
    this._glide(new THREE.Vector3(...v.pos), yaw, pitch, v.fov, dur);
    this.current = name;
  }
  seatView(dur = 0.9) { this.goTo(this.seat, dur); }

  _glide(pos, yaw, pitch, fov, dur) {
    const from = { pos: this.cam.position.clone(), yaw: this.yaw, pitch: this.pitch, fov: this.fov };
    // shortest way round for yaw
    let dy = yaw - from.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    if (dur <= 0) { this.cam.position.copy(pos); this.yaw = yaw; this.pitch = pitch; this.fov = fov; this._apply(); return; }
    this.anim = { from, to: { pos, yaw: from.yaw + dy, pitch, fov }, t0: performance.now(), dur: dur * 1000 };
  }

  focusPoint(point) {
    // lean towards what was tapped, keeping a comfortable distance, and zoom in
    const p = this.cam.position.clone();
    const dir = point.clone().sub(p); const dist = dir.length(); dir.normalize();
    const lean = Math.max(0, Math.min(0.32, dist - 0.38));
    const pos = p.clone().addScaledVector(dir, lean);
    pos.y = Math.min(Math.max(pos.y, 0.7), 1.3);
    const d = point.clone().sub(pos).normalize();
    this._glide(pos, Math.atan2(-d.x, -d.z), Math.asin(d.y), 36, 0.7);
    this.current = null;
  }

  _apply() {
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    // fov is set for a landscape screen; on tall screens keep the same sideways view
    const a = this.cam.aspect || 1.6, ref = 1.6;
    const v = a >= ref ? this.fov
      : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.fov) / 2) * ref / a));
    this.cam.fov = Math.min(v, 105); this.cam.updateProjectionMatrix();
    this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  update() {
    if (this.anim) {
      const k = Math.min(1, (performance.now() - this.anim.t0) / this.anim.dur); const e = ease(k);
      const { from, to } = this.anim;
      this.cam.position.lerpVectors(from.pos, to.pos, e);
      this.yaw = from.yaw + (to.yaw - from.yaw) * e;
      this.pitch = from.pitch + (to.pitch - from.pitch) * e;
      this.fov = from.fov + (to.fov - from.fov) * e;
      if (k >= 1) this.anim = null;
    }
    this._apply();
  }

  zoom(delta) { this.anim = null; this.fov = Math.max(18, Math.min(82, this.fov * Math.exp(delta))); }

  _bind() {
    const el = this.dom;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
      if (this.pointers.size === 2) this.pinch = this._pinchDist();
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      if (this.pointers.size === 2) {
        p.x = e.clientX; p.y = e.clientY;
        const d = this._pinchDist(); if (this.pinch) this.zoom(-Math.log(d / this.pinch)); this.pinch = d; return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      this.anim = null;
      const k = (this.fov / 68) * 0.0042;          // slower look when zoomed in
      this.yaw += dx * k; this.pitch += dy * k;
    });
    const end = (e) => {
      const p = this.pointers.get(e.pointerId); this.pointers.delete(e.pointerId); this.pinch = null;
      if (!p) return;
      const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
      if (moved < 10 && e.type === 'pointerup' && e.pointerType === 'touch') {   // double tap focuses (touch)
        const now = performance.now();
        if (now - this.lastTap < 400) { this._focusAt(e.clientX, e.clientY); this.lastTap = 0; }
        else this.lastTap = now;
      }
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', (e) => this._focusAt(e.clientX, e.clientY));   // mouse
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY * 0.0012); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      const s = 0.05;
      if (e.key === 'ArrowLeft') this.yaw += s; else if (e.key === 'ArrowRight') this.yaw -= s;
      else if (e.key === 'ArrowUp') this.pitch += s; else if (e.key === 'ArrowDown') this.pitch -= s;
      else if (e.key === '+' || e.key === '=') this.zoom(-0.1); else if (e.key === '-') this.zoom(0.1);
      else if (e.key === 'Escape') { this.seatView(); return; }
      else return;
      this.anim = null;
    });
  }
  _pinchDist() { const [a, b] = [...this.pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
  _focusAt(x, y) {
    const r = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.cam);
    const hit = this.ray.intersectObjects(this.scene.getObjectByName('cockpit').children, true).find((h) => h.object.visible && h.object.material?.opacity !== 0.08);
    if (hit) this.focusPoint(hit.point);
  }
}
