"""Реклама хлопьев «Принклс»."""
import math, random
import numpy as np
from PIL import Image, ImageFilter
from gfx import Cv, to_f, to_im, vgrad, radial, ease, font, FONT_C, FONT_B, glow_sprite, add_over, alpha_over
import human as Hm
import cast as C
import timeline as TL

W, H = 1080, 1920
AS = 2


def back_ease(u):
    u = min(1, max(0, u))
    s = 1.7
    u -= 1
    return u * u * ((s + 1) * u + s) + 1


def flake(c, x, y, r, a, col=(240, 170, 50, 255)):
    """Хлопья-колечко."""
    pts = []
    for k in range(12):
        ang = a + k / 12 * 2 * math.pi
        rr = r * (1 + 0.12 * math.sin(k * 2.3))
        pts.append((x + math.cos(ang) * rr, y + math.sin(ang) * rr * 0.8))
    c.poly(pts, col, smooth=True)
    c.ell((x - r * 0.38, y - r * 0.3, x + r * 0.38, y + r * 0.3), (250, 220, 140, 255))
    c.ell((x - r * 0.25, y - r * 0.2, x + r * 0.25, y + r * 0.2), (150, 70, 20, 255))
    c.circ(x - r * 0.5, y - r * 0.4, r * 0.12, (255, 240, 200, 255))


def bubble_text(c, x, y, txt, size, fill, stroke=(120, 20, 90, 255), sw=10, rot_wave=0.0):
    f = font(size, FONT_C)
    tw = f.getlength(txt) + sw * 0.9 * (len(txt) - 1)
    xx = x - tw / 2
    for i, ch in enumerate(txt):
        dy = math.sin(i * 0.9 + rot_wave) * size * 0.08
        c.text((xx, y + dy), ch, size, (40, 10, 40, 255), FONT_C, anchor="lm", stroke_width=int(sw * 1.6 * c.s), stroke_fill=(40, 10, 40, 255))
        c.text((xx, y + dy - 4), ch, size, fill, FONT_C, anchor="lm", stroke_width=int(sw * c.s), stroke_fill=stroke)
        xx += f.getlength(ch) + sw * 0.9


def box(c, x, y, sc, t):
    """Коробка хлопьев. (x,y) — центр."""
    b = c.sub(x, y, sc)
    b.poly([(-260, -380), (220, -400), (280, -360), (280, 400), (-260, 420)], (60, 10, 60, 120))
    b.rect((-250, -400, 250, 400), (255, 90, 40, 255), r=24)
    b.poly([(250, -380), (300, -340), (300, 380), (250, 400)], (200, 50, 30, 255))
    b.poly([(-250, -400), (250, -400), (300, -340), (-200, -340)], (255, 150, 80, 255))
    b.rect((-230, -380, 230, -150), (120, 30, 160, 255), r=20)
    bubble_text(b, 0, -265, "ПРИНКЛС", 98, (255, 230, 60, 255), rot_wave=t * 3)
    b.text((0, -180), "ХРУСТЯЩИЕ КОЛЕЧКИ", 34, (255, 255, 255, 255), FONT_C, anchor="mm")
    # миска на коробке
    b.ell((-190, 40, 190, 120), (250, 250, 250, 255))
    b.poly([(-190, 80), (190, 80), (140, 260), (-140, 260)], (60, 150, 230, 255), smooth=False)
    b.ell((-190, 40, 190, 120), (250, 250, 255, 255))
    for k in range(9):
        flake(b, -150 + k * 38, 60 + (k % 3) * 12 - 30 * math.sin(k), 30, k)
    # маскот — улыбающееся колечко
    mx, my = 140, -60
    flake(b, mx, my, 80, t * 2)
    b.circ(mx - 26, my - 20, 12, (255, 255, 255, 255)); b.circ(mx + 22, my - 22, 12, (255, 255, 255, 255))
    b.circ(mx - 24, my - 18, 6, (20, 20, 20, 255)); b.circ(mx + 24, my - 20, 6, (20, 20, 20, 255))
    b.arc((mx - 40, my - 20, mx + 40, my + 40), 20, 160, (120, 30, 20, 255), 7)
    # звезда «новинка»
    star = [(-160 + 80 * math.cos(math.radians(i * 18)) * (1 if i % 2 == 0 else 0.72), -60 + 80 * math.sin(math.radians(i * 18)) * (1 if i % 2 == 0 else 0.72)) for i in range(20)]
    b.poly(star, (255, 240, 40, 255))
    b.text((-160, -60), "НОВИНКА", 24, (200, 20, 40, 255), FONT_C, anchor="mm")
    b.rect((-250, 300, 250, 400), (120, 30, 160, 255), r=0)
    b.text((0, 350), "+ ВИТАМИНЫ  •  500 г", 34, (255, 255, 255, 255), FONT_C, anchor="mm")
    b.line([(-226, -390), (-226, 380)], (255, 255, 255, 80), 12)


