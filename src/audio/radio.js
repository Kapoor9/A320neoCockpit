// VHF radio chatter: Delhi Ground (121.800) and Delhi Tower (118.700).
// The exchanges are generated offline (tools/audio/atc: random ICAO phraseology spoken by neural voices, every crew
// with a voice of its own) and stored clean. The radio sound is made here, new for every transmission: carrier
// hiss and squelch, band-limited and slightly overdriven voice, signal strength, a touch of fading on weak
// transmissions, a squelch tail at the end - so even the same words never come out the same way.
// Each station runs on its own timeline whether or not you listen (tune in and you may land mid-exchange).
// Exchanges are dealt from a shuffled deck that is remembered between visits: nothing repeats until a pool is used up.

const DIR = new URL('../../public/sounds/atc/', import.meta.url).href;
export const STATIONS = { '121.8': 'ground', '118.7': 'tower' };   // frequency (MHz, as the RMP shows it) -> position
const rnd = (a, b) => a + Math.random() * (b - a);

export class RadioChatter {
  constructor(ctx, out) {
    this.ctx = ctx; this.flow = Math.random() < 0.5 ? 'west' : 'east';   // runway direction for this session
    this.bus = ctx.createGain(); this.bus.gain.value = 1.5;
    // cockpit loudspeaker: small cone, a little boxy
    const spk = ctx.createBiquadFilter(); spk.type = 'peaking'; spk.frequency.value = 950; spk.Q.value = 0.9; spk.gain.value = 2.5;
    this.bus.connect(spk).connect(out);
    this.stations = {}; this.started = false;
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

  async start() {
    this.started = true;
    try {
      const man = await (await fetch(DIR + 'atc.json')).json();
      const flows = [...new Set(Object.keys(man.pools).map((k) => k.split('-')[0]))];
      if (!flows.includes(this.flow)) this.flow = flows[Math.floor(Math.random() * flows.length)];
      await Promise.all(['ground', 'tower'].map(async (pos) => {
        const key = this.flow + '-' + pos, pool = man.pools[key]; if (!pool) return;
        const blob = await (await fetch(DIR + pool.file)).arrayBuffer();
        const out = this.ctx.createGain(); out.gain.value = 0; out.connect(this.bus);
        const st = this.stations[pos] = { key, pool, blob, out, g: 0, deck: this.deck(key, pool.exchanges.length) };
        setTimeout(() => this.run(st), rnd(1200, 4500));
      }));
    } catch (e) { console.warn('radio', e); }
  }

  deck(key, n) {
    let used = [];
    try { used = JSON.parse(localStorage.getItem('a320.atc.' + key) || '[]'); } catch { /* storage unavailable */ }
    let left = [...Array(n).keys()].filter((i) => !used.includes(i));
    if (!left.length) { used = []; left = [...Array(n).keys()]; }
    for (let i = left.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [left[i], left[j]] = [left[j], left[i]]; }
    return { left, used };
  }
  draw(st) {
    const d = st.deck; if (!d.left.length) st.deck = this.deck(st.key, st.pool.exchanges.length);
    const i = st.deck.left.pop(); st.deck.used.push(i);
    try { localStorage.setItem('a320.atc.' + st.key, JSON.stringify(st.deck.used)); } catch { /* storage unavailable */ }
    return st.pool.exchanges[i];
  }

  async run(st) {
    for (;;) {
      try {
        const ex = this.draw(st);
        // the pilot's radio for the whole exchange: near / far, clean / scratchy
        const crew = { strength: Math.random() < 0.25 ? rnd(0.35, 0.65) : rnd(0.7, 1), rate: rnd(0.97, 1.035) };
        const atc = { strength: rnd(0.85, 1), rate: rnd(0.985, 1.015) };
        for (let i = 0; i < ex.lines.length; i++) {
          const L = ex.lines[i];
          const buf = await this.ctx.decodeAudioData(st.blob.slice(L.off, L.off + L.len));
          const dur = await this.transmit(st, buf, L.who === 'atc' ? atc : crew);
          await wait(dur * 1000 + (i < ex.lines.length - 1 ? rnd(350, 1500) : 0));
        }
      } catch (e) { console.warn('radio', e); }
      // frequency quiet time: often a short pause, sometimes long
      await wait(Math.random() < 0.3 ? rnd(1500, 5000) : rnd(7000, 32000));
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
    return Promise.resolve(end - c.currentTime);
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function curve(k) {
  const a = new Float32Array(1024);
  for (let i = 0; i < a.length; i++) { const x = (i / 511.5) - 1; a[i] = Math.tanh(k * x) / Math.tanh(k); }
  return a;
}
