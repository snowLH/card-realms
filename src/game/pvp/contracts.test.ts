import { describe, expect, it } from "vitest";
import {
  CreateChallengeSchema,
  PvpActionSchema,
  RespondChallengeSchema,
  isSamePvpAction,
} from "./contracts";

const validAction = {
  battleId: "10000000-0000-4000-8000-000000000001",
  expectedVersion: 1,
  actionId: "20000000-0000-4000-8000-000000000002",
};

describe("contratos PVP hostis", () => {
  it.each([
    { ...validAction, action: "attack", attackId: "boitata-1", damage: 999999 },
    { ...validAction, action: "attack", attackId: "boitata-1", die: 6 },
    { ...validAction, action: "pass", winnerId: "10000000-0000-4000-8000-000000000001" },
    { ...validAction, action: "evolve", evolutionStage: 1 },
    { ...validAction, action: "victory" },
  ])("rejeita campos ou ações que tentam escolher o resultado: %o", (payload) => {
    expect(PvpActionSchema.safeParse(payload).success).toBe(false);
  });

  it("aceita apenas o comando semântico mínimo", () => {
    expect(PvpActionSchema.safeParse({
      ...validAction,
      action: "attack",
      attackId: "boitata-1",
    }).success).toBe(true);
  });

  it("aceita compra/equipamento de Poder apenas como comandos sem aceitar dano forjado", () => {
    expect(PvpActionSchema.safeParse({
      ...validAction,
      action: "draw_power",
    }).success).toBe(true);
    expect(PvpActionSchema.safeParse({
      ...validAction,
      action: "equip_power",
      creatureIndex: 0,
      cardId: "player-a:power:boitata-2:1",
      slot: 1,
    }).success).toBe(true);
    expect(PvpActionSchema.safeParse({
      ...validAction,
      action: "equip_power",
      creatureIndex: 0,
      cardId: "player-a:power:boitata-2:1",
      slot: 1,
      damage: 9999,
    }).success).toBe(false);
  });

  it("aceita desistência apenas como comando sem permitir escolher o vencedor", () => {
    expect(PvpActionSchema.safeParse({
      ...validAction,
      action: "concede",
    }).success).toBe(true);
    expect(PvpActionSchema.safeParse({
      ...validAction,
      action: "concede",
      winnerId: "10000000-0000-4000-8000-000000000001",
    }).success).toBe(false);
  });

  it("aceita Evolução apenas como comando, sem permitir escolher o resultado", () => {
    expect(PvpActionSchema.safeParse({
      ...validAction,
      action: "evolve",
    }).success).toBe(true);
    expect(PvpActionSchema.safeParse({
      ...validAction,
      action: "evolve",
      maxHp: 9999,
    }).success).toBe(false);
  });

  it("não permite forjar estado no convite ou na resposta", () => {
    expect(CreateChallengeSchema.safeParse({
      addresseeId: "20000000-0000-4000-8000-000000000002",
      status: "accepted",
    }).success).toBe(false);
    expect(RespondChallengeSchema.safeParse({
      challengeId: "20000000-0000-4000-8000-000000000002",
      response: "accept",
      actingUserId: "10000000-0000-4000-8000-000000000001",
    }).success).toBe(false);
  });

  it("distingue retry idempotente de reutilização hostil do action ID", () => {
    const action = PvpActionSchema.parse({ ...validAction, action: "pass" });
    expect(isSamePvpAction({ ...validAction, action: "pass" }, action)).toBe(true);
    expect(isSamePvpAction({ ...validAction, action: "attack", attackId: "boitata-1" }, action)).toBe(false);
  });
});
