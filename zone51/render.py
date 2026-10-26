"""Покадровый рендер видео 1080x1920 (9:16), 30 к/с.  python3 render.py [--preview t1,t2,...] [--out file.mp4]"""
import argparse, math, os, subprocess, sys, time
import numpy as np
from multiprocessing import Pool
from PIL import Image
from gfx import to_im, ease, alpha_over
import timeline as TL
import post
from room import Room
from tvroom import TVRoom
from studio import Studio
from field import Field, camera

W, H, FPS = 1080, 1920, TL.FPS
BUILD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")

print("подготовка сцен...", flush=True)
ROOM, TV, STUDIO, FIELD = Room(), TVRoom(), Studio(), Field()


def _walls():
    z = FIELD.z
    a = z.view(0.5, 230, 640, 1.9)
    w1 = to_im(a).crop((0, 300, 1080, 914)).resize((880, 500))
    from gfx import Cv, FONT_C
    c = Cv(880, 500, 1)
    c.rect((0, 400, 880, 500), (200, 20, 30, 230))
    c.text((440, 450), "ВЗРЫВ В «ЗОНЕ 51»", 52, (255, 255, 255, 255), FONT_C, anchor="mm")
    w1 = w1.convert("RGBA"); w1.alpha_composite(c.im)
    b = FIELD.report(34.0)
    w2 = to_im(b).crop((0, 260, 1080, 874)).resize((880, 500)).convert("RGBA")
    c = Cv(880, 500, 1)
    c.rect((0, 400, 880, 500), (200, 20, 30, 230))
    c.text((440, 450), "НА СВЯЗИ: ЭЛЛИ", 52, (255, 255, 255, 255), FONT_C, anchor="mm")
    c.rect((20, 20, 230, 70), (200, 20, 30, 255), r=8)
    c.text((125, 45), "● LIVE", 30, (255, 255, 255, 255), FONT_C, anchor="mm")
    w2.alpha_composite(c.im)
    return w1.convert("RGB"), w2.convert("RGB")


WALL1, WALL2 = _walls()


def shot_at(t):
    for name, s, e in TL.SHOTS:
        if s <= t < e:
            return name, s, e
    return TL.SHOTS[-1]


def wall(t):
    img = WALL2 if t >= TL.LINE["e4"][0] + 1.2 else WALL1
    z = 1 + 0.05 * ((t * 0.1) % 1)
    w, h = img.size
    cw, ch = w / z, h / z
    im = img.crop((int((w - cw) / 2), int((h - ch) / 2), int((w + cw) / 2), int((h + ch) / 2))).resize((880, 500), Image.BILINEAR)
    return np.asarray(im, np.float32) / 255


def broadcast(t):
    """Что идёт по телевизору в момент t (для плана с телевизором)."""
    it = t - TL.EVENTS["intro"]
    if it < 0:
        return post.static_noise(t, int(t * 30)) * 0.6
    return STUDIO.intro(it)


