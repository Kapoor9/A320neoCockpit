// A320 overhead panel: system panels with their real controls and legends.
// Panels are laid out in three columns (left / centre / right), aft at the top as read,
// forward (towards the windshield) at the bottom, as the crew sees it looking up.
import { buildPanel } from './panel.js';

const PB = 0.019;   // Korry pushbutton size (m)

// evenly spaced row of pushbuttons with captions above: [caption, topLegend, bottomLegend, opts]
function pbRow(w, y, list, { cap = 0.0042, gap = 0.0145, size = PB, line = false } = {}) {
  const items = []; const n = list.length;
  if (line) items.push({ t: 'line', pts: [[-w / 2 + (w / n) * 0.5, y], [-w / 2 + (w / n) * (n - 0.5), y]], w: 0.0008, col: '#5ccf98' });   // white flow line behind the row
  list.forEach(([caption, top, bot, opts = {}], i) => {
    const x = -w / 2 + (w / n) * (i + 0.5) + (opts.dx || 0);
    if (caption) items.push({ t: 'text', x, y: y + size / 2 + gap * 0.55, s: caption, size: cap });
    items.push({ t: 'pb', x, y, w: opts.w || size, h: opts.h || size, legends: [top, bot], guard: opts.guard, id: opts.id });
  });
  return items;
}
const toggleWith = (x, y, caption, pos) => [
  { t: 'text', x, y: y + 0.021, s: caption, size: 0.0038 },
  { t: 'toggle', x, y },
  ...pos.map((s, i) => ({ t: 'text', x: x + 0.013, y: y + 0.008 - i * 0.008, s, size: 0.0032, align: 'left' })),
];
const selector = (x, y, caption, labels, id, r = 0.0085) => [
  { t: 'text', x, y: y + r + 0.013, s: caption, size: 0.0038 },
  ...labels.map((s, i) => { const a = (labels.length === 1 ? 0 : -50 + (100 / (labels.length - 1)) * i) * Math.PI / 180; return { t: 'text', x: x + Math.sin(a) * (r + 0.009), y: y + Math.cos(a) * (r + 0.007), s, size: 0.003 }; }),
  { t: 'knob', x, y, r, id, ticks: labels.map((_, i) => (labels.length === 1 ? 0 : -50 + (100 / (labels.length - 1)) * i)) },
];

// ---------------------------------------------------------------- panel definitions
export const PANELS = {
  calls: (w, h) => ({ title: 'CALLS', items: [
    { t: 'key', x: -0.05, y: 0.008, w: 0.024, h: 0.012, s: 'MECH' }, { t: 'key', x: -0.016, y: 0.008, w: 0.024, h: 0.012, s: 'FWD' },
    { t: 'key', x: 0.018, y: 0.008, w: 0.024, h: 0.012, s: 'AFT' }, { t: 'key', x: 0.052, y: 0.008, w: 0.024, h: 0.012, s: 'ALL' },
    ...pbRow(w, -0.022, [['EMER', 'CALL', 'ON', { guard: 'grey' }]]),
  ] }),
  wiper: (side) => (w, h) => ({ title: 'WIPER', items: [
    ...selector(side < 0 ? -0.025 : 0.025, -0.012, '', ['OFF', 'SLOW', 'FAST'], 'wiper' + side),
    ...pbRow(w, -0.012, [['RAIN RPLNT', '', '']]).map((i) => ({ ...i, x: i.x + (side < 0 ? 0.04 : -0.04) })),
  ] }),
  airCond: (w, h) => ({ title: 'AIR COND', items: [
    ...selector(-0.09, 0.028, 'CKPT', ['COLD', 'HOT'], 'tCkpt'), ...selector(-0.03, 0.028, 'FWD CABIN', ['COLD', 'HOT'], 'tFwd'), ...selector(0.03, 0.028, 'AFT CABIN', ['COLD', 'HOT'], 'tAft'),
    ...pbRow(0.03, 0.028, [['HOT AIR', 'FAULT', 'OFF']]).map((i) => ({ ...i, x: i.x + 0.105 })),
    { t: 'line', pts: [[-0.09, 0.016], [-0.09, 0.004], [0.105, 0.004], [0.105, 0.016]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[-0.03, 0.016], [-0.03, 0.004]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[0.03, 0.016], [0.03, 0.004]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[-0.004, 0.004], [-0.004, -0.024]], w: 0.0008, col: '#5ccf98' },
    ...pbRow(w, -0.024, [['ENG 1\nBLEED', 'FAULT', 'OFF'], ['PACK 1', 'FAULT', 'OFF'], ['', '', '', { w: 0.001, h: 0.001 }], ['APU BLEED', 'FAULT', 'ON'], ['PACK 2', 'FAULT', 'OFF'], ['ENG 2\nBLEED', 'FAULT', 'OFF']], { cap: 0.0032, line: true }),
    ...selector(-0.004, -0.026, 'X BLEED', ['SHUT', 'AUTO', 'OPEN'], 'xbleed'),
    ...selector(-0.12, -0.052, '', ['LO', 'NORM', 'HI'], 'packFlow', 0.007), { t: 'text', x: -0.095, y: -0.052, s: 'PACK FLOW', size: 0.0032, align: 'left' },
    ...pbRow(0.02, -0.054, [['RAM AIR', '', 'ON', { guard: 'grey' }]]).map((i) => ({ ...i, x: i.x + 0.11 })),
  ] }),
  antiIce: (w, h) => ({ title: 'ANTI ICE', items: [
    ...pbRow(w, 0.006, [['WING', 'FAULT', 'ON'], ['ENG 1', 'FAULT', 'ON'], ['ENG 2', 'FAULT', 'ON']], { line: true }),
    ...pbRow(w, -0.028, [['PROBE/WINDOW HEAT', '', 'ON']], { cap: 0.0032 }),
  ] }),
  cabPress: (w, h) => ({ title: 'CABIN PRESS', items: [
    ...toggleWith(-0.05, -0.004, 'MAN V/S CTL', ['UP', '', 'DN']),
    ...pbRow(0.03, 0.006, [['MODE SEL', 'FAULT', 'MAN']]).map((i) => ({ ...i, x: i.x - 0.008 })),
    ...selector(0.045, 0.004, 'LDG ELEV', ['AUTO'], 'ldgElev'),
    ...pbRow(0.03, -0.03, [['DITCHING', '', 'ON', { guard: 'grey' }]]).map((i) => ({ ...i, x: i.x - 0.008 })),
  ] }),
  extLt: (w, h) => {
    const items = [];
    [['STROBE', ['ON', 'AUTO', 'OFF']], ['BEACON', ['ON', '', 'OFF']], ['WING', ['ON', '', 'OFF']], ['NAV & LOGO', ['2', '1', 'OFF']], ['RWY TURN OFF', ['ON', '', 'OFF']], ['LAND', ['ON', 'OFF', 'RETRACT']], ['NOSE', ['T.O', 'TAXI', 'OFF']]]
      .forEach(([c, p], i) => { items.push(...toggleWith(-0.135 + i * 0.043, -0.006, c, p)); if (i) items.push({ t: 'line', pts: [[-0.1565 + i * 0.043, 0.02], [-0.1565 + i * 0.043, -0.028]], w: 0.0008, col: '#5ccf98' }); });
    return { title: 'EXT LT', items };
  },
  apu: (w, h) => ({ title: 'APU', items: pbRow(w, -0.01, [['MASTER SW', 'FAULT', 'ON', { id: 'apuMaster' }], ['START', 'AVAIL', 'ON', { id: 'apuStart' }]]) }),
  signs: (w, h) => ({ title: 'SIGNS', items: [
    ...toggleWith(-0.035, -0.008, 'SEAT BELTS', ['ON', '', 'OFF']), ...toggleWith(0.0, -0.008, 'NO SMOKING', ['ON', 'AUTO', 'OFF']), ...toggleWith(0.035, -0.008, 'EMER EXIT LT', ['ON', 'ARM', 'OFF']),
  ] }),
  intLt: (w, h) => ({ title: 'INT LT', items: [
    ...selector(-0.035, -0.008, 'OVHD INTEG LT', ['OFF', 'BRT'], 'ovhdInteg', 0.0075),
    ...toggleWith(0.0, -0.008, 'DOME', ['BRT', 'DIM', 'OFF']), ...toggleWith(0.035, -0.008, 'ANN LT', ['TEST', 'BRT', 'DIM']),
  ] }),
  cargoHeat: (w, h) => ({ title: 'CARGO HEAT', items: [
    ...pbRow(0.09, -0.008, [['AFT ISOL VALVE', 'FAULT', 'OFF'], ['HOT AIR', 'FAULT', 'OFF']], { cap: 0.003 }).map((i) => ({ ...i, x: i.x - 0.025 })),
    ...selector(0.05, -0.01, 'AFT', ['COLD', 'HOT'], 'cargoT', 0.0075),
  ] }),
  engManStart: (w, h) => ({ title: 'ENG MAN START', items: pbRow(w, -0.01, [['ENG 1', '', 'ON'], ['ENG 2', '', 'ON']]) }),
};

