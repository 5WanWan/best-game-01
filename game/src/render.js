// Everything the player sees: the arena, the creatures, the HUD and every
// screen (title, upgrade, pause, victory, game over), all painted on one
// canvas in the game's own palette. The canvas fills the window; the game
// itself is drawn in a fixed 960x600 logical space, letterboxed.
import { ARENA, TOTAL_WAVES, VIEW } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const CARD = { width: 240, height: 190, gap: 24, y: 250 };
const BUTTON = { width: 300, height: 56 };

function cardRect(index) {
  const total = CARD.width * 3 + CARD.gap * 2;
  const x0 = (VIEW.width - total) / 2;
  return { x: x0 + index * (CARD.width + CARD.gap), y: CARD.y, width: CARD.width, height: CARD.height };
}

function buttonRect() {
  return { x: (VIEW.width - BUTTON.width) / 2, y: 452, width: BUTTON.width, height: BUTTON.height };
}

export function upgradeCardAt(x, y) {
  for (let i = 0; i < 3; i += 1) {
    const r = cardRect(i);
    if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return i;
  }
  return -1;
}

export function restartButtonAt(x, y) {
  const r = buttonRect();
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
}

function heartPath(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.9);
  ctx.bezierCurveTo(x - size * 1.2, y + size * 0.1, x - size * 0.6, y - size * 0.9, x, y - size * 0.25);
  ctx.bezierCurveTo(x + size * 0.6, y - size * 0.9, x + size * 1.2, y + size * 0.1, x, y + size * 0.9);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let stars = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    scale = Math.min(w / VIEW.width, h / VIEW.height) * dpr;
    offsetX = (canvas.width - VIEW.width * scale) / 2;
    offsetY = (canvas.height - VIEW.height * scale) / 2;
    if (stars.length === 0) {
      for (let i = 0; i < 90; i += 1) {
        stars.push({ x: Math.random() * VIEW.width, y: Math.random() * VIEW.height, r: Math.random() * 1.6 + 0.4, tw: Math.random() * 6.28 });
      }
    }
  }

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top) * (canvas.height / rect.height);
    return { x: (px - offsetX) / scale, y: (py - offsetY) / scale };
  }

  function drawBackground(time) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    g.addColorStop(0, '#0d0a1f');
    g.addColorStop(0.55, '#141031');
    g.addColorStop(1, '#0a0f1e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    for (const s of stars) {
      const a = 0.25 + 0.55 * Math.abs(Math.sin(time * 0.7 + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#cdd8ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawArena(time) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height);
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.08)';
    ctx.lineWidth = 1;
    for (let x = ARENA.x + 76; x < ARENA.x + ARENA.width; x += 76) {
      ctx.beginPath();
      ctx.moveTo(x, ARENA.y);
      ctx.lineTo(x, ARENA.y + ARENA.height);
      ctx.stroke();
    }
    for (let y = ARENA.y + 82; y < ARENA.y + ARENA.height; y += 82) {
      ctx.beginPath();
      ctx.moveTo(ARENA.x, y);
      ctx.lineTo(ARENA.x + ARENA.width, y);
      ctx.stroke();
    }
    // Faint embers drifting up through the arena.
    for (let i = 0; i < 14; i += 1) {
      const ex = ARENA.x + ((i * 173 + time * 12) % ARENA.width);
      const ey = ARENA.y + ARENA.height - ((i * 97 + time * 26) % ARENA.height);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(ex, ey, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGlow(x, y, radius, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawPlayer(p, time) {
    // Lantern light first, so the keeper reads as the light in the dark.
    drawGlow(p.x, p.y, 130, 'rgba(255, 190, 90, 0.20)', 1);
    ctx.save();
    if (p.invuln > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    // Cloak.
    ctx.fillStyle = '#2e6f8e';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius - 6, 0, Math.PI * 2);
    ctx.fill();
    // Hood and face.
    ctx.fillStyle = '#17324a';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 3, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(p.x - 3, p.y - 4, 1.6, 0, Math.PI * 2);
    ctx.arc(p.x + 3, p.y - 4, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // Lantern swung toward the aim.
    const lx = p.x + Math.cos(p.aim) * 22;
    const ly = p.y + Math.sin(p.aim) * 22;
    ctx.strokeStyle = '#8a6d2f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fill();
    if (p.shield) {
      ctx.strokeStyle = 'rgba(159, 216, 255, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 7 + Math.sin(time * 5) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(e, time) {
    ctx.save();
    if (e.flash > 0) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18;
    }
    if (e.type === 'wisp') {
      drawGlow(e.x, e.y, 46, 'rgba(183, 140, 255, 0.25)', 1);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, Math.PI, 0);
      ctx.lineTo(e.x + e.radius, e.y + e.radius * 0.7);
      ctx.lineTo(e.x + e.radius * 0.5, e.y + e.radius * 0.3);
      ctx.lineTo(e.x, e.y + e.radius * 0.8);
      ctx.lineTo(e.x - e.radius * 0.5, e.y + e.radius * 0.3);
      ctx.lineTo(e.x - e.radius, e.y + e.radius * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(e.x - 5, e.y - 3, 2.6, 0, Math.PI * 2);
      ctx.arc(e.x + 5, e.y - 3, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(e.x - 5, e.y - 3, 1.2, 0, Math.PI * 2);
      ctx.arc(e.x + 5, e.y - 3, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'spitter') {
      drawGlow(e.x, e.y, 44, 'rgba(255, 122, 158, 0.22)', 1);
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.sin(e.wobble) * 0.2);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(0, -e.radius - 4);
      ctx.lineTo(e.radius, 0);
      ctx.lineTo(0, e.radius + 4);
      ctx.lineTo(-e.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a0a18';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'hulk') {
      drawGlow(e.x, e.y, 60, 'rgba(127, 224, 168, 0.22)', 1);
      ctx.translate(e.x, e.y);
      ctx.rotate(time * 0.4);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-time * 0.4);
      ctx.fillStyle = '#0d2a1a';
      ctx.beginPath();
      ctx.arc(-6, -3, 2.4, 0, Math.PI * 2);
      ctx.arc(6, -3, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0d2a1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 8);
      ctx.lineTo(6, 8);
      ctx.stroke();
    } else {
      // Boss: a crowned ember orb.
      drawGlow(e.x, e.y, 130, 'rgba(255, 179, 71, 0.30)', 1);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a2d00';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius - 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(e.x - 12, e.y - 6, 4, 0, Math.PI * 2);
      ctx.arc(e.x + 12, e.y - 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff5d5d';
      ctx.beginPath();
      ctx.arc(e.x - 12, e.y - 6, 1.8, 0, Math.PI * 2);
      ctx.arc(e.x + 12, e.y - 6, 1.8, 0, Math.PI * 2);
      ctx.fill();
      // Crown spikes.
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      for (let k = -1; k <= 1; k += 1) {
        const cx = e.x + k * 16;
        ctx.moveTo(cx - 7, e.y - e.radius + 8);
        ctx.lineTo(cx, e.y - e.radius - 10);
        ctx.lineTo(cx + 7, e.y - e.radius + 8);
      }
      ctx.fill();
    }
    if (e.elite) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.maxHp > 6 && e.hp < e.maxHp) {
      const w = e.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
      ctx.fillStyle = '#ff5d5d';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * (e.hp / e.maxHp), 5);
    }
    ctx.restore();
  }

  function drawHud(state, best, muted) {
    const p = state.player;
    ctx.save();
    ctx.textBaseline = 'middle';
    // Score, left.
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE  ${state.score}`, 28, 30);
    ctx.fillStyle = '#9fb4d8';
    ctx.font = '16px Georgia, serif';
    ctx.fillText(`BEST  ${Math.max(best, state.score)}`, 28, 56);
    // Wave, centre.
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${state.wave} / ${TOTAL_WAVES}`, VIEW.width / 2, 30);
    ctx.fillStyle = '#9fb4d8';
    ctx.font = '15px Georgia, serif';
    const left = state.spawnQueue.length + state.enemies.length;
    ctx.fillText(left > 0 ? `${left} shades remain` : 'Wave clear!', VIEW.width / 2, 54);
    // Hearts, right.
    for (let i = 0; i < p.maxHp; i += 1) {
      ctx.fillStyle = i < p.hp ? '#ff5d7a' : 'rgba(255,93,122,0.18)';
      heartPath(ctx, VIEW.width - 44 - i * 34, 30, 11);
      ctx.fill();
    }
    if (p.shield) {
      ctx.fillStyle = '#9fd8ff';
      ctx.font = 'bold 15px Georgia, serif';
      ctx.textAlign = 'right';
      ctx.fillText('⛨ WARD', VIEW.width - 28, 58);
    }
    // Combo.
    if (state.combo >= 3) {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 20px Georgia, serif';
      ctx.textAlign = 'left';
      ctx.fillText(`COMBO x${(1 + Math.min(state.combo, 20) * 0.1).toFixed(1)}  (${state.combo})`, 28, 84);
    }
    // Overdrive bar.
    if (p.overdrive > 0) {
      ctx.fillStyle = 'rgba(255, 209, 102, 0.25)';
      ctx.fillRect(28, 96, 160, 8);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(28, 96, 160 * Math.min(1, p.overdrive / (6 * (1 + p.overdriveBonus))), 8);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 13px Georgia, serif';
      ctx.textAlign = 'left';
      ctx.fillText('OVERDRIVE', 196, 100);
    }
    // Boss bar.
    if (state.boss) {
      const b = state.boss;
      const w = 420;
      const x = (VIEW.width - w) / 2;
      const y = VIEW.height - 26;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - 6, y - 6, w + 12, 24);
      ctx.fillStyle = '#ff5d5d';
      ctx.fillRect(x, y, w * Math.max(0, b.hp / b.maxHp), 12);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 13px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.wave >= 10 ? 'THE HOLLOW KING' : 'THE GLOOM HERALD', VIEW.width / 2, y - 16);
    }
    ctx.fillStyle = '#5d6b8a';
    ctx.font = '13px Georgia, serif';
    ctx.textAlign = 'right';
    ctx.fillText(`M mute ${muted ? '(muted)' : ''} · P pause`, VIEW.width - 28, VIEW.height - 16);
    ctx.restore();
  }

  function drawBanner(state) {
    if (state.bannerTimer <= 0 || !state.banner) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.bannerTimer);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 24;
    ctx.fillText(state.banner, VIEW.width / 2, 190);
    ctx.restore();
  }

  function drawWorld(state, time) {
    ctx.save();
    if (state.shake > 0.5) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    drawBackground(time);
    drawArena(time);
    for (const pk of state.pickups) {
      const bob = Math.sin(time * 4 + pk.x) * 2;
      if (pk.kind === 'shard') {
        ctx.fillStyle = '#7fe0ff';
        ctx.save();
        ctx.translate(pk.x, pk.y + bob);
        ctx.rotate(time * 2);
        ctx.fillRect(-5, -5, 10, 10);
        ctx.restore();
      } else if (pk.kind === 'heart') {
        ctx.fillStyle = '#ff5d7a';
        heartPath(ctx, pk.x, pk.y + bob, 9);
        ctx.fill();
      } else {
        drawGlow(pk.x, pk.y + bob, 26, 'rgba(255, 209, 102, 0.5)', 1);
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(pk.x, pk.y + bob, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a4d00';
        ctx.font = 'bold 11px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☀', pk.x, pk.y + bob + 0.5);
      }
    }
    for (const e of state.enemies) drawEnemy(e, time);
    for (const b of state.bullets) {
      drawGlow(b.x, b.y, 14, 'rgba(255, 209, 102, 0.55)', 1);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of state.enemyBullets) {
      ctx.fillStyle = '#ff7a9e';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd6e0';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.player && state.phase !== 'gameover') drawPlayer(state.player, time);
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 16px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.min(1, f.life / 0.45);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10, 8, 28, 0.82)';
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
  }

  function drawTitle(state, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 6, 22, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 84px Georgia, serif';
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 34;
    ctx.fillText('EMBERWARD', VIEW.width / 2, 150);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillText('Keep the last lantern burning. Ten waves of shade stand between', VIEW.width / 2, 210);
    ctx.fillText('you and the dawn — and the Hollow King waits at the end.', VIEW.width / 2, 238);
    ctx.fillStyle = '#cdd8ff';
    ctx.font = '17px Georgia, serif';
    ctx.fillText('WASD / arrows — move      Mouse — aim      Hold click / Space — fire', VIEW.width / 2, 300);
    ctx.fillText('Clear a wave, choose a blessing, survive all ten waves to win.', VIEW.width / 2, 328);
    ctx.fillText('Wisps chase · Spitters shoot · Hulks split in two · Bosses summon', VIEW.width / 2, 356);
    if (best > 0) {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 20px Georgia, serif';
      ctx.fillText(`BEST SCORE  ${best}`, VIEW.width / 2, 402);
    }
    const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 350);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 24px Georgia, serif';
    ctx.fillText('— CLICK OR PRESS SPACE TO BEGIN —', VIEW.width / 2, 462);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5d6b8a';
    ctx.font = '14px Georgia, serif';
    ctx.fillText('M mute · P pause · R restart', VIEW.width / 2, 516);
    ctx.restore();
  }

  function drawUpgrade(state) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 6, 22, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 40px Georgia, serif';
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 18;
    ctx.fillText(`WAVE ${state.wave} CLEAR`, VIEW.width / 2, 130);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '20px Georgia, serif';
    ctx.fillText('The lantern flares. Choose a blessing:', VIEW.width / 2, 180);
    state.choices.forEach((choice, index) => {
      const r = cardRect(index);
      const hover = false;
      ctx.fillStyle = hover ? 'rgba(255, 209, 102, 0.22)' : 'rgba(20, 16, 49, 0.92)';
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.width, r.height, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.font = '44px Georgia, serif';
      ctx.fillText(choice.icon, r.x + r.width / 2, r.y + 52);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 18px Georgia, serif';
      ctx.fillText(choice.name, r.x + r.width / 2, r.y + 104);
      ctx.fillStyle = '#cdd8ff';
      ctx.font = '15px Georgia, serif';
      ctx.fillText(choice.blurb, r.x + r.width / 2, r.y + 134);
      ctx.fillStyle = '#5d6b8a';
      ctx.font = 'bold 15px Georgia, serif';
      ctx.fillText(`Press ${index + 1} or click`, r.x + r.width / 2, r.y + 164);
    });
    ctx.fillStyle = '#9fb4d8';
    ctx.font = '16px Georgia, serif';
    ctx.fillText(`Score ${state.score}  ·  Wave ${state.wave + 1} of ${TOTAL_WAVES} next`, VIEW.width / 2, 490);
    ctx.restore();
  }

  function drawPaused() {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 6, 22, 0.66)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 52px Georgia, serif';
    ctx.fillText('PAUSED', VIEW.width / 2, 260);
    ctx.fillStyle = '#cdd8ff';
    ctx.font = '19px Georgia, serif';
    ctx.fillText('Press P or Space to keep playing · R to restart', VIEW.width / 2, 320);
    ctx.restore();
  }

  function drawResults(state, best, victory) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 6, 22, 0.68)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const w = 560;
    const h = 420;
    panel((VIEW.width - w) / 2, 100, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = victory ? '#ffd166' : '#ff7a9e';
    ctx.font = 'bold 46px Georgia, serif';
    ctx.shadowColor = victory ? '#ffb347' : '#ff5d5d';
    ctx.shadowBlur = 22;
    ctx.fillText(victory ? 'THE DAWN RETURNS' : 'THE LIGHT GOES OUT', VIEW.width / 2, 168);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '20px Georgia, serif';
    ctx.fillText(
      victory ? 'The Hollow King is ash. Ten waves survived — the lantern burns on.'
        : `The shades took the lantern on wave ${state.wave}. Light it again.`,
      VIEW.width / 2, 214,
    );
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60).toString().padStart(2, '0');
    const accuracy = state.stats.shots > 0 ? Math.round((state.stats.hits / state.stats.shots) * 100) : 0;
    const rows = [
      ['SCORE', String(state.score)],
      ['BEST', String(Math.max(best, state.score))],
      ['WAVES CLEARED', `${victory ? TOTAL_WAVES : state.wave - 1} / ${TOTAL_WAVES}`],
      ['SHADES VANQUISHED', String(state.kills)],
      ['BEST COMBO', `x${(1 + Math.min(state.bestCombo, 20) * 0.1).toFixed(1)}`],
      ['TIME', `${minutes}:${seconds}`],
      ['ACCURACY', `${accuracy}%`],
    ];
    ctx.font = '17px Georgia, serif';
    rows.forEach((row, i) => {
      const y = 252 + i * 24;
      ctx.fillStyle = '#9fb4d8';
      ctx.textAlign = 'right';
      ctx.fillText(row[0], VIEW.width / 2 - 12, y);
      ctx.fillStyle = '#ffe9a8';
      ctx.textAlign = 'left';
      ctx.fillText(row[1], VIEW.width / 2 + 12, y);
    });
    const r = buttonRect();
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#8a6d2f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.width, r.height, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3a2400';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('▶  PLAY AGAIN', VIEW.width / 2, r.y + r.height / 2 + 1);
    ctx.fillStyle = '#5d6b8a';
    ctx.font = '15px Georgia, serif';
    ctx.fillText('or press R / Space', VIEW.width / 2, 540);
    ctx.restore();
  }

  function draw(state, screen, best, muted, time) {
    resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05030d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    if (screen === SCREEN_TITLE) {
      drawWorld(state, time);
      drawTitle(state, best);
      return;
    }
    drawWorld(state, time);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_UPGRADE) {
      drawHud(state, best, muted);
      drawBanner(state);
    }
    if (screen === SCREEN_UPGRADE) drawUpgrade(state);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawResults(state, best, false);
    else if (screen === SCREEN_VICTORY) drawResults(state, best, true);
  }

  return { draw, resize, toLogical };
}
