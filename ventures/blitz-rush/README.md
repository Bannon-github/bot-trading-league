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
- Save data lives in `localStorage` key `blitzRush.save.v1`. "Reset all progress" in Settings clears only that key
  (the league tracker's key is left alone).

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
