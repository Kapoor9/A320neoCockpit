// A320neo cockpit audio engine
// - Ambience runs endlessly underneath everything (sample-accurate loop).
// - Every event sound is a clean layer on top; no second ambience is ever added.
// - Engine thrust: steady loops at IDLE / 45 / CL / FLX-MCT, and the real recorded
//   spool-up between them. Spool-down walks the same recording backwards, slower.

const SOUND_DIR = new URL('../../public/sounds/', import.meta.url).href;

// Positions in the takeoff recording (seconds) used for transitions.
// up master  = the recording itself (0..12 s)
// down master= the recording walked backwards from 7.2 s to 0.4 s at 1/1.4 speed
// One point in the spool-up recording per mode (fan tone: IDLE ~434 Hz, N45 ~530, CL ~750, FLX ~870). Transitions
// start and end exactly there, and each mode's loop is a frozen continuation of that same point
// (tools/audio/build_thrust_loops.py), so arriving in a mode just carries on the sound it reached.
const THRUST_POS = { IDLE: 1.6, N45: 3.0, CL: 5.45, FLX: 7.2 };
const UP_FROM = THRUST_POS, UP_TO = THRUST_POS, DOWN_FROM = THRUST_POS, DOWN_TO = THRUST_POS;
// equal-power crossfade curves (no loudness dip in the middle, unlike a linear fade between two noises)
const XF_IN = new Float32Array(64).map((_, i) => Math.sin((i / 63) * Math.PI / 2));
const XF_OUT = new Float32Array(64).map((_, i) => Math.cos((i / 63) * Math.PI / 2));
const DOWN_SLOW = 1.4;
const ORDER = ['IDLE', 'N45', 'CL', 'FLX'];
const LOOP_FILE = { IDLE: 'eng_idle_loop', N45: 'eng_n45_loop', CL: 'eng_cl_loop', FLX: 'eng_flx_loop' };

const CLICK_TYPES = [
  'pushbutton', 'toggle', 'guard_open', 'guard_close', 'knob_detent', 'knob_pushpull',
  'selector', 'eng_master', 'thrust_detent', 'mcdu_key', 'sidestick_btn', 'lever_heavy', 'korry',
];

