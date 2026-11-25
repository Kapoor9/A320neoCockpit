import numpy as np, scipy.io.wavfile as w, scipy.signal as ss
SR=48000; rng=np.random.default_rng(11)
def wr(n,a,peak):
    if a.ndim==1: a=np.stack([a,a],1)
    a=a/np.max(np.abs(a))*peak
    w.write(f'snd/{n}.wav',SR,(np.clip(a,-1,1)*32767).astype(np.int16))
def rd(p):
    sr,x=w.read(p); x=x.astype(np.float32)/32768
    if sr!=SR: x=ss.resample_poly(x,SR,sr,axis=0)
    return x
def lp_tv(x,fc):  # time-varying one-pole lowpass, fc array
    y=np.zeros_like(x); s=0.0
    a=np.exp(-2*np.pi*fc/SR)
    for i in range(len(x)): s=a[i]*s+(1-a[i])*x[i]; y[i]=s
    return y
def lp_tv_fast(x,fc,block=256):
    y=np.zeros_like(x); zi=None
    for i in range(0,len(x),block):
        b,a=ss.butter(2,min(fc[i],SR*0.45),fs=SR)
        if zi is None: zi=ss.lfilter_zi(b,a)*0
        y[i:i+block],zi=ss.lfilter(b,a,x[i:i+block],zi=zi)
    return y
def room(x,amt=0.12):
    n=int(0.05*SR); t=np.arange(n)/SR
    ir=rng.standard_normal(n)*np.exp(-t/0.012); ir=ss.lfilter(*ss.butter(2,3000,fs=SR),ir)
    ir/=np.max(np.abs(ir)); y=np.convolve(x,ir); y=np.pad(y,(0,len(x)+n-len(y)))
    xx=np.concatenate([x,np.zeros(n)]); return xx+amt*y/np.max(np.abs(y)+1e-9)*np.max(np.abs(x))
def brown(n):
    b=np.cumsum(rng.standard_normal(n)); b=ss.lfilter([1,-1],[1,-0.995],b); return b/np.max(np.abs(b))

# ---------- APU (quiet low roar + faint turbine whine)
def apu_layer(t,spool):  # spool 0..1
    n=len(t)
    roar=lp_tv_fast(brown(n),60+340*spool)
    rum=lp_tv_fast(rng.standard_normal(n),120+900*spool**1.5)*0.25
    f=250+1150*spool; ph=2*np.pi*np.cumsum(f)/SR
    whine=(np.sin(ph)+0.3*np.sin(2*ph+0.3))*(0.04+0.06*spool)*(1+0.05*np.sin(2*np.pi*0.3*t))
    return roar*(0.2+0.8*spool)+rum*spool+whine*spool
D=35.0; t=np.arange(int(D*SR))/SR
sp=np.clip(t/D,0,1); sp=1-(1-sp)**2.2              # fast early, settles at AVAIL
sp*=np.where(t<1.5,t/1.5,1)
lightoff=np.exp(-((t-7)/1.2)**2)*lp_tv_fast(rng.standard_normal(len(t)),np.full(len(t),700.0))*0.35
apu_start=apu_layer(t,sp)+lightoff
wr('apu_start',apu_start,0.35)
# seamless run loop: periodic noise made in the FFT domain
L=int(10*SR); t=np.arange(L)/SR
def periodic_noise(L,fc,order=2):
    X=np.fft.rfft(rng.standard_normal(L)); f=np.fft.rfftfreq(L,1/SR)
    X/= (1+(f/fc)**(2*order))**0.5; return np.fft.irfft(X,L)
roar=periodic_noise(L,400)*1/ (np.arange(L)*0+1); roar/=np.max(np.abs(roar))
rum=periodic_noise(L,1000); rum/=np.max(np.abs(rum))
f0=1400.0; whine=(np.sin(2*np.pi*f0*t)+0.3*np.sin(2*np.pi*2*f0*t))*0.1*(1+0.05*np.sin(2*np.pi*0.3*t))
wr('apu_run_loop',roar+0.25*rum+whine,0.35)
# APU spool-down (after cooling period)
D=18.0; t=np.arange(int(D*SR))/SR; sp=np.exp(-t/5.0)
apu_stop=apu_layer(t,sp)*np.where(t>D-4,(D-t)/4,1)
wr('apu_stop',apu_stop,0.35*float(np.max(np.abs(apu_layer(t[:SR],np.ones(SR))))/np.max(np.abs(apu_stop))) if False else 0.33)

# ---------- engine shutdown from the real idle sound: pitch and tone falling away
idle=rd('snd/eng_idle_loop.wav').mean(1)
D=28.0; n=int(D*SR); t=np.arange(n)/SR
rate=0.18+0.82*np.exp(-t/6.5)
pos=np.cumsum(rate)%len(idle); i0=pos.astype(int); fr=pos-i0
y=idle[i0]*(1-fr)+idle[(i0+1)%len(idle)]*fr
y=lp_tv_fast(y,2500*np.exp(-t/7)+150)
gain=np.exp(-t/9)*np.where(t>D-5,(D-t)/5,1)
eng_off=y*gain
idle_rms=np.sqrt((idle**2).mean()); eng_off*=idle_rms/np.sqrt((eng_off[:SR]**2).mean())
w.write('snd/eng_shutdown.wav',SR,(np.stack([eng_off,eng_off],1)*32767*0.9/max(1,np.max(np.abs(eng_off))/0.9)).astype(np.int16))

