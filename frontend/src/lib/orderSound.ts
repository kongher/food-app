const ENABLED_KEY = "food-app-order-sound-enabled";
const LANG_KEY = "food-app-voice-lang";
const RATE_KEY = "food-app-voice-rate";
const PITCH_KEY = "food-app-voice-pitch";

export const DEFAULT_VOICE_RATE = 0.95;
export const DEFAULT_VOICE_PITCH = 1;
const VOICE_LANG = "th-TH";

let unlocked = false;
const pendingTables: number[] = [];

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

function parseNumber(value: string | null, fallback: number): number {
  if (value == null || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function isOrderSoundEnabled(): boolean {
  return readStorage(ENABLED_KEY) !== "0";
}

export function setOrderSoundEnabled(enabled: boolean): void {
  writeStorage(ENABLED_KEY, enabled ? "1" : "0");
}

export function getVoiceRate(): number {
  return Math.min(1.4, Math.max(0.7, parseNumber(readStorage(RATE_KEY), DEFAULT_VOICE_RATE)));
}

export function setVoiceRate(rate: number): void {
  writeStorage(RATE_KEY, String(rate));
}

export function getVoicePitch(): number {
  return Math.min(1.4, Math.max(0.7, parseNumber(readStorage(PITCH_KEY), DEFAULT_VOICE_PITCH)));
}

export function setVoicePitch(pitch: number): void {
  writeStorage(PITCH_KEY, String(pitch));
}

export function buildVoiceMessage(tableNumber: number): string {
  const table = Number.isFinite(tableNumber) && tableNumber > 0 ? Math.trunc(tableNumber) : 0;
  return `มีออเดอร์ใหม่ จากโต๊ะ ${table}`;
}

function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

function loadVoices(): SpeechSynthesisVoice[] {
  return getSynth()?.getVoices() ?? [];
}

export function findThaiVoice(): SpeechSynthesisVoice | undefined {
  const voices = loadVoices();
  return voices.find((voice) => {
    const code = voice.lang.toLowerCase().replace("_", "-");
    return code === "th-th" || code.startsWith("th-") || code === "th";
  });
}

function speakNow(text: string, rate: number, pitch: number): void {
  const synth = getSynth();
  if (!synth || !text.trim()) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = VOICE_LANG;
  utter.rate = rate;
  utter.pitch = pitch;
  utter.volume = 1;
  const voice = findThaiVoice();
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang || VOICE_LANG;
  }
  try {
    synth.resume();
    synth.speak(utter);
  } catch {
    /* ignore */
  }
}

function speakText(tableNumber: number, options?: { rate?: number; pitch?: number }): void {
  writeStorage(LANG_KEY, VOICE_LANG);
  speakNow(buildVoiceMessage(tableNumber), options?.rate ?? getVoiceRate(), options?.pitch ?? getVoicePitch());
}

function flushPending(): void {
  if (!unlocked || !pendingTables.length) return;
  const tables = pendingTables.splice(0, pendingTables.length);
  for (const tableNumber of tables) speakText(tableNumber);
}

export function unlockOrderSound(): void {
  unlocked = true;
  const synth = getSynth();
  if (synth) {
    loadVoices();
    try {
      synth.resume();
    } catch {
      /* ignore */
    }
  }
  flushPending();
}

export function playVoiceNotification(tableNumber: number): void {
  if (!isOrderSoundEnabled()) return;
  const n = Number(tableNumber);
  if (!Number.isFinite(n) || n <= 0) return;
  if (!unlocked) {
    pendingTables.push(n);
    return;
  }
  speakText(n);
}

export function previewVoiceNotification(tableNumber = 1, settings?: { rate?: number; pitch?: number }): void {
  unlockOrderSound();
  speakText(tableNumber, settings);
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    loadVoices();
  });
}
