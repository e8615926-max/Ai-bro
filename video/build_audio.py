"""Озвучка (RHVoice), музыка и SFX для ролика. Пишет out/timeline.js и out/audio.wav."""
import io, json, os, subprocess, sys, wave
import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

MOCK = os.environ.get('MOCK')
if not MOCK:
    sys.path.insert(0, HERE)
    from tts_edge import synth
# голос, темп, высота, ffmpeg-обработка, во сколько раз обработка растягивает время
VOICE = {
    'main': ('ru-RU-DmitryNeural', '-6%', '-2Hz',
             'atempo=1.12,highpass=f=60,equalizer=f=140:t=q:w=1:g=2.5,equalizer=f=4000:t=q:w=1:g=1.5,'
             'acompressor=threshold=-20dB:ratio=3:attack=5:release=80,aecho=0.8:0.5:35:0.1', 1 / 1.12),
    'mom': ('ru-RU-SvetlanaNeural', '-15%', '-6Hz',
            'asetrate=44100*0.93,aresample=44100,highpass=f=350,lowpass=f=3200,'
            'aecho=0.8:0.7:60|120:0.35|0.2,tremolo=f=6:d=0.25', 1 / 0.93),
    'whisper': ('ru-RU-DmitryNeural', '-20%', '-8Hz',
                'asetrate=44100*0.85,aresample=44100,highpass=f=200,lowpass=f=5000,'
                'aecho=0.8:0.8:30|420:0.6|0.25', 1 / 0.85),
}


def ff(data, filt):
    """Прогоняет float32 моно через ffmpeg-фильтр."""
    p = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                        '-af', filt, '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-'],
                       input=data.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


def say(text, voice):
    """Возвращает (звук, [время начала каждого произнесённого слова])."""
    if MOCK:
        return np.zeros(int(len(text) * 0.065 * SR)), []
    name, rate, pitch, filt, k = VOICE[voice]
    mp3, words = synth(text, name, rate, pitch)
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', '-', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-'],
                       input=mp3, capture_output=True, check=True)
    x = np.frombuffer(p.stdout, dtype=np.float32).copy()
    x = ff(x, filt)
    # обрезаем тишину по краям и сдвигаем времена слов
    nz = np.where(np.abs(x) > 0.01)[0]
    a0 = max(0, nz[0] - 400) if len(nz) else 0
    x = x[a0: (nz[-1] + 2000) if len(nz) else len(x)]
    times = [max(0.0, w[1] * k - a0 / SR) for w in words]
    return x / (np.max(np.abs(x)) + 1e-9) * 0.9, times


tl = json.load(open(os.path.join(HERE, 'timeline.json')))
t = 0.35
voice_track = []
for sc in tl['scenes']:
    sc['t0'] = t - (0.0 if sc['id'] == 1 else 0.15)
    for card in sc['cards']:
        words = card['text'].split()
        spoken = card.get('say', ' '.join(w.split('#')[0] for w in words))
        a, wt = say(spoken.replace('…', '...').replace(' —', ','), card.get('voice', 'main'))
        d = len(a) / SR
        voice_track.append((t, a))
        card['t0'], card['t1'] = t, t + d
        # слова субтитров: точное время из сервиса, если число слов совпало; иначе — по длине слов
        real = [w for w in words if any(ch.isalnum() for ch in w)]
        if wt and len(wt) == len(real):
            it, starts, last = iter(wt), [], t
            for w in words:
                if any(ch.isalnum() for ch in w):
                    last = t + next(it)
                starts.append(last)
        else:
            lens = np.array([len(w.split('#')[0]) + 2 for w in words], float)
            starts = t + 0.04 + np.concatenate([[0], np.cumsum(lens)[:-1]]) / lens.sum() * d * 0.92
        card['words'] = [{'w': w.split('#')[0], 'c': (w.split('#') + [''])[1], 't': float(s)} for w, s in zip(words, starts)]
        t += d + card['pause']
    sc['t1'] = t - 0.15
    sc['t1'] = max(sc['t1'], sc['cards'][-1]['t1'] + 0.2)
for a, b in zip(tl['scenes'], tl['scenes'][1:]):
    a['t1'] = b['t0']
tl['outroT0'] = tl['scenes'][-1]['t1']
tl['dur'] = tl['outroT0'] + tl['outro']['dur']
N = int(tl['dur'] * SR) + SR

# ---------- синтез звуков ----------
def env(n, a=0.005, r=0.2):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e

def tone(f, d, wave_='sine'):
    tt = np.arange(int(d * SR)) / SR
    if wave_ == 'square': return np.sign(np.sin(2 * np.pi * f * tt)) * 0.5
    return np.sin(2 * np.pi * f * tt)

