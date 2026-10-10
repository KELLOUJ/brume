import type { InputFrame, Just, Level, Mover, Particle, Platform, Player, Rect, Sim } from "./types";

export const VIEW_W = 960;
export const VIEW_H = 540;
export const PLAYER_W = 28;
export const PLAYER_H = 50;

const RUN = 262;
const ACC_G = 3600;
const ACC_A = 1800;
const FRIC_G = 3200;
const FRIC_A = 150;
const JUMP_V = -548;
const DJUMP_V = -468;
const G_RISE = 1080;
const G_FALL = 2280;
const G_APEX = 640;
const APEX = 78;
const TERM = 900;
const COYOTE = 0.12;
const BUFFER = 0.13;

const emptyJust = (): Just => ({
  jump: 0,
  coin: 0,
  checkpoint: false,
  land: false,
  death: false,
  win: false,
});

export function motionOffset(move: Mover | undefined, time: number) {
  if (!move || move.period <= 0) return { x: 0, y: 0 };
  const s = Math.sin((time / move.period) * Math.PI * 2 + move.phase);
  return move.axis === "x" ? { x: s * move.amp, y: 0 } : { x: 0, y: s * move.amp };
}

export function placed(box: { x: number; y: number; w: number; h: number; move?: Mover }, time: number): Rect {
  const o = motionOffset(box.move, time);
  return { x: box.x + o.x, y: box.y + o.y, w: box.w, h: box.h };
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function intersects(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function makePlayer(x: number, y: number): Player {
  return {
    x,
    y,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    jumpsLeft: 2,
    coyote: COYOTE,
    jumpBuffer: 0,
    cutApplied: false,
    riding: null,
    dropTimer: 0,
    anim: "idle",
    animTime: 0,
    squash: 0,
    dust: 0,
  };
}

function camLimits(level: Level) {
  return {
    maxX: Math.max(0, level.width - VIEW_W),
    maxY: Math.max(0, level.height - VIEW_H),
  };
}

export function createSim(level: Level): Sim {
  const player = makePlayer(level.spawn.x, level.spawn.y);
  const limits = camLimits(level);
  const sim: Sim = {
    level,
    player,
    time: 0,
    coins: new Set(),
    lit: new Set(),
    checkpointId: null,
    snapshot: { x: level.spawn.x, y: level.spawn.y, coins: [], checkpointId: null },
    phase: "play",
    phaseTime: 0,
    shake: 0,
    flash: 0,
    camX: clamp(level.spawn.x - VIEW_W * 0.28, 0, limits.maxX),
    camY: clamp(level.spawn.y - VIEW_H * 0.55, 0, limits.maxY),
    particles: [],
    just: emptyJust(),
  };
  return sim;
}

function burst(sim: Sim, x: number, y: number, kind: Particle["kind"], n: number, colorSize: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 160;
    sim.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (kind === "dust" ? 20 : 40),
      life: 0.35 + Math.random() * 0.35,
      max: 0.7,
      size: colorSize * (0.6 + Math.random() * 0.8),
      kind,
    });
  }
  if (sim.particles.length > 110) sim.particles.splice(0, sim.particles.length - 110);
}