export class CockpitAudio {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.ready = false;
    this.listeners = new Set();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev, data) { for (const fn of this.listeners) fn(ev, data); }

  // Must be called from a user gesture (tap/click) so browsers allow sound.
  async init(onProgress) {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const c = this.ctx;
    this.out = c.createGain(); this.out.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.out.connect(comp).connect(c.destination);
    const bus = (v) => { const g = c.createGain(); g.gain.value = v; g.connect(this.out); return g; };
    this.bus = {
      ambience: bus(0.55), engines: bus(1.0), apu: bus(0.55),
      warnings: bus(0.75), chimes: bus(0.7), clicks: bus(0.6),
    };

    const names = [
      'ambience_loop', 'ac_air_loop', 'bat_power_up', 'ext_pwr_on', 'apu_start', 'apu_run_loop', 'apu_stop',
      'eng_start', 'eng_shutdown', 'eng_up_master', 'eng_down_master',
      ...Object.values(LOOP_FILE),
      'master_warning_loop', 'master_caution', 'fire_test_full',
      'ap_disconnect', 'ap_disconnect_cycle', 'chime_signs',
      ...CLICK_TYPES.flatMap((t) => [1, 2, 3].map((v) => `click_${t}_${v}`)),
    ];
    let done = 0;
    await Promise.all(names.map(async (n) => {
      // Loops are WAV so they join with no gap; everything else is MP3.
      const ext = n.endsWith('_loop') ? 'wav' : 'mp3';
      const res = await fetch(`${SOUND_DIR}${n}.${ext}`);
      if (!res.ok) throw new Error(`Missing sound ${n}`);
      const buf = await c.decodeAudioData(await res.arrayBuffer());
      this.buffers.set(n, buf);
      done++; onProgress?.(done / names.length);
    }));

    // Level-match the end of the start sequence to the idle loop.
    this.startGain = this._rms('eng_idle_loop') / this._rms('eng_start', -3);
    this.ready = true;
    this.thrust = new ThrustVoice(this);
    this.emit('ready');
  }

  _rms(name, fromSec = 0) {
    const b = this.buffers.get(name); const d = b.getChannelData(0);
    const start = fromSec < 0 ? Math.max(0, d.length + fromSec * b.sampleRate) : fromSec * b.sampleRate;
    let s = 0, n = 0;
    for (let i = start | 0; i < d.length; i += 4) { s += d[i] * d[i]; n++; }
    return Math.sqrt(s / Math.max(1, n));
  }

  // Generic player: returns {src, gain}
  play(name, { bus = 'warnings', gain = 1, loop = false, offset = 0, duration, when = 0, rate = 1, fadeIn = 0 } = {}) {
    const c = this.ctx; const buf = this.buffers.get(name);
    if (!buf) return null;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = loop; src.playbackRate.value = rate;
    const g = c.createGain();
    const t = when || c.currentTime;
    if (fadeIn > 0) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + fadeIn); }
    else g.gain.value = gain;
    src.connect(g).connect(this.bus[bus]);
    if (duration != null && !loop) src.start(t, offset, duration); else src.start(t, offset);
    return { src, gain: g };
  }

  fadeOut(voice, sec = 0.3) {
    if (!voice) return;
    const t = this.ctx.currentTime; const g = voice.gain.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + sec);
    try { voice.src.stop(t + sec + 0.05); } catch { /* already stopped */ }
  }

  // ---------------- Ambience (never stops)
  startAmbience() {
    if (this.amb) return;
    this.amb = this.play('ambience_loop', { bus: 'ambience', loop: true, fadeIn: 2 });
    // Very slow, small level drift so hours of listening never feel mechanical.
    const drift = () => {
      if (!this.amb) return;
      const g = this.amb.gain.gain; const t = this.ctx.currentTime;
      g.setTargetAtTime(0.88 + Math.random() * 0.24, t, 3);
      this._ambTimer = setTimeout(drift, 6000 + Math.random() * 6000);
    };
    setTimeout(drift, 3000);
  }
  stopAmbience() { clearTimeout(this._ambTimer); this.fadeOut(this.amb, 1.5); this.amb = null; }

  // ---------------- Clicks (each control type has its own sound)
  click(type) {
    const v = 1 + Math.floor(Math.random() * 3);
    this.play(`click_${type}_${v}`, { bus: 'clicks', rate: 0.97 + Math.random() * 0.06, gain: 0.9 + Math.random() * 0.1 });
  }

  // ---------------- Warnings & chimes
  masterWarning(on) {   // continuous repetitive chime (fire / master warning)
    if (on && !this.mw) this.mw = this.play('master_warning_loop', { bus: 'warnings', loop: true });
    if (!on && this.mw) { this.fadeOut(this.mw, 0.05); this.mw = null; }
  }
  masterCaution() { this.play('master_caution', { bus: 'chimes' }); }
  signsChime() { this.play('chime_signs', { bus: 'chimes' }); }
  // Instinctive disconnect (sidestick button): the owner's full recording, all six tones.
  // A second press stops it at once.
  apDisconnect() {
    if (this.apOnce) { this.fadeOut(this.apOnce, 0.03); this.apOnce = null; return; }
    const v = this.play('ap_disconnect', { bus: 'warnings' });
    this.apOnce = v; v.src.onended = () => { if (this.apOnce === v) this.apOnce = null; };
  }
  // Involuntary disconnect: cavalry charge repeats until cancelled.
  apDisconnectContinuous(on) {
    if (on && !this.apc) this.apc = this.play('ap_disconnect', { bus: 'warnings', loop: true });
    if (!on && this.apc) { this.fadeOut(this.apc, 0.05); this.apc = null; }
  }

  // ---------------- APU
  // runLoop false: the start recording fades out over its last 2 s and the caller blends in its own air
  // (the cockpit uses the ventilation air rather than a separate APU running loop)
  apuStart({ runLoop = true } = {}) {
    if (this.apuState === 'starting' || this.apuState === 'running') return;
    this.fadeOut(this.apuVoice, 0.5);
    const c = this.ctx; const buf = this.buffers.get('apu_start');
    this.apuState = 'starting'; this.emit('apu', 'starting');
    const start = this.apuVoice = this.play('apu_start', { bus: 'apu', fadeIn: 0.3 });
    const xf = 2.0; const tEnd = c.currentTime + buf.duration;
    let run = null;
    if (runLoop) { run = this.play('apu_run_loop', { bus: 'apu', loop: true, when: tEnd - xf, gain: 0 }); run.gain.gain.setValueAtTime(0, tEnd - xf); run.gain.gain.linearRampToValueAtTime(1, tEnd); }
    this._apuTimer = setTimeout(() => {
      if (!runLoop) this.fadeOut(start, xf);
      this.apuVoice = run; this.apuState = 'running'; this.emit('apu', 'avail');
    }, (buf.duration - xf) * 1000);
    return tEnd;
  }
  apuStop() {
    if (!this.apuState || this.apuState === 'off') return;
    clearTimeout(this._apuTimer);
    this.fadeOut(this.apuVoice, 1.5);
    this.apuVoice = this.play('apu_stop', { bus: 'apu', fadeIn: 1.0 });
    this.apuState = 'off'; this.emit('apu', 'off');
  }

  // ---------------- Engines
  // n = 1 or 2. Start: the recorded start sequence, then hand over to idle.
  engineStart(n) {
    this.eng ??= { 1: 'off', 2: 'off' };
    if (this.eng[n] !== 'off') return;
    const c = this.ctx; const buf = this.buffers.get('eng_start');
    this.eng[n] = 'starting'; this.emit('engine', { n, state: 'starting' });
    // Engine 1 is on the far side from the recording position: slightly quieter/duller.
    const side = n === 2 ? 1 : 0.8;
    const v = this.play('eng_start', { bus: 'engines', gain: this.startGain * side * 1.15 });
    this[`engStartVoice${n}`] = v;
    const xf = 3.0;
    this[`engTimer${n}`] = setTimeout(() => {
      this.eng[n] = 'running';
      this.thrust.setRunning(this.runningCount(), xf);
      this.fadeOut(v, xf);
      this.emit('engine', { n, state: 'running' });
    }, (buf.duration - xf) * 1000);
  }
  engineStop(n) {
    if (!this.eng || this.eng[n] === 'off') return;
    clearTimeout(this[`engTimer${n}`]);
    this.fadeOut(this[`engStartVoice${n}`], 0.8);
    const wasRunning = this.eng[n] === 'running';
    this.eng[n] = 'off';
    if (wasRunning) {
      const side = n === 2 ? 1 : 0.8;
      this.play('eng_shutdown', { bus: 'engines', gain: side * this.thrust.levelGain(), fadeIn: 0.8 });
    }
    this.thrust.setRunning(this.runningCount(), 1.0);
    this.emit('engine', { n, state: 'off' });
  }
  runningCount() { return this.eng ? Object.values(this.eng).filter((s) => s === 'running').length : 0; }

  // Thrust levers: 'IDLE' | 'N45' | 'CL' | 'FLX'
  setThrust(detent) { this.thrust.setTarget(detent); }
}

