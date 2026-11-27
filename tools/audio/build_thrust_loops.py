"""Thrust loops that continue each mode's sound exactly where its spool-up arrives.

Each loop is a 'frozen' continuation of the spool-up recording (public/sounds/eng_up_master.mp3, the file the
transitions play) at that mode's arrival point: grains are taken only from a narrow window around the point and
joined where the waveforms line up, so pitch, tone and loudness match the moment of arrival. The engine
(src/audio/audioEngine.js, THRUST_POS) uses the same points, so a transition hands over to its loop without a change.

Arrival points (fan tone measured in the recording): IDLE 1.6 s (~434 Hz), N45 3.0 s (~530 Hz, plateau),
CL 5.45 s (~750 Hz), FLX/MCT/TOGA 7.2 s (~870 Hz)."""
import subprocess, sys, numpy as np

SR = 48000
SRC, OUT = sys.argv[1], sys.argv[2]
x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', SRC, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, dtype=np.float32).reshape(-1, 2).copy()
mono = x.mean(1)
N, H = 2048, 1024
win = np.hanning(N).astype(np.float32)[:, None]
rng = np.random.default_rng(45)
POINTS = {'idle': (1.6, 0.22), 'n45': (3.0, 0.24), 'cl': (5.45, 0.12), 'flx': (7.2, 0.12)}   # point, half window (s)

def freeze(p, half, dur):
    lo, hi = int((p - half) * SR), int((p + half) * SR)
    out = np.zeros((int(dur * SR) + N, 2), np.float32); o = 0; pos = int(p * SR) - N // 2
    while o + N <= len(out):
        out[o:o + N] += x[pos:pos + N] * win
        target = mono[pos + H:pos + H + N]                      # what naturally follows this grain
        best, bc = pos, -1e9
        for _ in range(24):                                     # pick the window grain that lines up best with it
            c = int(rng.integers(lo, hi - N)); v = float(np.dot(mono[c:c + N], target))
            if v > bc: bc, best = v, c
        pos = best; o += H
    out = out[:int(dur * SR)]
    ref = x[int((p - 0.15) * SR):int((p + 0.15) * SR)]          # loudness of the recording at the point
    return out * (np.sqrt((ref ** 2).mean()) / np.sqrt((out ** 2).mean()))

def seamless(a, L=0.5):
    L = int(L * SR); m = a.mean(1); end = m[-L:]; best = (-2, 0)
    for s in range(0, int(1.5 * SR), 8):
        seg = m[s:s + L]; c = np.dot(seg, end) / (np.linalg.norm(seg) * np.linalg.norm(end) + 1e-9)
        if c > best[0]: best = (c, s)
    s = best[1]; body = a[s:].copy(); t = np.linspace(0, np.pi / 2, L)[:, None]
    body[:L] = body[:L] * np.sin(t) + a[-L:] * np.cos(t)      # equal-power join
    return body[:-L], best[0]

def tone(a):
    m = a.mean(1)[:SR]; sp = np.abs(np.fft.rfft(m * np.hanning(len(m)))); f = np.fft.rfftfreq(len(m), 1 / SR); b = (f > 380) & (f < 1000); return f[b][np.argmax(sp[b])]

