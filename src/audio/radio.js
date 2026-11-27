// VHF radio chatter: Delhi Ground (121.800) and Delhi Tower (118.700), generated live in the browser.
// Every exchange is made up on the spot (src/audio/atcPhrases.js: random ICAO phraseology) and spoken by a neural
// voice running in a worker thread (src/audio/ttsWorker.js: Kokoro-82M on onnxruntime-web) - no recordings, no
// end to it, and every crew has a voice of its own. The radio sound is added here, new for every transmission:
// carrier hiss and squelch, band-limited and overdriven voice, signal strength, fading on weak transmissions, a
// squelch tail - not every call comes through clean, as on a real frequency.
// The next exchange is generated while the current one plays; nothing is generated for a station nobody listens to.
import { AtcGen, crewVoice, controllerVoice } from './atcPhrases.js';

const TTS = new URL('../../vendor/tts/', import.meta.url).href;
const STARTER = new URL('../../public/sounds/atc_starter.json', import.meta.url).href;
export const STATIONS = { '121.8': 'ground', '118.7': 'tower' };   // frequency (MHz, as the RMP shows it) -> position
const rnd = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ the voice: worker threads, loaded at page open
const pool = { workers: [], jobs: new Map(), seq: 0, ready: false, pct: 0 };
export const voiceState = () => (pool.ready ? 'ready' : pool.workers.length ? 'loading ' + pool.pct + '%' : 'off');
export function preloadVoice() {
  if (pool.workers.length) return;
  const n = (navigator.hardwareConcurrency || 2) >= 6 ? 2 : 1;   // two on machines with plenty of cores
  try {
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./ttsWorker.js', import.meta.url), { type: 'module' }); w.load = 0;
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'ready') { pool.ready = true; return; }
        if (m.type === 'progress') { pool.pct = Math.max(pool.pct, m.pct); return; }
        const job = pool.jobs.get(m.id); if (job) { pool.jobs.delete(m.id); w.load--; }
        if (m.type === 'error') { console.warn('radio voice', m.msg); job?.resolve(null); return; }
        job?.resolve(m.pcm);
      };
      w.postMessage({ type: 'init', base: TTS }); pool.workers.push(w);
    }
  } catch (e) { console.warn('radio voice', e); }
}
function speak(text, v, priority = false) {
  if (!pool.workers.length) return Promise.resolve(null);
  const id = ++pool.seq, w = pool.workers.reduce((a, b) => (b.load < a.load ? b : a)); w.load++;
  return new Promise((resolve) => { pool.jobs.set(id, { resolve }); w.postMessage({ type: 'say', id, text, priority, ...v }); });
}

export const voiceReady = () => pool.ready;
export class RadioChatter {
  constructor(ctx, out) {
    this.ctx = ctx; this.flow = Math.random() < 0.5 ? 'west' : 'east'; this.gen = new AtcGen(this.flow);   // runway direction for this session
    this.bus = ctx.createGain(); this.bus.gain.value = 1.5;
    // cockpit loudspeaker: small cone, a little boxy
    const spk = ctx.createBiquadFilter(); spk.type = 'peaking'; spk.frequency.value = 950; spk.Q.value = 0.9; spk.gain.value = 2.5;
    this.bus.connect(spk).connect(out);
    this.stations = {}; this.started = false;
    const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = n;
    preloadVoice();
    // starter exchanges (same voice model, made in advance): heard only until the live voice is ready
    this.starter = fetch(STARTER).then((r) => r.json()).catch(() => ({}));
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
    for (const pos of ['ground', 'tower']) {
      const out = this.ctx.createGain(); out.gain.value = 0; out.connect(this.bus);
      const st = this.stations[pos] = { pos, out, g: 0, atc: controllerVoice(), q: [], used: new Set(), hold: 0 };
      this.run(st);
    }
  }

  // the frequency is busy with the pilot's own exchange: background traffic waits until hold time has passed
  async clear(st) { while (Date.now() < st.hold) await wait(200); }
  holdFor(pos, ms) { this.start0(); const st = this.stations[pos]; if (st) st.hold = Date.now() + Math.min(ms, 30000); }   // capped: a stuck call can never silence the frequency
  start0() { if (!this.started) this.start(); }
  // the controller answers the pilot: own voice of that station, ahead of everything else in the voice queue
  async atcSay(pos, text) {
    this.start0(); const st = this.stations[pos]; if (!st || !pool.ready) return 0;   // voice not loaded yet: subtitles only
    st.hold = Date.now() + 30000;   // never held for ever: worst case the frequency frees itself
    const pcm = await Promise.race([speak(text, st.atc, true), wait(25000).then(() => null)]); if (!pcm) return 0;
    const dur = this.transmit(st, this.toBuf(pcm), { strength: rnd(0.85, 1), rate: rnd(0.99, 1.01) });
    await wait(dur * 1000); return dur;
  }

  toBuf(pcm) { const b = this.ctx.createBuffer(1, pcm.length, 24000); b.copyToChannel(pcm, 0); return b; }
  // a new live exchange: the lines go to the voice worker at once and are spoken in order
  live(st) {
    const ex = st.pos === 'ground' ? this.gen.ground() : this.gen.tower(), crew = crewVoice(ex.cs.grp);
    return ex.lines.map(([who, text]) => ({ who, buf: speak(text, who === 'atc' ? st.atc : crew).then((p) => p && this.toBuf(p)) }));
  }
  async canned(st) {
    const list = (await this.starter)[this.flow + '-' + st.pos] || [];
    const left = list.map((_, i) => i).filter((i) => !st.used.has(i)); if (!left.length) return null;
    const i = left[Math.floor(Math.random() * left.length)]; st.used.add(i);
    return list[i].map((L) => ({ who: L.who, buf: this.ctx.decodeAudioData(Uint8Array.from(atob(L.mp3), (ch) => ch.charCodeAt(0)).buffer).catch(() => null) }));
  }
  radioFor() { return { atc: { strength: rnd(0.8, 1), rate: rnd(0.985, 1.015) }, plt: { strength: Math.random() < 0.3 ? rnd(0.3, 0.65) : rnd(0.68, 1), rate: rnd(0.97, 1.035) } }; }

  async run(st) {
    for (;;) {
      if (st.g <= 0) { st.q.length = 0; await wait(600); continue; }   // nobody listening: nothing generated
      // keep two live exchanges in preparation while the voice is up; until then the starter set talks
      if (pool.ready) while (st.q.length < 2) st.q.push(this.live(st));
      await this.clear(st);
      const ex = st.q.shift() || await this.canned(st);
      if (!ex) { await wait(500); continue; }
      const radio = this.radioFor();
      try {
        for (let i = 0; i < ex.length; i++) {
          const buf = await ex[i].buf; if (!buf) continue;
          await this.clear(st);   // the pilot keyed the mic: the next line waits until the frequency is free again
          const dur = this.transmit(st, buf, radio[ex[i].who]);
          await wait(dur * 1000 + (i < ex.length - 1 ? rnd(250, 1000) : 0));
        }
      } catch (e) { console.warn('radio', e); }
      // a busy frequency: mostly short pauses, now and then a longer one
      await wait(Math.random() < 0.45 ? rnd(800, 3000) : rnd(3000, 11000));
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
