import { NextResponse } from "next/server";
import { z } from "zod";
import { RemotePlayerSnapshotSchema } from "@/game/player";
import { REFUGE_FURNITURE_KEYS, REFUGE_THEMES } from "@/game/refuge";
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
    action: z.literal("choose_starter"),
    creatureId: z.enum(["boitata", "iara", "curupira"]),
  }),
  z.object({ action: z.literal("activate_team"), teamId: z.string().uuid() }),
  z.object({
    action: z.literal("save_refuge"),
    companionId: z.string().min(1).max(80).nullable(),
    theme: z.enum(REFUGE_THEMES),
    furniture: z.array(refugeFurnitureSchema).max(12),
  }),
]);

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

  const [snapshotResult, profileResult, worldResult] = await Promise.all([
    auth.supabase.rpc("get_my_player_snapshot"),
    auth.supabase.from("profiles").select("avatar_config").single(),
    auth.supabase.from("player_world_state").select("current_area_id,visited_area_ids,map_positions").single(),
  ]);
  const { data, error } = snapshotResult;
  if (error) {
    console.error("Falha no snapshot remoto.", error.code);
    return NextResponse.json({ error: "Não foi possível carregar o progresso." }, { status: 503 });
  }
  const enriched = data && typeof data === "object" && !Array.isArray(data)
    ? {
        ...data,
        profile: {
          ...((data as { profile?: object }).profile ?? {}),
          avatarConfig: profileResult.data?.avatar_config,
        },
        world: {
          ...((data as { world?: object }).world ?? {}),
          currentAreaId: worldResult.data?.current_area_id ?? null,
          visitedAreaIds: worldResult.data?.visited_area_ids ?? [],
          mapPositions: worldResult.data?.map_positions ?? {},
        },
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
    const payload = mutationSchema.parse(await request.json());
    const auth = await authenticatedClient();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (payload.action === "save_refuge") {
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
            : payload.action === "choose_starter"
              ? auth.supabase.rpc("choose_starter_card", { target_creature_id: payload.creatureId })
              : auth.supabase.rpc("activate_team", { target_team_id: payload.teamId });

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
