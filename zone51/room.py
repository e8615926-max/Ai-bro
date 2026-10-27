"""Квартира Андрея: широкий мир (диван, ковёр, фото, часы, сервант, дверной проём в коридор).
Персонажи и кот рисуются покадрово, затем вся картинка освещается светом телевизора и коридора."""
import math, random
import numpy as np
from PIL import Image, ImageFilter
from gfx import Cv, to_f, to_im, radial, ease, smooth_noise, font, FONT_SERIF, FONT_R, glow_sprite, add_over, alpha_over
import human as Hm
import cast as C
import timeline as TL

W, H = 1080, 1920
X0W, X1W, Y0W, Y1W = -1000, 1080, -200, 2100      # границы мира
KS = 1.6                                         # пикселей фона на единицу мира
AS = 2
SEAT_Y = 1180
DOOR = (-640, 720, -380, 1380)                   # дверной проём


def wallpaper(c, x0=X0W, x1=X1W, y0=Y0W, y1=1380):
    c.rect((x0, y0, x1, y1), (186, 160, 118, 255))
    for i, x in enumerate(range(int(x0), int(x1), 54)):
        if i % 2 == 0:
            c.rect((x, y0, x + 27, y1), (178, 152, 112, 255))
    for row, y in enumerate(range(int(y0) + 40, int(y1), 96)):
        for x in range(int(x0) + (27 if row % 2 else 0), int(x1) + 54, 108):
            c.poly([(x, y - 22), (x + 14, y), (x, y + 22), (x - 14, y)], (146, 116, 80, 255))
            c.circ(x, y, 5, (198, 174, 130, 255))
            for dx in (-22, 22):
                c.circ(x + dx, y + 30, 4, (156, 126, 88, 255))
    # потолочный плинтус
    c.rect((x0, y0, x1, y0 + 70), (220, 214, 200, 255))
    c.rect((x0, y0 + 70, x1, y0 + 84), (190, 182, 168, 255))


def carpet(c, x0, y0, x1, y1):
    c.rect((x0 + 8, y0 + 10, x1 + 8, y1 + 14), (40, 30, 20, 90))
    c.rect((x0, y0, x1, y1), (30, 34, 70, 255))
    c.rect((x0 + 22, y0 + 22, x1 - 22, y1 - 22), (200, 160, 70, 255))
    c.rect((x0 + 30, y0 + 30, x1 - 30, y1 - 30), (120, 26, 30, 255))
    for x in range(int(x0 + 40), int(x1 - 30), 34):
        for y in (y0 + 12, y1 - 12):
            c.poly([(x, y - 8), (x + 9, y), (x, y + 8), (x - 9, y)], (180, 40, 40, 255))
    for y in range(int(y0 + 40), int(y1 - 30), 34):
        for x in (x0 + 12, x1 - 12):
            c.poly([(x, y - 8), (x + 9, y), (x, y + 8), (x - 9, y)], (180, 40, 40, 255))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    for i in range(-8, 9):
        for j in range(-6, 7):
            x, y = cx + i * 70, cy + j * 70
            if x0 + 60 < x < x1 - 60 and y0 + 60 < y < y1 - 60:
                k = (i + j) % 2
                c.poly([(x, y - 30), (x + 30, y), (x, y + 30), (x - 30, y)], (150, 34, 36, 255) if k else (95, 18, 24, 255))
                c.poly([(x, y - 10), (x + 10, y), (x, y + 10), (x - 10, y)], (210, 170, 90, 255) if k else (40, 46, 90, 255))
    for r, col in ((210, (30, 34, 70, 255)), (190, (200, 160, 70, 255)), (175, (140, 28, 32, 255)), (120, (230, 205, 150, 255)),
                   (105, (40, 46, 90, 255)), (70, (180, 40, 40, 255)), (40, (220, 180, 90, 255)), (16, (30, 34, 70, 255))):
        rr = r * 0.85
        c.poly([(cx, cy - rr * 1.25), (cx + rr * 0.5, cy - rr * 0.5), (cx + rr, cy), (cx + rr * 0.5, cy + rr * 0.5),
                (cx, cy + rr * 1.25), (cx - rr * 0.5, cy + rr * 0.5), (cx - rr, cy), (cx - rr * 0.5, cy - rr * 0.5)], col)
    for qx, qy in ((x0 + 110, y0 + 110), (x1 - 110, y0 + 110), (x0 + 110, y1 - 110), (x1 - 110, y1 - 110)):
        for r, col in ((46, (200, 160, 70, 255)), (36, (30, 34, 70, 255)), (20, (180, 40, 40, 255))):
            c.poly([(qx, qy - r), (qx + r, qy), (qx, qy + r), (qx - r, qy)], col)
    for x in range(int(x0), int(x1), 7):
        c.line([(x, y1), (x + 1, y1 + 18)], (210, 190, 150, 255), 2)


