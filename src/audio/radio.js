// VHF radio chatter: Delhi Ground (121.800) and Delhi Tower (118.700), generated live in the browser.
// Every exchange is made up on the spot (src/audio/atcPhrases.js: random ICAO phraseology) and spoken by a neural
// voice running in a worker thread (src/audio/ttsWorker.js: Kokoro-82M on onnxruntime-web) - no recordings, no
// end to it, and every crew has a voice of its own. The radio sound is added here, new for every transmission:
// carrier hiss and squelch, band-limited and overdriven voice, signal strength, fading on weak transmissions, a
// squelch tail - not every call comes through clean, as on a real frequency.
// The next exchange is generated while the current one plays; nothing is generated for a station nobody listens to.
import { AtcGen, crewVoice, controllerVoice } from './atcPhrases.js';

const TTS = new URL('../../vendor/tts/', import.meta.url).href;
export const STATIONS = { '121.8': 'ground', '118.7': 'tower' };   // frequency (MHz, as the RMP shows it) -> position
const rnd = (a, b) => a + Math.random() * (b - a);

export class RadioChatter {
  constructor(ctx, out) {
    this.ctx = ctx; this.gen = new AtcGen(Math.random() < 0.5 ? 'west' : 'east');   // runway direction for this session
    this.bus = ctx.createGain(); this.bus.gain.value = 1.5;
    // cockpit loudspeaker: small cone, a little boxy
    const spk = ctx.createBiquadFilter(); spk.type = 'peaking'; spk.frequency.value = 950; spk.Q.value = 0.9; spk.gain.value = 2.5;
    this.bus.connect(spk).connect(out);
    this.stations = {}; this.started = false; this.jobs = new Map(); this.seq = 0;
    const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = n;
  }

  // gains: { ground: 0..1, tower: 0..1 } - what the crew currently hears of each station
  set(gains) {
    if (!this.started && Object.values(gains).some((g) => g > 0)) this.start();
    for (const [pos, st] of Object.entries(this.stations)) {
      const g = gains[pos] ?? 0; if (Math.abs(g - st.g) < 0.005) continue;
      st.g = g; st.out.gain.setTargetAtTime(g, this.ctx.currentTime, 0.03);
    }
  }

  start() {
    this.started = true;
    // one voice worker, two on machines with plenty of cores (lines of an exchange are then spoken in parallel)
    const n = (navigator.hardwareConcurrency || 2) >= 6 ? 2 : 1; this.workers = [];
    try {
      for (let i = 0; i < n; i++) {
        const w = new Worker(new URL('./ttsWorker.js', import.meta.url), { type: 'module' }); w.load = 0;
        w.onmessage = (e) => {
          const m = e.data;
          if (m.type === 'ready') { this.ready = true; return; }
          const job = this.jobs.get(m.id); if (job) { this.jobs.delete(m.id); w.load--; }
          if (m.type === 'error') { console.warn('radio voice', m.msg); job?.resolve(null); return; }
          if (!job) return;
          const b = this.ctx.createBuffer(1, m.pcm.length, 24000); b.copyToChannel(m.pcm, 0); job.resolve(b);
        };
        w.postMessage({ type: 'init', base: TTS }); this.workers.push(w);
      }
    } catch (e) { console.warn('radio', e); if (!this.workers.length) return; }
    for (const pos of ['ground', 'tower']) {
      const out = this.ctx.createGain(); out.gain.value = 0; out.connect(this.bus);
      const st = this.stations[pos] = { pos, out, g: 0, atc: controllerVoice() };
      this.run(st);
    }
  }

  say(text, v) {
    const id = ++this.seq;
    const w = this.workers.reduce((a, b) => (b.load < a.load ? b : a)); w.load++;
    return new Promise((resolve) => { this.jobs.set(id, { resolve }); w.postMessage({ type: 'say', id, text, ...v }); });
  }
  // a new exchange: the lines go to the voice worker at once and are spoken in order
  prepare(st) {
    const ex = st.pos === 'ground' ? this.gen.ground() : this.gen.tower(); const crew = crewVoice(ex.cs.grp);
    const radio = { atc: { strength: rnd(0.8, 1), rate: rnd(0.985, 1.015) }, plt: { strength: Math.random() < 0.3 ? rnd(0.3, 0.65) : rnd(0.68, 1), rate: rnd(0.97, 1.035) } };
    return ex.lines.map(([who, text]) => ({ who, text, radio: radio[who], buf: this.say(text, who === 'atc' ? st.atc : crew) }));
  }

