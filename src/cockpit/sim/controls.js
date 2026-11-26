// What every cockpit control IS (name, kind, positions, normal setting) - one line per control.
// Controls are addressed by a fixed id: '<panel>.<item id>' (panel = the name given to buildPanel).
// Geometry never appears here, so moving / reshaping a control or re-laying out a panel needs no change here,
// and nothing in the systems refers to 3D objects. A control missing from this table still works: it gets a
// default behaviour from its type (pushbutton = push on / push off, key = momentary, knob = selector, ...).
//
// kinds
//   alt    alternate-action pushbutton (push in / push again to release). lit: which state lights the lower
//          legend - 'out' for OFF / OVRD / MAN / ALTN buttons, 'in' for ON / OPEN ... (inferred from the legend)
//   mom    momentary pushbutton or key (springs back)
//   latch  key that latches on / off (green bars, selected lights)
//   radio  latching key in a group - pressing one releases the others in the same group (opt: toggle = may deselect)
//   ind    indicator / annunciator only (not operable)
//   sel    rotary selector with positions (left to right)
//   rot    continuous rotary (rheostat, temperature, volume): value 0..1
//   spring rotary that springs back to centre (rudder trim)
//   tog    toggle switch, positions listed top to bottom (opt: spring = index it returns to when released)
//   fcu    FCU / radio knob: turn, push, pull
//   rx     audio reception knob: push for on / off, turn for volume
// opts:  init (normal 'aircraft ready' setting), guard (inferred from the geometry), name (shown on hover)

const T = (name, pos, init = 0, o = {}) => ({ kind: 'tog', name, pos, init, ...o });
const S = (name, pos, init = 0, o = {}) => ({ kind: 'sel', name, pos, init, ...o });
const R = (name, init = 0.5, o = {}) => ({ kind: 'rot', name, init, ...o });
const P = (name, init = true, o = {}) => ({ kind: 'alt', name, init, ...o });   // init true = pushed in
const M = (name, o = {}) => ({ kind: 'mom', name, ...o });
const I = (name, o = {}) => ({ kind: 'ind', name, ...o });
const L = (name, init = false, o = {}) => ({ kind: 'latch', name, init, ...o });
const G = (name, group, o = {}) => ({ kind: 'radio', name, group, ...o });
const F = (name, o = {}) => ({ kind: 'fcu', name, ...o });
const X = (name, init = 0.6, on = false) => ({ kind: 'rx', name, init, on });

const D = {};
const panel = (p, defs) => { for (const [k, v] of Object.entries(defs)) D[p + '.' + k] = v; };

