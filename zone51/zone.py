"""Мир «Зона 51»: фон (небо, горы, база, забор, полиция), огонь и дым, фары-мигалки."""
import math, random
import numpy as np
from PIL import Image, ImageFilter
from gfx import Cv, to_f, to_im, vgrad, radial, font, FONT_C, FONT_B, glow_sprite, add_over, smooth_noise

W, H = 1080, 1920
WX0, WX1, WY0, WY1 = -300, 1380, 0, 2800   # границы мира (лог. ед.)
KM = 1.6                                   # пикселей мастер-картинки на ед. мира
HOR = 1000                                 # линия горизонта


def police_car(c, x, y, sc, facing=1, text="ПОЛИЦИЯ"):
    """Машина сбоку. (x,y) — центр низа колёс. Возвращает позиции мигалок (мир)."""
    f = facing
    L = 260 * sc
    hh = 70 * sc
    body = [(x - L / 2, y - 22 * sc), (x - L / 2, y - hh + 8 * sc), (x - L * 0.3 * f, y - hh), (x - L * 0.18 * f, y - hh - 52 * sc),
            (x + L * 0.2 * f, y - hh - 52 * sc), (x + L * 0.32 * f, y - hh), (x + L / 2, y - hh + 12 * sc), (x + L / 2, y - 22 * sc)]
    c.poly(body, (18, 18, 22, 255))
    c.poly([(x - L * 0.3 * f, y - hh), (x + L * 0.32 * f, y - hh), (x + L / 2, y - hh + 12 * sc), (x + L / 2, y - 40 * sc), (x - L / 2, y - 40 * sc), (x - L / 2, y - hh + 8 * sc)],
           (190, 190, 196, 255))
    c.poly([(x - L * 0.25 * f, y - hh - 2 * sc), (x - L * 0.15 * f, y - hh - 46 * sc), (x + L * 0.17 * f, y - hh - 46 * sc), (x + L * 0.27 * f, y - hh - 2 * sc)], (40, 50, 70, 255))
    c.line([(x + 0.01 * L * f, y - hh - 46 * sc), (x + 0.01 * L * f, y - hh)], (18, 18, 22, 255), 6 * sc)
    c.text((x, y - 56 * sc), text, 20 * sc, (20, 30, 70, 255), FONT_C, anchor="mm")
    for wx in (x - L * 0.32, x + L * 0.32):
        c.circ(wx, y - 16 * sc, 24 * sc, (10, 10, 12, 255))
        c.circ(wx, y - 16 * sc, 11 * sc, (90, 90, 96, 255))
    by = y - hh - 58 * sc
    c.rect((x - 46 * sc, by - 6 * sc, x + 46 * sc, by + 8 * sc), (30, 30, 34, 255), r=4 * sc)
    c.rect((x - 44 * sc, by - 4 * sc, x - 2 * sc, by + 6 * sc), (220, 40, 50, 255))
    c.rect((x + 2 * sc, by - 4 * sc, x + 44 * sc, by + 6 * sc), (40, 90, 240, 255))
    # фары
    c.circ(x + L / 2 * f - 6 * sc * f, y - 48 * sc, 7 * sc, (255, 240, 200, 255))
    return [((x - 24 * sc, by), "r", sc), ((x + 24 * sc, by), "b", sc)]


def fire_truck(c, x, y, sc):
    L = 380 * sc
    c.rect((x - L / 2, y - 120 * sc, x + L / 2, y - 20 * sc), (150, 20, 20, 255), r=6 * sc)
    c.rect((x + L / 2 - 90 * sc, y - 160 * sc, x + L / 2, y - 60 * sc), (170, 24, 24, 255), r=10 * sc)
    c.rect((x + L / 2 - 80 * sc, y - 150 * sc, x + L / 2 - 10 * sc, y - 110 * sc), (40, 50, 70, 255))
    c.line([(x - L / 2, y - 130 * sc), (x + L / 2 - 100 * sc, y - 150 * sc)], (200, 200, 200, 255), 6 * sc)
    for k in range(8):
        xx = x - L / 2 + k * (L - 100 * sc) / 7
        c.line([(xx, y - 128 * sc), (xx, y - 148 * sc)], (200, 200, 200, 255), 3 * sc)
    c.rect((x - L / 2, y - 70 * sc, x + L / 2, y - 60 * sc), (230, 230, 230, 255))
    for wx in (x - L * 0.32, x + L * 0.2, x + L * 0.38):
        c.circ(wx, y - 16 * sc, 26 * sc, (10, 10, 12, 255))
    return [((x + L / 2 - 60 * sc, y - 166 * sc), "r", sc), ((x + L / 2 - 30 * sc, y - 166 * sc), "r", sc)]


