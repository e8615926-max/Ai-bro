"""Монтаж: времена планов и реплик (секунды), вычисляются из длительности озвучки."""
import json, os
from lines import LINES, SPEAKERS

FPS = 30
_meta = json.load(open(os.path.join(os.path.dirname(__file__), "build", "voice", "meta.json")))
SUBS = {lid: (spk, sub) for lid, spk, sub, _ in LINES}

LINE = {}     # id -> (start, dur)
SHOTS = []    # (name, start, end)
EVENTS = {}   # именованные моменты
_t = 0.0


def say(lid, gap=0.25, at=None):
    global _t
    if at is not None:
        _t = at
    d = _meta[lid]["dur"]
    LINE[lid] = (_t, d)
    _t += d + gap
    return LINE[lid]


def shot(name, start, end):
    SHOTS.append((name, start, end))


# 1. Комната Андрея
shot("room", 0.0, 6.5)
# 2. Телевизор, наезд в экран (в эфире заставка)
EVENTS["intro"] = 7.0
shot("tv", 6.5, 12.0)
# 3. Студия
_t = 12.4
say("e1", 0.35)
say("e2", 0.25)
say("e3", 0.4)
say("e4", 0.3)
EVENTS["to_field"] = _t
shot("studio", 12.0, _t + 0.2)
# 4. Репортаж: камера снизу, потом поднимается
_t += 0.9
D0 = _t - 0.7
say("l1", 0.45)
say("l2", 0.2)
EVENTS["tilt0"] = _t - 0.1
_t += 0.5
say("s1", 0.25)
EVENTS["tilt1"] = _t
say("l3", 0.15)
say("l4", 0.35)
say("l5", 0.2)
EVENTS["turn"] = _t - 0.9
shot("report", D0, _t + 0.3)
# 5. Идут к зоне, полицейский преграждает путь
E0 = _t + 0.3
EVENTS["clark_in"] = E0 + 1.2
_t = E0 + 2.3
say("c1", 0.25)
shot("walk", E0, _t)
# 6. Перепалка
F0 = _t
say("l6", 0.15)
say("c2", 0.15)
say("l7", 0.2)
say("c3", 0.2)
say("l8", 0.05)
say("c4", 0.0)
EVENTS["boom"] = _t - 0.05
shot("standoff", F0, EVENTS["boom"])
# 7. Взрыв, мутанты, стрельба
G0 = EVENTS["boom"]
EVENTS["growl"] = G0 + 1.6
EVENTS["mutants"] = G0 + 2.0
EVENTS["draw"] = G0 + 3.2
EVENTS["shots0"] = G0 + 3.7
shot("explosion", G0, G0 + 6.6)
# 8. «Уходим отсюда, Сэм!»
H0 = G0 + 6.6
say("l9", 0.3, at=H0 + 0.35)
shot("flee", H0, _t + 0.3)
# 9. Бегство, человек-паук, помехи
I0 = _t + 0.3
EVENTS["spider"] = I0 + 2.6
EVENTS["hit"] = I0 + 3.9
shot("run", I0, EVENTS["hit"])
shot("static", EVENTS["hit"], EVENTS["hit"] + 2.4)
shot("offair", EVENTS["hit"] + 2.4, EVENTS["hit"] + 4.6)
# 10. Финал: снова комната, телевизор шипит
END0 = EVENTS["hit"] + 4.6
shot("room_end", END0, END0 + 5.0)
TOTAL = END0 + 5.0


def speaking(t):
    """(id, локальное время) текущей реплики или None."""
    for lid, (s, d) in LINE.items():
        if s <= t < s + d:
            return lid, t - s
    return None


def mouth(spk_ids, t):
    """Открытость рта для говорящего из списка (0..1)."""
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
    v = env[i]
    return min(1.0, max(0.0, (v - 0.12) * 1.5))


if __name__ == "__main__":
    for s in SHOTS:
        print("%-10s %6.2f %6.2f  (%.2f)" % (s[0], s[1], s[2], s[2] - s[1]))
    for k, v in LINE.items():
        print(k, round(v[0], 2), round(v[1], 2))
    print("TOTAL", round(TOTAL, 2))
