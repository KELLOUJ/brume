import type { InputFrame } from "./types";

const held = new Set<string>();
let override: Set<string> | null = null;
const touch = { left: false, right: false, jump: false };

let prevJump = false;
let prevDrop = false;
let prevPause = false;

const LEFT = ["ArrowLeft", "KeyA", "KeyQ"];
const RIGHT = ["ArrowRight", "KeyD"];
const JUMP = ["ArrowUp", "KeyW", "KeyZ", "Space"];
const DOWN = ["ArrowDown", "KeyS"];
const PAUSE = ["Escape", "KeyP"];
const BLOCK = new Set([...LEFT, ...RIGHT, ...JUMP, ...DOWN, ...PAUSE]);

function hasAny(src: Set<string>, codes: string[]) {
  for (const code of codes) if (src.has(code)) return true;
  return false;
}

export function setOverrideKeys(codes: string[]) {
  override = new Set(codes);
}

export function setTouch(partial: Partial<typeof touch>) {
  Object.assign(touch, partial);
}

export function attachInput(target: Window) {
  const down = (event: KeyboardEvent) => {
    if (BLOCK.has(event.code)) event.preventDefault();
    held.add(event.code);
    if (override && event.isTrusted) override = null;
  };
  const up = (event: KeyboardEvent) => {
    held.delete(event.code);
  };
  const clear = () => held.clear();
  const vis = () => {
    if (document.hidden) held.clear();
  };
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  target.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", vis);
  return () => {
    target.removeEventListener("keydown", down);
    target.removeEventListener("keyup", up);
    target.removeEventListener("blur", clear);
    document.removeEventListener("visibilitychange", vis);
    held.clear();
  };
}

function padState() {
  const pads = navigator.getGamepads?.() ?? [];
  let x = 0;
  let jump = false;
  let drop = false;
  let pause = false;
  let left = false;
  let right = false;
  for (const pad of pads) {
    if (!pad) continue;
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const mag = Math.hypot(ax, ay);
    const dz = 0.18;
    if (mag > dz) {
      const scale = (mag - dz) / (1 - dz) / mag;
      x = Math.max(-1, Math.min(1, x + ax * scale));
    }
    if (pad.buttons[14]?.pressed) left = true;
    if (pad.buttons[15]?.pressed) right = true;
    if (pad.buttons[0]?.pressed || pad.buttons[12]?.pressed) jump = true;
    if (pad.buttons[13]?.pressed || ay > 0.55) drop = true;
    if (pad.buttons[9]?.pressed) pause = true;
  }
  return { x, jump, drop, pause, left, right };
}

export function sample(): InputFrame {
  const pad = override ? { x: 0, jump: false, drop: false, pause: false, left: false, right: false } : padState();
  const src = override ?? held;
  const left = hasAny(src, LEFT) || (!override && (touch.left || pad.left));
  const right = hasAny(src, RIGHT) || (!override && (touch.right || pad.right));
  let moveX = 0;
  if (left && !right) moveX = -1;
  else if (right && !left) moveX = 1;
  else if (!left && !right && !override) moveX = pad.x;

  const jumpHeld = hasAny(src, JUMP) || (!override && (touch.jump || pad.jump));
  const dropHeld = hasAny(src, DOWN) || (!override && pad.drop);
  const pauseHeld = hasAny(src, PAUSE) || (!override && pad.pause);
  const frame: InputFrame = {
    moveX,
    jumpHeld,
    jumpPressed: jumpHeld && !prevJump,
    dropPressed: dropHeld && !prevDrop,
    pausePressed: pauseHeld && !prevPause,
  };
  prevJump = jumpHeld;
  prevDrop = dropHeld;
  prevPause = pauseHeld;
  return frame;
}
