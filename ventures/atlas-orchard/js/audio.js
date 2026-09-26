/* Atlas Orchard - WebAudio synthesized SFX + gentle generative music. No audio files. */
(function () {
  'use strict';
  var ctx = null, master = null, sfxBus = null, musBus = null, rev = null, noiseBuf = null;
  var musicOn = true, sfxOn = true, nextT = 0, step = 0, key = 0, melIdx = 4, timer = null, duckV = 1;
  var BPM = 76, EIGHTH = 60 / BPM / 2;
  // Cmaj7, Am7, Fmaj7, G7 (semitones relative to C4)
  var PROG = [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 5]];
  var PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  function f(semi) { return 261.63 * Math.pow(2, semi / 12); }

  function impulse(sec) {
    var len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return b;
  }
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(function () {}); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = 0.9;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    rev = ctx.createConvolver(); rev.buffer = impulse(2.4);
    var rg = ctx.createGain(); rg.gain.value = 0.3; rev.connect(rg); rg.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.6 : 0; sfxBus.connect(master);
    var ss = ctx.createGain(); ss.gain.value = 0.18; sfxBus.connect(ss); ss.connect(rev);
    musBus = ctx.createGain(); musBus.gain.value = musicOn ? 0.24 : 0;
    var mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 2800;
    musBus.connect(mlp); mlp.connect(master); mlp.connect(rev);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var nd = noiseBuf.getChannelData(0); for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    nextT = ctx.currentTime + 0.15;
    timer = setInterval(schedule, 90);
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
  }
  function tone(freq, dur, o) {
    if (!ctx) return;
    o = o || {};
    var t = o.when != null ? o.when : ctx.currentTime + 0.005;
    var osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    var g = ctx.createGain(), a = o.attack || 0.005, v = o.vol || 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.02));
    var node = osc;
    if (o.filter) { var bq = ctx.createBiquadFilter(); bq.type = 'lowpass'; bq.frequency.value = o.filter; osc.connect(bq); node = bq; }
    node.connect(g); g.connect(o.dest || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.1);
  }
  function noise(dur, o) {
    if (!ctx) return;
    o = o || {};
    var t = o.when != null ? o.when : ctx.currentTime + 0.005;
    var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var bq = ctx.createBiquadFilter(); bq.type = o.ftype || 'lowpass'; bq.frequency.setValueAtTime(o.freq || 1000, t);
    bq.Q.value = o.q || 0.7;
    if (o.fslide) bq.frequency.exponentialRampToValueAtTime(o.fslide, t + dur);
    var g = ctx.createGain(), a = o.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq); bq.connect(g); g.connect(o.dest || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  function now() { return ctx ? ctx.currentTime + 0.005 : 0; }

  var lastHarvest = 0;
  var sfx = {
    plant: function () { tone(210, 0.14, { type: 'triangle', vol: 0.22, slide: 340 }); noise(0.09, { freq: 900, vol: 0.1 }); },
    merge: function (combo) {
      var c = Math.min(combo || 1, 9), b = f(12 + [0, 2, 4, 7, 9, 12, 14, 16, 19][c - 1]), t = now();
      tone(b, 0.2, { type: 'triangle', vol: 0.2, when: t });
      tone(b * 1.26, 0.2, { type: 'triangle', vol: 0.18, when: t + 0.06 });
      tone(b * 1.5, 0.35, { type: 'triangle', vol: 0.18, when: t + 0.12 });
      tone(b * 2, 0.5, { type: 'sine', vol: 0.08, when: t + 0.12 });
      noise(0.12, { freq: 5000, ftype: 'highpass', vol: 0.04, when: t + 0.1 });
    },
    harvest: function (streak) {
      if (!ctx) return;
      var t = now(); if (t - lastHarvest < 0.03) return; lastHarvest = t;
      var n = PENTA[Math.min(streak || 0, 10)];
      tone(f(12 + n), 0.16, { type: 'sine', vol: 0.2 });
      tone(f(24 + n), 0.1, { type: 'triangle', vol: 0.04 });
    },
    tick: function () { tone(1800 + Math.random() * 300, 0.04, { type: 'sine', vol: 0.035 }); },
    gold: function () { var t = now(); [0, 4, 7, 12, 16, 19].forEach(function (s, i) { tone(f(19 + s), 0.25, { type: 'sine', vol: 0.12, when: t + i * 0.045 }); }); },
    squash: function () { noise(0.1, { freq: 1600, ftype: 'bandpass', q: 2, vol: 0.35 }); tone(160, 0.1, { type: 'square', vol: 0.06, slide: 60, filter: 900 }); },
    warn: function () { var t = now(); for (var i = 0; i < 2; i++) { tone(660, 0.12, { type: 'square', vol: 0.05, filter: 1600, when: t + i * 0.3 }); tone(880, 0.12, { type: 'square', vol: 0.05, filter: 1600, when: t + i * 0.3 + 0.13 }); } },
    thunder: function () { noise(1.8, { freq: 500, fslide: 60, vol: 0.55, attack: 0.02 }); tone(55, 1.2, { type: 'sine', vol: 0.35, slide: 32 }); },
    wind: function () { noise(2.2, { freq: 300, fslide: 1200, ftype: 'bandpass', q: 1.5, vol: 0.12, attack: 0.8 }); },
    stake: function () { tone(320, 0.08, { type: 'triangle', vol: 0.2, slide: 250 }); noise(0.05, { freq: 3000, ftype: 'bandpass', vol: 0.1 }); },
    water: function () { var t = now(); tone(900, 0.1, { type: 'sine', vol: 0.12, slide: 500, when: t }); tone(1200, 0.1, { type: 'sine', vol: 0.09, slide: 700, when: t + 0.07 }); },
    deny: function () { var t = now(); tone(200, 0.12, { type: 'square', vol: 0.05, filter: 700, when: t }); tone(150, 0.16, { type: 'square', vol: 0.05, filter: 700, when: t + 0.1 }); },
    click: function () { tone(760, 0.04, { type: 'triangle', vol: 0.08 }); },
    lose: function () { tone(330, 0.3, { type: 'sawtooth', vol: 0.06, slide: 110, filter: 900 }); },
    sell: function () { var t = now(); [0, 5, 9].forEach(function (s, i) { tone(f(24 + s), 0.08, { type: 'square', vol: 0.03, filter: 3000, when: t + i * 0.05 }); }); },
    achievement: function () { var t = now(); [0, 4, 7, 12].forEach(function (s, i) { tone(f(12 + s), 0.3, { type: 'triangle', vol: 0.14, when: t + i * 0.09 }); }); tone(f(24), 0.8, { type: 'sine', vol: 0.08, when: t + 0.36 }); },
    star: function (i) { tone(f(12 + [0, 4, 7][i % 3] + 12 * Math.floor(i / 3)), 0.6, { type: 'sine', vol: 0.16 }); tone(f(24 + [0, 4, 7][i % 3]), 0.4, { type: 'triangle', vol: 0.04 }); },
    boom: function () { tone(220, 0.6, { type: 'sawtooth', vol: 0.05, slide: 880, filter: 2000 }); var t = now(); [0, 4, 7, 12].forEach(function (s, i) { tone(f(12 + s), 0.2, { type: 'triangle', vol: 0.1, when: t + 0.35 + i * 0.07 }); }); },
    buzz: function () { tone(180, 0.6, { type: 'sawtooth', vol: 0.025, filter: 700, slide: 210 }); },
    season: function () { var t = now(); [0, 7, 12, 16].forEach(function (s, i) { tone(f(s), 0.7, { type: 'triangle', vol: 0.1, when: t + i * 0.12, attack: 0.02 }); }); },
    pop: function () { tone(500 + Math.random() * 200, 0.07, { type: 'sine', vol: 0.1, slide: 900 }); }
  };

  function pad(freq, dur, t) {
    var g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * duckV, t + 0.7);
    g.gain.setValueAtTime(0.05 * duckV, t + dur - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.9);
    [0, 7].forEach(function (d) {
      var o = ctx.createOscillator(); o.type = d ? 'sine' : 'triangle'; o.frequency.value = freq; o.detune.value = d;
      o.connect(lp); o.start(t); o.stop(t + dur + 1);
    });
    lp.connect(g); g.connect(musBus);
  }
  function playStep(s, t) {
    var bar = Math.floor(s / 8) % 4, beat = s % 8, ch = PROG[bar];
    if (beat === 0) {
      ch.forEach(function (n) { pad(f(n + key - 12), EIGHTH * 8, t); });
      tone(f(ch[0] + key - 24), EIGHTH * 3, { type: 'sine', vol: 0.16 * duckV, when: t, attack: 0.02, dest: musBus });
      if (Math.random() < 0.35) tone(f(PENTA[5 + Math.floor(Math.random() * 5)] + key + 12), 1.5, { type: 'sine', vol: 0.025, when: t + EIGHTH * 2, dest: musBus });
    }
    if (beat === 4) tone(f(ch[0] + key - 17), EIGHTH * 3, { type: 'sine', vol: 0.12 * duckV, when: t, attack: 0.02, dest: musBus });
    if (beat % 2 === 1) noise(0.035, { freq: 7000, ftype: 'highpass', vol: 0.018 * duckV, when: t, dest: musBus });
    var p = beat % 2 === 0 ? 0.55 : 0.2;
    if (Math.random() < p) {
      melIdx += Math.floor(Math.random() * 5) - 2;
      if (melIdx < 2) melIdx = 3; if (melIdx > 9) melIdx = 7;
      var n = PENTA[melIdx] + key;
      tone(f(n), EIGHTH * 1.8, { type: 'triangle', vol: 0.07 * duckV, when: t, attack: 0.01, dest: musBus });
      tone(f(n + 12), EIGHTH * 1.2, { type: 'sine', vol: 0.015 * duckV, when: t, attack: 0.01, dest: musBus });
    }
  }
  function schedule() {
    if (!ctx) return;
    if (!musicOn || ctx.state !== 'running') { nextT = ctx.currentTime + 0.1; return; }
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.35) { playStep(step, nextT); nextT += EIGHTH; step++; }
  }
  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(function () {}); else ctx.resume().catch(function () {});
  });

  window.AudioSys = {
    init: init,
    sfx: sfx,
    setMusic: function (on) { musicOn = on; if (musBus) musBus.gain.setTargetAtTime(on ? 0.24 : 0, ctx.currentTime, 0.1); },
    setSfx: function (on) { sfxOn = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.05); },
    setKey: function (k) { key = k; },
    duck: function (v) { duckV = v; },
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; }
  };
})();
