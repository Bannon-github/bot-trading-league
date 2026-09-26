/* Blitz Rush — boot, game loop, input and screen state machine */
'use strict';

(() => {
  const M = BR.meta, UI = BR.ui, $ = UI.$, audio = BR.audio;
  const canvas = $('game'), ctx = canvas.getContext('2d', { alpha: false });
  let W = 0, H = 0, dpr = 1;
  let state = 'menu';            // 'menu' | 'playing' | 'paused' | 'countdown' | 'over' | 'perk'
  let perkChoices = null, perkShownAt = 0, deathShot = null;
  let game = null, dailyRun = false, backdrop = new BR.Game.Backdrop();
  let overShownAt = 0, returnTo = 'menu', touchSeen = matchMedia('(pointer: coarse)').matches;
  const input = { jump: false, dive: false };
  const diveKeys = new Set(), divePointers = new Set();

  // ---------- public state for the league playtime tracker ----------
  window.BlitzRush = {
    version: '2.0.0',
    get state() { return state; },
    /** true only while a run is actively being played (not menus, pause, countdown or summary) */
    isPlaying: () => state === 'playing' && !document.hidden,
  };
  function setState(s) {
    if (s === state) return;
    state = s;
    // Drop focus from any clicked button so Space/Enter never re-activates it mid-run.
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    $('hudButtons').classList.toggle('hidden', !(s === 'playing' || s === 'countdown'));
    diveKeys.clear(); divePointers.clear(); input.dive = false; input.jump = false;
    window.dispatchEvent(new CustomEvent('blitzrush:state', { detail: { state: s } }));
  }

  // ---------- sizing ----------
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- audio settings ----------
  function applyAudioSettings() {
    const st = M.save.settings;
    audio.setMusic(st.music); audio.setSfx(st.sfx);
    $('btnMute').textContent = st.music || st.sfx ? '🔊' : '🔇';
  }
  function unlockAudio() { if (!audio.ready) { audio.init(); applyAudioSettings(); } else audio.resume(); }
  function toggleMute() {
    const st = M.save.settings, on = !(st.music || st.sfx);
    st.music = on; st.sfx = on; M.persist(); applyAudioSettings();
  }

  // ---------- run lifecycle ----------
  function startRun(daily = false) {
    unlockAudio();
    dailyRun = daily;
    const seed = daily ? M.dailySeed() : (Math.random() * 2 ** 31) | 0;
    const lo = M.loadout();
    lo.ghost = M.save.settings.ghost !== false ? M.getGhost(daily) : null;
    lo.bestDist = daily ? 0 : M.save.bestDist;
    deathShot = null; perkChoices = null;
    game = new BR.Game({
      seed, daily, loadout: lo, tutorial: M.save.tutorial < 2,
      hooks: { onTick: liveAchievements, onOver: endRun, onPerk: openPerk },
    });
    input.jump = false;
    UI.hideAll();
    setState('playing');
  }
  function liveAchievements(stats) {
    for (const a of M.checkAchievements(stats, false)) { UI.toast('🏆', a.name, `${a.desc} · +${a.reward} coins`); audio.sfx.achievement(); }
  }
  // ---------- perk picker (the run is frozen while it is open) ----------
  function openPerk(choices) {
    perkChoices = choices; perkShownAt = performance.now();
    UI.renderPerk(choices, game);
    UI.show('perk'); setState('perk');
    audio.sfx.perkOpen(); audio.setIntensity(0.1);
  }
  function pickPerk(i) {
    if (state !== 'perk' || !perkChoices || !perkChoices[i]) return;
    if (performance.now() - perkShownAt < 350) return;          // ignore a jump press that was already in flight
    game.applyPerk(perkChoices[i].id);
    perkChoices = null;
    UI.hideAll(); setState('playing');
  }
  $('mMissions').addEventListener('click', (e) => {
    const b = e.target.closest('[data-swap]'); if (!b) return;
    unlockAudio();
    if (M.swapMission(+b.dataset.swap)) { audio.sfx.buy(); UI.renderMenu(); } else audio.sfx.deny();
  });
  $('perkCards').addEventListener('click', (e) => {
    const b = e.target.closest('[data-perk]'); if (!b) return;
    const i = [...$('perkCards').children].indexOf(b); pickPerk(i);
  });
  // Snapshot of the crash (with the killer highlighted) for the summary screen.
  function captureDeath() {
    try {
      const c = document.createElement('canvas'), w = 320, h = Math.round(320 * H / W);
      c.width = w; c.height = h; c.getContext('2d').drawImage(canvas, 0, 0, w, h);
      deathShot = c.toDataURL('image/jpeg', 0.7);
    } catch (e) { deathShot = null; }
  }
  function endRun(stats) {
    M.save.tutorial++;
    const res = M.finishRun(stats, dailyRun);
    UI.renderOver(stats, res, dailyRun, deathShot);
    UI.show('over');
    overShownAt = performance.now();
    setState('over');
    audio.setIntensity(0.1);
    if (res.newBest) setTimeout(() => audio.sfx.newBest(), 350);
    else if (res.missionsDone.length || res.achievements.length) setTimeout(() => audio.sfx.achievement(), 350);
  }
  function pause() {
    if (state !== 'playing' && state !== 'countdown') return;
    clearTimeout(cdTimer);
    $('countdown').classList.add('hidden');
    UI.renderMissions($('pMissions'), game.stats);
    UI.show('pause');
    setState('paused');
    audio.setIntensity(0.05);
  }
  let cdTimer = 0;
  function resume() {
    if (state !== 'paused') return;
    unlockAudio();
    UI.hideAll(); setState('countdown');
    const cd = $('countdown'); let n = 3;
    const tick = () => {
      if (state !== 'countdown') return;
      if (n === 0) { cd.classList.add('hidden'); input.jump = false; setState('playing'); return; }
      cd.textContent = n; cd.classList.remove('hidden', 'tick'); void cd.offsetWidth; cd.classList.add('tick');
      audio.sfx.click(); n--; cdTimer = setTimeout(tick, 300);
    };
    tick();
  }
  function toMenu() { game = null; UI.show('menu'); setState('menu'); audio.setIntensity(0); backdrop = new BR.Game.Backdrop(); }
  const restart = () => startRun(dailyRun);

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (game && (state === 'playing' || state === 'over')) game.update(dt, input);
    if (game) {
      game.render(ctx, W, H, { touch: touchSeen, shake: M.save.settings.shake });
      if (!game.alive && !deathShot && game.dying > 0.45) captureDeath();
    } else backdrop.render(ctx, W, H, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- keyboard ----------
  const JUMP = ['Space', 'ArrowUp', 'KeyW'], DIVE = ['ArrowDown', 'KeyS', 'ShiftLeft', 'ShiftRight'];
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.code;
    if (JUMP.includes(k) || DIVE.includes(k) || k === 'Enter') e.preventDefault();
    unlockAudio();
    if (state === 'playing') {
      if (JUMP.includes(k) && !e.repeat) input.jump = true;
      if (DIVE.includes(k)) diveKeys.add(k);
      if (k === 'KeyP' || k === 'Escape') pause();
      if (k === 'KeyR') restart();
    } else if (state === 'perk') {
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[k];
      if (n != null && !e.repeat) pickPerk(n);
    } else if (state === 'paused') {
      if (k === 'KeyP' || k === 'Escape' || k === 'Enter' || k === 'Space') resume();
      if (k === 'KeyR') restart();
    } else if (state === 'over') {
      if (performance.now() - overShownAt > 450 && !e.repeat && (k === 'Space' || k === 'Enter' || k === 'KeyR') && !$('over').classList.contains('hidden')) restart();
      if (k === 'Escape') toMenu();
    } else if (state === 'menu') {
      if ((k === 'Space' || k === 'Enter') && !$('menu').classList.contains('hidden') && !e.repeat) startRun(false);
      if (k === 'Escape') UI.show('menu');
    }
    if (k === 'KeyM') toggleMute();
    input.dive = diveKeys.size > 0 || divePointers.size > 0;
  });
  window.addEventListener('keyup', (e) => { diveKeys.delete(e.code); input.dive = diveKeys.size > 0 || divePointers.size > 0; });

  // ---------- pointer (mouse + touch) on the canvas ----------
  canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    if (e.pointerType !== 'mouse') touchSeen = true;
    if (state !== 'playing') return;
    e.preventDefault();
    const isDive = e.pointerType === 'mouse' ? e.button === 2 : e.clientX < W * 0.5;
    if (isDive) divePointers.add(e.pointerId); else input.jump = true;
    input.dive = diveKeys.size > 0 || divePointers.size > 0;
  });
  const release = (e) => { divePointers.delete(e.pointerId); input.dive = diveKeys.size > 0 || divePointers.size > 0; };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault()); // iOS pinch-zoom

  // ---------- pause on blur / hidden tab ----------
  window.addEventListener('blur', () => { diveKeys.clear(); divePointers.clear(); input.dive = false; pause(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); audio.suspend(); } else if (audio.ready) audio.resume();
  });
  window.addEventListener('pagehide', pause);

  // ---------- buttons ----------
  const on = (id, fn) => $(id).addEventListener('click', (e) => { e.currentTarget.blur(); unlockAudio(); audio.sfx.click(); fn(e); });
  on('btnPlay', () => startRun(false));
  on('btnDaily', () => startRun(true));
  on('btnPause', pause);
  on('btnMute', toggleMute);
  on('btnResume', resume);
  on('btnRestartP', restart);
  on('btnQuit', toMenu);
  on('btnAgain', restart);
  on('btnMenuO', toMenu);
  on('btnShopO', () => { returnTo = 'over'; UI.show('shop'); });
  document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { unlockAudio(); audio.sfx.click(); returnTo = 'menu'; UI.show(b.dataset.open); }));
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => {
    audio.sfx.click();
    if (returnTo === 'over') { UI.show('over'); UI.updateBadges(); returnTo = 'menu'; } else UI.show('menu');
  }));
  document.querySelectorAll('#shop .tab').forEach((t) => t.addEventListener('click', () => { audio.sfx.click(); UI.setShopTab(t.dataset.tab); }));
  $('shopList').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    unlockAudio();
    let ok = false;
    if (b.dataset.buy) ok = M.buyUpgrade(b.dataset.buy);
    if (b.dataset.skinbtn) { const id = b.dataset.skinbtn; if (M.save.skins[id]) { M.selectSkin(id); ok = true; } else ok = M.buySkin(id); }
    ok ? audio.sfx.buy() : audio.sfx.deny();
    for (const a of M.checkAchievements(game ? game.stats : { dist: 0, coins: 0, maxCombo: 0, perfects: 0, stomps: 0, catTypes: 0, blitzes: 0, maxAir: 0, score: 0 }, false)) UI.toast('🏆', a.name, `+${a.reward} coins`);
    UI.renderShop();
  });
  const bindToggle = (id, key) => $(id).addEventListener('change', (e) => { M.save.settings[key] = e.target.checked; M.persist(); applyAudioSettings(); });
  bindToggle('setMusic', 'music'); bindToggle('setSfx', 'sfx'); bindToggle('setShake', 'shake');
  bindToggle('setGhost', 'ghost'); bindToggle('setHints', 'hints');
  $('btnReset').addEventListener('click', () => {
    if (confirm('Reset ALL Blitz Rush progress (coins, upgrades, records)? This cannot be undone.')) { M.reset(); applyAudioSettings(); UI.show('menu'); }
  });

  // Test hook (only with ?debug in the URL): lets automated tests inspect the live run.
  if (/[?&]debug\b/.test(location.search)) window.__br = { get game() { return game; }, get state() { return state; } };

  UI.show('menu');
  setState('menu');
  window.dispatchEvent(new CustomEvent('blitzrush:state', { detail: { state } }));
})();
