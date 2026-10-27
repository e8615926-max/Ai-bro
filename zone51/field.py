"""Полевые планы репортажа у Зоны 51 (персонажи — риг human.py)."""
import math, random
import numpy as np
from PIL import Image, ImageFilter
from gfx import Cv, to_f, to_im, vgrad, radial, ease, smooth_noise, glow_sprite, add_over, alpha_over, font, FONT_C, FONT_B
import human as Hm
import cast as C
import actors as A
import timeline as TL
from zone import Zone, W, H, HOR, police_car, news_van, _glow

AS = 2
EV = TL.EV


def lerp(a, b, u):
    return a + (b - a) * u


def ramp(t, t0, t1):
    return ease((t - t0) / max(1e-3, t1 - t0))


class Layer:
    """Слой персонажей с освещением: рисуем в 2x, сводим, подсвечиваем контур."""

    def __init__(self):
        self.c = Cv(W, H, AS)
        self.glows = []

    def put(self, out, mult=(1, 1, 1), tint=(0, 0, 0), rim=(1.0, 0.55, 0.25), rim_k=0.9, rim_dirs=((0, 10, 1.0), (7, 0, 0.55), (-7, 0, 0.55))):
        im = self.c.im.reduce(AS)
        a4 = np.asarray(im, np.float32) / 255
        a = a4[..., 3]
        if a.max() <= 0:
            return out
        rgb = a4[..., :3]
        r = np.zeros_like(a)
        for d in rim_dirs:
            sh = np.roll(np.roll(a, d[1], 0), d[0], 1)
            r = np.maximum(r, a * (1 - sh) * d[2])
        r = np.asarray(Image.fromarray((r * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), np.float32) / 255 * a
        lit = rgb * np.array(mult, np.float32) + np.array(tint, np.float32) + r[..., None] * np.array(rim, np.float32) * rim_k
        a3 = a[..., None]
        out[:] = out * (1 - a3) + lit * a3
        return out

    def emit(self, out):
        for x, y, rad, col, k in self.glows:
            add_over(out, _glow(rad, col), int(x - rad), int(y - rad), k)


def camera(out, dx=0.0, dy=0.0, rot=0.0, zoom=1.0):
    if abs(dx) < 0.3 and abs(dy) < 0.3 and abs(rot) < 0.01 and abs(zoom - 1) < 0.001:
        return out
    im = to_im(out)
    z = zoom * (1 + abs(rot) * 0.012 + (abs(dx) + abs(dy)) / 900)
    a = math.radians(rot)
    ca, sa = math.cos(a) / z, math.sin(a) / z
    cx, cy = W / 2, H / 2
    m = (ca, sa, cx - ca * (cx + dx) - sa * (cy + dy), -sa, ca, cy + sa * (cx + dx) - ca * (cy + dy))
    im = im.transform((W, H), Image.AFFINE, m, Image.BILINEAR)
    return np.asarray(im, np.float32) / 255


def shake(t, amp, freq=1.0, seed=0):
    return (smooth_noise(t * 7 * freq, seed) * amp, smooth_noise(t * 7 * freq, seed + 5) * amp, smooth_noise(t * 5 * freq, seed + 9) * amp * 0.04)


def motion_blur(out, dx, n=9):
    """Смаз по горизонтали (быстрый поворот камеры)."""
    if abs(dx) < 2:
        return out
    acc = np.zeros_like(out)
    for i in range(n):
        acc += np.roll(out, int(dx * (i / (n - 1) - 0.5)), 1)
    return acc / n


# --- реквизит ------------------------------------------------------------
def mic(c, p, ang, sc=1.0):
    """Микрофон: рисуется до кисти (кисть его обхватывает)."""
    x, y = p
    c.line([(x, y + 10), (x + 10, y - 120)], (30, 30, 34, 255), 26)
    c.circ(x + 12, y - 140, 32, (80, 80, 86, 255))
    for k in range(3):
        c.line([(x - 12, y - 150 + k * 10), (x + 36, y - 150 + k * 10)], (110, 110, 116, 255), 2)
    c.rect((x - 22, y - 106, x + 42, y - 54), (200, 20, 30, 255), r=6)
    if abs(c.sx) > 0.7 * c.s:
        c.text((x + 10, y - 80), "НД", 30, (255, 255, 255, 255), anchor="mm")


mic.under_hand = True


def smooth_pulse(t, t0, up, hold, down):
    if t < t0 or t > t0 + up + hold + down:
        return 0.0
    if t < t0 + up:
        return ease((t - t0) / up)
    if t < t0 + up + hold:
        return 1.0
    return 1 - ease((t - t0 - up - hold) / down)


def lerp2(a, b, u):
    return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)


def aim_elbows(c, L, recoil=0.0):
    """Со спины: руки вытянуты вперёд — видны локти, разведённые в стороны, предплечья скрыты корпусом."""
    for s_ in (-1, 1):
        sh_ = (s_ * 121 * L.width, 300)
        el = (s_ * 215 * L.width, 360 - recoil * 20)
        Hm.limb(c, sh_, el, 92 * L.width, 80 * L.width, L.top_col)
        Hm.limb(c, el, (s_ * 150 * L.width, 330 - recoil * 24), 80 * L.width, 70 * L.width, Hm.sh(L.top_col, 0.85))


def gun(c, p, ang):
    x, y = p
    c.rect((x - 10, y - 26, x + 80, y + 4), (18, 18, 20, 255), r=4)
    c.rect((x - 4, y - 6, x + 24, y + 50), (18, 18, 20, 255), r=4)


