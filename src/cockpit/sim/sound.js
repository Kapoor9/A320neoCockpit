// Connects the cockpit systems to the audio engine (src/audio/audioEngine.js, the owner's recordings).
// Power-up follows the owner's sim-cockpit recording (assets/raw-audio/sim_power_up.flac):
// - BAT 1 and BAT 2 on: about 0.9 s later the electrical power-up thump (~0.5 s), then the cockpit stays quiet.
// - AC power arrives (EXT PWR, APU GEN or an engine generator): the relays close and the air (avionics
//   ventilation) builds up over ~1.5 s and holds - recorded ramp, then a seamless loop of the same air.
// - APU start: the recorded start fades over its last 2 s into the same air (no separate APU running roar).
// - Engine start: the air dies away within ~1.5 s (packs and ventilation give way to the start), the start
//   recording takes over and blends into the engine running sound. AC lost: the air runs down.
// Every control makes its own click (Korry pushbuttons use the recorded click); APU, engines, master warning /
// caution and the signs chime follow the systems. Sound starts on the first click anywhere (browser rule).
import { CockpitAudio } from '../../audio/audioEngine.js';

export class CockpitSound {
  constructor(sim, systems) {
    this.sim = sim; this.sys = systems; this.audio = new CockpitAudio(); this.enabled = true;
    this.prev = { both: false, ac: false, apuStarting: false, apuRun: false, apuStop: false, mc: false, eng: [false, false], engRun: false };
    const start = () => { if (this.enabled) this.init(); };
    window.addEventListener('pointerdown', start, { capture: true });
    window.addEventListener('keydown', start, { capture: true });
    sim.on((c, ev, data) => this.onControl(c, ev, data));
  }
  init() {
    if (this.audio.ctx) { if (this.audio.ctx.state === 'suspended') this.audio.ctx.resume(); return; }
    this.audio.init().catch((e) => console.warn('audio', e));   // creates the context now (inside the gesture), loads in the background
    const c = this.audio.ctx; if (!c) return;
    // air (AC ventilation) chain and engine-running ambience chain, each with its own level
    this.airLevel = c.createGain(); this.airLevel.gain.value = 0;
    this.airTone = c.createBiquadFilter(); this.airTone.type = 'lowpass'; this.airTone.frequency.value = 12000; this.airTone.Q.value = 0.4;
    this.airLevel.connect(this.airTone);
    this.ambLevel = c.createGain(); this.ambLevel.gain.value = 0;
    const hookBus = () => { if (this.audio.bus) { this.airTone.connect(this.audio.bus.ambience); this.ambLevel.connect(this.audio.bus.ambience); } else setTimeout(hookBus, 30); }; hookBus();
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
    else if (ev === 'down') type = id.startsWith('mcdu') ? 'mcdu_key' : c.ctl?.kind === 'pb' ? 'korry' : 'pushbutton';
    else if (ev === 'change') {
      if (id.startsWith('engPanel.master')) type = 'eng_master';
      else if (id.startsWith('thrust.')) type = Number.isInteger(c.value) && [-14, 0, 22, 33, 45].includes(c.value) ? 'thrust_detent' : null;
      else if (/^(flaps|speedbrake|gear\.lever|parkBrake)/.test(id)) type = 'lever_heavy';
      else if (k === 'alt' || k === 'latch' || k === 'radio') type = c.ctl?.kind === 'pb' ? 'korry' : 'pushbutton';
      else if (k === 'tog') type = 'toggle';
      else if (k === 'sel') type = 'selector';
      else if (k === 'rx') type = 'knob_pushpull';
      if (/signsIntLt\.(seatBelts|noSmoking)$/.test(id) && this.sys.s.elec.dcEss) setTimeout(() => a.signsChime?.(), 350);
    }
    if (type && a.buffers.has(`click_${type}_1`)) a.click(type);
  }

  // ------------------------------------------------------------------ follow the systems (called by Systems.tick, 10 Hz)
  update(S) {
    const a = this.audio, c = a.ctx; if (!c || !this.airLevel || !a.bus) return;
    const t = c.currentTime, P = this.prev; const ac = !!S.elec.ac;
    const both = !!(this.sim.val('elec.bat1') && this.sim.val('elec.bat2'));
    // batteries: the power-up thump ~0.9 s after both are on (as in the recording); nothing after it
    if (both && !P.both && a.buffers.has('bat_power_up')) this.batVoice = a.play('bat_power_up', { bus: 'ambience', when: t + 0.9 });   // scheduled on the audio clock
    if (!both && P.both && this.batVoice) { try { this.batVoice.src.stop(); } catch { /* already played */ } this.batVoice = null; }
    // the air: on with AC or a running APU, gone while an engine is starting or running
    const engOn = (S.eng || []).some((e) => e.starting || e.running);
    const apuAir = a.apuState === 'running';
    const want = (ac || apuAir) && !engOn;
    if (!this.air && a.buffers.has('ac_air_loop')) { const src = c.createBufferSource(); src.buffer = a.buffers.get('ac_air_loop'); src.loop = true; src.connect(this.airLevel); src.start(t, Math.random() * 12); this.air = src; }
    const g = this.airLevel.gain, f = this.airTone.frequency;
    if (want && !this.airOn) {
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); f.cancelScheduledValues(t); f.setValueAtTime(12000, t);
      if (ac && !P.ac && !engOn) { const ramp = this.sample('ext_pwr_on', 1); if (ramp) { g.setValueAtTime(0, t + 1.5); g.linearRampToValueAtTime(1, t + 2.1); } else g.setTargetAtTime(1, t, 0.5); }   // relays + recorded build-up, then the loop
      else if (apuAir && !P.apuAir) g.linearRampToValueAtTime(1, t + 2.0);   // APU start fading out over these same 2 s
      else g.setTargetAtTime(1, t, 0.6);
    }
    if (!want && this.airOn) {
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); f.cancelScheduledValues(t); f.setValueAtTime(f.value, t);
      if (engOn) { g.setTargetAtTime(0, t, 0.4); f.setTargetAtTime(600, t, 0.5); }   // engine start: gone within ~1.5 s
      else { g.setTargetAtTime(0, t, 1.0); f.setTargetAtTime(400, t, 0.8); }          // power lost: fans run down
    }
    this.airOn = want; P.apuAir = apuAir;
    const engRun = engOn;
    P.both = both; P.ac = ac; P.engRun = engRun;
    if (!a.ready) return;
    // APU: start recording when the start begins, running loop if it is already running, wind-down when it stops
    const A = S.apu;
    if (A.starting && !P.apuStarting) a.apuStart({ runLoop: false });
    if (A.avail && !A.shutting && !P.apuRun && !A.starting && a.apuState !== 'running' && a.apuState !== 'starting') a.apuState = 'running';   // already running (preset): its sound is the air
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
  sample(name, gain) { const a = this.audio; if (!a.buffers.has(name)) return null; return a.play(name, { bus: 'ambience', gain }); }
}