// Aft overhead (behind the system panels): circuit breakers in the centre, maintenance items either side.
export const AFT = {
  audio: (w, h) => ({ title: 'AUDIO SWITCHING', items: [
    { t: 'round', x: -0.035, y: 0.13, r: 0.019, eyeball: true }, { t: 'round', x: -0.035, y: 0.075, r: 0.019, eyeball: true }, { t: 'round', x: -0.035, y: 0.02, r: 0.019, eyeball: true },
    ...selector(0.035, 0.09, '', ['CAPT 3', 'NORM', 'F/O 3'], 'audioSw'),
    { t: 'text', x: 0, y: -0.06, s: 'ENG FADEC GND PWR', size: 0.0034 },
    ...pbRow(w, -0.085, [['1', '', 'ON', { id: 'fadecGnd1' }], ['2', '', 'ON', { id: 'fadecGnd2' }]]),
    { t: 'text', x: 0, y: -0.12, s: 'APU AUTO EXTING', size: 0.0034 },
    { t: 'key', x: -0.025, y: -0.14, w: 0.022, h: 0.011, s: 'TEST', id: 'apuExtTest' }, { t: 'key', x: 0.025, y: -0.14, w: 0.022, h: 0.011, s: 'RESET', id: 'apuExtReset' },
  ] }),
  cb: (w, h) => ({ title: '', items: [
    { t: 'text', x: 0, y: h / 2 - 0.009, s: 'C/B PANEL 121VU', size: 0.0042 },
    ...[0, 1, 2, 3, 4, 5].flatMap((r) => [
      { t: 'line', pts: [[-w / 2 + 0.01, h / 2 - 0.024 - r * 0.046], [w / 2 - 0.01, h / 2 - 0.024 - r * 0.046]], w: 0.0005 },
      { t: 'text', x: 0, y: h / 2 - 0.03 - r * 0.046, s: ['ELEC  AC ESS SHED   DC ESS   DC BUS 1', 'FUEL   HYD   F/CTL   LDG GEAR', 'AIR COND   ANTI ICE   PRESS', 'NAV   ADIRU 1   ADIRU 2   ADIRU 3', 'AUTO FLT   FCU   FMGC 1   FMGC 2', 'COM   VHF   HF   CIDS   RMP'][r], size: 0.003 },
      { t: 'cb', x: 0, y: h / 2 - 0.044 - r * 0.046, cols: 13, rows: 1, dx: 0.0215, dy: 0 },
    ]),
  ] }),
  maint: (w, h) => ({ title: 'MAINTENANCE', items: [
    ...pbRow(w, 0.13, [['BLUE PUMP\nOVRD', '', 'ON', { guard: 'grey', id: 'bluePumpOvrd' }], ['OXYGEN\nTMR RESET', 'FAULT', '', { id: 'oxyTmrReset' }]], { cap: 0.003 }),
    { t: 'text', x: 0, y: 0.088, s: 'HYD LEAK MEASUREMENT VALVES', size: 0.0028 },
    ...pbRow(w, 0.065, [['G', '', 'OFF', { id: 'leakG' }], ['B', '', 'OFF', { id: 'leakB' }], ['Y', '', 'OFF', { id: 'leakY' }]], { cap: 0.0032 }),
    ...pbRow(w, 0.015, [['SVCE INT\nOVRD', '', 'ON', { id: 'svceInt' }], ['AVIONICS\nCOMPT LT', '', 'ON', { id: 'avncLt' }]], { cap: 0.003 }),
    { t: 'round', x: -0.03, y: -0.05, r: 0.02 },
    { t: 'annun', x: 0.035, y: -0.04, w: 0.04, h: 0.012, s: 'VHF 3 DATA' },
    ...selector(0.035, -0.09, 'CVR MIC', ['OFF', 'ON'], 'cvrMic', 0.0075),
  ] }),
};

