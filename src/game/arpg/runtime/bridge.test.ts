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
    bridge.queueRoomChoice("spirit-offering");
    bridge.queueLootDecision("equip");

    bridge.clearGameplayInput();

    expect(bridge.getInput()).toEqual({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false });
    expect(bridge.consumeDash()).toBe(false);
    expect(bridge.consumeInteract()).toBe(false);
    expect([0, 1].map((slot) => bridge.consumeAbility(slot as 0 | 1))).toEqual([
      false, false,
    ]);
    expect(bridge.consumeRoomChoice()).toBe("spirit-offering");
    expect(bridge.consumeLootDecision()).toBe("equip");
  });
});
