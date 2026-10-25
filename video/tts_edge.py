"""Озвучка через Microsoft Edge TTS (pip: edge-tts) с повторами и временем каждого слова."""
import asyncio, os, time
import edge_tts

PROXY = os.environ.get('HTTPS_PROXY')


async def _once(text, voice, rate, pitch):
    audio, words = b'', []
    async for ch in edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, proxy=PROXY,
                                         boundary='WordBoundary').stream():
        if ch['type'] == 'audio':
            audio += ch['data']
        elif ch['type'] == 'WordBoundary':
            words.append((ch['text'], ch['offset'] / 1e7))
    return audio, words


def synth(text, voice, rate='+0%', pitch='+0Hz', tries=60):
    """Возвращает (mp3 bytes, [(слово, сек от начала)]). Сервис через прокси часто сбрасывает первые попытки."""
    for _ in range(tries):
        try:
            audio, words = asyncio.run(_once(text, voice, rate, pitch))
            if audio:
                return audio, words
        except Exception:
            pass
        time.sleep(1.5)
    raise RuntimeError('Edge TTS: нет звука для: ' + text)
