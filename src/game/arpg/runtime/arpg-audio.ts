import type { Rarity } from "../../domain/creatures";
import { CHEST_LOOT_RARITY_PRESENTATION } from "./chest-loot-presentation";

export type ArpgSoundCue =
  | "attack"
  | "ability"
  | "player-hit"
  | "enemy-hit"
  | "breakable-hit"
  | "breakable-break"
  | "door-close"
  | "door-open"
  | "special-room"
  | "chest"
  | "loot"
  | "boss"
  | "portal"
  | "victory"
  | "defeat";

type SoundPattern = {
  notes: number[];
  duration: number;
  waveform: OscillatorType;
  volume: number;
  slide?: number;
};

const THEME_NOTES: Record<string, readonly number[]> = {
  "guild-hub": [392, 0, 523.25, 587.33, 523.25, 0, 392, 329.63, 0, 392, 440, 523.25, 0, 587.33, 523.25, 392],
  "title-screen": [261.63, 0, 349.23, 392, 466.16, 0, 392, 349.23, 0, 293.66, 349.23, 392, 0, 466.16, 392, 349.23],
  "mata-encantada": [293.66, 0, 349.23, 440, 392, 0, 349.23, 293.66, 0, 392, 440, 523.25, 0, 440, 392, 349.23],
  "arquipelago-das-mares": [349.23, 392, 523.25, 0, 392, 523.25, 440, 0, 349.23, 392, 587.33, 523.25, 0, 440, 392, 349.23],
  "montanhas-runicas": [220, 0, 293.66, 329.63, 440, 0, 329.63, 293.66, 0, 220, 293.66, 349.23, 0, 329.63, 293.66, 220],
};
const BOSS_THEME_NOTES: Record<string, readonly number[]> = {
  "mata-encantada": [146.83, 0, 220, 196, 146.83, 0, 174.61, 196, 0, 146.83, 220, 261.63, 0, 196, 174.61, 146.83],
  "arquipelago-das-mares": [174.61, 0, 233.08, 220, 174.61, 0, 196, 220, 0, 174.61, 233.08, 261.63, 0, 220, 196, 174.61],
  "montanhas-runicas": [110, 0, 146.83, 164.81, 110, 0, 123.47, 146.83, 0, 110, 164.81, 196, 0, 146.83, 123.47, 110],
};
const THEME_STEP_SECONDS = 0.48;

const SOUND_PATTERNS: Record<ArpgSoundCue, SoundPattern> = {
  attack: { notes: [410], duration: 0.12, waveform: "sawtooth", volume: 0.035, slide: -170 },
  ability: { notes: [440, 660, 880], duration: 0.2, waveform: "triangle", volume: 0.04 },
  "player-hit": { notes: [155], duration: 0.16, waveform: "square", volume: 0.055, slide: -70 },
  "enemy-hit": { notes: [235], duration: 0.1, waveform: "triangle", volume: 0.028, slide: -85 },
  "breakable-hit": { notes: [275], duration: 0.075, waveform: "square", volume: 0.018, slide: -65 },
  "breakable-break": { notes: [205, 132], duration: 0.17, waveform: "triangle", volume: 0.03, slide: -32 },
  "door-close": { notes: [105, 78], duration: 0.19, waveform: "triangle", volume: 0.035, slide: -20 },
  "door-open": { notes: [92, 138], duration: 0.17, waveform: "triangle", volume: 0.027, slide: 28 },
  "special-room": { notes: [392, 523, 659], duration: 0.34, waveform: "sine", volume: 0.024 },
  chest: { notes: [310, 415], duration: 0.22, waveform: "sine", volume: 0.035 },
  loot: { notes: [523, 659, 784, 1047], duration: 0.34, waveform: "sine", volume: 0.045 },
  boss: { notes: [98, 73], duration: 0.28, waveform: "sawtooth", volume: 0.042, slide: -16 },
  portal: { notes: [330, 494, 740], duration: 0.4, waveform: "sine", volume: 0.035 },
  victory: { notes: [392, 494, 587, 784], duration: 0.68, waveform: "triangle", volume: 0.05 },
  defeat: { notes: [330, 247, 185, 139], duration: 0.72, waveform: "triangle", volume: 0.045 },
};

