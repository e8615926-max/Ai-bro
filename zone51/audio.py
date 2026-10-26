"""Звуковая дорожка: голоса + синтезированные эффекты и музыка -> build/audio.wav"""
import math, os, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import timeline as TL
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


# ---------------- комната ----------------
def room_bed(t0, t1, tv_level=0.0, static=False):
    a, b = span(t0, t1)
    n = b - a
    bed = bp(noise(n), hi=300) * 0.06 + np.sin(2 * np.pi * 50 * np.arange(n) / SR).astype(np.float32) * 0.004
    add(fade(bed, 0.5, 0.5), t0)
    # часы
    tick = bp(noise(int(0.02 * SR)), 1500, 5000) * env_ad(int(0.02 * SR), 0.001, 0.004)
    tock = bp(noise(int(0.02 * SR)), 900, 3000) * env_ad(int(0.02 * SR), 0.001, 0.005)
    k = 0
    tt = math.ceil(t0)
    while tt < t1:
        add(tick if k % 2 == 0 else tock, tt, 0.09, -0.6)
        tt += 1.0
        k += 1
    # мурлыканье кота
    tt = np.arange(n) / SR
    purr = bp(noise(n), 60, 400) * (0.5 + 0.5 * np.sin(2 * np.pi * 24 * tt)) * (0.6 + 0.4 * np.sin(2 * np.pi * tt / 2.6))
    add(fade(purr.astype(np.float32), 0.5, 0.5) * 0.06, t0, pan=0.5)
    if static:
        s = bp(noise(n), 800, 6000) * 0.12
        s = bp(s, hi=3500)
        add(fade(s, 0.05, 1.2), t0, pan=-0.4)


room_bed(0, 6.6)
# невнятный звук телевизора за кадром (до заставки)
a, b = span(0, 7.0)
n = b - a
tt = np.arange(n) / SR
babble = bp(noise(n), 200, 1200) * (0.5 + 0.5 * np.sin(2 * np.pi * 3.1 * tt) * np.sin(2 * np.pi * 0.7 * tt)) * 0.16
add(fade(bp(babble.astype(np.float32), hi=900), 1.0, 0.3), 0, pan=-0.7)
room_bed(6.5, 12.2)


# ---------------- заставка новостей ----------------
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


J = jingle()
ti = TL.EVENTS["intro"]
# сначала звук из динамика телевизора, к концу наезда — полноценно
jm = bp(J, 300, 3000)
w = np.clip((np.arange(len(J)) / SR - 3.5) / 1.5, 0, 1).astype(np.float32)
add(jm * (1 - w) * 0.55 + J * w * 0.75, ti)

# студийная подложка
a, b = span(12.0, TL.SHOTS[2][2])
n = b - a
tt = np.arange(n) / SR
pad = (np.sin(2 * np.pi * 110 * tt) + 0.5 * np.sin(2 * np.pi * 164.8 * tt) + 0.4 * np.sin(2 * np.pi * 220.5 * tt)) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.2 * tt))
add(fade(bp(pad.astype(np.float32), hi=900) * 0.025, 1.0, 0.5), 12.0)
# переход в прямой эфир: свуш
wn = int(1.0 * SR)
sw = bp(noise(wn), 400, 6000) * np.sin(np.linspace(0, np.pi, wn)) ** 2
add(sw.astype(np.float32) * 0.35, TL.EVENTS["to_field"] - 0.4)
add(timp(55, 2.0) * 0.6, TL.EVENTS["to_field"] + 0.2)

# ---------------- поле ----------------
F0, F1 = TL.SHOTS[3][1], TL.SHOTS[8][2]
BOOM = TL.EVENTS["boom"]
a, b = span(F0, F1)
n = b - a
tt = np.arange(n) / SR + F0
# ветер + гул огня + треск
wind = bp(brown(n), 80, 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.13 * tt)) * 0.25
roar = bp(noise(n), 40, 260) * 0.25
crk = np.zeros(n, np.float32)
idx = rng.choice(n, size=int(n / SR * 60), replace=False)
crk[idx] = rng.uniform(-1, 1, len(idx))
crk = bp(crk, 1000, 7000) * 3.0
fire = (wind + roar + crk) * (1 + 1.2 * (tt > BOOM))
# после взрыва — «оглушение»: ненадолго глушим окружение
deaf = np.ones(n, np.float32)
m = (tt > BOOM) & (tt < BOOM + 1.6)
deaf[m] = 0.15 + 0.85 * ((tt[m] - BOOM) / 1.6) ** 2
fire_l = bp(fire, hi=500)
fire = fire * deaf + fire_l * (1 - deaf)
add(fade(fire.astype(np.float32), 0.4, 0.05) * 0.5, F0)
# сирены (две, разные фазы), громче на полицейских планах
for k, (per, base, pan, g) in enumerate(((4.2, 700, -0.5, 0.05), (3.1, 820, 0.6, 0.04))):
    f = base + 420 * (0.5 - 0.5 * np.cos(2 * np.pi * tt / per))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)).astype(np.float32)
    s = bp(s, 300, 4000)
    s = reverb(s, 1.5, 0.45)
    add(fade(s * deaf, 1.0, 0.05) * g, F0, pan=pan)