def photo(c, x0, y0, x1, y1):
    """Фото братьев: цветное, выцветшее, нарисовано тем же ригом."""
    c.rect((x0 + 10, y0 + 12, x1 + 10, y1 + 14), (40, 30, 20, 110))
    c.rect((x0, y0, x1, y1), (96, 58, 30, 255))
    c.rect((x0 + 6, y0 + 6, x1 - 6, y1 - 6), (150, 98, 54, 255))
    c.rect((x0 + 12, y0 + 12, x1 - 12, y1 - 12), (110, 70, 38, 255))
    c.rect((x0 + 22, y0 + 22, x1 - 22, y1 - 22), (236, 228, 206, 255))
    px0, py0, px1, py1 = x0 + 38, y0 + 38, x1 - 38, y1 - 70
    pw, ph = px1 - px0, py1 - py0
    p = Cv(pw, ph, c.s * 2)
    # небо, озеро, берёзы
    p.rect((0, 0, pw, ph * 0.5), (170, 196, 214, 255))
    p.rect((0, ph * 0.42, pw, ph * 0.58), (110, 150, 170, 255))
    p.rect((0, ph * 0.56, pw, ph), (120, 150, 80, 255))
    for k in range(6):
        x = 10 + k * pw / 5.5
        p.ell((x - 30, ph * 0.08, x + 30, ph * 0.5), (90, 130, 70, 255))
        p.rect((x - 3, ph * 0.3, x + 3, ph * 0.6), (240, 240, 230, 255))
    p.circ(pw * 0.85, ph * 0.12, 16, (255, 240, 200, 255))
    Hm.front(p.sub(pw * 0.34, ph * 0.22, 0.17), C.ANDREY, dict(face=dict(turn=0.15, gaze=0.0, smile=0.8), arms=((10, 10), (55, 120))))
    Hm.front(p.sub(pw * 0.66, ph * 0.17, 0.18), C.SASHA, dict(face=dict(turn=-0.15, gaze=0.0, smile=0.9), arms=((55, 120), (10, 10))))
    im = p.im.resize((int(pw * c.s), int(ph * c.s)), Image.LANCZOS)
    a = np.asarray(im, np.float32)
    rgb = a[..., :3]
    g = rgb.mean(-1, keepdims=True)
    rgb = (rgb * 0.75 + g * 0.25) * np.array([1.06, 1.0, 0.86]) + 8        # выцветание
    a[..., :3] = np.clip(rgb, 0, 255)
    c.im.alpha_composite(Image.fromarray(a.astype(np.uint8)), (int(px0 * c.s + c.ox), int(py0 * c.s + c.oy)))
    c.rect((px0, py0, px1, py1), None, outline=(200, 190, 170, 255), width=3)
    c.text(((x0 + x1) / 2, y1 - 46), "Андрей и Саша", 24, (80, 56, 36, 255), FONT_SERIF, anchor="mm")


