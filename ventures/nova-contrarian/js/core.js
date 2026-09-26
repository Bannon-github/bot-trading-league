/* Nova Contrarian - core rules: state, RNG, hand evaluation, scoring, round flow, shop. Classic scripts sharing one global scope; load order: data, core, fx, ui, goals, main. */
'use strict';
var D = window.NCData, HT = D.HT, BOTS = D.BOTS, TIPS = D.TIPS, REPORTS = D.REPORTS, BOSSES = D.BOSSES;
var SAVE_KEY = 'nova-contrarian:v1';
var SUITS = ['♠', '♥', '♦', '♣'], SUIT_NAMES = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
var ENH = { bull: 'BULL', bear: 'BEAR', gold: 'GOLD', lev: 'LEV x2', hodl: 'HODL' };
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

// ------------------------------------------------------------------ utils
function rankStr(r) { return r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r); }
function cardChips(r) { return r === 14 ? 11 : r >= 11 ? 10 : r; }
function fmt(n) { n = Math.floor(n); if (!isFinite(n)) return '∞'; if (Math.abs(n) >= 1e13) return n.toExponential(2).replace('+', ''); return n.toLocaleString('en-US'); }
function fmtM(m) { if (Number.isInteger(m)) return String(m); if (m >= 1000) return fmt(m); return m.toFixed(2).replace(/\.?0+$/, ''); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function hashStr(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function todayStr() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function niceRound(n) { if (n < 1000) return Math.round(n / 10) * 10; var p = Math.pow(10, Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p; }

// ------------------------------------------------------------------ state
var S = null;        // current run (serializable)
var M = null;        // meta (records, unlocks, settings)
var sel = [];        // selected card ids (UI only)
var fresh = {};      // ids to animate as freshly dealt
var busy = false, hurry = false;
var menuStake = 1;

function rnd() { // mulberry32 on S.rng (seeded, saved with the run)
  S.rng = (S.rng + 0x6D2B79F5) >>> 0;
  var t = S.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function ri(n) { return Math.floor(rnd() * n); }
function pick(a) { return a[ri(a.length)]; }
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = ri(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

function defaultMeta() {
  return { runs: 0, wins: 0, bestAnte: 0, bestHand: 0, bestHandName: '', stakeUnlocked: 1, seen: {}, history: [], daily: {},
    tutorialDone: false, mute: false, speed: 1, handsPlayed: 0, goalsDone: 0, bestAnteByStake: {} };
}
function loadAll() {
  M = defaultMeta(); S = null;
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      var o = JSON.parse(raw);
      if (o && o.meta) { for (var k in o.meta) M[k] = o.meta[k]; }
      if (o && o.run && o.run.v === 1 && o.run.phase !== 'over') S = o.run;
    }
  } catch (e) { S = null; }
}
function saveAll() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ meta: M, run: (S && S.phase !== 'over') ? S : null })); } catch (e) { /* storage full / private mode */ }
}

function count(k) { var n = 0; for (var i = 0; i < S.bots.length; i++) if (S.bots[i].k === k) n++; return n; }
function card(id) { return S.cards[id]; }
function bossActive() { return S.phase === 'round' && S.blindIdx === 2 ? S.boss.k : null; }

