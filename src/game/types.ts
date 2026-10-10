export type Axis = "x" | "y";

export type Mover = {
  axis: Axis;
  amp: number;
  period: number;
  phase: number;
};

export type Rect = { x: number; y: number; w: number; h: number };

export type Platform = Rect & {
  id: string;
  kind: "solid" | "oneway";
  move?: Mover;
};

export type Hazard = Rect & {
  id: string;
  kind: "spike" | "saw";
  move?: Mover;
};

export type Coin = { id: string; x: number; y: number };

export type Checkpoint = { id: string; x: number; y: number };

export type Level = {
  id: string;
  name: string;
  blurb: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  killY: number;
  platforms: Platform[];
  hazards: Hazard[];
  coins: Coin[];
  checkpoints: Checkpoint[];
  goal: { x: number; y: number };
};

export type Anim = "idle" | "run" | "air";

export type Player = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  jumpsLeft: number;
  coyote: number;
  jumpBuffer: number;
  cutApplied: boolean;
  riding: string | null;
  dropTimer: number;
  anim: Anim;
  animTime: number;
  squash: number;
  dust: number;
};

export type Snapshot = {
  x: number;
  y: number;
  coins: string[];
  checkpointId: string | null;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  kind: "dust" | "spark" | "shard";
};

export type Phase = "play" | "dead" | "win";

export type Just = {
  jump: 0 | 1 | 2;
  coin: number;
  checkpoint: boolean;
  land: boolean;
  death: boolean;
  win: boolean;
};

export type Sim = {
  level: Level;
  player: Player;
  time: number;
  coins: Set<string>;
  lit: Set<string>;
  checkpointId: string | null;
  snapshot: Snapshot;
  phase: Phase;
  phaseTime: number;
  shake: number;
  flash: number;
  camX: number;
  camY: number;
  particles: Particle[];
  just: Just;
};

export type InputFrame = {
  moveX: number;
  jumpHeld: boolean;
  jumpPressed: boolean;
  dropPressed: boolean;
  pausePressed: boolean;
};
