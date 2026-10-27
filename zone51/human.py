"""Риг персонажа: вид спереди, сзади и сбоку; моргание, взгляд, рот, эмоции, походка, руки с предметами.
Локальные координаты: (0,0) — макушка, рост ~1700 ед., ось Y вниз. Вид сбоку смотрит вправо (влево — fx=-1)."""
import math
from dataclasses import dataclass, field


def sh(c, k):
    """Затемнить/осветлить цвет."""
    return (max(0, min(255, int(c[0] * k))), max(0, min(255, int(c[1] * k))), max(0, min(255, int(c[2] * k))), c[3] if len(c) > 3 else 255)


def mixc(a, b, u):
    return tuple(int(a[i] + (b[i] - a[i]) * u) for i in range(3)) + (255,)


@dataclass
class Look:
    skin: tuple = (230, 186, 156, 255)
    hair: tuple = (60, 40, 30, 255)
    hair_style: str = "short"          # short, slick, ponytail, curly, messy, none
    top: str = "track"                 # track, hoodie, uniform, coat, hazmat, fire, doctor, mama, shirt
    top_col: tuple = (40, 54, 116, 255)
    accent: tuple = (236, 236, 240, 255)
    pants: tuple = (40, 54, 116, 255)
    shoes: tuple = (30, 26, 24, 255)
    eyes: tuple = (70, 50, 36, 255)
    female: bool = False
    extras: set = field(default_factory=set)   # mole, mustache, cap, helmet, hood, mask, earrings, freckles, lipstick, stubble
    width: float = 1.0
    child: bool = False


