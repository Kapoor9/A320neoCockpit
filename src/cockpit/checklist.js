// The checklist card: a sheet of paper beside the cockpit, in the order of the A320 normal procedures.
// Each phase has the steps to do (where, what - written for someone new to the aircraft) and then its normal
// checklist (standard item / response). Steps tick themselves when the aircraft is really in that state, the
// current one is marked, and "show" takes the eye to the panel. Items the sim cannot see are ticked by hand.
// Content lives in PHASES below: change the wording or add a step there, nothing else needs touching.

const on = (v, ...ids) => ids.every((id) => !!v(id));
const PHASES = [
  { name: 'COCKPIT PREPARATION', note: 'Aircraft parked, cold and dark, ground power plugged in.',
    steps: [
      ['ovhd', 'ELEC', 'BAT 1 and BAT 2: press both in. The OFF lights go out; the batteries now power the essentials and the radio.', (v) => on(v, 'elec.bat1', 'elec.bat2')],
      ['ovhd', 'ELEC', 'EXT PWR: press when it shows green AVAIL. It turns blue ON and ground power runs the whole aircraft: screens, lights, air.', (v, S) => S.extOn || S.apu.avail],
      ['ovhd', 'EXT LT', 'NAV & LOGO: set to 1.', (v) => v('extLt.navLogo') !== 2],
      ['ovhd', 'ADIRS', 'IR 1, IR 3 and IR 2 mode knobs: turn to NAV. The inertial references now align for about 7 minutes (the ON BAT light flashes briefly: normal).', (v) => [1, 2, 3].every((i) => v('adirs.irSel' + i) === 1)],
      ['ovhd', 'APU', 'MASTER SW: press in, then START: press. The APU takes about a minute: wait for the green AVAIL light.', (v, S) => S.apu.avail],
      ['ovhd', 'AIR COND', 'APU BLEED: press in (once APU AVAIL). PACK 1 and PACK 2: in. The packs now cool the cabin with APU air.', (v) => on(v, 'airCond.apuBleed', 'airCond.pack1', 'airCond.pack2')],
      ['ovhd', 'ELEC', 'EXT PWR: press again to let go of ground power. The APU generator takes over (EXT PWR back to AVAIL).', (v, S) => !S.extOn && S.apu.avail],
      ['ovhd', 'FUEL', 'All six PUMPS and MODE SEL: press in (no OFF lights).', (v) => on(v, 'fuel.ltk1', 'fuel.ltk2', 'fuel.ctr1', 'fuel.ctr2', 'fuel.rtk1', 'fuel.rtk2', 'fuel.fuelMode')],
      ['ovhd', 'OXYGEN', 'CREW SUPPLY: press in.', (v) => on(v, 'oxygen.crewOxy')],
      ['ovhd', 'RCDR', 'GND CTL: press in (voice and flight recorders on).', (v) => on(v, 'rcdr.gndCtl')],
      ['ovhd', 'SIGNS', 'SEAT BELTS: ON. NO SMOKING: AUTO. EMER EXIT LT: ARM.', (v) => v('signsIntLt.seatBelts') === 0 && v('signsIntLt.noSmoking') === 1 && v('signsIntLt.emerExit') === 1],
      ['fcu', 'EFIS (both)', 'FD: press so the green bar lights, on both sides. BARO: turn to today’s QNH (Ground gives it with the taxi clearance).', (v) => on(v, 'EFIS1.FD', 'EFIS2.FD')],
    ],
    check: [['GEAR PINS & COVERS', 'REMOVED'], ['FUEL QUANTITY', '___ KG'], ['SEAT BELTS', 'ON', (v) => v('signsIntLt.seatBelts') === 0], ['ADIRS', 'NAV', (v) => [1, 2, 3].every((i) => v('adirs.irSel' + i) === 1)], ['BARO REF', '___ SET (BOTH)']] },

  { name: 'BEFORE START', note: 'Doors closed, start-up approved by Delhi Ground (121.800).',
    steps: [
      ['ovhd', 'EXT LT', 'BEACON: ON (red flashing light: engines about to start, stay clear).', (v) => v('extLt.beacon') === 0],
      ['ped', 'PARKING BRK', 'Parking brake handle: ON.', (v) => !!v('parkBrake.handle')],
      ['ped', 'THRUST LEVERS', 'Both levers: IDLE (fully back).', (v) => v('thrust.lever1') === 0 && v('thrust.lever2') === 0],
    ],
    check: [['PARKING BRAKE', 'ON', (v) => !!v('parkBrake.handle')], ['T.O SPEEDS & THRUST', '___ (BOTH)'], ['WINDOWS / DOORS', 'CLOSED (BOTH)'], ['BEACON', 'ON', (v) => v('extLt.beacon') === 0]] },

  { name: 'ENGINE START', note: 'Engine 2 first, then engine 1. Watch the upper ECAM screen.',
    steps: [
      ['ped', 'ENG', 'MODE selector: IGN / START.', (v, S) => v('engPanel.mode') === 2 || S.eng.every((e) => e.running)],
      ['ped', 'ENG', 'ENG MASTER 2: ON (lift and move up). N2, then fuel flow and EGT rise; about a minute to idle, AVAIL shows.', (v, S) => S.eng[1].running],
      ['ped', 'ENG', 'ENG MASTER 1: ON. Same sequence on engine 1.', (v, S) => S.eng[0].running],
      ['ped', 'ENG', 'MODE selector: NORM once both engines are at idle.', (v, S) => v('engPanel.mode') === 1 && S.eng.every((e) => e.running)],
    ],
    check: [] },

  { name: 'AFTER START', note: '',
    steps: [
      ['ovhd', 'AIR COND', 'APU BLEED: release (off). The engines now feed the packs.', (v, S) => !v('airCond.apuBleed') && S.eng.some((e) => e.running)],
      ['ovhd', 'APU', 'APU MASTER SW: release (it runs on a short cool-down, then stops).', (v, S) => !v('apu.apuMaster') && S.eng.some((e) => e.running)],
      ['ped', 'FLAPS', 'FLAPS lever: 1 (the take-off setting, CONF 1+F).', (v) => (v('flaps.lever') ?? 0) >= 1],
      ['ped', 'SPEED BRAKE', 'Speed brake lever at RET: click it to ARM the ground spoilers.', (v, S, c) => !!c('speedbrake.lever')?.armed],
      ['ped', 'TRIM', 'Pitch trim wheels: set the take-off trim.', null],
    ],
    check: [['ANTI ICE', 'AS RQRD'], ['ECAM STATUS', 'CHECKED'], ['PITCH TRIM', '___ %'], ['RUDDER TRIM', 'ZERO']] },

  { name: 'TAXI', note: 'Taxi clearance from Delhi Ground.',
    steps: [
      ['ovhd', 'EXT LT', 'NOSE: TAXI. RWY TURN OFF: ON.', (v) => v('extLt.nose') === 1 && v('extLt.rwyTurnOff') === 0],
      ['main', 'AUTO BRK', 'AUTO BRK: MAX (for a rejected take-off).', (v) => !!v('gearBrake.abrkMAX')],
      ['ped', 'PARKING BRK', 'Parking brake: OFF, then thrust levers just forward to roll; steer with the tiller.', (v) => !v('parkBrake.handle')],
      ['ecam', 'ECAM', 'T.O CONFIG: press. No warning means the aircraft is set for take-off.', null],
    ],
    check: [['FLIGHT CONTROLS', 'CHECKED (BOTH)'], ['FLT INST', 'CHECKED (BOTH)'], ['BRIEFING', 'CONFIRMED'], ['FLAP SETTING', 'CONF ___ (BOTH)', (v) => (v('flaps.lever') ?? 0) >= 1], ['RADAR & PRED W/S', 'ON & AUTO'], ['ENG MODE SEL', 'AS RQRD'], ['ECAM MEMO', 'T.O NO BLUE']] },

  { name: 'LINE-UP', note: 'Cleared by Delhi Tower (118.700) to line up.',
    steps: [
      ['ped', 'ATC / TCAS', 'XPDR: AUTO. TCAS: TA/RA.', (v) => v('atc.xpdrMode') >= 1 && v('atc.tcasMode') === 2],
      ['ovhd', 'EXT LT', 'STROBE: ON. LAND L and LAND R: ON. NOSE: T.O.', (v) => v('extLt.strobe') === 0 && v('extLt.landL') === 0 && v('extLt.landR') === 0 && v('extLt.nose') === 0],
    ],
    check: [['T.O RWY', '___ (BOTH)'], ['TCAS', 'TA OR TA/RA', (v) => v('atc.tcasMode') >= 1], ['PACK 1 & 2', 'AS RQRD']] },

  { name: 'TAKE-OFF', note: 'Cleared for take-off.',
    steps: [
      ['ped', 'THRUST LEVERS', 'Thrust levers: FLX/MCT (or TOGA). The engines spool up to take-off thrust.', (v) => Math.max(v('thrust.lever1') ?? 0, v('thrust.lever2') ?? 0) >= 33],
      ['cpt', '', 'Flying is the next stage of this cockpit: the aircraft stays on the ground for now.', null],
    ],
    check: [] },

  { name: 'AFTER TAKEOFF / CLIMB', note: 'Positive climb.',
    steps: [
      ['ped', 'GEAR', 'Landing gear lever: UP.', null],
      ['ped', 'THRUST LEVERS', 'At thrust reduction altitude: CL.', null],
      ['ped', 'FLAPS', 'Flaps: 0 as speed builds. Ground spoilers: disarm.', null],
    ],
    check: [['LDG GEAR', 'UP'], ['FLAPS', 'RETRACTED'], ['PACKS', 'ON'], ['BARO REF', 'SET STD (BOTH)']] },

  { name: 'APPROACH', note: '', steps: [],
    check: [['BRIEFING', 'CONFIRMED'], ['ECAM STATUS', 'CHECKED'], ['SEAT BELTS', 'ON'], ['BARO REF', '___ SET (BOTH)'], ['MINIMUM', '___ (BOTH)'], ['ENG MODE SEL', 'AS RQRD']] },
  { name: 'LANDING', note: '', steps: [], check: [['ECAM MEMO', 'LDG NO BLUE']] },
  { name: 'AFTER LANDING', note: '', steps: [], check: [['RADAR & PRED W/S', 'OFF']] },

  { name: 'PARKING', note: 'On the stand.',
    steps: [
      ['ped', 'PARKING BRK', 'Parking brake: ON.', (v) => !!v('parkBrake.handle')],
      ['ovhd', 'APU', 'APU (started during taxi-in) with APU BLEED on.', null],
      ['ped', 'ENG', 'ENG MASTER 1 and 2: OFF.', (v) => !v('engPanel.master1') && !v('engPanel.master2')],
      ['ovhd', 'EXT LT / SIGNS', 'BEACON: OFF once the engines have stopped. SEAT BELTS: OFF.', (v) => v('extLt.beacon') === 1 && v('signsIntLt.seatBelts') === 1],
      ['ovhd', 'FUEL', 'All fuel pumps: off.', (v) => !['ltk1', 'ltk2', 'ctr1', 'ctr2', 'rtk1', 'rtk2'].some((k) => v('fuel.' + k))],
    ],
    check: [['APU BLEED', 'ON'], ['ENGINES', 'OFF', (v) => !v('engPanel.master1') && !v('engPanel.master2')], ['SEAT BELTS', 'OFF', (v) => v('signsIntLt.seatBelts') === 1], ['EXT LT', 'AS RQRD'], ['FUEL PUMPS', 'OFF'], ['PARK BRK & CHOCKS', 'AS RQRD']] },

  { name: 'SECURING THE AIRCRAFT', note: 'Leaving the aircraft.',
    steps: [
      ['ovhd', 'ADIRS', 'IR 1, 2 and 3: OFF.', (v) => [1, 2, 3].every((i) => v('adirs.irSel' + i) === 0)],
      ['ovhd', 'APU / ELEC', 'APU MASTER SW: off (or EXT PWR on). Then BAT 1 and BAT 2: off last.', (v) => !v('elec.bat1') && !v('elec.bat2')],
    ],
    check: [['OXYGEN', 'OFF', (v) => !v('oxygen.crewOxy')], ['EMER EXIT LT', 'OFF', (v) => v('signsIntLt.emerExit') === 2], ['EFBs', 'OFF'], ['BATTERIES', 'OFF', (v) => !v('elec.bat1') && !v('elec.bat2')]] },
];