function newRun(opts) {
  var seed = opts.daily ? hashStr('nova-daily-' + opts.date) : ((Math.random() * 4294967296) >>> 0);
  S = { v: 1, seed: seed, rng: seed, daily: !!opts.daily, date: opts.date || todayStr(), stake: opts.daily ? 1 : (opts.stake || 1),
    ante: 1, blindIdx: 0, blindState: ['todo', 'todo', 'todo'], phase: 'blind', money: 4 + startCashBonus(), cards: {}, nextId: 1, draw: [], hand: [], pile: [],
    handsLeft: 0, discardsLeft: 0, discardsUsed: 0, handsPlayedRound: 0, roundScore: 0, target: 0, boss: null, tags: [],
    bots: [], cons: [], maxBots: 5, maxCons: 2, levels: {}, plays: {}, lastType: null, sortMode: 'rank',
    best: 0, bestName: '', handsTotal: 0, won: false, shop: null, payout: null, startedAt: Date.now(), prevBest: M.bestAnte || 0 };
  D.HT_ORDER.forEach(function (k) { S.levels[k] = 1; S.plays[k] = 0; });
  for (var s = 0; s < 4; s++) for (var r = 2; r <= 14; r++) addCard(r, s, null);
  newAnte();
  S.starter = starterPicks();
  M.runs++;
  sel = [];
  saveAll();
  render();
  if (!M.tutorialDone && M.runs <= 1) { showTutorial(0); } else M.tutorialDone = true;
}
function showStarter() {
  var h = '<h2 class="vi">Pick your first Bot</h2><p>Every run starts with one free Common Bot. Choose your strategy:</p><div class="offers" style="margin-top:10px">';
  S.starter.forEach(function (k, i) {
    var d = BOTS[k];
    h += '<div class="offer"><div class="ic">' + d.icon + '</div><div class="nm">' + esc(d.name) + '</div><div class="ds">' + d.desc(d.init || {}, null) + '</div><button class="btn-cy" data-act="starter" data-i="' + i + '">Hire <kbd>' + (i + 1) + '</kbd></button></div>';
  });
  showOverlay(h + '</div>');
}
function addCard(r, s, e) { var id = S.nextId++; S.cards[id] = { id: id, r: r, s: s, e: e || null }; return id; }

function newAnte() {
  S.blindIdx = 0; S.blindState = ['todo', 'todo', 'todo'];
  var keys = D.BOSS_KEYS.filter(function (k) { return !S.boss || k !== S.boss.k; });
  if (S.ante === 1) keys = keys.filter(function (k) { return k !== 'bearmkt' && k !== 'margin'; });
  S.boss = { k: pick(keys), suit: ri(4) };
  var tk = Object.keys(D.TAGS);
  S.tags = [pick(tk), pick(tk)];
}
function blindTarget(ante, idx) {
  var base = ante <= D.ANTE_BASE.length ? D.ANTE_BASE[ante - 1] : D.ANTE_BASE[D.ANTE_BASE.length - 1] * Math.pow(1.7, ante - D.ANTE_BASE.length);
  var stakeMult = 1 + 0.2 * (S.stake - 1);
  return niceRound(base * D.BLINDS[idx].mult * stakeMult);
}
function bossDesc(b) { return BOSSES[b.k].desc.replace('{suit}', SUIT_NAMES[b.suit] + ' ' + SUITS[b.suit]); }
function baseHands() { var n = 4 + count('breaker') - count('leverage') - (S.stake >= 5 ? 1 : 0) - (bossActive() === 'halt' ? 1 : 0); return Math.max(1, n); }
function baseDiscards() { if (bossActive() === 'crunch') return 0; return Math.max(0, 3 + count('daytrader') - (S.stake >= 3 ? 1 : 0)); }
function handSize() { return 8 - (bossActive() === 'freeze' ? 2 : 0); }
function isDebuffed(c) {
  var b = bossActive();
  if (b === 'selloff' && c.s === S.boss.suit) return true;
  if (b === 'blackout' && c.r >= 11 && c.r <= 13) return true;
  return false;
}

// ------------------------------------------------------------------ round flow
function startRound() {
  S.phase = 'round';
  S.target = blindTarget(S.ante, S.blindIdx);
  S.roundScore = 0; S.discardsUsed = 0; S.handsPlayedRound = 0;
  S.handsLeft = baseHands(); S.discardsLeft = baseDiscards();
  S.draw = shuffle(Object.keys(S.cards).map(Number));
  S.hand = []; S.pile = []; sel = [];
  drawToFull();
  Snd.shuffle();
  saveAll(); render();
}
function drawToFull() {
  var hs = handSize(), k = 0;
  while (S.hand.length < hs && S.draw.length) { var id = S.draw.pop(); S.hand.push(id); fresh[id] = k++; }
  sortHand();
}
function sortHand() {
  S.hand.sort(function (a, b) {
    var A = card(a), B = card(b);
    if (S.sortMode === 'suit') return A.s - B.s || B.r - A.r;
    return B.r - A.r || A.s - B.s;
  });
}

