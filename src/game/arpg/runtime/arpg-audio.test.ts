// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { ArpgAudio } from "./arpg-audio";

class FakeAudioParam {
  value = 0;
  setTargetAtTime = vi.fn();
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
}

class FakeAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeOscillator extends FakeAudioNode {
  type: OscillatorType = "sine";
  frequency = new FakeAudioParam();
  detune = new FakeAudioParam();
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

class FakeGain extends FakeAudioNode {
  gain = new FakeAudioParam();
}

class FakeAudioContext {
  static latest: FakeAudioContext | null = null;
  state: AudioContextState = "suspended";
  currentTime = 0;
  destination = new FakeAudioNode();
  oscillators: FakeOscillator[] = [];
  resume = vi.fn(async () => { this.state = "running"; });
  close = vi.fn(async () => { this.state = "closed"; });

  constructor() {
    FakeAudioContext.latest = this;
  }

  createGain() {
    return new FakeGain();
  }

  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
}

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, "AudioContext");
  FakeAudioContext.latest = null;
});

describe("ArpgAudio", () => {
  it("sintetiza a melodia após desbloqueio, pausa no mute e limpa a cena", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });

    const audio = new ArpgAudio("guild-hub");
    await audio.unlock();

    expect(FakeAudioContext.latest?.oscillators).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);

    audio.play("special-room");
    expect(FakeAudioContext.latest?.oscillators).toHaveLength(4);

    audio.setEnabled(false);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1600);
    expect(FakeAudioContext.latest?.oscillators).toHaveLength(4);

    audio.setEnabled(true);
    expect(FakeAudioContext.latest?.oscillators).toHaveLength(5);
    audio.destroy();

    expect(vi.getTimerCount()).toBe(0);
    expect(FakeAudioContext.latest?.close).toHaveBeenCalledOnce();
  });

  it("usa um tema distinto na tela de título após um gesto do jogador", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });

    const audio = new ArpgAudio("title-screen");
    await audio.unlock();

    expect(FakeAudioContext.latest?.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(261.63, 0.04);
    audio.destroy();
  });

  it.each([
    ["mata-encantada", 293.66, 146.83],
    ["arquipelago-das-mares", 349.23, 174.61],
    ["montanhas-runicas", 220, 110],
  ] as const)("troca a música de %s ao iniciar o boss", async (regionId, explorationNote, bossNote) => {
    vi.useFakeTimers();
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });

    const audio = new ArpgAudio(regionId);
    await audio.unlock();
    const context = FakeAudioContext.latest;
    expect(context?.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(explorationNote, 0.04);

    audio.setMusicMode("boss");
    expect(context?.oscillators).toHaveLength(2);
    expect(context?.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(bossNote, 0.04);
    audio.destroy();
  });
});
