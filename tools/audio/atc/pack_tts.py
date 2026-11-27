"""Packs Kokoro-82M (int8 ONNX, github.com/thewh1teagle/kokoro-onnx release model-files-v1.0, Apache-2.0) for the
browser: the model split into parts under the host's file-size limit, the chosen voices as float16, and the vocab.
The host serves only web file types, so the binary parts are stored as base64 text (.txt) and decoded in the worker.
python3 pack_tts.py <kokoro dir> <out dir>"""
import sys, json, numpy as np, os
KD, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
m = open(f'{KD}/kokoro-v1.0.int8.onnx', 'rb').read(); P = 14 * 1024 * 1024
parts = [m[i:i + P] for i in range(0, len(m), P)]
import base64
for i, p in enumerate(parts): open(f'{OUT}/kokoro.part{i}.txt', 'wb').write(base64.b64encode(p))
VOICES = ['hm_omega', 'hm_psi', 'hf_alpha', 'hf_beta',
          'am_adam', 'am_echo', 'am_eric', 'am_liam', 'am_michael', 'am_onyx', 'am_puck', 'am_fenrir',
          'af_heart', 'af_bella', 'af_sarah', 'af_nicole', 'af_kore', 'af_aoede', 'af_river',
          'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis', 'bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily',
          'ff_siwis', 'jm_kumo', 'jf_alpha', 'zm_yunjian', 'zm_yunxi', 'zf_xiaoxiao']
V = np.load(f'{KD}/voices-v1.0.bin')
arr = np.stack([V[v].reshape(510, 256) for v in VOICES]).astype(np.float16)
open(f'{OUT}/voices.f16.txt', 'wb').write(base64.b64encode(arr.tobytes()))
import kokoro_onnx; vocab = json.load(open(os.path.join(os.path.dirname(kokoro_onnx.__file__), 'config.json')))['vocab']
json.dump({'parts': len(parts), 'bytes': len(m), 'voices': VOICES, 'rows': 510, 'dim': 256, 'vocab': vocab}, open(f'{OUT}/kokoro.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(parts), 'parts', [len(p) for p in parts], arr.nbytes)
