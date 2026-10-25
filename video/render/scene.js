// Покадровая отрисовка ролика «Домофон в 03:00». draw(t) рисует кадр в момент t (сек).
const W = 1080, H = 1920;
const C = {
  bg: '#0E1220', bg2: '#141B2B', wall: '#1A2235', wall2: '#212A40', line: '#2C3650',
  floor: '#151B29', skin: '#E7B48F', navy: '#2A3B63', navyD: '#1F2C4B', hair: '#3A2A22',
  pants: '#555E75', yel: '#F5C518', red: '#E5383B', blue: '#4FA3FF', green: '#3DDC84',
  warm: '#F2A65A', grey: '#8A93A8', dim: '#596178', beige: '#D9CBB0', beigeD: '#B7A88C',
  wood: '#5A3E2B', plank: '#8B6A45', paper: '#ECE5D1', robe: '#7A2232', white: '#F2F4F8'
};
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const TL = window.TL;
const FONT = '"Mont", sans-serif';

// ---------- utils ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
const easeIn = x => { x = clamp(x); return x * x * x; };
const prog = (t, a, d) => clamp((t - a) / d);
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const pop = (t, a, d = 0.25) => { const k = prog(t, a, d); return k <= 0 ? 0 : 1 + Math.sin(k * Math.PI) * 0.18 * (1 - k) + (easeOut(k) - 1); };

function rr(x, y, w, h, r, fill, stroke, lw = 4) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function circ(x, y, r, fill, stroke, lw = 4) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function txt(s, x, y, size, color, weight = 900, align = 'center', ls = 0) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.letterSpacing = ls + 'px'; ctx.fillText(s, x, y); ctx.letterSpacing = '0px';
}
function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
function noGlow() { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
function withCam(cx, cy, z, fn, rot = 0) {
  ctx.save(); ctx.translate(W / 2, 820); ctx.rotate(rot); ctx.scale(z, z); ctx.translate(-cx, -cy); fn(); ctx.restore();
}
function shake(t, amp, a, d) {
  const k = prog(t, a, d); if (k <= 0 || k >= 1) return [0, 0];
  const f = amp * (1 - k); return [Math.sin(t * 90) * f, Math.cos(t * 77) * f];
}

// ---------- characters ----------
function drawDenis(x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.flip ? -1 : 1), s);
  const pose = o.pose || 'stand';
  const lit = o.tint;
  if (pose === 'sit') {
    rr(-60, -70, 120, 30, 12, C.pants); // бёдра
    rr(40, -70, 26, 70, 10, C.pants); rr(-66, -70, 26, 70, 10, C.pants);
    rr(-70, -6, 46, 14, 7, '#111'); rr(34, -6, 46, 14, 7, '#111');
    ctx.translate(0, 100);
  } else {
    rr(-34, -100, 26, 100, 10, C.pants); rr(8, -100, 26, 100, 10, C.pants);
    rr(-40, -10, 36, 14, 7, '#111'); rr(6, -10, 36, 14, 7, '#111');
  }
  rr(-48, -230, 96, 140, 26, C.navy);
  rr(-48, -190, 96, 12, 0, C.yel);
  // руки
  ctx.fillStyle = C.navyD;
  const arm = (side, ang, len = 105) => {
    ctx.save(); ctx.translate(side * 44, -215); ctx.rotate(ang);
    rr(-11, 0, 22, len, 11, C.navyD); circ(0, len, 12, C.skin); ctx.restore();
  };
  if (pose === 'stand' || pose === 'sit' && !o.ears) { arm(-1, 0.12); arm(1, -0.12); }
  if (o.ears) { arm(-1, 2.7, 80); arm(1, -2.7, 80); }
  if (pose === 'phone') { arm(-1, 0.12); arm(1, -2.55, 82); }
  if (pose === 'pry') { arm(-1, -1.2, 95); arm(1, -1.35, 100); }
  if (pose === 'light') { arm(-1, 0.12); arm(1, -1.5, 100); }
  // голова
  const hy = -278;
  circ(0, hy, 44, C.skin);
  ctx.fillStyle = C.hair; ctx.beginPath();
  ctx.arc(0, hy - 6, 46, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(40, hy - 14);
  for (let i = 0; i < 7; i++) ctx.lineTo(36 - i * 12, hy - 30 - (i % 2) * 14);
  ctx.closePath(); ctx.fill();
  rr(-30, hy + 22, 60, 14, 7, 'rgba(58,42,34,0.25)');
  const ex = o.look || 0;
  circ(-15 + ex, hy + 2, o.fear ? 6 : 5, '#151515'); circ(15 + ex, hy + 2, o.fear ? 6 : 5, '#151515');
  ctx.strokeStyle = C.hair; ctx.lineWidth = 4; ctx.beginPath();
  if (o.fear) { ctx.moveTo(-24, hy - 10); ctx.lineTo(-8, hy - 19); ctx.moveTo(24, hy - 10); ctx.lineTo(8, hy - 19); }
  else { ctx.moveTo(-24, hy - 12); ctx.lineTo(-8, hy - 12); ctx.moveTo(24, hy - 12); ctx.lineTo(8, hy - 12); }
  ctx.stroke();
  if (o.fear) circ(0, hy + 22, 6, '#3a1d1d'); else { ctx.beginPath(); ctx.moveTo(-8, hy + 22); ctx.lineTo(8, hy + 22); ctx.stroke(); }
  if (pose === 'phone') { ctx.save(); ctx.translate(48, hy + 4); ctx.rotate(-0.25); rr(-12, -40, 24, 84, 10, C.beige); ctx.restore(); }
  if (pose === 'pry') { ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(80, -270); ctx.lineTo(160, -330); ctx.lineTo(175, -315); ctx.stroke(); }
  if (lit) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = lit; ctx.fillRect(-200, -400, 400, 500); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
}
function drawNeighbor(x, y, s, armUp) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rr(-34, -100, 26, 100, 10, '#3B4256'); rr(8, -100, 26, 100, 10, '#3B4256');
  rr(-52, -235, 104, 145, 28, '#D8DCE4');
  circ(0, -282, 46, '#D9A47E');
  ctx.fillStyle = '#6b6b6b'; ctx.beginPath(); ctx.arc(0, -292, 46, Math.PI, Math.PI * 2); ctx.fill();
  circ(-15, -280, 5, '#151515'); circ(15, -280, 5, '#151515');
  ctx.save(); ctx.translate(-46, -220); ctx.rotate(0.12); rr(-12, 0, 24, 105, 12, '#D9A47E'); ctx.restore();
  ctx.save(); ctx.translate(46, -220); ctx.rotate(lerp(-0.12, -2.5, armUp)); rr(-12, 0, 24, 85, 12, '#D9A47E');
  if (armUp > 0.6) rr(-14, 70, 28, 80, 10, C.beige);
  ctx.restore();
  ctx.restore();
}
function drawZoya(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rr(-28, -70, 22, 70, 8, '#4a4a55'); rr(6, -70, 22, 70, 8, '#4a4a55');
  ctx.fillStyle = C.robe; ctx.beginPath(); ctx.moveTo(-40, -210); ctx.lineTo(40, -210); ctx.lineTo(62, -60); ctx.lineTo(-62, -60); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5c1a26'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -210); ctx.lineTo(-10, -60); ctx.stroke();
  circ(0, -250, 40, '#E2AE8C');
  circ(0, -300, 22, '#C9CCD3'); ctx.fillStyle = '#C9CCD3'; ctx.beginPath(); ctx.arc(0, -258, 42, Math.PI, Math.PI * 2); ctx.fill();
  circ(-15, -248, 15, 'rgba(255,255,255,0.15)', '#e8e8e8', 4); circ(15, -248, 15, 'rgba(255,255,255,0.15)', '#e8e8e8', 4);
  circ(-15, -248, 7, '#151515'); circ(15, -248, 7, '#151515');
  ctx.strokeStyle = '#999'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-26, -220); ctx.lineTo(0, -170); ctx.lineTo(26, -220); ctx.stroke();
  rr(-8, -172, 16, 16, 3, '#c9b26b');
  ctx.restore();
}