// Layout: three columns; each entry [panelKey, design height]; rows run aft (top) to forward.
// Design heights are scaled so each column fills the measured system-panel length.
// ---- layout as photographed on the aircraft (aft at the top as read) ----
const cap = (x, y, s, size = 0.0026) => ({ t: 'text', x, y, s, size });
const pb = (x, y, c, top, bot, o = {}) => [...(c ? [cap(x, y + (o.h || 0.015) / 2 + 0.0055, c, o.cs || 0.0025)] : []), { t: 'pb', x, y, w: o.w || 0.015, h: o.h || 0.015, legends: [top, bot], guard: o.guard, id: o.id, cols: o.cols }];
const tg = (x, y, c, id, style) => [cap(x, y + 0.0135, c, 0.0023), { t: 'toggle', x, y, id, style }];
// engraved vertical side title, both edges of a panel (FIRE, HYD, FUEL, ELEC, AIR COND)
const vt = (s, half, h) => { const ch = s.split(''); const st = Math.min(0.0055, (h * 0.8) / ch.length); return [-1, 1].flatMap((sx) => ch.map((c, i) => cap(sx * (half - 0.006), (ch.length - 1) * st / 2 - i * st, c, 0.0036))); };
const rb = (x, y, c, r = 0.0045) => [...(c ? [cap(x, y + r + 0.005, c, 0.0024)] : []), { t: 'rbtn', x, y, r }];
const kn = (x, y, c, r = 0.0085, id) => [...(c ? [cap(x, y + r + 0.006, c, 0.0025)] : []), { t: 'knob', x, y, r, id }];
Object.assign(PANELS, {
  fuel: () => ({ title: 'FUEL', items: [
    { t: 'text', x: -0.09, y: 0.027, s: 'ENG 1', size: 0.0026, boxed: true }, { t: 'text', x: -0.035, y: 0.027, s: 'APU', size: 0.0026, boxed: true }, { t: 'text', x: 0.09, y: 0.027, s: 'ENG 2', size: 0.0026, boxed: true },
    ...pb(0, 0.02, 'X FEED', 'OPEN', 'ON'),
    { t: 'line', pts: [[-0.09, 0.022], [-0.09, 0.01], [-0.008, 0.01]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[0.008, 0.01], [0.09, 0.01], [0.09, 0.022]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[-0.035, 0.022], [-0.035, 0.01]], w: 0.0008, col: '#5ccf98' },
    { t: 'line', pts: [[-0.09, 0.01], [-0.09, 0.0], [-0.122, 0.0], [-0.122, -0.006]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[-0.09, 0.0], [-0.092, 0.0], [-0.092, -0.006]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[0.09, 0.01], [0.09, 0.0], [0.122, 0.0], [0.122, -0.006]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[0.09, 0.0], [0.092, -0.006]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[-0.035, 0.01], [-0.035, -0.006]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[0.035, 0.01], [0.035, -0.006]], w: 0.0008, col: '#5ccf98' },
    { t: 'text', x: -0.107, y: 0.004, s: 'L TK PUMPS', size: 0.0024 }, { t: 'text', x: 0.107, y: 0.004, s: 'R TK PUMPS', size: 0.0024 },
    ...pb(-0.122, -0.018, '1', 'FAULT', 'OFF', { cs: 0.0022 }), ...pb(-0.092, -0.018, '2', 'FAULT', 'OFF', { cs: 0.0022 }),
    ...pb(-0.035, -0.018, 'CTR TK PUMP 1', 'FAULT', 'OFF', { cs: 0.0021 }), ...pb(0, -0.018, 'MODE SEL', 'FAULT', 'MAN', { cs: 0.0021 }), ...pb(0.035, -0.018, 'CTR TK PUMP 2', 'FAULT', 'OFF', { cs: 0.0021 }),
    ...pb(0.092, -0.018, '1', 'FAULT', 'OFF', { cs: 0.0022 }), ...pb(0.122, -0.018, '2', 'FAULT', 'OFF', { cs: 0.0022 }),
  ] }),
  elec: () => ({ title: 'ELEC', items: [
    { t: 'text', x: -0.09, y: 0.052, s: 'DC BUS 1', size: 0.0026, boxed: true }, { t: 'text', x: 0.09, y: 0.052, s: 'DC BUS 2', size: 0.0026, boxed: true }, { t: 'text', x: -0.075, y: 0.006, s: 'AC BUS 1', size: 0.0026, boxed: true }, { t: 'text', x: 0, y: 0.006, s: 'AC ESS BUS', size: 0.0026, boxed: true }, { t: 'text', x: 0.075, y: 0.006, s: 'AC BUS 2', size: 0.0026, boxed: true },
    ...pb(-0.124, 0.032, 'COMMERCIAL', '', 'OFF', { cs: 0.0021 }), { t: 'annun', x: -0.062, y: 0.032, w: 0.03, h: 0.012, s: '26.5V' }, ...pb(-0.016, 0.032, 'BAT 1', 'FAULT', 'OFF', { cs: 0.0022 }), ...pb(0.016, 0.032, 'BAT 2', 'FAULT', 'OFF', { cs: 0.0022 }),
    { t: 'annun', x: 0.062, y: 0.032, w: 0.03, h: 0.012, s: '26.7V' }, ...pb(0.124, 0.032, 'AC ESS FEED', 'FAULT', 'ALTN', { cs: 0.0021 }),
    ...pb(-0.124, 0.0, 'GALY & CAB', 'FAULT', 'OFF', { cs: 0.0021 }),
    { t: 'line', pts: [[-0.09, 0.046], [-0.09, 0.006]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[0.09, 0.046], [0.09, 0.006]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[-0.058, 0.006], [-0.02, 0.006]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[0.02, 0.006], [0.058, 0.006]], w: 0.0008, col: '#5ccf98' },
    { t: 'line', pts: [[-0.085, 0.0], [-0.085, -0.034]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[0.085, 0.0], [0.085, -0.034]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[-0.085, -0.018], [-0.01, -0.018]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[0.01, -0.018], [0.085, -0.018]], w: 0.0008, col: '#5ccf98' }, { t: 'line', pts: [[-0.035, -0.034], [-0.035, -0.026], [0.035, -0.026], [0.035, -0.034]], w: 0.0008, col: '#5ccf98' },
    ...pb(0, -0.018, 'BUS TIE', '', 'OFF', { cs: 0.0022 }),
    ...pb(-0.125, -0.044, 'IDG 1', 'FAULT', '', { guard: 'grey', cs: 0.0022 }), ...pb(-0.085, -0.044, 'GEN 1', 'FAULT', 'OFF', { cs: 0.0022 }), ...pb(-0.035, -0.044, 'APU GEN', 'FAULT', 'OFF', { cs: 0.0022 }),
    ...pb(0.035, -0.044, 'EXT PWR', 'AVAIL', 'ON', { cs: 0.0022 }), ...pb(0.085, -0.044, 'GEN 2', 'FAULT', 'OFF', { cs: 0.0022 }), ...pb(0.125, -0.044, 'IDG 2', 'FAULT', '', { guard: 'grey', cs: 0.0022 }),
  ] }),
  adirs: () => ({ title: 'ADIRS', items: [
    { t: 'annun', x: 0, y: 0.056, w: 0.03, h: 0.009, s: 'ON BAT' },
    ...[['IR 1', -0.052], ['IR 3', 0], ['IR 2', 0.052]].flatMap(([n, x]) => [...pb(x, 0.03, n, 'FAULT', 'ALIGN'), cap(x - 0.017, -0.002, 'OFF', 0.0022), cap(x, 0.014, 'NAV', 0.0022), cap(x + 0.017, 0.006, 'ATT', 0.0022), { t: 'knob', x, y: -0.008, r: 0.0095, id: 'ir' + n }, ...pb(x, -0.052, 'ADR ' + n.slice(3), 'FAULT', 'OFF')]),
  ] }),
  blank: () => ({ title: '', items: [] }),
  fltCtl1: (w) => ({ title: 'FLT CTL', items: [...pb(-0.05, -0.006, 'ELAC 1', 'FAULT', 'OFF'), ...pb(0, -0.006, 'SEC 1', 'FAULT', 'OFF'), ...pb(0.05, -0.006, 'FAC 1', 'FAULT', 'OFF')] }),
  fltCtl2: (w) => ({ title: 'FLT CTL', items: [...pb(-0.06, -0.006, 'ELAC 2', 'FAULT', 'OFF'), ...pb(-0.02, -0.006, 'SEC 2', 'FAULT', 'OFF'), ...pb(0.02, -0.006, 'SEC 3', 'FAULT', 'OFF'), ...pb(0.06, -0.006, 'FAC 2', 'FAULT', 'OFF')] }),
  evac: () => ({ title: 'EVAC', items: [...pb(-0.05, -0.006, 'COMMAND', 'EVAC', 'ON', { guard: 'grey' }), ...rb(0.0, -0.006, 'HORN SHUT OFF'), ...tg(0.052, -0.008, 'CAPT & PURS')] }),
  emerElec: () => ({ title: 'EMER ELEC PWR', items: [...pb(-0.062, -0.008, 'EMER GEN TEST', '', '', { guard: 'grey', cs: 0.0021 }), ...pb(-0.02, -0.008, 'GEN 1 LINE', '', 'OFF'), ...pb(0.02, -0.008, 'RAT & EMER GEN', 'FAULT', ''), ...pb(0.06, -0.008, 'MAN ON', '', '', { guard: 'red' })] }),
  gpws: () => ({ title: 'GPWS', items: [['TERR', 'FAULT', 'OFF'], ['SYS', 'FAULT', 'OFF'], ['G/S MODE', '', 'OFF'], ['FLAP MODE', '', 'OFF'], ['LDG FLAP 3', '', 'ON']].flatMap(([c, a, b], i) => pb(-0.064 + i * 0.032, -0.008, c, a, b, { cs: 0.0022 })) }),
  rcdr: () => ({ title: 'RCDR', items: [...pb(-0.045, -0.006, 'GND CTL', '', 'ON'), ...rb(0.0, -0.006, 'CVR ERASE'), ...rb(0.045, -0.006, 'CVR TEST')] }),
  oxygen: () => ({ title: 'OXYGEN', items: [...pb(-0.05, -0.008, 'MASK MAN ON', '', '', { guard: 'red' }), ...pb(0.0, -0.008, 'PASSENGER', 'SYS ON', ''), ...pb(0.05, -0.008, 'CREW SUPPLY', '', 'OFF')] }),
  fire: () => {
    const items = [];
    [['ENG 1', -0.093], ['APU', 0], ['ENG 2', 0.093]].forEach(([n, x]) => {
      items.push(cap(x, 0.04, n, 0.0045), { t: 'pb', x, y: 0.012, w: 0.044, h: 0.03, legends: ['FIRE', 'PUSH'], cols: ['#b8402e', '#c9ccc8'], guard: 'fire', id: 'fire' + n.replace(' ', '') });
      if (n === 'APU') { items.push(...pb(-0.022, -0.03, '', 'SQUIB', 'DISCH'), cap(-0.022, -0.043, 'AGENT', 0.0024), ...rb(0.026, -0.03, 'TEST')); }
      else for (const s of [-1, 1]) items.push(...pb(x + s * 0.037, 0.018, 'AGENT ' + (s < 0 ? 1 : 2), 'SQUIB', 'DISCH', { cs: 0.0022 }));
      if (n !== 'APU') items.push(...rb(x + (n === 'ENG 1' ? -0.037 : 0.037), -0.02, 'TEST'));
    });
    items.push({ t: 'line', pts: [[-0.049, 0.045], [-0.049, -0.045]], w: 0.0006 }, { t: 'line', pts: [[0.049, 0.045], [0.049, -0.045]], w: 0.0006 });
    return { title: '', items };
  },
  cargoSmoke: () => ({ title: 'CARGO SMOKE', items: [...pb(-0.064, -0.006, 'DISCH', 'DISCH', '', { guard: 'red' }), ...pb(-0.03, -0.006, 'FWD', 'SMOKE', ''), ...rb(0.0, -0.006, 'TEST'), ...pb(0.03, -0.006, 'AFT', 'SMOKE', ''), ...pb(0.064, -0.006, 'DISCH', 'DISCH', '', { guard: 'red' })] }),
  vent: () => ({ title: 'VENTILATION', items: [...pb(-0.05, -0.007, 'BLOWER', 'FAULT', 'OVRD'), ...pb(-0.012, -0.007, 'EXTRACT', 'FAULT', 'OVRD'), ...pb(0.055, -0.007, 'CAB FANS', '', 'OFF')] }),
});
// ---- forward panels, laid out from the owner's photo of the overhead (pixel positions -> metres).
// K: metres per photo pixel across; photo rows are foreshortened, so each row has its own vertical factor.
const OK = 0.29 / 2440, GRN = '#8ee86a', GW = 0.0011;
const ocap = (x, y, s, size = 0.0029) => ({ t: 'text', x, y, s, size: size * 1.3, weight: 700 });
const obox = (x, y, s, size = 0.0029) => ({ t: 'text', x, y, s, size: size * 1.3, weight: 700, boxed: true });
const opb = (x, y, top, bot, o = {}) => ({ t: 'pb', x, y, w: o.w || 0.0175, h: o.h || 0.0135, legends: [top, bot], guard: o.guard, id: o.id });
const otg = (x, y, style, id) => ({ t: 'toggle', x, y, style, id, lit: true });
const bracket = (x0, x1, y, d = 0.0025) => ({ t: 'line', pts: [[x0, y - d], [x0, y], [x1, y], [x1, y - d]], w: 0.0006 });
const lcap = (x, y, s, size = 0.0029) => ({ t: 'text', x, y, s, size: size * 1.05, weight: 700 });
const vtext = (x, y, s, size = 0.0024) => s.split('').map((ch, i) => ocap(x, y + (s.length - 1) * size * 0.6 - i * size * 1.2, ch, size));
Object.assign(PANELS, {
  airCond: () => { const X = (px) => (px - 1283) * OK, Y = (py) => (300 - py) * (0.12 / 570);
    const knob = (px, py, id, r = 0.0118, ticks = [-120, -60, 0, 60, 120], arc = 125) => ({ t: 'knob', x: X(px), y: Y(py), r, id, ticks, arc, style: 'bar' });
    const ln = (pts, w = GW) => ({ t: 'line', pts: pts.map(([a, b]) => [X(a), Y(b)]), w, col: GRN });
    const ar = (px, py, dir) => ({ t: 'arrow', x: X(px), y: Y(py), dir, s: 0.0032, col: GRN });
    return { title: '', items: [
      ocap(X(325), Y(38), 'PACK FLOW', 0.0031), ocap(X(325), Y(60), 'NORM', 0.0028), ocap(X(195), Y(112), 'LO', 0.0028), ocap(X(475), Y(112), 'HI', 0.0028),
      opb(X(320), Y(358), '', 'OFF', { id: 'pack1' }), ocap(X(255), Y(285), 'PACK 1', 0.0026),
      knob(330, 205, 'packFlow', 0.0105, [-50, 0, 50], 55),
      ...[['COCKPIT', 910], ['FWD CABIN', 1310], ['AFT CABIN', 1715]].flatMap(([n, px]) => [obox(X(px), Y(47), n, 0.0031), ar(px, 76, 'up'), ocap(X(px - 140), Y(262), 'COLD', 0.0028), ocap(X(px + 140), Y(262), 'HOT', 0.0028), knob(px, 205, { COCKPIT: 'tCkpt', 'FWD CABIN': 'tFwd', 'AFT CABIN': 'tAft' }[n])]),
      ocap(X(2258), Y(90), 'HOT AIR', 0.0031), opb(X(2248), Y(168), 'FAULT', 'OFF', { id: 'hotAir' }),
      ocap(X(2328), Y(282), 'PACK 2', 0.0031), opb(X(2316), Y(352), 'FAULT', 'OFF', { id: 'pack2' }),
      obox(X(597), Y(328), 'PACK 1', 0.0029), obox(X(2037), Y(325), 'PACK 2', 0.0029),
      // flow lines: packs to the mixer and the three zones; bleed manifold with the crossbleed valve
      ln([[590, 420], [590, 288], [2040, 288], [2040, 420]]), ln([[910, 288], [910, 240]]), ln([[1310, 288], [1310, 240]]), ln([[1715, 288], [1715, 240]]),
      ln([[600, 362], [960, 362]]), ln([[1000, 362], [1640, 362]]), ln([[1720, 362], [2030, 362]]), { t: 'circ', x: X(980), y: Y(362), r: 20 * OK, a0: 180, a1: 360, w: GW, col: GRN },
      { t: 'circ', x: X(1680), y: Y(362), r: 40 * OK, w: GW, col: GRN }, ln([[980, 342], [980, 288]]), ln([[1680, 402], [1680, 430]]),
      ln([[790, 362], [790, 392]]), ar(790, 398, 'down'), ln([[1140, 362], [1140, 400]]), ar(1140, 372, 'up'), ln([[1315, 362], [1315, 405]]), ar(1315, 372, 'up'), ln([[1835, 362], [1835, 392]]), ar(1835, 398, 'down'),
      ocap(X(1605), Y(315), 'x', 0.003), ocap(X(795), Y(415), 'START', 0.0028), ocap(X(1835), Y(415), 'START', 0.0028),
      // bottom row
      bracket(X(500), X(725), Y(415)), ocap(X(612), Y(434), 'ENG 1 BLEED', 0.0029), opb(X(622), Y(503), 'FAULT', 'OFF', { id: 'eng1Bleed' }),
      bracket(X(905), X(1070), Y(402)), ocap(X(985), Y(418), 'RAM AIR', 0.0029), opb(X(990), Y(503), '', 'ON', { guard: 'grey', id: 'ramAir' }),
      bracket(X(1080), X(1205), Y(415)), ocap(X(1142), Y(434), 'GND HP', 0.0029),
      bracket(X(1218), X(1415), Y(415)), ocap(X(1315), Y(434), 'APU BLEED', 0.0029), opb(X(1318), Y(503), 'FAULT', 'ON', { id: 'apuBleed' }),
      ocap(X(1678), Y(404), 'AUTO', 0.0028), ocap(X(1520), Y(450), 'SHUT', 0.0028), ocap(X(1830), Y(450), 'OPEN', 0.0028), knob(1670, 498, 'xbleed', 0.0095, [-60, 0, 60], 65),
      bracket(X(1910), X(2140), Y(415)), ocap(X(2025), Y(434), 'ENG 2 BLEED', 0.0029), opb(X(2015), Y(503), 'FAULT', 'OFF', { id: 'eng2Bleed' }),
    ] }; },
  antiIce: () => { const X = (px) => (px - 642) * OK, Y = (py) => (702 - py) * (0.04 / 205);
    return { title: '', items: [lcap(X(710), Y(628), 'ANTI ICE', 0.0036),lcap(X(340), Y(668), 'WING', 0.0028), opb(X(355), Y(733), 'FAULT', 'ON', { id: 'wing' }), { t: 'line', pts: [[X(445), Y(650)], [X(445), Y(800)]], w: 0.0006 }, { t: 'line', pts: [[X(680), Y(650)], [X(680), Y(800)]], w: 0.0006 },
      lcap(X(805), Y(668), 'ENG 1', 0.0028), opb(X(810), Y(733), 'FAULT', 'ON', { id: 'eng1' }), lcap(X(1022), Y(668), 'ENG 2', 0.0028), opb(X(1020), Y(733), 'FAULT', 'ON', { id: 'eng2' })] }; },
  probeHeat: () => { const X = (px) => (px - 1300) * OK, Y = (py) => (702 - py) * (0.04 / 205);
    return { title: '', items: [lcap(X(1302), Y(628), 'PROBE/WINDOW', 0.0031), lcap(X(1318), Y(660), 'HEAT', 0.0031),opb(X(1316), Y(733), '', 'ON', { id: 'probeHeat' }), ...vtext(X(1422), Y(733), 'AUTO')] }; },
  cabPress: () => { const X = (px) => (px - 1970) * OK, Y = (py) => (702 - py) * (0.04 / 205);
    return { title: '', items: [lcap(X(1770), Y(626), 'CABIN PRESS', 0.0034),
      lcap(X(1585), Y(666), 'MAN V/S CTL', 0.0026), otg(X(1590), Y(733), undefined, 'manVs'), lcap(X(1690), Y(690), 'UP', 0.0026), lcap(X(1700), Y(768), 'DN', 0.0026),
      lcap(X(1800), Y(666), 'MODE SEL', 0.0026), opb(X(1792), Y(733), 'FAULT', 'MAN', { id: 'modeSel' }), ...vtext(X(1890), Y(733), 'AUTO'),
      lcap(X(2080), Y(628), 'LDG ELEV', 0.0026), lcap(X(2080), Y(646), 'AUTO', 0.0024),
      ...[['14', 1935, 705], ['12', 1920, 740], ['10', 1940, 775], ['-2', 2085, 668], ['0', 2120, 688], ['2', 2140, 722], ['4', 2122, 760]].map(([t, a, b]) => lcap(X(a), Y(b), t, 0.0023)),
      { t: 'knob', style: 'bar', x: X(2035), y: Y(745), r: 0.0085, id: 'ldgElev', ticks: [-140, -110, -80, -50, -20, 10, 40, 70, 100, 130], arc: 140 },
      lcap(X(2295), Y(646), 'DITCHING', 0.0026), opb(X(2280), Y(733), '', 'ON', { guard: 'grey', id: 'ditching' }),
    ] }; },
  extLt: () => { const X = (px) => (px - 675) * OK, Y = (py) => (967 - py) * (0.058 / 325);
    return { title: '', items: [lcap(X(700), Y(827), 'EXT LT', 0.0036),
      lcap(X(365), Y(848), 'STROBE', 0.0027), lcap(X(365), Y(866), 'ON', 0.0026), otg(X(380), Y(922), 'ribbed', 'strobe'), ...vtext(X(468), Y(912), 'AUTO', 0.0022), lcap(X(380), Y(990), 'OFF', 0.0024),
      lcap(X(565), Y(848), 'BEACON', 0.0027), lcap(X(565), Y(866), 'ON', 0.0026), otg(X(575), Y(922), 'ribbed', 'beacon'),
      lcap(X(808), Y(848), 'WING', 0.0027), lcap(X(808), Y(866), 'ON', 0.0026), otg(X(810), Y(922), undefined, 'wingLt'), lcap(X(810), Y(980), 'OFF', 0.0024),
      lcap(X(1047), Y(848), 'NAV & LOGO', 0.0027), lcap(X(1047), Y(866), '2', 0.0026), otg(X(1045), Y(922), 'ribbed', 'navLogo'), lcap(X(1142), Y(920), '1', 0.0026), lcap(X(1045), Y(985), 'OFF', 0.0024),
      lcap(X(425), Y(997), 'RWY TURN OFF', 0.0026), lcap(X(425), Y(1015), 'ON', 0.0026), otg(X(435), Y(1075), undefined, 'rwyTurnOff'), lcap(X(435), Y(1125), 'OFF', 0.0024),
      bracket(X(600), X(880), Y(995), -0.002), lcap(X(737), Y(997), 'LAND', 0.0027), lcap(X(620), Y(1015), 'L', 0.0026), lcap(X(852), Y(1015), 'R', 0.0026),
      lcap(X(740), Y(1030), 'ON', 0.0025), lcap(X(740), Y(1068), 'OFF', 0.0025), lcap(X(740), Y(1106), 'RETRACT', 0.0025),
      otg(X(630), Y(1075), 'tbar', 'landL'), otg(X(856), Y(1075), 'tbar', 'landR'),
      lcap(X(1052), Y(1015), 'NOSE', 0.0026), otg(X(1055), Y(1075), undefined, 'nose'), lcap(X(1150), Y(1042), 'T.O', 0.0024), lcap(X(1160), Y(1069), 'TAXI', 0.0024), lcap(X(1155), Y(1100), 'OFF', 0.0024),
    ] }; },
  apu: () => { const X = (px) => (px - 1312) * OK, Y = (py) => (967 - py) * (0.058 / 325);
    return { title: '', items: [lcap(X(1318), Y(833), 'APU', 0.0036),lcap(X(1320), Y(888), 'MASTER SW', 0.0026), opb(X(1320), Y(945), 'FAULT', 'ON', { id: 'apuMaster' }), lcap(X(1322), Y(1015), 'START', 0.0026), opb(X(1322), Y(1072), 'AVAIL', 'ON', { id: 'apuStart' })] }; },
  signsIntLt: () => { const X = (px) => (px - 1950) * OK, Y = (py) => (967 - py) * (0.058 / 325);
    return { title: '', items: [lcap(X(1985), Y(812), 'INT LT', 0.0034),
      lcap(X(1590), Y(836), 'OVHD INTEG LT', 0.0026), { t: 'knob', style: 'knurl', x: X(1565), y: Y(905), r: 0.0068, id: 'ovhdInteg', ticks: [-130, 130], arc: 130 }, lcap(X(1472), Y(950), 'OFF', 0.0024), lcap(X(1662), Y(950), 'BRT', 0.0024),
      lcap(X(1815), Y(830), 'ICE IND &', 0.0026), lcap(X(1815), Y(848), 'STBY COMPASS', 0.0026), otg(X(1785), Y(905), undefined, 'iceInd'), lcap(X(1785), Y(960), 'OFF', 0.0024),
      lcap(X(1975), Y(848), 'DOME', 0.0026), otg(X(1975), Y(905), undefined, 'dome'), lcap(X(2082), Y(872), 'BRT', 0.0024), lcap(X(2082), Y(903), 'DIM', 0.0024), lcap(X(2082), Y(935), 'OFF', 0.0024),
      lcap(X(2205), Y(848), 'ANN LT', 0.0026), otg(X(2205), Y(905), undefined, 'annLt'), lcap(X(2340), Y(872), 'TEST', 0.0024), lcap(X(2335), Y(903), 'BRT', 0.0024), lcap(X(2330), Y(935), 'DIM', 0.0024),
      { t: 'line', pts: [[X(1455), Y(975)], [X(2450), Y(975)]], w: 0.0006 }, lcap(X(1910), Y(995), 'SIGNS', 0.0032),
      lcap(X(1545), Y(1000), 'SEAT BELTS', 0.0024), otg(X(1550), Y(1072), undefined, 'seatBelts'), lcap(X(1550), Y(1120), 'OFF', 0.0024), lcap(X(1550), Y(1022), 'ON', 0.0024),
      lcap(X(1735), Y(1000), 'NO SMOKING', 0.0024), lcap(X(1735), Y(1022), 'ON', 0.0024), otg(X(1730), Y(1072), undefined, 'noSmoking'), ...vtext(X(1820), Y(1072), 'AUTO', 0.0021), lcap(X(1730), Y(1120), 'OFF', 0.0024),
      { t: 'line', pts: [[X(1865), Y(1010)], [X(1865), Y(1130)]], w: 0.0006 },
      { t: 'annun', x: X(1950), y: Y(1075), w: 0.012, h: 0.009, s: 'OFF', id: 'emerExitOff' },
      lcap(X(2080), Y(1015), 'EMER EXIT LT', 0.0024), otg(X(2130), Y(1072), undefined, 'emerExit'), lcap(X(2232), Y(1042), 'ON', 0.0024), lcap(X(2245), Y(1072), 'ARM', 0.0024), lcap(X(2240), Y(1102), 'OFF', 0.0024),
    ] }; },
});
// ---- FIRE, HYD, FUEL, ELEC laid out from reference photographs of the A320 overhead (one image per panel,
// spanning the full 0.29 m panel width). P(px, py) maps reference pixels to panel coordinates.
const refMap = (W, H, hd) => [(px) => (px - W / 2) * (0.29 / W), (py) => (H / 2 - py) * (hd / H)];
const G2 = GRN;
const gl = (X, Y, pts) => ({ t: 'line', pts: pts.map(([a, b]) => [X(a), Y(b)]), w: GW, col: G2 });
const ga = (X, Y, px, py, dir) => ({ t: 'arrow', x: X(px), y: Y(py), dir, s: 0.003, col: G2 });
const rc = (X, Y, px, py, s, size = 0.0029) => ocap(X(px), Y(py), s, size);
const rbx = (X, Y, px, py, s, size = 0.0029) => obox(X(px), Y(py), s, size);
const rpb = (X, Y, px, py, top, bot, o = {}) => opb(X(px), Y(py), top, bot, o);
const rbr = (X, Y, x0, x1, py) => bracket(X(x0), X(x1), Y(py));
Object.assign(PANELS, {
  elec: (w, hd) => { const [X, Y] = refMap(1126, 264, hd); return { title: '', items: [
    rc(X, Y, 128, 12, 'COMMERCIAL'), rpb(X, Y, 128, 44, '', 'OFF', { id: 'commercial' }),
    rc(X, Y, 127, 82, 'GALY & CAB'), rpb(X, Y, 128, 114, 'FAULT', 'OFF', { id: 'galyCab' }), ...vtext(X(161), Y(112), 'AUTO', 0.0021),
    rbx(X, Y, 232, 28, 'DC BUS 1'), rbx(X, Y, 232, 103, 'AC BUS 1'), gl(X, Y, [[232, 92], [232, 40]]), ga(X, Y, 232, 62, 'up'),
    rc(X, Y, 387, 12, 'BAT 1'), { t: 'annun', x: X(383), y: Y(52), w: 0.026, h: 0.009, s: '', id: 'bat1V', lcd: true },
    rc(X, Y, 507, 12, '1'), rc(X, Y, 534, 12, 'BAT'), rc(X, Y, 562, 12, '2'), rpb(X, Y, 507, 54, 'FAULT', 'OFF', { id: 'bat1' }), rpb(X, Y, 563, 54, 'FAULT', 'OFF', { id: 'bat2' }),
    rc(X, Y, 667, 12, 'BAT 2'), { t: 'annun', x: X(670), y: Y(52), w: 0.026, h: 0.009, s: '', id: 'bat2V', lcd: true },
    rc(X, Y, 790, 40, 'AC ESS FEED'), rpb(X, Y, 790, 80, 'FAULT', 'ALTN', { id: 'acEssFeed' }),
    rbx(X, Y, 898, 28, 'DC BUS 2'), rbx(X, Y, 898, 103, 'AC BUS 2'), gl(X, Y, [[898, 92], [898, 40]]), ga(X, Y, 898, 62, 'up'),
    rbx(X, Y, 567, 103, 'AC ESS BUS'), gl(X, Y, [[276, 103], [512, 103]]), ga(X, Y, 508, 103, 'right'), gl(X, Y, [[855, 103], [622, 103]]), ga(X, Y, 626, 103, 'left'),
    gl(X, Y, [[232, 114], [232, 150], [898, 150], [898, 114]]),
    rc(X, Y, 563, 140, ''), rpb(X, Y, 563, 172, 'FAULT', 'OFF', { id: 'busTie' }), rc(X, Y, 563, 142, 'BUS TIE', 0.0026), ...vtext(X(610), Y(172), 'AUTO', 0.0021),
    rbr(X, Y, 190, 280, 162), rc(X, Y, 236, 174, 'GEN 1'), rpb(X, Y, 240, 212, 'FAULT', 'OFF', { id: 'gen1' }),
    rpb(X, Y, 125, 206, 'FAULT', '', { guard: 'red', id: 'idg1' }), rc(X, Y, 125, 165, 'IDG 1'), gl(X, Y, [[163, 214], [208, 214]]),
    rc(X, Y, 425, 173, 'APU GEN'), rpb(X, Y, 425, 212, 'FAULT', 'OFF', { id: 'apuGen' }), gl(X, Y, [[470, 222], [545, 222], [545, 202]]), gl(X, Y, [[583, 202], [583, 222], [660, 222]]),
    rc(X, Y, 700, 173, 'EXT PWR'), rpb(X, Y, 700, 212, 'AVAIL', 'ON', { id: 'extPwr' }),
    rbr(X, Y, 845, 940, 162), rc(X, Y, 897, 174, 'GEN 2'), rpb(X, Y, 888, 212, 'FAULT', 'OFF', { id: 'gen2' }),
    rpb(X, Y, 1003, 206, 'FAULT', '', { guard: 'red', id: 'idg2' }), rc(X, Y, 1003, 165, 'IDG 2'), gl(X, Y, [[930, 214], [975, 214]]),
  ] }; },
  fire: (w, hd) => { const [X, Y] = refMap(1126, 186, hd); const items = [];
    for (const [n, x, hy, a1, a2, tx] of [['ENG 1', 237, 105, 87, 393, 87], ['ENG 2', 885, 105, 731, 1036, 1043]]) {
      items.push(rc(X, Y, x, 36, n, 0.0052), { t: 'pb', x: X(x), y: Y(hy), w: 0.042, h: 0.026, legends: ['FIRE', 'PUSH'], cols: ['#b8402e', '#c9ccc8'], guard: 'fire', id: 'fire' + n.replace(' ', '') });
      items.push(rc(X, Y, a1, 32, 'AGENT 1', 0.0025), rpb(X, Y, a1, 68, 'SQUIB', 'DISCH', { id: 'agent1' + n.replace(' ', '') }), rc(X, Y, a2, 32, 'AGENT 2', 0.0025), rpb(X, Y, a2, 68, 'SQUIB', 'DISCH', { id: 'agent2' + n.replace(' ', '') }));
      items.push(rc(X, Y, tx, 108, 'TEST', 0.0025), { t: 'rbtn', x: X(tx), y: Y(131), r: 0.004, id: 'test' + n.replace(' ', '') });
    }
    items.push(rc(X, Y, 562, 22, 'APU', 0.0052), { t: 'pb', x: X(562), y: Y(80), w: 0.042, h: 0.026, legends: ['FIRE', 'PUSH'], cols: ['#b8402e', '#c9ccc8'], guard: 'fire', id: 'fireAPU' },
      rpb(X, Y, 480, 160, 'SQUIB', 'DISCH', { id: 'agentAPU' }), rc(X, Y, 535, 157, 'AGENT', 0.0025), rc(X, Y, 641, 136, 'TEST', 0.0025), { t: 'rbtn', x: X(640), y: Y(152), r: 0.004, id: 'testAPU' },
      { t: 'line', pts: [[X(438), Y(18)], [X(438), Y(150)]], w: 0.0006 }, { t: 'line', pts: [[X(678), Y(18)], [X(678), Y(150)]], w: 0.0006 });
    return { title: '', items }; },
  hyd: (w, hd) => { const [X, Y] = refMap(1126, 172, hd); return { title: '', items: [
    rbx(X, Y, 235, 17, 'GREEN'), rbx(X, Y, 566, 17, 'BLUE'), rbx(X, Y, 891, 17, 'YELLOW'),
    gl(X, Y, [[235, 72], [235, 28]]), ga(X, Y, 235, 34, 'up'), gl(X, Y, [[235, 40], [700, 40]]), gl(X, Y, [[755, 40], [885, 40]]), ga(X, Y, 330, 40, 'left'), ga(X, Y, 640, 40, 'left'), ga(X, Y, 800, 40, 'right'),
    gl(X, Y, [[885, 72], [885, 28]]), ga(X, Y, 885, 34, 'up'), gl(X, Y, [[885, 52], [1010, 52], [1010, 68]]), ga(X, Y, 935, 52, 'left'),
    gl(X, Y, [[566, 64], [566, 28]]), ga(X, Y, 566, 34, 'up'), { t: 'circ', x: X(566), y: Y(40), r: 12 * 0.29 / 1126, a0: 0, a1: 180, w: GW, col: G2 },
    rbr(X, Y, 190, 280, 72), rc(X, Y, 235, 88, 'ENG 1 PUMP'), rpb(X, Y, 233, 128, 'FAULT', 'OFF', { id: 'eng1Pump' }),
    rc(X, Y, 395, 57, 'RAT MAN ON'), gl(X, Y, [[450, 50], [462, 50], [462, 64], [450, 64]]), gl(X, Y, [[462, 57], [500, 57]]),
    { t: 'pb', x: X(392), y: Y(122), w: 0.0175, h: 0.0175, legends: ['', ''], guard: 'red', id: 'ratManOn' },
    rbr(X, Y, 520, 612, 64), rc(X, Y, 566, 76, 'ELEC PUMP'), rpb(X, Y, 563, 118, 'FAULT', 'OFF', { guard: 'grey', id: 'blueElec' }), ...vtext(X(610), Y(118), 'AUTO', 0.0021),
    rc(X, Y, 727, 40, 'PTU', 0.0027), { t: 'line', pts: [[X(705), Y(50)], [X(705), Y(32)], [X(752), Y(32)], [X(752), Y(50)]], w: 0.0006 }, rpb(X, Y, 730, 82, 'FAULT', 'OFF', { id: 'ptu' }), ...vtext(X(776), Y(82), 'AUTO', 0.0021),
    rbr(X, Y, 845, 935, 72), rc(X, Y, 897, 88, 'ENG 2 PUMP'), rpb(X, Y, 893, 128, 'FAULT', 'OFF', { id: 'eng2Pump' }),
    rbr(X, Y, 965, 1055, 68), rc(X, Y, 1010, 82, 'ELEC PUMP'), rpb(X, Y, 1010, 118, 'FAULT', 'ON', { id: 'yellowElec' }),
  ] }; },
  fuel: (w, hd) => { const [X, Y] = refMap(1126, 160, hd); return { title: '', items: [
    rbx(X, Y, 239, 16, 'ENG 1'), rbx(X, Y, 457, 16, 'APU'), rbx(X, Y, 887, 16, 'ENG 2'),
    gl(X, Y, [[239, 63], [239, 28]]), ga(X, Y, 239, 34, 'up'), gl(X, Y, [[457, 63], [457, 28]]), ga(X, Y, 457, 34, 'up'), gl(X, Y, [[887, 63], [887, 28]]), ga(X, Y, 887, 34, 'up'),
    gl(X, Y, [[239, 42], [538, 42]]), gl(X, Y, [[590, 42], [887, 42]]),
    rc(X, Y, 563, 8, 'X FEED', 0.0026), rpb(X, Y, 563, 44, 'OPEN', 'ON', { id: 'xfeed' }),
    rbr(X, Y, 148, 320, 63), rc(X, Y, 230, 70, 'L TK PUMPS'), rc(X, Y, 190, 84, '1', 0.0025), rc(X, Y, 276, 84, '2', 0.0025),
    rpb(X, Y, 190, 123, 'FAULT', 'OFF', { id: 'ltk1' }), rpb(X, Y, 276, 123, 'FAULT', 'OFF', { id: 'ltk2' }),
    rbr(X, Y, 428, 500, 63), rc(X, Y, 463, 72, 'PUMP 1'), rc(X, Y, 510, 60, 'CTR TK', 0.0025), rpb(X, Y, 467, 123, 'FAULT', 'OFF', { id: 'ctr1' }),
    rc(X, Y, 563, 78, 'MODE SEL', 0.0026), rpb(X, Y, 563, 123, 'FAULT', 'MAN', { id: 'fuelMode' }),
    rbr(X, Y, 625, 700, 63), rc(X, Y, 662, 72, 'PUMP 2'), rc(X, Y, 620, 60, 'CTR TK', 0.0025), rpb(X, Y, 661, 123, 'FAULT', 'OFF', { id: 'ctr2' }),
    rbr(X, Y, 805, 985, 63), rc(X, Y, 894, 70, 'R TK PUMPS'), rc(X, Y, 846, 84, '1', 0.0025), rc(X, Y, 939, 84, '2', 0.0025),
    rpb(X, Y, 846, 123, 'FAULT', 'OFF', { id: 'rtk1' }), rpb(X, Y, 939, 123, 'FAULT', 'OFF', { id: 'rtk2' }),
  ] }; },
});
// ---- left column, laid out from reference photographs (one image per panel, 0.17 m wide)
const refL = (H, hd) => [(px) => (px - 338) * (0.17 / 676), (py) => (H / 2 - py) * (hd / H)];
const rk = (X, Y, px, py, id, r = 0.0095, ticks = [-45, 0, 45], arc = 55) => ({ t: 'knob', style: 'bar', x: X(px), y: Y(py), r, id, ticks, arc });
const rrb = (X, Y, px, py, r = 0.0058, id) => ({ t: 'rbtn', x: X(px), y: Y(py), r, id });
Object.assign(PANELS, {
  adirs: (w, hd) => { const [X, Y] = refL(468, hd); const items = [lcap(X(352), Y(20), 'ADIRS', 0.0036), { t: 'annun', x: X(344), y: Y(52), w: 0.028, h: 0.009, s: 'ON BAT', id: 'onBat' }];
    for (const [n, x] of [['1', 142], ['3', 340], ['2', 538]]) {
      items.push(rc(X, Y, x, 112, 'IR ' + n), rpb(X, Y, x, 165, 'FAULT', 'OFF', { id: 'ir' + n }),
        rc(X, Y, x - 85, 255, 'OFF', 0.0025), rc(X, Y, x - 5, 226, 'NAV', 0.0025), rc(X, Y, x + 68, 247, 'ATT', 0.0025), rk(X, Y, x, 300, 'irSel' + n, 0.0105, [-50, 0, 50], 55),
        rc(X, Y, x + 3, 362, 'ADIR ' + n), rpb(X, Y, x, 420, 'FAULT', 'OFF', { id: 'adr' + n }));
    }
    return { title: '', items }; },
  fltCtl1: (w, hd) => { const [X, Y] = refL(168, hd); return { title: '', items: [lcap(X(352), Y(22), 'FLT CTL', 0.0036),
    ...[['ELAC 1', 287], ['SEC 1', 415], ['FAC 1', 535]].flatMap(([n, x]) => [rc(X, Y, x, 48, n), rpb(X, Y, x, 112, 'FAULT', 'OFF', { id: n.replace(' ', '') })])] }; },
  evac: (w, hd) => { const [X, Y] = refL(165, hd); return { title: '', items: [lcap(X(355), Y(15), 'EVAC', 0.0036),
    rc(X, Y, 263, 20, 'COMMAND'), rpb(X, Y, 262, 72, 'EVAC', 'ON', { guard: 'grey', id: 'evacCmd' }),
    rc(X, Y, 403, 37, 'HORN SHUT OFF'), rrb(X, Y, 403, 86, undefined, 'hornShutOff'), rc(X, Y, 555, 37, 'CAPT & PURS'), otg(X(555), Y(86), undefined, 'evacSel'), rc(X, Y, 555, 148, 'CAPT', 0.0024)] }; },
  emerElec: (w, hd) => { const [X, Y] = refL(179, hd); return { title: '', items: [lcap(X(350), Y(18), 'EMER ELEC PWR', 0.0034),
    rc(X, Y, 120, 16, 'EMER GEN TEST'), rpb(X, Y, 118, 105, '', '', { guard: 'grey', id: 'emerGenTest' }), { t: 'line', pts: [[X(190), Y(32)], [X(190), Y(140)]], w: 0.0006 },
    rc(X, Y, 264, 48, 'GEN 1 LINE'), rpb(X, Y, 262, 113, 'SMOKE', 'OFF', { id: 'gen1Line' }),
    rc(X, Y, 404, 36, 'RAT', 0.0024), rc(X, Y, 404, 48, '&', 0.0024), rc(X, Y, 404, 60, 'EMER GEN'), rpb(X, Y, 405, 113, 'FAULT', '', { id: 'ratEmerGen' }),
    rc(X, Y, 505, 22, 'MAN ON'), rpb(X, Y, 505, 92, '', '', { guard: 'red', id: 'emerManOn' }), ...vtext(X(572), Y(92), 'AUTO', 0.0021)] }; },
  gpws: (w, hd) => { const [X, Y] = refL(162, hd); return { title: '', items: [lcap(X(290), Y(14), 'GPWS', 0.0036), { t: 'line', pts: [[X(165), Y(40)], [X(165), Y(150)]], w: 0.0006 },
    ...[['TERR', 101, 'FAULT', 'OFF'], ['SYS', 228, 'FAULT', 'OFF'], ['G/S\nMODE', 352, '', 'OFF'], ['FLAP\nMODE', 458, '', 'OFF'], ['LDG\nFLAP 3', 568, '', 'ON']].flatMap(([n, x, a, b]) => [rc(X, Y, x, n.includes('\n') ? 38 : 46, n), rpb(X, Y, x, 102, a, b, { id: 'gpws' + x })])] }; },
  rcdr: (w, hd) => { const [X, Y] = refL(138, hd); return { title: '', items: [lcap(X(405), Y(16), 'RCDR', 0.0036),
    rc(X, Y, 254, 28, 'GND CTL'), rpb(X, Y, 255, 80, '', 'ON', { id: 'gndCtl' }), ...vtext(X(318), Y(80), 'AUTO', 0.0021),
    rc(X, Y, 403, 36, 'CVR ERASE'), rrb(X, Y, 403, 82, undefined, 'cvrErase'), rc(X, Y, 552, 28, 'CVR TEST'), rrb(X, Y, 552, 82, undefined, 'cvrTest')] }; },
  oxygen: (w, hd) => { const [X, Y] = refL(186, hd); return { title: '', items: [lcap(X(379), Y(22), 'OXYGEN', 0.0036),
    rc(X, Y, 257, 48, 'MASK MAN ON'), rpb(X, Y, 258, 112, '', '', { guard: 'red', id: 'maskManOn' }),
    rc(X, Y, 408, 62, 'PASSENGER'), rpb(X, Y, 408, 120, 'SYS ON', '', { id: 'paxOxy' }), { t: 'line', pts: [[X(470), Y(40)], [X(470), Y(150)]], w: 0.0006 },
    rc(X, Y, 558, 40, 'CREW'), rc(X, Y, 558, 58, 'SUPPLY'), rpb(X, Y, 558, 120, '', 'OFF', { id: 'crewOxy' })] }; },
  callsWiper: (w, hd) => { const [X, Y] = refL(342, hd); return { title: '', items: [lcap(X(334), Y(16), 'CALLS', 0.0036),
    ...[['MECH', 101], ['ALL', 215], ['FWD', 330], ['AFT', 448]].flatMap(([n, x]) => [rc(X, Y, x, 34, n), rrb(X, Y, x, 92, 0.0062, 'call' + n)]),
    rc(X, Y, 565, 30, 'EMER'), rpb(X, Y, 557, 92, 'CALL', 'ON', { guard: 'grey', id: 'emerCall' }),
    { t: 'line', pts: [[X(55), Y(150)], [X(640), Y(150)]], w: 0.0006 },
    lcap(X(280), Y(175), 'RAIN RPLNT', 0.0033), rrb(X, Y, 280, 232, 0.0062, 'rainRplnt'),
    rc(X, Y, 545, 175, 'WIPER'), rc(X, Y, 483, 178, 'OFF', 0.0025), rc(X, Y, 584, 199, 'SLOW', 0.0025), rc(X, Y, 604, 275, 'FAST', 0.0025),
    rk(X, Y, 515, 275, 'wiperL', 0.011, [-30, 30, 75], 0)] }; },
});
// ---- right column (and the PA / door video panel), from reference photographs, 0.17 m wide
const rkey = (X, Y, px, py, s, id, w = 0.015, h = 0.0085) => ({ t: 'key', x: X(px), y: Y(py), w, h, s, id });
const rvk = (X, Y, px, py, id) => ({ t: 'knob', style: 'round', x: X(px), y: Y(py), r: 0.0055, id });
Object.assign(PANELS, {
  acp: (w, hd) => { const [X, Y] = refL(319, hd); const items = [];
    [['CALL', 'VHF 1', 112], ['CALL', 'VHF 2', 178], ['CALL', 'VHF 3', 252], ['CALL', 'HF 1', 328], ['CALL', 'HF 2', 405], ['MECH', 'INT', 482], ['ATT', 'CAB', 555]].forEach(([k, n, x]) => items.push(rkey(X, Y, x, 55, k, 'acpT' + n), rc(X, Y, x, 88, n, 0.0026), rvk(X, Y, x, 122, 'acpV' + n)));
    items.push(rc(X, Y, 138, 170, 'INT', 0.0026), otg(X(130), Y(205), undefined, 'acpIntRad'), rc(X, Y, 152, 238, 'RAD', 0.0026),
      rkey(X, Y, 256, 205, 'VOICE', 'acpVoice', 0.017), rkey(X, Y, 330, 203, 'RESET', 'acpReset', 0.017), rvk(X, Y, 440, 196, 'acpPA'), rc(X, Y, 490, 200, 'PA', 0.0026),
      { t: 'line', pts: [[X(520), Y(175)], [X(595), Y(175)], [X(595), Y(226)], [X(520), Y(226)], [X(520), Y(175)]], w: 0.0006 }, rkey(X, Y, 557, 200, '', 'acpPAkey'));
    [['VOR 1', 92], ['VOR 2', 170], ['MKR', 245], ['ILS', 322], ['MLS', 403], ['ADF 1', 478], ['ADF 2', 556]].forEach(([n, x]) => items.push(rc(X, Y, x, 234, n, 0.0026), rvk(X, Y, x, 268, 'acpR' + n)));
    return { title: '', items }; },
  paVideo: (w, hd) => { const [X, Y] = refL(165, hd); return { title: '', items: [rc(X, Y, 270, 48, 'PA'), rpb(X, Y, 272, 100, '', '', { id: 'paKey' }), { t: 'line', pts: [[X(470), Y(15)], [X(470), Y(150)]], w: 0.0006 },
    rc(X, Y, 538, 22, 'COCKPIT'), rc(X, Y, 540, 46, 'DOOR VIDEO'), rpb(X, Y, 538, 100, '', 'OFF', { id: 'doorVideo' })] }; },
  fltCtl2: (w, hd) => { const [X, Y] = refL(165, hd); return { title: '', items: [lcap(X(338), Y(22), 'FLT CTL', 0.0036),
    ...[['ELAC 2', 145], ['SEC 2', 273], ['SEC 3', 397], ['FAC 2', 525]].flatMap(([n, x]) => [rc(X, Y, x, 44, n), rpb(X, Y, x, 98, 'FAULT', 'OFF', { id: n.replace(' ', '') })])] }; },
  cargoVent: (w, hd) => { const [X, Y] = refL(244, hd); return { title: '', items: [lcap(X(330), Y(22), 'CARGO VENT', 0.0033), { t: 'line', pts: [[X(328), Y(40)], [X(328), Y(238)]], w: 0.0006 },
    rc(X, Y, 558, 34, 'AFT ISOL VALVE'), rpb(X, Y, 556, 92, 'FAULT', 'OFF', { id: 'aftIsol' })] }; },
  cargoSmoke: (w, hd) => { const [X, Y] = refL(187, hd); return { title: '', items: [lcap(X(338), Y(26), 'CARGO   SMOKE', 0.0033), { t: 'line', pts: [[X(10), Y(6)], [X(666), Y(6)]], w: 0.0006 },
    rc(X, Y, 110, 22, 'DISCH'), rpb(X, Y, 110, 100, 'DISCH', '', { guard: 'red', id: 'cargoDisch1' }), rc(X, Y, 202, 66, 'FWD'), rpb(X, Y, 200, 112, 'SMOKE', '', { id: 'fwdSmoke' }),
    rc(X, Y, 326, 58, 'TEST'), rrb(X, Y, 326, 112, 0.0072, 'smokeTest'),
    rc(X, Y, 465, 66, 'AFT'), rpb(X, Y, 465, 112, 'SMOKE', '', { id: 'aftSmoke' }), rc(X, Y, 560, 22, 'DISCH'), rpb(X, Y, 560, 100, 'DISCH', '', { guard: 'red', id: 'cargoDisch2' })] }; },
  vent: (w, hd) => { const [X, Y] = refL(176, hd); return { title: '', items: [lcap(X(328), Y(22), 'VENTILATION', 0.0033), { t: 'line', pts: [[X(10), Y(2)], [X(666), Y(2)]], w: 0.0006 },
    rc(X, Y, 115, 64, 'BLOWER'), rpb(X, Y, 113, 116, 'FAULT', 'OVRD', { id: 'blower' }), ...vtext(X(178), Y(116), 'AUTO', 0.0021),
    rc(X, Y, 252, 62, 'EXTRACT'), rpb(X, Y, 250, 116, 'FAULT', 'OVRD', { id: 'extract' }), ...vtext(X(313), Y(116), 'AUTO', 0.0021),
    { t: 'line', pts: [[X(488), Y(30)], [X(488), Y(160)]], w: 0.0006 }, rc(X, Y, 557, 60, 'CAB FANS'), rpb(X, Y, 558, 112, '', 'OFF', { id: 'cabFans' })] }; },
  engMan: (w, hd) => { const [X, Y] = refL(184, hd); return { title: '', items: [{ t: 'line', pts: [[X(10), Y(4)], [X(666), Y(4)]], w: 0.0006 },
    rc(X, Y, 190, 18, 'ENG'), rc(X, Y, 190, 34, 'MAN START'), rc(X, Y, 484, 18, 'ENG'), rc(X, Y, 484, 34, 'N1 MODE'), { t: 'line', pts: [[X(328), Y(40)], [X(328), Y(170)]], w: 0.0006 },
    ...[[115, 'manStart1'], [260, 'manStart2'], [422, 'n1Mode1'], [562, 'n1Mode2']].flatMap(([x, id], i) => [rc(X, Y, x, 56, String(i % 2 + 1), 0.0025), rpb(X, Y, x, 120, '', 'ON', { guard: 'grey', id })])] }; },
});
Object.assign(PANELS, {
  // F/O wiper panel: mirror of the captain's
  wiperR: (w, hd) => { const [X, Y] = refL(187, hd); const M = (px) => X(676 - px); return { title: '', items: [{ t: 'line', pts: [[X(55), Y(4)], [X(640), Y(4)]], w: 0.0006 },
    lcap(M(280), Y(20), 'RAIN RPLNT', 0.0033), rrb((px) => M(px), Y, 280, 77, 0.0062, 'rainRplnt'),
    ocap(M(545), Y(20), 'WIPER'), ocap(M(483), Y(23), 'OFF', 0.0025), ocap(M(584), Y(44), 'SLOW', 0.0025), ocap(M(604), Y(120), 'FAST', 0.0025),
    rk((px) => M(px), Y, 515, 120, 'wiperR', 0.011, [-30, 30, 75], 0)] }; },
});
export const LAYOUT = {
  left: { w: 0.17, rows: [['paVideo', 0.065], ['adirs', 0.118], ['blank', 0.05], ['fltCtl1', 0.042], ['evac', 0.0415], ['emerElec', 0.045], ['gpws', 0.041], ['rcdr', 0.035], ['oxygen', 0.047], ['callsWiper', 0.086]] },
  centre: { w: 0.29, rows: [['blank', 0.108], ['fire', 0.079], ['hyd', 0.073], ['fuel', 0.068], ['elec', 0.112], ['airCond', 0.12], [['antiIce', 'probeHeat', 'cabPress'], 0.04], [['extLt', 'apu', 'signsIntLt'], 0.058]] },
  right: { w: 0.17, rows: [['acp', 0.08], ['blank', 0.07], ['blank', 0.08], ['fltCtl2', 0.0415], ['cargoVent', 0.061], ['cargoSmoke', 0.047], ['vent', 0.044], ['engMan', 0.046], ['wiperR', 0.047]] },
};
const WEIGHT = { antiIce: 0.416, probeHeat: 0.157, cabPress: 0.427, extLt: 0.443, apu: 0.114, signsIntLt: 0.443 };
const GAP = 0.003;
const COLX = { left: -0.32 + 0.17 / 2, centre: 0, right: 0.32 - 0.17 / 2 };

