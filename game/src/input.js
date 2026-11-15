// Keyboard + mouse input, read once per frame. Movement keys, aiming with the
// mouse (arrow keys aim when no mouse has moved yet), and one-shot actions:
// confirm (start / restart / choose), pause, mute.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseSeen = false;
  let choice = -1;

  function toLogical(event) {
    // Keep raw client coordinates; the renderer converts them to game space.
    return { x: event.clientX, y: event.clientY };
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    } else if (event.code === 'KeyR') {
      actions |= ACTION_RESTART;
    } else if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3') {
      choice = Number(event.code.slice(-1)) - 1;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const p = toLogical(event);
    mouseX = p.x;
    mouseY = p.y;
    mouseSeen = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = toLogical(event);
    mouseX = p.x;
    mouseY = p.y;
    mouseSeen = true;
    mouseDown = true;
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function direction() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  return {
    direction,
    get mouse() { return { x: mouseX, y: mouseY, down: mouseDown, seen: mouseSeen }; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeChoice() {
      const taken = choice;
      choice = -1;
      return taken;
    },
    // Arrow keys double as an aim fallback when the mouse has never moved.
    aimAngle(fromX, fromY) {
      if (mouseSeen) return Math.atan2(mouseY - fromY, mouseX - fromX);
      let x = 0;
      let y = 0;
      if (keys.has('ArrowLeft')) x -= 1;
      if (keys.has('ArrowRight')) x += 1;
      if (keys.has('ArrowUp')) y -= 1;
      if (keys.has('ArrowDown')) y += 1;
      if (x === 0 && y === 0) return null;
      return Math.atan2(y, x);
    },
    get firing() { return mouseDown || keys.has('Space'); },
    get anyKey() { return keys.size > 0; },
  };
}
