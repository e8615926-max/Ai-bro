"""Звуковая дорожка: голоса + синтезированные эффекты и музыка -> build/audio.wav"""
import math, os, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import timeline as TL
EV = TL.EV
SH = {n: (s, e) for n, s, e in TL.SHOTS}
from lines import LINES

SR = 44100
N = int((TL.TOTAL + 0.5) * SR)
rng = np.random.default_rng(7)
BUILD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")
mix = np.zeros((N, 2), np.float32)


def bp(x, lo=None, hi=None, order=4):
    if lo and hi:
        sos = butter(order, [lo, hi], "band", fs=SR, output="sos")
    elif lo:
        sos = butter(order, lo, "high", fs=SR, output="sos")
    else:
        sos = butter(order, hi, "low", fs=SR, output="sos")
    return sosfilt(sos, x).astype(np.float32)


def noise(n):
    return rng.standard_normal(n).astype(np.float32)


def brown(n):
    b = np.cumsum(noise(n)) * 0.02
    b -= np.convolve(b, np.ones(2000) / 2000, "same")
    return (b / (np.abs(b).max() + 1e-6)).astype(np.float32)


def env_ad(n, a, d):
    t = np.arange(n) / SR
    return np.where(t < a, t / max(a, 1e-4), np.exp(-(t - a) / d)).astype(np.float32)


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N:
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    sig = sig[: N - i]
    l = math.cos((pan + 1) * math.pi / 4)
    r = math.sin((pan + 1) * math.pi / 4)
    if sig.ndim == 1:
        mix[i:i + len(sig), 0] += sig * gain * l * 1.41
        mix[i:i + len(sig), 1] += sig * gain * r * 1.41
    else:
        mix[i:i + len(sig)] += sig * gain


def span(t0, t1):
    return int(t0 * SR), int(t1 * SR)


def fade(sig, fi=0.05, fo=0.05):
    n = len(sig)
    a, b = int(fi * SR), int(fo * SR)
    e = np.ones(n, np.float32)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if b:
        e[-b:] = np.linspace(1, 0, b)
    return sig * e


def reverb(x, dur=0.8, wet=0.25, tone=4000):
    n = int(dur * SR)
    ir = noise(n) * np.exp(-np.arange(n) / SR / (dur / 5))
    ir = bp(ir, hi=tone)
    y = fftconvolve(x, ir)[: len(x)]
    y = y / (np.abs(y).max() + 1e-6) * np.abs(x).max()
    return (x * (1 - wet) + y * wet).astype(np.float32)


def saw(f, n):
    t = np.arange(n) / SR
    return (2 * ((t * f) % 1) - 1).astype(np.float32)


def brass(freqs, dur, att=0.03):
    n = int(dur * SR)
    s = np.zeros(n, np.float32)
    for f in freqs:
        for det in (-0.4, 0.4):
            s += saw(f * (1 + det / 100), n)
    s = bp(s, hi=3500)
    return s * env_ad(n, att, dur * 0.6) / len(freqs)


def timp(f, dur=1.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t * (1 - 0.1 * t)) + 0.4 * bp(noise(n), 60, 400)
    return (s * env_ad(n, 0.002, 0.35)).astype(np.float32)


def jingle():
    seq = [(0.0, [196, 247, 294], 0.35), (0.4, [196, 247, 294], 0.15), (0.6, [220, 277, 330], 0.35), (1.0, [262, 330, 392, 523], 1.6),
           (2.8, [233, 294, 349], 0.3), (3.15, [262, 330, 392, 523], 1.8)]
    n = int(5.2 * SR)
    j = np.zeros(n, np.float32)
    for t0, fs, d in seq:
        s = brass(fs, d + 0.4)
        i = int(t0 * SR)
        j[i:i + len(s)] += s[: n - i]
    for t0 in (0.0, 1.0, 3.15):
        s = timp(65)
        i = int(t0 * SR)
        j[i:i + len(s)] += s[: n - i] * 0.8
    # «тиканье» новостей
    for k in range(20):
        s = bp(noise(1500), 2000, 8000) * env_ad(1500, 0.001, 0.008)
        i = int((1.0 + k * 0.2) * SR)
        j[i:i + 1500] += s * 0.25
    return reverb(j, 1.2, 0.2)


