// A320 aircraft systems, on the ground, engines stopped (engines, autopilot and flight model come in phase 5).
// Reads controls by their fixed ids, works out what is powered / pressurised / running, and sets every light,
// display and cockpit lighting level. Nothing here refers to 3D geometry; the cockpit only *shows* the results.
//
// Behaviour follows the A320 flight crew documentation as published (FCOM system descriptions), simplified where
// noted: values (pressures, voltages, temperatures) follow plausible curves rather than certified data.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, t, rate, dt) => v + (t - v) * Math.min(1, rate * dt);

export class Systems {
  constructor(sim, env) {
    this.sim = sim; this.env = env;   // env: hooks into the cockpit (screens, lights) supplied by main.js
    this.t = 0;
    const S = this.s = {
      ground: true, gs: 0,
      extAvail: true, extOn: false,                                   // ground power unit connected; EXT PWR selected
      apu: { flap: 0, n: 0, egt: 20, starting: false, avail: false, cool: 0, availT: 0, shutting: false, bleed: false },
      elec: {}, batV: [26.6, 26.6],
      adirs: [0, 1, 2].map(() => ({ mode: 0, align: 0, aligned: false, onBat: 0, test: 0 })),
      hyd: { G: 0, B: 0, Y: 0, ptu: false },
      fuel: { xfeedOpen: 0, fob: 19080 },
      wingTest: 0, warnings: [], memos: [], masterWarn: false, masterCaut: false, warnAck: new Set(),
      fire: { eng1: false, eng2: false, apu: false }, agentDisch: new Set(),
      sdManual: null, sdAuto: null, sdApuUntil: 0,
      autobrk: null, squawk: '7000', sqEntry: '', rudTrim: 0, pitchTrim: 0.0,
      masks: false, evac: false, extLtFlash: 0, mcduScratch: ['', ''],
      eng: [0, 1].map(() => ({ n1: 0, n2: 0, egt: 20, ff: 0, oilP: 0, oilT: 20, starting: false, running: false, t: 0, ign: false, fuel: false, startValve: false, rev: false })),
      tla: [0, 0], engStartedT: null, toConfigT: null,
      ap: { ap1: false, ap2: false, athr: false, cont: false, onceT: -99, athrOffT: -99 },
      // FCU: power-up state - speed, heading and V/S managed (dashes, dot), altitude 100 ft
      fcuS: { spd: 100, hdg: 0, alt: 100, vs: 0, spdSel: false, hdgSel: false, vsSel: false, prevSpd: 0, prevHdg: 0, prevVs: 0, mach: false, trk: false, baro: [1013, 1013], std: [false, false], inHg: [false, false] },
      rmp: [0, 1].map(() => ({ ch: 'VHF1', freq: { VHF1: ['118.700', '121.800'], VHF2: ['121.500', '122.800'], VHF3: ['DATA', '131.725'], HF1: ['2.850', '3.016'], HF2: ['5.505', '6.604'] } })),
    };
    this.screensState = {};
    sim.on((c, ev, data) => this.onEvent(c, ev, data));
  }
  v(id) { return this.sim.val(id); }
  c(id) { return this.sim.get(id); }

  // ------------------------------------------------------------------ discrete events (key presses)
  onEvent(c, ev, data) {
    const S = this.s, id = c.id;
    if (c.kind === 'fcu' || /^(FCU|rmp|EFIS)/.test(id)) this.fcuEvent(c, ev, data);
    if (ev === 'down') {
      if (id === 'elec.extPwr' && this.dcOrExt()) { if (S.extAvail) S.extOn = !S.extOn; }
      else if (id === 'apu.apuStart') { if (this.v('apu.apuMaster') && this.dc() && !S.apu.avail && !S.apu.starting && S.apu.flap > 0.95) S.apu.starting = true; }
      else if (id.startsWith('ecamCP.ecp_') && /CLR/.test(id)) { for (const w of S.warnings) S.warnAck.add(w.text); }
      else if (id === 'ecamCP.TOCONFIG') S.toConfigT = this.t;
      else if (/^FCU\.(AP1|AP2|ATHR)$/.test(id) || /\.apDisc$/.test(id) || /^thrust\.athrDisc/.test(id)) this.autoflight(id);
      else if (id === 'ecamCP.ecp_ALL') { const P = ['ENG', 'BLEED', 'PRESS', 'ELEC', 'HYD', 'FUEL', 'APU', 'COND', 'DOOR', 'WHEEL', 'F/CTL']; const i = P.indexOf(S.sdManual); S.sdManual = P[(i + 1) % P.length]; this.syncSdKeys(); }
      else if (/^glareSide-?1\.master(Warn|Caut)$/.test(id)) { for (const w of S.warnings) S.warnAck.add(w.text); if (/Warn$/.test(id)) S.ap.cont = false; }
      else if (/^atc\.atc[0-9]$/.test(id)) { S.sqEntry = (S.sqEntry + id.slice(-1)).slice(-4); if (S.sqEntry.length === 4) { S.squawk = S.sqEntry; S.sqEntry = ''; } }
      else if (id === 'atc.atcCLR') S.sqEntry = '';
      else if (id === 'rudderTrim.rudReset') S.rudTrimReset = true;
      else if (/^fire\.agent/.test(id)) { const which = id.includes('APU') ? 'fireAPU' : id.includes('ENG1') ? 'fireENG1' : 'fireENG2'; if (!this.v('fire.' + which) && this.dc()) S.agentDisch.add(id); }
      else if (id === 'oxygen.maskManOn' && this.dc()) S.masks = true;
      else if (id === 'evac.hornShutOff') S.evacHornOff = true;
      const mk = /^mcdu(1|2)\.(.+)$/.exec(id);
      if (mk && (mk[1] === '1' ? S.elec.acEss : S.elec.ac2)) {   // scratchpad typing (page logic comes with the FMS in phase 5)
        const i = +mk[1] - 1, k = mk[2]; let sp = S.mcduScratch[i];
        if (k.length === 1 && /[A-Z0-9./]/.test(k)) sp += k; else if (k === 'SP') sp += ' '; else if (k === 'PLUSMINUS') sp = sp.endsWith('-') ? sp.slice(0, -1) + '+' : sp.endsWith('+') ? sp.slice(0, -1) + '-' : sp + '-'; else if (k === 'CLR') sp = sp.slice(0, -1); else if (k === 'OVFY') sp += 'Δ';
        S.mcduScratch[i] = sp.slice(0, 22);
      }
    }
    if (ev === 'change' && c.kind === 'radio' && c.def.group === 'sd') { S.sdManual = c.value ? id.split('_')[1] : null; }
    if (ev === 'change' && /^EFIS(1|2)\.baroUnit$/.test(id)) S.fcuS.inHg[+id[4] - 1] = c.value === 0;
    if (ev === 'change' && id === 'evac.evacCmd') S.evacHornOff = false;
    if (ev === 'change' && c.kind === 'radio' && c.def.group === 'abrk' && c.value && !this.autobrakeOk()) { c.value = false; this.sim.visual(c); }
  }

