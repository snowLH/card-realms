// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerBootstrap } from "@/game/player";
import { RaidView } from "./raid-view";

const PLAYER_ID = "10000000-0000-4000-8000-000000000001";
const ROOM_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";

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
        return {
          ok: true,
          json: async () => ({
            schedule: [],
            rewards: [],
            activeRoom: {
              roomId: ROOM_ID,
              eventId: EVENT_ID,
              status: "active",
              version: 9,
              gameplayMode: "arpg",
            },
          }),
        };
      }
      if (url === `/api/arpg/raids/rooms/${ROOM_ID}`) {
        return {
          ok: true,
          json: async () => ({
            room: {
              id: ROOM_ID, eventId: EVENT_ID, hostId: PLAYER_ID,
              inviteCode: "ABCD1234", status: "active", version: 9,
            },
            event: {
              id: EVENT_ID, title: "Roc — O Céu Desaparece", boss_creature_id: "roc",
              min_players: 2, max_players: 5, recommended_level: 1,
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
          }),
        };
      }
      throw new Error(`fetch inesperado: ${url}`);
    }));

    render(<RaidView bootstrap={bootstrap} onOpenRaid={onOpenRaid} />);
    await waitFor(() => expect(onOpenRaid).toHaveBeenCalledWith(ROOM_ID, "arpg"));
  });

  it("descreve o Arsenal ARPG da Raid como dois ataques próprios", async () => {
    vi.stubGlobal("fetch", vi.fn(async (request: RequestInfo | URL) => {
      if (String(request) !== "/api/raids") throw new Error(`fetch inesperado: ${String(request)}`);
      return {
        ok: true,
        json: async () => ({
          schedule: [{
            id: EVENT_ID,
            slug: "roc-mythic",
            title: "Roc — O Céu Desaparece",
            bossCreatureId: "roc",
            startsAt: "2026-10-04T18:00:00.000Z",
            endsAt: "2026-10-04T20:00:00.000Z",
            presentationTimezone: "UTC",
            minPlayers: 2,
            maxPlayers: 5,
            recommendedLevel: 1,
            bossConfig: { gameplayMode: "arpg" },
            rewards: {},
            serverNow: "2026-10-04T18:30:00.000Z",
            status: "active",
          }],
          rewards: [],
          activeRoom: null,
        }),
      };
    }));

    render(<RaidView bootstrap={bootstrap} onOpenRaid={vi.fn()} />);
    expect(await screen.findByText("Leve seu Arsenal ARPG")).toBeInTheDocument();
    expect(screen.getByText("Arma, armadura, relíquia e 2 ataques próprios entram congelados na sala.")).toBeInTheDocument();
    expect(screen.queryByText(/suportes|4 cartas-habilidade/i)).not.toBeInTheDocument();
  });
});
