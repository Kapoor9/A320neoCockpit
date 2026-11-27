// You on the radio: hold SPACE to transmit on the frequency your radio is tuned to (VHF 1 by default, VHF 2 if the
// captain's ACP has TRANSMIT VHF 2 selected), release to stop. Your call is heard in the browser (speech recognition
// in a worker, src/audio/sttWorker.js), understood by the controller (src/audio/atcBrain.js) and answered in that
// station's voice over the radio. While you and the controller talk, the other traffic on that frequency waits, and
// it carries on ~1.5 s after the exchange. If the microphone cannot be used, SPACE opens a box to type the call.
import { AtcBrain } from './atcBrain.js';
import { STATIONS, voiceState } from './radio.js';

const ORT = new URL('../../vendor/tts/ort.wasm.min.mjs', import.meta.url).href;
const STT = new URL('../../vendor/stt/', import.meta.url).href;
const rnd = (a, b) => a + Math.random() * (b - a), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const QUIET_AFTER = 1500;   // ms of quiet on the frequency after the controller's answer before other traffic resumes

const CSS = `
#atc-hud{position:fixed;left:12px;bottom:70px;z-index:5;max-width:min(520px,calc(100vw - 24px));font:12px/1.4 "B612",Arial,sans-serif;color:#e4e6e1;pointer-events:none}
#atc-hud .bar{display:inline-flex;gap:8px;align-items:center;background:rgba(18,21,24,.82);border:1px solid #3a4248;border-radius:4px;padding:4px 8px}
#atc-hud .tx{display:none;color:#ff5a4f;font-weight:700}#atc-hud.on .tx{display:inline}
#atc-hud .cs{color:#7fd3ff}#atc-hud .lines{margin-top:4px}
#atc-hud .lines div{background:rgba(18,21,24,.75);border-radius:3px;padding:3px 8px;margin-top:3px;transition:opacity .6s}
#atc-hud .you b{color:#ffd76a}#atc-hud .atc b{color:#8be28b}
#atc-type{position:fixed;left:12px;bottom:110px;z-index:7;display:none;width:min(460px,calc(100vw - 24px));font:13px "B612",Arial;padding:8px;border-radius:4px;border:1px solid #3a4248;background:#121518;color:#e4e6e1}
`;

