/* Nova Contrarian - input handling and boot. Classic scripts sharing one global scope; load order: data, core, fx, ui, goals, main. */
'use strict';
// ------------------------------------------------------------------ input
var actions = {
  continue: function () { render(); },
  newrun: function () { if (S && S.phase !== 'over' && !confirmAbandon()) return; newRun({ stake: menuStake }); },
  daily: function () { if (S && S.phase !== 'over' && !confirmAbandon()) return; newRun({ daily: true, date: todayStr() }); },
  stake: function (d) { menuStake = +d.v; render(); },
  tutorial: function () { showTutorial(0); },
  tut: function (d) { showTutorial(+d.v); },
  tutdone: function () { M.tutorialDone = true; saveAll(); closeOverlay(); if (S && S.phase === 'payout') showPayout(); else if (S && S.starter) showStarter(); },
  starter: function (d) { var k = S.starter && S.starter[+d.i]; if (!k) return; addBot(k); S.starter = null; closeOverlay(); Snd.coin(); toast('Hired ' + BOTS[k].name); saveAll(); render(); },
  collection: showCollection, history: showHistory,
  mute: function () { M.mute = !M.mute; saveAll(); if (overlayOpen()) showMenuOverlay(); else render(); },
  speed: function () { M.speed = M.speed >= 2 ? 1 : 2; saveAll(); showMenuOverlay(); },
  menu: function () { if (!busy) showMenuOverlay(); },
  closeov: function () { closeOverlay(); if (S && S.phase === 'payout') showPayout(); else if (S && S.phase === 'blind' && S.starter) showStarter(); else if (S && S.phase === 'shop' && S.shop && S.shop.packOpts) showPack(); },
  tomenu: function () { closeOverlay(); if (S && S.phase === 'over') S = null; saveAll(); $('#screen').innerHTML = menuHTML(); },
  abandon: function () { if (!confirm('Abandon this run? It will count as a loss.')) return; closeOverlay(); endRun(false); },
  finish: function () { closeOverlay(); endRun(true); },
  again: function () { closeOverlay(); var st = S ? S.stake : menuStake, dl = S && S.daily; S = null; if (dl) newRun({ daily: true, date: todayStr() }); else newRun({ stake: st }); },
  startround: function () { if (S.phase === 'blind') startRound(); },
  skip: skipBlind,
  card: function (d) { toggleCard(+d.id); },
  play: playHand, discard: discard,
  sort: function () { if (busy || S.phase !== 'round') return; S.sortMode = S.sortMode === 'rank' ? 'suit' : 'rank'; sortHand(); saveAll(); var b = $('.actions .sort'); if (b) b.textContent = 'Sort: ' + (S.sortMode === 'rank' ? 'Rank' : 'Suit'); fillHand(); updateSelection(); },
  levels: showLevels, deck: showDeck,
  bot: function (d) { showBotPop(+d.i); }, con: function (d) { showConPop(+d.i); },
  closepop: closePop,
  sellbot: function (d) { sellBot(+d.i); }, sellcon: function (d) { sellCon(+d.i); }, usecon: function (d) { useCon(+d.i); },
  botleft: function (d) { var i = +d.i; if (busy || i < 1) return; var t = S.bots[i - 1]; S.bots[i - 1] = S.bots[i]; S.bots[i] = t; saveAll(); render(); showBotPop(i - 1); },
  cashout: function () { closeOverlay(); cashOut(); },
  buy: function (d) { buy(+d.i); }, reroll: reroll, pack: openPack,
  packpick: function (d) { takePackCard(+d.i); }, packskip: function () { if (S.shop) S.shop.packOpts = null; closeOverlay(); saveAll(); },
  nextround: function () { if (S.phase === 'shop') { S.phase = 'blind'; S.shop = null; saveAll(); render(); } }
};
function confirmAbandon() { return confirm('Start a new run? Your current run will be abandoned.'); }

function onClick(ev) {
  Snd.init();
  if (busy) hurry = true;
  var t = ev.target.closest('[data-act]');
  if (!t) { if (!ev.target.closest('#pop')) closePop(); return; }
  if (t.disabled) return;
  var a = t.dataset.act;
  if (busy && ['card', 'play', 'discard', 'sort', 'usecon', 'sellbot', 'sellcon', 'botleft', 'menu', 'levels', 'deck'].indexOf(a) >= 0) return;
  if (a !== 'bot' && a !== 'con' && !t.closest('#pop') && a !== 'card') closePop();
  if (actions[a]) actions[a](t.dataset);
}
function onKey(ev) {
  Snd.init();
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  var k = ev.key;
  if (busy) { hurry = true; if (k === ' ' || k === 'Enter') ev.preventDefault(); return; }
  if (overlayOpen()) {
    if (k === 'Enter' || k === ' ') {
      var btn = $('#overlay .row-btns .btn-cy, #overlay .row-btns .btn-gd, #overlay .menu-btns .btn-cy');
      if (btn) { ev.preventDefault(); btn.click(); }
    } else if (k === 'Escape') {
      if ($('#overlay [data-act="tutdone"]')) actions.tutdone();
      else if ($('#overlay [data-act="packskip"]')) actions.packskip();
      else if ($('#overlay [data-act="closeov"]')) actions.closeov();
    } else if (/^[1-3]$/.test(k) && $('#overlay [data-act="packpick"]')) takePackCard(+k - 1);
    else if (/^[1-3]$/.test(k) && $('#overlay [data-act="starter"]')) actions.starter({ i: +k - 1 });
    return;
  }
  if (!S || S.phase === 'over') { if (k === 'Enter') { var b = $('[data-act="continue"]') || $('[data-act="newrun"]'); if (b) { ev.preventDefault(); b.click(); } } return; }
  if (k === 'Escape') { if (!$('#pop').hidden) closePop(); else if (S.phase === 'round' && sel.length) { sel = []; updateSelection(); } else showMenuOverlay(); return; }
  if (S.phase === 'round') {
    if (/^[1-9]$/.test(k)) { var id = S.hand[+k - 1]; if (id !== undefined) toggleCard(id); }
    else if (k === 'Enter' || k === ' ') { ev.preventDefault(); playHand(); }
    else if (k === 'd' || k === 'D' || k === 'Backspace' || k === 'Delete') { ev.preventDefault(); discard(); }
    else if (k === 's' || k === 'S') actions.sort();
  } else if (S.phase === 'blind') {
    if (k === 'Enter' || k === ' ') { ev.preventDefault(); startRound(); }
    else if (k === 'k' || k === 'K') skipBlind();
  } else if (S.phase === 'shop') {
    if (/^[1-4]$/.test(k)) buy(+k - 1);
    else if (k === '5') openPack();
    else if (k === 'r' || k === 'R') reroll();
    else if (k === 'Enter' || k === 'n' || k === 'N') { ev.preventDefault(); actions.nextround(); }
  }
}

// ------------------------------------------------------------------ boot
function boot() {
  loadAll();
  loadGoalSession();
  fxc = $('#fx'); fxx = fxc && fxc.getContext ? fxc.getContext('2d') : null; resizeFx();
  window.addEventListener('resize', resizeFx);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveAll(); });
  menuStake = S ? S.stake : 1;
  $('#screen').innerHTML = menuHTML();
  // small read-only hook for automated checks
  window.NC = { state: function () { return S; }, meta: function () { return M; }, busy: function () { return busy; }, evalHand: evalHand };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
