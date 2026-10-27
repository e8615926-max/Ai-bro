"""Монтаж: времена планов, реплик и событий (секунды). Всё считается от длительности озвучки."""
import json, os
from lines import LINES

FPS = 30
_meta = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "build", "voice", "meta.json")))
SUBS = {l[0]: (l[1], l[2]) for l in LINES}
FX = {l[0]: l[4] for l in LINES}

LINE = {}     # id -> (start, dur)
SHOTS = []    # (name, start, end)
EV = {}       # именованные моменты
_t = 0.0


def dur(lid):
    return _meta[lid]["dur"]


def say(lid, gap=0.25, at=None):
    global _t
    if at is not None:
        _t = at
    LINE[lid] = (_t, dur(lid))
    _t += dur(lid) + gap
    return LINE[lid]


def wait(d):
    global _t
    _t += d


def mark(name, off=0.0):
    EV[name] = _t + off
    return EV[name]


def shot(name, start, end=None):
    if SHOTS and SHOTS[-1][2] is None:
        n, s, _ = SHOTS[-1]
        SHOTS[-1] = (n, s, start)
    SHOTS.append((name, start, end))


# 1. комната, Андрей смотрит телевизор
shot("room_intro", 0.0)
EV["sip"] = 2.2
_t = 5.0
# 2. телевизор, наезд в экран
shot("tv", _t)
EV["intro"] = 5.5
_t = 10.5
# 3. студия
shot("studio", _t)
wait(0.4)
say("e1", 0.35); say("e2", 0.3); say("e3", 0.4); say("e4", 0.3)
mark("to_field")
wait(0.2)
# 4. репортаж
shot("report", _t)
wait(0.7)
say("l1", 0.45); say("l2", 0.15)
mark("tilt0"); wait(0.5)
say("s1", 0.25)
mark("tilt1")
say("l3", 0.2)
mark("zoom0")                     # Сэм отходит влево и приближает ворота
say("l4", 0.6)
mark("zoom1")
say("l5", 0.2)
mark("turn", -0.9)
wait(0.4)
# 5. идут к зоне, Кларкс встаёт перед Элли
shot("walk", _t)
mark("walk0")
mark("clark_in", 1.0)
wait(2.3)
say("c1", 0.3)
# 6. перепалка
shot("standoff", _t)
say("l6", 0.2); say("c2", 0.2); say("l7", 0.25); say("c3", 0.25); say("l8", 0.1); say("c4", 0.0)
mark("boom", -0.05)
# 7. взрыв
B = EV["boom"]
shot("explosion", B)
EV.update(epan0=B + 0.5, epan1=B + 2.0, turn_bg=B + 0.6, mic_drop=B + 0.4, growl=B + 2.2, mutants=B + 2.4, draw=B + 3.4, shots0=B + 3.9)
_t = B + 7.2
# 8. «Уходим отсюда!»
shot("flee", _t)
say("l9", 0.3, at=_t + 0.55)
wait(0.7)
mark("whip", -0.6)
# 9. бегство
shot("run", _t)
R0 = _t
EV.update(spider=R0 + 2.4, drop=R0 + 3.6, hit=R0 + 4.3)
say("s2", 0.0, at=R0 + 3.75)
_t = EV["hit"]
# 10. камера падает, трещина, помехи, крик Элли
shot("fall", _t)
say("l10", 0.2, at=_t + 1.4)
EV["growl2"] = EV["hit"] + 3.0
_t = EV["hit"] + 4.6
shot("nosignal", _t)
_t += 2.2
# 11. снова студия
shot("studio2", _t)
wait(0.6)
say("e5", 0.5)
mark("smile_turn", -0.2)
say("e6", 0.35)
# 12. реклама
shot("ad", _t)
AD0 = _t
say("b1", 0.3, at=AD0 + 3.2)
_t = AD0 + 7.0
# 13. отъезд от экрана
shot("tv_out", _t)
_t += 3.2
# 14. комната: Андрей, кот, встаёт
shot("room2", _t)
wait(0.5)
say("a1", 0.5)
mark("look_cat", -0.2)
say("a2", 0.3)
LINE["k1"] = (_t, dur("k1")); EV["meow"] = _t; wait(dur("k1") + 0.4)
say("a3", 0.3)
mark("put_beer"); wait(0.9)
mark("stand0"); wait(1.4)
mark("stand1")
# 15. поворот камеры влево: дверной проём, выходит Саша
mark("pan0"); wait(2.0); mark("pan1")
mark("sasha_in", -0.6)
wait(1.6)
mark("sasha_stop")
say("x1", 0.3)
say("a4", 0.0)
mark("knock", -0.1)
wait(0.7)
say("x2", 0.2)
mark("sasha_out")
wait(1.6)
mark("andrey_go", -1.0)
wait(0.6)
# 16. прихожая
shot("hall", _t)
H0 = _t
mark("hall_walk0"); wait(2.0); mark("hall_walk1")
say("a5", 0.3)
say("u1", 0.4)
mark("peep", -0.1)
# 17. глазок
shot("peephole", _t)
_t += 3.2
# 18. прихожая: мама заходит
shot("hall2", _t)
mark("door_open0"); wait(1.0); mark("door_open1")
say("a6", 0.3)
mark("mama_in0", -1.6); mark("mama_in1", -0.2)
say("m1", 0.3)
say("a7", 0.25)
say("m2", 0.2)
mark("mama_go"); wait(1.6); mark("door_close0"); wait(0.8); mark("door_close1")
mark("sigh"); wait(1.3)
mark("toilet0"); wait(1.6); mark("toilet1")
say("x3", 0.3)
say("a8", 0.4)
say("x4", 0.7)
mark("creep0")
say("a9", 0.6)
wait(1.4)
shot("end_card", _t)
_t += 4.5
SHOTS[-1] = (SHOTS[-1][0], SHOTS[-1][1], _t)
TOTAL = _t


def speaking(t):
    for lid, (s, d) in LINE.items():
        if s <= t < s + d:
            return lid, t - s
    return None


def mouth(spk_ids, t):
    sp = speaking(t)
    if not sp:
        return 0.0
    lid, lt = sp
    if SUBS[lid][0] not in spk_ids:
        return 0.0
    env = _meta[lid]["env"]
    i = int(lt * FPS)
    if i >= len(env):
        return 0.0
    v = 0.6 * env[i] + 0.4 * (env[i - 1] if i > 0 else 0)
    return min(1.0, max(0.0, (v - 0.1) * 1.6))


def talking(spk, t):
    sp = speaking(t)
    return bool(sp) and SUBS[sp[0]][0] == spk


def blink(t, seed=0):
    """Естественное моргание: ~раз в 3-4 с, длительность 0.15 с."""
    period = 3.1 + (seed * 0.37) % 1.3
    ph = (t + seed * 1.7) % period
    return max(0.0, 1 - abs(ph - 0.075) / 0.075) if ph < 0.15 else 0.0


if __name__ == "__main__":
    for s in SHOTS:
        print("%-11s %7.2f %7.2f (%.2f)" % (s[0], s[1], s[2], s[2] - s[1]))
    print("TOTAL", round(TOTAL, 2))
