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
const pool = { workers: [], reply: null, jobs: new Map(), seq: 0, ready: false, replyReady: false, pct: 0 };
export const voiceState = () => (pool.ready ? 'ready' : pool.workers.length ? 'loading ' + pool.pct + '%' : 'off');
// cores: the reply voice gets about half the machine (it must be quick), the background chatter a quarter
const CORES = navigator.hardwareConcurrency || 2;
let singleCore = false;
try { singleCore = localStorage.getItem('a320.radio.oneCore') === '1'; } catch { /* storage unavailable */ }
function makeWorker(onReady, threads) {
  const w = new Worker(new URL('./ttsWorker.js', import.meta.url), { type: 'module' }); w.load = 0;
  w.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'ready') { onReady(w); return; }
    if (m.type === 'progress') { pool.pct = Math.max(pool.pct, m.pct); return; }
    if (m.type === 'step') return;
    if (m.type === 'error' && m.msg === 'warmup-stalled') {   // this browser stalls on several cores: restart on one, and remember
      console.warn('radio voice: multi-core stalled, using one core'); singleCore = true;
      try { localStorage.setItem('a320.radio.oneCore', '1'); } catch { /* storage unavailable */ }
      w.terminate(); const n = makeWorker(onReady, 1); w.replaced = n; w.onReplaced?.(n); return;
    }
    const job = pool.jobs.get(m.id); if (job) { pool.jobs.delete(m.id); w.load--; }
    if (m.type === 'error') { if (m.msg !== 'cancelled') console.warn('radio voice', m.msg); job?.resolve(null); return; }
    job?.resolve(m.pcm);
  };
  w.postMessage({ type: 'init', base: TTS, threads: singleCore ? 1 : threads }); return w;
}
// The models load one after another (chatter voice, then reply voice, then speech recognition), so loading never
// takes over the whole computer and the cockpit's own sounds stay clean.
export function preloadVoice() {
  if (pool.workers.length) return;
  try {
    const chatter = makeWorker((w) => {
      pool.workers[0] = w; pool.ready = true;
      if (!pool.reply) pool.reply = makeWorker((r) => { pool.reply = r; pool.replyReady = true; window.dispatchEvent(new Event('radio-voice-ready')); }, Math.max(1, Math.min(6, Math.floor(CORES / 2))));
    }, Math.max(1, Math.floor(CORES / 3)));
    pool.workers.push(chatter);
  } catch (e) { console.warn('radio voice', e); }
}
export const replyVoiceReady = () => pool.replyReady;
// drop queued background lines (not the one being spoken): the pilot's exchange goes first
function cancelBackground() { pool.workers.forEach((w) => w.postMessage({ type: 'cancel', below: 1 })); }
// prio 0: background chatter (chatter worker); 1: replies prepared in advance, 2: reply needed now (reply worker)
function speakJob(text, v, prio = 0) {
  const w = prio > 0 && pool.replyReady ? pool.reply : pool.workers.length ? pool.workers.reduce((a, b) => (b.load < a.load ? b : a)) : null;
  if (!w) return { id: 0, w: null, p: Promise.resolve(null) };
  const id = ++pool.seq; w.load++;
  const p = new Promise((resolve) => { pool.jobs.set(id, { resolve }); w.postMessage({ type: 'say', id, text, priority: prio, ...v }); });
  return { id, w, p };
}
const speak = (text, v, prio = 0) => speakJob(text, v, prio).p;
const within = (p, ms) => Promise.race([p, wait(ms).then(() => null)]);