// ---------- props ----------
function cord(x1, y1, x2, y2, col = C.beigeD) {
  ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath();
  const n = 40, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
  for (let i = 0; i <= n; i++) {
    const k = i / n, w = Math.sin(k * Math.PI * 16) * 9;
    ctx.lineTo(x1 + dx * k + nx * w, y1 + dy * k + ny * w + Math.sin(k * Math.PI) * 30);
  }
  ctx.stroke();
}
// домофон: led — цвет индикатора, hang — 0 на рычаге / 1 висит, swing — угол
function drawIntercom(x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rr(-70, -150, 140, 300, 18, C.beige, C.beigeD, 6);
  rr(-40, -120, 80, 44, 8, '#20262f');
  if (o.screen) { ctx.save(); glow(C.red, 18); txt(o.screen, 0, -98, o.screenSize || 15, o.screenCol || C.red, 800); ctx.restore(); }
  const led = o.led || '#3a3f36';
  if (o.led) { glow(o.led, 30); }
  circ(44, -40, 9, led); noGlow();
  for (let i = 0; i < 3; i++) rr(-34, -40 + i * 26, 46, 12, 6, C.beigeD);
  rr(-50, 90, 100, 36, 10, C.beigeD);
  const hang = o.hang || 0;
  if (hang <= 0) {
    rr(-92, -130, 40, 230, 18, '#E8DCC3', C.beigeD, 5);
    cord(-72, 100, -60, 135);
  } else {
    const hx = -150, hy = lerp(-100, 330, hang);
    cord(-40, 110, hx + 10, hy - 100);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(o.swing || 0); rr(-20, -115, 40, 230, 18, '#E8DCC3', C.beigeD, 5); ctx.restore();
  }
  ctx.restore();
}
function waveform(x, y, w, h, t, col = C.red, amp = 1) {
  ctx.save(); glow(col, 20); ctx.fillStyle = col;
  const n = 22;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), env = Math.sin(k * Math.PI);
    const a = (0.25 + 0.75 * Math.abs(Math.sin(t * 9 + i * 1.7) * Math.sin(t * 4.3 + i * 0.6))) * env * amp;
    const bh = Math.max(6, h * a);
    rr(x + k * w - 5, y - bh / 2, 10, bh, 5, col);
  }
  ctx.restore();
}
function sticker(label, x, y, t, a, rot = -0.04) {
  const p = pop(t, a, 0.3); if (p <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(p, p);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
  ctx.font = `900 56px ${FONT}`; const w = ctx.measureText(label).width + 70;
  rr(-w / 2, -48, w, 96, 6, C.paper); noGlow(); ctx.shadowOffsetY = 0;
  txt(label, 0, 2, 56, '#1A1A1A');
  ctx.restore();
}
function tag(label, x, y, t, a, col = C.yel, size = 30, bg = 'rgba(10,14,24,0.85)') {
  const p = pop(t, a, 0.25); if (p <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(p, p);
  ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(label).width + 40;
  rr(-w / 2, -size * 0.9, w, size * 1.8, 8, bg, col, 3);
  txt(label, 0, 2, size, col, 800);
  ctx.restore();
}
function stamp(label, x, y, t, a, col = C.red, size = 54) {
  const k = prog(t, a, 0.22); if (k <= 0) return;
  const sc = lerp(2.2, 1, easeOut(k));
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.08); ctx.scale(sc, sc); ctx.globalAlpha = clamp(k * 1.5);
  ctx.font = `900 ${size}px ${FONT}`; const w = ctx.measureText(label).width + 50;
  rr(-w / 2, -size * 0.85, w, size * 1.7, 6, 'rgba(229,56,59,0.12)', col, 7);
  txt(label, 0, 3, size, col);
  ctx.restore();
}
function roomBg(floorY = 1180, wall = C.wall, floorC = C.floor) {
  ctx.fillStyle = wall; ctx.fillRect(-2000, -2000, 6000, floorY + 2000);
  ctx.fillStyle = floorC; ctx.fillRect(-2000, floorY, 6000, 3000);
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(-2000, floorY, 6000, 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 2;
  for (let x = -2000; x < 4000; x += 90) { ctx.beginPath(); ctx.moveTo(x, -2000); ctx.lineTo(x, floorY); ctx.stroke(); }
}
function door(x, y, w, h, num, open = 0, col = '#4A3A2E') {
  rr(x - 10, y - 10, w + 20, h + 10, 4, '#0C1019');
  if (open > 0) {
    ctx.fillStyle = '#05070C'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * (1 - open * 0.75), y + 30 * open);
    ctx.lineTo(x + w * (1 - open * 0.75), y + h - 30 * open); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
  } else {
    rr(x, y, w, h, 4, col); circ(x + w - 30, y + h / 2, 10, '#C9B26B');
  }
  if (num) txt(num, x + w / 2, y - 40, 34, C.grey, 800);
}

// ---------- building ----------
function building(cx, baseY, o = {}) {
  const fw = o.w || 640, fh = o.fh || 120, n = 12, x0 = cx - fw / 2;
  rr(x0 - 20, baseY - n * fh - 50, fw + 40, n * fh + 50, 6, '#1C2335');
  rr(x0 - 30, baseY - n * fh - 60, fw + 60, 24, 4, '#262F45');
  for (let f = 1; f <= n; f++) {
    const top = baseY - f * fh;
    ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(x0, top + fh - 6, fw, 6);
    if (o.floorFill && o.floorFill(f)) { ctx.fillStyle = o.floorFill(f); ctx.fillRect(x0, top, fw, fh - 6); }
    for (let i = 0; i < 4; i++) {
      const wx = x0 + 30 + i * (fw - 60) / 4, ww = (fw - 60) / 4 - 40;
      let col = hash(f * 7 + i * 3) > 0.45 ? C.warm : '#0A0E18';
      let a = hash(f * 13 + i) * 0.5 + 0.5;
      if (o.win) { const r = o.win(f, i); if (r) { col = r[0]; a = r[1]; } }
      ctx.globalAlpha = a; rr(wx, top + 24, ww, fh - 56, 3, col); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(wx + ww / 2 - 2, top + 24, 4, fh - 56);
    }
    if (o.labels) txt(String(f), x0 - 60, top + fh / 2, 30, f === o.hl ? C.yel : C.dim, 800);
  }
  ctx.fillStyle = '#0B0F18'; ctx.fillRect(-2000, baseY, 6000, 2000);
}

// ---------- HUD / overlays ----------
function hud(label) {
  ctx.font = `700 30px ${FONT}`; ctx.letterSpacing = '4px';
  const w = ctx.measureText(label).width + 56; ctx.letterSpacing = '0px';
  rr(W / 2 - w / 2, 62, w, 56, 6, 'rgba(10,13,22,0.85)', 'rgba(245,197,24,0.45)', 2);
  txt(label, W / 2, 91, 30, '#E8C35A', 700, 'center', 4);
}
function chips(t) {
  let i = 0;
  for (const s of TL.scenes) {
    if (!s.chip || t < s.t0 + 0.2) continue;
    const p = pop(t, s.t0 + 0.2, 0.3);
    ctx.save(); ctx.translate(40, 160 + i * 56); ctx.scale(p, p);
    ctx.font = `800 24px ${FONT}`; const w = ctx.measureText(s.chip).width + 30;
    rr(0, -20, w, 40, 5, 'rgba(229,56,59,0.15)', 'rgba(229,56,59,0.8)', 2);
    txt(s.chip, 15, 1, 24, '#FF8A8C', 800, 'left');
    ctx.restore(); i++;
  }
}
const COLS = { r: C.red, y: C.yel, b: C.blue };
function subtitles(t) {
  let card = null;
  for (const s of TL.scenes) for (const c of s.cards) if (t >= c.t0 - 0.05 && t < c.t1 + c.pause) card = c;
  if (!card) return;
  const size = 82, lh = 96, maxW = 940;
  ctx.font = `900 ${size}px ${FONT}`;
  const words = card.words.map(w => ({ ...w, s: w.w.toUpperCase(), wd: ctx.measureText(w.w.toUpperCase() + ' ').width }));
  const lines = [[]]; let lw = 0;
  for (const w of words) { if (lw + w.wd > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push(w); lw += w.wd; }
  const y0 = 1420 - (lines.length - 1) * lh / 2;
  const cardPop = lerp(0.92, 1, easeOut(prog(t, card.t0 - 0.05, 0.15)));
  ctx.save(); ctx.translate(W / 2, 1420); ctx.scale(cardPop, cardPop); ctx.translate(-W / 2, -1420);
  lines.forEach((ln, li) => {
    const total = ln.reduce((a, w) => a + w.wd, 0) - ctx.measureText(' ').width;
    let x = W / 2 - total / 2;
    for (const w of ln) {
      const on = t >= w.t;
      const col = on ? (COLS[w.c] || C.white) : '#5E6578';
      const k = on ? 1 + 0.14 * (1 - easeOut(prog(t, w.t, 0.16))) : 1;
      const ww = ctx.measureText(w.s).width;
      ctx.save(); ctx.translate(x + ww / 2, y0 + li * lh); ctx.scale(k, k);
      ctx.font = `900 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 12; ctx.strokeText(w.s, 0, 0);
      if (on && w.c) glow(col, 24);
      ctx.fillStyle = col; ctx.fillText(w.s, 0, 0); noGlow();
      ctx.restore();
      x += w.wd;
    }
  });
  ctx.restore();
}
const grain = document.createElement('canvas'); grain.width = grain.height = 256;
{ const g = grain.getContext('2d'), d = g.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); }
function post(t) {
  const g = ctx.createRadialGradient(W / 2, 860, 300, W / 2, 860, 1250);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'overlay';
  const ox = Math.floor(hash(t * 30) * 256), oy = Math.floor(hash(t * 30 + 5) * 256);
  ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.save(); ctx.translate(-ox, -oy); ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

// ---------- scenes ----------
// lt — локальное время сцены, c(i) — начало карточки i, e(type) — времена звуков
const SC = {};
SC[1] = (lt, c, e, D) => {
  const gone = prog(lt, c(1) + 0.15, 0.6);
  const camY = lerp(1960 - 4 * 120, 1960 - 11.5 * 120, ease(prog(lt, c(2) - 0.1, 1.1)));
  const z = lerp(0.95, 1.35, ease(prog(lt, c(2) + 0.6, 1.2)));
  withCam(540, camY, z, () => {
    ctx.fillStyle = '#0A0D16'; ctx.fillRect(-2000, -2000, 6000, 6000);
    circ(870, 400, 60, '#C9CFDB');
    building(540, 1960, {
      win: (f, i) => {
        if (f === 3) return [C.warm, (1 - gone) * (hash(i) * 0.4 + 0.6) * (i / 4 < gone * 1.4 ? 0 : 1)];
        if (f === 12 && i === 2) return [C.red, 0.9];
        return null;
      },
      floorFill: f => f === 3 && gone > 0 ? `rgba(0,0,0,${gone})` : null
    });
    if (gone > 0 && gone < 1) { ctx.fillStyle = `rgba(229,56,59,${0.35 * Math.sin(gone * Math.PI)})`; ctx.fillRect(220, 1960 - 3 * 120, 640, 114); }
    const wx = 220 + 30 + 2 * 580 / 4 + (580 / 4 - 40) / 2, wy = 1960 - 12 * 120 + 70;
    drawDenis(wx, wy + 38, 0.17, { pose: 'phone', tint: 'rgba(20,0,0,0.6)' });
    if (lt > c(2)) waveform(wx + 30, wy - 2, 40, 30, lt, C.red, 0.8);
  });
};
SC[2] = (lt, c, e, D) => {
  const close = ease(prog(lt, c(3) - 0.2, 0.9));
  const z = lerp(1.0, 1.12, lt / D);
  withCam(540, 820, z, () => {
    roomBg(1180, '#1E2638');
    ctx.fillStyle = 'rgba(255,240,200,0.06)'; ctx.beginPath(); ctx.moveTo(400, 200); ctx.lineTo(680, 200); ctx.lineTo(900, 1180); ctx.lineTo(180, 1180); ctx.fill();
    rr(250, 420, 420, 760, 6, '#0C1019');
    rr(270, 440, 380, 740, 4, '#3A4560');
    drawDenis(460, 1170, 1.25, { look: 6 });
    const dw = 190 * close;
    ctx.fillStyle = '#7C8597'; ctx.fillRect(270, 440, dw, 740); ctx.fillRect(650 - dw, 440, dw, 740);
    ctx.fillStyle = '#5E6779'; ctx.fillRect(268 + dw - 4, 440, 4, 740 * (close > 0 ? 1 : 0));
    rr(700, 640, 40, 90, 6, '#2B3346'); circ(720, 665, 8, C.warm); circ(720, 705, 8, '#555');
    const zx = lerp(780, 900, ease(prog(lt, c(2), 1)));
    drawZoya(zx, 1180, 1.3);
    const kp = ease(prog(lt, c(0) + 0.3, 0.9));
    const kx = lerp(zx - 70, 520, kp), ky = lerp(930, 880, kp);
    if (lt < c(3)) { ctx.strokeStyle = '#C9B26B'; ctx.lineWidth = 5; circ(kx, ky, 16, null, '#C9B26B', 5); rr(kx - 4, ky + 12, 8, 40, 3, '#C9B26B'); tag('47', kx + 40, ky + 40, lt, c(0) + 0.3, C.yel, 24); }
  });
  if (lt > c(3) + 0.6) { // глаза хозяйки поверх закрытых дверей
    const a = prog(lt, c(3) + 0.6, 0.4);
    ctx.globalAlpha = a; circ(450, 700, 60, 'rgba(255,255,255,0.1)', '#ddd', 6); circ(630, 700, 60, 'rgba(255,255,255,0.1)', '#ddd', 6);
    circ(450 + 10, 705, 22, '#111'); circ(630 + 10, 705, 22, '#111'); ctx.globalAlpha = 1;
  }
  // цена
  const pp = pop(lt, c(0) + 0.2, 0.3);
  if (pp > 0) {
    ctx.save(); ctx.translate(820, 300); ctx.scale(pp, pp);
    rr(-150, -70, 300, 140, 10, 'rgba(10,14,24,0.9)', C.line, 3);
    txt('АРЕНДА', 0, -40, 22, C.grey, 700, 'center', 3);
    txt('30 000 ₽', 0, 0, 40, C.dim, 900);
    const k = prog(lt, c(1), 0.3); ctx.strokeStyle = C.red; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-90, 0); ctx.lineTo(-90 + 180 * k, 0); ctx.stroke();
    if (k > 0) txt('10 000 ₽', 0, 44, 40, C.yel, 900);
    ctx.restore();
  }
};
SC[3] = (lt, c, e, D) => {
  const cut = lt >= c(3);
  if (!cut) {
    const fy = lerp(440, 860, ease(prog(lt, 0.1, c(2) - 0.1)));
    const fx = 540 + Math.sin(lt * 1.3) * 60;
    withCam(540, 760, 1.02 + lt * 0.01, () => {
      roomBg(1300, '#161D2E');
      rr(230, 220, 620, 1080, 8, '#2A3247', '#1C2233', 10);
      rr(740, 760, 50, 20, 6, '#999');
      ctx.save(); ctx.translate(270, 360); ctx.rotate(-0.02);
      const lines = ['ПРАВИЛА:', '1. В 03:00 ЗВОНИТ ДОМОФОН.', '   НЕ БЕРИ ТРУБКУ.', '2. ~~~~~~~~ ~~~~ ~~~~~', '3. ~~~~~ ~~~~~~~ ~~~~'];
      lines.forEach((l, i) => {
        ctx.font = `800 ${i ? 36 : 44}px "DejaVu Sans Mono", monospace`; ctx.textAlign = 'left'; ctx.fillStyle = '#AEB6C8';
        if (l.includes('~')) { ctx.strokeStyle = '#8992a6'; ctx.lineWidth = 4; ctx.beginPath(); for (let k = 0; k < 24; k++) ctx.lineTo(60 + k * 20, i * 90 + 40 + Math.sin(k * 2.3 + i) * 12); ctx.stroke(); txt(l.slice(0, 2), 0, i * 90 + 40, 36, '#AEB6C8', 800, 'left'); }
        else { for (let k = 0; k < l.length; k++) ctx.fillText(l[k], k * 21.5 + Math.sin(k * 3.1 + i) * 2, i * 90 + 40 + Math.cos(k * 1.7) * 3); }
      });
      ctx.restore();
    });
    // фонарик: маска
    ctx.save(); ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createRadialGradient(fx, fy, 60, fx, fy, 360);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#05070C'; ctx.fillRect(0, 0, W, H); ctx.restore();
    sticker('ПРАВИЛО 1', 540, 260, lt, c(2));
  } else {
    const k = lt - c(3);
    const blink = Math.floor(k * 3) % 2 === 0;
    const [sx, sy] = lt > c(4) ? shake(lt, 10, c(4), 2) : [0, 0];
    withCam(540 + sx, 760 + sy, lerp(1.6, 1.9, ease(k / 3)), () => {
      roomBg(1300, '#1B2336');
      drawIntercom(560, 760, 1.6, { led: blink ? C.green : null });
    });
    if (lt > c(4)) { ctx.globalAlpha = 0.25 * (0.5 + 0.5 * Math.sin(lt * 10)); ctx.fillStyle = C.red; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    sticker('ПРАВИЛО 1', 540, 260, lt, -1);
  }
};
SC[4] = (lt, c, e, D) => {
  const camX = lerp(380, 700, ease(prog(lt, 0.2, c(3) + 0.6)));
  const [sx, sy] = shake(lt, 12, e('knock')[0] || 99, 0.5);
  withCam(camX, 800, 1.05 + 0.08 * lt / D, () => {
    roomBg(1180);
    drawIntercom(220, 640, 0.9);
    ctx.save(); ctx.translate(sx, sy);
    door(640, 520, 300, 660, null, 0, C.wood);
    ctx.save(); ctx.translate(790, 850);
    ctx.rotate(0.55); rr(-210, -22, 420, 44, 4, C.plank, '#6b5034', 3); ctx.rotate(-1.1); rr(-210, -22, 420, 44, 4, C.plank, '#6b5034', 3);
    ctx.restore(); ctx.restore();
    // второй провод
    ctx.strokeStyle = '#6E778C'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(260, 780); ctx.lineTo(260, 1130); ctx.lineTo(700, 1130); ctx.lineTo(700, 1176); ctx.stroke();
    const hk = prog(lt, c(3), 0.8);
    if (hk > 0) {
      ctx.save(); glow(C.blue, 25); ctx.strokeStyle = C.blue; ctx.lineWidth = 7; ctx.setLineDash([22, 16]); ctx.lineDashOffset = -lt * 60;
      ctx.beginPath(); ctx.moveTo(260, 780); const L = 350 + 440 + 46, d = L * hk;
      if (d < 350) ctx.lineTo(260, 780 + d); else { ctx.lineTo(260, 1130); if (d < 790) ctx.lineTo(260 + d - 350, 1130); else { ctx.lineTo(700, 1130); ctx.lineTo(700, 1130 + d - 790); } }
      ctx.stroke(); ctx.restore();
    }
    tag('ВТОРОЙ ПРОВОД', 480, 1250, lt, c(3) + 0.3, C.blue, 28);
    drawDenis(440, 1180, 0.95, { pose: 'light', look: 8 });
    ctx.fillStyle = 'rgba(255,250,220,0.07)'; ctx.beginPath(); ctx.moveTo(540, 940); ctx.lineTo(960, 700); ctx.lineTo(960, 1150); ctx.fill();
  });
  tag('КЛАДОВКА', 760, 330, lt, c(0) + 0.6, C.yel, 30);
};
SC[5] = (lt, c, e, D) => {
  const rings = e('rings9');
  const n = rings.filter(r => lt >= r).length;
  const ringing = rings.some(r => lt >= r && lt < r + 0.55);
  const pick = e('pickup')[0] || 99;
  const camX = lerp(540, 1500, ease(prog(lt, c(3) - 0.1, 1.0)));
  withCam(camX, 820, 1.0, () => {
    roomBg(1180, '#141A2A', '#0F1420');
    ctx.fillStyle = '#0A0E17'; ctx.fillRect(1010, -2000, 60, 4000);
    ctx.fillStyle = 'rgba(160,180,230,0.07)'; ctx.fillRect(700, 300, 220, 300);
    drawIntercom(420, 620, 0.9, { led: ringing ? C.green : null });
    drawDenis(560, 1080, 1.0, { pose: 'sit', ears: true, fear: true });
    // сосед
    roomBgPart();
    drawIntercom(1640, 620, 0.9, { led: lt > pick ? C.red : (ringing ? C.green : null), hang: 0 });
    drawNeighbor(1450, 1180, 1.05, ease(prog(lt, pick - 0.45, 0.4)));
    if (lt > pick) waveform(1380, 660, 200, 120, lt, C.red);
  });
  if (n > 0 && lt < c(3)) tag(`ЗВОНОК ${n}/9`, 540, 300, lt, rings[0], n >= 9 ? C.red : C.green, 34);
  if (lt > c(3)) tag('КВ. 46', 540, 300, lt, c(3) + 0.6, C.yel, 34);
  function roomBgPart() { ctx.fillStyle = '#161C2D'; ctx.fillRect(1070, -2000, 1200, 3180); ctx.fillStyle = 'rgba(255,240,200,0.05)'; ctx.fillRect(1300, 300, 200, 280); }
};
SC[6] = (lt, c, e, D) => {
  const z = lerp(1.0, 1.55, ease(lt / D));
  withCam(540, 760, z, () => {
    roomBg(1180, '#2A3042', '#1E2230');
    ctx.fillStyle = 'rgba(200,210,230,0.08)'; ctx.fillRect(0, 0, 1080, 1180);
    door(300, 430, 480, 750, '46', 0.9, '#4A3A2E');
    ctx.save(); ctx.beginPath(); ctx.rect(300, 430, 380, 750); ctx.clip();
    ctx.fillStyle = '#323A4F'; ctx.fillRect(300, 430, 480, 750);
    ctx.fillStyle = 'rgba(210,220,240,0.12)'; ctx.fillRect(560, 480, 100, 200);
    const sw = Math.sin(lt * 2.4) * 0.45;
    drawIntercom(420, 640, 0.75, { hang: 1, swing: sw });
    rr(470, 1150, 50, 18, 8, '#7A6A8E'); rr(530, 1154, 50, 18, 8, '#7A6A8E');
    for (let i = 0; i < 30; i++) { ctx.globalAlpha = 0.25; circ(320 + hash(i) * 340, 450 + ((hash(i + 9) * 700 + lt * 20) % 700), 2.5, '#fff'); }
    ctx.globalAlpha = 1; ctx.restore();
  });
  stamp('ЖИЛЕЦ 46 — НЕТ', 540, 1190, lt, c(1) + 0.1);
};
SC[7] = (lt, c, e, D) => {
  ctx.fillStyle = C.bg2; ctx.fillRect(0, 0, W, H);
  sticker('ПРАВИЛО 2', 540, 270, lt, 0.05);
  const hp = pop(lt, c(1), 0.3);
  if (hp > 0) { ctx.save(); ctx.translate(250, 780); ctx.scale(hp, hp); drawIntercom(0, 0, 0.9, { led: C.red, hang: 0 }); ctx.restore(); waveform(170, 520, 160, 60, lt, C.red, hp); }
  const ap = prog(lt, c(2) - 0.2, 0.4);
  if (ap > 0) { ctx.strokeStyle = C.grey; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(380, 780); ctx.lineTo(380 + 160 * ap, 780); ctx.stroke();
    if (ap >= 1) { ctx.fillStyle = C.grey; ctx.beginPath(); ctx.moveTo(560, 780); ctx.lineTo(530, 760); ctx.lineTo(530, 800); ctx.fill(); } }
  rr(620, 400, 340, 760, 20, '#1E2638', C.line, 4);
  for (let f = 1; f <= 12; f++) {
    const col = (f - 1) % 2, row = 5 - Math.floor((f - 1) / 2);
    const x = 710 + col * 160, y = 480 + row * 120;
    const p = pop(lt, c(2) + (f - 1) * 0.07, 0.2); if (p <= 0) continue;
    ctx.save(); ctx.translate(x, y); ctx.scale(p, p);
    circ(0, 0, 50, '#2A3349', '#8892A8', 4); txt(String(f), 0, 2, 40, f === 12 ? C.yel : C.white, 900);
    if (f === 12) { const k = prog(lt, c(3) + 0.5, 0.25); ctx.strokeStyle = C.red; ctx.lineWidth = 12; glow(C.red, 20);
      ctx.beginPath(); ctx.moveTo(-50, -50); ctx.lineTo(-50 + 100 * k, -50 + 100 * k); ctx.moveTo(50, -50); ctx.lineTo(50 - 100 * k, -50 + 100 * k); ctx.stroke(); noGlow(); }
    ctx.restore();
  }
  if (lt > c(3) + 0.5) tag('ТВОЙ ЭТАЖ', 790, 1220, lt, c(3) + 0.6, C.red, 28);
};
SC[8] = (lt, c, e, D) => {
  const drop = e('drop')[0] || 99;
  if (lt < c(3)) {
    const hang = easeIn(prog(lt, drop, 0.35));
    const sw = hang >= 1 ? Math.sin((lt - drop) * 3) * 0.35 * Math.exp(-(lt - drop) * 0.4) : 0;
    withCam(540, 760, lerp(1.25, 1.5, lt / c(3)), () => {
      roomBg(1300, '#121827');
      drawIntercom(560, 620, 1.3, { led: lt > drop ? C.red : null, hang, swing: sw });
      ctx.fillStyle = 'rgba(229,56,59,0.07)'; ctx.fillRect(0, 0, 1080, 1300);
    });
    if (lt > c(2)) { waveform(200, 300, 680, 140, lt, C.red); tag('ГОЛОС: МАМА', 540, 430, lt, c(2) + 0.2, C.red, 32); }
  } else {
    const k = lt - c(3);
    withCam(540, 800, lerp(3.2, 3.6, k / 2), () => {
      ctx.fillStyle = '#0B0E16'; ctx.fillRect(0, 0, 2000, 2000);
      drawDenis(540, 1050, 1, { fear: true, look: -3, tint: 'rgba(200,30,40,0.35)' });
    });
    ctx.globalAlpha = 0.12 + 0.06 * Math.sin(lt * 12); ctx.fillStyle = C.red; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    waveform(240, 1180, 600, 70, lt, C.red, 0.9);
  }
};
SC[9] = (lt, c, e, D) => {
  const fall = e('fall')[0] || 99;
  const fk = easeIn(prog(lt, fall, 1.1));
  const fh = 120, base = 1960;
  const ny = lerp(base - 12 * fh - 120, base - 3 * fh + 55, fk);
  const camY = lt < fall ? base - 12 * fh + 100 : lerp(base - 12 * fh + 100, base - 3 * fh, ease(prog(lt, fall, 1.2)));
  withCam(540, camY, 1.05, () => {
    ctx.fillStyle = '#0A0D16'; ctx.fillRect(-2000, -2000, 6000, 6000);
    building(540, base, { labels: true, hl: 3, floorFill: f => f === 3 && fk >= 1 ? `rgba(229,56,59,${0.25 + 0.2 * Math.sin(lt * 14)})` : null });
    const p = pop(lt, c(0) + 0.5, 0.3);
    if (p > 0) { ctx.save(); ctx.translate(540, ny); ctx.scale(p, p); glow(C.yel, 50); txt('3', 0, 0, 200, C.yel, 900); noGlow(); ctx.restore(); }
  });
};
SC[10] = (lt, c, e, D) => {
  if (lt < c(2)) {
    const camX = lerp(320, 760, ease(prog(lt, 0, c(2))));
    withCam(camX, 820, 1.05, () => {
      roomBg(1180, '#252B3C', '#1B1F2B');
      ctx.fillStyle = 'rgba(200,210,230,0.06)'; ctx.fillRect(-500, 0, 2200, 1180);
      for (let i = 0; i < 4; i++) door(-100 + i * 380, 500, 280, 680, String(9 + i), lerp(0.2, 0.9, hash(i + 4)), '#4A3A2E');
      txt('3 ЭТАЖ', 540, 330, 40, C.grey, 800, 'center', 6);
      ctx.globalAlpha = 0.5; drawDenis(540, 1180, 1.0, { look: 4 }); ctx.globalAlpha = 1;
    });
    stamp('3 ЭТАЖ — 0 ЖИЛЬЦОВ', 540, 260, lt, c(1) + 0.2, C.red, 46);
  } else {
    withCam(540, 860, lerp(1.4, 1.75, prog(lt, c(2), 3)), () => {
      ctx.fillStyle = '#2A3043'; ctx.fillRect(0, 0, 1200, 2000);
      ctx.fillStyle = 'rgba(220,230,255,0.09)'; ctx.fillRect(650, 300, 260, 380);
      rr(150, 1000, 780, 40, 6, '#5E4A3A'); rr(190, 1040, 30, 300, 4, '#4A3A2E'); rr(860, 1040, 30, 300, 4, '#4A3A2E');
      rr(470, 880, 130, 120, 14, '#D7DDE6'); ctx.strokeStyle = '#D7DDE6'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(605, 940, 34, -1.3, 1.3); ctx.stroke();
      rr(482, 892, 106, 16, 6, '#7A4E2E');
      ctx.save(); ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let k = 0; k < 20; k++) { const y = 860 - k * 14, ph = (lt * 2 + i * 0.7); ctx.lineTo(500 + i * 34 + Math.sin(k * 0.5 + ph * 3) * 14, y - (lt * 30 % 14)); } ctx.globalAlpha = 0.6; ctx.stroke(); }
      ctx.restore();
    });
    tag('ЕЩЁ ТЁПЛЫЙ', 540, 330, lt, c(2) + 0.5, C.yel, 34);
    if (lt > c(3)) { ctx.save(); glow(C.red, 30); const p = pop(lt, c(3) + 0.5, 0.3); if (p > 0) { ctx.translate(540, 1150); ctx.scale(p, p); txt('ИЗ-ЗА МЕНЯ', 0, 0, 70, C.red, 900); } ctx.restore(); }
  }
};
SC[11] = (lt, c, e, D) => {
  const z = lerp(1.6, 0.62, ease(prog(lt, 0.4, 2.2)));
  const tk = (e('tick')[0] || 99);
  withCam(540, 1150, z, () => {
    ctx.fillStyle = C.bg2; ctx.fillRect(-3000, -3000, 8000, 8000);
    building(540, 1960, {
      labels: true, hl: 12, w: 560, fh: 120,
      floorFill: f => f === 3 ? 'rgba(5,7,12,0.92)' : (f === 12 && lt > c(4) ? `rgba(245,197,24,${0.18 + 0.1 * Math.sin(lt * 8)})` : null),
      win: (f, i) => f === 3 ? ['#000', 0] : (f === 12 && i === 2 ? [C.yel, 1] : (f === 12 && i === 1 ? ['#333', 0.5] : null))
    });
    if (lt > c(4)) tag('ТЫ ЗДЕСЬ · КВ. 47', 540, 1960 - 12 * 120 - 120, lt, c(4) + 0.3, C.yel, 40);
  });
  sticker('ПРАВИЛО 3', 540, 270, lt, 0.05);
  if (lt > c(3) - 0.2) {
    const left = lt > tk + 0.3 ? 10 : 11;
    const p = pop(lt, c(3) - 0.2, 0.3);
    ctx.save(); ctx.translate(540, 410); ctx.scale(p, p);
    rr(-260, -50, 520, 100, 10, 'rgba(10,14,24,0.9)', C.blue, 3);
    txt('ЭТАЖЕЙ ОСТАЛОСЬ:', -60, 0, 32, C.grey, 800);
    const fk = prog(lt, tk + 0.2, 0.25);
    txt(String(left), 190, 0, 60 * (1 + 0.3 * Math.sin(fk * Math.PI)), left === 10 ? C.red : C.white, 900);
    ctx.restore();
  }
};
SC[12] = (lt, c, e, D) => {
  const z = lerp(1.0, 1.5, ease(lt / D));
  ctx.fillStyle = '#05070B'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.beginPath(); ctx.arc(540, 800, 430, 0, Math.PI * 2); ctx.clip();
  withCam(540, 800, z, () => {
    ctx.fillStyle = '#2B2A28'; ctx.fillRect(0, 0, 1080, 1800);
    ctx.fillStyle = 'rgba(255,214,140,0.12)'; ctx.beginPath(); ctx.arc(540, 200, 500, 0, Math.PI * 2); ctx.fill();
    rr(150, 300, 330, 1000, 4, '#4A3A2E'); rr(600, 300, 330, 1000, 4, '#4A3A2E');
    ctx.fillStyle = '#030305'; ctx.fillRect(480, 300, 120, 1000);
    ctx.strokeStyle = '#A9A9A9'; ctx.lineWidth = 8; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(510 + i * 22, 700, 16, 10, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.save(); ctx.beginPath(); ctx.rect(480, 300, 120, 1000); ctx.clip();
    circ(560, 760, 70, '#E2AE8C'); circ(545, 740, 40, 'rgba(255,255,255,0.18)', '#E8E8E8', 6);
    const blink = (lt % 3.2) > 3.05 ? 0.2 : 1;
    ctx.save(); ctx.translate(545, 740); ctx.scale(1, blink); circ(0, 0, 18, '#111'); circ(-6, -6, 5, '#fff'); ctx.restore();
    ctx.fillStyle = '#C9CCD3'; ctx.fillRect(480, 660, 120, 40);
    ctx.fillStyle = C.robe; ctx.fillRect(480, 850, 120, 450);
    ctx.restore();
  });
  ctx.restore();
  ctx.strokeStyle = '#3A4256'; ctx.lineWidth = 18; circ(540, 800, 430, null, '#3A4256', 18);
  tag('ЗОЯ ПЕТРОВНА · 1 ЭТАЖ', 540, 300, lt, 0.3, C.grey, 28);
  tag('ПРОШЛЫЙ ЖИЛЕЦ — 11 НОЧЕЙ', 540, 1240, lt, c(3) + 0.2, C.yel, 32);
};
SC[13] = (lt, c, e, D) => {
  const nail = e('nail')[0] || 99;
  if (lt < c(2)) {
    const pk = ease(prog(lt, nail, 0.6));
    withCam(620, 780, 1.15, () => {
      roomBg(1180);
      door(560, 480, 320, 700, null, 0, C.wood);
      ctx.save(); ctx.translate(720, 830); ctx.rotate(-0.55 - pk * 0.12); ctx.translate(0, -pk * 20); rr(-220, -22, 440, 44, 4, C.plank, '#6b5034', 3); ctx.restore();
      ctx.save(); ctx.translate(720, 830); ctx.rotate(0.55); rr(-220, -22, 440, 44, 4, C.plank, '#6b5034', 3); ctx.restore();
      drawDenis(420, 1180, 1.05, { pose: 'pry', look: 8 });
    }, 0);
    tag('02:59', 540, 300, lt, 0.3, C.grey, 40);
  } else {
    const k = lt - c(2);
    const flick = k > 0.6 && (Math.floor(k * 14) % 3 === 0);
    ctx.fillStyle = '#06080D'; ctx.fillRect(0, 0, W, H);
    withCam(540, 800, lerp(1.0, 1.25, ease(k / 1.5)), () => {
      rr(330, 380, 420, 820, 50, '#111622', '#2D3448', 8);
      rr(355, 430, 370, 720, 28, '#1B2B4A');
      const time = k > 0.55 ? '03:00' : '02:59';
      txt(time, 540, 640, 130, time === '03:00' ? C.red : C.white, 800);
      txt('НОЧЬ 3', 540, 760, 34, C.grey, 700, 'center', 4);
    });
    if (flick) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); }
  }
};
SC[14] = (lt, c, e, D) => {
  const plank = e('plank')[0] || 99;
  if (lt < c(3)) {
    const blink = Math.floor(lt * 3) % 2 === 0;
    const scr = lt < c(2) ? 'ВЫЗОВ…' : 'КВ. 47';
    const [sx, sy] = shake(lt, 8, c(2) + 0.2, 0.6);
    withCam(560 + sx, 700 + sy, lt < c(2) ? lerp(1.7, 2.0, lt / c(2)) : 3.4, () => {
      roomBg(1300, '#141A2A');
      drawIntercom(560, 760, 1.6, { led: blink ? (lt > c(2) ? C.red : C.green) : null, screen: blink || lt < c(2) ? scr : '', screenSize: lt < c(2) ? 15 : 22 });
    });
    if (lt > c(1)) tag(lt < c(2) ? 'НЕ С УЛИЦЫ' : 'ВЫЗОВ: КВ. 47', 540, 300, lt, c(1) + 0.1, C.red, 40);
  } else {
    const k = lt - c(3);
    const fall = easeIn(prog(lt, plank, 0.45));
    const z = lt < c(4) ? lerp(1.0, 1.15, k) : lerp(1.2, 3.4, ease(prog(lt, c(4), D - c(4))));
    withCam(lt < c(4) ? 760 : lerp(760, 895, ease(prog(lt, c(4), D - c(4)))), lt < c(4) ? 860 : lerp(860, 790, ease(prog(lt, c(4), D - c(4)))), z, () => {
      roomBg(1180, '#0F1422', '#0A0E18');
      drawIntercom(220, 640, 0.9, { led: Math.floor(lt * 3) % 2 ? C.red : null });
      ctx.strokeStyle = '#6E778C'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(260, 780); ctx.lineTo(260, 1130); ctx.lineTo(700, 1130); ctx.lineTo(700, 1176); ctx.stroke();
      const op = lt > plank ? 0.12 + 0.05 * ease(prog(lt, plank, 3)) : 0.03;
      door(620, 480, 300, 700, null, 0, C.wood);
      // красный свет из щелей
      ctx.save(); glow(C.red, 50); ctx.fillStyle = C.red; ctx.fillRect(620, 1170, 300, 8 + op * 40);
      ctx.fillRect(620 + 300 * (1 - op), 480, 6 + op * 30, 700); ctx.restore();
      const gap = 46 * ease(prog(lt, plank + 0.5, 1.6));
      if (gap > 0) {
        ctx.fillStyle = '#020203'; ctx.fillRect(920 - gap, 480, gap, 700);
        ctx.save(); glow(C.red, 30); ctx.fillStyle = 'rgba(229,56,59,0.8)'; ctx.fillRect(920 - gap - 3, 480, 3, 700); ctx.restore();
        const a = prog(lt, c(4) + 0.3, 0.6), bl = (lt % 2.6) > 2.45 ? 0.15 : 1;
        ctx.save(); glow(C.red, 30); ctx.globalAlpha = a; ctx.translate(920 - gap / 2, 770); ctx.scale(1, bl);
        circ(-9, 0, 5.5, '#FF4B4E'); circ(9, 0, 5.5, '#FF4B4E'); ctx.restore();
      }
      ctx.save(); ctx.translate(770, 830); ctx.rotate(0.55); rr(-220, -22, 440, 44, 4, C.plank, '#6b5034', 3); ctx.restore();
      ctx.save(); ctx.translate(770 + fall * 60, 830 + fall * 330); ctx.rotate(-0.55 + fall * 1.0); rr(-220, -22, 440, 44, 4, C.plank, '#6b5034', 3); ctx.restore();
    });
    ctx.globalAlpha = 0.08 + 0.05 * Math.sin(lt * 7); ctx.fillStyle = C.red; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
};
function outro(lt, D) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const a = prog(lt, 0.3, 0.5);
  ctx.globalAlpha = a;
  txt('ЧАСТЬ 2', 540, 760, 44, C.grey, 700, 'center', 8);
  ctx.save(); glow(C.red, 40); txt('КТО В КЛАДОВКЕ?', 540, 860, 86, C.red, 900); ctx.restore();
  txt('ПОДПИШИСЬ, ЧТОБЫ НЕ ПРОПУСТИТЬ', 540, 1000, 30, C.white, 700, 'center', 2);
  ctx.globalAlpha = 1;
}

window.draw = function (t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); noGlow();
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const sc = TL.scenes.find(s => t >= s.t0 && t < s.t1);
  if (sc) {
    const lt = t - sc.t0, D = sc.t1 - sc.t0;
    const c = i => sc.cards[Math.min(i, sc.cards.length - 1)].t0 - sc.t0;
    const e = k => (sc.ev[k] || []).map(x => x - sc.t0);
    ctx.save();
    const tin = prog(lt, 0, 0.22);
    if (sc.id > 1 && tin < 1) { const z = lerp(1.07, 1, easeOut(tin)); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); }
    SC[sc.id](lt, c, e, D);
    ctx.restore();
    if (sc.id > 1 && tin < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - easeOut(tin)})`; ctx.fillRect(0, 0, W, H); }
    post(t);
    hud(sc.hud); chips(t);
    subtitles(t);
  } else {
    outro(t - TL.outroT0, TL.dur - TL.outroT0);
    post(t);
  }
};
