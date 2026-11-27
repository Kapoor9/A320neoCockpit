// Hears the pilot: Whisper tiny.en (int8 ONNX, from k2-fsa/sherpa-onnx) on onnxruntime-web, in its own worker
// thread, entirely in the browser. Log-mel front end and greedy decoding as in OpenAI Whisper.
// Messages in: {type:'init', ort, base} | {type:'stt', id, pcm (Float32Array, 16 kHz mono)}
// Messages out: {type:'ready'} | {type:'text', id, text} | {type:'error', id, msg}
let ort, cfg, enc, dec, mel, tokens;
const SR = 16000, NFFT = 400, HOP = 160, FRAMES = 3000, BINS = 201;
const queue = []; let busy = false;

async function bytes(url) {
  const s = (await (await fetch(url)).text()).trim();
  if (Uint8Array.fromBase64) return Uint8Array.fromBase64(s);
  const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u;
}
async function parts(base, name, n) {
  const ps = await Promise.all([...Array(n).keys()].map((i) => bytes(`${base}${name}.${i}.txt`)));
  const out = new Uint8Array(ps.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of ps) { out.set(p, o); o += p.length; } return out;
}
function idb(op, key, val) {   // same cache as the radio voice; failure just means no cache
  return new Promise((res) => {
    try {
      const rq = indexedDB.open('a320-radio-ears', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('f'); rq.onerror = () => res(null);
      rq.onsuccess = () => { try { const st = rq.result.transaction('f', op === 'get' ? 'readonly' : 'readwrite').objectStore('f'); const r = op === 'get' ? st.get(key) : st.put(val, key); r.onsuccess = () => res(op === 'get' ? r.result || null : true); r.onerror = () => res(null); } catch { res(null); } };
    } catch { res(null); }
  });
}
const f32 = (b64) => { const u = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); return new Float32Array(u.buffer); };

async function init(ortUrl, base) {
  ort = await import(ortUrl); ort.env.wasm.wasmPaths = new URL('.', ortUrl).href; ort.env.wasm.numThreads = 1;
  cfg = await (await fetch(base + 'whisper.json')).json();
  mel = f32(cfg.mel); tokens = cfg.tokens.map((t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0)));
  let e = await idb('get', 'enc'), d = await idb('get', 'dec'), emb = await idb('get', 'emb');
  if (!e || !d || !emb) {
    [e, d] = await Promise.all([parts(base, 'enc', cfg.enc), parts(base, 'dec', cfg.dec)]);
    const q = new Int8Array((await parts(base, 'embq', cfg.embQ)).buffer), s = f32(cfg.embS), D = cfg.embDim;
    const W = new Float32Array(cfg.embRows * D);   // the decoder's word table, back to float once
    for (let r = 0; r < cfg.embRows; r++) { const k = s[r]; for (let c = 0; c < D; c++) W[r * D + c] = q[r * D + c] * k; }
    emb = new Uint8Array(W.buffer); idb('put', 'enc', e); idb('put', 'dec', d); idb('put', 'emb', emb);
  }
  const opt = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
  enc = await ort.InferenceSession.create(e, opt);
  dec = await ort.InferenceSession.create(d, { ...opt, externalData: [{ path: 'emb.bin', data: emb }] });
  self.postMessage({ type: 'ready' }); pump();
}