def ring():  # двухтональный советский домофон
    a = np.concatenate([tone(880, 0.18, 'square'), tone(660, 0.18, 'square')]) * 0.35
    return ff(a * env(len(a), 0.005, 0.03), 'lowpass=f=2500,highpass=f=300,aecho=0.8:0.6:40:0.3')

def hit():
    tt = np.arange(int(1.6 * SR)) / SR
    f = 55 * np.exp(-tt * 1.5) + 32
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.2)
    n = rng.standard_normal(len(tt)) * np.exp(-tt * 18) * 0.4
    return ff(x + n, 'lowpass=f=900,aecho=0.8:0.7:90|180:0.3|0.2') * 0.9

def whoosh(d=0.55):
    n = rng.standard_normal(int(d * SR)); e = np.sin(np.linspace(0, np.pi, len(n))) ** 2
    return ff(n * e, 'bandpass=f=1200:w=1800,lowpass=f=4000') * 0.35

def knock():
    out = np.zeros(int(0.9 * SR))
    for k, o in enumerate([0, 0.22, 0.44]):
        tt = np.arange(int(0.18 * SR)) / SR
        x = (np.sin(2 * np.pi * 90 * tt) + rng.standard_normal(len(tt)) * 0.3) * np.exp(-tt * 35)
        i = int(o * SR); out[i:i + len(x)] += x
    return ff(out, 'lowpass=f=600,aecho=0.8:0.5:60:0.3') * 0.9

def creak(d=1.2):
    tt = np.arange(int(d * SR)) / SR
    f = 180 + 60 * np.sin(2 * np.pi * 0.8 * tt) + 30 * rng.standard_normal(len(tt)).cumsum() / SR
    x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * (0.5 + 0.5 * np.sin(2 * np.pi * 23 * tt))
    return ff(x * env(len(x), 0.1, 0.3), 'bandpass=f=900:w=600') * 0.18

def click(f=2500):
    tt = np.arange(int(0.03 * SR)) / SR
    return np.sin(2 * np.pi * f * tt) * np.exp(-tt * 300) * 0.4

def scratch(d=1.4):
    n = rng.standard_normal(int(d * SR)); tt = np.arange(len(n)) / SR
    am = (np.sin(2 * np.pi * 3.5 * tt) > 0.2).astype(float)
    return ff(n * am, 'bandpass=f=3000:w=2000') * 0.12

def keys():
    out = np.zeros(int(0.6 * SR))
    for i in range(7):
        c = np.sin(2 * np.pi * rng.uniform(3000, 6000) * np.arange(int(0.08 * SR)) / SR) * np.exp(-np.arange(int(0.08 * SR)) / SR * 60)
        o = int(rng.uniform(0, 0.5) * SR); out[o:o + len(c)] += c * 0.15
    return out

def drop():
    tt = np.arange(int(0.4 * SR)) / SR
    x = (np.sin(2 * np.pi * 220 * tt) + rng.standard_normal(len(tt)) * 0.5) * np.exp(-tt * 25)
    return ff(x, 'lowpass=f=1500') * 0.7

def fall():
    tt = np.arange(int(1.2 * SR)) / SR
    f = 900 * np.exp(-tt * 2.2) + 60
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.2 * np.linspace(0.3, 1, len(tt))
    return np.concatenate([x, hit() * 0.8])

def pickup():
    return np.concatenate([click(1200) * 2, np.zeros(int(0.05 * SR)), click(800)])

def nail():
    return np.concatenate([creak(0.8) * 2.5, click(4000) * 2])

def plank():
    return np.concatenate([creak(0.35) * 2, np.zeros(int(0.25 * SR)), knock()[:int(0.25 * SR)] * 1.5])

def chain():
    out = np.zeros(int(0.8 * SR))
    for i in range(10):
        c = click(rng.uniform(2500, 5000)) * 0.8; o = int((i * 0.06 + rng.uniform(0, 0.02)) * SR); out[o:o + len(c)] += c
    return out

def sticker():
    return ff(rng.standard_normal(int(0.12 * SR)) * env(int(0.12 * SR), 0.002, 0.08), 'highpass=f=1500') * 0.25

SFX = dict(ring=ring, hit=hit, whoosh=whoosh, knock=knock, creak=creak, scratch=scratch, keys=keys, drop=drop,
           fall=fall, pickup=pickup, nail=nail, plank=plank, chain=chain, sticker=sticker,
           tick=lambda: np.concatenate([click(3000), np.zeros(int(0.45 * SR)), click(3000)]),
           clicks=lambda: np.concatenate([np.concatenate([click(1800), np.zeros(int(0.07 * SR))]) for _ in range(12)]))

