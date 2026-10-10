import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause } from "lucide-react";
import { sfx, unlockAudio } from "@/game/audio";
import { attachInput, sample, setOverrideKeys, setTouch } from "@/game/input";
import { LEVELS, levelById, nextLevelId } from "@/game/levels";
import { draw, type Art } from "@/game/render";
import { formatTime, loadSave, recordWin, type Save } from "@/game/save";
import { createSim, panTitle, step, VIEW_H, VIEW_W } from "@/game/sim";
import type { Sim } from "@/game/types";

type Screen = "title" | "play" | "pause" | "win";

declare global {
  interface Window {
    __controlsTest?: {
      getX: () => number;
      getY: () => number;
      getVx: () => number;
      getVy: () => number;
      getYaw: () => number;
      getSpeed: () => number;
      getPhase: () => string;
      setKeys: (codes: string[]) => void;
    };
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(src));
    image.src = src;
  });
}

async function loadArt(): Promise<Art> {
  const frames = (folder: string, prefix: string) =>
    Promise.all([1, 2, 3, 4].map((n) => loadImage(`/sprites/${folder}/${prefix}-${n}.png`)));
  const [idle, run, jump] = await Promise.all([frames("idle", "idle"), frames("run", "run"), frames("jump", "jump")]);
  return { idle, run, jump };
}

const emptyArt: Art = { idle: [], run: [], jump: [] };