def bowl(c, x, y, sc, fill=1.0, t=0.0):
    b = c.sub(x, y, sc)
    b.ell((-300, 170, 300, 250), (60, 10, 60, 90))
    b.poly([(-300, -40), (300, -40), (230, 180), (-230, 180)], (40, 140, 230, 255), smooth=False)
    b.ell((-230, 150, 230, 210), (30, 110, 200, 255))
    b.ell((-300, -90, 300, 10), (70, 170, 250, 255))
    b.ell((-280, -78, 280, 0), (250, 250, 248, 255) if fill > 0.05 else (230, 240, 250, 255))
    rnd = random.Random(3)
    n = int(18 * min(1, fill * 1.5))
    for k in range(n):
        fx = rnd.uniform(-230, 230)
        fy = rnd.uniform(-70, -20) - 10 * math.sin(t * 3 + k)
        flake(b, fx, fy, 34, k + t)
    b.line([(-250, -40), (-200, 120)], (255, 255, 255, 90), 14)


class Ad:
    def __init__(self):
        self.rnd = random.Random(8)
        self.parts = [(self.rnd.uniform(0, W), self.rnd.uniform(-400, H), self.rnd.uniform(20, 50), self.rnd.uniform(0, 6), self.rnd.uniform(200, 500)) for _ in range(40)]

    def bg(self, t, c1, c2):
        yy, xx = np.mgrid[0:H:4, 0:W:4].astype(np.float32)
        ang = np.arctan2(yy - 900, xx - 540)
        rays = (np.sin(ang * 10 + t * 1.8) > 0.2).astype(np.float32)
        g = np.clip(1 - np.sqrt((xx - 540) ** 2 + (yy - 900) ** 2) / 1400, 0, 1)
        a = rays * 0.18 + g * 0.6
        im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)
        m = np.asarray(im, np.float32)[..., None] / 255
        return np.array(c1, np.float32) / 255 * (1 - m) + np.array(c2, np.float32) / 255 * m

    def frame(self, t):
        A0 = TL.SHOTS[[s[0] for s in TL.SHOTS].index("ad")][1]
        lt = t - A0
        c = Cv(W, H, AS)
        if lt < 3.0:
            out = self.bg(lt, (140, 30, 170), (255, 170, 40))
            # летящие колечки
            for (x, y, r, a, sp) in self.parts:
                yy = (y + lt * sp) % (H + 400) - 200
                flake(c, x, yy, r, a + lt * 3)
            u = back_ease(lt / 0.8)
            bx = 540 - (1 - u) * 900
            sc = 0.9 * u + 0.01
            rot_y = 300 + 30 * math.sin(lt * 2)
            if lt < 1.6:
                box(c, bx, 820, sc, lt)
            else:
                v = ease((lt - 1.6) / 0.5)
                box(c, 540 - 270 * v, 820 - 160 * v, 0.9 - 0.35 * v, lt)
                # молоко льётся, миска наполняется
                bowl(c, 600 + 0 * v, 1300, 1.0, fill=ease((lt - 1.8) / 0.9), t=lt)
                if 1.8 < lt < 2.8:
                    c.line([(760, 300), (720, 700), (650, 1240)], (250, 250, 250, 255), 46, smooth=True)
                    for k in range(10):
                        a = k / 10 * math.pi
                        r = 120 + (lt * 300 % 120)
                        c.circ(650 + math.cos(a) * r, 1240 - math.sin(a) * r * 0.6, 14, (255, 255, 255, 230))
            bubble_text(c, 540, 1700, "НОВЫЕ ХЛОПЬЯ!", 110, (255, 255, 255, 255), stroke=(200, 30, 90, 255), rot_wave=lt * 4) if lt > 0.6 else None
        elif lt < 5.4:
            u = lt - 3.0
            out = self.bg(lt, (40, 120, 220), (255, 230, 120))
            spoon = 0.0
            if u < 1.4:
                spoon = math.sin(min(1, u / 0.7) * math.pi / 2) if u < 0.7 else 1.0 - ease((u - 0.9) / 0.5)
            mo = TL.mouth(["boy"], t)
            chew = 0.3 * abs(math.sin(u * 9)) if 0.7 < u < 1.4 else 0.0
            happy = TL.talking("boy", t) or u > 1.4
            face = dict(turn=0.0, gaze=0.0, blink=1.0 if (happy and not TL.talking("boy", t) and u > 2.0) else TL.blink(t, 9), mouth=max(mo, chew),
                        smile=1.0 if happy else 0.5, brows=0.6 if happy else 0.2)
            tgt = (lerp(120, 30, spoon), lerp(560, 190, spoon))
            wr = Hm.front(c.sub(540, 300, 1.05), C.BOY, dict(face=face, arms=({"ik": (-200, 560)}, {"ik": tgt}),
                                                              props={1: lambda cc, p, a: (cc.line([p, (p[0] - 40, p[1] - 110)], (200, 200, 210, 255), 14),
                                                                                         cc.ell((p[0] - 80, p[1] - 150, p[0] - 10, p[1] - 100), (210, 210, 220, 255)))}))
            c.rect((0, 1350, W, H), (250, 220, 170, 255))      # стол перед мальчиком
            c.rect((0, 1350, W, 1380), (220, 180, 130, 255))
            for k in range(6):
                c.rect((k * 200, 1380, k * 200 + 100, H), (244, 210, 160, 255))
            bowl(c, 540, 1300, 0.9, fill=1.0, t=lt)
            if happy:
                for k in range(8):
                    a = k / 8 * 2 * math.pi + lt
                    r = 380 + 30 * math.sin(lt * 5 + k)
                    sx, sy = 540 + math.cos(a) * r, 560 + math.sin(a) * r * 0.8
                    s = 18 + 10 * math.sin(lt * 8 + k)
                    c.poly([(sx, sy - s), (sx + s * 0.3, sy - s * 0.3), (sx + s, sy), (sx + s * 0.3, sy + s * 0.3), (sx, sy + s), (sx - s * 0.3, sy + s * 0.3), (sx - s, sy), (sx - s * 0.3, sy - s * 0.3)], (255, 255, 200, 255))
        else:
            u = lt - 5.4
            out = self.bg(lt, (140, 30, 170), (255, 170, 40))
            for (x, y, r, a, sp) in self.parts[:20]:
                yy = (y + lt * sp) % (H + 400) - 200
                flake(c, x, yy, r, a + lt * 3)
            box(c, 380, 900, 0.75 + 0.03 * math.sin(lt * 6), lt)
            bowl(c, 760, 1260, 0.6, 1.0, lt)
            s = back_ease(u / 0.5)
            bubble_text(c, 540, 260, "ПРИНКЛС", int(150 * s) + 1, (255, 230, 60, 255), rot_wave=lt * 4)
            c.text((540, 1640), "ХРУСТИ С УДОВОЛЬСТВИЕМ!", 58, (255, 255, 255, 255), FONT_C, anchor="mm", stroke_width=8 * AS, stroke_fill=(120, 20, 90, 255))
        alpha_over(out, c.im.reduce(AS), 0, 0)
        # вспышки-переходы между частями
        for edge in (3.0, 5.4):
            d = abs(lt - edge)
            if d < 0.15:
                out = out + (1 - d / 0.15) * 0.8
        return out


def lerp(a, b, u):
    return a + (b - a) * u