# рык мутантов
def growl(dur, f0, seed):
    r = np.random.default_rng(seed)
    nn = int(dur * SR)
    t = np.arange(nn) / SR
    f = f0 * (1 + 0.15 * np.sin(2 * np.pi * r.uniform(3, 7) * t) + 0.1 * bp(r.standard_normal(nn).astype(np.float32), hi=20) * 8)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = (2 * ((ph / (2 * np.pi)) % 1) - 1) * (0.6 + 0.4 * np.abs(bp(r.standard_normal(nn).astype(np.float32), hi=30)) * 6)
    s = bp(s.astype(np.float32), 80, 1500) + bp(r.standard_normal(nn).astype(np.float32), 200, 2000) * 0.4
    e = np.sin(np.linspace(0, np.pi, nn)) ** 0.6
    return np.tanh(s * e * 2).astype(np.float32)


# выстрелы
def gunshot(dist=0.0):
    nn = int(0.9 * SR)
    t = np.arange(nn) / SR
    s = noise(nn) * np.exp(-t * 40) * 1.2 + np.sin(2 * np.pi * 90 * t) * np.exp(-t * 25) * 0.8
    s = s.astype(np.float32)
    if dist > 0:
        s = bp(s, hi=2500 - 1500 * dist)
    s = reverb(s, 0.8, 0.3 + 0.3 * dist)
    return np.tanh(s * 2) * (1 - 0.6 * dist)


# мяу
def meow(dur=0.7):
    nn = int(dur * SR)
    t = np.arange(nn) / SR
    f = 520 + 380 * np.sin(np.pi * t / dur) ** 0.7 - 120 * (t / dur)
    ph = 2 * np.pi * np.cumsum(f * (1 + 0.01 * np.sin(2 * np.pi * 6 * t))) / SR
    s = sum(np.sin(ph * h) / h for h in range(1, 9))
    s = bp(s.astype(np.float32), 500, 3500)
    return s * np.sin(np.pi * t / dur) ** 0.8




def step(g=1.0, hard=False):
    n = int(0.12 * SR)
    return bp(noise(n), 100 if not hard else 300, 1800 if not hard else 4000) * env_ad(n, 0.004, 0.03 if not hard else 0.02) * g


def footsteps(t0, t1, rate, g, pan=0.0, hard=False):
    tt = t0
    k = 0
    while tt < t1:
        add(step(1.0, hard), tt, g, pan + (0.1 if k % 2 else -0.1))
        tt += 1 / rate
        k += 1


def knock(t0, g=0.6):
    for k in range(3):
        n = int(0.15 * SR)
        tt = np.arange(n) / SR
        s = (np.sin(2 * np.pi * 120 * tt) * np.exp(-tt * 40) + bp(noise(n), 200, 1500) * np.exp(-tt * 60) * 0.6).astype(np.float32)
        add(reverb(s, 0.4, 0.3), t0 + k * 0.28, g, -0.5)


def creak(t0, dur=0.8, g=0.15, f0=300):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 + 120 * np.sin(2 * np.pi * 1.3 * tt) + 60 * np.sin(2 * np.pi * 7 * tt)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.5 + 0.5 * (np.sin(2 * np.pi * 40 * tt) > 0))
    s = bp(s.astype(np.float32), 200, 3000) * np.sin(np.pi * tt / dur)
    add(s, t0, g)


def thud(t0, g=0.5, f=70):
    n = int(0.4 * SR)
    tt = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 14) + bp(noise(n), 80, 800) * np.exp(-tt * 30)).astype(np.float32)
    add(reverb(s, 0.5, 0.25), t0, g)


def breath(t0, dur=1.2, g=0.12, lo=400, hi=2500):
    n = int(dur * SR)
    s = bp(noise(n), lo, hi) * np.sin(np.linspace(0, np.pi, n)) ** 1.5
    add(s.astype(np.float32), t0, g)


