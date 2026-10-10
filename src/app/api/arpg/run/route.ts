import { randomInt } from "node:crypto";
import { readBossProgress, recordStoredBossProgress } from "@/server/arpg/boss-progress";
import { confirmBossRestoration } from "@/game/arpg/bosses/boss-encounter-controller";
import { bossForRegion } from "@/game/arpg/bosses/registry";
import { isBossInputLocked } from "@/game/arpg/bosses/cinematic-input-lock";
import { getRunShardReward } from "@/game/arpg/dungeon/special-rooms";
import { ARPG_DUNGEON_CONFIGS } from "@/game/arpg/content/dungeons";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDungeonLootPlan } from "@/game/arpg/content/dungeons";
import {
  ARPG_EXPEDITIONS,
  DEFAULT_ARPG_EXPEDITION_ID,
  getArpgExpedition,
} from "@/game/arpg/content/expeditions";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import {
  getLegendAppearance,
  hasExactLegendPowers,
  PLAYABLE_LEGENDS,
} from "@/game/arpg/content/legends";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { ARPG_ARMOR_IDS } from "@/game/arpg/content/equipment";
import { getLocalDungeonCompletionReward } from "@/game/arpg/dungeon/rewards";
import {
  ARPG_RELIC_BY_ID,
  getRelicXpMultiplier,
  STARTER_ARPG_RELIC_ID,
} from "@/game/arpg/content/relics";
import { ArpgLoadoutSchema } from "@/game/arpg/domain/loadout-schema";
import type { ArpgLoadout } from "@/game/arpg/domain/types";
import { generateDungeon } from "@/game/arpg/dungeon/generator";
import { populateArpgDungeonContent } from "@/game/arpg/dungeon/content";
import { computeRoomDistances } from "@/game/arpg/dungeon/graph";
import {
  ArpgClientRunCheckpointSchema,
  ArpgRunCheckpointSchema,
  createInitialArpgRunCheckpoint,
  isValidArpgRunCheckpoint,
  isValidArpgRunCheckpointTransition,
  getArpgCombatRewardDeltas,
} from "@/game/arpg/dungeon/run-checkpoint";
import {
  applyArpgDungeonCombatCommand,
  createArpgDungeonCombatState,
  isValidArpgCombatEntryPosition,
  type ArpgDungeonCombatCommand,
} from "@/game/arpg/dungeon/combat-authority";
import { createArpgRunToken, verifyArpgRunToken } from "@/lib/arpg-run-token";
import {
  getArpgExpeditionForAtlasRegion,
  resolveAtlasEncounterTarget,
  type AtlasEncounterReference,
} from "@/game/arpg/content/atlas-encounters";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { validateArpgLoadoutOwnership } from "@/server/arpg/loadout-authority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function legendForFrozenRun(loadout: Pick<ArpgLoadout, "abilityIds">) {
  const legend = PLAYABLE_LEGENDS.find((candidate) => (
    hasExactLegendPowers(loadout.abilityIds, candidate.id)
  ));
  return legend ?? null;
}

function avatarForFrozenRun(loadout: ArpgLoadout): AvatarConfig | null {
  const legend = legendForFrozenRun(loadout);
  return legend ? {
    ...DEFAULT_AVATAR_CONFIG,
    ...getLegendAppearance(legend.id),
    favoriteLegendId: legend.id,
  } : null;
}

function sameAtlasEncounter(
  left: AtlasEncounterReference | null,
  right: AtlasEncounterReference | null,
) {
  return left === null
    ? right === null
    : right !== null
      && left.kind === right.kind
      && left.regionId === right.regionId
      && left.id === right.id;
}

const ExpeditionIdSchema = z.enum(["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"]);

const RequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    expeditionId: ExpeditionIdSchema.default(DEFAULT_ARPG_EXPEDITION_ID),
    atlasEncounter: z.object({
      kind: z.enum(["wild", "npc"]),
      regionId: z.string().min(1).max(40),
      id: z.string().min(1).max(80),
    }).strict().optional(),
  }),
  z.object({
    action: z.literal("checkpoint"),
    token: z.string().min(32),
    expectedRevision: z.number().int().min(0),
    checkpoint: ArpgClientRunCheckpointSchema,
  }),
  z.object({
    action: z.literal("encounter"),
    token: z.string().min(32),
    expectedRevision: z.number().int().min(0),
    roomId: z.string().min(1).max(40),
    command: z.strictObject({
      actionId: z.string().min(1).max(100),
      kind: z.enum(["sync", "basic_attack", "ability", "dash", "skip_intro"]),
      playerX: z.number().finite().min(0).max(4_096),
      playerY: z.number().finite().min(0).max(4_096),
      aimX: z.number().finite().min(-1).max(1),
      aimY: z.number().finite().min(-1).max(1),
      abilitySlot: z.number().int().min(0).max(1).optional(),
    }).superRefine((command, context) => {
      if (command.kind === "ability" && command.abilitySlot === undefined) {
        context.addIssue({ code: "custom", path: ["abilitySlot"], message: "A carta-habilidade não foi informada." });
      }
      if (command.kind !== "ability" && command.abilitySlot !== undefined) {
        context.addIssue({ code: "custom", path: ["abilitySlot"], message: "Esta ação não usa carta-habilidade." });
      }
    }),
  }),
  z.object({
    action: z.literal("complete"),
    token: z.string().min(32),
    victory: z.boolean(),
  }),
]);