def ambulance(c, x, y, sc):
    L = 300 * sc
    c.rect((x - L / 2, y - 150 * sc, x + L / 4, y - 20 * sc), (236, 236, 236, 255), r=8 * sc)
    c.poly([(x + L / 4, y - 110 * sc), (x + L / 2 - 20 * sc, y - 100 * sc), (x + L / 2, y - 60 * sc), (x + L / 2, y - 20 * sc), (x + L / 4, y - 20 * sc)], (236, 236, 236, 255))
    c.rect((x - L / 2, y - 80 * sc, x + L / 2, y - 66 * sc), (220, 40, 40, 255))
    c.rect((x - 70 * sc, y - 130 * sc, x - 40 * sc, y - 100 * sc), (220, 40, 40, 255))
    c.rect((x - 85 * sc, y - 120 * sc, x - 25 * sc, y - 110 * sc), (220, 40, 40, 255))
    for wx in (x - L * 0.32, x + L * 0.3):
        c.circ(wx, y - 16 * sc, 24 * sc, (10, 10, 12, 255))
    return [((x - L / 2 + 20 * sc, y - 158 * sc), "r", sc), ((x + L / 4 - 20 * sc, y - 158 * sc), "b", sc)]


def news_van(c, x, y, sc):
    L = 320 * sc
    c.rect((x - L / 2, y - 170 * sc, x + L / 2, y - 20 * sc), (230, 230, 236, 255), r=14 * sc)
    c.rect((x - L / 2, y - 100 * sc, x + L / 2, y - 60 * sc), (200, 20, 30, 255))
    c.text((x, y - 80 * sc), "НОВОСТИ ДНЯ", 24 * sc, (255, 255, 255, 255), FONT_C, anchor="mm")
    c.line([(x - 40 * sc, y - 170 * sc), (x - 40 * sc, y - 230 * sc)], (160, 160, 170, 255), 6 * sc)
    c.ell((x - 100 * sc, y - 290 * sc, x + 20 * sc, y - 210 * sc), (220, 220, 230, 255))
    for wx in (x - L * 0.32, x + L * 0.32):
        c.circ(wx, y - 16 * sc, 24 * sc, (10, 10, 12, 255))


def barricade(c, x, y, sc):
    c.line([(x - 60 * sc, y), (x - 40 * sc, y - 60 * sc)], (60, 50, 40, 255), 6 * sc)
    c.line([(x + 60 * sc, y), (x + 40 * sc, y - 60 * sc)], (60, 50, 40, 255), 6 * sc)
    c.rect((x - 70 * sc, y - 70 * sc, x + 70 * sc, y - 50 * sc), (240, 240, 240, 255))
    for k in range(5):
        xx = x - 70 * sc + k * 30 * sc
        c.poly([(xx, y - 70 * sc), (xx + 15 * sc, y - 70 * sc), (xx + 5 * sc, y - 50 * sc), (xx - 10 * sc, y - 50 * sc)], (230, 90, 20, 255))


