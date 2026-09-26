/* Nova Contrarian - audio (WebAudio) and juice (floating text, shake, particles, score animation). Classic scripts sharing one global scope; load order: data, core, fx, ui, goals, main. */
'use strict';
// ------------------------------------------------------------------ audio
var Snd = {
  ctx: null,
  init: function () {
    try {
      if (!this.ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
      if (this.ctx && this.ctx.state === 'suspended') { var p = this.ctx.resume(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) { this.ctx = null; }
  },
  ok: function () { return !M.mute && this.ctx && this.ctx.state === 'running'; },
  tone: function (f, d, type, vol, slide) {
    if (!this.ok()) return;
    try {
      var t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
      g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + d + 0.03);
    } catch (e) { /* ignore */ }
  },
  noise: function (d, vol) {
    if (!this.ok()) return;
    try {
      var n = Math.floor(this.ctx.sampleRate * d), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), ch = buf.getChannelData(0);
      for (var i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1800; src.buffer = buf; g.gain.value = vol || 0.05;
      src.connect(f); f.connect(g); g.connect(this.ctx.destination); src.start();
    } catch (e) { /* ignore */ }
  },
  shuffle: function () { var s = this; for (var i = 0; i < 5; i++) setTimeout(function () { s.noise(0.04, 0.05); }, i * 40); },
  coin: function () { var s = this; s.tone(988, 0.07, 'square', 0.04); setTimeout(function () { s.tone(1319, 0.14, 'square', 0.04); }, 70); },
  step: function (cls, i) {
    var base = 330 * Math.pow(1.06, Math.min(i, 30));
    if (cls === 'chips') this.tone(base, 0.07, 'triangle', 0.06);
    else if (cls === 'mult') this.tone(base * 1.5, 0.09, 'square', 0.035);
    else if (cls === 'xmult') { this.tone(base * 2, 0.16, 'sawtooth', 0.04, 1.5); }
    else if (cls === 'money') this.coin();
    else if (cls === 'debuff') this.tone(120, 0.12, 'square', 0.04, 0.6);
    else this.tone(base, 0.05, 'sine', 0.05);
  },
  win: function () { var s = this; [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { s.tone(f, 0.18, 'triangle', 0.06); }, i * 90); }); },
  lose: function () { var s = this; [392, 330, 262, 196].forEach(function (f, i) { setTimeout(function () { s.tone(f, 0.25, 'sawtooth', 0.04); }, i * 140); }); },
  big: function () { this.noise(0.5, 0.12); this.tone(80, 0.5, 'sine', 0.2, 0.5); }
};

