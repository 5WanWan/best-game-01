// Deterministic screenshot scenes behind ?shot=title|play|boss|victory|gameover.
// Each one plays the real rules forward from a fresh world for a fixed number
// of steps, steered by a simple autopilot (keep clear of shades, chase shards,
// shoot the nearest shade), so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const SAMPLE = STEP;

// Upgrade picks for the autopilot, best first: damage and extra bullets win
// waves; hearts only when hurt.
const PICK_ORDER = ['twin-shot', 'ember-rounds', 'swift-trigger', 'piercing-light', 'heart-vessel', 'wind-boots', 'magnet-charm', 'aegis-ward', 'overdrive-core'];

function nearestEnemy(state) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
    const score = e.type === 'boss' ? d * 0.2 : d;
    if (score < bestD) {
      bestD = score;
      best = e;
    }
  }
  return best;
}

export function autopilot(state) {
  const p = state.player;
  let mx = 0;
  let my = 0;
  // Flee the nearest shade inside 150 px (220 for the boss: its touch hurts).
  for (const e of state.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const range = e.type === 'boss' ? 220 : 150;
    if (d < range) {
      const w = (range - d) / range;
      mx += (dx / d) * w;
      my += (dy / d) * w;
    }
  }
  // Dodge enemy bullets inside 90 px.
  for (const b of state.enemyBullets) {
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 90) {
      const w = (90 - d) / 90;
      mx += (dx / d) * w;
      my += (dy / d) * w;
    }
  }
  // Drift toward the nearest shard when nothing is close.
  if (mx === 0 && my === 0) {
    let shard = null;
    let bestD = Infinity;
    for (const pk of state.pickups) {
      const d = (pk.x - p.x) * (pk.x - p.x) + (pk.y - p.y) * (pk.y - p.y);
      if (d < bestD) {
        bestD = d;
        shard = pk;
      }
    }
    if (shard && bestD < 220 * 220) {
      mx = (shard.x - p.x) / 220;
      my = (shard.y - p.y) / 220;
    } else {
      // Hold near the centre, circling slowly.
      mx = (480 - p.x) / 480 + 0.25;
      my = (300 - p.y) / 480;
    }
  }
  const len = Math.hypot(mx, my) || 1;
  const target = nearestEnemy(state);
  return {
    move: { x: mx / len, y: my / len },
    aimX: target ? target.x : p.x,
    aimY: target ? target.y : p.y - 100,
    firing: true,
  };
}

function idleInput(state) {
  return { move: { x: 0, y: 0 }, aimX: state.player.x, aimY: state.player.y - 100, firing: false };
}

function chooseUpgrade(world) {
  const state = world.state;
  if (state.phase !== 'upgrade') return;
  for (const id of PICK_ORDER) {
    if (state.choices.some((c) => c.id === id)) {
      world.applyUpgrade(id);
      return;
    }
  }
  if (state.choices.length > 0) world.applyUpgrade(state.choices[0].id);
}

// Step the world forward with the autopilot until `stop(state)` is true or
// the step budget runs out; upgrade choices are taken automatically.
function playForward(world, maxSteps, stop) {
  const state = world.state;
  let steps = 0;
  while (steps < maxSteps) {
    if (state.phase === 'upgrade') chooseUpgrade(world);
    if (stop(state)) break;
    const input = state.phase === 'fight' ? autopilot(state) : idleInput(state);
    world.step(STEP, input);
    steps += 1;
    if (state.phase === 'victory' || state.phase === 'gameover') break;
  }
  return state;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.reset();
    world.stageAtWave(3, ['twin-shot', 'ember-rounds', 'swift-trigger']);
    playForward(world, 60 * 16, () => world.state.waveTime > 12);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    world.reset();
    // A modest loadout, so the fight is still raging when the frame is taken;
    // extra hearts and a ward so the staging survives the opening salvo.
    world.stageAtWave(10, ['twin-shot', 'ember-rounds', 'swift-trigger', 'heart-vessel', 'heart-vessel', 'aegis-ward']);
    playForward(world, 60 * 30, (s) => s.waveTime > 10 && s.boss !== null && s.boss.hp < s.boss.maxHp);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'victory') {
    world.reset();
    world.stageAtWave(10, ['twin-shot', 'twin-shot', 'twin-shot', 'ember-rounds', 'ember-rounds', 'ember-rounds', 'swift-trigger', 'swift-trigger', 'piercing-light', 'piercing-light', 'heart-vessel', 'wind-boots']);
    playForward(world, 60 * 240, (s) => s.phase === 'victory');
    return { screen: world.state.phase === 'victory' ? SCREEN_VICTORY : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'gameover') {
    // A hurried player who stands still: the shades close in fast.
    world.reset();
    let steps = 0;
    while (steps < 60 * 120 && world.state.phase !== 'gameover') {
      world.step(STEP, idleInput(world.state));
      steps += 1;
    }
    return { screen: world.state.phase === 'gameover' ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  // Title: the game plays itself behind the title for a few seconds.
  world.reset();
  playForward(world, 60 * 6, () => false);
  return { screen: SCREEN_TITLE, best: 0 };
}
