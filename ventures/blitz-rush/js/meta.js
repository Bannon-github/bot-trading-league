/* Blitz Rush — meta-progression: save data, upgrades, skins, missions, achievements, leaderboard */
'use strict';

BR.meta = (() => {
  const { store, todayKey, hashStr, rng } = BR.util;
  const SAVE_KEY = 'blitzRush.save.v1';

  // ---------------- Definitions ----------------
  const UPGRADES = [
    { id: 'rocket', name: 'Earnings Rocket', icon: '🚀', max: 6, base: 120, growth: 1.7, desc: (l) => `Rocket lasts ${(2.5 + 0.5 * l).toFixed(1)}s` },
    { id: 'magnet', name: 'Liquidity Magnet', icon: '🧲', max: 6, base: 100, growth: 1.7, desc: (l) => `Magnet lasts ${7 + 1.5 * l}s` },
    { id: 'lever', name: '2x Leverage', icon: '✖️', max: 6, base: 110, growth: 1.7, desc: (l) => `2x score lasts ${8 + 2 * l}s` },
    { id: 'coinVal', name: 'Dividends', icon: '💰', max: 8, base: 150, growth: 1.6, desc: (l) => `+${15 * l}% coins banked` },
    { id: 'blitz', name: 'Blitz Charge', icon: '⚡', max: 5, base: 180, growth: 1.75, desc: (l) => `Blitz meter +${12 * l}% fill, +${(0.5 * l).toFixed(1)}s` },
    { id: 'luck', name: 'Catalyst Luck', icon: '🍀', max: 5, base: 160, growth: 1.75, desc: (l) => `Catalysts ${15 * l}% more often` },
    { id: 'head', name: 'IPO Pop', icon: '🎉', max: 5, base: 300, growth: 1.8, desc: (l) => l ? `Start with a ${(1.5 + 1.2 * l).toFixed(1)}s rocket` : 'Start each run with a rocket' },
    { id: 'hedge', name: 'Hedge', icon: '🛡️', max: 1, base: 900, growth: 1, desc: (l) => l ? 'Start every run shielded' : 'Start every run with a shield' },
    { id: 'legs', name: 'Extra Leg', icon: '🦵', max: 2, base: 1500, growth: 3.2, desc: (l) => `${1 + l} air jump${l ? 's' : ''}` },
  ];
  const upgradeCost = (u, lvl) => Math.round(u.base * Math.pow(u.growth, lvl) / 10) * 10;

  const SKINS = [
    { id: 'blitz', name: 'Blitz', cost: 0, color: '#ffd23f', accent: '#ff8c1a', trail: '#ffd23f', perk: 'The original momentum trader.' },
    { id: 'bull', name: 'Raging Bull', cost: 600, color: '#ff6b3d', accent: '#fff1d6', trail: '#ff6b3d', perk: '+12% jump height', jump: 1.12 },
    { id: 'diamond', name: 'Diamond Hands', cost: 1500, color: '#7df9ff', accent: '#ffffff', trail: '#7df9ff', perk: 'Starts every run shielded', shield: true },
    { id: 'whale', name: 'The Whale', cost: 3000, color: '#4d8dff', accent: '#bfe0ff', trail: '#4d8dff', perk: '+25% coins', coins: 1.25 },
    { id: 'mooncat', name: 'Moon Cat', cost: 6000, color: '#b57bff', accent: '#ffe7ff', trail: '#d6a8ff', perk: '+1 air jump', airJumps: 1 },
    { id: 'ape', name: 'Degen Ape', cost: 10000, color: '#8b5a2b', accent: '#ffcf99', trail: '#ff4fd8', perk: 'Blitz meter fills 30% faster', blitz: 1.3 },
    { id: 'satoshi', name: 'Satoshi Gold', cost: 20000, color: '#ffe066', accent: '#fff9d9', trail: '#fff2a8', perk: '+20% score', score: 1.2 },
  ];

  const RANKS = ['Intern', 'Analyst', 'Associate', 'Trader', 'Senior Trader', 'Vice President', 'Portfolio Manager',
    'Managing Director', 'Hedge Fund Legend', 'Market Wizard'];
  const rankName = (r) => r < RANKS.length ? RANKS[r] : `Market Wizard ${r - RANKS.length + 2}`;

  // Missions: `stat` for per-run values (run.stats[key]), `total` for cumulative progress across runs.
  const MISSIONS = [
    { id: 'coinsRun', stat: 'coins', text: (n) => `Collect ${n} coins in one run`, n: (L) => 30 + L * 25 },
    { id: 'distRun', stat: 'dist', text: (n) => `Reach ${n.toLocaleString()} m in one run`, n: (L) => 300 + L * 250 },
    { id: 'perfRun', stat: 'perfects', text: (n) => `Land ${n} Perfect landings in one run`, n: (L) => 3 + L * 2 },
    { id: 'comboRun', stat: 'maxCombo', text: (n) => `Reach a ${n}-chain combo`, n: (L) => 3 + L * 2 },
    { id: 'stompRun', stat: 'stomps', text: (n) => `Stomp ${n} bear${n > 1 ? 's' : ''} in one run`, n: (L) => 1 + L },
    { id: 'catRun', stat: 'catalysts', text: (n) => `Grab ${n} catalysts in one run`, n: (L) => 2 + Math.ceil(L / 1.5) },
    { id: 'scoreRun', stat: 'score', text: (n) => `Score $${n.toLocaleString()} in one run`, n: (L) => 2000 + L * 2500 },
    { id: 'blitzRun', stat: 'blitzes', text: (n) => `Trigger Blitz Mode ${n}x in one run`, n: (L) => 1 + Math.floor(L / 3) },
    { id: 'airRun', stat: 'maxAir', text: (n) => `Stay airborne ${n}s in one jump`, n: (L) => Math.min(6, 1.5 + L * 0.35).toFixed(1) * 1 },
    { id: 'coinsTot', total: 'coins', text: (n) => `Collect ${n} coins (any runs)`, n: (L) => 200 + L * 150 },
    { id: 'distTot', total: 'dist', text: (n) => `Travel ${n.toLocaleString()} m (any runs)`, n: (L) => 2000 + L * 1500 },
    { id: 'stompTot', total: 'stomps', text: (n) => `Stomp ${n} bears (any runs)`, n: (L) => 5 + L * 3 },
    { id: 'perfTot', total: 'perfects', text: (n) => `Land ${n} Perfects (any runs)`, n: (L) => 15 + L * 8 },
    { id: 'daily', stat: 'daily', text: () => `Play a Daily Challenge run`, n: () => 1 },
  ];
  const missionReward = (L) => 40 + L * 20;

  // Achievements: check(run stats, save) -> bool. Checked live during runs and at run end.
  const ACHIEVEMENTS = [
    { id: 'first', name: 'Market Open', desc: 'Finish your first run', reward: 25, end: true, check: (r) => true },
    { id: 'd1k', name: 'Breakout', desc: 'Reach 1,000 m', reward: 50, check: (r) => r.dist >= 1000 },
    { id: 'd3k', name: 'Bull Run', desc: 'Reach 3,000 m', reward: 150, check: (r) => r.dist >= 3000 },
    { id: 'd6k', name: 'Supercycle', desc: 'Reach 6,000 m', reward: 400, check: (r) => r.dist >= 6000 },
    { id: 'd10k', name: 'To The Moon', desc: 'Reach 10,000 m', reward: 1000, check: (r) => r.dist >= 10000 },
    { id: 'c100', name: 'Bag Holder', desc: 'Collect 100 coins in one run', reward: 100, check: (r) => r.coins >= 100 },
    { id: 'c300', name: 'Deep Pockets', desc: 'Collect 300 coins in one run', reward: 300, check: (r) => r.coins >= 300 },
    { id: 'combo10', name: 'Momentum', desc: 'Reach a 10-chain combo', reward: 100, check: (r) => r.maxCombo >= 10 },
    { id: 'combo25', name: 'Parabolic', desc: 'Reach a 25-chain combo', reward: 400, check: (r) => r.maxCombo >= 25 },
    { id: 'perf10', name: 'Sticking It', desc: '10 Perfect landings in one run', reward: 150, check: (r) => r.perfects >= 10 },
    { id: 'stomp5', name: 'Bear Hunter', desc: 'Stomp 5 bears in one run', reward: 150, check: (r) => r.stomps >= 5 },
    { id: 'allCat', name: 'Diversified', desc: 'Use all 4 catalyst types in one run', reward: 200, check: (r) => r.catTypes >= 4 },
    { id: 'blitz3', name: 'Blitzkrieg', desc: 'Trigger Blitz Mode 3x in one run', reward: 250, check: (r) => r.blitzes >= 3 },
    { id: 'air3', name: 'Hang Time', desc: 'Stay airborne 3 seconds', reward: 100, check: (r) => r.maxAir >= 3 },
    { id: 's100k', name: 'Six Figures', desc: 'Score $100,000 in one run', reward: 500, check: (r) => r.score >= 100000 },
    { id: 'bank5k', name: 'Accredited', desc: 'Earn 5,000 coins lifetime', reward: 250, check: (r, s) => s.stats.coins >= 5000 },
    { id: 'skin', name: 'New Look', desc: 'Unlock a character', reward: 100, check: (r, s) => Object.keys(s.skins).length >= 2 },
    { id: 'maxUp', name: 'Fully Loaded', desc: 'Max out any upgrade', reward: 300, check: (r, s) => UPGRADES.some((u) => (s.upgrades[u.id] || 0) >= u.max) },
    { id: 'daily', name: 'Daily Grind', desc: 'Beat a Daily Challenge target', reward: 150, check: (r, s) => s.stats.dailyWins >= 1 },
    { id: 'rank5', name: 'Corner Office', desc: 'Reach rank Vice President', reward: 500, check: (r, s) => s.rank >= 5 },
  ];

  // ---------------- Save state ----------------
  function fresh() {
    return {
      v: 1, coins: 0, runs: 0, bestScore: 0, bestDist: 0, rank: 0, missionsDone: 0,
      upgrades: {}, skins: { blitz: true }, skin: 'blitz', achievements: {}, missions: [],
      leaderboard: [], daily: { date: '', best: 0, won: false, runs: 0 },
      settings: { music: true, sfx: true, shake: true },
      stats: { coins: 0, dist: 0, stomps: 0, perfects: 0, time: 0, dailyWins: 0 },
      tutorial: 0,
    };
  }
  let save = load();

  function load() {
    const s = Object.assign(fresh(), store.get(SAVE_KEY, {}) || {});
    const f = fresh();
    s.stats = Object.assign(f.stats, s.stats); s.settings = Object.assign(f.settings, s.settings);
    s.daily = Object.assign(f.daily, s.daily);
    if (!s.skins.blitz) s.skins.blitz = true;
    if (!SKINS.find((k) => k.id === s.skin)) s.skin = 'blitz';
    fillMissions(s);
    return s;
  }
  function persist() { store.set(SAVE_KEY, save); }
  function reset() { store.remove(SAVE_KEY); save = load(); persist(); }

  // ---------------- Missions ----------------
  function newMission(s, exclude) {
    const L = s.rank;
    const r = rng((Date.now() ^ (s.missionsDone * 7919)) >>> 0);
    const pool = MISSIONS.filter((m) => !exclude.includes(m.id));
    const def = r.pick(pool);
    return { id: def.id, n: def.n(L), progress: 0, reward: missionReward(L) };
  }
  function fillMissions(s) {
    s.missions = (s.missions || []).filter((m) => MISSIONS.find((d) => d.id === m.id));
    while (s.missions.length < 3) s.missions.push(newMission(s, s.missions.map((m) => m.id)));
  }
  const missionDef = (id) => MISSIONS.find((d) => d.id === id);
  const missionText = (m) => missionDef(m.id).text(m.n);

  // Live (in-run) progress of a mission, without mutating save.
  function missionLive(m, stats) {
    const d = missionDef(m.id);
    if (d.total) return Math.min(m.n, m.progress + (stats[d.total] || 0));
    return Math.min(m.n, Math.max(m.progress, stats[d.stat] || 0));
  }

  // ---------------- Run lifecycle ----------------
  const upg = (id) => save.upgrades[id] || 0;
  const skin = () => SKINS.find((k) => k.id === save.skin) || SKINS[0];

  // Compute gameplay modifiers from upgrades + selected skin.
  function loadout() {
    const k = skin();
    return {
      skin: k,
      rocketTime: 2.5 + 0.5 * upg('rocket'),
      magnetTime: 7 + 1.5 * upg('magnet'),
      leverTime: 8 + 2 * upg('lever'),
      coinMult: (1 + 0.15 * upg('coinVal')) * (k.coins || 1),
      blitzFill: (1 + 0.12 * upg('blitz')) * (k.blitz || 1),
      blitzTime: 6 + 0.5 * upg('blitz'),
      luck: 1 + 0.15 * upg('luck'),
      headStart: upg('head') ? 1.5 + 1.2 * upg('head') : 0,
      startShield: !!(upg('hedge') || k.shield),
      airJumps: 1 + upg('legs') + (k.airJumps || 0),
      jumpMult: k.jump || 1,
      scoreMult: (1 + 0.1 * save.rank) * (k.score || 1),
    };
  }

  // Apply a finished run to the save. Returns a summary for the results screen.
  function finishRun(stats, daily) {
    const out = { banked: 0, missionsDone: [], rankUp: false, achievements: [], newBest: false, dailyWin: false, rewards: 0 };
    const lo = loadout();
    out.banked = Math.round(stats.coins * lo.coinMult);
    save.coins += out.banked;
    save.runs++;
    Object.assign(save.stats, {
      coins: save.stats.coins + out.banked, dist: save.stats.dist + stats.dist, stomps: save.stats.stomps + stats.stomps,
      perfects: save.stats.perfects + stats.perfects, time: save.stats.time + stats.time,
    });
    if (stats.score > save.bestScore) { out.newBest = save.runs > 1 || save.bestScore > 0; save.bestScore = Math.floor(stats.score); }
    save.bestDist = Math.max(save.bestDist, Math.floor(stats.dist));

    if (daily) {
      const key = todayKey();
      if (save.daily.date !== key) save.daily = { date: key, best: 0, won: false, runs: 0 };
      save.daily.runs++;
      save.daily.best = Math.max(save.daily.best, Math.floor(stats.score));
      if (!save.daily.won && stats.score >= dailyTarget()) {
        save.daily.won = true; out.dailyWin = true; save.stats.dailyWins++;
        save.coins += 250; out.rewards += 250;
      }
    }

    // Missions
    save.missions.forEach((m, i) => {
      const d = missionDef(m.id);
      m.progress = missionLive(m, stats);
      if (m.progress >= m.n) {
        out.missionsDone.push({ text: missionText(m), reward: m.reward });
        save.coins += m.reward; out.rewards += m.reward;
        save.missionsDone++;
        save.missions[i] = null;
      }
    });
    const before = save.rank;
    save.rank = Math.floor(save.missionsDone / 3);
    out.rankUp = save.rank > before;
    save.missions = save.missions.filter(Boolean);
    fillMissions(save);

    // Leaderboard
    save.leaderboard.push({ score: Math.floor(stats.score), dist: Math.floor(stats.dist), skin: save.skin, date: todayKey(), daily: !!daily });
    save.leaderboard.sort((a, b) => b.score - a.score);
    save.leaderboard = save.leaderboard.slice(0, 10);
    out.lbRank = save.leaderboard.findIndex((e) => e.score === Math.floor(stats.score) && e.dist === Math.floor(stats.dist)) + 1;

    out.achievements = checkAchievements(stats, true);
    persist();
    return out;
  }

  // Unlock any newly satisfied achievements; returns the list (with rewards credited).
  function checkAchievements(stats, atEnd) {
    const got = [];
    for (const a of ACHIEVEMENTS) {
      if (save.achievements[a.id]) continue;
      if (a.end && !atEnd) continue;
      if (a.check(stats, save)) {
        save.achievements[a.id] = Date.now();
        save.coins += a.reward;
        got.push(a);
      }
    }
    if (got.length) persist();
    return got;
  }

  // ---------------- Shop ----------------
  function buyUpgrade(id) {
    const u = UPGRADES.find((x) => x.id === id), l = upg(id);
    if (!u || l >= u.max) return false;
    const c = upgradeCost(u, l);
    if (save.coins < c) return false;
    save.coins -= c; save.upgrades[id] = l + 1; persist();
    return true;
  }
  function buySkin(id) {
    const k = SKINS.find((x) => x.id === id);
    if (!k || save.skins[id] || save.coins < k.cost) return false;
    save.coins -= k.cost; save.skins[id] = true; save.skin = id; persist();
    return true;
  }
  function selectSkin(id) { if (save.skins[id]) { save.skin = id; persist(); } }

  // Cheapest thing not yet owned — shown as a "next goal" nudge on the results screen.
  function nextGoal() {
    const opts = [];
    for (const u of UPGRADES) { const l = upg(u.id); if (l < u.max) opts.push({ name: `${u.name} Lv${l + 1}`, cost: upgradeCost(u, l) }); }
    for (const k of SKINS) if (!save.skins[k.id]) opts.push({ name: k.name, cost: k.cost });
    opts.sort((a, b) => a.cost - b.cost);
    return opts[0] || null;
  }
  const affordableCount = () => UPGRADES.filter((u) => upg(u.id) < u.max && save.coins >= upgradeCost(u, upg(u.id))).length
    + SKINS.filter((k) => !save.skins[k.id] && save.coins >= k.cost).length;

  // ---------------- Daily ----------------
  const dailySeed = () => hashStr('blitz-rush-' + todayKey());
  const dailyTarget = () => 15000 + (dailySeed() % 8) * 2500;
  function dailyInfo() {
    const key = todayKey();
    const d = save.daily.date === key ? save.daily : { best: 0, won: false, runs: 0 };
    return { key, target: dailyTarget(), best: d.best, won: d.won, runs: d.runs };
  }

  return {
    get save() { return save; }, persist, reset,
    UPGRADES, SKINS, ACHIEVEMENTS, upgradeCost, rankName,
    loadout, finishRun, checkAchievements, missionText, missionLive,
    buyUpgrade, buySkin, selectSkin, nextGoal, affordableCount, dailySeed, dailyInfo, upg,
  };
})();