# ---------- master caution: single chime (soft, rounded)
D=1.6; t=np.arange(int(D*SR))/SR
f=1046.5; ch=(np.sin(2*np.pi*f*t)*np.exp(-t/0.55)+0.35*np.sin(2*np.pi*2*f*t)*np.exp(-t/0.3)+0.12*np.sin(2*np.pi*2.76*f*t)*np.exp(-t/0.15))
ch*=np.minimum(1,t/0.004)
wr('master_caution',room(ch,0.08),0.6)

# ---------- clicks: each control type has its own physics
def click(parts,dur=0.12):
    n=int(dur*SR); t=np.arange(n)/SR; out=np.zeros(n)
    for kind,*p in parts:
        if kind=='tick':   # sharp contact transient
            t0,amp,fc,tau=p; k=int(t0*SR); m=n-k
            b=ss.lfilter(*ss.butter(2,[fc*0.5,min(fc*2,20000)],'band',fs=SR),rng.standard_normal(m))
            out[k:]+=amp*b*np.exp(-t[:m]/tau)
        if kind=='mode':   # resonant body
            t0,amp,f,tau=p; k=int(t0*SR); m=n-k
            out[k:]+=amp*np.sin(2*np.pi*f*t[:m]*(1+rng.uniform(-0.02,0.02)))*np.exp(-t[:m]/tau)
        if kind=='thump':
            t0,amp,fc,tau=p; k=int(t0*SR); m=n-k
            b=ss.lfilter(*ss.butter(2,fc,fs=SR),rng.standard_normal(m))
            out[k:]+=amp*b*np.exp(-t[:m]/tau)/np.max(np.abs(b[:200])+1e-9)
    return room(out,0.1)
R=lambda a,b: rng.uniform(a,b)
defs={
 'click_pushbutton':lambda:[('thump',0,1.0,R(500,700),0.006),('tick',0,0.5,R(2500,3500),0.002),('mode',0,0.3,R(900,1100),0.012),('tick',0.035,0.25,R(2000,3000),0.0015)],
 'click_toggle':lambda:[('tick',0,1.0,R(4500,6000),0.0015),('mode',0,0.4,R(2800,3300),0.01),('mode',0,0.25,R(5200,6000),0.006),('thump',0.001,0.4,900,0.004)],
 'click_guard_open':lambda:[('tick',0,0.6,R(1800,2400),0.004),('mode',0,0.4,R(700,900),0.02),('thump',0,0.3,600,0.01)],
 'click_guard_close':lambda:[('tick',0,1.0,R(2000,2600),0.003),('thump',0,0.7,700,0.006),('mode',0,0.35,R(750,950),0.015)],
 'click_knob_detent':lambda:[('tick',0,1.0,R(4000,5500),0.0008),('mode',0,0.25,R(2200,2600),0.004)],
 'click_knob_pushpull':lambda:[('tick',0,0.8,R(2500,3200),0.002),('thump',0,0.8,R(400,600),0.007),('mode',0,0.3,R(1200,1400),0.01)],
 'click_selector':lambda:[('thump',0,1.0,R(300,450),0.012),('tick',0,0.6,R(2200,2800),0.003),('mode',0,0.4,R(600,800),0.02)],
 'click_eng_master':lambda:[('tick',0,0.5,R(2500,3000),0.002),('thump',0.04,1.0,R(250,350),0.015),('tick',0.04,0.9,R(3500,4500),0.0015),('mode',0.04,0.5,R(1800,2100),0.02)],
 'click_thrust_detent':lambda:[('thump',0,1.0,R(150,220),0.03),('tick',0,0.35,R(1500,2000),0.004),('mode',0,0.4,R(400,500),0.04)],
 'click_mcdu_key':lambda:[('thump',0,0.8,R(700,900),0.004),('tick',0,0.35,R(3000,4000),0.0012)],
 'click_sidestick_btn':lambda:[('tick',0,0.9,R(3500,4500),0.0012),('thump',0,0.4,800,0.003),('mode',0,0.2,R(2600,3000),0.005)],
 'click_lever_heavy':lambda:[('thump',0,1.0,R(120,180),0.05),('tick',0.002,0.5,R(1200,1600),0.006),('mode',0.002,0.5,R(300,380),0.06)],
}
for name,f in defs.items():
    for v in range(3):
        dur=0.25 if 'lever' in name or 'thrust' in name else 0.14
        wr(f'{name}_{v+1}',click(f(),dur),0.7 if 'detent' not in name else 0.5)
print('ok')
