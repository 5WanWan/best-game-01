// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, upgrade, paused, victory and game over.
//
// ?seed=N fixes the spawn pattern. ?shot=title|play|boss|victory|gameover
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BOSS, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_SHARD, EVENT_UPGRADE, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, restartButtonAt, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_VICTORY, upgradeCardAt } from './render.js';
import { stageShot, autopilot as autopilotInput } from './shots.js';

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
const audio = createAudio();

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
    // A fixed clock keeps the staged frame identical every run.
    renderer.draw(world.state, scene.screen, scene.best, false, 4.2);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let prevMouseDown = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Playing. Wave 1 of 10. ${world.state.player.maxHp} hearts.`);
  }

  function endGame(victory) {
    screen = victory ? SCREEN_VICTORY : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (victory) audio.victory();
    else audio.gameOver();
    announce(victory
      ? `Victory! Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function playSounds(events) {
    if (events & EVENT_KILL) audio.enemyDie();
    if (events & EVENT_HIT) audio.hurt();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_SHARD) audio.shard();
    if (events & EVENT_WAVE_CLEAR) audio.waveClear();
    if (events & EVENT_BOSS) audio.bossRoar();
    if (events & EVENT_UPGRADE) audio.upgrade();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Attract mode: the world plays itself behind the title. A cleared wave
      // picks its blessing at once, and a lost run starts over, so the
      // backdrop never freezes.
      if (world.state.phase === 'upgrade' && world.state.choices.length > 0) {
        world.applyUpgrade(world.state.choices[0].id);
      } else if (world.state.phase === 'gameover') {
        world.reset();
      } else {
        world.step(STEP, autopilotInput(world.state));
      }
      return;
    }
    const mouse = input.mouse;
    const aim = renderer.toLogical(mouse.x, mouse.y);
    const events = world.step(STEP, {
      move: input.direction(),
      aimX: aim.x,
      aimY: aim.y,
      firing: input.firing,
    });
    if (world.state.phase === 'upgrade' && screen === SCREEN_PLAY) {
      screen = SCREEN_UPGRADE;
      announce(`Wave ${world.state.wave} clear. Choose a blessing: 1, 2 or 3.`);
    }
    playSounds(events);
  }

  function handleClicks() {
    const mouse = input.mouse;
    const clicked = mouse.down && !prevMouseDown;
    prevMouseDown = mouse.down;
    if (!clicked) return;
    audio.unlock();
    const aim = renderer.toLogical(mouse.x, mouse.y);
    if (screen === SCREEN_TITLE) {
      startGame();
    } else if (screen === SCREEN_UPGRADE) {
      const card = upgradeCardAt(aim.x, aim.y);
      if (card >= 0 && world.state.choices[card]) {
        world.applyUpgrade(world.state.choices[card].id);
        screen = SCREEN_PLAY;
        announce(`Wave ${world.state.wave}.`);
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      if (restartButtonAt(aim.x, aim.y)) startGame();
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const choice = input.takeChoice();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_UPGRADE) {
      if (choice >= 0 && choice < world.state.choices.length) {
        world.applyUpgrade(world.state.choices[choice].id);
        screen = SCREEN_PLAY;
        announce(`Wave ${world.state.wave}.`);
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      if (actions & ACTION_CONFIRM) startGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handleClicks();
    if (screen === SCREEN_PAUSED) {
      accumulator = 0;
    } else if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      // The upgrade / pause / end screens still let the world breathe.
      while (accumulator >= STEP) {
        world.step(STEP, { move: { x: 0, y: 0 }, aimX: 0, aimY: 0, firing: false });
        accumulator -= STEP;
      }
    }
    renderer.draw(world.state, screen, best, audio.muted, now / 1000);
  }

  // Leaving the tab pauses a running game rather than letting shades hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  world.reset();
  screen = SCREEN_TITLE;
  announce('Emberward. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
