// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import { attachArpgSharedDungeon } from "@/game/arpg/coop-dungeon/shared-run";
import { ARPG_ROC_RAID_BOSS } from "@/game/arpg/raid/content";
import { ARPG_RAID_PLAYER_MARGIN } from "@/game/arpg/raid/types";
import { createArpgRaidState } from "@/game/arpg/raid/engine";
import { ArpgRaidArena } from "./arpg-raid-arena";

const ROOM_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const PLAYER_ID = "player-a";

function createState() {
  return createArpgRaidState(
    ROOM_ID,
    EVENT_ID,
    [
      { id: PLAYER_ID, name: "A", seat: 1, loadout: structuredClone(DEFAULT_ARPG_LOADOUT) },
      { id: "player-b", name: "B", seat: 2, loadout: structuredClone(DEFAULT_ARPG_LOADOUT) },
    ],
    ARPG_ROC_RAID_BOSS,
    1_000_000,
  );
}
function payload(status: "active" | "victory" = "active") {
  const state = createState();
  state.status = status;
  if (status === "victory") state.boss.hp = 0;
  return {
    room: { id: ROOM_ID, status, version: 7 },
    event: { id: EVENT_ID, title: "Roc — O Céu Desaparece", boss_creature_id: "roc" },
    state,
    eventReward: {
      obtained: status === "victory",
      coinsAwarded: status === "victory" ? 250 : 0,
      xpAwarded: status === "victory" ? 100 : 0,
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => payload(),
  })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("ArpgRaidArena", () => {
  it("renderiza dois ataques e controles equivalentes para teclado e gamepad", async () => {
    render(<ArpgRaidArena roomId={ROOM_ID} playerId={PLAYER_ID} onClose={() => undefined} />);

    await waitFor(() => expect(screen.getByText("Roc — O Céu Desaparece")).toBeInTheDocument());
    expect(screen.getByText("Espaço · A")).toBeInTheDocument();
    expect(screen.getByText("Shift · B")).toBeInTheDocument();
    expect(screen.getByText(/PRONTA · ↑/)).toBeInTheDocument();
    expect(screen.getByText(/PRONTA · ↓/)).toBeInTheDocument();
    expect(screen.queryByText(/PRONTA · →|PRONTA · ←/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SUPORTE|TROCAR/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Raízes do Curupira/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Flecha de Brasa/ })).toBeInTheDocument();
  });

  it("não deixa input lento bloquear ataques discretos", async () => {
    const actions: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      if (String(request).includes("/actions")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string };
        actions.push(body.action ?? "unknown");
        if (body.action === "input") await new Promise((resolve) => setTimeout(resolve, 700));
        return { ok: true, json: async () => ({ state: createState(), version: 8 }) };
      }
      return { ok: true, json: async () => payload() };
    }));
    render(<ArpgRaidArena roomId={ROOM_ID} playerId={PLAYER_ID} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByText("Roc — O Céu Desaparece")).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 340));
    fireEvent.click(screen.getByRole("button", { name: /ATACAR/i }));
    await waitFor(() => expect(actions).toContain("attack"), { timeout: 400 });
    expect(actions).toContain("input");
  });

  it("envia input neutro quando a janela perde foco", async () => {
    const inputPackets: Array<{ moveX: number; moveY: number }> = [];
    vi.stubGlobal("fetch", vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      if (String(request).includes("/actions")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string; moveX?: number; moveY?: number };
        if (body.action === "input") inputPackets.push({ moveX: Number(body.moveX), moveY: Number(body.moveY) });
        return { ok: true, json: async () => ({ state: createState(), version: 8 }) };
      }
      return { ok: true, json: async () => payload() };
    }));

    render(<ArpgRaidArena roomId={ROOM_ID} playerId={PLAYER_ID} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByText("Roc — O Céu Desaparece")).toBeInTheDocument());
    window.dispatchEvent(new Event("blur"));
    await waitFor(() => expect(inputPackets.some((packet) => packet.moveX === 0 && packet.moveY === 0)).toBe(true));
  });

  it("mostra o corredor aberto e quantos aliados já chegaram à saída", async () => {
    const sharedState = attachArpgSharedDungeon(createState());
    const room = sharedState.dungeon!.rooms[sharedState.dungeon!.roomIndex];
    room.state = "awaiting_exit";
    sharedState.players[0].x = room.roomWidth + room.corridorWidth - ARPG_RAID_PLAYER_MARGIN;
    const sharedPayload = { ...payload(), state: sharedState };
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => sharedPayload,
    })));

    render(<ArpgRaidArena roomId={ROOM_ID} playerId={PLAYER_ID} onClose={() => undefined} />);

    expect(await screen.findByRole("status")).toHaveTextContent("PASSAGEM ABERTA");
    expect(screen.getByRole("status")).toHaveTextContent("1/2 na saída");
    expect(document.querySelector(".arpg-raid-dungeon-corridor.is-open")).toBeInTheDocument();
  });

  it("ignora polling antigo depois de uma versão mais nova", async () => {
    const updatedState = createState();
    updatedState.boss.hp = 9_000;
    vi.stubGlobal("fetch", vi.fn(async (request: RequestInfo | URL) => {
      if (String(request).includes("/actions")) {
        return { ok: true, json: async () => ({ state: updatedState, version: 8 }) };
      }
      return { ok: true, json: async () => payload() };
    }));
    render(<ArpgRaidArena roomId={ROOM_ID} playerId={PLAYER_ID} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByText("Roc — O Céu Desaparece")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /ATACAR/i }));
    await waitFor(() => expect(screen.getByText(/9\.000 \/ 10\.000 HP/)).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    expect(screen.getByText(/9\.000 \/ 10\.000 HP/)).toBeInTheDocument();
  });

  it("exibe apenas moedas e XP após vitória autoritativa", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => payload("victory"),
    })));
    render(<ArpgRaidArena roomId={ROOM_ID} playerId={PLAYER_ID} onClose={() => undefined} />);

    await waitFor(() => expect(screen.getByText(/RAID ARPG ENCERRADA/i)).toBeInTheDocument());
    expect(screen.getByText("✓ 250 moedas · 100 XP")).toBeInTheDocument();
    expect(screen.queryByText(/Criatura Mítica|Habilidade Mítica/)).not.toBeInTheDocument();
  });
});
