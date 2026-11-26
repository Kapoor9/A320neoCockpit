// Connects the cockpit systems to the audio engine (src/audio/audioEngine.js, the owner's recordings).
// - Batteries on: a short electrical power-up (relays closing, inverter whine rising, ~0.5 s) that blends into
//   the cockpit ambience. On batteries alone the ambience is quieter and duller; when AC arrives the avionics
//   ventilation spins up and it opens out to full. All power gone: it winds down.
// - Every control makes its own click; APU, engines, master warning / caution and the signs chime follow the systems.
// Sound starts on the first click anywhere (browsers only allow audio after a user gesture).
import { CockpitAudio } from '../../audio/audioEngine.js';

export class CockpitSound {
  constructor(sim, systems) {
    this.sim = sim; this.sys = systems; this.audio = new CockpitAudio(); this.enabled = true;
    this.prev = { dc: false, ac: false, apuStarting: false, apuRun: false, apuStop: false, mw: false, mc: false, eng: [false, false], engRun: [false, false] };
    const start = () => { if (this.enabled) this.init(); };
    window.addEventListener('pointerdown', start, { capture: true });
    window.addEventListener('keydown', start, { capture: true });
    sim.on((c, ev, data) => this.onControl(c, ev, data));
  }
  init() {
    if (this.audio.ctx) { if (this.audio.ctx.state === 'suspended') this.audio.ctx.resume(); return; }
    this.audio.init().catch((e) => console.warn('audio', e));   // creates the context now (inside the gesture), loads in the background
    const c = this.audio.ctx; if (!c) return;
    // ambience chain: loop -> level -> low-pass (opens when AC fans run) -> ambience bus
    this.ambLevel = c.createGain(); this.ambLevel.gain.value = 0;
    this.ambTone = c.createBiquadFilter(); this.ambTone.type = 'lowpass'; this.ambTone.frequency.value = 900; this.ambTone.Q.value = 0.5;
    this.ambLevel.connect(this.ambTone);
    const hookBus = () => { if (this.audio.bus) this.ambTone.connect(this.audio.bus.ambience); else setTimeout(hookBus, 30); }; hookBus();
    this.powerBuf = makePowerUp(c); this.powerDownBuf = makePowerDown(c);
  }
  setEnabled(on) { this.enabled = on; const c = this.audio.ctx; if (!c) { if (on) this.init(); return; } on ? c.resume() : c.suspend(); }

  // ------------------------------------------------------------------ control clicks
  onControl(c, ev) {
    const a = this.audio; if (!a.ctx || !a.buffers.size || !this.enabled) return;
    const id = c.id, k = c.kind;
    let type = null;
    if (ev === 'guard') type = c.guardOpen ? 'guard_open' : 'guard_close';
    else if (ev === 'push' || ev === 'pull') type = 'knob_pushpull';
    else if (ev === 'turn') type = 'knob_detent';
    else if (ev === 'down') type = id.startsWith('mcdu') ? 'mcdu_key' : 'pushbutton';
    else if (ev === 'change') {
      if (id.startsWith('engPanel.master')) type = 'eng_master';
      else if (id.startsWith('thrust.')) type = Number.isInteger(c.value) && [-14, 0, 22, 33, 45].includes(c.value) ? 'thrust_detent' : null;
      else if (/^(flaps|speedbrake|gear\.lever|parkBrake)/.test(id)) type = 'lever_heavy';
      else if (k === 'alt' || k === 'latch' || k === 'radio') type = 'pushbutton';
      else if (k === 'tog') type = 'toggle';
      else if (k === 'sel') type = 'selector';
      else if (k === 'rx') type = 'knob_pushpull';
      if (/signsIntLt\.(seatBelts|noSmoking)$/.test(id) && this.sys.s.elec.dcEss) setTimeout(() => a.signsChime?.(), 350);
    }
    if (type && a.buffers.has(`click_${type}_1`)) a.click(type);
  }

