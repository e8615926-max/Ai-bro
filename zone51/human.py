"""Риг персонажа: вид спереди, сзади и сбоку; моргание, взгляд, рот, эмоции, походка, кисти с пальцами, предметы.
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
    hair_style: str = "short"          # short, medium, slick, ponytail, curly, messy, none
    top: str = "track"                 # track, hoodie, uniform, coat, hazmat, fire, doctor, mama, shirt
    top_col: tuple = (40, 54, 116, 255)
    accent: tuple = (236, 236, 240, 255)
    pants: tuple = (40, 54, 116, 255)
    shoes: tuple = (30, 26, 24, 255)
    shoe_style: str = "shoe"           # shoe, sneaker, boot
    sneaker_accent: tuple = (40, 80, 200, 255)
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


def edge_line(c, p0, p1, w0, w1, side, col, width):
    """Полоса вдоль внешнего края сегмента (лампасы на рукавах/штанинах)."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L
    if nx * side < 0 or (abs(nx) < 1e-3 and ny * side < 0):
        nx, ny = -nx, -ny
    o0, o1 = w0 / 2 - width, w1 / 2 - width
    c.line([(p0[0] + nx * o0, p0[1] + ny * o0), (p1[0] + nx * o1, p1[1] + ny * o1)], col, width)


def rot(p, a, o=(0, 0)):
    ca, sa = math.cos(a), math.sin(a)
    x, y = p[0] - o[0], p[1] - o[1]
    return (o[0] + x * ca - y * sa, o[1] + x * sa + y * ca)


def arm_points(shoulder, a_sh, a_el, side, l1=310, l2=290):
    """side: -1 левая сторона экрана, +1 правая. Углы: a_sh — отвод от вертикали наружу, a_el — сгиб к центру (градусы)."""
    a1 = math.radians(a_sh) * side
    el = (shoulder[0] + math.sin(a1) * l1, shoulder[1] + math.cos(a1) * l1)
    a2 = a1 - math.radians(a_el) * side
    wr = (el[0] + math.sin(a2) * l2, el[1] + math.cos(a2) * l2)
    return el, wr, a2