// A reply in pieces: the callsign alone first (voiced once per flight, so a reply always starts at once), then the
// rest at its commas, short enough that the next piece is ready before the one playing ends.
export function replyPieces(text) {
  const seg = text.split(/(?<=,)\s+/), out = [seg[0]];
  for (const w of seg.slice(1)) { const last = out[out.length - 1]; if (out.length > 1 && (last.split(' ').length < 3 || w.split(' ').length < 2)) out[out.length - 1] = last + ' ' + w; else out.push(w); }
  return out;
}

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
  holdFor(pos, ms) { this.start0(); const st = this.stations[pos]; if (st) { st.hold = Date.now() + Math.min(ms, 30000); if (ms > 2000) { st.q.length = 0; cancelBackground(); } } }   // capped: a stuck call can never silence the frequency
  start0() { if (!this.started) this.start(); }
  // ------------------------------------------------------------ the controller's own voice: prepared pieces
  pieceKey(st, text) { return st.pos + '|' + text; }
  // voice in advance the pieces of replies the pilot may need next (most likely first); already voiced ones are skipped
  prewarm(pos, texts, skipFirst = false, fresh = false) {
    this.start0(); const st = this.stations[pos]; if (!st || !pool.replyReady) return;
    st.cache ??= new Map(); st.coming ??= new Map();
    if (fresh) pool.reply.postMessage({ type: 'cancel', below: 2 });   // the flight moved on: older guesses are dropped
    for (const text of texts) {
      replyPieces(text).forEach((piece, i) => {
        if (skipFirst && i === 0) return;
        const k = this.pieceKey(st, piece); if (st.cache.has(k) || st.coming.has(k)) return;
        const job = speakJob(piece, st.atc, 1); st.coming.set(k, job);
        job.p.then((pcm) => { st.coming.delete(k); if (pcm) { st.cache.set(k, pcm); if (st.cache.size > 300) st.cache.delete(st.cache.keys().next().value); } });
      });
    }
  }
  // the controller answers: prepared pieces play at once, missing ones are voiced now at top priority while the earlier
  // ones play. Nothing can hang: a piece that does not come in time is skipped (its text is on screen anyway).
  async atcSay(pos, text) {
    this.start0(); const st = this.stations[pos]; if (!st) return 0;
    st.cache ??= new Map(); st.coming ??= new Map();
    const keep = () => { st.hold = Date.now() + 15000; };
    keep();
    for (let i = 0; !pool.ready && i < 120; i++) { keep(); await wait(500); }   // first visit: voice still loading
    if (!pool.ready) return 0;
    cancelBackground(); st.q.length = 0;
    const bump = new Map(), t0 = performance.now(), log = (this.timing = []);   // timing of the last reply, for testing
    const jobs = replyPieces(text).map((piece) => {
      const k = this.pieceKey(st, piece);
      if (st.cache.has(k)) { log.push('ready: ' + piece); return Promise.resolve(st.cache.get(k)); }
      const c = st.coming.get(k); if (c) { log.push('preparing: ' + piece); (bump.get(c.w) || bump.set(c.w, []).get(c.w)).push(c.id); return c.p; }
      log.push('new: ' + piece); const j = speakJob(piece, st.atc, 2); j.p.then((pcm) => { if (pcm) st.cache.set(k, pcm); }); return j.p;
    });
    for (const [w, ids] of bump) w?.postMessage({ type: 'bump', ids });
    const k = this.carrier(st, { strength: rnd(0.85, 1), rate: rnd(0.99, 1.01) });
    for (let i = 0; i < jobs.length; i++) { keep(); const pcm = await within(jobs[i], 25000); log[i] += pcm ? ` (${((performance.now() - t0) / 1000).toFixed(1)}s)` : ' (SKIPPED)'; if (pcm) k.voice(this.toBuf(pcm)); }
    const dur = k.end(); keep(); await wait(dur * 1000); return dur;
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
      await this.clear(st);
      if (pool.ready) while (st.q.length < 2) st.q.push(this.live(st));
      const ex = st.q.shift() || await this.canned(st);
      if (!ex) { await wait(500); continue; }
      const radio = this.radioFor();
      await within(Promise.all(ex.map((l) => l.buf)), 60000);   // whole exchange ready: no gaps between its lines
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

  // a carrier: opens with a squelch click and hiss, carries one or more pieces of voice, drops with a squelch tail.
  // Pieces can arrive while it is open (the controller's reply is spoken while the rest is still being generated).
  carrier(st, who) {
    const c = this.ctx, t0 = c.currentTime + 0.05, s = who.strength, nodes = [];
    const N = (n) => { nodes.push(n); return n; };
    const filt = (type, f, q, g) => { const b = N(c.createBiquadFilter()); b.type = type; b.frequency.value = f; b.Q.value = q; if (g != null) b.gain.value = g; return b; };
    // voice path: VHF AM audio is roughly 300 Hz - 3 kHz, compressed and a little driven
    const hp = filt('highpass', rnd(300, 460), 0.8), lp = filt('lowpass', rnd(2500, 3300), 0.9), mid = filt('peaking', rnd(1200, 2100), 1, rnd(3, 8));
    const sh = N(c.createWaveShaper()); sh.curve = curve(rnd(1.6, 3.4) + (1 - s) * 2.5); sh.oversample = '2x';
    const post = filt('lowpass', rnd(3200, 3800), 0.7), vg = N(c.createGain()); vg.gain.value = 0.55 * (0.55 + 0.45 * s);
    hp.connect(lp).connect(mid).connect(sh).connect(post).connect(vg).connect(st.out);
    let lfo = null;   // weak signals fade a little
    if (s < 0.7) { lfo = N(c.createOscillator()); const od = N(c.createGain()); lfo.frequency.value = rnd(3, 8); od.gain.value = (0.7 - s) * 0.5; lfo.connect(od).connect(vg.gain); lfo.start(t0); }
    // carrier hiss, louder on weak signals; squelch click at the start
    const ns = N(c.createBufferSource()); ns.buffer = this.noise; ns.loop = true;
    const nh = filt('highpass', 380, 0.7), nl = filt('lowpass', rnd(2600, 3400), 0.7), ng = N(c.createGain());
    const hiss = (0.012 + (1 - s) * 0.05) * rnd(0.7, 1.3), g = ng.gain;
    g.setValueAtTime(0, t0); g.linearRampToValueAtTime(hiss * 6, t0 + 0.004); g.linearRampToValueAtTime(hiss, t0 + 0.03);
    ns.connect(nh).connect(nl).connect(ng).connect(st.out); ns.start(t0, rnd(0, 1.5));
    let cursor = t0 + rnd(0.08, 0.22);
    return {
      voice: (buf) => {   // plays after whatever is already queued on this carrier
        cursor = Math.max(cursor, c.currentTime + 0.03);
        const src = N(c.createBufferSource()); src.buffer = buf; src.playbackRate.value = who.rate; src.connect(hp); src.start(cursor);
        cursor += buf.duration / who.rate + rnd(0.03, 0.1); return cursor;
      },
      end: () => {   // squelch tail, then everything is released
        const tailAt = Math.max(cursor, c.currentTime + 0.02) + rnd(0.02, 0.1), end = tailAt + rnd(0.1, 0.22);
        g.cancelScheduledValues(tailAt); g.setValueAtTime(hiss, tailAt); g.linearRampToValueAtTime(hiss * rnd(5, 9), tailAt + 0.012);
        g.setValueAtTime(hiss * rnd(4, 7), end - 0.02); g.linearRampToValueAtTime(0, end); ns.stop(end + 0.01); lfo?.stop(end);
        setTimeout(() => nodes.forEach((n) => { try { n.disconnect(); } catch { /* already gone */ } }), (end - c.currentTime + 0.3) * 1000);
        return end - c.currentTime;
      },
    };
  }
  // one complete transmission of a ready buffer; returns its length in seconds
  transmit(st, buf, who) { const k = this.carrier(st, who); k.voice(buf); return k.end(); }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function curve(k) {
  const a = new Float32Array(1024);
  for (let i = 0; i < a.length; i++) { const x = (i / 511.5) - 1; a[i] = Math.tanh(k * x) / Math.tanh(k); }
  return a;
}