def bed(t0, t1, g=1.0, tv=None):
    a, b = span(t0, t1)
    n = b - a
    s = bp(noise(n), hi=300) * 0.06 + np.sin(2 * np.pi * 50 * np.arange(n) / SR).astype(np.float32) * 0.004
    add(fade(s, 0.3, 0.3), t0, g)


def clock(t0, t1, g=0.09):
    tick = bp(noise(int(0.02 * SR)), 1500, 5000) * env_ad(int(0.02 * SR), 0.001, 0.004)
    tock = bp(noise(int(0.02 * SR)), 900, 3000) * env_ad(int(0.02 * SR), 0.001, 0.005)
    tt = math.ceil(t0)
    k = 0
    while tt < t1:
        add(tick if k % 2 == 0 else tock, tt, g, -0.6)
        tt += 1.0
        k += 1


def purr(t0, t1, g=0.06):
    a, b = span(t0, t1)
    n = b - a
    tt = np.arange(n) / SR
    s = bp(noise(n), 60, 400) * (0.5 + 0.5 * np.sin(2 * np.pi * 24 * tt)) * (0.6 + 0.4 * np.sin(2 * np.pi * tt / 2.6))
    add(fade(s.astype(np.float32), 0.5, 0.5), t0, g, 0.5)


def tv_babble(t0, t1, g=0.12, warm=False):
    a, b = span(t0, t1)
    n = b - a
    tt = np.arange(n) / SR
    s = bp(noise(n), 200, 1200) * (0.5 + 0.5 * np.sin(2 * np.pi * 3.1 * tt) * np.sin(2 * np.pi * 0.7 * tt))
    if warm:   # вечернее шоу: смех и музыка из телевизора
        s = s + bp(saw(220, n) + saw(277, n) + saw(330, n), 200, 900) * 0.08 * (np.sin(2 * np.pi * 0.25 * tt) > 0)
    add(fade(bp(s.astype(np.float32), hi=900), 0.3, 0.3), t0, g, -0.7)


def static_burst(t0, t1, g=0.35, ramp_in=0.0):
    n = int((t1 - t0) * SR)
    s = bp(noise(n), 300, 9000)
    if ramp_in:
        s[: int(ramp_in * SR)] *= np.linspace(0, 1, int(ramp_in * SR))
    add(fade(s, 0.005, 0.03), t0, g)


# ======================= 1. комната и телевизор =========================
T_TV = SH["studio"][0]
bed(0, T_TV + 0.2)
clock(0, T_TV)
purr(0, SH["tv"][1])
tv_babble(0, EV["intro"])
n = int(0.5 * SR)
gulp = bp(noise(n), 200, 900) * (np.sin(np.linspace(0, 6 * np.pi, n)) > 0.3) * np.sin(np.linspace(0, np.pi, n))
add(gulp.astype(np.float32), EV["sip"] + 0.6, 0.12)
J = jingle()
ti = EV["intro"]
jm = bp(J, 300, 3000)
w = np.clip((np.arange(len(J)) / SR - 3.5) / 1.5, 0, 1).astype(np.float32)
add(jm * (1 - w) * 0.55 + J * w * 0.75, ti)

# ======================= 2. студия ======================================
for (s0, s1) in (SH["studio"], SH["studio2"]):
    a, b = span(s0, s1)
    n = b - a
    tt = np.arange(n) / SR
    pad = (np.sin(2 * np.pi * 110 * tt) + 0.5 * np.sin(2 * np.pi * 164.8 * tt) + 0.4 * np.sin(2 * np.pi * 220.5 * tt)) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.2 * tt))
    add(fade(bp(pad.astype(np.float32), hi=900) * 0.025, 1.0, 0.5), s0)
wn = int(1.0 * SR)
sw = bp(noise(wn), 400, 6000) * np.sin(np.linspace(0, np.pi, wn)) ** 2
add(sw.astype(np.float32) * 0.35, EV["to_field"] - 0.4)
add(timp(55, 2.0) * 0.6, EV["to_field"] + 0.2)

