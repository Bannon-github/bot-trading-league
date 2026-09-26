# Blitz Rush

An arcade momentum runner for **Blitz**, the momentum-trader bot. You ride a live, procedurally generated
price chart: the chart line is the terrain. Green rallies launch you, red crashes are where you pick up speed,
and gap-downs are pits.

Text assets only (HTML/CSS/JS/SVG), no external requests, no build step. Open `index.html` from any static
host (GitHub Pages) or straight from disk (`file://` works too, since it uses classic scripts, not ES modules).

## Files
```
index.html        entry point: screens/menus markup, script includes, tracker hook
favicon.svg
css/style.css     UI styles (responsive, safe-area aware)
js/util.js        seeded RNG, math helpers, safe localStorage wrapper
js/audio.js       Web Audio: synth SFX + 16-step procedural music loop (intensity follows your speed)
js/meta.js        save data, upgrades, characters, missions/ranks, achievements, leaderboard, daily challenge
js/world.js       procedural chart terrain (hills/rallies/dumps/gaps) + coins, catalysts and hazards
js/game.js        one run: physics, scoring/chains, Blitz Mode, effects, canvas rendering, HUD
js/ui.js          DOM menus: title, shop, trophies, records, settings, pause, run summary, toasts
js/main.js        boot, 60 fps loop, keyboard/mouse/touch input, state machine, pause on blur
shots/            screenshots from the headless test runs
```

## How to play
| Action | Keyboard | Mouse | Touch |
|---|---|---|---|
| Jump / double jump | Space, W, ↑ | left click | tap the **right** half |
| Dive (hold) | S, ↓, Shift | hold right button | hold the **left** half |
| Pause | P / Esc (also auto-pauses on tab switch or blur) | ⏸ button | ⏸ button |
| Restart | R (or Space/Enter on the summary screen) | | |
| Mute | M | 🔊 button | 🔊 button |

- **Momentum:** diving on a downslope speeds you up. Diving on a climb slows you down. Release on green, dive on red.
- **Perfect landing:** touch down smoothly on a downslope for a speed boost, +1 chain, and ⚡ meter charge.
- **Chain:** perfects, stomps, catalysts, big air and smashes build a chain. Each link adds +0.1× to your score
  multiplier. When the chain timer runs out, the chain cashes in for chain² × $10. Belly-flopping into a climb or
  taking a hit loses the chain.
- **Blitz Mode:** a full ⚡ meter gives a few seconds of invincibility, ×2 score, extra speed, and bounces you out of pits.
- **Catalysts:** 🚀 Earnings Rocket, 🛡️ Stop-Loss shield (absorbs one hit or pit fall), 🧲 Liquidity Magnet, 2× Leverage.
- **Hazards:** gap-downs, bear claws, walking bears (stomp them from above), flash-crash candles
  (a red **!** shows where one will drop).
- Speed, volatility, gap width and hazard density all ramp up with distance.

## v2: depth pass
- **Market regimes** rotate within every run (~every 850–1,150 m, with a calm border and a banner):
  🐂 **Bull Run** (rallies, bears; every run opens here), 〰️ **Sideways Chop** (rhythmic short bumps, great
  for Perfect chains, claws), 📉 **Flash Crash** (dumps, staircase crashes, gaps, falling candles),
  🚀 **Crypto Mania** (huge pumps with sky coin arcs and 5× coins, wide gaps, more catalysts). Each regime has its
  own palette (smoothly blended). The chart line stays green/red everywhere, so the core read never changes.
  Flash Crash unlocks after run 1, Crypto Mania after run 3 (or 1,500 m).
- **⛔ Circuit Breaker** set piece (first at ~1,700 m, then every ~2,500 m): a telegraphed gauntlet
  (striped gate → gap, claws, bears, candles, gap, claws; later ones are longer) built from the normal fair
  patterns at capped difficulty, with calm flats between stages, a progress bar, and a green gate that pays
  1,500×N score, coins and ⚡+40. No catalysts spawn inside it.
- **Perks (roguelite picks):** at 450/350 m, 1,200, 2,300, 3,600, 5,200, 7,000 m, then every 2,000 m, the run freezes
  and you pick 1 of 3 (keys 1/2/3, click or tap). It only opens on safe ground, never mid-gauntlet or over a banner,
  and gives 1.2 s of invulnerability plus a short slow-mo ease-in afterwards. 13 perks; 6 at the start, and more join the pool
  as you get promoted (rank 1–5).
- **First minute:** gentler terrain for the first 2 runs (hazards arrive later, early gaps narrower; the first gap of
  every run is a gimme), a **training shield** for runs 1–2, coins on the intro ramps, and contextual hints
  (landing marker; "HOLD ↓ to dive onto the red slope" while airborne over a downslope; "JUMP!" before hazards) until you have
  a few Perfects. You can turn hints off in Settings. Easy starter missions and new early achievements
  (first Perfect, first stomp, first perk, first Close Call, first regime change).
