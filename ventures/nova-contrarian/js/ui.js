/* Nova Contrarian - rendering, screens, overlays and popovers. Classic scripts sharing one global scope; load order: data, core, fx, ui, goals, main. */
'use strict';
// ------------------------------------------------------------------ rendering
function cardEl(c, o) {
  o = o || {};
  var e = document.createElement('div');
  e.className = 'card s' + c.s + (c.e ? ' e-' + c.e : '') + (S && S.phase === 'round' && isDebuffed(c) ? ' debuff' : '');
  e.dataset.id = c.id;
  e.innerHTML = (o.key ? '<span class="key">' + o.key + '</span>' : '') + '<span class="r">' + rankStr(c.r) + '</span><span class="s">' + SUITS[c.s] +
    '</span><span class="big">' + SUITS[c.s] + '</span>' + (c.e ? '<span class="tag">' + ENH[c.e] + '</span>' : '');
  e.setAttribute('aria-label', rankStr(c.r) + ' of ' + SUIT_NAMES[c.s] + (c.e ? ' (' + ENH[c.e] + ')' : ''));
  return e;
}
function cardHTML(c, extra) { var e = cardEl(c); if (extra) e.className += ' ' + extra; return e.outerHTML; }

function botsHTML() {
  var h = '';
  for (var i = 0; i < S.maxBots; i++) {
    var b = S.bots[i];
    if (!b) { h += '<div class="empty-slot"></div>'; continue; }
    var d = BOTS[b.k], cnt = '';
    if (b.k === 'diamond' && b.d.x > 1) cnt = 'x' + b.d.x;
    if ((b.k === 'dca' || b.k === 'raid') && b.d.c) cnt = '+' + b.d.c;
    if (b.k === 'momentum' && b.d.m) cnt = '+' + b.d.m;
    h += '<div class="bot r' + d.rar + '" data-act="bot" data-i="' + i + '" title="' + esc(d.name) + '"><span class="cnt">' + cnt + '</span><span class="ic">' + d.icon + '</span><span class="nm">' + esc(d.name) + '</span></div>';
  }
  return h;
}
function consHTML() {
  var h = '';
  for (var i = 0; i < S.maxCons; i++) {
    var k = S.cons[i];
    if (!k) { h += '<div class="empty-slot"></div>'; continue; }
    var d = conDef(k);
    h += '<div class="con' + (REPORTS[k] ? ' rep' : '') + '" data-act="con" data-i="' + i + '" title="' + esc(d.name) + '"><span class="ic">' + d.icon + '</span><span class="nm">' + esc(d.name) + '</span></div>';
  }
  return h;
}
function rackHTML() {
  return '<div class="rack"><div class="slots bots"><span class="slot-label">Bots ' + S.bots.length + '/' + S.maxBots + '</span>' + botsHTML() +
    '</div><div class="slots cons"><span class="slot-label">Items</span>' + consHTML() + '</div></div>';
}
function topPills() {
  return '<span class="pill">Ante <b>' + S.ante + '</b>/' + D.WIN_ANTE + '</span><span class="pill">Cash <b class="gd">$' + S.money + '</b></span>' +
    '<span class="pill">' + (S.daily ? 'Daily ' + S.date : 'Stake: ' + D.STAKES[S.stake - 1].name) + '</span>';
}

function render() {
  closePop();
  var sc = $('#screen');
  if (!S || S.phase === 'over') { sc.innerHTML = menuHTML(); return; }
  if (S.phase === 'blind') { sc.innerHTML = blindHTML(); if (S.starter && !overlayOpen()) showStarter(); }
  else if (S.phase === 'round' || S.phase === 'payout') { sc.innerHTML = roundHTML(); fillHand(); updateSelection(); if (S.phase === 'payout' && !overlayOpen()) showPayout(); }
  else if (S.phase === 'shop') { sc.innerHTML = shopHTML(); if (S.shop.packOpts && !overlayOpen()) showPack(); }
  goalEvent('state');
}

