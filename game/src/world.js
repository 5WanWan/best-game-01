// The simulation: player, enemies, bullets, pickups, waves and scoring. It
// knows nothing about the canvas or the DOM; main.js feeds it input each fixed
// step and render.js paints the state it leaves behind.
import { ARENA, ENEMY, MAX_ALIVE, PLAYER, SCORE, STEP, TOTAL_WAVES, UPGRADES, VIEW, WAVES } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_PICKUP = 4;
export const EVENT_SHARD = 8;
export const EVENT_WAVE_CLEAR = 16;
export const EVENT_WIN = 32;
export const EVENT_OVER = 64;
export const EVENT_BOSS = 128;
export const EVENT_UPGRADE = 256;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const state = {
    phase: 'fight',
    wave: 0,
    score: 0,
    kills: 0,
    shards: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    time: 0,
    waveTime: 0,
    player: null,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    particles: [],
    floaters: [],
    spawnQueue: [],
    spawnTimer: 0,
    banner: '',
    bannerTimer: 0,
    shake: 0,
    choices: [],
    takenUpgrades: {},
    boss: null,
    stats: { shots: 0, hits: 0 },
  };

  function freshPlayer() {
    return {
      x: VIEW.width / 2,
      y: VIEW.height / 2 + 80,
      radius: PLAYER.radius,
      speed: PLAYER.speed,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      fireInterval: PLAYER.fireInterval,
      damage: PLAYER.bulletDamage,
      multishot: 0,
      pierce: 0,
      magnetRadius: PLAYER.magnetRadius,
      fireCooldown: 0,
      invuln: 0,
      aim: -Math.PI / 2,
      shield: false,
      hasAegis: false,
      overdriveBonus: 0,
      overdrive: 0,
    };
  }

  function spawnPosition() {
    // Enter from a random arena edge, away from the player.
    const side = random.int(0, 3);
    const margin = 30;
    let x;
    let y;
    if (side === 0) { x = random.range(ARENA.x + margin, ARENA.x + ARENA.width - margin); y = ARENA.y + margin; }
    else if (side === 1) { x = random.range(ARENA.x + margin, ARENA.x + ARENA.width - margin); y = ARENA.y + ARENA.height - margin; }
    else if (side === 2) { x = ARENA.x + margin; y = random.range(ARENA.y + margin, ARENA.y + ARENA.height - margin); }
    else { x = ARENA.x + ARENA.width - margin; y = random.range(ARENA.y + margin, ARENA.y + ARENA.height - margin); }
    return { x, y };
  }

  function makeEnemy(type, elite) {
    const def = ENEMY[type];
    const pos = spawnPosition();
    const waveScale = 1 + (state.wave - 1) * 0.09;
    const enemy = {
      type,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      hp: def.hp * waveScale * (elite ? 2.4 : 1) * (type === 'boss' ? (state.wave >= 10 ? 1.6 : 1) : 1),
      maxHp: 0,
      radius: def.radius * (elite ? 1.35 : 1),
      speed: def.speed * random.range(0.9, 1.1) * (elite ? 1.1 : 1),
      damage: def.damage,
      score: def.score * (elite ? 2 : 1),
      color: def.color,
      elite: Boolean(elite),
      wobble: random.range(0, TAU),
      shootTimer: random.range(1.2, 2.4),
      burstTimer: 4,
      summonTimer: 8,
      angle: 0,
      flash: 0,
    };
    enemy.maxHp = enemy.hp;
    return enemy;
  }

  function buildWaveQueue(wave) {
    const def = WAVES[wave - 1];
    const queue = [];
    for (let i = 0; i < def.wisps; i += 1) queue.push({ type: 'wisp', elite: random.next() < 0.08 });
    for (let i = 0; i < def.spitters; i += 1) queue.push({ type: 'spitter', elite: random.next() < 0.08 });
    for (let i = 0; i < def.hulks; i += 1) queue.push({ type: 'hulk', elite: random.next() < 0.06 });
    // Shuffle the queue so the wave never arrives in one predictable clump.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random.next() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    if (def.boss) queue.unshift({ type: 'boss', elite: false });
    return queue;
  }

  function burstParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random.range(0, TAU);
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: random.range(0.3, 0.7),
        maxLife: 0.7,
        radius: random.range(2, 4.5),
        color,
      });
    }
  }

  function addFloater(x, y, text, color) {
    state.floaters.push({ x, y, text, color: color ?? '#ffe9a8', life: 0.9 });
  }

  function dropPickup(x, y, kind) {
    state.pickups.push({ x, y, kind, vx: random.range(-40, 40), vy: random.range(-40, 40), life: 12 });
  }

  function rollDrops(enemy) {
    const roll = random.next();
    if (enemy.type === 'boss') {
      dropPickup(enemy.x - 20, enemy.y, 'heart');
      dropPickup(enemy.x + 20, enemy.y, 'overdrive');
      for (let i = 0; i < 5; i += 1) dropPickup(enemy.x + random.range(-50, 50), enemy.y + random.range(-50, 50), 'shard');
      return;
    }
    if (roll < 0.55) dropPickup(enemy.x, enemy.y, 'shard');
    else if (roll < 0.59 && state.player.hp < state.player.maxHp) dropPickup(enemy.x, enemy.y, 'heart');
    else if (roll < 0.62) dropPickup(enemy.x, enemy.y, 'overdrive');
  }

  function killEnemy(index, events) {
    const enemy = state.enemies[index];
    state.enemies.splice(index, 1);
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = 2;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const multiplier = 1 + Math.min(state.combo, 20) * 0.1;
    const points = Math.round(enemy.score * multiplier);
    state.score += points;
    addFloater(enemy.x, enemy.y - enemy.radius, `+${points}`, enemy.type === 'boss' ? '#ffd166' : '#ffe9a8');
    burstParticles(enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 60 : 16, enemy.type === 'boss' ? 320 : 200);
    state.shake = Math.max(state.shake, enemy.type === 'boss' ? 14 : 5);
    rollDrops(enemy);
    if (enemy.type === 'hulk') {
      for (let i = 0; i < 2; i += 1) {
        const wisp = makeEnemy('wisp', false);
        wisp.x = enemy.x + random.range(-24, 24);
        wisp.y = enemy.y + random.range(-24, 24);
        wisp.hp = 1;
        wisp.maxHp = 1;
        state.enemies.push(wisp);
      }
    }
    if (enemy.type === 'boss') {
      state.boss = null;
      return events | EVENT_KILL | EVENT_BOSS;
    }
    return events | EVENT_KILL;
  }

  function hurtPlayer(damage) {
    const p = state.player;
    if (p.invuln > 0 || state.phase !== 'fight') return EVENT_NONE;
    if (p.shield) {
      p.shield = false;
      p.invuln = 1.1;
      burstParticles(p.x, p.y, '#9fd8ff', 18, 220);
      addFloater(p.x, p.y - 24, 'WARD HELD', '#9fd8ff');
      return EVENT_HIT;
    }
    p.hp -= damage;
    p.invuln = PLAYER.invulnSeconds;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = Math.max(state.shake, 10);
    burstParticles(p.x, p.y, '#ff5d5d', 22, 260);
    if (p.hp <= 0) {
      state.phase = 'gameover';
      burstParticles(p.x, p.y, '#ffd166', 50, 320);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function startWave(wave) {
    state.wave = wave;
    state.waveTime = 0;
    state.spawnQueue = buildWaveQueue(wave);
    state.spawnTimer = 0.4;
    state.phase = 'fight';
    state.banner = WAVES[wave - 1].boss ? `WAVE ${wave} — THE GLOOM HERALD` : `WAVE ${wave}`;
    state.bannerTimer = 2.2;
    if (state.player.hasAegis) state.player.shield = true;
    if (WAVES[wave - 1].boss) return EVENT_BOSS;
    return EVENT_NONE;
  }

  function offerUpgrades() {
    const available = UPGRADES.filter((u) => (state.takenUpgrades[u.id] ?? 0) < u.max);
    const pool = [...available];
    const choices = [];
    while (choices.length < 3 && pool.length > 0) {
      const index = Math.floor(random.next() * pool.length);
      choices.push(pool.splice(index, 1)[0]);
    }
    state.choices = choices;
    state.phase = 'upgrade';
    return choices;
  }

  function applyUpgrade(id) {
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade || state.phase !== 'upgrade') return EVENT_NONE;
    if (!state.choices.some((c) => c.id === id)) return EVENT_NONE;
    upgrade.apply(state.player);
    state.takenUpgrades[id] = (state.takenUpgrades[id] ?? 0) + 1;
    state.choices = [];
    state.score += 25;
    const events = startWave(state.wave + 1);
    return events | EVENT_UPGRADE;
  }

  function fireBullets() {
    const p = state.player;
    const spread = 0.14;
    const count = 1 + p.multishot;
    const base = p.aim;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * spread;
      const angle = base + offset;
      state.bullets.push({
        x: p.x + Math.cos(angle) * (p.radius + 8),
        y: p.y + Math.sin(angle) * (p.radius + 8),
        vx: Math.cos(angle) * PLAYER.bulletSpeed * (p.overdrive > 0 ? 1.25 : 1),
        vy: Math.sin(angle) * PLAYER.bulletSpeed * (p.overdrive > 0 ? 1.25 : 1),
        radius: PLAYER.bulletRadius,
        damage: p.damage,
        pierce: p.pierce,
        life: 1.4,
      });
    }
    state.stats.shots += count;
  }

  function stepFight(dt, input) {
    let events = EVENT_NONE;
    const p = state.player;
    state.time += dt;
    state.waveTime += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (p.invuln > 0) p.invuln -= dt;
    if (p.overdrive > 0) p.overdrive -= dt;
    if (p.fireCooldown > 0) p.fireCooldown -= dt;

    // Movement, clamped inside the arena.
    p.x = clamp(p.x + input.move.x * p.speed * dt, ARENA.x + p.radius, ARENA.x + ARENA.width - p.radius);
    p.y = clamp(p.y + input.move.y * p.speed * dt, ARENA.y + p.radius, ARENA.y + ARENA.height - p.radius);
    if (input.aimX !== null && input.aimY !== null) p.aim = Math.atan2(input.aimY - p.y, input.aimX - p.x);

    if (input.firing && p.fireCooldown <= 0) {
      fireBullets();
      p.fireCooldown = p.fireInterval * (p.overdrive > 0 ? 0.5 : 1);
    }

    // Spawning from the queue, one at a time, capped alive.
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.enemies.length < MAX_ALIVE) {
        const next = state.spawnQueue.shift();
        const enemy = makeEnemy(next.type, next.elite);
        state.enemies.push(enemy);
        if (next.type === 'boss') {
          state.boss = enemy;
          events |= EVENT_BOSS;
        }
        state.spawnTimer = Math.max(0.22, 0.55 - state.wave * 0.03);
      }
    }

    // Enemies.
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      if (e.flash > 0) e.flash -= dt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.wobble += dt * 2;
      if (e.type === 'wisp') {
        const wob = Math.sin(e.wobble) * 0.5;
        const ax = (dx / d) * Math.cos(wob) - (dy / d) * Math.sin(wob);
        const ay = (dx / d) * Math.sin(wob) + (dy / d) * Math.cos(wob);
        e.x += ax * e.speed * dt;
        e.y += ay * e.speed * dt;
      } else if (e.type === 'spitter') {
        const want = 250;
        const toward = d < want - 30 ? -1 : d > want + 30 ? 1 : 0;
        const strafe = Math.sin(e.wobble * 0.7);
        e.x += ((dx / d) * toward * e.speed + (-dy / d) * strafe * e.speed * 0.6) * dt;
        e.y += ((dy / d) * toward * e.speed + (dx / d) * strafe * e.speed * 0.6) * dt;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 520) {
          e.shootTimer = random.range(1.9, 2.6);
          const a = Math.atan2(dy, dx);
          state.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, radius: 6, damage: 1, life: 4 });
        }
      } else if (e.type === 'hulk') {
        e.x += (dx / d) * e.speed * dt;
        e.y += (dy / d) * e.speed * dt;
      } else if (e.type === 'boss') {
        const enraged = e.hp < e.maxHp * 0.5;
        const speed = e.speed * (enraged ? 1.5 : 1);
        e.x += (dx / d) * speed * dt;
        e.y += (dy / d) * speed * dt;
        e.burstTimer -= dt;
        if (e.burstTimer <= 0) {
          e.burstTimer = enraged ? 3.4 : 4.6;
          const shots = enraged ? 12 : 8;
          for (let k = 0; k < shots; k += 1) {
            const a = (k / shots) * TAU + e.angle;
            state.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, radius: 6, damage: 1, life: 5 });
          }
          e.angle += 0.35;
        }
        e.summonTimer -= dt;
        if (e.summonTimer <= 0) {
          e.summonTimer = 11;
          for (let k = 0; k < 3; k += 1) {
            const wisp = makeEnemy('wisp', false);
            wisp.x = clamp(e.x + random.range(-90, 90), ARENA.x + 20, ARENA.x + ARENA.width - 20);
            wisp.y = clamp(e.y + random.range(-90, 90), ARENA.y + 20, ARENA.y + ARENA.height - 20);
            state.enemies.push(wisp);
          }
        }
      }
      e.x = clamp(e.x, ARENA.x + e.radius, ARENA.x + ARENA.width - e.radius);
      e.y = clamp(e.y, ARENA.y + e.radius, ARENA.y + ARENA.height - e.radius);

      // Touching the player hurts.
      if (dist2(e.x, e.y, p.x, p.y) < (e.radius + p.radius) * (e.radius + p.radius)) {
        events |= hurtPlayer(e.damage);
        // Knock the enemy back a little so one touch is not a chain of hits.
        e.x -= (dx / d) * 26;
        e.y -= (dy / d) * 26;
        if (state.phase !== 'fight') return events;
      }
    }

    // Player bullets.
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < ARENA.x - 20 || b.x > ARENA.x + ARENA.width + 20 || b.y < ARENA.y - 20 || b.y > ARENA.y + ARENA.height + 20;
      if (!dead) {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const e = state.enemies[j];
          if (dist2(b.x, b.y, e.x, e.y) < (e.radius + b.radius) * (e.radius + b.radius)) {
            e.hp -= b.damage;
            e.flash = 0.09;
            // One bullet counts as one connecting shot, however many shades
            // it pierces through, so accuracy stays a real percentage.
            if (!b.connected) {
              b.connected = true;
              state.stats.hits += 1;
            }
            burstParticles(b.x, b.y, '#ffd166', 4, 140);
            if (e.hp <= 0) {
              events |= killEnemy(j, EVENT_NONE);
              if (state.phase !== 'fight') return events;
            }
            if (b.pierce > 0) {
              b.pierce -= 1;
            } else {
              dead = true;
            }
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }

    // Enemy bullets.
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = state.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < ARENA.x - 10 || b.x > ARENA.x + ARENA.width + 10 || b.y < ARENA.y - 10 || b.y > ARENA.y + ARENA.height + 10;
      if (!dead && dist2(b.x, b.y, p.x, p.y) < (b.radius + p.radius) * (b.radius + p.radius)) {
        events |= hurtPlayer(b.damage);
        dead = true;
        if (state.phase !== 'fight') return events;
      }
      if (dead) state.enemyBullets.splice(i, 1);
    }

    // Pickups drift, then get magnetised, then collected.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      pk.life -= dt;
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      pk.vx *= 0.98;
      pk.vy *= 0.98;
      pk.x = clamp(pk.x, ARENA.x + 10, ARENA.x + ARENA.width - 10);
      pk.y = clamp(pk.y, ARENA.y + 10, ARENA.y + ARENA.height - 10);
      const d2 = dist2(pk.x, pk.y, p.x, p.y);
      if (d2 < p.magnetRadius * p.magnetRadius) {
        const d = Math.sqrt(d2) || 1;
        const pull = 420 * dt;
        pk.x += ((p.x - pk.x) / d) * pull;
        pk.y += ((p.y - pk.y) / d) * pull;
      }
      if (d2 < 26 * 26) {
        if (pk.kind === 'shard') {
          state.score += SCORE.shard;
          state.shards += 1;
          addFloater(pk.x, pk.y - 12, `+${SCORE.shard}`, '#7fe0ff');
          events |= EVENT_SHARD;
        } else if (pk.kind === 'heart') {
          p.hp = Math.min(p.maxHp, p.hp + 1);
          addFloater(pk.x, pk.y - 12, '+1 ♥', '#ff8fa3');
          events |= EVENT_PICKUP;
        } else if (pk.kind === 'overdrive') {
          p.overdrive = 6 * (1 + p.overdriveBonus);
          addFloater(pk.x, pk.y - 12, 'OVERDRIVE!', '#ffd166');
          events |= EVENT_PICKUP;
        }
        state.pickups.splice(i, 1);
      } else if (pk.life <= 0) {
        state.pickups.splice(i, 1);
      }
    }

    // Particles and floaters fade.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);

    // Wave cleared: nothing left to spawn and nothing alive.
    if (state.spawnQueue.length === 0 && state.enemies.length === 0 && state.phase === 'fight') {
      const bonus = SCORE.waveBonus * state.wave;
      state.score += bonus;
      addFloater(p.x, p.y - 30, `WAVE BONUS +${bonus}`, '#ffd166');
      events |= EVENT_WAVE_CLEAR;
      if (state.wave >= TOTAL_WAVES) {
        state.phase = 'victory';
        events |= EVENT_WIN;
      } else {
        offerUpgrades();
      }
    }
    return events;
  }

  return {
    state,
    reset() {
      state.phase = 'fight';
      state.wave = 0;
      state.score = 0;
      state.kills = 0;
      state.shards = 0;
      state.combo = 0;
      state.comboTimer = 0;
      state.bestCombo = 0;
      state.time = 0;
      state.waveTime = 0;
      state.player = freshPlayer();
      state.enemies = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.pickups = [];
      state.particles = [];
      state.floaters = [];
      state.spawnQueue = [];
      state.spawnTimer = 0;
      state.banner = '';
      state.bannerTimer = 0;
      state.shake = 0;
      state.choices = [];
      state.takenUpgrades = {};
      state.boss = null;
      state.stats = { shots: 0, hits: 0 };
      startWave(1);
    },
    startWave,
    applyUpgrade,
    offerUpgrades,
    // Screenshot staging only: rebuild a legal mid-run state — a fresh player
    // carrying the named upgrades (each applied through the same upgrade
    // definitions real play uses), a plausible score, then the named wave.
    // The state is one a real run could reach; the wave itself still plays
    // out under the normal rules.
    stageAtWave(wave, upgradeIds) {
      state.player = freshPlayer();
      state.takenUpgrades = {};
      for (const id of upgradeIds) {
        const upgrade = UPGRADES.find((u) => u.id === id);
        if (!upgrade) continue;
        if ((state.takenUpgrades[id] ?? 0) >= upgrade.max) continue;
        upgrade.apply(state.player);
        state.takenUpgrades[id] = (state.takenUpgrades[id] ?? 0) + 1;
      }
      state.score = 1200 * (wave - 1);
      state.kills = 12 * (wave - 1);
      state.time = 45 * (wave - 1);
      state.enemies = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.pickups = [];
      state.particles = [];
      state.floaters = [];
      state.spawnQueue = [];
      state.combo = 0;
      state.comboTimer = 0;
      state.boss = null;
      startWave(wave);
    },
    step(dt, input) {
      if (state.phase === 'fight') return stepFight(dt, input);
      // Between waves and on end screens the world still breathes: particles
      // fade and the banner ticks down, but nothing spawns or fights.
      if (state.bannerTimer > 0) state.bannerTimer -= dt;
      for (let i = state.particles.length - 1; i >= 0; i -= 1) {
        const pt = state.particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        if (pt.life <= 0) state.particles.splice(i, 1);
      }
      for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
        const f = state.floaters[i];
        f.y -= 34 * dt;
        f.life -= dt;
        if (f.life <= 0) state.floaters.splice(i, 1);
      }
      if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
      return EVENT_NONE;
    },
  };
}
