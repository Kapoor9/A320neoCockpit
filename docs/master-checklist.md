# A320neo Cockpit — Master Checklist (v1)

What the cockpit must contain and how each part must behave. Reference aircraft:
**A320neo with CFM LEAP-1A engines** (as flown by IndiGo).

How to read this:
- **Sound** = which click type from the audio engine the control uses.
- ✅ = confirmed in more than one public source. ⚠️ = needs checking before build.
- Light colours are muted, as on the real panel by day — never neon.

---

## 1. Light and colour rules (whole cockpit)

**Dark cockpit ("lights out"):** when every system is set up normally, the overhead is
dark. A light means something needs attention or is temporarily selected. ✅

| Colour | Meaning | Examples |
|---|---|---|
| None (dark) | Normal configuration | Most overhead buttons in flight |
| Red | Failure needing immediate action | ENG FIRE, APU FIRE, MASTER WARN |
| Amber | Failure, no immediate action | FAULT, DISCH, MASTER CAUT |
| Green | System operating normally | APU AVAIL, EXT PWR AVAIL |
| Blue | System selected for temporary use | APU MASTER SW ON, START ON, anti-ice ON |
| White | Pushbutton in an abnormal position, or test/maintenance | OFF, SQUIB |

Pushbutton positions: pressed in = ON / AUTO / OPEN; released out = OFF / MAN / ALTN / SHUT. ✅
In normal operation only green lights stay on; blue may come on temporarily. ✅

**Lighting controls to build:** annunciator test/bright/dim (ANN LT), dome light OFF/DIM/BRT,
overhead integral lighting dimmer, flood lights for main panel and pedestal. ✅

**Screen colours (ECAM, PFD, MCDU):** green = normal/active, amber = caution,
red = warning, blue/cyan = actions to do or selected values, magenta = managed targets
and special messages, white = titles and labels. ✅

---

## 2. Overhead panel (top to bottom, left to right)

