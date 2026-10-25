// node render.js <outdir> [fps] [onlyStills]: рендер кадров в mp4 через ffmpeg
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const out = path.resolve(process.argv[2]); const fps = +(process.argv[3] || 30); const stills = process.argv[4];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => { console.error('PAGEERR', e.message); process.exit(1); });
  await p.goto('file://' + path.join(out, 'index.html'));
  await p.evaluate(async () => { for (const w of [700, 800, 900]) { await document.fonts.load(`${w} 40px Mont`, 'АБВ'); await document.fonts.load(`${w} 40px Mont`, 'AB'); } });
  const dur = await p.evaluate(() => window.TL.dur);
  const grab = async t => Buffer.from((await p.evaluate(t => { window.draw(t); return document.getElementById('c').toDataURL('image/jpeg', 0.92); }, t)).split(',')[1], 'base64');
  if (stills) {
    for (const t of stills.split(',').map(Number)) require('fs').writeFileSync(path.join(out, `still_${t}.jpg`), await grab(t));
    await b.close(); return;
  }
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-i', path.join(out, 'audio.wav'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.join(out, 'video.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.ceil(dur * fps);
  for (let i = 0; i < n; i++) {
    const buf = await grab(i / fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`frame ${i}/${n}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close(); console.log('done');
})();
