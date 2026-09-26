/* Nova Contrarian - session goals, lifetime milestones and "next unlock" progress. Classic scripts sharing one global scope; load order: data, core, fx, ui, goals, main. */
'use strict';
// Session goals: a chain that restarts each time the page is opened (same idea as a tracker session).
// Progress carries across runs within the session, so there is always a next target just ahead.
var GOALS = [
  { txt: 'Win a round', r: 2, ev: 'win', ok: function () { return true; } },
  { txt: 'Score 300+ in one hand', r: 2, ev: 'hand', ok: function (x) { return x.score >= 300; } },
  { txt: 'Play a Flush', r: 3, ev: 'hand', ok: function (x) { return x.contains.flush; } },
  { txt: 'Own 3 Bots at once', r: 3, ev: 'state', ok: function () { return S && S.bots.length >= 3; }, prog: function () { return S ? S.bots.length + '/3' : ''; } },
  { txt: 'Beat a Crash boss', r: 3, ev: 'win', ok: function (w) { return w.blindIdx === 2; } },
  { txt: 'Reach Ante 3', r: 3, ev: 'state', ok: function () { return S && S.ante >= 3; }, prog: function () { return S ? 'now ' + S.ante : ''; } },
  { txt: 'Play a Full House or better', r: 4, ev: 'hand', ok: function (x) { return ['full', 'quads', 'sflush'].indexOf(x.type) >= 0; } },
  { txt: 'Score 2,000+ in one hand', r: 4, ev: 'hand', ok: function (x) { return x.score >= 2000; } },
  { txt: 'Win a round with a single hand', r: 4, ev: 'win', ok: function (w) { return w.handsUsed === 1; } },
  { txt: 'Own 5 Bots at once', r: 4, ev: 'state', ok: function () { return S && S.bots.length >= 5; }, prog: function () { return S ? S.bots.length + '/5' : ''; } },
  { txt: 'Reach Ante 5', r: 5, ev: 'state', ok: function () { return S && S.ante >= 5; }, prog: function () { return S ? 'now ' + S.ante : ''; } },
  { txt: 'Score 10,000+ in one hand', r: 5, ev: 'hand', ok: function (x) { return x.score >= 10000; } },
  { txt: 'Reach Ante 7', r: 5, ev: 'state', ok: function () { return S && S.ante >= 7; }, prog: function () { return S ? 'now ' + S.ante : ''; } },
  { txt: 'Beat the Ante 8 Crash', r: 6, ev: 'win', ok: function (w) { return w.blindIdx === 2 && w.ante >= 8; } }
];
var goalSess = { idx: 0, done: 0 };
function loadGoalSession() {
  try { var o = JSON.parse(sessionStorage.getItem('nova-contrarian:session') || 'null'); if (o && typeof o.idx === 'number') goalSess = o; } catch (e) { /* ignore */ }
}
function saveGoalSession() { try { sessionStorage.setItem('nova-contrarian:session', JSON.stringify(goalSess)); } catch (e) { /* ignore */ } }
function currentGoal() {
  if (goalSess.idx < GOALS.length) return GOALS[goalSess.idx];
  var k = goalSess.idx - GOALS.length, n = 25000 * Math.pow(2, k);
  return { txt: 'Score ' + fmt(n) + '+ in one hand', r: 6, ev: 'hand', ok: function (x) { return x.score >= n; } };
}
function goalEvent(ev, data) {
  var guard = 0;
  while (guard++ < 5) {
    var g = currentGoal();
    var hit = g.ev === 'state' ? g.ok() : (g.ev === ev && g.ok(data || {}));
    if (!hit) break;
    completeGoal(g);
    ev = 'state'; // the next goal may already be satisfied by the current state
  }
  updateGoalChips();
}
function startCashBonus() { return Math.min(5, Math.floor((M.goalsDone || 0) / 5)); }
function completeGoal(g) {
  var before = startCashBonus();
  goalSess.idx++; goalSess.done++; M.goalsDone = (M.goalsDone || 0) + 1;
  var inRun = S && S.phase !== 'over';
  if (inRun) { S.money += g.r; var me = $('#money'); if (me) me.textContent = '$' + S.money; }
  var perk = startCashBonus() > before ? ' · Unlocked: +$1 starting cash!' : '';
  saveGoalSession(); saveAll();
  showGoalBanner('🎯 ' + g.txt + (inRun ? ' <b class="gd">+$' + g.r + '</b>' : '') + perk, currentGoal());
  Snd.coin(); setTimeout(function () { Snd.tone(1568, 0.16, 'triangle', 0.05); }, 150);
  burst(innerWidth / 2, 40, 40, ['#3dffa8', '#22e6ff', '#ffc94d']);
}
function showGoalBanner(html, next) {
  var b = $('#goalban');
  if (!b) { b = document.createElement('div'); b.id = 'goalban'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
  b.innerHTML = '<div class="gb-t">Goal complete</div><div>' + html + '</div><div class="gb-n">Next: ' + esc(next.txt) + ' <span class="gd">+$' + next.r + '</span></div>';
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(showGoalBanner._t); showGoalBanner._t = setTimeout(function () { b.classList.remove('show'); }, 3200);
}
function goalChipHTML() {
  var g = currentGoal(), p = g.prog ? g.prog() : '';
  return '<div class="goal-chip" title="Session goal: completing it pays cash in your run and counts toward permanent unlocks">🎯 <span class="gc-t">' + esc(g.txt) + (p ? ' <small class="dim">(' + esc(p) + ')</small>' : '') + '</span> <b class="gd">+$' + g.r + '</b>' +
    (goalSess.done ? '<span class="gc-n">' + goalSess.done + ' done</span>' : '') + '</div>';
}
function updateGoalChips() { var h = goalChipHTML(); $$('.goal-chip').forEach(function (e) { e.outerHTML = h; }); }

// ---- lifetime unlock tracks (always something just ahead)
function bestAnteOn(stake) { var b = (M.bestAnteByStake || {})[stake] || 0; if (stake === 1) b = Math.max(b, M.bestAnte || 0); return b; }
function unlockTracks() {
  var t = [], seen = Object.keys(M.seen).length, total = Object.keys(BOTS).length;
  var gd = M.goalsDone || 0;
  if (startCashBonus() < 5) t.push({ ic: '💵', name: '+$1 starting cash (now +$' + startCashBonus() + ')', cur: gd % 5, max: 5, unit: 'goals' });
  var ms = [[12, '4 starter Bot choices'], [24, 'an Uncommon starter choice'], [total, 'Collector title']];
  for (var i = 0; i < ms.length; i++) if (seen < ms[i][0]) { t.push({ ic: '🤖', name: ms[i][1], cur: seen, max: ms[i][0], unit: 'Bots discovered' }); break; }
  if (M.stakeUnlocked < D.STAKES.length) {
    var s = M.stakeUnlocked, b = bestAnteOn(s);
    t.push({ ic: '🔓', name: D.STAKES[s].name + ' stake (beat Ante 8 on ' + D.STAKES[s - 1].name + ')', cur: Math.max(0, Math.min(8, b - 1)), max: 8, unit: 'antes cleared' });
  }
  return t;
}
function unlockBarHTML(all) {
  var t = unlockTracks(); if (!t.length) return '';
  if (!all) { t.sort(function (a, b) { return b.cur / b.max - a.cur / a.max; }); t = t.slice(0, 1); }
  return '<div class="unlocks">' + t.map(function (u) {
    return '<div class="unlock"><div class="ul-t">' + u.ic + ' Next unlock: <b>' + esc(u.name) + '</b> <span class="dim">' + u.cur + '/' + u.max + ' ' + u.unit + '</span></div><div class="ul-bar"><i style="width:' + Math.round(u.cur / u.max * 100) + '%"></i></div></div>';
  }).join('') + '</div>';
}
function starterCount() { return Object.keys(M.seen).length >= 12 ? 4 : 3; }
function starterPicks() {
  var ex = [], n = starterCount();
  for (var q = 0; q < n; q++) { var rar = (q === n - 1 && Object.keys(M.seen).length >= 24) ? 2 : 1; var k = pickBot(rar, ex); ex.push(k); M.seen[k] = 1; }
  return ex;
}
