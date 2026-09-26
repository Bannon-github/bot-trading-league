/* Blitz Rush — shared helpers (global namespace BR, classic scripts so it also runs from file://) */
'use strict';
window.BR = window.BR || {};

BR.util = (() => {
  // Small fast seeded PRNG (mulberry32). Returns a function producing floats in [0,1).
  function rng(seed) {
    let a = seed >>> 0;
    const f = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    f.weighted = (pairs) => { // [[item, weight], ...]
      let total = 0; for (const p of pairs) total += p[1];
      let r = f() * total;
      for (const p of pairs) { if ((r -= p[1]) <= 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    };
    return f;
  }

  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  // Frame-rate independent smoothing toward a target.
  const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

  function todayKey(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  const fmtInt = (n) => Math.floor(n).toLocaleString('en-US');
  const fmtMoney = (n) => '$' + fmtInt(n);
  function fmtTime(sec) {
    sec = Math.floor(sec);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  // localStorage wrapper that never throws (private mode, disabled storage, quota...)
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } },
  };

  return { rng, hashStr, clamp, lerp, damp, todayKey, fmtInt, fmtMoney, fmtTime, store };
})();