function evalHand(cards) {
  var n = cards.length, byRank = {}, i;
  for (i = 0; i < n; i++) (byRank[cards[i].r] = byRank[cards[i].r] || []).push(cards[i]);
  var groups = Object.keys(byRank).map(function (r) { return byRank[r]; }).sort(function (a, b) { return b.length - a.length || b[0].r - a[0].r; });
  var flush = n === 5 && cards.every(function (c) { return c.s === cards[0].s; });
  var ranks = cards.map(function (c) { return c.r; }).sort(function (a, b) { return a - b; });
  var straight = false;
  if (n === 5 && groups.length === 5) {
    straight = ranks[4] - ranks[0] === 4 || (ranks[4] === 14 && ranks[0] === 2 && ranks[3] === 5);
  }
  var g0 = groups[0] ? groups[0].length : 0, g1 = groups[1] ? groups[1].length : 0;
  var contains = { pair: g0 >= 2, two: (g0 >= 2 && g1 >= 2) || g0 >= 4, trips: g0 >= 3, straight: straight, flush: flush, full: g0 === 3 && g1 === 2, quads: g0 >= 4 };
  var type, scoring;
  if (straight && flush) { type = 'sflush'; scoring = cards.slice(); }
  else if (g0 === 4) { type = 'quads'; scoring = groups[0].slice(); }
  else if (g0 === 3 && g1 === 2) { type = 'full'; scoring = cards.slice(); }
  else if (flush) { type = 'flush'; scoring = cards.slice(); }
  else if (straight) { type = 'straight'; scoring = cards.slice(); }
  else if (g0 === 3) { type = 'trips'; scoring = groups[0].slice(); }
  else if (g0 === 2 && g1 === 2) { type = 'two'; scoring = groups[0].concat(groups[1]); }
  else if (g0 === 2) { type = 'pair'; scoring = groups[0].slice(); }
  else { type = 'high'; scoring = [groups[0][0]]; }
  scoring = cards.filter(function (c) { return scoring.indexOf(c) >= 0; }); // keep played order
  return { type: type, scoring: scoring, contains: contains };
}
function baseCM(type) {
  var h = HT[type], L = S.levels[type] || 1;
  return { c: h.c + h.lc * (L - 1), m: h.m + h.lm * (L - 1), L: L };
}

function compute(played, held) {
  var ev = evalHand(played), type = ev.type, b = baseCM(type);
  var x = { type: type, played: played, scoring: ev.scoring, held: held, contains: ev.contains, steps: [], money: 0, broken: [], c: b.c, m: b.m };
  if (bossActive() === 'bearmkt') { x.c = Math.floor(x.c / 2); x.m = Math.max(1, Math.floor(x.m / 2)); }
  function st(ref, txt, cls) { x.steps.push({ ref: ref, txt: txt, cls: cls, c: x.c, m: x.m }); }
  function mkA(ref) {
    return {
      chips: function (n) { x.c += n; st(ref, '+' + fmt(n), 'chips'); },
      mult: function (n) { x.m += n; st(ref, '+' + fmtM(n) + ' Mult', 'mult'); },
      x: function (n) { x.m *= n; st(ref, 'x' + fmtM(n) + ' Mult', 'xmult'); },
      money: function (n) { x.money += n; st(ref, '+$' + n, 'money'); }
    };
  }
  st('base', HT[type].name + ' Lv' + b.L, 'base');
  S.bots.forEach(function (bt) { var d = BOTS[bt.k]; if (d.pre) d.pre(x, bt, S); });
  var algo = count('algo');
  x.scoring.forEach(function (c, idx) {
    var reps = 1 + (idx === 0 ? 2 * algo : 0);
    for (var r = 0; r < reps; r++) {
      var ref = 'card:' + c.id;
      if (isDebuffed(c)) { st(ref, 'Debuffed', 'debuff'); break; }
      if (r > 0) st(ref, 'Again!', 'info');
      var A = mkA(ref);
      A.chips(cardChips(c.r));
      if (c.e === 'bull') A.chips(30);
      if (c.e === 'bear') A.mult(4);
      if (c.e === 'gold') { A.money(2); for (var g = 0; g < count('goldstd'); g++) A.x(1.5); }
      if (c.e === 'lev') A.x(2);
      S.bots.forEach(function (bt, i) { var d = BOTS[bt.k]; if (d.card) d.card(x, c, mkA('bot:' + i), bt, S, rnd); });
    }
  });
  var cold = count('cold') > 0;
  held.forEach(function (c) {
    if (c.e === 'hodl' && !isDebuffed(c)) {
      var A = mkA('card:' + c.id);
      if (cold) A.chips(10);
      A.x(cold ? 2 : 1.5);
    }
  });
  S.bots.forEach(function (bt, i) { var d = BOTS[bt.k]; if (d.hand) d.hand(x, mkA('bot:' + i), bt, S, rnd); });
  x.scoring.forEach(function (c) { if (c.e === 'lev' && !isDebuffed(c) && rnd() < 0.25) x.broken.push(c.id); });
  x.score = Math.floor(x.c * x.m);
  S.bots.forEach(function (bt) { var d = BOTS[bt.k]; if (d.after) d.after(x, bt, S); });
  return x;
}

