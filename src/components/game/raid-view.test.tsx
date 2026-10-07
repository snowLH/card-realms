// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerBootstrap } from "@/game/player";
import { RaidView } from "./raid-view";

const PLAYER_ID = "10000000-0000-4000-8000-000000000001";
const ROOM_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";

function jsonResponse(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    headers: new Headers({ "content-type": "application/json" }),
    text: async () => JSON.stringify(payload),
  };
}

const bootstrap: PlayerBootstrap = {
  source: "supabase",
  identity: { id: PLAYER_ID, email: null },
  snapshot: null,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RaidView reconnect", () => {
  it("retoma automaticamente uma Raid ARPG ativa após refresh", async () => {
    const onOpenRaid = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url === "/api/raids") {
        return jsonResponse({
            schedule: [],
            rewards: [],
            activeRoom: {
              roomId: ROOM_ID,
              eventId: EVENT_ID,
              status: "active",
              version: 9,
              gameplayMode: "arpg",
            },
          });
      }
      if (url === `/api/arpg/raids/rooms/${ROOM_ID}`) {
        return jsonResponse({
            room: {
              id: ROOM_ID, eventId: EVENT_ID, hostId: PLAYER_ID,
              inviteCode: "ABCD1234", status: "active", version: 9,
            },
            event: {
              id: EVENT_ID, title: "Roc — O Céu Desaparece", boss_creature_id: "roc",
              min_players: 2, max_players: 4, recommended_level: 1,
              boss_config: { gameplayMode: "arpg" },
            },
            gameplayMode: "arpg",
            participants: [
              {
                id: PLAYER_ID, name: "A", level: 1, seat: 1, isReady: true,
                presenceStatus: "ready", contribution: {},
              },
              {
                id: "player-b", name: "B", level: 1, seat: 2, isReady: true,
                presenceStatus: "ready", contribution: {},
              },
            ],
            state: {},
          });
      }
      throw new Error(`fetch inesperado: ${url}`);
    }));

    render(<RaidView bootstrap={bootstrap} onOpenRaid={onOpenRaid} />);
    await waitFor(() => expect(onOpenRaid).toHaveBeenCalledWith(ROOM_ID, "arpg"));
  });

  it("descreve a Raid com uma Lenda e seus dois ataques próprios", async () => {
    vi.stubGlobal("fetch", vi.fn(async (request: RequestInfo | URL) => {
      if (String(request) !== "/api/raids") throw new Error(`fetch inesperado: ${String(request)}`);
      return jsonResponse({
          schedule: [{
            id: EVENT_ID,
            slug: "roc-mythic",
            title: "Roc — O Céu Desaparece",
            bossCreatureId: "roc",
            startsAt: "2026-10-04T18:00:00.000Z",
            endsAt: "2026-10-04T20:00:00.000Z",
            presentationTimezone: "UTC",
            minPlayers: 2,
            maxPlayers: 4,
            recommendedLevel: 1,
            bossConfig: { gameplayMode: "arpg" },
            rewards: {},
            serverNow: "2026-10-04T18:30:00.000Z",
            status: "active",
          }],
          rewards: [],
          activeRoom: null,
          });
    }));

    render(<RaidView bootstrap={bootstrap} onOpenRaid={vi.fn()} />);
    expect(await screen.findByText("Leve sua Lenda ativa")).toBeInTheDocument();
    expect(screen.getByText("Ela entra com dois ataques próprios; armas e relíquias são conquistadas nas masmorras.")).toBeInTheDocument();
    expect(screen.queryByText(/armadura|suportes|4 cartas-habilidade/i)).not.toBeInTheDocument();
  });

  it("cria sala apenas para a dungeon ARPG, mesmo com raid antiga ativa", async () => {
    const createRoom = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      if (url === "/api/raids" && !init?.method) {
        return jsonResponse({
          schedule: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              slug: "old-card-raid",
              title: "Raid antiga",
              bossCreatureId: "roc",
              startsAt: "2026-10-04T18:00:00.000Z",
              endsAt: "2026-10-04T20:00:00.000Z",
              presentationTimezone: "UTC",
              minPlayers: 2,
              maxPlayers: 4,
              recommendedLevel: 1,
              bossConfig: { gameplayMode: "avatar" },
              rewards: {},
              serverNow: "2026-10-04T18:30:00.000Z",
              status: "active",
            },
            {
              id: EVENT_ID,
              slug: "arpg-coop-dungeon-2026-10",
              title: "Dungeon ARPG",
              bossCreatureId: "roc",
              startsAt: "2026-10-04T18:00:00.000Z",
              endsAt: "2027-10-04T18:00:00.000Z",
              presentationTimezone: "UTC",
              minPlayers: 2,
              maxPlayers: 4,
              recommendedLevel: 1,
              bossConfig: { gameplayMode: "arpg" },
              rewards: {},
              serverNow: "2026-10-04T18:30:00.000Z",
              status: "active",
            },
          ],
          rewards: [],
          activeRoom: null,
        });
      }
      if (url === "/api/raids" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { action: string; eventId: string };
        createRoom(body);
        return jsonResponse({ result: { roomId: ROOM_ID, gameplayMode: "arpg" } });
      }
      if (url === `/api/arpg/raids/rooms/${ROOM_ID}`) {
        return jsonResponse({
          room: { id: ROOM_ID, eventId: EVENT_ID, hostId: PLAYER_ID, inviteCode: "ABCD1234", status: "lobby", version: 1, gameplayMode: "arpg" },
          event: { id: EVENT_ID, title: "Dungeon ARPG", boss_creature_id: "roc", min_players: 2, max_players: 4, recommended_level: 1 },
          gameplayMode: "arpg",
          participants: [],
          state: null,
        });
      }
      throw new Error(`fetch inesperado: ${url}`);
    }));

    render(<RaidView bootstrap={bootstrap} onOpenRaid={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /CRIAR SALA DA DUNGEON/i }));
    await waitFor(() => expect(createRoom).toHaveBeenCalledWith({ action: "create", eventId: EVENT_ID }));
    expect(await screen.findByText("Código ABCD1234")).toBeInTheDocument();
  });

  it("mostra erro útil quando o servidor retorna HTML em vez de JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => "<!DOCTYPE html><title>Not found</title>",
    })));

    render(<RaidView bootstrap={bootstrap} onOpenRaid={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/serviço da expedição não foi encontrado/i);
    expect(screen.queryByText(/Unexpected token/i)).not.toBeInTheDocument();
  });
});