def arm_ik(shoulder, target, side, l1=310, l2=290, out=1.0):
    """Двухзвенная ИК. Локоть всегда в одну сторону (наружу-вниз) — без скачков между решениями."""
    dx, dy = target[0] - shoulder[0], target[1] - shoulder[1]
    d0 = math.hypot(dx, dy)
    # кисть близко к плечу -> рука идёт на зрителя: укорачиваем звенья (ракурс), а не выворачиваем локоть
    f = min(1.0, max(0.45, d0 * 1.12 / (l1 + l2)))
    l1, l2 = l1 * f, l2 * f
    d = max(1.0, min(d0, l1 + l2 - 1))
    base = math.atan2(dx, dy)
    a = math.acos(max(-1, min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
    # нормаль к линии плечо-цель, обращённая наружу/вниз
    ux, uy = math.sin(base), math.cos(base)
    n1 = (uy, -ux)
    pref = (side * 0.2 * out, 1.0)
    sg = 1 if (n1[0] * pref[0] + n1[1] * pref[1]) >= 0 else -1
    # рост угла base поворачивает направление в сторону n1
    a1 = base + a * sg
    el = (shoulder[0] + math.sin(a1) * l1, shoulder[1] + math.cos(a1) * l1)
    a2 = math.atan2(target[0] - el[0], target[1] - el[1])
    wr = (el[0] + math.sin(a2) * l2, el[1] + math.cos(a2) * l2)
    return el, wr, a2


def lerp_t(a, b, u):
    return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)


# --- кисти --------------------------------------------------------------
def _frame(p, ang):
    """Локальная система кисти: v — вдоль предплечья, u — поперёк."""
    dv = (math.sin(ang), math.cos(ang))
    du = (math.cos(ang), -math.sin(ang))
    return lambda u, v: (p[0] + du[0] * u + dv[0] * v, p[1] + du[1] * u + dv[1] * v)


def hand(c, p, skin, r=42, ang=0.0, fist=False, side=1, mode=None):
    """Кисть: relax (пальцы чуть согнуты), fist/grip (кулак, держит предмет), point (указательный).
    p — запястье, ang — направление предплечья."""
    mode = mode or ("grip" if fist else "relax")
    d = sh(skin, 0.8)
    F = _frame(p, ang)
    s = side
    if mode in ("grip", "fist"):
        c.poly([F(-0.85 * r, 0.1 * r), F(0.85 * r, 0.1 * r), F(0.95 * r, 0.9 * r), F(0.6 * r, 1.45 * r), F(-0.6 * r, 1.45 * r), F(-0.95 * r, 0.9 * r)], skin, smooth=True)
        for k in range(3):   # костяшки
            u = -0.5 * r + k * 0.5 * r
            c.line([F(u, 0.95 * r), F(u, 1.35 * r)], d, max(2, r * 0.08))
        c.poly([F(-s * 0.9 * r, 0.3 * r), F(-s * 1.2 * r, 0.8 * r), F(-s * 0.7 * r, 1.15 * r), F(-s * 0.45 * r, 0.6 * r)], sh(skin, 0.95), smooth=True)   # большой палец
        return
    if mode == "point":
        c.poly([F(-0.8 * r, 0.1 * r), F(0.8 * r, 0.1 * r), F(0.85 * r, 1.0 * r), F(-0.85 * r, 1.0 * r)], skin, smooth=True)
        c.line([F(0.35 * r, 0.9 * r), F(0.35 * r, 2.2 * r)], skin, r * 0.42)
        c.poly([F(-0.85 * r, 0.9 * r), F(0.2 * r, 0.9 * r), F(0.1 * r, 1.35 * r), F(-0.75 * r, 1.3 * r)], sh(skin, 0.94), smooth=True)
        return
    # relax: ладонь + сомкнутые пальцы, слегка согнутые, большой палец сбоку
    c.poly([F(-0.75 * r, 0.0), F(0.75 * r, 0.0), F(0.85 * r, 0.9 * r), F(0.7 * r, 1.5 * r), F(0.3 * r, 1.9 * r), F(-0.15 * r, 1.95 * r), F(-0.6 * r, 1.7 * r), F(-0.85 * r, 0.9 * r)],
           skin, smooth=True)
    for k in range(3):
        u = -0.35 * r + k * 0.38 * r
        c.line([F(u, 1.05 * r), F(u + 0.05 * r, 1.75 * r)], d, max(2, r * 0.06))
    c.poly([F(-s * 0.7 * r, 0.25 * r), F(-s * 1.15 * r, 0.75 * r), F(-s * 1.05 * r, 1.15 * r), F(-s * 0.7 * r, 0.95 * r)], sh(skin, 0.95), smooth=True)


def palm(c, p, skin, r=42):
    """Открытая ладонь к зрителю, пальцы вверх."""
    d = sh(skin, 0.8)
    x, y = p
    c.rect((x - r * 1.0, y - r * 0.9, x + r * 1.0, y + r * 1.0), skin, r=r * 0.6)
    for i in range(4):
        fx = x - r * 0.75 + i * r * 0.5
        h = r * (1.5 - abs(i - 1.4) * 0.22)
        c.rect((fx - r * 0.22, y - r * 0.6 - h, fx + r * 0.22, y - r * 0.4), skin, r=r * 0.22)
    c.line([(x + r * 0.9, y + r * 0.3), (x + r * 1.5, y - r * 0.4)], skin, r * 0.45)
    c.arc((x - r * 0.6, y - r * 0.2, x + r * 0.6, y + r * 0.8), 200, 340, d, max(2, r * 0.07))


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
    # уши: рисуются под головой, мочка заходит на щёку — без зазора у челюсти
    for s in (-1, 1):
        vis = 1 - max(0, s * turn) * 0.9
        if vis > 0.2:
            ex = s * (hw - 8) - turn * 12
            c.ell((ex - 18 * vis, 98, ex + 18 * vis, 172), sd)
            c.ell((ex - 9 * vis, 110, ex + 9 * vis, 156), sh(skin, 0.74))
            if "earrings" in L.extras:
                c.circ(ex, 176, 7, (230, 200, 90, 255))
    jaw = 0.0 if L.female or ch else 8
    head = [(-hw, 92), (-hw + 4, 40), (-52, 6), (0, -2), (52, 6), (hw - 4, 40), (hw, 92), (hw - 2, 140), (hw - 14 - jaw * 0.5, 178),
            (hw * 0.52 + ox * 0.3, 210), (ox * 0.5, 224), (-hw * 0.52 + ox * 0.3, 210), (-hw + 14 + jaw * 0.5, 178), (-hw + 2, 140)]
    c.poly(head, skin, smooth=True, n=14)
    # мягкая тень со стороны поворота (без острых углов)
    s = -1 if turn > 0 else 1
    c.ell((s * hw - 30 - s * 6, 60, s * hw + 22 - s * 6, 200), sh(skin, 0.9)[:3] + (int(60 + 60 * abs(turn)),))
    c.ell((-hw * 0.5 + ox * 0.3, 196, hw * 0.5 + ox * 0.3, 226), sh(skin, 0.9)[:3] + (60,))
    if "stubble" in L.extras:
        c.ell((-hw * 0.62 + ox * 0.3, 168, hw * 0.62 + ox * 0.3, 226), (80, 60, 50, 36))
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


# --- волосы -----------------------------------------------------------------
def hair_back(c, L, view="front"):
    st = L.hair_style
    hc = L.hair
    if st == "ponytail":
        c.poly([(-108, 70), (-100, -10), (0, -30), (100, -10), (108, 70), (104, 170), (-104, 170)], hc, smooth=True)
        if view == "front":
            c.line([(86, 120), (126, 230), (118, 360)], sh(hc, 0.85), 40, smooth=True)
    elif st == "curly":
        for k in range(11):
            a = math.pi * (k / 10)
            c.circ(math.cos(a) * 96, 80 - math.sin(a) * 82, 38, hc)
        c.ell((-108, 60, 108, 190), hc)
    elif st == "messy":
        c.ell((-104, -14, 104, 150), hc)
    elif st == "medium":   # объёмные волосы до низа ушей
        c.poly([(-112, 150), (-118, 60), (-100, -4), (-40, -30), (40, -30), (100, -4), (118, 60), (112, 150), (96, 176), (-96, 176)], hc, smooth=True)
    elif st in ("short", "slick"):
        c.ell((-98, -8, 98, 130), hc)


def hair_front(c, L, turn=0.0):
    st = L.hair_style
    hc = L.hair
    hl = sh(hc, 1.22)
    ox = turn * 20
    if st == "short":
        c.poly([(-96, 92), (-98, 30), (-60, -8), (0, -16), (60, -8), (98, 30), (96, 92), (84, 60), (60, 38), (ox + 10, 34), (-40, 30), (-80, 56)], hc, smooth=True)
        c.poly([(-40, 30), (ox + 20, 24), (40, 40), (ox - 10, 50)], hc, smooth=True)
    elif st == "medium":
        # пробор сбоку, чёлка уложена на лоб, пряди закрывают верх ушей
        c.poly([(-108, 132), (-112, 50), (-84, -2), (-20, -24), (50, -20), (100, 8), (112, 60), (108, 130), (94, 100), (90, 64), (60, 50), (30, 56),
                (ox + 6, 70), (-30, 62), (-60, 54), (-88, 76), (-94, 120)], hc, smooth=True, n=12)
        c.poly([(-70, 20), (-20, 4), (40, 16), (ox + 20, 66), (-10, 76), (-50, 60)], hc, smooth=True)
        for k in range(5):     # блики и пряди
            x = -70 + k * 30
            c.line([(x, 4 + abs(k - 2) * 4), (x + 18, 50 + k * 2)], hl, 4, smooth=True)
        c.line([(-40, -14), (30, -18), (80, 0)], sh(hc, 1.35), 5, smooth=True)
    elif st == "slick":
        c.poly([(-96, 92), (-96, 20), (-40, -14), (40, -14), (96, 20), (96, 92), (88, 50), (50, 30), (-50, 30), (-88, 50)], hc, smooth=True)
        c.line([(-40, 8), (30, -4), (70, 10)], sh(hc, 1.12), 4, smooth=True)
    elif st == "ponytail":
        c.poly([(-100, 120), (-98, 20), (-40, -20), (40, -20), (98, 20), (100, 120), (88, 60), (40, 26), (ox - 6, 22), (-50, 34), (-86, 72)], hc, smooth=True)
        c.poly([(-92, 40), (-60, 30), (-70, 130), (-98, 160)], hc, smooth=True)
        c.line([(-50, 0), (10, -10), (60, 4)], hl, 4, smooth=True)
    elif st == "curly":
        for k in range(9):
            a = math.pi * (0.1 + 0.8 * k / 8)
            c.circ(math.cos(a) * 76 + ox * 0.3, 40 - math.sin(a) * 52, 30, hc)
        for k in range(5):
            c.circ(-60 + k * 30, 16 + (k % 2) * 8, 6, hl)
    elif st == "messy":
        pts = [(-98, 100), (-104, 30)]
        for k in range(9):
            pts.append((-90 + k * 22, -18 - (k % 2) * 18))
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


def head_back(c, L, p):
    """Голова со спины: круглый затылок, линия роста волос, уши, шея."""
    sk = L.skin
    for s in (-1, 1):
        c.ell((s * 92 - 16, 100, s * 92 + 16, 170), sh(sk, 0.84))
        c.ell((s * 92 - 8, 112, s * 92 + 8, 156), sh(sk, 0.7))
    if "hood" in L.extras:
        hats(c, L, "back")
        return
    st = L.hair_style
    hc = L.hair
    if st == "none":
        c.ell((-94, -2, 94, 214), sk)
    elif st == "ponytail":
        c.ell((-100, -22, 100, 210), hc)
        for k in range(5):
            x = -60 + k * 30
            c.line([(x * 0.6, -8), (x, 90), (x * 0.3, 140)], sh(hc, 1.18), 4, smooth=True)
        sway = p.get("tail", 0.0)
        c.ell((-22, 100, 22, 132), (200, 40, 70, 255))
        # пышный хвост: несколько прядей, сужается книзу
        for k, (dx, w) in enumerate(((-14, 40), (14, 40), (0, 56))):
            c.line([(dx * 0.4, 124), (dx + sway * 30, 260), (dx * 0.5 + sway * 56, 400)], sh(hc, 0.92 + k * 0.06), w, smooth=True)
        c.line([(sway * 10, 130), (sway * 40, 300)], sh(hc, 1.25), 6, smooth=True)
    elif st == "curly":
        hair_back(c, L, "back")
        c.ell((-100, 0, 100, 190), hc)
    else:
        # шея-затылок, сверху шапка волос с округлой линией роста
        c.ell((-88, 30, 88, 214), sk)
        nape = 200 if st == "medium" else 176
        c.poly([(-100, 100), (-98, 30), (-60, -8), (0, -16), (60, -8), (98, 30), (100, 100), (92, 160), (60, nape), (0, nape + 10), (-60, nape), (-92, 160)], hc, smooth=True, n=12)
        c.line([(-50, 10), (-20, 120)], sh(hc, 1.15), 4, smooth=True)
        c.line([(30, 0), (50, 110)], sh(hc, 1.15), 4, smooth=True)
    hats(c, L, "back")


# --- торс -------------------------------------------------------------------
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
    c.poly([(sw * 0.5, 300), (sw - 6, 300), (sw + 4, 620), (sw * 0.86, hem - 4), (sw * 0.55, hem - 4), (sw * 0.6, 620)], sh(col, 0.88)[:3] + (140,))
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
            c.poly([(-90, 760), (90, 760), (110, 900), (-110, 900)], sh(col, 0.85))
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
            c.poly([(-60, 246), (0, 300), (60, 246), (70, 300), (0, 360), (-70, 300)], (90, 140, 120, 255))
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
            c.rect((-60, 250, 60, 280), acc, r=10)
        elif t == "hoodie":
            c.ell((-96, 232, 96, 390), sh(col, 0.85))
            c.ell((-80, 244, 80, 360), sh(col, 0.72))
        elif t == "uniform":
            # кокетка, складки, ремень с кобурой, светоотражающая надпись
            c.poly([(-sw - 6, 300), (sw + 6, 300), (sw, 380), (-sw, 380)], sh(col, 0.9))
            for s in (-1, 1):
                c.line([(s * 70, 380), (s * 76, 930)], sh(col, 0.82), 4)
                c.rect((s * 135 - 46, 276, s * 135 + 46, 296), sh(col, 0.7), r=6)
            c.rect((-sw - 6, 940, sw + 6, 1000), (16, 16, 20, 255))
            c.rect((-150, 520, 150, 600), (200, 190, 120, 255), r=8)
            c.text((0, 560), "POLICE", 50, (24, 30, 60, 255), anchor="mm")
        elif t == "coat":
            c.rect((-sw - 8, 620, sw + 8, 664), sh(col, 0.75))
            c.line([(0, 700), (0, hem)], sh(col, 0.75), 8)
            c.poly([(-sw + 10, 270), (sw - 10, 270), (sw - 30, 420), (-sw + 30, 420)], sh(col, 0.92))
        elif t == "hazmat":
            c.rect((-80, 330, 80, 760), (190, 190, 196, 255), r=40)
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
    c.poly([(-36, 170), (36, 170), (40, 262), (-40, 262)], sh(L.skin, 0.84))
    c.ell((-40, 236, 40, 276), sh(L.skin, 0.75))


# --- обувь -----------------------------------------------------------------
def shoe(c, L, p, view, fx=1, lift=0.0, tilt=0.0):
    """view: front (носок к нам) | back | side (носок вправо). tilt — наклон стопы (рад) в виде сбоку."""
    x, y = p
    st = L.shoe_style
    col = L.shoes
    if view in ("front", "back"):
        if st == "sneaker":
            c.ell((x - 54, y - 22, x + 54, y + 40), col)
            c.rect((x - 56, y + 18, x + 56, y + 46), (246, 246, 246, 255), r=14)       # подошва
            if view == "front":
                c.ell((x - 30, y - 18, x + 30, y + 10), sh(col, 1.12))
                for k in range(3):
                    c.line([(x - 18, y - 12 + k * 9), (x + 18, y - 12 + k * 9)], (250, 250, 250, 255), 3)
            c.line([(x - 48, y + 8), (x - 30, y + 24)], L.sneaker_accent, 5)
            c.line([(x + 48, y + 8), (x + 30, y + 24)], L.sneaker_accent, 5)
        elif st == "boot":
            c.rect((x - 46, y - 60, x + 46, y + 36), col, r=18)
            c.rect((x - 50, y + 24, x + 50, y + 44), sh(col, 0.6), r=8)
        else:
            c.ell((x - 50, y - 14, x + 50, y + 44), col)
            c.ell((x - 40, y - 10, x + 30, y + 14), sh(col, 1.4))
        return
    # профиль
    F = lambda u, v: (x + u * math.cos(tilt) - v * math.sin(tilt), y + u * math.sin(tilt) + v * math.cos(tilt))
    if st == "sneaker":
        c.poly([F(-46, -26), F(20, -30), F(70, 0), F(104, 16), F(108, 36), F(-50, 36)], col, smooth=True)
        c.poly([F(-54, 24), F(110, 24), F(112, 44), F(-52, 46)], (246, 246, 246, 255), smooth=True)
        c.line([F(-10, 8), F(40, -6), F(70, 14)], L.sneaker_accent, 7, smooth=True)
        for k in range(3):
            c.line([F(4 + k * 16, -24 + k * 6), F(14 + k * 16, -14 + k * 6)], (250, 250, 250, 255), 3)
    elif st == "boot":
        c.poly([F(-44, -70), F(20, -70), F(30, -10), F(100, 14), F(100, 40), F(-48, 40)], col, smooth=True)
        c.rect((-50 + x, 28 + y, 104 + x, 44 + y), sh(col, 0.6), r=6) if tilt == 0 else None
    else:
        c.poly([F(-40, -20), F(30, -24), F(96, 10), F(96, 36), F(-46, 36)], col, smooth=True)


# --- походка -----------------------------------------------------------------
GAIT = {"stand": (0.0, 0.0), "walk": (0.42, 0.95), "run": (0.72, 1.7), "sneak": (0.28, 0.7)}


def step_per_radian(hw, mode="walk"):
    """Сколько единиц мира проходит персонаж ростом hw за 1 рад фазы шага (чтобы ноги не скользили)."""
    A = GAIT.get(mode, (0.4, 1))[0]
    leg = 0.41 * hw
    return 2 * leg * math.sin(A) / math.pi


def leg_side(c, L, phi, mode, colf, hip=(0, 990)):
    """Нога в профиль. phi — фаза этой ноги. Бедро вперёд при sin>0, колено сгибается в фазе переноса."""
    A, K = GAIT.get(mode, (0, 0))
    th = A * math.sin(phi)
    swing = max(0.0, math.cos(phi))
    kn = 0.08 + K * swing ** 1.3 + (0.35 if mode == "sneak" else 0)
    knee = rot((hip[0], hip[1] + 340), -th, hip)
    ank = rot((knee[0], knee[1] + 330), -th + kn, knee)
    limb(c, hip, knee, 116, 98, colf(L.pants))
    limb(c, knee, ank, 98, 72, colf(L.pants))
    if L.top == "track":
        edge_line(c, hip, knee, 116, 98, -1, colf(L.accent), 6)
        edge_line(c, knee, ank, 98, 72, -1, colf(L.accent), 6)
    toe_up = -0.25 * max(0, math.sin(phi)) * (A > 0) + 0.3 * swing * (A > 0) * 0.5
    sh_ = L.shoes
    shoe(c, Look(**{**L.__dict__, "shoes": colf(sh_), "sneaker_accent": colf(L.sneaker_accent)}), (ank[0] - 10, ank[1] + 4), "side", tilt=-toe_up)


def arm_side(c, L, phi, mode, colf, pose=None, prop=None, shp=(10, 300)):
    A, K = GAIT.get(mode, (0, 0))
    if pose:
        a1, a2 = math.radians(pose[0]), math.radians(pose[1])
        el = rot((shp[0], shp[1] + 300), -a1, shp)
        wr = rot((el[0], el[1] + 280), -a1 - a2, el)
    else:
        sw = -0.9 * A * math.sin(phi)            # рука противоположна ноге
        bend = 0.25 + (1.2 if mode == "run" else 0.35) * max(0, -math.sin(phi)) + (0.9 if mode == "run" else 0)
        el = rot((shp[0], shp[1] + 300), sw, shp)
        wr = rot((el[0], el[1] + 280), sw - bend, el)
    limb(c, shp, el, 84, 74, colf(L.top_col))
    limb(c, el, wr, 74, 64, colf(L.top_col))
    if L.top == "track":
        edge_line(c, shp, el, 84, 74, -1, colf(L.accent), 5)
        edge_line(c, el, wr, 74, 64, -1, colf(L.accent), 5)
    skin = (30, 30, 30, 255) if L.top == "hazmat" else ((50, 40, 30, 255) if L.top == "fire" else L.skin)
    ang = math.atan2(wr[0] - el[0], wr[1] - el[1])
    if prop:
        prop(c, wr, ang)
    hand(c, wr, colf(skin), 38, ang, fist=prop is not None, side=-1)


# --- вид спереди -----------------------------------------------------------
def legs_front(c, L, mode="stand", phase=0.0, sit=None, spread=0.0, view="front"):
    pc = L.pants
    hip_y = 980
    for s in (-1, 1):
        hx = s * 56 * L.width
        if mode == "sit":
            knee, ankle = sit[s]
            limb(c, knee, ankle, 100, 72, sh(pc, 0.8))
            limb(c, (hx, hip_y), knee, 124, 140, pc)
            limb(c, (hx, hip_y - 4), (knee[0], knee[1] - 22), 70, 60, sh(pc, 1.14))
            c.ell((knee[0] - 54, knee[1] - 40, knee[0] + 54, knee[1] + 40), sh(pc, 1.06))
            c.ell((knee[0] - 30, knee[1] - 30, knee[0] + 30, knee[1] + 6), sh(pc, 1.2))
            if L.top == "track":
                c.line([(ankle[0] + s * 34, ankle[1] - 20), (knee[0] + s * 50, knee[1] + 10)], L.accent, 6)
            shoe(c, L, ankle, "front")
            continue
        A, K = GAIT.get(mode, (0, 0))
        phi = phase + (0 if s < 0 else math.pi)
        swing = max(0.0, math.cos(phi)) * (A > 0)
        fwd = math.sin(phi) * A        # нога впереди -> стопа ниже в кадре (ближе к камере)
        if view == "back":
            fwd = -fwd
        lift = swing * K * 70
        knee = (hx + s * 4, hip_y + 340 - lift * 0.7 + max(0, fwd) * 20)
        ankle = (hx + s * (14 + spread), 1660 - lift + fwd * 60)
        limb(c, (hx, hip_y), knee, 116, 98, pc)
        limb(c, knee, ankle, 98, 72, pc)
        if L.top == "track":
            edge_line(c, (hx, hip_y), knee, 116, 98, s, L.accent, 6)
            edge_line(c, knee, ankle, 98, 72, s, L.accent, 6)
        shoe(c, L, ankle, view)


def _arm(c, L, p, i, s, arms, hs, wrists, view="front"):
    sw = 150 * L.width * (0.9 if L.female else 1.0)
    shp = (s * (sw - 14), 300)
    l1, l2 = 300 * (0.9 if L.female else 1), 280 * (0.9 if L.female else 1)
    mode = p.get("legs", "stand")
    if isinstance(arms[i], dict):
        tg = arms[i]["ik"]
        a0 = math.atan2(tg[0] - shp[0], tg[1] - shp[1])
        el, wr, ang = arm_ik(shp, (tg[0] - math.sin(a0) * 30, tg[1] - math.cos(a0) * 30), s, l1, l2)
    else:
        a_sh, a_el = arms[i]
        A = GAIT.get(mode, (0, 0))[0]
        if A > 0 and not p.get("no_swing"):
            # качание вперёд-назад: в кадре рука чуть короче/длиннее и кисть выше/ниже, а не в стороны
            phi = p.get("phase", 0.0) + (math.pi if s < 0 else 0)
            fw = math.sin(phi) * A
            if view == "back":
                fw = -fw
            a_el = a_el + max(0, fw) * (70 if mode == "run" else 40)
            l2 = l2 * (1 - 0.18 * max(0, fw))
        el, wr, ang = arm_points(shp, a_sh, a_el, s, l1, l2)
    k = hs[i]
    sleeve = L.top_col
    limb(c, shp, el, 86 * L.width, 76 * L.width, sleeve)
    limb(c, el, wr, 76 * L.width * (0.7 + 0.3 * k), 66 * L.width * k, sleeve)
    if L.top == "track":
        edge_line(c, shp, el, 86 * L.width, 76 * L.width, s, L.accent, 5)
        edge_line(c, el, wr, 76 * L.width, 66 * L.width * k, s, L.accent, 5)
    c.circ(wr[0], wr[1], 34 * L.width * k, sh(sleeve, 0.8))
    skin = (30, 30, 30, 255) if L.top == "hazmat" else ((50, 40, 30, 255) if L.top == "fire" else L.skin)
    hp = (wr[0] + math.sin(ang) * 22 * k, wr[1] + math.cos(ang) * 22 * k)
    wrists[s] = (hp, ang)
    prop = p.get("props", {}).get(s)
    hm = p.get("hand_mode", {}).get(s)
    if prop is not None and getattr(prop, "under_hand", True):
        prop(c, hp, ang)
    if p.get("palm", (False, False))[i]:
        palm(c, hp, skin, 40 * k)
    else:
        hand(c, hp, skin, 40 * k, ang, fist=prop is not None, side=s, mode=hm)
    if prop is not None and not getattr(prop, "under_hand", True):
        prop(c, hp, ang)


def front(c, L, p=None):
    """p: face, arms=((a_sh,a_el)|{'ik':(x,y)}, ...) для левой/правой стороны кадра, legs, phase, sit, props, palm, hand_mode,
    hand_scale, arms_behind, face_first (лицо под руками — для микрофона у рта), breath."""
    p = p or {}
    face = p.get("face", {})
    turn = face.get("turn", 0.0)
    A = GAIT.get(p.get("legs", "stand"), (0, 0))[0]
    bob = abs(math.sin(p.get("phase", 0.0))) * 14 * A / 0.42 if A > 0 else 0.0
    hair_back(c, L)
    if L.top == "hazmat":
        hats(c, L)
    legs_front(c, L, p.get("legs", "stand"), p.get("phase", 0.0), p.get("sit"), p.get("spread", 0.0))
    u = c.sub(0, bob, 1.0) if bob else c
    arms = p.get("arms", ((8, 10), (8, 10)))
    behind = p.get("arms_behind", (False, False))
    hs = p.get("hand_scale", (1.0, 1.0))
    wrists = {}
    for i, s in enumerate((-1, 1)):
        if behind[i]:
            _arm(u, L, p, i, s, arms, hs, wrists)
    neck(u, L)
    torso(u, L, "front", p.get("breath", 0.0), sitting=p.get("legs") == "sit")
    ff = p.get("face_first", False)
    if ff and "hood" not in L.extras:
        face_front(u, L, face)
        hair_front(u, L, turn)
    for i, s in enumerate((-1, 1)):
        if not behind[i]:
            _arm(u, L, p, i, s, arms, hs, wrists)
    if not ff and "hood" not in L.extras:
        face_front(u, L, face)
        hair_front(u, L, turn)
    hats(u, L)
    return wrists


def back(c, L, p=None):
    p = p or {}
    mode = p.get("legs", "stand")
    A = GAIT.get(mode, (0, 0))[0]
    bob = abs(math.sin(p.get("phase", 0.0))) * 14 * A / 0.42 if A > 0 else 0.0
    if L.hair_style == "ponytail":
        pass
    legs_front(c, L, mode, p.get("phase", 0.0), None, 0.0, view="back")
    u = c.sub(0, bob, 1.0) if bob else c
    arms = p.get("arms", ((8, 6), (8, 6)))
    behind = p.get("arms_behind", (False, False))
    hs = p.get("hand_scale", (1.0, 1.0))
    wrists = {}
    for i, s in enumerate((-1, 1)):
        if behind[i]:
            _arm(u, L, p, i, s, arms, hs, wrists, view="back")
    neck(u, L)
    torso(u, L, "back")
    for i, s in enumerate((-1, 1)):
        if not behind[i]:
            _arm(u, L, p, i, s, arms, hs, wrists, view="back")
    head_back(u, L, p)
    return wrists


# --- вид сбоку (лицом вправо) ---------------------------------------------
def side(c, L, p=None):
    p = p or {}
    mode = p.get("legs", "stand")
    ph = p.get("phase", 0.0)
    A, K = GAIT.get(mode, (0, 0))
    blink = p.get("blink", 0.0)
    mouth = p.get("mouth", 0.0)
    far = lambda col: sh(col, 0.74)
    near = lambda col: col
    bob = abs(math.sin(ph)) * 16 * (A / 0.42) if A > 0 else 0.0
    lean = {"run": 46, "sneak": 20}.get(mode, 0)
    hip = (0, 990 + bob)
    u = c.sub(0, bob, 1.0)
    up = u.sub(lean * 0.3, 0, 1.0) if lean else u     # верх корпуса чуть вперёд при беге
    # дальние рука и нога (темнее), затем корпус, затем ближние
    arm_side(up, L, ph + math.pi, mode, far, p.get("arm_far"), None)
    leg_side(c, L, ph + math.pi, mode, far, hip)
    col = L.top_col
    hem = 1120 if L.top in ("coat", "mama", "doctor", "fire") else (1060 if L.top == "hazmat" else 1020)
    if L.female and L.top in ("coat", "mama"):
        body = [(-70, 282), (30, 262), (80, 320), (96, 460), (84, 600), (100, 820), (104, hem), (-86, hem), (-92, 820), (-74, 600), (-88, 420), (-86, 330)]
    else:
        body = [(-72, 282), (30, 262), (82, 310), (98, 470), (92, 640), (84, hem), (-80, hem), (-88, 640), (-94, 440), (-86, 330)]
    up.poly(body, col, smooth=True)
    up.poly([(-72, 282), (-30, 270), (-40, 600), (-80, hem), (-88, 640), (-94, 440), (-86, 330)], sh(col, 0.88)[:3] + (150,), smooth=True)
    t = L.top
    if t == "hazmat":
        up.rect((-160, 340, -80, 740), (190, 190, 196, 255), r=36)
        for y in (520, 800):
            up.rect((-88, y, 98, y + 30), (200, 200, 200, 255))
    elif t == "fire":
        for y in (560, 960):
            up.rect((-84, y, 96, y + 34), (220, 220, 90, 255))
    elif t == "uniform":
        up.rect((-86, 940, 96, 1000), (16, 16, 20, 255))
        up.rect((-64, 960, 6, 1100), (16, 16, 20, 255), r=10)
        up.rect((40, 380, 96, 450), sh(col, 0.8), r=6)
        up.poly([(66, 340), (80, 360), (66, 380), (52, 360)], (232, 192, 76, 255))
    elif t == "track":
        up.line([(30, 268), (40, hem - 10)], (200, 200, 210, 255), 4)
        up.rect((-82, hem - 40, 86, hem), sh(col, 0.8), r=8)
    elif t == "hoodie":
        up.ell((-110, 240, 0, 360), sh(col, 0.85))
        up.poly([(0, 760), (96, 760), (92, 900), (0, 900)], sh(col, 0.85))
    elif t == "coat":
        up.rect((-90, 620, 100, 664), sh(col, 0.75))
        up.poly([(30, 262), (70, 300), (60, 420)], (170, 160, 150, 255))
    elif t == "mama":
        up.poly([(-30, 250), (60, 260), (70, 330), (-20, 330)], (90, 140, 120, 255))
    elif t == "doctor":
        up.poly([(30, 262), (80, 310), (60, 400)], (120, 170, 220, 255))
    leg_side(c, L, ph, mode, near, hip)
    # голова в профиль
    hd = up
    hd.poly([(-34, 176), (40, 176), (46, 270), (-38, 270)], sh(L.skin, 0.84))
    if "hood" in L.extras:
        hd.ell((-110, -30, 130, 250), L.top_col)
        hd.ell((10, 40, 140, 200), (30, 40, 50, 255))
        hd.ell((40, 50, 120, 110), (150, 190, 210, 120))
        hd.circ(110, 220, 34, (40, 40, 44, 255))
    else:
        hair_side_back(hd, L, p)
        head = [(-92, 70), (-74, 14), (-20, -6), (40, 0), (82, 34), (98, 78), (102, 104), (122, 134), (106, 146), (108, 160), (104, 172), (100, 196), (78, 218),
                (30, 226), (-20, 212), (-62, 186), (-90, 136)]
        hd.poly(head, L.skin, smooth=True, n=12)
        hd.ell((-30, 94, 6, 162), sh(L.skin, 0.84))
        hd.ell((-20, 108, -2, 148), sh(L.skin, 0.72))
        hd.ell((20, 196, 90, 226), sh(L.skin, 0.92)[:3] + (90,))
        if blink > 0.6:
            hd.line([(62, 108), (86, 110)], sh(L.skin, 0.5), 4)
        else:
            hd.poly([(60, 102), (88, 98), (92, 112), (64, 116)], (250, 248, 244, 255), smooth=True)
            hd.circ(82, 106, 7.5, L.eyes)
            hd.circ(84, 106, 3.5, (16, 14, 14, 255))
            hd.line([(58, 100), (90, 96)], sh(L.skin, 0.5), 3)
        hd.line([(54, 84), (96, 80)], sh(L.hair, 0.9) if L.hair_style != "none" else sh(L.skin, 0.6), 6)
        if mouth > 0.07:
            hd.ell((88, 160, 106, 170 + 16 * mouth), (70, 20, 26, 255))
        else:
            hd.line([(90, 172), (106, 170)], (180, 70, 76, 255) if "lipstick" in L.extras else sh(L.skin, 0.6), 4)
        if "mole" in L.extras:
            hd.circ(62, 160, 4, (90, 50, 40, 255))
        if "freckles" in L.extras:
            for k in range(4):
                hd.circ(60 + k * 8, 140 + (k % 2) * 6, 2.5, (170, 100, 60, 200))
        if "mustache" in L.extras:
            hd.poly([(80, 150), (112, 148), (108, 162), (80, 164)], sh(L.hair, 0.9))
        if "earrings" in L.extras:
            hd.circ(-12, 168, 7, (230, 200, 90, 255))
        hair_side_front(hd, L)
        if "cap" in L.extras:
            hd.poly([(-96, 60), (-90, 0), (-20, -30), (70, -20), (100, 20), (96, 60)], (22, 28, 52, 255), smooth=True)
            hd.poly([(70, 50), (150, 60), (140, 80), (60, 74)], (10, 10, 14, 255))
            hd.poly([(60, 0), (76, 18), (60, 36), (44, 18)], (220, 180, 70, 255))
        if "helmet" in L.extras:
            hd.ell((-120, -40, 120, 110), (200, 150, 30, 255))
            hd.poly([(-150, 80), (-120, 60), (140, 70), (170, 96), (-150, 100)], (180, 130, 20, 255))
        if "mask" in L.extras:
            hd.poly([(40, 140), (124, 132), (118, 200), (50, 206)], (150, 200, 220, 255), smooth=True)
    arm_side(up, L, ph, mode, near, p.get("arm"), p.get("prop"))


def hair_side_back(c, L, p=None):
    st = L.hair_style
    hc = L.hair
    if st == "ponytail":
        sway = (p or {}).get("tail", 0.0)
        c.ell((-104, -22, 94, 176), hc)
        c.line([(-94, 90), (-150 - sway * 20, 210), (-140 - sway * 40, 340)], hc, 48, smooth=True)
        c.ell((-114, 76, -84, 110), (200, 40, 70, 255))
    elif st == "curly":
        for k in range(8):
            a = math.pi * (0.2 + k / 7 * 1.0)
            c.circ(-10 + math.cos(a) * 96, 80 - math.sin(a) * 86, 36, hc)
        c.ell((-120, 60, 20, 200), hc)
    elif st == "medium":
        c.poly([(-108, 170), (-112, 40), (-70, -14), (10, -26), (70, -10), (96, 30), (-40, 80), (-60, 190)], hc, smooth=True)
    elif st in ("short", "slick", "messy"):
        c.ell((-100, -14, 84, 150), hc)


def hair_side_front(c, L):
    st = L.hair_style
    hc = L.hair
    if st == "short":
        c.poly([(-96, 100), (-90, 10), (-20, -18), (60, -8), (96, 40), (70, 34), (20, 30), (-30, 50), (-40, 110)], hc, smooth=True)
    elif st == "medium":
        c.poly([(-104, 160), (-100, 20), (-40, -22), (40, -16), (90, 16), (104, 62), (80, 70), (60, 50), (20, 46), (-20, 70), (-34, 150)], hc, smooth=True)
        c.line([(-40, 0), (40, 6), (84, 40)], sh(hc, 1.3), 5, smooth=True)
    elif st == "slick":
        c.poly([(-96, 100), (-90, 10), (-20, -18), (60, -10), (94, 30), (40, 26), (-40, 40), (-50, 110)], hc, smooth=True)
    elif st == "messy":
        c.poly([(-100, 110), (-96, 10), (-40, -30), (0, -14), (40, -34), (80, -6), (104, 44), (60, 40), (20, 50), (-30, 54), (-44, 120)], hc, smooth=True)
    elif st == "ponytail":
        c.poly([(-90, 110), (-90, 10), (-20, -20), (60, -10), (96, 50), (60, 36), (10, 30), (-40, 60), (-50, 120)], hc, smooth=True)
    elif st == "curly":
        for k in range(6):
            c.circ(-60 + k * 28, -2 + (k % 2) * 10, 30, hc)
