import { describe, expect, it } from "vitest";
import { CREATURES, CREATURE_BY_ID } from "./creatures";
import { REQUESTED_CREATURE_SPECS, REQUESTED_EVOLUTION_ATLAS } from "./requested-expansion";

const requestedIds = REQUESTED_CREATURE_SPECS.map((spec) => spec.id);

describe("expansão solicitada de 100 criaturas", () => {
  it("registra exatamente as 100 espécies solicitadas com ids únicos", () => {
    expect(REQUESTED_CREATURE_SPECS).toHaveLength(100);
    expect(new Set(requestedIds).size).toBe(100);
    for (const id of requestedIds) expect(CREATURE_BY_ID.has(id)).toBe(true);
  });

  it("não duplica as espécies que já existiam no catálogo", () => {
    expect(CREATURES).toHaveLength(124);
    expect(new Set(CREATURES.map((creature) => creature.id)).size).toBe(CREATURES.length);
  });
  it("atribui linha de três estágios às 100 formas finais", () => {
    for (const id of requestedIds) {
      const creature = CREATURE_BY_ID.get(id)!;
      expect(creature.evolutionLine).toHaveLength(3);
      expect(creature.evolutionLine?.map((stage) => stage.stage)).toEqual([0, 1, 2]);
      expect(creature.evolutionLine?.[2].name).toBe(creature.name);
      expect(creature.evolutionLine?.[0].adaptation).toContain("Card Realms");
      expect(creature.evolutionLine?.[1].adaptation).toContain("Card Realms");
    }
  });

  it("usa sprites únicos para as duas pré-evoluções adaptadas", () => {
    const sprites = requestedIds.flatMap((id) => CREATURE_BY_ID.get(id)!.evolutionLine!.slice(0, 2));
    expect(sprites.every((stage) => stage.sprite.sheet === REQUESTED_EVOLUTION_ATLAS)).toBe(true);
    const positions = sprites.map((stage) => `${stage.sprite.row}:${stage.sprite.column}`);
    expect(new Set(positions).size).toBe(200);
  });
  it("atribui raridade válida a cada forma final solicitada", () => {
    const rarities = new Set(["common", "uncommon", "rare", "epic", "legendary", "mythic"]);
    for (const id of requestedIds) {
      expect(rarities.has(CREATURE_BY_ID.get(id)!.rarity)).toBe(true);
    }
  });
});
