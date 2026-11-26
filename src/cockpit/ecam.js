// ECAM drawings: Engine / Warning Display (upper) and the System Display pages (lower), drawn from the systems
// state. Layouts follow the A320 page structure (titles, symbols, colours); engines stopped = amber XX.
// Colour code: green = normal / available, amber = caution / not available, white = titles, cyan = units.
const C = { bg: '#04060a', w: '#f2f2f2', g: '#2ee86a', a: '#ff9a1e', c: '#22d3f2', m: '#ff4fd8', y: '#ffe23a', r: '#ff2a2a', grey: '#8a9096' };
const FONT = '"B612", "B612 Mono", sans-serif';

export function canvas(n = 512) { const cv = document.createElement('canvas'); cv.width = cv.height = n * 2; const c = cv.getContext('2d'); c.scale(2, 2); c.fillStyle = C.bg; c.fillRect(0, 0, n, n); c.lineCap = 'round'; c.lineJoin = 'round'; return [cv, c]; }
function txt(c, s, x, y, col, px, align = 'center', weight = 600) { c.fillStyle = col; c.font = `${weight} ${px}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y); }
const line = (c, pts, col, w = 2.5) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
const box = (c, x, y, w, h, col, lw = 2) => { c.strokeStyle = col; c.lineWidth = lw; c.strokeRect(x, y, w, h); };
const title = (c, s) => { txt(c, s, 256, 30, C.w, 26); const w = c.measureText(s).width; line(c, [[256 - w / 2, 46], [256 + w / 2, 46]], C.w, 2); };
const XX = (c, x, y, px = 18) => txt(c, 'XX', x, y, C.a, px);
const fmt = (v, d = 0) => (Math.round(v / (d || 1)) * (d || 1)).toString();

// ---------------------------------------------------------------------------------------------- E/WD
export function ewd(S) {
  // A320neo with CFM LEAP-1A: N1 and EGT gauges, N2 and fuel flow as numbers. Amber XX while the FADEC is unpowered.
  const [cv, c] = canvas(); const E = S.eng || [];
  const arc = (x, y, r, a0, a1, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); };
  const A0 = Math.PI * 0.86, A1 = Math.PI * 2.08;
  const gauge = (x, y, r, val, max, red, ok, digits, avail) => {
    if (!ok) { arc(x, y, r, A0, A1, C.a, 3); txt(c, 'XX', x, y - 4, C.a, 22); return; }
    arc(x, y, r, A0, A1, C.w, 3); arc(x, y, r, A0 + (A1 - A0) * red, A1, C.r, 4);
    c.strokeStyle = C.w; c.lineWidth = 2; for (let k = 0; k <= 5; k++) { const a = A0 + (k / 5) * (A1 - A0); c.beginPath(); c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.lineTo(x + Math.cos(a) * (r - 7), y + Math.sin(a) * (r - 7)); c.stroke(); }
    const a = A0 + (A1 - A0) * Math.min(1, Math.max(0, val / max)); line(c, [[x + Math.cos(a) * 10, y + Math.sin(a) * 10], [x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4)]], C.g, 4);
    box(c, x - 6, y + 6, 62, 30, C.grey, 1.5); txt(c, digits, x + 52, y + 21, C.g, 22, 'right');
    if (avail) txt(c, 'AVAIL', x, y - r - 10, C.g, 15);
  };
  E.forEach((e, i) => {
    const x = i ? 352 : 160, ok = !!e.fadec, av = e.running && S.engStartedAt && S.t - (S.engStartedAt[i] || -99) < 10;
    gauge(x, 82, 52, e.n1, 110, 0.93, ok, e.n1.toFixed(1), av);
    gauge(x, 198, 38, e.egt, 1100, 0.9, ok, String(Math.round(e.egt)), false);
    if (ok) { if (e.starting) { c.fillStyle = '#3a3f45'; c.fillRect(x - 36, 256, 70, 26); } txt(c, e.n2.toFixed(1), x + 30, 270, C.g, 21, 'right'); txt(c, String(Math.round(e.ff / 10) * 10), x + 30, 308, C.g, 21, 'right'); }
    else { XX(c, x, 270); XX(c, x, 308); }
    if (e.ign) txt(c, e.ign ? 'IGN A' : '', x + (i ? 78 : -78), 270, C.g, 14);
    if (e.rev) { box(c, x - 22, 30, 44, 22, C.g, 2); txt(c, 'REV', x, 41, C.g, 16); }
  });
  txt(c, 'N1', 256, 76, C.w, 20); txt(c, '%', 256, 96, C.c, 15); txt(c, 'EGT', 256, 192, C.w, 20); txt(c, '°C', 256, 210, C.c, 15);
  txt(c, 'N2', 256, 262, C.w, 18); txt(c, '%', 256, 280, C.c, 14); txt(c, 'FF', 256, 300, C.w, 18); txt(c, 'KG/H', 256, 318, C.c, 13);
  txt(c, 'FOB :', 16, 346, C.w, 22, 'left'); txt(c, fmt(S.fuel.fob, 20), 104, 346, C.g, 24, 'left'); txt(c, 'KG', 192, 348, C.c, 17, 'left');
  line(c, [[8, 372], [296, 372]], C.w, 3); line(c, [[330, 372], [504, 372]], C.w, 3); line(c, [[316, 384], [316, 496]], C.w, 3);
  // left: warnings, else the T.O memo, else the alignment memo; right: memos
  let y = 394; const right = [];
  for (const w of S.warnings) { txt(c, w.text, 14, y, w.lvl === 3 ? C.r : C.a, 19, 'left'); y += 22; }
  if (!S.warnings.length && S.toMemo) {
    S.toMemo.forEach(([lab, val, done, doneVal], i) => {
      const yy = 394 + i * 19; if (i === 0) txt(c, 'T.O', 14, yy, C.w, 17, 'left');
      const name = i === 0 ? lab.slice(4) : lab;
      if (done) txt(c, name + ' ' + (doneVal || val), 54, yy, C.g, 17, 'left');
      else { txt(c, name, 54, yy, C.c, 17, 'left'); c.font = `600 17px ${FONT}`; const w = c.measureText(name).width; const dots = '.'.repeat(Math.max(2, Math.round((206 - w) / 5))); txt(c, dots + val, 54 + w, yy, C.c, 17, 'left'); }
    });
  }
  for (const m of S.memos) { if (m.t.startsWith('IRS IN ALIGN') && !S.toMemo && y < 480) { txt(c, m.t, 14, y, m.c === 'a' ? C.a : C.g, 19, 'left'); y += 22; } else if (!m.t.startsWith('IRS IN ALIGN')) right.push(m); }
  right.slice(0, 5).forEach((m, i) => txt(c, m.t, 336, 394 + i * 22, m.c === 'a' ? C.a : C.g, 19, 'left'));
  return cv;
}

// ---------------------------------------------------------------------------------------------- SD pages
export function sd(S, page) {
  const [cv, c] = canvas();
  (PAGES[page] || PAGES.DOOR)(c, S);
  // permanent data at the bottom
  line(c, [[10, 470], [502, 470]], C.w, 2.5); line(c, [[172, 470], [172, 510]], C.w, 2.5); line(c, [[340, 470], [340, 510]], C.w, 2.5);
  txt(c, 'TAT', 18, 482, C.w, 15, 'left'); txt(c, '+11', 72, 482, C.g, 16, 'left'); txt(c, '°C', 136, 482, C.c, 14, 'left');
  txt(c, 'SAT', 18, 500, C.w, 15, 'left'); txt(c, '+11', 72, 500, C.g, 16, 'left'); txt(c, '°C', 136, 500, C.c, 14, 'left');
  const d = new Date(); txt(c, String(d.getUTCHours()).padStart(2, '0'), 228, 492, C.g, 20); txt(c, 'H', 256, 494, C.c, 14); txt(c, String(d.getUTCMinutes()).padStart(2, '0'), 284, 492, C.g, 20);
  txt(c, 'GW', 352, 482, C.w, 15, 'left'); txt(c, '--', 412, 482, C.g, 16, 'left'); txt(c, 'KG', 492, 482, C.c, 14, 'right');
  return cv;
}

const PAGES = {
  DOOR(c) {
    title(c, 'DOOR/OXY');
    txt(c, 'CKPT OXY', 430, 32, C.w, 18); txt(c, '1740', 410, 56, C.g, 20); txt(c, 'PSI', 462, 58, C.c, 15);
    c.strokeStyle = C.w; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(256, 64); c.quadraticCurveTo(290, 74, 292, 120); c.lineTo(292, 448); c.quadraticCurveTo(292, 462, 280, 462); c.lineTo(232, 462); c.quadraticCurveTo(220, 462, 220, 448); c.lineTo(220, 120); c.quadraticCurveTo(222, 74, 256, 64); c.stroke();
    line(c, [[220, 280], [110, 322]], C.w); line(c, [[292, 280], [402, 322]], C.w);
    c.strokeStyle = C.g; c.lineWidth = 3; c.strokeRect(246, 86, 20, 12);
    for (const [x, y] of [[236, 112], [266, 112], [272, 160], [246, 196], [270, 220], [230, 302], [270, 302], [230, 330], [270, 330], [270, 374], [270, 398], [230, 436], [270, 436]]) c.strokeRect(x, y, 12, 20);
    c.fillStyle = C.a; c.fillRect(224, 160, 12, 22); txt(c, 'CABIN', 96, 170, C.a, 18, 'left');
    c.strokeStyle = C.a; c.lineWidth = 2; c.setLineDash([5, 4]); line(c, [[160, 170], [222, 170]], C.a, 2); c.setLineDash([]);
    txt(c, 'SLIDE', 168, 316, C.w, 16); txt(c, 'SLIDE', 344, 316, C.w, 16);
  },
  APU(c, S) {
    const A = S.apu; title(c, 'APU');
    // APU GEN box
    const genOk = A.avail && A.n > 95; box(c, 40, 70, 120, 110, genOk ? C.w : C.grey);
    txt(c, 'APU GEN', 100, 86, genOk ? C.w : C.a, 18);
    if (genOk) { txt(c, S.elec.source === 'APU GEN' ? '18' : '0', 110, 112, C.g, 20, 'right'); txt(c, '%', 122, 112, C.c, 15, 'left'); txt(c, '115', 110, 138, C.g, 20, 'right'); txt(c, 'V', 122, 138, C.c, 15, 'left'); txt(c, '400', 110, 164, C.g, 20, 'right'); txt(c, 'HZ', 122, 164, C.c, 15, 'left'); }
    if (A.avail) txt(c, 'AVAIL', 256, 82, C.g, 22);
    // bleed
    txt(c, 'APU BLEED', 400, 90, C.w, 17); box(c, 360, 104, 80, 30, C.w); txt(c, String(A.bleed ? 40 : A.avail ? 38 : 0).padStart(2, ' '), 392, 120, A.avail ? C.g : C.a, 19, 'right'); txt(c, 'PSI', 400, 121, C.c, 14, 'left');
    c.strokeStyle = A.bleed ? C.g : C.g; c.lineWidth = 3; c.beginPath(); c.arc(400, 170, 16, 0, Math.PI * 2); c.stroke(); line(c, A.bleed ? [[400, 154], [400, 186]] : [[384, 170], [416, 170]], C.g, 3); line(c, [[400, 134], [400, 154]], C.g, 3);
    // N and EGT gauges
    const gauge = (x, y, label, val, max, unit, red) => {
      c.strokeStyle = C.w; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 58, Math.PI * 0.75, Math.PI * 2.1); c.stroke();
      if (red) { c.strokeStyle = C.r; c.lineWidth = 4; c.beginPath(); c.arc(x, y, 58, Math.PI * 1.95, Math.PI * 2.1); c.stroke(); }
      const a = Math.PI * 0.75 + (Math.min(val, max) / max) * Math.PI * 1.35; line(c, [[x, y], [x + Math.cos(a) * 54, y + Math.sin(a) * 54]], C.g, 3.5);
      txt(c, label, x - 60, y + 50, C.w, 20, 'left'); box(c, x + 6, y + 24, 70, 28, C.grey, 1.5); txt(c, fmt(val, unit === '%' ? 1 : 5), x + 66, y + 39, C.g, 20, 'right'); txt(c, unit, x + 82, y + 40, C.c, 15, 'left');
    };
    gauge(150, 280, 'N', A.n, 110, '%', false); gauge(150, 410, 'EGT', A.egt, 1100, '°C', true);
    if (A.flap > 0.98) txt(c, 'FLAP OPEN', 380, 300, C.g, 19);
    if (A.shutting && A.cool > 0) txt(c, 'COOLING', 380, 330, C.g, 17);
  },
  ELEC(c, S) {
    const E = S.elec; title(c, 'ELEC');
    const bus = (x, y, w, s, on) => { c.fillStyle = '#1b1f24'; c.fillRect(x, y, w, 26); txt(c, s, x + w / 2, y + 13, on ? C.g : C.a, 17); };
    const src = (x, y, s, on, v, ln) => { box(c, x, y, 92, 92, on ? C.w : C.grey); txt(c, s, x + 46, y + 14, on ? C.w : C.a, 16); if (on) { txt(c, String(v[0]), x + 54, y + 38, C.g, 18, 'right'); txt(c, '%', x + 60, y + 38, C.c, 13, 'left'); txt(c, '115', x + 54, y + 58, C.g, 18, 'right'); txt(c, 'V', x + 60, y + 58, C.c, 13, 'left'); txt(c, '400', x + 54, y + 78, C.g, 18, 'right'); txt(c, 'HZ', x + 60, y + 78, C.c, 13, 'left'); } else if (ln !== false) { XX(c, x + 46, y + 50); } };
    // batteries and DC buses
    for (const [i, x] of [[0, 70], [1, 350]]) { const on = !!S.sim?.bat?.[i]; box(c, x, 64, 92, 56, C.w); txt(c, 'BAT ' + (i + 1), x + 46, 78, C.w, 16); txt(c, S.batV[i].toFixed(0), x + 52, 98, C.g, 18, 'right'); txt(c, 'V', x + 58, 98, C.c, 13, 'left'); txt(c, String(E.batAmp[i] || 0), x + 52, 114, C.g, 15, 'right'); txt(c, 'A', x + 58, 114, C.c, 13, 'left'); }
    bus(30, 150, 110, 'DC 1', E.dc1); bus(201, 106, 110, 'DC BAT', E.dcBat); bus(372, 150, 110, 'DC 2', E.dc2); bus(201, 176, 110, 'DC ESS', E.dcEss);
    bus(30, 300, 110, 'AC 1', E.ac1); bus(201, 300, 110, 'AC ESS', E.acEss); bus(372, 300, 110, 'AC 2', E.ac2);
    for (const [x, s, on] of [[40, 'TR 1', E.ac1], [210, 'ESS TR', false], [380, 'TR 2', E.ac2]]) { box(c, x, 214, 90, 60, on ? C.w : C.grey); txt(c, s, x + 45, 228, on ? C.w : C.grey, 15); if (on) { txt(c, '28', x + 52, 248, C.g, 16, 'right'); txt(c, 'V', x + 56, 248, C.c, 12, 'left'); txt(c, '35', x + 52, 264, C.g, 16, 'right'); txt(c, 'A', x + 56, 264, C.c, 12, 'left'); } }
    if (E.dc1) line(c, [[85, 214], [85, 176]], C.g); if (E.dc2) line(c, [[427, 214], [427, 176]], C.g); if (E.ac1) line(c, [[85, 300], [85, 274]], C.g); if (E.ac2) line(c, [[427, 300], [427, 274]], C.g);
    // sources: engine generators (engines stopped), APU GEN, EXT PWR
    src(20, 360, 'GEN 1', !!E.gen?.[0], [28]); src(400, 360, 'GEN 2', !!E.gen?.[1], [28]);
    const apuOn = S.apu.avail; src(140, 372, 'APU GEN', apuOn, [S.elec.source === 'APU GEN' ? 18 : 0], apuOn ? undefined : false);
    const ext = S.extAvail; box(c, 280, 372, 92, 80, ext ? C.w : C.grey); txt(c, 'EXT PWR', 326, 386, ext ? C.w : C.grey, 16);
    if (ext) { txt(c, '115', 334, 410, C.g, 18, 'right'); txt(c, 'V', 340, 410, C.c, 13, 'left'); txt(c, '400', 334, 432, C.g, 18, 'right'); txt(c, 'HZ', 340, 432, C.c, 13, 'left'); }
    if (E.source === 'EXT PWR') line(c, [[326, 372], [326, 340], [256, 340], [256, 326]], C.g); if (E.source === 'APU GEN') line(c, [[186, 372], [186, 340], [256, 340], [256, 326]], C.g);
    if (E.ac1 && E.ac2) { line(c, [[140, 313], [201, 313]], C.g); line(c, [[311, 313], [372, 313]], C.g); }
    txt(c, 'IDG 1', 66, 462, C.w, 14); txt(c, 'IDG 2', 446, 462, C.w, 14);
  },
  HYD(c, S) {
    const H = S.hyd; title(c, 'HYD');
    [['GREEN', H.G, 90], ['BLUE', H.B, 256], ['YELLOW', H.Y, 422]].forEach(([n, p, x]) => {
      const ok = p > 1450; txt(c, n, x, 80, ok ? C.w : C.a, 20); txt(c, String(Math.round(p / 50) * 50), x, 106, ok ? C.g : C.a, 22);
      c.fillStyle = ok ? C.g : C.a; c.beginPath(); c.moveTo(x, 122); c.lineTo(x - 9, 136); c.lineTo(x + 9, 136); c.closePath(); c.fill();
      line(c, [[x, 136], [x, 380]], ok ? C.g : C.a, 3);
      box(c, x - 22, 380, 44, 36, C.w); txt(c, n === 'BLUE' ? 'ELEC' : 'ENG', x, 360, C.w, 14); line(c, [[x - 14, 398], [x + 14, 398]], C.a, 3);
      // reservoir
      box(c, x - 6, 430, 12, 30, C.w); c.fillStyle = C.g; c.fillRect(x - 5, 440, 10, 19);
    });
    // PTU between green and yellow
    txt(c, 'PTU', 256, 210, C.w, 17); line(c, [[90, 210], [220, 210]], H.ptu ? C.g : C.grey, 2.5); line(c, [[292, 210], [422, 210]], H.ptu ? C.g : C.grey, 2.5);
    // yellow electric pump
    txt(c, 'ELEC', 470, 260, C.w, 14); box(c, 446, 274, 40, 28, C.w); if (S.hyd.Y > 1450) line(c, [[454, 288], [478, 288]], C.g, 3); else line(c, [[466, 278], [466, 298]], C.a, 3);
  },
  FUEL(c, S) {
    title(c, 'FUEL'); const F = S.fuel; const q = [3780, 3780, 4280, 3780, 3780];
    txt(c, 'F.USED', 256, 68, C.w, 15); txt(c, '1+2', 256, 86, C.w, 15); txt(c, '0', 256, 106, C.g, 20); txt(c, 'KG', 256, 124, C.c, 13);
    txt(c, 'ENG 1', 100, 70, C.w, 17); txt(c, 'ENG 2', 412, 70, C.w, 17); txt(c, 'APU', 256, 156, F.pumps?.some(Boolean) ? C.w : C.grey, 15);
    const pump = (x, y, on) => { box(c, x - 14, y - 14, 28, 28, on ? C.g : C.a); line(c, on ? [[x, y - 9], [x, y + 9]] : [[x - 9, y], [x + 9, y]], on ? C.g : C.a, 3); };
    const tank = (x, w, val) => { box(c, x, 300, w, 80, C.grey, 1.5); txt(c, String(val), x + w / 2, 348, C.g, 21); };
    tank(20, 90, q[0]); tank(110, 90, q[1]); tank(200, 112, q[2]); tank(312, 90, q[3]); tank(402, 90, q[4]); txt(c, 'KG', 256, 395, C.c, 14);
    const P = F.pumps || []; pump(130, 260, P[0]); pump(180, 260, P[1]); pump(232, 260, P[2]); pump(280, 260, P[3]); pump(332, 260, P[4]); pump(382, 260, P[5]);
    line(c, [[100, 90], [100, 230], [412, 230], [412, 90]], C.g, 2.5);
    const xo = F.xfeedOpen >= 1; c.strokeStyle = C.g; c.lineWidth = 3; c.beginPath(); c.arc(256, 230, 15, 0, Math.PI * 2); c.stroke(); line(c, xo ? [[241, 230], [271, 230]] : [[256, 215], [256, 245]], C.g, 3);
    txt(c, 'FOB :', 40, 438, C.w, 20, 'left'); txt(c, String(Math.round(F.fob / 20) * 20), 190, 438, C.g, 22, 'right'); txt(c, 'KG', 200, 440, C.c, 15, 'left');
  },
  BLEED(c, S) {
    title(c, 'BLEED'); const A = S.apu;
    for (const [x, n] of [[100, '1'], [412, '2']]) { txt(c, n, x, 420, C.w, 22); box(c, x - 30, 360, 60, 30, C.w); XX(c, x, 375); txt(c, 'HP', x - 46, 330, C.w, 14); txt(c, 'IP', x + 40, 400, C.w, 14);
      c.strokeStyle = C.g; c.lineWidth = 3; c.beginPath(); c.arc(x, 300, 15, 0, Math.PI * 2); c.stroke(); line(c, [[x - 15, 300], [x + 15, 300]], C.g, 3); }
    line(c, [[100, 260], [412, 260]], A.bleed ? C.g : C.grey, 3);
    c.strokeStyle = C.g; c.lineWidth = 3; c.beginPath(); c.arc(256, 260, 15, 0, Math.PI * 2); c.stroke(); line(c, S.xbleedOpen ? [[241, 260], [271, 260]] : [[256, 245], [256, 275]], C.g, 3); txt(c, 'X BLEED', 256, 236, C.w, 13);
    txt(c, 'APU', 256, 360, C.w, 17); c.beginPath(); c.arc(256, 310, 15, 0, Math.PI * 2); c.stroke(); line(c, A.bleed ? [[256, 295], [256, 325]] : [[241, 310], [271, 310]], C.g, 3); if (A.bleed) line(c, [[256, 295], [256, 260]], C.g, 3);
    for (const [x, i] of [[100, 0], [412, 1]]) { box(c, x - 40, 120, 80, 70, C.w); txt(c, 'PACK ' + (i + 1), x, 210, C.w, 15); txt(c, S.packs?.[i] ? '15' : 'XX', x + 18, 140, S.packs?.[i] ? C.g : C.a, 18, 'right'); txt(c, '°C', x + 22, 140, C.c, 13, 'left'); txt(c, S.packs?.[i] ? '0.9' : '', x, 172, C.g, 16);
      txt(c, 'FLOW', x - 70, 166, C.w, 12); c.strokeStyle = C.g; c.lineWidth = 3; c.beginPath(); c.arc(x, 230, 13, 0, Math.PI * 2); c.stroke(); line(c, S.packs?.[i] ? [[x, 217], [x, 243]] : [[x - 13, 230], [x + 13, 230]], S.packs?.[i] ? C.g : C.a, 3); }
    txt(c, 'RAM', 256, 120, C.w, 14); txt(c, 'AIR', 256, 136, C.w, 14);
    txt(c, 'GND', 330, 336, C.w, 13);
  },
  COND(c, S) {
    title(c, 'COND'); txt(c, 'TEMP :', 360, 70, C.w, 16); txt(c, '°C', 420, 70, C.c, 14, 'left');
    c.strokeStyle = C.w; c.lineWidth = 2.5; c.beginPath(); c.moveTo(60, 230); c.quadraticCurveTo(80, 140, 150, 130); c.lineTo(470, 130); c.lineTo(470, 230); c.closePath(); c.stroke();
    line(c, [[200, 130], [200, 230]], C.w, 2); line(c, [[335, 130], [335, 230]], C.w, 2);
    [['CKPT', 125], ['FWD', 268], ['AFT', 402]].forEach(([n, x], i) => { txt(c, n, x, 150, C.w, 17); txt(c, S.packs?.some(Boolean) ? String(22 + i) : '22', x, 180, C.g, 22); txt(c, String(21 + i), x, 208, C.c, 16); });
    txt(c, 'HOT AIR', 400, 300, C.w, 14);
  },
  PRESS(c, S) {
    title(c, 'CAB PRESS'); txt(c, 'LDG ELEV', 330, 64, C.w, 15); txt(c, 'AUTO', 410, 64, C.g, 15); txt(c, '200', 470, 64, C.g, 16, 'right'); txt(c, 'FT', 480, 64, C.c, 13, 'left');
    const g = (x, label, val, unit) => { c.strokeStyle = C.w; c.lineWidth = 3; c.beginPath(); c.arc(x, 150, 50, Math.PI * 0.8, Math.PI * 2.2); c.stroke(); line(c, [[x, 150], [x - 44, 160]], C.g, 3); txt(c, label, x, 92, C.w, 16); txt(c, val, x + 14, 190, C.g, 19, 'right'); txt(c, unit, x + 18, 191, C.c, 13, 'left'); };
    g(100, 'ΔP', '0.0', 'PSI'); g(256, 'V/S', '0', 'FT/MIN'); g(412, 'CAB ALT', '0', 'FT');
    box(c, 160, 300, 192, 120, C.w, 2); txt(c, 'SAFETY', 256, 330, C.w, 15); txt(c, 'PACK 1', 120, 440, S.packs?.[0] ? C.w : C.a, 15); txt(c, 'PACK 2', 392, 440, S.packs?.[1] ? C.w : C.a, 15);
    txt(c, 'VENT', 90, 300, C.w, 15); txt(c, 'INLET', 90, 330, C.w, 13); txt(c, 'EXTRACT', 90, 360, C.w, 13);
  },
  ENG(c, S) {
    title(c, 'ENG'); const E = S.eng || [];
    txt(c, 'F.USED', 256, 70, C.w, 16); txt(c, 'KG', 256, 90, C.c, 13);
    txt(c, 'OIL', 256, 140, C.w, 17); txt(c, 'QT', 256, 160, C.c, 13); txt(c, 'PSI', 256, 252, C.c, 13); txt(c, '°C', 256, 300, C.c, 13);
    E.forEach((e, i) => {
      const x = i ? 372 : 140, ok = !!e.fadec;
      if (ok) txt(c, '0', x, 90, C.g, 18); else XX(c, x, 90);
      c.strokeStyle = C.w; c.lineWidth = 3; c.beginPath(); c.arc(x, 160, 42, Math.PI * 0.9, Math.PI * 2.1); c.stroke(); txt(c, ok ? '17.5' : 'XX', x, 176, ok ? C.g : C.a, 18);
      c.beginPath(); c.arc(x, 252, 42, Math.PI * 0.9, Math.PI * 2.1); c.stroke();
      if (ok) { const a = Math.PI * 0.9 + Math.PI * 1.2 * Math.min(1, e.oilP / 140); line(c, [[x, 252], [x + Math.cos(a) * 40, 252 + Math.sin(a) * 40]], e.oilP < 13 && e.running ? C.r : C.g, 3); txt(c, String(Math.round(e.oilP)), x, 268, C.g, 18); txt(c, String(Math.round(e.oilT)), x, 300, C.g, 18); }
      else { XX(c, x, 268); XX(c, x, 300); }
      txt(c, ok ? (e.n1 > 1 ? '0.1' : '0.0') : 'XX', x, 340, ok ? C.g : C.a, 17); txt(c, ok ? (e.n2 > 1 ? '0.2' : '0.0') : 'XX', x, 362, ok ? C.g : C.a, 17);
      if (e.ign) txt(c, 'A', x + (i ? 40 : -40), 410, C.g, 18);
      // start valve and bleed pressure during the start
      if (ok && (e.starting || e.running)) { c.strokeStyle = C.g; c.lineWidth = 3; c.beginPath(); c.arc(x, 438, 13, 0, Math.PI * 2); c.stroke(); line(c, e.startValve ? [[x, 425], [x, 451]] : [[x - 13, 438], [x + 13, 438]], C.g, 3); txt(c, String(S.bleedPsi?.[i] ?? 0), x + (i ? 50 : -50), 438, C.g, 17); txt(c, 'PSI', x + (i ? 84 : -84), 439, C.c, 12); }
    });
    txt(c, 'VIB N1', 256, 340, C.w, 15); txt(c, 'N2', 256, 362, C.w, 15); txt(c, 'IGN', 256, 410, C.w, 15);
  },
  WHEEL(c, S) {
    title(c, 'WHEEL'); const tri = (x, y) => { c.strokeStyle = C.g; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 18, y); c.lineTo(x + 18, y); c.lineTo(x, y + 22); c.closePath(); c.stroke(); };
    tri(240, 90); tri(272, 90); tri(96, 250); tri(130, 250); tri(382, 250); tri(416, 250); txt(c, 'L/G', 256, 76, C.w, 13);
    txt(c, 'BRAKES', 256, 330, C.w, 17); for (const [x, n] of [[60, '1'], [130, '2'], [380, '3'], [450, '4']]) { txt(c, '20', x, 360, C.g, 18); txt(c, n, x, 386, C.w, 15); }
    txt(c, '°C', 256, 360, C.c, 13); txt(c, 'REL', 256, 410, C.w, 14);
    if (S.autobrk) txt(c, 'AUTO BRK', 256, 440, C.g, 16);
    txt(c, 'SPLRS', 256, 150, C.w, 14);
  },
  'F/CTL'(c, S) {
    title(c, 'F/CTL'); const ok = S.hyd.G > 1450 || S.hyd.Y > 1450 || S.hyd.B > 1450;
    txt(c, 'SPD BRK', 256, 72, C.w, 16);
    for (let i = 0; i < 5; i++) { line(c, [[150 + i * 20, 100], [150 + i * 20, 110]], ok ? C.g : C.a, 3); line(c, [[290 + i * 20, 100], [290 + i * 20, 110]], ok ? C.g : C.a, 3); }
    txt(c, 'L AIL', 70, 150, C.w, 16); txt(c, 'R AIL', 440, 150, C.w, 16); txt(c, 'L ELEV', 70, 330, C.w, 16); txt(c, 'R ELEV', 440, 330, C.w, 16);
    for (const x of [70, 440]) { line(c, [[x, 170], [x, 260]], C.w, 2); line(c, [[x, 350], [x, 430]], C.w, 2); }
    txt(c, 'RUD', 256, 370, C.w, 16); c.strokeStyle = C.w; c.lineWidth = 2.5; c.beginPath(); c.arc(256, 380, 60, Math.PI * 0.25, Math.PI * 0.75); c.stroke();
    txt(c, 'PITCH TRIM', 256, 230, C.w, 15); txt(c, '0.0°', 256, 252, C.g, 17);
    for (const [x, s] of [[150, 'ELAC'], [300, 'SEC']]) { txt(c, s, x, 190, C.w, 14); [1, 2, 3].slice(0, s === 'ELAC' ? 2 : 3).forEach((n, i) => { box(c, x + 22 + i * 22, 180, 18, 22, C.g, 1.5); txt(c, String(n), x + 31 + i * 22, 191, C.g, 13); }); }
    txt(c, ok ? 'G B Y' : 'G B Y', 256, 300, ok ? C.g : C.a, 16);
  },
};

// ---------------------------------------------------------------------------------------------- self test / init
export function selfTest(n = 512) {
  const [cv, c] = canvas(n); const k = n / 512;
  txt(c, 'SELF TEST IN PROGRESS', 256 * k, 236 * k, C.g, 24 * k); txt(c, '(MAX 40 SECONDS)', 256 * k, 272 * k, C.g, 20 * k); return cv;
}
export function isisInit(sec) {
  const [cv, c] = canvas(256); txt(c, 'INIT', 128, 110, C.a, 26); txt(c, Math.ceil(sec) + 's', 128, 146, C.a, 22); return cv;
}
