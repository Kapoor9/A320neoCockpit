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

for k, (p, half) in POINTS.items():
    lp, c = seamless(freeze(p, half, 12.0))
    import wave
    w = wave.open('/tmp/_loop.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(lp, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', '/tmp/_loop.wav', '-c:a', 'pcm_s16le', f'{OUT}/eng_{k}_loop.wav'], check=True)
    ref = x[int((p - 0.5) * SR):int((p + 0.5) * SR)]
    print(f'{k}: {len(lp) / SR:.1f} s loop, seam {c:.3f}, tone loop {tone(lp):.0f} Hz vs recording {tone(np.vstack([ref, ref])):.0f} Hz')
