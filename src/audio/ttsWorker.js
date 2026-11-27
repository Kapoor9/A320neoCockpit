// Neural voice for the radio, running in the browser: Kokoro-82M (int8 ONNX, Apache-2.0) on onnxruntime-web
// (WebAssembly), English phonemes from eSpeak NG (phonemizer.js). Runs in its own worker thread so speech is
// generated without touching the rendering. Every speaker's voice is a blend of two Kokoro voices with random
// weights, so there is no end of different voices.
// Messages in: {type:'init', base}, {type:'say', id, text, voice:{a, b, w}, lang, speed}
// Messages out: {type:'ready'} | {type:'audio', id, pcm (Float32Array, 24 kHz)} | {type:'error', id, msg}
let ort, phonemize, session, cfg, voices, vocab;
const queue = []; let busy = false;

async function init(base) {
  ort = await import(base + 'ort.wasm.min.mjs');
  ({ phonemize } = await import(base + 'phonemizer.js'));
  ort.env.wasm.wasmPaths = base; ort.env.wasm.numThreads = Math.min(4, self.crossOriginIsolated ? (navigator.hardwareConcurrency || 2) - 1 : 1);
  cfg = await (await fetch(base + 'kokoro.json')).json(); vocab = cfg.vocab;
  const parts = await Promise.all([...Array(cfg.parts).keys()].map(async (i) => new Uint8Array(await (await fetch(base + 'kokoro.part' + i)).arrayBuffer())));
  const model = new Uint8Array(cfg.bytes); let o = 0; for (const p of parts) { model.set(p, o); o += p.length; }
  const vb = new Uint16Array(await (await fetch(base + 'voices.f16')).arrayBuffer());
  voices = Object.fromEntries(cfg.voices.map((n, i) => [n, vb.subarray(i * cfg.rows * cfg.dim, (i + 1) * cfg.rows * cfg.dim)]));
  session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  try { await say({ id: 0, text: 'Roger.', voice: { a: cfg.voices[0] }, speed: 1, silent: true }); } catch { /* warm-up only */ }   // first run is slow: do it now
  self.postMessage({ type: 'ready' }); pump();
}

// float16 -> float32
function h2f(h) {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, f = h & 1023;
  return e === 0 ? s * 2 ** -14 * (f / 1024) : e === 31 ? (f ? NaN : s * Infinity) : s * 2 ** (e - 15) * (1 + f / 1024);
}

// punctuation is kept (it shapes the pauses); eSpeak phonemizes the text between it
async function phonemes(text, lang) {
  const parts = text.split(/(\s*[;:,.!?]+\s*)/); let out = '';
  for (const p of parts) {
    if (!p) continue;
    if (/^\s*[;:,.!?]+\s*$/.test(p)) out += p.trim() + ' ';
    else out += (await phonemize(p, lang)).join(' ');
  }
  return [...out.trim()].filter((ch) => ch in vocab).join('');
}

async function say({ id, text, voice, lang, speed, silent }) {
  const ph = await phonemes(text, lang || 'en-us');
  const ids = [...ph].map((ch) => vocab[ch]).filter((v) => v != null).slice(0, cfg.rows - 2);
  const row = Math.min(ids.length, cfg.rows) - 1, A = voices[voice.a], B = voices[voice.b] || A, w = voice.w ?? 1;
  const style = new Float32Array(cfg.dim);
  for (let i = 0; i < cfg.dim; i++) style[i] = w * h2f(A[row * cfg.dim + i]) + (1 - w) * h2f(B[row * cfg.dim + i]);
  const tok = new BigInt64Array(ids.length + 2); ids.forEach((v, i) => { tok[i + 1] = BigInt(v); });
  const r = await session.run({
    tokens: new ort.Tensor('int64', tok, [1, tok.length]),
    style: new ort.Tensor('float32', style, [1, cfg.dim]),
    speed: new ort.Tensor('float32', new Float32Array([speed || 1]), [1]),
  });
  if (silent) return;
  const pcm = new Float32Array(r.audio.data);
  self.postMessage({ type: 'audio', id, pcm }, [pcm.buffer]);
}

async function pump() {
  if (busy) return; busy = true;
  while (queue.length) { const m = queue.shift(); try { await say(m); } catch (e) { self.postMessage({ type: 'error', id: m.id, msg: String(e?.message || e) }); } }
  busy = false;
}

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') init(m.base).catch((err) => self.postMessage({ type: 'error', msg: String(err?.message || err) }));
  else if (m.type === 'say') { queue.push(m); if (session) pump(); }
};
