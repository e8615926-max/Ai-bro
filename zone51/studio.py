"""Студия «Новости дня»: заставка, ведущий Эдди в смокинге, бегущая строка."""
import math, random
import numpy as np
from PIL import Image, ImageFilter
import human as Hm
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


EDDIE = Hm.Look(skin=(234, 192, 160, 255), hair=(30, 26, 26, 255), hair_style="slick", eyes=(70, 90, 120, 255), top="shirt")
HEAD_X, HEAD_Y, HEAD_SC = 540, 628, 1.18


def eddie_body(c):
    # шея (под воротником), затем смокинг
    c.poly([(498, 860), (582, 860), (590, 966), (540, 1000), (490, 966)], SKIN_D)
    c.ell((492, 930, 588, 980), (190, 140, 112, 255))
    blk, blk_l = (18, 18, 24, 255), (40, 40, 52, 255)
    c.poly([(250, 1300), (270, 1060), (330, 980), (440, 950), (640, 950), (750, 980), (810, 1060), (830, 1300)], blk, smooth=True)
    c.poly([(470, 960), (540, 1000), (610, 960), (600, 1300), (480, 1300)], (244, 244, 248, 255))   # рубашка
    for y in (1080, 1140, 1200):
        c.circ(540, y, 6, (30, 30, 36, 255))
    c.poly([(440, 950), (470, 960), (530, 1150), (500, 1300), (420, 1060), (450, 1010)], blk_l)
    c.poly([(640, 950), (610, 960), (550, 1150), (580, 1300), (660, 1060), (630, 1010)], blk_l)
    c.line([(452, 975), (510, 1150)], (90, 90, 110, 255), 4)
    c.line([(628, 975), (570, 1150)], (90, 90, 110, 255), 4)
    # воротник-стойка поверх шеи
    c.poly([(482, 940), (540, 998), (502, 1016), (470, 962)], (250, 250, 252, 255))
    c.poly([(598, 940), (540, 998), (578, 1016), (610, 962)], (250, 250, 252, 255))
    # бабочка
    c.poly([(540, 1000), (488, 976), (482, 1030)], (10, 10, 12, 255))
    c.poly([(540, 1000), (592, 976), (598, 1030)], (10, 10, 12, 255))
    c.ell((526, 988, 554, 1014), (30, 30, 36, 255))
    c.poly([(680, 1080), (720, 1072), (716, 1092), (686, 1096)], (240, 240, 245, 255))
    c.line([(676, 1098), (736, 1090)], (60, 60, 70, 255), 3)


def eddie_head(c, turn=0.0, gaze=None, blink=0.0, mouth=0.0, smile=0.0, brows=0.0):
    h = c.sub(HEAD_X, HEAD_Y, HEAD_SC)
    Hm.hair_back(h, EDDIE)
    Hm.face_front(h, EDDIE, dict(turn=turn, gaze=turn if gaze is None else gaze, blink=blink, mouth=mouth, smile=smile, brows=brows))
    Hm.hair_front(h, EDDIE, turn)


def glass(c, x, y):
    """Стакан воды на столе."""
    c.ell((x - 46, y - 10, x + 46, y + 12), (10, 20, 40, 120))
    c.poly([(x - 40, y - 170), (x + 40, y - 170), (x + 34, y), (x - 34, y)], (200, 220, 240, 90))
    c.poly([(x - 37, y - 110), (x + 37, y - 110), (x + 34, y - 4), (x - 34, y - 4)], (150, 200, 240, 120))
    c.ell((x - 37, y - 120, x + 37, y - 100), (190, 225, 255, 160))
    c.ell((x - 40, y - 180, x + 40, y - 160), None, outline=(230, 240, 255, 200), width=3)
    c.line([(x - 26, y - 160), (x - 22, y - 16)], (255, 255, 255, 150), 6)
    c.ell((x - 34, y - 10, x + 34, y + 6), (200, 230, 255, 120))


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
        # бумаги, ручка, стакан воды
        c.poly([(300, 1256), (500, 1248), (512, 1282), (292, 1290)], (250, 250, 250, 255))
        c.poly([(310, 1250), (496, 1242), (506, 1272), (302, 1280)], (236, 236, 240, 255))
        c.line([(540, 1270), (620, 1250)], (230, 190, 60, 255), 6)
        glass(c, 790, 1272)
        # логотип на столе
        logo(c, 390, 1400, 1.0)
        self.base = to_f(c.result(SS))
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

    def frame(self, t, mouth, blink, wall=None, lower_third=1.0, ticker_t=0.0, face=None):
        out = self.base.copy()
        if wall is not None:   # 888x508 float
            out[240:740, 100:980] = wall[:500, :880]
        bob = 3 * math.sin(t * 2.1) + 4 * mouth
        f = dict(face or {})
        hc = Cv(W, 400, 2, oy=-(560 - bob) * 2)
        eddie_head(hc, f.get("turn", 0.0), f.get("gaze"), blink, mouth, f.get("smile", 0.15), f.get("brows", 0.0))
        alpha_over(out, hc.im.reduce(2), 0, 560)
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
