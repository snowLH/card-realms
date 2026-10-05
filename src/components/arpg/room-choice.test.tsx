// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ArpgHudState } from "@/game/arpg/domain/types";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { RoomChoice } from "./room-choice";

function createState(runShards: number): ArpgHudState {
  return {
    nowMs: 1000,
    hp: 90,
    maxHp: 120,
    room: 3,
    roomCount: 10,
    enemiesRemaining: 0,
    weaponId: "forest-bow",
    secondaryWeaponId: "iron-sword",
    armorId: "leather-armor",
    relicId: "cartographer-compass",
    dungeonMap: null,
    runShards,
    chestAvailable: false,
    pendingLoot: null,
    pendingRoomChoice: {
      type: "shop",
      title: "Mercador eremita",
      description: "Troque fragmentos apenas desta run.",
      options: [
        { id: "shop-heal", label: "Tônico", description: "Recupere vida.", costShards: 10 },
        { id: "shop-power", label: "Afiar", description: "Aumente o dano.", costShards: 16 },
        { id: "shop-leave", label: "Seguir", description: "Não comprar.", costShards: 0 },
      ],
    },
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

describe("RoomChoice", () => {
  it("bloqueia compras caras quando faltam fragmentos", () => {
    const bridge = new ArpgBridge();
    render(<RoomChoice state={createState(8)} bridge={bridge} />);

    expect(screen.getByRole("button", { name: /Tônico/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Afiar/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Seguir/i })).toBeEnabled();
    expect(screen.getByText(/8 fragmentos da run/i)).toBeInTheDocument();
  });

  it("envia a escolha válida para o bridge", () => {
    const bridge = new ArpgBridge();
    render(<RoomChoice state={createState(20)} bridge={bridge} />);

    fireEvent.click(screen.getByRole("button", { name: /Afiar/i }));
    expect(bridge.consumeRoomChoice()).toBe("shop-power");
    expect(bridge.consumeRoomChoice()).toBeNull();
  });
});