const CSS = `
#cl-card{position:fixed;right:12px;top:52px;bottom:70px;width:min(400px,calc(100vw - 24px));z-index:6;display:none;flex-direction:column;
  background:#f4efe0;background-image:linear-gradient(90deg,rgba(0,0,0,.025) 1px,transparent 1px);background-size:3px 3px;color:#14171a;
  border-radius:3px;box-shadow:0 10px 30px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.25);font:12px/1.35 "B612",Arial,sans-serif}
#cl-card.open{display:flex}
#cl-card header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px 8px;border-bottom:2px solid #14171a}
#cl-card header b{font:700 13px "B612",Arial,sans-serif;letter-spacing:.06em}
#cl-card header span{font-size:10px;color:#5a5f63;display:block;letter-spacing:.02em}
#cl-card .x{background:none;border:1px solid #14171a;border-radius:2px;font:700 11px "B612",Arial;padding:3px 8px;cursor:pointer;color:#14171a}
#cl-tabs{display:flex;flex-wrap:wrap;gap:3px;padding:7px 10px;border-bottom:1px solid #b9b2a0}
#cl-tabs button{background:#e8e1cd;border:1px solid #a9a28f;border-radius:2px;padding:3px 6px;font:700 9.5px "B612",Arial;letter-spacing:.03em;cursor:pointer;color:#14171a}
#cl-tabs button.sel{background:#14171a;color:#f4efe0;border-color:#14171a}
#cl-tabs button.done{border-color:#2f6b3a;color:#2f6b3a}#cl-tabs button.sel.done{color:#bfe3c5}
#cl-body{overflow:auto;padding:4px 12px 14px}
#cl-body h3{margin:12px 0 2px;font:700 12px "B612",Arial;letter-spacing:.06em;background:#14171a;color:#f4efe0;padding:4px 7px}
#cl-body .note{font-size:10.5px;color:#5a5f63;margin:4px 0 6px;font-style:italic}
#cl-body .sub{font:700 10px "B612",Arial;letter-spacing:.08em;color:#5a5f63;margin:10px 0 2px;border-bottom:1px solid #b9b2a0}
.cl-step{display:grid;grid-template-columns:18px 1fr auto;gap:6px;padding:6px 4px;border-bottom:1px dotted #b9b2a0;cursor:pointer;align-items:start}
.cl-step .bx{width:13px;height:13px;border:1.5px solid #14171a;margin-top:1px;position:relative}
.cl-step.ok .bx::after{content:'\\2713';position:absolute;left:0;top:-5px;font:700 15px Arial;color:#1f5ea8}
.cl-step.ok .tx{color:#5a5f63}
.cl-step.cur{background:rgba(255,214,90,.35);outline:1px solid rgba(160,120,0,.4)}
.cl-step .wh{font:700 9.5px "B612",Arial;letter-spacing:.05em;color:#7a4b00;display:block}
.cl-step .go{font:700 9px "B612",Arial;border:1px solid #14171a;border-radius:2px;padding:2px 5px;background:none;cursor:pointer;color:#14171a}
.cl-item{display:grid;grid-template-columns:18px 1fr auto;gap:6px;padding:4px 4px;cursor:pointer;align-items:baseline;font-size:11.5px}
.cl-item .ld{overflow:hidden;white-space:nowrap}.cl-item .ld::after{content:' ..................................................................'}
.cl-item .rs{font-weight:700;white-space:nowrap}
.cl-item.ok .bx::after{content:'\\2713';position:absolute;left:0;top:-5px;font:700 15px Arial;color:#1f5ea8}
.cl-item .bx{width:12px;height:12px;border:1.5px solid #14171a;position:relative}
#cl-foot{border-top:1px solid #b9b2a0;padding:6px 12px;font-size:10px;color:#5a5f63}
`;

