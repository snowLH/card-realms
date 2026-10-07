import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isDungeonLootPlanValid } from "@/game/arpg/content/dungeons";
import { ArpgLoadoutSchema } from "@/game/arpg/domain/loadout-schema";
import type { ArpgLoadout } from "@/game/arpg/domain/types";
import {
  getArpgExpeditionForAtlasRegion,
  resolveAtlasEncounterTarget,
  type AtlasEncounterReference,
} from "@/game/arpg/content/atlas-encounters";
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

type ArpgRunTokenPayloadV6 = ArpgRunTokenCommon & {
  version: 6;
  lootItemIds: string[];
  dungeonSeed: string;
  initialLoadout: ArpgLoadout | null;
  atlasEncounter: AtlasEncounterReference | null;
};

type ArpgRunTokenPayload =
  | ArpgRunTokenPayloadV1
  | ArpgRunTokenPayloadV2
  | ArpgRunTokenPayloadV3
  | ArpgRunTokenPayloadV4
  | ArpgRunTokenPayloadV5
  | ArpgRunTokenPayloadV6;

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
  atlasEncounter?: AtlasEncounterReference | null,
) {
  const expedition = ARPG_EXPEDITIONS.find((item) => item.id === regionId);
  if (!expedition?.available) throw new Error("Esta expedição ainda não está disponível.");
  if (!isDungeonLootPlanValid(regionId, lootItemIds)) {
    throw new Error("Plano de loot ARPG inválido.");
  }
  const target = atlasEncounter ? resolveAtlasEncounterTarget(atlasEncounter) : null;
  if (atlasEncounter && (!target || getArpgExpeditionForAtlasRegion(atlasEncounter.regionId) !== regionId)) {
    throw new Error("O alvo do Atlas não pertence a esta expedição.");
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
  const payload: ArpgRunTokenPayloadV6 = {
    ...common,
    version: 6,
    initialLoadout: playerId ? ArpgLoadoutSchema.parse(initialLoadout) : null,
    atlasEncounter: target
      ? { kind: target.kind, regionId: target.regionId, id: target.id }
      : null,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return { token: `v${payload.version}.${encoded}.${signature(encoded)}`, payload };
}

export function verifyArpgRunToken(token: string) {
  const [versionTag, encoded, providedSignature] = token.split(".");
  if (!(["v1", "v2", "v3", "v4", "v5", "v6"].includes(versionTag)) || !encoded || !providedSignature) {
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
  const dungeonSeed = payload.version === 3 || payload.version === 4 || payload.version === 5 || payload.version === 6
    ? payload.dungeonSeed
    : `${payload.regionId}:${payload.runId}`;
  const initialLoadout = payload.version === 5
    ? payload.initialLoadout
    : payload.version === 6 ? payload.initialLoadout : null;
  const atlasEncounter = payload.version === 6 ? payload.atlasEncounter : null;
  const validInitialLoadout = payload.version === 5
    ? ArpgLoadoutSchema.safeParse(payload.initialLoadout).success
    : payload.version !== 6 || (payload.playerId === null
      ? payload.initialLoadout === null
      : ArpgLoadoutSchema.safeParse(payload.initialLoadout).success);
  const validAtlasEncounter = payload.version !== 6
    || atlasEncounter === null
    || (
      resolveAtlasEncounterTarget(atlasEncounter) !== null
      && getArpgExpeditionForAtlasRegion(atlasEncounter.regionId) === payload.regionId
    );

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
    || ((payload.version === 3 || payload.version === 4 || payload.version === 5 || payload.version === 6) && (typeof dungeonSeed !== "string" || dungeonSeed.length < 8))
    || (payload.version === 5 && payload.playerId === null)
    || !validInitialLoadout
    || !validAtlasEncounter
  ) {
    throw new Error("Sessão de run inválida ou expirada.");
  }

  return {
    ...payload,
    lootItemIds,
    dungeonSeed,
    initialLoadout,
    atlasEncounter,
  };
}
