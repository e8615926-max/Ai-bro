"""Планы в комнате: начало (Андрей смотрит новости) и вторая часть (кот, Саша, стук в дверь)."""
import math
import numpy as np
import human as Hm
import cast as C
import timeline as TL
from gfx import ease
from room import Room, andrey_seated, armrest_local, beer_mug, cat, ANDREY_SC, A_X, A_TOP, DOOR

EV = TL.EV


def lerp(a, b, u):
    return a + (b - a) * u


def ramp(t, t0, t1):
    return ease((t - t0) / max(1e-3, t1 - t0))


class RoomScenes:
    def __init__(self):
        self.room = Room()

    # ------------------------------------------------------------------
    def intro(self, t):
        lt = t
        w = lerp(1060, 940, ease(lt / 5.0))

        def actors(c, k, X0, Y0):
            cat(c, (720 - X0) * k, (1100 - Y0) * k, 1.2 * k, t)
            sip = 0.0
            s0 = EV["sip"]
            if s0 < t < s0 + 1.6:
                sip = math.sin(math.pi * (t - s0) / 1.6) ** 0.7
            rest = armrest_local(X0, Y0, k)
            rest = (rest[0] + 40, rest[1] - 40)
            mouth = (-50, 150)
            tgt = (lerp(rest[0], mouth[0], sip), lerp(rest[1], mouth[1], sip))
            face = dict(turn=-0.55, gaze=-0.9, blink=TL.blink(t, 1), smile=-0.1, gy=0.1)
            andrey_seated(c, k, X0, Y0, t, face, {"ik": tgt})
        return self.room.view(t, 520, 960, w, actors)

    # ------------------------------------------------------------------
    def part2(self, t):
        R = self.room
        # камера
        pan = ramp(t, EV["pan0"], EV["pan1"])
        cx = lerp(510, -90, pan)
        w = lerp(980, 1250, pan)
        cy = lerp(960, 930, pan)
        if t > EV["andrey_go"]:
            cx = lerp(-90, -260, ramp(t, EV["andrey_go"], EV["andrey_go"] + 1.6))
        door_l = ramp(t, EV["sasha_in"] - 0.8, EV["sasha_in"] - 0.4) * 0.9

        def actors(c, k, X0, Y0):
            # кот
            look_cat = t > EV["look_cat"]
            head = ramp(t, EV["meow"] - 0.5, EV["meow"]) * (1 - 0.6 * ramp(t, EV["meow"] + 2.5, EV["meow"] + 3.5))
            eyes = 0.0
            if t > EV["meow"] - 0.4:
                eyes = 1.0 - 0.5 * ramp(t, EV["meow"] + 2.5, EV["meow"] + 3.5)
                if TL.blink(t, 7) > 0.5:
                    eyes = 0.1
            mw = 0.0
            m0 = EV["meow"]
            if m0 < t < m0 + 0.8:
                mw = math.sin(math.pi * (t - m0) / 0.8)
            cat(c, (720 - X0) * k, (1100 - Y0) * k, 1.2 * k, t, head_up=head, eyes=eyes, meow=mw, look=-1.0 if head > 0 else 0.0)
            # Андрей
            mo = TL.mouth(["andrey"], t)
            stand = ramp(t, EV["stand0"] + 0.4, EV["stand1"])
            leg_down = ramp(t, EV["stand0"], EV["stand0"] + 0.5)
            put = ramp(t, EV["put_beer"], EV["put_beer"] + 0.6)
            after = t > EV["put_beer"] + 0.6
            rest = armrest_local(X0, Y0, k, stand)
            hold = (rest[0] + 40, rest[1] - 40)
            if not after:
                hand_r = {"ik": (lerp(hold[0], rest[0] + 60, put), lerp(hold[1], rest[1] - 50, put))}
            else:
                back = ramp(t, EV["put_beer"] + 0.6, EV["put_beer"] + 1.0)
                hand_r = {"ik": (lerp(rest[0] + 60, -150, back), lerp(rest[1] - 40, 900, back))}
            # куда смотрит
            turn, gaze, smile, brows = -0.55, -0.9, 0.0, 0.0
            if TL.talking("andrey", t) and t < EV["look_cat"]:
                brows, smile = -0.4, -0.4
            if look_cat and t < EV["stand0"]:
                turn, gaze, smile = 0.55, 1.0, 0.45
            if t > EV["stand0"]:
                turn, gaze = -0.2, -0.5
            if t > EV["sasha_in"] + 0.6:
                turn, gaze, smile = -0.6, -1.0, 0.0
            if TL.LINE["a4"][0] < t < EV["knock"]:
                smile = 0.5
            if EV["knock"] < t < EV["knock"] + 1.0:
                turn, gaze, brows = -0.8, -1.0, 0.8
            face = dict(turn=turn, gaze=gaze, blink=TL.blink(t, 1), mouth=mo, smile=smile, brows=brows)
            if after:
                ax, ay = armrest_local(X0, Y0, k, 0)
                beer_mug(c, (75 + 60 * ANDREY_SC - X0) * k, (950 - Y0) * k, ANDREY_SC * k, -1)
            walk0 = EV["andrey_go"]
            if t < walk0:
                andrey_seated(c, k, X0, Y0, t, face, hand_r, mug=not after, stand=stand, leg_down=leg_down,
                              hand_l=None if stand < 0.5 else {"ik": (150, 900)})
            else:
                u = (t - walk0)
                x = A_X + 30 - u * 520
                sc = ANDREY_SC * lerp(1.0, 0.86, min(1, u / 1.6))
                yfeet = lerp(A_TOP - 64 + 1700 * ANDREY_SC, 1450, min(1, u / 1.6))
                alpha_in = x > DOOR[0] + 40
                if alpha_in:
                    Hm.side(c.sub((x - X0) * k, (yfeet - 1700 * sc - Y0) * k, sc * k, -1), C.ANDREY,
                            dict(legs="walk", phase=u * 8.5, blink=TL.blink(t, 1)))
            # Саша
            si, ss, so = EV["sasha_in"], EV["sasha_stop"], EV["sasha_out"]
            if si < t < so + 1.5:
                ux = DOOR[0] + 130
                if t < ss:
                    u = (t - si) / (ss - si)
                    x = lerp(ux, -170, u)
                    yfeet = lerp(1400, 1530, u)
                    sc = lerp(0.5, 0.56, u)
                    Hm.side(c.sub((x - X0) * k, (yfeet - 1700 * sc - Y0) * k, sc * k), C.SASHA, dict(legs="walk", phase=(t - si) * 8.0, blink=TL.blink(t, 3)))
                elif t < so:
                    sc = 0.56
                    mo2 = TL.mouth(["sasha"], t)
                    tr, gz, br, sm = 0.55, 0.95, -0.5, -0.3
                    if EV["knock"] < t < EV["knock"] + 1.2:
                        tr, gz, br, sm = -0.7, -1.0, 0.7, 0.0
                    if TL.talking("sasha", t) and t > TL.LINE["x2"][0]:
                        tr, gz, br = 0.4, 0.9, 0.0
                    point = TL.LINE["x1"][0] < t < TL.LINE["x1"][0] + 1.6
                    arms = ((10, 15), {"ik": (420, 520)} if point else (12, 20))
                    Hm.front(c.sub((-170 - X0) * k, (1530 - 1700 * sc - Y0) * k, sc * k), C.SASHA,
                             dict(face=dict(turn=tr, gaze=gz, blink=TL.blink(t, 3), mouth=mo2, brows=br, smile=sm), arms=arms, breath=math.sin(t * 1.7)))
                else:
                    u = min(1, (t - so) / 1.4)
                    x = lerp(-170, ux - 40, u)
                    yfeet = lerp(1530, 1395, u)
                    sc = lerp(0.56, 0.48, u)
                    if u < 0.98:
                        Hm.side(c.sub((x - X0) * k, (yfeet - 1700 * sc - Y0) * k, sc * k, -1), C.SASHA, dict(legs="walk", phase=(t - so) * 8.0))
        return R.view(t, cx, cy, w, actors, door_light=door_l)
