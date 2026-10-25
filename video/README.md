# Видео «Домофон в 03:00», часть 1

Готовый ролик: `domofon-03-00-part1.mp4` (1080×1920, 30 fps, 85 с).

Пересборка:
```
pip install numpy rhvoice-wrapper rhvoice-wrapper-bin scons   # голос RHVoice «Aleksandr»
python build_audio.py out            # озвучка + музыка + SFX + таймлайн субтитров
cp render/index.html render/scene.js out/ && cp -r render/fonts out/
node render/render.js out 30         # кадры (Playwright) → out/video.mp4
```
Текст, цвета субтитров и звуки задаются в `timeline.json`.