  // ------------------------------------------------------------------ follow the systems (called by Systems.tick, 10 Hz)
  update(S) {
    const a = this.audio, c = a.ctx; if (!c || !this.ambLevel) return;
    const t = c.currentTime, P = this.prev; const dc = !!S.elec.dcEss, ac = !!S.elec.ac;
    // power up / down
    if (dc && !P.dc) { this.oneShot(this.powerBuf, 0.55); this.ambLevel.gain.cancelScheduledValues(t); this.ambLevel.gain.setTargetAtTime(ac ? 1 : 0.42, t + 0.18, 0.22); }
    if (!dc && P.dc) { this.oneShot(this.powerDownBuf, 0.45); this.ambLevel.gain.cancelScheduledValues(t); this.ambLevel.gain.setTargetAtTime(0, t, 0.35); }
    if (dc && ac !== P.ac) {   // avionics ventilation: spins up over a few seconds with AC, runs down without
      this.ambLevel.gain.setTargetAtTime(ac ? 1 : 0.42, t, ac ? 1.0 : 0.8);
      this.ambTone.frequency.setTargetAtTime(ac ? 9000 : 900, t, ac ? 1.2 : 0.8);
    }
    if (!P.dc && dc) this.ambTone.frequency.setValueAtTime(ac ? 9000 : 900, t);
    if (dc && !this.amb && a.buffers.has('ambience_loop')) {   // the loop itself runs from the first power-up on
      const src = c.createBufferSource(); src.buffer = a.buffers.get('ambience_loop'); src.loop = true; src.connect(this.ambLevel); src.start(t, Math.random() * 8); this.amb = src;
    }
    P.dc = dc; P.ac = ac;
    if (!a.ready) return;
    // APU: start recording when the start begins, running loop if it is already running, wind-down when it stops
    const A = S.apu;
    if (A.starting && !P.apuStarting) a.apuStart();
    if (A.avail && !A.shutting && !P.apuRun && !A.starting && a.apuState !== 'running' && a.apuState !== 'starting') { a.apuState = 'running'; a.apuVoice = a.play('apu_run_loop', { bus: 'apu', loop: true, fadeIn: 1.5 }); }
    const winding = A.shutting && A.cool <= 0 && A.n > 0;
    if (winding && !P.apuStop) a.apuStop();
    P.apuStarting = A.starting; P.apuRun = A.avail; P.apuStop = winding;
    // engines: the recorded start sequence from start valve open, idle loop when running, shutdown spool-down
    (S.eng || []).forEach((E, i) => {
      const n = i + 1; const on = E.starting || E.running;
      if (on && !P.eng[i]) { if (E.running && !E.starting) { a.eng ??= { 1: 'off', 2: 'off' }; a.eng[n] = 'running'; a.thrust.setRunning(a.runningCount(), 2); } else a.engineStart(n); }
      if (!on && P.eng[i]) a.engineStop(n);
      P.eng[i] = on;
    });
    if (S.eng) { const tla = Math.max(...S.eng.map((E, i) => (E.running ? S.tla[i] : 0))); a.setThrust(tla < 6 ? 'IDLE' : tla < 17 ? 'N45' : tla < 28 ? 'CL' : 'FLX'); }
    // master warning (continuous repetitive chime) and master caution (single chime)
    a.masterWarning(!!S.masterWarn && dc);
    if (S.masterCaut && !P.mc && dc) a.masterCaution();
    P.mc = S.masterCaut;
  }
  oneShot(buf, gain) { const c = this.audio.ctx; if (!c || !this.audio.bus) return; const s = c.createBufferSource(); s.buffer = buf; const g = c.createGain(); g.gain.value = gain; s.connect(g).connect(this.audio.bus.ambience); s.start(); }
}

// ~0.5 s electrical power-up: two relay clunks, a soft thump, the static inverter whine rising and settling,
// and a breath of fan noise that hands over to the ambience loop
function makePowerUp(c) {
  const sr = c.sampleRate, n = Math.round(sr * 0.6), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
  let lp = 0, lp2 = 0, seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / sr; let v = 0;
    for (const [t0, a0] of [[0.0, 1.0], [0.045, 0.7], [0.11, 0.45]]) { const u = t - t0; if (u >= 0 && u < 0.05) { const e = Math.exp(-u * 160); lp += (rnd() - lp) * 0.35; v += lp * e * a0 * 0.9 + Math.sin(2 * Math.PI * 95 * u) * e * a0 * 0.6; } }   // contactor clunks
    const w = Math.min(1, Math.max(0, (t - 0.08) / 0.32)); const f = 320 + 80 * w;                                    // inverter whine coming up to 400 Hz
    v += (Math.sin(2 * Math.PI * f * t) * 0.05 + Math.sin(2 * Math.PI * 2 * f * t) * 0.025 + Math.sin(2 * Math.PI * 3 * f * t) * 0.012) * w * (1 - Math.max(0, (t - 0.42) / 0.18));
    lp2 += (rnd() - lp2) * 0.08; v += lp2 * 0.35 * w * (1 - Math.max(0, (t - 0.4) / 0.2));                             // first breath of air
    d[i] = v * (i > n - 400 ? (n - i) / 400 : 1);
  }
  return b;
}
function makePowerDown(c) {
  const sr = c.sampleRate, n = Math.round(sr * 0.7), b = c.createBuffer(1, n, sr), d = b.getChannelData(0); let lp = 0, seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr; const f = 400 * Math.exp(-t * 2.2); ph += (2 * Math.PI * f) / sr; const e = Math.exp(-t * 4);
    let v = Math.sin(ph) * 0.05 * e + Math.sin(2 * ph) * 0.02 * e; if (t < 0.05) { lp += (rnd() - lp) * 0.35; v += lp * Math.exp(-t * 150) * 0.8; } d[i] = v; }
  return b;
}