const RewardSchema = z.object({
  coins: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  victory: z.boolean(),
  items: z.array(z.string()),
  runLootItems: z.array(z.string()).optional(),
  runLootReplayed: z.boolean().optional(),
  newItems: z.array(z.string()).optional(),
  replayed: z.boolean().optional(),
  persisted: z.boolean().optional(),
});

const StartResultSchema = z.object({
  runId: z.string().uuid(),
  expeditionId: ExpeditionIdSchema,
  dungeonSeed: z.string().min(8),
  startRoomId: z.string().min(1),
  bossRoomId: z.string().min(1),
  lootItemIds: z.array(z.string()).length(4),
  token: z.string().min(32),
  checkpoint: z.unknown(),
  loadout: ArpgLoadoutSchema.optional(),
  revision: z.number().int().nonnegative(),
  resumed: z.boolean(),
});

const ActiveRunSchema = z.object({
  runId: z.string().uuid(),
  expeditionId: ExpeditionIdSchema,
  dungeonSeed: z.string().min(8),
  checkpoint: z.unknown(),
  updatedAt: z.string(),
  expiresAt: z.string(),
});

const CompletionRunSchema = ActiveRunSchema.extend({
  status: z.enum(["active", "extracted", "defeated"]),
});

function secureRandomUnit() {
  return randomInt(0, 0x1000000) / 0x1000000;
}

function rpcStatus(code?: string) {
  if (code === "P0002" || code === "23505" || code === "22023") return 409;
  return 500;
}

async function authenticatedPlayerId() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") return null;
  return data.claims.sub;
}

