#!/usr/bin/env bash
# Сборка видео «Зона 51» целиком из кода.
# Нужны: python3 (numpy, pillow, scipy, piper-tts, soundfile), ffmpeg с rubberband,
# голоса Piper: vits-piper-ru_RU-{denis,dmitri,irina,ruslan}-medium из
# https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models в папке $PIPER_MODELS (по умолчанию /home/user/models).
set -euo pipefail
cd "$(dirname "$0")"
python3 tts.py                                   # озвучка -> build/voice
python3 audio.py                                 # звуки, музыка, сведение -> build/audio.wav
python3 render.py --out build/video_noaudio.mp4  # кадры -> видео
ffmpeg -y -loglevel error -i build/video_noaudio.mp4 -i build/audio.wav -map 0:v:0 -map 1:a:0 -c:v libx264 -profile:v high -level:v 4.1 -preset slow -b:v 2600k -maxrate 4000k -bufsize 8000k \
  -pix_fmt yuv420p -r 30 -c:a aac -profile:a aac_low -b:a 192k -ar 48000 -ac 2 -shortest -movflags +faststart -brand mp42 zone51.mp4
echo "Готово: zone51/zone51.mp4"
