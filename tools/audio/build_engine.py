import numpy as np, scipy.io.wavfile as w
SR=48000; rng=np.random.default_rng(7)
def rd(p):
    sr,x=w.read(p); x=x.astype(np.float32)/32768
    if sr!=SR:
        import scipy.signal as ss; x=ss.resample_poly(x,SR,sr,axis=0)
    return x
def wr(n,a,peak=None,gain=None):
    if peak: a=a/np.max(np.abs(a))*peak
    if gain: a=a*gain
    w.write(f'/home/claude/work/snd/{n}.wav',SR,(np.clip(a,-1,1)*32767).astype(np.int16))
x=rd('/home/claude/work/src/takeoff_clean.wav')
mono=x.mean(1)
N=2048; H=N//2; D=600
win=np.hanning(N).astype(np.float32)[:,None]
def best_near(pos,target,lo,hi):
    a=max(lo,pos-D); b=min(hi-N,pos+D)
    if b<=a: return max(lo,min(pos,hi-N))
    seg=mono[a:b+N]; t=target
    c=np.correlate(seg,t,'valid')
    return a+int(np.argmax(c))
def texture(t0,t1,dur):
    lo,hi=int(t0*SR),int(t1*SR)
    out=np.zeros((int(dur*SR)+N,2),np.float32)
    pos=rng.integers(lo,hi-N); o=0
    while o+N<=len(out):
        out[o:o+N]+=x[pos:pos+N]*win
        nat=pos+H; target=mono[nat:nat+N] if nat+N<len(mono) else mono[pos:pos+N]
        cand=int(rng.integers(lo,hi-N))
        pos=best_near(cand,target,lo,hi); o+=H
    return out[:int(dur*SR)]
def path(pos_fn,dur,lo=0,hi=None):
    hi=hi or len(mono)
    out=np.zeros((int(dur*SR)+N,2),np.float32); o=0; pos=int(pos_fn(0)*SR)
    while o+N<=len(out):
        out[o:o+N]+=x[pos:pos+N]*win
        nat=pos+H; target=mono[nat:nat+N]
        cand=int(pos_fn(o/SR+H/SR)*SR)
        pos=best_near(cand,target,lo,hi); o+=H
    return out[:int(dur*SR)]
def make_loop(a,L=0.4):
    L=int(L*SR); m=a.mean(1); endseg=m[-L:]
    best=(-2,0)
    for s in range(0,int(1.0*SR),4):
        c=np.dot(m[s:s+L],endseg)/(np.linalg.norm(m[s:s+L])*np.linalg.norm(endseg)+1e-9)
        if c>best[0]: best=(c,s)
    s=best[1]; body=a[s:].copy()
    xx=np.linspace(0,np.pi/2,L)[:,None]
    body[:L]=body[:L]*np.sin(xx)+a[-L:]*np.cos(xx)
    return body[:-L],best[0]
# detent windows (seconds in the recording)
W={'idle':(0.2,2.2),'n45':(2.55,3.35),'cl':(5.20,5.60)}
for k,(a,b) in W.items():
    t=texture(a,b,12.5); lp,c=make_loop(t); wr(f'eng_{k}_loop',lp); print(k,'loop',round(len(lp)/SR,2),'s seam corr',round(c,3))
# FLX: real recording, steady stretch
f=x[int(12.0*SR):int(30.5*SR)]; lp,c=make_loop(f); wr('eng_flx_loop',lp); print('flx loop',round(len(lp)/SR,2),'seam',round(c,3))
# up master: the recording as-is 0..12 s (transitions play straight from this)
wr('eng_up_master',x[:int(12.0*SR)])
# down master: walk back from 7.2 s to 0.4 s, 1.4x slower than the rise
rate=1/1.4; dur=(7.2-0.4)/rate
dn=path(lambda t:max(0.4,7.2-t*rate),dur)
wr('eng_down_master',dn); print('down master',round(dur,2),'s')
