// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), world events become sound effects
// and announcements, and the renderer paints what is there. The game moves between four
// screens: title, play, paused and game over (win or lose).
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_BREACH, EVENT_BRUTE_DOWN, EVENT_GEM, EVENT_HIT, EVENT_KILL,
  EVENT_OVER, EVENT_POWER, EVENT_SHOOT, EVENT_WAVE, EVENT_WIN,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastShotSound = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.wave();
    announce(`Playing. Wave 1 of 8. ${world.state.lives} hull.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (world.state.won) audio.win();
    else audio.over();
    announce(world.state.won
      ? `You win. Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      announce(audio.toggleMute() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function react(events) {
    if (events & EVENT_SHOOT) {
      const now = performance.now();
      if (now - lastShotSound > 60) {
        audio.shoot();
        lastShotSound = now;
      }
    }
    if (events & EVENT_BRUTE_DOWN) audio.explosion(true);
    else if (events & EVENT_KILL) audio.explosion(false);
    if (events & EVENT_GEM) audio.gem();
    if (events & EVENT_POWER) audio.power();
    if (events & EVENT_BREACH) {
      audio.breach();
      announce(world.state.lives === 1 ? 'Breach. 1 hull left.' : `Breach. ${world.state.lives} hull left.`);
    }
    if (events & EVENT_HIT) {
      audio.hit();
      announce(world.state.lives === 1 ? 'Hit. 1 hull left.' : `Hit. ${world.state.lives} hull left.`);
    }
    if (events & EVENT_WAVE) {
      audio.wave();
      announce(`Wave ${world.state.wave}.`);
    }
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_WIN) endGame();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, null, true);
      return;
    }
    const events = world.step(STEP, input.direction(), input.firing(), input.pointerTarget(), false);
    react(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.muted);
  }

  // Leaving the tab pauses a running game rather than letting the swarm fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Gem Tide. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
