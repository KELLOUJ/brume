import type { Checkpoint, Coin, Hazard, Level, Platform } from "./types";

const GH = 260;

function solid(id: string, x: number, y: number, w: number, h = GH): Platform {
  return { id, x, y, w, h, kind: "solid" };
}

function deck(id: string, x: number, y: number, w: number, h = 18): Platform {
  return { id, x, y, w, h, kind: "oneway" };
}

function slide(
  id: string,
  x: number,
  y: number,
  w: number,
  axis: "x" | "y",
  amp: number,
  period: number,
  phase = 0,
  h = 20,
  kind: Platform["kind"] = "solid",
): Platform {
  return { id, x, y, w, h, kind, move: { axis, amp, period, phase } };
}

function spike(id: string, x: number, y: number, w = 96): Hazard {
  return { id, x, y, w, h: 26, kind: "spike" };
}

function saw(
  id: string,
  x: number,
  y: number,
  amp: number,
  period: number,
  phase = 0,
  axis: "x" | "y" = "x",
): Hazard {
  return {
    id,
    x,
    y,
    w: 46,
    h: 46,
    kind: "saw",
    move: { axis, amp, period, phase },
  };
}

function coins(list: Array<[string, number, number]>): Coin[] {
  return list.map(([id, x, y]) => ({ id, x, y }));
}

function marks(list: Array<[string, number, number]>): Checkpoint[] {
  return list.map(([id, x, y]) => ({ id, x, y }));
}

const quai: Level = {
  id: "quai",
  name: "Quai des Lucioles",
  blurb: "Le saut, puis le second souffle.",
  width: 3920,
  height: 900,
  spawn: { x: 72, y: 418 },
  killY: 860,
  platforms: [
    solid("a", 0, 468, 700),
    solid("b", 860, 468, 520),
    deck("step", 1460, 348, 180),
    solid("c", 1700, 468, 400),
    slide("m1", 2240, 424, 160, "x", 150, 3.5, 0.4),
    solid("d", 2520, 468, 1280),
    deck("high", 2940, 278, 170),
  ],
  hazards: [spike("sp1", 3220, 442, 120)],
  coins: coins([
    ["q1", 340, 390],
    ["q2", 780, 300],
    ["q3", 1120, 400],
    ["q4", 1550, 300],
    ["q5", 1960, 248],
    ["q6", 2360, 360],
    ["q7", 3020, 220],
    ["q8", 3580, 390],
  ]),
  checkpoints: marks([
    ["qc1", 1880, 468],
    ["qc2", 2660, 468],
  ]),
  goal: { x: 3680, y: 468 },
};

const jardins: Level = {
  id: "jardins",
  name: "Jardins Suspendus",
  blurb: "Les dalles bougent. Le vide aussi.",
  width: 2760,
  height: 920,
  spawn: { x: 90, y: 590 },
  killY: 880,
  platforms: [
    solid("start", 40, 640, 340, 120),
    deck("p1", 430, 524, 170),
    deck("p2", 680, 404, 160),
    deck("p3", 450, 292, 170),
    solid("ledge", 700, 188, 260, 56),
    slide("mx", 1040, 210, 150, "x", 70, 2.9, 0),
    slide("my", 1340, 250, 140, "y", 80, 2.8, 1.1),
    solid("isle", 1580, 228, 380, 56),
    slide("mf", 2060, 260, 150, "x", 80, 3.1, 0.5),
    solid("end", 2280, 312, 380, 80),
  ],
  hazards: [
    saw("saw1", 1840, 176, 48, 2.8, 0.4),
    spike("pit", 200, 820, 2400),
  ],
  coins: coins([
    ["j1", 180, 560],
    ["j2", 500, 460],
    ["j3", 760, 340],
    ["j4", 520, 220],
    ["j5", 820, 120],
    ["j6", 1380, 180],
    ["j7", 1840, 160],
    ["j8", 2460, 250],
  ]),
  checkpoints: marks([
    ["jc1", 820, 188],
    ["jc2", 1660, 228],
  ]),
  goal: { x: 2520, y: 312 },
};

const fleche: Level = {
  id: "fleche",
  name: "La Flèche du Vent",
  blurb: "Scies, piques, et trois vides.",
  width: 4080,
  height: 920,
  spawn: { x: 70, y: 450 },
  killY: 880,
  platforms: [
    solid("a", 0, 500, 520),
    solid("b", 690, 500, 320),
    slide("fast", 1140, 468, 150, "x", 140, 2.55, 0.2),
    solid("c", 1540, 410, 380, 250),
    slide("vert", 2020, 400, 130, "y", 110, 2.6, 0.7),
    solid("d", 2280, 500, 220),
    deck("s1", 2580, 410, 90),
    deck("s2", 2760, 318, 90),
    deck("s3", 2940, 228, 100),
    solid("e", 3160, 400, 860, 240),
  ],
  hazards: [
    saw("sawF", 3420, 348, 130, 3, 0.2),
    spike("spF", 3660, 374, 100),
  ],
  coins: coins([
    ["f1", 260, 420],
    ["f2", 820, 420],
    ["f3", 1260, 400],
    ["f4", 1720, 340],
    ["f5", 2080, 240],
    ["f6", 2580, 370],
    ["f7", 2760, 270],
    ["f8", 2948, 180],
    ["f9", 3380, 320],
    ["f10", 3820, 330],
  ]),
  checkpoints: marks([
    ["fc1", 1660, 410],
    ["fc2", 2340, 500],
    ["fc3", 3220, 400],
  ]),
  goal: { x: 3880, y: 400 },
};

export const LEVELS: Level[] = [quai, jardins, fleche];

export function levelById(id: string): Level {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

export function nextLevelId(id: string): string | null {
  const index = LEVELS.findIndex((level) => level.id === id);
  return LEVELS[index + 1]?.id ?? null;
}