function menuHTML() {
  var daily = M.daily[todayStr()];
  var stakes = '';
  for (var i = 1; i <= D.STAKES.length; i++) {
    var locked = i > M.stakeUnlocked;
    stakes += '<button data-act="stake" data-v="' + i + '" class="' + (i === menuStake ? 'on' : '') + '" ' + (locked ? 'disabled title="Win a run on the previous stake to unlock"' : 'title="' + esc(D.STAKES[i - 1].desc) + '"') + '>' + (locked ? '🔒 ' : '') + D.STAKES[i - 1].name + '</button>';
  }
  var fan = [{ id: -1, r: 14, s: 0, e: 'bull' }, { id: -2, r: 13, s: 1, e: null }, { id: -3, r: 12, s: 2, e: 'gold' }, { id: -4, r: 11, s: 3, e: 'bear' }, { id: -5, r: 10, s: 1, e: 'lev' }]
    .map(function (c, i) { var e = cardEl(c); e.style.transform = 'rotate(' + ((i - 2) * 11) + 'deg) translate(' + ((i - 2) * 30) + 'px,' + (Math.abs(i - 2) * 8) + 'px)'; e.style.animationDelay = (i * 80) + 'ms'; return e.outerHTML; }).join('');
  return '<div class="menu"><div class="fan">' + fan + '</div>' +
    '<h1 class="logo"><span class="a">NOVA</span><span class="b">CONTRARIAN</span></h1>' +
    '<p class="tagline">Buy when they panic. Play poker hands for <b class="cy">Chips</b> × <b class="vi">Mult</b>, survive the Dip, the Correction and the Crash, and build a squad of contrarian market Bots.</p>' +
    '<div class="menu-btns">' +
    (S && S.phase !== 'over'
      ? '<button class="btn-cy big-cta" data-act="continue">▶ Continue<small>Ante ' + S.ante + ' · ' + (S.phase === 'shop' ? 'Shop' : D.BLINDS[S.blindIdx].name) + ' · $' + S.money + '</small></button><button data-act="newrun">New Run</button>'
      : '<button class="btn-cy big-cta" data-act="newrun">▶ ' + (M.runs ? 'New Run' : 'Play') + '<small>' + (M.runs ? 'Best: Ante ' + (M.bestAnte || 1) + ' · one tap to start' : 'Quick tutorial, then you are dealt in') + '</small></button>') +
    goalChipHTML() + unlockBarHTML(true) +
    '<div class="stake-row">' + stakes + '</div>' +
    '<button class="btn-vi" data-act="daily">📅 Daily Run <small>' + todayStr() + (daily ? ' · best: Ante ' + daily.ante + (daily.won ? ' ✓' : '') : '') + '</small></button>' +
    '<button data-act="tutorial">How to Play</button>' +
    '<button data-act="collection">Bot Collection <small>(' + Object.keys(M.seen).length + '/' + Object.keys(BOTS).length + ')</small></button>' +
    '<button data-act="history">Records & History</button>' +
    '<button data-act="mute">' + (M.mute ? '🔇 Sound off' : '🔊 Sound on') + '</button>' +
    '</div><div class="menu-foot">A Nova game · Matt\'s Bot Trading League · keys: <kbd>1-8</kbd> select · <kbd>Enter</kbd> play · <kbd>D</kbd> discard</div></div>';
}

