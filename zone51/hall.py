"""Прихожая: входная дверь с глазком, туалет, коридор на кухню; вид в глазок; мама Саши с пирогом."""
import math, random
import numpy as np
from PIL import Image, ImageFilter
from gfx import Cv, to_f, to_im, radial, ease, smooth_noise, font, FONT_SERIF, FONT_C, alpha_over
import human as Hm
import cast as C
import timeline as TL

W, H = 1080, 1920
X0W, X1W, Y0W, Y1W = -300, 1380, -100, 2020
KS = 1.6
AS = 2
DOORE = (390, 520, 690, 1440)        # входная дверь
WC = (-170, 600, 130, 1440)          # дверь туалета
KITCHEN = (900, 560, 1180, 1440)     # проход на кухню
EV = TL.EV


def lerp(a, b, u):
    return a + (b - a) * u


def ramp(t, t0, t1):
    return ease((t - t0) / max(1e-3, t1 - t0))


def pie(c, x, y, sc=1.0):
    c.ell((x - 150 * sc, y - 34 * sc, x + 150 * sc, y + 46 * sc), (236, 236, 240, 255))      # тарелка
    c.ell((x - 136 * sc, y - 60 * sc, x + 136 * sc, y + 30 * sc), (196, 126, 56, 255))
    c.ell((x - 124 * sc, y - 70 * sc, x + 124 * sc, y + 10 * sc), (226, 160, 74, 255))
    for k in range(-3, 4):
        c.line([(x + k * 30 * sc - 30 * sc, y - 62 * sc), (x + k * 30 * sc + 30 * sc, y + 4 * sc)], (190, 116, 46, 255), 8 * sc)
        c.line([(x + k * 30 * sc + 30 * sc, y - 62 * sc), (x + k * 30 * sc - 30 * sc, y + 4 * sc)], (190, 116, 46, 255), 8 * sc)
    c.ell((x - 124 * sc, y - 70 * sc, x + 124 * sc, y + 10 * sc), None, outline=(170, 100, 40, 255), width=6 * sc)
    for k in range(3):   # пар от тёплого пирога
        c.line([(x - 40 * sc + k * 40 * sc, y - 80 * sc), (x - 30 * sc + k * 40 * sc, y - 130 * sc), (x - 44 * sc + k * 40 * sc, y - 180 * sc)], (255, 255, 255, 60), 10 * sc, smooth=True)


def mama_front(c, x, y, sc, t, mouth=0.0, smile=0.6, turn=0.0, gaze=None, with_pie=True, phase=None):
    p = dict(face=dict(turn=turn, gaze=turn if gaze is None else gaze, blink=TL.blink(t, 5), mouth=mouth, smile=smile, brows=0.3),
             arms=({"ik": (-80, 640)}, {"ik": (80, 640)}) if with_pie else ((8, 10), (8, 10)), breath=math.sin(t * 1.5))
    if phase is not None:
        p["legs"] = "walk"
        p["phase"] = phase
    Hm.front(c.sub(x, y, sc), C.MAMA, p)
    if with_pie:
        pie(c, x, y + 600 * sc, sc * 0.8)