### ADIRS
- IR 1/2/3 selectors OFF–NAV–ATT · **Sound:** selector
- ON BAT light (amber) during self test; ALIGN lights on IR pushbuttons while aligning
- Logic: alignment takes several minutes; PFD/ND attitude & heading flags until aligned ⚠️ (we'll shorten to ~1–2 min)

### FLT CTL (left)
- ELAC 1, SEC 1, FAC 1 pushbuttons: OFF (white) / FAULT (amber) · **Sound:** pushbutton

### EVAC, EMER ELEC PWR, GPWS, RCDR, OXYGEN, CALLS
- GPWS pushbuttons (SYS, G/S MODE, FLAP MODE, LDG FLAP 3, TERR) · OFF white / FAULT amber
- RCDR GND CTL ON (blue) · CVR TEST
- CREW SUPPLY OFF (white) · **Sound:** pushbutton
- EVAC COMMAND (guarded) · **Sound:** guard open/close + pushbutton

### FIRE ✅
- ENG 1 / APU / ENG 2 FIRE pushbuttons — red, guarded · **Sound:** guard open + pushbutton (pull release)
- AGENT 1 / AGENT 2 per engine, AGENT for APU: SQUIB (white), DISCH (amber)
- TEST pushbuttons (ENG 1, APU, ENG 2), press and hold:
  - continuous repetitive chime (owner's recording) ✅
  - both MASTER WARN lights flash ✅
  - the fire pushbutton lights red ✅
  - SQUIB white and DISCH amber come on ✅
  - ECAM shows the ENG FIRE (or APU FIRE) warning and the ENGINE page ✅
  - FIRE light under the engine master switch on the pedestal lights red ✅
- Releasing the fire pushbutton: silences the aural warning and arms the squibs; shuts the
  engine's fuel, hydraulic, bleed and pack valves and its generator ✅

### HYD
- ENG 1 PUMP, RAT MAN ON (guarded), ELEC PUMP (blue), PTU, ENG 2 PUMP, YELLOW ELEC PUMP
- FAULT amber / OFF white · **Sound:** pushbutton

### FUEL
- L TK PUMP 1/2, CTR TK PUMP 1/2, MODE SEL (AUTO/MAN), X FEED, R TK PUMP 1/2
- FAULT amber / OFF white; X FEED OPEN green ⚠️ · **Sound:** pushbutton

### ELEC
- BAT 1 / BAT 2 (OFF white, FAULT amber) with voltage readouts
- GEN 1 / GEN 2, APU GEN, EXT PWR (AVAIL green / ON blue), BUS TIE, AC ESS FEED, GALY & CAB, IDG (guarded)
- Logic: batteries on → partial power; EXT PWR or APU GEN → full AC; engine GENs take over after start
- **Sound:** pushbutton (guarded IDG: guard open/close)

### AIR COND
- PACK FLOW selector (LO/NORM/HI) · selector
- HOT AIR, PACK 1, PACK 2, ENG 1 BLEED, ENG 2 BLEED, APU BLEED (ON blue ⚠️ verify), X BLEED selector (SHUT/AUTO/OPEN), RAM AIR (guarded)
- Zone temperature knobs (CKPT, FWD CAB, AFT CAB) · knob turn
- Logic: setting ENG MODE to IGN/START closes the packs; they reopen after the start ✅

### ANTI ICE
- WING, ENG 1, ENG 2 (ON blue, FAULT amber), PROBE/WINDOW HEAT (AUTO/ON)

### CABIN PRESS
- MODE SEL (AUTO/MAN), MAN V/S CTL toggle, LDG ELEV knob, DITCHING (guarded)

### EXT LT
- STROBE (ON/AUTO/OFF), BEACON, WING, NAV & LOGO (1/2/OFF), RWY TURN OFF, LAND L/R (RETRACT/OFF/ON), NOSE (TAXI/T.O/OFF)
- **Sound:** toggle

### APU ✅
- MASTER SW: ON blue, FAULT amber · START: ON blue, AVAIL green · **Sound:** pushbutton
- Logic: MASTER SW on → START → ~35 s run-up (our sound) → AVAIL green → APU BLEED available
- MASTER SW off: AVAIL goes out after a cooling period, then the APU spools down (our sound)

### SIGNS
- SEAT BELTS (ON/OFF), NO SMOKING / NO PED (ON/AUTO/OFF), EMER EXIT LT (ON/ARM/OFF)
- Each SEAT BELTS / NO SMOKING change plays the cabin chime (owner's recording)
- **Sound:** toggle

### INT LT
- OVHD INTEG LT dimmer, ICE IND & STBY COMPASS, DOME (OFF/DIM/BRT), ANN LT (TEST/BRT/DIM) ✅
- ANN LT TEST lights every annunciator at once

### WIPER, RAIN RPLNT, CARGO SMOKE, VENTILATION, CARGO HEAT, ENG MAN START
- Lower-priority panels: build looks and click behaviour first; logic later

---

## 3. Glareshield

### FCU (centre) ✅
- SPD/MACH window + knob (push = managed, pull = selected) · knob turn / push-pull
- HDG/TRK window + knob, LOC pushbutton
- ALT window + knob (100/1000 ft step), ALT knob push/pull
- V/S–FPA window + knob · METRIC ALT, HDG-V/S / TRK-FPA, SPD/MACH pushbuttons
- AP1, AP2, A/THR, EXPED, APPR pushbuttons — green bars when engaged
- Managed targets shown with a dot in the window; selected values shown as numbers
- **Sound:** knob detent (turn), knob push/pull, pushbutton

### EFIS panels (captain + F/O)
- QNH/STD baro knob (hPa/inHg), FD, LS, CSTR, WPT, VOR.D, NDB, ARPT
- ND mode selector (LS/VOR/NAV/ARC/PLAN), range selector (10–320 NM), ADF/VOR 1 & 2 switches

### Warning lights (each side)
- MASTER WARN (red, flashing) — push to silence the aural warning
- MASTER CAUT (amber, steady) — push to reset
- AUTOLAND (red), CHRONO pushbutton, SIDE STICK PRIORITY arrows

---

## 4. Main instrument panel

- **PFD** (each side): speed tape, attitude, altitude tape, V/S, heading, FMA (5 columns), ILS deviations ✅
- **ND** (each side): ARC/ROSE/PLAN modes, magenta route, waypoints, wind, range rings
- **Upper ECAM (E/WD):** N1, EGT, N2, fuel flow, fuel on board, slat/flap position, warnings and memos ✅
- **Lower ECAM (SD):** 11 system pages + STATUS; bottom strip shows TAT, SAT, time, gross weight ✅
- **Standby instrument (ISIS):** attitude, speed, altitude
- Landing gear lever + gear indicator lights (green triangles / red UNLK) · **Sound:** heavy lever
- AUTO BRK (LO / MED / MAX), A/SKID & N/W STRG switch, brake pressure gauge
- Clock (UTC / chrono / elapsed time)
- Display brightness knobs, PFD/ND XFR

---

## 5. Centre pedestal

- **MCDU** ×2 (see section 8)
- **ECAM control panel:** ENG, BLEED, PRESS, ELEC, HYD, FUEL, APU, COND, DOOR, WHEEL, F/CTL, ALL, CLR, STS, RCL, EMER CANC, T.O CONFIG
- **Thrust levers:** detents REV – IDLE – CL – FLX/MCT – TOGA; manual 45 % stabilise position (between IDLE and CL) · **Sound:** thrust detent
- **Engine panel:** ENG 1/2 MASTER (lift and toggle), FIRE (red) / FAULT (amber) lights, MODE selector CRANK–NORM–IGN/START · **Sound:** eng master, selector
- Speed brake lever, flap lever (0, 1, 1+F, 2, 3, FULL) · **Sound:** heavy lever
- Pitch trim wheels, rudder trim, parking brake handle
- RMPs (radio panels), audio control panels, ATC/TCAS panel, WX radar panel

---

## 6. Sidesticks
- Red takeover/AP disconnect pushbutton, radio transmit trigger
- One press: the owner's full disconnect recording (cavalry charge + three following tones), MASTER WARN (≤ 3 s) and red "AP OFF" on ECAM (≤ 9 s)
- Second press stops the aural, light and message at once ✅
- Disconnect any other way (involuntary): cavalry charge keeps going until cancelled ✅

---

## 7. ECAM

### Upper ECAM (E/WD)
- Top: engine primary parameters, fuel on board, slat and flap position ✅
- Bottom: warnings and cautions on the left, memos on the right ✅
- Memos during startup: SEAT BELTS, NO SMOKING, SIGNS ON, APU AVAIL, APU BLEED, PARK BRK, etc.
- After-start and T.O MEMO / LDG MEMO lists

### Lower ECAM (SD) pages ✅
ENG · BLEED · PRESS · ELEC · HYD · FUEL · APU · COND · DOOR · WHEEL · F/CTL + STATUS
- Page auto-selects: APU page during APU start, ENG page when ENG MODE goes to IGN/START ✅
- Keep the bottom data strip (TAT, SAT, ISA, time, G load, gross weight) ✅

### Warnings to model first
| Event | Aural | Light | ECAM |
|---|---|---|---|
| Fire test | Repetitive chime (owner) | MASTER WARN flashes | ENG/APU FIRE |
| AP disconnect | Cavalry charge (owner) | MASTER WARN | AP OFF (red) |
| Caution (e.g. a FAULT) | Single chime (synth) | MASTER CAUT | Amber caution |
| Engine start | — | — | ENG page |
| Signs change | Cabin chime (owner) | — | SEAT BELTS / NO SMOKING memo |

---

## 8. MCDU (approved scope: complete look, limited data)

### Physical unit (exact)
- Screen: 14 lines × 24 characters, title line on top, scratchpad at the bottom ✅
- 6 line select keys each side (1L–6L, 1R–6R) ✅
- Page keys: DIR, PROG, PERF, INIT, DATA, F-PLN, RAD NAV, FUEL PRED, SEC F-PLN, ATC COMM, MCDU MENU, AIRPORT
- Slew keys (← → ↑ ↓), full A–Z keypad, 0–9, ".", "+/-", "/", SP, OVFY, CLR
- Annunciators: FAIL, FM, IND, RDY, FM1, FM2 · brightness knobs
- **Sound:** MCDU key

### Behaviour
- Typing goes to the scratchpad; an LSK sends it to that line ✅
- CLR deletes the last character; held, clears all; CLR then an LSK deletes that field ✅
- Amber scratchpad messages for things to act on; white ones are advisory ✅
- Messages to implement: NOT IN DATA BASE, FORMAT ERROR, NOT ALLOWED, ENTRY OUT OF RANGE, CHECK TAKE OFF DATA, SELECT DESIRED SYSTEM

### Pages that work fully
INIT (FROM/TO, flight number, cost index, cruise level) · INIT FUEL PRED · F-PLN (with LAT REV → DEPARTURE/ARRIVAL) · PERF TAKE OFF (V1, VR, V2, FLEX TEMP, flaps) · PERF CLB / CRZ / DES / APPR · PROG · RAD NAV

### Data
- Worldwide airports with runways, from OurAirports (public domain)
- Radio beacons (VOR/NDB) from the same source
- Full SID/STAR/approach procedures for **VIDP → VABB** only; other pairs fly direct runway to runway

---

## 9. Autopilot and FMA

FMA, top of PFD, five columns × three rows ✅
1. Autothrust (MAN TOGA, MAN FLX, THR CLB, SPEED, THR IDLE…)
2. Vertical (SRS, CLB, OP CLB, ALT*, ALT, DES, V/S, G/S…)
3. Lateral (RWY, NAV, HDG, LOC, …)
4. Approach capability and minimums (CAT 1/2/3, DH/MDA)
5. Engagement status (AP1/AP2, 1FD2, A/THR)

- Row 1 engaged (green), row 2 armed (blue), row 3 reminders ✅
- A white box around any new mode for 10 s ✅
- On the ground ready for takeoff: CLB and NAV armed in blue, 1FD2 ✅
- Push = managed, pull = selected on every FCU knob ✅
- "LVR CLB" flashing at thrust reduction altitude → pull levers to CL (our CL sound)

---

## 10. Normal procedure to simulate (cold and dark → takeoff)

1. **Preliminary cockpit prep:** BAT 1 + 2 ON · EXT PWR ON (if available) · ADIRS NAV · lights test
2. **APU:** FIRE TEST · MASTER SW ON · START → AVAIL (~35 s) · APU BLEED ON ✅
3. **Cockpit prep:** fuel pumps ON · signs ON · MCDU INIT/F-PLN/PERF · FCU set · baro set
4. **Before start:** beacon ON · doors closed · parking brake
5. **Engine start** ✅
   - ENG MODE → IGN/START (packs close, lower ECAM shows ENG page)
   - ENG 2 MASTER ON → start valve opens, N2 rises, ignition, fuel flow, EGT rise, idle
   - LEAP-1A: FADEC may "dry crank" first for up to ~60 s if the engine is still warm (bowed-rotor protection) ✅
   - When ENG 2 is at idle: ENG 1 MASTER ON, same sequence (our sounds overlap the two)
   - ENG MODE → NORM · APU BLEED OFF · APU MASTER OFF
6. **Taxi:** flaps set, T.O CONFIG test, T.O MEMO all green
7. **Takeoff:** levers to ~45 % stabilise (our 45 % sound) → FLX/MCT (our FLX sound)
   → MAN FLX on FMA → climb → LVR CLB → CL (our CL sound) → AP ON

---

## 11. Open questions for the owner

1. ~~AP disconnect clip~~ — resolved: the owner confirmed all six tones are part of it; the full recording plays.
2. **APU BLEED light colour:** sources differ (white vs blue) — will confirm against cockpit photos.
3. ~~Startup clip~~ — resolved: the full 63-second recording plays, including the build-up before the engine turns.
4. **TOGA, idle taxi and shutdown recordings** — still welcome whenever you have them.

---

## Sources

- FlyByWire A32NX documentation — fire panel, internal lights, FCU, MCDU interface, FMA, ECAM STATUS page, beginner guides (docs.flybywiresim.com)
- AviationHunt — A320 cockpit colour coding, fire control panel, ECAM SD pages
- Airbus/ICAO FOSAS 2017 — Airbus cockpit philosophy (dark cockpit, colour coding)
- FAA-hosted Airbus Flight Operations Briefing Note — Optimum Use of Automation
- PPRuNe Tech Log — A320 start, LEAP-1A cooling/dry crank, fire test threads
- FlightGlobal — CFM Leap-1A start-up time
- SKYbrary — MCDU, FMA
- Training flashcards (Brainscape) — used only to cross-check other sources
