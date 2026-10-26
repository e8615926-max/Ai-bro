"""Студия «Новости дня»: заставка, ведущий Эдди в смокинге, бегущая строка."""
import math, random
import numpy as np
from PIL import Image, ImageFilter
from gfx import Cv, to_f, to_im, radial, ease, smooth_noise, font, FONT_B, FONT_C, FONT_R, vgrad, glow_sprite, add_over, alpha_over

W, H = 1080, 1920
SS = 2
SKIN, SKIN_D = (234, 192, 160, 255), (204, 156, 124, 255)


def globe(c, cx, cy, r, col, w=3):
    c.circ(cx, cy, r, None, outline=col, width=w)
    for k in range(1, 4):
        rr = r * k / 4
        c.ell((cx - rr, cy - r, cx + rr, cy + r), None, outline=col, width=w)
    for k in range(-3, 4):
        y = cy + r * k / 4
        hw = math.sqrt(max(0, r * r - (y - cy) ** 2))
        c.line([(cx - hw, y), (cx + hw, y)], col, w)


def logo(c, x, y, sc=1.0, alpha=255):
    c.rect((x, y, x + 300 * sc, y + 86 * sc), (200, 20, 30, alpha), r=12 * sc)
    c.rect((x + 8 * sc, y + 8 * sc, x + 78 * sc, y + 78 * sc), (255, 255, 255, alpha), r=10 * sc)
    globe(c, x + 43 * sc, y + 43 * sc, 28 * sc, (200, 20, 30, alpha), max(1, int(3 * sc)))
    c.text((x + 92 * sc, y + 14 * sc), "НОВОСТИ", 30 * sc, (255, 255, 255, alpha), FONT_C)
    c.text((x + 92 * sc, y + 46 * sc), "ДНЯ", 30 * sc, (255, 220, 120, alpha), FONT_C)


def eddie_body(c):
    # пиджак-смокинг
    blk, blk_l = (18, 18, 24, 255), (40, 40, 52, 255)
    c.poly([(250, 1300), (270, 1060), (330, 980), (440, 950), (640, 950), (750, 980), (810, 1060), (830, 1300)], blk, smooth=True)
    c.poly([(470, 960), (540, 1000), (610, 960), (600, 1300), (480, 1300)], (244, 244, 248, 255))   # рубашка
    for y in (1080, 1140, 1200):
        c.circ(540, y, 6, (30, 30, 36, 255))
    # атласные лацканы с бликом
    c.poly([(440, 950), (470, 960), (530, 1150), (500, 1300), (420, 1060), (450, 1010)], blk_l)
    c.poly([(640, 950), (610, 960), (550, 1150), (580, 1300), (660, 1060), (630, 1010)], blk_l)
    c.line([(452, 975), (510, 1150)], (90, 90, 110, 255), 4)
    c.line([(628, 975), (570, 1150)], (90, 90, 110, 255), 4)
    # шея и воротник
    c.poly([(500, 870), (580, 870), (588, 962), (540, 992), (492, 962)], SKIN_D)
    c.poly([(486, 948), (540, 996), (504, 1014), (474, 966)], (250, 250, 252, 255))
    c.poly([(594, 948), (540, 996), (576, 1014), (606, 966)], (250, 250, 252, 255))
    # бабочка
    c.poly([(540, 1000), (488, 976), (482, 1030)], (10, 10, 12, 255), smooth=False)
    c.poly([(540, 1000), (592, 976), (598, 1030)], (10, 10, 12, 255), smooth=False)
    c.ell((526, 988, 554, 1014), (30, 30, 36, 255))
    # платок в кармане
    c.poly([(680, 1080), (720, 1072), (716, 1092), (686, 1096)], (240, 240, 245, 255))
    c.line([(676, 1098), (736, 1090)], (60, 60, 70, 255), 3)