def render(i):
    t = i / FPS
    name, s, e = shot_at(t)
    lt = t - s
    tv_look = False
    if name == "room":
        out = ROOM.view(t, zoom=1.0 + 0.12 * ease(lt / 6.5), cx=0.42, cy=0.42)
        out = post.vignette(out)
        a = min(1, max(0, (lt - 0.8) / 1.0)) * min(1, max(0, (6.0 - lt) / 0.6))
        if a > 0:
            alpha_over(out, post.title_card("СССР · 1991", "ночь, 23:47", a, 1700), 0, 0)
        out *= min(1, lt / 0.8)
    elif name == "tv":
        content = broadcast(t)
        u = ease((lt - 1.2) / 3.6)
        zoom = 1.0 + 1.75 * u
        cx = 540 + (490 - 540) * u
        cy = 1000 + (1250 - 1000) * u
        out = TV.view(t, content, zoom, cx, cy)
        out = post.vignette(out)
        f = ease((lt - 4.7) / 0.8)
        if f > 0:
            full = post.vignette(post.crt(content, 0.6), 0.6)
            out = out * (1 - f) + full * f
    elif name == "studio":
        sp = TL.speaking(t)
        m = TL.mouth(["eddie"], t)
        blink = (t % 3.7) < 0.12
        lower = min(1, max(0, (t - 12.6) / 0.5)) * min(1, max(0, (17.8 - t) / 0.5))
        out = STUDIO.frame(t, m, blink, wall=wall(t), lower_third=lower, ticker_t=t - 12)
        if lt < 0.35:   # переход из заставки
            out = out * ease(lt / 0.35) + (1 - ease(lt / 0.35))
        tz = t - (TL.EVENTS["to_field"] - 0.5)
        if tz > 0:   # картинка с видеостены разворачивается на весь кадр
            u = ease(tz / 0.6)
            x0, y0, x1, y1 = 100 + (540 - 1690 - 100) * u, 240 + (0 - 240) * u, 980 + (540 + 1690 - 980) * u, 740 + (1920 - 740) * u
            big = WALL2.resize((max(2, int(x1 - x0)), max(2, int(y1 - y0))), Image.BILINEAR)
            im = to_im(out)
            im.paste(big, (int(x0), int(y0)))
            out = np.asarray(im, np.float32) / 255 + max(0, (tz - 0.35) / 0.35) ** 2
        tv_look = True
    elif name in ("report", "walk", "standoff", "explosion", "flee", "run"):
        out = getattr(FIELD, name)(t)
        D0 = TL.SHOTS[3][1]
        lower = None
        if name == "report":
            lower = min(1, max(0, (t - D0 - 0.6) / 0.5)) * min(1, max(0, (D0 + 7.5 - t) / 0.5))
            if lt < 0.5:
                out = out * ease(lt / 0.5) + (1 - ease(lt / 0.5))
        alpha_over(out, post.field_overlays(t, lower), 0, 0)
        tv_look = True
    elif name == "static":
        if lt < 0.45:
            base = FIELD.run(TL.EVENTS["hit"] - 1 / FPS)
            alpha_over(base, post.field_overlays(t), 0, 0)
            out = post.glitch(base, t, i, 1 + lt * 4)
            out = out * 0.6 + post.static_noise(t, i) * 0.4 * (lt / 0.45)
        else:
            out = post.static_noise(t, i)
            if lt > 1.0:
                from gfx import Cv, FONT_C
                c = Cv(W, H, 1)
                c.text((540, 960), "НЕТ СИГНАЛА", 80, (255, 255, 255, int(200 * min(1, (lt - 1.0) / 0.3))), FONT_C, anchor="mm")
                alpha_over(out, c.im, 0, 0)
        tv_look = True
    elif name == "offair":
        out = post.offair(t)
        out = out * 0.92 + post.static_noise(t, i) * 0.08
        if lt < 0.15:
            out = post.static_noise(t, i)
        tv_look = True
    else:  # room_end
        out = ROOM.view(t, zoom=1.12 - 0.05 * ease(lt / 5), cx=0.42, cy=0.42, mode="static")
        out = post.vignette(out)
        a = min(1, max(0, (lt - 1.2) / 0.8))
        if a > 0:
            alpha_over(out, post.title_card("Продолжение следует…", None, a, 1740), 0, 0)
        out *= min(1, max(0, (5.0 - lt) / 1.2))
    if tv_look:
        out = post.crt(out, 0.55)
        out = post.vignette(out, 0.55)
    sub = post.subtitles(t)
    if sub is not None:
        alpha_over(out, sub, 0, 0)
    out = post.grain(out, i, 0.008)
    return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", default="")
    ap.add_argument("--out", default=os.path.join(BUILD, "video.mp4"))
    ap.add_argument("--procs", type=int, default=os.cpu_count())
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--end", type=float, default=TL.TOTAL)
    a = ap.parse_args()
    if a.preview:
        os.makedirs(os.path.join(BUILD, "preview"), exist_ok=True)
        for s in a.preview.split(","):
            i = int(float(s) * FPS)
            Image.frombytes("RGB", (W, H), render(i)).save(os.path.join(BUILD, "preview", "f_%06.2f.png" % float(s)))
        return
    n0, n1 = int(a.start * FPS), int(a.end * FPS)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (W, H), "-r", str(FPS),
                           "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", a.out], stdin=subprocess.PIPE)
    t0 = time.time()
    with Pool(a.procs) as pool:
        for k, buf in enumerate(pool.imap(render, range(n0, n1), chunksize=2)):
            ff.stdin.write(buf)
            if k % 60 == 0:
                el = time.time() - t0
                print("кадр %d/%d  %.0f с, осталось ~%.0f с" % (k, n1 - n0, el, el / (k + 1) * (n1 - n0 - k)), flush=True)
    ff.stdin.close()
    ff.wait()
    print("готово:", a.out)


if __name__ == "__main__":
    main()
