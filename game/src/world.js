// Gem Tide's rules and state, with no drawing and no browser in it: the player's skimmer,
// its bolts, the falling swarm (drones, weavers and brutes), gems and power-ups, waves,
// the combo multiplier, particles and screen shake. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sound, announcements)
// without the world knowing about screens. Pools are allocated once, at boot.
//
// The goal: clear WIN_WAVE waves. An enemy that slips past the tide line, or touches the
// skimmer, costs a life (a shield absorbs one touch). Gems and kills feed the combo
// multiplier; taking a hit resets it.
import { COMBO, ENEMY, FIELD, GEM, LIVES, MAX_LIVES, PLAYER, POOL, WIN_WAVE } from './config.js';

export const KIND_DRONE = 0;
export const KIND_WEAVER = 1;
export const KIND_BRUTE = 2;

export const PICKUP_GEM = 0;
export const PICKUP_HEART = 1;
export const PICKUP_SHIELD = 2;

export const EVENT_SHOOT = 1;
export const EVENT_KILL = 2;
export const EVENT_GEM = 4;
export const EVENT_HIT = 8;
export const EVENT_OVER = 16;
export const EVENT_WAVE = 32;
export const EVENT_WIN = 64;
export const EVENT_POWER = 128;
export const EVENT_BREACH = 256;
export const EVENT_BRUTE_DOWN = 512;

function circleHitsRect(cx, cy, radius, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < radius * radius;
}

function makePool(size, make) {
  const items = [];
  for (let i = 0; i < size; i += 1) items.push(make());
  return items;
}

function freeOf(pool) {
  for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
  return null;
}

