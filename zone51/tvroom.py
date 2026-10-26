"""Сцена 2: старый телевизор на фоне ночного окна; наезд камеры в экран."""
import math, random
import numpy as np
from PIL import Image, ImageFilter
from gfx import Cv, to_f, to_im, radial, ease, smooth_noise, font, FONT_SERIF, FONT_B, vgrad
from room import wallpaper

W, H = 1080, 1920
WS = 2.0          # мир в 2 раза больше кадра (для глубокого наезда)
SCR = (290, 1090, 690, 1410)   # экран в логических координатах


def night_sky(c):
    rnd = random.Random(7)
    sky = vgrad(int(W * c.s), int(1100 * c.s), [(0, (6, 10, 30)), (0.6, (16, 26, 58)), (1, (40, 46, 80))])
    c.im.paste(to_im(sky).convert("RGBA"), (0, 0))
    for _ in range(140):
        x, y = rnd.uniform(0, W), rnd.uniform(0, 700)
        r = rnd.choice((1.2, 1.6, 2.2))
        c.circ(x, y, r, (255, 255, 240, rnd.randint(120, 255)))
    # луна
    for r, a in ((140, 20), (90, 40), (60, 70)):
        c.circ(760, 330, r, (200, 210, 255, a))
    c.circ(760, 330, 46, (246, 244, 226, 255))
    c.circ(778, 318, 42, (30, 40, 76, 255))
    # панельки
    blds = [(140, 760, 300), (290, 820, 470), (470, 720, 640), (640, 800, 780), (790, 740, 960)]
    for x0, top, x1 in blds:
        c.rect((x0, top, x1, 1100), (22, 26, 44, 255))
        for y in range(int(top) + 14, 1090, 22):
            for x in range(int(x0) + 10, int(x1) - 10, 20):
                v = rnd.random()
                if v < 0.22:
                    col = rnd.choice([(255, 206, 120, 255), (255, 180, 90, 255), (180, 220, 255, 255), (255, 230, 170, 255)])
                elif v < 0.3:
                    col = (90, 110, 160, 255)  # телевизор в окне
                else:
                    col = (34, 38, 60, 255)
                c.rect((x, y, x + 10, y + 12), col)
        c.rect((x0, top - 8, x1, top), (30, 34, 54, 255))
    c.rect((0, 1000, W, 1100), (60, 50, 70, 120))