// ------------------------------------------------------------------ overhead, centre
panel('fire', {
  fireENG1: P('ENG 1 FIRE', true, { kind: 'alt', lit: 'none' }), agent1ENG1: M('ENG 1 AGENT 1'), agent2ENG1: M('ENG 1 AGENT 2'), testENG1: M('ENG 1 FIRE TEST'),
  fireENG2: P('ENG 2 FIRE', true, { kind: 'alt', lit: 'none' }), agent1ENG2: M('ENG 2 AGENT 1'), agent2ENG2: M('ENG 2 AGENT 2'), testENG2: M('ENG 2 FIRE TEST'),
  fireAPU: P('APU FIRE', true, { kind: 'alt', lit: 'none' }), agentAPU: M('APU AGENT'), testAPU: M('APU FIRE TEST'),
});
panel('hyd', {
  eng1Pump: P('GREEN ENG 1 PUMP'), ratManOn: M('RAT MAN ON'), blueElec: P('BLUE ELEC PUMP'), ptu: P('PTU'),
  eng2Pump: P('YELLOW ENG 2 PUMP'), yellowElec: P('YELLOW ELEC PUMP', false),
});
panel('fuel', {
  xfeed: P('X FEED', false), ltk1: P('L TK PUMP 1'), ltk2: P('L TK PUMP 2'), ctr1: P('CTR TK PUMP 1'), fuelMode: P('FUEL MODE SEL', true, { lit: 'out' }),
  ctr2: P('CTR TK PUMP 2'), rtk1: P('R TK PUMP 1'), rtk2: P('R TK PUMP 2'),
});
panel('elec', {
  commercial: P('COMMERCIAL'), galyCab: P('GALY & CAB'), bat1: P('BAT 1'), bat2: P('BAT 2'), acEssFeed: P('AC ESS FEED', true, { lit: 'out' }),
  busTie: P('BUS TIE'), gen1: P('GEN 1'), idg1: M('IDG 1 DISC'), apuGen: P('APU GEN'), extPwr: { kind: 'mom', name: 'EXT PWR' },
  gen2: P('GEN 2'), idg2: M('IDG 2 DISC'), bat1V: I('BAT 1 voltage'), bat2V: I('BAT 2 voltage'),
});
panel('airCond', {
  pack1: P('PACK 1'), packFlow: S('PACK FLOW', ['LO', 'NORM', 'HI'], 1), tCkpt: R('COCKPIT TEMP'), tFwd: R('FWD CABIN TEMP'), tAft: R('AFT CABIN TEMP'),
  hotAir: P('HOT AIR'), pack2: P('PACK 2'), eng1Bleed: P('ENG 1 BLEED'), ramAir: P('RAM AIR', false), apuBleed: P('APU BLEED', false),
  xbleed: S('X BLEED', ['SHUT', 'AUTO', 'OPEN'], 1), eng2Bleed: P('ENG 2 BLEED'),
});
panel('antiIce', { wing: P('WING ANTI ICE', false), eng1: P('ENG 1 ANTI ICE', false), eng2: P('ENG 2 ANTI ICE', false) });
panel('probeHeat', { probeHeat: P('PROBE / WINDOW HEAT', false) });
panel('cabPress', {
  manVs: T('MAN V/S CTL', ['UP', 'NEUTRAL', 'DN'], 1, { spring: 1 }), modeSel: P('CABIN PRESS MODE SEL', true, { lit: 'out' }),
  ldgElev: R('LDG ELEV', 0, { detentAt: 0, name: 'LDG ELEV (AUTO at full left)' }), ditching: P('DITCHING', false),
});
panel('extLt', {
  strobe: T('STROBE', ['ON', 'AUTO', 'OFF'], 1), beacon: T('BEACON', ['ON', 'OFF'], 0), wingLt: T('WING', ['ON', 'OFF'], 1),
  navLogo: T('NAV & LOGO', ['2', '1', 'OFF'], 1), rwyTurnOff: T('RWY TURN OFF', ['ON', 'OFF'], 1),
  landL: T('LAND L', ['ON', 'OFF', 'RETRACT'], 2), landR: T('LAND R', ['ON', 'OFF', 'RETRACT'], 2), nose: T('NOSE', ['T.O', 'TAXI', 'OFF'], 2),
});
panel('apu', { apuMaster: P('APU MASTER SW', false), apuStart: { kind: 'mom', name: 'APU START', latchIn: true } });
panel('signsIntLt', {
  ovhdInteg: R('OVHD INTEG LT', 1), iceInd: T('ICE IND & STBY COMPASS', ['ON', 'OFF'], 1), dome: T('DOME', ['BRT', 'DIM', 'OFF'], 2),
  annLt: T('ANN LT', ['TEST', 'BRT', 'DIM'], 1), seatBelts: T('SEAT BELTS', ['ON', 'OFF'], 1), noSmoking: T('NO SMOKING', ['ON', 'AUTO', 'OFF'], 1),
  emerExit: T('EMER EXIT LT', ['ON', 'ARM', 'OFF'], 1), emerExitOff: I('EMER EXIT LT OFF light'),
});
// ------------------------------------------------------------------ overhead, left column
panel('paVideo', { paKey: L('PA'), doorVideo: P('COCKPIT DOOR VIDEO') });
panel('adirs', {
  onBat: I('ON BAT'),
  ir1: P('IR 1'), irSel1: S('IR 1 MODE', ['OFF', 'NAV', 'ATT'], 1), adr1: P('ADR 1'),
  ir3: P('IR 3'), irSel3: S('IR 3 MODE', ['OFF', 'NAV', 'ATT'], 1), adr3: P('ADR 3'),
  ir2: P('IR 2'), irSel2: S('IR 2 MODE', ['OFF', 'NAV', 'ATT'], 1), adr2: P('ADR 2'),
});
panel('fltCtl1', { ELAC1: P('ELAC 1'), SEC1: P('SEC 1'), FAC1: P('FAC 1') });
panel('evac', { evacCmd: P('EVAC COMMAND', false), hornShutOff: M('EVAC HORN SHUT OFF'), evacSel: T('EVAC CAPT & PURS / CAPT', ['CAPT & PURS', 'CAPT'], 0) });
panel('emerElec', { emerGenTest: M('EMER GEN TEST'), gen1Line: P('GEN 1 LINE'), ratEmerGen: I('RAT & EMER GEN'), emerManOn: M('EMER ELEC MAN ON') });
panel('gpws', { gpws101: P('GPWS TERR'), gpws228: P('GPWS SYS'), gpws352: P('GPWS G/S MODE'), gpws458: P('GPWS FLAP MODE'), gpws568: P('GPWS LDG FLAP 3', false) });
panel('rcdr', { gndCtl: P('RCDR GND CTL', false), cvrErase: M('CVR ERASE'), cvrTest: M('CVR TEST') });
panel('oxygen', { maskManOn: M('PAX OXY MASK MAN ON'), paxOxy: I('PASSENGER SYS ON'), crewOxy: P('CREW SUPPLY') });
panel('callsWiper', {
  callMECH: M('CALL MECH'), callALL: M('CALL ALL'), callFWD: M('CALL FWD'), callAFT: M('CALL AFT'), emerCall: M('EMER CALL'),
  rainRplnt: M('RAIN RPLNT (CAPT)'), wiperL: S('WIPER (CAPT)', ['OFF', 'SLOW', 'FAST'], 0),
});
// ------------------------------------------------------------------ overhead, right column
panel('fltCtl2', { ELAC2: P('ELAC 2'), SEC2: P('SEC 2'), SEC3: P('SEC 3'), FAC2: P('FAC 2') });
panel('cargoVent', { aftIsol: P('AFT ISOL VALVE') });
panel('cargoSmoke', { cargoDisch1: M('CARGO DISCH 1'), fwdSmoke: I('FWD CARGO SMOKE'), smokeTest: M('CARGO SMOKE TEST'), aftSmoke: I('AFT CARGO SMOKE'), cargoDisch2: M('CARGO DISCH 2') });
panel('vent', { blower: P('BLOWER', true, { lit: 'out' }), extract: P('EXTRACT', true, { lit: 'out' }), cabFans: P('CAB FANS') });
panel('engMan', { manStart1: P('ENG 1 MAN START', false), manStart2: P('ENG 2 MAN START', false), n1Mode1: P('ENG 1 N1 MODE', false), n1Mode2: P('ENG 2 N1 MODE', false) });
panel('wiperR', { rainRplnt: M('RAIN RPLNT (F/O)'), wiperR: S('WIPER (F/O)', ['OFF', 'SLOW', 'FAST'], 0) });
// audio control panels: overhead third ACP and the two pedestal ACPs share one layout
const acp = (pre, tx, rx, extra) => {
  const o = {};
  for (const n of ['VHF 1', 'VHF 2', 'VHF 3', 'HF 1', 'HF 2', 'INT', 'CAB']) { o[tx + n] = G('TRANSMIT ' + n, 'tx', { toggle: true }); o[rx + n] = X('RECEPTION ' + n, 0.6, n === 'VHF 1'); }
  for (const n of ['VOR 1', 'VOR 2', 'MKR', 'ILS', 'MLS', 'ADF 1', 'ADF 2']) o[rx + n] = X('RECEPTION ' + n, 0.5);
  return { ...o, ...extra };
};
panel('acp', acp('', 'acpT', 'acpV', { acpIntRad: T('INT / RAD', ['INT', 'NEUTRAL', 'RAD'], 1, { spring: 1, springFrom: [2] }), acpVoice: L('VOICE'), acpReset: M('RESET'), acpPA: X('PA RECEPTION', 0.5), acpPAkey: L('PA') }));
for (const k of ['VOR 1', 'VOR 2', 'MKR', 'ILS', 'MLS', 'ADF 1', 'ADF 2']) { D['acp.acpR' + k] = D['acp.acpV' + k]; delete D['acp.acpV' + k]; }
for (const p of ['acpPed', 'acpPed#2']) panel(p, acp('', 'tx', 'rx', { intRad: T('INT / RAD', ['INT', 'NEUTRAL', 'RAD'], 1, { spring: 1, springFrom: [2] }), voice: L('VOICE'), reset: M('RESET'), rxPA: X('PA RECEPTION', 0.5), paKey: L('PA') }));
// ------------------------------------------------------------------ aft overhead
panel('audio', { audioSw: S('AUDIO SWITCHING', ['CAPT 3', 'NORM', 'F/O 3'], 1), fadecGnd1: P('ENG 1 FADEC GND PWR', false), fadecGnd2: P('ENG 2 FADEC GND PWR', false), apuExtTest: M('APU AUTO EXTING TEST'), apuExtReset: M('APU AUTO EXTING RESET') });
panel('maint', { bluePumpOvrd: P('BLUE PUMP OVRD', false), oxyTmrReset: M('OXYGEN TMR RESET'), leakG: P('HYD LEAK MEASUREMENT G'), leakB: P('HYD LEAK MEASUREMENT B'), leakY: P('HYD LEAK MEASUREMENT Y'), svceInt: P('SVCE INT OVRD', false), avncLt: P('AVIONICS COMPT LT', false), cvrMic: S('CVR MIC', ['OFF', 'ON'], 0) });

