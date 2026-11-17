# gem-tide

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/IamYerhyer/gem-tide/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/IamYerhyer/gem-tide/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Gem Tide** is a neon wave-based arcade defender for the browser, written in vanilla JavaScript with no libraries and no network requests — everything is drawn in code on a canvas. Pilot a tide skimmer above the reef, blast the falling swarm (darting drones, sine-weaving weavers and armoured brutes), catch the gems they drop, and hold the tide line through 8 waves to win. Every enemy that slips past the line — or touches your ship — costs 1 hull. Kills and gems chain into combo multipliers up to x8, brutes drop shield and hull power-ups, and generated Web Audio sound effects (no audio files) with particles, floating score text and screen shake keep every hit feeling crunchy.

How to play:

- **Move:** arrow keys / WASD, or steer with the mouse
- **Fire:** hold Space or J, or hold the mouse button
- **Pause:** P or Esc · **Mute:** M · **Start / restart:** Space, Enter or click
- Chain kills before the combo bar drains to raise your multiplier; a hit or a breach resets it. Clear all 8 waves to save the tide.

The game is the static `game/` folder (`game/index.html` plus ES modules under `game/src/`). `main.ts` is the make.fun entry program: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library in `vendor/`. Screenshot scenes are deterministic: open `game/index.html?shot=start|play|end&seed=1` (see `shots.json`).

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in a desktop browser
# (or simply open game/index.html in a browser — it runs fully offline)
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=cfpg3p8n&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
