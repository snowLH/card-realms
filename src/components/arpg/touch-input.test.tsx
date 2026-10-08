// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { TouchControls } from "./touch-controls";
import { HubTouchControls } from "./hub-touch-controls";

afterEach(cleanup);

function mount(hub = false) {
  const bridge = new ArpgBridge();
  const view = render(hub ? <HubTouchControls bridge={bridge} /> : <TouchControls
    bridge={bridge} abilityIds={["curupira-root-snare", "curupira-ember-arrow"]}
    abilityReadyAt={{}} nowMs={0} dashReadyAt={0} chestAvailable weaponBId="iron-sword"
  />);
  const stick = view.container.querySelector<HTMLDivElement>(hub ? ".arpg-hub-stick" : ".arpg-stick")!;
  stick.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON: () => ({}) });
  for (const element of [stick, ...view.container.querySelectorAll<HTMLButtonElement>("button")]) {
    const captured = new Set<number>();
    element.setPointerCapture = vi.fn((id) => { captured.add(id); });
    element.hasPointerCapture = vi.fn((id) => captured.has(id));
    element.releasePointerCapture = vi.fn((id) => { captured.delete(id); });
  }
  return { bridge, stick, ...view };
}

describe("multitouch ownership", () => {
  it.each([false, true])("a second finger cannot steal or release the joystick (hub=%s)", (hub) => {
    const { bridge, stick } = mount(hub);
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 92, clientY: 50 });
    expect(bridge.getInput().moveX).toBe(1);
    fireEvent.pointerDown(stick, { pointerId: 2, clientX: 8, clientY: 50 });
    fireEvent.pointerMove(stick, { pointerId: 2, clientX: 50, clientY: 92 });
    fireEvent.pointerUp(stick, { pointerId: 2 });
    fireEvent.lostPointerCapture(stick, { pointerId: 2 });
    expect(bridge.getInput().moveX).toBe(1);
    expect(bridge.getInput().moveY).toBe(0);
    fireEvent.pointerCancel(stick, { pointerId: 1 });
    expect(bridge.getInput().moveX).toBe(0);
    fireEvent.pointerDown(stick, { pointerId: 3, clientX: 8, clientY: 50 });
    expect(bridge.getInput().moveX).toBe(-1);
  });

  it("holding attack and moving remain independent, including unrelated pointer loss", () => {
    const { bridge, stick } = mount();
    const attack = screen.getByRole("button", { name: "Atacar e mirar no inimigo mais próximo" });
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 92, clientY: 50 });
    fireEvent.pointerDown(attack, { pointerId: 2 });
    fireEvent.pointerDown(attack, { pointerId: 3 });
    fireEvent.pointerCancel(attack, { pointerId: 2 });
    fireEvent.lostPointerCapture(attack, { pointerId: 99 });
    expect(bridge.getInput()).toMatchObject({ moveX: 1, attack: true });
    fireEvent.pointerUp(attack, { pointerId: 3 });
    expect(bridge.getInput()).toMatchObject({ moveX: 1, attack: false });
  });

  it.each(["blur", "pagehide"])("releases captured controls on %s and accepts a new gesture after return", (event) => {
    const { bridge, stick } = mount();
    const attack = screen.getByRole("button", { name: "Atacar e mirar no inimigo mais próximo" });
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 92, clientY: 50 });
    fireEvent.pointerDown(attack, { pointerId: 2 });
    fireEvent(window, new Event(event));
    expect(bridge.getInput()).toMatchObject({ moveX: 0, moveY: 0, attack: false });
    expect(stick.hasPointerCapture(1)).toBe(false);
    fireEvent.pointerDown(stick, { pointerId: 3, clientX: 8, clientY: 50 });
    expect(bridge.getInput().moveX).toBe(-1);
  });

  it("a weapon press queues once until its owner releases, without a duplicate click", () => {
    const { bridge } = mount();
    const swap = screen.getByRole("button", { name: "Trocar arma para o slot B" });
    fireEvent.pointerDown(swap, { pointerId: 1 });
    expect(bridge.consumeWeaponSwitch()).toBe(true);
    fireEvent.pointerDown(swap, { pointerId: 2 });
    fireEvent.click(swap, { detail: 1 });
    fireEvent.pointerUp(swap, { pointerId: 2 });
    expect(bridge.consumeWeaponSwitch()).toBe(false);
    fireEvent.pointerUp(swap, { pointerId: 1 });
    fireEvent.pointerDown(swap, { pointerId: 3 });
    expect(bridge.consumeWeaponSwitch()).toBe(true);
  });
});
