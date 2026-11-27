"""Starter radio exchanges: played only while the in-browser voice model loads, so the radio talks at once.
Spoken by the same model (Kokoro-82M, full precision here). node starter.mjs > s.json; python3 starter_synth.py <kokoro dir> s.json <out.json>"""
import sys, json, base64, io, subprocess, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
KD, SRC, OUT = sys.argv[1:4]
K = Kokoro(f'{KD}/kokoro-v1.0.onnx', f'{KD}/voices-v1.0.bin'); data = json.load(open(SRC)); pools = {}
def speak(text, v):
    st = v['voice']['w'] * K.get_voice_style(v['voice']['a']) + (1 - v['voice']['w']) * K.get_voice_style(v['voice']['b'])
    a, _ = K.create(text, voice=st, speed=v['speed'], lang=v['lang']); nz = np.flatnonzero(np.abs(a) > 0.01)
    return a[max(0, nz[0] - 1200):nz[-1] + 2400] if len(nz) else a
def mp3(a):
    b = io.BytesIO(); sf.write(b, a, 24000, format='WAV', subtype='PCM_16')
    return subprocess.run(['ffmpeg', '-v', 'error', '-f', 'wav', '-i', '-', '-ar', '16000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '40k', '-f', 'mp3', '-'], input=b.getvalue(), capture_output=True, check=True).stdout
for key, p in data.items():
    pools[key] = [[{'who': w, 'mp3': base64.b64encode(mp3(speak(t, p['atc'] if w == 'atc' else e['crew']))).decode()} for w, t in e['lines']] for e in p['ex']]
    print(key, flush=True)
json.dump(pools, open(OUT, 'w'), separators=(',', ':'))
