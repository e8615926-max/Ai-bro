"""Озвучка через Microsoft Edge TTS (pip: edge-tts) с повторами и временем каждого слова."""
import asyncio, hashlib, json, os, time
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


CACHE = os.environ.get('TTS_CACHE', os.path.join(os.path.dirname(os.path.abspath(__file__)), '.tts_cache'))


def synth(text, voice, rate='+0%', pitch='+0Hz', tries=60):
    """Возвращает (mp3 bytes, [(слово, сек от начала)]). Сервис через прокси часто сбрасывает первые попытки,
    поэтому готовые фразы кэшируются на диск и повторный запуск продолжает с места сбоя."""
    key = hashlib.sha1(f'{voice}|{rate}|{pitch}|{text}'.encode()).hexdigest()
    os.makedirs(CACHE, exist_ok=True)
    mp3_path, js_path = os.path.join(CACHE, key + '.mp3'), os.path.join(CACHE, key + '.json')
    if os.path.exists(mp3_path) and os.path.exists(js_path):
        return open(mp3_path, 'rb').read(), [tuple(w) for w in json.load(open(js_path))]
    for _ in range(tries):
        try:
            audio, words = asyncio.run(_once(text, voice, rate, pitch))
            if audio:
                open(mp3_path, 'wb').write(audio)
                json.dump(words, open(js_path, 'w'), ensure_ascii=False)
                return audio, words
        except Exception:
            pass
        time.sleep(1.5)
    raise RuntimeError('Edge TTS: нет звука для: ' + text)
