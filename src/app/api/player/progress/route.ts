import { NextResponse } from "next/server";
import { z } from "zod";
import { ARPG_MERCHANT_PRODUCT_KEYS } from "@/game/arpg/content/merchant-catalog";
import { RemotePlayerSnapshotSchema } from "@/game/player";
import {
  REFUGE_FURNITURE_KEYS,
  REFUGE_FURNITURE_UNLOCK_ITEM_KEYS,
  REFUGE_THEMES,
} from "@/game/refuge";
import { BATTLE_BOARD_IDS } from "@/game/battle/presentation";
import { ELEMENTS } from "@/game/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refugeFurnitureSchema = z.object({
  id: z.string().min(1).max(100),
  itemKey: z.enum(REFUGE_FURNITURE_KEYS),
  x: z.number().min(8).max(92),
  y: z.number().min(24).max(88),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
});

const obsoleteTeamMutationSchema = z.object({
  action: z.enum(["activate_team", "save_team"]),
});

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("travel"), regionId: z.string().min(1).max(80) }),
  z.object({ action: z.literal("claim_treasure"), regionId: z.string().min(1).max(80) }),
  z.object({
    action: z.literal("visit_area"),
    regionId: z.string().min(1).max(80),
    areaId: z.string().min(1).max(80),
  }),
  z.object({
    action: z.literal("save_position"),
    regionId: z.string().min(1).max(80),
    x: z.number().int().min(0).max(39),
    y: z.number().int().min(0).max(24),
  }),
  z.object({
    action: z.literal("buy_energy"),
    element: z.enum(ELEMENTS),
    quantity: z.union([z.literal(1), z.literal(5)]),
  }),
  z.object({
    action: z.literal("buy_merchant_item"),
    itemKey: z.string().min(1).max(80).refine((itemKey) => ARPG_MERCHANT_PRODUCT_KEYS.has(itemKey)),
  }),
  z.object({
    action: z.literal("choose_starter"),
    creatureId: z.enum(["boitata", "iara", "curupira"]),
  }),
  z.object({ action: z.literal("evolve_creature"), instanceId: z.string().uuid() }),
  z.object({ action: z.literal("claim_mission"), missionId: z.string().min(1).max(80) }),
  z.object({ action: z.literal("save_battle_board"), boardId: z.enum(BATTLE_BOARD_IDS) }),
  z.object({
    action: z.literal("save_refuge"),
    companionId: z.string().min(1).max(80).nullable(),
    theme: z.enum(REFUGE_THEMES),
    furniture: z.array(refugeFurnitureSchema).max(12),
  }),
]);

function assertNever(value: never): never {
  throw new Error(`Ação de progresso não tratada: ${JSON.stringify(value)}`);
}

async function authenticatedClient() {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado.", status: 503 } as const;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") {
    return { ok: false, error: "Autenticação necessária.", status: 401 } as const;
  }
  return { ok: true, supabase, userId: data.claims.sub } as const;
}

