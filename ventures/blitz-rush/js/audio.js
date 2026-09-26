/* Blitz Rush — procedural audio: synth SFX + a light step-sequenced music loop (Web Audio only, no files) */
'use strict';

BR.audio = (() => {
  let ctx = null, master, sfxBus, musicBus, musicFilter, noiseBuf;
  const settings = { music: true, sfx: true };
  const mus = { playing: false, step: 0, nextTime: 0, timer: null, intensity: 0, tempo: 118, blitz: false };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx ? 0.55 : 0; sfxBus.connect(master);
    musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 1400;
    musicBus = ctx.createGain(); musicBus.gain.value = settings.music ? 0.32 : 0;
    musicBus.connect(musicFilter); musicFilter.connect(master);
    // One second of white noise, reused for hats / crashes.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  }

  function setMusic(on) { settings.music = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.05); }
  function setSfx(on) { settings.sfx = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05); }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  // ---------- low-level voices ----------
  function tone(freq, dur, { type = 'square', vol = 0.3, slide = 0, attack = 0.005, when = 0, bus = null, filter = 0 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
    node.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, { vol = 0.3, type = 'highpass', freq = 6000, when = 0, bus = null, sweep = 0 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // ---------- SFX ----------
  const semis = (base, n) => base * Math.pow(2, n / 12);
  const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
  const sfx = {
    jump() { tone(260, 0.16, { type: 'square', vol: 0.18, slide: 2.2, filter: 3000 }); },
    airJump() { tone(420, 0.14, { type: 'square', vol: 0.15, slide: 1.8, filter: 3500 }); tone(840, 0.08, { type: 'sine', vol: 0.1, when: 0.03 }); },
    coin(chain = 0) {
      const n = PENTA[Math.min(chain, PENTA.length - 1)];
      tone(semis(880, n), 0.09, { type: 'square', vol: 0.09, filter: 5000 });
      tone(semis(1320, n), 0.12, { type: 'sine', vol: 0.08, when: 0.04 });
    },
    perfect(combo = 1) {
      const base = semis(523, Math.min(combo, 12));
      [0, 4, 7, 12].forEach((s, i) => tone(semis(base, s), 0.14, { type: 'triangle', vol: 0.16, when: i * 0.045 }));
    },
    land() { noise(0.08, { vol: 0.12, type: 'lowpass', freq: 900 }); },
    rough() { tone(140, 0.18, { type: 'sawtooth', vol: 0.18, slide: 0.5, filter: 800 }); noise(0.15, { vol: 0.15, type: 'lowpass', freq: 600 }); },
    stomp() { tone(180, 0.2, { type: 'square', vol: 0.22, slide: 0.4, filter: 1500 }); tone(660, 0.12, { type: 'square', vol: 0.12, when: 0.05, slide: 1.5 }); },
    powerup() { [0, 5, 7, 12, 17, 24].forEach((s, i) => tone(semis(440, s), 0.1, { type: 'square', vol: 0.1, when: i * 0.04, filter: 4000 })); },
    shieldBreak() { noise(0.35, { vol: 0.3, type: 'bandpass', freq: 3000, sweep: 400 }); tone(900, 0.3, { type: 'triangle', vol: 0.15, slide: 0.3 }); },
    hit() { noise(0.5, { vol: 0.45, type: 'lowpass', freq: 2000, sweep: 100 }); tone(200, 0.5, { type: 'sawtooth', vol: 0.25, slide: 0.2, filter: 1200 }); },
    fall() { tone(600, 0.9, { type: 'triangle', vol: 0.22, slide: 0.12 }); },
    blitz() { [0, 7, 12, 19, 24].forEach((s, i) => tone(semis(330, s), 0.25, { type: 'sawtooth', vol: 0.1, when: i * 0.06, filter: 3500 })); noise(0.6, { vol: 0.15, type: 'highpass', freq: 2000, sweep: 9000 }); },
    click() { tone(1200, 0.04, { type: 'square', vol: 0.08, filter: 4000 }); },
    buy() { tone(988, 0.08, { type: 'square', vol: 0.12 }); tone(1319, 0.2, { type: 'square', vol: 0.12, when: 0.08 }); },
    deny() { tone(160, 0.15, { type: 'square', vol: 0.12 }); tone(120, 0.2, { type: 'square', vol: 0.12, when: 0.1 }); },
    achievement() { [0, 4, 7, 11, 14].forEach((s, i) => tone(semis(659, s), 0.18, { type: 'triangle', vol: 0.14, when: i * 0.07 })); },
    newBest() { [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone(semis(523, s), 0.16, { type: 'square', vol: 0.1, when: i * 0.09, filter: 3500 })); },
    tick() { tone(1800, 0.02, { type: 'square', vol: 0.04 }); },
  };

  // ---------- Music: 16-step loop, Am-F-C-G, intensity layers ----------
  const ROOTS = [57, 53, 48, 55]; // A3 F3 C3 G3 (midi)
  const CHORDS = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const ARP = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 3, 2, 1, 0, 2];

  function startMusic() {
    if (!ctx || mus.timer) return;
    mus.playing = true; mus.step = 0; mus.nextTime = ctx.currentTime + 0.1;
    mus.timer = setInterval(schedule, 25);
  }
  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    const spb = 60 / mus.tempo / 4; // sixteenth notes
    while (mus.nextTime < ctx.currentTime + 0.12) {
      playStep(mus.step, mus.nextTime - ctx.currentTime);
      mus.nextTime += spb; mus.step = (mus.step + 1) % 64;
    }
  }
  function playStep(step, when) {
    if (!settings.music) return;
    const bar = Math.floor(step / 16), s = step % 16, I = mus.intensity;
    const root = ROOTS[bar], chord = CHORDS[bar];
    // bass: pulsing eighths
    if (s % 2 === 0) tone(mtof(root - 12 + (s === 14 ? 12 : 0)), 0.18, { type: 'sawtooth', vol: 0.22, when, filter: 500 + I * 900, bus: musicBus });
    // kick
    if (I > 0.05 && s % 4 === 0) tone(120, 0.16, { type: 'sine', vol: 0.5, slide: 0.35, when, bus: musicBus });
    // snare on 2 & 4
    if (I > 0.3 && (s === 4 || s === 12)) noise(0.12, { vol: 0.2, type: 'bandpass', freq: 1800, when, bus: musicBus });
    // hats
    if (I > 0.05 && s % 2 === 1) noise(0.03, { vol: 0.08 + I * 0.06, type: 'highpass', freq: 8000, when, bus: musicBus });
    // arp
    const idx = ARP[s] % 3, oct = ARP[s] === 3 ? 12 : 0;
    const arpVol = 0.05 + I * 0.05;
    if (I > 0.15 || s % 2 === 0) tone(mtof(root + 12 + chord[idx] + oct), 0.12, { type: 'triangle', vol: arpVol, when, bus: musicBus });
    // lead in Blitz mode
    if (mus.blitz && s % 4 === 2) tone(mtof(root + 24 + chord[(s / 4 | 0) % 3]), 0.2, { type: 'square', vol: 0.05, when, filter: 3000, bus: musicBus });
  }
  // intensity 0..1 (menus ~0, running increases with speed); tempo follows
  function setIntensity(i, blitz = false) {
    mus.intensity = Math.max(0, Math.min(1, i));
    mus.tempo = 112 + mus.intensity * 34;
    mus.blitz = blitz;
    if (musicFilter) musicFilter.frequency.setTargetAtTime(blitz ? 5000 : 900 + mus.intensity * 2600, ctx.currentTime, 0.2);
  }

  return { init, sfx, setMusic, setSfx, setIntensity, suspend, resume, settings, get ready() { return !!ctx; } };
})();
