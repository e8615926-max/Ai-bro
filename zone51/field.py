"""Полевые планы репортажа у Зоны 51."""
import math, random
import numpy as np
from PIL import Image, ImageFilter
from gfx import Cv, to_f, to_im, vgrad, radial, ease, smooth_noise, glow_sprite, add_over, alpha_over, font, FONT_C, FONT_B
import actors as A
import timeline as TL
from zone import Zone, W, H, HOR, police_car, news_van, _glow

AS = 2


def lerp(a, b, u):
    return a + (b - a) * u


class Layer:
    """Слой персонажей с освещением: рисуем в 2x, сводим, подсвечиваем контур."""

    def __init__(self):
        self.c = Cv(W, H, AS)
        self.glows = []

    def put(self, out, mult=(1, 1, 1), tint=(0, 0, 0), rim=(1.0, 0.55, 0.25), rim_k=0.9, rim_dirs=((0, 10, 1.0), (7, 0, 0.55), (-7, 0, 0.55))):
        im = self.c.im.reduce(AS)
        a4 = np.asarray(im, np.float32) / 255
        a = a4[..., 3]
        if a.max() <= 0:
            return out
        rgb = a4[..., :3]
        r = np.zeros_like(a)
        for d in rim_dirs:
            dx, dy = d[0], d[1]
            w = d[2] if len(d) > 2 else 1.0
            sh = np.roll(np.roll(a, dy, 0), dx, 1)
            r = np.maximum(r, a * (1 - sh) * w)
        r = np.asarray(Image.fromarray((r * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), np.float32) / 255 * a
        lit = rgb * np.array(mult, np.float32) + np.array(tint, np.float32) + r[..., None] * np.array(rim, np.float32) * rim_k
        a3 = a[..., None]
        out[:] = out * (1 - a3) + lit * a3
        return out

    def emit(self, out):
        for x, y, rad, col, k in self.glows:
            add_over(out, _glow(rad, col), int(x - rad), int(y - rad), k)


def camera(out, dx=0.0, dy=0.0, rot=0.0, zoom=1.0):
    if abs(dx) < 0.3 and abs(dy) < 0.3 and abs(rot) < 0.01 and abs(zoom - 1) < 0.001:
        return out
    im = to_im(out)
    z = zoom * (1 + abs(rot) * 0.012 + (abs(dx) + abs(dy)) / 900)
    a = math.radians(rot)
    ca, sa = math.cos(a) / z, math.sin(a) / z
    cx, cy = W / 2, H / 2
    # обратное аффинное преобразование
    m = (ca, sa, cx - ca * (cx + dx) - sa * (cy + dy), -sa, ca, cy + sa * (cx + dx) - ca * (cy + dy))
    im = im.transform((W, H), Image.AFFINE, m, Image.BILINEAR)
    return np.asarray(im, np.float32) / 255


def shake(t, amp, freq=1.0, seed=0):
    return (smooth_noise(t * 7 * freq, seed) * amp, smooth_noise(t * 7 * freq, seed + 5) * amp, smooth_noise(t * 5 * freq, seed + 9) * amp * 0.04)


def mutant_set(rnd, n, t0):
    ms = []
    for i in range(n):
        ms.append(dict(x=rnd.uniform(330, 800), spawn=t0 + i * 0.3 + rnd.uniform(0, 0.25), var=i % 3,
                       speed=rnd.uniform(26, 40), dx=rnd.uniform(-25, 25), ph=rnd.uniform(0, 6)))
    return ms


class Field:
    def __init__(self):
        self.z = Zone()
        rnd = random.Random(5)
        self.muts = mutant_set(rnd, 12, 0.0)
        self.debris = [(rnd.uniform(0, 2 * math.pi), rnd.uniform(150, 520), rnd.uniform(0.5, 1.0), rnd.random() < 0.5) for _ in range(90)]
        self.road = self._road()

    # ---------- задний план для бегства (камера смотрит от пожара) ----------
    def _road(self):
        rnd = random.Random(9)
        s = 2
        Wd, Hd = 1200, 2100
        c = Cv(Wd, Hd, s, (0, 0, 0, 255))
        sky = vgrad(Wd * s, 900 * s, [(0, (4, 6, 20)), (0.8, (14, 18, 40)), (1, (34, 30, 50))])
        c.im.paste(to_im(sky).convert("RGBA"), (0, 0))
        for _ in range(160):
            c.circ(rnd.uniform(0, Wd), rnd.uniform(0, 700), rnd.choice((1, 1.5, 2)), (255, 250, 240, rnd.randint(80, 230)))
        pts = [(0, 900)] + [(x, 860 - 40 * abs(math.sin(x * 0.006)) - 20 * rnd.random()) for x in range(0, Wd + 40, 40)] + [(Wd, 900)]
        c.poly(pts, (16, 14, 26, 255))
        for i in range(40):
            y0 = 900 + (i / 40) ** 1.5 * 1200
            y1 = 900 + ((i + 1) / 40) ** 1.5 * 1200
            v = i / 40
            c.rect((0, y0, Wd, y1 + 1), (int(30 + 90 * v ** 1.5), int(24 + 50 * v ** 1.5), int(26 + 20 * v), 255))
        c.poly([(580, 900), (620, 900), (1500, Hd), (-300, Hd)], (40, 34, 38, 255))
        for k in range(12):
            a = (k / 12) ** 1.7
            b = ((k + 0.45) / 12) ** 1.7
            ya, yb = 900 + a * 1200, 900 + b * 1200
            wa, wb = 2 + a * 28, 2 + b * 28
            c.poly([(600 - wa / 2, ya), (600 + wa / 2, ya), (600 + wb / 2, yb), (600 - wb / 2, yb)], (200, 170, 70, 255))
        for x in range(40, Wd, 120):   # огни шоссе вдали
            c.circ(x + rnd.uniform(-20, 20), 905, 3, (255, 220, 160, 255))
        self.road_lights = []
        self.road_lights += [(p, col, sc) for p, col, sc in police_car(c, 260, 1060, 0.7, 1)]
        self.road_lights += [(p, col, sc) for p, col, sc in police_car(c, 980, 1120, 0.85, -1)]
        news_van(c, 820, 990, 0.55)
        for _ in range(60):
            y = 920 + rnd.random() ** 1.4 * 1150
            x = rnd.uniform(0, Wd)
            if abs(x - 600) < 30 + (y - 900) * 0.8:
                continue
            r = 2 + (y - 900) / 1200 * 20
            c.ell((x - r * 1.4, y - r, x + r * 1.4, y), (30, 22, 20, 255))
        return to_f(c.result(s))

    # ---------------------------------------------------------------------
    def mouth(self, spk, t):
        return TL.mouth(spk, t)

    def report(self, t):
        lt = t - TL.SHOTS[3][1]
        z = self.z
        tl0, tl1 = TL.EVENTS["tilt0"], TL.EVENTS["tilt1"]
        u = ease((t - tl0) / (tl1 - tl0))
        Y0 = lerp(870, 330, u)
        dx, dy, rot = shake(t, 6, 0.5, 1)
        X0 = 0
        # врезка: Сэм зумит на пожарных у ворот
        cut = TL.LINE["l4"][0] + 0.6 < t < TL.LINE["l4"][0] + TL.LINE["l4"][1] - 0.3
        if cut:
            ct = t - TL.LINE["l4"][0] - 0.6
            k = 2.3 + 0.25 * ct / 5
            X0, Y0c = 640 - W / k / 2, 1000 - 1060 / k
            out = z.view(t, X0, Y0c, k)
            z.light_glows(out, t, X0, Y0c, k)
            out = self.small_figures(out, t, X0, Y0c, k, rescue=True)
            return camera(out, dx * 1.5, dy * 1.5, rot)
        k = 1.0
        out = z.view(t, X0, Y0, k)
        z.light_glows(out, t, X0, Y0, k)
        L = Layer()
        turn = (t - TL.EVENTS["turn"]) / 0.5
        breath = math.sin(t * 1.7) * 4
        if turn < 0:
            e = L.c.sub(600, 640 - Y0 + breath, 1.0)
            A.elli_front(e, t)
        else:
            p = min(1, turn)
            fx = abs(math.cos(p * math.pi)) * 0.94 + 0.06
            e = L.c.sub(600, 640 - Y0 + breath, 1.0, fx)
            if p < 0.5:
                A.elli_front(e, t)
            else:
                A.elli_back(e, t, walk=max(0, turn - 1) * 6)
        tint = z.flash_tint(t)
        L.put(out, mult=(0.36, 0.3, 0.32), tint=tint * 0.8, rim_k=1.0)
        return camera(out, dx, dy, rot)

    def small_figures(self, out, t, X0, Y0, k, rescue=False, attack=0.0):
        """Мелкие фигурки у ворот: пожарные/врачи, позже — бегущие и стреляющие полицейские."""
        L = Layer()
        if rescue:
            for i, (wx, ph) in enumerate(((470, 0), (520, 1.5), (610, 3))):
                x = (wx + 20 * math.sin(t * 0.8 + ph) - X0) * k
                y = (1010 - Y0) * k
                A.cop_small(L.c.sub(x, y - 60 * k, 0.06 * k), "run", t + ph)
        L.put(out, mult=(0.5, 0.42, 0.42), tint=self.z.flash_tint(t) * 0.6, rim_k=0.8)
        return out

    def walk(self, t):
        E0 = TL.SHOTS[4][1]
        lt = t - E0
        z = self.z
        k = 1.15 + 0.32 * ease(lt / 5.5)
        stop = TL.EVENTS["clark_in"] + 1.1
        walking = t < stop
        bob = math.sin(lt * 2 * math.pi * 1.6) * 10 if walking else 0
        X0 = 540 - W / k / 2 + 6 * math.sin(lt * 1.3)
        Y0 = HOR - 820 / k
        out = z.view(t, X0, Y0, k)
        z.light_glows(out, t, X0, Y0, k)
        L = Layer()
        # Кларкс выходит справа
        ci = TL.EVENTS["clark_in"]
        if t > ci - 0.2:
            u = ease((t - ci) / 1.1)
            cx = lerp(1400, 730, u)
            cb = abs(math.sin((t - ci) * 7)) * 12 * (1 - u)
            pose = "stop" if t > TL.LINE["c1"][0] + 0.4 else "idle"
            A.clark_front(L.c.sub(cx, 700 - cb, 0.6), t, self.mouth(["cop"], t), pose)
        ph = lt * 2 * math.pi * 1.6 if walking else 0
        A.elli_back(L.c.sub(410, 650 + bob * 0.3, 0.72), t, walk=ph)
        L.put(out, mult=(0.4, 0.33, 0.35), tint=z.flash_tint(t) * 0.9, rim_k=1.0)
        dx, dy, rot = shake(t, 7, 0.6, 2)
        return camera(out, dx, dy + bob, rot)

    # --- общий для перепалки и взрыва: персонажи в «мировых» координатах ---
    def _fg_cam(self, k):
        X0 = 560 - W / k / 2
        Y0 = HOR - 980 / k
        return X0, Y0

    def standoff(self, t):
        F0 = TL.SHOTS[5][1]
        lt = t - F0
        k = 1.9 + 0.28 * ease(lt / 18)
        z = self.z
        X0, Y0 = self._fg_cam(k)
        out = z.view(t, X0, Y0, k, blur=1.0)
        z.light_glows(out, t, X0, Y0, k, 1.3)
        self.draw_fg(out, t, k, X0, Y0, clark="front")
        dx, dy, rot = shake(t, 5, 0.5, 3)
        if TL.LINE["c4"][0] < t:
            dx, dy, rot = shake(t, 12, 1.4, 3)
        return camera(out, dx, dy, rot)

    def draw_fg(self, out, t, k, X0, Y0, clark="front", boom=None, aim_t=None, k0=1.9):
        """Кларкс и Элли на переднем плане; их «мировые» якоря рассчитаны от кадра k0."""
        X0r, Y0r = self._fg_cam(k0)
        cwx, cwy, csc = X0r + 600 / k0, Y0r + 340 / k0, 1.05 / k0
        ewx, ewy, esc = X0r + 120 / k0, Y0r + 760 / k0, 1.15 / k0
        Lc = Layer()
        sp = self.mouth(["cop", "clark"], t)
        pose, anger, reach = "idle", 0.0, 0.0
        if TL.LINE["c3"][0] - 0.2 < t < TL.LINE["c3"][0] + TL.LINE["c3"][1] + 0.3:
            pose, anger = "stop", 1.0
        if t > TL.LINE["c4"][0]:
            pose, anger = "stop", 1.0
            reach = ease((t - TL.LINE["c4"][0]) / TL.LINE["c4"][1])
        cx, cy, sc = (cwx - X0) * k, (cwy - Y0) * k, csc * k
        if clark == "front":
            A.clark_front(Lc.c.sub(cx, cy, sc), t, sp, pose, anger, reach)
        else:
            self._clark_turn(Lc, t, cx, cy, sc, boom, aim_t)
        Le = Layer()
        A.elli_back(Le.c.sub((ewx - X0) * k, (ewy - Y0) * k, esc * k), t, mic=True)
        tint = self.z.flash_tint(t)
        Lc.put(out, mult=(0.78, 0.62, 0.62), tint=tint * 1.2, rim_k=0.9)
        Le.put(out, mult=(0.26, 0.22, 0.24), tint=tint * 0.5, rim_k=1.0)
        Lc.emit(out)
        return out

    def _clark_turn(self, L, t, cx, cy, sc, b, aim_t):
        if b < 0.5:
            A.clark_front(L.c.sub(cx, cy, sc), t, 0.9, "idle", 0.0)
            return
        p = min(1, (b - 0.5) / 0.4)
        fx = abs(math.cos(p * math.pi)) * 0.94 + 0.06
        if p < 0.5:
            A.clark_front(L.c.sub(cx, cy, sc, fx), t, 0.9, "idle")
            return
        pose = "idle"
        recoil = 0.0
        if b > TL.EVENTS["draw"] - TL.EVENTS["boom"]:
            pose = "draw"
        if b > TL.EVENTS["shots0"] - TL.EVENTS["boom"] - 0.3:
            pose = "aim"
            st = (b - (TL.EVENTS["shots0"] - TL.EVENTS["boom"])) % 0.34
            if b > TL.EVENTS["shots0"] - TL.EVENTS["boom"]:
                recoil = max(0, 1 - st / 0.12)
                if st < 0.05:
                    L.glows.append((cx + 165 * sc, cy + 200 * sc, int(170 * sc + 20), (255, 230, 150), 1.3))
                    L.glows.append((cx + 165 * sc, cy + 200 * sc, int(600 * sc), (255, 160, 60), 0.5))
        A.clark_back(L.c.sub(cx, cy, sc, fx), t, pose, recoil)

    def mutants_draw(self, L, t, tb, X0, Y0, k, closer=0.0):
        """Мутанты выходят из огня. tb — время после взрыва."""
        for m in self.muts:
            age = tb - (TL.EVENTS["mutants"] - TL.EVENTS["boom"]) - m["spawn"]
            if age < 0:
                continue
            prog = age * m["speed"] + closer
            wy = 1020 + prog * 1.2
            hw = 120 + prog * 1.1       # высота в ед. мира
            wx = m["x"] + m["dx"] * age
            x, y = (wx - X0) * k, (wy - hw - Y0) * k
            sc = hw / 1000 * k
            e = A.mutant(L.c.sub(x, y, sc), t, m["var"], walk=t * 6 + m["ph"])
            for ex, ey in e:
                L.glows.append((x + ex * sc, y + ey * sc, max(8, int(80 * sc)), (180, 255, 80), 1.3))

    def explosion(self, t):
        G0 = TL.SHOTS[6][1]
        b = t - G0
        z = self.z
        k = lerp(2.18, 1.55, ease((b - 0.4) / 1.8))
        X0, Y0 = self._fg_cam(k)
        blur = 1 - ease((b - 0.3) / 1.2)
        out = z.view(t, X0, Y0, k, blur=blur, boom=b)
        z.light_glows(out, t, X0, Y0, k, 1.3)
        # обломки
        D = Layer()
        for ang, sp, sz, hot in self.debris:
            if b > 4:
                break
            px = 470 + math.cos(ang) * sp * b
            py = 950 - math.sin(ang) * sp * b * 0.8 + 160 * b * b
            col = (255, 160, 60, 255) if hot else (30, 24, 24, 255)
            D.c.circ((px - X0) * k, (py - Y0) * k, sz * 4 * k, col)
        D.put(out, rim_k=0.0)
        # мутанты и стрелки
        M = Layer()
        self.mutants_draw(M, t, b, X0, Y0, k)
        if b > 2.3:
            for (wx, wy), ph in (((150, 1230), 0.0), ((960, 1250), 0.13)):
                x, y = (wx - X0) * k, (wy - 160 - Y0) * k
                fl = A.cop_small(M.c.sub(x, y, 0.16 * k), "shoot", t, 1 if wx < 500 else -1)
                if ((b + ph) % 0.27) < 0.05:
                    M.glows.append((x + fl[0] * 0.16 * k, y + fl[1] * 0.16 * k, int(40 * k), (255, 220, 140), 1.2))
        M.put(out, mult=(0.45, 0.45, 0.4), tint=z.flash_tint(t) * 0.5, rim=(1.0, 0.7, 0.3), rim_k=1.3)
        M.emit(out)
        self.draw_fg(out, t, k, X0, Y0, clark="back", boom=b)
        # вспышка
        if b < 0.6:
            out += (1 - b / 0.6) ** 2 * np.array([1.0, 0.85, 0.6], np.float32)
        amp = 40 * math.exp(-b * 1.5) + 6
        dx, dy, rot = shake(t, amp, 1.6, 4)
        return camera(out, dx, dy, rot)

    def flee(self, t):
        H0 = TL.SHOTS[7][1]
        lt = t - H0
        z = self.z
        k = 1.5
        X0 = 560 - W / k / 2
        Y0 = HOR - 900 / k
        tb = t - TL.EVENTS["boom"]
        out = z.view(t, X0, Y0, k, boom=tb)
        z.light_glows(out, t, X0, Y0, k, 1.3)
        M = Layer()
        self.mutants_draw(M, t, tb, X0, Y0, k)
        # мутант напал на полицейского у машины
        x, y = (120 - X0) * k, (1235 - Y0) * k
        A.cop_down(M.c.sub(x, y, 0.16 * k))
        A.mutant(M.c.sub(x + 10, y - 150 * k * 0.16 * 1.3, 0.2 * k), t, 1, walk=t * 20)
        # Кларкс стреляет справа
        cx, cy, sc = 900, 760, 0.5
        st = (t % 0.3)
        recoil = max(0, 1 - st / 0.1)
        A.clark_back(M.c.sub(cx, cy, sc), t, "aim", recoil)
        if st < 0.05:
            M.glows.append((cx + 165 * sc, cy + 200 * sc, 90, (255, 230, 150), 1.3))
        M.put(out, mult=(0.4, 0.34, 0.34), tint=z.flash_tint(t) * 0.6, rim_k=1.0)
        M.emit(out)
        # Элли поворачивается к камере и убегает
        L = Layer()
        p = min(1, max(0, lt / 0.45))
        fx = abs(math.cos(p * math.pi)) * 0.94 + 0.06
        run = ease((lt - 2.5) / 0.9)
        ex = lerp(560, -500, run)
        ey = lerp(560, 200, run)
        esc = lerp(0.8, 1.6, run)
        if p < 0.5:
            A.elli_back(L.c.sub(ex, ey, esc, fx), t)
        else:
            A.elli_front(L.c.sub(ex, ey, esc, fx), t, mic=run < 0.2)
        L.put(out, mult=(0.3, 0.25, 0.27), tint=z.flash_tint(t) * 0.6, rim_k=1.0)
        dx, dy, rot = shake(t, 14, 1.2, 6)
        if lt > 2.9:
            w = ease((lt - 2.9) / 0.6)
            dx += w * 900
            rot += w * 4
            img = to_im(out).filter(ImageFilter.BoxBlur(int(4 + w * 20)))
            out = np.asarray(img, np.float32) / 255
        return camera(out, dx, dy, rot)

    def run(self, t):
        I0 = TL.SHOTS[8][1]
        lt = t - I0
        hit = TL.EVENTS["hit"]
        bob = abs(math.sin(lt * math.pi * 3.2)) * 40
        sx = 60 + smooth_noise(t * 3, 7) * 40
        sy = 90 - bob
        out = self.road[int(sy):int(sy) + H, int(sx):int(sx) + W].copy()
        # отсвет пожара сзади (мерцание)
        fl = 0.85 + 0.15 * smooth_noise(t * 5, 2)
        yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
        out = out * (0.55 + 0.5 * fl * yy ** 1.5 * np.array([1.0, 0.7, 0.5], np.float32))
        ph = t * 3.0
        for (x, y), col, sc in self.road_lights:
            if math.sin(ph * math.pi * 2 + (0 if col == "r" else math.pi)) > 0:
                r = int(90 * sc)
                add_over(out, _glow(r, (255, 40, 50) if col == "r" else (50, 100, 255)), int(x - sx - r), int(y - sy - r), 0.9)
        L = Layer()
        # полицейские бегут, мутант вдали прыгает на одного
        A.cop_small(L.c.sub(220 + lt * 30, 1050 - sy + 90, 0.28), "run", t)
        A.cop_small(L.c.sub(860 - lt * 20, 1010 - sy + 90, 0.22), "run", t + 0.4)
        A.cop_down(L.c.sub(360, 980 - sy + 90, 0.12))
        A.mutant(L.c.sub(350, 900 - sy + 90, 0.12), t, 2, walk=t * 20)
        A.elli_back(L.c.sub(520 + math.sin(lt * 3) * 30, 760 - sy + 90 - lt * 40, 0.55 - lt * 0.04), t, walk=lt * 2 * math.pi * 2.6, run=True, mic=False)
        L.put(out, mult=(0.85, 0.6, 0.5), tint=(0.03, 0.0, 0.02), rim=(0.4, 0.5, 1.0), rim_k=0.4, rim_dirs=((0, 8),))
        # человек-паук
        s0 = TL.EVENTS["spider"]
        if t > s0:
            u = (t - s0) / (hit - s0)
            S = Layer()
            uu = u ** 2.2
            x = lerp(980, 540, uu)
            y = lerp(380, 1000, uu) - math.sin(u * math.pi) * 200
            sc = lerp(0.18, 3.2, uu)
            eyes = A.spider(S.c.sub(x, y, sc), t, spread=uu)
            for ex, ey in eyes:
                S.glows.append((x + ex * sc, y + ey * sc, max(6, int(50 * sc)), (255, 30, 20), 1.1))
            S.put(out, mult=(0.75, 0.55, 0.5), tint=(0.02, 0, 0.02), rim=(0.6, 0.3, 1.0), rim_k=0.5)
            S.emit(out)
        a = 12 + 10 * (lt > 3.3)
        dx, dy, rot = shake(t, a, 1.8, 8)
        return camera(out, dx, dy, rot + math.sin(lt * math.pi * 3.2) * 1.2)
