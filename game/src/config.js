// Every tuning number and colour for Gem Tide in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size.

export const FIELD = { width: 1280, height: 720, tideY: 648 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  width: 46,
  height: 38,
  speed: 520,
  pointerSpeed: 1100,
  invulnerable: 1.6,
  fireInterval: 0.14,
  bulletSpeed: 760,
  bulletWidth: 6,
  bulletHeight: 18,
};

export const LIVES = 3;
export const MAX_LIVES = 5;

/** Clearing this wave wins the game. */
export const WIN_WAVE = 8;

export const ENEMY = {
  drone: { hp: 1, radius: 20, speed: 96, points: 50 },
  weaver: { hp: 2, radius: 22, speed: 82, points: 80, sway: 120, swayRate: 2.4 },
  brute: { hp: 6, radius: 34, speed: 52, points: 200 },
  speedPerWave: 9,
  spawnStart: 0.9,
  spawnMin: 0.28,
  spawnScale: 0.9,
};

export const GEM = { radius: 11, fall: 150, points: 25, chance: 0.45 };

/** A kill chain: each kill refreshes the timer; every CHAIN_STEP kills raises the multiplier. */
export const COMBO = { window: 3, step: 4, maxMultiplier: 8 };

export const POOL = { bullets: 64, enemies: 48, pickups: 28, particles: 180, floaters: 24 };

export const PALETTE = {
  backdrop: '#070b18',
  deep: '#0a1030',
  horizon: '#12224d',
  grid: '#1d3a6e',
  tide: '#19d3da',
  player: '#37f4e4',
  playerCore: '#eafffb',
  bullet: '#8ff7ff',
  drone: '#ff5470',
  weaver: '#c77dff',
  brute: '#ff9f43',
  gem: '#3dff9e',
  heart: '#ff6b9d',
  shield: '#6bcbff',
  panel: 'rgba(13, 20, 44, 0.92)',
  panelEdge: '#2a4a8f',
  text: '#eef6ff',
  muted: '#93a5c8',
  gold: '#ffd166',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gem-tide.best';