def draw_world(c, rnd):
    """Рисует мир на холсте c (s=KM, смещение -WX0)."""
    # земля
    c.rect((WX0, HOR, WX1, WY1), (30, 24, 24, 255))
    for i in range(40):
        y0 = HOR + (i / 40) ** 1.6 * (WY1 - HOR)
        y1 = HOR + ((i + 1) / 40) ** 1.6 * (WY1 - HOR)
        v = i / 40
        c.rect((WX0, y0, WX1, y1 + 1), (int(32 + 30 * v), int(25 + 18 * v), int(25 + 10 * v), 255))
    # дорога к воротам
    c.poly([(510, 1040), (570, 1040), (1500, WY1), (-420, WY1)], (34, 32, 36, 255))
    for k in range(14):
        a = (k / 14) ** 1.7
        b = ((k + 0.45) / 14) ** 1.7
        ya, yb = 1040 + a * (WY1 - 1040), 1040 + b * (WY1 - 1040)
        wa, wb = 3 + a * 26, 3 + b * 26
        xa, xb = 540 + a * 0, 540
        c.poly([(xa - wa / 2, ya), (xa + wa / 2, ya), (xb + wb / 2, yb), (xb - wb / 2, yb)], (180, 160, 60, 255))
    # камни, кусты
    for _ in range(160):
        y = HOR + 20 + (rnd.random() ** 1.5) * (WY1 - HOR - 40)
        v = (y - HOR) / (WY1 - HOR)
        x = rnd.uniform(WX0, WX1)
        if abs(x - 540) < 60 + v * 900:
            continue
        r = 2 + v * 22 * rnd.uniform(0.5, 1.5)
        if rnd.random() < 0.5:
            c.ell((x - r * 1.4, y - r, x + r * 1.4, y), (20, 16, 16, 255))
        else:
            for k in range(5):
                a = math.radians(-70 + k * 35)
                c.line([(x, y), (x + math.sin(a) * r * 1.6, y - math.cos(a) * r * 1.6)], (26, 22, 18, 255), max(1, r / 5))
    # горы
    pts = [(WX0, HOR)]
    for i in range(36):
        x = WX0 + i * (WX1 - WX0) / 35
        pts.append((x, HOR - 40 - 50 * abs(math.sin(i * 0.7)) - 30 * rnd.random()))
    pts.append((WX1, HOR))
    c.poly(pts, (24, 16, 24, 255))
    # база: ангары, вышка, антенна
    dk = (26, 20, 24, 255)
    c.rect((150, 930, 1000, 1030), dk)
    hangar = [(300, 1030)] + [(470 + 170 * math.cos(math.radians(a)), 1030 - 150 * math.sin(math.radians(a))) for a in range(0, 181, 10)] + [(640, 1030)]
    c.poly(hangar[::-1], (32, 24, 28, 255))
    for k in range(1, 6):
        x = 300 + k * 340 / 6
        hgt = 150 * math.sqrt(max(0, 1 - ((x - 470) / 170) ** 2))
        c.line([(x, 1030), (x, 1030 - hgt)], (44, 34, 38, 255), 3)
    c.rect((400, 960, 540, 1030), (60, 30, 20, 255))  # ворота ангара (светятся огнём)
    c.rect((680, 950, 880, 1030), (30, 22, 26, 255))
    for x in range(700, 870, 34):
        c.rect((x, 968, x + 18, 984), (255, 140, 40, 255) if rnd.random() < 0.6 else (60, 40, 40, 255))
    c.rect((215, 780, 240, 1030), dk)
    c.rect((185, 740, 270, 790), (34, 26, 30, 255))
    c.rect((192, 750, 263, 772), (255, 160, 60, 255))
    c.line([(227, 740), (227, 690)], dk, 4)
    c.line([(940, 1030), (940, 930)], dk, 8)
    c.poly([(880, 860), (1000, 900), (990, 940), (870, 905)], (40, 30, 34, 255), smooth=True)
    c.text((470, 905), "51", 60, (60, 46, 50, 255), FONT_C, anchor="mm")
    # забор
    for x in range(WX0, WX1, 8):
        c.line([(x, 1000), (x + 30, 1060)], (70, 66, 70, 255), 1.2)
        c.line([(x + 30, 1000), (x, 1060)], (70, 66, 70, 255), 1.2)
    for x in range(WX0, WX1, 70):
        c.line([(x, 990), (x, 1062)], (90, 86, 90, 255), 4)
        c.line([(x, 990), (x + 12, 980)], (90, 86, 90, 255), 3)
    for k in range(3):
        c.line([(WX0, 984 + k * 8), (WX1, 984 + k * 8)], (100, 96, 100, 255), 1.5)
    c.rect((496, 996, 584, 1064), (30, 24, 24, 255))   # открытые ворота
    c.rect((620, 1010, 760, 1050), (230, 230, 220, 255))
    c.text((690, 1022), "ЗОНА 51", 15, (180, 20, 20, 255), FONT_C, anchor="mm")
    c.text((690, 1040), "ВХОД ЗАПРЕЩЁН", 11, (30, 30, 30, 255), FONT_C, anchor="mm")
    lights = []
    lights += fire_truck(c, 860, 1100, 0.5)
    lights += ambulance(c, 330, 1095, 0.45)
    # лента ограждения
    for x0, x1 in ((-200, 380), (700, 1300)):
        c.line([(x0, 1150), (x1, 1145)], (240, 200, 20, 255), 6)
        for x in range(x0, x1, 40):
            c.line([(x, 1149), (x + 14, 1147)], (20, 20, 20, 255), 6)
    for x in (-200, 380, 700, 1300):
        c.line([(x, 1130), (x, 1200)], (200, 200, 200, 255), 6)
    lights += police_car(c, 60, 1230, 1.0, 1)
    lights += police_car(c, 1040, 1250, 1.05, -1)
    barricade(c, 300, 1200, 0.8)
    barricade(c, 800, 1210, 0.8)
    return lights


