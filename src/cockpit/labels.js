// Crisp cockpit lettering. All legends are drawn into one shared texture (an "atlas"),
// and each label is a small plane that shows its own patch of it.
import * as THREE from 'three';

export const FONT_PANEL = '"Panel", "Arial Narrow", Arial, sans-serif';   // engraved panel legends (DIN-style)
export const FONT_SCREEN = '"B612", Arial, sans-serif';                   // display text (Airbus cockpit font)

export async function loadFonts() {
  if (!document.fonts) return;
  await Promise.all(['500 20px Panel', '600 20px Panel', '400 20px B612', '700 20px B612', '400 20px "B612 Mono"', '700 20px "B612 Mono"']
    .map((f) => document.fonts.load(f).catch(() => null)));
}

export class LabelAtlas {
  constructor(size = 2048) {
    this.size = size;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
    this.x = 0; this.y = 0; this.rowH = 0; this.cache = new Map();
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.anisotropy = 8;
    this.texture.generateMipmaps = true; this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    // emissiveMap = the lettering itself: at night (integral lighting) the light legends glow, dark ones barely
    this.material = new THREE.MeshStandardMaterial({ map: this.texture, emissiveMap: this.texture, emissive: 0x000000, transparent: true, alphaTest: 0.25, roughness: 0.55, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }

  // Draw text into a cell; returns its UV rectangle. lines: string or array of strings.
  add(lines, { px = 40, weight = 600, font = FONT_PANEL, color = '#ecefe9', aspect = 2.4, box = false, align = 'center' } = {}) {
    const text = Array.isArray(lines) ? lines : [lines];
    const key = JSON.stringify([text, px, weight, font, color, aspect, box, align]);
    if (this.cache.has(key)) return this.cache.get(key);
    const h = Math.ceil(px * (text.length * 1.18 + 0.5)); const w = Math.ceil(h * aspect);
    if (this.x + w > this.size) { this.x = 0; this.y += this.rowH + 4; this.rowH = 0; }
    if (this.y + h > this.size) throw new Error('label atlas full');
    const c = this.ctx; const x0 = this.x, y0 = this.y;
    c.save(); c.font = `${weight} ${px}px ${font}`; c.fillStyle = color; c.strokeStyle = color;
    c.textAlign = align; c.textBaseline = 'middle';
    const lineH = px * 1.18; const top = y0 + h / 2 - (lineH * (text.length - 1)) / 2;
    const tx = align === 'center' ? x0 + w / 2 : align === 'left' ? x0 + px * 0.3 : x0 + w - px * 0.3;
    text.forEach((t, i) => c.fillText(t, tx, top + i * lineH));
    if (box) { c.lineWidth = Math.max(2, px * 0.08); c.strokeRect(x0 + 2, y0 + 2, w - 4, h - 4); }
    c.restore();
    this.x += w + 4; this.rowH = Math.max(this.rowH, h);
    const r = { u0: x0 / this.size, v0: 1 - (y0 + h) / this.size, u1: (x0 + w) / this.size, v1: 1 - y0 / this.size, aspect: w / h };
    this.cache.set(key, r); this.texture.needsUpdate = true; return r;
  }

  // A label plane of the given height (m); width follows the text cell's aspect unless given.
  mesh(lines, height, opts = {}, width = null) {
    const r = this.add(lines, opts);
    const w = width ?? height * r.aspect;
    const g = new THREE.PlaneGeometry(w, height);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? r.u1 : r.u0, uv.getY(i) ? r.v1 : r.v0);
    const m = new THREE.Mesh(g, this.material); m.renderOrder = 2; return m;
  }
}
