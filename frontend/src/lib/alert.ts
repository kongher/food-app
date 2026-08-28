import { isOrderSoundEnabled } from "./orderSound";

let audioCtx: AudioContext | null = null;
let pendingAlert = false;

function getCtx(): AudioContext {
  audioCtx ??= new AudioContext();
  return audioCtx;
}

export function unlockAudio(): void {
  const ctx = getCtx();
  if (ctx.state === "suspended") void ctx.resume();
  if (pendingAlert) {
    pendingAlert = false;
    playStaffAlert();
  }
}

function scheduleTing(ctx: AudioContext, when: number, frequency: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.2, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.16);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + 0.18);
}

function playTingTingTwice(): void {
  const ctx = getCtx();
  void ctx.resume();
  const now = ctx.currentTime;
  const pairGap = 0.2;
  const roundGap = 0.7;
  for (let round = 0; round < 2; round += 1) {
    const start = now + round * roundGap;
    scheduleTing(ctx, start, 1046);
    scheduleTing(ctx, start + pairGap, 880);
  }
}

export function playStaffAlert(options?: { force?: boolean; vibrate?: boolean }): void {
  if (!options?.force && !isOrderSoundEnabled()) return;
  try {
    if (options?.vibrate) {
      navigator.vibrate?.([120, 70, 120, 70, 180]);
    }
    const ctx = getCtx();
    if (ctx.state === "suspended") {
      pendingAlert = true;
      void ctx.resume().then(() => {
        if (!pendingAlert || ctx.state !== "running") return;
        pendingAlert = false;
        playTingTingTwice();
      });
      return;
    }
    playTingTingTwice();
  } catch {
    /* ignore autoplay limits */
  }
}