// ------------------------------------------------------------------ juice
function dly(ms) { return hurry ? Math.min(ms, 25) : ms / (M.speed || 1); }
function floatText(target, txt, cls) {
  if (!target) return;
  var r = target.getBoundingClientRect(), e = document.createElement('div');
  e.className = 'float ' + (cls || ''); e.textContent = txt;
  e.style.left = Math.max(44, Math.min(innerWidth - 44, r.left + r.width / 2)) + 'px'; e.style.top = Math.max(62, r.top - 12) + 'px';
  document.body.appendChild(e);
  setTimeout(function () { e.remove(); }, 950);
}
function refEl(ref) {
  if (ref === 'base') return $('#hname');
  var p = ref.split(':');
  if (p[0] === 'card') return $('#playArea .card[data-id="' + p[1] + '"]') || $('.hand .card[data-id="' + p[1] + '"]');
  if (p[0] === 'bot') return $('.bots .bot[data-i="' + p[1] + '"]');
  return null;
}
function bumpEl(e) { if (!e) return; e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
function popEl(e) { if (!e) return; e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }
function setCM(c, m) {
  var ce = $('#chips'), me = $('#mult');
  if (ce && ce.textContent !== fmt(c)) { ce.textContent = fmt(c); bumpEl(ce); }
  if (me && me.textContent !== fmtM(m)) { me.textContent = fmtM(m); bumpEl(me); }
}
function countUp(elm, from, to, ms) {
  return new Promise(function (res) {
    if (!elm) return res();
    var dur = dly(ms);
    if (dur <= 30 || document.hidden) { elm.textContent = fmt(to); return res(); }
    var t0 = performance.now(), done = false;
    var guard = setTimeout(function () { if (!done) { done = true; elm.textContent = fmt(to); res(); } }, dur + 400);
    function f(t) {
      if (done) return;
      var k = Math.min(1, Math.max(0, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
      elm.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(f); else { done = true; clearTimeout(guard); res(); }
    }
    requestAnimationFrame(f);
  });
}
function screenShake(amp) {
  document.body.style.setProperty('--amp', amp.toFixed(1));
  document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake');
  setTimeout(function () { document.body.classList.remove('shake'); }, 480);
}
var parts = [], fxc = null, fxx = null, fxRunning = false;
function burst(x, y, n, colors) {
  if (!fxx) return;
  colors = colors || ['#22e6ff', '#8b5cff', '#ff4fa3', '#ffc94d'];
  for (var i = 0; i < n; i++) {
    var a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 7;
    parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, c: colors[i % colors.length], s: 2 + Math.random() * 3 });
  }
  if (parts.length > 600) parts = parts.slice(-600);
  if (!fxRunning) { fxRunning = true; requestAnimationFrame(fxLoop); }
}
function fxLoop() {
  var w = fxc.width, h = fxc.height, dpr = window.devicePixelRatio || 1;
  fxx.clearRect(0, 0, w, h);
  parts = parts.filter(function (p) { return p.life > 0; });
  parts.forEach(function (p) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.985; p.life -= 0.018;
    fxx.globalAlpha = Math.max(0, p.life); fxx.fillStyle = p.c;
    fxx.fillRect(p.x * dpr, p.y * dpr, p.s * dpr, p.s * dpr);
  });
  fxx.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(fxLoop); else { fxRunning = false; fxx.clearRect(0, 0, w, h); }
}
function resizeFx() { if (!fxc) return; var dpr = window.devicePixelRatio || 1; fxc.width = innerWidth * dpr; fxc.height = innerHeight * dpr; }

async function animateHand(x, played) {
  var pa = $('#playArea'), hs = $('#handScore');
  $$('.card,.play-hint', pa).forEach(function (e) { e.remove(); });
  played.forEach(function (c, i) {
    var e = cardEl(c, {});
    if (x.scoring.indexOf(c) < 0) e.classList.add('out'); else e.classList.add('scoring');
    e.style.setProperty('--i', i);
    pa.appendChild(e);
  });
  Snd.tone(440, 0.06, 'triangle', 0.05);
  await sleep(dly(420));
  var i = 0;
  for (var k = 0; k < x.steps.length; k++) {
    var s = x.steps[k];
    setCM(s.c, s.m);
    var t = refEl(s.ref);
    if (s.ref === 'base') $('#hname').innerHTML = esc(HT[x.type].name) + ' <small>Lv' + (S.levels[x.type]) + '</small>';
    else { popEl(t); if (!hurry) floatText(t, s.txt, s.cls); }
    if (!hurry) Snd.step(s.cls, i++);
    await sleep(dly(s.cls === 'base' ? 320 : s.cls === 'xmult' ? 330 : 240));
  }
  hs.classList.add('show');
  var ratio = x.score / Math.max(1, S.target);
  Snd.tone(220 + Math.min(600, ratio * 500), 0.25, 'sawtooth', 0.05, 2);
  await countUp(hs, 0, x.score, 550);
  if (ratio >= 0.35) {
    screenShake(Math.min(16, 3 + ratio * 9));
    var r = pa.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, Math.min(140, 20 + Math.floor(ratio * 60)));
    if (ratio >= 1) Snd.big();
  }
  var rs = $('#rscore');
  await countUp(rs, S.roundScore, S.roundScore + x.score, 450);
  var bar = $('.score-box .bar i'); if (bar) bar.style.width = Math.min(100, (S.roundScore + x.score) / S.target * 100) + '%';
  await sleep(dly(350));
  hs.classList.remove('show');
}

function toast(msg) {
  var t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 1800);
}
