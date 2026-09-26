/* Blitz Rush — DOM menus: title, shop, trophies, records, settings, pause, run summary, toasts */
'use strict';

BR.ui = (() => {
  const $ = (id) => document.getElementById(id);
  const M = BR.meta, { fmtInt, fmtMoney, fmtTime } = BR.util;
  const SCREENS = ['menu', 'shop', 'trophies', 'records', 'settings', 'pause', 'over', 'perk'];
  let shopTab = 'upgrades';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function show(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    if (id === 'menu') renderMenu();
    if (id === 'shop') renderShop();
    if (id === 'trophies') renderTrophies();
    if (id === 'records') renderRecords();
    if (id === 'settings') renderSettings();
  }
  const hideAll = () => SCREENS.forEach((s) => $(s).classList.add('hidden'));

  function updateBadges() {
    const n = M.affordableCount();
    for (const id of ['shopBadge', 'shopBadgeO']) { $(id).textContent = n; $(id).classList.toggle('hidden', n === 0); }
    document.querySelectorAll('.coinsNow').forEach((e) => { e.textContent = fmtInt(M.save.coins); });
  }

  // ---------- title ----------
  function renderMenu() {
    const s = M.save;
    $('mCoins').textContent = fmtInt(s.coins);
    $('mBest').textContent = fmtMoney(s.bestScore);
    $('mRank').textContent = M.rankName(s.rank);
    $('mRankBar').style.width = `${((s.missionsDone % 3) / 3) * 100}%`;
    const d = M.dailyInfo();
    $('mDaily').textContent = d.won ? `✓ Beaten! Best ${fmtMoney(d.best)}` : `Beat ${fmtMoney(d.target)} → +250 coins${d.best ? ` · best ${fmtMoney(d.best)}` : ''}`;
    renderMissions($('mMissions'), null, [], true);
    renderGoals($('mGoals'));
    const touch = matchMedia('(pointer: coarse)').matches;
    $('controlsHint').textContent = touch ? 'Tap right side: jump · Hold left side: dive' : 'Space / click: jump · Hold ↓ or S: dive · P: pause · M: mute';
    updateBadges();
  }

  // "Next goal" cards: cheapest unlock, a bigger goal (character / heavy upgrade), and the next free content unlock.
  function goalCard(label, g, coins) {
    const ready = coins >= g.cost, pct = Math.min(100, (coins / g.cost) * 100);
    return `<div class="goal-card${ready ? ' ready' : ''}"><div class="gl"><span>${esc(label)}</span><span>${ready ? '✅ affordable now!' : `${fmtInt(g.cost - coins)} to go`}</span></div>
      <div><b>${esc(g.name)}</b> <span style="color:var(--muted)">· <span class="coin-ico">$</span> ${fmtInt(g.cost)}${g.perk ? ` · ${esc(g.perk)}` : ''}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }
  function renderGoals(el) {
    const coins = M.save.coins, g = M.nextGoal(), b = M.bigGoal(), c = M.nextContent();
    let html = '';
    if (g) html += goalCard('Next unlock', g, coins);
    if (b && (!g || b.name !== g.name)) html += goalCard('Big goal', b, coins);
    if (c) html += `<div class="goal-card content"><div class="gl"><span>Coming up (free)</span></div><div>${esc(c)}</div></div>`;
    if (!html) html = `<div class="goal-card"><b>You own everything.</b> Chase the leaderboard!</div>`;
    el.innerHTML = html;
  }

  // ---------- perk picker ----------
  function renderPerk(choices, game) {
    $('perkCards').innerHTML = choices.map((q, i) => {
      const lv = game.perks[q.id] || 0;
      return `<button class="perk-card" data-perk="${q.id}" style="animation-delay:${i * 0.07}s"><span class="pk">${i + 1}</span><span class="pi">${q.icon}</span>
        <div><h4>${esc(q.name)}</h4><p>${esc(q.desc)}</p>${lv ? `<span class="lv">stack ${lv + 1}/${q.max}</span>` : ''}</div></button>`;
    }).join('');
    const touch = matchMedia('(pointer: coarse)').matches;
    $('perkKeys').textContent = touch ? 'Tap a card' : 'Press 1 · 2 · 3, or click a card';
    $('perkSub').textContent = `Perk ${game.stats.perks + 1} · lasts for the rest of this run`;
  }

  function renderMissions(el, live = null, justDone = [], swappable = false) {
    const s = M.save;
    const canSwap = swappable && s.swaps > 0;
    let html = `<div class="mhead"><span>Missions · ${esc(M.rankName(s.rank))}</span><span>${canSwap ? '↻ 1 free swap · ' : ''}${s.missionsDone % 3}/3 to rank up</span></div>`;
    for (const d of justDone) html += `<div class="mission done"><div class="ck">✓</div><div>${esc(d.text)}</div><div class="rw">+${d.reward}</div></div>`;
    for (const [i, m] of s.missions.entries()) {
      const prog = live ? M.missionLive(m, live) : m.progress;
      const pct = Math.min(100, (prog / m.n) * 100), done = prog >= m.n;
      html += `<div class="mission${done ? ' done' : ''}"><div class="ck">${done ? '✓' : ''}</div><div>${esc(M.missionText(m))}</div>
        <div class="rw">+${m.reward}${canSwap ? ` <button class="swap" data-swap="${i}" title="Swap this mission (1 free per run)">↻</button>` : ''}</div><div class="bar mbar"><i style="width:${pct}%"></i></div></div>`;
    }
    el.innerHTML = html;
  }

  // ---------- shop ----------
  function renderShop() {
    document.querySelectorAll('#shop .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === shopTab));
    const s = M.save, list = $('shopList');
    let html = '';
    if (shopTab === 'upgrades') {
      for (const u of M.UPGRADES) {
        const l = M.upg(u.id), max = l >= u.max, cost = M.upgradeCost(u, l), can = !max && s.coins >= cost;
        html += `<div class="card"><div class="top"><div class="ico">${u.icon}</div><div><h4>${esc(u.name)}</h4><p>${esc(u.desc(l))}${max ? '' : ` → <b style="color:#fff">${esc(u.desc(l + 1))}</b>`}</p></div></div>
          <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div>
          <button class="btn ${can ? 'can' : ''}" data-buy="${u.id}" ${max || !can ? 'disabled' : ''}>${max ? 'MAXED' : `<span class="coin-ico">$</span> ${fmtInt(cost)}`}</button></div>`;
      }
    } else {
      for (const k of M.SKINS) {
        const owned = !!s.skins[k.id], sel = s.skin === k.id, can = s.coins >= k.cost;
        html += `<div class="card ${sel ? 'owned-sel' : ''}"><div class="top"><canvas width="112" height="112" data-skin="${k.id}"></canvas><div><h4>${esc(k.name)}</h4><p>${esc(k.perk)}</p></div></div>
          <button class="btn ${!owned && can ? 'can' : ''}" data-skinbtn="${k.id}" ${sel || (!owned && !can) ? 'disabled' : ''}>${sel ? 'SELECTED' : owned ? 'SELECT' : `<span class="coin-ico">$</span> ${fmtInt(k.cost)}`}</button></div>`;
      }
    }
    list.innerHTML = html;
    list.querySelectorAll('canvas[data-skin]').forEach((c) => {
      const ctx = c.getContext('2d'); ctx.scale(2, 2);
      BR.Game.drawSkinPreview(ctx, M.SKINS.find((k) => k.id === c.dataset.skin), 56);
    });
    updateBadges();
  }

  // ---------- trophies ----------
  function renderTrophies() {
    const s = M.save, got = M.ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
    $('trophyCount').textContent = `${got} / ${M.ACHIEVEMENTS.length}`;
    $('trophyList').innerHTML = M.ACHIEVEMENTS.map((a) => {
      const on = !!s.achievements[a.id];
      return `<div class="card ${on ? 'unlocked' : 'locked'}"><div class="top"><div class="ico">${on ? '🏆' : '🔒'}</div><div><h4>${esc(a.name)}</h4><p>${esc(a.desc)}</p><p style="color:#ffd23f">+${a.reward} coins</p></div></div></div>`;
    }).join('');
  }

  // ---------- records ----------
  function renderRecords() {
    const s = M.save;
    const rows = s.leaderboard.map((e, i) => `<tr><td>${i + 1}</td><td class="num"><b>${fmtMoney(e.score)}</b></td><td class="num">${fmtInt(e.dist)} m</td><td>${esc((M.SKINS.find((k) => k.id === e.skin) || M.SKINS[0]).name)}${e.daily ? ' 📅' : ''}</td><td>${esc(e.date)}</td></tr>`).join('');
    $('lbTable').innerHTML = `<tr><th>#</th><th class="num">Score</th><th class="num">Dist</th><th>Char</th><th>Date</th></tr>` + (rows || '<tr><td colspan="5">No runs yet — go set a record!</td></tr>');
    const st = s.stats, d = M.dailyInfo();
    const items = [
      ['Rank', M.rankName(s.rank)], ['Runs', fmtInt(s.runs)], ['Best score', fmtMoney(s.bestScore)], ['Best distance', `${fmtInt(s.bestDist)} m`],
      ['Total distance', `${fmtInt(st.dist)} m`], ['Coins earned', fmtInt(st.coins)], ['Perfect landings', fmtInt(st.perfects)], ['Bears stomped', fmtInt(st.stomps)],
      ['Time on the chart', fmtTime(st.time)], ['Dailies beaten', fmtInt(st.dailyWins)], [`Daily ${d.key}`, d.best ? fmtMoney(d.best) : '—'],
    ];
    $('careerStats').innerHTML = items.map(([k, v]) => `<span>${esc(k)}</span><span>${esc(v)}</span>`).join('');
  }

  function renderSettings() {
    const st = M.save.settings;
    $('setMusic').checked = st.music; $('setSfx').checked = st.sfx; $('setShake').checked = st.shake;
    $('setGhost').checked = st.ghost !== false; $('setHints').checked = st.hints !== false;
  }

  // ---------- run summary ----------
  function renderOver(stats, res, daily, shot) {
    $('oCause').textContent = stats.cause || 'Run over';
    $('oTip').textContent = stats.tip ? `💡 ${stats.tip}` : '';
    const img = $('oShot');
    if (shot) { img.src = shot; img.classList.remove('hidden'); } else { img.removeAttribute('src'); img.classList.add('hidden'); }
    $('oBest').classList.toggle('hidden', !res.newBest);
    const grid = [
      ['Distance', `${fmtInt(stats.dist)} m`], ['Coins', `+${fmtInt(res.banked)}`], ['Time', fmtTime(stats.time)], ['Best chain', stats.maxCombo], ['Perfects', stats.perfects],
      ['Close calls', stats.nearMisses || 0], ['Stomps', stats.stomps], ['Breakers', stats.breakers || 0], ['Perks', stats.perks || 0],
      ['Regimes', (stats.regimeIds || []).map((id) => BR.World.REGIMES[id].icon).join('') || '—'],
    ];
    $('oStats').innerHTML = grid.map(([k, v]) => `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('');
    const rw = [];
    if (daily) { const d = M.dailyInfo(); rw.push(res.dailyWin ? '📅 Daily beaten! +250' : `📅 Daily target ${fmtMoney(d.target)} · best ${fmtMoney(d.best)}`); }
    if (res.lbRank && res.lbRank <= 10) rw.push(`📈 #${res.lbRank} on your Top 10`);
    if (res.rankUp) rw.push(`⭐ Promoted to ${M.rankName(M.save.rank)}! (+10% score)`);
    for (const a of res.achievements) rw.push(`🏆 ${a.name} +${a.reward}`);
    if (res.ghostSaved && M.save.settings.ghost !== false) rw.push('👻 New ghost saved: race it next run');
    const nw = (res.unlocks || []).map((t) => `NEW! ${t}`);
    $('oRewards').innerHTML = rw.concat(nw).map((t, i) => `<span class="rw${i >= rw.length ? ' new' : ''}" style="animation-delay:${0.3 + i * 0.12}s">${esc(t)}</span>`).join('');
    const ids = stats.perkIds || [];
    const cnt = {}; for (const id of ids) cnt[id] = (cnt[id] || 0) + 1;
    $('oPerks').innerHTML = ids.length ? 'Perks: ' + Object.keys(cnt).map((id) => { const q = M.PERKS.find((x) => x.id === id); return q ? `<span>${q.icon} ${esc(q.name)}${cnt[id] > 1 ? ` ×${cnt[id]}` : ''}</span>` : ''; }).join('') : '';
    renderMissions($('oMissions'), null, res.missionsDone);
    renderGoals($('oGoal'));
    updateBadges();
    // count-up
    const el = $('oScore'), target = stats.score, t0 = performance.now(), dur = 700;
    let lastTick = 0;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmtMoney(target * e);
      if (now - lastTick > 60 && k < 1) { BR.audio.sfx.tick(); lastTick = now; }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function toast(icon, title, sub) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="t-ico">${icon}</div><div><b>${esc(title)}</b><span>${esc(sub)}</span></div>`;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 3300);
  }

  function setShopTab(t) { shopTab = t; renderShop(); }

  return { show, hideAll, renderMenu, renderShop, renderMissions, renderOver, renderPerk, toast, setShopTab, updateBadges, $ };
})();
