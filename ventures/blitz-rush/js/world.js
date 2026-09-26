/* Blitz Rush — procedural price-chart terrain + entity placement.
   World uses canvas-style coordinates: y grows DOWN, so a rally (price up) means y decreasing.
   v2: "market regimes" (biomes) rotate within a run, each with its own terrain shapes, hazard mix and palette,
   plus boss-like "Circuit Breaker" gauntlets and "Short Squeeze" launch set pieces. */
'use strict';

BR.World = (() => {
  const { rng, clamp } = BR.util;
  const STEP = 10;                 // horizontal spacing of terrain samples (world units)
  const difficultyAt = (x) => 1 - Math.exp(-Math.max(0, x - 800) / 40000);

  // Palettes: bg gradient top/bottom, terrain fill tint, grid tint, background candle alpha.
  // The chart line itself always stays green (rising) / red (falling) so the core read never changes.
  const REGIMES = {
    bull: {
      id: 'bull', name: 'BULL RUN', icon: '🐂', tip: 'Green rallies & bears. Stomp bears from above!', vol: 0.9, luck: 1, coinDensity: 1,
      weights: { hills: 3, rally: 3, dump: 1.2, chop: 0.4, claws: 0.8, bears: 1.3, gap: 0.6, candles: 0, stairs: 0, moon: 0.2 },
      pal: { top: '#06202b', bot: '#0b2d2a', fill: '#1d6b57', grid: '#7dffc8' },
    },
    chop: {
      id: 'chop', name: 'SIDEWAYS CHOP', icon: '〰️', tip: 'Quick little bumps. Dive each downslope to chain Perfects!', vol: 0.75, luck: 1, coinDensity: 1,
      weights: { hills: 1, rally: 0.4, dump: 0.4, chop: 4, claws: 1.5, bears: 0.8, gap: 0.5, candles: 0.3, stairs: 0, moon: 0 },
      pal: { top: '#140c30', bot: '#1f1744', fill: '#4a3a9a', grid: '#b99bff' },
    },
    crash: {
      id: 'crash', name: 'FLASH CRASH', icon: '📉', tip: 'Steep dumps & gaps. Dive for speed, watch the sky for red !', vol: 1.15, luck: 1, coinDensity: 1,
      weights: { hills: 0.8, rally: 0.7, dump: 3, chop: 0, claws: 0.6, bears: 0.4, gap: 1.8, candles: 1.8, stairs: 2.2, moon: 0 },
      pal: { top: '#260812', bot: '#3a0f1c', fill: '#8a2440', grid: '#ff8aa0' },
    },
    mania: {
      id: 'mania', name: 'CRYPTO MANIA', icon: '🚀', tip: 'Huge pumps, wide gaps, coins everywhere!', vol: 1.4, luck: 1.7, coinDensity: 1.4,
      weights: { hills: 1.5, rally: 2, dump: 1.4, chop: 0.3, claws: 0.5, bears: 0.6, gap: 1.6, candles: 0.5, stairs: 0.4, moon: 2.2 },
      pal: { top: '#1a0736', bot: '#062a3c', fill: '#1f7a9a', grid: '#ff7af2' },
    },
  };
  const REGIME_ORDER = ['bull', 'chop', 'crash', 'mania'];

  class World {
    constructor(seed, opts = {}) {
      this.r = rng(seed);
      this.luck = opts.luck || 1;
      this.menu = !!opts.menu;          // menu background: terrain only, no entities
      this.gentle = !!opts.gentle;      // first runs: hazards arrive later and softer
      this.unlocked = opts.regimes || ['bull', 'chop'];
      this.baseX = -400;                // x of ys[0]
      this.ys = []; this.solid = [];
      this.coins = []; this.hazards = []; this.powerups = []; this.markers = [];
      this.y = 0;                       // generator cursor height
      this.nextPowerX = 1500 / this.luck;
      this.lastType = '';
      this.gaps = 0; this.clawsN = 0;
      // regime schedule: always open on a Bull Run so the first ~30 s are friendly
      this.regimes = [{ x: -1e9, id: this.menu ? REGIME_ORDER[(seed >>> 3) % 4] : 'bull' }];
      this.regime = REGIMES[this.regimes[0].id];
      this.nextRegimeX = this.gentle ? 7000 : 6000;
      this.nextBreakerX = this.gentle ? 20000 : 17000;
      this.breakerN = 0; this.inSet = false;
      this.flat(1100, false);           // safe start runway
      const r1 = this.curX();
      this.bump(420, 90);               // tiny first ramp so the first jump feels great
      if (!this.menu) { this.coinLine(r1 - 300, r1 - 60, 28); this.coinArcOverCrest(r1 + 210, 90); }
      this.flat(260, false);
      const r2 = this.curX();
      this.bump(360, 60);               // a second easy ramp: land on its back side = first Perfect
      if (!this.menu) this.coinLine(r2 + 200, r2 + 340, 28);
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
    regimeAt(x) {
      let r = this.regimes[0];
      for (const q of this.regimes) { if (q.x <= x) r = q; else break; }
      return REGIMES[r.id];
    }

    // ---------- generation ----------
    push(y, solid = true) { this.ys.push(y); this.solid.push(solid); this.y = y; }
    curX() { return this.baseX + this.ys.length * STEP; }
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

    // hazard type gates by distance (later in the first runs)
    gate(x) {
      const g = this.gentle ? 1200 : 0;
      return { claws: x > 1900 + g, gap: x > 2800 + g, bears: x > 3400 + g, candles: x > (this.regime.id === 'crash' ? 7000 : 9000) + g * 2 };
    }

    nextPattern() {
      const r = this.r, x0 = this.curX(), d = difficultyAt(x0), R = this.regime;
      if (!this.menu && x0 >= this.nextRegimeX) { this.switchRegime(); return; }
      if (!this.menu && x0 >= this.nextBreakerX) { this.breaker(d); return; }
      const vol = (1 + 1.4 * d) * R.vol;
      let type;
      if (this.menu) type = r.weighted([['hills', 3], ['rally', 2], ['dump', 1.5], ['chop', R.weights.chop], ['stairs', R.weights.stairs]]);
      else {
        const g = this.gate(x0), w = R.weights, k = 1 + d * 1.6;
        type = r.weighted([
          ['hills', w.hills], ['rally', w.rally], ['dump', w.dump], ['chop', w.chop], ['stairs', w.stairs],
          ['moon', x0 > 2500 ? w.moon : 0],
          ['claws', g.claws ? w.claws * k : 0],
          ['gap', g.gap ? w.gap * k : 0],
          ['bears', g.bears ? w.bears * k : 0],
          ['candles', g.candles ? w.candles * k : 0],
        ]);
      }
      if (type === this.lastType && (type === 'gap' || type === 'claws' || type === 'candles' || type === 'moon')) type = 'hills';
      // Keep the chart from drifting forever in one direction (gentle mean-reversion toward a slow bull trend)
      const trend = -x0 * 0.02;
      if ((type === 'dump' || type === 'stairs') && this.y > trend + 700) type = 'rally';
      if ((type === 'rally' || type === 'moon') && this.y < trend - 900) type = 'dump';
      this.lastType = type;
      this[type](d, vol, x0);
      if (!this.menu) this.maybePowerup();
    }

    switchRegime() {
      const cur = this.regime.id;
      const pool = this.unlocked.filter((id) => id !== cur && id !== this.prevRegime);
      const pick = pool.length ? this.r.pick(pool) : (this.unlocked.find((id) => id !== cur) || 'bull');
      this.prevRegime = cur;
      this.flat(260, false);
      const x = this.curX();
      this.flat(340, false);                                    // calm runway across the border
      this.regimes.push({ x, id: pick });
      this.markers.push({ type: 'regime', x, id: pick });
      this.regime = REGIMES[pick];
      this.nextRegimeX = x + this.r.range(8500, 11500);
      if (this.nextBreakerX - x < 2500) this.nextBreakerX = x + 3000;
    }

    hills(d, vol) {
      const n = this.r.int(2, 4);
      for (let i = 0; i < n; i++) {
        const W = this.r.range(300, 520), A = this.r.range(40, 120) * vol;
        const xs = this.curX();
        this.bump(W, A);
        if (!this.menu && this.r.chance(0.55 * this.regime.coinDensity)) this.coinArcOverCrest(xs + W / 2, A);
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
      if (!this.menu && this.r.chance(0.6 * this.regime.coinDensity)) this.coinLine(xs + len * 0.2, xs + len * 0.85, 30);
      this.flat(this.r.range(60, 140));
    }
    chop(d, vol) { // sideways chop: a rhythmic run of short bumps — each back side is a Perfect opportunity
      const n = this.r.int(5, 8), W = this.r.range(190, 250);
      for (let i = 0; i < n; i++) {
        const xs = this.curX(), A = this.r.range(26, 46) * Math.min(1.3, vol);
        this.bump(W, A);
        if (!this.menu && i % 2 === 0) this.coins.push({ x: xs + W * 0.5, y: null, off: 30 + A * 0.9, taken: false });
      }
      this.flat(this.r.range(80, 140));
    }
    stairs(d, vol) { // staircase crash: drop, ledge, drop, ledge... dive every drop
      const n = this.r.int(3, 5);
      for (let i = 0; i < n; i++) {
        const xs = this.curX(), len = this.r.range(150, 210);
        this.ease(len, this.r.range(60, 110) * Math.min(1.4, vol));
        if (!this.menu && this.r.chance(0.5)) this.coinLine(xs + len * 0.3, xs + len * 0.9, 28);
        this.flat(this.r.range(80, 130));
      }
      this.flat(80);
    }
    moon(d, vol) { // pump: long climb, a launch lip, then a sky full of coins over the drop
      const len = this.r.range(600, 850), h = this.r.range(180, 300) * Math.min(1.5, vol), xs = this.curX();
      this.ease(len, -h);
      if (!this.menu) this.coinLine(xs + len * 0.4, xs + len * 0.95, 26);
      const lip = this.curX();
      this.bump(160, 25);
      const drop = this.r.range(260, 380);
      this.ease(drop, h * 0.85);
      if (!this.menu) {
        const top = this.groundY(lip) - 190, n = 11;
        for (let k = 0; k < n; k++) {
          const t = k / (n - 1), x = lip + 40 + t * (drop + 200), lift = 4 * t * (1 - t);
          const base = this.groundYSafe(lip) - 40;
          this.coins.push({ x, y: base + (top - base) * lift, taken: false, v: k === (n >> 1) ? 5 : 1 });
        }
      }
      this.flat(this.r.range(140, 220));
    }
    claws(d, vol) {
      this.flat(120);
      const first = this.clawsN === 0;
      const groups = first ? 1 : this.r.int(1, 2 + Math.round(d * 2));
      for (let g = 0; g < groups; g++) {
        this.flat(this.r.range(120, 200));
        const xc = this.curX(), count = !first && this.r.chance(0.3 + d * 0.4) ? 2 : 1;
        for (let k = 0; k < count; k++) this.hazards.push({ type: 'claw', x: xc + k * 26, y: 0 });
        this.clawsN++;
        this.flat(40 + count * 26);
        this.coinArc(xc - 60, xc + count * 26 + 60, this.y - 70, 5);
        this.flat(this.r.range(220, 360) * (1 + d * 0.6));   // room to land between groups, scaled for speed
      }
      this.ease(160, this.r.range(-60, 40));
    }
    gap(d, vol, x0, forceW) {
      this.ease(this.r.range(150, 220), -this.r.range(35, 70));       // lip / launch ramp
      const edgeY = this.y, x1 = this.curX();
      let W = forceW || (110 + 170 * d + this.r.range(0, 70) * (this.regime.id === 'mania' ? 1.6 : 1));
      if (this.gaps === 0) W = Math.min(W, 95);                        // first gap of every run is a gimme
      else if (this.gentle && this.gaps < 3) W = Math.min(W, 130);
      this.gaps++;
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
        const W = this.r.range(360, 520);
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
        this.hazards.push({ type: 'candle', x: this.curX() - len * 0.5, y: -9999, gy: 0, state: 'wait', vy: 0, w: 26, h: 80 });
      }
      this.flat(160);
    }

    // ---------- set piece: CIRCUIT BREAKER gauntlet ----------
    // A telegraphed, fixed-shape obstacle course. Every stage uses the regular (fair) patterns at a capped
    // difficulty, with calm flats between them. Clearing it pays out a big bonus.
    breaker(d) {
      const dd = clamp(d + 0.12, 0.15, 0.6), N = this.breakerN++;
      this.inSet = true;
      this.flat(300, false);
      const xs = this.curX();
      this.flat(420, false);
      const stages = [['gap'], ['claws'], ['bears'], ['candles'], ['gap'], ['claws']];
      if (N > 0) stages.push(['candles'], ['gap']);
      const sx = [];
      for (const [s] of stages) {
        sx.push(this.curX());
        if (s === 'gap') this.gap(dd, 1, 0, 120 + 60 * dd + N * 15);
        else this[s](dd, 1);
        this.flat(240, false);
      }
      const xe = this.curX();
      this.flat(200, false);
      this.markers.push({ type: 'breakerStart', x: xs, end: xe, n: N + 1, stages: sx });
      this.markers.push({ type: 'breakerEnd', x: xe, n: N + 1 });
      // payout coin fountain
      this.coinArc(xe + 20, xe + 380, this.y - 170, 9);
      this.flat(300, false);
      this.inSet = false;
      this.nextBreakerX = this.curX() + this.r.range(22000, 28000);
      if (this.nextRegimeX - this.curX() < 1500) this.nextRegimeX = this.curX() + 1500;
      this.nextPowerX = Math.max(this.nextPowerX, this.curX() + 200);
    }

    maybePowerup() {
      if (this.inSet) return;
      const x = this.curX() - 60;
      if (x < this.nextPowerX) return;
      this.nextPowerX = x + this.r.range(1300, 2500) / (this.luck * this.regime.luck);
      const type = this.r.weighted([['rocket', 1], ['shield', 1.2], ['magnet', 1.2], ['lever', 1]]);
      this.powerups.push({ type, x, y: this.groundY(x) - 100, taken: false, t: this.r.range(0, 6) });
    }

    // ---------- coin layouts ----------
    coinLine(xa, xb, off = 28) {
      const sp = 34 / Math.min(1.5, this.regime.coinDensity);
      for (let x = xa; x <= xb; x += sp) this.coins.push({ x, y: null, off, taken: false });
    }
    coinArcOverCrest(xc, A) {
      const top = this.groundY(xc) - clamp(60 + A * 0.5, 70, 150);
      this.coinArc(xc - 110, xc + 110, top, 7);
    }
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
      const cut = Math.floor(this.idx(minX)) - 5;
      if (cut > 400) {
        this.ys.splice(0, cut); this.solid.splice(0, cut); this.baseX += cut * STEP;
        this.coins = this.coins.filter((c) => c.x > minX && !c.gone);
        this.hazards = this.hazards.filter((h) => h.x > minX - 200);
        this.powerups = this.powerups.filter((p) => p.x > minX && !p.taken);
        this.markers = this.markers.filter((m) => (m.end || m.x) > minX - 400);
        if (this.regimes.length > 3) this.regimes.splice(0, this.regimes.length - 3);
      }
    }
  }
  World.STEP = STEP;
  World.difficultyAt = difficultyAt;
  World.REGIMES = REGIMES;
  World.REGIME_ORDER = REGIME_ORDER;
  return World;
})();