# All four loops are built the FLX way: one seamless piece of noise shaped by the recording's own fine-grained
# spectrum around the point (fan tones included), made circular so the loop has no joins at all (grain-stitched loops
# crackle). The fan tone is still moving at some points (CL sits mid-sweep), so each analysis frame is warped to the
# arrival tone before averaging; otherwise the moving tone smears into a broadband 'blowing air' hiss. The low core
# rumble (~250 Hz) does not move and is left as it is. Stereo keeps the recording's left / right balance.
FAN = {'idle': 434, 'n45': 527, 'cl': 750, 'flx': 870}
def spectrum(p, half, fan=None):
    seg = x[int((p - half) * SR):int((p + half) * SR)]; n = 8192; w = np.hanning(n); fs = np.fft.rfftfreq(n, 1 / SR)
    ramp = np.clip((fs - 300) / 150, 0, 1)                    # 0 below 300 Hz (rumble kept), 1 above 450 Hz (fan)
    mags = []
    for ch in range(2):
        acc = np.zeros(n // 2 + 1); k = 0
        for i in range(0, len(seg) - n, n // 8):
            sp = np.abs(np.fft.rfft(seg[i:i + n, ch] * w)) ** 2
            if fan:
                m = np.abs(np.fft.rfft(seg[i:i + n].mean(1) * w)); b = (fs > fan * 0.88) & (fs < fan * 1.12)
                j = np.flatnonzero(b)[np.argmax(m[b])]; a, c0, c = np.log(m[j - 1:j + 2] + 1e-12)
                ft = fs[j] + (a - c) / (2 * (a - 2 * c0 + c) + 1e-12) * (fs[1] - fs[0])
                r = 1 + ramp * (fan / ft - 1)                    # move this frame's fan tone onto the arrival tone
                sp = np.interp(fs / r, fs, sp)
            acc += sp; k += 1
        mags.append(np.sqrt(acc / k))
    return fs, mags

# Above ~1.2 kHz the CL point (mid-acceleration) carries 6-10 dB more broadband intake hiss than FLX, which reads as
# blowing air over the engine. Modes listed in AS_FLX get FLX's balance there: the smoothed difference to FLX
# (both levelled on the ~250 Hz rumble) is taken off, only ever as a cut; the tones and rumble stay their own.
AS_FLX = {'cl', 'n45'}
def smooth_db(fs, m, oct=1 / 3):
    db = 20 * np.log10(m + 1e-9); out = np.empty_like(db)
    for i, f in enumerate(fs):
        b = (fs >= max(f, 20) * 2 ** (-oct / 2)) & (fs <= max(f, 20) * 2 ** (oct / 2)); out[i] = db[b].mean() if b.any() else db[i]
    return out

def spectral(p, half, dur=12.0, fan=None, like=None):
    fs, mags = spectrum(p, half, fan)
    if like is not None:
        lf, lm = like; ref = (fs > 200) & (fs < 320)
        for ch in range(2):
            a, b = smooth_db(fs, mags[ch]), smooth_db(fs, lm[ch]); a -= a[ref].mean(); b -= b[ref].mean()
            cut = np.minimum(0, b - a) * np.clip((fs - 1000) / 400, 0, 1)
            mags[ch] = mags[ch] * 10 ** (cut / 20)
    L = int(dur * SR); fb = np.fft.rfftfreq(L, 1 / SR)
    common = np.fft.rfft(rng.standard_normal(L))
    out = np.zeros((L, 2), np.float32)
    for ch in range(2):
        own = np.fft.rfft(rng.standard_normal(L)); spec = 0.85 * common + 0.53 * own
        out[:, ch] = np.fft.irfft(spec * np.interp(fb, fs, mags[ch]), L)
    ref = x[int((p - 0.15) * SR):int((p + 0.15) * SR)]
    return out * (np.sqrt((ref ** 2).mean()) / np.sqrt((out ** 2).mean())), 1.0
SMOOTH = {'idle': 0.22, 'n45': 0.24, 'cl': 0.22}   # half window for the spectrum; FLX is kept as built

FLX_SPEC = spectrum(POINTS['flx'][0], 0.22, FAN['flx'])
for k, (p, half) in POINTS.items():
    if k not in SMOOTH: continue
    lp, c = spectral(p, SMOOTH[k], fan=FAN[k], like=FLX_SPEC if k in AS_FLX else None)
    import wave
    w = wave.open('/tmp/_loop.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(lp, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', '/tmp/_loop.wav', '-c:a', 'pcm_s16le', f'{OUT}/eng_{k}_loop.wav'], check=True)
    ref = x[int((p - 0.5) * SR):int((p + 0.5) * SR)]
    print(f'{k}: {len(lp) / SR:.1f} s loop, seam {c:.3f}, tone loop {tone(lp):.0f} Hz vs recording {tone(np.vstack([ref, ref])):.0f} Hz')
