// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REGIONS } from "@/game/catalog";
import { HubView } from "./hub-view";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("atalhos do menu clássico", () => {
  it("resume o Arsenal ARPG com dois ataques e descreve o Refúgio sem papel de combate", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const { container } = render(
      <HubView
        playerName="Luna"
        level={1}
        coins={500}
        xp={0}
        collectionCount={0}
        currentRegionDiscoveryCount={0}
        combatReady={false}
        currentRegion={REGIONS[0]}
        source="local"
        treasureClaimed={false}
        onContinue={vi.fn()}
        onOpenCollection={vi.fn()}
        onOpenTeam={vi.fn()}
        onOpenRefuge={vi.fn()}
        onOpenRaid={vi.fn()}
        onOpenPvp={vi.fn()}
        onClaimTreasure={vi.fn()}
      />,
    );
    const cards = [...container.querySelectorAll(".hub-action-card")];
    const arsenal = cards.find((card) => card.textContent?.includes("Loadout ARPG"));
    const refuge = cards.find((card) => card.textContent?.includes("Seu refúgio"));

    expect(arsenal).toBeDefined();
    expect(arsenal!).toHaveTextContent("Arma, armadura, relíquia e 2 ataques");
    expect(arsenal!).not.toHaveTextContent(/suporte|4 cartas/i);
    expect(refuge).toBeDefined();
    expect(refuge!).toHaveTextContent("Sua casa e criaturas da coleção");
    expect(refuge!).not.toHaveTextContent(/companheiros/i);
    expect(container).toHaveTextContent("Prepare avatar e 2 poderes");
    expect(container).not.toHaveTextContent(/equipe de seis/i);
  });

  it("shows avatar and two powers as the PVP readiness contract", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const { container } = render(
      <HubView
        playerName="Luna"
        level={1}
        coins={500}
        xp={0}
        collectionCount={0}
        currentRegionDiscoveryCount={0}
        combatReady
        currentRegion={REGIONS[0]}
        source="local"
        treasureClaimed={false}
        onContinue={vi.fn()}
        onOpenCollection={vi.fn()}
        onOpenTeam={vi.fn()}
        onOpenRefuge={vi.fn()}
        onOpenRaid={vi.fn()}
        onOpenPvp={vi.fn()}
        onClaimTreasure={vi.fn()}
      />,
    );

    expect(container).toHaveTextContent("Avatar e 2 poderes prontos");
    expect(container).not.toHaveTextContent(/equipe de seis/i);
  });
});
