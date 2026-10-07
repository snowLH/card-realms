// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { TouchControls } from "./touch-controls";

const CURUPIRA_ABILITIES = ["curupira-root-snare", "curupira-ember-arrow"] as [string, string];

afterEach(() => cleanup());

describe("TouchControls ability cards", () => {
  it("shows each cooldown on its mobile action and queues that card", () => {
    const bridge = { queueAbility: vi.fn() } as unknown as ArpgBridge;
    render(
      <TouchControls
        bridge={bridge}
        abilityIds={CURUPIRA_ABILITIES}
        abilityReadyAt={{ "curupira-root-snare": 3000 }}
        nowMs={1000}
        dashReadyAt={0}
        chestAvailable={false}
      />,
    );

    const coolingCard = screen.getByRole("button", { name: /Poder 1: Raízes do Curupira, 2\.0s/ });
    expect(coolingCard).toHaveClass("is-cooling");
    expect(coolingCard).toHaveTextContent("2.0s");

    fireEvent.pointerDown(coolingCard);
    expect(bridge.queueAbility).toHaveBeenCalledWith(0);
    fireEvent.click(coolingCard, { detail: 1 });
    expect(bridge.queueAbility).toHaveBeenCalledOnce();

    expect(screen.getByRole("button", { name: /Poder 2: Flecha de Brasa, Pronta/ })).toHaveClass("is-ready");
  });

  it("shows exactly two attacks and has no support controls", () => {
    const bridge = { queueAbility: vi.fn() } as unknown as ArpgBridge;
    const { container } = render(
      <TouchControls
        bridge={bridge}
        abilityIds={CURUPIRA_ABILITIES}
        abilityReadyAt={{}}
        nowMs={0}
        dashReadyAt={0}
        chestAvailable={false}
      />,
    );

    expect(container.querySelectorAll(".arpg-touch__cards button")).toHaveLength(2);
    expect(container.querySelector(".arpg-touch__support")).not.toBeInTheDocument();
    const secondAttack = screen.getByRole("button", { name: /Poder 2: Flecha de Brasa, Pronta/ });
    fireEvent.pointerDown(secondAttack);
    expect(bridge.queueAbility).toHaveBeenCalledWith(1);
  });

  it("offers a contextual touch action for an active special room", () => {
    const bridge = {
      queueAbility: vi.fn(),
      queueInteract: vi.fn(),
    } as unknown as ArpgBridge;
    render(
      <TouchControls
        bridge={bridge}
        abilityIds={CURUPIRA_ABILITIES}
        abilityReadyAt={{}}
        nowMs={0}
        dashReadyAt={0}
        chestAvailable={false}
        specialRoomAvailable
      />,
    );

    const interactButton = screen.getByRole("button", { name: "Interagir com sala especial" });
    expect(interactButton).toHaveTextContent("Interagir");
    fireEvent.pointerDown(interactButton);
    expect(bridge.queueInteract).toHaveBeenCalledOnce();
  });

  it("offers a one-touch swap when a second weapon is equipped", () => {
    const bridge = { queueWeaponSwitch: vi.fn() } as unknown as ArpgBridge;
    render(
      <TouchControls
        bridge={bridge}
        abilityIds={CURUPIRA_ABILITIES}
        abilityReadyAt={{}}
        nowMs={0}
        dashReadyAt={0}
        chestAvailable={false}
        weaponBId="iron-sword"
        activeWeaponSlot="A"
      />,
    );

    const swap = screen.getByRole("button", { name: "Trocar arma para o slot B" });
    fireEvent.pointerDown(swap);
    expect(bridge.queueWeaponSwitch).toHaveBeenCalledOnce();
  });

  it("moves the virtual joystick nub with the pointer and recenters it on release", () => {
    const bridge = { setMove: vi.fn() } as unknown as ArpgBridge;
    const { container } = render(
      <TouchControls
        bridge={bridge}
        abilityIds={CURUPIRA_ABILITIES}
        abilityReadyAt={{}}
        nowMs={0}
        dashReadyAt={0}
        chestAvailable={false}
      />,
    );
    const stick = container.querySelector<HTMLDivElement>(".arpg-stick")!;
    const nub = stick.querySelector<HTMLElement>(".arpg-stick__nub")!;
    const captured = new Set<number>();
    stick.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100,
      toJSON: () => ({}),
    });
    stick.setPointerCapture = vi.fn((pointerId) => captured.add(pointerId));
    stick.hasPointerCapture = vi.fn((pointerId) => captured.has(pointerId));

    fireEvent.pointerDown(stick, { pointerId: 7, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(stick, { pointerId: 7, clientX: 80, clientY: 40 });

    expect(bridge.setMove).toHaveBeenLastCalledWith(30 / 42, -10 / 42);
    expect(nub.style.getPropertyValue("--stick-x")).toBe("30px");
    expect(nub.style.getPropertyValue("--stick-y")).toBe("-10px");

    fireEvent.pointerUp(stick, { pointerId: 7 });
    expect(bridge.setMove).toHaveBeenLastCalledWith(0, 0);
    expect(nub.style.getPropertyValue("--stick-x")).toBe("0px");
    expect(nub.style.getPropertyValue("--stick-y")).toBe("0px");
  });

  it("retains attack while the touch pointer leaves the button and releases it on every end path", () => {
    const bridge = { setAttack: vi.fn() } as unknown as ArpgBridge;
    const { container } = render(
      <TouchControls
        bridge={bridge}
        abilityIds={CURUPIRA_ABILITIES}
        abilityReadyAt={{}}
        nowMs={0}
        dashReadyAt={0}
        chestAvailable={false}
      />,
    );
    const attack = container.querySelector<HTMLButtonElement>(".arpg-touch__attack")!;
    const captured = new Set<number>();
    attack.setPointerCapture = vi.fn((pointerId) => captured.add(pointerId));
    attack.hasPointerCapture = vi.fn((pointerId) => captured.has(pointerId));
    attack.releasePointerCapture = vi.fn((pointerId) => captured.delete(pointerId));

    fireEvent.pointerDown(attack, { pointerId: 17 });
    expect(bridge.setAttack).toHaveBeenLastCalledWith(true);
    expect(attack.setPointerCapture).toHaveBeenCalledWith(17);
    fireEvent.pointerUp(attack, { pointerId: 17 });
    expect(bridge.setAttack).toHaveBeenLastCalledWith(false);
    expect(attack.releasePointerCapture).toHaveBeenCalledWith(17);

    fireEvent.pointerDown(attack, { pointerId: 18 });
    fireEvent.pointerCancel(attack, { pointerId: 18 });
    expect(bridge.setAttack).toHaveBeenLastCalledWith(false);
    fireEvent.keyDown(attack, { code: "Space" });
    expect(bridge.setAttack).toHaveBeenLastCalledWith(true);
    fireEvent.keyUp(attack, { code: "Space" });
    expect(bridge.setAttack).toHaveBeenLastCalledWith(false);
  });

  it("keeps attack keyboard input from reaching Phaser movement shortcuts", () => {
    const bridge = { setAttack: vi.fn() } as unknown as ArpgBridge;
    const { container } = render(
      <TouchControls
        bridge={bridge}
        abilityIds={CURUPIRA_ABILITIES}
        abilityReadyAt={{}}
        nowMs={0}
        dashReadyAt={0}
        chestAvailable={false}
      />,
    );
    const attack = container.querySelector<HTMLButtonElement>(".arpg-touch__attack")!;
    const bubblesToWindow = vi.fn();
    window.addEventListener("keydown", bubblesToWindow);
    fireEvent.keyDown(attack, { code: "Space" });
    expect(bridge.setAttack).toHaveBeenLastCalledWith(true);
    expect(bubblesToWindow).not.toHaveBeenCalled();
    window.removeEventListener("keydown", bubblesToWindow);
  });
});
