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


CAT = (770, 1036, 0.8)          # кот: мир x, y, масштаб — лежит ровно на сиденье
MUG_ON_ARM = (100, 966)          # где кружка стоит на подлокотнике (мир)


def mug_hold_local():
    """Кисть на ручке кружки, стоящей на подлокотнике (локальные коорд. Андрея)."""
    return ((MUG_ON_ARM[0] - A_X) / ANDREY_SC, (MUG_ON_ARM[1] - A_TOP) / ANDREY_SC)


def lerp2(a, b, u):
    return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)


def smooth_pulse(t, t0, up, hold, down):
    """0 -> 1 -> 0 с плавными разгоном и торможением."""
    if t < t0 or t > t0 + up + hold + down:
        return 0.0
    if t < t0 + up:
        return ease((t - t0) / up)
    if t < t0 + up + hold:
        return 1.0
    return 1 - ease((t - t0 - up - hold) / down)


class RoomScenes:
    def __init__(self):
        self.room = Room()

    def draw_cat(self, c, k, X0, Y0, t, **kw):
        cat(c, (CAT[0] - X0) * k, (CAT[1] - Y0) * k, CAT[2] * k, t, **kw)

    # ------------------------------------------------------------------
    def intro(self, t):
        w = lerp(1060, 940, ease(t / 5.0))

        def actors(c, k, X0, Y0):
            self.draw_cat(c, k, X0, Y0, t)
            sip = smooth_pulse(t, EV["sip"], 0.9, 0.7, 0.9)
            hold = mug_hold_local()
            tgt = lerp2(hold, (60, 300), sip)            # кружку к губам и обратно
            face = dict(turn=lerp(-0.55, -0.2, sip), gaze=lerp(-0.9, -0.6, sip), blink=TL.blink(t, 1), smile=-0.1, gy=lerp(0.1, -0.5, sip))
            andrey_seated(c, k, X0, Y0, t, face, {"ik": tgt})
        return self.room.view(t, 520, 960, w, actors)

    # ------------------------------------------------------------------
    def part2(self, t):
        R = self.room
        pan = ramp(t, EV["pan0"], EV["pan1"])
        cx = lerp(510, -90, pan)
        w = lerp(980, 1250, pan)
        cy = lerp(960, 930, pan)
        if t > EV["andrey_go"]:
            cx = lerp(-90, -260, ramp(t, EV["andrey_go"], EV["andrey_go"] + 1.6))
        door_l = ramp(t, EV["sasha_in"] - 0.8, EV["sasha_in"] - 0.4) * 0.9

        def actors(c, k, X0, Y0):
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
            self.draw_cat(c, k, X0, Y0, t, head_up=head, eyes=eyes, meow=mw, look=-1.0 if head > 0 else 0.0)
            # Андрей: кружка стоит на подлокотнике, рука на ручке; отпускает и кладёт руку на колено
            mo = TL.mouth(["andrey"], t)
            stand = ramp(t, EV["stand0"] + 0.2, EV["stand1"])
            pb = EV["put_beer"]
            released = t > pb + 0.35
            hold = mug_hold_local()
            lap = (-112, 1110)
            hang_r, hang_l = (-150, 930), (150, 930)
            if not released:
                hand_r = {"ik": hold}
            else:
                u = ramp(t, pb + 0.35, pb + 1.1)
                p = lerp2(lerp2(hold, (hold[0], hold[1] - 30), min(1, u * 3)), lap, u)
                hand_r = {"ik": lerp2(p, hang_r, stand)}
            hand_l = {"ik": lerp2((108, 1110), hang_l, stand)}
            turn, gaze, smile, brows = -0.55, -0.9, 0.0, 0.0
            if TL.talking("andrey", t) and t < EV["look_cat"]:
                brows, smile = -0.4, -0.4
            if look_cat and t < EV["stand0"]:
                q = ramp(t, EV["look_cat"], EV["look_cat"] + 0.35)
                turn, gaze, smile = lerp(-0.55, 0.55, q), lerp(-0.9, 1.0, q), 0.45 * q
            if t > EV["stand0"]:
                turn, gaze = -0.2, -0.5
            if t > EV["sasha_in"] + 0.6:
                turn, gaze, smile = -0.6, -1.0, 0.0
            if TL.LINE["a4"][0] < t < EV["knock"]:
                smile = 0.5
            if EV["knock"] < t < EV["knock"] + 1.0:
                turn, gaze, brows = -0.8, -1.0, 0.8
            face = dict(turn=turn, gaze=gaze, blink=TL.blink(t, 1), mouth=mo, smile=smile, brows=brows)
            if released:
                beer_mug(c, (MUG_ON_ARM[0] - X0) * k, (MUG_ON_ARM[1] - Y0) * k, ANDREY_SC * k, -1)
            walk0 = EV["andrey_go"]
            if t < walk0:
                andrey_seated(c, k, X0, Y0, t, face, hand_r, mug=not released, stand=stand, hand_l=hand_l)
            else:
                u = (t - walk0)
                x = A_X + 30 - u * 520
                sc = ANDREY_SC * lerp(1.0, 0.86, min(1, u / 1.6))
                yfeet = lerp(A_TOP - 64 + 1700 * ANDREY_SC, 1450, min(1, u / 1.6))
                if x > DOOR[0] + 40:
                    Hm.side(c.sub((x - X0) * k, (yfeet - 1700 * sc - Y0) * k, sc * k, -1), C.ANDREY,
                            dict(legs="walk", phase=(u * 520) / Hm.step_per_radian(1700 * sc), blink=TL.blink(t, 1)))
            # Саша
            si, ss, so = EV["sasha_in"], EV["sasha_stop"], EV["sasha_out"]
            if si < t < so + 1.5:
                ux = DOOR[0] + 130
                if t < ss:
                    u = (t - si) / (ss - si)
                    x = lerp(ux, -170, u)
                    yfeet = lerp(1400, 1530, u)
                    sc = lerp(0.5, 0.56, u)
                    Hm.side(c.sub((x - X0) * k, (yfeet - 1700 * sc - Y0) * k, sc * k), C.SASHA,
                            dict(legs="walk", phase=(x - ux) / Hm.step_per_radian(1700 * sc), blink=TL.blink(t, 3)))
                elif t < so:
                    sc = 0.56
                    mo2 = TL.mouth(["sasha"], t)
                    tr, gz, br, sm = 0.55, 0.95, -0.5, -0.3
                    if EV["knock"] < t < EV["knock"] + 1.2:
                        tr, gz, br, sm = -0.7, -1.0, 0.7, 0.0
                    if TL.talking("sasha", t) and t > TL.LINE["x2"][0]:
                        tr, gz, br = 0.4, 0.9, 0.0
                    x1 = TL.LINE["x1"][0]
                    pt = smooth_pulse(t, x1, 0.35, 1.0, 0.45)      # показывает на пиво
                    arm_r = {"ik": lerp2((150, 930), (420, 560), pt)}
                    Hm.front(c.sub((-170 - X0) * k, (1530 - 1700 * sc - Y0) * k, sc * k), C.SASHA,
                             dict(face=dict(turn=tr, gaze=gz, blink=TL.blink(t, 3), mouth=mo2, brows=br, smile=sm), arms=({"ik": (-150, 930)}, arm_r),
                                  hand_mode={1: "point" if pt > 0.6 else "relax"}, breath=math.sin(t * 1.7)))
                else:
                    u = min(1, (t - so) / 1.4)
                    x = lerp(-170, ux - 40, u)
                    yfeet = lerp(1530, 1395, u)
                    sc = lerp(0.56, 0.48, u)
                    if u < 0.98:
                        Hm.side(c.sub((x - X0) * k, (yfeet - 1700 * sc - Y0) * k, sc * k, -1), C.SASHA,
                                dict(legs="walk", phase=(-170 - x) / Hm.step_per_radian(1700 * sc)))
        return R.view(t, cx, cy, w, actors, door_light=door_l)
