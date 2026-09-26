/* Blitz Rush — meta-progression: save data, upgrades, skins, missions, achievements, leaderboard */
'use strict';

BR.meta = (() => {
  const { store, todayKey, hashStr, rng } = BR.util;
  const SAVE_KEY = 'blitzRush.save.v1';

  // ---------------- Definitions ----------------
  const UPGRADES = [
    { id: 'rocket', name: 'Earnings Rocket', icon: '🚀', max: 6, base: 90, growth: 1.6, desc: (l) => `Rocket lasts ${(2.5 + 0.5 * l).toFixed(1)}s` },
    { id: 'magnet', name: 'Liquidity Magnet', icon: '🧲', max: 6, base: 80, growth: 1.6, desc: (l) => `Magnet lasts ${7 + 1.5 * l}s` },
    { id: 'lever', name: '2x Leverage', icon: '✖️', max: 6, base: 90, growth: 1.6, desc: (l) => `2x score lasts ${8 + 2 * l}s` },
    { id: 'coinVal', name: 'Dividends', icon: '💰', max: 8, base: 130, growth: 1.55, desc: (l) => `+${15 * l}% coins banked` },
    { id: 'blitz', name: 'Blitz Charge', icon: '⚡', max: 5, base: 160, growth: 1.65, desc: (l) => `Blitz meter +${12 * l}% fill, +${(0.5 * l).toFixed(1)}s` },
    { id: 'luck', name: 'Catalyst Luck', icon: '🍀', max: 5, base: 150, growth: 1.65, desc: (l) => `Catalysts ${15 * l}% more often` },
    { id: 'head', name: 'IPO Pop', icon: '🎉', max: 5, base: 260, growth: 1.7, desc: (l) => l ? `Start with a ${(1.5 + 1.2 * l).toFixed(1)}s rocket` : 'Start each run with a rocket' },
    { id: 'hedge', name: 'Hedge', icon: '🛡️', max: 1, base: 750, growth: 1, desc: (l) => l ? 'Start every run shielded' : 'Start every run with a shield' },
    { id: 'legs', name: 'Extra Leg', icon: '🦵', max: 2, base: 1300, growth: 3, desc: (l) => `${1 + l} air jump${l ? 's' : ''}` },
  ];
  const upgradeCost = (u, lvl) => Math.round(u.base * Math.pow(u.growth, lvl) / 10) * 10;

  const SKINS = [
    { id: 'blitz', name: 'Blitz', cost: 0, color: '#ffd23f', accent: '#ff8c1a', trail: '#ffd23f', perk: 'The original momentum trader.' },
    { id: 'bull', name: 'Raging Bull', cost: 400, color: '#ff6b3d', accent: '#fff1d6', trail: '#ff6b3d', perk: '+12% jump height', jump: 1.12 },
    { id: 'diamond', name: 'Diamond Hands', cost: 1000, color: '#7df9ff', accent: '#ffffff', trail: '#7df9ff', perk: 'Starts every run shielded', shield: true },
    { id: 'whale', name: 'The Whale', cost: 2000, color: '#4d8dff', accent: '#bfe0ff', trail: '#4d8dff', perk: '+25% coins', coins: 1.25 },
    { id: 'mooncat', name: 'Moon Cat', cost: 3500, color: '#b57bff', accent: '#ffe7ff', trail: '#d6a8ff', perk: '+1 air jump', airJumps: 1 },
    { id: 'ape', name: 'Degen Ape', cost: 6000, color: '#8b5a2b', accent: '#ffcf99', trail: '#ff4fd8', perk: 'Blitz meter fills 30% faster', blitz: 1.3 },
    { id: 'satoshi', name: 'Satoshi Gold', cost: 10000, color: '#ffe066', accent: '#fff9d9', trail: '#fff2a8', perk: '+20% score', score: 1.2 },
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
    { id: 'nearRun', stat: 'nearMisses', text: (n) => `Get ${n} Close Calls in one run`, n: (L) => 2 + L },
    { id: 'perkRun', stat: 'perks', text: (n) => `Pick ${n} perk${n > 1 ? 's' : ''} in one run`, n: (L) => Math.min(6, 1 + Math.ceil(L / 2)) },
    { id: 'regRun', stat: 'regimes', text: (n) => `See ${n} market regimes in one run`, n: (L) => Math.min(4, 2 + Math.floor(L / 3)) },
    { id: 'brkTot', total: 'breakers', text: (n) => `Clear ${n} Circuit Breaker${n > 1 ? 's' : ''} (any runs)`, n: (L) => 1 + Math.floor(L / 3), minRank: 1 },
  ];
  // The very first three missions are fixed and easy, so run 1 or 2 almost always pays out.
  const STARTER = [{ id: 'coinsRun', n: 25 }, { id: 'distRun', n: 400 }, { id: 'perfRun', n: 1 }];
  const missionReward = (L) => 50 + L * 25;

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
    // v2
    { id: 'perf1', name: 'Stuck The Landing', desc: 'Land your first Perfect (dive onto a downslope)', reward: 40, check: (r) => r.perfects >= 1 },
    { id: 'stomp1', name: 'Bear Necessities', desc: 'Stomp a bear from above', reward: 40, check: (r) => r.stomps >= 1 },
    { id: 'perk1', name: 'Pick Your Poison', desc: 'Choose your first perk', reward: 30, check: (r) => r.perks >= 1 },
    { id: 'near1', name: 'Close Call', desc: 'Skim past a hazard for a Close Call', reward: 30, check: (r) => r.nearMisses >= 1 },
    { id: 'reg2', name: 'Regime Change', desc: 'See 2 market regimes in one run', reward: 60, check: (r) => r.regimes >= 2 },
    { id: 'reg4', name: 'Full Market Cycle', desc: 'See all 4 market regimes in one run', reward: 400, check: (r) => r.regimes >= 4 },
    { id: 'brk1', name: 'Halt Lifted', desc: 'Clear a Circuit Breaker gauntlet', reward: 250, check: (r) => r.breakers >= 1 },
    { id: 'brk3', name: 'Unstoppable', desc: 'Clear 3 Circuit Breakers in one run', reward: 800, check: (r) => r.breakers >= 3 },
    { id: 'near10', name: 'Living Dangerously', desc: '10 Close Calls in one run', reward: 200, check: (r) => r.nearMisses >= 10 },
    { id: 'perks5', name: 'Stacked Portfolio', desc: 'Hold 5 perks in one run', reward: 300, check: (r) => r.perks >= 5 },
    { id: 'ghost', name: 'Beat Yourself', desc: 'Overtake the ghost of your best run', reward: 80, check: (r) => r.ghostPass >= 1 },
  ];

  // ---------------- Perks (per-run roguelite picks, offered at distance milestones) ----------------
  // rank: the rank at which a perk joins the pool (new perks unlock as you get promoted).
  const PERKS = [
    { id: 'compound', icon: '💹', name: 'Compound Interest', desc: '+25% coins this run', max: 3, rank: 0 },
    { id: 'chainlen', icon: '⛓️', name: 'Long Position', desc: 'Chain timer +1.5s', max: 3, rank: 0 },
    { id: 'shield', icon: '🛡️', name: 'Stop-Loss Order', desc: 'Gain a shield right now', max: 9, rank: 0 },
    { id: 'softland', icon: '🪂', name: 'Soft Landing', desc: 'Much wider Perfect-landing window', max: 1, rank: 0 },
    { id: 'shorter', icon: '📉', name: 'Short Seller', desc: 'Diving down red slopes earns score + ⚡', max: 2, rank: 0 },
    { id: 'hot', icon: '🔥', name: 'Hot Streak', desc: '⚡ meter fills 30% faster', max: 3, rank: 0 },
    { id: 'qe', icon: '🧲', name: 'Quantitative Easing', desc: 'Permanent mini coin magnet', max: 2, rank: 1 },
    { id: 'boots', icon: '🥾', name: 'Moon Boots', desc: '+1 air jump', max: 2, rank: 1 },
    { id: 'trapper', icon: '🪤', name: 'Bear Trapper', desc: 'Stomps pay ×3 and bounce higher', max: 1, rank: 2 },
    { id: 'insider', icon: '🕵️', name: 'Insider Info', desc: 'Catalysts 50% more often, last 30% longer', max: 2, rank: 2 },
    { id: 'lever', icon: '📈', name: 'Margin Trading', desc: 'Each chain link +0.15× instead of +0.1×', max: 1, rank: 3 },
    { id: 'thrill', icon: '😬', name: 'Thrill Seeker', desc: 'Close Calls pay ×3 and extend the chain', max: 1, rank: 4 },
    { id: 'bailout', icon: '🏦', name: 'Bailout', desc: 'Once: a fatal hit or fall bounces you instead', max: 1, rank: 5 },
  ];
  const perkPool = (s = save) => PERKS.filter((p) => p.rank <= s.rank);

  // Regimes unlock quickly so early runs keep revealing new stuff.
  const REGIME_UNLOCKS = [
    { id: 'bull', when: () => true, text: 'Start' },
    { id: 'chop', when: () => true, text: 'Start' },
    { id: 'crash', when: (s) => s.runs >= 1, text: 'Finish 1 run' },
    { id: 'mania', when: (s) => s.runs >= 3 || s.bestDist >= 1500, text: 'Play 3 runs or reach 1,500 m' },
  ];
  const unlockedRegimes = (s = save) => REGIME_UNLOCKS.filter((u) => u.when(s)).map((u) => u.id);

  // ---------------- Save state ----------------
  function fresh() {
    return {
      v: 2, coins: 0, runs: 0, bestScore: 0, bestDist: 0, rank: 0, missionsDone: 0,
      upgrades: {}, skins: { blitz: true }, skin: 'blitz', achievements: {}, missions: [],
      leaderboard: [], daily: { date: '', best: 0, won: false, runs: 0 },
      settings: { music: true, sfx: true, shake: true, ghost: true, hints: true },
      stats: { coins: 0, dist: 0, stomps: 0, perfects: 0, time: 0, dailyWins: 0, breakers: 0, nearMisses: 0, perks: 0 },
      tutorial: 0, regimesSeen: {}, perksSeen: {}, starter: false, swaps: 0,
    };
  }
  let save = load();

  function load() {
    const raw = store.get(SAVE_KEY, {});
    const old = raw && typeof raw === 'object' ? raw : {};
    const s = Object.assign(fresh(), old);
    const f = fresh();
    // v1 -> v2 migration: keep everything, add new fields, and don't show the beginner flow to veterans.
    if (!old.v || old.v < 2) {
      s.starter = (old.runs || 0) > 0;          // veterans keep their current missions
      s.regimesSeen = {}; s.perksSeen = {};
      if ((old.runs || 0) >= 3) s.tutorial = Math.max(s.tutorial || 0, 2);
      s.v = 2;
    }
    for (const k of ['upgrades', 'skins', 'achievements', 'regimesSeen', 'perksSeen']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = {};
    if (!Array.isArray(s.leaderboard)) s.leaderboard = [];
    if (!Array.isArray(s.missions)) s.missions = [];
    s.stats = Object.assign(f.stats, s.stats); s.settings = Object.assign(f.settings, s.settings);
    s.daily = Object.assign(f.daily, s.daily);
    if (!s.skins.blitz) s.skins.blitz = true;
    if (!SKINS.find((k) => k.id === s.skin)) s.skin = 'blitz';
    fillMissions(s);
    return s;
  }
  function persist() { store.set(SAVE_KEY, save); }
  function reset() { store.remove(SAVE_KEY); store.remove(GHOST_KEY); save = load(); persist(); }

  // ---------------- Ghost of your best run ----------------
  // Terrain is random per run, so the ghost is a "pace" ghost: we store x-position samples (every 0.2 s of run time)
  // and draw it riding the *current* chart. On the Daily (same seed) we also store y so it retraces your exact line.
  const GHOST_KEY = 'blitzRush.ghost.v1';
  let ghosts = store.get(GHOST_KEY, null) || {};
  if (typeof ghosts !== 'object' || Array.isArray(ghosts)) ghosts = {};
  function getGhost(daily) {
    const g = daily ? ghosts.daily : ghosts.best;
    if (!g || !Array.isArray(g.xs) || g.xs.length < 5) return null;
    if (daily && g.date !== todayKey()) return null;
    return g;
  }
  function offerGhost(trace, stats, daily) {
    if (!trace || !trace.xs || trace.xs.length < 5) return false;
    const cur = daily ? ghosts.daily : ghosts.best;
    const stale = daily && cur && cur.date !== todayKey();
    if (cur && !stale && cur.score >= stats.score) return false;
    const g = { score: Math.floor(stats.score), dist: Math.floor(stats.dist), xs: trace.xs.slice(0, 3000), skin: save.skin };
    if (daily) { g.date = todayKey(); g.ys = (trace.ys || []).slice(0, 3000); }
    ghosts[daily ? 'daily' : 'best'] = g;
    store.set(GHOST_KEY, ghosts);
    return true;
  }

  // ---------------- Missions ----------------
  function newMission(s, exclude) {
    const L = s.rank;
    const r = rng((Date.now() ^ (s.missionsDone * 7919)) >>> 0);
    const pool = MISSIONS.filter((m) => !exclude.includes(m.id) && (m.minRank || 0) <= L);
    const def = r.pick(pool);
    return { id: def.id, n: def.n(L), progress: 0, reward: missionReward(L) };
  }
  function fillMissions(s) {
    s.missions = (s.missions || []).filter((m) => m && MISSIONS.find((d) => d.id === m.id));
    if (!s.starter && s.missions.length === 0 && s.missionsDone === 0) {
      s.starter = true;
      s.missions = STARTER.map((m) => ({ id: m.id, n: m.n, progress: 0, reward: 40 }));
    }
    s.starter = true;
    while (s.missions.length < 3) s.missions.push(newMission(s, s.missions.map((m) => m.id)));
  }
  function swapMission(i) {
    if (!(save.swaps > 0) || !save.missions[i]) return false;
    const ids = save.missions.map((m) => m.id);
    save.missions[i] = newMission(save, ids);
    save.swaps--; persist();
    return true;
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
      regimes: unlockedRegimes(),
      gentle: save.runs < 2,
      trainingShield: save.runs < 2,
      hints: save.settings.hints && (save.runs < 6 || save.stats.perfects < 12),
      perkPool: perkPool().map((p) => p.id),
      firstPerkAt: save.runs === 0 ? 450 : 350,
    };
  }

  // Apply a finished run to the save. Returns a summary for the results screen.
  function finishRun(stats, daily) {
    const out = { banked: 0, missionsDone: [], rankUp: false, achievements: [], newBest: false, dailyWin: false, rewards: 0, unlocks: [] };
    const lo = loadout();
    const regBefore = unlockedRegimes(), perkBefore = perkPool().length;
    out.banked = Math.round(stats.coins * lo.coinMult * (stats.coinMult || 1));
    save.coins += out.banked;
    save.runs++;
    save.swaps = 1;                                   // one free mission swap per finished run
    Object.assign(save.stats, {
      coins: save.stats.coins + out.banked, dist: save.stats.dist + stats.dist, stomps: save.stats.stomps + stats.stomps,
      perfects: save.stats.perfects + stats.perfects, time: save.stats.time + stats.time,
      breakers: (save.stats.breakers || 0) + (stats.breakers || 0), nearMisses: (save.stats.nearMisses || 0) + (stats.nearMisses || 0),
      perks: (save.stats.perks || 0) + (stats.perks || 0),
    });
    for (const id of stats.regimeIds || []) save.regimesSeen[id] = (save.regimesSeen[id] || 0) + 1;
    for (const id of stats.perkIds || []) save.perksSeen[id] = (save.perksSeen[id] || 0) + 1;
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
    // newly revealed content (shown on the summary as "NEW")
    const W = BR.World && BR.World.REGIMES;
    for (const id of unlockedRegimes()) if (!regBefore.includes(id) && W) out.unlocks.push(`${W[id].icon} New market regime: ${W[id].name}`);
    const pp = perkPool();
    for (const p of pp.slice(perkBefore)) out.unlocks.push(`${p.icon} New perk in the pool: ${p.name}`);
    out.ghostSaved = offerGhost(stats.trace, stats, daily);
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
  // A "big" goal: next character or one of the heavy upgrades, for the longer arc.
  function bigGoal() {
    const opts = [];
    for (const k of SKINS) if (!save.skins[k.id]) opts.push({ name: k.name, cost: k.cost, icon: '🧑‍🚀', kind: 'character', perk: k.perk });
    for (const id of ['hedge', 'legs']) { const u = UPGRADES.find((x) => x.id === id), l = upg(id); if (l < u.max) opts.push({ name: `${u.name}${u.max > 1 ? ' Lv' + (l + 1) : ''}`, cost: upgradeCost(u, l), icon: u.icon, kind: 'upgrade', perk: u.desc(l + 1) }); }
    opts.sort((a, b) => a.cost - b.cost);
    return opts[0] || null;
  }
  // Next non-coin unlock (regime, perk via rank) for the menu's "coming up" line.
  function nextContent() {
    const s = save;
    const lockedReg = REGIME_UNLOCKS.find((u) => !u.when(s));
    if (lockedReg && BR.World) return `${BR.World.REGIMES[lockedReg.id].icon} ${BR.World.REGIMES[lockedReg.id].name}: ${lockedReg.text}`;
    const np = PERKS.find((p) => p.rank > s.rank);
    if (np) return `${np.icon} Perk "${np.name}": reach ${rankName(np.rank)} (${3 - (s.missionsDone % 3)} mission${3 - (s.missionsDone % 3) > 1 ? 's' : ''} to next rank)`;
    return '';
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
    PERKS, perkPool, unlockedRegimes, swapMission, REGIME_UNLOCKS, bigGoal, nextContent, getGhost,
  };
})();
