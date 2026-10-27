"""Покадровый рендер видео 1080x1920 (9:16), 30 к/с.  python3 render.py [--preview t1,t2,...] [--out file.mp4]"""
import argparse, math, os, subprocess, sys, time
import numpy as np
from multiprocessing import Pool
from PIL import Image
from gfx import to_im, ease, alpha_over, Cv, FONT_C, FONT_R
import timeline as TL
import post
from scene_room import RoomScenes
from tvroom import TVRoom, SCR
from studio import Studio
from field import Field, camera, motion_blur
from hall import HallScenes
from ad import Ad

W, H, FPS = 1080, 1920, TL.FPS
EV = TL.EV
BUILD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")

print("подготовка сцен...", flush=True)
ROOM, TV, STUDIO, FIELD, HALL, AD = RoomScenes(), TVRoom(), Studio(), Field(), HallScenes(), Ad()
SH = {n: (s, e) for n, s, e in TL.SHOTS}


def _walls():
    z = FIELD.z
    a = z.view(0.5, 230, 640, 1.9)
    w1 = to_im(a).crop((0, 300, 1080, 914)).resize((880, 500))
    c = Cv(880, 500, 1)
    c.rect((0, 400, 880, 500), (200, 20, 30, 230))
    c.text((440, 450), "ВЗРЫВ В «ЗОНЕ 51»", 52, (255, 255, 255, 255), FONT_C, anchor="mm")
    w1 = w1.convert("RGBA"); w1.alpha_composite(c.im)
    b = FIELD.report(EV["tilt1"] + 0.6)
    w2 = to_im(b).crop((0, 160, 1080, 774)).resize((880, 500)).convert("RGBA")
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


def wall(t, img):
    z = 1 + 0.05 * ((t * 0.1) % 1)
    w, h = img.size
    cw, ch = w / z, h / z
    im = img.crop((int((w - cw) / 2), int((h - ch) / 2), int((w + cw) / 2), int((h + ch) / 2))).resize((880, 500), Image.BILINEAR)
    return np.asarray(im, np.float32) / 255


def eddie_face(t):
    """Эмоции ведущего по словам."""
    f = dict(turn=0.0, gaze=0.0, smile=0.15, brows=0.0)
    for lid, (s, d) in TL.LINE.items():
        if not (s - 0.2 <= t < s + d + 0.4):
            continue
        lt = t - s
        if lid == "e1":
            f.update(smile=0.6, brows=0.4)
        elif lid == "e2":
            f.update(smile=0.5, brows=0.5) if lt < 1.4 else f.update(smile=-0.5, brows=-0.2, gaze=0.0)
        elif lid == "e3":
            f.update(smile=-0.3, brows=0.9) if lt < 2.0 else f.update(smile=-0.4, brows=-0.5)
        elif lid == "e4":
            f.update(smile=0.4, brows=0.2, turn=0.15 if lt > 1.5 else 0.0, gaze=0.6 if lt > 1.5 else 0.0)
    if SH["studio2"][0] <= t < SH["studio2"][1]:
        st = EV["smile_turn"]
        if t < st:   # смотрит налево, растерян
            u = ease((t - SH["studio2"][0]) / 0.5)
            f = dict(turn=-0.7 * u, gaze=-1.0 * u, smile=-0.5, brows=0.9)
        else:        # поворачивается к камере с натянутой улыбкой
            u = ease((t - st) / 0.45)
            f = dict(turn=-0.7 * (1 - u), gaze=-1.0 * (1 - u), smile=lerp(-0.5, 1.0, u), brows=lerp(0.9, 0.6, u))
            e6 = TL.LINE["e6"]
            if e6[0] + 1.3 < t < e6[0] + 2.6:   # «М-да...»
                f.update(smile=0.3, brows=0.8, gaze=-0.3)
    return f


def lerp(a, b, u):
    return a + (b - a) * u


def broadcast(t):
    it = t - EV["intro"]
    if it < 0:
        return post.static_noise(t, int(t * 30)) * 0.6
    return STUDIO.intro(it)