def floor(c):
    c.rect((X0W, 1380, X1W, Y1W), (110, 70, 40, 255))
    for row in range(0, 30):
        y = 1380 + row * 26
        for col in range(-20, 22):
            x = col * 60 + (row % 2) * 30
            v = 96 + ((row * 7 + col * 13) % 5) * 7
            c.poly([(x, y), (x + 30, y + 13), (x + 30, y + 39), (x, y + 26)], (v + 30, v - 10, v - 50, 255))
            c.poly([(x + 30, y + 13), (x + 60, y), (x + 60, y + 26), (x + 30, y + 39)], (v + 20, v - 18, v - 56, 255))
    c.rect((X0W, 1370, X1W, 1396), (90, 54, 30, 255))
    c.poly([(60, 1560), (1020, 1560), (1080, 2100), (-60, 2100)], (96, 30, 34, 255))
    c.poly([(90, 1580), (990, 1580), (1040, 2100), (-20, 2100)], (150, 52, 46, 255))
    for i in range(14):
        y = 1600 + i * 34
        c.line([(110 - i * 5, y), (970 + i * 5, y)], (190, 150, 80, 120), 3)


def sofa(c):
    g, gd, gl = (64, 96, 72, 255), (44, 70, 52, 255), (84, 118, 90, 255)
    c.rect((40, 1440, 70, 1480), (60, 36, 20, 255))
    c.rect((1010, 1440, 1040, 1480), (60, 36, 20, 255))
    c.rect((30, 880, 1050, 1220), g, r=40)
    for x in range(120, 1000, 110):
        c.line([(x, 900), (x, 1180)], gd, 4)
        for y in (960, 1080):
            c.circ(x + 55, y, 7, gd)
    c.rect((30, 880, 1050, 910), gl, r=20)
    pts = [(560, 868)] + [(568 + i * 16, 960 + (10 if i % 2 else 0)) for i in range(13)] + [(768, 868)]
    c.poly(pts, (236, 232, 222, 255))
    for i in range(12):
        c.circ(570 + i * 16, 900 + (i % 3) * 14, 4, (200, 196, 186, 255))
    c.rect((110, 1180, 970, 1310), gl, r=24)
    c.line([(540, 1185), (540, 1305)], gd, 4)
    c.rect((100, 1290, 980, 1440), gd, r=16)
    for x0 in (10, 940):
        c.rect((x0, 1000, x0 + 130, 1450), g, r=44)
        c.rect((x0, 1000, x0 + 130, 1060), gl, r=40)


def lamp(c):
    c.line([(1010, 760), (1010, 1380)], (60, 50, 40, 255), 10)
    c.poly([(930, 600), (1090, 600), (1110, 770), (910, 770)], (210, 160, 90, 255))
    c.poly([(930, 600), (1090, 600), (1094, 630), (926, 630)], (190, 140, 70, 255))
    for x in range(915, 1110, 14):
        c.line([(x, 770), (x, 790)], (200, 150, 80, 255), 3)
    c.ell((960, 1370, 1060, 1400), (50, 40, 30, 255))


def servant(c):
    """Советский сервант с хрусталём."""
    x0, x1 = -990, -700
    c.rect((x0 + 10, 560, x1 + 10, 1392), (40, 28, 18, 100))
    c.rect((x0, 540, x1, 1380), (110, 66, 36, 255))
    c.rect((x0 + 16, 560, x1 - 16, 980), (60, 70, 80, 255))
    for y in (700, 840):
        c.rect((x0 + 16, y, x1 - 16, y + 8), (200, 200, 210, 255))
    rnd = random.Random(4)
    for shelf, y in enumerate((700, 840, 975)):
        x = x0 + 30
        while x < x1 - 50:
            k = rnd.random()
            if k < 0.4:   # бокал
                c.poly([(x, y - 70), (x + 30, y - 70), (x + 20, y - 40), (x + 18, y - 8), (x + 26, y), (x + 4, y), (x + 12, y - 8), (x + 10, y - 40)], (200, 220, 236, 200))
                x += 40
            elif k < 0.7:  # тарелка на ребре
                c.ell((x, y - 90, x + 80, y), (236, 236, 240, 255))
                c.ell((x + 12, y - 78, x + 68, y - 12), (60, 110, 170, 255))
                c.ell((x + 20, y - 70, x + 60, y - 20), (236, 236, 240, 255))
                x += 88
            else:          # ваза
                c.poly([(x + 10, y), (x, y - 50), (x + 14, y - 96), (x + 40, y - 96), (x + 54, y - 50), (x + 44, y)], (180, 210, 230, 200), smooth=True)
                x += 62
        c.line([(x0 + 16, y - 120), (x0 + 30, y - 10)], (255, 255, 255, 60), 6)
    c.line([(x0 + 145, 560), (x0 + 145, 980)], (110, 66, 36, 255), 8)
    c.rect((x0, 990, x1, 1380), (96, 56, 30, 255))
    for yy in (1000, 1190):
        c.rect((x0 + 16, yy, x1 - 16, yy + 176), (120, 74, 40, 255), r=6)
        c.circ((x0 + x1) / 2, yy + 88, 8, (210, 190, 120, 255))
    c.rect((x0 - 10, 530, x1 + 10, 548), (90, 52, 28, 255))


