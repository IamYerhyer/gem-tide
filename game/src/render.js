// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop.
// Neon flat shapes drawn in code: a starfield with parallax, nebula glows, the tide-line
// grid, a sleek skimmer with an engine flame, and three enemy shapes (diamond drone,
// orbiting weaver, hexagon brute). Particles, floating score text and screen shake give
// the hits their juice.
import { COMBO, FIELD, FONT, LIVES, MAX_LIVES, PALETTE, WIN_WAVE } from './config.js';
import { KIND_BRUTE, KIND_DRONE, PICKUP_GEM, PICKUP_HEART } from './world.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const STARS = [];
{
  const rand = createRandom(7);
  for (let i = 0; i < 130; i += 1) {
    STARS.push({ x: rand() * FIELD.width, y: rand() * FIELD.height, r: 0.8 + rand() * 1.9, depth: 0.25 + rand() * 0.75 });
  }
}

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const waveLabel = cachedLabel('Wave ');
  const bestLabel = cachedLabel('Best ');
  const comboLabel = cachedLabel('x');
  let bgGradient = null;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
    bgGradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    bgGradient.addColorStop(0, PALETTE.deep);
    bgGradient.addColorStop(0.62, PALETTE.horizon);
    bgGradient.addColorStop(1, '#0a2e4a');
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight = '') {
    const key = `${size}${weight}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawBackground(state) {
    context.fillStyle = bgGradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Nebula glows: two soft radial blooms drifting very slowly.
    for (const [bx, by, r, color] of [
      [300 + Math.sin(state.elapsed * 0.07) * 30, 180, 260, 'rgba(88, 60, 180, 0.16)'],
      [980 + Math.cos(state.elapsed * 0.05) * 30, 300, 300, 'rgba(20, 120, 160, 0.14)'],
    ]) {
      const g = context.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = g;
      context.fillRect(bx - r, by - r, r * 2, r * 2);
    }
    // Stars scroll downward, faster when nearer, and wrap.
    context.fillStyle = '#cfe8ff';
    for (const s of STARS) {
      const y = (s.y + state.elapsed * 26 * s.depth) % FIELD.height;
      context.globalAlpha = 0.35 + s.depth * 0.6;
      context.beginPath();
      context.arc(s.x, y, s.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // The tide line and its perspective grid below.
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let gx = 0; gx <= FIELD.width; gx += 80) {
      context.moveTo(gx, FIELD.tideY);
      context.lineTo(gx + (gx - FIELD.width / 2) * 0.22, FIELD.height);
    }
    for (let gy = FIELD.tideY + 18; gy < FIELD.height; gy += 18) {
      context.moveTo(0, gy);
      context.lineTo(FIELD.width, gy);
    }
    context.stroke();
    context.strokeStyle = PALETTE.tide;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, FIELD.tideY);
    context.lineTo(FIELD.width, FIELD.tideY);
    context.stroke();
  }

  function drawShip(state) {
    const p = state.player;
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 12) % 2 === 0) {
      // Blink while invulnerable after a hit (still drawn faintly so it never vanishes).
      context.globalAlpha = 0.35;
    }
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    // Engine flame, flickering with time.
    const flame = 13 + Math.sin(state.elapsed * 34) * 4 + Math.random() * 3;
    context.fillStyle = '#ffb347';
    context.beginPath();
    context.moveTo(cx - 7, p.y + p.height - 4);
    context.lineTo(cx + 7, p.y + p.height - 4);
    context.lineTo(cx, p.y + p.height + flame);
    context.closePath();
    context.fill();
    // Hull: a sleek arrow, leaning with the steering tilt.
    context.save();
    context.translate(cx, cy);
    context.rotate(p.tilt * 0.18);
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(0, -p.height / 2 - 6);
    context.lineTo(p.width / 2, p.height / 2);
    context.lineTo(p.width / 4, p.height / 2 - 9);
    context.lineTo(-p.width / 4, p.height / 2 - 9);
    context.lineTo(-p.width / 2, p.height / 2);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.playerCore;
    context.beginPath();
    context.arc(0, -4, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
    if (p.shield) {
      context.strokeStyle = PALETTE.shield;
      context.globalAlpha = 0.75 + Math.sin(state.elapsed * 6) * 0.2;
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(cx, cy, 36, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
    context.globalAlpha = 1;
  }

  function drawEnemy(e) {
    context.save();
    context.translate(e.x, e.y);
    if (e.kind === KIND_DRONE) {
      context.rotate(Math.sin(e.age * 3) * 0.25);
      context.fillStyle = PALETTE.drone;
      context.beginPath();
      context.moveTo(0, e.radius);
      context.lineTo(e.radius, 0);
      context.lineTo(0, -e.radius);
      context.lineTo(-e.radius, 0);
      context.closePath();
      context.fill();
      context.fillStyle = '#ffe3ea';
      context.beginPath();
      context.arc(0, 0, 5, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === 1) {
      context.fillStyle = PALETTE.weaver;
      context.beginPath();
      context.arc(0, 0, e.radius - 4, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#ecd9ff';
      context.lineWidth = 2.5;
      const a = e.age * 3.2;
      context.beginPath();
      context.arc(Math.cos(a) * e.radius, Math.sin(a) * e.radius, 4.5, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.arc(Math.cos(a + Math.PI) * e.radius, Math.sin(a + Math.PI) * e.radius, 4.5, 0, Math.PI * 2);
      context.stroke();
    } else {
      // Brute: a heavy hexagon with a shrinking hull ring as it takes damage.
      context.rotate(e.age * 0.5);
      context.fillStyle = PALETTE.brute;
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        if (i === 0) context.moveTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
        else context.lineTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
      }
      context.closePath();
      context.fill();
      context.fillStyle = '#fff1dd';
      context.beginPath();
      context.arc(0, 0, 8, 0, Math.PI * 2);
      context.fill();
      context.rotate(-e.age * 0.5);
      context.strokeStyle = '#ffd9ae';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(0, 0, e.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.hp / e.maxHp));
      context.stroke();
    }
    context.restore();
    void KIND_BRUTE;
  }

  function drawPickup(p, elapsed) {
    const bob = Math.sin(elapsed * 5 + p.age * 3) * 3;
    context.save();
    context.translate(p.x, p.y + bob);
    if (p.kind === PICKUP_GEM) {
      context.rotate(elapsed * 2.4);
      context.fillStyle = PALETTE.gem;
      context.beginPath();
      context.moveTo(0, -13);
      context.lineTo(10, 0);
      context.lineTo(0, 13);
      context.lineTo(-10, 0);
      context.closePath();
      context.fill();
      context.fillStyle = '#dcffef';
      context.beginPath();
      context.moveTo(0, -6);
      context.lineTo(5, 0);
      context.lineTo(0, 6);
      context.lineTo(-5, 0);
      context.closePath();
      context.fill();
    } else if (p.kind === PICKUP_HEART) {
      context.fillStyle = PALETTE.heart;
      context.beginPath();
      context.arc(-6, -3, 7, Math.PI * 0.9, Math.PI * 2.05);
      context.arc(6, -3, 7, Math.PI * 0.95, Math.PI * 2.1);
      context.lineTo(0, 13);
      context.closePath();
      context.fill();
    } else {
      context.strokeStyle = PALETTE.shield;
      context.lineWidth = 3.5;
      context.beginPath();
      context.arc(0, 0, 13, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.shield;
      context.beginPath();
      context.arc(0, 0, 5, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawEntities(state) {
    for (const p of state.pickups) if (p.active) drawPickup(p, state.elapsed);
    for (const e of state.enemies) if (e.active) drawEnemy(e);
    // Bolts.
    context.fillStyle = PALETTE.bullet;
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.beginPath();
      context.ellipse(b.x, b.y, 3.5, 11, 0, 0, Math.PI * 2);
      context.fill();
    }
    drawShip(state);
    // Particles.
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // Floating score text.
    context.textBaseline = 'middle';
    for (const f of state.floaters) {
      if (!f.active) continue;
      context.globalAlpha = Math.min(1, f.life * 1.6);
      text(f.text, f.x, f.y, 19, PALETTE.gold, 'center', '700');
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, muted) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 30, PALETTE.text, 'left', '700');
    text(`${waveLabel(state.wave)} / ${WIN_WAVE}`, FIELD.width / 2, 18, 28, PALETTE.text, 'center', '700');
    // Hull hearts.
    for (let i = 0; i < MAX_LIVES; i += 1) {
      const x = FIELD.width - 30 - (MAX_LIVES - 1 - i) * 34;
      context.fillStyle = i < state.lives ? PALETTE.heart : 'rgba(255,255,255,0.14)';
      context.beginPath();
      context.arc(x, 30, 11, 0, Math.PI * 2);
      context.fill();
    }
    // Combo: multiplier and its draining window bar.
    if (state.multiplier > 1 || state.combo > 0) {
      text(`Combo ${comboLabel(state.multiplier)}`, 24, 56, 23, PALETTE.gold, 'left', '700');
      context.fillStyle = 'rgba(255,255,255,0.16)';
      context.fillRect(24, 88, 130, 7);
      context.fillStyle = PALETTE.gold;
      context.fillRect(24, 88, 130 * Math.max(0, state.comboTimer / COMBO.window), 7);
    }
    if (muted) text('Muted (M)', FIELD.width - 24, 60, 19, PALETTE.muted, 'right');
    if (state.intermission > 0 && !state.over) {
      context.textBaseline = 'middle';
      text(`Wave ${state.wave} cleared!`, FIELD.width / 2, 150, 36, PALETTE.gem, 'center', '800');
    } else if (state.elapsed < 4 && state.wave === 1 && state.kills === 0) {
      context.textBaseline = 'middle';
      text('Wave 1 — good hunting!', FIELD.width / 2, 150, 30, PALETTE.muted, 'center', '700');
    }
  }

  function drawPanel(title, titleColor, lines, prompt) {
    const width = 680;
    const height = 178 + lines.length * 36 + 84;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, y, width, height, 18);
    context.fill();
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 86, 54, titleColor, 'center', '800');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 140 + i * 36, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 25, PALETTE.gold, 'center', '700');
  }

  const TITLE_LINES = [
    'Blast the swarm. Catch the gems. Hold the tide line.',
    `Clear ${WIN_WAVE} waves to win — a breach or a touch costs 1 hull.`,
    'Move: ← ↑ ↓ → / WASD or mouse · Fire: hold Space / J or mouse',
    'Chain kills for combo multipliers · P pause · M mute',
    '',
  ];
  const PAUSED_LINES = ['The tide will wait for you.'];
  let overLines = ['', '', ''];

  /** Paint one frame: background, entities, then HUD or a panel for the screen. */
  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    let sx = 0;
    let sy = 0;
    if (state.shake > 0) {
      sx = (Math.random() * 2 - 1) * state.shake;
      sy = (Math.random() * 2 - 1) * state.shake;
    }
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawBackground(state);
    drawEntities(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = bestLabel(best);
      drawPanel('GEM TIDE', PALETTE.tide, TITLE_LINES, 'Press Space, Enter or click to launch');
      return;
    }
    drawHud(state, muted);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PALETTE.text, PAUSED_LINES, 'Press P or Space to resume');
    } else if (screen === SCREEN_OVER) {
      overLines = [
        state.won ? 'You cleared every wave. The reef is safe.' : 'The swarm broke the tide line.',
        `Score ${state.score} · Best ${Math.max(best, state.score)}`,
        `Waves cleared ${state.won ? WIN_WAVE : state.wave - 1} · Kills ${state.kills} · Gems ${state.gems} · Best chain ${state.bestCombo}`,
      ];
      drawPanel(state.won ? 'TIDE SAVED!' : 'GAME OVER', state.won ? PALETTE.gem : PALETTE.drone,
        overLines, 'Press Space, Enter or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
