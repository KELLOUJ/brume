let ctx: AudioContext | null = null;

export function unlockAudio() {
  const AC = window.AudioContext;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.045, slide = 0) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(48, freq + slide), t + dur);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  jump() {
    tone(380, 0.09, "square", 0.035, 160);
  },
  djump() {
    tone(560, 0.11, "square", 0.035, 240);
  },
  coin() {
    tone(880, 0.06, "triangle", 0.05);
    window.setTimeout(() => tone(1280, 0.09, "triangle", 0.04), 55);
  },
  checkpoint() {
    tone(494, 0.1, "sine", 0.05);
    window.setTimeout(() => tone(740, 0.16, "sine", 0.04), 80);
  },
  die() {
    tone(196, 0.28, "sawtooth", 0.04, -120);
  },
  land() {
    tone(130, 0.04, "sine", 0.03);
  },
  win() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      window.setTimeout(() => tone(freq, 0.18, "triangle", 0.05), i * 95);
    });
  },
};
