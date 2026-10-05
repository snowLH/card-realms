// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { TouchControls } from "./touch-controls";

afterEach(() => cleanup());

describe("TouchControls ability cards", () => {
  it("shows each cooldown on its mobile action and queues that card", () => {
    const bridge = { queueAbility: vi.fn() } as unknown as ArpgBridge;
    render(
      <TouchControls
        bridge={bridge}
        abilityIds={["ancestral-roots", "boitata-flame"]}
        abilityReadyAt={{ "ancestral-roots": 3000 }}
        nowMs={1000}
        dashReadyAt={0}
        chestAvailable={false}
      />,
    );

    const coolingCard = screen.getByRole("button", { name: /Raízes Ancestrais: 2\.0s/ });
    expect(coolingCard).toHaveClass("is-cooling");
    expect(coolingCard).toHaveTextContent("2.0s");

    fireEvent.pointerDown(coolingCard);
    expect(bridge.queueAbility).toHaveBeenCalledWith(0);
    fireEvent.click(coolingCard, { detail: 1 });
    expect(bridge.queueAbility).toHaveBeenCalledOnce();

    expect(screen.getByRole("button", { name: /Chama do Boitatá: Pronta/ })).toHaveClass("is-ready");
  });

  it("shows the active and reserve weapon and queues a quick swap", () => {
    const bridge = { queueWeaponSwap: vi.fn() } as unknown as ArpgBridge;
    render(
      <TouchControls
        bridge={bridge}
        weaponId="forest-bow"
        secondaryWeaponId="iron-sword"
        abilityIds={["ancestral-roots", "boitata-flame"]}
        abilityReadyAt={{}}
        nowMs={0}
        dashReadyAt={0}
        chestAvailable={false}
      />,
    );

    const swap = screen.getByRole("button", { name: "Trocar arma: atual Arco da Mata, próxima Espada de Ferro" });
    expect(swap).toHaveTextContent("Arma: Arco da Mata");
    expect(swap).toHaveTextContent("Trocar por Espada de Ferro");
    fireEvent.pointerDown(swap);
    expect(bridge.queueWeaponSwap).toHaveBeenCalledOnce();
  });

  it("shows exactly two attacks and has no support controls", () => {
    const bridge = { queueAbility: vi.fn() } as unknown as ArpgBridge;
    const { container } = render(
      <TouchControls
        bridge={bridge}
        abilityIds={["ancestral-roots", "boitata-flame"]}
        abilityReadyAt={{}}
        nowMs={0}
        dashReadyAt={0}
        chestAvailable={false}
      />,
    );

    expect(container.querySelectorAll(".arpg-touch__cards button")).toHaveLength(2);
    expect(container.querySelector(".arpg-touch__support")).not.toBeInTheDocument();
    const secondAttack = screen.getByRole("button", { name: /Chama do Boitatá: Pronta/ });
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
        abilityIds={["ancestral-roots", "boitata-flame"]}
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

  it("retains attack while the touch pointer leaves the button and releases it on every end path", () => {
    const bridge = { setAttack: vi.fn() } as unknown as ArpgBridge;
    const { container } = render(
      <TouchControls
        bridge={bridge}
        abilityIds={["ancestral-roots", "boitata-flame"]}
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
        abilityIds={["ancestral-roots", "boitata-flame"]}
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
