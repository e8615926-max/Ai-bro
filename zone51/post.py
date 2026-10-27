"""Оверлеи эфира, субтитры, помехи, кинескоп, зерно."""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from gfx import Cv, to_im, font, FONT_B, FONT_C, FONT_R, ease, alpha_over, vgrad
from studio import draw_overlays, logo
import timeline as TL
from lines import SPEAKERS

W, H = 1080, 1920
_rng = np.random.default_rng(0)
GRAIN = [(_rng.standard_normal((H // 2, W // 2)).astype(np.float32)) for _ in range(6)]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIG = np.clip(1 - 0.45 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) ** 1.4, 0, 1)[..., None].astype(np.float32)
SCAN = (1 - 0.10 * (np.arange(H) % 4 < 2).astype(np.float32))[:, None, None]
del yy, xx


def grain(out, i, k=0.035):
    g = GRAIN[i % len(GRAIN)]
    g = np.asarray(Image.fromarray(((g * 0.25 + 0.5) * 255).clip(0, 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), np.float32) / 255 - 0.5
    out += g[..., None] * k * 4
    return out


def crt(out, k=1.0):
    """Лёгкий эффект кинескопа для «телевизионной» картинки."""
    o = out * (1 - (1 - SCAN) * k)
    o[..., 0] = np.roll(o[..., 0], 2, 1)
    o[..., 2] = np.roll(o[..., 2], -2, 1)
    return o


def vignette(out, k=1.0):
    return out * (1 - (1 - VIG) * k)


def field_overlays(t, show_lower=None):
    c = Cv(W, H, 1)
    draw_overlays(c, t, 0, t - 12)
    # камера оператора
    on = (t % 1.0) < 0.6
    if on:
        c.circ(56, 186, 12, (230, 30, 30, 255))
    c.text((78, 186), "REC", 28, (255, 255, 255, 230), FONT_C, anchor="lm")
    tc = max(0.0, t - 25)
    c.text((150, 186), "%02d:%02d:%02d" % (int(tc // 60), int(tc % 60), int((tc * 30) % 30)), 26, (255, 255, 255, 210), FONT_C, anchor="lm")
    for (x, y, dx, dy) in ((40, 230, 1, 1), (1040, 230, -1, 1), (40, 1780, 1, -1), (1040, 1780, -1, -1)):
        c.line([(x, y + dy * 70), (x, y), (x + dx * 70, y)], (255, 255, 255, 170), 4, joint=None)
    if show_lower is not None and show_lower > 0:
        a = int(255 * min(1, show_lower))
        x = -700 * (1 - ease(min(1, show_lower)))
        c.rect((40 + x, 1380, 840 + x, 1448), (200, 20, 30, a))
        c.rect((40 + x, 1448, 840 + x, 1494), (245, 245, 250, a))
        c.text((60 + x, 1414), "ЭЛЛИ · С МЕСТА СОБЫТИЙ", 38, (255, 255, 255, a), FONT_C, anchor="lm")
        c.text((60 + x, 1471), "ЗОНА 51, НЕВАДА · ПРЯМОЙ ЭФИР", 26, (20, 30, 60, a), FONT_C, anchor="lm")
    return c.im


# --- субтитры ------------------------------------------------------------
SUB_FONT = 54
_sub_cache = {}


def wrap(text, f, maxw):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if f.getlength(test) <= maxw or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def pages_for(lid):
    if lid in _sub_cache:
        return _sub_cache[lid]
    spk, text = TL.SUBS[lid]
    f = font(SUB_FONT, FONT_B)
    lines = wrap(text, f, 900)
    pages = [lines[i:i + 2] for i in range(0, len(lines), 2)]
    lens = [sum(len(l) for l in p) for p in pages]
    _sub_cache[lid] = (spk, pages, lens)
    return _sub_cache[lid]


def subtitles(t, y_center=1650):
    sp = TL.speaking(t)
    # держим субтитр чуть дольше реплики
    if not sp:
        for lid, (s, d) in TL.LINE.items():
            if s + d <= t < s + d + 0.25:
                sp = (lid, d - 0.001)
        if not sp:
            return None
    lid, lt = sp
    spk, pages, lens = pages_for(lid)
    d = TL.LINE[lid][1]
    tot = sum(lens)
    acc = 0
    pi = 0
    for i, L in enumerate(lens):
        if lt < (acc + L) / tot * d:
            pi = i
            break
        acc += L
    else:
        pi = len(pages) - 1
        acc = tot - lens[-1]
    page = pages[pi]
    p0 = acc / tot * d
    p1 = (acc + lens[pi]) / tot * d
    prog = (lt - p0) / max(0.01, p1 - p0)
    info = SPEAKERS[spk]
    f = font(SUB_FONT, FONT_B)
    fn = font(34, FONT_C)
    c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(c)
    lh = 68
    n = len(page)
    top = y_center - (n * lh) / 2
    # плашка
    wmax = max(f.getlength(l) for l in page)
    name = info["name"].upper()
    nw = fn.getlength(name) + 36
    box = [W / 2 - wmax / 2 - 30, top - 14, W / 2 + wmax / 2 + 30, top + n * lh + 10]
    dr.rounded_rectangle(box, radius=22, fill=(0, 0, 0, 150))
    nb = [box[0], box[1] - 50, box[0] + nw, box[1] - 4]
    dr.rounded_rectangle(nb, radius=12, fill=info["color"] + (235,))
    dr.text((nb[0] + 18, (nb[1] + nb[3]) / 2), name, font=fn, fill=(10, 10, 16, 255), anchor="lm")
    # слова: текущее выделено цветом говорящего
    allw = [w for l in page for w in l.split()]
    chars = sum(len(w) + 1 for w in allw)
    cur_c = prog * chars
    acc_c = 0
    for li, line in enumerate(page):
        y = top + li * lh + lh / 2
        x = W / 2 - f.getlength(line) / 2
        for w in line.split():
            start = acc_c
            acc_c += len(w) + 1
            spoken = cur_c >= start
            col = (255, 255, 255, 255) if spoken else (255, 255, 255, 150)
            if start <= cur_c < acc_c:
                col = info["color"] + (255,)
            dr.text((x, y), w, font=f, fill=col, anchor="lm", stroke_width=3, stroke_fill=(0, 0, 0, 200))
            x += f.getlength(w + " ")
    return c


def title_card(text, sub, a, y=300):
    c = Cv(W, H, 1)
    al = int(255 * a)
    c.text((W / 2, y), text, 64, (255, 240, 220, al), FONT_C, anchor="mm")
    if sub:
        c.text((W / 2, y + 70), sub, 34, (220, 210, 200, int(al * 0.85)), FONT_R, anchor="mm")
    return c.im


# --- помехи и «эфир прерван» -------------------------------------------------
def static_noise(t, seed):
    r = np.random.default_rng(seed)
    n = r.random((H // 3, W // 3), dtype=np.float32)
    n = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((W, H), Image.NEAREST), np.float32) / 255
    band = ((np.arange(H) + int(t * 900)) % 300 < 40).astype(np.float32)[:, None] * 0.25
    v = np.clip(n * 0.9 + band, 0, 1)
    return np.repeat(v[..., None], 3, 2)


def glitch(img, t, seed, k=1.0):
    r = random.Random(seed)
    out = img.copy()
    for _ in range(int(14 * k)):
        y = r.randint(0, H - 60)
        h = r.randint(8, 90)
        dx = r.randint(-160, 160)
        out[y:y + h] = np.roll(out[y:y + h], dx, 1)
    out[..., 0] = np.roll(out[..., 0], int(12 * k), 1)
    out[..., 2] = np.roll(out[..., 2], -int(12 * k), 1)
    return out


def offair(t):
    bars = [(192, 192, 192), (192, 192, 0), (0, 192, 192), (0, 192, 0), (192, 0, 192), (192, 0, 0), (0, 0, 192)]
    c = Cv(W, H, 1, (0, 0, 0, 255))
    bw = W / 7
    for i, col in enumerate(bars):
        c.rect((i * bw, 0, (i + 1) * bw + 1, 1300), col + (255,))
    for i, col in enumerate(bars[::-1]):
        c.rect((i * bw, 1300, (i + 1) * bw + 1, 1420), (col[0] // 3, col[1] // 3, col[2] // 3, 255))
    c.rect((0, 1420, W, H), (16, 16, 20, 255))
    c.rect((90, 640, 990, 1020), (10, 10, 16, 235), r=24)
    logo(c, 540 - 150, 680, 1.0)
    c.text((540, 860), "ЭФИР ПРЕРВАН", 76, (255, 255, 255, 255), FONT_C, anchor="mm")
    c.text((540, 950), "Технические неполадки. Оставайтесь с нами.", 34, (220, 220, 230, 255), FONT_R, anchor="mm")
    return np.asarray(c.im.convert("RGB"), np.float32) / 255


# --- старый телевизор -------------------------------------------------------
def _barrel_maps(k=0.07):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    nx, ny = (xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)
    r2 = nx * nx + ny * ny
    f = 1 + k * r2
    sx = np.clip((nx * f * 0.965 + 1) * W / 2, 0, W - 1).astype(np.int32)
    sy = np.clip((ny * f * 0.965 + 1) * H / 2, 0, H - 1).astype(np.int32)
    # скруглённые углы кинескопа
    ax, ay = np.abs(nx * f * 0.965), np.abs(ny * f * 0.965)
    q = np.clip(((np.maximum(ax - 0.86, 0) / 0.14) ** 2 + (np.maximum(ay - 0.9, 0) / 0.1) ** 2), 0, 1)
    mask = np.clip((1 - q) * 6, 0, 1) * np.clip((1 - np.maximum(ax, ay)) * 40, 0, 1)
    return sx, sy, mask[..., None].astype(np.float32)


_BX, _BY, _BMASK = _barrel_maps()
_SCAN2 = (1 - 0.16 * (np.arange(H) % 3 == 0).astype(np.float32))[:, None, None]


def oldtv(out, t, i, k=1.0):
    """Эффект старого кинескопа: выпуклость, строки, ореол цвета, бегущая полоса, «снег», мерцание."""
    o = out[_BY, _BX]
    # ореол цвета (смещение и размытие каналов)
    r = (np.roll(o[..., 0], 3, 1) + np.roll(o[..., 0], 5, 1)) * 0.5
    b = (np.roll(o[..., 2], -3, 1) + np.roll(o[..., 2], -5, 1)) * 0.5
    o = np.stack([r, o[..., 1], b], -1)
    o = o * (1 - (1 - _SCAN2) * k)
    # бегущая полоса и мерцание
    y = int((t * 160) % (H + 300)) - 150
    y0, y1 = max(0, y), min(H, y + 110)
    if y1 > y0:
        o[y0:y1] = o[y0:y1] * 1.06 + 0.025
    rnd = random.Random(i)
    o = o * (0.97 + 0.03 * rnd.random())
    # редкий сбой строки
    if rnd.random() < 0.06:
        yy = rnd.randint(0, H - 40)
        o[yy:yy + 20] = np.roll(o[yy:yy + 20], rnd.randint(-30, 30), 1)
    g = GRAIN[(i * 7) % len(GRAIN)]
    g = np.asarray(Image.fromarray(((g * 0.25 + 0.5) * 255).clip(0, 255).astype(np.uint8)).resize((W, H), Image.NEAREST), np.float32) / 255 - 0.5
    o += g[..., None] * 0.05 * k
    o = o * (1 - (1 - VIG) * 0.7) * _BMASK
    return o


# --- трещина стекла -----------------------------------------------------------
def _crack_img(cx=600, cy=760, seed=4):
    rnd = random.Random(seed)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for k in range(16):
        a = k / 16 * 2 * math.pi + rnd.uniform(-0.2, 0.2)
        x, y = cx, cy
        L = rnd.uniform(500, 1400)
        pts = [(x, y)]
        n = 9
        for j in range(n):
            a += rnd.uniform(-0.35, 0.35)
            x += math.cos(a) * L / n
            y += math.sin(a) * L / n
            pts.append((x, y))
            if rnd.random() < 0.35:   # ответвление
                b = a + rnd.choice((-1, 1)) * rnd.uniform(0.5, 1.0)
                d.line([(x, y), (x + math.cos(b) * 160, y + math.sin(b) * 160)], fill=(255, 255, 255, 150), width=2)
        d.line(pts, fill=(20, 20, 24, 220), width=6)
        d.line(pts, fill=(255, 255, 255, 220), width=2)
    for r in (40, 90, 150, 230):   # концентрические трещины
        pts = []
        for k in range(24):
            a = k / 24 * 2 * math.pi
            rr = r * rnd.uniform(0.85, 1.15)
            pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
        for k in range(24):
            if rnd.random() < 0.7:
                d.line([pts[k], pts[(k + 1) % 24]], fill=(255, 255, 255, 170), width=2)
    d.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], fill=(255, 255, 255, 90))
    return im


CRACK = _crack_img()


def watermark():
    c = Image.new("RGBA", (W, 120), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    f = font(34, "/usr/share/fonts/opentype/inter/InterDisplay-Light.otf")
    txt = "ELDAR COMPANY"
    sp = 9
    tw = sum(f.getlength(ch) for ch in txt) + sp * (len(txt) - 1)
    x = W / 2 - tw / 2
    y = 46
    for ch in txt:
        d.text((x, y), ch, font=f, fill=(255, 255, 255, 140), anchor="lm")
        x += f.getlength(ch) + sp
    d.line([(W / 2 - tw / 2 - 70, y), (W / 2 - tw / 2 - 18, y)], fill=(255, 255, 255, 110), width=2)
    d.line([(W / 2 + tw / 2 + 18, y), (W / 2 + tw / 2 + 70, y)], fill=(255, 255, 255, 110), width=2)
    d.ellipse([W / 2 - tw / 2 - 12, y - 3, W / 2 - tw / 2 - 6, y + 3], fill=(255, 255, 255, 140))
    d.ellipse([W / 2 + tw / 2 + 6, y - 3, W / 2 + tw / 2 + 12, y + 3], fill=(255, 255, 255, 140))
    return c


WATERMARK = watermark()
