// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import { useMapParty } from "./map-party";

class TestBroadcastChannel {
  static channels = new Set<TestBroadcastChannel>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  private closed = false;

  constructor(readonly name: string) {
    TestBroadcastChannel.channels.add(this);
  }

  postMessage(data: unknown) {
    queueMicrotask(() => {
      for (const channel of TestBroadcastChannel.channels) {
        if (channel === this || channel.closed || channel.name !== this.name) continue;
        channel.onmessage?.(new MessageEvent("message", { data }));
      }
    });
  }

  close() {
    this.closed = true;
    TestBroadcastChannel.channels.delete(this);
  }
}

function openLocalParty(id: string, name: string) {
  window.sessionStorage.setItem("card-realms:local-party-id", id);
  return renderHook(() => useMapParty({
    online: false,
    regionId: "enchanted-forest",
    playerName: name,
    avatar: DEFAULT_AVATAR_CONFIG,
  }));
}

afterEach(() => {
  cleanup();
  TestBroadcastChannel.channels.clear();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("salas locais de exploração conjunta", () => {
  it("aceita até quatro jogadores e recusa a quinta entrada", async () => {
    vi.stubGlobal("BroadcastChannel", TestBroadcastChannel);
    const host = openLocalParty("player-1", "Líder");
    const guests = [
      openLocalParty("player-2", "Jogador 2"),
      openLocalParty("player-3", "Jogador 3"),
      openLocalParty("player-4", "Jogador 4"),
      openLocalParty("player-5", "Jogador 5"),
    ];

    await act(async () => { await host.result.current.create(); });
    const code = host.result.current.session?.inviteCode ?? "";
    expect(code).toHaveLength(6);

    for (let index = 0; index < 3; index += 1) {
      const guest = guests[index];
      act(() => guest.result.current.setJoinCode(code));
      await act(async () => { await guest.result.current.join(); });
      await waitFor(() => {
        expect(host.result.current.members).toHaveLength(index + 2);
        expect(guest.result.current.members).toHaveLength(index + 2);
      });
    }

    const rejected = guests[3];
    act(() => rejected.result.current.setJoinCode(code));
    await act(async () => { await rejected.result.current.join(); });
    await waitFor(() => expect(rejected.result.current.session).toBeNull());

    expect(rejected.result.current.error).toContain("limite é de 4 jogadores");
    expect(host.result.current.members).toHaveLength(4);
    expect(guests[2].result.current.members).toHaveLength(4);
  });
});
