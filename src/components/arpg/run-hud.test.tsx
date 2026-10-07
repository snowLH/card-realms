// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STARTER_ARPG_RELIC_ID } from "@/game/arpg/content/relics";
import type { ArpgHudState, ArpgMiniMapRoom } from "@/game/arpg/domain/types";
import { DungeonMapOverlay, RunHud } from "./run-hud";

afterEach(() => cleanup());

const rooms: ArpgMiniMapRoom[] = [
  { id: "start", gridX: 0, gridY: 0, type: "start", state: "cleared", connections: ["shop"] },
  { id: "shop", gridX: 1, gridY: 0, type: "shop", state: "active", connections: ["start", "event"] },
  { id: "event", gridX: 2, gridY: 0, type: "event", state: "discovered", connections: ["shop", "rest"] },
  { id: "rest", gridX: 3, gridY: 0, type: "rest", state: "discovered", connections: ["event", "boss"] },
  { id: "boss", gridX: 4, gridY: 0, type: "boss", state: "discovered", connections: ["rest"] },
];

function createHud(): ArpgHudState {
  return {
    nowMs: 1000, hp: 100, maxHp: 120, room: 2, roomCount: 9, enemiesRemaining: 0,
    weaponId: "forest-bow", weaponSlots: { A: "forest-bow", B: "iron-sword", active: "A" },
    armorId: "leather-armor", relicId: STARTER_ARPG_RELIC_ID,
    dungeonMap: { currentRoomId: "shop", rooms }, runShards: 12,
    runMoveSpeedBonus: 0, runBasicDamageMultiplier: 1,
    chestAvailable: false, pendingLoot: null, pendingRoomChoice: null, runLoot: [],
    abilityIds: ["curupira-root-snare", "curupira-ember-arrow"],
    dashReadyAt: 0, abilityReadyAt: {},
    xpEarned: 0, runEnded: false, victory: false,
  };
}

describe("RunHud minimap", () => {
  it("shows both weapons and marks the active slot", () => {
    render(<RunHud state={createHud()} />);

    expect(screen.getByRole("img", { name: /Slot A, arma ativa: Arco da Mata/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Slot B: Espada de Ferro/i })).toBeInTheDocument();
    expect(screen.getByText("Q trocar")).toBeInTheDocument();
  });

  it("mantém identidade visual por tipo e destaca a sala atual", () => {
    const { container } = render(<RunHud state={createHud()} />);

    expect(container.querySelector(".arpg-minimap-room.is-type-shop.is-current")).toBeInTheDocument();
    expect(container.querySelector(".arpg-minimap-room.is-type-event title")).toHaveTextContent("Evento");
    expect(container.querySelector(".arpg-minimap-room.is-type-rest title")).toHaveTextContent("Descanso");
    expect(container.querySelector(".arpg-minimap-room.is-type-boss title")).toHaveTextContent("Chefe");
  });

  it("keeps equipment names accessible alongside compactable equipment icons", () => {
    const { container } = render(<RunHud state={createHud()} />);

    expect(container.querySelectorAll(".arpg-hud__equipment")).toHaveLength(3);
    expect(screen.getByRole("img", { name: "Slot A, arma ativa: Arco da Mata" })).toHaveAttribute("title", "Slot A: Arco da Mata");
    expect(screen.getByRole("img", { name: /Relíquia equipada:/ })).toBeInTheDocument();
    expect(container.querySelectorAll(".arpg-hud__cards > span")).toHaveLength(2);
  });

  it("opens an accessible map with unknown rooms masked and a close action", () => {
    const onClose = vi.fn();
    const visibleMap = {
      currentRoomId: "start",
      rooms: [
        { id: "start", gridX: 0, gridY: 0, type: "start" as const, state: "cleared" as const, connections: ["next"] },
        { id: "next", gridX: 0, gridY: -1, type: "unknown" as const, state: "discovered" as const, connections: ["start"] },
      ],
    };
    render(<DungeonMapOverlay map={visibleMap} onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "Mapa" })).toHaveAttribute("aria-modal", "true");
    const map = screen.getByRole("img", { name: "2 salas descobertas" });
    expect(map.querySelector(".arpg-minimap-room.is-type-unknown title")).toHaveTextContent("Sala desconhecida");

    fireEvent.click(screen.getByRole("button", { name: "Fechar mapa" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
