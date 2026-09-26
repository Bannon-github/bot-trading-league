/* Blitz Rush — procedural price-chart terrain + entity placement.
   World uses canvas-style coordinates: y grows DOWN, so a rally (price up) means y decreasing. */
'use strict';

BR.World = (() => {
  const { rng, clamp } = BR.util;
  const STEP = 10;                 // horizontal spacing of terrain samples (world units)
  const difficultyAt = (x) => 1 - Math.exp(-Math.max(0, x - 800) / 40000);

  class World {
    constructor(seed, opts = {}) {
      this.r = rng(seed);
      this.luck = opts.luck || 1;
      this.menu = !!opts.menu;          // menu background: terrain only, no entities
      this.baseX = -400;                // x of ys[0]
      this.ys = []; this.solid = [];
      this.coins = []; this.hazards = []; this.powerups = [];
      this.y = 0;                       // generator cursor height
      this.nextPowerX = 1500 / this.luck;
      this.lastType = '';
      this.flat(1100, false);           // safe start runway
      this.bump(420, 90);               // tiny first ramp so the first jump feels great
    }

    // ---------- sampling ----------
    get endX() { return this.baseX + (this.ys.length - 1) * STEP; }
    idx(x) { return (x - this.baseX) / STEP; }
    groundY(x) {
      const f = this.idx(x), i = Math.floor(f);
      if (i < 0) return this.ys[0];
      if (i >= this.ys.length - 1) return this.ys[this.ys.length - 1];
      const t = f - i; return this.ys[i] + (this.ys[i + 1] - this.ys[i]) * t;
    }
    solidAt(x) {
      const i = Math.floor(this.idx(x));
      if (i < 0 || i >= this.ys.length - 1) return true;
      return this.solid[i] && this.solid[i + 1];
    }
    slopeAt(x) { return (this.groundY(x + 6) - this.groundY(x - 6)) / 12; }

    // ---------- generation ----------
    push(y, solid = true) { this.ys.push(y); this.solid.push(solid); this.y = y; }
    curX() { return this.baseX + this.ys.length * STEP; }
    // cosine ease between current y and target over length
    ease(len, dy, solid = true) {
      const y0 = this.y, n = Math.max(1, Math.round(len / STEP));
      for (let k = 1; k <= n; k++) this.push(y0 + dy * (1 - Math.cos(Math.PI * k / n)) / 2, solid);
    }
    flat(len, wiggle = true) {
      const y0 = this.y, n = Math.round(len / STEP), a = wiggle ? this.r.range(2, 6) : 0, ph = this.r.range(0, 6);
      for (let k = 1; k <= n; k++) this.push(y0 + Math.sin(ph + k * 0.18) * a - Math.sin(ph) * a * (1 - k / n));
    }
    bump(len, h) { // a hill: up then down back (h>0 = up)
      const y0 = this.y, n = Math.round(len / STEP);
      for (let k = 1; k <= n; k++) this.push(y0 - h * (1 - Math.cos(2 * Math.PI * k / n)) / 2);
    }

    ensure(xMax) {
      let guard = 0;
      while (this.endX < xMax && guard++ < 50) this.nextPattern();
    }

    nextPattern() {
      const r = this.r, x0 = this.curX(), d = difficultyAt(x0), vol = 1 + 1.4 * d;
      let type;
      if (this.menu) type = r.weighted([['hills', 3], ['rally', 2], ['dump', 1.5]]);
      else type = r.weighted([
        ['hills', 3], ['rally', 2], ['dump', 1.6],
        ['claws', x0 > 1800 ? 0.9 + d * 2 : 0],
        ['gap', x0 > 2600 ? 0.8 + d * 2.2 : 0],
        ['bears', x0 > 3500 ? 0.7 + d * 1.5 : 0],
        ['candles', x0 > 9000 ? 0.4 + d * 1.6 : 0],
      ]);
      if (type === this.lastType && (type === 'gap' || type === 'claws' || type === 'candles')) type = 'hills';
      // Keep the chart from drifting forever in one direction (gentle mean-reversion toward a slow bull trend)
      const trend = -x0 * 0.02;
      if (type === 'dump' && this.y > trend + 700) type = 'rally';
      if (type === 'rally' && this.y < trend - 900) type = 'dump';
      this.lastType = type;
      this[type](d, vol, x0);
      if (!this.menu) this.maybePowerup();
    }

    hills(d, vol) {
      const n = this.r.int(2, 4);
      for (let i = 0; i < n; i++) {
        const W = this.r.range(300, 520), A = this.r.range(40, 120) * vol;
        const xs = this.curX();
        this.bump(W, A);
        if (!this.menu && this.r.chance(0.55)) this.coinArcOverCrest(xs + W / 2, A);
        else if (!this.menu && this.r.chance(0.5)) this.coinLine(xs + W * 0.55, xs + W * 0.95);
      }
      this.ease(this.r.range(60, 160), this.r.range(-30, 30));
    }
    rally(d, vol) { // green: climb, then a crest that launches you
      const len = this.r.range(420, 800), h = this.r.range(90, 230) * vol, xs = this.curX();
      this.ease(len, -h);
      if (!this.menu) this.coinLine(xs + len * 0.3, xs + len * 0.9, 26);
      const W = this.r.range(260, 380);
      this.bump(W, this.r.range(30, 70) * vol);
    }
    dump(d, vol) { // red: steep crash — dive down it for speed
      const xs = this.curX(), len = this.r.range(220, 420), h = this.r.range(120, 300) * vol;
      this.ease(len, h);
      if (!this.menu && this.r.chance(0.6)) this.coinLine(xs + len * 0.2, xs + len * 0.85, 30);
      this.flat(this.r.range(60, 140));
    }
    claws(d, vol) {
      this.flat(120);
      const groups = this.r.int(1, 2 + Math.round(d * 2));
      for (let g = 0; g < groups; g++) {
        this.flat(this.r.range(120, 200));
        const xc = this.curX(), count = this.r.chance(0.3 + d * 0.4) ? 2 : 1;
        for (let k = 0; k < count; k++) this.hazards.push({ type: 'claw', x: xc + k * 26, y: 0 });
        this.flat(40 + count * 26);
        this.coinArc(xc - 60, xc + count * 26 + 60, this.y - 70, 5);
        this.flat(this.r.range(220, 360) * (1 + d * 0.6));   // room to land between groups, scaled for speed
      }
      this.ease(160, this.r.range(-60, 40));
    }
    gap(d, vol) {
      this.ease(this.r.range(150, 220), -this.r.range(35, 70));       // lip / launch ramp
      const edgeY = this.y, x1 = this.curX();
      const W = 110 + 170 * d + this.r.range(0, 70);
      const drop = this.r.range(0, 70 + 60 * d);
      const n = Math.round(W / STEP);
      for (let k = 1; k <= n; k++) this.push(edgeY + drop * k / n, false);
      this.coinArc(x1 - 20, x1 + W + 40, edgeY - 110, 7);
      this.flat(this.r.range(140, 220));
    }
    bears(d, vol) {
      this.flat(80);
      const n = this.r.int(1, 1 + Math.round(d * 2));
      for (let i = 0; i < n; i++) {
        const W = this.r.range(360, 520), xs = this.curX();
        this.bump(W, this.r.range(30, 60) * vol);
        this.flat(this.r.range(160, 240));
        const bx = this.curX() - 100;
        this.hazards.push({ type: 'bear', x: bx, x0: bx, y: 0, dir: -1, alive: true, t: this.r.range(0, 6) });
        this.coinArc(bx - 90, bx + 90, 0, 5, true);
        this.flat(this.r.range(120, 220));
      }
    }
    candles(d, vol) { // "flash crash": red candles drop from the sky when you approach
      this.flat(100);
      const n = this.r.int(1, 2 + Math.round(d));
      for (let i = 0; i < n; i++) {
        const len = this.r.range(260, 380);
        this.ease(len, this.r.range(-60, 40));
        this.hazards.push({ type: 'candle', x: this.curX() - len * 0.5, y: -9999, gy: 0, state: 'wait', vy: 0, w: 26, h: 110 });
      }
      this.flat(160);
    }

    maybePowerup() {
      const x = this.curX() - 60;
      if (x < this.nextPowerX) return;
      this.nextPowerX = x + this.r.range(1300, 2500) / this.luck;
      const type = this.r.weighted([['rocket', 1], ['shield', 1.2], ['magnet', 1.2], ['lever', 1]]);
      this.powerups.push({ type, x, y: this.groundY(x) - 100, taken: false, t: this.r.range(0, 6) });
    }

    // ---------- coin layouts ----------
    coinLine(xa, xb, off = 28) {
      for (let x = xa; x <= xb; x += 34) this.coins.push({ x, y: null, off, taken: false });
    }
    coinArcOverCrest(xc, A) {
      const top = this.groundY(xc) - clamp(60 + A * 0.5, 70, 150);
      this.coinArc(xc - 110, xc + 110, top, 7);
    }
    // parabola from (xa, ground-ish) peaking at `top`; relative=true puts it `top` relative to ground later
    coinArc(xa, xb, top, n, overGround = false) {
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1), x = xa + (xb - xa) * t;
        const lift = 4 * t * (1 - t);                    // 0..1..0
        if (overGround || top === 0) this.coins.push({ x, y: null, off: 30 + 90 * lift, taken: false });
        else {
          const base = Math.min(this.groundYSafe(xa), this.groundYSafe(xb)) - 30;
          this.coins.push({ x, y: base + (top - base) * lift, taken: false });
        }
      }
    }
    groundYSafe(x) { return x <= this.endX ? this.groundY(x) : this.y; }

    // Resolve lazily-positioned entities once terrain under them exists, and trim old data.
    settle(minX) {
      for (const c of this.coins) if (c.y === null && c.x <= this.endX) c.y = this.groundY(c.x) - c.off;
      for (const h of this.hazards) {
        if (h.type === 'claw' && !h.y && h.x <= this.endX) h.y = this.groundY(h.x);
        if (h.type === 'candle' && !h.gy && h.x <= this.endX) h.gy = this.groundY(h.x);
      }
      // trim terrain behind the camera in chunks
      const cut = Math.floor(this.idx(minX)) - 5;
      if (cut > 400) {
        this.ys.splice(0, cut); this.solid.splice(0, cut); this.baseX += cut * STEP;
        this.coins = this.coins.filter((c) => c.x > minX && !c.gone);
        this.hazards = this.hazards.filter((h) => h.x > minX - 200);
        this.powerups = this.powerups.filter((p) => p.x > minX && !p.taken);
      }
    }
  }
  World.STEP = STEP;
  World.difficultyAt = difficultyAt;
  return World;
})();