def eddie_head(c, mouth=0.0, blink=False, brow=0.0):
    cx, cy = 540, 760
    c.ell((418, 742, 452, 806), SKIN_D)   # уши
    c.ell((628, 742, 662, 806), SKIN_D)
    c.poly([(450, 680), (540, 640), (630, 680), (640, 780), (610, 860), (540, 900), (470, 860), (440, 780)], SKIN, smooth=True)
    c.poly([(470, 860), (540, 900), (610, 860), (600, 880), (540, 912), (480, 880)], (210, 162, 130, 160), smooth=True)
    # волосы: зачёс, седые виски
    c.poly([(436, 760), (432, 680), (470, 630), (540, 610), (620, 626), (654, 680), (648, 760), (634, 720), (620, 680), (560, 668), (500, 672), (460, 690), (448, 760)],
           (30, 26, 26, 255), smooth=True)
    c.poly([(520, 616), (600, 622), (630, 660), (560, 650)], (60, 54, 54, 255), smooth=True)
    c.poly([(440, 740), (442, 712), (450, 720), (449, 744)], (130, 130, 136, 255), smooth=True)
    c.poly([(644, 740), (642, 712), (634, 720), (635, 744)], (130, 130, 136, 255), smooth=True)
    by = 726 - brow * 8
    c.line([(472, by + 4), (494, by - 3), (520, by + 2)], (40, 32, 30, 255), 7, smooth=True)
    c.line([(560, by + 2), (586, by - 3), (608, by + 4)], (40, 32, 30, 255), 7, smooth=True)
    if blink:
        c.line([(476, 752), (518, 752)], (90, 60, 50, 255), 4)
        c.line([(562, 752), (604, 752)], (90, 60, 50, 255), 4)
    else:
        for ex in (497, 583):
            c.ell((ex - 22, 740, ex + 22, 764), (250, 248, 245, 255))
            c.circ(ex, 752, 10, (70, 90, 120, 255))
            c.circ(ex, 752, 5, (20, 20, 24, 255))
            c.circ(ex - 3, 749, 3, (255, 255, 255, 255))
            c.arc((ex - 22, 738, ex + 22, 766), 190, 350, (110, 70, 60, 255), 3)
    c.poly([(540, 760), (526, 812), (540, 820), (556, 812)], SKIN_D, smooth=True)
    c.line([(526, 814), (540, 822), (556, 814)], (180, 120, 100, 255), 3)
    # рот
    mo = mouth
    if mo < 0.08:
        c.line([(506, 850), (540, 856), (574, 850)], (150, 70, 66, 255), 5, smooth=True)
    else:
        h = 6 + 30 * mo
        w = 34 - 6 * mo
        c.ell((540 - w, 846 - 4, 540 + w, 846 + h), (90, 26, 30, 255))
        c.rect((540 - w + 6, 843, 540 + w - 6, 843 + 7 + 3 * mo), (245, 242, 236, 255), r=3)
        if mo > 0.4:
            c.ell((540 - w * 0.5, 846 + h * 0.55, 540 + w * 0.5, 846 + h), (190, 80, 90, 255))
        c.arc((540 - w - 2, 840, 540 + w + 2, 846 + h + 4), 0, 180, (170, 100, 90, 255), 3)