# ======================= 3. поле ========================================
F0, F1 = SH["report"][0], EV["hit"]
BOOM = EV["boom"]
a, b = span(F0, F1)
n = b - a
tt = np.arange(n) / SR + F0
wind = bp(brown(n), 80, 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.13 * tt)) * 0.25
roar = bp(noise(n), 40, 260) * 0.25
crk = np.zeros(n, np.float32)
idx = rng.choice(n, size=int(n / SR * 60), replace=False)
crk[idx] = rng.uniform(-1, 1, len(idx))
crk = bp(crk, 1000, 7000) * 3.0
fire = (wind + roar + crk) * (1 + 1.2 * (tt > BOOM))
deaf = np.ones(n, np.float32)
m = (tt > BOOM) & (tt < BOOM + 1.6)
deaf[m] = 0.15 + 0.85 * ((tt[m] - BOOM) / 1.6) ** 2
fire = fire * deaf + bp(fire, hi=500) * (1 - deaf)
add(fade(fire.astype(np.float32), 0.4, 0.05) * 0.5, F0)
for k, (per, base, pan, g) in enumerate(((4.2, 700, -0.5, 0.05), (3.1, 820, 0.6, 0.04))):
    f = base + 420 * (0.5 - 0.5 * np.cos(2 * np.pi * tt / per))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)).astype(np.float32)
    s = reverb(bp(s, 300, 4000), 1.5, 0.45)
    add(fade(s * deaf, 1.0, 0.05) * g, F0, pan=pan)
drone = (saw(55, n) + saw(55.4, n) + 0.6 * saw(82.4, n)) / 3
rise = np.clip((tt - SH["standoff"][0]) / (BOOM - SH["standoff"][0]), 0, 1) ** 2
drone = bp(drone, hi=400) * (0.05 + 0.12 * rise) * (tt < BOOM)
add(fade(drone.astype(np.float32), 2.0, 0.02), F0)
for k in range(int((F1 - BOOM - 1.5) / 0.75)):
    h = timp(48, 0.4)
    add(h * 0.35, BOOM + 1.5 + k * 0.75)
    add(h * 0.25, BOOM + 1.5 + k * 0.75 + 0.22)
footsteps(SH["walk"][0], EV["clark_in"] + 1.3, 3.2, 0.25)
footsteps(EV["clark_in"], EV["clark_in"] + 1.3, 3.0, 0.18, 0.5)
for t0 in (F0 + 9.5, F0 + 17.0, SH["standoff"][0] + 6.0):
    nn = int(1.2 * SR)
    r = bp(noise(nn), 1200, 3000) * (np.sin(2 * np.pi * 7 * np.arange(nn) / SR) > 0) * 0.15
    add(fade(r.astype(np.float32), 0.01, 0.1), t0, 0.5, 0.4)
# взрыв + вторичные
nb = int(6 * SR)
tb = np.arange(nb) / SR
sub = np.sin(2 * np.pi * np.cumsum(70 * np.exp(-tb * 1.2) + 25) / SR) * np.exp(-tb * 0.9)
blast = bp(noise(nb), hi=1200) * np.exp(-tb * 1.6) + bp(noise(nb), hi=250) * np.exp(-tb * 0.6) * 0.8
deb = np.zeros(nb, np.float32)
idx = rng.choice(nb, size=900, replace=False)
deb[idx] = rng.uniform(-1, 1, 900) * np.exp(-idx / SR * 0.8)
deb = bp(deb, 800, 6000) * 2.5
boom = np.tanh((sub * 1.2 + blast * 1.4 + deb * 0.6).astype(np.float32) * 1.5) * 0.9
add(boom, BOOM, 0.6)
for d, g in ((0.7, 0.35), (1.3, 0.3), (2.1, 0.25)):
    add(boom[: int(2.5 * SR)] * np.exp(-tb[: int(2.5 * SR)] * 1.0), BOOM + d, g, rng.uniform(-0.5, 0.5))