- **Juice/clarity:** hit-stop on stomps/hits, Close Call bonus (skim a hazard, or a clutch landing just past a gap edge),
  speed lines, 5× coins, and a killer highlight on death ("✖ BEAR CLAW" ring). The summary shows a snapshot of the crash,
  the cause, and a specific tip.
- **Ghost:** an optional pace ghost of your best run (x-position samples at 5 Hz, drawn riding the current chart;
  on the Daily it retraces your exact line) plus a "BEST n m" flag. Stored separately in `blitzRush.ghost.v1`.
- **Pacing:** retuned prices (cheapest upgrades 80–90, characters 400 → 10,000), mission rewards 50+25×rank,
  a free mission swap after each run, and "Next unlock / Big goal / Coming up (free)" cards with progress bars
  on the menu and the summary. Economy sim (`/tmp/pwtest/econ.js`, skill-ramping bot, 25 runs): something to buy almost every
  run, a new character roughly every 4–8 runs, and free content unlocks in runs 1–3 and at each promotion.
- **Save:** still `blitzRush.save.v1` (now `v: 2`). Old saves migrate in place: coins, upgrades, skins, records and
  missions are kept, unknown missions are dropped, new fields get defaults, and veterans (3+ runs) skip the beginner flow.

## Meta-progression (the "one more run" loop)
- **Coins** are banked after each run and spent in the **Shop**:
  - 9 upgrades, 5–8 levels each: rocket/magnet/2× duration, Dividends (+coins), Blitz Charge, Catalyst Luck,
    IPO Pop (start with a rocket), Hedge (start shielded), Extra Leg (more air jumps).
  - 7 characters with perks: Blitz, Raging Bull, Diamond Hands, The Whale, Moon Cat, Degen Ape, Satoshi Gold.
- **Missions:** 3 active at a time, scaled to your rank, with coin rewards. Every 3 completed missions promotes you
  (Intern → Analyst → … → Market Wizard). Each rank adds +10% score.
- **Daily Challenge:** a seeded chart that's the same all day. Beat the day's target for +250 coins. Best daily score is tracked.
- **20 achievements** with coin rewards and in-run toasts.
- **Records:** local top-10 leaderboard plus career stats. The run summary shows a count-up score, new-best banner,
  mission ticks, rewards, and a "next unlock: N coins to go" nudge.
- Save data lives in `localStorage` key `blitzRush.save.v1` (ghost in `blitzRush.ghost.v1`). "Reset all progress" in Settings clears only
  those keys (the league tracker's key is left alone).

## Playtime tracker
The shared tracker is at `/workspace/league/shared/playtime.js`, documented in `/workspace/league/RULES.md`
section "G) Games". It counts **active** play only: the tab is visible **and** there was a real input event in
the last 30 s. The total is saved in `localStorage["btl-playtime:<game>"]` and shown as a small "Played: mm:ss"
badge in the bottom-right corner. The referee's `league game playtime` number is the only source of truth.

**To integrate** (when the game is copied into `/workspace/league/ventures/blitz/<slug>/`):
1. `venture create blitz <slug> --kind game ...`, then copy this folder's contents into the venture folder.
   `shots/` and `README.md` are optional.
2. In `index.html`, find the `LEAGUE PLAYTIME TRACKER HOOK` comment near the end of `<body>` and add the line
   RULES.md requires, uncommented:
   ```html
   <script src="../../shared/playtime.js" data-game="<slug>" defer></script>
   ```
   Use `../../` (not `../../../`) because RULES.md defines the path for the **published** layout, where
   `/ventures/<slug>/index.html` loads `/shared/playtime.js`. Set `data-game` to the real slug.
3. `venture submit blitz <slug>`.

Tested: a throwaway copy in `/tmp` with that exact include loads the tracker (`BTLPlaytime.game === "blitz-rush"`)
with no console errors. It counts real key presses during play, and the badge doesn't block input
(`pointer-events: none`).

**Fair-play guarantees:** the game never dispatches synthetic input events and never touches the tracker's
storage. There's no attract/demo mode (the menu background is just a scrolling chart), and no idle or auto-play
of any kind. The game auto-pauses on blur or tab switch. For optional extra instrumentation, it exposes
`window.BlitzRush.state` / `window.BlitzRush.isPlaying()` and fires a `blitzrush:state` CustomEvent.
v2 adds a `'perk'` state while the perk picker is open (the run is frozen; `isPlaying()` is false).

## Testing
```
cd /workspace/blitz/game && python3 -m http.server 8765
# open http://127.0.0.1:8765/   (append ?debug to expose window.__br for automated tests)
```
The headless tests (playwright-core + system Chrome, scripts in `/tmp/pwtest/`) checked:
- no console errors on desktop, mobile, and file://
- a steady ~60 fps, early and late in a run
- keyboard, mouse, and touch input
- pause on blur, and resume with a countdown
- instant restart
- shop and character screens
- landscape and portrait phone layouts
