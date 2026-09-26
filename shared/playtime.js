/* Bot Trading League - shared active-playtime tracker for bot-built games.
 * Include in every game (from ventures/<slug>/index.html):
 *   <script src="../../shared/playtime.js" data-game="YOUR-SLUG" defer></script>
 * Counts ACTIVE play only: tab visible AND an input event within the last 30 s.
 * Per-game total is stored in localStorage ("btl-playtime:<game>", seconds). A small
 * "Played: mm:ss" badge is shown. Matt reports his total to the referee, who records it with
 * `league game playtime SLUG --minutes N` - the referee's number is the only source of truth.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var game = (script && script.dataset && script.dataset.game) ||
    (location.pathname.replace(/\/index\.html?$/, "").replace(/\/+$/, "").split("/").pop()) || "game";
  var KEY = "btl-playtime:" + game;
  var IDLE_MS = 30000;
  var total = 0, lastInput = 0, lastTick = Date.now(), dirty = false, badge = null;

  function load() { try { total = parseFloat(localStorage.getItem(KEY)) || 0; } catch (e) { total = 0; } }
  function save() { if (!dirty) return; try { localStorage.setItem(KEY, String(Math.round(total))); dirty = false; } catch (e) {} }
  function fmt(s) {
    s = Math.floor(s);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var mm = (h ? h * 60 + m : m);
    return (mm < 10 ? "0" : "") + mm + ":" + (sec < 10 ? "0" : "") + sec;
  }
  function active(now) { return document.visibilityState === "visible" && (now - lastInput) < IDLE_MS; }
  function draw(now) {
    if (!badge) return;
    badge.textContent = "Played: " + fmt(total);
    badge.style.opacity = active(now) ? "0.85" : "0.45";
  }
  function tick() {
    var now = Date.now();
    var dt = Math.min(now - lastTick, 2000);           // ignore long gaps (sleep, throttled tabs)
    lastTick = now;
    if (dt > 0 && active(now)) { total += dt / 1000; dirty = true; }
    draw(now);
  }
  function onInput() { lastInput = Date.now(); }
  function mountBadge() {
    badge = document.createElement("div");
    badge.id = "btl-playtime-badge";
    badge.setAttribute("aria-label", "Active play time");
    badge.style.cssText = "position:fixed;right:8px;bottom:8px;z-index:2147483647;pointer-events:none;" +
      "font:600 11px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e6ecf5;background:rgba(15,21,32,.75);" +
      "border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:3px 8px;letter-spacing:.3px;opacity:.45";
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
    ping: onInput   // games with no DOM input (e.g. gamepad polling) can call BTLPlaytime.ping() each frame
  };
})();