class Studio:
    def __init__(self):
        c = Cv(W, H, SS, (0, 0, 0, 255))
        bg = vgrad(W * SS, H * SS, [(0, (4, 10, 34)), (0.5, (12, 34, 90)), (1, (4, 10, 30))])
        c.im.paste(to_im(bg).convert("RGBA"), (0, 0))
        # световые колонны и полосы
        for x in (60, 1020):
            c.rect((x - 26, 0, x + 26, 1300), (40, 120, 255, 50))
            c.rect((x - 6, 0, x + 6, 1300), (140, 200, 255, 120))
        for i in range(8):
            y = 200 + i * 130
            c.line([(0, y), (W, y + 40)], (60, 120, 255, 18), 3)
        gl = c.layer()
        globe(gl, 540, 560, 430, (80, 160, 255, 70), 4)
        c.paste(gl, blur=1)
        # видеостена (заполняется кадр за кадром)
        c.rect((96, 236, 984, 744), (10, 14, 20, 255), r=10)
        c.rect((96, 236, 984, 744), None, r=10, outline=(120, 170, 255, 255), width=4)
        eddie_body(c)
        # стол
        c.poly([(0, 1260), (1080, 1260), (1080, 1920), (0, 1920)], (16, 30, 70, 255))
        c.poly([(-40, 1240), (1120, 1240), (1100, 1300), (-20, 1300)], (220, 230, 245, 255), smooth=False)
        c.rect((0, 1296, 1080, 1312), (70, 140, 255, 255))
        dl = c.layer()
        dl.rect((0, 1290, 1080, 1320), (90, 170, 255, 180))
        c.paste(dl, blur=10)
        # бумаги и руки
        c.poly([(330, 1252), (520, 1244), (530, 1276), (322, 1284)], (250, 250, 250, 255))
        c.ell((300, 1212, 400, 1268), SKIN)
        c.ell((660, 1214, 760, 1270), SKIN)
        c.rect((280, 1190, 410, 1250), (18, 18, 24, 255), r=30)
        c.rect((650, 1192, 780, 1252), (18, 18, 24, 255), r=30)
        c.rect((395, 1206, 410, 1250), (245, 245, 248, 255))
        c.rect((650, 1206, 665, 1252), (245, 245, 248, 255))
        c.line([(560, 1260), (640, 1236)], (230, 190, 60, 255), 6)   # ручка
        # логотип на столе
        logo(c, 390, 1400, 1.0)
        self.base = to_f(c.result(SS))
        # головы: 6 уровней рта x моргание
        self.heads = {}
        for blink in (False, True):
            for m in range(6):
                hc = Cv(W, 360, SS)
                hc_off = Cv(W, H, SS)
                eddie_head(hc_off, m / 5, blink)
                im = hc_off.im.crop((0, 600 * SS, W * SS, 960 * SS)).resize((W, 360), Image.LANCZOS)
                self.heads[(m, blink)] = im
        # интро
        ic = Cv(W, H, SS, (0, 0, 0, 255))
        ibg = vgrad(W * SS, H * SS, [(0, (90, 8, 16)), (0.5, (20, 20, 80)), (1, (4, 8, 30))])
        ic.im.paste(to_im(ibg).convert("RGBA"), (0, 0))
        self.intro_bg = to_f(ic.result(SS))
        self.rnd = random.Random(1)

    def intro(self, t):
        """Заставка новостей, t от 0."""
        out = self.intro_bg.copy()
        # вращающиеся лучи
        yy, xx = np.mgrid[0:H:4, 0:W:4].astype(np.float32)
        ang = np.arctan2(yy - 860 / 4 * 4, xx - 540)
        rays = (np.sin(ang * 12 + t * 1.5) > 0.6).astype(np.float32) * 0.12
        rays = np.asarray(Image.fromarray((rays * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), np.float32)[..., None] / 255
        out += rays * np.array([1.0, 0.6, 0.5], np.float32)
        c = Cv(W, H, 1)
        r = 200 + 30 * ease(t / 1.5)
        rot = t * 0.8
        for k in range(-3, 4):
            rr = abs(r * math.cos(rot + k * 0.45))
            c.ell((540 - rr, 860 - r, 540 + rr, 860 + r), None, outline=(255, 255, 255, 200), width=4)
        for k in range(-3, 4):
            y = 860 + r * k / 4
            hw = math.sqrt(max(0, r * r - (y - 860) ** 2))
            c.line([(540 - hw, y), (540 + hw, y)], (255, 255, 255, 200), 4)
        c.circ(540, 860, r, None, outline=(255, 255, 255, 255), width=8)
        a = ease((t - 0.6) / 0.8)
        sc = 2.2
        if a > 0:
            logo(c, 540 - 150 * sc, 860 - 43 * sc + (1 - a) * 80, sc, int(255 * a))
        b = ease((t - 1.6) / 0.6)
        if b > 0:
            c.text((540, 1180), "ВЫПУСК 23:45", 52, (255, 255, 255, int(255 * b)), FONT_C, anchor="mm")
        alpha_over(out, c.im, 0, 0)
        g = glow_sprite(420, (255, 120, 120), 2.5)
        add_over(out, g * (0.35 + 0.1 * math.sin(t * 4)), 540 - 420, 860 - 420)
        return out

    def frame(self, t, mouth, blink, wall=None, lower_third=1.0, ticker_t=0.0):
        out = self.base.copy()
        if wall is not None:   # 888x508 float
            out[240:740, 100:980] = wall[:500, :880]
        bob = 3 * math.sin(t * 2.1) + 4 * mouth
        head = self.heads[(min(5, int(round(mouth * 5))), blink)]
        alpha_over(out, head, 0, int(600 + bob))
        c = Cv(W, H, 1)
        draw_overlays(c, t, lower_third, ticker_t, name="ЭДДИ МОРРИС", role="ВЕДУЩИЙ «НОВОСТЕЙ ДНЯ»")
        alpha_over(out, c.im, 0, 0)
        return out


TICKER = "  ВЗРЫВ НА СЕКРЕТНОЙ БАЗЕ «ЗОНА 51»  •  ОЧЕВИДЦЫ СООБЩАЮТ О СТРАННЫХ СУЩЕСТВАХ  •  ВЛАСТИ ОЦЕПИЛИ РАЙОН  •  ЖИТЕЛЕЙ ПРОСЯТ НЕ ВЫХОДИТЬ ИЗ ДОМА  "


def draw_overlays(c, t, lower_third, ticker_t, name=None, role=None, live=True):
    logo(c, 36, 60, 0.8)
    if live:
        on = (t % 1.0) < 0.6
        c.rect((800, 64, 1044, 116), (200, 20, 30, 255), r=8)
        if on:
            c.circ(826, 90, 10, (255, 255, 255, 255))
        c.text((846, 90), "ПРЯМОЙ ЭФИР", 24, (255, 255, 255, 255), FONT_C, anchor="lm")
        c.text((1044, 140), "23:47", 28, (255, 255, 255, 230), FONT_C, anchor="rm")
    if name and lower_third > 0:
        a = int(255 * lower_third)
        x = -600 * (1 - ease(lower_third))
        c.rect((40 + x, 1380, 760 + x, 1448), (200, 20, 30, a))
        c.rect((40 + x, 1448, 760 + x, 1494), (245, 245, 250, a))
        c.text((60 + x, 1414), name, 38, (255, 255, 255, a), FONT_C, anchor="lm")
        c.text((60 + x, 1471), role, 26, (20, 30, 60, a), FONT_C, anchor="lm")
    # бегущая строка
    c.rect((0, 1810, W, 1880), (12, 18, 40, 235))
    c.rect((0, 1810, 210, 1880), (200, 20, 30, 255))
    c.text((105, 1845), "СРОЧНО", 32, (255, 255, 255, 255), FONT_C, anchor="mm")
    f = font(34, FONT_C)
    tw = f.getlength(TICKER)
    x = 230 - (ticker_t * 160) % tw
    # рисуем в полосе справа от плашки
    strip = Cv(W - 220, 70, 1)
    for k in range(3):
        strip.text((x - 220 + k * tw, 35), TICKER, 34, (255, 255, 255, 255), FONT_C, anchor="lm")
    c.im.alpha_composite(strip.im, (220, 1810))
