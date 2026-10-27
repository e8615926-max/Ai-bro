"""Синтез голосов нейросетью Piper (VITS) + сдвиг высоты (rubberband) -> build/voice/<id>.npy + огибающая для липсинка.
Модели: github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models (vits-piper-ru_RU-{denis,dmitri,irina,ruslan}-medium),
путь задаётся переменной PIPER_MODELS (по умолчанию /home/user/models)."""
import json, os, subprocess, wave
import numpy as np
from piper import PiperVoice, SynthesisConfig
from lines import LINES, SPEAKERS

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build", "voice")
MODELS = os.environ.get("PIPER_MODELS", "/home/user/models")
SR = 44100
FPS = 30
_voices = {}


def voice(name):
    if name not in _voices:
        _voices[name] = PiperVoice.load(f"{MODELS}/vits-piper-ru_RU-{name}-medium/ru_RU-{name}-medium.onnx")
    return _voices[name]


def read_wav(path):
    with wave.open(path) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768


def synth_seg(spk, text, speed, pitch, gain, tmp):
    s = SPEAKERS[spk]
    raw = tmp + "_raw.wav"
    with wave.open(raw, "wb") as w:
        voice(s["model"]).synthesize_wav(text, w, syn_config=SynthesisConfig(length_scale=1 / (s["speed"] * speed), noise_scale=s["noise"], noise_w_scale=0.9))
    p = s["pitch"] + pitch
    fl = "rubberband=pitch=%.5f:formant=%s:pitchq=quality" % (2 ** (p / 12), "preserved" if s.get("formant", True) else "shifted")
    out = tmp + ".wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", fl + ",volume=%.1fdB" % gain, "-ar", str(SR), "-ac", "1", out], check=True)
    a = read_wav(out)
    idx = np.where(np.abs(a) > 0.015)[0]
    return a[max(0, idx[0] - 600): idx[-1] + 1500] if len(idx) else a


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for lid, spk, _sub, segs, opt in LINES:
        if not segs:
            continue
        parts = []
        for k, (text, sp, p, g) in enumerate(segs):
            parts.append(synth_seg(spk, text, sp, p, g, os.path.join(OUT, "%s_%d" % (lid, k))))
            gap = 0.5 if text.rstrip().endswith(("...", "..")) else 0.22
            parts.append(np.zeros(int(gap * SR), np.float32))
        a = np.concatenate(parts[:-1])
        if "stretch" in opt:
            tmp = os.path.join(OUT, lid + "_st")
            import soundfile as sf
            sf.write(tmp + "_in.wav", a, SR)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp + "_in.wav", "-af", "rubberband=tempo=%.3f:pitchq=quality" % (1 / opt["stretch"]), tmp + ".wav"], check=True)
            a = read_wav(tmp + ".wav")
        if "cut" in opt:
            a = a[: int(len(a) * opt["cut"])]
            a[-400:] *= np.linspace(1, 0, 400)
        # выравнивание громкости реплик (RMS по озвученным участкам)
        voiced = a[np.abs(a) > 0.02]
        a = a * (0.11 / (np.sqrt(np.mean(voiced ** 2)) + 1e-6))
        a = np.tanh(a * 1.2) / 1.2
        np.save(os.path.join(OUT, lid + ".npy"), a.astype(np.float32))
        hop = SR // FPS
        env = [float(np.sqrt(np.mean(a[i:i + hop] ** 2))) for i in range(0, len(a), hop)]
        m = max(env) or 1
        meta[lid] = dict(dur=len(a) / SR, env=[round(e / m, 3) for e in env])
        print(lid, round(len(a) / SR, 2))
    meta["k1"] = dict(dur=0.9, env=[0.0] * 27)
    for f in os.listdir(OUT):
        if f.endswith(".wav"):
            os.remove(os.path.join(OUT, f))
    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump(meta, f)


if __name__ == "__main__":
    main()