ring = np.sin(2 * np.pi * 3600 * tb[: int(2.5 * SR)]) * np.exp(-tb[: int(2.5 * SR)] * 1.4) * 0.03
add(ring.astype(np.float32), BOOM + 0.1)
# микрофон падает
thud(EV["mic_drop"] + 0.35, 0.25, 160)
G0 = EV["growl"]
for k in range(16):
    t0 = G0 + k * 0.5 + rng.uniform(0, 0.3)
    if t0 > F1:
        break
    add(reverb(growl(rng.uniform(0.8, 1.6), rng.uniform(55, 110), k), 0.9, 0.35), t0, 0.22, rng.uniform(-0.8, 0.8))
tsh = EV["shots0"]
H0, I0 = SH["flee"][0], SH["run"][0]
while tsh < H0:
    add(gunshot(), tsh, 0.38, 0.15)
    tsh += 0.34
tt_ = BOOM + 2.6
while tt_ < I0:
    for i in range(2):
        add(gunshot(0.6), tt_ + i * 0.13, 0.18, -0.6 + 1.2 * i)
    tt_ += 0.3
tt_ = math.ceil(H0 / 0.3) * 0.3
while tt_ < I0:
    add(gunshot(0.25), tt_, 0.3, 0.6)
    tt_ += 0.3
for k in range(9):
    add(gunshot(0.85), I0 + 0.2 + k * 0.4 + rng.uniform(0, 0.2), 0.3, rng.uniform(-1, 1))
# свист поворота камеры
wn = int(0.6 * SR)
add((bp(noise(wn), 800, 6000) * np.sin(np.linspace(0, np.pi, wn)) ** 2).astype(np.float32) * 0.4, EV["whip"])
footsteps(I0 - 0.3, F1, 6.4, 0.35, 0, True)
for k in range(int((F1 - I0 + 0.4) / 0.42)):
    breath(I0 - 0.4 + k * 0.42, 0.3, 0.12, 500, 2500)
S0, HIT = EV["spider"], EV["hit"]
nn = int((HIT - S0) * SR)
t = np.arange(nn) / SR
hiss = bp(noise(nn), 3000, 9000) * (t / t[-1]) ** 1.5 * 0.5
f = 900 + 1800 * (t / t[-1]) ** 2
scr = bp(np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / t[-1]) ** 2 * 3).astype(np.float32), 600, 6000) * 0.3
add((hiss + scr).astype(np.float32), S0, 0.8, 0.3)
add(growl(1.2, 160, 99), EV["drop"], 0.5)
thud(HIT, 0.9, 60)
thud(HIT + 0.45, 0.7, 90)      # камера ударилась об асфальт
nn = int(0.3 * SR)
add(bp(noise(nn), 2000, 9000) * np.exp(-np.arange(nn) / SR * 12) * 0.5, HIT + 0.45)   # треск стекла

# ======================= 4. помехи ======================================
FA, FB = SH["fall"]
nn = int((FB - FA) * SR)
st = bp(noise(nn), 300, 9000) * 0.3 * np.clip(0.15 + np.arange(nn) / SR / 4.0, 0, 1)
st *= (0.6 + 0.4 * (np.sin(2 * np.pi * 13 / (2 * np.pi) * np.arange(nn) / SR * 6) > 0.6))
add(fade(st.astype(np.float32), 0.005, 0.02), FA)
for k in range(3):
    add(reverb(growl(1.4, 70 + k * 15, 200 + k), 1.0, 0.4) * 0.5, EV["growl2"] + k * 0.6, 0.3, -0.3 + 0.3 * k)
static_burst(*SH["nosignal"], g=0.33)
nn = int(0.4 * SR)
add(bp(noise(nn), 300, 9000) * 0.3, SH["studio2"][0])

