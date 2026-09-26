import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { BattleState } from "@/game/types";

type TokenPayload = {
  version: 1;
  expiresAt: number;
  state: BattleState;
};

const encoder = new TextEncoder();

function secret() {
  const configured = process.env.GAME_ACTION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") {
    return "card-realms-local-development-secret-change-me";
  }
  throw new Error("GAME_ACTION_SECRET não configurado.");
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signBattleState(state: BattleState) {
  const payload: TokenPayload = {
    version: 1,
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
    state,
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  return `${encoded}.${signature(encoded)}`;
}

export function verifyBattleState(token: string): BattleState {
  const [encoded, supplied] = token.split(".");
  if (!encoded || !supplied) throw new Error("Estado de batalha inválido.");
  const expected = signature(encoded);
  const suppliedBytes = encoder.encode(supplied);
  const expectedBytes = encoder.encode(expected);
  if (
    suppliedBytes.byteLength !== expectedBytes.byteLength ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    throw new Error("A assinatura da batalha não é válida.");
  }
  const payload = JSON.parse(fromBase64Url(encoded)) as TokenPayload;
  if (payload.version !== 1 || payload.expiresAt < Date.now()) {
    throw new Error("A sessão de batalha expirou.");
  }
  return payload.state;
}

declare global {
  var __cardRealmsConsumedTokens: Set<string> | undefined;
}

const consumedTokens =
  globalThis.__cardRealmsConsumedTokens ?? new Set<string>();

if (process.env.NODE_ENV !== "production") {
  globalThis.__cardRealmsConsumedTokens = consumedTokens;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function assertTokenUnused(token: string) {
  if (consumedTokens.has(tokenHash(token))) {
    throw new Error("Esta ação já foi enviada. Use o estado mais recente da batalha.");
  }
}

export function consumeToken(token: string) {
  consumedTokens.add(tokenHash(token));
  if (consumedTokens.size > 5000) {
    const first = consumedTokens.values().next().value;
    if (first) consumedTokens.delete(first);
  }
}