// Plays the engine thrust sound for the aircraft (both engines' levers together).
class ThrustVoice {
  constructor(audio) {
    this.a = audio; this.c = audio.ctx;
    this.out = this.c.createGain(); this.out.gain.value = 0;
    this.out.connect(audio.bus.engines);
    this.state = 'IDLE';          // steady detent, or 'MOVING'
    this.target = 'IDLE';
    this.voice = null;            // current playing voice
    this.seg = null;              // {dir, fromPos, toPos, t0}
    this.running = 0;
  }
  levelGain() { return { IDLE: 1, N45: 1, CL: 1, FLX: 1 }[this.state] ?? 1; }

  setRunning(count, fade = 1.0) {
    this.running = count;
    const g = count === 2 ? 1 : count === 1 ? 0.72 : 0;
    const t = this.c.currentTime; const p = this.out.gain;
    p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(g, t + fade);
    if (count > 0 && !this.voice) this._startLoop(this.state === 'MOVING' ? this.target : this.state, 0.05);
    if (count === 0 && this.voice) { const v = this.voice; setTimeout(() => this.a.fadeOut(v, 0.1), fade * 1000); this.voice = null; }
  }

  _mk(name, { loop = false, offset = 0, duration, when, gain = 1 } = {}) {
    const src = this.c.createBufferSource(); src.buffer = this.a.buffers.get(name); src.loop = loop;
    const g = this.c.createGain(); g.gain.value = gain;
    src.connect(g).connect(this.out);
    if (duration != null && !loop) src.start(when, offset, duration); else src.start(when, offset);
    return { src, gain: g };
  }