export async function POST(request: Request) {
  try {
    const parsed = RequestSchema.parse(await request.json());
    const playerId = await authenticatedPlayerId();

    if (parsed.action === "start") {
      const expedition = ARPG_EXPEDITIONS.find((item) => item.id === parsed.expeditionId);
      if (!expedition?.available) {
        return NextResponse.json(
          { error: "Esta expedição ainda não está disponível." },
          { status: 409 },
        );
      }

      let initialLoadout: ArpgLoadout = DEFAULT_ARPG_LOADOUT;
      const atlasTarget = parsed.atlasEncounter
        ? resolveAtlasEncounterTarget(parsed.atlasEncounter)
        : null;
      if (parsed.atlasEncounter && (
        !atlasTarget
        || getArpgExpeditionForAtlasRegion(parsed.atlasEncounter.regionId) !== parsed.expeditionId
      )) {
        return NextResponse.json({ error: "O alvo do Atlas não pertence a esta expedição." }, { status: 409 });
      }
      if (playerId) {
        const admin = createAdminClient();
        const { data: loadoutRow, error: loadoutError } = await admin
          .from("player_arpg_loadouts")
          .select("weapon_id, armor_id, relic_id, ability_ids")
          .eq("user_id", playerId)
          .maybeSingle();
        if (loadoutError) {
          console.error("Falha ao ler loadout ARPG para a run.", loadoutError.code);
          return NextResponse.json({ error: "O loadout do Arsenal não pôde ser validado." }, { status: 500 });
        }
        if (loadoutRow) {
          const savedLoadout = ArpgLoadoutSchema.safeParse({
            weaponId: loadoutRow.weapon_id,
            armorId: DEFAULT_ARPG_LOADOUT.armorId,
            relicId: loadoutRow.relic_id,
            abilityIds: loadoutRow.ability_ids,
          });
          if (!savedLoadout.success) {
            console.error("Loadout salvo inválido para início de run.", savedLoadout.error.issues);
            return NextResponse.json({ error: "O loadout salvo no Arsenal é inválido." }, { status: 409 });
          }
          initialLoadout = savedLoadout.data;
        }

        const ownership = await validateArpgLoadoutOwnership(admin, playerId, initialLoadout);
        if (!ownership.valid && ownership.reason === "inventory_unavailable") {
          console.error("Falha ao validar posse do loadout ARPG.", ownership.code);
          return NextResponse.json({ error: "A coleção não pôde ser validada para iniciar a expedição." }, { status: 500 });
        }
        if (!ownership.valid) {
          return NextResponse.json({ error: "O loadout contém equipamento ou poderes que esta conta não possui." }, { status: 409 });
        }
      }

      if (!legendForFrozenRun(initialLoadout)) {
        return NextResponse.json(
          { error: "A Lenda da run precisa levar exatamente seus dois poderes de assinatura." },
          { status: 409 },
        );
      }

      const lootPlan = createDungeonLootPlan(parsed.expeditionId, secureRandomUnit);
      const lootItemIds = lootPlan.map((item) => item.id);
      const session = createArpgRunToken(
        playerId,
        parsed.expeditionId,
        lootItemIds,
        playerId ? initialLoadout : undefined,
        atlasTarget ? {
          kind: atlasTarget.kind,
          regionId: atlasTarget.regionId,
          id: atlasTarget.id,
        } satisfies AtlasEncounterReference : null,
      );
      const graph = generateDungeon({ seed: session.payload.dungeonSeed, regionId: parsed.expeditionId });
      const initialCheckpoint = createInitialArpgRunCheckpoint({
        startRoomId: graph.startRoomId,
        weaponId: initialLoadout.weaponId,
        armorId: initialLoadout.armorId,
        maxHp: 120,
      });

      if (playerId) {
        const admin = createAdminClient();
        const { data, error } = await admin.rpc("begin_or_resume_arpg_run", {
          target_player_id: playerId,
          target_run_id: session.payload.runId,
          target_expedition_id: parsed.expeditionId,
          target_dungeon_seed: session.payload.dungeonSeed,
          target_start_room_id: graph.startRoomId,
          target_boss_room_id: graph.bossRoomId,
          target_loot_item_ids: lootItemIds,
          target_signed_token: session.token,
          target_checkpoint: initialCheckpoint,
        });
        if (error) {
          console.error("Falha ao iniciar ou retomar run ARPG.", error.code);
          return NextResponse.json({ error: "A run persistente não pôde ser iniciada." }, { status: rpcStatus(error.code) });
        }

        const activeRun = StartResultSchema.safeParse(data);
        if (!activeRun.success) {
          console.error("Resposta de run persistente incompatível.", activeRun.error.issues);
          return NextResponse.json({ error: "A sessão persistente retornou dados incompatíveis." }, { status: 500 });
        }
        if (activeRun.data.expeditionId !== parsed.expeditionId) {
          return NextResponse.json({
            error: `Você tem uma run ativa em ${getArpgExpedition(activeRun.data.expeditionId).name}. Retome-a antes de iniciar outra expedição.`,
            activeRun: { expeditionId: activeRun.data.expeditionId },
          }, { status: 409 });
        }

        const storedSession = verifyArpgRunToken(activeRun.data.token);
        const requestedTarget = atlasTarget
          ? { kind: atlasTarget.kind, regionId: atlasTarget.regionId, id: atlasTarget.id }
          : null;
        if (activeRun.data.resumed && !sameAtlasEncounter(storedSession.atlasEncounter, requestedTarget)) {
          const savedTarget = storedSession.atlasEncounter
            ? resolveAtlasEncounterTarget(storedSession.atlasEncounter)
            : null;
          return NextResponse.json({
            error: savedTarget
              ? `Retome a run ativa para ${savedTarget.name} antes de escolher outro encontro.`
              : "Retome ou conclua sua run ativa antes de iniciar este encontro do Atlas.",
          }, { status: 409 });
        }
        const checkpoint = ArpgRunCheckpointSchema.safeParse(activeRun.data.checkpoint);
        const activeLoadout = storedSession.initialLoadout
          ?? (checkpoint.success ? {
            ...initialLoadout,
            weaponId: checkpoint.data.weaponId,
            armorId: checkpoint.data.armorId,
          } : null);
        if (!activeLoadout || !legendForFrozenRun(activeLoadout)) {
          return NextResponse.json(
            { error: "A run salva não contém exatamente os dois poderes de uma Lenda jogável." },
            { status: 409 },
          );
        }
        const matchesCurrentLoadout = activeLoadout
          && activeLoadout.weaponId === initialLoadout.weaponId
          && activeLoadout.armorId === initialLoadout.armorId
          && activeLoadout.relicId === initialLoadout.relicId
          && activeLoadout.abilityIds[0] === initialLoadout.abilityIds[0]
          && activeLoadout.abilityIds[1] === initialLoadout.abilityIds[1];
        if (activeLoadout && !matchesCurrentLoadout) {
          const ownership = await validateArpgLoadoutOwnership(admin, playerId, activeLoadout);
          if (!ownership.valid && ownership.reason === "inventory_unavailable") {
            console.error("Falha ao validar posse do snapshot da run ARPG.", ownership.code);
            return NextResponse.json({ error: "O loadout salvo da expedição não pôde ser validado." }, { status: 500 });
          }
          if (!ownership.valid) {
            return NextResponse.json({ error: "A run salva contém poderes ou equipamentos que esta conta não possui." }, { status: 409 });
          }
        }
        const activeGraph = generateDungeon({
          seed: activeRun.data.dungeonSeed,
          regionId: activeRun.data.expeditionId,
        });
        if (
          storedSession.runId !== activeRun.data.runId
          || storedSession.playerId !== playerId
          || storedSession.regionId !== activeRun.data.expeditionId
          || storedSession.dungeonSeed !== activeRun.data.dungeonSeed
          || storedSession.lootItemIds.join("\0") !== activeRun.data.lootItemIds.join("\0")
          || activeRun.data.startRoomId !== activeGraph.startRoomId
          || activeRun.data.bossRoomId !== activeGraph.bossRoomId
          || !checkpoint.success
          || !activeLoadout
          || !isValidArpgRunCheckpoint(activeGraph, checkpoint.data, activeRun.data.lootItemIds)
        ) {
          console.error("Checkpoint salvo da run inválido.", checkpoint.success ? undefined : checkpoint.error.issues);
          return NextResponse.json({ error: "O checkpoint salvo não passou pela validação do mapa." }, { status: 409 });
        }

        const runAvatar = avatarForFrozenRun(activeLoadout);
        return NextResponse.json({
          token: activeRun.data.token,
          runId: activeRun.data.runId,
          regionId: activeRun.data.expeditionId,
          persistent: true,
          lootItemIds: activeRun.data.lootItemIds,
          runSeed: activeRun.data.dungeonSeed,
          checkpoint: checkpoint.data,
          loadout: activeLoadout,
          avatarConfig: runAvatar,
          legendId: runAvatar?.legendId ?? null,
          atlasEncounter: storedSession.atlasEncounter,
          revision: activeRun.data.revision,
          resumed: activeRun.data.resumed,
        });
      }

      return NextResponse.json({
        token: session.token,
        runId: session.payload.runId,
        regionId: session.payload.regionId,
        persistent: false,
        lootItemIds,
        runSeed: session.payload.dungeonSeed,
        checkpoint: initialCheckpoint,
        revision: 0,
        resumed: false,
        atlasEncounter: verifyArpgRunToken(session.token).atlasEncounter,
      });
    }

    let session: ReturnType<typeof verifyArpgRunToken>;
    try {
      session = verifyArpgRunToken(parsed.token);
    } catch (error) {
      if (error instanceof Error && error.message.includes("GAME_ACTION_SECRET")) throw error;
      return NextResponse.json({ error: "Esta run expirou ou tem uma assinatura inválida." }, { status: 401 });
    }
    if (session.playerId && session.playerId !== playerId) {
      return NextResponse.json({ error: "Esta run pertence a outra sessão." }, { status: 403 });
    }

    if (parsed.action === "encounter") {
      if (!session.playerId || !playerId || !session.initialLoadout) {
        return NextResponse.json({ error: "O combate autoritativo exige uma run persistente autenticada." }, { status: 403 });
      }

      const graph = generateDungeon({ seed: session.dungeonSeed, regionId: session.regionId });
      populateArpgDungeonContent(graph);
      const admin = createAdminClient();
      const { data: activeRunData, error: activeRunError } = await admin.rpc("get_active_arpg_run", {
        target_player_id: playerId,
      });
      if (activeRunError) {
        console.error("Falha ao carregar encontro autoritativo ARPG.", activeRunError.code);
        return NextResponse.json({ error: "O estado do combate não pôde ser carregado." }, { status: 500 });
      }

      const activeRun = ActiveRunSchema.safeParse(activeRunData);
      const storedCheckpoint = activeRun.success
        ? ArpgRunCheckpointSchema.safeParse(activeRun.data.checkpoint)
        : null;
      if (
        !activeRun.success
        || activeRun.data.runId !== session.runId
        || activeRun.data.expeditionId !== session.regionId
        || activeRun.data.dungeonSeed !== session.dungeonSeed
        || !storedCheckpoint?.success
        || !isValidArpgRunCheckpoint(graph, storedCheckpoint.data, session.lootItemIds)
      ) {
        return NextResponse.json({ error: "A run salva não corresponde ao encontro solicitado." }, { status: 409 });
      }

      const previous = storedCheckpoint.data;
      const room = graph.rooms[parsed.roomId];
      if (
        previous.currentRoomId !== parsed.roomId
        || previous.clearedRoomIds.includes(parsed.roomId)
        || !room
        || !["combat", "elite", "boss"].includes(room.type)
      ) {
        return NextResponse.json({ error: "A sala de combate não está ativa nesta run." }, { status: 409 });
      }

      const existingCombat = previous.serverCombatState;
      if (
        existingCombat
        && existingCombat.roomId !== parsed.roomId
        && !previous.clearedRoomIds.includes(existingCombat.roomId)
      ) {
        return NextResponse.json({ error: "O encontro anterior ainda não foi validado como concluído." }, { status: 409 });
      }

      const loadout: ArpgLoadout = {
        ...session.initialLoadout,
        weaponId: previous.weaponId,
        armorId: previous.armorId,
      };
      const nowMs = Date.now();
      const bossProgress = room.type === "boss" ? await readBossProgress(admin, playerId) : undefined;
      if (
        (!existingCombat || existingCombat.roomId !== parsed.roomId)
        && !isValidArpgCombatEntryPosition(
          graph,
          parsed.roomId,
          previous.clearedRoomIds,
          parsed.command.playerX,
          parsed.command.playerY,
        )
      ) {
        return NextResponse.json({ error: "O combate precisa começar na entrada física da sala." }, { status: 409 });
      }
      let combatState = existingCombat?.roomId === parsed.roomId
        ? {
          ...existingCombat,
          // The versioned run checkpoint is the authority for the active
          // weapon slot. Rebase the encounter weapon after a between-action
          // slot switch was saved, while preserving cooldowns and enemy state.
          weaponId: previous.weaponId,
          // Breakable props grant checkpoint-owned shards during combat. Fold those
          // rewards into the encounter baseline before its next authoritative step.
          baseRunShards: previous.runShards - existingCombat.runShards,
        }
        : createArpgDungeonCombatState({
          graph,
          roomId: parsed.roomId,
          loadout,
          playerHp: previous.playerHp,
          maxHp: previous.maxHp,
          playerX: parsed.command.playerX,
          playerY: parsed.command.playerY,
          runMoveSpeedBonus: previous.runMoveSpeedBonus,
          runBasicDamageMultiplier: previous.runBasicDamageMultiplier,
          xpMultiplier: getRelicXpMultiplier(ARPG_RELIC_BY_ID.get(loadout.relicId) ?? ARPG_RELIC_BY_ID.get(STARTER_ARPG_RELIC_ID)!),
          baseXpEarned: previous.xpEarned,
          baseRunShards: previous.runShards,
          nowMs,
          seenBossIntro: bossProgress?.seenBossIntroIds.includes(bossForRegion(session.regionId).id),
        });
      let confirmedProgress = bossProgress;
      let restorationError: string | undefined;
      if (combatState.bossEncounter?.state === "RESTORED") {
        const receipt = await recordStoredBossProgress(admin, { playerId, runId: session.runId }, true);
        if (receipt.confirmed) {
          confirmBossRestoration(combatState.bossEncounter, combatState.bossEncounter.bossId, true, nowMs);
          const enemy = combatState.enemies.find((enemy) => enemy.definitionId === "boss");
          if (enemy?.alive) {
            enemy.alive = false;
            const definition = ARPG_DUNGEON_CONFIGS[session.regionId].enemies.boss;
            combatState.xpEarned += Math.round(definition.rewardXp * combatState.xpMultiplier);
            combatState.runShards += getRunShardReward(definition.rewardXp);
          }
          confirmedProgress = receipt.progress;
        } else restorationError = receipt.error;
      }
      try {
        combatState = applyArpgDungeonCombatCommand({
          state: combatState,
          graph,
          loadout,
          command: parsed.command as ArpgDungeonCombatCommand,
          nowMs,
        });
      } catch (error) {
        if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 409 });
        throw error;
      }

      const nextCheckpoint = {
        ...previous,
        playerHp: combatState.playerHp,
        xpEarned: combatState.baseXpEarned + combatState.xpEarned,
        runShards: combatState.baseRunShards + combatState.runShards,
        serverCombatState: combatState,
      };
      if (!isValidArpgRunCheckpoint(graph, nextCheckpoint, session.lootItemIds)) {
        console.error("O simulador gerou um checkpoint de combate inválido.", { roomId: parsed.roomId });
        return NextResponse.json({ error: "O resultado do encontro não passou pela validação da run." }, { status: 500 });
      }

      const { data, error } = await admin.rpc("save_arpg_run_checkpoint", {
        target_player_id: playerId,
        target_run_id: session.runId,
        target_expected_revision: parsed.expectedRevision,
        target_checkpoint: nextCheckpoint,
      });
      if (error) {
        console.error("Falha ao salvar estado do combate ARPG.", error.code);
        return NextResponse.json({ error: "O estado do combate não pôde ser salvo." }, { status: rpcStatus(error.code) });
      }
      const saveResult = z.object({
        conflict: z.boolean(),
        revision: z.number().int().nonnegative(),
      }).safeParse(data);
      if (!saveResult.success) {
        console.error("Resposta de combate ARPG incompatível.", saveResult.error.issues);
        return NextResponse.json({ error: "O estado do combate salvo retornou dados incompatíveis." }, { status: 500 });
      }
      if (saveResult.data.conflict) {
        return NextResponse.json({
          error: "O combate foi atualizado em outra sessão. Reabra a expedição para sincronizar o estado.",
          revision: saveResult.data.revision,
        }, { status: 409 });
      }
      if (combatState.bossEncounter && ["COMBAT", "DEFEATED", "PURIFICATION"].includes(combatState.bossEncounter.state)
        && !bossProgress?.seenBossIntroIds.includes(combatState.bossEncounter.bossId)) {
        const seen = await recordStoredBossProgress(admin, { playerId, runId: session.runId }, false);
        if (seen.confirmed) confirmedProgress = seen.progress;
      }
      return NextResponse.json({
        authoritative: true,
        bossProgress: confirmedProgress,
        restorationError,
        revision: saveResult.data.revision,
        state: combatState,
      });
    }

    if (parsed.action === "checkpoint") {
      const graph = generateDungeon({ seed: session.dungeonSeed, regionId: session.regionId });
      if (!isValidArpgRunCheckpoint(graph, parsed.checkpoint, session.lootItemIds)) {
        return NextResponse.json({ error: "O checkpoint não corresponde à rota válida desta dungeon." }, { status: 409 });
      }

      if (!session.playerId || !playerId) {
        return NextResponse.json({ persisted: false, revision: parsed.expectedRevision + 1 });
      }

      const admin = createAdminClient();
      const { data: activeRunData, error: activeRunError } = await admin.rpc("get_active_arpg_run", {
        target_player_id: playerId,
      });
      if (activeRunError) {
        console.error("Falha ao validar progressão do checkpoint ARPG.", activeRunError.code);
        return NextResponse.json({ error: "A progressão atual da run não pôde ser validada." }, { status: 500 });
      }
      const activeRun = ActiveRunSchema.safeParse(activeRunData);
      const previousCheckpoint = activeRun.success
        ? ArpgRunCheckpointSchema.safeParse(activeRun.data.checkpoint)
        : null;
      const nextCheckpoint = previousCheckpoint?.success
        ? {
          ...parsed.checkpoint,
          ...(previousCheckpoint.data.serverCombatState
            ? {
              serverCombatState: {
                ...previousCheckpoint.data.serverCombatState,
                // The transition validator ties each newly broken prop to one
                // shard; carry only that increment into the combat proof baseline.
                baseRunShards: previousCheckpoint.data.serverCombatState.baseRunShards
                  + parsed.checkpoint.brokenBreakableIds.filter(
                    (id) => !previousCheckpoint.data.brokenBreakableIds.includes(id),
                  ).length,
              },
            }
            : {}),
        }
        : null;
      if (
        !activeRun.success
        || activeRun.data.runId !== session.runId
        || activeRun.data.expeditionId !== session.regionId
        || activeRun.data.dungeonSeed !== session.dungeonSeed
        || !previousCheckpoint?.success
        || !nextCheckpoint
        || (isBossInputLocked(previousCheckpoint?.success ? previousCheckpoint.data.serverCombatState?.bossEncounter?.state : undefined)
          && (parsed.checkpoint.weaponId !== previousCheckpoint?.data?.weaponId || parsed.checkpoint.armorId !== previousCheckpoint?.data?.armorId))
        || !isValidArpgRunCheckpoint(graph, previousCheckpoint.data, session.lootItemIds)
        || !isValidArpgRunCheckpointTransition(
          graph,
          previousCheckpoint.data,
          nextCheckpoint,
          session.lootItemIds,
        )
      ) {
        return NextResponse.json({ error: "O checkpoint não representa uma transição válida da run salva." }, { status: 409 });
      }

      const newlyClearedCombatRoomId = parsed.checkpoint.clearedRoomIds.find((roomId) => (
        !previousCheckpoint.data.clearedRoomIds.includes(roomId)
        && ["combat", "elite", "boss"].includes(graph.rooms[roomId]?.type ?? "")
      ));
      if (newlyClearedCombatRoomId) {
        const combatProof = previousCheckpoint.data.serverCombatState;
        const previousBreakableIds = new Set(previousCheckpoint.data.brokenBreakableIds);
        const newBreakableCount = parsed.checkpoint.brokenBreakableIds
          .filter((id) => !previousBreakableIds.has(id)).length;
        const initialRelic = session.initialLoadout
          ? ARPG_RELIC_BY_ID.get(session.initialLoadout.relicId)
          : ARPG_RELIC_BY_ID.get(STARTER_ARPG_RELIC_ID);
        const xpMultiplier = initialRelic ? getRelicXpMultiplier(initialRelic) : 1;
        const expectedRewards = getArpgCombatRewardDeltas(graph, newlyClearedCombatRoomId, xpMultiplier);
        if (
          previousCheckpoint.data.currentRoomId !== newlyClearedCombatRoomId
          || combatProof?.roomId !== newlyClearedCombatRoomId
          || combatProof.status !== "victory"
          || !expectedRewards
          || combatProof.xpEarned !== expectedRewards.xp
          || combatProof.runShards !== expectedRewards.runShards
          || parsed.checkpoint.runShards !== combatProof.baseRunShards + combatProof.runShards + newBreakableCount
          || (
            parsed.checkpoint.xpEarned !== combatProof.baseXpEarned + combatProof.xpEarned
          )
          || parsed.checkpoint.playerHp !== combatProof.playerHp
        ) {
          return NextResponse.json({
            error: "O clear não corresponde à simulação autoritativa do encontro.",
          }, { status: 409 });
        }
      }

      if (!isValidArpgRunCheckpoint(graph, nextCheckpoint, session.lootItemIds)) {
        return NextResponse.json({ error: "O checkpoint com o resultado do encontro é inválido." }, { status: 409 });
      }

      const { data, error } = await admin.rpc("save_arpg_run_checkpoint", {
        target_player_id: playerId,
        target_run_id: session.runId,
        target_expected_revision: parsed.expectedRevision,
        target_checkpoint: nextCheckpoint,
      });
      if (error) {
        console.error("Falha ao salvar checkpoint ARPG.", error.code);
        return NextResponse.json({ error: "O checkpoint não pôde ser salvo." }, { status: rpcStatus(error.code) });
      }

      const checkpointResult = z.object({
        conflict: z.boolean(),
        revision: z.number().int().nonnegative(),
        checkpoint: z.unknown(),
        updatedAt: z.string().optional(),
      }).safeParse(data);
      if (!checkpointResult.success) {
        console.error("Resposta de checkpoint ARPG incompatível.", checkpointResult.error.issues);
        return NextResponse.json({ error: "O checkpoint salvo retornou dados incompatíveis." }, { status: 500 });
      }
      if (checkpointResult.data.conflict) {
        return NextResponse.json({
          error: "Esta run foi atualizada em outra sessão. Reabra a expedição para carregar o checkpoint mais recente.",
          revision: checkpointResult.data.revision,
        }, { status: 409 });
      }
      return NextResponse.json({ persisted: true, revision: checkpointResult.data.revision });
    }

    if (!session.playerId || !playerId) {
      return NextResponse.json({
        persisted: false,
        reward: {
          ...getLocalDungeonCompletionReward(session.regionId, parsed.victory),
          victory: parsed.victory,
          items: [],
          replayed: false,
        },
      });
    }

    const admin = createAdminClient();
    const { data: completionRunData, error: completionRunError } = await admin.rpc("get_arpg_run_for_completion", {
      target_player_id: playerId,
      target_run_id: session.runId,
    });
    const completionRun = CompletionRunSchema.safeParse(completionRunData);
    if (
      completionRunError
      || !completionRun.success
      || completionRun.data.runId !== session.runId
      || completionRun.data.expeditionId !== session.regionId
      || completionRun.data.dungeonSeed !== session.dungeonSeed
    ) {
      return NextResponse.json({ error: "O resultado da run não corresponde ao checkpoint salvo." }, { status: 409 });
    }

    if (completionRun.data.status === "active") {
      const activeCheckpoint = ArpgRunCheckpointSchema.safeParse(completionRun.data.checkpoint);
      const activeGraph = generateDungeon({
        seed: completionRun.data.dungeonSeed,
        regionId: completionRun.data.expeditionId,
      });
      if (
        !activeCheckpoint.success
        || !isValidArpgRunCheckpoint(activeGraph, activeCheckpoint.data, session.lootItemIds)
      ) {
        return NextResponse.json({ error: "O resultado da run não corresponde ao checkpoint salvo." }, { status: 409 });
      }
      const storedCombat = activeCheckpoint.data.serverCombatState;
      if (
        (parsed.victory && (
          !activeCheckpoint.data.exitPortalAvailable
          || activeCheckpoint.data.currentRoomId !== activeGraph.bossRoomId
          || !activeCheckpoint.data.clearedRoomIds.includes(activeGraph.bossRoomId)
          || storedCombat?.roomId !== activeGraph.bossRoomId
          || storedCombat.status !== "victory"
          || activeCheckpoint.data.playerHp <= 0
        ))
        || (!parsed.victory && (
          activeCheckpoint.data.playerHp > 0
          || storedCombat?.status !== "defeat"
          || storedCombat.playerHp > 0
        ))
      ) {
        return NextResponse.json({ error: "O resultado ainda não foi comprovado pelo simulador de combate." }, { status: 409 });
      }
    }

    // The RPC validates the signed loot and requested outcome on retries,
    // returning the saved result without awarding or finalizing the run again.
    const { data, error } = await admin.rpc("finish_arpg_run", {
      target_player_id: playerId,
      target_run_id: session.runId,
      target_expedition_id: session.regionId,
      target_victory: parsed.victory,
      target_loot_item_ids: session.lootItemIds,
    });

    if (error) {
      console.error("Falha ao persistir término da run ARPG.", error.code);
      return NextResponse.json({ error: "A run terminou, mas o resultado não pôde ser registrado." }, { status: rpcStatus(error.code) });
    }

    const reward = RewardSchema.parse(data);
    const activeItems = (items: string[] | undefined) => items?.filter((itemId) => !ARPG_ARMOR_IDS.has(itemId));
    return NextResponse.json({
      persisted: true,
      reward: {
        ...reward,
        items: activeItems(reward.items),
        newItems: activeItems(reward.newItems),
        runLootItems: activeItems(reward.runLootItems),
      },
    });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "A solicitação da run é inválida."
      : error instanceof Error
        ? error.message
        : "Não foi possível processar a run.";
    return NextResponse.json({ error: message }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}