export async function GET() {
  const auth = await authenticatedClient();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [snapshotResult, profileResult, worldResult, evolutionResult, missionResult] = await Promise.all([
    auth.supabase.rpc("get_my_player_snapshot"),
    auth.supabase.from("profiles").select("avatar_config").single(),
    auth.supabase.from("player_world_state").select("current_area_id,visited_area_ids,map_positions").single(),
    auth.supabase.from("player_creatures").select("id,evolution_stage"),
    auth.supabase.from("missions").select("id,objective,enabled").eq("enabled", true),
  ]);
  const { data, error } = snapshotResult;
  if (error) {
    console.error("Falha no snapshot remoto.", error.code);
    return NextResponse.json({ error: "Não foi possível carregar o progresso." }, { status: 503 });
  }
  const evolutionById = new Map(
    (evolutionResult.data ?? []).map((row) => [row.id, Number(row.evolution_stage) || 0]),
  );
  const missionTargets = new Map(
    (missionResult.data ?? []).map((row) => {
      const objective = row.objective && typeof row.objective === "object" && !Array.isArray(row.objective)
        ? row.objective as Record<string, unknown>
        : {};
      return [row.id, Math.max(1, Number(objective.count) || 1)] as const;
    }),
  );
  const raw = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : null;
  const rawCollection = Array.isArray(raw?.collection) ? raw.collection : [];
  const rawTeams = Array.isArray(raw?.teams) ? raw.teams : [];
  const rawMissions = Array.isArray(raw?.missions) ? raw.missions : [];
  const enriched = raw
    ? {
        ...raw,
        profile: {
          ...(raw.profile && typeof raw.profile === "object" ? raw.profile : {}),
          avatarConfig: profileResult.data?.avatar_config,
        },
        world: {
          ...(raw.world && typeof raw.world === "object" ? raw.world : {}),
          currentAreaId: worldResult.data?.current_area_id ?? null,
          visitedAreaIds: worldResult.data?.visited_area_ids ?? [],
          mapPositions: worldResult.data?.map_positions ?? {},
        },
        collection: rawCollection.map((entry) => {
          const creature = entry as Record<string, unknown>;
          return { ...creature, evolutionStage: evolutionById.get(String(creature.instanceId)) ?? 0 };
        }),
        teams: rawTeams.map((entry) => {
          const team = entry as Record<string, unknown>;
          const members = Array.isArray(team.members) ? team.members : [];
          return {
            ...team,
            members: members.map((member) => {
              const typed = member as Record<string, unknown>;
              return { ...typed, evolutionStage: evolutionById.get(String(typed.playerCreatureId)) ?? 0 };
            }),
          };
        }),
        missions: rawMissions
          .filter((entry) => missionTargets.has(String((entry as Record<string, unknown>).id)))
          .map((entry) => {
            const mission = entry as Record<string, unknown>;
            return { ...mission, target: missionTargets.get(String(mission.id)) ?? 1 };
          }),
      }
    : data;
  const parsed = RemotePlayerSnapshotSchema.safeParse(enriched);
  if (!parsed.success) {
    return NextResponse.json({ error: "Snapshot remoto incompatível." }, { status: 500 });
  }
  return NextResponse.json({ snapshot: parsed.data, authority: "supabase" });
}

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
    if (obsoleteTeamMutationSchema.safeParse(body).success) {
      return NextResponse.json(
        { error: "As operações de equipe foram desativadas." },
        { status: 410 },
      );
    }
    const payload = mutationSchema.parse(body);
    const auth = await authenticatedClient();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (payload.action === "evolve_creature") {
      const { data, error } = await auth.supabase.rpc("evolve_owned_creature", {
        target_instance_id: payload.instanceId,
      });
      if (error) {
        const conflict = error.code === "22023" || error.code === "P0002";
        return NextResponse.json(
          { error: conflict ? error.message : "Não foi possível evoluir esta carta." },
          { status: conflict ? 409 : 503 },
        );
      }
      return NextResponse.json({ result: data, authority: "supabase" });
    }

    if (payload.action === "claim_mission") {
      const { data, error } = await auth.supabase.rpc("claim_mission_reward", {
        target_mission_id: payload.missionId,
      });
      if (error) {
        const conflict = error.code === "22023" || error.code === "P0002";
        return NextResponse.json(
          { error: conflict ? error.message : "Não foi possível resgatar a missão." },
          { status: conflict ? 409 : 503 },
        );
      }
      return NextResponse.json({ result: data, authority: "supabase" });
    }

    if (payload.action === "save_battle_board") {
      const { data: house, error: houseError } = await auth.supabase
        .from("houses")
        .select("layout")
        .eq("user_id", auth.userId)
        .single();
      if (houseError || !house) {
        return NextResponse.json({ error: "O perfil de personalização não foi encontrado." }, { status: 404 });
      }
      const previousLayout = house.layout
        && typeof house.layout === "object"
        && !Array.isArray(house.layout)
        ? house.layout as Record<string, unknown>
        : {};
      const { error: updateError } = await auth.supabase
        .from("houses")
        .update({ layout: { ...previousLayout, preferredBattleBoard: payload.boardId } })
        .eq("user_id", auth.userId);
      if (updateError) {
        return NextResponse.json({ error: "Não foi possível salvar seu tabuleiro." }, { status: 503 });
      }
      return NextResponse.json({
        result: { boardId: payload.boardId },
        authority: "supabase",
      });
    }

    if (payload.action === "save_refuge") {
      const requiredCosmeticKeys = [...new Set(payload.furniture
        .map((item) => REFUGE_FURNITURE_UNLOCK_ITEM_KEYS[item.itemKey])
        .filter((itemKey): itemKey is string => Boolean(itemKey)))];
      if (requiredCosmeticKeys.length > 0) {
        const { data: ownedCosmetics, error: cosmeticsError } = await auth.supabase
          .from("inventory_items")
          .select("item_key,quantity")
          .eq("user_id", auth.userId)
          .in("item_key", requiredCosmeticKeys);
        if (cosmeticsError) {
          return NextResponse.json({ error: "Não foi possível validar os cosméticos do Refúgio." }, { status: 503 });
        }
        const ownedCosmeticKeys = new Set((ownedCosmetics ?? [])
          .filter((item) => item.quantity > 0)
          .map((item) => item.item_key));
        if (requiredCosmeticKeys.some((itemKey) => !ownedCosmeticKeys.has(itemKey))) {
          return NextResponse.json(
            { error: "Compre os móveis especiais no Mercador antes de usá-los no Refúgio." },
            { status: 409 },
          );
        }
      }

      if (payload.companionId) {
        const { data: owned, error: ownedError } = await auth.supabase
          .from("player_creatures")
          .select("id")
          .eq("user_id", auth.userId)
          .eq("creature_id", payload.companionId)
          .limit(1)
          .maybeSingle();
        if (ownedError) {
          return NextResponse.json({ error: "Não foi possível validar a lenda escolhida." }, { status: 503 });
        }
        if (!owned) {
          return NextResponse.json(
            { error: "Você só pode exibir no Refúgio uma lenda que realmente possui." },
            { status: 409 },
          );
        }
      }

      const { data: house, error: houseError } = await auth.supabase
        .from("houses")
        .select("layout")
        .eq("user_id", auth.userId)
        .single();
      if (houseError || !house) {
        return NextResponse.json({ error: "O Refúgio desta conta não foi encontrado." }, { status: 404 });
      }

      const previousLayout = house.layout
        && typeof house.layout === "object"
        && !Array.isArray(house.layout)
        ? house.layout as Record<string, unknown>
        : {};
      const nextLayout = {
        ...previousLayout,
        residentCreatureId: payload.companionId,
        furniture: payload.furniture,
      };

      const { data: updatedHouse, error: updateError } = await auth.supabase
        .from("houses")
        .update({ theme: payload.theme, layout: nextLayout })
        .eq("user_id", auth.userId)
        .select("id,theme,layout")
        .single();
      if (updateError || !updatedHouse) {
        return NextResponse.json({ error: "Não foi possível salvar a decoração do Refúgio." }, { status: 503 });
      }

      return NextResponse.json({
        result: {
          companionId: payload.companionId,
          theme: updatedHouse.theme,
          furniture: payload.furniture,
        },
        authority: "supabase",
      });
    }

    const rpc = payload.action === "travel"
      ? auth.supabase.rpc("travel_to_region", { target_region_id: payload.regionId })
      : payload.action === "claim_treasure"
        ? auth.supabase.rpc("claim_region_treasure", { target_region_id: payload.regionId })
        : payload.action === "visit_area"
          ? auth.supabase.rpc("visit_region_area", {
              target_region_id: payload.regionId,
              target_area_id: payload.areaId,
            })
          : payload.action === "save_position"
            ? auth.supabase.rpc("save_world_position", {
                target_region_id: payload.regionId,
                target_x: payload.x,
                target_y: payload.y,
              })
          : payload.action === "buy_energy"
            ? auth.supabase.rpc("buy_energy_pack", {
                target_element: payload.element,
                target_quantity: payload.quantity,
              })
            : payload.action === "buy_merchant_item"
              ? auth.supabase.rpc("purchase_arpg_merchant_item", {
                  target_item_key: payload.itemKey,
                })
            : payload.action === "choose_starter"
              ? auth.supabase.rpc("choose_starter_card", { target_creature_id: payload.creatureId })
              : assertNever(payload);

    const { data, error } = await rpc;
    if (error) {
      const conflict = error.code === "23505" || error.code === "22023";
      return NextResponse.json(
        {
          error: conflict
            ? "A ação conflita com o estado atual do progresso. Atualize o jogo e tente novamente."
            : "A alteração remota não pôde ser concluída.",
        },
        { status: conflict ? 409 : 503 },
      );
    }
    return NextResponse.json({ result: data, authority: "supabase" });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "A alteração de progresso é inválida."
      : "Não foi possível processar a alteração.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
