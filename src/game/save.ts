export type Best = { coins: number; time: number };

export type Save = {
  v: 1;
  cleared: string[];
  best: Record<string, Best>;
};

const KEY = "brume-save-v1";

const empty = (): Save => ({ v: 1, cleared: [], best: {} });

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Save;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.cleared) || typeof parsed.best !== "object") {
      return empty();
    }
    return parsed;
  } catch {
    return empty();
  }
}

export function recordWin(levelId: string, coins: number, time: number): Save {
  const save = loadSave();
  if (!save.cleared.includes(levelId)) save.cleared.push(levelId);
  const prev = save.best[levelId];
  if (!prev || coins > prev.coins || (coins === prev.coins && time < prev.time)) {
    save.best[levelId] = { coins, time };
  }
  localStorage.setItem(KEY, JSON.stringify(save));
  return save;
}

export function formatTime(time: number) {
  const safe = Math.max(0, time);
  const whole = Math.floor(safe);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