export async function GET() {
  try {
    const playerId = await authenticatedPlayerId();
    if (!playerId) return NextResponse.json({ persistent: false, activeRun: null });

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("get_active_arpg_run", { target_player_id: playerId });
    if (error) {
      console.error("Falha ao consultar run ativa ARPG.", error.code);
      return NextResponse.json({ error: "A run ativa não pôde ser consultada." }, { status: 500 });
    }
    if (data === null) return NextResponse.json({ persistent: true, activeRun: null });

    const activeRun = ActiveRunSchema.safeParse(data);
    if (!activeRun.success) {
      console.error("Resposta de run ativa incompatível.", activeRun.error.issues);
      return NextResponse.json({ error: "A run ativa retornou dados incompatíveis." }, { status: 500 });
    }
    const checkpoint = ArpgRunCheckpointSchema.safeParse(activeRun.data.checkpoint);
    const graph = generateDungeon({ seed: activeRun.data.dungeonSeed, regionId: activeRun.data.expeditionId });
    if (!checkpoint.success || !isValidArpgRunCheckpoint(graph, checkpoint.data)) {
      console.error("Checkpoint ativo ARPG inválido.", checkpoint.success ? undefined : checkpoint.error.issues);
      return NextResponse.json({ error: "O checkpoint ativo não pôde ser validado." }, { status: 409 });
    }

    return NextResponse.json({
      persistent: true,
      activeRun: {
        runId: activeRun.data.runId,
        expeditionId: activeRun.data.expeditionId,
        currentRoom: (computeRoomDistances(graph).get(checkpoint.data.currentRoomId) ?? 0) + 1,
        clearedRoomCount: checkpoint.data.clearedRoomIds.length,
        roomCount: Object.keys(graph.rooms).length,
        updatedAt: activeRun.data.updatedAt,
      },
    });
  } catch (error) {
    console.error("Falha ao consultar run ativa ARPG.", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "A run ativa não pôde ser consultada." }, { status: 500 });
  }
}