export class Checklist {
  constructor(sim, systems, camera) {
    this.sim = sim; this.sys = systems; this.cam = camera; this.manual = new Set(); this.phase = 0;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const el = this.el = document.createElement('section'); el.id = 'cl-card'; el.setAttribute('aria-label', 'Checklist');
    el.innerHTML = '<header><div><b>A320 NORMAL CHECKLIST</b><span>Procedure steps tick themselves when done · click a line to tick it</span></div><button class="x" type="button">CLOSE</button></header><nav id="cl-tabs"></nav><div id="cl-body"></div><div id="cl-foot">For this simulator, not for real-world flight.</div>';
    document.body.appendChild(el);
    el.querySelector('.x').onclick = () => this.toggle(false);
    this.tabs = el.querySelector('#cl-tabs'); this.body = el.querySelector('#cl-body');
    PHASES.forEach((p, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = p.name; b.onclick = () => { this.phase = i; this.render(); }; this.tabs.appendChild(b); });
    this.render();
    setInterval(() => { if (el.classList.contains('open')) this.refresh(); }, 500);
  }
  toggle(force) { const open = force ?? !this.el.classList.contains('open'); this.el.classList.toggle('open', open); if (open) { this.render(); } }

  state(fn, key) {
    if (this.manual.has(key)) return true; if (!fn) return false;
    const v = (id) => this.sim.val(id), c = (id) => this.sim.get(id);
    try { return !!fn(v, this.sys.s, c); } catch { return false; }
  }
  render() {
    const p = PHASES[this.phase]; this.body.textContent = '';
    const h = document.createElement('h3'); h.textContent = p.name; this.body.appendChild(h);
    if (p.note) { const n = document.createElement('div'); n.className = 'note'; n.textContent = p.note; this.body.appendChild(n); }
    this.rows = [];
    if (p.steps.length) {
      const s = document.createElement('div'); s.className = 'sub'; s.textContent = 'PROCEDURE'; this.body.appendChild(s);
      p.steps.forEach(([view, where, text, fn], i) => {
        const key = this.phase + 's' + i, r = document.createElement('div'); r.className = 'cl-step';
        const bx = document.createElement('span'); bx.className = 'bx';
        const tx = document.createElement('span'); tx.className = 'tx';
        if (where) { const w = document.createElement('span'); w.className = 'wh'; w.textContent = ({ ovhd: 'OVERHEAD', ped: 'PEDESTAL', fcu: 'GLARESHIELD', main: 'MAIN PANEL', ecam: 'PEDESTAL', cpt: '' }[view] || '') + (where ? ' › ' + where : ''); tx.appendChild(w); }
        tx.appendChild(document.createTextNode(text));
        const go = document.createElement('button'); go.type = 'button'; go.className = 'go'; go.textContent = 'SHOW';
        go.onclick = (e) => { e.stopPropagation(); this.cam.goTo(view); };
        r.append(bx, tx, go); r.onclick = () => { if (!fn) { this.manual.has(key) ? this.manual.delete(key) : this.manual.add(key); this.refresh(); } };
        this.body.appendChild(r); this.rows.push({ r, fn, key, step: true });
      });
    }
    if (p.check.length) {
      const s = document.createElement('div'); s.className = 'sub'; s.textContent = 'CHECKLIST'; this.body.appendChild(s);
      p.check.forEach(([item, resp, fn], i) => {
        const key = this.phase + 'c' + i, r = document.createElement('div'); r.className = 'cl-item';
        const bx = document.createElement('span'); bx.className = 'bx';
        const ld = document.createElement('span'); ld.className = 'ld'; ld.textContent = item;
        const rs = document.createElement('span'); rs.className = 'rs'; rs.textContent = resp;
        r.append(bx, ld, rs); r.onclick = () => { this.manual.has(key) ? this.manual.delete(key) : this.manual.add(key); this.refresh(); };
        this.body.appendChild(r); this.rows.push({ r, fn, key });
      });
    }
    this.refresh();
  }
  refresh() {
    let cur = false;
    for (const row of this.rows) {
      const ok = this.state(row.fn, row.key); row.r.classList.toggle('ok', ok);
      const isCur = !ok && !cur && row.step; row.r.classList.toggle('cur', isCur); if (isCur) cur = true;
    }
    [...this.tabs.children].forEach((b, i) => {
      b.classList.toggle('sel', i === this.phase);
      const P = PHASES[i], all = [...P.steps.map((s, j) => [s[3], i + 's' + j]), ...P.check.map((c, j) => [c[2], i + 'c' + j])];
      b.classList.toggle('done', all.length > 0 && all.every(([fn, k]) => this.state(fn, k)));
    });
  }
}
