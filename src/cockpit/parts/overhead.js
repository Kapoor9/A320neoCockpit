// A320 overhead panel: system panels with their real controls and legends.
// Panels are laid out in three columns (left / centre / right), aft at the top as read,
// forward (towards the windshield) at the bottom, as the crew sees it looking up.
import { buildPanel } from './panel.js';

const PB = 0.019;   // Korry pushbutton size (m)

// evenly spaced row of pushbuttons with captions above: [caption, topLegend, bottomLegend, opts]
function pbRow(w, y, list, { cap = 0.0042, gap = 0.0145, size = PB, line = false } = {}) {
  const items = []; const n = list.length;
  if (line) items.push({ t: 'line', pts: [[-w / 2 + (w / n) * 0.5, y], [-w / 2 + (w / n) * (n - 0.5), y]], w: 0.0007 });   // white flow line behind the row
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
  fltCtl1: (w, h) => ({ title: 'FLT CTL', items: pbRow(w, -0.012, [['ELAC 1', 'FAULT', 'OFF'], ['SEC 1', 'FAULT', 'OFF'], ['FAC 1', 'FAULT', 'OFF']]) }),
  fltCtl2: (w, h) => ({ title: 'FLT CTL', items: pbRow(w, -0.012, [['ELAC 2', 'FAULT', 'OFF'], ['SEC 2', 'FAULT', 'OFF'], ['SEC 3', 'FAULT', 'OFF'], ['FAC 2', 'FAULT', 'OFF']], { cap: 0.0036 }) }),
  evac: (w, h) => ({ title: 'EVAC', items: [
    ...pbRow(w, -0.01, [['COMMAND', 'EVAC', 'ON', { guard: 'red', id: 'evac' }], ['HORN\nSHUT OFF', '', '']]),
  ] }),
  emerElec: (w, h) => ({ title: 'EMER ELEC PWR', items: [
    ...pbRow(w, 0.004, [['GEN 1 LINE', '', 'OFF'], ['MAN ON', 'FAULT', '', { guard: 'grey' }]]),
    { t: 'annun', x: 0, y: -0.03, w: 0.05, h: 0.008, s: 'RAT & EMER GEN' },
  ] }),
  gpws: (w, h) => ({ title: 'GPWS', items: [
    ...pbRow(w, 0.016, [['SYS', 'FAULT', 'OFF'], ['G/S MODE', '', 'OFF'], ['FLAP MODE', '', 'OFF']], { cap: 0.0036 }),
    ...pbRow(w, -0.03, [['LDG FLAP 3', '', 'ON'], ['TERR', 'FAULT', 'OFF']], { cap: 0.0036 }),
  ] }),
  rcdr: (w, h) => ({ title: 'RCDR', items: [
    ...pbRow(w, -0.008, [['GND CTL', '', 'ON']]).map((i) => ({ ...i, x: i.x - 0.04 })),
    { t: 'key', x: 0.01, y: -0.008, w: 0.022, h: 0.012, s: 'CVR\nERASE' }, { t: 'key', x: 0.045, y: -0.008, w: 0.022, h: 0.012, s: 'CVR\nTEST' },
  ] }),
  oxygen: (w, h) => ({ title: 'OXYGEN', items: pbRow(w, -0.008, [['MASK MAN ON', '', '', { guard: 'grey' }], ['PASSENGER', 'SYS ON', ''], ['CREW SUPPLY', '', 'OFF']], { cap: 0.0032 }) }),
  calls: (w, h) => ({ title: 'CALLS', items: [
    { t: 'key', x: -0.05, y: 0.008, w: 0.024, h: 0.012, s: 'MECH' }, { t: 'key', x: -0.016, y: 0.008, w: 0.024, h: 0.012, s: 'FWD' },
    { t: 'key', x: 0.018, y: 0.008, w: 0.024, h: 0.012, s: 'AFT' }, { t: 'key', x: 0.052, y: 0.008, w: 0.024, h: 0.012, s: 'ALL' },
    ...pbRow(w, -0.022, [['EMER', 'CALL', 'ON', { guard: 'grey' }]]),
  ] }),
  wiper: (side) => (w, h) => ({ title: 'WIPER', items: [
    ...selector(side < 0 ? -0.025 : 0.025, -0.012, '', ['OFF', 'SLOW', 'FAST'], 'wiper' + side),
    ...pbRow(w, -0.012, [['RAIN RPLNT', '', '']]).map((i) => ({ ...i, x: i.x + (side < 0 ? 0.04 : -0.04) })),
  ] }),
  adirs: (w, h) => ({ title: 'ADIRS', items: [
    { t: 'annun', x: -0.12, y: 0.036, w: 0.028, h: 0.009, s: 'ON BAT' },
    { t: 'text', x: 0.03, y: 0.036, s: 'IR 1          IR 3          IR 2', size: 0.0042 },
    ...pbRow(0.2, 0.017, [['', 'FAULT', 'ALIGN'], ['', 'FAULT', 'ALIGN'], ['', 'FAULT', 'ALIGN']]).map((i) => ({ ...i, x: i.x + 0.03 })),
    ...selector(-0.037, -0.022, '', ['OFF', 'NAV', 'ATT'], 'ir1'),
    ...selector(0.03, -0.022, '', ['OFF', 'NAV', 'ATT'], 'ir3'),
    ...selector(0.097, -0.022, '', ['OFF', 'NAV', 'ATT'], 'ir2'),
    { t: 'text', x: -0.12, y: 0.0, s: 'ADR 1  ADR 3  ADR 2', size: 0.0034 },
    ...pbRow(0.08, -0.018, [['', 'FAULT', 'OFF'], ['', 'FAULT', 'OFF'], ['', 'FAULT', 'OFF']], { size: 0.016 }).map((i) => ({ ...i, x: i.x - 0.12 })),
  ] }),
  fire: (w, h) => {
    const items = [];
    [['ENG 1', -0.105], ['APU', 0], ['ENG 2', 0.105]].forEach(([n, x]) => {
      items.push({ t: 'text', x, y: 0.036, s: n === 'APU' ? 'APU' : n, size: 0.0046 });
      items.push({ t: 'pb', x, y: 0.012, w: 0.046, h: 0.03, legends: [n === 'APU' ? 'APU FIRE' : n + ' FIRE', 'PUSH'], guard: 'clear', id: 'fire' + n.replace(' ', '') });
            if (n === 'APU') items.push(...pbRow(0.03, -0.026, [['AGENT', 'SQUIB', 'DISCH']]).map((i) => ({ ...i, x: i.x + x })));
      else items.push(...pbRow(0.05, -0.026, [['AGENT 1', 'SQUIB', 'DISCH'], ['AGENT 2', 'SQUIB', 'DISCH']], { cap: 0.0032, size: 0.017 }).map((i) => ({ ...i, x: i.x + x })));
      items.push({ t: 'key', x: x + (n === 'APU' ? 0.034 : 0.04), y: 0.03, w: 0.014, h: 0.01, s: 'TEST', id: 'test' + n.replace(' ', '') });
    });
    return { title: '', items };
  },
  hyd: (w, h) => ({ title: 'HYD', items: [
    { t: 'text', x: -0.12, y: 0.022, s: 'GREEN', size: 0.0034 }, { t: 'text', x: -0.02, y: 0.022, s: 'BLUE', size: 0.0034 }, { t: 'text', x: 0.1, y: 0.022, s: 'YELLOW', size: 0.0034 },
    ...pbRow(w, -0.012, [['ENG 1\nPUMP', 'FAULT', 'OFF'], ['RAT MAN ON', '', '', { guard: 'grey' }], ['ELEC PUMP', 'FAULT', 'OFF'], ['PTU', 'FAULT', 'OFF'], ['ENG 2\nPUMP', 'FAULT', 'OFF'], ['ELEC PUMP', 'FAULT', 'ON']], { cap: 0.0032, line: true }),
  ] }),
  fuel: (w, h) => ({ title: 'FUEL', items: [
    { t: 'text', x: -0.115, y: 0.034, s: 'L TK PUMPS', size: 0.0034 }, { t: 'text', x: 0, y: 0.034, s: 'CTR TK PUMPS', size: 0.0034 }, { t: 'text', x: 0.115, y: 0.034, s: 'R TK PUMPS', size: 0.0034 },
    ...pbRow(w, 0.012, [['1', 'FAULT', 'OFF'], ['2', 'FAULT', 'OFF'], ['1', 'FAULT', 'OFF'], ['MODE SEL', 'FAULT', 'MAN'], ['2', 'FAULT', 'OFF'], ['1', 'FAULT', 'OFF'], ['2', 'FAULT', 'OFF']], { cap: 0.0034, line: true }),
    ...pbRow(w, -0.03, [['X FEED', 'OPEN', 'ON']]),
  ] }),
  elec: (w, h) => {
    const items = [
      { t: 'text', x: -0.1, y: 0.056, s: 'BAT 1', size: 0.0038 }, { t: 'text', x: -0.035, y: 0.056, s: 'BAT 2', size: 0.0038 },
      ...pbRow(0.15, 0.03, [['', 'FAULT', 'OFF'], ['', 'FAULT', 'OFF']]).map((i) => ({ ...i, x: i.x - 0.067 })),
      { t: 'text', x: 0.09, y: 0.05, s: 'AC ESS FEED', size: 0.0034 }, { t: 'text', x: -0.067, y: 0.012, s: 'DC BAT', size: 0.003, boxed: true }, ...pbRow(0.02, 0.03, [['', 'FAULT', 'ALTN']]).map((i) => ({ ...i, x: i.x + 0.09 })),
      ...pbRow(w, -0.005, [['IDG 1', 'FAULT', '', { guard: 'grey' }], ['GALY & CAB', 'FAULT', 'OFF'], ['COMMERCIAL', '', 'OFF'], ['IDG 2', 'FAULT', '', { guard: 'grey' }]], { cap: 0.0032 }),
      ...pbRow(w, -0.045, [['GEN 1', 'FAULT', 'OFF'], ['APU GEN', 'FAULT', 'OFF'], ['BUS TIE', '', 'OFF'], ['EXT PWR', 'AVAIL', 'ON'], ['GEN 2', 'FAULT', 'OFF']], { cap: 0.0034, line: true }),
    ];
    return { title: 'ELEC', items };
  },
  airCond: (w, h) => ({ title: 'AIR COND', items: [
    ...selector(-0.09, 0.028, 'CKPT', ['COLD', 'HOT'], 'tCkpt'), ...selector(-0.03, 0.028, 'FWD CABIN', ['COLD', 'HOT'], 'tFwd'), ...selector(0.03, 0.028, 'AFT CABIN', ['COLD', 'HOT'], 'tAft'),
    ...pbRow(0.03, 0.028, [['HOT AIR', 'FAULT', 'OFF']]).map((i) => ({ ...i, x: i.x + 0.105 })),
    ...pbRow(w, -0.024, [['ENG 1\nBLEED', 'FAULT', 'OFF'], ['PACK 1', 'FAULT', 'OFF'], ['', '', '', { w: 0.001, h: 0.001 }], ['APU BLEED', 'FAULT', 'ON'], ['PACK 2', 'FAULT', 'OFF'], ['ENG 2\nBLEED', 'FAULT', 'OFF']], { cap: 0.0032, line: true }),
    ...selector(-0.004, -0.026, 'X BLEED', ['SHUT', 'AUTO', 'OPEN'], 'xbleed'),
    ...selector(-0.12, -0.052, '', ['LO', 'NORM', 'HI'], 'packFlow', 0.007), { t: 'text', x: -0.095, y: -0.052, s: 'PACK FLOW', size: 0.0032, align: 'left' },
    ...pbRow(0.02, -0.054, [['RAM AIR', '', 'ON', { guard: 'grey' }]]).map((i) => ({ ...i, x: i.x + 0.11 })),
  ] }),
  antiIce: (w, h) => ({ title: 'ANTI ICE', items: [
    ...pbRow(w, 0.006, [['WING', 'FAULT', 'ON'], ['ENG 1', 'FAULT', 'ON'], ['ENG 2', 'FAULT', 'ON']]),
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
      .forEach(([c, p], i) => items.push(...toggleWith(-0.135 + i * 0.043, -0.006, c, p)));
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
  cargoSmoke: (w, h) => ({ title: 'CARGO SMOKE', items: [
    ...pbRow(w, -0.005, [['AFT', 'SMOKE', '', { guard: 'grey' }], ['DISCH', 'DISCH', '', { guard: 'red' }]]),
    { t: 'key', x: 0, y: -0.03, w: 0.018, h: 0.01, s: 'TEST' },
  ] }),
  vent: (w, h) => ({ title: 'VENTILATION', items: pbRow(w, -0.01, [['BLOWER', 'FAULT', 'OVRD'], ['EXTRACT', 'FAULT', 'OVRD'], ['CAB FANS', '', 'OFF']], { cap: 0.0034 }) }),
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
    ...pbRow(w, -0.085, [['1', '', 'ON'], ['2', '', 'ON']]),
    { t: 'text', x: 0, y: -0.12, s: 'APU AUTO EXTING', size: 0.0034 },
    { t: 'key', x: -0.025, y: -0.14, w: 0.022, h: 0.011, s: 'TEST' }, { t: 'key', x: 0.025, y: -0.14, w: 0.022, h: 0.011, s: 'RESET' },
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
    ...pbRow(w, 0.13, [['BLUE PUMP\nOVRD', '', 'ON', { guard: 'grey' }], ['OXYGEN\nTMR RESET', 'FAULT', '']], { cap: 0.003 }),
    { t: 'text', x: 0, y: 0.088, s: 'HYD LEAK MEASUREMENT VALVES', size: 0.0028 },
    ...pbRow(w, 0.065, [['G', '', 'OFF'], ['B', '', 'OFF'], ['Y', '', 'OFF']], { cap: 0.0032 }),
    ...pbRow(w, 0.015, [['SVCE INT\nOVRD', '', 'ON'], ['AVIONICS\nCOMPT LT', '', 'ON']], { cap: 0.003 }),
    { t: 'round', x: -0.03, y: -0.05, r: 0.02 },
    { t: 'annun', x: 0.035, y: -0.04, w: 0.04, h: 0.012, s: 'VHF 3 DATA' },
    ...selector(0.035, -0.09, 'CVR MIC', ['OFF', 'ON'], 'cvrMic', 0.0075),
  ] }),
};