# напряжённая музыка: низкий дрон, к взрыву нарастает
drone = (saw(55, n) + saw(55.4, n) + 0.6 * saw(82.4, n)) / 3
rise = np.clip((tt - TL.SHOTS[5][1]) / (BOOM - TL.SHOTS[5][1]), 0, 1) ** 2
drone = bp(drone, hi=400) * (0.05 + 0.12 * rise) * (tt < BOOM)
add(fade(drone.astype(np.float32), 2.0, 0.02), F0)
# сердцебиение после взрыва
for k in range(int((F1 - BOOM - 1.5) / 0.75)):
    h = timp(48, 0.4)
    add(h * 0.35, BOOM + 1.5 + k * 0.75)
    add(h * 0.25, BOOM + 1.5 + k * 0.75 + 0.22)

# шаги (идут к зоне)
step = lambda g=1.0: bp(noise(int(0.12 * SR)), 100, 1800) * env_ad(int(0.12 * SR), 0.004, 0.03) * g
E0 = TL.SHOTS[4][1]
stop = TL.EVENTS["clark_in"] + 1.1
tt_ = E0
while tt_ < stop:
    add(step(), tt_, 0.25, -0.2 + 0.4 * (int(tt_ * 3.2) % 2))
    tt_ += 1 / 3.2
# шаги полицейского
tt_ = TL.EVENTS["clark_in"]
while tt_ < TL.EVENTS["clark_in"] + 1.1:
    add(step(), tt_, 0.18, 0.5)
    tt_ += 0.32
# рация
for t0 in (F0 + 9.5, F0 + 17.0, TL.SHOTS[5][1] + 6.0):
    nn = int(1.2 * SR)
    r = bp(noise(nn), 1200, 3000) * (np.sin(2 * np.pi * 7 * np.arange(nn) / SR) > 0) * 0.15
    add(fade(r.astype(np.float32), 0.01, 0.1), t0, 0.5, 0.4)

# взрыв
nb = int(6 * SR)
tb = np.arange(nb) / SR
sub = np.sin(2 * np.pi * np.cumsum(70 * np.exp(-tb * 1.2) + 25) / SR) * np.exp(-tb * 0.9)
blast = bp(noise(nb), hi=1200) * np.exp(-tb * 1.6) + bp(noise(nb), hi=250) * np.exp(-tb * 0.6) * 0.8
deb = np.zeros(nb, np.float32)
idx = rng.choice(nb, size=900, replace=False)
deb[idx] = rng.uniform(-1, 1, 900) * np.exp(-idx / SR * 0.8)
deb = bp(deb, 800, 6000) * 2.5
boom = (sub * 1.2 + blast * 1.4 + deb * 0.6).astype(np.float32)
boom = np.tanh(boom * 1.5) * 0.9
add(boom, BOOM, 1.0)
ring = np.sin(2 * np.pi * 3600 * tb[: int(2.5 * SR)]) * np.exp(-tb[: int(2.5 * SR)] * 1.4) * 0.03
add(ring.astype(np.float32), BOOM + 0.1)


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


G0 = TL.EVENTS["growl"]
for k in range(14):
    t0 = G0 + k * 0.55 + rng.uniform(0, 0.3)
    if t0 > F1:
        break
    add(reverb(growl(rng.uniform(0.8, 1.6), rng.uniform(55, 110), k), 0.9, 0.35), t0, 0.22, rng.uniform(-0.8, 0.8))


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


tsh = TL.EVENTS["shots0"]
H0, I0 = TL.SHOTS[7][1], TL.SHOTS[8][1]
while tsh < H0:
    add(gunshot(), tsh, 0.6, 0.15)
    tsh += 0.34
for ph, pan in ((0.0, -0.7), (0.13, 0.7)):
    k = 0
    while True:
        b = k * 0.27 - ph
        k += 1
        if b < 2.3:
            continue
        if BOOM + b > H0:
            break
        add(gunshot(0.6), BOOM + b, 0.35, pan)
tt_ = math.ceil(H0 / 0.3) * 0.3
while tt_ < I0:
    add(gunshot(0.25), tt_, 0.5, 0.6)
    tt_ += 0.3
for k in range(9):
    add(gunshot(0.85), I0 + 0.2 + k * 0.4 + rng.uniform(0, 0.2), 0.3, rng.uniform(-1, 1))

