// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import { ARPG_ROC_RAID_BOSS } from "@/game/arpg/raid/content";
import { createArpgRaidState } from "@/game/arpg/raid/engine";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import { ArpgRaidArena } from "./arpg-raid-arena";

const ROOM_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const PLAYER_ID = "player-a";

function createState() {
  return createArpgRaidState(
    ROOM_ID,
    EVENT_ID,
    [
      {
        id: PLAYER_ID,
        name: "A",
        seat: 1,
        avatarConfig: { ...DEFAULT_AVATAR_CONFIG, skin: "amber", hair: "mohawk" },
        loadout: structuredClone(DEFAULT_ARPG_LOADOUT),
      },
      {
        id: "player-b",
        name: "B",
        seat: 2,
        avatarConfig: { ...DEFAULT_AVATAR_CONFIG, skin: "umber", hair: "waves" },
        loadout: structuredClone(DEFAULT_ARPG_LOADOUT),
      },
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
  it("renderiza o avatar personalizado de cada participante no campo", async () => {
    const { container } = render(<ArpgRaidArena roomId={ROOM_ID} playerId={PLAYER_ID} onClose={() => undefined} />);

    await waitFor(() => expect(screen.getByText("Roc — O Céu Desaparece")).toBeInTheDocument());
    expect(container.querySelectorAll(".arpg-raid-player__avatar .character-avatar-2d")).toHaveLength(2);
    expect(container.querySelector(".arpg-raid-player__avatar .character-avatar-2d--skin-amber.character-avatar-2d--hair-mohawk")).not.toBeNull();
    expect(container.querySelector(".arpg-raid-player__avatar .character-avatar-2d--skin-umber.character-avatar-2d--hair-waves")).not.toBeNull();
    expect(container.querySelector(".arpg-raid-player__token")).toBeNull();
  });

  it("renderiza dois ataques e controles equivalentes para teclado e gamepad", async () => {
    render(<ArpgRaidArena roomId={ROOM_ID} playerId={PLAYER_ID} onClose={() => undefined} />);

    await waitFor(() => expect(screen.getByText("Roc — O Céu Desaparece")).toBeInTheDocument());
    expect(screen.getByText("Espaço · A")).toBeInTheDocument();
    expect(screen.getByText("Shift · B")).toBeInTheDocument();
    expect(screen.getByText(/PRONTA · ↑/)).toBeInTheDocument();
    expect(screen.getByText(/PRONTA · ↓/)).toBeInTheDocument();
    expect(screen.queryByText(/PRONTA · →|PRONTA · ←/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SUPORTE|TROCAR/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Raízes Ancestrais/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chama do Boitatá/ })).toBeInTheDocument();
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