// Layout: three columns; each entry [panelKey, design height]; rows run aft (top) to forward.
// Design heights are scaled so each column fills the measured system-panel length.
export const LAYOUT = {
  left: { w: 0.155, rows: [['fltCtl1', 0.085], ['evac', 0.072], ['emerElec', 0.085], ['gpws', 0.1], ['rcdr', 0.065], ['oxygen', 0.07], ['calls', 0.08], ['wiperL', 0.075]] },
  centre: { w: 0.32, rows: [['adirs', 0.105], ['fire', 0.095], ['hyd', 0.075], ['fuel', 0.095], ['elec', 0.135], ['airCond', 0.13], [['antiIce', 'cabPress'], 0.085], ['extLt', 0.075], [['apu', 'signs', 'intLt'], 0.075]] },
  right: { w: 0.155, rows: [['fltCtl2', 0.085], ['cargoSmoke', 0.08], ['vent', 0.075], ['cargoHeat', 0.075], ['engManStart', 0.065], ['wiperR', 0.075]], fill: false },
};

const GAP = 0.003;
const COLX = { left: -0.32 + 0.155 / 2, centre: 0, right: 0.32 - 0.155 / 2 };

// returns panels with x and yFromTop (distance from the aft edge of the system section)
export function makeOverheadPanels(M, A, systemLen = 0.65) {
  const out = [];
  const make = (key, w, hd, f) => {
    const def = key === 'wiperL' ? PANELS.wiper(-1) : key === 'wiperR' ? PANELS.wiper(1) : PANELS[key];
    const spec = def(w, hd);
    const items = spec.items.map((i) => ({ ...i, y: i.y * f, ...(i.pts ? { pts: i.pts.map(([x, y]) => [x, y * f]) } : {}) }));
    return buildPanel({ w, h: hd * f, name: key, ...spec, items }, M, A);
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
        const n = key.length; const sw = (w - GAP * (n - 1)) / n;
        key.forEach((k, i) => out.push({ panel: make(k, sw, hd, f), x: COLX[col] - w / 2 + sw / 2 + i * (sw + GAP), yFromTop: y + h / 2, key: k }));
      } else out.push({ panel: make(key, w, hd, f), x: COLX[col], yFromTop: y + h / 2, key });
      y += h + GAP;
    }
  }
  return out;
}

export function makeAftPanels(M, A, len) {
  const h = len; const out = [];
  for (const [key, col] of [['audio', 'left'], ['cb', 'centre'], ['maint', 'right']]) {
    const w = col === 'centre' ? 0.32 : 0.155;
    out.push({ panel: buildPanel({ w, h, name: key, ...AFT[key](w, h) }, M, A), x: COLX[col], key });
  }
  return out;
}
