/* Nova Contrarian - static game data (hand types, Bots, Tips, Reports, Crash bosses). */
(function (G) {
  'use strict';
  G.HT = {
    high:    { name: 'High Card',       c: 5,   m: 1, lc: 10, lm: 1 },
    pair:    { name: 'Pair',            c: 10,  m: 2, lc: 15, lm: 1 },
    two:     { name: 'Two Pair',        c: 20,  m: 2, lc: 20, lm: 1 },
    trips:   { name: 'Three of a Kind', c: 30,  m: 3, lc: 20, lm: 2 },
    straight:{ name: 'Straight',        c: 30,  m: 4, lc: 30, lm: 3 },
    flush:   { name: 'Flush',           c: 35,  m: 4, lc: 15, lm: 2 },
    full:    { name: 'Full House',      c: 40,  m: 4, lc: 25, lm: 2 },
    quads:   { name: 'Four of a Kind',  c: 60,  m: 7, lc: 30, lm: 3 },
    sflush:  { name: 'Straight Flush',  c: 100, m: 8, lc: 40, lm: 4 }
  };
  G.HT_ORDER = ['high', 'pair', 'two', 'trips', 'straight', 'flush', 'full', 'quads', 'sflush'];
  G.RAR = ['', 'Common', 'Uncommon', 'Rare'];

  var face = function (c) { return c.r >= 11 && c.r <= 13; };

  // Bots = passive modifiers. Hooks: pre(x,b,S) card(x,card,A,b,S) hand(x,A,b,S) after(x,b,S)
  // discard(cards,b,S)->$ roundEnd(b,S)->{money,msg}. A.chips/A.mult/A.x/A.money add a scoring step.
  G.BOTS = {
    dip: { name: 'Buy the Dip', icon: '📉', rar: 1, cost: 5,
      desc: function (d, S) { return '+3 Mult for each discard used this round' + (S && S.phase === 'round' ? ' <i>(now +' + 3 * S.discardsUsed + ')</i>' : '') + '.'; },
      hand: function (x, A, b, S) { if (S.discardsUsed) A.mult(3 * S.discardsUsed); } },
    panic: { name: 'Panic Seller', icon: '😱', rar: 1, cost: 5,
      desc: function () { return '<b>x2 Mult</b> if you play with 0 discards left.'; },
      hand: function (x, A, b, S) { if (S.discardsLeft === 0) A.x(2); } },
    diamond: { name: 'Diamond Hands', icon: '💎', rar: 2, cost: 7, init: { x: 1 },
      desc: function (d) { return 'Gains <b>x0.25 Mult</b> after every round you win without discarding. <i>(now x' + d.x + ')</i>'; },
      hand: function (x, A, b) { if (b.d.x > 1) A.x(b.d.x); },
      roundEnd: function (b, S) { if (S.discardsUsed === 0) { b.d.x = Math.round((b.d.x + 0.25) * 100) / 100; return { msg: 'Diamond Hands x' + b.d.x }; } } },
    squeeze: { name: 'Short Squeeze', icon: '🚀', rar: 2, cost: 7,
      desc: function () { return '<b>x3 Mult</b> on the final hand of the round.'; },
      hand: function (x, A, b, S) { if (S.handsLeft === 0) A.x(3); } },
    beartrap: { name: 'Bear Trap', icon: '🐻', rar: 1, cost: 5,
      desc: function () { return 'Each scored card ranked 2-5 gives <b>+5 Mult</b>.'; },
      card: function (x, c, A) { if (c.r <= 5) A.mult(5); } },
    contra: { name: 'The Contrarian', icon: '🔄', rar: 1, cost: 5,
      desc: function () { return '<b>+5 Mult</b> for each card fewer than 5 you play.'; },
      hand: function (x, A) { var n = 5 - x.played.length; if (n > 0) A.mult(5 * n); } },
    dca: { name: 'Dollar-Cost Averager', icon: '🪙', rar: 1, cost: 5, init: { c: 0 },
      desc: function (d) { return 'Gains <b>+3 Chips</b> permanently for every card you play. <i>(now +' + d.c + ')</i>'; },
      hand: function (x, A, b) { if (b.d.c) A.chips(b.d.c); },
      after: function (x, b) { b.d.c += 3 * x.played.length; } },
    momentum: { name: 'Momentum', icon: '📈', rar: 2, cost: 6, init: { m: 0 },
      desc: function (d) { return 'Gains <b>+4 Mult</b> each time you repeat the same hand type in a row; resets otherwise. <i>(now +' + d.m + ')</i>'; },
      pre: function (x, b, S) { if (S.lastType === x.type) b.d.m += 4; else b.d.m = 0; },
      hand: function (x, A, b) { if (b.d.m) A.mult(b.d.m); } },
    revert: { name: 'Mean Reversion', icon: '🧲', rar: 1, cost: 5,
      desc: function () { return '<b>x1.5 Mult</b> if this hand type differs from your last one.'; },
      hand: function (x, A, b, S) { if (S.lastType && S.lastType !== x.type) A.x(1.5); } },
    dividend: { name: 'Dividend Payer', icon: '💵', rar: 1, cost: 4,
      desc: function () { return 'Earn <b>$3</b> at the end of every round.'; },
      roundEnd: function () { return { money: 3 }; } },
    compound: { name: 'Compound Interest', icon: '🏦', rar: 2, cost: 6,
      desc: function () { return 'Interest cap raised by <b>$5</b> (earn up to $10 interest).'; } },
    bluechip: { name: 'Blue Chip', icon: '🔷', rar: 1, cost: 5,
      desc: function () { return 'Each scored J, Q or K gives <b>+30 Chips</b>.'; },
      card: function (x, c, A) { if (face(c)) A.chips(30); } },
    penny: { name: 'Penny Stock', icon: '🎟️', rar: 1, cost: 4,
      desc: function () { return 'Each scored 2 or 3 gives <b>+20 Chips</b> and <b>+4 Mult</b>.'; },
      card: function (x, c, A) { if (c.r === 2 || c.r === 3) { A.chips(20); A.mult(4); } } },
    hedge: { name: 'Hedge Fund', icon: '🛡️', rar: 2, cost: 6,
      desc: function (d, S) { return '<b>+1 Mult</b> for every $4 you hold' + (S ? ' <i>(now +' + Math.floor(Math.max(0, S.money) / 4) + ')</i>' : '') + '.'; },
      hand: function (x, A, b, S) { var n = Math.floor(Math.max(0, S.money) / 4); if (n) A.mult(n); } },
    insider: { name: 'Insider Info', icon: '🕵️', rar: 1, cost: 5,
      desc: function () { return '<b>+120 Chips</b> on the first hand of each round.'; },
      hand: function (x, A, b, S) { if (S.handsPlayedRound === 0) A.chips(120); } },
    liquidity: { name: 'Liquidity Pool', icon: '🌊', rar: 1, cost: 5,
      desc: function () { return '<b>+3 Chips</b> for each card left in your draw pile.'; },
      hand: function (x, A, b, S) { if (S.draw.length) A.chips(3 * S.draw.length); } },
    flash: { name: 'Flash Crash', icon: '⚡', rar: 2, cost: 6,
      desc: function () { return '<b>x3 Mult</b> if you play exactly 1 card.'; },
      hand: function (x, A) { if (x.played.length === 1) A.x(3); } },
    whale: { name: 'Whale Alert', icon: '🐋', rar: 2, cost: 6,
      desc: function () { return '<b>x2 Mult</b> if the hand contains a Flush.'; },
      hand: function (x, A) { if (x.contains.flush) A.x(2); } },
    bullrun: { name: 'Bull Run', icon: '🐂', rar: 1, cost: 5,
      desc: function () { return '<b>+12 Mult</b> if the hand contains a Straight.'; },
      hand: function (x, A) { if (x.contains.straight) A.mult(12); } },
    pairs: { name: 'Pairs Trader', icon: '👯', rar: 1, cost: 4,
      desc: function () { return '<b>+8 Mult</b> if the hand contains a Pair.'; },
      hand: function (x, A) { if (x.contains.pair) A.mult(8); } },
    stoploss: { name: 'Stop Loss', icon: '🛑', rar: 3, cost: 6,
      desc: function () { return 'If you fail a round with at least <b>50%</b> of the target, you survive. Self-destructs.'; } },
    breaker: { name: 'Circuit Breaker', icon: '🔌', rar: 2, cost: 6,
      desc: function () { return '<b>+1 hand</b> every round.'; } },
    daytrader: { name: 'Day Trader', icon: '⏱️', rar: 1, cost: 5,
      desc: function () { return '<b>+1 discard</b> every round.'; } },
    algo: { name: 'Algo Trader', icon: '🤖', rar: 3, cost: 8,
      desc: function () { return 'The first scored card is <b>retriggered 2 extra times</b>.'; } },
    vol: { name: 'Volatility Index', icon: '🎲', rar: 1, cost: 4,
      desc: function () { return '<b>+0 to +23 Mult</b>, random every hand.'; },
      hand: function (x, A, b, S, rnd) { var n = Math.floor(rnd() * 24); A.mult(n); } },
    rotation: { name: 'Sector Rotation', icon: '🧭', rar: 2, cost: 7,
      desc: function () { return '<b>x3 Mult</b> if the played cards include all four suits.'; },
      hand: function (x, A) { var s = {}; x.played.forEach(function (c) { s[c.s] = 1; }); if (Object.keys(s).length === 4) A.x(3); } },
    bag: { name: 'Bagholder', icon: '🎒', rar: 1, cost: 5,
      desc: function () { return '<b>+2 Mult</b> for each card left in your hand (not played).'; },
      hand: function (x, A) { if (x.held.length) A.mult(2 * x.held.length); } },
    harvest: { name: 'Tax-Loss Harvester', icon: '🌾', rar: 1, cost: 4,
      desc: function () { return 'Earn <b>$1</b> for each card ranked 2-5 you discard.'; },
      discard: function (cards) { return cards.filter(function (c) { return c.r <= 5; }).length; } },
    leverage: { name: 'Leverage Bot', icon: '🎰', rar: 3, cost: 8,
      desc: function () { return '<b>x2.5 Mult</b> on every hand, but <b>-1 hand</b> each round.'; },
      hand: function (x, A) { A.x(2.5); } },
    raid: { name: 'Bear Raid', icon: '🐾', rar: 1, cost: 5, init: { c: 0 },
      desc: function (d) { return 'Gains <b>+3 Chips</b> permanently for every card you discard. <i>(now +' + d.c + ')</i>'; },
      discard: function (cards, b) { b.d.c += 3 * cards.length; return 0; },
      hand: function (x, A, b) { if (b.d.c) A.chips(b.d.c); } },
    cold: { name: 'Cold Wallet', icon: '🧊', rar: 2, cost: 6,
      desc: function () { return 'HODL cards held in hand give <b>x2</b> instead of x1.5. Each HODL card held also <b>+10 Chips</b>.'; } },
    goldstd: { name: 'Gold Standard', icon: '🥇', rar: 2, cost: 6,
      desc: function () { return 'Scored GOLD cards also give <b>x1.5 Mult</b>.'; } },
    analyst: { name: 'Research Analyst', icon: '🔬', rar: 1, cost: 5,
      desc: function () { return '<b>+3 Mult</b> per level of the played hand type.'; },
      hand: function (x, A, b, S) { A.mult(3 * (S.levels[x.type] || 1)); } },
    index: { name: 'Index Fund', icon: '🗂️', rar: 3, cost: 8,
      desc: function (d, S) { return '<b>x0.3 Mult</b> for each Bot you own (incl. this)' + (S && S.bots ? ' <i>(now x' + (1 + 0.3 * S.bots.length).toFixed(1) + ')</i>' : '') + '.'; },
      hand: function (x, A, b, S) { A.x(Math.round((1 + 0.3 * S.bots.length) * 10) / 10); } }
  };

  // Tips = one-shot card upgrades (tarot-like). need = [min,max] selected cards.
  G.TIPS = {
    bull:    { name: 'Bull Tip',   icon: '🟦', need: [1, 2], desc: 'Upgrade up to 2 selected cards to <b>BULL</b> (+30 Chips when scored).' },
    bear:    { name: 'Bear Tip',   icon: '🟪', need: [1, 2], desc: 'Upgrade up to 2 selected cards to <b>BEAR</b> (+4 Mult when scored).' },
    gold:    { name: 'Gold Tip',   icon: '🟨', need: [1, 2], desc: 'Upgrade up to 2 selected cards to <b>GOLD</b> (+$2 when scored).' },
    lev:     { name: 'Margin Tip', icon: '🟥', need: [1, 1], desc: 'Upgrade 1 selected card to <b>LEVERAGED</b> (x2 Mult when scored, 1 in 4 chance to blow up).' },
    hodl:    { name: 'HODL Tip',   icon: '⬜', need: [1, 2], desc: 'Upgrade up to 2 selected cards to <b>HODL</b> (x1.5 Mult while held in hand, unplayed).' },
    rebal:   { name: 'Rebalance',  icon: '♻️', need: [2, 3], desc: 'Convert up to 3 selected cards to the suit of the <b>left-most</b> selected card.' },
    split:   { name: 'Stock Split',icon: '✂️', need: [1, 1], desc: 'Add an exact copy of 1 selected card to your deck (and hand).' },
    delist:  { name: 'Delist',     icon: '🗑️', need: [1, 2], desc: 'Destroy up to 2 selected cards (thin your deck).' },
    upgrade: { name: 'Upgrade',    icon: '⏫', need: [1, 2], desc: 'Raise the rank of up to 2 selected cards by 1 (A wraps to 2).' },
    windfall:{ name: 'Windfall',   icon: '💰', need: [0, 0], desc: 'Double your cash (max +$20).' },
    ipo:     { name: 'IPO',        icon: '🔔', need: [0, 0], desc: 'Create a random Common Bot (needs a free slot).' }
  };
  G.TIP_KEYS = Object.keys(G.TIPS);

  // Reports = level up a hand type (planet-like)
  G.REPORTS = {};
  var repNames = { high: 'Penny Report', pair: 'Pair Report', two: 'Twin Earnings', trips: 'Triple Beat', straight: 'Trend Report',
    flush: 'Sector Report', full: 'Annual Report', quads: 'Quad Witching', sflush: 'Black Swan Memo' };
  G.HT_ORDER.forEach(function (k) {
    G.REPORTS['rp_' + k] = { name: repNames[k], icon: '📄', hand: k, need: [0, 0],
      desc: 'Level up <b>' + G.HT[k].name + '</b> (+' + G.HT[k].lc + ' Chips, +' + G.HT[k].lm + ' Mult).' };
  });

  // Crash boss twists
  G.BOSSES = {
    crunch:   { name: 'Liquidity Crunch', icon: '🧊', desc: 'No discards this round.' },
    halt:     { name: 'Trading Halt',     icon: '⛔', desc: '-1 hand this round.' },
    freeze:   { name: 'Flash Freeze',     icon: '❄️', desc: 'Hand size -2 this round.' },
    selloff:  { name: 'Sector Sell-off',  icon: '🔻', desc: 'All {suit} cards are debuffed (score nothing).' },
    blackout: { name: 'Earnings Blackout',icon: '🌑', desc: 'Face cards (J, Q, K) are debuffed.' },
    bearmkt:  { name: 'Bear Market',      icon: '🐻‍❄️', desc: 'Base Chips and Mult of every hand are halved.' },
    margin:   { name: 'Margin Call',      icon: '📞', desc: 'Every hand must use exactly 5 cards.' }
  };
  G.BOSS_KEYS = Object.keys(G.BOSSES);

  G.TAGS = {
    cash:   { name: 'Cash Tag',   icon: '💵', desc: '+$7 now' },
    report: { name: 'Report Tag', icon: '📄', desc: 'Free random Report' },
    tip:    { name: 'Tip Tag',    icon: '🎫', desc: 'Free random Tip' },
    bot:    { name: 'Bot Tag',    icon: '🤖', desc: 'Free Common Bot' }
  };
  G.STAKES = [
    { name: 'Calm',       desc: 'Standard market.' },
    { name: 'Volatile',   desc: 'Targets x1.2.' },
    { name: 'Bear',       desc: 'Targets x1.4, -1 discard.' },
    { name: 'Crisis',     desc: 'Targets x1.6, -1 discard.' },
    { name: 'Black Swan', desc: 'Targets x1.8, -1 discard, -1 hand.' }
  ];
  G.BLINDS = [
    { key: 'dip', name: 'The Dip', icon: '📉', mult: 1, reward: 3 },
    { key: 'cor', name: 'The Correction', icon: '📊', mult: 1.5, reward: 4 },
    { key: 'crash', name: 'The Crash', icon: '💥', mult: 2, reward: 5 }
  ];
  G.ANTE_BASE = [300, 650, 1500, 3800, 8500, 16000, 29000, 46000];
  G.WIN_ANTE = 8;
})(window.NCData = {});
