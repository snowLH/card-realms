import type { BattlePresentationKind } from "./presentation-events";

let audioContext: AudioContext | null = null;

function context() {
  if (typeof window === "undefined") return null;
  audioContext ??= new AudioContext();
  return audioContext;
}

export function unlockBattleAudio() {
  const ctx = context();
  if (ctx?.state === "suspended") void ctx.resume();
}

function tone(
  frequency: number,
  duration: number,
  {
    endFrequency = frequency,
    gain = 0.055,
    type = "square",
    delay = 0,
  }: {
    endFrequency?: number;
    gain?: number;
    type?: OscillatorType;
    delay?: number;
  } = {},
) {
  const ctx = context();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, endFrequency), start + duration);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume);
  volume.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function noise(duration = 0.12, gain = 0.035) {
  const ctx = context();
  if (!ctx) return;
  const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
  }
  const source = ctx.createBufferSource();
  const volume = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1450;
  volume.gain.value = gain;
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(volume);
  volume.connect(ctx.destination);
  source.start();
}

export function playBattleSfx(kind: BattlePresentationKind) {
  const ctx = context();
  if (!ctx || ctx.state !== "running") return;

  if (kind === "draw") {
    tone(540, .08, { endFrequency: 760, type: "triangle", gain: .035 });
    tone(760, .08, { endFrequency: 920, type: "triangle", gain: .025, delay: .07 });
    return;
  }

  if (kind === "energy") {
    tone(330, .16, { endFrequency: 690, type: "sine", gain: .05 });
    tone(660, .14, { endFrequency: 880, type: "triangle", gain: .025, delay: .08 });
    return;
  }

  if (kind === "roll") {
    for (let index = 0; index < 5; index += 1) {
      tone(150 + index * 32, .035, { gain: .028, delay: index * .045 });
    }
    return;
  }

  if (kind === "attack") {
    tone(190, .22, { endFrequency: 610, type: "sawtooth", gain: .05 });
    noise(.1, .035);
    return;
  }

  if (kind === "critical") {
    tone(250, .3, { endFrequency: 920, type: "sawtooth", gain: .065 });
    tone(520, .34, { endFrequency: 1180, type: "square", gain: .035, delay: .04 });
    noise(.16, .05);
    return;
  }

  if (kind === "miss") {
    tone(440, .25, { endFrequency: 125, type: "triangle", gain: .038 });
    return;
  }

  if (kind === "ko") {
    tone(260, .38, { endFrequency: 72, type: "square", gain: .052 });
    noise(.18, .025);
    return;
  }

  if (kind === "switch" || kind === "forcedSwitch" || kind === "enter") {
    tone(280, .16, { endFrequency: 510, type: "triangle", gain: .035 });
    return;
  }

  if (kind === "status") {
    tone(680, .18, { endFrequency: 480, type: "sine", gain: .028 });
    return;
  }

  if (kind === "end") {
    tone(392, .2, { endFrequency: 523, type: "triangle", gain: .04 });
    tone(523, .24, { endFrequency: 784, type: "triangle", gain: .04, delay: .18 });
  }
}
