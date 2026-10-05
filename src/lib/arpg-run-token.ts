import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isDungeonLootPlanValid } from "@/game/arpg/content/dungeons";
import { ArpgLoadoutSchema } from "@/game/arpg/domain/loadout-schema";
import type { ArpgLoadout } from "@/game/arpg/domain/types";
import {
  ARPG_EXPEDITIONS,
  DEFAULT_ARPG_EXPEDITION_ID,
  type ArpgExpeditionId,
} from "@/game/arpg/content/expeditions";

type ArpgRunTokenCommon = {
  runId: string;
  playerId: string | null;
  regionId: ArpgExpeditionId;
  startedAt: number;
  expiresAt: number;
};

type ArpgRunTokenPayloadV1 = ArpgRunTokenCommon & {
  version: 1;
};

type ArpgRunTokenPayloadV2 = ArpgRunTokenCommon & {
  version: 2;
  lootItemIds: string[];
};

type ArpgRunTokenPayloadV3 = ArpgRunTokenCommon & {
  version: 3;
  lootItemIds: string[];
  dungeonSeed: string;
};

type ArpgRunTokenPayloadV4 = ArpgRunTokenCommon & {
  version: 4;
  lootItemIds: string[];
  dungeonSeed: string;
};

type ArpgRunTokenPayloadV5 = ArpgRunTokenCommon & {
  version: 5;
  lootItemIds: string[];
  dungeonSeed: string;
  initialLoadout: ArpgLoadout;
};

type ArpgRunTokenPayload =
  | ArpgRunTokenPayloadV1
  | ArpgRunTokenPayloadV2
  | ArpgRunTokenPayloadV3
  | ArpgRunTokenPayloadV4
  | ArpgRunTokenPayloadV5;

function secret() {
  const configured = process.env.GAME_ACTION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") {
    return "card-realms-local-development-secret-change-me";
  }
  throw new Error("GAME_ACTION_SECRET não configurado.");
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createArpgRunToken(
  playerId: string | null,
  regionId: ArpgExpeditionId = DEFAULT_ARPG_EXPEDITION_ID,
  lootItemIds: readonly string[],
  initialLoadout?: ArpgLoadout,
) {
  const expedition = ARPG_EXPEDITIONS.find((item) => item.id === regionId);
  if (!expedition?.available) throw new Error("Esta expedição ainda não está disponível.");
  if (!isDungeonLootPlanValid(regionId, lootItemIds)) {
    throw new Error("Plano de loot ARPG inválido.");
  }

  const now = Date.now();
  const runId = randomUUID();
  const common = {
    runId,
    playerId,
    regionId,
    lootItemIds: [...lootItemIds],
    dungeonSeed: `${regionId}:${runId}`,
    startedAt: now,
    expiresAt: now + 1000 * 60 * 60 * 24 * 7,
  };
  const payload: ArpgRunTokenPayload = playerId
    ? {
      ...common,
      version: 5,
      initialLoadout: ArpgLoadoutSchema.parse(initialLoadout),
    }
    : { ...common, version: 4 };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return { token: `v${payload.version}.${encoded}.${signature(encoded)}`, payload };
}

export function verifyArpgRunToken(token: string) {
  const [versionTag, encoded, providedSignature] = token.split(".");
  if (!(["v1", "v2", "v3", "v4", "v5"].includes(versionTag)) || !encoded || !providedSignature) {
    throw new Error("Sessão de run inválida.");
  }
  const expected = Buffer.from(signature(encoded));
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error("Assinatura da run inválida.");
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ArpgRunTokenPayload;
  const expeditionAvailable = ARPG_EXPEDITIONS.some(
    (item) => item.id === payload.regionId && item.available,
  );
  const tagMatchesPayload = versionTag === `v${payload.version}`;
  const lootItemIds = payload.version === 1
    ? []
    : Array.isArray(payload.lootItemIds) ? payload.lootItemIds : [];
  const dungeonSeed = payload.version === 3 || payload.version === 4 || payload.version === 5
    ? payload.dungeonSeed
    : `${payload.regionId}:${payload.runId}`;
  const validInitialLoadout = payload.version !== 5
    || ArpgLoadoutSchema.safeParse(payload.initialLoadout).success;

  if (
    !tagMatchesPayload
    || !expeditionAvailable
    || typeof payload.runId !== "string"
    || (payload.playerId !== null && typeof payload.playerId !== "string")
    || typeof payload.startedAt !== "number"
    || typeof payload.expiresAt !== "number"
    || payload.expiresAt <= payload.startedAt
    || payload.expiresAt < Date.now()
    || (payload.version !== 1 && !isDungeonLootPlanValid(payload.regionId, lootItemIds))
    || ((payload.version === 3 || payload.version === 4 || payload.version === 5) && (typeof dungeonSeed !== "string" || dungeonSeed.length < 8))
    || (payload.version === 5 && payload.playerId === null)
    || !validInitialLoadout
  ) {
    throw new Error("Sessão de run inválida ou expirada.");
  }

  return {
    ...payload,
    lootItemIds,
    dungeonSeed,
    initialLoadout: payload.version === 5 ? payload.initialLoadout : null,
  };
}