export function createWorld(random) {
  const player = {
    x: 0, y: 0, width: PLAYER.width, height: PLAYER.height,
    invulnerable: 0, fireTimer: 0, shield: false, tilt: 0,
  };
  const bullets = makePool(POOL.bullets, () => ({ active: false, x: 0, y: 0 }));
  const enemies = makePool(POOL.enemies, () => ({
    active: false, kind: KIND_DRONE, x: 0, y: 0, baseX: 0, radius: 20, hp: 1, maxHp: 1,
    speed: 0, phase: 0, age: 0,
  }));
  const pickups = makePool(POOL.pickups, () => ({ active: false, kind: PICKUP_GEM, x: 0, y: 0, age: 0 }));
  const particles = makePool(POOL.particles, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#ffffff',
  }));
  const floaters = makePool(POOL.floaters, () => ({ active: false, x: 0, y: 0, life: 0, text: '' }));

  const state = {
    player, bullets, enemies, pickups, particles, floaters,
    score: 0, lives: LIVES, wave: 1, elapsed: 0,
    combo: 0, comboTimer: 0, multiplier: 1, bestCombo: 0,
    kills: 0, gems: 0, shake: 0, won: false, over: false,
    toSpawn: 0, spawnTimer: 0, intermission: 0, spawnedInWave: 0,
  };

  function burst(x, y, color, count, speed, size) {
    for (let n = 0; n < count; n += 1) {
      const p = freeOf(particles);
      if (p === null) return;
      const angle = random() * Math.PI * 2;
      const v = (0.3 + random() * 0.7) * speed;
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = 0.35 + random() * 0.45;
      p.life = p.maxLife;
      p.size = 2 + random() * size;
      p.color = color;
    }
  }

  function floater(x, y, text) {
    const f = freeOf(floaters);
    if (f === null) return;
    f.active = true;
    f.x = x; f.y = y;
    f.life = 0.9;
    f.text = text;
  }

  function startWave() {
    state.toSpawn = 6 + state.wave * 3;
    state.spawnedInWave = 0;
    state.spawnTimer = 0.4;
    state.intermission = 0;
  }

  function reset() {
    player.x = (FIELD.width - player.width) / 2;
    player.y = FIELD.tideY - 86;
    player.invulnerable = 0;
    player.fireTimer = 0;
    player.shield = false;
    player.tilt = 0;
    for (const pool of [bullets, enemies, pickups, particles, floaters]) {
      for (const item of pool) item.active = false;
    }
    state.score = 0;
    state.lives = LIVES;
    state.wave = 1;
    state.elapsed = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.bestCombo = 0;
    state.kills = 0;
    state.gems = 0;
    state.shake = 0;
    state.won = false;
    state.over = false;
    startWave();
  }

  function spawnInterval() {
    return Math.max(ENEMY.spawnMin, ENEMY.spawnStart * ENEMY.spawnScale ** (state.wave - 1));
  }

  function spawnEnemy() {
    const e = freeOf(enemies);
    if (e === null) return;
    state.spawnedInWave += 1;
    const roll = random();
    let kind = KIND_DRONE;
    if (state.wave >= 3 && state.spawnedInWave % 7 === 0) kind = KIND_BRUTE;
    else if (state.wave >= 2 && roll < 0.32) kind = KIND_WEAVER;
    const spec = kind === KIND_DRONE ? ENEMY.drone : kind === KIND_WEAVER ? ENEMY.weaver : ENEMY.brute;
    e.active = true;
    e.kind = kind;
    e.radius = spec.radius;
    e.hp = spec.hp;
    e.maxHp = spec.hp;
    e.baseX = e.radius + random() * (FIELD.width - e.radius * 2);
    e.x = e.baseX;
    e.y = -e.radius;
    e.speed = spec.speed + ENEMY.speedPerWave * (state.wave - 1) + random() * 22;
    e.phase = random() * Math.PI * 2;
    e.age = 0;
  }

  function dropPickup(x, y, kind) {
    const p = freeOf(pickups);
    if (p === null) return;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.age = 0;
  }

  function addCombo() {
    state.combo += 1;
    state.comboTimer = COMBO.window;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.multiplier = Math.min(COMBO.maxMultiplier, 1 + Math.floor(state.combo / COMBO.step));
  }

  function loseCombo() {
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
  }

  function damagePlayer(events) {
    if (player.shield) {
      player.shield = false;
      player.invulnerable = PLAYER.invulnerable;
      burst(player.x + player.width / 2, player.y + player.height / 2, '#6bcbff', 14, 220, 3);
      floater(player.x + player.width / 2, player.y - 12, 'SHIELD DOWN');
      return events | EVENT_POWER;
    }
    state.lives -= 1;
    player.invulnerable = PLAYER.invulnerable;
    state.shake = Math.max(state.shake, 13);
    loseCombo();
    burst(player.x + player.width / 2, player.y + player.height / 2, '#37f4e4', 22, 280, 4);
    events |= EVENT_HIT;
    if (state.lives <= 0) {
      state.over = true;
      events |= EVENT_OVER;
    }
    return events;
  }

  /**
   * One fixed step. `move` is {x, y} in -1..1, `firing` holds the trigger, `pointer` is a
   * field position to steer toward (or null), and `harmless` runs the title backdrop:
   * the swarm drifts and fades at the tide line, nothing shoots, scores or hurts.
   */
  function step(dt, move, firing, pointer, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);

    // --- player ---
    if (pointer !== null && pointer !== undefined) {
      const cx = player.x + player.width / 2;
      const cy = player.y + player.height / 2;
      const dx = pointer.x - cx;
      const dy = pointer.y - 30 - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const v = Math.min(PLAYER.pointerSpeed * dt, dist);
        player.x += (dx / dist) * v;
        player.y += (dy / dist) * v;
      }
      player.tilt = Math.max(-1, Math.min(1, dx / 160));
    } else {
      player.x += move.x * PLAYER.speed * dt;
      player.y += move.y * PLAYER.speed * dt;
      player.tilt = move.x;
    }
    player.x = Math.max(6, Math.min(FIELD.width - player.width - 6, player.x));
    player.y = Math.max(FIELD.height * 0.42, Math.min(FIELD.tideY - player.height - 4, player.y));
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);

    // --- firing ---
    player.fireTimer -= dt;
    if (firing && !harmless && player.fireTimer <= 0) {
      const b = freeOf(bullets);
      if (b !== null) {
        b.active = true;
        b.x = player.x + player.width / 2;
        b.y = player.y - 8;
        player.fireTimer = PLAYER.fireInterval;
        events |= EVENT_SHOOT;
      } else {
        player.fireTimer = 0.05;
      }
    }

    // --- spawning / waves ---
    if (harmless) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy();
        state.spawnTimer = 0.7 + random() * 0.6;
      }
    } else if (state.toSpawn > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy();
        state.toSpawn -= 1;
        state.spawnTimer = spawnInterval() * (0.7 + random() * 0.6);
      }
    } else if (!enemies.some((e) => e.active)) {
      // Wave cleared: a breather, then the next wave — or the win.
      state.intermission += dt;
      if (state.intermission > 2.2) {
        if (state.wave >= WIN_WAVE) {
          state.won = true;
          state.over = true;
          events |= EVENT_WIN | EVENT_OVER;
        } else {
          state.wave += 1;
          startWave();
          events |= EVENT_WAVE;
        }
      }
    }

    // --- combo timer ---
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) loseCombo();
    }

    // --- bullets ---
    for (const b of bullets) {
      if (!b.active) continue;
      b.y -= PLAYER.bulletSpeed * dt;
      if (b.y < -24) {
        b.active = false;
        continue;
      }
      for (const e of enemies) {
        if (!e.active) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (dx * dx + dy * dy < (e.radius + 7) * (e.radius + 7)) {
          b.active = false;
          e.hp -= 1;
          burst(b.x, b.y, '#8ff7ff', 3, 140, 2);
          if (e.hp <= 0) {
            e.active = false;
            const spec = e.kind === KIND_DRONE ? ENEMY.drone : e.kind === KIND_WEAVER ? ENEMY.weaver : ENEMY.brute;
            addCombo();
            const gained = spec.points * state.multiplier;
            state.score += gained;
            state.kills += 1;
            burst(e.x, e.y, e.kind === KIND_DRONE ? '#ff5470' : e.kind === KIND_WEAVER ? '#c77dff' : '#ff9f43',
              e.kind === KIND_BRUTE ? 30 : 16, e.kind === KIND_BRUTE ? 320 : 240, 4);
            floater(e.x, e.y, `+${gained}`);
            events |= EVENT_KILL;
            if (e.kind === KIND_BRUTE) {
              state.shake = Math.max(state.shake, 9);
              events |= EVENT_BRUTE_DOWN;
              dropPickup(e.x, e.y, random() < 0.5 ? PICKUP_SHIELD : PICKUP_HEART);
            } else if (random() < GEM.chance) {
              dropPickup(e.x, e.y, PICKUP_GEM);
            }
          }
          break;
        }
      }
    }

    // --- enemies ---
    for (const e of enemies) {
      if (!e.active) continue;
      e.age += dt;
      e.y += e.speed * dt;
      if (e.kind === KIND_WEAVER) {
        e.x = e.baseX + Math.sin(e.age * ENEMY.weaver.swayRate + e.phase) * ENEMY.weaver.sway;
        e.x = Math.max(e.radius, Math.min(FIELD.width - e.radius, e.x));
      }
      if (e.y - e.radius > FIELD.tideY) {
        e.active = false;
        if (!harmless) {
          state.lives -= 1;
          state.shake = Math.max(state.shake, 10);
          loseCombo();
          burst(e.x, FIELD.tideY, '#ff5470', 16, 240, 4);
          floater(e.x, FIELD.tideY - 26, 'BREACH!');
          events |= EVENT_BREACH;
          if (state.lives <= 0) {
            state.over = true;
            events |= EVENT_OVER;
          }
        }
        continue;
      }
      if (!harmless && player.invulnerable === 0 && circleHitsRect(e.x, e.y, e.radius - 4, player)) {
        e.active = false;
        burst(e.x, e.y, '#ff5470', 16, 240, 4);
        events = damagePlayer(events);
        if (state.over) break;
      }
    }

    // --- pickups ---
    for (const p of pickups) {
      if (!p.active) continue;
      p.age += dt;
      p.y += GEM.fall * dt;
      // A gentle magnet: nearby pickups drift toward the skimmer.
      if (!harmless) {
        const cx = player.x + player.width / 2;
        const cy = player.y + player.height / 2;
        const dx = cx - p.x;
        const dy = cy - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 130 * 130 && d2 > 1) {
          const d = Math.sqrt(d2);
          p.x += (dx / d) * 190 * dt;
          p.y += (dy / d) * 190 * dt;
        }
        if (circleHitsRect(p.x, p.y, GEM.radius + 6, player)) {
          p.active = false;
          if (p.kind === PICKUP_GEM) {
            addCombo();
            const gained = GEM.points * state.multiplier;
            state.score += gained;
            state.gems += 1;
            floater(p.x, p.y - 10, `+${gained}`);
            burst(p.x, p.y, '#3dff9e', 8, 160, 3);
            events |= EVENT_GEM;
          } else if (p.kind === PICKUP_HEART) {
            if (state.lives < MAX_LIVES) {
              state.lives += 1;
              floater(p.x, p.y - 10, '+1 HULL');
            } else {
              state.score += 250;
              floater(p.x, p.y - 10, '+250');
            }
            burst(p.x, p.y, '#ff6b9d', 12, 180, 3);
            events |= EVENT_POWER;
          } else {
            player.shield = true;
            floater(p.x, p.y - 10, 'SHIELD UP');
            burst(p.x, p.y, '#6bcbff', 12, 180, 3);
            events |= EVENT_POWER;
          }
          continue;
        }
      }
      if (p.y > FIELD.tideY + 20) p.active = false;
    }

    // --- particles & floaters (visual, but stepped here so shots are deterministic) ---
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    for (const f of floaters) {
      if (!f.active) continue;
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) f.active = false;
    }

    return events;
  }

  reset();
  return { state, reset, step };
}