// 80-bin log-mel of up to 30 s, as Whisper: hann 400 / hop 160, reflect padding, log10, 8 dB floor, scaled
const WIN = Float32Array.from({ length: NFFT }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / NFFT));
const COS = new Float32Array(BINS * NFFT), SIN = new Float32Array(BINS * NFFT);
for (let k = 0; k < BINS; k++) for (let n = 0; n < NFFT; n++) { const a = (2 * Math.PI * k * n) / NFFT; COS[k * NFFT + n] = Math.cos(a); SIN[k * NFFT + n] = Math.sin(a); }
function logMel(pcm) {
  const L = Math.min(pcm.length, SR * 30), P = new Float32Array(L + NFFT);
  for (let i = 0; i < L + NFFT; i++) { let j = i - NFFT / 2; if (j < 0) j = -j; if (j >= L) j = 2 * (L - 1) - j; P[i] = pcm[Math.max(0, Math.min(L - 1, j))] || 0; }
  const nAudio = Math.min(FRAMES, Math.floor(L / HOP)), out = new Float32Array(80 * FRAMES).fill(-10), fr = new Float32Array(NFFT), pw = new Float32Array(BINS);
  let max = -10;
  for (let t = 0; t < nAudio; t++) {
    for (let n = 0; n < NFFT; n++) fr[n] = P[t * HOP + n] * WIN[n];
    for (let k = 0; k < BINS; k++) { let re = 0, im = 0; const o = k * NFFT; for (let n = 0; n < NFFT; n++) { re += fr[n] * COS[o + n]; im -= fr[n] * SIN[o + n]; } pw[k] = re * re + im * im; }
    for (let m = 0; m < 80; m++) { let s = 0; const o = m * BINS; for (let k = 0; k < BINS; k++) s += mel[o + k] * pw[k]; const v = Math.log10(Math.max(s, 1e-10)); out[m * FRAMES + t] = v; if (v > max) max = v; }
  }
  for (let i = 0; i < out.length; i++) out[i] = (Math.max(out[i], max - 8) + 4) / 4;
  return out;
}

async function stt({ id, pcm }) {
  const m = logMel(pcm);
  const eo = await enc.run({ mel: new ort.Tensor('float32', m, [1, 80, FRAMES]) });
  const ck = eo.n_layer_cross_k, cv = eo.n_layer_cross_v, S = cfg.layers * cfg.ctx * cfg.state;
  let kc = new ort.Tensor('float32', new Float32Array(S), [cfg.layers, 1, cfg.ctx, cfg.state]), vc = new ort.Tensor('float32', new Float32Array(S), [cfg.layers, 1, cfg.ctx, cfg.state]);
  let tok = [cfg.sot, cfg.noTs], off = 0; const out = [];
  for (let step = 0; step < 96; step++) {
    const r = await dec.run({ tokens: new ort.Tensor('int64', BigInt64Array.from(tok.map(BigInt)), [1, tok.length]), in_n_layer_self_k_cache: kc, in_n_layer_self_v_cache: vc, n_layer_cross_k: ck, n_layer_cross_v: cv, offset: new ort.Tensor('int64', BigInt64Array.from([BigInt(off)]), [1]) });
    off += tok.length; kc = r.out_n_layer_self_k_cache; vc = r.out_n_layer_self_v_cache;
    const lg = r.logits.data, V = r.logits.dims[2], base = (r.logits.dims[1] - 1) * V;
    let best = -1, bv = -Infinity;
    for (let i = 0; i < cfg.sot; i++) { if (step === 0 && (i === cfg.blank || i === cfg.eot)) continue; const v = lg[base + i]; if (v > bv) { bv = v; best = i; } }
    if (best === cfg.eot) break;
    if (out.length > 6 && out.slice(-3).every((t) => t === best)) break;   // stuck repeating
    out.push(best); tok = [best];
  }
  const n = out.reduce((s, t) => s + tokens[t].length, 0), b = new Uint8Array(n); let o = 0; for (const t of out) { b.set(tokens[t], o); o += tokens[t].length; }
  self.postMessage({ type: 'text', id, text: new TextDecoder().decode(b).trim() });
}

async function pump() {
  if (busy) return; busy = true;
  while (queue.length) { const m = queue.shift(); try { await stt(m); } catch (e) { self.postMessage({ type: 'error', id: m.id, msg: String(e?.message || e) }); } }
  busy = false;
}
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') init(m.ort, m.base).catch((err) => self.postMessage({ type: 'error', msg: String(err?.message || err) }));
  else if (m.type === 'stt') { queue.push(m); if (dec) pump(); }
};