def doorway(c):
    x0, y0, x1, y1 = DOOR
    # коридор за проёмом
    c.rect((x0, y0, x1, y1), (150, 120, 84, 255))
    c.poly([(x0, y0), (x0 + 60, y0 + 50), (x0 + 60, y1 - 60), (x0, y1)], (120, 92, 62, 255))
    c.poly([(x0, y1), (x0 + 60, y1 - 60), (x1, y1 - 60), (x1, y1)], (110, 70, 44, 255))
    c.rect((x0 + 80, y1 - 60, x1 - 10, y1 - 30), (130, 40, 40, 255))      # дорожка
    c.line([(x0 + 150, y0 + 160), (x0 + 150, y0 + 200)], (60, 40, 30, 255), 6)   # вешалка
    c.poly([(x0 + 110, y0 + 200), (x0 + 190, y0 + 200), (x0 + 210, y0 + 460), (x0 + 90, y0 + 460)], (70, 60, 70, 255), smooth=True)
    c.rect((x0 + 90, y0 + 20, x1 - 20, y0 + 26), (90, 70, 50, 255))
    # открытая дверь (полотно под углом)
    c.poly([(x0, y0), (x0 - 70, y0 + 40), (x0 - 70, y1 + 20), (x0, y1)], (176, 150, 120, 255))
    c.poly([(x0 - 60, y0 + 90), (x0 - 12, y0 + 70), (x0 - 12, y0 + 300), (x0 - 60, y0 + 320)], (156, 130, 100, 255))
    c.circ(x0 - 56, y0 + 360, 7, (200, 180, 120, 255))
    # наличник
    c.rect((x0 - 26, y0 - 30, x1 + 26, y0), (226, 220, 206, 255))
    c.rect((x0 - 26, y0 - 30, x0, y1), (226, 220, 206, 255))
    c.rect((x1, y0 - 30, x1 + 26, y1), (226, 220, 206, 255))
    # выключатель
    c.rect((x1 + 50, 1000, x1 + 100, 1060), (236, 232, 222, 255), r=4)
    c.rect((x1 + 66, 1010, x1 + 84, 1050), (210, 206, 196, 255))


def clock(c, cx, cy, r, t):
    c.circ(cx + 6, cy + 8, r, (40, 30, 20, 90))
    c.circ(cx, cy, r, (110, 66, 36, 255))
    c.circ(cx, cy, r - 10, (236, 226, 200, 255))
    for i in range(60):
        a = i / 60 * 2 * math.pi
        l = 14 if i % 5 == 0 else 6
        c.line([(cx + math.sin(a) * (r - 14 - l), cy - math.cos(a) * (r - 14 - l)), (cx + math.sin(a) * (r - 14), cy - math.cos(a) * (r - 14))], (40, 30, 20, 255), 4 if i % 5 == 0 else 2)
    sec = 47 * 60 + 12 + t                      # 23:47:12 + время ролика
    sv = math.floor(sec) + min(1, (sec % 1) / 0.12) ** 0.5    # секундная стрелка «щёлкает»
    a_s = sv / 60 * 2 * math.pi
    a_m = (sec / 60) / 60 * 2 * math.pi
    a_h = (11 + sec / 3600) / 12 * 2 * math.pi
    c.line([(cx, cy), (cx + math.sin(a_h) * r * 0.45, cy - math.cos(a_h) * r * 0.45)], (30, 20, 16, 255), 7)
    c.line([(cx, cy), (cx + math.sin(a_m) * r * 0.7, cy - math.cos(a_m) * r * 0.7)], (30, 20, 16, 255), 5)
    c.line([(cx - math.sin(a_s) * 12, cy + math.cos(a_s) * 12), (cx + math.sin(a_s) * r * 0.78, cy - math.cos(a_s) * r * 0.78)], (170, 30, 30, 255), 2.5)
    c.circ(cx, cy, 6, (170, 30, 30, 255))


