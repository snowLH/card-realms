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
    { ...validAction, action: "ability", slot: 0, damage: 999999 },
    { ...validAction, action: "ability", slot: 2 },
    { ...validAction, action: "pass", winnerId: "10000000-0000-4000-8000-000000000001" },
    { ...validAction, action: "switch", creatureIndex: 0 },
    { ...validAction, action: "capture", creatureId: "iara" },
    { ...validAction, action: "attack", attackId: "boitata-1" },
    { ...validAction, action: "victory" },
  ])("rejeita campos ou ações que tentam escolher o resultado: %o", (payload) => {
    expect(PvpActionSchema.safeParse(payload).success).toBe(false);
  });

  it("aceita habilidade apenas por um dos dois espaços equipados", () => {
    expect(PvpActionSchema.safeParse({
      ...validAction,
      action: "ability",
      slot: 0,
    }).success).toBe(true);
    expect(PvpActionSchema.safeParse({
      ...validAction,
      action: "ability",
      slot: 1,
    }).success).toBe(true);
  });

  it("normaliza UUIDs em maiúsculas para a forma canônica do banco", () => {
    const parsed = PvpActionSchema.parse({
      ...validAction,
      battleId: "A0000000-BBBB-4CCC-8DDD-EEEEEEEEEEEE",
      actionId: "B0000000-CCCC-4DDD-8EEE-FFFFFFFFFFFF",
      action: "attack",
    });

    expect(parsed.battleId).toBe("a0000000-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(parsed.actionId).toBe("b0000000-cccc-4ddd-8eee-ffffffffffff");
    expect(CreateChallengeSchema.parse({
      addresseeId: "A0000000-BBBB-4CCC-8DDD-EEEEEEEEEEEE",
    }).addresseeId).toBe("a0000000-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(RespondChallengeSchema.parse({
      challengeId: "A0000000-BBBB-4CCC-8DDD-EEEEEEEEEEEE",
      response: "accept",
    }).challengeId).toBe("a0000000-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  });

  it("aceita entrada de movimento limitada e exige vetor de mira explícito", () => {
    expect(PvpActionSchema.safeParse({
      ...validAction,
      action: "input",
      moveX: 1,
      moveY: -1,
      aimX: 0.5,
      aimY: 0,
    }).success).toBe(true);
    expect(PvpActionSchema.safeParse({
      ...validAction,
      action: "input",
      moveX: 2,
      moveY: 0,
      aimX: 1,
      aimY: 0,
    }).success).toBe(false);
  });

  it("aceita desistência sem permitir escolher o vencedor", () => {
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
    const action = PvpActionSchema.parse({ ...validAction, action: "attack" });
    expect(isSamePvpAction({ ...validAction, action: "attack" }, action)).toBe(true);
    expect(isSamePvpAction({
      ...validAction,
      action: "ability",
      slot: 0,
    }, action)).toBe(false);
  });
});