// ------------------------------------------------------------------ glareshield
panel('FCU', {
  spdMach: M('SPD / MACH'), kSPD: F('SPD knob'), kHDG: F('HDG knob'), LOC: L('LOC'), hdgvs: M('HDG-V/S / TRK-FPA'),
  AP1: L('AP 1'), AP2: L('AP 2'), ATHR: L('A/THR'), kALT: F('ALT knob'), EXPED: L('EXPED'), metric: M('METRIC ALT'), kVS: F('V/S knob'), APPR: L('APPR'),
});
for (const s of ['1', '2']) panel('EFIS' + s, {
  FD: L('FD', true), LS: L('LS'), CSTR: G('CSTR', 'nd', { toggle: true }), WPT: G('WPT', 'nd', { toggle: true }), 'VOR.D': G('VOR.D', 'nd', { toggle: true }),
  NDB: G('NDB', 'nd', { toggle: true }), ARPT: G('ARPT', 'nd', { toggle: true }),
  ndMode: S('ND MODE', ['LS', 'VOR', 'NAV', 'ARC', 'PLAN'], 3), ndRange: S('ND RANGE', ['10', '20', '40', '80', '160', '320'], 2),
  nav1: T('ADF / VOR 1', ['VOR', 'OFF', 'ADF'], 1), nav2: T('ADF / VOR 2', ['VOR', 'OFF', 'ADF'], 1),
});
for (const s of ['-1', '1']) panel('glareSide' + s, {
  chrono: M('CHRONO'), ssp: I('SIDE STICK PRIORITY'), masterWarn: M('MASTER WARN'), masterCaut: M('MASTER CAUT'),
  hudDeclutter: M('HUD DECLUTTER'), hudBrt: R('HUD BRIGHTNESS', 0.7), hudMode: T('HUD', ['NORM', 'OFF'], 0), sspArrow: I('SIDE STICK PRIORITY arrow'),
});
// ------------------------------------------------------------------ main panel
for (const s of ['-1', '1']) {
  panel('terr' + s, { ['terrOnNd' + s]: P('TERR ON ND', false) });
  panel('lighting' + s, {
    ['pullUp' + s]: M('GPWS / G/S warning'), pfdBrt: R('PFD BRIGHTNESS', 0.8), ['pfdNdXfr' + s]: M('PFD / ND XFR'), ndBrt: R('ND BRIGHTNESS', 0.8),
    loud: R('LOUD SPKR', 0.5), ['console' + s]: T('CONSOLE / FLOOR LT', ['BRT', 'DIM', 'OFF'], 2),
  });
}
panel('gearBrake', { abrkLO: G('AUTO BRK LO', 'abrk', { toggle: true }), abrkMED: G('AUTO BRK MED', 'abrk', { toggle: true }), abrkMAX: G('AUTO BRK MAX', 'abrk', { toggle: true }), askid: T('A/SKID & N/W STRG', ['ON', 'OFF'], 0) });