class Hall:
    def __init__(self):
        c = Cv(X1W - X0W, Y1W - Y0W, KS, (0, 0, 0, 255), ox=-X0W * KS, oy=-Y0W * KS)
        rnd = random.Random(12)
        # стены (виниловые обои)
        c.rect((X0W, Y0W, X1W, 1440), (150, 160, 128, 255))
        for i, x in enumerate(range(X0W, X1W, 40)):
            c.rect((x, Y0W, x + 6, 1440), (140, 150, 118, 255))
        for y in range(Y0W + 60, 1440, 120):
            for x in range(X0W, X1W, 120):
                c.circ(x + (60 if (y // 120) % 2 else 0), y, 10, (164, 174, 140, 255))
        c.rect((X0W, Y0W, X1W, Y0W + 60), (220, 216, 204, 255))
        # пол: линолеум «паркет»
        c.rect((X0W, 1440, X1W, Y1W), (150, 100, 60, 255))
        for y in range(1440, Y1W, 40):
            for x in range(X0W - 60, X1W, 120):
                off = 60 if (y // 40) % 2 else 0
                c.rect((x + off, y, x + off + 116, y + 36), (160 + rnd.randint(-10, 10), 110 + rnd.randint(-8, 8), 66, 255))
        c.rect((X0W, 1430, X1W, 1452), (110, 70, 40, 255))
        c.poly([(330, 1500), (750, 1500), (820, 2020), (260, 2020)], (130, 40, 44, 255))
        c.poly([(350, 1520), (730, 1520), (790, 2020), (290, 2020)], (160, 60, 54, 255))
        # входная дверь (дерматин с ромбами)
        x0, y0, x1, y1 = DOORE
        c.rect((x0 - 30, y0 - 30, x1 + 30, y1), (200, 194, 180, 255))
        self.door_rect = DOORE
        # коридор на кухню (тёмный)
        kx0, ky0, kx1, ky1 = KITCHEN
        c.rect((kx0 - 24, ky0 - 24, kx1, ky1), (200, 194, 180, 255))
        c.rect((kx0, ky0, kx1, ky1), (40, 36, 34, 255))
        c.poly([(kx0, ky1), (kx0 + 80, ky1 - 80), (kx1, ky1 - 80), (kx1, ky1)], (60, 46, 36, 255))
        c.rect((kx0 + 120, ky0 + 200, kx0 + 240, ky1 - 80), (60, 54, 50, 255))   # дальняя дверь кухни
        c.rect((kx0 + 130, ky0 + 210, kx0 + 230, ky0 + 420), (120, 100, 60, 255))
        # туалет
        wx0, wy0, wx1, wy1 = WC
        c.rect((wx0 - 24, wy0 - 24, wx1 + 24, wy1), (200, 194, 180, 255))
        c.rect((wx0 - 24, wy0 - 200, wx1 + 24, wy0 - 60), (200, 194, 180, 255))
        c.rect((wx0 + 20, wy0 - 180, wx1 - 20, wy0 - 80), (90, 80, 60, 255))   # окошко над дверью
        # вешалка с одеждой
        c.rect((180, 600, 360, 620), (110, 70, 40, 255))
        for x in (200, 250, 300, 340):
            c.line([(x, 620), (x, 650)], (180, 170, 150, 255), 5)
        c.poly([(186, 640), (250, 636), (262, 1000), (176, 1010)], (70, 60, 72, 255), smooth=True)
        c.poly([(260, 640), (340, 640), (356, 960), (250, 960)], (110, 80, 50, 255), smooth=True)
        c.ell((200, 560, 290, 610), (60, 50, 40, 255))
        c.ell((180, 590, 310, 616), (60, 50, 40, 255))
        # обувь
        c.rect((170, 1380, 370, 1400), (110, 70, 40, 255))
        for x, col in ((180, (40, 36, 34, 255)), (240, (40, 36, 34, 255)), (300, (150, 40, 40, 255))):
            c.ell((x, 1350, x + 54, 1384), col)
        c.ell((750, 1400, 830, 1440), (40, 40, 60, 255))
        c.ell((800, 1404, 880, 1444), (40, 40, 60, 255))
        # зеркало и полочка
        c.rect((760, 700, 870, 980), (150, 110, 60, 255), r=50)
        c.rect((772, 712, 858, 968), (150, 170, 180, 255), r=44)
        c.line([(790, 740), (820, 940)], (220, 230, 240, 255), 6)
        c.rect((740, 1000, 890, 1016), (130, 90, 50, 255))
        c.rect((770, 976, 800, 1000), (200, 80, 80, 255))
        # выключатель и звонок
        c.rect((720, 900, 760, 950), (236, 232, 222, 255), r=4)
        # лампочка под потолком
        c.line([(540, Y0W + 60), (540, 60)], (40, 40, 40, 255), 3)
        c.poly([(480, 60), (600, 60), (630, 120), (450, 120)], (220, 200, 160, 255))
        c.circ(540, 132, 22, (255, 240, 200, 255))
        self.bg = c.im.convert("RGB")
        # освещение
        self.lw, self.lh = (X1W - X0W) // 8, (Y1W - Y0W) // 8
        yy, xx = np.mgrid[0:self.lh, 0:self.lw].astype(np.float32) * 8
        xx += X0W
        yy += Y0W
        self.L_bulb = (np.exp(-(((xx - 540) / 900) ** 2 + ((yy - 300) / 1300) ** 2) * 1.6) * 1.15).astype(np.float32)
        self.L_wc = (np.exp(-(((xx + 20) / 380) ** 2 + ((yy - 1100) / 700) ** 2)) * 0.9).astype(np.float32)
        kx0, ky0, kx1, ky1 = KITCHEN
        self.kmask = ((xx > kx0) & (xx < kx1) & (yy > ky0) & (yy < ky1)).astype(np.float32)
        self.landing = self._landing()

    def _landing(self):
        """Лестничная площадка за дверью (для открытой двери и глазка)."""
        c = Cv(1080, 1920, 1.0, (0, 0, 0, 255))
        c.rect((0, 0, 1080, 1000), (226, 226, 214, 255))
        c.rect((0, 1000, 1080, 1700), (60, 120, 96, 255))
        c.rect((0, 990, 1080, 1004), (40, 80, 64, 255))
        c.rect((0, 1700, 1080, 1920), (120, 110, 100, 255))
        for x in range(0, 1080, 60):
            c.line([(x, 1700), (x - 80, 1920)], (100, 92, 84, 255), 3)
        c.rect((60, 400, 340, 1700), (120, 80, 60, 255))    # дверь соседей
        c.rect((80, 420, 320, 1680), (140, 96, 70, 255))
        c.circ(290, 1060, 12, (210, 190, 120, 255))
        c.rect((170, 330, 230, 370), (210, 210, 200, 255))
        c.text((200, 350), "48", 30, (40, 40, 40, 255), FONT_C, anchor="mm")
        c.rect((760, 700, 1040, 1000), (90, 110, 120, 255))  # почтовые ящики
        for i in range(3):
            for j in range(2):
                c.rect((776 + i * 88, 716 + j * 140, 852 + i * 88, 840 + j * 140), (70, 90, 100, 255))
        c.line([(720, 1300), (1080, 1100)], (60, 50, 40, 255), 18)   # перила
        for x in range(740, 1080, 60):
            c.line([(x, 1300 - (x - 720) * 0.55), (x, 1700)], (40, 40, 40, 255), 6)
        c.line([(540, 0), (540, 120)], (30, 30, 30, 255), 3)
        c.circ(540, 140, 26, (255, 240, 190, 255))
        im = c.im.convert("RGB")
        a = to_f(im) * (0.35 + 0.75 * radial(1080, 1920, 540, 260, 1300, 1.2)[..., None] * np.array([1.0, 0.92, 0.75], np.float32))
        return a

    def view(self, t, cx, cy, w, actors, wc_light=0.0, door_open=0.0, kitchen_flicker=0.0, through=None):
        h = w * H / W
        X0 = min(max(cx - w / 2, X0W), X1W - w)
        Y0 = min(max(cy - h / 2, Y0W), Y1W - h)
        box = (int((X0 - X0W) * KS), int((Y0 - Y0W) * KS), int((X0 + w - X0W) * KS), int((Y0 + h - Y0W) * KS))
        alb = self.bg.crop(box).resize((W, H), Image.BILINEAR).convert("RGBA")
        k = W / w
        a = Cv(W, H, AS)
        self._doors(a, k, X0, Y0, door_open, wc_light, through)
        actors(a, k, X0, Y0)
        alb.alpha_composite(a.im.reduce(AS))
        out = np.asarray(alb.convert("RGB"), np.float32) / 255
        lb = ((X0 - X0W) / 8, (Y0 - Y0W) / 8, (X0 + w - X0W) / 8, (Y0 + h - Y0W) / 8)

        def up(m):
            im = Image.fromarray(np.clip(m * 100, 0, 255).astype(np.uint8))
            return np.asarray(im.transform((W, H), Image.EXTENT, lb, Image.BILINEAR), np.float32)[..., None] / 100
        fl = 0.94 + 0.06 * smooth_noise(t * 2, 3)
        L = np.array([0.07, 0.07, 0.1], np.float32) + up(self.L_bulb) * np.array([1.0, 0.82, 0.55], np.float32) * fl
        if wc_light > 0:
            L = L + up(self.L_wc) * wc_light * np.array([0.9, 0.95, 1.0], np.float32)
        if kitchen_flicker > 0:
            km = up(self.kmask)
            L = L * (1 - km * kitchen_flicker * 0.6)
        return out * L

    def _doors(self, c, k, X0, Y0, door_open, wc_light, through):
        T = lambda x, y: ((x - X0) * k, (y - Y0) * k)
        x0, y0, x1, y1 = DOORE
        # проём: площадка видна, когда дверь открыта
        if door_open > 0:
            land = Image.fromarray((np.clip(self.landing, 0, 1) * 255).astype(np.uint8)).resize((int((x1 - x0) * k * AS), int((y1 - y0) * k * AS)))
            px, py = T(x0, y0)
            c.im.paste(land, (int(px * AS), int(py * AS)))
            if through:
                through(c, k, X0, Y0)
        # полотно двери: петли слева, открывается внутрь (на нас)
        u = door_open
        wd = (x1 - x0) * (1 - 0.82 * u)
        dx1 = x0 + wd
        grow = 60 * u
        pts = [T(x0, y0), T(dx1, y0 - grow), T(dx1, y1 + grow), T(x0, y1)]
        c2 = Cv(W, H, AS)
        c.d.polygon([(p[0] * AS, p[1] * AS) for p in pts], fill=(92, 30, 34, 255))
        if u < 0.5:
            # стёжка ромбами и гвоздики
            for j in range(8):
                for i in range(4):
                    cxx = x0 + (i + 0.5) * (wd / 4)
                    cyy = y0 + 60 + j * 110
                    X, Y = T(cxx, cyy)
                    r = 46 * k * (1 - 0.82 * u) * 0.9
                    c.d.polygon([(X * AS, (Y - 50 * k) * AS), ((X + r) * AS, Y * AS), (X * AS, (Y + 50 * k) * AS), ((X - r) * AS, Y * AS)], outline=(70, 20, 24, 255), width=max(1, int(3 * k * AS)))
                    c.d.ellipse([(X - 5 * k) * AS, (Y - 55 * k) * AS, (X + 5 * k) * AS, (Y - 45 * k) * AS], fill=(200, 180, 120, 255))
            hx, hy = T(x0 + wd - 50, 1000)
            c.d.rounded_rectangle([(hx - 10 * k) * AS, (hy - 50 * k) * AS, (hx + 10 * k) * AS, (hy + 50 * k) * AS], radius=6, fill=(190, 180, 150, 255))
            px, py = T(x0 + wd / 2, 880)
            c.d.ellipse([(px - 12 * k) * AS, (py - 12 * k) * AS, (px + 12 * k) * AS, (py + 12 * k) * AS], fill=(30, 30, 30, 255), outline=(200, 190, 150, 255), width=int(4 * k * AS))
            nx, ny = T(x0 + wd / 2, 760)
            c.d.rectangle([(nx - 40 * k) * AS, (ny - 24 * k) * AS, (nx + 40 * k) * AS, (ny + 24 * k) * AS], fill=(210, 190, 120, 255))
            c.d.text((nx * AS, ny * AS), "47", font=font(36 * k * AS, FONT_C), fill=(60, 40, 20, 255), anchor="mm")
        # дверь туалета
        wx0, wy0, wx1, wy1 = WC
        if wc_light > 0:
            X0p, Y0p = T(wx0, wy0)
            X1p, Y1p = T(wx1, wy1)
            c.d.rectangle([X0p * AS, Y0p * AS, X1p * AS, Y1p * AS], fill=(230, 236, 230, 255))
            c.d.rectangle([X0p * AS, (Y1p - 100 * k) * AS, X1p * AS, Y1p * AS], fill=(200, 210, 210, 255))
            wu = min(1, wc_light)
            ww = (wx1 - wx0) * (1 - 0.85 * wu)
            pts = [T(wx1, wy0), T(wx1 - ww, wy0 - 40 * wu), T(wx1 - ww, wy1 + 40 * wu), T(wx1, wy1)]
            c.d.polygon([(p[0] * AS, p[1] * AS) for p in pts], fill=(214, 206, 186, 255))
            ox, oy = T(wx0 + 20, wy0 - 180)
            ox2, oy2 = T(wx1 - 20, wy0 - 80)
            c.d.rectangle([ox * AS, oy * AS, ox2 * AS, oy2 * AS], fill=(255, 250, 220, 255))
        else:
            p0, p1 = T(wx0, wy0), T(wx1, wy1)
            c.d.rectangle([p0[0] * AS, p0[1] * AS, p1[0] * AS, p1[1] * AS], fill=(214, 206, 186, 255))
            for yy in (wy0 + 60, wy0 + 460):
                q0, q1 = T(wx0 + 40, yy), T(wx1 - 40, yy + 340)
                c.d.rectangle([q0[0] * AS, q0[1] * AS, q1[0] * AS, q1[1] * AS], outline=(190, 180, 160, 255), width=int(6 * k * AS))
            hx, hy = T(wx1 - 40, 1020)
            c.d.ellipse([(hx - 12 * k) * AS, (hy - 12 * k) * AS, (hx + 12 * k) * AS, (hy + 12 * k) * AS], fill=(200, 190, 140, 255))
            # табличка с человечком
            q0, q1 = T((wx0 + wx1) / 2 - 30, wy0 - 40), T((wx0 + wx1) / 2 + 30, wy0 - 4)


class HallScenes:
    def __init__(self):
        self.h = Hall()
        self.fish = self._fisheye_map()

    def hall(self, t):
        A0 = EV["hall_walk0"]
        A1 = EV["hall_walk1"]
        u = ramp(t, A0, A1)

        def actors(c, k, X0, Y0):
            sc = 0.72
            if t < A1:
                x = lerp(-60, 470, u)
                Hm.side(c.sub((x - X0) * k, (1700 - 1700 * sc - Y0) * k, sc * k), C.ANDREY, dict(legs="walk", phase=(t - A0) * 8.2, blink=TL.blink(t, 1)))
            else:
                lean = ramp(t, EV["peep"] - 0.8, EV["peep"])
                Hm.back(c.sub((540 - X0) * k, (1700 - 1700 * sc - Y0 + 20 * lean) * k, sc * k), C.ANDREY,
                        dict(arms=((10, 8), (30, 120 * lean)) if lean > 0 else ((10, 8), (10, 8))))
        w = lerp(1180, 1000, ramp(t, A0, A1 + 3))
        return self.h.view(t, 540, 1000, w, actors)

    def _fisheye_map(self):
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        nx, ny = (xx - W / 2) / (W / 2), (yy - H / 2) / (W / 2)
        r = np.sqrt(nx ** 2 + ny ** 2)
        k = 1 + 0.55 * r ** 2
        sx = np.clip(W / 2 + nx / k * (W / 2) * 1.25, 0, W - 1).astype(np.int32)
        sy = np.clip(H / 2 + ny / k * (W / 2) * 1.25, 0, H - 1).astype(np.int32)
        mask = np.clip((0.98 - r) / 0.06, 0, 1)[..., None].astype(np.float32)
        return sx, sy, mask, r

    def peephole(self, t):
        P0 = TL.SHOTS[[s[0] for s in TL.SHOTS].index("peephole")][1]
        lt = t - P0
        base = self.h.landing.copy()
        c = Cv(W, H, AS)
        sc = 0.95
        mama_front(c, 540 + 10 * math.sin(lt * 0.8), 560 + 6 * math.sin(lt * 1.3), 0.8, t, mouth=0.0, smile=0.75, gaze=0.0)
        im = c.im.reduce(AS)
        a4 = np.asarray(im, np.float32) / 255
        al = a4[..., 3:4]
        lightm = 0.45 + 0.7 * radial(W, H, 540, 200, 1400, 1.1)[..., None]
        base = base * (1 - al) + a4[..., :3] * al * lightm * np.array([1.0, 0.92, 0.78], np.float32)
        sx, sy, mask, r = self.fish
        out = base[sy, sx]
        out = out * (1 - 0.35 * r[..., None] ** 2)
        out = out * mask
        # блик линзы
        g = radial(W, H, 380, 640, 260, 2.0)[..., None] * 0.12
        out = out + g * mask
        # приближение к глазку в начале
        z = 1 + 0.25 * (1 - ramp(lt, 0, 0.6))
        if z > 1.001:
            ci = to_im(out)
            cw, ch = W / z, H / z
            ci = ci.crop((int(W / 2 - cw / 2), int(H / 2 - ch / 2), int(W / 2 + cw / 2), int(H / 2 + ch / 2))).resize((W, H))
            out = np.asarray(ci, np.float32) / 255
        out *= min(1, lt / 0.3) * min(1, max(0, (3.2 - lt) / 0.3))
        return out

    def hall2(self, t):
        do = ramp(t, EV["door_open0"], EV["door_open1"]) * (1 - ramp(t, EV["door_close0"], EV["door_close1"]))
        wc = ramp(t, EV["toilet0"], EV["toilet0"] + 0.6) * (1 - ramp(t, EV["toilet1"] + 0.4, EV["toilet1"] + 1.0))
        creep = ramp(t, EV["creep0"], EV["creep0"] + 4.5)
        flick = 0.0
        if t > EV["creep0"] + 1.0:
            flick = 1.0 if smooth_noise(t * 6, 11) > 0.3 else 0.3

        mi0, mi1 = EV["mama_in0"], EV["mama_in1"]

        def through(c, k, X0, Y0):
            # мама на площадке, пока не вошла
            if t < mi0:
                mama_front(c, (540 - X0) * k, (720 - Y0) * k, 0.42 * k, t, smile=0.7, gaze=0.0)

        def actors(c, k, X0, Y0):
            T = lambda x, y: ((x - X0) * k, (y - Y0) * k)
            sc = 0.72
            # Андрей
            a_x = 540
            if t < EV["door_open1"]:
                a_x = lerp(540, 300, ramp(t, EV["door_open0"], EV["door_open1"]))
            elif t > EV["door_close0"] - 0.6:
                a_x = lerp(300, 470, ramp(t, EV["door_close0"] - 0.6, EV["door_close0"])) if t < EV["sigh"] else lerp(470, 600, ramp(t, EV["sigh"] + 0.6, EV["toilet0"]))
            else:
                a_x = 300
            mo = TL.mouth(["andrey"], t)
            turn, gaze, smile, brows = 0.5, 1.0, 0.2, 0.0
            if TL.LINE["a6"][0] < t < TL.LINE["a6"][0] + TL.LINE["a6"][1]:
                smile, brows = 0.5, 0.4
                if t > TL.LINE["a6"][0] + 1.2:
                    smile, brows, gaze = 0.2, 0.5, 0.4    # смущённо отводит взгляд
            if t > EV["mama_go"]:
                turn, gaze = 0.6, 1.0
            if t > EV["toilet0"]:
                turn, gaze, smile = -0.6, -1.0, 0.0
            if TL.LINE["a8"][0] < t < TL.LINE["a8"][0] + TL.LINE["a8"][1]:
                smile, brows = 0.8, 0.5
            if t > TL.LINE["x4"][0] + 0.8:
                smile, brows = -0.2, 1.0
            if t > EV["creep0"] + 2.5:
                turn, gaze = 0.7, 1.0
            arms = ((10, 10), (10, 10))
            a7 = TL.LINE["a7"]
            if a7[0] < t < a7[0] + a7[1] + 0.4:
                arms = ((10, 10), {"ik": (560, 380)})
            if TL.LINE["a8"][0] < t < TL.LINE["a8"][0] + 2.0:
                arms = ({"ik": (-220, 500)}, {"ik": (220, 500)})
            sigh = 0.0
            if EV["sigh"] < t < EV["sigh"] + 1.3:
                sigh = math.sin(math.pi * (t - EV["sigh"]) / 1.3)
            facing_door = EV["door_close0"] - 0.6 < t < EV["sigh"] + 0.4
            if facing_door:
                Hm.back(c.sub(*T(a_x, 1700 - 1700 * sc), sc * k), C.ANDREY, dict(arms=((10, 8), (40, 70))))
            else:
                walking = EV["sigh"] + 0.6 < t < EV["toilet0"]
                if walking:
                    Hm.side(c.sub(*T(a_x, 1700 - 1700 * sc), sc * k), C.ANDREY, dict(legs="walk", phase=t * 8))
                else:
                    Hm.front(c.sub(*T(a_x, 1700 - 1700 * sc + 14 * sigh), sc * k), C.ANDREY,
                             dict(face=dict(turn=turn, gaze=gaze, blink=max(TL.blink(t, 1), sigh * 0.8), mouth=mo, smile=smile, brows=brows - sigh * 0.6),
                                  arms=arms, breath=math.sin(t * 1.6) + sigh * 2))
            # мама: входит, говорит, уходит направо
            if mi0 <= t < EV["mama_go"] + 1.6:
                if t < mi1:
                    u = ramp(t, mi0, mi1)
                    msc = lerp(0.42, 0.68, u)
                    mx = lerp(540, 640, u)
                    mama_front(c, *T(mx, lerp(720, 1700 - 1700 * 0.68, u)), msc * k, t, smile=0.7, phase=(t - mi0) * 7)
                elif t < EV["mama_go"]:
                    mmo = TL.mouth(["mama"], t)
                    mama_front(c, *T(640, 1700 - 1700 * 0.68), 0.68 * k, t, mouth=mmo, smile=0.6 if mmo < 0.1 else 0.4, turn=-0.45, gaze=-0.9)
                else:
                    u = (t - EV["mama_go"]) / 1.6
                    mx = lerp(640, 1150, u)
                    Hm.side(c.sub(*T(mx, 1700 - 1700 * 0.66), 0.66 * k), C.MAMA, dict(legs="walk", phase=(t - EV["mama_go"]) * 7.5,
                            prop=lambda cc, p, a: pie(cc, p[0] + 60, p[1] - 40, 0.8)))
            # Саша выходит из туалета
            if t > EV["toilet0"] + 0.4:
                ssc = 0.7
                if t < EV["toilet1"]:
                    u = ramp(t, EV["toilet0"] + 0.4, EV["toilet1"])
                    sx = lerp(-20, 180, u)
                    Hm.side(c.sub(*T(sx, 1700 - 1700 * ssc), ssc * k), C.SASHA, dict(legs="walk", phase=t * 8))
                else:
                    smo = TL.mouth(["sasha"], t)
                    st, sg, sb, ssm = 0.55, 1.0, 0.0, 0.0
                    if t > TL.LINE["x4"][0] - 0.5:
                        sb, ssm, sg = 0.6, -0.4, 0.6
                    if t > EV["creep0"] + 2.5:
                        st, sg = 0.7, 1.0
                    Hm.front(c.sub(*T(180, 1700 - 1700 * ssc), ssc * k), C.SASHA,
                             dict(face=dict(turn=st, gaze=sg, blink=TL.blink(t, 3), mouth=smo, brows=sb, smile=ssm), breath=math.sin(t * 1.7)))
        cx = lerp(540, 800, creep)
        w = lerp(1150, 760, creep)
        cy = lerp(1000, 1000, creep)
        return self.h.view(t, cx, cy, w, actors, wc_light=wc, door_open=do, kitchen_flicker=flick * creep, through=through)
