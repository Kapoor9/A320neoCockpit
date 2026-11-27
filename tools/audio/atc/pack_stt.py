"""Packs Whisper tiny.en (int8 ONNX from k2-fsa/sherpa-onnx, MIT) for in-browser speech recognition of the pilot's
radio calls. The decoder's 80 MB float word-embedding table is shipped as int8 with one scale per row and rebuilt
once in the browser (passed to onnxruntime-web as external data), so the download is ~45 MB and the speed unchanged.
The host serves web types only: binaries go as base64 text. python3 pack_stt.py <sherpa whisper dir> <out dir>"""
import sys, os, json, base64, numpy as np, onnx
from onnx import numpy_helper
D, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2]; os.makedirs(OUT, exist_ok=True)
m = onnx.load(D + 'tiny.en-decoder.int8.onnx')
W = next(numpy_helper.to_array(i) for i in m.graph.initializer if i.name == 'textDecoder.token_embedding.weight')
onnx.save(m, '/tmp/dec_ext.onnx', save_as_external_data=True, all_tensors_to_one_file=True, location='emb.bin', size_threshold=50_000_000)
sc = (np.abs(W).max(1) / 127).astype(np.float32); q = np.round(W / sc[:, None]).astype(np.int8)
def b64(name, data):
    P = 14 * 1024 * 1024; parts = [data[i:i + P] for i in range(0, len(data), P)]
    for k, p in enumerate(parts): open(f'{OUT}/{name}.{k}.txt', 'wb').write(base64.b64encode(p))
    return len(parts)
# slaney mel filters (80 x 201), as Whisper uses
def hz2mel(f): f = np.asarray(f, float); lin = 1000 / (200 / 3); return np.where(f >= 1000, lin + np.log(np.maximum(f, 1e-9) / 1000) / (np.log(6.4) / 27), f / (200 / 3))
def mel2hz(x): x = np.asarray(x, float); lin = 1000 / (200 / 3); return np.where(x >= lin, 1000 * np.exp((np.log(6.4) / 27) * (x - lin)), x * (200 / 3))
fft = np.linspace(0, 8000, 201); mp = mel2hz(np.linspace(hz2mel(0), hz2mel(8000), 82)); fd = np.diff(mp); ramps = mp[:, None] - fft[None, :]
F = np.zeros((80, 201))
for i in range(80): F[i] = np.maximum(0, np.minimum(-ramps[i] / fd[i], ramps[i + 2] / fd[i + 1]))
F *= (2 / (mp[2:82] - mp[:80]))[:, None]
toks = [''] * 51864
for l in open(D + 'tiny.en-tokens.txt', encoding='utf-8'):
    t, i = l.rstrip('\n').split(' '); toks[int(i)] = t
cfg = {'enc': b64('enc', open(D + 'tiny.en-encoder.int8.onnx', 'rb').read()), 'dec': b64('dec', open('/tmp/dec_ext.onnx', 'rb').read()),
       'embQ': b64('embq', q.tobytes()), 'embRows': W.shape[0], 'embDim': W.shape[1],
       'embS': base64.b64encode(sc.tobytes()).decode(), 'mel': base64.b64encode(F.astype(np.float32).tobytes()).decode(), 'tokens': toks,
       'sot': 50257, 'noTs': 50362, 'eot': 50256, 'blank': 220, 'layers': 4, 'ctx': 448, 'state': 384}
json.dump(cfg, open(f'{OUT}/whisper.json', 'w'), separators=(',', ':'))
print({k: v for k, v in cfg.items() if isinstance(v, int)}, sorted((f, os.path.getsize(f'{OUT}/{f}') // 1048576) for f in os.listdir(OUT)))