# бег: шаги и дыхание
tt_ = I0 - 0.3
while tt_ < TL.EVENTS["hit"]:
    add(step(1.4), tt_, 0.35, 0)
    tt_ += 1 / 6.4
for k in range(int((TL.EVENTS["hit"] - I0 + 0.4) / 0.42)):
    nn = int(0.3 * SR)
    br = bp(noise(nn), 500, 2500) * np.sin(np.linspace(0, np.pi, nn)) ** 2
    add(br.astype(np.float32) * 0.12, I0 - 0.4 + k * 0.42)
# человек-паук: шипение и визг
S0, HIT = TL.EVENTS["spider"], TL.EVENTS["hit"]
nn = int((HIT - S0) * SR)
t = np.arange(nn) / SR
hiss = bp(noise(nn), 3000, 9000) * (t / t[-1]) ** 1.5 * 0.5
f = 900 + 1800 * (t / t[-1]) ** 2
scr = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / t[-1]) ** 2
scr = bp(np.tanh(scr * 3).astype(np.float32), 600, 6000) * 0.3
add((hiss + scr).astype(np.float32), S0, 0.8, 0.3)
add(growl(1.2, 160, 99), HIT - 0.9, 0.5)
# удар по камере
nn = int(0.6 * SR)
t = np.arange(nn) / SR
thud = (np.sin(2 * np.pi * 60 * t) * np.exp(-t * 10) + noise(nn) * np.exp(-t * 30)).astype(np.float32)
add(np.tanh(thud * 3) * 0.9, HIT)

# ---------------- помехи, «эфир прерван», финал ----------------
s0, s1 = TL.SHOTS[9][1], TL.SHOTS[9][2]
nn = int((s1 - s0) * SR)
st = bp(noise(nn), 300, 9000) * 0.35
st[: int(0.45 * SR)] *= np.linspace(0.2, 1, int(0.45 * SR))
add(fade(st, 0.005, 0.02), s0)
o0, o1 = TL.SHOTS[10][1], TL.SHOTS[10][2]
nn = int((o1 - o0 - 0.15) * SR)
beep = np.sin(2 * np.pi * 1000 * np.arange(nn) / SR).astype(np.float32) * 0.12
add(fade(beep, 0.01, 0.05), o0 + 0.15)
add(bp(noise(int(0.15 * SR)), 300, 9000) * 0.3, o0)
r0, r1 = TL.SHOTS[11][1], TL.SHOTS[11][2]
room_bed(r0, r1, static=True)


# мяу
def meow(dur=0.7):
    nn = int(dur * SR)
    t = np.arange(nn) / SR
    f = 520 + 380 * np.sin(np.pi * t / dur) ** 0.7 - 120 * (t / dur)
    ph = 2 * np.pi * np.cumsum(f * (1 + 0.01 * np.sin(2 * np.pi * 6 * t))) / SR
    s = sum(np.sin(ph * h) / h for h in range(1, 9))
    s = bp(s.astype(np.float32), 500, 3500)
    return s * np.sin(np.pi * t / dur) ** 0.8


add(meow() * 0.18, r0 + 2.4, pan=0.5)

# ---------------- голоса ----------------
vbus = np.zeros((N, 2), np.float32)
for lid, spk, _, _ in LINES:
    v = np.load(os.path.join(BUILD, "voice", lid + ".npy")).astype(np.float32)
    s, d = TL.LINE[lid]
    if spk == "eddie":
        v = reverb(v, 0.5, 0.12, 6000)
    else:
        v = reverb(v, 1.0, 0.16, 3500)
    gain = 1.0
    if lid == "c4":
        gain = 1.15
    i = int(s * SR)
    vbus[i:i + len(v), 0] += v[: N - i] * gain
    vbus[i:i + len(v), 1] += v[: N - i] * gain
# приглушаем фон под голосом
venv = np.abs(vbus[:, 0])
venv = np.convolve(venv, np.ones(4410) / 4410, "same")
duck = 1 - 0.45 * np.clip(venv / 0.05, 0, 1)
mix *= duck[:, None]
mix += vbus * 0.9

# уровень: голоса ~ -17 dBFS RMS, пики взрыва мягко ограничиваем
vr = np.sqrt(np.mean(vbus[np.abs(vbus[:, 0]) > 0.01, 0] ** 2))
mix *= 10 ** (-17 / 20) / (vr * 0.9)
mix = np.tanh(mix * 1.1) / 1.1
mix = np.clip(mix, -0.97, 0.97)
out = (mix * 32767).astype(np.int16)
with wave.open(os.path.join(BUILD, "audio_raw.wav"), "w") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(out.tobytes())
print("audio ok", len(out) / SR)