def flashlight(c, p, ang):
    x, y = p
    c.rect((x - 10, y - 14, x + 70, y + 14), (60, 60, 66, 255), r=6)


def stretcher(c, x, y, sc):
    c.rect((x - 160 * sc, y - 60 * sc, x + 160 * sc, y - 40 * sc), (230, 230, 236, 255), r=6 * sc)
    for xx in (x - 130 * sc, x + 130 * sc):
        c.line([(xx, y - 40 * sc), (xx, y)], (160, 160, 170, 255), 6 * sc)
        c.circ(xx, y, 10 * sc, (40, 40, 40, 255))


def person(L, look, view, wx, wfeet, hw, X0, Y0, k, p=None, fx=1.0, shadow=True):
    """Рисует персонажа в мировых координатах (ступни в wfeet, рост hw ед. мира)."""
    sc = hw / 1700 * k
    x, y = (wx - X0) * k, (wfeet - hw - Y0) * k
    if x < -600 * sc or x > W + 600 * sc or y > H + 50 or y + 1750 * sc < -50:
        return None
    if shadow:
        L.c.ell((x - 260 * sc, y + 1670 * sc, x + 260 * sc, y + 1760 * sc), (0, 0, 0, 120))
    sub = L.c.sub(x, y, sc, fx)
    fn = {"front": Hm.front, "back": Hm.back, "side": Hm.side}[view]
    return fn(sub, look, p or {})


def turn_person(L, look, wx, wfeet, hw, X0, Y0, k, u, p_front, p_back):
    """Разворот спереди -> спиной (сжатие по X)."""
    fx = abs(math.cos(min(1, max(0, u)) * math.pi)) * 0.94 + 0.06
    if u < 0.5:
        person(L, look, "front", wx, wfeet, hw, X0, Y0, k, p_front, fx)
    else:
        person(L, look, "back", wx, wfeet, hw, X0, Y0, k, p_back, fx)


def mutant_set(rnd, n):
    return [dict(x=rnd.uniform(330, 800), spawn=i * 0.3 + rnd.uniform(0, 0.25), var=i % 3, speed=rnd.uniform(26, 40), dx=rnd.uniform(-25, 25), ph=rnd.uniform(0, 6))
            for i in range(n)]