# --- примитивы --------------------------------------------------------------
def limb(c, p0, p1, w0, w1, col):
    """Сужающийся сегмент со скруглёнными концами."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L
    c.poly([(p0[0] + nx * w0 / 2, p0[1] + ny * w0 / 2), (p1[0] + nx * w1 / 2, p1[1] + ny * w1 / 2),
            (p1[0] - nx * w1 / 2, p1[1] - ny * w1 / 2), (p0[0] - nx * w0 / 2, p0[1] - ny * w0 / 2)], col)
    c.circ(p0[0], p0[1], w0 / 2, col)
    c.circ(p1[0], p1[1], w1 / 2, col)


def rot(p, a, o=(0, 0)):
    ca, sa = math.cos(a), math.sin(a)
    x, y = p[0] - o[0], p[1] - o[1]
    return (o[0] + x * ca - y * sa, o[1] + x * sa + y * ca)


def arm_points(shoulder, a_sh, a_el, side, l1=310, l2=290):
    """side: -1 левая сторона экрана, +1 правая. Углы в градусах: a_sh — отвод от вертикали наружу, a_el — сгиб к центру."""
    a1 = math.radians(a_sh) * side
    el = (shoulder[0] + math.sin(a1) * l1, shoulder[1] + math.cos(a1) * l1)
    a2 = a1 - math.radians(a_el) * side
    wr = (el[0] + math.sin(a2) * l2, el[1] + math.cos(a2) * l2)
    return el, wr, a2


def arm_ik(shoulder, target, side, l1=310, l2=290, out=1.0):
    """Двухзвенная ИК: локоть отводится наружу/вниз. Возвращает (локоть, кисть, угол предплечья)."""
    dx, dy = target[0] - shoulder[0], target[1] - shoulder[1]
    d = max(1.0, min(math.hypot(dx, dy), l1 + l2 - 1))
    base = math.atan2(dx, dy)
    a = math.acos(max(-1, min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
    best = None
    for sg in (1, -1):    # локоть ниже линии плеча-цели и наружу
        a1 = base + a * sg
        e = (shoulder[0] + math.sin(a1) * l1, shoulder[1] + math.cos(a1) * l1)
        score = e[1] + 0.35 * side * e[0] * out
        if best is None or score > best[0]:
            best = (score, e)
    el = best[1]
    a2 = math.atan2(target[0] - el[0], target[1] - el[1])
    wr = (el[0] + math.sin(a2) * l2, el[1] + math.cos(a2) * l2)
    return el, wr, a2


def palm(c, p, skin, r=42):
    """Открытая ладонь к зрителю, пальцы вверх."""
    d = sh(skin, 0.8)
    x, y = p
    c.rect((x - r * 1.0, y - r * 0.9, x + r * 1.0, y + r * 1.0), skin, r=r * 0.6)
    for i in range(4):
        fx = x - r * 0.75 + i * r * 0.5
        h = r * (1.5 - abs(i - 1.4) * 0.22)
        c.rect((fx - r * 0.22, y - r * 0.6 - h, fx + r * 0.22, y - r * 0.4), skin, r=r * 0.22)
        c.line([(fx, y - r * 0.6 - h * 0.45), (fx, y - r * 0.6 - h * 0.4)], d, max(2, r * 0.06))
    c.line([(x + r * 0.9, y + r * 0.3), (x + r * 1.5, y - r * 0.4)], skin, r * 0.45)
    c.arc((x - r * 0.6, y - r * 0.2, x + r * 0.6, y + r * 0.8), 200, 340, d, max(2, r * 0.07))


def hand(c, p, skin, r=42, ang=0.0, fist=False):
    c.circ(p[0], p[1], r, skin)
    d = sh(skin, 0.82)
    if fist:
        for k in range(3):
            c.line([(p[0] - r * 0.6 + k * r * 0.6, p[1] + r * 0.35), (p[0] - r * 0.6 + k * r * 0.6, p[1] + r * 0.6)], d, 4)
    else:
        tip = (p[0] + math.sin(ang) * r * 1.5, p[1] + math.cos(ang) * r * 1.5)
        c.line([p, tip], skin, r * 1.1)
        for k in (-1, 0, 1):
            q = (tip[0] + math.cos(ang) * k * r * 0.33, tip[1] - math.sin(ang) * k * r * 0.33)
            c.line([(q[0] - math.sin(ang) * r * 0.5, q[1] - math.cos(ang) * r * 0.5), q], d, 3)


# --- лицо спереди --------------------------------------------------------------
def face_front(c, L, f):
    """f: turn (-1..1 поворот головы), gaze (-1..1 + вертикаль gy), blink 0..1, mouth 0..1, smile -1..1, brows (-1 злость .. 1 удивление)."""
    turn = f.get("turn", 0.0)
    gaze = f.get("gaze", turn)
    gy = f.get("gy", 0.0)
    blink = f.get("blink", 0.0)
    mouth = f.get("mouth", 0.0)
    smile = f.get("smile", 0.0)
    brows = f.get("brows", 0.0)
    skin = L.skin
    sd = sh(skin, 0.86)
    ch = L.child
    hw = 92 if not ch else 100
    ox = turn * 26
    # уши (дальнее ухо прячется при повороте)
    for s in (-1, 1):
        vis = 1 - max(0, s * turn) * 0.9
        if vis > 0.2:
            ex = s * (hw - 4) - turn * 12
            c.ell((ex - 16 * vis, 102, ex + 16 * vis, 160), sd)
            c.ell((ex - 8 * vis, 112, ex + 8 * vis, 150), sh(skin, 0.72))
            if "earrings" in L.extras:
                c.circ(ex, 166, 7, (230, 200, 90, 255))
    # голова
    jaw = 0.0 if L.female or ch else 6
    c.poly([(-hw + 2, 90), (-hw + 6, 40), (-50, 6), (0, 0), (50, 6), (hw - 6, 40), (hw - 2, 90), (hw - 10 - jaw, 150),
            (hw * 0.55 + ox * 0.3, 205), (ox * 0.5, 222), (-hw * 0.55 + ox * 0.3, 205), (-hw + 10 + jaw, 150)], skin, smooth=True)
    # тень со стороны поворота
    s = -1 if turn > 0 else 1
    c.poly([(s * (hw - 2), 80), (s * (hw - 18), 150), (s * hw * 0.5, 206), (s * hw * 0.3, 210), (s * (hw - 36), 150), (s * (hw - 20), 80)],
           (sh(skin, 0.9)[:3] + (110,)), smooth=True)
    if "stubble" in L.extras:
        c.poly([(-hw + 14, 150), (-hw * 0.55 + ox * 0.3, 205), (ox * 0.5, 222), (hw * 0.55 + ox * 0.3, 205), (hw - 14, 150), (ox, 190)], (80, 60, 50, 50), smooth=True)
    # глаза
    ey = 112
    for s in (-1, 1):
        ex = s * 36 + ox
        w = 20 * (1 - 0.35 * max(0, -s * turn)) * (1.1 if ch else 1)
        if blink > 0.6:
            c.line([(ex - w, ey + 2), (ex, ey + 6), (ex + w, ey + 2)], sh(skin, 0.55), 4, smooth=True)
            continue
        h = 11 * (1 - blink) * (1.15 if ch else 1) * (1 + 0.25 * max(0, brows))
        c.ell((ex - w, ey - h, ex + w, ey + h), (250, 248, 244, 255))
        ix = ex + gaze * w * 0.45
        iy = ey + gy * h * 0.4
        ir = min(h, 10.5)
        c.circ(ix, iy, ir, L.eyes)
        c.circ(ix, iy, ir * 0.5, (16, 14, 14, 255))
        c.circ(ix - 3, iy - 3, 3, (255, 255, 255, 255))
        c.arc((ex - w - 1, ey - h - 2, ex + w + 1, ey + h + 2), 195, 345, sh(skin, 0.45), 4)
        if L.female:
            c.line([(ex + s * w * 0.8, ey - h * 0.6), (ex + s * (w + 7), ey - h - 2)], (40, 30, 30, 255), 3)
    # брови
    for s in (-1, 1):
        ex = s * 36 + ox
        inner = 82 - brows * 8 + max(0, -brows) * 6
        outer = 80 - brows * 6 - max(0, -brows) * 4
        bc = sh(L.hair, 0.9) if L.hair_style != "none" else sh(skin, 0.6)
        if L.hair_style == "none" and "hood" in L.extras:
            continue
        c.line([(ex - s * 18, inner), (ex, inner - 5 - brows * 3), (ex + s * 20, outer)], bc, 7 if not L.female else 5, smooth=True)
    # нос
    nx = ox * 1.25
    c.poly([(nx - 4, 118), (nx - 12 - turn * 6, 160), (nx, 168), (nx + 12 - turn * 6, 160), (nx + 4, 118)], sd, smooth=True)
    c.circ(nx - 7, 163, 3, sh(skin, 0.62))
    c.circ(nx + 7, 163, 3, sh(skin, 0.62))
    # румянец, веснушки, родинка
    for s in (-1, 1):
        c.ell((s * 52 + ox - 16, 150, s * 52 + ox + 16, 168), (240, 130, 120, 50))
    if "freckles" in L.extras:
        for k in range(7):
            c.circ(-50 + k * 16 + ox, 146 + (k % 2) * 6, 2.5, (170, 100, 60, 200))
    if "mole" in L.extras:
        c.circ(48 + ox, 172, 4, (90, 50, 40, 255))
    if "mustache" in L.extras:
        c.poly([(ox - 48, 186), (ox - 14, 174), (ox, 180), (ox + 14, 174), (ox + 48, 186), (ox + 34, 194), (ox - 34, 194)], sh(L.hair, 0.9), smooth=True)
    # рот
    my = 190 if not ch else 186
    mw = 24 + 4 * smile
    lip = (180, 70, 76, 255) if "lipstick" in L.extras else sh(skin, 0.62)
    mx = ox * 1.1
    if mouth < 0.07:
        c.line([(mx - mw, my - smile * 7), (mx, my + smile * 4), (mx + mw, my - smile * 7)], lip, 5, smooth=True)
    else:
        h = 6 + 30 * mouth
        w = mw - 4 * mouth
        top_y = my - 3 - smile * 4
        c.poly([(mx - w, top_y), (mx, top_y - 2), (mx + w, top_y), (mx + w * 0.6, top_y + h * 0.9), (mx, top_y + h), (mx - w * 0.6, top_y + h * 0.9)], (70, 20, 26, 255), smooth=True)
        c.rect((mx - w * 0.7, top_y, mx + w * 0.7, top_y + min(8, h * 0.3)), (246, 244, 236, 255), r=3)
        if mouth > 0.35:
            c.ell((mx - w * 0.5, top_y + h * 0.55, mx + w * 0.5, top_y + h * 1.0), (200, 90, 100, 255))
        c.arc((mx - w - 2, top_y - 6, mx + w + 2, top_y + h + 3), 10, 170, lip, 4)


def hair_back(c, L, view="front"):
    st = L.hair_style
    hc = L.hair
    if st == "ponytail":
        c.poly([(-104, 70), (-96, -8), (0, -26), (96, -8), (104, 70), (98, 160), (-98, 160)], hc, smooth=True)
        if view == "front":
            c.line([(80, 120), (118, 220), (110, 330)], sh(hc, 0.85), 36, smooth=True)
    elif st == "curly":
        for k in range(11):
            a = math.pi * (k / 10)
            c.circ(math.cos(a) * 96, 80 - math.sin(a) * 82, 38, hc)
        c.ell((-108, 60, 108, 190), hc)
    elif st == "messy":
        c.ell((-104, -14, 104, 150), hc)
    elif st in ("short", "slick"):
        c.ell((-98, -8, 98, 130), hc)


def hair_front(c, L, turn=0.0):
    st = L.hair_style
    hc = L.hair
    hl = sh(hc, 1.25)
    ox = turn * 20
    if st == "short":
        c.poly([(-96, 92), (-98, 30), (-60, -8), (0, -16), (60, -8), (98, 30), (96, 92), (84, 60), (60, 38), (ox + 10, 34), (-40, 30), (-80, 56)], hc, smooth=True)
        c.poly([(-40, 30), (ox + 20, 24), (40, 40), (ox - 10, 50)], hc, smooth=True)
    elif st == "slick":
        c.poly([(-96, 92), (-96, 20), (-40, -14), (40, -14), (96, 20), (96, 92), (88, 50), (50, 30), (-50, 30), (-88, 50)], hc, smooth=True)
        c.line([(-40, 8), (30, -4), (70, 10)], sh(hc, 1.12), 4, smooth=True)
    elif st == "ponytail":
        c.poly([(-98, 110), (-96, 20), (-40, -18), (40, -18), (96, 20), (98, 110), (86, 60), (40, 26), (ox - 6, 22), (-50, 34), (-84, 70)], hc, smooth=True)
        c.poly([(-90, 40), (-60, 30), (-70, 120), (-96, 150)], hc, smooth=True)

    elif st == "curly":
        for k in range(9):
            a = math.pi * (0.1 + 0.8 * k / 8)
            c.circ(math.cos(a) * 76 + ox * 0.3, 40 - math.sin(a) * 52, 30, hc)
        for k in range(5):
            c.circ(-60 + k * 30, 16 + (k % 2) * 8, 6, hl)
    elif st == "messy":
        pts = [(-98, 100), (-104, 30)]
        for k in range(9):
            x = -90 + k * 22
            pts.append((x, -18 - (k % 2) * 18))
        pts += [(104, 30), (98, 100), (86, 60), (50, 36), (20, 56), (-10, 40), (-40, 60), (-70, 44)]
        c.poly(pts, hc, smooth=True)



def hats(c, L, view="front"):
    if "cap" in L.extras:          # полицейская фуражка
        c.poly([(-104, 60), (-112, 4), (-60, -26), (60, -26), (112, 4), (104, 60)], (22, 28, 52, 255), smooth=True)
        c.rect((-108, 46, 108, 72), (14, 16, 26, 255), r=8)
        if view == "front":
            c.poly([(-108, 66), (108, 66), (88, 100), (-88, 100)], (10, 10, 14, 255), smooth=True)
            c.poly([(0, 4), (18, 24), (0, 44), (-18, 24)], (220, 180, 70, 255))
    if "helmet" in L.extras:       # каска пожарного
        c.ell((-120, -40, 120, 120), (200, 150, 30, 255))
        c.rect((-140, 70, 140, 96), (180, 130, 20, 255), r=12)
        c.line([(0, -36), (0, 70)], (230, 190, 70, 255), 10)
        if view == "front":
            c.rect((-80, 82, 80, 110), (40, 40, 44, 200), r=8)
    if "hood" in L.extras:         # капюшон химзащиты с маской
        c.ell((-130, -40, 130, 250), L.top_col)
        if view == "front":
            c.ell((-82, 40, 82, 200), (30, 40, 50, 255))
            c.ell((-70, 50, 30, 120), (150, 190, 210, 120))
            c.circ(-50, 220, 34, (40, 40, 44, 255))
            c.circ(50, 220, 34, (40, 40, 44, 255))
            c.ell((-30, 196, 30, 246), (60, 60, 64, 255))


# --- торс спереди / сзади ------------------------------------------------------
def torso(c, L, view="front", breath=0.0, sitting=False):
    w = L.width * (0.9 if L.female else 1.0)
    sw = 150 * w
    col = L.top_col
    acc = L.accent
    b = breath * 6
    if L.top in ("coat", "mama", "doctor", "hazmat", "fire"):
        hem = 1120 if L.top != "hazmat" else 1060
    else:
        hem = 1020
    if sitting:
        hem = min(hem, 960)
    pts = [(-sw - 6, 300), (-sw + 30, 262 - b), (-50, 250), (50, 250), (sw - 30, 262 - b), (sw + 6, 300), (sw + 12, 620), (sw * 0.95, hem - 60),
           (sw * 0.9, hem), (-sw * 0.9, hem), (-sw * 0.95, hem - 60), (-sw - 12, 620)]
    if L.female and L.top != "hazmat":
        pts = [(-sw - 6, 300), (-sw + 30, 262), (-50, 250), (50, 250), (sw - 30, 262), (sw + 6, 300), (sw + 4, 560), (sw - 14, 650), (sw + 10, 820), (sw * 1.0, hem),
               (-sw * 1.0, hem), (-sw - 10, 820), (-sw + 14, 650), (-sw - 4, 560)]
    c.poly(pts, col, smooth=True)
    # объём: тень с правой стороны
    c.poly([(sw * 0.45, 270), (sw - 30, 262), (sw + 6, 300), (sw + 12, 620), (sw * 0.9, hem), (sw * 0.55, hem)], sh(col, 0.86)[:3] + (150,), smooth=True)
    t = L.top
    if view == "front":
        if t == "track":
            c.line([(0, 262), (0, hem - 8)], (200, 200, 210, 255), 4)
            c.poly([(-56, 250), (0, 300), (56, 250), (46, 236), (0, 274), (-46, 236)], acc)
            c.rect((-sw * 0.9, hem - 40, sw * 0.9, hem), sh(col, 0.8), r=8)
        elif t == "hoodie":
            c.poly([(-70, 246), (0, 290), (70, 246), (80, 280), (0, 330), (-80, 280)], sh(col, 0.8))
            c.line([(-20, 300), (-24, 430)], acc, 5)
            c.line([(20, 300), (24, 430)], acc, 5)
            c.poly([(-90, 760), (90, 760), (110, 900), (-110, 900)], sh(col, 0.85), smooth=False)
            c.rect((-sw * 0.92, hem - 46, sw * 0.92, hem), sh(col, 0.8), r=12)
        elif t == "uniform":
            c.poly([(-40, 250), (0, 320), (40, 250)], (220, 214, 204, 255))
            c.poly([(-14, 290), (14, 290), (20, 450), (0, 480), (-20, 450)], (14, 16, 30, 255))
            c.line([(0, 320), (0, 940)], sh(col, 0.75), 5)
            for s in (-1, 1):
                c.rect((s * 135 - 46, 276, s * 135 + 46, 296), sh(col, 0.7), r=6)
                c.rect((s * 80 - 48, 420, s * 80 + 48, 506), sh(col, 0.8), r=8)
                c.line([(s * 80 - 48, 440), (s * 80 + 48, 440)], sh(col, 0.65), 4)
            star = [(80 + 30 * math.cos(math.radians(-90 + i * 36)) * (1 if i % 2 == 0 else 0.45), 385 + 30 * math.sin(math.radians(-90 + i * 36)) * (1 if i % 2 == 0 else 0.45)) for i in range(10)]
            c.poly(star, (232, 192, 76, 255))
            c.rect((-128, 528, -32, 550), (210, 210, 220, 255), r=3)
            c.rect((-170, 330, -124, 404), (22, 22, 26, 255), r=8)
            c.line([(-150, 330), (-150, 296)], (22, 22, 26, 255), 6)
            c.rect((-sw - 6, 940, sw + 6, 1000), (16, 16, 20, 255))
            c.rect((-28, 942, 28, 998), (196, 176, 96, 255), r=4)
        elif t == "coat":
            c.poly([(-50, 248), (0, 420), (50, 248), (16, 244), (0, 300), (-16, 244)], (170, 160, 150, 255))
            c.line([(-50, 250), (-14, 560)], sh(col, 0.8), 10)
            c.line([(50, 250), (14, 560)], sh(col, 0.8), 10)
            c.rect((-sw - 8, 620, sw + 8, 664), sh(col, 0.75))
            c.rect((-22, 616, 22, 668), (70, 56, 44, 255), r=4)
            for y in (450, 540, 760, 860):
                for s in (-1, 1):
                    c.circ(s * 40, y, 9, sh(col, 0.7))
        elif t == "mama":
            c.poly([(-60, 246), (0, 300), (60, 246), (70, 300), (0, 360), (-70, 300)], (90, 140, 120, 255))   # шарф
            c.line([(40, 320), (60, 520)], (90, 140, 120, 255), 40)
            for y in (420, 560, 700, 840):
                c.circ(0, y, 10, sh(col, 0.7))
            c.line([(0, 360), (0, hem)], sh(col, 0.75), 4)
        elif t == "hazmat":
            c.line([(0, 262), (0, hem - 40)], sh(col, 0.75), 6)
            for y in (520, 800):
                c.rect((-sw - 10, y, sw + 10, y + 30), (200, 200, 200, 255))
            c.rect((-60, 380, 60, 440), (30, 30, 30, 255), r=6)
            c.text((0, 410), "☢", 46, (240, 200, 0, 255), anchor="mm")
        elif t == "fire":
            for y in (560, 960):
                c.rect((-sw - 10, y, sw + 10, y + 34), (220, 220, 90, 255))
            c.line([(0, 262), (0, hem)], sh(col, 0.7), 6)
        elif t == "doctor":
            c.poly([(-60, 248), (0, 380), (60, 248)], (120, 170, 220, 255))
            c.line([(-60, 250), (-20, 700)], sh(col, 0.85), 8)
            c.line([(60, 250), (20, 700)], sh(col, 0.85), 8)
            c.rect((40, 400, 110, 470), sh(col, 0.9), r=6)
            c.rect((-16, 470, 16, 560), (220, 40, 40, 255))
            c.rect((-46, 500, 46, 530), (220, 40, 40, 255))
        elif t == "shirt":
            c.poly([(-40, 250), (0, 310), (40, 250)], acc)
    else:  # сзади
        if t == "track":
            c.line([(0, 270), (0, hem)], sh(col, 0.85), 4)
            c.rect((-sw * 0.9, hem - 40, sw * 0.9, hem), sh(col, 0.8), r=8)
        elif t == "hoodie":
            c.ell((-90, 236, 90, 380), sh(col, 0.85))
        elif t == "uniform":
            c.line([(0, 300), (0, 940)], sh(col, 0.8), 5)
            for s in (-1, 1):
                c.line([(s * 70, 300), (s * 80, 900)], sh(col, 0.85), 4)
            c.rect((-sw - 6, 940, sw + 6, 1000), (16, 16, 20, 255))
            c.text((0, 520), "POLICE", 46, (212, 202, 150, 255), anchor="mm")
        elif t == "coat":
            c.rect((-sw - 8, 620, sw + 8, 664), sh(col, 0.75))
            c.line([(0, 700), (0, hem)], sh(col, 0.75), 8)
            c.poly([(-sw + 10, 270), (sw - 10, 270), (sw - 30, 420), (-sw + 30, 420)], sh(col, 0.92))
        elif t == "hazmat":
            c.rect((-80, 330, 80, 760), (190, 190, 196, 255), r=40)   # баллон
            c.rect((-60, 300, 60, 340), (60, 60, 64, 255), r=8)
            for y in (520, 800):
                c.rect((-sw - 10, y, sw + 10, y + 30), (200, 200, 200, 255))
        elif t == "fire":
            c.text((0, 520), "01", 70, (220, 220, 90, 255), anchor="mm")
            for y in (700, 960):
                c.rect((-sw - 10, y, sw + 10, y + 34), (220, 220, 90, 255))
        elif t == "mama":
            c.line([(0, 300), (0, hem)], sh(col, 0.8), 4)


def neck(c, L):
    c.poly([(-36, 180), (36, 180), (40, 262), (-40, 262)], sh(L.skin, 0.84))
    c.ell((-40, 236, 40, 276), sh(L.skin, 0.75))


# --- ноги ---------------------------------------------------------------
def legs_front(c, L, mode="stand", phase=0.0, sit=None, spread=0.0):
    pc = L.pants
    hip_y = 980
    lens = 1700 - hip_y
    for s in (-1, 1):
        hx = s * 56 * L.width
        if mode == "sit":
            knee, ankle = sit[s]
            limb(c, knee, ankle, 100, 72, sh(pc, 0.8))
            limb(c, (hx, hip_y), knee, 124, 140, pc)
            # верх бедра освещён (вид сверху на колени)
            limb(c, (hx, hip_y - 4), (knee[0], knee[1] - 22), 70, 60, sh(pc, 1.14))
            c.ell((knee[0] - 54, knee[1] - 40, knee[0] + 54, knee[1] + 40), sh(pc, 1.06))
            c.ell((knee[0] - 30, knee[1] - 30, knee[0] + 30, knee[1] + 6), sh(pc, 1.2))
            if L.top == "track":
                c.line([(ankle[0] + s * 34, ankle[1] - 20), (knee[0] + s * 50, knee[1] + 10)], L.accent, 6)
            shoe(c, L, ankle, "front")
            continue
        lift = 0.0
        if mode == "walk":
            lift = max(0, math.sin(phase + (0 if s < 0 else math.pi))) * 60
        elif mode == "run":
            lift = max(0, math.sin(phase + (0 if s < 0 else math.pi))) * 140
        foot_x = hx + s * (18 + spread)
        ky = hip_y + lens * 0.5 - lift * 0.6
        knee = (hx + s * 6, ky)
        ankle = (foot_x, 1660 - lift)
        limb(c, (hx, hip_y), knee, 116, 96, pc)
        limb(c, knee, ankle, 96, 70, pc)
        if L.top in ("track",):
            c.line([(hx + s * 52, hip_y + 10), (knee[0] + s * 44, knee[1]), (ankle[0] + s * 30, ankle[1] - 20)], L.accent, 6)
        shoe(c, L, ankle, "front")


def shoe(c, L, p, view, fx=1):
    if view == "front":
        c.ell((p[0] - 50, p[1] - 14, p[0] + 50, p[1] + 44), L.shoes)
        c.ell((p[0] - 40, p[1] - 10, p[0] + 30, p[1] + 14), sh(L.shoes, 1.4))
    else:
        c.poly([(p[0] - 40, p[1] - 20), (p[0] + 30, p[1] - 24), (p[0] + 96, p[1] + 10), (p[0] + 96, p[1] + 36), (p[0] - 46, p[1] + 36)], L.shoes, smooth=True)


# --- вид спереди -----------------------------------------------------------
def front(c, L, p=None):
    """p: dict(face=..., arms=((a_sh,a_el),(a_sh,a_el)) для левой/правой, legs='stand'|'walk'|'run'|'sit',
    phase, sit={-1:(knee,ankle), 1:(knee,ankle)}, props={'r': fn(c, wrist, ang)}, hand_r scale, breath)"""
    p = p or {}
    face = p.get("face", {})
    turn = face.get("turn", 0.0)
    hair_back(c, L)
    if L.top == "hazmat":
        hats(c, L)
    legs_front(c, L, p.get("legs", "stand"), p.get("phase", 0.0), p.get("sit"), p.get("spread", 0.0))
    arms = p.get("arms", ((8, 10), (8, 10)))
    behind = p.get("arms_behind", (False, False))
    sw = 150 * L.width * (0.9 if L.female else 1.0)
    sleeve = L.top_col
    hs = p.get("hand_scale", (1.0, 1.0))
    wrists = {}

    def draw_arm(i, s):
        shp = (s * (sw - 14), 300)
        l1, l2 = 300 * (0.9 if L.female else 1), 280 * (0.9 if L.female else 1)
        if isinstance(arms[i], dict):
            tg = arms[i]["ik"]
            el, wr, ang = arm_ik(shp, (tg[0] - math.sin(math.atan2(tg[0] - shp[0], tg[1] - shp[1])) * 30, tg[1] - math.cos(math.atan2(tg[0] - shp[0], tg[1] - shp[1])) * 30), s, l1, l2)
        else:
            a_sh, a_el = arms[i]
            el, wr, ang = arm_points(shp, a_sh, a_el, s, l1, l2)
        k = hs[i]
        limb(c, shp, el, 86 * L.width, 76 * L.width, sleeve)
        limb(c, el, wr, 76 * L.width * (0.7 + 0.3 * k), 66 * L.width * k, sleeve)
        if L.top == "track":
            c.line([(shp[0] + s * 34, shp[1]), (el[0] + s * 30, el[1]), (wr[0] + s * 22, wr[1])], L.accent, 5)
        cuff = sh(sleeve, 0.8)
        c.circ(wr[0], wr[1], 34 * L.width * k, cuff)
        skin = (30, 30, 30, 255) if L.top in ("hazmat",) else ((50, 40, 30, 255) if L.top == "fire" else L.skin)
        hp = (wr[0] + math.sin(ang) * 30 * k, wr[1] + math.cos(ang) * 30 * k)
        wrists[s] = (hp, ang)
        prop = p.get("props", {}).get(s)
        if p.get("palm", (False, False))[i]:
            palm(c, hp, skin, 40 * k)
        else:
            hand(c, hp, skin, 40 * k, ang, fist=prop is not None)
        if prop:
            prop(c, hp, ang)

    for i, s in enumerate((-1, 1)):
        if behind[i]:
            draw_arm(i, s)
    neck(c, L)
    torso(c, L, "front", p.get("breath", 0.0), sitting=p.get("legs") == "sit")
    for i, s in enumerate((-1, 1)):
        if not behind[i]:
            draw_arm(i, s)
    if "hood" not in L.extras:
        face_front(c, L, face)
        hair_front(c, L, turn)
    hats(c, L)
    return wrists


def back(c, L, p=None):
    p = p or {}
    sw = 150 * L.width * (0.9 if L.female else 1.0)
    mode = p.get("legs", "stand")
    ph = p.get("phase", 0.0)
    amp = 1.7 if mode == "run" else 1.0
    # ноги
    for s in (-1, 1):
        x = s * 56 * L.width
        lift = 0
        if mode in ("walk", "run"):
            lift = max(0, math.sin(ph + (0 if s < 0 else math.pi))) * 80 * amp
        knee = (x + s * 4, 1320 - lift * 0.5)
        ank = (x + s * 14, 1660 - lift)
        limb(c, (x, 980), knee, 116, 98, L.pants)
        limb(c, knee, ank, 98, 72, L.pants)
        c.ell((ank[0] - 48, ank[1] - 10, ank[0] + 48, ank[1] + 40), L.shoes)
        if lift > 20:
            c.ell((ank[0] - 36, ank[1] + 10, ank[0] + 36, ank[1] + 40), sh(L.shoes, 1.6))
    arms = p.get("arms", ((8, 6), (8, 6)))
    sw_ = math.sin(ph) * (16 if mode == "walk" else 40 if mode == "run" else 0)
    neck(c, L)
    torso(c, L, "back")
    for i, s in enumerate((-1, 1)):
        shp = (s * (sw - 14), 300)
        if isinstance(arms[i], dict):
            el, wr, ang = arm_ik(shp, arms[i]["ik"], s, 300 * (0.9 if L.female else 1), 280 * (0.9 if L.female else 1))
        else:
            a_sh, a_el = arms[i]
            a_sh = a_sh + s * sw_ * 0.3
            a_el = a_el + (sw_ * s if mode == "run" else 0)
            el, wr, ang = arm_points(shp, a_sh, a_el, s, 300 * (0.9 if L.female else 1), 280 * (0.9 if L.female else 1))
        limb(c, shp, el, 86 * L.width, 76 * L.width, L.top_col)
        limb(c, el, wr, 76 * L.width, 66 * L.width, L.top_col)
        skin = (30, 30, 30, 255) if L.top == "hazmat" else L.skin
        hp = (wr[0] + math.sin(ang) * 30, wr[1] + math.cos(ang) * 30)
        prop = p.get("props", {}).get(s)
        hand(c, hp, skin, 40, ang, fist=prop is not None)
        if prop:
            prop(c, hp, ang)
    # голова сзади
    c.ell((-104, 104, -80, 160), sh(L.skin, 0.84))
    c.ell((80, 104, 104, 160), sh(L.skin, 0.84))
    if "hood" in L.extras:
        hats(c, L, "back")
        return
    st = L.hair_style
    hc = L.hair
    if st == "ponytail":
        c.ell((-98, -20, 98, 200), hc)
        c.line([(-30, 30), (-10, 150)], sh(hc, 1.2), 5)
        c.line([(30, 30), (10, 150)], sh(hc, 1.2), 5)
        sway = p.get("tail", 0.0)
        c.rect((-16, 96, 16, 124), (200, 40, 70, 255), r=6)
        c.line([(0, 118), (6 + sway * 30, 240), (-4 + sway * 50, 360)], hc, 44, smooth=True)
    elif st == "curly":
        hair_back(c, L, "back")
    elif st == "none":
        c.ell((-96, 0, 96, 220), L.skin)
    else:
        c.ell((-98, -12, 98, 200), hc)
        c.ell((-80, 150, 80, 210), sh(L.skin, 0.84))
        c.ell((-98, -12, 98, 170), hc)
    hats(c, L, "back")


# --- вид сбоку (лицом вправо) ---------------------------------------------
def side(c, L, p=None):
    p = p or {}
    mode = p.get("legs", "stand")
    ph = p.get("phase", 0.0)
    amp = {"stand": 0, "walk": 1.0, "run": 1.8, "sneak": 0.6}.get(mode, 0)
    blink = p.get("blink", 0.0)
    mouth = p.get("mouth", 0.0)
    pc = L.pants
    far = lambda col: sh(col, 0.78)
    s1 = math.sin(ph)
    lean = 0.12 * (mode == "run") + 0.05 * (mode == "sneak")

    def leg(sign, colf):
        a = sign * s1 * 0.45 * amp
        hip = (0, 990)
        knee = rot((0, 1330), a, hip)
        bend = max(0, sign * math.cos(ph)) * 0.6 * amp + (0.4 if mode == "sneak" else 0)
        ank = rot((knee[0], knee[1] + 330), a - bend, knee)
        limb(c, hip, knee, 112, 96, colf(pc))
        limb(c, knee, ank, 96, 70, colf(pc))
        q = {"shoes": colf(L.shoes)}
        c.poly([(ank[0] - 40, ank[1] - 20), (ank[0] + 30, ank[1] - 24), (ank[0] + 96, ank[1] + 10), (ank[0] + 96, ank[1] + 36), (ank[0] - 46, ank[1] + 36)], q["shoes"], smooth=True)

    def arm(sign, colf, top=False):
        a = -sign * s1 * 0.5 * amp
        if mode == "run":
            a *= 1.3
        shp = (6, 300)
        pose = p.get("arm") if top else p.get("arm_far")
        if pose:
            a1, a2 = math.radians(pose[0]), math.radians(pose[1])
            el = rot((shp[0], shp[1] + 300), -a1, shp)
            wr = rot((el[0], el[1] + 280), -a1 - a2, el)
        else:
            el = rot((shp[0], shp[1] + 300), a, shp)
            wr = rot((el[0], el[1] + 280), a - (0.9 if mode == "run" else 0.25 + 0.2 * max(0, -sign * s1)), el)
        limb(c, shp, el, 82, 72, colf(L.top_col))
        limb(c, el, wr, 72, 62, colf(L.top_col))
        skin = (30, 30, 30, 255) if L.top == "hazmat" else L.skin
        c.circ(wr[0], wr[1], 38, colf(skin))
        prop = p.get("prop") if top else None
        if prop:
            prop(c, wr, 0)

    c2 = c.sub(0, 0, 1.0)
    if lean:
        pass
    arm(-1, far)
    leg(-1, far)
    # торс
    col = L.top_col
    hem = 1120 if L.top in ("coat", "mama", "doctor", "fire") else (1060 if L.top == "hazmat" else 1020)
    c.poly([(-70, 280), (40, 260), (86, 320), (92, 600), (80, hem), (-76, hem), (-84, 600), (-80, 330)], col, smooth=True)
    if L.top == "hazmat":
        c.rect((-150, 340, -70, 740), (190, 190, 196, 255), r=36)
        for y in (520, 800):
            c.rect((-80, y, 94, y + 30), (200, 200, 200, 255))
    if L.top == "fire":
        for y in (560, 960):
            c.rect((-80, y, 94, y + 34), (220, 220, 90, 255))
    if L.top == "uniform":
        c.rect((-82, 940, 96, 1000), (16, 16, 20, 255))
        c.rect((-60, 960, 10, 1100), (16, 16, 20, 255), r=10)
    if L.top == "track":
        c.line([(-10, 280), (-10, hem)], L.accent, 5)
    leg(1, lambda x: x)
    # голова в профиль
    c.poly([(-30, 190), (40, 190), (44, 270), (-34, 270)], sh(L.skin, 0.84))
    if "hood" in L.extras:
        c.ell((-110, -30, 130, 250), L.top_col)
        c.ell((10, 40, 140, 200), (30, 40, 50, 255))
        c.ell((40, 50, 120, 110), (150, 190, 210, 120))
        c.circ(110, 220, 34, (40, 40, 44, 255))
    else:
        hair_side_back(c, L)
        head = [(-90, 60), (-60, 4), (10, -6), (70, 20), (92, 70), (100, 100), (124, 132), (104, 146), (106, 162), (102, 172), (96, 196), (70, 218), (20, 222), (-40, 200), (-86, 150)]
        c.poly(head, L.skin, smooth=True)
        c.ell((-26, 96, 10, 158), sh(L.skin, 0.84))
        if blink > 0.6:
            c.line([(64, 106), (86, 108)], sh(L.skin, 0.5), 4)
        else:
            c.poly([(62, 102), (88, 98), (90, 112), (66, 114)], (250, 248, 244, 255), smooth=True)
            c.circ(82, 106, 7, L.eyes)
        c.line([(56, 84), (94, 80)], sh(L.hair, 0.9), 6)
        if mouth > 0.07:
            c.ell((86, 162, 104, 172 + 16 * mouth), (70, 20, 26, 255))
        else:
            c.line([(88, 170), (104, 168)], sh(L.skin, 0.6), 4)
        if "mole" in L.extras:
            c.circ(66, 160, 4, (90, 50, 40, 255))
        if "mustache" in L.extras:
            c.poly([(80, 152), (110, 150), (106, 162), (80, 164)], sh(L.hair, 0.9))
        hair_side_front(c, L)
        if "cap" in L.extras:
            c.poly([(-96, 60), (-90, 0), (-20, -30), (70, -20), (100, 20), (96, 60)], (22, 28, 52, 255), smooth=True)
            c.poly([(70, 50), (150, 60), (140, 80), (60, 74)], (10, 10, 14, 255))
            c.poly([(60, 0), (76, 18), (60, 36), (44, 18)], (220, 180, 70, 255))
        if "helmet" in L.extras:
            c.ell((-120, -40, 120, 110), (200, 150, 30, 255))
            c.poly([(-150, 80), (-120, 60), (140, 70), (170, 96), (-150, 100)], (180, 130, 20, 255))
        if "mask" in L.extras:
            c.poly([(40, 140), (124, 132), (118, 200), (50, 206)], (150, 200, 220, 255), smooth=True)
    arm(1, lambda x: x, top=True)


def hair_side_back(c, L):
    st = L.hair_style
    hc = L.hair
    if st == "ponytail":
        c.ell((-100, -20, 90, 170), hc)
        c.line([(-90, 90), (-140, 200), (-130, 320)], hc, 44, smooth=True)
        c.rect((-104, 80, -80, 108), (200, 40, 70, 255), r=6)
    elif st == "curly":
        for k in range(8):
            a = math.pi * (0.2 + k / 7 * 1.0)
            c.circ(-10 + math.cos(a) * 96, 80 - math.sin(a) * 86, 36, hc)
        c.ell((-120, 60, 20, 200), hc)
    elif st in ("short", "slick", "messy"):
        c.ell((-100, -14, 84, 150), hc)


def hair_side_front(c, L):
    st = L.hair_style
    hc = L.hair
    if st == "short":
        c.poly([(-96, 100), (-90, 10), (-20, -18), (60, -8), (96, 40), (70, 34), (20, 30), (-30, 50), (-40, 110)], hc, smooth=True)
    elif st == "slick":
        c.poly([(-96, 100), (-90, 10), (-20, -18), (60, -10), (94, 30), (40, 26), (-40, 40), (-50, 110)], hc, smooth=True)
    elif st == "messy":
        c.poly([(-100, 110), (-96, 10), (-40, -30), (0, -14), (40, -34), (80, -6), (104, 44), (60, 40), (20, 50), (-30, 54), (-44, 120)], hc, smooth=True)
    elif st == "ponytail":
        c.poly([(-90, 110), (-90, 10), (-20, -20), (60, -10), (96, 50), (60, 36), (10, 30), (-40, 60), (-50, 120)], hc, smooth=True)
    elif st == "curly":
        for k in range(6):
            c.circ(-60 + k * 28, -2 + (k % 2) * 10, 30, hc)