function updateParticles(sim: Sim, dt: number) {
  for (const p of sim.particles) {
    p.life -= dt;
    p.vy += (p.kind === "spark" ? -40 : 500) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  sim.particles = sim.particles.filter((p) => p.life > 0);
}

function updateCamera(sim: Sim, dt: number) {
  const p = sim.player;
  const look = p.facing * 86 + clamp(p.vx, -220, 220) * 0.22;
  const targetX = p.x + p.w / 2 - VIEW_W / 2 + look;
  const targetY = p.y + p.h * 0.35 - VIEW_H * 0.58;
  const kx = 1 - Math.exp(-4.4 * dt);
  const ky = 1 - Math.exp(-3 * dt);
  sim.camX += (targetX - sim.camX) * kx;
  sim.camY += (targetY - sim.camY) * ky;
  const limits = camLimits(sim.level);
  sim.camX = clamp(sim.camX, 0, limits.maxX);
  sim.camY = clamp(sim.camY, 0, limits.maxY);
}

function respawn(sim: Sim) {
  const snap = sim.snapshot;
  const p = sim.player;
  p.x = snap.x;
  p.y = snap.y;
  p.vx = 0;
  p.vy = 0;
  p.grounded = false;
  p.jumpsLeft = 2;
  p.coyote = COYOTE;
  p.jumpBuffer = 0;
  p.cutApplied = false;
  p.riding = null;
  p.dropTimer = 0;
  p.squash = 0;
  sim.coins = new Set(snap.coins);
  sim.checkpointId = snap.checkpointId;
  sim.phase = "play";
  sim.phaseTime = 0;
  sim.flash = 0;
  sim.particles = [];
}

function saveCheckpoint(sim: Sim, id: string) {
  const p = sim.player;
  sim.checkpointId = id;
  sim.lit.add(id);
  sim.snapshot = {
    x: p.x,
    y: p.y,
    coins: [...sim.coins],
    checkpointId: id,
  };
  sim.just.checkpoint = true;
  burst(sim, p.x + p.w / 2, p.y + 10, "spark", 10, 4);
}

function kill(sim: Sim) {
  if (sim.phase !== "play") return;
  sim.phase = "dead";
  sim.phaseTime = 0;
  sim.shake = 1;
  sim.flash = 1;
  sim.just.death = true;
  sim.player.vx = 0;
  sim.player.vy = 0;
  burst(sim, sim.player.x + sim.player.w / 2, sim.player.y + sim.player.h / 2, "shard", 16, 5);
}

function playerRect(p: Player): Rect {
  return { x: p.x, y: p.y, w: p.w, h: p.h };
}

function tryJump(sim: Sim): boolean {
  const p = sim.player;
  if (p.grounded || p.coyote > 0) {
    p.vy = JUMP_V;
    p.grounded = false;
    p.coyote = 0;
    p.jumpsLeft = 1;
    p.riding = null;
    p.cutApplied = false;
    p.squash = -0.2;
    sim.just.jump = 1;
    burst(sim, p.x + p.w / 2, p.y + p.h, "dust", 6, 3);
    return true;
  }
  if (p.jumpsLeft > 0) {
    p.vy = DJUMP_V;
    p.jumpsLeft = 0;
    p.coyote = 0;
    p.cutApplied = false;
    p.squash = -0.16;
    sim.just.jump = 2;
    burst(sim, p.x + p.w / 2, p.y + p.h * 0.5, "spark", 8, 3);
    return true;
  }
  return false;
}

function physics(sim: Sim, input: InputFrame, dt: number, allowEdge: boolean) {
  const p = sim.player;
  const t0 = sim.time;
  const t1 = t0 + dt;
  sim.time = t1;
  p.dropTimer = Math.max(0, p.dropTimer - dt);

  if (p.riding) {
    const plat = sim.level.platforms.find((item) => item.id === p.riding);
    if (plat) {
      const a = placed(plat, t0);
      const b = placed(plat, t1);
      p.x += b.x - a.x;
      p.y += b.y - a.y;
    }
  }

  const target = input.moveX * RUN;
  if (Math.abs(input.moveX) > 0.05) {
    const accel = (p.grounded ? ACC_G : ACC_A) * dt;
    const diff = target - p.vx;
    if (Math.abs(diff) <= accel) p.vx = target;
    else p.vx += Math.sign(diff) * accel;
    if (input.moveX < -0.2) p.facing = -1;
    if (input.moveX > 0.2) p.facing = 1;
  } else {
    const fric = (p.grounded ? FRIC_G : FRIC_A) * dt;
    if (Math.abs(p.vx) <= fric) p.vx = 0;
    else p.vx -= Math.sign(p.vx) * fric;
  }

  if (allowEdge && input.dropPressed && p.grounded && p.riding) {
    const plat = sim.level.platforms.find((item) => item.id === p.riding);
    if (plat?.kind === "oneway") {
      p.dropTimer = 0.2;
      p.grounded = false;
      p.riding = null;
      p.coyote = 0;
      p.jumpsLeft = Math.min(p.jumpsLeft, 1);
      p.vy = 80;
      p.y += 4;
    }
  }

  if (!p.grounded) {
    let g = G_FALL;
    if (p.vy < -APEX) g = G_RISE;
    else if (p.vy < APEX) g = G_APEX;
    p.vy = Math.min(TERM, p.vy + g * dt);
  } else {
    p.vy = 0;
  }

  const prevX = p.x;
  p.x += p.vx * dt;
  for (const plat of sim.level.platforms) {
    if (plat.kind === "oneway") continue;
    const r = placed(plat, t1);
    const body = playerRect(p);
    if (!intersects(body, r)) continue;
    if (p.vx > 0 && prevX + p.w <= r.x + 0.5) {
      p.x = r.x - p.w;
      p.vx = 0;
    } else if (p.vx < 0 && prevX >= r.x + r.w - 0.5) {
      p.x = r.x + r.w;
      p.vx = 0;
    }
  }

  const prevY = p.y;
  p.y += p.vy * dt;
  let landed: Platform | null = null;
  let landedTop = Infinity;
  for (const plat of sim.level.platforms) {
    const r = placed(plat, t1);
    if (!intersects(playerRect(p), r)) continue;
    const prevBottom = prevY + p.h;
    if (p.vy >= 0 && prevBottom <= r.y + 2) {
      if (plat.kind === "oneway" && p.dropTimer > 0) continue;
      if (r.y < landedTop) {
        landed = plat;
        landedTop = r.y;
      }
    } else if (plat.kind === "solid" && p.vy < 0 && prevY >= r.y + r.h - 2) {
      p.y = r.y + r.h;
      p.vy = 0.1;
    }
  }

  if (landed) {
    const impact = p.vy;
    p.y = landedTop - p.h;
    p.vy = 0;
    const wasAir = !p.grounded;
    p.grounded = true;
    p.jumpsLeft = 2;
    p.coyote = COYOTE;
    p.riding = landed.id;
    if (wasAir && impact > 340) {
      sim.just.land = true;
      p.squash = 0.22;
      burst(sim, p.x + p.w / 2, p.y + p.h, "dust", 5, 3);
    }
  } else {
    const probe: Rect = { x: p.x + 3, y: p.y + p.h, w: p.w - 6, h: 4 };
    let stick: Platform | null = null;
    let stickTop = Infinity;
    for (const plat of sim.level.platforms) {
      if (plat.kind === "oneway" && p.dropTimer > 0) continue;
      const r = placed(plat, t1);
      if (!intersects(probe, r)) continue;
      if (r.y < stickTop) {
        stick = plat;
        stickTop = r.y;
      }
    }
    if (stick && p.vy >= 0) {
      p.y = stickTop - p.h;
      p.vy = 0;
      p.grounded = true;
      p.jumpsLeft = 2;
      p.coyote = COYOTE;
      p.riding = stick.id;
    } else if (p.grounded) {
      p.grounded = false;
      p.riding = null;
    } else {
      const before = p.coyote;
      p.coyote = Math.max(0, p.coyote - dt);
      if (before > 0 && p.coyote === 0 && p.jumpsLeft > 1) p.jumpsLeft = 1;
    }
  }

  if (allowEdge && input.jumpPressed) p.jumpBuffer = BUFFER;
  if (p.jumpBuffer > 0) {
    if (tryJump(sim)) p.jumpBuffer = 0;
    else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  }

  if (!input.jumpHeld && p.vy < -40 && !p.cutApplied) {
    p.vy *= 0.46;
    p.cutApplied = true;
  }

  const body = playerRect(p);
  const hurt: Rect = { x: body.x + 5, y: body.y + 4, w: body.w - 10, h: body.h - 6 };
  for (const hazard of sim.level.hazards) {
    const r = placed(hazard, t1);
    if (hazard.kind === "saw") {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const rad = Math.min(r.w, r.h) * 0.42;
      const nx = clamp(cx, hurt.x, hurt.x + hurt.w);
      const ny = clamp(cy, hurt.y, hurt.y + hurt.h);
      if ((cx - nx) ** 2 + (cy - ny) ** 2 < rad * rad) {
        kill(sim);
        return;
      }
    } else if (intersects(hurt, r)) {
      kill(sim);
      return;
    }
  }
  if (p.y > sim.level.killY) {
    kill(sim);
    return;
  }

  for (const coin of sim.level.coins) {
    if (sim.coins.has(coin.id)) continue;
    const nx = clamp(coin.x, body.x, body.x + body.w);
    const ny = clamp(coin.y, body.y, body.y + body.h);
    if ((coin.x - nx) ** 2 + (coin.y - ny) ** 2 < 18 * 18) {
      sim.coins.add(coin.id);
      sim.just.coin += 1;
      burst(sim, coin.x, coin.y, "spark", 7, 3);
    }
  }

  for (const cp of sim.level.checkpoints) {
    if (sim.checkpointId === cp.id) continue;
    const zone: Rect = { x: cp.x - 8, y: cp.y - 78, w: 36, h: 78 };
    if (intersects(body, zone)) saveCheckpoint(sim, cp.id);
  }

  const goal: Rect = { x: sim.level.goal.x - 6, y: sim.level.goal.y - 110, w: 48, h: 110 };
  if (intersects(body, goal)) {
    sim.phase = "win";
    sim.phaseTime = 0;
    sim.just.win = true;
    p.vx = 0;
    burst(sim, sim.level.goal.x, sim.level.goal.y - 70, "spark", 18, 4);
  }
}

export function step(sim: Sim, input: InputFrame, dt: number) {
  sim.just = emptyJust();
  sim.shake = Math.max(0, sim.shake - dt * 1.5);
  sim.flash = Math.max(0, sim.flash - dt * 2.2);

  if (sim.phase === "dead") {
    sim.phaseTime += dt;
    updateParticles(sim, dt);
    if (sim.phaseTime >= 0.68) respawn(sim);
    updateCamera(sim, dt);
    return;
  }

  if (sim.phase === "win") {
    sim.phaseTime += dt;
    updateParticles(sim, dt);
    sim.player.squash += (0 - sim.player.squash) * (1 - Math.exp(-8 * dt));
    updateCamera(sim, dt);
    return;
  }

  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    physics(sim, input, h, i === 0);
    if (sim.phase !== "play") break;
  }

  const p = sim.player;
  p.animTime += dt;
  p.squash += (0 - p.squash) * (1 - Math.exp(-10 * dt));
  if (!p.grounded) p.anim = "air";
  else if (Math.abs(p.vx) > 28) p.anim = "run";
  else p.anim = "idle";

  if (sim.phase === "play" && p.grounded && Math.abs(p.vx) > 90) {
    p.dust -= dt;
    if (p.dust <= 0) {
      p.dust = 0.07;
      burst(sim, p.x + p.w / 2 - p.facing * 8, p.y + p.h, "dust", 1, 3);
    }
  }

  updateParticles(sim, dt);
  updateCamera(sim, dt);
}

export function panTitle(sim: Sim, dt: number) {
  sim.time += dt;
  sim.camX += dt * 42;
  const maxX = Math.max(0, sim.level.width - VIEW_W);
  if (sim.camX > maxX) sim.camX = 0;
  sim.camY = clamp(sim.level.spawn.y - VIEW_H * 0.48, 0, Math.max(0, sim.level.height - VIEW_H));
}