function blindHTML() {
  var h = '<div class="screen2"><div class="topbar"><h2 class="h2 cy">Choose your market</h2><span class="grow"></span>' + topPills() + '<button data-act="menu">☰</button></div>' + goalChipHTML() + rackHTML() + '<div class="blinds">';
  D.BLINDS.forEach(function (bl, i) {
    var cur = i === S.blindIdx, st = S.blindState[i];
    h += '<div class="blind ' + bl.key + (cur ? ' cur' : '') + '"><div class="ico">' + (i === 2 ? BOSSES[S.boss.k].icon : bl.icon) + '</div>' +
      '<div class="t">' + bl.name + '</div>' +
      '<div class="dim">Target <span class="tg">' + fmt(blindTarget(S.ante, i)) + '</span></div>' +
      '<div class="gd">Reward $' + bl.reward + '</div>' +
      '<div class="tw">' + (i === 2 ? '<b>' + BOSSES[S.boss.k].name + ':</b> ' + esc(bossDesc(S.boss)) : '') + '</div>';
    if (st === 'done') h += '<div class="done">✓ Beaten</div>';
    else if (st === 'skipped') h += '<div class="skipd">Skipped</div>';
    else if (cur) {
      h += '<button class="btn-cy" data-act="startround">Play <kbd>Enter</kbd></button>';
      if (i < 2) { var tg = D.TAGS[S.tags[i]]; h += '<button data-act="skip">Skip <kbd>K</kbd></button><div class="skiptag">Skip reward: ' + tg.icon + ' ' + tg.desc + '</div>'; }
    } else if (i < 2) { var tg2 = D.TAGS[S.tags[i]]; h += '<div class="skiptag dim">Skip reward: ' + tg2.icon + ' ' + tg2.desc + '</div>'; }
    h += '</div>';
  });
  return h + '</div></div>';
}

function roundHTML() {
  var bl = D.BLINDS[S.blindIdx];
  var boss = S.blindIdx === 2 ? '<div class="twist">' + BOSSES[S.boss.k].icon + ' <b>' + BOSSES[S.boss.k].name + ':</b> ' + esc(bossDesc(S.boss)) + '</div>' : '';
  return '<div class="round"><aside class="side">' +
    '<div class="panel blind-box ' + bl.key + '"><div class="bname">' + bl.icon + ' ' + bl.name + '</div>' + boss + '<div class="target">Target <b>' + fmt(S.target) + '</b> · reward <span class="gd">$' + bl.reward + '</span></div></div>' + goalChipHTML() +
    '<div class="panel score-box"><label>Round score</label><div id="rscore">' + fmt(S.roundScore) + '</div><div class="bar"><i style="width:' + Math.min(100, S.roundScore / S.target * 100) + '%"></i></div></div>' +
    '<div class="panel hand-box"><div id="hname">Select cards</div><div class="cm"><span id="chips" class="chips">0</span><span class="x">×</span><span id="mult" class="mult">0</span></div></div>' +
    '<div class="stats"><div><label>Hands</label><b id="hands">' + S.handsLeft + '</b></div><div><label>Discards</label><b id="discs">' + S.discardsLeft + '</b></div>' +
    '<div><label>Cash</label><b id="money">$' + S.money + '</b></div><div><label>Ante</label><b>' + S.ante + '<small class="dim">/' + D.WIN_ANTE + '</small></b></div></div>' +
    '<div class="side-btns"><button data-act="levels">Hands</button><button data-act="deck">Deck ' + S.draw.length + '</button><button data-act="menu">Menu</button></div>' +
    '</aside><main class="table">' + rackHTML() +
    '<div class="play-area" id="playArea"><div id="handScore">0</div>' + (S.handsPlayedRound === 0 ? '<div class="play-hint">Tap cards to select (max 5) · <b>Play</b> scores them · <b>Discard</b> swaps them for new cards</div>' : '') + '</div>' +
    '<div class="hand" id="hand"></div>' +
    '<div class="actions"><button class="btn-cy" data-act="play" id="btnPlay">Play Hand</button><button class="sort" data-act="sort">Sort: ' + (S.sortMode === 'rank' ? 'Rank' : 'Suit') + '</button><button class="btn-pk" data-act="discard" id="btnDisc">Discard</button></div>' +
    '</main></div>';
}
function fillHand() {
  var h = $('#hand'); if (!h) return;
  h.innerHTML = '';
  S.hand.forEach(function (id, i) {
    var c = card(id), e = cardEl(c, { key: i < 9 ? String(i + 1) : '' });
    e.dataset.act = 'card';
    if (fresh[id] !== undefined) { e.classList.add('deal'); e.style.setProperty('--d', fresh[id]); }
    h.appendChild(e);
  });
  fresh = {};
}
function updateSelection() {
  if (!S || S.phase !== 'round') return;
  $$('.hand .card').forEach(function (e) { e.classList.toggle('sel', sel.indexOf(+e.dataset.id) >= 0); });
  var cs = selectedCards(), hn = $('#hname');
  if (!hn || busy) return;
  if (!cs.length) { hn.textContent = 'Select cards'; setCMRaw(0, 0); }
  else {
    var ev = evalHand(cs), b = baseCM(ev.type);
    var c = b.c, m = b.m;
    if (bossActive() === 'bearmkt') { c = Math.floor(c / 2); m = Math.max(1, Math.floor(m / 2)); }
    hn.innerHTML = esc(HT[ev.type].name) + ' <small>Lv' + b.L + '</small>';
    setCMRaw(c, m);
  }
  var bp = $('#btnPlay'), bd = $('#btnDisc');
  if (bp) bp.disabled = !cs.length;
  if (bd) bd.disabled = !cs.length || S.discardsLeft <= 0;
}
function setCMRaw(c, m) { var ce = $('#chips'), me = $('#mult'); if (ce) ce.textContent = fmt(c); if (me) me.textContent = fmtM(m); }