  async run(st) {
    let next = null;
    for (;;) {
      if (st.g <= 0 || !this.ready) { next = null; await wait(800); continue; }   // nobody listening: nothing generated
      const ex = next || this.prepare(st); next = null; let first = true;
      try {
        for (let i = 0; i < ex.length; i++) {
          const L = ex[i], buf = await L.buf; if (!buf) continue;
          if (first) { first = false; if (st.g > 0) next = this.prepare(st); }   // generate the next exchange while this one plays
          const dur = this.transmit(st, buf, L.radio);
          await wait(dur * 1000 + (i < ex.length - 1 ? rnd(350, 1500) : 0));
        }
      } catch (e) { console.warn('radio', e); }
      // frequency quiet time: often a short pause, sometimes long
      await wait(Math.random() < 0.3 ? rnd(1500, 5000) : rnd(6000, 28000));
    }
  }

  // one transmission: carrier opens (squelch click + hiss), voice through the radio, carrier drops (squelch tail)
  transmit(st, buf, who) {
    const c = this.ctx, t0 = c.currentTime + 0.05, s = who.strength;
    const lead = rnd(0.08, 0.22), rate = who.rate, voiceDur = buf.duration / rate, tailAt = t0 + lead + voiceDur + rnd(0.04, 0.14);
    const tailLen = rnd(0.1, 0.22), end = tailAt + tailLen;
    const nodes = [];
    const N = (n) => { nodes.push(n); return n; };
    const filt = (type, f, q, g) => { const b = N(c.createBiquadFilter()); b.type = type; b.frequency.value = f; b.Q.value = q; if (g != null) b.gain.value = g; return b; };
    // voice: VHF AM audio is roughly 300 Hz - 3 kHz, compressed and a little driven
    const src = N(c.createBufferSource()); src.buffer = buf; src.playbackRate.value = rate;
    const hp = filt('highpass', rnd(300, 460), 0.8), lp = filt('lowpass', rnd(2500, 3300), 0.9), mid = filt('peaking', rnd(1200, 2100), 1, rnd(3, 8));
    const sh = N(c.createWaveShaper()); sh.curve = curve(rnd(1.6, 3.4) + (1 - s) * 2.5); sh.oversample = '2x';
    const post = filt('lowpass', rnd(3200, 3800), 0.7);
    const vg = N(c.createGain()); vg.gain.value = 0.55 * (0.55 + 0.45 * s);
    src.connect(hp).connect(lp).connect(mid).connect(sh).connect(post).connect(vg).connect(st.out);
    // weak signals fade a little
    if (s < 0.7) { const o = N(c.createOscillator()), od = N(c.createGain()); o.frequency.value = rnd(3, 8); od.gain.value = (0.7 - s) * 0.5; o.connect(od).connect(vg.gain); o.start(t0); o.stop(end); }
    // carrier hiss under the voice, louder on weak signals; squelch click at the start, noise burst at the end
    const ns = N(c.createBufferSource()); ns.buffer = this.noise; ns.loop = true; ns.loopStart = rnd(0, 1);
    const nh = filt('highpass', 380, 0.7), nl = filt('lowpass', rnd(2600, 3400), 0.7), ng = N(c.createGain());
    const hiss = (0.012 + (1 - s) * 0.05) * rnd(0.7, 1.3), g = ng.gain;
    g.setValueAtTime(0, t0); g.linearRampToValueAtTime(hiss * 6, t0 + 0.004); g.linearRampToValueAtTime(hiss, t0 + 0.03);
    g.setValueAtTime(hiss, tailAt); g.linearRampToValueAtTime(hiss * rnd(5, 9), tailAt + 0.012);
    g.setValueAtTime(hiss * rnd(4, 7), end - 0.02); g.linearRampToValueAtTime(0, end);
    ns.connect(nh).connect(nl).connect(ng).connect(st.out);
    ns.start(t0, rnd(0, 1.5)); ns.stop(end + 0.01); src.start(t0 + lead);
    setTimeout(() => nodes.forEach((n) => { try { n.disconnect(); } catch { /* already gone */ } }), (end - c.currentTime + 0.3) * 1000);
    return end - c.currentTime;
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function curve(k) {
  const a = new Float32Array(1024);
  for (let i = 0; i < a.length; i++) { const x = (i / 511.5) - 1; a[i] = Math.tanh(k * x) / Math.tanh(k); }
  return a;
}