def beer_mug(c, x, y, sc=1.0, side=-1, level=0.8):
    """Стеклянная пивная кружка; (x,y) — центр ручки."""
    bx = x + side * 70 * sc
    w2, h = 46 * sc, 150 * sc
    top = y - h * 0.55
    c.rect((bx - w2, top, bx + w2, top + h), (220, 230, 236, 120), r=10 * sc)
    c.rect((bx - w2 + 6 * sc, top + h * (1 - level), bx + w2 - 6 * sc, top + h - 8 * sc), (226, 150, 40, 230), r=6 * sc)
    for k in range(4):
        c.circ(bx - 20 * sc + k * 13 * sc, top + h * 0.6 + (k % 2) * 20 * sc, 3 * sc, (255, 220, 150, 200))
    c.ell((bx - w2 + 2 * sc, top + h * (1 - level) - 18 * sc, bx + w2 - 2 * sc, top + h * (1 - level) + 12 * sc), (250, 246, 232, 255))
    c.rect((bx - w2, top + h - 14 * sc, bx + w2, top + h), (200, 214, 222, 200), r=6 * sc)
    c.arc((x + side * 22 * sc - 30 * sc, y - 46 * sc, x + side * 22 * sc + 30 * sc, y + 46 * sc), 0, 360, (210, 222, 230, 220), 10 * sc)
    c.line([(bx - w2 + 10 * sc, top + 14 * sc), (bx - w2 + 10 * sc, top + h - 20 * sc)], (255, 255, 255, 140), 5 * sc)


def cat(c, x, y, sc, t, head_up=0.0, eyes=0.0, meow=0.0, look=0.0):
    """Рыжий кот на диване. (x,y) — левый верх, как у старого спрайта 320x200."""
    o, od, ol = (226, 128, 46, 255), (176, 86, 28, 255), (248, 176, 98, 255)
    k = c.sub(x, y, sc)
    br = 1 + 0.02 * math.sin(t * 2 * math.pi / 2.6) * (1 - head_up)
    k.ell((20, 150, 300, 196), (20, 20, 20, 70))
    body = [(40, 120), (90, 50 / br), (180, 36 / br), (260, 60 / br), (300, 120), (290, 170), (200, 186), (90, 184), (40, 160)]
    # хвост: огибает тело, кончик подрагивает
    tip = math.sin(t * 2.3) * 14 + math.sin(t * 7.1) * 5
    k.line([(292, 150), (300, 186), (240, 198), (150, 198), (70, 190), (34 + tip, 176 - tip * 0.6)], o, 30, smooth=True)
    for xx in (110, 160, 210, 260):
        k.line([(xx, 186), (xx + 6, 210)], od, 8)
    k.line([(70, 190), (34 + tip, 176 - tip * 0.6)], (250, 240, 230, 255), 22)
    k.poly(body, o, smooth=True)
    for i in range(6):
        xx = 120 + i * 30
        k.line([(xx, 44 / br + 4), (xx + 12, 90), (xx + 4, 130)], od, 9, smooth=True)
    # голова: спит (лежит слева) или поднята и повернута к хозяину
    hx = 70 - head_up * 10 - look * 8
    hy = 120 - head_up * 70
    hd = k.sub(hx, hy, 1.0 + head_up * 0.1)
    hd.ell((-56, -50, 56, 48), o)
    hd.poly([(-50, -28), (-46, -86), (-10, -44)], o)
    hd.poly([(10, -46), (40, -88), (52, -22)], o)
    hd.poly([(-40, -36), (-38, -70), (-18, -44)], (240, 160, 150, 255))
    hd.poly([(18, -44), (36, -72), (42, -30)], (240, 160, 150, 255))
    hd.ell((-40, 0, 40, 46), ol)
    for ex in (-22, 22):
        if eyes < 0.3:
            hd.arc((ex - 13, -16, ex + 13, 4), 200, 340, (60, 30, 10, 255), 4)
        else:
            h = 12 * eyes
            hd.ell((ex - 13, -6 - h, ex + 13, -6 + h), (190, 210, 60, 255))
            hd.ell((ex - 3 + look * 4, -6 - h, ex + 3 + look * 4, -6 + h), (20, 20, 10, 255))
            hd.circ(ex - 4, -10, 2.5, (255, 255, 255, 255))
    hd.poly([(-6, 8), (6, 8), (0, 15)], (200, 100, 100, 255))
    if meow > 0.05:
        hd.ell((-12, 16, 12, 18 + 22 * meow), (120, 30, 40, 255))
        hd.poly([(-8, 18), (-4, 18), (-6, 26)], (255, 255, 255, 255))
        hd.poly([(4, 18), (8, 18), (6, 26)], (255, 255, 255, 255))
    for dy in (-4, 4):
        hd.line([(-26, 16 + dy), (-64, 10 + dy * 2)], (255, 240, 220, 200), 2)
        hd.line([(26, 16 + dy), (64, 10 + dy * 2)], (255, 240, 220, 200), 2)
    for xx in (-16, 0, 16):
        hd.line([(xx, -42), (xx + 4, -26)], od, 5)


