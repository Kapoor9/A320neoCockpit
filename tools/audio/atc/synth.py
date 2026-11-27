"""Speaks the generated exchanges with Kokoro (open neural TTS, github.com/thewh1teagle/kokoro-onnx) and packs them.

python3 synth.py <kokoro dir> <out dir> [exchanges per pool]

Controllers keep one voice per pool; every pilot gets a voice of their own, blended at random from two Kokoro voices
of the same accent group and gender, with a random speaking rate, so no two crews sound alike. Each line is checked by
speech recognition (Whisper tiny, sherpa-onnx) and re-spoken with another voice if it does not come out intelligible.
Lines are stored clean (16 kHz mono MP3); the radio sound is added in the browser, differently on every playback.
Output: one blob per pool (MP3 files back to back) and atc.json with byte offsets."""
import sys, os, json, random, subprocess, difflib, re, io
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(__file__))
from phrases import Gen
from kokoro_onnx import Kokoro
import sherpa_onnx

KD, OUT = sys.argv[1], sys.argv[2]; N = int(sys.argv[3]) if len(sys.argv) > 3 else 80
K = Kokoro(f'{KD}/kokoro-v1.0.onnx', f'{KD}/voices-v1.0.bin')
W = f'{KD}/sherpa-onnx-whisper-tiny.en/'
ASR = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=W + 'tiny.en-encoder.int8.onnx', decoder=W + 'tiny.en-decoder.int8.onnx', tokens=W + 'tiny.en-tokens.txt', num_threads=2)
V = lambda n: K.get_voice_style(n)

MALE = {'in': ['hm_omega', 'hm_psi'], 'us': ['am_adam', 'am_echo', 'am_eric', 'am_liam', 'am_michael', 'am_onyx', 'am_puck', 'am_fenrir'],
        'gb': ['bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis'], 'fr': ['ff_siwis'], 'jp': ['jm_kumo'], 'cn': ['zm_yunjian', 'zm_yunxi']}
FEMALE = {'in': ['hf_alpha', 'hf_beta'], 'us': ['af_heart', 'af_bella', 'af_sarah', 'af_nicole', 'af_kore', 'af_aoede', 'af_river'],
          'gb': ['bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily'], 'fr': ['ff_siwis'], 'jp': ['jf_alpha'], 'cn': ['zf_xiaoxiao']}
LANG = {'gb': 'en-gb'}

def pilot_voice(r, grp):
    if grp == 'mix': grp = r.choice(['in', 'gb', 'us', 'us', 'gb'])
    fem = r.random() < 0.18; pool = (FEMALE if fem else MALE); other = pool['us'] + pool['gb']
    a = r.choice(pool[grp]); b = r.choice([v for v in (pool[grp] + other) if v != a] or other)
    w = r.uniform(0.55, 0.85) if grp not in ('fr', 'jp', 'cn') else r.uniform(0.35, 0.55)   # accented voices lean on an English one
    return {'mix': [a, b, round(w, 2)], 'lang': LANG.get(grp, 'en-us'), 'speed': round(r.uniform(1.02, 1.28), 2)}

CONTROLLERS = {   # one voice per pool (session): Indian controllers
    'west-ground': {'mix': ['hm_omega', 'bm_george', 0.75], 'lang': 'en-us', 'speed': 1.22},
    'west-tower': {'mix': ['hf_alpha', 'bf_emma', 0.8], 'lang': 'en-us', 'speed': 1.18},
    'east-ground': {'mix': ['hf_beta', 'af_sarah', 0.72], 'lang': 'en-us', 'speed': 1.2},
    'east-tower': {'mix': ['hm_psi', 'am_eric', 0.75], 'lang': 'en-us', 'speed': 1.24},
}

NUM = {'0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'}
def words(t):
    t = t.lower().replace('niner', 'nine').replace('9er', ' nine').replace('-', ' ')
    t = re.sub(r'\d', lambda m: ' ' + NUM[m.group()] + ' ', t)
    return re.findall(r'[a-z]+', t)
def score(text, audio):
    s = ASR.create_stream(); s.accept_waveform(24000, audio); ASR.decode_stream(s); heard = s.result.text
    return difflib.SequenceMatcher(None, words(text), words(heard)).ratio(), heard

def speak(text, v):
    a, b, w = v['mix']; style = w * V(a) + (1 - w) * V(b)
    audio, sr = K.create(text, voice=style, speed=v['speed'], lang=v['lang'])
    nz = np.flatnonzero(np.abs(audio) > 0.01)
    audio = audio[max(0, nz[0] - 1200):nz[-1] + 2400] if len(nz) else audio
    return audio / (np.sqrt((audio ** 2).mean()) + 1e-9) * 0.1

def mp3(audio):
    buf = io.BytesIO(); sf.write(buf, audio, 24000, format='WAV', subtype='PCM_16')
    return subprocess.run(['ffmpeg', '-v', 'error', '-f', 'wav', '-i', '-', '-ar', '16000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '32k', '-f', 'mp3', '-'],
                          input=buf.getvalue(), capture_output=True, check=True).stdout

os.makedirs(OUT, exist_ok=True)
manifest = {'version': 1, 'pools': {}}
stats = {'lines': 0, 'retries': 0, 'dropped': 0}
ONLY = os.environ.get('POOLS', '').split(',') if os.environ.get('POOLS') else list(CONTROLLERS)
for pi, pool in enumerate(CONTROLLERS):
    if pool not in ONLY: continue
    flow, pos = pool.split('-'); g = Gen(flow, 1000 + pi * 7919); r = random.Random(77 + pi)
    blob = bytearray(); exs = []; seen = set()
    while len(exs) < N:
        e = g.ground() if pos == 'ground' else g.tower()
        key = tuple(t for _, t in e['lines'])
        if key in seen: continue
        seen.add(key); pv = pilot_voice(r, e['cs']['grp']); lines = []; ok = True
        for who, text in e['lines']:
            v = CONTROLLERS[pool] if who == 'atc' else pv
            for attempt in range(3):
                audio = speak(text, v); sc, heard = score(text, audio)
                if sc >= 0.62: break
                stats['retries'] += 1
                if who == 'plt': pv = v = pilot_voice(r, e['cs']['grp'])
                else: v = {**v, 'speed': max(1.0, v['speed'] - 0.08)}
            else:
                ok = False; break
            data = mp3(audio); lines.append({'who': who, 'off': len(blob), 'len': len(data), 'dur': round(len(audio) / 24000, 2), 'text': text}); blob += data
        if not ok:
            stats['dropped'] += 1; blob = blob[:lines[0]['off']] if lines else blob; continue
        stats['lines'] += len(lines); exs.append({'kind': e['kind'], 'lines': lines})
        if len(exs) % 10 == 0: print(pool, len(exs), stats, flush=True)
    fn = f'atc_{pool}.bin'; open(f'{OUT}/{fn}', 'wb').write(bytes(blob))
    manifest['pools'][pool] = {'file': fn, 'exchanges': exs}
    json.dump({'pools': {pool: manifest['pools'][pool]}}, open(f'{OUT}/{pool}.json', 'w'), separators=(',', ':'))
    print(pool, 'done', len(blob) // 1024, 'KB', flush=True)

print('all done', stats)
