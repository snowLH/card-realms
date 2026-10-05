// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CREATURES } from "@/game/catalog";
import { CollectionView } from "./collection-view";
import { TeamView } from "./team-view";

const iaraInstanceId = "00000000-0000-4000-8000-000000000101";
const teamId = "00000000-0000-4000-8000-000000000201";
const ownedIara = {
  instanceId: iaraInstanceId,
  catalogId: "iara",
  nickname: null,
  level: 1,
  xp: 0,
  bond: 0,
  variant: "standard",
  acquiredFrom: "starter",
  acquiredAt: "2026-10-01T12:00:00.000Z",
  evolutionStage: 0,
};

describe("telas de progressão da conta", () => {
  it("mostra somente a carta inicial na equipe e mantém cinco espaços vazios", () => {
    render(
      <TeamView
        team={{
          id: teamId,
          name: "Equipe principal",
          isActive: true,
          members: [{
            slot: 1,
            playerCreatureId: iaraInstanceId,
            catalogId: "iara",
            evolutionStage: 0,
          }],
        }}
        collection={[ownedIara]}
        source="local"
      />,
    );

    expect(screen.getAllByText("Gota de Iara").length).toBeGreaterThan(0);
    expect(screen.queryByText("Boitatá")).not.toBeInTheDocument();
    expect(screen.getByText("1/6 cartas selecionadas")).toBeInTheDocument();
    expect(screen.getAllByText("Espaço vazio")).toHaveLength(5);
  });

  it("oculta nome, arte e atributos das cartas ainda não encontradas", () => {
    render(<CollectionView ownedCatalogIds={["iara"]} />);

    expect(screen.getAllByText("Iara").length).toBeGreaterThan(0);
    expect(screen.queryByText("Boitatá")).not.toBeInTheDocument();
    expect(screen.getAllByText("Carta não descoberta")).toHaveLength(
      Math.min(CREATURES.length, 24) - 1,
    );
    expect(screen.getByText(`1/${CREATURES.length}`)).toBeInTheDocument();
  });
});