class Room:
    def __init__(self):
        c = Cv(X1W - X0W, Y1W - Y0W, KS, (0, 0, 0, 255), ox=-X0W * KS, oy=-Y0W * KS)
        wallpaper(c)
        carpet(c, 70, 420, 1010, 1010)
        photo(c, 380, 110, 700, 420)
        servant(c)
        doorway(c)
        lamp(c)
        floor(c)
        sofa(c)
        # картина над сервантом
        c.rect((-940, 230, -740, 420), (120, 80, 40, 255))
        c.rect((-926, 244, -754, 406), (90, 120, 150, 255))
        c.poly([(-926, 360), (-870, 300), (-820, 340), (-754, 280), (-754, 406), (-926, 406)], (60, 90, 60, 255))
        c.circ(-800, 290, 16, (240, 220, 160, 255))
        self.bg = c.im.convert("RGB")
        # освещение (мир, низкое разрешение: 1 px = 8 ед.)
        self.lw, self.lh = (X1W - X0W) // 8, (Y1W - Y0W) // 8
        yy, xx = np.mgrid[0:self.lh, 0:self.lw].astype(np.float32) * 8
        xx += X0W
        yy += Y0W
        d2 = (xx + 160) ** 2 + ((yy - 1150) * 0.8) ** 2
        self.L_tv = (np.exp(-d2 / (2 * 700 ** 2)) * 1.7).astype(np.float32)
        dx0, dy0, dx1, dy1 = DOOR
        dd = ((xx - (dx0 + dx1) / 2) / 420) ** 2 + ((yy - 1250) / 520) ** 2
        self.L_door = (np.exp(-dd) * 1.1).astype(np.float32)
        self.L_door[(xx > dx0) & (xx < dx1) & (yy > dy0) & (yy < dy1)] = 1.25
        self.L_moon = radial(self.lw, self.lh, self.lw * 0.95, self.lh * 0.1, self.lw * 0.6, 1.6).astype(np.float32) * 0.15

    # ------------------------------------------------------------------
    def tv_light(self, t):
        if TL.SHOTS[0][1] <= t < TL.SHOTS[0][2]:
            k = 0.82 + 0.12 * smooth_noise(t * 3, 1) + 0.06 * smooth_noise(t * 11, 2)
            return k * np.array([0.55 + 0.1 * smooth_noise(t * 0.7, 5), 0.72, 1.0], np.float32)
        # после рекламы — вечернее шоу: тёплые и холодные переливы
        u = 0.5 + 0.5 * smooth_noise(t * 0.35, 8)
        k = 0.8 + 0.12 * smooth_noise(t * 3, 4) + 0.06 * smooth_noise(t * 9, 6)
        return k * (np.array([0.62, 0.72, 1.0], np.float32) * (1 - u) + np.array([1.0, 0.78, 0.6], np.float32) * u)

    def view(self, t, cx, cy, w, draw_actors, door_light=0.0):
        """Окно мира с центром (cx,cy) и шириной w. draw_actors(c, k, X0, Y0) рисует персонажей в координатах кадра."""
        h = w * H / W
        X0 = min(max(cx - w / 2, X0W), X1W - w)
        Y0 = min(max(cy - h / 2, Y0W), Y1W - h)
        box = (int((X0 - X0W) * KS), int((Y0 - Y0W) * KS), int((X0 + w - X0W) * KS), int((Y0 + h - Y0W) * KS))
        alb = self.bg.crop(box).resize((W, H), Image.BILINEAR).convert("RGBA")
        k = W / w
        a = Cv(W, H, AS)
        clock(a.sub((170 - X0) * k, (250 - Y0) * k, k), 0, 0, 74, t)
        draw_actors(a, k, X0, Y0)
        alb.alpha_composite(a.im.reduce(AS))
        out = np.asarray(alb.convert("RGB"), np.float32) / 255
        lb = ((X0 - X0W) / 8, (Y0 - Y0W) / 8, (X0 + w - X0W) / 8, (Y0 + h - Y0W) / 8)

        def up(m):
            im = Image.fromarray(np.clip(m * 100, 0, 255).astype(np.uint8))
            return np.asarray(im.transform((W, H), Image.EXTENT, lb, Image.BILINEAR), np.float32)[..., None] / 100
        col = self.tv_light(t)
        L = np.array([0.05, 0.06, 0.11], np.float32) + up(self.L_tv) * col + up(self.L_moon) * np.array([0.5, 0.6, 1.0], np.float32)
        if door_light > 0:
            L = L + up(self.L_door) * door_light * np.array([1.0, 0.74, 0.42], np.float32)
        return out * L