export class AtcPilot {
  constructor(sim, systems) {
    this.sim = sim; this.sys = systems; this.jobs = new Map(); this.seq = 0; this.busy = false;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.hud = document.createElement('div'); this.hud.id = 'atc-hud';
    this.hud.innerHTML = '<div class="bar"><span class="tx">● TX</span><span class="fq"></span><span class="cs"></span></div><div class="lines"></div>';
    document.body.appendChild(this.hud);
    this.box = document.createElement('input'); this.box.id = 'atc-type'; this.box.placeholder = 'Type your radio call, Enter to send (no microphone)'; document.body.appendChild(this.box);
    this.box.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const t = this.box.value.trim(); this.box.value = ''; this.box.style.display = 'none'; this.box.blur(); if (t) this.call(t, this.txStation()); } else if (e.key === 'Escape') { this.box.style.display = 'none'; this.box.blur(); } e.stopPropagation(); });
    window.addEventListener('keydown', (e) => this.key(e, true), { capture: true });
    window.addEventListener('keyup', (e) => this.key(e, false), { capture: true });
    window.addEventListener('radio-voice-ready', () => this.loadEars(), { once: true });   // speech recognition loads after the voices
    setTimeout(() => this.loadEars(), 15000);   // ...or 15 s after page open in any case
    setInterval(() => { this.tick(); if (!this.tx) this.show(); }, 500);
  }
  get radio() { return this.sys.sound?.radio; }
  get brain() { if (!this.radio) return null; this.b ??= new AtcBrain(this.radio.gen); return this.b; }
  newFlight() { this.b?.reset(); this.show(); }

  // ---------------------------------------------------------------- speech recognition worker
  loadEars() {
    if (this.ears) return;
    try {
      this.ears = new Worker(new URL('./sttWorker.js', import.meta.url), { type: 'module' });
      this.earsPct = 0; this.ears.onmessage = (e) => { const m = e.data; if (m.type === 'ready') { this.earsReady = true; this.show(); return; } if (m.type === 'progress') { this.earsPct = m.pct; return; } if (m.type === 'error' && !m.id) { this.earsFailed = m.msg; console.warn('radio ears', m.msg); return; } const j = this.jobs.get(m.id); if (!j) { if (m.type === 'error') console.warn('radio ears', m.msg); return; } this.jobs.delete(m.id); j(m.type === 'text' ? m.text : ''); };
      this.ears.postMessage({ type: 'init', ort: ORT, base: STT });
    } catch (e) { console.warn('radio ears', e); }
  }
  hear(pcm) {
    this.loadEars(); const id = ++this.seq;
    const job = new Promise((r) => { this.jobs.set(id, r); this.ears.postMessage({ type: 'stt', id, pcm }, [pcm.buffer]); });
    return Promise.race([job, wait(this.earsReady ? 20000 : 90000).then(() => { this.jobs.delete(id); return ''; })]);   // never wait for ever
  }

  // ---------------------------------------------------------------- which station hears you
  txStation() {
    const S = this.sys.s, E = S.elec; const vhf2 = this.sim.val('acpPed.txVHF 2');
    const ch = vhf2 ? { pw: E.dc2, f: S.rmp?.[1]?.freq.VHF2[0], name: 'VHF 2' } : { pw: E.dcEss, f: S.rmp?.[0]?.freq.VHF1[0], name: 'VHF 1' };
    return { ...ch, pos: ch.pw ? STATIONS[String(parseFloat(ch.f))] : null };
  }
  ctx() {
    const S = this.sys.s, run = (S.eng || []).filter((e) => e.running).length;
    const tla = Math.max(this.sim.val('thrust.lever1') ?? 0, this.sim.val('thrust.lever2') ?? 0);
    return { engines: run, thrustTO: run > 0 && tla >= 33 };
  }

  // ---------------------------------------------------------------- push to talk
  key(e, down) {
    if (e.code !== 'Space' || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable) return;
    e.preventDefault(); e.stopPropagation();   // Space never scrolls the page or presses a focused button
    if (down && !e.repeat) this.pttDown(); else if (!down) this.pttUp();
  }
  async pttDown() {
    if (this.tx) return;
    const ch = this.txStation(); this.show(ch);
    if (!ch.pw) { this.say('note', 'Radio not powered: switch the batteries on.'); return; }
    if (this.micFailed) { this.box.style.display = 'block'; this.box.focus(); return; }
    this.sys.sound?.init?.();
    const ok = await this.ensureMic(); if (!ok) { this.micFailed = true; this.say('note', 'Microphone not available: type your call instead (Space opens the box).'); this.box.style.display = 'block'; this.box.focus(); return; }
    if (this.earsFailed) { this.say('note', 'Speech recognition could not load here; type your call instead.'); this.micFailed = true; this.box.style.display = 'block'; this.box.focus(); return; }
    if (!this.earsReady) this.say('note', `Speech recognition still loading (${this.earsPct || 0}%), first visit only. Your call will be answered once it is ready.`);
    this.tx = { ch, chunks: [], t: performance.now() }; this.hud.classList.add('on');
    if (ch.pos) this.radio?.holdFor(ch.pos, 30000);   // frequency busy while you talk (capped)
  }
  async pttUp() {
    const tx = this.tx; if (!tx) return;
    await wait(180);   // the last syllable
    this.tx = null; this.hud.classList.remove('on');
    const pcm = await this.to16k(tx.chunks);
    let e = 0; for (let i = 0; i < pcm.length; i++) e += pcm[i] * pcm[i];
    if (pcm.length < 16000 * 0.35 || Math.sqrt(e / Math.max(1, pcm.length)) < 0.004) { this.release(tx.ch.pos, 400); return; }
    if (!this.earsReady) this.say('note', 'Speech recognition still loading…');
    const text = (await this.hear(pcm).catch(() => '')).replace(/\[[^\]]*\]|\([^)]*\)/g, '').trim();
    this.call(text, tx.ch);
  }

  // what you said -> the controller's answer, spoken on that station
  async call(text, ch) {
    if (text) this.say('you', text);
    const pos = ch.pos, brain = this.brain;
    if (!pos || !brain || !text) { if (!text) this.say('note', 'Nothing heard: hold SPACE while you speak.'); this.release(pos, 400); return; }   // nobody on that frequency: silence, as in real life
    this.radio.holdFor(pos, 30000);
    const r = brain.handle(text, pos, this.ctx()); this.show(ch);
    if (!r?.say) { this.release(pos, QUIET_AFTER); return; }
    await wait(rnd(600, 1600));   // the controller thinking / keying the mic
    this.busy = true; this.say('atc', r.say);
    try { await this.radio.atcSay(pos, r.say); } finally { this.busy = false; this.release(pos, QUIET_AFTER); }
  }
  release(pos, ms) { if (pos) this.radio?.holdFor(pos, ms); }

  // controller-initiated calls (line up, take-off clearance, handoffs, "stop!")
  async tick() {
    const brain = this.radio && this.brain; if (!brain || this.tx || this.busy) return;
    const p = brain.tick(this.ctx()); if (!p) return;
    this.busy = true; this.radio.holdFor(p.stn, 30000); await wait(rnd(300, 900));
    if (this.txStation().pos === p.stn) this.say('atc', p.say);
    try { await this.radio.atcSay(p.stn, p.say); } finally { this.busy = false; this.release(p.stn, QUIET_AFTER); }
  }

  // ---------------------------------------------------------------- microphone
  async ensureMic() {
    if (this.mic) return true;
    const ctx = this.sys.sound?.audio?.ctx; if (!ctx || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      const src = ctx.createMediaStreamSource(s), sp = ctx.createScriptProcessor(4096, 1, 1), z = ctx.createGain(); z.gain.value = 0;
      sp.onaudioprocess = (e) => { if (this.tx) this.tx.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      src.connect(sp); sp.connect(z); z.connect(ctx.destination);
      this.mic = { s, sr: ctx.sampleRate }; return true;
    } catch (e) { console.warn('microphone', e); return false; }
  }
  async to16k(chunks) {
    const n = chunks.reduce((s, c) => s + c.length, 0); if (!n) return new Float32Array(0);
    const sr = this.mic.sr, buf = new AudioBuffer({ length: n, sampleRate: sr, numberOfChannels: 1 }); let o = 0; const d = buf.getChannelData(0);
    for (const c of chunks) { d.set(c, o); o += c.length; }
    const off = new OfflineAudioContext(1, Math.ceil((n * 16000) / sr), 16000), s = off.createBufferSource(); s.buffer = buf; s.connect(off.destination); s.start();
    return (await off.startRendering()).getChannelData(0).slice();
  }

  // ---------------------------------------------------------------- on-screen strip: frequency, callsign, last calls
  show(ch = this.txStation()) {
    const name = { ground: 'Delhi Ground', tower: 'Delhi Tower' }[ch.pos] || '';
    this.hud.querySelector('.fq').textContent = `${ch.name} ${ch.f || ''}${name ? ' · ' + name : ''}`;
    this.hud.querySelector('.cs').textContent = this.b?.callsign ? '· ' + this.b.callsign : '· SPACE to talk';
  }
  say(who, text) {
    const lines = this.hud.querySelector('.lines'), d = document.createElement('div'); d.className = who;
    const b = document.createElement('b'); b.textContent = who === 'you' ? 'YOU  ' : who === 'atc' ? 'ATC  ' : ''; d.append(b, document.createTextNode(text));
    lines.appendChild(d); while (lines.children.length > 3) lines.firstChild.remove();
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 700); }, 12000);
  }
}