  // Equal-power fades built from short linear steps (sin / cos shape). Plain ramps can be cut off and
  // re-scheduled at any moment, which curve automation cannot (it refuses overlapping events -> silence).
  _hold(g, t) { if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else { const v = g.value; g.cancelScheduledValues(t); g.setValueAtTime(v, t); } }
  _shape(g, at, dur, from, to, rising) {
    const n = 10; g.setValueAtTime(from, at);
    for (let i = 1; i <= n; i++) { const x = (i / n) * Math.PI / 2; const k = rising ? Math.sin(x) : 1 - Math.cos(x); g.linearRampToValueAtTime(from + (to - from) * k, at + (dur * i) / n); }
  }
  _in(v, at, dur) { const g = v.gain.gain; this._hold(g, this.c.currentTime); this._shape(g, Math.max(at, this.c.currentTime), dur, 0, 1, true); }
  _out(v, at, dur) {
    if (!v) return; const g = v.gain.gain; const now = this.c.currentTime;
    if (at > now + 0.005) { g.setValueAtTime(1, at); this._shapeLater(g, at, dur); }      // later: queued after its fade-in
    else { this._hold(g, now); this._shape(g, now, dur, g.value, 0, false); at = now; }   // now: from whatever level it has
    try { v.src.stop(at + dur + 0.05); } catch { /* already stopped */ }
  }
  _shapeLater(g, at, dur) { const n = 10; for (let i = 1; i <= n; i++) { const x = (i / n) * Math.PI / 2; g.linearRampToValueAtTime(Math.cos(x), at + (dur * i) / n); } }

  _startLoop(detent, xf = 0.4, at = null) {
    const t = at ?? this.c.currentTime;
    const buf = this.a.buffers.get(LOOP_FILE[detent]);
    const v = this._mk(LOOP_FILE[detent], { loop: true, offset: Math.random() * buf.duration * 0.8, when: t, gain: 0 });
    this._in(v, t, xf);
    if (this.voice) this._out(this.voice, t, xf);
    this.voice = v; this.state = detent; this.seg = null; this.pending = null;
    this.a.emit('thrust', { state: detent });
    return v;
  }

  // Where in the recording the sound is right now (seconds).
  _currentPos() {
    if (this.seg) {
      const el = this.c.currentTime - this.seg.t0;
      if (this.seg.dir > 0) return Math.min(this.seg.toPos, this.seg.fromPos + el);
      return Math.max(this.seg.toPos, this.seg.fromPos - el / DOWN_SLOW);
    }
    return null;
  }

  setTarget(detent) {
    if (detent === this.target && this.running && this.voice) return;   // already there or on the way
    this.target = detent;
    if (!this.running) { this.state = detent; return; }
    // a hand-over already scheduled for an earlier target is cancelled
    if (this.pending) { const p = this.pending; this.pending = null; if (p.at > this.c.currentTime) { try { p.v.src.stop(); } catch { /* not started */ } } else this._out(p.v, this.c.currentTime, 0.3); }
    const cur = this._currentPos() ?? THRUST_POS[this.state];
    const toPos = THRUST_POS[detent];
    if (Math.abs(toPos - cur) < 0.02) { if (this.state !== detent) this._startLoop(detent, 0.5); return; }
    const dir = toPos > cur ? 1 : -1, fromPos = cur;
    const t = this.c.currentTime; const xs = 0.35, xa = 0.7;   // start / arrival crossfades
    let v, dur;
    if (dir > 0) { dur = toPos - fromPos; v = this._mk('eng_up_master', { offset: fromPos, duration: dur + xa, when: t, gain: 0 }); }
    else { const o = (7.2 - fromPos) * DOWN_SLOW; dur = (fromPos - toPos) * DOWN_SLOW; v = this._mk('eng_down_master', { offset: o, duration: dur + xa, when: t, gain: 0 }); }
    // the recording takes over from where the sound is (same point, same pitch), equal-power
    this._in(v, t, xs); if (this.voice) this._out(this.voice, t, xs);
    this.voice = v; this.state = 'MOVING';
    this.seg = { dir, fromPos, toPos, t0: t };
    this.a.emit('thrust', { state: 'MOVING', to: detent });
    // arrival, on the audio clock: the mode's loop (a continuation of this very point) fades in across the
    // moment of arrival while the recording fades out - no jump in pitch or level
    const at = t + Math.max(xs, dur - xa / 2);
    const loop = this._mk(LOOP_FILE[detent], { loop: true, offset: Math.random() * this.a.buffers.get(LOOP_FILE[detent]).duration * 0.8, when: at, gain: 0 });
    this._in(loop, at, xa); this._out(v, at, xa);
    this.pending = { v: loop, at };
    clearTimeout(this._segTimer);
    this._segTimer = setTimeout(() => { if (this.pending && this.pending.v === loop) { this.voice = loop; this.state = detent; this.seg = null; this.pending = null; this.a.emit('thrust', { state: detent }); } }, (at - t + xa) * 1000);
  }
}

export const CLICKS = CLICK_TYPES;