function toggleCard(id) {
  if (busy || S.phase !== 'round') return;
  var i = sel.indexOf(id);
  if (i >= 0) sel.splice(i, 1);
  else { if (sel.length >= 5) { Snd.tone(160, 0.06, 'square', 0.03); toast('Max 5 cards'); return; } sel.push(id); }
  Snd.tone(i >= 0 ? 520 : 700, 0.04, 'triangle', 0.05);
  updateSelection();
}
function selectedCards() { return S.hand.filter(function (id) { return sel.indexOf(id) >= 0; }).map(card); }

async function playHand() {
  if (busy || S.phase !== 'round') return;
  var played = selectedCards();
  if (!played.length) { toast('Select 1-5 cards to play'); return; }
  if (bossActive() === 'margin' && played.length !== 5 && S.hand.length >= 5) { toast('Margin Call: play exactly 5 cards'); popEl($('#hname')); return; }
  busy = true; hurry = false; closePop();
  var playedIds = played.map(function (c) { return c.id; });
  S.hand = S.hand.filter(function (id) { return playedIds.indexOf(id) < 0; });
  var held = S.hand.map(card);
  S.handsLeft--;
  var hl = $('#hands'); if (hl) hl.textContent = S.handsLeft;
  var x = compute(played, held);
  sel = [];
  $$('.hand .card').forEach(function (e) { if (playedIds.indexOf(+e.dataset.id) >= 0) e.remove(); });
  try { await animateHand(x, played); } catch (e) { /* never block the game on a visual glitch */ }
  S.roundScore += x.score;
  S.money += x.money;
  S.lastType = x.type; S.handsPlayedRound++; S.plays[x.type]++; S.handsTotal++; M.handsPlayed++;
  goalEvent('hand', x);
  if (x.score > S.best) { S.best = x.score; S.bestName = HT[x.type].name; }
  if (x.score > M.bestHand) { M.bestHand = x.score; M.bestHandName = HT[x.type].name; }
  playedIds.forEach(function (id) { if (x.broken.indexOf(id) >= 0) delete S.cards[id]; else S.pile.push(id); });
  if (x.broken.length) { toast('💥 ' + x.broken.length + ' leveraged card' + (x.broken.length > 1 ? 's' : '') + ' blew up!'); Snd.noise(0.25, 0.08); }
  $$('#playArea .card').forEach(function (e) { e.classList.add('flyout'); });
  await sleep(dly(260));
  busy = false;
  if (S.roundScore >= S.target) return winRound();
  if (S.handsLeft <= 0) return loseRound();
  drawToFull();
  if (!S.hand.length) return loseRound();
  saveAll(); render();
}