  // ------------------------------------------------------------------ FCU, baro, RMP (turn / push / pull)
  fcuEvent(c, ev, dir) {
    const F = this.s.fcuS, id = c.id, now = this.t;
    if (id === 'FCU.kSPD') { if (ev === 'turn') { F.spd = Math.max(100, Math.min(399, F.spd + dir)); if (!F.spdSel) F.prevSpd = now + 45; } if (ev === 'pull') F.spdSel = true; if (ev === 'push') { F.spdSel = false; F.prevSpd = 0; } }
    if (id === 'FCU.kHDG') { if (ev === 'turn') { F.hdg = (F.hdg + dir + 360) % 360; if (!F.hdgSel) F.prevHdg = now + 45; } if (ev === 'pull') F.hdgSel = true; if (ev === 'push') { F.hdgSel = false; F.prevHdg = 0; } }
    if (id === 'FCU.kALT' && ev === 'turn') F.alt = Math.max(100, Math.min(49000, F.alt + dir * 100));
    if (id === 'FCU.kVS') { if (ev === 'turn') { F.vs = Math.max(-6000, Math.min(6000, F.vs + dir * 100)); if (!F.vsSel) F.prevVs = now + 45; } if (ev === 'pull') { F.vsSel = true; } if (ev === 'push') { F.vs = 0; F.vsSel = true; } }
    if (id === 'FCU.spdMach' && ev === 'down') F.mach = !F.mach;
    if (id === 'FCU.hdgvs' && ev === 'down') F.trk = !F.trk;
    const m = /^EFIS(1|2)\.baro$/.exec(id); if (m) { const i = +m[1] - 1; if (ev === 'turn' && !F.std[i]) F.baro[i] = Math.max(745, Math.min(1100, F.baro[i] + dir)); if (ev === 'pull') F.std[i] = !F.std[i]; if (ev === 'push') F.std[i] = false; }
    const r = /^rmp(1|2)\.(freq|freqInner)$/.exec(id); if (r && ev === 'turn') { const R = this.s.rmp[+r[1] - 1]; const f = R.freq[R.ch]; if (f && f[1] !== 'DATA') { let [mhz, khz] = f[1].split('.').map(Number); if (r[2] === 'freq') mhz = Math.max(118, Math.min(136, mhz + dir)); else khz = (khz + dir * 25 + 1000) % 1000; f[1] = mhz + '.' + String(khz).padStart(3, '0'); } }
    const x = /^rmp(1|2)\.xfer$/.exec(id); if (x && ev === 'down') { const R = this.s.rmp[+x[1] - 1]; const f = R.freq[R.ch]; if (f) R.freq[R.ch] = [f[1], f[0]]; }
    const k = /^rmp(1|2)\.rmp(VHF1|VHF2|VHF3|HF1|HF2)$/.exec(id); if (k && ev === 'change' && c.value) this.s.rmp[+k[1] - 1].ch = k[2];
  }
  fcuShow() {
    const F = this.s.fcuS, now = this.t; const p3 = (n) => String(n).padStart(3, '0');
    const baro = [0, 1].map((i) => (F.std[i] ? 'Std' : F.inHg[i] ? String(Math.round(F.baro[i] * 2.953)).padStart(4, '0') : String(F.baro[i]).padStart(4, '0')));
    this.s.fcu = {
      spd: F.spdSel || F.prevSpd > now ? (F.mach ? '.' + String(Math.round(F.spd / 5)).padStart(2, '0') : p3(F.spd)) : '---', spdM: !F.spdSel,
      hdg: F.hdgSel || F.prevHdg > now ? p3(F.hdg) : '---', hdgM: !F.hdgSel,
      alt: String(F.alt).padStart(5, '0'), altM: true,
      vs: F.vsSel || F.prevVs > now ? (F.vs < 0 ? '-' : '+') + String(Math.abs(F.vs) / 100).padStart(2, '0') + 'oo' : '-----', trk: F.trk, mach: F.mach, baro,
    };
    this.s.rmpAct = this.s.rmp.map((R) => R.freq[R.ch]?.[0] || ''); this.s.rmpStby = this.s.rmp.map((R) => R.freq[R.ch]?.[1] || '');
  }

