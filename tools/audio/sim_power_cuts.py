"""Cut the owner's sim-cockpit power-up recording (assets/raw-audio/sim_power_up.flac) into game sounds.
Timeline of the recording: BAT 1 pressed 0.635 s, BAT 2 1.250 s, electrical power-up thump 2.187 s,
EXT PWR pressed 5.121 s, relays 5.19 s, then the air (avionics ventilation) builds up and holds from ~6.75 s.
All cuts share one gain so their relative loudness is as recorded."""
import subprocess, sys, numpy as np, wave
SRC, OUT = sys.argv[1], sys.argv[2]
sr = 44100
x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', SRC, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout, dtype=np.float32).copy()
x -= x.mean()
G = 0.9 / np.abs(x[int(2.15 * sr):int(2.8 * sr)]).max()   # one gain for everything: the battery thump peaks at 0.9

def cut(t0, t1, fin=0.003, fout=0.04):
    s = x[int(t0 * sr):int(t1 * sr)].copy() * G
    a, b = int(fin * sr), int(fout * sr); s[:a] *= np.linspace(0, 1, a); s[-b:] *= np.linspace(1, 0, b) ** 2; return s
def save(name, s, fmt='mp3'):
    w = wave.open('/tmp/_cut.wav', 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((np.clip(s, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    args = ['-c:a', 'libmp3lame', '-q:a', '2'] if fmt == 'mp3' else ['-c:a', 'pcm_s16le']
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', '/tmp/_cut.wav', *args, f'{OUT}/{name}.{fmt}'], check=True)

# Korry pushbutton: press (and release, in the first two)
save('click_korry_1', cut(0.630, 0.920, fout=0.03))
save('click_korry_2', cut(1.245, 1.470, fout=0.03))
save('click_korry_3', cut(5.116, 5.180, fout=0.015))
# battery power-up thump, ~0.55 s
save('bat_power_up', cut(2.182, 2.760, fout=0.12))
# EXT PWR: relays closing and the air building up until it holds (the loop takes over from 1.9 s)
save('ext_pwr_on', cut(5.183, 7.700, fout=0.3))
# the steady air as a seamless 16 s loop: same average spectrum as 6.75-7.70 s, built by circular filtering of noise
seg = x[int(6.75 * sr):int(7.70 * sr)] * G
n = 4096; win = np.hanning(n); acc = np.zeros(n // 2 + 1); k = 0
for i in range(0, len(seg) - n, n // 4): acc += np.abs(np.fft.rfft(seg[i:i + n] * win)) ** 2; k += 1
mag = np.sqrt(acc / k)
L = 16 * sr; rng = np.random.default_rng(320)
spec = np.fft.rfft(rng.standard_normal(L))
f_big = np.fft.rfftfreq(L, 1 / sr); f_small = np.fft.rfftfreq(n, 1 / sr)
loop = np.fft.irfft(spec * np.interp(f_big, f_small, mag), L)
loop *= np.sqrt((seg ** 2).mean()) / np.sqrt((loop ** 2).mean())
save('ac_air_loop', loop.astype(np.float32), 'wav')
print('gain', round(G, 3), 'air rms', round(float(np.sqrt((seg ** 2).mean())), 4))
