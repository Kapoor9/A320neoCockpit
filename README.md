# A320neo Cockpit

A realistic, interactive Airbus A320neo cockpit for the browser.

## Status

**Stage 1 — Audio (done):** sound test board at `sound-test.html`.
**Stage 3 — First look:** the 3D flight deck at `cockpit.html` (layout and camera; detail comes next).

| Stage | What | Status |
|---|---|---|
| 1 | Audio engine and all sounds | Done |
| 2 | Research and master checklist | Done (`docs/master-checklist.md`) |
| 3 | 3D cockpit and game-style camera | In progress — layout and camera done |
| 4 | Interactive panels and lighting | |
| 5 | Systems logic, startup, ECAM | |
| 6 | PFD, ND, FCU, autopilot | |
| 7 | MCDU / FMS (worldwide airports) | |
| 8 | Polish and testing | |

## Run it locally

Any static server works, e.g. `python3 -m http.server` in this folder, then open
`http://localhost:8000/sound-test.html`.

## Folders

- `src/cockpit/` — the 3D flight deck: dimensions (`dims.js`), geometry (`build.js`), camera (`camera.js`)
- `vendor/three/` — the Three.js 3D library (MIT licence)
- `src/audio/` — the audio engine (ambience, engines, APU, warnings, clicks)
- `public/sounds/` — the sounds the site plays (loops as WAV so they join with no gap, the rest as MP3)
- `assets/raw-audio/` — original recordings, untouched
- `tools/audio/` — scripts that turned the recordings into loops and made the synthesised sounds

## Sounds

All recorded sounds (engine start, takeoff thrust, ambience, autopilot disconnect,
fire test / master warning, seat-belt chime) are the owner's own recordings.
Clicks, APU, engine shutdown and the master caution chime are synthesised.

### Engine thrust model
The takeoff recording is mapped to thrust positions: IDLE 0–2.2 s, 45 % 2.5–3.4 s,
spool-up through CL 3.4–6.7 s, FLX/MCT from 7 s. A steady lever position loops that
position's sound indefinitely. Moving the levers up plays the real recorded spool-up;
moving down walks back through the recording 1.4× slower.

## To do later

- Engine acceleration/deceleration between thrust levels is not smooth enough yet (owner feedback).

## Credits

Cockpit shapes are modelled after **"A320 Cockpit 2" by davidmarton1987**
(Sketchfab, CC BY 4.0, https://creativecommons.org/licenses/by/4.0/), used as the
reference model. All geometry in this repository is rebuilt from scratch; no files,
meshes or textures from that model are included.