# --- позы ------------------------------------------------------------------
ANDREY_SC = 0.6
A_X, A_TOP = 250, 600


def andrey_seated(c, k, X0, Y0, t, face, hand_r, hand_l=None, mug=True, stand=0.0, leg_down=0.0, mug_tilt=0.0):
    """Андрей на диване, обе ноги на полу. stand 0..1 — встаёт."""
    sc = ANDREY_SC * k
    top = A_TOP - 64 * ease(stand) + 3 * math.sin(t * 1.6) * (1 - stand)
    x = (A_X + 30 * ease(stand) - X0) * k
    y = (top - Y0) * k
    knee_l, ank_l = (-138, 1150), (-126, 1615)
    knee_r, ank_r = (138, 1150), (126, 1615)
    s = ease(stand)
    if s > 0:
        knee_l = (knee_l[0] * (1 - s) - 62 * s, knee_l[1] * (1 - s) + 1320 * s)
        ank_l = (ank_l[0] * (1 - s) - 74 * s, ank_l[1] * (1 - s) + 1668 * s)
        knee_r = (knee_r[0] * (1 - s) + 62 * s, knee_r[1] * (1 - s) + 1320 * s)
        ank_r = (ank_r[0] * (1 - s) + 74 * s, ank_r[1] * (1 - s) + 1668 * s)
    props = {}
    if mug:
        props[-1] = lambda cc, p, a: beer_mug(cc, p[0], p[1], 1.0, -1)
    arms = (hand_r, hand_l if hand_l is not None else {"ik": (knee_r[0] - 10, knee_r[1] - 70)})
    return Hm.front(c.sub(x, y, sc), C.ANDREY, dict(face=face, legs="sit", sit={-1: (knee_l, ank_l), 1: (knee_r, ank_r)}, arms=arms, props=props,
                                                     hand_mode={1: "relax"}, breath=math.sin(t * 1.6)))


def armrest_local(X0, Y0, k, stand=0.0):
    """Точка подлокотника в локальных координатах Андрея."""
    top = A_TOP - 64 * ease(stand)
    return ((75 - A_X - 30 * ease(stand)) / ANDREY_SC, (990 - top) / ANDREY_SC)