class Field:
    def __init__(self):
        self.z = Zone()
        rnd = random.Random(5)
        self.muts = mutant_set(rnd, 12)
        self.debris = [(rnd.uniform(0, 2 * math.pi), rnd.uniform(150, 600), rnd.uniform(0.5, 1.2), rnd.random() < 0.6) for _ in range(140)]
        self.sparks = [(rnd.uniform(-1.2, 1.2), rnd.uniform(300, 900), rnd.uniform(0.6, 1.6)) for _ in range(80)]
        self.road, self.road_lights = self._road()
        self.corpse = self._corpse()

    # ---------- задний план для бегства (камера смотрит от пожара) ----------
    def _road(self):
        rnd = random.Random(9)
        s = 2
        Wd, Hd = 1200, 2100
        c = Cv(Wd, Hd, s, (0, 0, 0, 255))
        sky = vgrad(Wd * s, 900 * s, [(0, (4, 6, 20)), (0.8, (14, 18, 40)), (1, (34, 30, 50))])
        c.im.paste(to_im(sky).convert("RGBA"), (0, 0))
        for _ in range(160):
            c.circ(rnd.uniform(0, Wd), rnd.uniform(0, 700), rnd.choice((1, 1.5, 2)), (255, 250, 240, rnd.randint(80, 230)))
        pts = [(0, 900)] + [(x, 860 - 40 * abs(math.sin(x * 0.006)) - 20 * rnd.random()) for x in range(0, Wd + 40, 40)] + [(Wd, 900)]
        c.poly(pts, (16, 14, 26, 255))
        for i in range(40):
            y0 = 900 + (i / 40) ** 1.5 * 1200
            y1 = 900 + ((i + 1) / 40) ** 1.5 * 1200
            v = i / 40
            c.rect((0, y0, Wd, y1 + 1), (int(30 + 90 * v ** 1.5), int(24 + 50 * v ** 1.5), int(26 + 20 * v), 255))
        c.poly([(580, 900), (620, 900), (1500, Hd), (-300, Hd)], (40, 34, 38, 255))
        for k in range(12):
            a = (k / 12) ** 1.7
            b = ((k + 0.45) / 12) ** 1.7
            ya, yb = 900 + a * 1200, 900 + b * 1200
            wa, wb = 2 + a * 28, 2 + b * 28
            c.poly([(600 - wa / 2, ya), (600 + wa / 2, ya), (600 + wb / 2, yb), (600 - wb / 2, yb)], (200, 170, 70, 255))
        for x in range(40, Wd, 120):
            c.circ(x + rnd.uniform(-20, 20), 905, 3, (255, 220, 160, 255))
        lights = []
        lights += police_car(c, 260, 1060, 0.7, 1)
        lights += police_car(c, 980, 1120, 0.85, -1)
        lights += news_van(c, 800, 990, 0.6)
        # кровь на дороге
        for k in range(26):
            x = 520 + rnd.uniform(-160, 200)
            y = 1350 + rnd.uniform(-60, 260)
            r = rnd.uniform(6, 26)
            c.ell((x - r * 1.6, y - r * 0.6, x + r * 1.6, y + r * 0.6), (110 + rnd.randint(0, 30), 8, 12, 230))
        c.ell((300, 1440, 560, 1540), (90, 6, 10, 240))
        c.poly([(560, 1490), (640, 1470), (760, 1500), (700, 1520)], (100, 8, 10, 220))
        for _ in range(60):
            y = 920 + rnd.random() ** 1.4 * 1150
            x = rnd.uniform(0, Wd)
            if abs(x - 600) < 30 + (y - 900) * 0.8:
                continue
            r = 2 + (y - 900) / 1200 * 20
            c.ell((x - r * 1.4, y - r, x + r * 1.4, y), (30, 22, 20, 255))
        return to_f(c.result(s)), lights

    def _corpse(self):
        """Лежащий полицейский (риг сбоку, повернут на 90°)."""
        c = Cv(900, 1900, 1.0)
        Hm.side(c.sub(450, 60, 1.0), C.COP3, dict(legs="stand", blink=1.0, arm=(150, 30)))
        im = c.im.rotate(90, expand=True, resample=Image.BICUBIC)
        return im

    # ---------------------------------------------------------------------
    def bg_people(self, L, t, X0, Y0, k, phase="calm"):
        """Люди у ворот: двое полицейских, химзащита и пожарные заходят, врачи у скорой.
        phase: calm | turned (смотрят на взрыв) | panic (бегут/стреляют)."""
        tb = t - EV["boom"]
        turned = t > EV["turn_bg"]
        tu = ramp(t, EV["turn_bg"], EV["turn_bg"] + 0.4)
        cop_hw = 100
        for i, (wx, look) in enumerate(((470, C.COP2), (612, C.COP3))):
            if t > EV["boom"] + 2.6:
                # стреляют по мутантам, укрывшись у ворот
                st = ((t + i * 0.13) % 0.3) < 0.05
                person(L, look, "side", wx + (i * 2 - 1) * 20, 1062, cop_hw, X0, Y0, k,
                       dict(arm=(88, 0), arm_far=(84, 0), prop=gun), fx=1 if i == 0 else -1)
                if st:
                    gx = (wx + (i * 2 - 1) * 20 + (1 if i == 0 else -1) * 30 - X0) * k
                    gy = (1062 - cop_hw * 0.8 - Y0) * k
                    L.glows.append((gx, gy, max(6, int(26 * k)), (255, 220, 140), 1.3))
            elif turned:
                turn_person(L, look, wx, 1062, cop_hw, X0, Y0, k, tu, dict(face=dict(blink=0, brows=1, mouth=0.6)), dict())
            else:
                person(L, look, "front", wx, 1062, cop_hw, X0, Y0, k,
                       dict(face=dict(turn=(0.4 if i == 0 else -0.4), gaze=(0.6 if i == 0 else -0.6), blink=TL.blink(t, 11 + i)),
                            arms=((12, 30), {"ik": (60, 900)}) if i == 0 else ({"ik": (-60, 900)}, (12, 30))))
        # входят внутрь: химзащита и пожарные приходят из-за края кадра боком, у ворот поворачиваются и осторожно уходят вглубь
        if t < EV["boom"]:
            for j in range(4):
                cyc = 9.0
                u = ((t + j * cyc / 4) % cyc) / cyc
                look = C.HAZMAT if j % 2 == 0 else C.FIRE
                left = j < 2
                gx = 532 + (j - 1.5) * 12
                if u < 0.5:                       # подход к воротам вдоль дороги
                    v = u / 0.5
                    x0_ = -260 if left else 1340
                    wx = lerp(x0_, gx, v)
                    hw = 108
                    dist = abs(wx - x0_)
                    person(L, look, "side", wx, 1078, hw, X0, Y0, k, dict(legs="sneak", phase=dist / Hm.step_per_radian(hw, "sneak"), prop=flashlight if j % 2 == 0 else None),
                           fx=1 if left else -1)
                else:                             # спиной к нам, осторожно внутрь
                    v = (u - 0.5) / 0.5
                    wy = lerp(1078, 1000, v)
                    hw = lerp(108, 30, v)
                    if hw > 34:
                        person(L, look, "back", gx, wy, hw, X0, Y0, k, dict(legs="sneak", phase=v * 26 + j))
            for j, (spd, off, fy) in enumerate(((0.05, 0.0, 1068), (0.045, 0.5, 1070))):
                u = ((t * spd + off) % 1)
                x0_, x1_ = (-260, 1340) if j == 0 else (1340, -260)
                wx = lerp(x0_, x1_, u)
                person(L, C.HAZMAT, "side", wx, fy, 104, X0, Y0, k, dict(legs="sneak", phase=abs(wx - x0_) / Hm.step_per_radian(104, "sneak"), prop=flashlight),
                       fx=1 if j == 0 else -1)
        elif tb > 2.0:
            # паника: бегут прочь по-настоящему (ноги соответствуют скорости)
            for j in range(3):
                d = (tb - 2.0 - j * 0.5) * 300
                if d <= 0:
                    continue
                look = (C.FIRE, C.HAZMAT, C.DOCTOR)[j]
                sgn = -1 if j % 2 == 0 else 1
                wx = 540 + sgn * (30 + d)
                wy = 1060 + min(100, d * 0.12)
                hw = 100 + min(30, d * 0.04)
                person(L, look, "side", wx, wy, hw, X0, Y0, k, dict(legs="run", phase=d / Hm.step_per_radian(hw, "run") + j), fx=sgn)
        # врачи у скорой
        for i, wx in enumerate((300, 380)):
            if t < EV["boom"]:
                person(L, C.DOCTOR, "front", wx, 1102, 102, X0, Y0, k, dict(face=dict(turn=0.5 - i, gaze=0.8 - 1.6 * i, blink=TL.blink(t, 20 + i)), arms=((10, 40), (10, 40))))
            elif tb < 2.0:
                turn_person(L, C.DOCTOR, wx, 1102, 102, X0, Y0, k, tu, dict(face=dict(brows=1, mouth=0.5)), dict())
        if t < EV["boom"] + 2.0:
            stretcher(L.c, (340 - X0) * k, (1104 - Y0) * k, 0.3 * k)

    def mutants_draw(self, L, t, tb, X0, Y0, k):
        for m in self.muts:
            age = tb - (EV["mutants"] - EV["boom"]) - m["spawn"]
            if age < 0:
                continue
            prog = age * m["speed"]
            wy = 1020 + prog * 1.2
            hw = 120 + prog * 1.1
            wx = m["x"] + m["dx"] * age
            x, y = (wx - X0) * k, (wy - hw - Y0) * k
            sc = hw / 1000 * k
            L.c.ell((x - 200 * sc, y + 960 * sc, x + 200 * sc, y + 1040 * sc), (0, 0, 0, 120))
            e = A.mutant(L.c.sub(x, y, sc), t, m["var"], walk=t * 6 + m["ph"])
            for ex, ey in e:
                L.glows.append((x + ex * sc, y + ey * sc, max(8, int(80 * sc)), (180, 255, 80), 1.3))

    # --------------------------------------------------------------------
    def report(self, t):
        z = self.z
        u = ramp(t, EV["tilt0"], EV["tilt1"])
        Y0 = lerp(870, 330, u)
        X0 = 0.0
        k = 1.0
        # Сэм отходит влево и приближает ворота, потом возвращается к Элли
        z0, z1 = EV["zoom0"], EV["zoom1"]
        step = ramp(t, z0 + 0.2, z0 + 1.2) * (1 - ramp(t, z1 - 1.3, z1 - 0.3))
        zoom = ramp(t, z0 + 1.0, z0 + 2.4) * (1 - ramp(t, z1 - 2.2, z1 - 0.9))
        kz = 2.5
        X0 = lerp(0.0, 560 - W / kz / 2, zoom) - 120 * step * (1 - zoom)
        Y0 = lerp(Y0, HOR + 40 - H / kz * 0.55, zoom)
        k = lerp(1.0, kz, zoom)
        out = z.view(t, X0, Y0, k)
        z.light_glows(out, t, X0, Y0, k)
        B = Layer()
        self.bg_people(B, t, X0, Y0, k)
        B.put(out, mult=(0.55, 0.48, 0.48), tint=z.flash_tint(t) * 0.6, rim_k=0.8)
        B.emit(out)
        # Элли (ближе к камере: при шаге Сэма уходит вправо из кадра)
        if step < 0.95:
            L = Layer()
            ex = 610 + 640 * step
            breath = math.sin(t * 1.7) * 4
            mo = TL.mouth(["elli"], t)
            turn = (t - EV["turn"]) / 0.5
            face = dict(turn=0.0, gaze=0.0, gy=0.0, blink=TL.blink(t, 2), mouth=mo, smile=0.15 if mo < 0.1 else 0.0, brows=0.2)
            if TL.talking("sam", t):
                face.update(turn=-0.4, gaze=-0.8, gy=-0.3)       # смотрит на оператора
            pf = dict(face=face, arms=({"ik": (-40, 380)}, (8, 14)), props={-1: mic}, face_first=True, breath=math.sin(t * 1.7))
            pb = dict(arms=((10, 14), {"ik": (150, 330)}), arms_behind=(False, True), props={1: mic}, tail=math.sin(t * 2) * 0.3)
            if turn < 0:
                person(L, C.ELLI, "front", ex, 640 + 1700 + breath, 1700, X0, Y0, k, pf, shadow=False)
            else:
                turn_person(L, C.ELLI, ex, 640 + 1700, 1700, X0, Y0, k, min(1, turn), pf, pb)
            L.put(out, mult=(0.85, 0.72, 0.7), tint=z.flash_tint(t) * 0.5, rim_k=1.0)
        dx, dy, rot = shake(t, 6, 0.5, 1)
        return camera(out, dx, dy, rot)

    def walk(self, t):
        E0 = EV["walk0"]
        lt = t - E0
        z = self.z
        k = 1.15 + 0.32 * ease(lt / 5.5)
        ci = EV["clark_in"]
        stop = ci + 1.3
        walking = t < stop
        bob = math.sin(lt * 2 * math.pi * 1.6) * 10 if walking else 0
        X0 = 540 - W / k / 2 + 6 * math.sin(lt * 1.3)
        Y0 = HOR - 820 / k
        out = z.view(t, X0, Y0, k)
        z.light_glows(out, t, X0, Y0, k)
        B = Layer()
        self.bg_people(B, t, X0, Y0, k)
        B.put(out, mult=(0.55, 0.48, 0.48), tint=z.flash_tint(t) * 0.6, rim_k=0.8)
        B.emit(out)
        L = Layer()
        # Кларкс выходит справа и встаёт перед Элли, лицом к ней
        if t > ci - 0.2:
            u = ramp(t, ci, ci + 1.3)
            cx = lerp(1450, 690, u)
            sc = 0.62
            if u < 1:
                Hm.side(L.c.sub(cx, 700, sc, -1), C.CLARK, dict(legs="walk", phase=(1450 - cx) / Hm.step_per_radian(1700 * sc)))
            else:
                talk = TL.mouth(["cop"], t)
                w_ = ramp(t, TL.LINE["c1"][0] + 0.2, TL.LINE["c1"][0] + 0.6)
                pose = ({"ik": lerp2((-120, 960), (-270, 180), w_)}, {"ik": (120, 960)})
                Hm.front(L.c.sub(cx, 700, sc), C.CLARK, dict(face=dict(turn=-0.25, gaze=-0.7, gy=0.3, blink=TL.blink(t, 4), mouth=talk, brows=-0.5),
                                                            arms=pose, hand_scale=(lerp(1.0, 1.1, w_), 1.0), palm=(w_ > 0.6, False)))
        ph = min(lt, stop - E0) * 2 * math.pi * 1.0
        Hm.back(L.c.sub(400, 650, 0.72), C.ELLI, dict(legs="walk" if walking else "stand", phase=ph, arms=((10, 14), {"ik": (150, 330)}), arms_behind=(False, True),
                                                    props={1: mic}, tail=math.sin(lt * 6) * 0.5))
        L.put(out, mult=(0.62, 0.52, 0.54), tint=z.flash_tint(t) * 0.9, rim_k=1.0)
        dx, dy, rot = shake(t, 7, 0.6, 2)
        return camera(out, dx, dy + bob, rot)

    # --- перепалка и взрыв: передний план в мировых координатах ---
    def _fg_cam(self, k):
        return 560 - W / k / 2, HOR - 980 / k

    def _anchors(self, k0=1.9):
        X0r, Y0r = self._fg_cam(k0)
        return (X0r + 610 / k0, Y0r + 340 / k0 + 1840 / k0, 1840 / k0), (X0r + 130 / k0, Y0r + 760 / k0 + 1955 / k0, 1955 / k0)

    def clark_pose(self, t):
        """Жесты Кларкса плавно перетекают: руки на ремне -> «стоп» -> ладонь к объективу."""
        sp = TL.mouth(["cop", "clark"], t)
        talking = TL.talking("cop", t) or TL.talking("clark", t)
        brows, smile = (-0.6, -0.3) if talking else (-0.3, -0.2)
        idle, stop, lens = (-120, 960), (-270, 180), (-90, 300)
        c3, c4 = TL.LINE["c3"], TL.LINE["c4"]
        w_stop = smooth_pulse(t, c3[0] + 1.0, 0.4, c3[1] - 1.0, 0.0) if t < c4[0] else 1.0
        if c3[0] + c3[1] < t < c4[0]:
            w_stop = 1 - ease((t - c3[0] - c3[1]) / 0.5) * (1 - ease((t - c4[0] + 0.5) / 0.5))
        r = ramp(t, c4[0], c4[0] + c4[1]) if t > c4[0] else 0.0
        tgt = lerp2(lerp2(idle, stop, w_stop), lens, r)
        hs = lerp(lerp(1.0, 1.2, w_stop), 2.0, r)
        if w_stop > 0.3 or r > 0:
            brows = -1.0
        face = dict(turn=-0.25, gaze=-0.75, gy=0.35, blink=TL.blink(t, 4), mouth=sp, brows=brows, smile=smile)
        return dict(face=face, arms=({"ik": tgt}, {"ik": (120, 960)}), hand_scale=(hs, 1.0), palm=(w_stop > 0.55 or r > 0, False), breath=math.sin(t * 1.4))

    def elli_back_pose(self, t, mic_in=True):
        talking = TL.talking("elli", t)
        arm_r = {"ik": (250, 330 - 30 * TL.mouth(["elli"], t))} if mic_in else (10, 10)
        return dict(arms=((10, 14), arm_r), arms_behind=(False, mic_in), props={1: mic} if mic_in else {}, tail=math.sin(t * 1.5) * 0.2)

    def standoff(self, t):
        lt = t - TL.SHOTS[[s[0] for s in TL.SHOTS].index("standoff")][1]
        k = 1.9 + 0.28 * ease(lt / 19)
        z = self.z
        X0, Y0 = self._fg_cam(k)
        out = z.view(t, X0, Y0, k, blur=1.0)
        z.light_glows(out, t, X0, Y0, k, 1.3)
        B = Layer()
        self.bg_people(B, t, X0, Y0, k)
        im = B.c.im.filter(ImageFilter.GaussianBlur(6))
        B.c.im = im
        B.put(out, mult=(0.5, 0.44, 0.44), tint=z.flash_tint(t) * 0.6, rim_k=0.6)
        B.emit(out)
        (cx, cf, chw), (ex, ef, ehw) = self._anchors()
        L = Layer()
        person(L, C.CLARK, "front", cx, cf, chw, X0, Y0, k, self.clark_pose(t), shadow=False)
        L.put(out, mult=(0.92, 0.76, 0.74), tint=z.flash_tint(t) * 1.1, rim_k=0.9)
        Le = Layer()
        person(Le, C.ELLI, "back", ex, ef, ehw, X0, Y0, k, self.elli_back_pose(t), shadow=False)
        Le.put(out, mult=(0.42, 0.36, 0.38), tint=z.flash_tint(t) * 0.5, rim_k=1.0)
        dx, dy, rot = shake(t, 5, 0.5, 3)
        if t > TL.LINE["c4"][0]:
            dx, dy, rot = shake(t, 12, 1.4, 3)
        return camera(out, dx, dy, rot)

    def explosion(self, t):
        B0 = EV["boom"]
        b = t - B0
        z = self.z
        # Сэм наводит камеру на взрыв: отъезд и подъём к огненному шару
        p = ramp(t, EV["epan0"], EV["epan1"])
        k0 = 2.18
        k = lerp(k0, 1.2, p)
        X0a, Y0a = self._fg_cam(k0)
        X0b, Y0b = 470 - W / 1.2 / 2, HOR - 1250 / 1.2
        X0, Y0 = lerp(X0a, X0b, p), lerp(Y0a, Y0b, p)
        if t > EV["epan1"] + 1.8:     # потом снова на людей (мутанты выходят)
            q = ramp(t, EV["epan1"] + 1.8, EV["epan1"] + 2.8)
            k = lerp(1.2, 1.45, q)
            X0 = lerp(X0b, 560 - W / 1.45 / 2, q)
            Y0 = lerp(Y0b, HOR - 1040 / 1.45, q)
        blur = 1 - ramp(t, B0 + 0.2, B0 + 1.2)
        out = z.view(t, X0, Y0, k, blur=blur, boom=b)
        z.light_glows(out, t, X0, Y0, k, 1.3)
        self.boom_fx(out, b, X0, Y0, k)
        M = Layer()
        self.bg_people(M, t, X0, Y0, k)
        self.mutants_draw(M, t, b, X0, Y0, k)
        M.put(out, mult=(0.5, 0.46, 0.44), tint=z.flash_tint(t) * 0.5, rim=(1.0, 0.7, 0.3), rim_k=1.3)
        M.emit(out)
        (cx, cf, chw), (ex, ef, ehw) = self._anchors()
        L = Layer()
        # Кларкс: удивление -> разворот -> выхватывает пистолет -> стреляет по мутантам
        if b < 0.5:
            person(L, C.CLARK, "front", cx, cf, chw, X0, Y0, k, dict(face=dict(brows=1.0, mouth=0.8, gaze=0, blink=0)), shadow=False)
        elif b < 0.9:
            turn_person(L, C.CLARK, cx, cf, chw, X0, Y0, k, (b - 0.5) / 0.4, dict(face=dict(brows=1.0, mouth=0.8)), dict())
        else:
            self.clark_shoot_back(L, t, cx, cf, chw, X0, Y0, k)
        L.put(out, mult=(0.6, 0.52, 0.5), tint=z.flash_tint(t) * 0.8, rim_k=1.1)
        L.emit(out)
        # Элли: микрофон падает из рук
        Le = Layer()
        drop = t > EV["mic_drop"]
        person(Le, C.ELLI, "back", ex, ef, ehw, X0, Y0, k, self.elli_back_pose(t, mic_in=not drop), shadow=False)
        if drop:
            u = t - EV["mic_drop"]
            sc = ehw / 1700 * k
            hx = (ex - X0) * k + 250 * sc
            hy = (ef - ehw - Y0) * k + 330 * sc
            ground = (ef - Y0) * k - 40 * sc
            yy = min(ground, hy + 0.5 * 4200 * u * u * sc)
            bounce = 0
            if yy >= ground:
                tt = u - math.sqrt(2 * (ground - hy) / (4200 * sc))
                bounce = abs(math.sin(tt * 9)) * 60 * sc * math.exp(-tt * 4)
            rot_ = min(1.4, u * 5)
            mc = Le.c.sub(hx + u * 80 * sc, yy - bounce, sc)
            mc2 = mc.sub(0, 0, 1.0)
            mic(mc2, (0, 0), 0)
        Le.put(out, mult=(0.36, 0.3, 0.32), tint=z.flash_tint(t) * 0.5, rim_k=1.1)
        if b < 0.6:
            out += (1 - b / 0.6) ** 2 * np.array([1.0, 0.85, 0.6], np.float32)
        amp = 46 * math.exp(-b * 1.4) + 6
        dx, dy, rot = shake(t, amp, 1.6, 4)
        return camera(out, dx, dy, rot)

    def clark_shoot_back(self, L, t, cx, cf, chw, X0, Y0, k):
        """Кларкс спиной к нам: выхватывает пистолет из кобуры на поясе и стреляет вперёд — в мутантов."""
        d0, s0 = EV["draw"], EV["shots0"]
        grab = ramp(t, d0 - 0.45, d0 - 0.1)               # рука к кобуре
        raise_ = ramp(t, d0, d0 + 0.45)                   # вскидывает оружие
        holster, aim = (200, 990), (40, 300)
        st = (t - s0) % 0.34 if t > s0 else 1.0
        recoil = max(0.0, 1 - st / 0.1) if t > s0 else 0.0
        if raise_ <= 0:
            arm_r = {"ik": lerp2((150, 930), holster, grab)}
            arm_l = (10, 8)
            behind = (False, False)
            props = {1: gun} if grab > 0.95 else {}
        else:
            arm_r = {"ik": lerp2(holster, (aim[0], aim[1] - recoil * 30), raise_)}
            arm_l = {"ik": lerp2((-150, 930), (-40, aim[1] - recoil * 30), raise_)}
            behind = (raise_ > 0.6, raise_ > 0.6)        # руки вытянуты вперёд — за корпусом
            props = {1: gun}
        person(L, C.CLARK, "back", cx, cf, chw, X0, Y0, k, dict(arms=(arm_l, arm_r), arms_behind=behind, props=props), shadow=False)
        if raise_ > 0.6:
            sc = chw / 1700 * k
            aim_elbows(L.c.sub((cx - X0) * k, (cf - chw - Y0) * k, sc), C.CLARK, recoil)
        if t > s0 and st < 0.05:
            sc = chw / 1700 * k
            gx = (cx - X0) * k
            gy = (cf - chw - Y0) * k + 260 * sc
            L.glows.append((gx, gy - 60 * sc, int(240 * sc + 20), (255, 230, 150), 1.3))
            L.glows.append((gx, gy, int(700 * sc), (255, 160, 60), 0.4))

    def boom_fx(self, out, b, X0, Y0, k):
        """Красивый взрыв: ударная волна, искры, обломки, вспышки вторичных взрывов."""
        if b < 0 or b > 6:
            return
        cx, cy = (470 - X0) * k, (960 - Y0) * k
        c = Cv(W, H, 1)
        if b < 1.6:   # кольцо ударной волны
            r = 60 + b * 900
            a = int(220 * (1 - b / 1.6))
            c.ell((cx - r * k * 0.5, cy + 40 * k - r * k * 0.12, cx + r * k * 0.5, cy + 40 * k + r * k * 0.12), None, outline=(255, 220, 160, a), width=max(2, int(14 * k)))
        for ang, sp, sz, hot in self.debris:
            if b > 4.5:
                break
            px = 470 + math.cos(ang) * sp * b
            py = 950 - abs(math.sin(ang)) * sp * b * 0.9 + 180 * b * b
            if py > 1060:
                continue
            col = (255, 170, 70, int(255 * max(0, 1 - b / 4))) if hot else (30, 24, 24, 255)
            X, Y = (px - X0) * k, (py - Y0) * k
            c.circ(X, Y, sz * 3.5 * k, col)
            if hot:
                c.line([(X, Y), (X - math.cos(ang) * 20 * k, Y + abs(math.sin(ang)) * 16 * k)], col, sz * 2 * k)
        alpha_over(out, c.im, 0, 0)
        for dxn, sp, life in self.sparks:
            if b > life:
                continue
            px = 470 + dxn * sp * b
            py = 930 - sp * b * 0.8 + 260 * b * b
            g = _glow(max(4, int(14 * k)), (255, 200, 110))
            add_over(out, g, int((px - X0) * k - 14 * k), int((py - Y0) * k - 14 * k), 1.0 - b / life)
        for tb2, ox in ((0.7, -120), (1.3, 160), (2.1, 40)):   # вторичные вспышки
            d = b - tb2
            if 0 < d < 0.5:
                r = int(220 * k)
                add_over(out, _glow(r, (255, 210, 140)), int((470 + ox - X0) * k - r), int((990 - Y0) * k - r), 1.2 * (1 - d / 0.5))

    def flee(self, t):
        H0 = TL.SHOTS[[s[0] for s in TL.SHOTS].index("flee")][1]
        lt = t - H0
        z = self.z
        k = 1.5
        X0 = 560 - W / k / 2
        Y0 = HOR - 900 / k
        tb = t - EV["boom"]
        out = z.view(t, X0, Y0, k, boom=tb)
        z.light_glows(out, t, X0, Y0, k, 1.3)
        M = Layer()
        self.bg_people(M, t, X0, Y0, k)
        self.mutants_draw(M, t, tb, X0, Y0, k)
        # мутант набросился на полицейского у машины
        x, y = (120 - X0) * k, (1235 - Y0) * k
        M.c.im.paste(self.corpse.resize((int(self.corpse.width * 0.11 * k), int(self.corpse.height * 0.11 * k))), (int((x - 100 * k) * AS), int((y - 30 * k) * AS)),
                     self.corpse.resize((int(self.corpse.width * 0.11 * k), int(self.corpse.height * 0.11 * k))))
        A.mutant(M.c.sub(x + 10, y - 60 * k * 0.16, 0.17 * k), t, 1, walk=t * 20)   # монстр на поверженном полицейском — ниже, на земле
        # Кларкс справа спиной к нам стреляет вперёд по мутантам
        st = (t % 0.3)
        recoil = max(0, 1 - st / 0.1)
        sc = 0.5
        Hm.back(M.c.sub(880, 760, sc), C.CLARK, dict(arms=({"ik": (-40, 300 - recoil * 30)}, {"ik": (40, 300 - recoil * 30)}), arms_behind=(True, True), props={1: gun}))
        aim_elbows(M.c.sub(880, 760, sc), C.CLARK, recoil)
        if st < 0.05:
            M.glows.append((880, 760 + 200 * sc, 110, (255, 230, 150), 1.3))
        M.put(out, mult=(0.5, 0.44, 0.44), tint=z.flash_tint(t) * 0.6, rim_k=1.0)
        M.emit(out)
        # Элли поворачивается к камере (лицо видно, испугана) и убегает
        L = Layer()
        p = min(1, max(0, lt / 0.45))
        fx = abs(math.cos(p * math.pi)) * 0.94 + 0.06
        run = ease((lt - 3.0) / 0.9)
        ex = lerp(560, -500, run)
        ey = lerp(560, 200, run)
        esc = lerp(0.8, 1.6, run)
        mo = TL.mouth(["elli"], t)
        if p < 0.5:
            Hm.back(L.c.sub(ex, ey, esc, fx), C.ELLI, dict(arms=((10, 14), (10, 10))))
        else:
            Hm.front(L.c.sub(ex, ey, esc, fx), C.ELLI, dict(face=dict(turn=0.0, gaze=0.0, blink=TL.blink(t, 2) * 0.5, mouth=max(mo, 0.25), brows=1.0, smile=-0.6),
                                                         arms=({"ik": (-220, 300)}, {"ik": (280, 420)}) if run < 0.05 else ((40, 90), (40, 90)),
                                                         legs="run" if run > 0 else "stand", phase=lt * 12))
        L.put(out, mult=(0.75, 0.62, 0.62), tint=z.flash_tint(t) * 0.6, rim_k=1.0)
        dx, dy, rot = shake(t, 14, 1.2, 6)
        wp = ramp(t, EV["whip"], EV["whip"] + 0.6)
        if wp > 0:
            out = motion_blur(out, 380 * wp * (1 - wp * 0.3), 13)
            dx += wp * 700
            rot += wp * 5
            out = out * (1 + 0.25 * wp)
        return camera(out, dx, dy, rot)

    def run(self, t, spider_override=None):
        R0 = TL.SHOTS[[s[0] for s in TL.SHOTS].index("run")][1]
        lt = t - R0
        hit = EV["hit"]
        bob = abs(math.sin(lt * math.pi * 3.2)) * 40
        sx = 60 + smooth_noise(t * 3, 7) * 40
        sy = 90 - bob
        out = self.road[int(sy):int(sy) + H, int(sx):int(sx) + W].copy()
        fl = 0.85 + 0.15 * smooth_noise(t * 5, 2)
        yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
        out = out * (0.55 + 0.5 * fl * yy ** 1.5 * np.array([1.0, 0.7, 0.5], np.float32))
        ph = t * 3.0
        from zone import _beam
        for (x, y), col, sc in self.road_lights:
            X, Y = x - sx, y - sy
            if col in ("w", "wl"):
                add_over(out, _glow(int(40 * sc), (255, 240, 200)), int(X - 40 * sc), int(Y - 40 * sc), 1.0)
                bm = _beam(int(420 * sc), int(110 * sc), col == "wl")
                add_over(out, bm, int(X - (bm.shape[1] if col == "wl" else 0)), int(Y - bm.shape[0] / 2), 0.3)
                continue
            if col == "o":
                continue
            if math.sin(ph * math.pi * 2 + (0 if col == "r" else math.pi)) > 0:
                r = int(90 * sc)
                add_over(out, _glow(r, (255, 40, 50) if col == "r" else (50, 100, 255)), int(X - r), int(Y - r), 0.9)
        # мёртвый полицейский в луже крови
        cp = self.corpse.resize((int(self.corpse.width * 0.2), int(self.corpse.height * 0.2)))
        cimg = to_im(out).convert("RGBA")
        cimg.alpha_composite(cp, (int(330 - sx), int(1380 - sy)))
        out = np.asarray(cimg.convert("RGB"), np.float32) / 255
        L = Layer()
        d1, d2 = lt * 260, lt * 220
        person(L, C.COP2, "side", 300 - d1, 1150 - sy + 90, 300, 0, 0, 1.0, dict(legs="run", phase=d1 / Hm.step_per_radian(300, "run")), fx=-1)
        person(L, C.FIRE, "side", 760 + d2, 1100 - sy + 90, 250, 0, 0, 1.0, dict(legs="run", phase=d2 / Hm.step_per_radian(250, "run") + 1))
        A.mutant(L.c.sub(360, 900 - sy + 90, 0.12), t, 2, walk=t * 20)
        # Элли бежит: наклон вперёд, руки работают, хвост раскачивается
        esc = 0.56 - lt * 0.04
        Hm.back(L.c.sub(520 + math.sin(lt * 3) * 30, 760 - sy + 90 - lt * 40 + abs(math.sin(lt * 12)) * 20, esc), C.ELLI,
                dict(legs="run", phase=lt * 12, arms=((24 + 10 * math.sin(lt * 12), 12), (24 - 10 * math.sin(lt * 12), 12)), no_swing=True, tail=math.sin(lt * 12) * 0.8))
        L.put(out, mult=(0.9, 0.66, 0.56), tint=(0.03, 0.0, 0.02), rim=(0.4, 0.5, 1.0), rim_k=0.4, rim_dirs=((0, 8, 1.0),))
        # человек-паук: спускается сверху на паутине, потом прыгает на камеру
        s0, d0 = EV["spider"], EV["drop"]
        if t > s0 or spider_override:
            S = Layer()
            if spider_override:
                x, y, sc, spread = spider_override
            elif t < d0:
                u = ramp(t, s0, d0)
                x, y, sc, spread = 780, lerp(-500, 520, u), 0.42, 0.0
                S.c.line([(x, -10), (x, y - 470 * sc)], (220, 220, 230, 200), 3)
            else:
                u = ((t - d0) / (hit - d0)) ** 1.8
                x = lerp(780, 540, u)
                y = lerp(520, 1050, u)
                sc = lerp(0.42, 3.4, u)
                spread = u
            eyes = A.spider(S.c.sub(x, y, sc), t, spread=spread)
            for ex, ey in eyes:
                S.glows.append((x + ex * sc, y + ey * sc, max(6, int(50 * sc)), (255, 30, 20), 1.1))
            S.put(out, mult=(0.8, 0.66, 0.6), tint=(0.0, 0, 0.0), rim=(0.55, 0.55, 0.6), rim_k=0.6)
            S.emit(out)
        a = 12 + 10 * (lt > 3.5)
        dx, dy, rot = shake(t, a, 1.8, 8)
        return camera(out, dx, dy, rot + math.sin(lt * math.pi * 3.2) * 1.2)

    def fall(self, t):
        """Сэма сбили: камера кувыркается и падает на асфальт, над ней нависает паук."""
        hit = EV["hit"]
        u = t - hit
        if u < 0.5:
            base = self.run(hit - 0.02)
            v = ease(u / 0.5)
            out = motion_blur(base, 260 * math.sin(v * math.pi), 9)
            return camera(out, 0, 0, 78 * v, 1.0 + 0.15 * v)
        # лежит на земле: паук над камерой, потом уходит
        w = ramp(t, hit + 2.6, hit + 4.2)
        sp = (lerp(640, 1200, w), lerp(380, 120, w), 1.5, 0.4)
        base = self.run(hit - 0.02 + (u - 0.5) * 0.3, spider_override=sp)
        out = camera(base, 0, 8 * math.sin(u * 23), 78 + math.sin(u * 3) * 0.6, 1.15)
        return out * (0.8 + 0.2 * smooth_noise(t * 9, 3))