sfx = np.zeros(N)
def put(buf, x, at, g=1.0):
    i = int(at * SR)
    if i < 0: x, i = x[-i:], 0
    x = x[:len(buf) - i]; buf[i:i + len(x)] += x * g

cache = {}
for sc in tl['scenes']:
    sc['ev'] = {}
    for kind, ci, off in sc['sfx']:
        at = sc['cards'][ci]['t0'] + off
        if kind == 'rings9':
            span = sc['cards'][3]['t0'] - sc['cards'][0]['t0'] - 0.4
            times = [sc['cards'][0]['t0'] + 0.2 + k * span / 9 for k in range(9)]
            for x in times: put(sfx, cache.setdefault('ring', ring()), x, 0.7)
            sc['ev']['rings9'] = times
            continue
        if kind not in cache or kind in ('creak',): cache[kind] = SFX[kind]()
        put(sfx, cache[kind], at, 0.8 if kind != 'hit' else 1.0)
        sc['ev'].setdefault(kind, []).append(at)
    if sc['id'] > 1 and not any(k == 'whoosh' for k, _, _ in sc['sfx']):
        put(sfx, whoosh(), sc['t0'] - 0.2, 1)
put(sfx, hit(), tl['outroT0'] + 0.25, 1.0)

# ---------- музыка: тёмный пэд в ре-миноре + пульс ----------
fit = lambda x: np.pad(x, (0, max(0, N - len(x))))[:N]
tt = np.arange(N) / SR
music = np.zeros(N)
chords = [[73.42, 87.31, 110.0], [69.30, 87.31, 103.83], [65.41, 82.41, 98.0], [58.27, 73.42, 87.31]]
seg = 8.0
for k, ch in enumerate(chords * int(np.ceil(tl['dur'] / seg / 4) + 1)):
    a, b = int(k * seg * SR), int((k + 1) * seg * SR) + SR
    if a >= N: break
    b = min(b, N); x = tt[a:b] - tt[a]
    e = np.minimum(1, x / 1.5) * np.minimum(1, (x[-1] - x) / 1.5 + 0.0001)
    for f in ch:
        for det in (-0.6, 0.6):
            music[a:b] += np.sin(2 * np.pi * (f * 2 + det) * x + np.sin(2 * np.pi * 0.2 * x)) * 0.05 * e
music += np.sin(2 * np.pi * 36.71 * tt) * 0.12 * (0.7 + 0.3 * np.sin(2 * np.pi * 0.05 * tt))
music += fit(ff(rng.standard_normal(N) * 0.04, 'lowpass=f=400'))
beat = 60 / 64
for k in range(int(tl['dur'] / beat)):
    tb = np.arange(int(0.35 * SR)) / SR
    put(music, np.sin(2 * np.pi * (50 * np.exp(-tb * 8) + 38) * tb) * np.exp(-tb * 9) * 0.35, k * beat)
    if k % 2: put(music, click(5000) * 0.12, k * beat + beat / 2)
music = fit(ff(music, 'lowpass=f=2200,aecho=0.8:0.6:300:0.3'))
# провалы музыки на ударных моментах
duck = np.ones(N)
for sc in tl['scenes']:
    if sc['id'] in (5, 14):
        at = sc['ev']['hit'][-1] if sc['id'] == 5 else sc['ev']['hit'][0]
        i = int((at - 0.1) * SR); duck[i:i + int(0.6 * SR)] = 0.1
music *= duck
music[int(tl['outroT0'] * SR):] *= np.linspace(1, 0.2, N - int(tl['outroT0'] * SR))

voice = np.zeros(N)
for at, a in voice_track: put(voice, a, at)
# сайдчейн: музыка ниже под голосом
venv = np.convolve(np.abs(voice), np.ones(2205) / 2205, 'same')
music *= 1 - 0.45 * np.clip(venv * 8, 0, 1)
mix = voice * 0.95 + music * 0.55 + sfx * 0.6
mix = fit(ff(mix, 'alimiter=limit=0.89,loudnorm=I=-14:TP=-1.5:LRA=9'))
mix = np.clip(mix, -1, 1)
with wave.open(os.path.join(OUT, 'audio.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix[:int(tl['dur'] * SR)] * 32767).astype(np.int16).tobytes())
with open(os.path.join(OUT, 'timeline.js'), 'w') as f:
    f.write('window.TL = ' + json.dumps(tl, ensure_ascii=False) + ';\n')
print('duration', round(tl['dur'], 2))