function discard() {
  if (busy || S.phase !== 'round') return;
  var cs = selectedCards();
  if (!cs.length) { toast('Select cards to discard'); return; }
  if (S.discardsLeft <= 0) { toast('No discards left'); return; }
  closePop();
  var ids = cs.map(function (c) { return c.id; });
  S.hand = S.hand.filter(function (id) { return ids.indexOf(id) < 0; });
  ids.forEach(function (id) { S.pile.push(id); });
  S.discardsLeft--; S.discardsUsed++;
  var gain = 0;
  S.bots.forEach(function (bt) { var d = BOTS[bt.k]; if (d.discard) gain += d.discard(cs, bt, S) || 0; });
  if (gain) { S.money += gain; toast('Tax-loss harvest +$' + gain); Snd.coin(); }
  sel = [];
  Snd.tone(300, 0.1, 'sawtooth', 0.04, 0.5);
  drawToFull();
  saveAll(); render();
}

function winRound() {
  S.blindState[S.blindIdx] = 'done';
  var lines = [];
  var bl = D.BLINDS[S.blindIdx];
  lines.push(['Beat ' + bl.name, bl.reward]);
  if (S.handsLeft > 0) lines.push(['Unused hands (' + S.handsLeft + ' × $1)', S.handsLeft]);
  var cap = 5 + 5 * count('compound');
  var interest = Math.min(cap, Math.floor(Math.max(0, S.money) / 5));
  if (interest > 0) lines.push(['Interest ($1 per $5, max $' + cap + ')', interest]);
  var msgs = [];
  S.bots.forEach(function (bt) {
    var d = BOTS[bt.k]; if (!d.roundEnd) return;
    var r = d.roundEnd(bt, S); if (!r) return;
    if (r.money) lines.push([d.icon + ' ' + d.name, r.money]);
    if (r.msg) msgs.push(d.icon + ' ' + r.msg);
  });
  var total = lines.reduce(function (a, l) { return a + l[1]; }, 0);
  S.payout = { lines: lines, total: total, msgs: msgs, score: S.roundScore, target: S.target };
  S.phase = 'payout';
  M.bestAnte = Math.max(M.bestAnte, S.ante);
  if (!S.daily) { M.bestAnteByStake = M.bestAnteByStake || {}; M.bestAnteByStake[S.stake] = Math.max(M.bestAnteByStake[S.stake] || 0, S.blindIdx === 2 ? S.ante + 1 : S.ante); }
  var winInfo = { handsUsed: S.handsPlayedRound, blindIdx: S.blindIdx, ante: S.ante };
  Snd.win();
  burst(window.innerWidth / 2, window.innerHeight / 2, 60);
  saveAll(); render();
  goalEvent('win', winInfo);
}

function loseRound() {
  if (count('stoploss') && S.roundScore >= S.target * 0.5) {
    var i = S.bots.findIndex(function (b) { return b.k === 'stoploss'; });
    S.bots.splice(i, 1);
    toast('🛑 Stop Loss triggered - you survive!');
    return winRound();
  }
  endRun(false);
}

function cashOut() {
  if (S.phase !== 'payout') return;
  S.money += S.payout.total;
  Snd.coin();
  var bossBeaten = S.blindIdx === 2;
  S.payout = null;
  if (bossBeaten) {
    if (S.ante === D.WIN_ANTE && !S.won) {
      S.won = true; M.wins++;
      if (!S.daily && S.stake >= M.stakeUnlocked && M.stakeUnlocked < D.STAKES.length) M.stakeUnlocked = S.stake + 1;
      recordDaily();
      S.ante++; newAnte();
      goShop(); showVictory();
      return;
    }
    S.ante++; newAnte();
  } else {
    S.blindIdx++;
  }
  goShop();
}

function skipBlind() {
  if (S.phase !== 'blind' || S.blindIdx >= 2) return;
  var tag = S.tags[S.blindIdx];
  S.blindState[S.blindIdx] = 'skipped';
  applyTag(tag);
  S.blindIdx++;
  Snd.tone(880, 0.08, 'triangle', 0.05); Snd.tone(1320, 0.1, 'triangle', 0.04);
  saveAll(); render();
}
function applyTag(t) {
  if (t === 'cash') { S.money += 7; toast('💵 +$7'); }
  else if (t === 'report' || t === 'tip') {
    if (S.cons.length >= S.maxCons) { S.money += 4; toast('Item slots full: +$4 instead'); return; }
    var k = t === 'report' ? 'rp_' + pick(D.HT_ORDER) : pick(D.TIP_KEYS);
    S.cons.push(k); toast('Got ' + conDef(k).name);
  } else if (t === 'bot') {
    if (S.bots.length >= S.maxBots) { S.money += 5; toast('Bot slots full: +$5 instead'); return; }
    var k2 = pickBot(1, []); addBot(k2); toast('Got ' + BOTS[k2].name);
  }
}

