/* Blitz Rush — a single run: physics, scoring, entities, effects and rendering. */
'use strict';

BR.Game = (() => {
  const { clamp, lerp, damp, fmtMoney, fmtInt } = BR.util;
  const A = BR.audio.sfx;

  // ---- tuning ----
  const G = 1900, JUMP_V = 640, AIR_JUMP_V = 590, MAX_V = 1050, R = 16;
  const COMBO_TIME = 4, VIEW_H = 560;
  const minSpeedAt = (d) => 320 + 300 * d;
  const CAT = {
    rocket: { name: 'ROCKET', color: '#ff7a1a', icon: '🚀' },
    shield: { name: 'STOP-LOSS', color: '#4de1ff', icon: '🛡️' },
    magnet: { name: 'MAGNET', color: '#ff4fd8', icon: '🧲' },
    lever: { name: '2X LEVERAGE', color: '#b6ff3b', icon: '2×' },
  };
  const GREEN = '#22e39a', RED = '#ff4d6d';

  class Game {
    constructor({ seed, daily = false, loadout, tutorial = false, hooks = {} }) {
      this.lo = loadout; this.daily = daily; this.hooks = hooks; this.tutorial = tutorial;
      this.world = new BR.World(seed, { luck: loadout.luck });
      const p = this.p = {
        x: 0, y: 0, v: 300, vx: 300, vy: 0, grounded: true, air: 0, coyote: 0, jumpBuf: 0,
        airJumps: loadout.airJumps, angle: 0, spin: 0, sq: 1, trail: [], invuln: 0, dive: false,
      };
      p.y = this.world.groundY(0);
      this.alive = true; this.dying = 0; this.time = 0; this.dist = 0; this.startX = 0;
      this.score = 0; this.coins = 0; this.combo = 0; this.comboT = 0; this.meter = 0;
      this.blitzT = 0; this.rocketT = loadout.headStart; this.magnetT = 0; this.leverT = 0;
      this.shield = loadout.startShield;
      this.stats = { score: 0, dist: 0, coins: 0, perfects: 0, maxCombo: 0, stomps: 0, catalysts: 0, catTypes: 0, blitzes: 0, maxAir: 0, time: 0, jumps: 0, daily: daily ? 1 : 0 };
      this.catSeen = {};
      this.parts = []; this.floaters = []; this.shake = 0; this.flash = 0; this.slowmo = 1;
      this.cam = { x: -200, y: p.y - VIEW_H * 0.6, zoom: 1 };
      this.coinChain = 0; this.coinChainT = 0;
      this.achTimer = 0; this.deathCause = '';
      this.startPrice = this.price(p.y);
      if (this.rocketT > 0) this.float('IPO POP!', p.x + 60, p.y - 60, '#ffd23f', 28);
    }

    get d() { return BR.World.difficultyAt(this.p.x); }
    get mult() {
      return (1 + Math.min(this.combo, 40) * 0.1) * (this.leverT > 0 ? 2 : 1) * (this.blitzT > 0 ? 2 : 1) * this.lo.scoreMult;
    }
    price(y) { return 100 * Math.exp(-y / 1800); }

    // ================= UPDATE =================
    update(dt, input) {
      dt = Math.min(dt, 1 / 30);
      if (!this.alive) {                       // death slow-mo, then report
        this.dying += dt;
        this.updateFx(dt * 0.4);
        if (this.dying > 1.0 && !this.reported) { this.reported = true; this.hooks.onOver && this.hooks.onOver(this.finalStats()); }
        return;
      }
      this.time += dt;
      const p = this.p, w = this.world;
      const minV = minSpeedAt(this.d) * (this.blitzT > 0 ? 1.15 : 1);

      // timers
      this.comboT -= dt;
      if (this.combo > 0 && this.comboT <= 0) this.cashCombo();
      this.coinChainT -= dt; if (this.coinChainT <= 0) this.coinChain = 0;
      this.magnetT = Math.max(0, this.magnetT - dt); this.leverT = Math.max(0, this.leverT - dt);
      p.invuln = Math.max(0, p.invuln - dt); this.flash = Math.max(0, this.flash - dt * 3);
      if (this.blitzT > 0) { this.blitzT -= dt; this.meter = Math.max(0, 100 * this.blitzT / this.lo.blitzTime); if (this.blitzT <= 0) { this.meter = 0; p.invuln = Math.max(p.invuln, 0.8); } }

      // input
      p.dive = !!input.dive;
      if (input.jump) { p.jumpBuf = 0.13; input.jump = false; }
      p.jumpBuf -= dt;

      const prevX = p.x;
      if (this.rocketT > 0) this.updateRocket(dt, minV);
      else if (p.grounded) this.updateGround(dt, minV);
      else this.updateAir(dt, minV);

      // jumping (buffered + coyote time)
      if (p.jumpBuf > 0 && this.rocketT <= 0) {
        if (p.grounded || p.coyote > 0) this.jump(false);
        else if (p.airJumps > 0) this.jump(true);
      }

      // distance & score
      const dx = Math.max(0, p.x - prevX);
      this.dist = (p.x - this.startX) / 10;
      this.addScore(dx * 0.5);
      w.ensure(p.x + 2400);
      w.settle(this.cam.x - 300);

      this.updateEntities(dt);
      this.updateFx(dt);
      this.updateCamera(dt);

      // trail
      p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 18) p.trail.shift();

      // live stats + achievements (throttled)
      this.syncStats();
      this.achTimer -= dt;
      if (this.achTimer <= 0) { this.achTimer = 0.5; this.hooks.onTick && this.hooks.onTick(this.stats); }
      BR.audio.setIntensity(0.25 + clamp((p.v - 280) / 700, 0, 0.75), this.blitzT > 0);
    }

    updateGround(dt, minV) {
      const p = this.p, w = this.world;
      const s = w.slopeAt(p.x), th = Math.atan(s), sin = Math.sin(th), cos = Math.cos(th);
      const acc = G * sin * 0.85 * (p.dive ? 1.9 : 1);
      p.v += acc * dt; p.v -= (p.v * 0.03 + p.v * p.v * 0.00012) * dt;   // light drag, stronger at high speed
      p.v = clamp(p.v, minV, MAX_V);
      p.vx = p.v * cos; const vyLine = p.v * sin;
      const nx = p.x + p.vx * dt, ballistic = p.y + vyLine * dt + 0.5 * G * dt * dt;
      p.x = nx; p.coyote = 0.1;
      if (!w.solidAt(nx)) { p.grounded = false; p.vy = vyLine; p.y = ballistic; p.air = 0; return; }
      const gy = w.groundY(nx);
      if (gy > ballistic + 0.5 && !p.dive && vyLine < 60) { // crest: the ground falls away faster than gravity
        p.grounded = false; p.vy = vyLine; p.y = ballistic; p.air = 0;
      } else p.y = gy;
      p.angle = damp(p.angle, th, 20, dt);
      if (p.dive && sin > 0.2 && Math.random() < 0.5) this.spark(p.x - 10, p.y, '#ffffff', 1, 60);
    }

    updateAir(dt, minV) {
      const p = this.p, w = this.world;
      p.coyote -= dt; p.air += dt;
      const gMul = p.dive ? (p.vy < 0 ? 3.4 : 2.6) : 1;
      p.vy += G * gMul * dt;
      p.vx = Math.max(p.vx, minV * 0.85);
      const px = p.x, py = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.angle = damp(p.angle, Math.atan2(p.vy, p.vx) * 0.6, 8, dt);

      if (w.solidAt(p.x)) {
        const gy = w.groundY(p.x);
        if (p.y >= gy) {
          const wasSolid = w.solidAt(px);
          if (!wasSolid && py > w.groundY(p.x) + 22) {           // smacked into the far wall of a gap
            p.x = px - 2; p.vx = 60; this.shake = Math.max(this.shake, 6);
          } else this.land(gy);
        }
      } else {
        const gy = w.groundY(p.x);
        if (p.y > gy + 360) this.pitFall();
      }
    }

    updateRocket(dt, minV) {
      const p = this.p, w = this.world;
      this.rocketT -= dt;
      p.v = Math.max(p.v, minV) ; p.vx = Math.max(p.v, minV) * 1.7;
      p.x += p.vx * dt;
      let top = Infinity; for (let k = 0; k <= 4; k++) top = Math.min(top, w.groundY(p.x + k * 90));
      p.y = damp(p.y, top - 150, 5, dt); p.vy = 0; p.angle = damp(p.angle, -0.15, 8, dt);
      p.grounded = false; p.air = 0; p.airJumps = this.lo.airJumps;
      this.spark(p.x - 20, p.y + 4, Math.random() < 0.5 ? '#ffb347' : '#ff5a1f', 2, 200, -1);
      if (this.rocketT <= 0 && !w.solidAt(p.x + 60)) this.rocketT = 0.02;   // never drop the player into a gap
      if (this.rocketT <= 0) { p.invuln = 1.0; p.vy = -200; this.float('BOOST OVER', p.x, p.y - 40, '#ffb347', 16); }
    }

    jump(air) {
      const p = this.p, jm = this.lo.jumpMult;
      if (air) {
        p.airJumps--; p.vy = Math.min(p.vy * 0.3, 0) - AIR_JUMP_V * jm; A.airJump();
        this.ring(p.x, p.y + 10, '#ffffff', 26);
      } else {
        const th = Math.atan(this.world.slopeAt(p.x));
        const vyLine = p.grounded ? p.v * Math.sin(th) : Math.min(p.vy, 0);
        p.vy = Math.max(-1150, Math.min(vyLine, 0) * 0.7 - JUMP_V * jm);
        p.grounded = false; p.coyote = 0; p.air = 0; A.jump();
        for (let i = 0; i < 6; i++) this.spark(p.x, p.y + R, '#9fb3c8', 1, 120);
      }
      p.jumpBuf = 0; p.sq = 1.35; this.stats.jumps++;
    }

    land(gy) {
      const p = this.p, w = this.world;
      const s = w.slopeAt(p.x), tg = Math.atan(s);
      const tv = Math.atan2(p.vy, p.vx), diff = Math.abs(tv - tg);
      const proj = p.vx * Math.cos(tg) + p.vy * Math.sin(tg);
      const airT = p.air;
      p.y = gy; p.grounded = true; p.airJumps = this.lo.airJumps; p.sq = 0.65; p.air = 0;
      this.stats.maxAir = Math.max(this.stats.maxAir, +airT.toFixed(2));
      if (airT < 0.22) { p.v = Math.max(proj, p.v * 0.95); return; }      // tiny hop, no judgement
      const rel = tv - tg;                                                   // >0: coming in steeper than the slope
      if (s > 0.08 && rel > -0.4 && rel < 0.75) {                           // PERFECT: land along a downslope
        p.v = Math.min(MAX_V, Math.max(proj, p.v) * 1.1 + 40);
        this.stats.perfects++;
        this.bumpCombo(1);
        this.addScore(50, true);
        this.charge(12);
        this.float(this.combo > 1 ? `PERFECT ×${this.combo}` : 'PERFECT', p.x, p.y - 50, GREEN, 22);
        A.perfect(this.combo);
        for (let i = 0; i < 14; i++) this.spark(p.x, p.y + 6, i % 2 ? GREEN : '#ffffff', 1.4, 260);
        this.shake = Math.max(this.shake, 3);
      } else if (s < -0.1 && diff > 1.0 && p.vy > 400) {                     // belly flop into a climb
        p.v = Math.max(minSpeedAt(this.d), proj * 0.7);
        if (this.combo > 1) this.float('CHAIN BROKEN', p.x, p.y - 50, RED, 18);
        this.combo = 0; this.comboT = 0;
        A.rough(); this.shake = Math.max(this.shake, 7);
        for (let i = 0; i < 10; i++) this.spark(p.x, p.y + 8, '#9fb3c8', 1.5, 200);
      } else {
        p.v = Math.max(proj, p.v * 0.9); A.land();
        for (let i = 0; i < 5; i++) this.spark(p.x, p.y + R, '#9fb3c8', 1, 120);
      }
      if (airT > 1.4) { this.float('BIG AIR', p.x, p.y - 80, '#ffd23f', 18); this.bumpCombo(1); this.addScore(40, true); }
    }

    pitFall() {
      const p = this.p;
      if (this.shield || this.blitzT > 0) {
        if (this.shield) { this.shield = false; A.shieldBreak(); this.float('STOP-LOSS SAVED YOU', p.x, p.y - 200, '#4de1ff', 18); }
        else this.float('BLITZ BOUNCE', p.x, p.y - 200, '#ffd23f', 18);
        p.vy = -1250; p.vx = Math.max(p.vx, 480); p.invuln = 1; p.airJumps = this.lo.airJumps;
        this.shake = 10; this.flash = 0.5;
        return;
      }
      this.die('Gapped down — margin call!');
      A.fall();
    }

    hit(cause) {
      const p = this.p;
      if (p.invuln > 0 || this.rocketT > 0) return false;
      if (this.shield) {
        this.shield = false; p.invuln = 1.2; A.shieldBreak(); this.shake = 10; this.flash = 0.6;
        this.float('STOP-LOSS HIT', p.x, p.y - 50, '#4de1ff', 20);
        if (this.combo > 1) this.float('CHAIN BROKEN', p.x, p.y - 80, RED, 16);
        this.combo = 0; this.comboT = 0;
        for (let i = 0; i < 20; i++) this.spark(p.x, p.y, '#4de1ff', 2, 300);
        return true;
      }
      this.die(cause); A.hit();
      return true;
    }

    die(cause) {
      if (!this.alive) return;
      this.alive = false; this.deathCause = cause; this.shake = 16; this.flash = 1;
      const p = this.p;
      for (let i = 0; i < 40; i++) this.spark(p.x, p.y, i % 3 ? this.lo.skin.color : RED, 2.5, 500);
      this.combo = 0;
    }

    finalStats() { this.syncStats(); return Object.assign({}, this.stats, { cause: this.deathCause }); }
    syncStats() {
      const s = this.stats;
      s.score = Math.floor(this.score); s.dist = Math.floor(this.dist); s.coins = this.coins; s.time = +this.time.toFixed(1);
      s.maxCombo = Math.max(s.maxCombo, this.combo); s.catTypes = Object.keys(this.catSeen).length;
    }

    // ---- scoring helpers ----
    addScore(n, show) { this.score += n * this.mult; }
    bumpCombo(n) { this.combo += n; this.comboT = COMBO_TIME; this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo); }
    cashCombo() {
      if (this.combo >= 3) {
        const bonus = this.combo * this.combo * 10 * this.lo.scoreMult;
        this.score += bonus;
        this.float(`CHAIN ×${this.combo}  +${fmtMoney(bonus)}`, this.p.x + 40, this.p.y - 110, '#ffd23f', 22);
        A.powerup();
      }
      this.combo = 0; this.comboT = 0;
    }
    charge(n) {
      if (this.blitzT > 0) return;
      this.meter += n * this.lo.blitzFill;
      if (this.meter >= 100) {
        this.meter = 100; this.blitzT = this.lo.blitzTime; this.stats.blitzes++;
        A.blitz(); this.flash = 0.8; this.shake = 8;
        this.float('BLITZ MODE!', this.p.x + 80, this.p.y - 90, '#ffd23f', 34);
        this.bumpCombo(1);
      }
    }

    // ================= ENTITIES =================
    updateEntities(dt) {
      const p = this.p, w = this.world, t = this.time;
      const py = p.y - R;                       // p.y is the feet; collisions use the body centre
      const magnet = this.magnetT > 0 || this.rocketT > 0 || this.blitzT > 0;
      const magR = this.magnetT > 0 ? 260 : 170;
      // coins
      for (const c of w.coins) {
        if (c.taken || c.y === null) continue;
        const dx = c.x - p.x; if (dx > 700) break;
        if (dx < -120) continue;
        const dy = c.y - py, dd = dx * dx + dy * dy;
        if (magnet && dd < magR * magR) { const k = Math.min(1, dt * 12); c.x -= dx * k; c.y -= dy * k; }
        if (dd < (R + 14) * (R + 14)) {
          c.taken = true; this.coins++; this.addScore(5);
          this.coinChain = Math.min(this.coinChain + 1, 10); this.coinChainT = 0.6;
          A.coin(this.coinChain);
          if (this.combo > 0) this.comboT = Math.min(COMBO_TIME, this.comboT + 0.35);
          this.charge(1.2);
          for (let i = 0; i < 4; i++) this.spark(c.x, c.y, '#ffd23f', 1, 140);
        }
      }
      // catalysts
      for (const u of w.powerups) {
        if (u.taken) continue;
        const dx = u.x - p.x; if (dx > 700) break;
        const yy = u.y + Math.sin(t * 3 + u.t) * 8;
        if (dx * dx + (yy - py) * (yy - py) < (R + 22) * (R + 22)) this.collect(u);
      }
      // hazards
      for (const h of w.hazards) {
        const dx = h.x - p.x; if (dx > 900) break;
        if (dx < -300) continue;
        if (h.type === 'claw' && h.y) {
          if (!h.dead && Math.abs(dx) < 19 && p.y > h.y - 24 && py < h.y + 6) this.hazardContact(h, 'Caught by a bear claw');
        } else if (h.type === 'bear' && h.alive) {
          h.t += dt; h.x += h.dir * 55 * dt;
          if (Math.abs(h.x - h.x0) > 80) h.dir *= -1;
          h.y = w.groundY(h.x);
          const by = h.y - 24, ddx = h.x - p.x, ddy = by - py;
          if (ddx * ddx + ddy * ddy < (R + 19) * (R + 19)) {
            if ((p.vy > 60 && p.y < h.y - 26 && !p.grounded) || this.blitzT > 0 || this.rocketT > 0) this.stomp(h);
            else this.hazardContact(h, 'Mauled by a bear market');
          }
        } else if (h.type === 'candle') {
          // drop is timed from your speed so it lands ~0.5s before you arrive
          if (h.state === 'wait' && h.gy && dx < 200 + p.vx * 1.15) { h.state = 'fall'; h.y = h.gy - 520; h.vy = 500; }
          if (h.state === 'fall') { h.vy += 2600 * dt; h.y += h.vy * dt; if (h.y + h.h >= h.gy) { h.y = h.gy - h.h; h.state = 'down'; this.shake = Math.max(this.shake, 4); for (let i = 0; i < 8; i++) this.spark(h.x, h.gy, RED, 1.2, 200); } }
          if (!h.dead && h.state !== 'wait' && Math.abs(dx) < h.w / 2 + R - 4 && py > h.y - R + 4 && py < h.y + h.h + R - 4) this.hazardContact(h, 'Crushed by a flash crash');
        }
      }
    }
    hazardContact(h, cause) {
      if (this.blitzT > 0 || this.rocketT > 0) { this.smash(h); return; }
      if (this.hit(cause)) { if (h.type === 'claw' || h.type === 'candle') h.dead = true; }
    }
    smash(h) {
      if (h.dead || h.alive === false) return;
      h.dead = true; if (h.type === 'bear') h.alive = false;
      const x = h.x, y = h.type === 'candle' ? h.y + h.h / 2 : (h.y || this.p.y) - 15;
      for (let i = 0; i < 16; i++) this.spark(x, y, i % 2 ? RED : '#ffd23f', 2, 380);
      this.addScore(60, true); this.bumpCombo(1); this.coins += 2; this.shake = Math.max(this.shake, 6);
      this.float('SMASH!', x, y - 40, '#ffd23f', 20); A.stomp();
    }
    stomp(h) {
      const p = this.p;
      if (this.blitzT > 0 || this.rocketT > 0) { this.smash(h); this.stats.stomps++; return; }
      h.alive = false; this.stats.stomps++;
      p.vy = -760; p.airJumps = this.lo.airJumps; p.sq = 1.3;
      this.bumpCombo(1); this.addScore(100, true); this.charge(15); this.coins += 3;
      this.float(this.combo > 1 ? `STOMP ×${this.combo}` : 'STOMP!', h.x, h.y - 70, '#ff9f1a', 22);
      A.stomp(); this.shake = Math.max(this.shake, 6);
      for (let i = 0; i < 18; i++) this.spark(h.x, h.y - 20, i % 2 ? '#8b5a2b' : '#ffd23f', 1.8, 320);
    }
    collect(u) {
      u.taken = true; this.stats.catalysts++; this.catSeen[u.type] = 1;
      const lo = this.lo, p = this.p;
      if (u.type === 'rocket') this.rocketT = lo.rocketTime;
      if (u.type === 'shield') this.shield = true;
      if (u.type === 'magnet') this.magnetT = lo.magnetTime;
      if (u.type === 'lever') this.leverT = lo.leverTime;
      this.bumpCombo(1); this.charge(8); this.addScore(30, true);
      A.powerup(); this.flash = 0.35;
      this.float(CAT[u.type].name, p.x + 30, p.y - 60, CAT[u.type].color, 24);
      this.ring(u.x, u.y, CAT[u.type].color, 60);
    }

    // ================= FX =================
    spark(x, y, color, size = 1, speed = 200, dirX = 0) {
      if (this.parts.length > 450) return;
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * s + dirX * 150, vy: Math.sin(a) * s - speed * 0.2, life: 0, max: 0.35 + Math.random() * 0.4, color, size: (2 + Math.random() * 2.5) * size });
    }
    ring(x, y, color, r) { this.parts.push({ ring: true, x, y, r, life: 0, max: 0.35, color }); }
    float(text, x, y, color, size = 20) { this.floaters.push({ text, x, y, color, size, life: 0, max: 1.1 }); }
    updateFx(dt) {
      for (const q of this.parts) {
        q.life += dt;
        if (!q.ring) { q.vy += 600 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.98; }
      }
      this.parts = this.parts.filter((q) => q.life < q.max);
      for (const f of this.floaters) { f.life += dt; f.y -= 45 * dt; }
      this.floaters = this.floaters.filter((f) => f.life < f.max);
      this.shake = Math.max(0, this.shake - dt * 30);
      this.p.sq = damp(this.p.sq, 1, 12, dt);
    }
    updateCamera(dt) {
      const p = this.p, w = this.world, c = this.cam;
      const speedK = clamp((p.v - 300) / 700, 0, 1);
      c.zoom = damp(c.zoom, lerp(1.05, 0.72, speedK), 2, dt);
      const vh = (this.viewH || VIEW_H) / c.zoom;
      const ahead = w.groundY(p.x + 320 / c.zoom);
      const focus = Math.min(p.y, w.groundY(p.x)) * 0.55 + ahead * 0.45;
      let ty = focus - vh * 0.52;
      ty = Math.min(ty, p.y - 70); ty = Math.max(ty, p.y - vh + 110);
      c.y = damp(c.y, ty, 5, dt);
      c.xOff = 0.28;
    }

    // ================= RENDER =================
    render(ctx, W, H, opts = {}) {
      const c = this.cam, p = this.p;
      const scale = baseScale(W, H) * c.zoom;
      const vw = W / scale, vh = H / scale;
      c.x = p.x - vw * 0.24; this.viewH = vh * c.zoom;
      const shakeOn = opts.shake !== false;
      const sx = shakeOn ? (Math.random() - 0.5) * this.shake : 0, sy = shakeOn ? (Math.random() - 0.5) * this.shake : 0;

      drawBackground(ctx, W, H, c.x, c.y, scale, this.blitzT > 0, this.time);
      ctx.save();
      ctx.translate(sx, sy); ctx.scale(scale, scale); ctx.translate(-c.x, -c.y);
      drawTerrain(ctx, this.world, c.x - 40, c.x + vw + 40, c.y + vh + 60);
      this.drawEntities(ctx, c.x - 60, c.x + vw + 80);
      this.drawPlayer(ctx);
      this.drawFx(ctx);
      ctx.restore();

      if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.25})`; ctx.fillRect(0, 0, W, H); }
      if (this.blitzT > 0) { // golden vignette
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
        g.addColorStop(0, 'rgba(255,210,63,0)'); g.addColorStop(1, `rgba(255,170,30,${0.18 + 0.06 * Math.sin(this.time * 12)})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      this.drawHud(ctx, W, H, opts);
    }

    drawEntities(ctx, x0, x1) {
      const w = this.world, t = this.time;
      // coins
      for (const c of w.coins) {
        if (c.taken || c.y === null || c.x < x0) continue; if (c.x > x1) break;
        const sw = Math.abs(Math.cos(t * 4 + c.x * 0.01));
        ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 10 * sw + 1.5, 10, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 8 * sw + 1, 8, 0, 0, 7); ctx.fill();
        if (sw > 0.5) { ctx.fillStyle = '#b8860b'; ctx.font = '700 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', c.x, c.y + 1); }
      }
      // catalysts
      for (const u of w.powerups) {
        if (u.taken || u.x < x0) continue; if (u.x > x1) break;
        const y = u.y + Math.sin(t * 3 + u.t) * 8, col = CAT[u.type].color;
        ctx.save(); ctx.translate(u.x, y); ctx.rotate(Math.sin(t * 2 + u.t) * 0.15);
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 6); ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        roundRect(ctx, -19, -19, 38, 38, 9); ctx.fillStyle = '#0d1426'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
        drawCatIcon(ctx, u.type, col);
        ctx.restore();
      }
      // hazards
      for (const h of w.hazards) {
        if (h.x < x0 - 40) continue; if (h.x > x1 + 40) break;
        if (h.type === 'claw' && h.y && !h.dead) drawClaw(ctx, h.x, h.y);
        else if (h.type === 'bear' && h.alive) drawBear(ctx, h.x, h.y, h.dir, h.t);
        else if (h.type === 'candle' && !h.dead) {
          if (h.state === 'wait' && h.gy) { // warning marker
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 14); ctx.fillStyle = RED;
            ctx.font = '900 26px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', h.x, h.gy - 30); ctx.globalAlpha = 1;
          } else if (h.state !== 'wait') {
            ctx.strokeStyle = RED; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(h.x, h.y - 25); ctx.lineTo(h.x, h.y + h.h); ctx.stroke();
            ctx.fillStyle = RED; roundRect(ctx, h.x - h.w / 2, h.y, h.w, h.h - 12, 3); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(h.x - h.w / 2 + 4, h.y + 4, 5, h.h - 22);
          }
        }
      }
    }

    drawPlayer(ctx) {
      const p = this.p, sk = this.lo.skin, t = this.time;
      // trail
      if (p.trail.length > 1) {
        ctx.lineCap = 'round';
        for (let i = 1; i < p.trail.length; i++) {
          const a = i / p.trail.length;
          ctx.strokeStyle = this.blitzT > 0 ? `hsla(${(t * 400 + i * 20) % 360},100%,60%,${a * 0.8})` : hexA(sk.trail, a * 0.5);
          ctx.lineWidth = R * 1.4 * a;
          ctx.beginPath(); ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y); ctx.lineTo(p.trail[i].x, p.trail[i].y); ctx.stroke();
        }
      }
      if (!this.alive) return;
      ctx.save(); ctx.translate(p.x, p.y - R * p.sq * 0.95);
      if (p.invuln > 0 && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.45;
      ctx.rotate(p.angle);
      // rocket flame
      if (this.rocketT > 0) {
        const fl = 20 + Math.random() * 14;
        ctx.fillStyle = '#ff5a1f'; ctx.beginPath(); ctx.moveTo(-R, -7); ctx.lineTo(-R - fl, 0); ctx.lineTo(-R, 7); ctx.fill();
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-R, -4); ctx.lineTo(-R - fl * 0.6, 0); ctx.lineTo(-R, 4); ctx.fill();
      }
      ctx.scale(1 / Math.sqrt(p.sq), p.sq);
      drawSkin(ctx, sk, t, p.dive);
      ctx.restore();
      // shield / magnet auras (unrotated)
      const cy = p.y - R;
      if (this.shield) {
        ctx.strokeStyle = `rgba(77,225,255,${0.6 + 0.3 * Math.sin(t * 8)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, cy, R + 10, 0, 7); ctx.stroke();
        ctx.fillStyle = 'rgba(77,225,255,0.12)'; ctx.fill();
      }
      if (this.magnetT > 0) {
        const r = R + 14 + ((t * 60) % 30);
        ctx.strokeStyle = `rgba(255,79,216,${0.5 * (1 - ((t * 60) % 30) / 30)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, cy, r, 0, 7); ctx.stroke();
      }
    }

    drawFx(ctx) {
      for (const q of this.parts) {
        const a = 1 - q.life / q.max;
        if (q.ring) { ctx.strokeStyle = hexA(q.color, a); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (0.3 + q.life / q.max), 0, 7); ctx.stroke(); continue; }
        ctx.fillStyle = hexA(q.color, a); ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const f of this.floaters) {
        const k = f.life / f.max, pop = k < 0.12 ? 0.6 + k / 0.12 * 0.5 : 1.1 - Math.min(0.1, (k - 0.12));
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.font = `900 ${Math.round(f.size * pop)}px system-ui,sans-serif`;
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(5,8,20,0.85)'; ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
    }

    drawHud(ctx, W, H, opts) {
      const u = Math.max(0.75, Math.min(W, H * 1.6) / 900);   // UI scale
      const pad = 14 * u;
      ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      // score
      ctx.font = `900 ${30 * u}px system-ui,sans-serif`;
      shadowText(ctx, fmtMoney(this.score), pad, pad, '#ffffff');
      ctx.font = `700 ${15 * u}px system-ui,sans-serif`;
      shadowText(ctx, `${fmtInt(this.dist)} m`, pad, pad + 36 * u, '#9fb3c8');
      // coins
      const cx = pad + 8 * u, cy = pad + 64 * u;
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(cx, cy + 8 * u, 8 * u, 0, 7); ctx.fill();
      ctx.fillStyle = '#b8860b'; ctx.font = `800 ${10 * u}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.fillText('$', cx, cy + 3.5 * u);
      ctx.textAlign = 'left'; ctx.font = `800 ${16 * u}px system-ui,sans-serif`;
      shadowText(ctx, fmtInt(this.coins), cx + 14 * u, cy, '#ffd23f');
      // ticker (price of the chart you're riding)
      const pr = this.price(this.p.y), ch = (pr / this.startPrice - 1) * 100;
      ctx.font = `700 ${13 * u}px ui-monospace,Menlo,monospace`;
      shadowText(ctx, `BLZ ${pr.toFixed(2)} ${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(1)}%`, pad, cy + 26 * u, ch >= 0 ? GREEN : RED);

      // combo + multiplier (center)
      ctx.textAlign = 'center';
      const m = this.mult;
      if (this.combo > 0 || m > 1.01) {
        ctx.font = `900 ${26 * u}px system-ui,sans-serif`;
        const col = this.blitzT > 0 ? '#ffd23f' : this.combo >= 10 ? '#ff4fd8' : this.combo >= 5 ? GREEN : '#ffffff';
        shadowText(ctx, `×${m.toFixed(1)}`, W / 2, pad, col);
        if (this.combo > 0) {
          ctx.font = `800 ${12 * u}px system-ui,sans-serif`;
          shadowText(ctx, `${this.combo} CHAIN`, W / 2, pad + 30 * u, '#cfe0ff');
          const bw = 110 * u; ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(W / 2 - bw / 2, pad + 47 * u, bw, 4 * u);
          ctx.fillStyle = col; ctx.fillRect(W / 2 - bw / 2, pad + 47 * u, bw * clamp(this.comboT / COMBO_TIME, 0, 1), 4 * u);
        }
      }
      // blitz meter (bottom center)
      const mw = Math.min(W * 0.5, 320 * u), mh = 10 * u, mx = W / 2 - mw / 2, my = H - 26 * u;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(ctx, mx - 2, my - 2, mw + 4, mh + 4, 6); ctx.fill();
      const fill = clamp(this.meter / 100, 0, 1);
      const g = ctx.createLinearGradient(mx, 0, mx + mw, 0);
      g.addColorStop(0, '#ff8c1a'); g.addColorStop(1, '#ffd23f');
      ctx.fillStyle = g; roundRect(ctx, mx, my, Math.max(0.01, mw * fill), mh, 5); ctx.fill();
      ctx.font = `800 ${10 * u}px system-ui,sans-serif`; ctx.textBaseline = 'bottom';
      shadowText(ctx, this.blitzT > 0 ? `⚡ BLITZ MODE ${this.blitzT.toFixed(1)}s ⚡` : '⚡ BLITZ METER', W / 2, my - 3, this.blitzT > 0 ? '#ffd23f' : '#9fb3c8');

      // active catalysts (top-right, under the pause button)
      const act = [];
      if (this.rocketT > 0) act.push(['rocket', this.rocketT / this.lo.rocketTime]);
      if (this.shield) act.push(['shield', 1]);
      if (this.magnetT > 0) act.push(['magnet', this.magnetT / this.lo.magnetTime]);
      if (this.leverT > 0) act.push(['lever', this.leverT / this.lo.leverTime]);
      act.forEach(([type, f], i) => {
        const r = 17 * u, x = W - pad - r - i * (r * 2 + 8 * u), y = pad + 70 * u;
        ctx.fillStyle = 'rgba(13,20,38,0.8)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = CAT[type].color; ctx.lineWidth = 3 * u;
        ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
        ctx.save(); ctx.translate(x, y); ctx.scale(u * 0.8, u * 0.8); drawCatIcon(ctx, type, CAT[type].color); ctx.restore();
      });

      // tutorial prompts
      if (this.tutorial && this.alive) {
        const t = this.time; let msg = '';
        if (t < 4) msg = opts.touch ? 'TAP RIGHT SIDE to JUMP' : 'SPACE / CLICK to JUMP';
        else if (t < 8) msg = 'Tap again in mid-air to DOUBLE JUMP';
        else if (t < 14) msg = opts.touch ? 'HOLD LEFT SIDE to DIVE — land on red downslopes' : 'HOLD ↓ / S to DIVE — land on red downslopes';
        else if (t < 19) msg = 'Smooth downslope landings = PERFECT + speed + combo';
        else if (t < 24) msg = 'Chain tricks before the timer runs out. Fill the ⚡ meter!';
        if (msg) {
          ctx.font = `800 ${Math.min(20 * u, W / 26)}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 5);
          shadowText(ctx, msg, W / 2, H * 0.3, '#ffffff'); ctx.globalAlpha = 1;
        }
      }
      // touch zone hints
      if (opts.touch && this.time < 30) {
        ctx.globalAlpha = Math.max(0, 0.5 - this.time / 60);
        ctx.font = `900 ${16 * u}px system-ui,sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
        shadowText(ctx, '▼ HOLD: DIVE', W * 0.2, H - 60 * u, '#ffffff');
        shadowText(ctx, 'TAP: JUMP ▲', W * 0.8, H - 60 * u, '#ffffff');
        ctx.globalAlpha = 1;
      }
    }
  }

  // ================= drawing helpers (module-private) =================
  // World-to-screen scale: fit VIEW_H units vertically, but always show >= 820 units horizontally (portrait phones).
  const baseScale = (W, H) => Math.min(H / VIEW_H, W / 820);
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function shadowText(ctx, s, x, y, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(s, x + 2, y + 2);
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  const frac = (n) => n - Math.floor(n);
  const hash = (n) => frac(Math.sin(n * 127.1) * 43758.5453);

  function drawBackground(ctx, W, H, camX, camY, scale, blitz, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, blitz ? '#2a1640' : '#0b1030'); g.addColorStop(1, blitz ? '#3d1a1a' : '#131a3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // parallax grid with price labels
    const ps = 0.35, gx = 120 * scale * 0.8, gy = 100 * scale * 0.8;
    const ox = -((camX * scale * ps) % gx), oy = -((camY * scale * ps) % gy);
    ctx.strokeStyle = 'rgba(120,150,255,0.07)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = ox; x < W; x += gx) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = oy; y < H; y += gy) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    // background candlesticks (parallax 0.5)
    const cs = 0.5, cw = 22 * scale, start = Math.floor(camX * cs * scale / cw);
    for (let k = start - 1; k < start + W / cw + 2; k++) {
      const x = k * cw - camX * cs * scale;
      const base = H * 0.55 + Math.sin(k * 0.13) * H * 0.12 + Math.sin(k * 0.037) * H * 0.1 - camY * scale * 0.08;
      const o = (hash(k) - 0.5) * 50 * scale, cl = (hash(k + 0.5) - 0.5) * 50 * scale, up = cl < o;
      ctx.fillStyle = up ? 'rgba(34,227,154,0.07)' : 'rgba(255,77,109,0.07)';
      const top = base + Math.min(o, cl), h = Math.abs(o - cl) + 3;
      ctx.fillRect(x + cw * 0.2, top, cw * 0.6, h);
      ctx.fillRect(x + cw * 0.47, top - 12 * scale * hash(k + 3), cw * 0.06, h + 24 * scale * hash(k + 7));
    }
  }

  // Chart-line terrain: filled area + green (rising) / red (falling) glowing line + gap markers.
  function drawTerrain(ctx, w, x0, x1, bottom) {
    const STEP = BR.World.STEP;
    const i0 = Math.max(0, Math.floor((x0 - w.baseX) / STEP)), i1 = Math.min(w.ys.length - 1, Math.ceil((x1 - w.baseX) / STEP));
    // fill solid runs
    const fill = ctx.createLinearGradient(0, bottom - 700, 0, bottom);
    fill.addColorStop(0, 'rgba(40,70,140,0.55)'); fill.addColorStop(1, 'rgba(10,14,34,0.95)');
    ctx.fillStyle = fill;
    let i = i0;
    while (i < i1) {
      while (i < i1 && !(w.solid[i] && w.solid[i + 1])) i++;
      if (i >= i1) break;
      const s = i; ctx.beginPath(); ctx.moveTo(w.baseX + s * STEP, bottom);
      while (i < i1 && w.solid[i] && w.solid[i + 1]) { ctx.lineTo(w.baseX + i * STEP, w.ys[i]); i++; }
      ctx.lineTo(w.baseX + i * STEP, w.ys[i]); ctx.lineTo(w.baseX + i * STEP, bottom); ctx.closePath(); ctx.fill();
    }
    // line: batch rising / falling segments
    for (const pass of [[9, 0.18], [3.5, 1]]) {
      for (const up of [true, false]) {
        ctx.beginPath();
        for (let k = i0; k < i1; k++) {
          if (!(w.solid[k] && w.solid[k + 1])) continue;
          const rising = w.ys[k + 1] <= w.ys[k];
          if (rising !== up) continue;
          ctx.moveTo(w.baseX + k * STEP, w.ys[k]); ctx.lineTo(w.baseX + (k + 1) * STEP, w.ys[k + 1]);
        }
        ctx.strokeStyle = up ? hexA(GREEN, pass[1]) : hexA(RED, pass[1]); ctx.lineWidth = pass[0]; ctx.lineCap = 'round'; ctx.stroke();
      }
    }
    // gaps ("trading halted")
    ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,77,109,0.7)';
    for (let k = i0; k < i1; k++) {
      const edgeL = w.solid[k] && !w.solid[k + 1], edgeR = !w.solid[k] && w.solid[k + 1];
      if (edgeL || edgeR) {
        const x = w.baseX + (edgeL ? k : k + 1) * STEP, y = w.ys[edgeL ? k : k + 1];
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 500); ctx.stroke();
        if (edgeL) {
          let e = k + 1; while (e < w.ys.length - 1 && !w.solid[e]) e++;
          const mid = (x + w.baseX + e * STEP) / 2;
          ctx.save(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,77,109,0.8)'; ctx.font = '800 14px system-ui,sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('GAP DOWN', mid, y + 60); ctx.restore();
        }
      }
    }
    ctx.setLineDash([]);
  }

  function drawClaw(ctx, x, y) {
    ctx.fillStyle = '#ff4d6d'; ctx.strokeStyle = '#5a0f1f'; ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath(); ctx.moveTo(x + k * 9 - 6, y + 2); ctx.quadraticCurveTo(x + k * 9 - 4, y - 22, x + k * 9 + 5, y - 34 + Math.abs(k) * 6);
      ctx.quadraticCurveTo(x + k * 9 + 2, y - 14, x + k * 9 + 6, y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  function drawBear(ctx, x, y, dir, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(-dir, 1);
    const bob = Math.abs(Math.sin(t * 8)) * 3;
    ctx.fillStyle = '#6b3f1f'; ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -20 - bob, 24, 18, 0, 0, 7); ctx.fill(); ctx.stroke();      // body
    ctx.beginPath(); ctx.arc(16, -34 - bob, 12, 0, 7); ctx.fill(); ctx.stroke();                 // head
    ctx.beginPath(); ctx.arc(10, -45 - bob, 4.5, 0, 7); ctx.arc(22, -44 - bob, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(20, -36 - bob, 2.6, 0, 7); ctx.fill();   // angry eye
    ctx.fillStyle = '#c9a27a'; ctx.beginPath(); ctx.ellipse(25, -30 - bob, 5, 4, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(13, -42 - bob); ctx.lineTo(22, -39 - bob); ctx.stroke();
    ctx.fillStyle = '#2a1608'; ctx.fillRect(-16, -6, 8, 6 + (Math.sin(t * 8) > 0 ? 0 : -2)); ctx.fillRect(8, -6, 8, 6 + (Math.sin(t * 8) > 0 ? -2 : 0));
    ctx.fillStyle = '#ff4d6d'; ctx.font = '900 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▼', -2, -18 - bob);
    ctx.restore();
  }
  function drawCatIcon(ctx, type, col) {
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
    if (type === 'rocket') {
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(8, -4, 5, 8); ctx.lineTo(-5, 8); ctx.quadraticCurveTo(-8, -4, 0, -12); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-4, 9); ctx.lineTo(0, 16); ctx.lineTo(4, 9); ctx.fill();
    } else if (type === 'shield') {
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(10, -7); ctx.quadraticCurveTo(9, 7, 0, 13); ctx.quadraticCurveTo(-9, 7, -10, -7); ctx.closePath(); ctx.fill();
    } else if (type === 'magnet') {
      ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, -1, 8, Math.PI, 0); ctx.lineTo(8, 9); ctx.moveTo(-8, -1); ctx.lineTo(-8, 9); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(-11, 7, 6, 4); ctx.fillRect(5, 7, 6, 4);
    } else {
      ctx.font = '900 17px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('2×', 0, 1);
    }
  }

  // Characters are drawn procedurally around (0,0) facing right, radius R.
  function drawSkin(ctx, sk, t, dive) {
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#0a0f22';
    if (sk.id === 'diamond') {
      ctx.fillStyle = sk.color; ctx.beginPath(); ctx.moveTo(0, -R - 2); ctx.lineTo(R + 1, -4); ctx.lineTo(0, R + 2); ctx.lineTo(-R - 1, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(6, -4); ctx.lineTo(-6, -4); ctx.closePath(); ctx.fill();
    } else {
      if (sk.id === 'mooncat') { ctx.fillStyle = sk.color; tri(ctx, -10, -10, -13, -24, -2, -15); tri(ctx, 4, -15, 12, -25, 13, -10); }
      if (sk.id === 'ape') { ctx.fillStyle = sk.color; ctx.beginPath(); ctx.arc(-R + 1, -2, 6, 0, 7); ctx.fill(); ctx.stroke(); }
      if (sk.id === 'whale') { ctx.fillStyle = sk.color; tri(ctx, -R + 2, 0, -R - 12, -10, -R - 10, 8); ctx.stroke(); }
      const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, R);
      g.addColorStop(0, sk.accent); g.addColorStop(0.35, sk.color); g.addColorStop(1, shade(sk.color));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); ctx.stroke();
      if (sk.id === 'bull') {
        ctx.strokeStyle = '#fff1d6'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-4, -R + 2); ctx.quadraticCurveTo(-8, -R - 10, 2, -R - 12); ctx.moveTo(6, -R + 3); ctx.quadraticCurveTo(10, -R - 8, 18, -R - 8); ctx.stroke();
        ctx.strokeStyle = '#0a0f22'; ctx.lineWidth = 2.5;
      }
      if (sk.id === 'ape') { ctx.fillStyle = sk.accent; ctx.beginPath(); ctx.ellipse(6, 3, 9, 8, 0, 0, 7); ctx.fill(); }
      if (sk.id === 'whale') { ctx.strokeStyle = '#bfe0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -R); ctx.quadraticCurveTo(-6, -R - 10 - Math.sin(t * 10) * 2, -10, -R - 8); ctx.moveTo(-2, -R); ctx.quadraticCurveTo(2, -R - 12, 6, -R - 9); ctx.stroke(); ctx.strokeStyle = '#0a0f22'; }
    }
    // emblem
    if (sk.id === 'blitz') {
      ctx.fillStyle = '#1a1a2e'; ctx.beginPath(); ctx.moveTo(-3, -10); ctx.lineTo(4, -10); ctx.lineTo(0, -2); ctx.lineTo(5, -2); ctx.lineTo(-5, 11); ctx.lineTo(-1, 1); ctx.lineTo(-6, 1); ctx.closePath(); ctx.fill();
    }
    if (sk.id === 'satoshi') { ctx.fillStyle = '#8a6d00'; ctx.font = '900 16px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('₿', -3, 1); }
    // eyes (look forward; squint when diving)
    ctx.fillStyle = '#ffffff';
    const ey = sk.id === 'diamond' ? -4 : -3;
    if (dive) { ctx.fillRect(4, ey - 1, 7, 3); ctx.fillRect(10, ey - 1, 5, 3); }
    else {
      ctx.beginPath(); ctx.arc(8, ey, 4.2, 0, 7); ctx.arc(14.5, ey, 3.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#0a0f22'; ctx.beginPath(); ctx.arc(9.5, ey, 2, 0, 7); ctx.arc(15.3, ey, 1.6, 0, 7); ctx.fill();
    }
  }
  function tri(ctx, a, b, c, d, e, f) { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.lineTo(e, f); ctx.closePath(); ctx.fill(); }
  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${(n >> 16) * 0.55 | 0},${((n >> 8) & 255) * 0.55 | 0},${(n & 255) * 0.55 | 0})`;
  }

  // Menu backdrop: slowly scrolling chart, no player (purely decorative, not a run).
  class Backdrop {
    constructor() { this.world = new BR.World((Math.random() * 1e9) | 0, { menu: true }); this.x = 0; this.y = 0; this.t = 0; }
    render(ctx, W, H, dt) {
      this.t += dt; this.x += 90 * dt;
      const scale = baseScale(W, H), vw = W / scale, vh = H / scale;
      this.world.ensure(this.x + vw + 600); this.world.settle(this.x - 300);
      this.y = damp(this.y, this.world.groundY(this.x + vw * 0.5) - vh * 0.6, 1.5, dt);
      drawBackground(ctx, W, H, this.x, this.y, scale, false, this.t);
      ctx.save(); ctx.scale(scale, scale); ctx.translate(-this.x, -this.y);
      drawTerrain(ctx, this.world, this.x - 40, this.x + vw + 40, this.y + vh + 60);
      ctx.restore();
    }
  }

  Game.Backdrop = Backdrop;
  Game.drawSkinPreview = (ctx, sk, size) => { ctx.save(); ctx.translate(size / 2, size / 2 + 4); const s = size / 48; ctx.scale(s, s); drawSkin(ctx, sk, 0, false); ctx.restore(); };
  Game.CAT = CAT;
  return Game;
})();
