/* Bot Trading League - shared active-playtime tracker for bot-built games (v2).
 * Include in every game (from ventures/<slug>/index.html):
 *   <script src="../../shared/playtime.js" data-game="YOUR-SLUG" defer></script>
 * Counts ACTIVE play only: tab visible AND an input event within the last 30 s.
 * Game rule (Matt, 2026-09-26): a game QUALIFIES once Matt plays ONE session of 10+ minutes;
 * after that it is worth $1,000 x his TOTAL confirmed minutes across all sessions.
 * Sessions: a session starts when the page is loaded/reloaded/reopened. Short idle pauses and
 * hidden-tab pauses do NOT end it (the clock just stops while paused); only leaving the page does.
 * Badge (bottom-right): "Session mm:ss · Total mm:ss" + "✓" marker once the session hits 10:00.
 * localStorage (seconds):
 *   "btl-playtime:<game>"       all-time active total
 *   "btl-playtime-best:<game>"  longest single session (best)
 * Matt reports total + longest session to the referee, who records them with
 * `league game playtime SLUG --minutes N --longest-session M` - the referee's numbers are the only source of truth.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var game = (script && script.dataset && script.dataset.game) ||
    (location.pathname.replace(/\/index\.html?$/, "").replace(/\/+$/, "").split("/").pop()) || "game";
  var KEY = "btl-playtime:" + game, BEST_KEY = "btl-playtime-best:" + game;
  var IDLE_MS = 30000, QUALIFY_S = 600;
  var total = 0, session = 0, best = 0, lastInput = 0, lastTick = Date.now(), dirty = false, badge = null;

  function num(k) { try { return parseFloat(localStorage.getItem(k)) || 0; } catch (e) { return 0; } }
  function load() { total = num(KEY); best = num(BEST_KEY); }
  function save() {
    if (!dirty) return;
    try {
      localStorage.setItem(KEY, String(Math.round(total)));
      if (session > num(BEST_KEY)) localStorage.setItem(BEST_KEY, String(Math.floor(session)));
      dirty = false;
    } catch (e) {}
  }
  function fmt(s) {
    s = Math.floor(s);
    var mm = Math.floor(s / 60), sec = s % 60;
    return (mm < 10 ? "0" : "") + mm + ":" + (sec < 10 ? "0" : "") + sec;
  }
  function active(now) { return document.visibilityState === "visible" && (now - lastInput) < IDLE_MS; }
  function draw(now) {
    if (!badge) return;
    var done = session >= QUALIFY_S, on = active(now);
    badge.textContent = "Session " + fmt(session) + (done ? " \u2713" : "") + " \u00b7 Total " + fmt(total) +
      (on ? "" : " \u00b7 paused");
    badge.title = "Active play. Best session: " + fmt(Math.max(best, session)) +
      ". A game qualifies after one 10:00 session.";
    badge.style.borderColor = done ? "rgba(80,220,120,.9)" : "rgba(255,255,255,.15)";
    badge.style.color = done ? "#8ff0a8" : "#e6ecf5";
    badge.style.opacity = on ? "0.9" : "0.55";
  }
  function tick() {
    var now = Date.now();
    var dt = Math.min(now - lastTick, 2000);           // ignore long gaps (sleep, throttled tabs)
    lastTick = now;
    if (dt > 0 && active(now)) {
      total += dt / 1000; session += dt / 1000; dirty = true;
      if (session > best) best = session;
    }
    draw(now);
  }
  function onInput() { lastInput = Date.now(); }
  function mountBadge() {
    badge = document.createElement("div");
    badge.id = "btl-playtime-badge";
    badge.setAttribute("aria-label", "Active play time: current session and all-time total");
    badge.style.cssText = "position:fixed;right:8px;bottom:8px;z-index:2147483647;pointer-events:none;white-space:nowrap;" +
      "font:600 11px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e6ecf5;background:rgba(15,21,32,.8);" +
      "border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:3px 8px;letter-spacing:.3px;opacity:.55;" +
      "font-variant-numeric:tabular-nums";
    document.body.appendChild(badge);
    draw(Date.now());
  }

  load();
  ["keydown", "mousedown", "pointerdown", "touchstart", "wheel", "mousemove", "pointermove", "gamepadconnected"].forEach(function (ev) {
    window.addEventListener(ev, onInput, { passive: true, capture: true });
  });
  document.addEventListener("visibilitychange", function () { lastTick = Date.now(); save(); });
  window.addEventListener("pagehide", save);
  window.addEventListener("beforeunload", save);
  if (document.body) mountBadge(); else document.addEventListener("DOMContentLoaded", mountBadge);
  setInterval(tick, 1000);
  setInterval(save, 5000);
  window.BTLPlaytime = {
    game: game,
    seconds: function () { return Math.floor(total); },
    minutes: function () { return Math.floor(total / 60); },
    sessionSeconds: function () { return Math.floor(session); },
    bestSessionSeconds: function () { return Math.floor(best); },
    sessionQualified: function () { return session >= QUALIFY_S; },
    ping: onInput   // games with no DOM input (e.g. gamepad polling) can call BTLPlaytime.ping() each frame
  };
})();
