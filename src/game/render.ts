import { placed, VIEW_H, VIEW_W } from "./sim";
import type { Level, Particle, Player, Sim } from "./types";

export type Art = {
  idle: HTMLImageElement[];
  run: HTMLImageElement[];
  jump: HTMLImageElement[];
};

const C = {
  skyTop: "#070b14",
  skyMid: "#18243c",
  skyWarm: "#3a2c40",
  moon: "#f3efe6",
  hill: "#121a2b",
  hill2: "#0d1422",
  stone: "#243044",
  stoneDeep: "#182232",
  rim: "#d7c4a4",
  moss: "#6ec8a0",
  amber: "#e8a15a",
  danger: "#e15d4f",
  cream: "#f3efe6",
  metal: "#c5ceda",
  flag: "#e15d4f",
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

export function draw(ctx: CanvasRenderingContext2D, sim: Sim, art: Art, showPlayer: boolean, reduceMotion: boolean) {
  const camX = Math.round(sim.camX + (reduceMotion ? 0 : Math.sin(sim.time * 46) * sim.shake * 8));
  const camY = Math.round(sim.camY + (reduceMotion ? 0 : Math.cos(sim.time * 35) * sim.shake * 5));
  const level = sim.level;

  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, C.skyTop);
  sky.addColorStop(0.55, C.skyMid);
  sky.addColorStop(1, C.skyWarm);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  drawMoon(ctx, camX, camY);
  drawStars(ctx, camX, camY, level);
  drawHills(ctx, camX, camY, level);
  drawPlatforms(ctx, sim, camX, camY);
  drawHazards(ctx, sim, camX, camY);
  drawCoins(ctx, sim, camX, camY);
  drawCheckpoints(ctx, sim, camX, camY);
  drawGoal(ctx, level, camX, camY, sim.time);
  drawParticles(ctx, sim.particles, camX, camY);

  const fog = ctx.createLinearGradient(0, VIEW_H * 0.62, 0, VIEW_H);
  fog.addColorStop(0, "rgba(8,10,16,0)");
  fog.addColorStop(1, "rgba(8,10,16,0.45)");
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (showPlayer && sim.phase !== "dead") drawPlayer(ctx, sim.player, art, camX, camY, sim.time);
  else if (showPlayer && sim.phase === "dead") drawPlayer(ctx, sim.player, art, camX, camY, sim.time);

  if (sim.flash > 0) {
    ctx.fillStyle = `rgba(225, 93, 79, ${sim.flash * 0.38})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  const vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(5,7,12,0.38)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawMoon(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
  const x = 280 - camX * 0.06;
  const y = 86 - camY * 0.04;
  const glow = ctx.createRadialGradient(x, y, 10, x, y, 90);
  glow.addColorStop(0, "rgba(243,239,230,0.45)");
  glow.addColorStop(1, "rgba(243,239,230,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.moon;
  ctx.beginPath();
  ctx.arc(x, y, 28, 0, Math.PI * 2);
  ctx.fill();
}

function drawStars(ctx: CanvasRenderingContext2D, camX: number, camY: number, level: Level) {
  ctx.fillStyle = "rgba(243,239,230,0.75)";
  for (let i = 0; i < 48; i++) {
    const x = ((i * 211 + 40 - camX * 0.08) % (level.width + 200)) - 40;
    const y = ((i * 97) % 240) + 16 - camY * 0.03;
    if (x < -10 || x > VIEW_W + 10) continue;
    ctx.globalAlpha = 0.35 + (i % 5) * 0.12;
    ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1.4, i % 4 === 0 ? 2 : 1.4);
  }
  ctx.globalAlpha = 1;
}

function drawHills(ctx: CanvasRenderingContext2D, camX: number, camY: number, level: Level) {
  const layers = [
    { parallax: 0.18, color: C.hill, base: 300, h: 90, step: 280 },
    { parallax: 0.38, color: C.hill2, base: 360, h: 70, step: 210 },
  ];
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    const start = Math.floor((camX * layer.parallax) / layer.step) - 1;
    for (let i = start; i < start + 12; i++) {
      const x = i * layer.step - camX * layer.parallax;
      const y = layer.base - camY * layer.parallax * 0.35 + ((i * 37) % 30);
      ctx.beginPath();
      ctx.moveTo(x, y + layer.h);
      ctx.quadraticCurveTo(x + layer.step * 0.5, y - layer.h, x + layer.step, y + layer.h);
      ctx.fill();
    }
  }
  void level;
}

function drawPlatforms(ctx: CanvasRenderingContext2D, sim: Sim, camX: number, camY: number) {
  for (const plat of sim.level.platforms) {
    if (plat.move) {
      const reach = placed(
        {
          ...plat,
          x: plat.x - (plat.move.axis === "x" ? plat.move.amp : 0),
          y: plat.y - (plat.move.axis === "y" ? plat.move.amp : 0),
          w: plat.w + (plat.move.axis === "x" ? plat.move.amp * 2 : 0),
          h: plat.h + (plat.move.axis === "y" ? plat.move.amp * 2 : 0),
        },
        0,
      );
      ctx.strokeStyle = "rgba(232,161,90,0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(reach.x - camX, reach.y - camY, reach.w, reach.h);
    }
    const r = placed(plat, sim.time);
    const x = r.x - camX;
    const y = r.y - camY;
    if (x > VIEW_W + 40 || x + r.w < -40 || y > VIEW_H + 40 || y + r.h < -80) continue;

    const g = ctx.createLinearGradient(x, y, x, y + Math.min(r.h, 90));
    if (plat.kind === "oneway") {
      g.addColorStop(0, "#4e6280");
      g.addColorStop(1, "#2a3b54");
    } else if (plat.move) {
      g.addColorStop(0, "#4a4032");
      g.addColorStop(1, "#2a241c");
    } else {
      g.addColorStop(0, "#31445f");
      g.addColorStop(1, C.stoneDeep);
    }
    ctx.fillStyle = g;
    roundRect(ctx, x, y, r.w, r.h, plat.kind === "oneway" ? 8 : 10);
    ctx.fill();
    ctx.fillStyle = plat.move ? C.amber : C.rim;
    ctx.fillRect(x + 6, y, Math.max(0, r.w - 12), 4);
    if (plat.kind === "solid" && !plat.move && r.w > 80) {
      ctx.fillStyle = C.moss;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(x + 28, y + 2, 14, 5, 0, Math.PI, 0);
      ctx.fill();
      if (r.w > 220) {
        ctx.beginPath();
        ctx.ellipse(x + r.w * 0.62, y + 2, 18, 6, 0, Math.PI, 0);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}

function drawHazards(ctx: CanvasRenderingContext2D, sim: Sim, camX: number, camY: number) {
  for (const hazard of sim.level.hazards) {
    const r = placed(hazard, sim.time);
    const x = r.x - camX;
    const y = r.y - camY;
    if (hazard.kind === "spike") {
      const n = Math.max(1, Math.round(r.w / 18));
      const tw = r.w / n;
      ctx.fillStyle = C.danger;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * tw + 2, y + r.h);
        ctx.lineTo(x + i * tw + tw / 2, y);
        ctx.lineTo(x + (i + 1) * tw - 2, y + r.h);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      const cx = x + r.w / 2;
      const cy = y + r.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sim.time * 7);
      ctx.fillStyle = C.metal;
      ctx.beginPath();
      ctx.arc(0, 0, r.w * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.danger;
      ctx.beginPath();
      ctx.arc(0, 0, r.w * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.metal;
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r.w * 0.28, Math.sin(a) * r.w * 0.28);
        ctx.lineTo(Math.cos(a) * r.w * 0.5, Math.sin(a) * r.w * 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawCoins(ctx: CanvasRenderingContext2D, sim: Sim, camX: number, camY: number) {
  sim.level.coins.forEach((coin, index) => {
    if (sim.coins.has(coin.id)) return;
    const bob = Math.sin(sim.time * 3 + index) * 4;
    const spin = 0.35 + Math.abs(Math.sin(sim.time * 3.2 + index)) * 0.65;
    const x = coin.x - camX;
    const y = coin.y - camY + bob;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(spin, 1);
    ctx.fillStyle = C.amber;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f3efe6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0.4, Math.PI * 1.4);
    ctx.stroke();
    ctx.restore();
  });
}

function drawCheckpoints(ctx: CanvasRenderingContext2D, sim: Sim, camX: number, camY: number) {
  for (const cp of sim.level.checkpoints) {
    const lit = sim.lit.has(cp.id);
    const x = cp.x - camX;
    const y = cp.y - camY;
    ctx.fillStyle = "#1c2838";
    ctx.fillRect(x, y - 74, 6, 74);
    if (lit) {
      const glow = ctx.createRadialGradient(x + 3, y - 84, 2, x + 3, y - 84, 22);
      glow.addColorStop(0, "rgba(232,161,90,0.7)");
      glow.addColorStop(1, "rgba(232,161,90,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x + 3, y - 84, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = lit ? C.amber : "#3c4658";
    ctx.beginPath();
    ctx.arc(x + 3, y - 82, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lit ? C.cream : "#8d97a8";
    ctx.fillRect(x + 1, y - 88, 4, 7);
  }
}

function drawGoal(ctx: CanvasRenderingContext2D, level: Level, camX: number, camY: number, time: number) {
  const x = level.goal.x - camX;
  const y = level.goal.y - camY;
  ctx.fillStyle = "#e7e1d4";
  ctx.fillRect(x, y - 116, 5, 116);
  ctx.fillStyle = C.flag;
  ctx.beginPath();
  ctx.moveTo(x + 5, y - 112);
  const wave = Math.sin(time * 4) * 5;
  ctx.quadraticCurveTo(x + 28, y - 104 + wave, x + 40, y - 96);
  ctx.lineTo(x + 40, y - 74);
  ctx.quadraticCurveTo(x + 24, y - 80 - wave, x + 5, y - 78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.cream;
  ctx.fillRect(x - 6, y - 8, 16, 6);
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], camX: number, camY: number) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.max);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.kind === "shard" ? C.danger : p.kind === "spark" ? C.amber : C.cream;
    ctx.beginPath();
    ctx.arc(p.x - camX, p.y - camY, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  art: Art,
  camX: number,
  camY: number,
  time: number,
) {
  const feetX = player.x + player.w / 2 - camX;
  const feetY = player.y + player.h - camY;
  ctx.save();
  ctx.translate(feetX, feetY + 2);
  ctx.fillStyle = "rgba(6,8,14,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const sx = 1 + player.squash;
  const sy = 1 - player.squash * 0.8;
  const frames = player.anim === "run" ? art.run : player.anim === "idle" ? art.idle : art.jump;
  ctx.save();
  ctx.translate(feetX, feetY);
  ctx.scale(player.facing * sx, sy);
  if (frames.length >= 4) {
    let index = 0;
    if (player.anim === "run") index = Math.floor(player.animTime * 10) % 4;
    else if (player.anim === "idle") index = Math.floor(player.animTime * 3.5) % 4;
    else if (player.vy < -160) index = 1;
    else if (player.vy > 180) index = 3;
    else index = 2;
    const size = 112;
    ctx.drawImage(frames[index], -size / 2, -size * 0.9, size, size);
  } else {
    drawFallbackFox(ctx, time);
  }
  ctx.restore();
}

function drawFallbackFox(ctx: CanvasRenderingContext2D, time: number) {
  ctx.fillStyle = "#1d2740";
  ctx.beginPath();
  ctx.ellipse(-6, -28, 16, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f3efe6";
  ctx.beginPath();
  ctx.ellipse(0, -30, 14, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8a15a";
  ctx.beginPath();
  ctx.moveTo(6, -46);
  ctx.lineTo(14, -58);
  ctx.lineTo(16, -44);
  ctx.fill();
  ctx.fillStyle = "#e8a15a";
  ctx.beginPath();
  ctx.arc(18, -24 + Math.sin(time * 6) * 2, 7, 0, Math.PI * 2);
  ctx.fill();
}
