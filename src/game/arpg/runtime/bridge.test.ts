import { describe, expect, it } from "vitest";
import { ArpgBridge } from "./bridge";

describe("ArpgBridge gameplay input clearing", () => {
  it("clears held and one-shot gameplay controls without losing room choices", () => {
    const bridge = new ArpgBridge();
    bridge.setMove(0.7, -0.4);
    bridge.setAim(1, 1);
    bridge.setAttack(true);
    bridge.queueDash();
    bridge.queueInteract();
    bridge.queueAbility(1);
    bridge.queueWeaponSwitch();
    bridge.queueRoomChoice("spirit-offering");
    bridge.queueLootDecision("equip");

    bridge.clearGameplayInput();

    expect(bridge.getInput()).toEqual({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false });
    expect(bridge.consumeDash()).toBe(false);
    expect(bridge.consumeInteract()).toBe(false);
    expect(bridge.consumeWeaponSwitch()).toBe(false);
    expect([0, 1].map((slot) => bridge.consumeAbility(slot as 0 | 1))).toEqual([
      false, false,
    ]);
    expect(bridge.consumeRoomChoice()).toBe("spirit-offering");
    expect(bridge.consumeLootDecision()).toBe("equip");
  });

  it("notifica ouvintes quando uma transição de estágio de mundo é emitida", () => {
    const bridge = new ArpgBridge();
    const transitions: unknown[] = [];
    const unsubscribe = bridge.onStageTransition((t) => transitions.push(t));

    const mockStage = {
      index: 2,
      total: 3,
      id: "mata-boitata",
      name: "Travessia do Boitatá",
      subtitle: "Margens Pantanosas",
      description: "Águas escuras",
      folkloreQuote: "Cuidado com o fogo",
      accentColor: "#4f7d8c",
      badge: "Zona 2/3",
      environmentalDetail: "Água e pontes",
    };

    bridge.emitStageTransition({
      previousStage: null,
      stage: mockStage,
      roomId: "room-2",
    });

    expect(transitions).toHaveLength(1);
    expect((transitions[0] as { stage: typeof mockStage }).stage.name).toBe("Travessia do Boitatá");

    unsubscribe();
    bridge.emitStageTransition({
      previousStage: mockStage,
      stage: { ...mockStage, index: 3, name: "Santuário das Raízes" },
      roomId: "room-5",
    });
    expect(transitions).toHaveLength(1);
  });
});