# ======================= 5. реклама =====================================
def ad_music(dur):
    n = int(dur * SR)
    out = np.zeros(n, np.float32)
    bpm = 128
    beat = 60 / bpm
    prog = [(262, 330, 392), (196, 247, 294), (220, 262, 330), (175, 220, 262)]
    for bi in range(int(dur / beat)):
        t0 = bi * beat
        chord = prog[(bi // 4) % 4]
        i = int(t0 * SR)
        L = int(beat * SR)
        tt = np.arange(L) / SR
        if bi % 2 == 0:   # бас
            s = saw(chord[0] / 2, L) * np.exp(-tt * 6) * 0.5
            out[i:i + L] += bp(s, hi=600)[: n - i]
        st_ = sum(np.sin(2 * np.pi * f * tt) for f in chord) * np.exp(-tt * 9) * 0.18   # стаб
        out[i + L // 2:i + L // 2 + L][: max(0, n - i - L // 2)] += st_[: max(0, n - i - L // 2)]
        k_ = np.sin(2 * np.pi * 60 * tt * np.exp(-tt * 20)) * np.exp(-tt * 18) * 0.7   # бочка
        out[i:i + L] += k_[: n - i]
        if bi % 2 == 1:   # хлопок
            cl = bp(noise(L), 1000, 6000) * np.exp(-tt * 30) * 0.4
            out[i:i + L] += cl[: n - i]
        mel = [523, 587, 659, 784, 659, 587, 523, 440][bi % 8]
        m_ = (np.sin(2 * np.pi * mel * tt) + 0.3 * np.sin(4 * np.pi * mel * tt)) * np.exp(-tt * 7) * 0.12
        out[i:i + L] += m_[: n - i]
    return out


A0, A1 = SH["ad"]
music = ad_music(A1 - A0 + 3.4)
# в комнате (отъезд от экрана) звук рекламы тише и глуше
mt = np.arange(len(music)) / SR
q = np.clip((mt - (A1 - A0)) / 2.6, 0, 1)
music = music * (1 - 0.8 * q) * np.where(mt > A1 - A0 + 2.8, np.clip(1 - (mt - (A1 - A0 + 2.8)) / 0.6, 0, 1), 1)
add(bp(music, hi=7000) * 0.5, A0)
for k in range(5):   # хруст хлопьев
    nn = int(0.12 * SR)
    add((bp(noise(nn), 1500, 8000) * (rng.random(nn) > 0.7) * np.exp(-np.arange(nn) / SR * 20)).astype(np.float32), A0 + 3.8 + k * 0.14, 0.4)
for k in range(6):   # звон блёсток
    nn = int(0.5 * SR)
    tt = np.arange(nn) / SR
    add((np.sin(2 * np.pi * (2000 + k * 300) * tt) * np.exp(-tt * 8)).astype(np.float32) * 0.06, A0 + 4.4 + k * 0.18, 1, rng.uniform(-0.6, 0.6))
nn = int(1.0 * SR)
add((bp(noise(nn), 200, 3000) * np.exp(-np.arange(nn) / SR * 3)).astype(np.float32) * 0.2, A0 + 1.8)   # молоко

# ======================= 6. комната, часть 2 =============================
R0, R1 = SH["room2"]
bed(SH["tv_out"][0], R1)
clock(SH["tv_out"][0], R1)
purr(R0, EV["meow"] - 0.5)
tv_babble(R0, R1, 0.07, warm=True)
add(meow(0.8) * 0.3, EV["meow"], pan=0.5)
thud(EV["put_beer"] + 0.6, 0.2, 220)                 # кружка на подлокотник
creak(EV["stand0"] + 0.3, 1.0, 0.12, 260)             # скрип дивана
footsteps(EV["sasha_in"], EV["sasha_stop"], 3.0, 0.18, -0.5)
knock(EV["knock"], 0.55)
footsteps(EV["sasha_out"], EV["sasha_out"] + 1.4, 3.0, 0.16, -0.5)
footsteps(EV["andrey_go"], R1, 3.2, 0.2, -0.2)

# ======================= 7. прихожая ====================================
HA0, HA1 = SH["hall"][0], SH["end_card"][1]
bed(HA0, HA1, 0.8)
a, b = span(HA0, SH["end_card"][0])
nn = b - a
hum = (np.sin(2 * np.pi * 100 * np.arange(nn) / SR) * 0.004).astype(np.float32)   # гудит лампочка
add(hum, HA0)
footsteps(EV["hall_walk0"], EV["hall_walk1"], 3.2, 0.22)
creak(EV["door_open0"], 1.0, 0.18, 360)
thud(EV["door_open0"], 0.2, 120)
footsteps(EV["mama_in0"], EV["mama_in1"], 2.8, 0.18, 0.2, True)
footsteps(EV["mama_go"], EV["mama_go"] + 1.6, 2.8, 0.14, 0.6, True)
creak(EV["door_close0"], 0.7, 0.15, 330)
thud(EV["door_close1"] - 0.05, 0.5, 90)
breath(EV["sigh"], 1.2, 0.16, 300, 1800)
# туалет: смыв и дверь
nn = int(2.2 * SR)
fl = bp(noise(nn), 200, 3000) * np.sin(np.linspace(0, np.pi, nn)) ** 0.5 * 0.2
add(reverb(fl.astype(np.float32), 0.6, 0.3), EV["toilet0"] - 1.6, 1, -0.6)
creak(EV["toilet0"], 0.6, 0.12, 420)
footsteps(EV["toilet0"] + 0.4, EV["toilet1"], 3.0, 0.16, -0.4)
# зловещий гул в конце
C0 = EV["creep0"]
a, b = span(C0 - 2.0, HA1)
nn = b - a
tt = np.arange(nn) / SR
dr = (saw(41, nn) + saw(41.3, nn) + 0.5 * saw(61.7, nn)) / 2.5
dr = bp(dr, hi=300) * np.clip(tt / 3, 0, 1) * 0.16
add(fade(dr.astype(np.float32), 0.5, 2.0), C0 - 2.0)
add(timp(40, 3.0) * 0.6, SH["end_card"][0] + 0.8)

# ======================= голоса =========================================
vbus = np.zeros((N, 2), np.float32)
for lid, spk, _, segs, opt in LINES:
    if not segs:
        continue
    v = np.load(os.path.join(BUILD, "voice", lid + ".npy")).astype(np.float32)
    s, d = TL.LINE[lid]
    fx = opt.get("fx")
    gain = 1.0
    pan = 0.0
    if spk == "eddie":
        v = reverb(v, 0.5, 0.12, 6000)
    elif fx == "door":        # через входную дверь — глухо
        v = reverb(bp(v, 150, 900), 0.6, 0.3)
        gain = 1.4
    elif fx == "radio":       # крик сквозь помехи
        v = np.tanh(bp(v, 400, 3000) * 4) * 0.6
        v = v * (0.6 + 0.4 * (rng.random(len(v)) > 0.1))
        gain = 1.1
    elif spk in ("andrey", "sasha", "mama"):
        v = reverb(v, 0.4, 0.12, 5000)
    elif spk == "boy":
        v = reverb(v, 0.3, 0.1, 7000)
    else:
        v = reverb(v, 1.0, 0.16, 3500)
    i = int(s * SR)
    vbus[i:i + len(v), 0] += v[: N - i] * gain
    vbus[i:i + len(v), 1] += v[: N - i] * gain
venv = np.abs(vbus[:, 0])
venv = np.convolve(venv, np.ones(4410) / 4410, "same")
duck = 1 - 0.45 * np.clip(venv / 0.05, 0, 1)
mix *= duck[:, None]
mix += vbus * 0.9
vr = np.sqrt(np.mean(vbus[np.abs(vbus[:, 0]) > 0.01, 0] ** 2))
mix *= 10 ** (-17 / 20) / (vr * 0.9)
mix = np.tanh(mix * 1.1) / 1.1
mix = np.clip(mix, -0.97, 0.97)
out = (mix * 32767).astype(np.int16)
with wave.open(os.path.join(BUILD, "audio.wav"), "w") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(out.tobytes())
print("audio ok", len(out) / SR)
