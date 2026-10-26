#!/usr/bin/env bash
# Сборка видео «Зона 51» целиком из кода.
# Нужны: python3 (numpy, pillow, scipy), ffmpeg, RHVoice с русскими голосами (apt install rhvoice rhvoice-russian).
set -euo pipefail
cd "$(dirname "$0")"
python3 tts.py                                   # озвучка -> build/voice
python3 audio.py && cp build/audio_raw.wav build/audio.wav   # звуки, музыка, сведение
python3 render.py --out build/video_noaudio.mp4  # кадры -> видео
ffmpeg -y -loglevel error -i build/video_noaudio.mp4 -i build/audio.wav -c:v copy -c:a aac -b:a 192k -shortest zone51.mp4
echo "Готово: zone51/zone51.mp4"
