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
