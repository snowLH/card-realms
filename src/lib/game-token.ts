import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { BattleState } from "@/game/types";

type TokenPayload = {
  version: 2;
  expiresAt: number;
  state: BattleState;
};

function secret() {
  const configured = process.env.GAME_ACTION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") {
    return "card-realms-local-development-secret-change-me";
  }
  throw new Error("GAME_ACTION_SECRET não configurado.");
}

function encryptionKey() {
  return createHash("sha256").update(secret(), "utf8").digest();
}

export function signBattleState(state: BattleState) {
  const payload: TokenPayload = {
    version: 2,
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
    state,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v2.${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}

export function verifyBattleState(token: string): BattleState {
  try {
    const [version, encodedIv, encodedPayload, encodedTag] = token.split(".");
    if (version !== "v2" || !encodedIv || !encodedPayload || !encodedTag) {
      throw new Error("Formato inválido.");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(encodedIv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encodedPayload, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(decrypted) as TokenPayload;
    if (payload.version !== 2 || payload.expiresAt < Date.now() || payload.state.version !== 2) {
      throw new Error("Versão ou validade incorreta.");
    }
    return payload.state;
  } catch {
    throw new Error("A sessão de batalha é inválida ou expirou.");
  }
}

declare global {
  var __cardRealmsConsumedTokens: Set<string> | undefined;
}

const consumedTokens = globalThis.__cardRealmsConsumedTokens ?? new Set<string>();
globalThis.__cardRealmsConsumedTokens = consumedTokens;

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