function endRun(won) {
  var entry = { d: new Date().toISOString(), seed: S.seed.toString(36).toUpperCase(), daily: S.daily, stake: S.stake, ante: S.ante, blind: S.blindIdx,
    won: S.won || won, best: S.best, bestName: S.bestName, bots: S.bots.map(function (b) { return b.k; }), hands: S.handsTotal };
  S.phase = 'over';
  M.history.unshift(entry); M.history = M.history.slice(0, 25);
  recordDaily();
  saveAll();
  if (entry.won) Snd.win(); else Snd.lose();
  showGameOver(entry);
}
function recordDaily() {
  if (!S.daily) return;
  var cur = M.daily[S.date], prog = S.ante * 3 + S.blindIdx;
  if (!cur || prog > cur.prog || (prog === cur.prog && S.best > cur.best)) M.daily[S.date] = { prog: prog, ante: S.ante, blind: S.blindIdx, best: S.best, won: S.won };
  var keys = Object.keys(M.daily).sort(); while (keys.length > 30) delete M.daily[keys.shift()];
}

// ------------------------------------------------------------------ shop
function botPool(rar, exclude) {
  return Object.keys(BOTS).filter(function (k) { return BOTS[k].rar === rar && exclude.indexOf(k) < 0 && !count(k); });
}
function pickBot(forceRar, exclude) {
  var r = forceRar || (function () { var v = rnd(); return v < 0.68 ? 1 : v < 0.93 ? 2 : 3; })();
  var pool = botPool(r, exclude);
  if (!pool.length) pool = botPool(1, exclude).concat(botPool(2, exclude), botPool(3, exclude));
  if (!pool.length) pool = Object.keys(BOTS);
  return pick(pool);
}
function addBot(k) { var d = BOTS[k]; S.bots.push({ k: k, d: d.init ? JSON.parse(JSON.stringify(d.init)) : {} }); M.seen[k] = 1; }
function conDef(k) { return TIPS[k] || REPORTS[k]; }
function genShopItems() {
  var items = [], ex = [];
  for (var i = 0; i < 2; i++) { var k = pickBot(0, ex); ex.push(k); items.push({ t: 'bot', k: k, price: BOTS[k].cost }); M.seen[k] = 1; }
  for (var j = 0; j < 2; j++) {
    if (rnd() < 0.55) items.push({ t: 'con', k: pick(D.TIP_KEYS), price: 3 });
    else items.push({ t: 'con', k: 'rp_' + pickWeightedHand(), price: 3 });
  }
  return items;
}
function pickWeightedHand() {
  var ks = D.HT_ORDER, w = ks.map(function (k) { return 1 + S.plays[k] * 1.5; });
  var tot = w.reduce(function (a, b) { return a + b; }, 0), v = rnd() * tot;
  for (var i = 0; i < ks.length; i++) { v -= w[i]; if (v <= 0) return ks[i]; }
  return ks[0];
}
function goShop() {
  S.phase = 'shop';
  S.shop = { items: genShopItems(), pack: { price: 4, sold: false }, reroll: 3 };
  saveAll(); render();
}
function buy(i) {
  if (S.phase !== 'shop') return;
  var it = S.shop.items[i]; if (!it || it.sold) return;
  if (S.money < it.price) { toast('Not enough cash'); Snd.tone(150, 0.1, 'square', 0.03); return; }
  if (it.t === 'bot') { if (S.bots.length >= S.maxBots) { toast('Bot slots full - sell one first'); return; } addBot(it.k); }
  else { if (S.cons.length >= S.maxCons) { toast('Item slots full - use or sell one'); return; } S.cons.push(it.k); }
  S.money -= it.price; it.sold = true;
  Snd.coin(); saveAll(); render();
}
function reroll() {
  if (S.phase !== 'shop') return;
  if (S.money < S.shop.reroll) { toast('Not enough cash'); return; }
  S.money -= S.shop.reroll; S.shop.reroll++;
  S.shop.items = genShopItems();
  Snd.shuffle(); saveAll(); render();
}
function openPack() {
  if (S.phase !== 'shop' || S.shop.pack.sold) return;
  if (S.money < S.shop.pack.price) { toast('Not enough cash'); return; }
  S.money -= S.shop.pack.price; S.shop.pack.sold = true;
  var enhs = Object.keys(ENH), opts = [];
  for (var i = 0; i < 3; i++) opts.push({ r: 2 + ri(13), s: ri(4), e: rnd() < 0.65 ? pick(enhs) : null });
  S.shop.packOpts = opts;
  Snd.shuffle(); saveAll(); render();
}
function takePackCard(i) {
  var o = S.shop && S.shop.packOpts && S.shop.packOpts[i]; if (!o) return;
  addCard(o.r, o.s, o.e); S.shop.packOpts = null;
  closeOverlay(); toast('Added ' + rankStr(o.r) + SUITS[o.s] + (o.e ? ' (' + ENH[o.e] + ')' : '') + ' to your deck');
  Snd.coin(); saveAll(); render();
}
function sellBot(i) {
  var b = S.bots[i]; if (!b || busy) return;
  var v = Math.max(1, Math.floor(BOTS[b.k].cost / 2));
  S.bots.splice(i, 1); S.money += v;
  closePop(); toast('Sold ' + BOTS[b.k].name + ' for $' + v); Snd.coin();
  saveAll(); render();
}
function sellCon(i) {
  var k = S.cons[i]; if (!k || busy) return;
  S.cons.splice(i, 1); S.money += 1; closePop(); toast('Sold for $1'); Snd.coin(); saveAll(); render();
}
function useCon(i) {
  if (busy) return;
  var k = S.cons[i], d = conDef(k); if (!d) return;
  var cs = S.phase === 'round' ? selectedCards() : [];
  if (d.need[1] > 0) {
    if (S.phase !== 'round') { toast('Use this during a round, with cards selected'); return; }
    if (cs.length < d.need[0] || cs.length > d.need[1]) { toast('Select ' + (d.need[0] === d.need[1] ? d.need[0] : d.need[0] + '-' + d.need[1]) + ' card' + (d.need[1] > 1 ? 's' : '') + ' first'); return; }
  }
  if (REPORTS[k]) {
    S.levels[d.hand]++;
    toast('📄 ' + HT[d.hand].name + ' is now Lv' + S.levels[d.hand]);
  } else if (k === 'windfall') { var g = Math.min(20, Math.max(0, S.money)); S.money += g; toast('💰 +$' + g); }
  else if (k === 'ipo') {
    if (S.bots.length >= S.maxBots) { toast('No free Bot slot'); return; }
    var bk = pickBot(1, []); addBot(bk); toast('🔔 IPO: ' + BOTS[bk].name);
  } else if (k === 'rebal') { var s0 = cs[0].s; cs.forEach(function (c) { c.s = s0; }); }
  else if (k === 'split') { var c0 = cs[0], nid = addCard(c0.r, c0.s, c0.e); S.hand.push(nid); fresh[nid] = 0; }
  else if (k === 'delist') { cs.forEach(function (c) { delete S.cards[c.id]; S.hand = S.hand.filter(function (id) { return id !== c.id; }); }); }
  else if (k === 'upgrade') { cs.forEach(function (c) { c.r = c.r === 14 ? 2 : c.r + 1; }); }
  else { cs.forEach(function (c) { c.e = k; }); }
  S.cons.splice(i, 1);
  closePop();
  Snd.tone(660, 0.08, 'triangle', 0.05); setTimeout(function () { Snd.tone(990, 0.12, 'triangle', 0.05); }, 70);
  if (S.phase === 'round') { sel = []; sortHand(); if (!S.hand.length) { drawToFull(); } }
  saveAll(); render();
  if (k !== 'delist') cs.forEach(function (c) { var e = $('.hand .card[data-id="' + c.id + '"]'); if (e) { popEl(e); floatText(e, 'Upgraded!', 'info'); } });
}
