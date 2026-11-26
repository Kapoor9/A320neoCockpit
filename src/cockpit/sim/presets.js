// Starting states. Each preset lists only the controls that differ from the normal settings in controls.js,
// plus the system states to jump to (so 'ready' does not make you wait for the APU and the IRS alignment).
const LIGHTS_OFF = { 'extLt.strobe': 2, 'extLt.beacon': 1, 'extLt.wingLt': 1, 'extLt.navLogo': 2, 'extLt.rwyTurnOff': 1, 'extLt.landL': 2, 'extLt.landR': 2, 'extLt.nose': 2 };
export const PRESETS = {
  // parked overnight: everything off, ground power plugged in (EXT PWR AVAIL), parking brake set
  cold: {
    controls: { 'elec.bat1': false, 'elec.bat2': false, 'apu.apuMaster': false, 'airCond.apuBleed': false, 'hyd.yellowElec': false,
      'adirs.irSel1': 0, 'adirs.irSel2': 0, 'adirs.irSel3': 0, ...LIGHTS_OFF, 'signsIntLt.seatBelts': 1, 'signsIntLt.noSmoking': 1, 'signsIntLt.emerExit': 2, 'signsIntLt.dome': 2,
      'parkBrake.handle': 1, 'atc.xpdrMode': 0, 'atc.tcasMode': 0, 'fuel.xfeed': false, 'engPanel.master1': 0, 'engPanel.master2': 0, 'engPanel.mode': 1,
      'floodLt-1.floodMain': 0, 'floodLt1.floodPed': 0 },
    sys: (s) => { s.extOn = false; Object.assign(s.apu, { flap: 0, n: 0, egt: 20, starting: false, avail: false, shutting: false, cool: 0 }); s.adirs.forEach((ir) => Object.assign(ir, { mode: 0, align: 0, aligned: false, onBat: 0, test: 0 })); s.batV = [25.8, 25.8]; s.hyd = { G: 0, B: 0, Y: 0, ptu: false }; s.masks = false; s.agentDisch.clear(); },
  },
  // before engine start: APU running with its generator and bleed, IRs aligned, beacon on, seat belts on
  ready: {
    controls: { 'elec.bat1': true, 'elec.bat2': true, 'apu.apuMaster': true, 'elec.apuGen': true, 'airCond.apuBleed': true, 'hyd.yellowElec': false,
      'adirs.irSel1': 1, 'adirs.irSel2': 1, 'adirs.irSel3': 1, ...LIGHTS_OFF, 'extLt.beacon': 0, 'extLt.navLogo': 1, 'extLt.strobe': 1,
      'signsIntLt.seatBelts': 0, 'signsIntLt.noSmoking': 1, 'signsIntLt.emerExit': 1, 'signsIntLt.dome': 2,
      'parkBrake.handle': 1, 'atc.xpdrMode': 0, 'atc.tcasMode': 0, 'engPanel.master1': 0, 'engPanel.master2': 0, 'engPanel.mode': 1 },
    sys: (s, t) => { s.extOn = false; Object.assign(s.apu, { flap: 1, n: 100, egt: 520, starting: false, avail: true, shutting: false, availT: t - 60 }); s.adirs.forEach((ir) => Object.assign(ir, { mode: 1, align: 0, aligned: true, onBat: 0, test: 0 })); s.batV = [28.2, 28.2]; },
  },
};

export function applyPreset(sim, systems, name) {
  const p = PRESETS[name]; if (!p) return;
  for (const c of sim.controls.values()) {   // back to the normal setting, then the preset's differences
    if (c.kind === 'mom' || c.kind === 'ind' || c.kind === 'fcu') continue;
    const d = c.def; let v = d.init;
    if (c.kind === 'rx') v = { on: !!d.on, vol: d.init ?? 0.6 }; else if (c.kind === 'alt' || c.kind === 'latch' || c.kind === 'radio') v = !!d.init; else if (c.kind === 'lever' && d.value !== undefined) v = d.value;
    if (v === undefined) continue; c.value = v; c.guardOpen = false;
  }
  for (const [id, v] of Object.entries(p.controls)) { const c = sim.get(id); if (c) c.value = v; }
  for (const c of sim.controls.values()) sim.visual(c, true);
  p.sys(systems.s, systems.t); systems.s.sdManual = null; systems.screensState = name === 'ready' ? Object.fromEntries(Object.keys(systems.screensState).map((k) => [k, { on: true, test: 0, brt: 1 }])) : {};
  systems.tick(0.1); if (name === 'ready') for (const st of Object.values(systems.screensState)) st.test = 0;
  sim.dirty = true;
}
