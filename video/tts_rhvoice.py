"""Минимальный синтез через RHVoice (pip: rhvoice-wrapper, rhvoice-wrapper-bin) напрямую по ctypes."""
import ctypes, io, wave
import rhvoice_wrapper_bin as _b, rhvoice_wrapper_data as _d
from rhvoice_wrapper.rhvoice_proxy import Engine

_buf, _sr = bytearray(), [24000]
def _play(samples, count, user_data):
    _buf.extend(ctypes.string_at(samples, count * 2)); return 1
def _rate(r, user_data):
    _sr[0] = r; return 1
_e = Engine(lib_path=str(_b.lib_path))
_e.init(_play, _rate, data_path=str(_d.data_path), config_path=str(_d.data_path))

def synth(text, voice, rate=0.0, pitch=0.0):
    """Возвращает WAV (bytes)."""
    _buf.clear()
    _e.set_params(voice_profile=voice, absolute_rate=rate, absolute_pitch=pitch)
    _e.generate(text)
    out = io.BytesIO()
    with wave.open(out, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(_sr[0]); w.writeframes(bytes(_buf))
    return out.getvalue()