def tile_noise(h, w, scale, seed):
    r = np.random.default_rng(seed).standard_normal((h, w))
    F = np.fft.fft2(r)
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    F *= np.exp(-(fx ** 2 + fy ** 2) * (scale ** 2))
    n = np.real(np.fft.ifft2(F))
    n = (n - n.min()) / (n.max() - n.min())
    return n.astype(np.float32)


def fire_cmap(v):
    v = np.clip(v, 0, 1.2)
    r = np.clip(v * 2.4, 0, 1)
    g = np.clip((v - 0.3) * 1.9, 0, 1)
    b = np.clip((v - 0.75) * 2.5, 0, 1)
    a = np.clip(v * 1.6, 0, 1)
    return np.stack([r, g * 0.85, b * 0.7], -1) * a[..., None]


class Zone:
    FR = 4.0   # ед. мира на пиксель карты огня

    def __init__(self):
        rnd = random.Random(51)
        mw, mh = int((WX1 - WX0) * KM), int((WY1 - WY0) * KM)
        c = Cv(WX1 - WX0, WY1 - WY0, KM, (0, 0, 0, 0), ox=-WX0 * KM, oy=-WY0 * KM)
        sky = vgrad(mw, int(HOR * KM), [(0, (6, 6, 18)), (0.55, (30, 14, 30)), (0.85, (110, 40, 30)), (1, (170, 70, 36))])
        c.im.paste(to_im(sky).convert("RGBA"), (0, 0))
        for _ in range(120):
            x, y = rnd.uniform(WX0, WX1), rnd.uniform(0, 500)
            c.circ(x, y, rnd.choice((1, 1.4, 2)), (255, 240, 230, rnd.randint(60, 200)))
        self.lights = draw_world(c, rnd)
        self.master = c.im.convert("RGB")
        self.master_blur = self.master.filter(ImageFilter.GaussianBlur(7))
        # карта огня (мир, низкое разрешение)
        fw, fh = int((WX1 - WX0) / self.FR), int(1300 / self.FR)   # Y 0..1300
        self.fw, self.fh = fw, fh
        self.sources = [(470, 1000, 150, 1.0), (470, 890, 60, 0.9), (227, 760, 40, 0.9), (780, 960, 90, 0.85), (940, 900, 50, 0.8),
                        (360, 1030, 50, 0.7), (600, 1035, 40, 0.7), (130, 1010, 40, 0.6), (1100, 1020, 60, 0.6), (560, 1000, 50, 0.8)]
        self.M = self.fire_map(self.sources)
        self.noise1 = tile_noise(fh, fw, 9, 1)
        self.noise2 = tile_noise(fh, fw, 4, 2)
        self.smoke_n = tile_noise(fh, fw, 18, 3)
        self.extra = None

    def fire_map(self, srcs, boom=0.0):
        yy, xx = np.mgrid[0:self.fh, 0:self.fw].astype(np.float32) * self.FR
        xx += WX0
        M = np.zeros_like(xx)
        for x, y, w, k in srcs:
            dx = (xx - x) / w
            up = (y - yy) / (w * 2.2)
            f = np.exp(-dx ** 2 * 2.2) * np.where(up > 0, np.exp(-np.clip(up, 0, 50) * 1.3), np.exp(np.clip(up, -50, 0) * 8)) * k
            M = np.maximum(M, f)
        return M

    def fire(self, t, boom=0.0):
        """Огонь + дым в координатах мира (RGB добавка, плотность дыма)."""
        sh1 = int(t * 60 / self.FR * 2.5) % self.fh
        sh2 = int(t * 110 / self.FR * 2.5) % self.fh
        n = 0.55 * np.roll(self.noise1, -sh1, 0) + 0.45 * np.roll(self.noise2, -sh2, 0)
        M = self.M
        if boom > 0:
            M = np.maximum(M, self.boom_map(boom))
        v = M * (0.35 + 1.2 * n) - 0.18
        rgb = fire_cmap(v * 1.25)
        sm = np.roll(self.smoke_n, -int(t * 20 / self.FR) % self.fh, 0)
        sh = np.clip(self.smoke_mask() * 1.5, 0, 1) * np.clip(sm * 2.0 - 0.45, 0, 1)
        return rgb, sh

    def smoke_mask(self):
        if not hasattr(self, "_sm"):
            yy, xx = np.mgrid[0:self.fh, 0:self.fw].astype(np.float32) * self.FR
            xx += WX0
            m = np.zeros_like(xx)
            for x, y, w, k in self.sources[:5]:
                up = (y - yy)
                spread = w * 0.8 + np.clip(up, 0, None) * 0.5
                f = np.exp(-((xx - x - np.clip(up, 0, None) * 0.25) / spread) ** 2) * np.clip(up / 200, 0, 1) * np.exp(-np.clip(up, 0, None) / 900)
                m = np.maximum(m, f * k)
            self._sm = m
        return self._sm

    def boom_map(self, b):
        """Огненный шар взрыва; b — время после взрыва (с)."""
        yy, xx = np.mgrid[0:self.fh, 0:self.fw].astype(np.float32) * self.FR
        xx += WX0
        r = 60 + 380 * (1 - math.exp(-b * 1.6))
        cy = 960 - 160 * (1 - math.exp(-b * 0.8))
        d = np.sqrt((xx - 470) ** 2 + ((yy - cy) * 1.2) ** 2) / r
        k = max(0.0, 1.3 - b * 0.12)
        return np.clip(1 - d, 0, 1) ** 0.7 * k * 1.3

    def view(self, t, X0, Y0, k, blur=0.0, boom=None, pulse=True):
        """Окно мира (левый верх X0,Y0; k пикс/ед.) -> float кадр 1080x1920."""
        ww, wh = W / k, H / k
        box = (int((X0 - WX0) * KM), int((Y0 - WY0) * KM), int((X0 + ww - WX0) * KM), int((Y0 + wh - WY0) * KM))
        src = self.master if blur <= 0 else self.master_blur
        bg = np.asarray(src.crop(box).resize((W, H), Image.BILINEAR), np.float32) / 255
        if 0 < blur < 1:
            bg2 = np.asarray(self.master.crop(box).resize((W, H), Image.BILINEAR), np.float32) / 255
            bg = bg2 * (1 - blur) + bg * blur
        b = boom if boom is not None else 0.0
        rgb, smoke = self.fire(t, b)
        fb = ((X0 - WX0) / self.FR, Y0 / self.FR, (X0 + ww - WX0) / self.FR, (Y0 + wh) / self.FR)

        def up(a, ch=3):
            # перенос карты мира (0..fh) в кадр
            im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
            ext = im.transform((W, H), Image.EXTENT, fb, Image.BILINEAR)
            return np.asarray(ext, np.float32) / 255
        fire = up(rgb)
        sm = up(smoke)[..., None]
        # мерцающий отсвет пожара
        fl = 0.85 + 0.15 * smooth_noise(t * 5, 9)
        glow = up(np.clip(np.asarray(Image.fromarray((np.clip(self.M if b <= 0 else np.maximum(self.M, self.boom_map(b)), 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14)), np.float32) / 255 * 1.4, 0, 1))
        glow = glow[..., None] if glow.ndim == 2 else glow
        lit = bg * (0.5 + glow * np.array([1.1, 0.6, 0.35], np.float32) * fl)
        out = lit * (1 - sm * 0.8) + sm * 0.8 * (np.array([0.10, 0.07, 0.07], np.float32) + glow * np.array([0.35, 0.12, 0.04], np.float32))
        out = out + glow * np.array([0.9, 0.38, 0.12], np.float32) * 0.3 * fl + fire * 1.15
        return out

    def light_glows(self, out, t, X0, Y0, k, scale=1.0):
        """Мигалки полицейских машин (аддитивно)."""
        ph = t * 3.0
        for (x, y), col, sc in self.lights:
            on = (math.sin(ph * math.pi * 2 + (0 if col == "r" else math.pi)) > 0)
            if not on:
                continue
            X, Y = (x - X0) * k, (y - Y0) * k
            r = int(110 * sc * k * scale)
            if r < 4 or X < -r or X > W + r or Y < -r or Y > H + r:
                continue
            g = _glow(r, (255, 40, 50) if col == "r" else (50, 100, 255))
            add_over(out, g, int(X - r), int(Y - r), 0.9)
        return out

    def flash_tint(self, t):
        """Общий красно-синий отблеск на сцене."""
        s = math.sin(t * 3.0 * math.pi * 2)
        return np.array([0.10, 0.0, 0.0], np.float32) * max(0, s) + np.array([0.0, 0.03, 0.12], np.float32) * max(0, -s)


_gcache = {}


def _glow(r, col):
    r = max(4, int(r / 4) * 4)
    k = (r, col)
    if k not in _gcache:
        _gcache[k] = glow_sprite(r, col, 2.0)
    return _gcache[k]
