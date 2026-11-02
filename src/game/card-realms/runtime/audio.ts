import type { CultureId } from "../domain/types";

export type CardRealmsSoundCue =
  | "card-select"
  | "card-place"
  | "summon-ritual"
  | "creature-materialize"
  | "territory-shift"
  | "structure-build"
  | "attack-clash"
  | "awakening-power"
  | "event-cast"
  | "heart-hit"
  | "turn-change"
  | "victory"
  | "defeat";

type SoundPattern = {
  notes: readonly number[];
  duration: number;
  waveform: OscillatorType;
  volume: number;
  slide?: number;
};

const CULTURE_THEME_NOTES: Readonly<Record<CultureId, readonly number[]>> = {
  brasil: [
    293.66, 349.23, 440, 0, 392, 440, 523.25, 0,
    440, 392, 349.23, 293.66, 0, 349.23, 392, 293.66,
  ],
  japao: [
    329.63, 349.23, 440, 0, 493.88, 440, 349.23, 0,
    329.63, 293.66, 220, 0, 293.66, 329.63, 349.23, 329.63,
  ],
};

const CUE_PATTERNS: Readonly<Record<CardRealmsSoundCue, SoundPattern>> = {
  "card-select": { notes: [523.25, 659.25], duration: 0.09, waveform: "sine", volume: 0.025 },
  "card-place": { notes: [220, 330], duration: 0.14, waveform: "triangle", volume: 0.035 },
  "summon-ritual": { notes: [293.66, 440, 587.33], duration: 0.28, waveform: "sine", volume: 0.038 },
  "creature-materialize": {
    notes: [392, 523.25, 659.25, 783.99],
    duration: 0.36,
    waveform: "triangle",
    volume: 0.045,
  },
  "territory-shift": {
    notes: [261.63, 329.63, 392, 523.25],
    duration: 0.32,
    waveform: "sine",
    volume: 0.036,
  },
  "structure-build": {
    notes: [196, 293.66, 392],
    duration: 0.24,
    waveform: "triangle",
    volume: 0.038,
  },
  "attack-clash": {
    notes: [360, 180],
    duration: 0.16,
    waveform: "sawtooth",
    volume: 0.042,
    slide: -110,
  },
  "awakening-power": {
    notes: [440, 554.37, 659.25, 880],
    duration: 0.38,
    waveform: "triangle",
    volume: 0.045,
  },
  "event-cast": {
    notes: [349.23, 440, 523.25, 698.46],
    duration: 0.4,
    waveform: "sine",
    volume: 0.04,
  },
  "heart-hit": {
    notes: [146.83, 110, 82.41],
    duration: 0.32,
    waveform: "sawtooth",
    volume: 0.052,
    slide: -30,
  },
  "turn-change": {
    notes: [392, 493.88],
    duration: 0.18,
    waveform: "sine",
    volume: 0.028,
  },
  victory: {
    notes: [392, 493.88, 587.33, 783.99, 987.77],
    duration: 0.72,
    waveform: "triangle",
    volume: 0.05,
  },
  defeat: {
    notes: [329.63, 261.63, 196, 146.83],
    duration: 0.72,
    waveform: "triangle",
    volume: 0.045,
  },
};

export class CardRealmsAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private culture: CultureId = "brasil";
  private themeTimer: number | null = null;
  private themeStep = 0;
  private removeGestureListeners: (() => void) | null = null;

  constructor(culture: CultureId = "brasil") {
    this.culture = culture;
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
    this.master.gain.setTargetAtTime(enabled ? 0.48 : 0, this.context.currentTime, 0.03);
    if (enabled && this.context.state === "running") {
      this.startTheme();
    } else {
      this.stopTheme();
    }
  }

  setCulture(culture: CultureId) {
    if (this.culture === culture) return;
    this.culture = culture;
    this.themeStep = 0;
  }

  async unlock() {
    if (typeof window === "undefined" || !window.AudioContext) return;
    try {
      if (!this.context) {
        this.context = new window.AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? 0.48 : 0;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") {
        await this.context.resume();
      }
      if (this.context.state === "running" && this.enabled) {
        this.startTheme();
      }
    } catch {
      // Audio remains optional when blocked by browser autoplay policy.
    }
  }

  play(cue: CardRealmsSoundCue) {
    const pattern = CUE_PATTERNS[cue];
    const context = this.context;
    const master = this.master;
    if (!this.enabled || !context || !master || context.state !== "running") return;

    const noteDuration = pattern.duration / Math.max(1, pattern.notes.length);
    const startAt = context.currentTime + 0.005;

    pattern.notes.forEach((frequency, index) => {
      const startsAt = startAt + index * noteDuration * 0.65;
      const duration = Math.max(0.07, noteDuration);
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = pattern.waveform;
      oscillator.frequency.setValueAtTime(frequency, startsAt);
      if (pattern.slide) {
        oscillator.frequency.linearRampToValueAtTime(
          Math.max(40, frequency + pattern.slide),
          startsAt + duration,
        );
      }
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

  private startTheme() {
    const context = this.context;
    const master = this.master;
    const notes = CULTURE_THEME_NOTES[this.culture];
    if (
      !this.enabled ||
      !context ||
      !master ||
      context.state !== "running" ||
      this.themeTimer !== null
    ) {
      return;
    }

    const frequency = notes[this.themeStep];
    if (frequency > 0) {
      const startsAt = context.currentTime + 0.03;
      const duration = 0.36;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, startsAt);
      envelope.gain.setValueAtTime(0.0001, startsAt);
      envelope.gain.exponentialRampToValueAtTime(0.01, startsAt + 0.04);
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
    }, 520);
  }

  private stopTheme() {
    if (this.themeTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.themeTimer);
      this.themeTimer = null;
    }
  }

  destroy() {
    this.removeGestureListeners?.();
    this.removeGestureListeners = null;
    this.stopTheme();
    const context = this.context;
    this.context = null;
    this.master?.disconnect();
    this.master = null;
    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }
}
