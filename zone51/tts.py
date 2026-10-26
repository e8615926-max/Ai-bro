"""Синтез голосов через RHVoice -> build/voice/<id>.wav (44.1 кГц моно) + огибающая для липсинка."""
import json, os, subprocess, wave
import numpy as np
from lines import LINES, SPEAKERS

OUT = os.path.join(os.path.dirname(__file__), "build", "voice")
SR = 44100
FPS = 30


def read_wav(path):
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return a


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for lid, spk, _sub, text in LINES:
        s = SPEAKERS[spk]
        raw = os.path.join(OUT, lid + "_raw.wav")
        fin = os.path.join(OUT, lid + ".wav")
        subprocess.run(["RHVoice-test", "-p", s["voice"], "-r", str(s["rate"]), "-t", str(s["pitch"]), "-o", raw],
                       input=text.encode(), check=True)
        # голос: ресемпл, лёгкая компрессия/эквализация, громкость
        af = "highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=7"
        if lid == "c4":  # крик — обрываем на полуслове
            af = "highpass=f=90,volume=2.2,alimiter=limit=0.9," + af
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", af, "-ar", str(SR), "-ac", "1", fin], check=True)
        a = read_wav(fin)
        # обрезаем тишину по краям
        idx = np.where(np.abs(a) > 0.02)[0]
        a = a[max(0, idx[0] - 800): idx[-1] + 2000]
        if lid == "c4":
            a = a[: int(len(a) * 0.97)]
        np.save(os.path.join(OUT, lid + ".npy"), a)
        hop = SR // FPS
        env = [float(np.sqrt(np.mean(a[i:i + hop] ** 2))) for i in range(0, len(a), hop)]
        m = max(env) or 1
        meta[lid] = dict(dur=len(a) / SR, env=[round(e / m, 3) for e in env])
        print(lid, round(len(a) / SR, 2))
    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump(meta, f)


if __name__ == "__main__":
    main()