class TVRoom:
    def __init__(self):
        s = WS
        self.Wp, self.Hp = int(W * s), int(H * s)
        c = Cv(W, H, s, (0, 0, 0, 255))
        wallpaper(c)
        # пол
        c.rect((0, 1680, W, H), (90, 58, 34, 255))
        for i in range(12):
            c.line([(0, 1700 + i * 22), (W, 1700 + i * 22)], (70, 44, 26, 255), 3)
        c.rect((0, 1670, W, 1694), (80, 48, 28, 255))
        # окно (рамка), стекло отдельно (светится)
        c.rect((150, 160, 930, 1080), (210, 210, 200, 255))
        glass = [(176, 186, 530, 620), (550, 186, 904, 620), (176, 640, 530, 1056), (550, 640, 904, 1056)]
        for g in glass:
            c.rect(g, (0, 0, 0, 255))
        # подоконник + батарея
        c.rect((120, 1070, 960, 1108), (236, 234, 226, 255))
        c.rect((130, 1100, 950, 1116), (180, 178, 170, 255))
        for x in range(260, 820, 34):
            c.rect((x, 1130, x + 26, 1300), (200, 196, 186, 255), r=8)
        # растения на подоконнике
        c.poly([(200, 1072), (196, 1010), (270, 1010), (266, 1072)], (170, 90, 50, 255))
        c.rect((222, 900, 246, 1012), (60, 120, 60, 255), r=12)
        c.rect((196, 940, 214, 990), (60, 120, 60, 255), r=8)
        c.rect((252, 925, 270, 980), (60, 120, 60, 255), r=8)
        c.poly([(830, 1072), (826, 1016), (900, 1016), (896, 1072)], (180, 100, 60, 255))
        for a in range(-60, 61, 20):
            r = math.radians(a)
            c.line([(863, 1016), (863 + math.sin(r) * 70, 1016 - math.cos(r) * 80)], (50, 110, 50, 255), 10)
        for fx, fy in ((830, 930), (880, 920), (905, 960), (850, 960)):
            c.circ(fx, fy, 14, (210, 40, 50, 255))
        # шторы
        for x0, x1 in ((60, 230), (850, 1020)):
            c.rect((x0, 110, x1, 1340), (110, 26, 34, 255))
            for i, x in enumerate(range(int(x0), int(x1), 24)):
                c.rect((x, 110, x + 12, 1340), (90, 18, 26, 255) if i % 2 else (130, 36, 44, 255))
            c.rect((x0, 1300, x1, 1340), (90, 20, 28, 255))
        c.rect((30, 92, 1050, 112), (170, 140, 80, 255), r=8)
        for x in range(70, 1020, 40):
            c.circ(x, 112, 8, (190, 160, 100, 255))
        # тумба
        c.rect((190, 1500, 890, 1600), (96, 56, 30, 255), r=6)
        c.rect((190, 1500, 890, 1516), (130, 80, 44, 255))
        for x0 in (230, 830):
            c.poly([(x0, 1600), (x0 + 24, 1600), (x0 + 16 if x0 < 500 else x0 + 30, 1830), (x0 + 4 if x0 < 500 else x0 + 18, 1830)], (80, 46, 24, 255))
        c.line([(860, 1560), (950, 1640), (980, 1700)], (20, 20, 20, 255), 6, smooth=True)   # провод
        # корпус ТВ
        c.rect((250, 1040, 850, 1512), (30, 20, 14, 120), r=30)
        c.rect((240, 1030, 840, 1500), (122, 74, 40, 255), r=26)
        for i in range(40):  # текстура дерева
            y = 1040 + i * 11.5
            c.line([(250, y), (830, y + 4 * math.sin(i))], (108, 64, 34, 255), 2)
        c.rect((262, 1060, 716, 1440), (40, 38, 36, 255), r=40)
        c.rect((276, 1076, 704, 1424), (20, 20, 22, 255), r=36)
        # правая панель: динамик и ручки
        c.rect((730, 1070, 820, 1450), (70, 44, 26, 255), r=10)
        for y in range(1090, 1290, 16):
            c.rect((744, y, 806, y + 8), (30, 22, 16, 255), r=4)
        for ky in (1340, 1410):
            c.circ(775, ky, 30, (30, 30, 30, 255))
            c.circ(775, ky, 24, (180, 176, 168, 255))
            c.line([(775, ky), (775 + 18, ky - 12)], (40, 40, 40, 255), 5)
        c.text((490, 1470), "РУБИН", 34, (220, 190, 120, 255), FONT_SERIF, anchor="mm")
        # салфетка и статуэтка на телевизоре
        c.poly([(320, 1030), (760, 1030)] + [(760 - i * 22, 1060 + (12 if i % 2 else 0)) for i in range(21)], (236, 232, 222, 255))
        c.ell((640, 990, 720, 1034), (230, 230, 236, 255))
        c.circ(700, 980, 22, (230, 230, 236, 255))
        c.poly([(712, 972), (730, 960), (722, 990)], (230, 230, 236, 255))
        c.circ(706, 976, 3, (30, 30, 30, 255))
        # антенна «рога»
        c.ell((500, 1004, 580, 1036), (40, 40, 44, 255))
        c.line([(530, 1010), (360, 720)], (180, 180, 190, 255), 6)
        c.line([(550, 1010), (740, 700)], (180, 180, 190, 255), 6)
        c.circ(360, 720, 9, (200, 200, 210, 255))
        c.circ(740, 700, 9, (200, 200, 210, 255))
        # фикус слева
        c.poly([(40, 1900), (30, 1760), (190, 1760), (180, 1900)], (150, 80, 46, 255))
        c.rect((24, 1748, 196, 1776), (170, 96, 56, 255), r=6)
        c.line([(110, 1760), (100, 1500), (120, 1250)], (80, 60, 30, 255), 10, smooth=True)
        rnd = random.Random(11)
        for i in range(22):
            y = 1270 + i * 22
            side = -1 if i % 2 else 1
            x = 108 + side * 10
            c.poly([(x, y), (x + side * 90, y - 40 + rnd.uniform(-15, 15)), (x + side * 130, y - 10), (x + side * 60, y + 26)], (40 + rnd.randint(0, 30), 110 + rnd.randint(0, 40), 50, 255), smooth=True)
        # столик с дисковым телефоном справа
        c.rect((900, 1560, 1080, 1590), (110, 66, 36, 255))
        c.rect((920, 1590, 940, 1900), (90, 54, 30, 255))
        c.poly([(930, 1560), (950, 1480), (1060, 1480), (1080, 1560)], (180, 30, 30, 255), smooth=False)
        c.circ(1005, 1520, 30, (230, 220, 210, 255))
        c.circ(1005, 1520, 10, (180, 30, 30, 255))
        for i in range(10):
            a = math.radians(200 + i * 22)
            c.circ(1005 + math.cos(a) * 20, 1520 + math.sin(a) * 20, 4, (60, 60, 60, 255))
        c.rect((940, 1450, 1076, 1478), (160, 24, 24, 255), r=14)
        c.line([(940, 1560), (900, 1620), (930, 1700)], (60, 20, 20, 255), 4, smooth=True)
        # календарь на стене
        c.rect((960, 300, 1060, 440), (240, 236, 226, 255))
        c.rect((960, 300, 1060, 336), (180, 30, 30, 255))
        c.text((1010, 318), "1991", 22, (255, 240, 220, 255), FONT_B, anchor="mm")
        for i in range(5):
            c.line([(972, 352 + i * 18), (1048, 352 + i * 18)], (150, 140, 130, 255), 3)
        self.alb = c.im.convert("RGB")
        # маски: стекло окна (эмиссия), экран
        m = Cv(W, H, s, (0, 0, 0, 255))
        for g in glass:
            m.rect(g, (255, 255, 255, 255))
        k = (0, 0, 0, 255)   # то, что стоит перед окном
        m.rect((240, 1030, 840, 1500), k, r=26)
        m.line([(530, 1010), (360, 720)], k, 6)
        m.line([(550, 1010), (740, 700)], k, 6)
        m.circ(360, 720, 9, k); m.circ(740, 700, 9, k)
        m.ell((500, 1004, 580, 1036), k)
        m.ell((640, 990, 720, 1034), k); m.circ(700, 980, 22, k)
        m.poly([(712, 972), (730, 960), (722, 990)], k)
        m.poly([(320, 1030), (760, 1030)] + [(760 - i * 22, 1060 + (12 if i % 2 else 0)) for i in range(21)], k)
        sky = Cv(W, H, s, (0, 0, 0, 255))
        night_sky(sky)
        # тюль поверх стекла
        tul = Cv(W, H, s)
        tul.rect((176, 150, 904, 1060), (230, 230, 240, 22))
        for x in range(176, 904, 26):
            tul.line([(x, 150), (x + 4, 1060)], (240, 240, 250, 16), 6)
        for x in range(176, 904, 40):   # кружевной низ тюля
            tul.circ(x + 20, 1030, 16, (240, 240, 250, 45))
            tul.circ(x, 1000, 9, (240, 240, 250, 35))
        sk = sky.im.copy()
        sk.alpha_composite(tul.im)
        self.sky = sk.convert("RGB")
        self.glass = m.im.convert("L")
        sm = Cv(W, H, s, (0, 0, 0, 255))
        sm.rect(SCR, (255, 255, 255, 255), r=30)
        self.scr_mask = sm.im.convert("L")
        # низкое разрешение карт освещения
        lw, lh = 270, 480
        sx, sy = (SCR[0] + SCR[2]) / 2 / W * lw, (SCR[1] + SCR[3]) / 2 / H * lh
        self.L_tv = radial(lw, lh, sx, sy, lw * 0.95, 1.4)[..., None]
        self.L_win = radial(lw, lh, lw * 0.5, lh * 0.32, lw * 0.75, 1.5)[..., None]
        self.lw, self.lh = lw, lh

    def view(self, t, content, zoom, cx, cy):
        """content: float HxWx3 кадр трансляции 1080x1920. cx, cy — центр кадра в логических координатах."""
        cw, ch = W / zoom, H / zoom
        x0 = min(max(cx - cw / 2, 0), W - cw)
        y0 = min(max(cy - ch / 2, 0), H - ch)
        box = (int(x0 * WS), int(y0 * WS), int((x0 + cw) * WS), int((y0 + ch) * WS))
        alb = np.asarray(self.alb.crop(box).resize((W, H), Image.BILINEAR), np.float32) / 255
        sky = np.asarray(self.sky.crop(box).resize((W, H), Image.BILINEAR), np.float32) / 255
        gl = np.asarray(self.glass.crop(box).resize((W, H), Image.BILINEAR), np.float32)[..., None] / 255
        sm = np.asarray(self.scr_mask.crop(box).resize((W, H), Image.BILINEAR), np.float32)[..., None] / 255
        lb = (x0 / W * self.lw, y0 / H * self.lh, (x0 + cw) / W * self.lw, (y0 + ch) / H * self.lh)
        bright = float(content.mean())
        flick = 0.85 + 0.15 * smooth_noise(t * 4, 3)
        Ltv = np.asarray(Image.fromarray((self.L_tv[..., 0] * 255).astype(np.uint8)).crop(tuple(int(v) for v in lb)).resize((W, H), Image.BILINEAR), np.float32)[..., None] / 255
        Lw = np.asarray(Image.fromarray((self.L_win[..., 0] * 255).astype(np.uint8)).crop(tuple(int(v) for v in lb)).resize((W, H), Image.BILINEAR), np.float32)[..., None] / 255
        L = np.array([0.09, 0.10, 0.15], np.float32) + Ltv * (0.8 + 1.4 * bright) * flick * np.array([0.6, 0.75, 1.0], np.float32) \
            + Lw * np.array([0.25, 0.3, 0.5], np.float32)
        out = alb * L * (1 - gl) + sky * gl * 0.85
        # экран: контент вписан в экран (обрезка по центру)
        sx0 = (SCR[0] - x0) * zoom
        sy0 = (SCR[1] - y0) * zoom
        sw, sh = (SCR[2] - SCR[0]) * zoom, (SCR[3] - SCR[1]) * zoom
        ar = sw / sh
        cimg = to_im(content)
        crop_h = 1080 / ar
        cy0 = 860 - crop_h / 2
        cimg = cimg.crop((0, int(cy0), 1080, int(cy0 + crop_h)))
        X0, Y0 = int(sx0), int(sy0)
        X1, Y1 = int(sx0 + sw), int(sy0 + sh)
        full = Image.new("RGB", (W, H))
        if X1 - X0 > 2 and Y1 - Y0 > 2:
            full.paste(cimg.resize((X1 - X0, Y1 - Y0), Image.BILINEAR), (X0, Y0))
        scr = np.asarray(full, np.float32) / 255
        # кинескоп: выпуклость-блик и затемнение по краям
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        u = (xx - (X0 + X1) / 2) / max(1, (X1 - X0) / 2)
        v = (yy - (Y0 + Y1) / 2) / max(1, (Y1 - Y0) / 2)
        vig = np.clip(1 - 0.35 * (u * u + v * v) ** 1.5, 0, 1)[..., None]
        glare = np.clip(1 - ((u + 0.45) ** 2 / 0.12 + (v + 0.55) ** 2 / 0.05), 0, 1)[..., None] * 0.18
        scr = scr * vig * 1.05 + glare + 0.02
        out = out * (1 - sm) + scr * sm
        return out
