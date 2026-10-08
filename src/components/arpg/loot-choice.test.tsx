// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ArpgHudState } from "@/game/arpg/domain/types";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { LootChoice } from "./loot-choice";

function createState(): ArpgHudState {
  return {
    nowMs: 1000,
    hp: 100,
    maxHp: 120,
    room: 4,
    roomCount: 10,
    enemiesRemaining: 0,
    weaponId: "iron-sword",
    weaponSlots: { A: "iron-sword", B: null, active: "A" },
    armorId: "leather-armor",
    relicId: "cartographer-compass",
    dungeonMap: null,
    runShards: 12,
    runMoveSpeedBonus: 0,
    runBasicDamageMultiplier: 1,
    chestAvailable: false,
    pendingLoot: { id: "forest-bow", kind: "weapon", quantity: 1, label: "Arco da Mata" },
    pendingRoomChoice: null,
    runLoot: [],
    abilityIds: ["ancestral-roots", "boitata-flame"],
    dashReadyAt: 0,
    abilityReadyAt: {},
    xpEarned: 0,
    runEnded: false,
    victory: false,
  };
}

afterEach(() => cleanup());

describe("LootChoice", () => {
  it("moves focus into the modal and keeps keyboard navigation inside its decisions", () => {
    const bridge = new ArpgBridge();
    render(<LootChoice state={createState()} bridge={bridge} />);

    const keep = screen.getByRole("button", { name: /Manter armas/i });
    const equip = screen.getByRole("button", { name: /Equipar no slot B/i });
    expect(equip).toHaveFocus();

    fireEvent.keyDown(equip, { key: "ArrowLeft" });
    expect(keep).toHaveFocus();
    fireEvent.keyDown(keep, { key: "ArrowRight" });
    expect(equip).toHaveFocus();
    fireEvent.keyDown(equip, { key: "Tab" });
    expect(keep).toHaveFocus();
    fireEvent.keyDown(keep, { key: "Tab", shiftKey: true });
    expect(equip).toHaveFocus();
  });

  it("queues the selected weapon decision exactly once", () => {
    const bridge = new ArpgBridge();
    render(<LootChoice state={createState()} bridge={bridge} />);
    fireEvent.click(screen.getByRole("button", { name: /Equipar no slot B/i }));
    expect(bridge.consumeLootDecision()).toBe("equip");
    expect(bridge.consumeLootDecision()).toBeNull();
  });
});