  // ------------------------------------------------------------------ autopilot / autothrust engage and disconnect
  // FCU AP 1 / AP 2: push to engage, push again to disconnect. Disconnecting from the FCU is not the instinctive way:
  // the cavalry charge repeats with MASTER WARN and red AP OFF until the sidestick pushbutton or MASTER WARN is pressed.
  // Sidestick pushbutton: instinctive disconnect - the cavalry charge sounds once (a second press silences it),
  // MASTER WARN for 3 s, AP OFF for 9 s. A/THR: FCU pushbutton or the red buttons on the thrust levers - single
  // chime and amber A/THR OFF.
  autoflight(id) {
    const S = this.s, P = S.ap, fcu = S.elec.dcEss;
    if (id === 'FCU.AP1' || id === 'FCU.AP2') {
      if (!fcu) return; const k = id === 'FCU.AP1' ? 'ap1' : 'ap2';
      if (P[k]) { P[k] = false; if (!P.ap1 && !P.ap2) { P.cont = true; this.sound?.apWarning(true); } }
      else { P[k] = true; if (k === 'ap1') P.ap2 = false; else P.ap1 = false; P.cont = false; this.sound?.apWarning(false); }
    } else if (/\.apDisc$/.test(id)) {
      if (P.cont) { P.cont = false; this.sound?.apWarning(false); return; }
      if (P.ap1 || P.ap2) { P.ap1 = P.ap2 = false; P.onceT = this.t; this.sound?.apOnce(); }
      else if (this.t - P.onceT < 9) this.sound?.apOnce();   // second press: silences the remaining tones
    } else if (id === 'FCU.ATHR' || /^thrust\.athrDisc/.test(id)) {
      if (!fcu) return;
      if (P.athr) { P.athr = false; P.athrOffT = this.t; }
      else if (id === 'FCU.ATHR') P.athr = true;
    }
  }
  syncSdKeys() { for (const p of ['ENG', 'BLEED', 'PRESS', 'ELEC', 'HYD', 'FUEL', 'APU', 'COND', 'DOOR', 'WHEEL', 'F/CTL']) { const k = this.c('ecamCP.ecp_' + p); if (k) k.value = this.s.sdManual === p; } }

  // ------------------------------------------------------------------ power
  dc() { return this.s.elec.dcEss; }
  dcOrExt() { return this.s.elec.dcEss || this.s.extAvail; }
  ac() { return this.s.elec.ac; }
  autobrakeOk() { return this.s.hyd.G > 1450 && this.v('gearBrake.askid') === 0 && this.s.elec.dc1; }