export class ArpgAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientOscillators: OscillatorNode[] = [];
  private themeTimer: number | null = null;
  private themeStep = 0;
  private musicMode: "exploration" | "boss" | "intro" | "purification" = "exploration";
  private enabled = true;
  private removeGestureListeners: (() => void) | null = null;

  constructor(private readonly regionId: string) {
    if (typeof window === "undefined") return;
    const unlock = () => void this.unlock();
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    this.removeGestureListeners = () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(enabled ? 0.52 : 0, this.context.currentTime, 0.035);
    if (THEME_NOTES[this.regionId]) {
      if (enabled && this.context.state === "running") this.startTheme();
      else this.stopTheme();
    }
  }

  setMusicMode(mode: "exploration" | "boss" | "intro" | "purification") {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    if (!THEME_NOTES[this.regionId] || !this.context || this.context.state !== "running") return;
    this.stopTheme();
    this.startTheme();
  }

  async unlock() {
    if (typeof window === "undefined" || !window.AudioContext) return;
    try {
      if (!this.context) {
        this.context = new window.AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? 0.52 : 0;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") await this.context.resume();
      if (this.context.state === "running") this.startAmbience();
    } catch {
      // Audio is an enhancement; the game remains playable when a browser blocks it.
    }
  }

  play(cue: ArpgSoundCue) {
    this.playPattern(SOUND_PATTERNS[cue]);
  }

  playLootReveal(rarity: Rarity) {
    const presentation = CHEST_LOOT_RARITY_PRESENTATION[rarity];
    const notes = [392, 494, 587, 698, 831, 988, 1175];
    this.playPattern({
      notes: notes.slice(0, presentation.noteCount),
      duration: presentation.noteDurationMs / 1000,
      waveform: "sine",
      volume: 0.035,
    });
  }

  private playPattern(pattern: SoundPattern) {
    const context = this.context;
    const master = this.master;
    if (!this.enabled || !context || !master || context.state !== "running") return;

    const noteDuration = pattern.duration / Math.max(1, pattern.notes.length);
    const startAt = context.currentTime + 0.005;
    pattern.notes.forEach((frequency, index) => {
      const startsAt = startAt + index * noteDuration * 0.62;
      const duration = Math.max(0.075, noteDuration);
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = pattern.waveform;
      oscillator.frequency.setValueAtTime(frequency, startsAt);
      if (pattern.slide) oscillator.frequency.linearRampToValueAtTime(frequency + pattern.slide, startsAt + duration);
      envelope.gain.setValueAtTime(0.0001, startsAt);
      envelope.gain.exponentialRampToValueAtTime(pattern.volume, startsAt + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(startsAt);
      oscillator.stop(startsAt + duration + 0.01);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
    });
  }

  destroy() {
    this.removeGestureListeners?.();
    this.removeGestureListeners = null;
    this.stopTheme();
    this.ambientOscillators.forEach((oscillator) => {
      try {
        oscillator.stop();
        oscillator.disconnect();
      } catch {
        // An oscillator may already have stopped during scene shutdown.
      }
    });
    this.ambientOscillators = [];
    const context = this.context;
    this.context = null;
    this.master?.disconnect();
    this.master = null;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }

  private startAmbience() {
    const context = this.context;
    const master = this.master;
    if (!context || !master || !this.enabled) return;
    if (THEME_NOTES[this.regionId]) {
      this.startTheme();
      return;
    }
    if (this.ambientOscillators.length > 0) return;

    const root = this.regionId === "arquipelago-das-mares" ? 73.42
      : this.regionId === "montanhas-runicas" ? 87.31
        : 65.41;
    [root, root * 1.5].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const ambienceGain = context.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 0 ? -4 : 5;
      ambienceGain.gain.value = index === 0 ? 0.016 : 0.008;
      oscillator.connect(ambienceGain);
      ambienceGain.connect(master);
      oscillator.start();
      this.ambientOscillators.push(oscillator);
    });
  }

  private startTheme() {
    const context = this.context;
    const master = this.master;
    const notes = this.musicMode === "intro" ? [110, 0, 0, 164.81, 0, 0, 123.47, 0]
      : this.musicMode === "purification" ? [261.63, 0, 329.63, 392, 0, 523.25, 392, 0]
      : this.musicMode === "boss"
      ? BOSS_THEME_NOTES[this.regionId] ?? THEME_NOTES[this.regionId]
      : THEME_NOTES[this.regionId];
    if (!this.enabled || !context || !master || !notes || context.state !== "running" || this.themeTimer !== null) return;

    const frequency = notes[this.themeStep];
    if (frequency > 0) {
      const startsAt = context.currentTime + 0.04;
      const duration = THEME_STEP_SECONDS * 0.72;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, startsAt);
      envelope.gain.setValueAtTime(0.0001, startsAt);
      envelope.gain.exponentialRampToValueAtTime(0.012, startsAt + 0.045);
      envelope.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(startsAt);
      oscillator.stop(startsAt + duration + 0.02);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
    }

    this.themeStep = (this.themeStep + 1) % notes.length;
    this.themeTimer = window.setTimeout(() => {
      this.themeTimer = null;
      this.startTheme();
    }, THEME_STEP_SECONDS * 1000);
  }

  private stopTheme() {
    if (this.themeTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.themeTimer);
      this.themeTimer = null;
    }
    this.themeStep = 0;
  }
}
