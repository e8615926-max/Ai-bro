"""Базовые инструменты рисования: канва с логическими координатами, сплайны, свечения."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT_B = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
FONT_R = "/usr/share/fonts/opentype/inter/Inter-Medium.otf"
FONT_C = "/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf"
FONT_SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
_fonts = {}


def font(size, path=FONT_B):
    k = (path, int(size))
    if k not in _fonts:
        _fonts[k] = ImageFont.truetype(path, int(size))
    return _fonts[k]


def spline(pts, closed=True, n=10):
    """Catmull-Rom сплайн через точки -> гладкий полигон."""
    p = list(pts)
    if closed:
        p = [p[-1]] + p + [p[0], p[1]]
    else:
        p = [p[0]] + p + [p[-1]]
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    if not closed:
        out.append(p[-2])
    return out


class Cv:
    """RGBA-холст, рисование в логических координатах (масштаб s). Полупрозрачные заливки смешиваются."""

    def __init__(self, w, h, s=1.0, bg=(0, 0, 0, 0), ox=0.0, oy=0.0):
        self.w, self.h, self.s = w, h, s
        self.ox, self.oy = ox, oy   # смещение в пикселях
        self.sx, self.sy = s, s
        self.im = Image.new("RGBA", (max(1, int(w * s)), max(1, int(h * s))), bg)
        self.d = ImageDraw.Draw(self.im)

    def _op(self, fill, fn, pts=None):
        if fill is not None and len(fill) == 4 and fill[3] < 255:
            if pts:
                xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
                pad = 4
                x0, y0 = max(0, int(min(xs)) - pad), max(0, int(min(ys)) - pad)
                x1, y1 = min(self.im.width, int(max(xs)) + pad), min(self.im.height, int(max(ys)) + pad)
                if x1 <= x0 or y1 <= y0:
                    return
                tmp = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
                fn(ImageDraw.Draw(tmp), -x0, -y0)
                self.im.alpha_composite(tmp, (x0, y0))
            else:
                tmp = Image.new("RGBA", self.im.size, (0, 0, 0, 0))
                fn(ImageDraw.Draw(tmp), 0, 0)
                self.im.alpha_composite(tmp)
        else:
            fn(self.d, 0, 0)

    def P(self, pts):
        return [(x * self.sx + self.ox, y * self.sy + self.oy) for x, y in pts]

    def B(self, b):
        x0, x1 = sorted((b[0] * self.sx + self.ox, b[2] * self.sx + self.ox))
        y0, y1 = sorted((b[1] * self.sy + self.oy, b[3] * self.sy + self.oy))
        return [x0, y0, max(x1, x0 + 0.5), max(y1, y0 + 0.5)]

    def sub(self, x, y, sc, fx=1.0):
        """Локальная система координат: (0,0) -> (x,y) родителя, масштаб sc, fx — сжатие/отражение по X."""
        c = object.__new__(Cv)
        c.__dict__.update(self.__dict__)
        c.ox = self.ox + x * self.sx
        c.oy = self.oy + y * self.sy
        c.sx = self.sx * sc * fx
        c.sy = self.sy * sc
        c.s = abs(self.s * sc)
        return c

    @staticmethod
    def _sh(pts, ox, oy):
        return [(x + ox, y + oy) for x, y in pts]

    def poly(self, pts, fill, smooth=False, n=10):
        if smooth:
            pts = spline(pts, True, n)
        P = self.P(pts)
        self._op(fill, lambda d, ox, oy: d.polygon(self._sh(P, ox, oy), fill=fill), P)

    def line(self, pts, fill, width, smooth=False, joint="curve"):
        if smooth:
            pts = spline(pts, False, 10)
        P = self.P(pts)
        wpx = max(1, int(width * self.s))

        def fn(d, ox, oy):
            Q = self._sh(P, ox, oy)
            d.line(Q, fill=fill, width=wpx, joint=joint)
            if wpx > 3:
                r = wpx / 2
                for x, y in (Q[0], Q[-1]):
                    d.ellipse([x - r, y - r, x + r, y + r], fill=fill)
        bb = P + [(min(p[0] for p in P) - wpx, min(p[1] for p in P) - wpx), (max(p[0] for p in P) + wpx, max(p[1] for p in P) + wpx)]
        self._op(fill, fn, bb)

    def ell(self, b, fill, outline=None, width=0):
        B = self.B(b)
        self._op(fill, lambda d, ox, oy: d.ellipse([B[0] + ox, B[1] + oy, B[2] + ox, B[3] + oy], fill=fill, outline=outline,
                                                  width=int(width * self.s)), [(B[0], B[1]), (B[2], B[3])])

    def circ(self, x, y, r, fill, outline=None, width=0):
        self.ell((x - r, y - r, x + r, y + r), fill, outline, width)

    def rect(self, b, fill, r=0, outline=None, width=0):
        B = self.B(b)

        def fn(d, ox, oy):
            bb = [B[0] + ox, B[1] + oy, B[2] + ox, B[3] + oy]
            if r:
                d.rounded_rectangle(bb, radius=max(0, min(r * self.s, (bb[2] - bb[0]) / 2 - 0.5, (bb[3] - bb[1]) / 2 - 0.5)), fill=fill, outline=outline, width=int(width * self.s))
            else:
                d.rectangle(bb, fill=fill, outline=outline, width=int(width * self.s))
        self._op(fill, fn, [(B[0], B[1]), (B[2], B[3])])

    def arc(self, b, a0, a1, fill, width):
        B = self.B(b)
        self._op(fill, lambda d, ox, oy: d.arc([B[0] + ox, B[1] + oy, B[2] + ox, B[3] + oy], a0, a1, fill=fill,
                                              width=max(1, int(width * self.s))), [(B[0] - 4, B[1] - 4), (B[2] + 4, B[3] + 4)])

    def text(self, xy, txt, size, fill, path=FONT_B, anchor="la", **kw):
        self._op(fill, lambda d, ox, oy: d.text((xy[0] * self.s + self.ox + ox, xy[1] * self.s + self.oy + oy), txt, font=font(size * self.s, path),
                                               fill=fill, anchor=anchor, **kw))

    def layer(self):
        return Cv(self.w, self.h, self.s)

    def paste(self, other, blur=0, opacity=1.0, offset=(0, 0)):
        im = other.im
        if blur:
            im = im.filter(ImageFilter.GaussianBlur(blur * self.s))
        if opacity < 1:
            a = np.array(im)
            a[..., 3] = (a[..., 3] * opacity).astype(np.uint8)
            im = Image.fromarray(a)
        self.im.alpha_composite(im, (int(offset[0] * self.s), int(offset[1] * self.s)) if offset != (0, 0) else (0, 0)) \
            if min(offset) >= 0 else self.im.alpha_composite(im.crop((int(-min(0, offset[0]) * self.s), int(-min(0, offset[1]) * self.s), im.width, im.height)),
                                                             (int(max(0, offset[0]) * self.s), int(max(0, offset[1]) * self.s)))

    def result(self, scale_down=1):
        im = self.im
        if scale_down != 1:
            im = im.resize((int(im.width / scale_down), int(im.height / scale_down)), Image.LANCZOS)
        return im

    def silhouette(self, color=(0, 0, 0, 255)):
        """Копия-силуэт (для теней)."""
        c = self.layer()
        a = np.array(self.im)
        a[..., 0], a[..., 1], a[..., 2] = color[:3]
        a[..., 3] = (a[..., 3].astype(np.float32) * color[3] / 255).astype(np.uint8)
        c.im = Image.fromarray(a)
        c.d = ImageDraw.Draw(c.im)
        return c


def vgrad(w, h, stops):
    """Вертикальный градиент: stops = [(pos0..1, (r,g,b)), ...] -> float32 HxWx3 (0..1)."""
    y = np.linspace(0, 1, h)[:, None]
    out = np.zeros((h, 3), np.float32)
    ps = [s[0] for s in stops]
    for c in range(3):
        out[:, c] = np.interp(y[:, 0], ps, [s[1][c] / 255 for s in stops])
    return np.repeat(out[:, None, :], w, axis=1)


def radial(w, h, cx, cy, r, power=2.0):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
    return np.clip(1 - d, 0, 1) ** power


def to_f(im):
    return np.asarray(im.convert("RGB"), dtype=np.float32) / 255


def to_im(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))


def alpha_over(dst, src_rgba, x, y):
    """dst float HxWx3, src PIL RGBA, вставка в (x,y) с обрезкой."""
    s = np.asarray(src_rgba, dtype=np.float32) / 255
    h, w = s.shape[:2]
    H, W = dst.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return dst
    sp = s[y0 - y:y1 - y, x0 - x:x1 - x]
    a = sp[..., 3:4]
    dst[y0:y1, x0:x1] = dst[y0:y1, x0:x1] * (1 - a) + sp[..., :3] * a
    return dst


def add_over(dst, src, x, y, k=1.0):
    """аддитивно (float HxWx3 src)."""
    h, w = src.shape[:2]
    H, W = dst.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return dst
    dst[y0:y1, x0:x1] += src[y0 - y:y1 - y, x0 - x:x1 - x] * k
    return dst


def glow_sprite(r, color, power=2.2):
    g = radial(2 * r, 2 * r, r, r, r, power)
    return g[..., None] * np.array(color, np.float32)[None, None, :] / 255


def ease(t):
    t = min(1, max(0, t))
    return t * t * (3 - 2 * t)


def smooth_noise(t, seed=0, octaves=3):
    """Детерминированный 1D шум (для мерцания, тряски камеры)."""
    v = 0
    amp = 1
    tot = 0
    for o in range(octaves):
        f = 2 ** o
        x = t * f + seed * 17.123 + o * 3.7
        i = math.floor(x)
        fr = x - i
        a = math.sin(i * 12.9898 + seed * 78.233) * 43758.5453 % 1
        b = math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453 % 1
        u = fr * fr * (3 - 2 * fr)
        v += amp * (a + (b - a) * u)
        tot += amp
        amp *= 0.5
    return v / tot * 2 - 1