export function BrumeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const screenRef = useRef<Screen>("title");
  const coinsRef = useRef(0);
  const jumpsRef = useRef(2);
  const litRef = useRef(false);
  const dyingRef = useRef(false);
  const [screen, setScreen] = useState<Screen>("title");
  const [levelId, setLevelId] = useState(LEVELS[0].id);
  const [coins, setCoins] = useState(0);
  const [total, setTotal] = useState(LEVELS[0].coins.length);
  const [time, setTime] = useState(0);
  const [jumps, setJumps] = useState(2);
  const [lit, setLit] = useState(false);
  const [dying, setDying] = useState(false);
  const [levelName, setLevelName] = useState(LEVELS[0].name);
  const [save, setSave] = useState<Save>({ v: 1, cleared: [], best: {} });

  useEffect(() => {
    setSave(loadSave());
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    simRef.current = createSim(levelById(LEVELS[0].id));
    let art = emptyArt;
    let alive = true;
    void loadArt()
      .then((loaded) => {
        if (alive) art = loaded;
      })
      .catch(() => undefined);

    const detach = attachInput(window);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = performance.now();
    let acc = 0;
    let raf = 0;
    let hudStamp = 0;

    const publish = (sim: Sim) => {
      const stamp = Math.floor(sim.time * 10);
      const nextCoins = sim.coins.size;
      const nextDying = sim.phase === "dead";
      const nextLit = sim.checkpointId !== null;
      if (
        stamp === hudStamp &&
        nextCoins === coinsRef.current &&
        sim.player.jumpsLeft === jumpsRef.current &&
        nextLit === litRef.current &&
        nextDying === dyingRef.current
      ) {
        return;
      }
      hudStamp = stamp;
      coinsRef.current = nextCoins;
      jumpsRef.current = sim.player.jumpsLeft;
      litRef.current = nextLit;
      dyingRef.current = nextDying;
      setCoins(nextCoins);
      setTotal(sim.level.coins.length);
      setTime(sim.time);
      setJumps(sim.player.jumpsLeft);
      setLit(nextLit);
      setDying(nextDying);
      setLevelName(sim.level.name);
      setLevelId(sim.level.id);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H) || 1;
      ctx.setTransform(
        dpr * scale,
        0,
        0,
        dpr * scale,
        (dpr * (rect.width - VIEW_W * scale)) / 2,
        (dpr * (rect.height - VIEW_H * scale)) / 2,
      );
      ctx.imageSmoothingEnabled = true;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const loop = (now: number) => {
      const sim = simRef.current;
      if (!sim) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const mode = screenRef.current;
      if (mode === "title") {
        panTitle(sim, dt);
      } else if (mode === "play") {
        acc += dt;
        const input = sample();
        if (input.pausePressed) {
          screenRef.current = "pause";
          setScreen("pause");
        } else {
          let guard = 0;
          let jumpEdge = input.jumpPressed;
          let dropEdge = input.dropPressed;
          while (acc >= 1 / 60 && guard < 4) {
            step(sim, { ...input, jumpPressed: jumpEdge, dropPressed: dropEdge }, 1 / 60);
            jumpEdge = false;
            dropEdge = false;
            acc -= 1 / 60;
            guard += 1;
            if (sim.just.jump === 1) sfx.jump();
            if (sim.just.jump === 2) sfx.djump();
            if (sim.just.coin) sfx.coin();
            if (sim.just.checkpoint) sfx.checkpoint();
            if (sim.just.land) sfx.land();
            if (sim.just.death) sfx.die();
            if (sim.just.win) {
              sfx.win();
              setSave(recordWin(sim.level.id, sim.coins.size, sim.time));
              screenRef.current = "win";
              setScreen("win");
            }
          }
        }
      } else {
        acc = 0;
        const input = sample();
        if (mode === "pause" && input.pausePressed) {
          screenRef.current = "play";
          setScreen("play");
        }
      }
      draw(ctx, sim, art, mode !== "title", reduce);
      if (mode !== "title") publish(sim);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.__controlsTest = {
      getX: () => simRef.current?.player.x ?? 0,
      getY: () => simRef.current?.player.y ?? 0,
      getVx: () => simRef.current?.player.vx ?? 0,
      getVy: () => simRef.current?.player.vy ?? 0,
      getYaw: () => 0,
      getSpeed: () => Math.abs(simRef.current?.player.vx ?? 0),
      getPhase: () => `${screenRef.current}:${simRef.current?.phase ?? "none"}`,
      setKeys: (codes: string[]) => setOverrideKeys(codes),
    };

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      detach();
      delete window.__controlsTest;
    };
  }, []);

  const boot = (id: string) => {
    unlockAudio();
    const level = levelById(id);
    simRef.current = createSim(level);
    screenRef.current = "play";
    setScreen("play");
    setLevelId(id);
    setLevelName(level.name);
    setCoins(0);
    setTotal(level.coins.length);
    setTime(0);
    setJumps(2);
    setLit(false);
    setDying(false);
    coinsRef.current = 0;
    jumpsRef.current = 2;
    litRef.current = false;
    dyingRef.current = false;
  };

  const upcoming = nextLevelId(levelId);
  const best = save.best[levelId];
  const level = levelById(levelId);

  return (
    <div className={`shell bg-bg text-fg ${screen === "play" || screen === "pause" ? "has-controls" : ""}`}>
      <div className="stage">
        <canvas ref={canvasRef} aria-label="Zone de jeu BRUME" />
        {screen !== "title" && (
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 md:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-lg border border-border bg-surface/90 px-3 py-2">
                <p className="font-display text-lg leading-none text-fg">{levelName}</p>
                <p className="mt-1 text-sm text-muted">
                  {coins}/{total} pièces · {formatTime(time)}
                </p>
                <div className="mt-2 flex items-center gap-2" aria-label="Sauts restants">
                  <span className={`size-2.5 rounded-full ${jumps >= 1 ? "bg-primary lamp-dot" : "bg-border"}`} />
                  <span className={`size-2.5 rounded-full ${jumps >= 2 ? "bg-primary" : "bg-border"}`} />
                  <span className="text-sm text-muted">{lit ? "Quai allumé" : "Aucun quai"}</span>
                </div>
              </div>
              {screen === "play" && (
                <button
                  type="button"
                  className="pointer-events-auto grid size-11 place-items-center rounded-lg border border-border bg-surface text-fg"
                  aria-label="Pause"
                  onClick={() => {
                    screenRef.current = "pause";
                    setScreen("pause");
                  }}
                >
                  <Pause className="size-5" />
                </button>
              )}
            </div>
            {dying && screen === "play" && (
              <p className="self-center rounded-lg bg-surface/90 px-4 py-2 font-display text-2xl text-danger">
                Retour au quai
              </p>
            )}
            {screen === "play" && (
              <p className="hidden text-sm text-muted md:block">
                Flèches ou ZQSD · Espace, Z ou ↑ pour sauter · S pour traverser une dalle
              </p>
            )}
          </div>
        )}

        {screen === "title" && (
          <div className="absolute inset-0 flex items-end p-3 md:items-center md:p-6">
            <div className="max-h-full w-full overflow-auto rounded-lg border border-border bg-surface/90 p-5 md:max-w-md">
              <div className="flex items-center gap-2">
                <span className="lamp-dot inline-block size-2.5 rounded-full bg-primary" />
                <span className="text-sm tracking-wide text-muted">Coursier de nuit</span>
              </div>
              <h1 className="mt-2 font-display text-5xl leading-none text-fg">BRUME</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Cours sur les quais, saute, puis saute encore. Les dalles mobiles portent, les piques et les scies
                non. Une lanterne retient ta place. Le drapeau ferme le jardin.
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {LEVELS.map((item, index) => {
                  const record = save.best[item.id];
                  const cleared = save.cleared.includes(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-3 text-left"
                        onClick={() => boot(item.id)}
                      >
                        <span>
                          <span className="block font-display text-xl text-fg">
                            {index + 1}. {item.name}
                          </span>
                          <span className="block text-sm text-muted">{item.blurb}</span>
                        </span>
                        <span className="shrink-0 text-right text-sm text-primary">
                          {cleared ? "Franchi" : "Ouvrir"}
                          {record ? (
                            <span className="mt-1 block text-muted">
                              {record.coins} p. · {formatTime(record.time)}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {screen === "pause" && (
          <Overlay title="Pause" text="La brume attend.">
            <button type="button" className="btn-primary" onClick={() => resume(screenRef, setScreen)}>
              Reprendre
            </button>
            <button type="button" className="btn-ghost" onClick={() => boot(levelId)}>
              Recommencer
            </button>
            <button type="button" className="btn-ghost" onClick={() => goTitle(screenRef, setScreen, simRef)}>
              Niveaux
            </button>
          </Overlay>
        )}

        {screen === "win" && (
          <Overlay title="Jardin franchi" text={`${level.name} · ${coins}/${total} pièces · ${formatTime(time)}`}>
            {best ? (
              <p className="text-sm text-muted">
                Meilleure récolte : {best.coins} pièces · {formatTime(best.time)}
              </p>
            ) : null}
            {upcoming ? (
              <button type="button" className="btn-primary" onClick={() => boot(upcoming)}>
                Niveau suivant
              </button>
            ) : null}
            <button type="button" className="btn-ghost" onClick={() => boot(levelId)}>
              Rejouer
            </button>
            <button type="button" className="btn-ghost" onClick={() => goTitle(screenRef, setScreen, simRef)}>
              Niveaux
            </button>
          </Overlay>
        )}
      </div>

      <div className={`touch-bar ${screen === "play" || screen === "pause" ? "is-live" : ""}`}>
        <TouchButton label="Gauche" onChange={(down) => setTouch({ left: down })}>
          <ChevronLeft className="size-7" />
        </TouchButton>
        <TouchButton label="Droite" onChange={(down) => setTouch({ right: down })}>
          <ChevronRight className="size-7" />
        </TouchButton>
        <TouchButton label="Sauter" primary onChange={(down) => setTouch({ jump: down })}>
          <span className="font-display text-xl">Saut</span>
        </TouchButton>
      </div>
    </div>
  );
}

function resume(screenRef: { current: Screen }, setScreen: (screen: Screen) => void) {
  screenRef.current = "play";
  setScreen("play");
}

function goTitle(
  screenRef: { current: Screen },
  setScreen: (screen: Screen) => void,
  simRef: { current: Sim | null },
) {
  simRef.current = createSim(levelById(LEVELS[0].id));
  screenRef.current = "title";
  setScreen("title");
}

function Overlay({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg/70 p-4">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 className="font-display text-4xl leading-none text-fg">{title}</h2>
        <p className="text-sm text-muted">{text}</p>
        {children}
      </div>
    </div>
  );
}

function TouchButton({
  label,
  primary,
  onChange,
  children,
}: {
  label: string;
  primary?: boolean;
  onChange: (down: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`flex min-h-14 items-center justify-center rounded-lg border border-border ${
        primary ? "bg-primary text-bg" : "bg-surface text-fg"
      }`}
      onPointerDown={(event) => {
        event.preventDefault();
        onChange(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={() => onChange(false)}
      onPointerCancel={() => onChange(false)}
      onLostPointerCapture={() => onChange(false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </button>
  );
}