// ------------------------------------------------------------------ pedestal
panel('switching', {
  sw0: S('ATT HDG', ['CAPT 3', 'NORM', 'F/O 3'], 1), sw1: S('AIR DATA', ['CAPT 3', 'NORM', 'F/O 3'], 1),
  sw2: S('EIS DMC', ['CAPT 3', 'NORM', 'F/O 3'], 1), sw3: S('ECAM / ND XFR', ['CAPT', 'NORM', 'F/O'], 1),
});
panel('ecamCP', {
  upperBrt: R('UPPER DISPLAY (OFF - BRT)', 0.8), lowerBrt: R('LOWER DISPLAY (OFF - BRT)', 0.8), TOCONFIG: M('T.O CONFIG'), EMERCANC: M('EMER CANC'),
  ...Object.fromEntries(['ENG', 'BLEED', 'PRESS', 'ELEC', 'HYD', 'FUEL', 'APU', 'COND', 'DOOR', 'WHEEL', 'F/CTL'].map((p) => ['ecp_' + p, G(p + ' page', 'sd', { toggle: true })])),
  ecp_ALL: M('ALL'), ecp_CLR0: M('CLR'), ecp_STS1: M('STS'), ecp_RCL2: M('RCL'), ecp_CLR3: M('CLR'),
});
for (const n of ['1', '2']) panel('rmp' + n, {
  xfer: M('TRANSFER'), rmpVHF1: G('VHF 1', 'rmp'), rmpVHF2: G('VHF 2', 'rmp'), rmpVHF3: G('VHF 3', 'rmp'), rmpHF1: G('HF 1', 'rmp'), rmpHF2: G('HF 2', 'rmp'), rmpAM: L('AM'),
  selLt: I('SEL'), nav: L('NAV'), navVOR: G('VOR', 'rmpnav'), navILS: G('ILS', 'rmpnav'), navMLS: G('MLS', 'rmpnav'), navADF: G('ADF', 'rmpnav'), navBFO: L('BFO'),
  freq: F('FREQ outer'), freqInner: F('FREQ inner'), pwr: T('RMP', ['ON', 'OFF'], 0),
});
panel('floodLt-1', { floodMain: R('FLOOD LT MAIN PNL & PED', 0), integMain: R('INTEG LT MAIN PNL & PED', 1) });
panel('floodLt1', { floodPed: R('FLOOD LT PED', 0), aidsPrint: M('AIDS PRINT'), dfdrEvent: M('DFDR EVENT') });
panel('wxRadar', {
  wxGain: R('WX GAIN', 0), wxMulti: T('MULTISCAN', ['MAN', 'AUTO'], 1, { horizontal: true }), wxGcs: T('GCS', ['OFF', 'AUTO'], 1, { horizontal: true }),
  wxTilt: R('TILT', 0.5), wxMode: S('WX MODE', ['WX', 'WX+T', 'TURB', 'MAP'], 0), wxSys: T('WX SYS', ['1', 'OFF', '2'], 1, { horizontal: true }), wxPws: T('PWS', ['OFF', 'AUTO'], 1, { horizontal: true }),
});
panel('atc', {
  xpdrMode: S('XPDR', ['STBY', 'AUTO', 'ON'], 0), atcSys: S('ATC SYS', ['1', '2'], 0), altRptg: S('ALT RPTG', ['OFF', 'ON'], 1), ident: M('IDENT'),
  tcasTraffic: S('TCAS TRAFFIC', ['THRT', 'ALL', 'ABV', 'BLW'], 1), tcasMode: S('TCAS', ['STBY', 'TA', 'TA/RA'], 0),
  ...Object.fromEntries(['1', '2', '3', '4', '5', '6', '7', '0'].map((k) => ['atc' + k, M('XPDR ' + k)])), atcCLR: M('XPDR CLR'),
});
panel('engPanel', { engLt1: I('ENG 1 FIRE / FAULT'), engLt2: I('ENG 2 FIRE / FAULT'), mode: S('ENG MODE', ['CRANK', 'NORM', 'IGN / START'], 1) });
panel('rudderTrim', { rudTrim: { kind: 'spring', name: 'RUD TRIM (NOSE L / NOSE R)' }, rudReset: M('RUD TRIM RESET') });
panel('cockpitDoor', { doorOpen: I('COCKPIT DOOR OPEN'), doorVideoPed: M('DOOR VIDEO') });

export const DEFS = D;

// default behaviour for a control that is not in the table
const OUT_LEGENDS = new Set(['OFF', 'OVRD', 'MAN', 'ALTN', 'ISOL']);
export function defFor(id, ctl) {
  const it = ctl.item; let d = D[id];
  if (!d) {
    if (ctl.kind === 'pb') d = it.guard === 'red' ? M('') : P('');
    else if (ctl.kind === 'key' || ctl.kind === 'rbtn') d = M('');
    else if (ctl.kind === 'annun') d = I('');
    else if (ctl.kind === 'toggle') d = T('', ['ON', 'OFF'], 0);
    else if (ctl.kind === 'knob') d = ctl.style === 'fcu' ? F('') : ctl.style === 'knurl' ? R('') : ctl.style === 'round' ? X('') : S('', (it.ticks || [-45, 0, 45]).map((_, i) => 'POS ' + (i + 1)), 0);
    else d = M('');
  }
  d = { ...d };
  if (!d.name) d.name = [ctl.caption, ...(it.legends || [])].filter(Boolean).join(' ') || id;
  if (d.kind === 'alt' && !d.lit) d.lit = OUT_LEGENDS.has((it.legends || [])[1]) ? 'out' : 'in';
  return d;
}
