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
  it("resume o Arsenal ARPG com dois ataques da Lenda e descreve o Refúgio sem papel de combate", () => {
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
    expect(arsenal!).toHaveTextContent("Armas e relíquias das masmorras; 2 ataques da Lenda ativa");
    expect(arsenal!).not.toHaveTextContent(/armadura|suporte|4 cartas/i);
    expect(refuge).toBeDefined();
    expect(refuge!).toHaveTextContent("Personalize seu espaço e decoração");
    expect(refuge!).not.toHaveTextContent(/companheiros/i);
    expect(container).toHaveTextContent("Escolha uma Lenda e ative seus 2 ataques");
    expect(container).toHaveTextContent("2–4 jogadores · sala com convite");
    expect(container).not.toHaveTextContent(/até 5 amigos|cinco jogadores/i);
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

    expect(container).toHaveTextContent("Lenda ativa e 2 ataques próprios prontos");
    expect(container).not.toHaveTextContent(/equipe de seis/i);
  });
});