export function makeOverheadPanels(M, A, systemLen = 0.65) {
  const out = [];
  const make = (key, w, hd, f) => {
    const def = PANELS[key];
    const spec = def(w, hd);
    const VT = { fire: 'FIRE', hyd: 'HYD', fuel: 'FUEL', elec: 'ELEC', airCond: 'AIR COND' };
    if (VT[key]) { spec.items = [...spec.items, ...vt(VT[key].replace(' ', ''), w / 2, hd)]; spec.title = ''; }
    const items = spec.items.map((i) => ({ ...i, y: i.y * f, ...(i.pts ? { pts: i.pts.map(([x, y]) => [x, y * f]) } : {}) }));
    return buildPanel({ w, h: hd * f, name: key, bg: '#6a798a', titleSize: 0.0048, ...spec, items }, M, A);
  };
  const centreTotal = LAYOUT.centre.rows.reduce((s, [, h]) => s + h, 0);
  const fC = (systemLen - GAP * (LAYOUT.centre.rows.length - 1)) / centreTotal;
  for (const [col, { w, rows, fill }] of Object.entries(LAYOUT)) {
    const tot = rows.reduce((s, [, h]) => s + h, 0);
    const f = fill === false ? fC : (systemLen - GAP * (rows.length - 1)) / tot;
    let y = 0;
    for (const [key, hd] of rows) {
      const h = hd * f;
      if (Array.isArray(key)) {
        const n = key.length; const tw = key.reduce((s, k) => s + (WEIGHT[k] || 1), 0); let x0 = COLX[col] - w / 2;
        key.forEach((k) => { const sw = (w - GAP * (n - 1)) * (WEIGHT[k] || 1) / tw; out.push({ panel: make(k, sw, hd, f), x: x0 + sw / 2, yFromTop: y + h / 2, key: k }); x0 += sw + GAP; });
      } else out.push({ panel: make(key, w, hd, f), x: COLX[col], yFromTop: y + h / 2, key });
      y += h + GAP;
    }
  }
  return out;
}

export function makeAftPanels(M, A, len) {
  const h = len; const out = [];
  for (const [key, col] of [['audio', 'left'], ['cb', 'centre'], ['maint', 'right']]) {
    const w = col === 'centre' ? 0.29 : 0.17;
    out.push({ panel: buildPanel({ w, h, name: key, bg: '#7d919b', ...AFT[key](w, h) }, M, A), x: COLX[col], key });
  }
  return out;
}
