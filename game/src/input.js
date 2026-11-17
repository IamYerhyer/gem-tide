// Keyboard and pointer input. Held keys give a steering direction and a fire flag; one-shot
// presses (start or restart, pause, mute) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The pointer steers the
// skimmer directly: while it is down or was moved recently, the world is handed its position
// in logical field coordinates (the same fit-the-field maths the renderer uses).
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const FIRE = new Set(['Space', 'KeyJ']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = { left: false, right: false, up: false, down: false, fire: false };
  let actions = 0;
  let pointer = null;
  let pointerDown = false;
  let pointerSeenAt = -Infinity;

  function setHeld(code, value) {
    if (LEFT.has(code)) held.left = value;
    else if (RIGHT.has(code)) held.right = value;
    else if (UP.has(code)) held.up = value;
    else if (DOWN.has(code)) held.down = value;
    else if (FIRE.has(code)) held.fire = value;
    else return false;
    return true;
  }

  window.addEventListener('keydown', (event) => {
    if (setHeld(event.code, true)) {
      if (CONFIRM.has(event.code) && !event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
      return;
    }
    if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (setHeld(event.code, false)) event.preventDefault();
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.left = held.right = held.up = held.down = held.fire = false;
    pointerDown = false;
  });

  function toField(event) {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    const x0 = (window.innerWidth - FIELD.width * scale) / 2;
    const y0 = (window.innerHeight - FIELD.height * scale) / 2;
    return {
      x: (event.clientX - x0) / scale,
      y: (event.clientY - y0) / scale,
    };
  }

  target.addEventListener('pointermove', (event) => {
    pointer = toField(event);
    pointerSeenAt = performance.now();
  });
  target.addEventListener('pointerdown', (event) => {
    pointer = toField(event);
    pointerSeenAt = performance.now();
    pointerDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    pointerDown = false;
  });

  return {
    /** Held steering as {x, y}, each -1, 0 or 1. */
    direction() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    firing() {
      return held.fire || pointerDown;
    },
    /** The pointer's field position while it is steering (fresh or held down), else null. */
    pointerTarget() {
      if (pointer === null) return null;
      if (pointerDown || performance.now() - pointerSeenAt < 2500) return pointer;
      return null;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