function shopHTML() {
  var h = '<div class="screen2"><div class="topbar"><h2 class="h2 vi">Market Shop</h2><span class="grow"></span>' + topPills() + '<button data-act="levels">Hands</button><button data-act="deck">Deck</button><button data-act="menu">☰</button></div>' +
    goalChipHTML() + rackHTML() + '<div class="shop"><div class="section-t">For sale · tap an owned Bot or item to inspect / sell / use it</div><div class="offers">';
  S.shop.items.forEach(function (it, i) {
    var d = it.t === 'bot' ? BOTS[it.k] : conDef(it.k);
    var kind = it.t === 'bot' ? 'Bot · ' + D.RAR[d.rar] : (REPORTS[it.k] ? 'Report · level up' : 'Tip · card upgrade');
    var desc = it.t === 'bot' ? d.desc(d.init || {}, null) : d.desc;
    h += '<div class="offer' + (it.t === 'bot' ? ' r' + d.rar : '') + (it.sold ? ' sold' : '') + '"><div class="kind">' + kind + '</div><div class="ic">' + d.icon + '</div><div class="nm">' + esc(d.name) + '</div>' +
      (REPORTS[it.k] ? '<div class="dim" style="font-size:11px">' + HT[d.hand].name + ' is Lv' + S.levels[d.hand] + '</div>' : '') +
      '<div class="ds">' + desc + '</div><button class="btn-gd" data-act="buy" data-i="' + i + '" ' + (it.sold ? 'disabled' : '') + '>' + (it.sold ? 'Sold' : 'Buy $' + it.price) + ' <kbd>' + (i + 1) + '</kbd></button></div>';
  });
  var p = S.shop.pack;
  h += '<div class="offer' + (p.sold ? ' sold' : '') + '"><div class="kind">Asset Pack</div><div class="ic">🃏</div><div class="nm">Asset Pack</div><div class="ds">Choose 1 of 3 cards (often upgraded) to add to your deck.</div>' +
    '<button class="btn-gd" data-act="pack" ' + (p.sold ? 'disabled' : '') + '>' + (p.sold ? 'Sold' : 'Buy $' + p.price) + ' <kbd>5</kbd></button></div>';
  h += '</div><div class="shop-actions"><button data-act="reroll">🔄 Reroll $' + S.shop.reroll + ' <kbd>R</kbd></button><button class="btn-cy" data-act="nextround">Next Round → <kbd>Enter</kbd></button></div>' +
    '<div class="dim" style="text-align:center;font-size:12px">Interest: $1 per $5 you hold at the end of a round (max $' + (5 + 5 * count('compound')) + '). Saving pays.</div>' + unlockBarHTML(false) + '</div></div>';
  return h;
}