  // ------------------------------------------------------------------ simulation step
  tick(dt) {
    const S = this.s, sim = this.sim; this.t += dt; const t = this.t;
    const bat1 = this.v('elec.bat1'), bat2 = this.v('elec.bat2');
    // --- APU (needs DC for its ECB; the air intake flap opens first, start ~ 50 s to AVAIL at 95 % N)
    const A = S.apu; const master = this.v('apu.apuMaster') && !this.fireReleased('fireAPU');
    const dcForApu = (bat1 || bat2) || S.extOn;
    if (master && dcForApu) { A.flap = Math.min(1, A.flap + dt / 20); A.shutting = false; }
    if (A.starting) { A.n = Math.min(100, A.n + dt * (A.n < 20 ? 1.2 : A.n < 60 ? 2.6 : 1.8)); A.egt = approach(A.egt, A.n < 50 ? 120 + A.n * 14 : 860 - (A.n - 50) * 9, 0.6, dt); if (A.n >= 95) { A.avail = true; A.starting = false; A.availT = t; } }
    if (A.avail || (A.n > 95 && !A.shutting)) { A.n = approach(A.n, 100, 0.5, dt); A.egt = approach(A.egt, A.bleed ? 520 : 390, 0.2, dt); }
    if (!master && (A.avail || A.starting)) { A.starting = false; if (!A.shutting) { A.shutting = true; A.cool = A.bleed ? 60 : 0; } }
    if (A.shutting) { A.cool -= dt; if (A.cool <= 0) { A.avail = false; A.n = Math.max(0, A.n - dt * 7); A.egt = approach(A.egt, 20, 0.05, dt); if (A.n <= 7 && A.flap > 0) A.flap = Math.max(0, A.flap - dt / 20); if (A.n <= 0) A.shutting = false; } }
    else if (!master && !A.starting && A.n <= 0) { A.flap = Math.max(0, A.flap - dt / 20); A.egt = approach(A.egt, 20, 0.05, dt); }
    A.bleed = A.avail && this.v('airCond.apuBleed') && !A.shutting;
    // --- engines (CFM LEAP-1A, FADEC automatic start). With ENG MODE IGN/START, MASTER ON opens the start valve:
    // the starter dry-motors N2, ignition at ~16 % N2, fuel at ~20 %, light-off, starter cut-out near 50 %, idle ~60 % N2.
    // The timeline follows the owner's engine start recording (about 60 s to stabilised idle).
    const START = [[0, 0], [2, 2], [8, 14], [16, 20], [22, 23], [35, 35], [48, 50], [56, 58], [60.4, 60.2]];
    const lerpT = (tab, x) => { for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [a0, b0] = tab[i - 1], [a1, b1] = tab[i]; return b0 + (b1 - b0) * (x - a0) / (a1 - a0); } return tab[tab.length - 1][1]; };
    const mode = this.v('engPanel.mode');
    const xb = this.v('airCond.xbleed'); const bleedAvail = (k) => A.bleed || ((xb === 2) && S.eng[1 - k].running && !!this.v('airCond.eng' + (2 - k) + 'Bleed'));   // APU bleed, or the other engine through an open crossbleed
    S.tla = [this.v('thrust.lever1') ?? 0, this.v('thrust.lever2') ?? 0];
    S.eng.forEach((E, k) => {
      const n = k + 1; const master = this.v('engPanel.master' + n) === 1 && !this.fireReleased('fireENG' + n);
      const fadec = mode === 2 || master || E.running;
      if (!master) {   // fuel off: run down
        if (E.starting || E.running) { E.starting = false; E.running = false; E.fuel = false; E.ign = false; E.startValve = false; }
        E.n2 = Math.max(0, approach(E.n2, -2, 0.06, dt)); E.n1 = Math.max(0, approach(E.n1, -1, 0.14, dt)); E.ff = 0; E.egt = approach(E.egt, 20, E.egt > 200 ? 0.08 : 0.02, dt);   // run-down after fuel cut-off
      } else if (!E.running && !E.starting && mode === 2 && bleedAvail(k) && E.n2 < 20) { E.starting = true; E.t = 0; E.startValve = true; }
      if (E.starting) {
        if (!bleedAvail(k) && E.t < 48) { E.startValve = false; }   // no air: the starter cannot turn the engine
        else { E.t += dt; E.startValve = E.t < 48;
          E.n2 = lerpT(START, E.t); E.ign = E.t > 12 && E.t < 50; E.fuel = E.t > 17;
          E.n1 = E.t < 16 ? E.n2 * 0.08 : lerpT([[16, 1.5], [22, 3], [35, 8], [48, 14], [56, 18.5], [60.4, 19.6]], E.t);
          E.egt = E.t < 19 ? approach(E.egt, 25, 0.1, dt) : lerpT([[19, 60], [24, 320], [30, 520], [40, 640], [48, 610], [56, 500], [60.4, 460]], E.t);
          E.ff = E.fuel ? lerpT([[17, 90], [24, 150], [40, 230], [48, 260], [60.4, 240]], E.t) : 0;
          if (E.t >= 60.4) { E.starting = false; E.running = true; E.startValve = false; E.ign = false; S.engStartedT = this.t; (S.engStartedAt ||= [])[k] = this.t; } }
      }
      if (E.running) {   // thrust lever sets N1 (static, on the ground); reverse below idle
        const tla = S.tla[k]; E.rev = tla < -2;
        const n1t = tla >= 0 ? 19.6 + (tla <= 22 ? tla / 22 * 61 : tla <= 33 ? 80.6 + (tla - 22) / 11 * 6.4 : 87 + (tla - 33) / 12 * 6) : 19.6 + (-tla / 14) * 52;
        const up = n1t > E.n1; E.n1 = approach(E.n1, n1t, up ? 0.35 : 0.25, dt);
        E.n2 = 60.2 + (E.n1 - 19.6) * 0.47; E.egt = approach(E.egt, 460 + (E.n1 - 19.6) * 4.5, 0.4, dt); E.ff = 240 + Math.pow(Math.max(0, E.n1 - 19.6) / 74, 1.7) * 5200;
      }
      E.oilP = approach(E.oilP, E.n2 > 5 ? 20 + E.n2 * 0.9 : 0, 0.5, dt); E.oilT = approach(E.oilT, E.running ? 75 : 20, 0.01, dt);
      E.fadec = fadec;
    });
    S.engStarting = S.eng.some((E) => E.starting);
    // --- electrical network: engine generators first, then EXT PWR, then the APU generator; batteries give DC only
    if (!S.extAvail) S.extOn = false;
    const apuGenOn = A.avail && this.v('elec.apuGen') && A.n > 95;
    const extSupplies = S.extOn && S.extAvail;
    const gen = [0, 1].map((k) => S.eng[k].running && S.eng[k].n2 > 57 && !!this.v('elec.gen' + (k + 1)));
    const ac = extSupplies || apuGenOn;   // a ground / APU source is on line
    const E = S.elec; E.gen = gen;
    // each engine generator feeds its own AC bus; EXT PWR / APU GEN (between the two bus tie contactors) feed whatever
    // side has no generator; with one generator only, BUS TIE AUTO lets it feed both sides
    const tie = !!this.v('elec.busTie');
    E.ac1 = gen[0] || (tie && (ac || gen[1])); E.ac2 = gen[1] || (tie && (ac || gen[0])); E.ac = E.ac1 || E.ac2;
    E.src1 = gen[0] ? 'GEN 1' : extSupplies ? 'EXT PWR' : apuGenOn ? 'APU GEN' : gen[1] ? 'GEN 2' : null; E.src2 = gen[1] ? 'GEN 2' : extSupplies ? 'EXT PWR' : apuGenOn ? 'APU GEN' : gen[0] ? 'GEN 1' : null;
    E.acEss = this.v('elec.acEssFeed') ? E.ac1 : E.ac2;
    E.dc1 = E.ac1; E.dc2 = E.ac2; E.dcBat = E.dc1 || E.dc2 || bat1 || bat2;
    E.dcEss = E.acEss || E.dcBat;          // DC ESS: ESS TR / DC BAT bus, or BAT 2 direct when only batteries
    E.source = gen[0] || gen[1] ? 'GEN' : extSupplies ? 'EXT PWR' : apuGenOn ? 'APU GEN' : (bat1 || bat2) ? 'BAT' : null;
    E.shed = !ac;
    // battery voltage (always readable: hot bus): resting ~25.8 V, charging ~28 V, slowly drains on load
    for (const [i, on] of [[0, bat1], [1, bat2]]) {
      const charging = on && E.dc1; const load = on && !E.dc1;
      S.batV[i] = approach(S.batV[i], charging ? 28.3 : load ? 26.0 : 26.6, charging ? 0.05 : 0.02, dt);   // as read in the owner's sim-cockpit recording
    }
    E.batAmp = [0, 1].map((i) => ([bat1, bat2][i] && E.dc1 ? Math.max(0, Math.round((28.2 - S.batV[i]) * 40)) : ([bat1, bat2][i] ? -12 : 0)));
    // --- ADIRS: OFF / NAV / ATT; alignment about 7 min in NAV, 30 s in ATT; ON BAT while on battery power
    S.adirs.forEach((ir, i) => {
      const n = [1, 3, 2][i]; const mode = this.v('adirs.irSel' + n); const powered = E.acEss || (E.dcEss && (bat1 || bat2));
      if (mode === 0 || !powered) { if (mode === 0) { ir.align = 0; ir.aligned = false; ir.mode = 0; } return; }
      if (ir.mode === 0) { ir.mode = mode; ir.align = mode === 1 ? 420 : 30; ir.aligned = false; ir.test = 5; }
      ir.mode = mode; ir.test = Math.max(0, ir.test - dt);
      if (!ir.aligned) { ir.align -= dt; if (ir.align <= 0) { ir.aligned = true; ir.align = 0; } }
      ir.onBat = ir.test > 0 || !E.acEss;
    });
    S.anyIrAligning = S.adirs.some((ir) => ir.mode && !ir.aligned);
    S.irAlignMin = Math.ceil(Math.max(0, ...S.adirs.map((ir) => (ir.mode && !ir.aligned ? ir.align : 0))) / 60);
    // --- hydraulics (engines stopped): yellow electric pump; blue electric pump only with an engine running or
    // BLUE PUMP OVRD; the PTU carries yellow pressure across to green (and the reverse) when the difference exceeds 500 psi
    const H = S.hyd;
    const yEl = this.v('hyd.yellowElec') && E.ac2;
    const bEl = this.v('hyd.blueElec') && E.ac1 && (this.v('maint.bluePumpOvrd') || S.eng.some((o) => o.running));
    const gEng = this.v('hyd.eng1Pump') && S.eng[0].n2 > 20, yEng = this.v('hyd.eng2Pump') && S.eng[1].n2 > 20;
    H.Y = approach(H.Y, yEl || yEng ? 3000 : 0, yEl || yEng ? 1.6 : 0.08, dt);
    H.B = approach(H.B, bEl ? 3000 : 0, bEl ? 1.6 : 0.08, dt);
    const ptuOk = this.v('hyd.ptu') && E.dc2;
    const ptuDrive = ptuOk && H.Y > 1500; H.ptu = ptuDrive && H.Y - H.G > 200;
    H.G = approach(H.G, gEng ? 3000 : ptuDrive ? H.Y * 0.98 : 0, gEng ? 1.6 : ptuDrive ? 0.5 : 0.08, dt);
    // --- fuel: pumps need AC; crossfeed valve takes ~2 s
    S.fuel.xfeedOpen = clamp(S.fuel.xfeedOpen + (this.v('fuel.xfeed') && E.dcEss ? dt / 2 : -dt / 2), 0, 1);
    S.fuel.pumps = ['ltk1', 'ltk2', 'ctr1', 'ctr2', 'rtk1', 'rtk2'].map((p) => this.v('fuel.' + p) && E.ac);
    // --- bleed and packs (engines stopped: APU bleed only); X BLEED AUTO opens with the APU bleed valve
    const xbSel = this.v('airCond.xbleed'); S.xbleedOpen = xbSel === 2 || (xbSel === 1 && A.bleed);
    S.engBleed = [0, 1].map((k) => S.eng[k].running && this.v('airCond.eng' + (k + 1) + 'Bleed') && !A.bleed);   // APU bleed has priority: engine bleed valves close
    const air = [0, 1].map((k) => A.bleed || S.engBleed[k] || (S.xbleedOpen && S.engBleed[1 - k]));
    S.packs = [1, 2].map((n) => this.v('airCond.pack' + n) && air[n - 1] && E.dc1 && !S.engStarting);   // pack valves close during engine start
    S.bleedPsi = [0, 1].map((k) => (air[k] ? (S.engBleed[k] ? 44 : 40) : 0));
    // --- anti ice: on the ground WING ANTI ICE opens its valves for a 30 s test only
    if (this.v('antiIce.wing')) { if (S.wingWas !== true) S.wingTest = 30; S.wingTest = Math.max(0, S.wingTest - dt); } else S.wingTest = 0; S.wingWas = this.v('antiIce.wing');
    // --- fire: engine / APU fire test (hold), fire pushbuttons, agents
    const test = (k) => sim.get('fire.test' + k)?.down && E.dcEss;
    S.fire.test = { ENG1: test('ENG1'), ENG2: test('ENG2'), APU: test('APU') };
    // --- cargo smoke test, pax oxygen, evacuation
    S.cargoTest = sim.get('cargoSmoke.smokeTest')?.down && E.dcEss;
    S.evac = this.v('evac.evacCmd') && E.dcEss;
    // --- trims
    const rt = this.v('rudderTrim.rudTrim'); if (rt && E.dcEss) S.rudTrim = clamp(S.rudTrim + rt * dt * 1.0, -20, 20);
    if (S.rudTrimReset) { S.rudTrim = approach(S.rudTrim, 0, 1.5, dt); if (Math.abs(S.rudTrim) < 0.05) { S.rudTrim = 0; S.rudTrimReset = false; } }
    // --- autobrake loses its arming when its conditions go
    if (!this.autobrakeOk()) for (const k of ['abrkLO', 'abrkMED', 'abrkMAX']) { const c = this.c('gearBrake.' + k); if (c && c.value) { c.value = false; } }
    // --- warnings and memos, ECAM page selection, then every light and display
    this.fcuShow(); S.t = this.t;
    this.ecamLogic(dt);
    this.lights();
    this.cockpitLighting();
    this.displays(dt);
    sim.dirty = true;
  }
  fireReleased(id) { return this.v('fire.' + id) === false; }

  // ------------------------------------------------------------------ ECAM: warnings, memos and the SD page
  ecamLogic() {
    const S = this.s, E = S.elec, A = S.apu; const W = [], Mm = [];
    if (S.fire.test.ENG1) W.push({ text: 'ENG 1 FIRE', lvl: 3 }); if (S.fire.test.ENG2) W.push({ text: 'ENG 2 FIRE', lvl: 3 }); if (S.fire.test.APU) W.push({ text: 'APU FIRE', lvl: 3 });
    if (S.cargoTest) W.push({ text: 'CARGO SMOKE', lvl: 3 });
    if (S.evac) W.push({ text: 'EVAC', lvl: 3 });
    const AP = S.ap;
    if (AP.cont || this.t - AP.onceT < 9) W.push({ text: 'AUTO FLT AP OFF', lvl: 3, ap: true });
    if (this.t - AP.athrOffT < 9) W.push({ text: 'AUTO FLT A/THR OFF', lvl: 2 });
    S.warnings = W.filter((w) => !w.memo);
    // memos (green), in the order the E/WD lists them
    if (S.anyIrAligning) Mm.push({ t: `IRS IN ALIGN ${S.irAlignMin} MN`, c: S.eng.some((e) => e.running || e.starting) ? 'a' : 'g' });
    // T.O MEMO: 2 min after the second engine start (or T.O CONFIG pressed), until take-off power
    const bothRun = S.eng.every((e) => e.running);
    if (bothRun && S.engStartedT != null && (this.t - S.engStartedT > 120 || S.toConfigT != null)) {
      const abMax = !!this.v('gearBrake.abrkMAX'), signs = this.v('signsIntLt.seatBelts') === 0 && this.v('signsIntLt.noSmoking') !== 2;
      const splr = !!this.sim.get('speedbrake.lever')?.armed && this.v('speedbrake.lever') === 0, fl = this.v('flaps.lever'), flapsTo = fl >= 1 && fl <= 3;
      const cfgOk = S.toConfigT != null && flapsTo && Math.abs(S.pitchTrimDeg ?? 0) < 4 && this.v('speedbrake.lever') === 0 && !this.v('parkBrake.handle');
      S.toMemo = [['T.O AUTO BRK', 'MAX', abMax], ['SIGNS', 'ON', signs], ['CABIN', 'CHECK', false], ['SPLRS', 'ARM', splr], ['FLAPS', 'T.O', flapsTo], ['T.O CONFIG', 'TEST', cfgOk, 'NORMAL']];
    } else S.toMemo = null;
    if (this.v('signsIntLt.seatBelts') === 0) Mm.push({ t: 'SEAT BELTS', c: 'g' });
    if (this.v('signsIntLt.noSmoking') !== 2) Mm.push({ t: 'NO SMOKING', c: 'g' });
    if ([this.v('extLt.landL'), this.v('extLt.landR')].some((p) => p !== 2)) Mm.push({ t: 'LDG LT', c: 'g' });
    if (this.v('airCond.ramAir')) Mm.push({ t: 'RAM AIR ON', c: 'g' });
    if (this.v('antiIce.eng1') || this.v('antiIce.eng2')) Mm.push({ t: 'ENG A.ICE', c: 'g' });
    if (this.v('antiIce.wing')) Mm.push({ t: 'WING A.ICE', c: 'g' });
    if (this.v('parkBrake.handle')) Mm.push({ t: 'PARK BRK', c: 'g' });
    if (this.v('speedbrake.lever') === 0 && this.sim.get('speedbrake.lever')?.armed) Mm.push({ t: 'GND SPLRS ARMED', c: 'g' });
    if (S.hyd.ptu) Mm.push({ t: 'HYD PTU', c: 'g' });
    if (A.avail && !A.bleed) Mm.push({ t: 'APU AVAIL', c: 'g' });
    if (A.bleed) Mm.push({ t: 'APU BLEED', c: 'g' });
    if (this.v('maint.svceInt')) Mm.push({ t: 'SVCE INT OVRD', c: 'g' });
    if (this.v('engMan.manStart1') || this.v('engMan.manStart2')) Mm.push({ t: 'MAN START', c: 'g' });
    if (this.v('atc.tcasMode') === 0) Mm.push({ t: 'TCAS STBY', c: 'g' });
    if (S.masks) Mm.push({ t: 'PAX OXY MASKS DEPLOYED', c: 'a' });
    S.memos = Mm;
    // master warning / caution lights (flashing red / steady amber until acknowledged)
    // MASTER WARN: unacknowledged red warnings; the instinctive AP disconnect flashes it for 3 s only
    S.masterWarn = S.warnings.some((w) => w.lvl === 3 && !S.warnAck.has(w.text) && (!w.ap || AP.cont || this.t - AP.onceT < 3));
    S.crc = S.warnings.some((w) => w.lvl === 3 && !w.ap && !S.warnAck.has(w.text));   // continuous repetitive chime (not for AP OFF: it has the cavalry charge)
    S.masterCaut = S.warnings.some((w) => w.lvl === 2 && !S.warnAck.has(w.text));
    for (const k of [...S.warnAck]) if (!S.warnings.some((w) => w.text === k)) S.warnAck.delete(k);
    // SD: APU page from APU MASTER ON until 10 s after AVAIL; otherwise the selected page, else DOOR on the ground
    const apuPage = this.v('apu.apuMaster') && (!A.avail || this.t - A.availT < 10);
    S.sdAuto = this.v('engPanel.mode') !== 1 || S.engStarting ? 'ENG' : apuPage ? 'APU' : S.eng.some((e) => e.running) ? 'WHEEL' : 'DOOR';
    S.sdPage = S.sdManual || S.sdAuto;
  }

  // ------------------------------------------------------------------ annunciator lights
  lights() {
    const sim = this.sim, S = this.s, E = S.elec, A = S.apu;
    // annunciator lights: most need the normal DC buses (from AC through the TRs); on batteries alone only the
    // panels on the battery / essential buses light (electrical, APU, fire, ADIRS, engine panel, emergency)
    const pwAll = E.dc1 || E.dc2, pwEss = E.dcEss;
    const ESS = /^(elec|apu|fire|adirs|engPanel|emerElec|evac|cargoSmoke)\./;
    const pwFor = (id) => (ESS.test(id) ? pwEss : pwAll);
    const pw = pwAll;
    const test = pwEss && this.v('signsIntLt.annLt') === 0;   // ANN LT TEST: everything lights
    sim.annLt = this.v('signsIntLt.annLt') === 2 ? 0.45 : 1;
    const flash = Math.floor(this.t * 2) % 2 === 0;
    const setL = (id, top, bot) => { const c = sim.get(id); if (c) { const p = pwFor(id); c.lights.top = test ? 1 : (p ? +!!top : 0); c.lights.bot = test ? 1 : (p ? +!!bot : 0); } };
    // generic rule for every alternate-action pushbutton: the lower legend shows its state
    for (const c of sim.controls.values()) {
      if (c.kind === 'alt') { const on = c.def.lit === 'out' ? !c.value : c.def.lit === 'in' ? c.value : false; c.lights.top = test ? 1 : 0; c.lights.bot = test ? 1 : pwFor(c.id) && on ? 1 : 0; }
      else if (c.kind === 'latch' || c.kind === 'radio') { c.lights.top = test ? 1 : pw && c.value ? 1 : 0; c.lights.bot = c.lights.top; }
      else if (c.kind === 'ind' || c.kind === 'mom') { c.lights.top = test ? 1 : 0; c.lights.bot = test ? 1 : 0; }
    }
    // specific lights
    const ext = sim.get('elec.extPwr'); if (ext) { ext.lights.top = test ? 1 : (S.extAvail && !S.extOn ? 1 : 0); ext.lights.bot = test ? 1 : (S.extOn ? 1 : 0); }   // AVAIL lit by ground power itself
    setL('apu.apuStart', A.avail, A.starting);
    setL('apu.apuMaster', false, this.v('apu.apuMaster'));
    for (const n of ['1', '2']) setL('elec.gen' + n, this.v('elec.gen' + n) && !E.gen[+n - 1], !this.v('elec.gen' + n));   // GEN FAULT: pushbutton ON, generator not on line (engine stopped)
    setL('fuel.xfeed', S.fuel.xfeedOpen >= 1, this.v('fuel.xfeed'));
    // HYD: ENG PUMP FAULT with the pushbutton ON and the pump at low pressure (engine stopped included), PTU FAULT while the
    // reservoirs have no air pressure (they are pressurised from bleed air) - as seen in the owner's sim before engine start
    S.resAir = !!(S.resAir || A.bleed || S.eng.some((e) => e.running));
    setL('hyd.eng1Pump', this.v('hyd.eng1Pump') && !(S.eng[0].running && S.hyd.G > 1450), !this.v('hyd.eng1Pump')); setL('hyd.eng2Pump', this.v('hyd.eng2Pump') && !(S.eng[1].running && S.hyd.Y > 1450), !this.v('hyd.eng2Pump'));
    setL('hyd.ptu', this.v('hyd.ptu') && !S.resAir, !this.v('hyd.ptu'));
    setL('airCond.apuBleed', false, this.v('airCond.apuBleed'));
    for (const n of ['1', '2']) setL('antiIce.eng' + n, false, this.v('antiIce.eng' + n));
    setL('antiIce.wing', false, this.v('antiIce.wing'));
    S.adirs.forEach((ir, i) => { const n = [1, 3, 2][i]; setL('adirs.ir' + n, ir.test > 0, !this.v('adirs.ir' + n)); });
    setL('adirs.onBat', S.adirs.some((ir) => ir.mode && ir.onBat), false);
    setL('signsIntLt.emerExitOff', this.v('signsIntLt.emerExit') === 2, false);
    setL('oxygen.paxOxy', S.masks, false);
    setL('evac.evacCmd', S.evac && flash, this.v('evac.evacCmd'));
    // fire
    for (const [k, pbid, eng] of [['ENG1', 'fireENG1', 'engPanel.engLt1'], ['ENG2', 'fireENG2', 'engPanel.engLt2'], ['APU', 'fireAPU', null]]) {
      const t = S.fire.test[k]; const rel = this.fireReleased(pbid);
      setL('fire.' + pbid, t, false);
      const ag = k === 'APU' ? ['fire.agentAPU'] : ['fire.agent1' + k, 'fire.agent2' + k];
      for (const a of ag) setL(a, t || rel, t || S.agentDisch.has(a));
      if (eng) { const E2 = S.eng[k === 'ENG1' ? 0 : 1]; setL(eng, t, E2.starting && !E2.startValve && E2.t < 48 && this.v('engPanel.mode') === 2); }
    }
    setL('cargoSmoke.fwdSmoke', S.cargoTest, false); setL('cargoSmoke.aftSmoke', S.cargoTest, false);
    setL('cargoSmoke.cargoDisch1', false, S.cargoTest); setL('cargoSmoke.cargoDisch2', false, S.cargoTest);
    for (const s of ['-1', '1']) { setL(`glareSide${s}.masterWarn`, S.masterWarn && flash, S.masterWarn && flash); setL(`glareSide${s}.masterCaut`, S.masterCaut, S.masterCaut); }
    // ECAM control panel: the key of the page on show is lit; CLR lit while there is something to clear
    for (const p of ['ENG', 'BLEED', 'PRESS', 'ELEC', 'HYD', 'FUEL', 'APU', 'COND', 'DOOR', 'WHEEL', 'F/CTL']) setL('ecamCP.ecp_' + p, S.sdPage === p && E.ac, S.sdPage === p && E.ac);
    const clr = S.warnings.length > 0; setL('ecamCP.ecp_CLR0', clr, clr); setL('ecamCP.ecp_CLR3', clr, clr);
    // autobrake: ON when armed
    for (const k of ['abrkLO', 'abrkMED', 'abrkMAX']) setL('gearBrake.' + k, false, this.v('gearBrake.' + k));
    for (const [id, on] of [['FCU.AP1', S.ap.ap1], ['FCU.AP2', S.ap.ap2], ['FCU.ATHR', S.ap.athr]]) { const c = sim.get(id); if (c) c.lights.top = test ? 1 : (E.dcEss && on ? 1 : 0); }
    // FCU / EFIS / RMP / ACP keys need their own power
    for (const c of sim.controls.values()) if ((c.id.startsWith('FCU.') || c.id.startsWith('EFIS')) && (c.kind === 'latch' || c.kind === 'radio')) { c.lights.top = test ? 1 : (E.dcEss && c.value ? 1 : 0); }
    // battery voltage readouts
    for (const i of [0, 1]) { const c = sim.get('elec.bat' + (i + 1) + 'V'); if (c) c.text = S.batV[i].toFixed(1) + 'V'; }
  }

  // ------------------------------------------------------------------ cockpit lighting (integral, flood, dome, ANN LT)
  cockpitLighting() {
    const S = this.s, E = S.elec, env = this.env;
    const ovhd = E.ac ? this.v('signsIntLt.ovhdInteg') : 0;
    const main = E.ac ? this.v('floodLt-1.integMain') : 0;
    env.setIntegral?.(ovhd, main);
    const dome = this.v('signsIntLt.dome'); env.setDome?.(E.dcEss ? (dome === 0 ? 1 : dome === 1 ? 0.45 : 0) : 0);
    env.setFlood?.(E.ac ? this.v('floodLt-1.floodMain') : 0, E.ac ? this.v('floodLt1.floodPed') : 0);
    env.setConsole?.(E.ac ? [this.v('lighting-1.console-1'), this.v('lighting1.console1')].map((p) => (p === 0 ? 1 : p === 1 ? 0.4 : 0)) : [0, 0]);
    env.setCompass?.(E.dcEss && this.v('signsIntLt.iceInd') === 0);
    // exterior lights (seen through the windshield at night)
    S.extLtFlash += 1;
    env.setExterior?.({
      nose: E.ac ? ['to', 'taxi', 'off'][this.v('extLt.nose')] : 'off',
      land: E.ac ? [this.v('extLt.landL') === 0, this.v('extLt.landR') === 0] : [false, false],
      turnoff: E.ac && this.v('extLt.rwyTurnOff') === 0,
      beacon: E.dcEss && this.v('extLt.beacon') === 0, strobe: E.ac && this.v('extLt.strobe') === 0, nav: E.ac && this.v('extLt.navLogo') !== 2, wing: E.ac && this.v('extLt.wingLt') === 0,
    });
  }

  // ------------------------------------------------------------------ display units: power, self test, brightness, content
  displays(dt) {
    const S = this.s, E = S.elec, env = this.env; if (!env.screens) return;
    const want = {
      PFD1: E.acEss ? this.v('lighting-1.pfdBrt') : 0, ND1: E.acEss ? this.v('lighting-1.ndBrt') : 0,
      PFD2: E.ac2 ? this.v('lighting1.pfdBrt') : 0, ND2: E.ac2 ? this.v('lighting1.ndBrt') : 0,
      EWD: E.acEss ? this.v('ecamCP.upperBrt') : 0, SD: E.ac2 ? this.v('ecamCP.lowerBrt') : 0,
      ISIS: E.dcEss ? 1 : 0, MCDU1: E.acEss ? 1 : 0, MCDU2: E.ac2 ? 1 : 0, DCDU1: E.ac ? 1 : 0, DCDU2: E.ac ? 1 : 0,
    };
    for (const [name, brt] of Object.entries(want)) {
      const st = this.screensState[name] || (this.screensState[name] = { on: false, test: 0, brt: 0 });
      const powered = brt > 0.02;
      if (powered && !st.on) { st.on = true; st.test = name === 'ISIS' ? 90 : name.startsWith('MCDU') || name.startsWith('DCDU') ? 3 : 25 + Math.random() * 12; }
      if (!powered) { st.on = false; st.test = 0; }
      st.test = Math.max(0, st.test - dt); st.brt = brt;
      env.screens.set(name, { on: st.on, test: st.test, brt, sys: S });
    }
    // small segment windows: FCU, baro, RMPs, transponder, rudder trim, battery readouts
    try { this.sound?.update(S); } catch (e) { if (!this._sndErr) { this._sndErr = true; console.error('sound', e); } }   // sound must never stop the systems
    env.screens.small?.({ fcu: E.dcEss, rmp1: E.dcEss && this.v('rmp1.pwr') === 0, rmp2: E.dc2 && this.v('rmp2.pwr') === 0, atc: E.ac, rudTrim: E.dcEss, test: E.dcEss && this.v('signsIntLt.annLt') === 0, sys: S });
  }
}
