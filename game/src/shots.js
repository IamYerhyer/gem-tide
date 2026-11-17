// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by an autopilot, so the frame is
// what a real game looks like and the same seed always gives the same frame.
//  - start: the swarm drifts harmlessly behind the title panel.
//  - play: a competent pilot — it lines up under the lowest enemy, fires, and dodges
//    anything about to touch it or cross the tide line nearby.
//  - end: a pilot that never fires and barely steers, so breaches and touches end its
//    run, as they end a distracted player's.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 20;
const END_LIMIT_SECONDS = 600;
const NO_MOVE = { x: 0, y: 0 };

function lowestEnemy(state) {
  let best = null;
  for (const e of state.enemies) {
    if (e.active && (best === null || e.y > best.y)) best = e;
  }
  return best;
}

/** Steer toward the lowest enemy's column; dodge sideways when something is very close. */
function pilot(state) {
  const player = state.player;
  const cx = player.x + player.width / 2;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const dx = e.x - cx;
    const dy = e.y - (player.y + player.height / 2);
    if (Math.abs(dx) < 54 && dy > -70 && dy < 130) {
      return { x: dx >= 0 ? -1 : 1, y: 0 };
    }
  }
  const target = lowestEnemy(state);
  if (target === null) {
    const home = FIELD.width / 2;
    return { x: home > cx + 10 ? 1 : home < cx - 10 ? -1 : 0, y: 0 };
  }
  const dx = target.x - cx;
  return { x: dx > 12 ? 1 : dx < -12 ? -1 : 0, y: 0 };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, NO_MOVE, false, null, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      world.step(STEP, pilot(world.state), true, null, false);
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // A real run first: 25 seconds of the competent pilot, so the final frame carries a
  // real score — then the pilot gives up, drifting without firing, and the swarm gets
  // through, as it does for a player who stops shooting.
  for (let i = 0; i < 25 / STEP; i += 1) {
    world.step(STEP, pilot(world.state), true, null, false);
  }
  for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
    const drift = { x: Math.sin(i / 240) > 0 ? 1 : -1, y: 0 };
    if (world.step(STEP, drift, false, null, false) & EVENT_OVER) break;
  }
  return { screen: SCREEN_OVER, best: world.state.score };
}