// ------------------------------------------------------------------ overlays & popovers
function showOverlay(html, cls) { var o = $('#overlay'); o.innerHTML = '<div class="modal ' + (cls || '') + '">' + html + '</div>'; o.hidden = false; }
function closeOverlay() { var o = $('#overlay'); o.hidden = true; o.innerHTML = ''; }
function overlayOpen() { return !$('#overlay').hidden; }
function closePop() { var p = $('#pop'); if (p) { p.hidden = true; p.innerHTML = ''; } }

function showPayout() {
  var p = S.payout; if (!p) return;
  var h = '<h2 class="gd">Blind beaten! 💰</h2><p>Scored <b class="cy">' + fmt(p.score) + '</b> / ' + fmt(p.target) + '</p>';
  p.lines.forEach(function (l, i) { h += '<div class="pay-line" style="animation-delay:' + (i * 140) + 'ms"><span>' + esc(l[0]) + '</span><b>+$' + l[1] + '</b></div>'; });
  p.msgs.forEach(function (m) { h += '<p class="gn">' + esc(m) + '</p>'; });
  h += '<div class="row-btns"><button class="btn-gd" data-act="cashout" style="width:100%;padding:13px;font-size:17px">Cash out $' + p.total + ' <kbd>Enter</kbd></button></div>';
  showOverlay(h);
}
function showVictory() {
  burst(innerWidth / 2, innerHeight / 3, 160);
  showOverlay('<h2 class="gd">🏆 You beat the market!</h2><p>Ante ' + D.WIN_ANTE + ' Crash survived. ' +
    (M.stakeUnlocked > S.stake && !S.daily ? 'New stake unlocked: <b class="vi">' + D.STAKES[Math.min(D.STAKES.length, S.stake + 1) - 1].name + '</b>.' : '') +
    '</p>' + unlockBarHTML(false) + '<p>Keep going in <b>Endless mode</b> - targets grow 1.7x every ante. How deep can your Bots go?</p>' +
    '<div class="row-btns"><button data-act="finish">Cash out run</button><button class="btn-cy" data-act="closeov">Keep going ∞</button></div>');
}
function showGameOver(e) {
  var bl = D.BLINDS[e.blind], hook = '';
  var pct = S.target ? S.roundScore / S.target : 0;
  if (!e.won && S.target && pct >= 0.6) hook = '<p class="gd">So close: only <b>' + fmt(S.target - S.roundScore) + '</b> short (' + Math.round(pct * 100) + '% of the target).</p>';
  var reached = e.blind === 2 && e.won ? e.ante + 1 : e.ante;
  if (typeof S.prevBest === 'number' && reached > S.prevBest && S.prevBest > 0) hook += '<p class="gn">🏅 New personal best: Ante ' + reached + ' (was ' + S.prevBest + ')</p>';
  else if (M.bestAnte > e.ante) hook += '<p class="dim">Your best is Ante ' + M.bestAnte + '. ' + (M.bestAnte - e.ante === 1 ? 'One ante away.' : 'Run it back?') + '</p>';
  showOverlay('<h2 class="pk">' + (e.won ? '🏆 Run complete' : '📉 Margin called') + '</h2>' +
    '<p>' + (e.won ? 'You won the run and finished at ' : 'Knocked out at ') + '<b>Ante ' + e.ante + ' · ' + bl.name + '</b>' + (S.target && !e.won ? ' (' + fmt(S.roundScore) + ' / ' + fmt(S.target) + ')' : '') + '.</p>' +
    '<p>Best hand: <b class="cy">' + fmt(e.best) + '</b> ' + esc(e.bestName || '') + ' · Hands played: ' + e.hands + '</p>' +
    '<p class="dim">Seed ' + e.seed + (e.daily ? ' · Daily run' : '') + ' · Bots: ' + (e.bots.map(function (k) { return BOTS[k].icon; }).join(' ') || 'none') + '</p>' +
    hook + goalChipHTML() + unlockBarHTML(false) +
    '<div class="row-btns"><button data-act="tomenu">Menu</button><button class="btn-cy big-again" data-act="again">↻ Run it back <kbd>Enter</kbd></button></div>');
}
function showPack() {
  var o = S.shop.packOpts; if (!o) return;
  var h = '<h2>🃏 Asset Pack</h2><p>Pick one card to add to your deck.</p><div class="pack-cards">';
  o.forEach(function (c, i) { var e = cardEl({ id: 'p' + i, r: c.r, s: c.s, e: c.e }); e.dataset.act = 'packpick'; e.dataset.i = i; h += e.outerHTML; });
  h += '</div><p class="dim" style="font-size:12px">BULL +30 Chips · BEAR +4 Mult · GOLD +$2 · LEV x2 Mult (may blow up) · HODL x1.5 Mult while held</p><div class="row-btns"><button data-act="packskip">Skip</button></div>';
  showOverlay(h);
}
function showBotPop(i) {
  var b = S.bots[i]; if (!b) return;
  var d = BOTS[b.k], p = $('#pop');
  p.innerHTML = '<div class="ph"><span class="ic">' + d.icon + '</span><div><b>' + esc(d.name) + '</b><div class="rar">' + D.RAR[d.rar] + ' Bot</div></div></div><p>' + d.desc(b.d, S) + '</p>' +
    '<div class="pb"><button data-act="closepop">Close</button>' + (i > 0 ? '<button data-act="botleft" data-i="' + i + '" title="Move left (order matters: +Mult before xMult)">◀ Move</button>' : '') +
    '<button class="btn-pk" data-act="sellbot" data-i="' + i + '" ' + (busy ? 'disabled' : '') + '>Sell $' + Math.max(1, Math.floor(d.cost / 2)) + '</button></div>';
  p.hidden = false;
}
function showConPop(i) {
  var k = S.cons[i]; if (!k) return;
  var d = conDef(k), p = $('#pop');
  var need = d.need[1] > 0 ? '<p class="dim" style="font-size:12px">Select ' + (d.need[0] === d.need[1] ? d.need[0] : d.need[0] + '-' + d.need[1]) + ' card(s) in your hand during a round, then Use.</p>' : '';
  var lvl = REPORTS[k] ? '<p class="dim" style="font-size:12px">' + HT[d.hand].name + ' is Lv' + S.levels[d.hand] + '</p>' : '';
  p.innerHTML = '<div class="ph"><span class="ic">' + d.icon + '</span><div><b>' + esc(d.name) + '</b><div class="rar">' + (REPORTS[k] ? 'Report' : 'Tip') + '</div></div></div><p>' + d.desc + '</p>' + need + lvl +
    '<div class="pb"><button data-act="closepop">Close</button><button data-act="sellcon" data-i="' + i + '">Sell $1</button><button class="btn-cy" data-act="usecon" data-i="' + i + '">Use</button></div>';
  p.hidden = false;
}
function showLevels() {
  var h = '<h2>Hand levels</h2><table class="tbl"><tr><th>Hand</th><th class="n">Lv</th><th class="n">Chips</th><th class="n">Mult</th><th class="n">Played</th></tr>';
  D.HT_ORDER.slice().reverse().forEach(function (k) { var b = baseCM(k); h += '<tr><td>' + HT[k].name + '</td><td class="n">' + b.L + '</td><td class="n cy">' + b.c + '</td><td class="n vi">' + b.m + '</td><td class="n">' + S.plays[k] + '</td></tr>'; });
  h += '</table><p class="dim" style="font-size:12px">Card chips: 2-10 = face value, J/Q/K = 10, A = 11. Only the cards that make the hand score.</p><div class="row-btns"><button class="btn-cy" data-act="closeov">Close</button></div>';
  showOverlay(h);
}
function showDeck() {
  var inDraw = {}; if (S.phase === 'round') S.draw.forEach(function (id) { inDraw[id] = 1; });
  var all = Object.keys(S.cards).map(function (k) { return S.cards[k]; }).sort(function (a, b) { return a.s - b.s || b.r - a.r; });
  var h = '<h2>Your deck <small class="dim">(' + all.length + ' cards' + (S.phase === 'round' ? ', ' + S.draw.length + ' left to draw' : '') + ')</small></h2><div class="deck-grid">';
  all.forEach(function (c) { h += cardHTML(c, S.phase === 'round' && !inDraw[c.id] ? 'gone' : ''); });
  h += '</div><div class="row-btns"><button class="btn-cy" data-act="closeov">Close</button></div>';
  showOverlay(h);
}
function showMenuOverlay() {
  showOverlay('<h2 class="vi">Paused</h2><p class="dim">Seed ' + S.seed.toString(36).toUpperCase() + (S.daily ? ' · Daily ' + S.date : ' · Stake ' + D.STAKES[S.stake - 1].name) + '</p>' +
    '<div class="menu-btns" style="margin:10px auto">' +
    '<button class="btn-cy" data-act="closeov">Resume</button>' +
    '<button data-act="mute">' + (M.mute ? '🔇 Sound off' : '🔊 Sound on') + '</button>' +
    '<button data-act="speed">Animation speed: ' + (M.speed >= 2 ? 'Fast' : 'Normal') + '</button>' +
    '<button data-act="tutorial">How to Play</button>' +
    '<button data-act="tomenu">Save & quit to menu</button>' +
    '<button class="btn-pk" data-act="abandon">Abandon run</button></div>');
}
var TUT = [
  ['🃏 Play poker hands', 'You hold <b>8 cards</b>. Tap up to <b>5</b> and press <b>Play</b>. Pairs, Two Pair, Three of a Kind, Straights, Flushes, Full Houses, Four of a Kind and Straight Flushes all score. Only the cards that make the hand count.'],
  ['✖ Chips × Mult', 'Every hand type has base <b class="cy">Chips</b> and <b class="vi">Mult</b>. Each scoring card adds its chips (2-10 face value, J/Q/K 10, A 11). Your score is <b class="cy">Chips</b> × <b class="vi">Mult</b>.'],
  ['📉 Beat the market', 'Each round has a target. You get <b>4 hands</b> and <b>3 discards</b> (discard = swap selected cards for new ones). Each ante has <b class="cy">The Dip</b>, <b class="vi">The Correction</b>, then <b class="pk">The Crash</b> boss with a twist rule. You may skip the first two for a free tag.'],
  ['🤖 Hire Bots', 'Win rounds to earn cash (+$1 per unused hand, +$1 interest per $5 saved). Spend it in the shop on <b>Bots</b> (passive powers, max 5), <b>Tips</b> (upgrade cards) and <b>Reports</b> (level up a hand type).'],
  ['🔄 Think contrarian', 'Many Bots reward what others avoid: discarding (Buy the Dip), playing few cards (The Contrarian, Flash Crash), holding cards (Bagholder), or clutch last hands (Short Squeeze). Find synergies! Beat <b>Ante 8</b> to win, then go endless.<br><br>Keys: <kbd>1-8</kbd> select · <kbd>Enter</kbd> play · <kbd>D</kbd> discard · <kbd>S</kbd> sort · <kbd>Esc</kbd> menu. Tap during scoring to speed up.']
];
function showTutorial(i) {
  var t = TUT[i], dots = TUT.map(function (_, j) { return '<i class="' + (j === i ? 'on' : '') + '"></i>'; }).join('');
  showOverlay('<div class="tut-step"><h2>' + t[0] + '</h2><p>' + t[1] + '</p></div><div class="tut-dots">' + dots + '</div>' +
    '<div class="row-btns">' + (i > 0 ? '<button data-act="tut" data-v="' + (i - 1) + '">Back</button>' : '<button data-act="tutdone">Skip</button>') +
    (i < TUT.length - 1 ? '<button class="btn-cy" data-act="tut" data-v="' + (i + 1) + '">Next <kbd>Enter</kbd></button>' : '<button class="btn-cy" data-act="tutdone">Let\'s trade! <kbd>Enter</kbd></button>') + '</div>');
}
function showCollection() {
  var h = '<h2>Bot Collection <small class="dim">' + Object.keys(M.seen).length + '/' + Object.keys(BOTS).length + ' discovered</small></h2><div class="coll">';
  Object.keys(BOTS).forEach(function (k) {
    var d = BOTS[k], seen = M.seen[k];
    h += '<div class="item' + (seen ? '' : ' locked') + '"><b>' + (seen ? d.icon + ' ' + esc(d.name) : '❔ ???') + '</b><span class="dim">' + D.RAR[d.rar] + ' · $' + d.cost + '</span><br>' + (seen ? d.desc(d.init || {}, null) : 'Appears in the shop to discover.') + '</div>';
  });
  h += '</div><div class="row-btns"><button class="btn-cy" data-act="closeov">Close</button></div>';
  showOverlay(h);
}
function showHistory() {
  var h = '<h2>Records</h2><div class="records"><div><b>' + M.runs + '</b><span>Runs</span></div><div><b>' + M.wins + '</b><span>Wins</span></div><div><b>' + (M.bestAnte || '-') + '</b><span>Best ante</span></div>' +
    '<div><b>' + fmt(M.bestHand) + '</b><span>Best hand' + (M.bestHandName ? ' (' + esc(M.bestHandName) + ')' : '') + '</span></div><div><b>' + D.STAKES[M.stakeUnlocked - 1].name + '</b><span>Top stake unlocked</span></div><div><b>' + fmt(M.handsPlayed) + '</b><span>Hands played</span></div></div>';
  var dk = Object.keys(M.daily).sort().reverse().slice(0, 7);
  if (dk.length) {
    h += '<div class="section-t">Daily runs</div><table class="tbl"><tr><th>Date</th><th class="n">Reached</th><th class="n">Best hand</th></tr>';
    dk.forEach(function (k) { var r = M.daily[k]; h += '<tr><td>' + k + '</td><td class="n">Ante ' + r.ante + (r.won ? ' 🏆' : '') + '</td><td class="n">' + fmt(r.best) + '</td></tr>'; });
    h += '</table><br>';
  }
  h += '<div class="section-t">Recent runs</div><table class="tbl"><tr><th>When</th><th>Mode</th><th class="n">Reached</th><th class="n">Best</th><th>Bots</th></tr>';
  if (!M.history.length) h += '<tr><td colspan="5" class="dim">No finished runs yet.</td></tr>';
  M.history.forEach(function (e) {
    var d = new Date(e.d);
    h += '<tr><td>' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + '</td><td>' + (e.daily ? 'Daily' : D.STAKES[e.stake - 1].name) + '</td><td class="n">A' + e.ante + (e.won ? ' 🏆' : '') + '</td><td class="n">' + fmt(e.best) + '</td><td>' + e.bots.map(function (k) { return BOTS[k] ? BOTS[k].icon : ''; }).join('') + '</td></tr>';
  });
  h += '</table><div class="row-btns"><button class="btn-cy" data-act="closeov">Close</button></div>';
  showOverlay(h);
}