def render(i):
    t = i / FPS
    name, s, e = shot_at(t)
    lt = t - s
    tv_look = False
    over = None
    if name == "room_intro":
        out = ROOM.intro(t)
        out = post.vignette(out)
        out *= min(1, lt / 0.8)
    elif name == "tv":
        content = broadcast(t)
        u = ease((lt - 1.2) / 3.6)
        out = TV.view(t, content, 1.0 + 1.75 * u, 540 + (490 - 540) * u, 1000 + (1250 - 1000) * u)
        out = post.vignette(out)
        f = ease((lt - 4.7) / 0.8)
        if f > 0:
            full = post.oldtv(content, t, i)
            out = out * (1 - f) + full * f
    elif name in ("studio", "studio2"):
        m = TL.mouth(["eddie"], t)
        blink = TL.blink(t, 0)
        if name == "studio":
            lower = min(1, max(0, (t - (s + 0.6)) / 0.5)) * min(1, max(0, (s + 5.8 - t) / 0.5))
            img = WALL2 if t >= TL.LINE["e4"][0] + 1.0 else WALL1
            wl = wall(t, img)
        else:
            lower = 0
            wl = post.static_noise(t, i)[240:740, 100:980] * 0.7
        out = STUDIO.frame(t, m, blink, wall=wl, lower_third=lower, ticker_t=t - 12, face=eddie_face(t))
        if lt < 0.35:
            out = out * ease(lt / 0.35) + (1 - ease(lt / 0.35)) * (1 if name == "studio" else post.static_noise(t, i))
        if name == "studio":
            tz = t - (EV["to_field"] - 0.5)
            if tz > 0:
                u = ease(tz / 0.6)
                x0, y0, x1, y1 = 100 + (540 - 1690 - 100) * u, 240 + (0 - 240) * u, 980 + (540 + 1690 - 980) * u, 740 + (1920 - 740) * u
                big = WALL2.resize((max(2, int(x1 - x0)), max(2, int(y1 - y0))), Image.BILINEAR)
                im = to_im(out)
                im.paste(big, (int(x0), int(y0)))
                out = np.asarray(im, np.float32) / 255 + max(0, (tz - 0.35) / 0.35) ** 2
        tv_look = True
    elif name in ("report", "walk", "standoff", "explosion", "flee", "run"):
        out = getattr(FIELD, name)(t)
        lower = None
        if name == "report":
            lower = min(1, max(0, (lt - 0.6) / 0.5)) * min(1, max(0, (7.5 - lt) / 0.5))
            if lt < 0.5:
                out = out * ease(lt / 0.5) + (1 - ease(lt / 0.5))
        alpha_over(out, post.field_overlays(t, lower), 0, 0)
        tv_look = True
    elif name == "fall":
        out = FIELD.fall(t)
        if lt > 0.45:
            im = to_im(out).convert("RGBA")
            im.alpha_composite(post.CRACK)
            out = np.asarray(im.convert("RGB"), np.float32) / 255
        alpha_over(out, post.field_overlays(t), 0, 0)
        st = min(1, 0.15 + lt / 4.0)
        if lt > 0.45:
            out = post.glitch(out, t, i, 0.5 + lt)
            k = st * (0.6 + 0.4 * (math.sin(t * 13) > 0.6))
            out = out * (1 - k) + post.static_noise(t, i) * k
        tv_look = True
    elif name == "nosignal":
        out = post.static_noise(t, i)
        c = Cv(W, H, 1)
        c.text((540, 960), "НЕТ СИГНАЛА", 84, (255, 255, 255, int(220 * min(1, lt / 0.3))), FONT_C, anchor="mm")
        alpha_over(out, c.im, 0, 0)
        tv_look = True
    elif name == "ad":
        out = AD.frame(t)
        tv_look = True
    elif name == "tv_out":
        content = post.oldtv(AD.frame(SH["ad"][1] - 0.05 + min(lt, 0.0)), t, i)
        u = 1 - ease(lt / 2.6)
        out = TV.view(t, content, 1.0 + 1.75 * u, 540 + (490 - 540) * u, 1000 + (1250 - 1000) * u)
        out = post.vignette(out)
        f = 1 - ease(lt / 0.6)
        if f > 0:
            out = out * (1 - f) + content * f
    elif name == "room2":
        out = ROOM.part2(t)
        out = post.vignette(out)
        if lt < 0.4:
            out *= ease(lt / 0.4) * 0.6 + 0.4
    elif name == "hall":
        out = post.vignette(HALL.hall(t))
        if lt < 0.3:
            out *= ease(lt / 0.3)
    elif name == "peephole":
        out = HALL.peephole(t)
    elif name == "hall2":
        out = post.vignette(HALL.hall2(t))
        if lt < 0.3:
            out *= ease(lt / 0.3)
    else:  # end_card
        base = post.vignette(HALL.hall2(SH["hall2"][1] - 0.05)) * (1 - ease(lt / 1.0)) * 0.9
        out = base
        a = min(1, max(0, (lt - 0.8) / 0.8)) * min(1, max(0, (4.4 - lt) / 0.6))
        if a > 0:
            c = Cv(W, H, 1)
            c.text((540, 880), "Продолжение во 2 части", 66, (255, 240, 220, int(255 * a)), FONT_C, anchor="mm")
            c.text((540, 980), "скоро…", 44, (230, 210, 200, int(230 * a)), FONT_R, anchor="mm")
            alpha_over(out, c.im, 0, 0)
    if tv_look:
        out = post.oldtv(out, t, i)
    sub = post.subtitles(t)
    if sub is not None:
        alpha_over(out, sub, 0, 0)
    alpha_over(out, post.WATERMARK, 0, 0)
    out = post.grain(out, i, 0.008)
    return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", default="")
    ap.add_argument("--out", default=os.path.join(BUILD, "video_noaudio.mp4"))
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
                           "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p", a.out], stdin=subprocess.PIPE)
    t0 = time.time()
    with Pool(a.procs) as pool:
        for k, buf in enumerate(pool.imap(render, range(n0, n1), chunksize=2)):
            ff.stdin.write(buf)
            if k % 90 == 0:
                el = time.time() - t0
                print("кадр %d/%d  %.0f с, осталось ~%.0f с" % (k, n1 - n0, el, el / (k + 1) * (n1 - n0 - k)), flush=True)
    ff.stdin.close()
    ff.wait()
    print("готово:", a.out)


if __name__ == "__main__":
    main()
